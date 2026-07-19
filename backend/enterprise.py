"""企业端接口 — 人才星（候选人搜索）

数据来源：jobs / jobseekers / match_records 三表联查
- jobs          : 企业发布的岗位（用于岗位下拉）
- jobseekers    : 求职者信息（候选人基本资料）
- match_records : 人岗匹配记录（match_score 及三维度分数）

字段映射约定（前端 TalentSearch.tsx 依赖）:
    experience  -> exp
    match_score -> match
    avatar_text -> av   (取 real_name 首字)
"""

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field
from typing import Optional

from database import get_session, Job, Jobseeker, MatchRecord
from match_engine import run_match_batch

router = APIRouter(prefix='/api/enterprise', tags=['enterprise'])


def _err(code: str, message: str, details=None):
    """统一错误响应格式: {success:false, error:{code, message, details}}"""
    return {'success': False, 'error': {'code': code, 'message': message, 'details': details or {}}}


def _candidate_dict(mr: MatchRecord, js: Jobseeker, job: Job):
    """组装单个候选人字典，字段名按前端约定映射"""
    # 技能列表：DB 中是逗号分隔字符串，转成数组便于前端渲染
    skills = [s.strip() for s in (js.skills or '').split(',') if s.strip()]
    # 头像文字：优先 real_name 首字，其次 username 首字
    name = js.real_name or js.username or '匿名'
    av = name[0] if name else '?'
    return {
        # 注意：id 用 match_record.id（唯一），不用 jobseeker.id
        # 因为"全部岗位"模式下同一求职者会因匹配多个岗位出现多次，jobseeker.id 会重复导致前端 key 冲突
        'id': mr.id,
        'jobseeker_id': js.id,                    # 求职者原始 id（供前端按需使用）
        'name': name,
        'title': js.target_position or '',          # 当前求职意向岗位
        'skills': skills,
        'exp': js.experience or '',                 # experience -> exp
        'salary': js.expected_salary or '',
        'match': mr.match_score,                    # match_score -> match (可能为 None)
        'av': av,                                   # avatar_text -> av
        # 三维度分数（可能为 None，前端按需展示）
        'match_breakdown': {
            'skill': mr.skill_match,
            'exp': mr.exp_match,
            'salary': mr.salary_match,
        },
        'match_status': mr.status or 'pending',     # pending/accepted/rejected
        'job_title': job.title if job else '',
    }


@router.get('/candidates')
def list_candidates(
    job_id: int = Query(None, description='按岗位 ID 过滤'),
    keyword: str = Query('', description='按姓名/技能关键字过滤'),
    page: int = Query(1, ge=1, description='页码，从 1 开始'),
    size: int = Query(10, ge=1, le=100, description='每页条数'),
):
    """
    人才星 — 候选人列表
    返回结构:
        {
          "success": true,
          "data": {
            "jobs": [...],          # 当前企业的岗位下拉列表（含每个岗位的候选人数）
            "candidates": [...],    # 当前页候选人
            "total": int, "page": int, "size": int
          }
        }
    """
    session = get_session()
    try:
        # ── 1. 岗位下拉：当前企业所有岗位 + 每个岗位的候选人数 ──
        jobs_query = session.query(Job).filter(Job.status == 'active')
        jobs_list = []
        for j in jobs_query.all():
            cnt = session.query(MatchRecord).filter(MatchRecord.job_id == j.id).count()
            jobs_list.append({
                'id': j.id,
                'title': j.title,
                'status': j.status,
                'count': cnt,
            })

        # ── 2. 候选人查询：match_records JOIN jobseekers ──
        q = (session.query(MatchRecord, Jobseeker, Job)
             .join(Jobseeker, MatchRecord.jobseeker_id == Jobseeker.id)
             .join(Job, MatchRecord.job_id == Job.id, isouter=True))

        # 按 job_id 过滤
        if job_id:
            q = q.filter(MatchRecord.job_id == job_id)

        # 关键字过滤：匹配姓名或技能
        if keyword:
            kw = f'%{keyword}%'
            q = q.filter(
                (Jobseeker.real_name.like(kw)) |
                (Jobseeker.username.like(kw)) |
                (Jobseeker.skills.like(kw)) |
                (Jobseeker.target_position.like(kw))
            )

        # 按匹配度降序，NULL 排在最后
        # 注：MySQL 不支持 NULLS LAST 语法，用 `match_score IS NULL` 实现
        #     （IS NULL 返回 0/1，0 在前 1 在后，配合 DESC 实现非空降序 + 空值垫底）
        q = q.order_by(
            MatchRecord.match_score.is_(None),
            MatchRecord.match_score.desc(),
            MatchRecord.id.desc(),
        )

        total = q.count()
        # 分页
        rows = q.offset((page - 1) * size).limit(size).all()

        candidates = [_candidate_dict(mr, js, job) for mr, js, job in rows]

        return {
            'success': True,
            'data': {
                'jobs': jobs_list,
                'candidates': candidates,
                'total': total,
                'page': page,
                'size': size,
            },
            'message': 'ok',
        }
    except Exception as e:
        # 统一错误格式，避免泄露堆栈
        return _err('INTERNAL_ERROR', f'查询候选人失败: {e}')
    finally:
        session.close()


