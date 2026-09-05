"""投递接口 — 求职端岗位详情「去投递/联系」

两类岗位两种投递方式：
- 企业已入驻星图（enterprises.company_name 能对上爬虫岗位的 company_name）
  → 站内投递：把爬虫岗位镜像进 enterprise_jobs，建 match_record 并落首条消息，
    企业端「消息」页立刻能看到这个对话（status=communicating）。
- 未入驻 → 返回 source_url，前端弹窗后跳转原招聘网站。

@owner: 张boy（人岗匹配模块）
"""

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field
from typing import Optional
from urllib.parse import quote

from database import get_session, CrawledJob, Job, Jobseeker, Enterprise, MatchRecord, Message

router = APIRouter(prefix='/api/apply', tags=['apply'])

# 爬虫数据 source_url 普遍为空（实测 618 条岗位 0 条有链接），
# 未入驻企业跳转时按来源渠道拼搜索页兜底，保证「跳转到对应的招聘网站」一定可点
_SOURCE_SEARCH = {
    'boss': 'https://www.zhipin.com/web/geek/job?query={kw}&city=100010000',
    '拉勾': 'https://www.lagou.com/wn/jobs?kd={kw}',
    '猎聘': 'https://www.liepin.com/zhaopin/?key={kw}',
    '智联': 'https://sou.zhaopin.com/?kw={kw}',
    '51job': 'https://we.51job.com/pc/search?keyword={kw}&jobArea=000000',
    '前程无忧': 'https://we.51job.com/pc/search?keyword={kw}&jobArea=000000',
}


def _jump_url(job: CrawledJob) -> str:
    """优先原始链接；缺失时按 source 渠道拼「公司+岗位」搜索链接，再兜底百度"""
    if job.source_url:
        return job.source_url
    kw = quote(f'{job.company_name or ""}{job.title or ""}')
    src = (job.source or '').lower()
    for key, tpl in _SOURCE_SEARCH.items():
        if key in src:
            return tpl.format(kw=kw)
    return f'https://www.baidu.com/s?wd={kw}招聘'


def _err(code: str, message: str, details=None):
    return {'success': False, 'error': {'code': code, 'message': message, 'details': details or {}}}


def _find_enterprise(session, company_name: str):
    """按公司名找入驻企业 — 精确匹配优先，双向包含兜底（如「字节跳动」vs「字节跳动有限公司」）"""
    if not company_name:
        return None
    ent = session.query(Enterprise).filter(Enterprise.company_name == company_name).first()
    if ent:
        return ent
    like = f'%{company_name}%'
    for e in session.query(Enterprise).filter(Enterprise.company_name.like(like)).all():
        if e.company_name and (e.company_name in company_name or company_name in e.company_name):
            return e
    return None


def _channel_payload(job: CrawledJob, ent: Optional[Enterprise]) -> dict:
    return {
        'job_id': job.id,
        'title': job.title or '',
        'company': job.company_name or '',
        'salary': job.salary_min and job.salary_max and f'{job.salary_min // 1000}K-{job.salary_max // 1000}K' or '面议',
        'location': f'{job.city or ""}{job.area or ""}'.strip(),
        'source': job.source or '',
        'source_url': job.source_url or '',
        'jump_url': _jump_url(job),
        'onboarded': ent is not None,
        'enterprise_id': ent.id if ent else None,
    }


@router.get('/channel/{job_id}')
def get_apply_channel(job_id: int):
    """投递渠道判定 — 企业入驻星图走站内投递，否则跳转原招聘网站"""
    session = get_session()
    try:
        job = session.query(CrawledJob).filter(CrawledJob.id == job_id, CrawledJob.data_type == 1).first()
        if not job:
            return _err('JOB_NOT_FOUND', f'岗位不存在: id={job_id}')
        ent = _find_enterprise(session, job.company_name or '')
        return {'success': True, 'data': _channel_payload(job, ent), 'message': 'ok'}
    except Exception as e:
        return _err('CHANNEL_ERROR', f'查询投递渠道失败: {e}')
    finally:
        session.close()


class ApplyReq(BaseModel):
    jobseeker_id: int = Field(..., description='求职者 ID（xingtu_user.id）')
    message: str = Field('', max_length=2000, description='附言，默认为标准投递语')


