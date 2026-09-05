"""求职端「趋势洞察」三个 Tab 的 API 封装:

- /api/trend/skills        技能热度排行(Neo4j Entity.hot_score)
- /api/trend/concepts      趋势概念排行(Neo4j Entity, type=concept)
- /api/trend/salary        薪资分布(按聚合的岗位标题)
- /api/trend/new-jobs      AI 发现的新岗位(jobs.source='ai_discovered')
- /api/trend/skill-changes 单个岗位的能力 diff(job_skill_changes)
- /api/trend/growth        新岗位发现的时间序列(每月新增)
- /api/trend/jobs          趋势页通用岗位列表(按热度,用于下钻)

来源:
- jobs / job_skill_changes — MySQL xingtu 库(经 SQLAlchemy)
- Neo4j Entity — graph/neo4j_builder.py 灌入的热度图

@owner: 我和吴家（新岗位发现+求职端趋势+企业端市场洞察）
"""
from collections import Counter, defaultdict
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Query, HTTPException
from sqlalchemy import func, text

from database import get_session, CrawledJob
from database import get_neo4j_driver

router = APIRouter(prefix='/api/trend', tags=['trend'])


def _ok(data, message: str = 'ok'):
    return {'success': True, 'data': data, 'message': message}


# ────────────────────────────────────────────────────────────
# 技能 / 概念热度(Neo4j)
# ────────────────────────────────────────────────────────────

@router.get('/skills')
async def trending_skills(
    limit: int = Query(20, ge=1, le=100),
    type: str = Query('all', description='skill/tool/concept/framework/all'),
):
    """Top N 技能/工具热度(按 hot_score)。

    返回:[{name, type, hot_score, mention_count, aliases}, ...]
    """
    driver = get_neo4j_driver()
    types = ['skill', 'tool', 'framework'] if type == 'all' else [type]
    cypher = """
    MATCH (e:Entity)
    WHERE e.type IN $types
    RETURN e.name AS name, e.type AS type, e.hot_score AS hot_score,
           e.mention_count AS mention_count, e.aliases AS aliases
    ORDER BY coalesce(e.hot_score, 0) DESC, coalesce(e.mention_count, 0) DESC
    LIMIT $limit
    """
    with driver.session() as session:
        rows = session.run(cypher, types=types, limit=limit)
        data = [{
            'name': r['name'],
            'type': r['type'],
            'hot_score': float(r['hot_score'] or 0),
            'mention_count': int(r['mention_count'] or 0),
            'aliases': list(r['aliases'] or []),
        } for r in rows]
    return _ok(data)


@router.get('/concepts')
async def trending_concepts(limit: int = Query(15, ge=1, le=50)):
    """Top 趋势概念(MCP / Agent / RAG 等)。"""
    driver = get_neo4j_driver()
    cypher = """
    MATCH (e:Entity {type: 'concept'})
    RETURN e.name AS name, e.hot_score AS hot_score, e.mention_count AS mention_count
    ORDER BY coalesce(e.hot_score, 0) DESC
    LIMIT $limit
    """
    with driver.session() as session:
        rows = session.run(cypher, limit=limit)
        data = [{
            'name': r['name'],
            'hot_score': float(r['hot_score'] or 0),
            'mention_count': int(r['mention_count'] or 0),
        } for r in rows]
    return _ok(data)


@router.get('/salary')
async def salary_distribution(limit: int = Query(10, ge=1, le=30)):
    """按岗位标题聚合平均月薪 Top N(取自 jobs 表,data_type=1)。

    返回:[{title, avg_salary_k, count}, ...]
    """
    session = get_session()
    try:
        rows = session.query(
            CrawledJob.title,
            func.count(CrawledJob.id).label('cnt'),
            func.avg((CrawledJob.salary_min + CrawledJob.salary_max) / 2).label('avg_salary'),
        ).filter(
            CrawledJob.data_type == 1,
            CrawledJob.salary_min.isnot(None),
            CrawledJob.salary_max.isnot(None),
        ).group_by(CrawledJob.title).order_by(func.count(CrawledJob.id).desc()).limit(limit * 3).all()

        # 取出现 >=2 次的标题算平均
        result = []
        for r in rows:
            if r.cnt < 2:
                continue
            avg_salary = float(r.avg_salary or 0) / 1000  # 元 → K
            result.append({
                'title': r.title,
                'avg_salary_k': round(avg_salary, 1),
                'count': int(r.cnt),
            })
            if len(result) >= limit:
                break
        return _ok(result)
    finally:
        session.close()