@router.post('/run-match')
def trigger_match():
    """
    手动触发匹配引擎 — 遍历所有 active 岗位 × 所有求职者，计算分数并写入 match_records。
    用作 demo：前端点"重新匹配"按钮即调用此接口，跑完后刷新候选人列表即可看到真实分数。

    返回结构:
        {
          "success": true,
          "data": {
            "total_jobs": int, "total_seekers": int, "total_matches": int,
            "sample": {job_title, seeker_name, skill, exp, salary, total}  # 首个样本
          }
        }
    """
    try:
        result = run_match_batch()
        return {
            'success': True,
            'data': result,
            'message': f"匹配完成: {result['total_matches']} 条记录已更新",
        }
    except Exception as e:
        return _err('MATCH_ENGINE_ERROR', f'匹配引擎执行失败: {e}')


@router.get('/dashboard')
def dashboard():
    """
    企业仪表盘汇总数据 — 全部来自 jobs / match_records 真实表数据
    返回结构:
        {
          "success": true,
          "data": {
            "metrics": {
              "active_jobs": int,        # 在招岗位数
              "total_candidates": int,   # 匹配候选人总数（去重）
              "high_match": int,         # 高匹配度候选人数（>=85）
              "pending_count": int       # 待处理匹配记录数
            },
            "recent_jobs": [             # 近期岗位（最近 5 条），含候选人数
              {id, title, status, candidates, created_at}
            ],
            "match_distribution": {       # 匹配度分布
              "high": int, "mid": int, "low": int
            }
          }
        }
    """
    session = get_session()
    try:
        # ── 指标卡数据 ──
        active_jobs = session.query(Job).filter(Job.status == 'active').count()
        # 匹配候选人总数（去重 jobseeker_id）
        total_candidates = (session.query(MatchRecord.jobseeker_id)
                            .distinct().count())
        # 高匹配度候选人数（match_score >= 85）
        high_match = (session.query(MatchRecord)
                      .filter(MatchRecord.match_score >= 85).count())
        # 待处理沟通：独立候选人数（去重 jobseeker_id）
        # 注：同一求职者匹配多个岗位会产生多条 pending 记录，但对 HR 而言"待联系的人"才是有意义的指标
        pending_count = (session.query(MatchRecord.jobseeker_id)
                         .filter(MatchRecord.status == 'pending')
                         .distinct().count())

        # ── 近期岗位（按创建时间倒序，前 5 条）──
        recent_jobs_rows = (session.query(Job)
                            .order_by(Job.created_at.desc())
                            .limit(5).all())
        recent_jobs = []
        for j in recent_jobs_rows:
            cnt = session.query(MatchRecord).filter(MatchRecord.job_id == j.id).count()
            recent_jobs.append({
                'id': j.id,
                'title': j.title,
                'status': j.status,
                'candidates': cnt,
                'created_at': j.created_at.strftime('%Y-%m-%d') if j.created_at else '',
            })

        # ── 匹配度分布 ──
        high = session.query(MatchRecord).filter(MatchRecord.match_score >= 85).count()
        mid = session.query(MatchRecord).filter(
            MatchRecord.match_score >= 60, MatchRecord.match_score < 85
        ).count()
        low = session.query(MatchRecord).filter(MatchRecord.match_score < 60).count()

        return {
            'success': True,
            'data': {
                'metrics': {
                    'active_jobs': active_jobs,
                    'total_candidates': total_candidates,
                    'high_match': high_match,
                    'pending_count': pending_count,
                },
                'recent_jobs': recent_jobs,
                'match_distribution': {'high': high, 'mid': mid, 'low': low},
            },
            'message': 'ok',
        }
    except Exception as e:
        return _err('INTERNAL_ERROR', f'查询仪表盘失败: {e}')
    finally:
        session.close()


