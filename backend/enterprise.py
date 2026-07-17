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
        # 待处理匹配记录数（status=pending）
        pending_count = (session.query(MatchRecord)
                         .filter(MatchRecord.status == 'pending').count())

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
