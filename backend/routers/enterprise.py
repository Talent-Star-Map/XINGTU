"""企业端接口 — 人才星（候选人搜索）

数据来源：jobs / jobseekers / match_records 三表联查
- jobs          : 企业发布的岗位（用于岗位下拉）
- jobseekers    : 求职者信息（候选人基本资料）
- match_records : 人岗匹配记录（match_score 及三维度分数）

字段映射约定（前端 TalentSearch.tsx 依赖）:
    experience  -> exp
    match_score -> match
    avatar_text -> av   (取 real_name 首字)

@owner: 阳总&洋总（人岗匹配+企业端人才星界面）；实际由张东阳开发
"""

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field
from typing import Optional
from sqlalchemy import func

from database import get_session, Job, Jobseeker, MatchRecord, Message
from sqlalchemy import func as _func
from services.deerflow_compare import run_deep_compare
# services 模块已迁移到 services/ 子目录
from services.match_engine import run_match_batch

router = APIRouter(prefix='/api/enterprise', tags=['enterprise'])


def _err(code: str, message: str, details=None):
    """统一错误响应格式: {success:false, error:{code, message, details}}"""
    return {'success': False, 'error': {'code': code, 'message': message, 'details': details or {}}}


def _like_escape(s: str) -> str:
    """转义 LIKE 通配符，防止 % _ 注入"""
    return s.replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_')