@router.get('/jobs')
def list_enterprise_jobs(
    status: str = Query('', description='按状态过滤: active/closed/draft'),
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
):
    """
    企业岗位列表（带候选人数） — 供 JobManage 页面使用
    返回结构:
        {
          "success": true,
          "data": {
            "jobs": [{id, title, location, salary_range, experience, skills_required, status, candidates, created_at}],
            "total": int, "page": int, "size": int
          }
        }
    """
    session = get_session()
    try:
        q = session.query(Job)
        if status:
            q = q.filter(Job.status == status)

        total = q.count()
        rows = q.order_by(Job.created_at.desc()).offset((page - 1) * size).limit(size).all()

        jobs = []
        for j in rows:
            # 每个岗位的候选人数（来自 match_records）
            cnt = session.query(MatchRecord).filter(MatchRecord.job_id == j.id).count()
            jobs.append({
                'id': j.id,
                'title': j.title,
                'location': j.location or '',
                'salary_range': j.salary_range or '',
                'experience': j.experience or '',
                'skills_required': j.skills_required or '',
                'status': j.status or 'active',
                'candidates': cnt,
                'created_at': j.created_at.strftime('%Y-%m-%d') if j.created_at else '',
            })

        return {
            'success': True,
            'data': {'jobs': jobs, 'total': total, 'page': page, 'size': size},
            'message': 'ok',
        }
    except Exception as e:
        return _err('INTERNAL_ERROR', f'查询岗位列表失败: {e}')
    finally:
        session.close()


# ─── 岗位 CRUD：支撑岗位管理页面的发布/编辑/查看/状态切换 ────────────────

# 默认企业 ID（demo 阶段未接 JWT 用户上下文，统一归属 id=1 的企业）
DEFAULT_ENTERPRISE_ID = 1


class JobCreateReq(BaseModel):
    """创建/更新岗位的请求体"""
    title: str = Field(..., min_length=1, max_length=200, description='岗位名称')
    description: str = Field('', max_length=2000, description='岗位描述')
    location: str = Field('', max_length=100, description='工作城市')
    salary_min: Optional[int] = Field(None, ge=0, description='薪资下限(K)')
    salary_max: Optional[int] = Field(None, ge=0, description='薪资上限(K)')
    salary_range: str = Field('', max_length=50, description='展示用薪资字符串，如 30K-50K')
    education: str = Field('', max_length=50, description='学历要求')
    experience: str = Field('', max_length=100, description='经验要求，如 3-5年')
    skills_required: str = Field('', max_length=500, description='要求技能，逗号分隔')
    status: str = Field('active', description='状态: active/draft/closed')


class JobStatusReq(BaseModel):
    """修改岗位状态的请求体"""
    status: str = Field(..., description='目标状态: active/closed/draft')


def _job_to_dict(j: Job, candidates: Optional[int] = None) -> dict:
    """把 Job ORM 对象转成前端可用的字典"""
    cnt = candidates if candidates is not None else 0
    return {
        'id': j.id,
        'enterprise_id': j.enterprise_id,
        'title': j.title,
        'description': j.description or '',
        'location': j.location or '',
        'salary_min': j.salary_min,
        'salary_max': j.salary_max,
        'salary_range': j.salary_range or '',
        'education': j.education or '',
        'experience': j.experience or '',
        'skills_required': j.skills_required or '',
        'status': j.status or 'active',
        'candidates': cnt,
        'created_at': j.created_at.strftime('%Y-%m-%d') if j.created_at else '',
        'updated_at': j.updated_at.strftime('%Y-%m-%d %H:%M') if j.updated_at else '',
    }


@router.post('/jobs')
def create_job(req: JobCreateReq):
    """
    创建岗位 — 供"发布新岗位"按钮调用
    成功返回新岗位详情（含 candidates=0）
    """
    # 状态白名单校验，防止前端传非法值
    if req.status not in ('active', 'draft', 'closed'):
        return _err('INVALID_STATUS', f'非法状态值: {req.status}')

    session = get_session()
    try:
        job = Job(
            enterprise_id=DEFAULT_ENTERPRISE_ID,
            title=req.title,
            description=req.description,
            location=req.location,
            salary_min=req.salary_min,
            salary_max=req.salary_max,
            salary_range=req.salary_range,
            education=req.education,
            experience=req.experience,
            skills_required=req.skills_required,
            status=req.status,
        )
        session.add(job)
        session.commit()
        session.refresh(job)
        return {
            'success': True,
            'data': _job_to_dict(job, candidates=0),
            'message': f'岗位「{job.title}」发布成功',
        }
    except Exception as e:
        session.rollback()
        return _err('CREATE_JOB_ERROR', f'创建岗位失败: {e}')
    finally:
        session.close()