def _mirror_to_enterprise_job(session, job: CrawledJob, enterprise_id: int) -> Job:
    """把爬虫岗位镜像成企业端岗位（同企业同标题只建一次），返回企业岗位记录"""
    existing = (session.query(Job)
                .filter(Job.enterprise_id == enterprise_id, Job.title == (job.title or ''))
                .first())
    if existing:
        return existing
    skills = ','.join(job.skill_tags or [])
    salary_min_k = job.salary_min // 1000 if job.salary_min else None
    salary_max_k = job.salary_max // 1000 if job.salary_max else None
    mirrored = Job(
        enterprise_id=enterprise_id,
        title=job.title or '未命名岗位',
        description=(job.job_description or '')[:2000],
        location=f'{job.city or ""}{job.area or ""}'.strip(),
        salary_min=salary_min_k,
        salary_max=salary_max_k,
        salary_range=f'{salary_min_k}K-{salary_max_k}K' if salary_min_k and salary_max_k else '',
        education=job.education or '',
        experience=job.experience or '',
        skills_required=skills[:500],
        status='active',
    )
    session.add(mirrored)
    session.flush()   # 拿到自增 id
    return mirrored


@router.post('/{job_id}')
def apply_job(job_id: int, req: ApplyReq):
    """站内投递 — 仅入驻企业可用；成功后企业端「消息」列表立即可见"""
    session = get_session()
    try:
        job = session.query(CrawledJob).filter(CrawledJob.id == job_id, CrawledJob.data_type == 1).first()
        if not job:
            return _err('JOB_NOT_FOUND', f'岗位不存在: id={job_id}')

        ent = _find_enterprise(session, job.company_name or '')
        if not ent:
            # 未入驻：把原网站链接带回给前端做跳转
            return _err('NOT_ONBOARDED', '该企业未入驻星图，请前往原招聘网站投递',
                        {'source': job.source or '', 'source_url': job.source_url or '', 'jump_url': _jump_url(job)})

        seeker = session.query(Jobseeker).filter(Jobseeker.id == req.jobseeker_id).first()
        if not seeker:
            return _err('SEEKER_NOT_FOUND', f'求职者不存在: id={req.jobseeker_id}')

        ent_job = _mirror_to_enterprise_job(session, job, ent.id)

        # 同一人对同一岗位重复投递 → 复用已有 match_record，追加消息
        mr = (session.query(MatchRecord)
              .filter(MatchRecord.job_id == ent_job.id, MatchRecord.jobseeker_id == req.jobseeker_id)
              .first())
        if not mr:
            mr = MatchRecord(job_id=ent_job.id, jobseeker_id=req.jobseeker_id, status='communicating')
            session.add(mr)
            session.flush()

        content = req.message.strip() or f'您好，我对贵司「{ent_job.title}」岗位很感兴趣，已投递简历，期待与您沟通。'
        msg = Message(match_record_id=mr.id, sender_type='jobseeker',
                      sender_id=req.jobseeker_id, content=content, is_read=0)
        session.add(msg)
        if mr.status == 'pending':
            mr.status = 'communicating'
        session.commit()

        return {
            'success': True,
            'data': {
                'match_record_id': mr.id,
                'job_title': ent_job.title,
                'company': ent.company_name or job.company_name or '',
            },
            'message': '投递成功，可在「消息」中与 HR 沟通',
        }
    except Exception as e:
        session.rollback()
        return _err('APPLY_ERROR', f'投递失败: {e}')
    finally:
        session.close()


@router.get('/status')
def apply_status(job_id: int = Query(...), jobseeker_id: int = Query(...)):
    """查询某岗位是否已投递过（详情页按钮态用）"""
    session = get_session()
    try:
        job = session.query(CrawledJob).filter(CrawledJob.id == job_id).first()
        if not job:
            return {'success': True, 'data': {'applied': False}, 'message': 'ok'}
        ent = _find_enterprise(session, job.company_name or '')
        applied = False
        if ent:
            ent_job = (session.query(Job)
                       .filter(Job.enterprise_id == ent.id, Job.title == (job.title or ''))
                       .first())
            if ent_job:
                applied = session.query(MatchRecord).filter(
                    MatchRecord.job_id == ent_job.id,
                    MatchRecord.jobseeker_id == jobseeker_id).count() > 0
        return {'success': True, 'data': {'applied': applied}, 'message': 'ok'}
    finally:
        session.close()