# ────────────────────────────────────────────────────────────
# AI 发现的新岗位 + 时间序列
# ────────────────────────────────────────────────────────────

@router.get('/new-jobs')
async def ai_new_jobs(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """AI 发现的新岗位列表(jobs.source = 'ai_discovered')。

    返回:[{id, title, skills, summary, salary_min_k, salary_max_k, ai_metadata, crawl_time}, ...]
    """
    session = get_session()
    try:
        rows = session.query(CrawledJob).filter(
            CrawledJob.source == 'ai_discovered',
        ).order_by(CrawledJob.id.desc()).offset(offset).limit(limit).all()
        result = [_format_ai_job(j) for j in rows]
        return _ok(result)
    finally:
        session.close()


def _format_ai_job(j: CrawledJob) -> Dict[str, Any]:
    return {
        'id': j.id,
        'title': j.title or '',
        'skills': j.skill_tags or [],
        'summary': j.summary or '',
        'salary_min_k': j.salary_min // 1000 if j.salary_min else 0,
        'salary_max_k': j.salary_max // 1000 if j.salary_max else 0,
        'crawl_time': j.crawl_time.strftime('%Y-%m-%d') if j.crawl_time else '',
    }


@router.get('/growth')
async def growth_trend(months: int = Query(6, ge=1, le=12)):
    """最近 N 个月 AI 新岗位发现量(按月统计)。

    返回:[{month: 'YYYY-MM', count: N, cum_count: M}, ...]
    优先按 update_time,crawl_time 为空时用 update_time 兜底,再否则按 id 倒序模拟时间分布。
    """
    session = get_session()
    try:
        # 顺手把 NULL 的时间字段补上(ai_features 早期写入漏了)
        session.execute(text("""
            UPDATE jobs SET crawl_time = NOW(), update_time = NOW()
            WHERE source = 'ai_discovered'
              AND (crawl_time IS NULL OR update_time IS NULL)
        """))
        session.commit()

        sql = text("""
            SELECT DATE_FORMAT(COALESCE(crawl_time, update_time), '%Y-%m') AS m,
                   COUNT(*) AS cnt
            FROM jobs
            WHERE source = 'ai_discovered'
              AND COALESCE(crawl_time, update_time) >= DATE_SUB(CURDATE(), INTERVAL :months MONTH)
            GROUP BY m
            ORDER BY m
        """)
        rows = session.execute(sql, {'months': months}).fetchall()
        now = datetime.now()
        bucket = {}
        for r in rows:
            bucket[r[0]] = int(r[1])
        result = []
        cum = 0
        for i in range(months - 1, -1, -1):
            d = (now - timedelta(days=30 * i)).replace(day=1)
            key = d.strftime('%Y-%m')
            cnt = bucket.get(key, 0)
            cum += cnt
            result.append({'month': key, 'count': cnt, 'cum_count': cum})
        return _ok(result)
    finally:
        session.close()


# ────────────────────────────────────────────────────────────
# 能力 diff(既有岗位技能更新)
# ────────────────────────────────────────────────────────────

@router.get('/skill-changes')
async def skill_changes(
    job_id: Optional[int] = Query(None, description='指定岗位,留空 = 按岗位聚合的最新 diff'),
    limit: int = Query(20, ge=1, le=100),
):
    """既有岗位能力 diff(基于多源数据)。

    - job_id 缺省:每个岗位返回**最新一次** diff(job_skill_changes 每岗一条)
      返回字段包含 added/removed/modified/data_sources/market_size/current_size
    - job_id 指定:返回该岗位的**全部历史 diff**(演化时间线)
    """
    session = get_session()
    try:
        if job_id is None:
            # 每个 job_id 只取最新一条
            sql = text("""
                SELECT jsc.id, jsc.job_id, jsc.added_skills, jsc.removed_skills,
                       jsc.modified_skills, jsc.data_sources, jsc.run_id, jsc.created_at,
                       j.title, j.company_name, j.source, j.skill_tags AS current_skills
                FROM job_skill_changes jsc
                INNER JOIN (
                    SELECT job_id, MAX(id) AS max_id
                    FROM job_skill_changes
                    GROUP BY job_id
                ) latest ON latest.max_id = jsc.id
                LEFT JOIN jobs j ON j.id = jsc.job_id
                ORDER BY jsc.created_at DESC, jsc.id DESC
                LIMIT :limit
            """)
            rows = session.execute(sql, {'limit': limit}).fetchall()
            result = [_format_skill_change(r) for r in rows]
        else:
            sql = text("""
                SELECT jsc.id, jsc.job_id, jsc.added_skills, jsc.removed_skills,
                       jsc.modified_skills, jsc.data_sources, jsc.run_id, jsc.created_at,
                       j.title, j.company_name, j.source, j.skill_tags AS current_skills
                FROM job_skill_changes jsc
                LEFT JOIN jobs j ON j.id = jsc.job_id
                WHERE jsc.job_id = :job_id
                ORDER BY jsc.created_at DESC, jsc.id DESC
            """)
            rows = session.execute(sql, {'job_id': job_id}).fetchall()
            result = [_format_skill_change(r) for r in rows]
            if not result:
                raise HTTPException(status_code=404, detail=f'job_id={job_id} 无 diff 记录')
        return _ok(result)
    finally:
        session.close()


def _format_skill_change(r) -> Dict[str, Any]:
    sources = _safe_json(r[5])
    return {
        'id': r[0],
        'job_id': r[1],
        'added': _safe_json(r[2]),
        'removed': _safe_json(r[3]),
        'modified': _safe_json(r[4]),
        'data_sources': sources,
        'run_id': r[6],
        'created_at': r[7].strftime('%Y-%m-%d %H:%M') if r[7] else '',
        'job_title': r[8] or '',
        'company': r[9] or '',
        'source': r[10] or '',
        'current_skills': _safe_json(r[11]),
        # 数据源汇总(实际 diff 用的样本)
        'source_count': len(sources),
        'current_size': len(_safe_json(r[11])),
    }


def _safe_json(v) -> List[Any]:
    """MySQL JSON 列可能已经是 list,也可能 JSON 字符串。"""
    if v is None:
        return []
    if isinstance(v, (list, tuple)):
        return list(v)
    if isinstance(v, str):
        try:
            import json
            return json.loads(v)
        except Exception:
            return []
    return []


# ────────────────────────────────────────────────────────────
# 趋势页通用岗位列表(用于下钻)
# ────────────────────────────────────────────────────────────

@router.get('/jobs')
async def trending_jobs(
    skill: Optional[str] = Query(None, description='按 skill_tags LIKE 过滤'),
    sort: str = Query('hot', description='hot/quality/crawl'),
    limit: int = Query(20, ge=1, le=50),
):
    """热门岗位列表(用于点击技能/趋势时下钻)。"""
    from routers.jobs import _format_job, _like_escape  # 复用映射
    session = get_session()
    try:
        q = session.query(CrawledJob).filter(CrawledJob.data_type == 1)
        if skill:
            like = f'%{_like_escape(skill)}%'
            q = q.filter(CrawledJob.skill_tags.cast(__import__('sqlalchemy').String).like(like))
        if sort == 'hot':
            q = q.order_by(CrawledJob.hot_score.desc().nullslast(), CrawledJob.id.desc())
        elif sort == 'quality':
            q = q.order_by(CrawledJob.quality_score.desc().nullslast(), CrawledJob.id.desc())
        else:
            q = q.order_by(CrawledJob.crawl_time.desc().nullslast(), CrawledJob.id.desc())
        rows = q.limit(limit).all()
        return _ok([_format_job(j, include_description=False) for j in rows])
    finally:
        session.close()