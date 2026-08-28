"""岗位数据 + 按技能查询 + 企业统计

@owner: 静怡、议桓（多源异构数据采集+求职端岗位界面+企业端行业报告）
"""

from fastapi import APIRouter, Query, HTTPException
from sqlalchemy import or_, func, text as sql_text
from database import get_session, CrawledJob

router = APIRouter(prefix='/api/jobs', tags=['jobs'])

DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100


def _like_escape(s: str) -> str:
    """转义 LIKE 通配符，防止用户输入里的 % / _ 被当成通配符（CLAUDE.md 第 27 条）"""
    return s.replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_')


def _format_job(job: CrawledJob, include_description: bool = True) -> dict:
    """将 CrawledJob ORM 对象转为前端期望的格式（唯一一份映射，避免重复实现漂移）。

    include_description=False 用于列表接口：列表卡片不展示 JD 全文，
    去掉 description 能让列表响应轻量、首屏更快（详情页仍返回全文）。
    """
    salary_min_k = job.salary_min // 1000 if job.salary_min else 0
    salary_max_k = job.salary_max // 1000 if job.salary_max else 0
    data = {
        'id': job.id,
        'title': job.title or '',
        'company': job.company_name or '',
        'location': f'{job.city or ""}{job.area or ""}'.strip(),
        'salary': f'{salary_min_k}K-{salary_max_k}K' if salary_min_k and salary_max_k else '面议',
        'education': job.education or '',
        'experience': job.experience or '',
        'status': 'active',
        'skills': job.skill_tags or [],
        'source': job.source or '',
        'collected_at': job.crawl_time.strftime('%Y-%m-%d') if job.crawl_time else '',
    }
    if include_description:
        data['description'] = job.job_description or ''
    return data


def load_all_jobs(include_description: bool = False) -> list[dict]:
    """实时从数据库读取全部岗位（data_type=1）。

    注意：不要在模块导入期缓存结果。爬虫会持续写入新岗位，
    缓存成常量会导致「前端看得到新岗位、点诊断却 404」。

    include_description 默认 False：匹配/推荐/交叉验证/技能频率统计
    都只用 skills/source 等字段，不读 JD 全文能显著减小内存与传输量。
    """
    session = get_session()
    try:
        return [_format_job(j, include_description=include_description)
                for j in session.query(CrawledJob).filter(CrawledJob.data_type == 1).all()]
    finally:
        session.close()


def load_job_by_id(job_id: int) -> dict | None:
    """按 id 实时查询单个岗位"""
    session = get_session()
    try:
        job = session.query(CrawledJob).filter(
            CrawledJob.id == job_id, CrawledJob.data_type == 1
        ).first()
        return _format_job(job) if job else None
    finally:
        session.close()


def load_jobs_by_ids(job_ids: list[int]) -> list[dict]:
    """按 id 批量查询，保持传入顺序"""
    if not job_ids:
        return []
    session = get_session()
    try:
        rows = session.query(CrawledJob).filter(
            CrawledJob.id.in_(job_ids), CrawledJob.data_type == 1
        ).all()
        by_id = {r.id: _format_job(r) for r in rows}
        return [by_id[i] for i in job_ids if i in by_id]
    finally:
        session.close()


@router.get('/stats')
def job_stats(company: str = Query('')):
    """企业岗位统计 — 传 company 过滤公司名"""
    session = get_session()
    try:
        query = session.query(CrawledJob).filter(CrawledJob.data_type == 1)
        if company:
            query = query.filter(CrawledJob.company_name == company)
        total = query.count()
        return {'success': True, 'data': {'total': total, 'active': total, 'closed': 0, 'draft': 0, 'company': company}}
    finally:
        session.close()


@router.get('')
def list_jobs(
    keyword: str = Query(''),
    skill: str = Query(''),
    city: str = Query(''),
    company: str = Query(''),
    ids: str = Query(''),
    page: int = Query(1, ge=1),
    size: int = Query(DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE),
):
    """岗位列表。

    - keyword: 对 标题/公司/技能 做模糊搜索
    - skill:   精确匹配技能标签（JSON_CONTAINS，避免 java 命中 javascript）
    - city:    城市/地区模糊匹配
    - ids:     逗号分隔的 id 列表，用于按推荐结果取岗位详情
    """
    # ids 模式：忽略分页与筛选
    if ids:
        try:
            id_list = [int(x) for x in ids.split(',') if x.strip()]
        except ValueError:
            raise HTTPException(400, 'ids 参数格式错误')
        jobs = load_jobs_by_ids(id_list)
        return {'success': True, 'data': jobs, 'total': len(jobs), 'page': 1, 'size': len(jobs)}

    session = get_session()
    try:
        query = session.query(CrawledJob).filter(CrawledJob.data_type == 1)

        if keyword:
            kw = _like_escape(keyword.strip())
            if kw:
                like = f'%{kw}%'
                query = query.filter(or_(
                    CrawledJob.title.like(like),
                    CrawledJob.company_name.like(like),
                    CrawledJob.skill_tags.like(like),
                ))

        if skill:
            # 精确匹配数组元素，杜绝子串误命中
            query = query.filter(
                func.json_contains(CrawledJob.skill_tags, sql_text(':tag')).params(tag=f'"{skill}"')
            )

        if city:
            c = _like_escape(city.strip())
            if c:
                like = f'%{c}%'
                query = query.filter(or_(CrawledJob.city.like(like), CrawledJob.area.like(like)))

        if company:
            query = query.filter(CrawledJob.company_name == company)

        total = query.count()
        jobs = query.order_by(CrawledJob.id).offset((page - 1) * size).limit(size).all()
        return {
            'success': True,
            # 列表不返回 description 全文，首屏更快（详情页走 /api/jobs/{id}）
            'data': [_format_job(j, include_description=False) for j in jobs],
            'total': total,
            'page': page,
            'size': size,
        }
    finally:
        session.close()


@router.get('/{job_id}')
def get_job(job_id: int):
    job = load_job_by_id(job_id)
    if not job:
        raise HTTPException(404, '岗位不存在')
    return {'success': True, 'data': job}