def _candidate_dict(mr: MatchRecord, js: Jobseeker, job: Job):
    """组装单个候选人字典，字段名按前端约定映射（五维度版）"""
    # 技能列表：DB 中是逗号分隔字符串，转成数组便于前端渲染
    skills = [s.strip() for s in (js.skills or '').split(',') if s.strip()]
    # 头像文字：优先 real_name 首字，其次 username 首字
    name = js.real_name or js.username or '匿名'
    av = name[0] if name else '?'
    return {
        'id': mr.id,
        'jobseeker_id': js.id,
        'name': name,
        'title': js.target_position or '',
        'skills': skills,
        'exp': js.experience or '',
        'salary': js.expected_salary or '',
        'education': js.education or '',           # 学历（新增，对比面板用）
        'city': js.target_city or js.city or '',    # 意向城市（新增，对比面板用）
        'match': mr.match_score,
        'av': av,
        # 五维度分数（可能为 None，前端按需展示）
        'match_breakdown': {
            'skill': mr.skill_match,
            'exp': mr.exp_match,
            'edu': mr.edu_match,
            'location': mr.location_match,
            'salary': mr.salary_match,
        },
        'match_status': mr.status or 'pending',
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
        # ── 1. 岗位下拉：当前企业所有岗位 + 每个岗位的候选人数（批量查，避免 N+1）──
        from sqlalchemy import func as _func
        jobs_query = session.query(Job).filter(Job.status == 'active')
        job_ids = [j.id for j in jobs_query.all()]
        cnt_map = {}
        if job_ids:
            cnt_rows = (session.query(MatchRecord.job_id, _func.count())
                        .filter(MatchRecord.job_id.in_(job_ids))
                        .group_by(MatchRecord.job_id).all())
            cnt_map = {jid: c for jid, c in cnt_rows}
        jobs_list = [{'id': j.id, 'title': j.title, 'status': j.status, 'count': cnt_map.get(j.id, 0)}
                     for j in jobs_query.all()]

        # ── 2. 候选人查询：match_records JOIN jobseekers ──
        q = (session.query(MatchRecord, Jobseeker, Job)
             .join(Jobseeker, MatchRecord.jobseeker_id == Jobseeker.id)
             .join(Job, MatchRecord.job_id == Job.id, isouter=True))

        # 按 job_id 过滤
        if job_id:
            q = q.filter(MatchRecord.job_id == job_id)

        # 关键字过滤：匹配姓名或技能
        if keyword:
            kw = f'%{_like_escape(keyword)}%'
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
    手动触发匹配引擎 — 遍历所有 active 岗位 × 所有求职者，计算五维度分数并写入 match_records。
    用作 demo：前端点"重新匹配"按钮即调用此接口，跑完后刷新候选人列表即可看到真实分数。

    返回结构:
        {
          "success": true,
          "data": {
            "total_jobs": int, "total_seekers": int, "total_matches": int,
            "dimensions": 5,
            "algorithm": "TF-IDF + Gaussian + IoU + Level Mapping",
            "sample": {job_title, seeker_name, skill, exp, edu, location, salary, total}
          }
        }
    """
    try:
        result = run_match_batch()
        return {
            'success': True,
            'data': result,
            'message': f"五维度匹配完成: {result['total_matches']} 条记录已更新",
        }
    except Exception as e:
        return _err('MATCH_ENGINE_ERROR', f'匹配引擎执行失败: {e}')


class CompareReq(BaseModel):
    """候选人对比请求体（支持 2~10 人对比，前端可配置上限）"""
    ids: list[int] = Field(..., min_length=2, max_length=10, description='要对比的 match_record id 列表（2-10个）')


@router.post('/candidates/compare')
def compare_candidates(req: CompareReq):
    """
    候选人对比 — 支持同时对比 2-10 个候选人（前端可配置上限）

    返回结构:
        {
          "success": true,
          "data": {
            "candidates": [...],          # 各候选人详情（含五维度分数）
            "skill_analysis": {            # 技能交集/差异分析
              "common": [...],             # 共同拥有的技能
              "unique": {id: [...]}        # 各候选人独有的技能
            },
            "dimension_ranking": [...]     # 各维度最优候选人
          }
        }
    """
    session = get_session()
    try:
        # 查询指定的 match_records（含关联的 jobseeker 和 job）
        rows = (session.query(MatchRecord, Jobseeker, Job)
                .join(Jobseeker, MatchRecord.jobseeker_id == Jobseeker.id)
                .join(Job, MatchRecord.job_id == Job.id, isouter=True)
                .filter(MatchRecord.id.in_(req.ids))
                .all())

        if len(rows) < 2:
            return _err('COMPARE_NEED_MORE', '对比至少需要 2 个候选人')

        candidates = [_candidate_dict(mr, js, job) for mr, js, job in rows]

        # ── 技能交集/差异分析 ──
        skill_sets = [set(c['skills']) for c in candidates]
        # 交集：所有候选人都拥有的技能
        common = sorted(set.intersection(*skill_sets)) if skill_sets else []
        # 各候选人独有技能
        unique = {}
        for i, c in enumerate(candidates):
            others = set()
            for j, s in enumerate(skill_sets):
                if i != j:
                    others |= s
            unique[c['id']] = sorted(skill_sets[i] - others)

        # ── 各维度排名（分数最高的候选人）──
        dims = ['skill', 'exp', 'edu', 'location', 'salary']
        dimension_ranking = []
        for dim in dims:
            ranked = sorted(candidates, key=lambda c: c['match_breakdown'].get(dim) or 0, reverse=True)
            best = ranked[0]
            dimension_ranking.append({
                'dimension': dim,
                'best_id': best['id'],
                'best_name': best['name'],
                'best_score': best['match_breakdown'].get(dim),
                'scores': {c['id']: c['match_breakdown'].get(dim) for c in candidates},
            })

        return {
            'success': True,
            'data': {
                'candidates': candidates,
                'skill_analysis': {
                    'common': common,
                    'unique': unique,
                },
                'dimension_ranking': dimension_ranking,
            },
            'message': 'ok',
        }
    except Exception as e:
        return _err('COMPARE_ERROR', f'对比失败: {e}')
    finally:
        session.close()


@router.post('/candidates/deep-compare')
def deep_compare_candidates(req: CompareReq):
    """
    候选人 AI 深度对比 — 基于 DeerFlow 编排的多 Agent 协同分析

    在规则引擎对比的基础上，调用 LongCat LLM 进行语义级深度分析:
        Agent 1「技能迁移分析师」— 可迁移能力、语义相似、技能缺口
        Agent 2「综合决策报告师」— 排名建议、优势/劣势/风险、推荐理由

    返回结构:
        {
          "success": true,
          "data": {
            "ranking": [{candidate_id, candidate_name, rank, strengths, weaknesses, risks, recommendation}],
            "overall_summary": "整体对比总结",
            "key_insights": ["关键洞察"],
            "skill_analysis": {...},  // Agent 1 输出
            "agents_trace": [...]     // Agent 执行轨迹
          }
        }
    """
    session = get_session()
    try:
        # 复用规则引擎的候选人数据（含五维度分数）
        rows = (session.query(MatchRecord, Jobseeker, Job)
                .join(Jobseeker, MatchRecord.jobseeker_id == Jobseeker.id)
                .join(Job, MatchRecord.job_id == Job.id, isouter=True)
                .filter(MatchRecord.id.in_(req.ids))
                .all())

        if len(rows) < 2:
            return _err('COMPARE_NEED_MORE', '对比至少需要 2 个候选人')

        candidates = [_candidate_dict(mr, js, job) for mr, js, job in rows]

        # 构造岗位信息（取第一个候选人的关联岗位）
        first_job = rows[0][2]
        job_info = {
            'title': first_job.title if first_job else '未知岗位',
            'skills_required': [s.strip() for s in (first_job.skills_required or '').split(',') if s.strip()] if first_job else [],
            'experience': first_job.experience if first_job else '',
            'education': first_job.education if first_job else '',
        }

        # 调用 DeerFlow 编排器
        result = run_deep_compare(candidates, job_info)

        if result['success']:
            return {'success': True, 'data': result['data'], 'message': 'AI 深度分析完成'}
        else:
            return _err('DEEP_COMPARE_FAILED', result.get('error', 'AI 分析失败'), result.get('agents_trace'))
    except Exception as e:
        return _err('DEEP_COMPARE_ERROR', f'深度对比失败: {e}')
    finally:
        session.close()


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

        # ── 近期岗位（按创建时间倒序，前 5 条，批量查候选人数）──
        recent_jobs_rows = (session.query(Job)
                            .order_by(Job.created_at.desc())
                            .limit(5).all())
        rj_ids = [j.id for j in recent_jobs_rows]
        rj_cnt_map = {}
        if rj_ids:
            rj_cnt_rows = (session.query(MatchRecord.job_id, _func.count())
                           .filter(MatchRecord.job_id.in_(rj_ids))
                           .group_by(MatchRecord.job_id).all())
            rj_cnt_map = {jid: c for jid, c in rj_cnt_rows}
        recent_jobs = [{
            'id': j.id, 'title': j.title, 'status': j.status,
            'candidates': rj_cnt_map.get(j.id, 0),
            'created_at': j.created_at.strftime('%Y-%m-%d') if j.created_at else '',
        } for j in recent_jobs_rows]

        # ── 匹配度分布（high 已在上面算过 high_match，复用）──
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
                'match_distribution': {'high': high_match, 'mid': mid, 'low': low},
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


# ─── 沟通消息 API ─────────────────────────────────────────────────────

class SendMessageReq(BaseModel):
    """发送消息请求体"""
    match_record_id: int = Field(..., description='关联的匹配记录 ID')
    content: str = Field(..., min_length=1, max_length=2000, description='消息内容')


@router.get('/messages/{match_record_id}')
def get_messages(match_record_id: int, page: int = Query(1, ge=1), size: int = Query(50, ge=1, le=200)):
    """
    获取沟通消息列表 — 按时间正序（旧→新），支持分页

    返回结构:
        {
          "success": true,
          "data": {
            "messages": [{id, sender_type, sender_id, content, is_read, created_at}, ...],
            "total": int,
            "page": int,
            "size": int
          }
        }
    """
    session = get_session()
    try:
        # 验证 match_record 存在
        mr = session.query(MatchRecord).filter(MatchRecord.id == match_record_id).first()
        if not mr:
            return _err('MATCH_NOT_FOUND', f'匹配记录不存在: id={match_record_id}')

        total = session.query(Message).filter(Message.match_record_id == match_record_id).count()
        msgs = (session.query(Message)
                .filter(Message.match_record_id == match_record_id)
                .order_by(Message.created_at.asc())
                .offset((page - 1) * size)
                .limit(size)
                .all())

        return {
            'success': True,
            'data': {
                'messages': [{
                    'id': m.id,
                    'sender_type': m.sender_type,
                    'sender_id': m.sender_id,
                    'content': m.content,
                    'is_read': m.is_read,
                    'created_at': m.created_at.strftime('%Y-%m-%d %H:%M:%S') if m.created_at else '',
                } for m in msgs],
                'total': total,
                'page': page,
                'size': size,
            },
            'message': 'ok',
        }
    except Exception as e:
        return _err('GET_MESSAGES_ERROR', f'获取消息失败: {e}')
    finally:
        session.close()


@router.post('/messages')
def send_message(req: SendMessageReq):
    """
    发送沟通消息 — 企业端发起沟通或回复

    同时将关联 match_record 的状态更新为 'communicating'（首次沟通时）。
    """
    session = get_session()
    try:
        # 验证 match_record 存在
        mr = session.query(MatchRecord).filter(MatchRecord.id == req.match_record_id).first()
        if not mr:
            return _err('MATCH_NOT_FOUND', f'匹配记录不存在: id={req.match_record_id}')

        msg = Message(
            match_record_id=req.match_record_id,
            sender_type='enterprise',   # 企业端发送
            sender_id=mr.job_id,        # 记录发布岗位的企业
            content=req.content,
            is_read=0,
        )
        session.add(msg)

        # 首次沟通时更新匹配状态
        if mr.status == 'pending':
            mr.status = 'communicating'
            mr.updated_at = func.now()

        session.commit()
        session.refresh(msg)

        return {
            'success': True,
            'data': {
                'id': msg.id,
                'sender_type': msg.sender_type,
                'content': msg.content,
                'created_at': msg.created_at.strftime('%Y-%m-%d %H:%M:%S') if msg.created_at else '',
            },
            'message': '消息已发送',
        }
    except Exception as e:
        session.rollback()
        return _err('SEND_MESSAGE_ERROR', f'发送消息失败: {e}')
    finally:
        session.close()


@router.post('/messages/read')
def mark_messages_read(match_record_id: int):
    """
    将指定对话中所有来自求职者的消息标记为已读。
    在用户打开聊天对话框时调用。
    """
    session = get_session()
    try:
        session.query(Message).filter(
            Message.match_record_id == match_record_id,
            Message.sender_type == 'jobseeker',
            Message.is_read == 0,
        ).update({'is_read': 1}, synchronize_session=False)
        session.commit()
        return {'success': True, 'data': {'match_record_id': match_record_id}, 'message': '已读'}
    except Exception as e:
        session.rollback()
        return _err('MARK_READ_ERROR', f'标记已读失败: {e}')
    finally:
        session.close()


@router.get('/conversations')
def get_conversations(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """
    获取沟通对话列表 — 按最后消息时间倒序，类似微信聊天列表

    每条对话 = 一个 match_record（岗位-候选人配对），
    聚合该 match_record 下的最新消息、未读数、候选人信息。

    返回结构:
        {
          "success": true,
          "data": {
            "conversations": [
              {
                "match_record_id": int,
                "candidate_name": str,
                "candidate_av": str,
                "job_title": str,
                "match_score": int | null,
                "last_message": str | null,    # 最后一条消息的摘要
                "last_time": str | null,        # 最后消息时间
                "unread_count": int,            # 未读消息数（企业视角）
                "status": str,                  # 匹配状态
              }
            ],
            "total": int,
            "unread_total": int,    # 所有对话的未读总数（用于导航栏徽标）
            "page": int,
            "size": int,
          }
        }
    """
    session = get_session()
    try:
        # 查询所有存在沟通记录的 match_records（用消息表反查）
        # 用子查询：每个 match_record 的最后一条消息时间
        from sqlalchemy import func as sa_func

        # 子查询：每个 match_record 的最后消息时间
        last_msg_subq = (
            session.query(
                Message.match_record_id,
                sa_func.max(Message.created_at).label('last_time'),
                sa_func.max(Message.id).label('last_msg_id'),
            )
            .group_by(Message.match_record_id)
            .subquery()
        )

        # 主查询：关联 match_records、jobseekers、jobs
        rows = (
            session.query(
                MatchRecord,
                Jobseeker,
                Job,
                last_msg_subq.c.last_time,
                last_msg_subq.c.last_msg_id,
            )
            .join(Jobseeker, MatchRecord.jobseeker_id == Jobseeker.id)
            .join(Job, MatchRecord.job_id == Job.id, isouter=True)
            .join(last_msg_subq, MatchRecord.id == last_msg_subq.c.match_record_id, isouter=True)
            .filter(MatchRecord.status == 'communicating')  # 只展示已有沟通消息的对话
            .order_by(sa_func.coalesce(last_msg_subq.c.last_time, MatchRecord.updated_at).desc())
            .offset((page - 1) * size)
            .limit(size)
            .all()
        )

        # 总对话数
        total = (
            session.query(MatchRecord)
            .filter(MatchRecord.status == 'communicating')
            .count()
        )

        # 总未读（企业视角：sender_type='jobseeker' 且 is_read=0）
        unread_total = (
            session.query(sa_func.count(Message.id))
            .filter(Message.sender_type == 'jobseeker', Message.is_read == 0)
            .scalar()
        ) or 0

        # 获取每条对话的最后一条消息内容和未读数
        conversations = []
        for mr, js, job, last_time, last_msg_id in rows:
            name = js.real_name or js.username or '匿名'
            av = name[0] if name else '?'

            # 获取最后一条消息内容
            last_msg = None
            if last_msg_id:
                msg = session.query(Message).filter(Message.id == last_msg_id).first()
                if msg:
                    last_msg = msg.content[:80]  # 截取前80字

            # 未读数（企业视角）
            unread = (
                session.query(sa_func.count(Message.id))
                .filter(
                    Message.match_record_id == mr.id,
                    Message.sender_type == 'jobseeker',
                    Message.is_read == 0,
                )
                .scalar()
            ) or 0

            conversations.append({
                'match_record_id': mr.id,
                'candidate_name': name,
                'candidate_av': av,
                'job_title': job.title if job else '',
                'match_score': mr.match_score,
                'last_message': last_msg or '',
                'last_time': last_time.strftime('%Y-%m-%d %H:%M') if last_time else (mr.updated_at.strftime('%Y-%m-%d %H:%M') if mr.updated_at else ''),
                'unread_count': unread,
                'status': mr.status or 'pending',
            })

        return {
            'success': True,
            'data': {
                'conversations': conversations,
                'total': total,
                'unread_total': unread_total,
                'page': page,
                'size': size,
            },
            'message': 'ok',
        }
    except Exception as e:
        return _err('CONVERSATIONS_ERROR', f'获取对话列表失败: {e}')
    finally:
        session.close()