@router.get('/jobs/{job_id}')
def get_job(job_id: int):
    """
    岗位详情 — 供"查看"按钮调用
    返回完整字段 + 候选人数
    """
    session = get_session()
    try:
        job = session.query(Job).filter(Job.id == job_id).first()
        if not job:
            return _err('JOB_NOT_FOUND', f'岗位不存在: id={job_id}')
        cnt = session.query(MatchRecord).filter(MatchRecord.job_id == job_id).count()
        return {
            'success': True,
            'data': _job_to_dict(job, candidates=cnt),
            'message': 'ok',
        }
    except Exception as e:
        return _err('INTERNAL_ERROR', f'查询岗位详情失败: {e}')
    finally:
        session.close()


@router.put('/jobs/{job_id}')
def update_job(job_id: int, req: JobCreateReq):
    """
    更新岗位 — 供"编辑"按钮调用
    所有字段全量更新
    """
    if req.status not in ('active', 'draft', 'closed'):
        return _err('INVALID_STATUS', f'非法状态值: {req.status}')

    session = get_session()
    try:
        job = session.query(Job).filter(Job.id == job_id).first()
        if not job:
            return _err('JOB_NOT_FOUND', f'岗位不存在: id={job_id}')

        job.title = req.title
        job.description = req.description
        job.location = req.location
        job.salary_min = req.salary_min
        job.salary_max = req.salary_max
        job.salary_range = req.salary_range
        job.education = req.education
        job.experience = req.experience
        job.skills_required = req.skills_required
        job.status = req.status

        session.commit()
        session.refresh(job)
        cnt = session.query(MatchRecord).filter(MatchRecord.job_id == job_id).count()
        return {
            'success': True,
            'data': _job_to_dict(job, candidates=cnt),
            'message': f'岗位「{job.title}」已更新',
        }
    except Exception as e:
        session.rollback()
        return _err('UPDATE_JOB_ERROR', f'更新岗位失败: {e}')
    finally:
        session.close()


@router.patch('/jobs/{job_id}/status')
def update_job_status(job_id: int, req: JobStatusReq):
    """
    修改岗位状态 — 供"关闭岗位/重新开放"按钮调用
    仅修改 status 字段
    """
    if req.status not in ('active', 'draft', 'closed'):
        return _err('INVALID_STATUS', f'非法状态值: {req.status}')

    session = get_session()
    try:
        job = session.query(Job).filter(Job.id == job_id).first()
        if not job:
            return _err('JOB_NOT_FOUND', f'岗位不存在: id={job_id}')

        job.status = req.status
        session.commit()
        session.refresh(job)
        cnt = session.query(MatchRecord).filter(MatchRecord.job_id == job_id).count()
        return {
            'success': True,
            'data': _job_to_dict(job, candidates=cnt),
            'message': f'岗位状态已更新为「{_status_label(req.status)}」',
        }
    except Exception as e:
        session.rollback()
        return _err('UPDATE_STATUS_ERROR', f'更新状态失败: {e}')
    finally:
        session.close()


@router.delete('/jobs/{job_id}')
def delete_job(job_id: int):
    """
    删除岗位 — 同时清理关联的匹配记录
    供"删除"按钮调用
    """
    session = get_session()
    try:
        job = session.query(Job).filter(Job.id == job_id).first()
        if not job:
            return _err('JOB_NOT_FOUND', f'岗位不存在: id={job_id}')

        title = job.title
        # 先删除关联的匹配记录（外键约束）
        session.query(MatchRecord).filter(MatchRecord.job_id == job_id).delete()
        session.delete(job)
        session.commit()
        return {
            'success': True,
            'data': {'id': job_id},
            'message': f'岗位「{title}」已删除',
        }
    except Exception as e:
        session.rollback()
        return _err('DELETE_JOB_ERROR', f'删除岗位失败: {e}')
    finally:
        session.close()


def _status_label(status: str) -> str:
    """状态码转中文，供消息展示"""
    return {'active': '招聘中', 'draft': '草稿', 'closed': '已关闭'}.get(status, status)
