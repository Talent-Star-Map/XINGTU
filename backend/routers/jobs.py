"""岗位数据 + 按技能查询 + 企业统计

@owner: 静怡、议桓（多源异构数据采集+求职端岗位界面+企业端行业报告）
"""

from fastapi import APIRouter, Query, HTTPException
from database import get_session, CrawledJob

router = APIRouter(prefix='/api/jobs', tags=['jobs'])


def _load_seed_jobs():
    """从数据库加载岗位数据，格式兼容原 SEED_JOBS"""
    session = get_session()
    try:
        jobs = session.query(CrawledJob).filter(CrawledJob.data_type == 1).all()
        result = []
        for j in jobs:
            salary_min_k = j.salary_min // 1000 if j.salary_min else 0
            salary_max_k = j.salary_max // 1000 if j.salary_max else 0
            result.append({
                'id': j.id,
                'title': j.title or '',
                'company': j.company_name or '',
                'location': f'{j.city or ""}{j.area or ""}'.strip(),
                'salary': f'{salary_min_k}K-{salary_max_k}K' if salary_min_k and salary_max_k else '面议',
                'education': j.education or '',
                'experience': j.experience or '',
                'description': j.job_description or '',
                'status': 'active',
                'skills': j.skill_tags or [],
                'source': j.source or '',
                'collected_at': j.crawl_time.strftime('%Y-%m-%d') if j.crawl_time else '',
            })
        return result
    finally:
        session.close()


SEED_JOBS = _load_seed_jobs()


def _format_job(job: CrawledJob) -> dict:
    """将 CrawledJob ORM 对象转为前端期望的格式"""
    salary_min_k = job.salary_min // 1000 if job.salary_min else 0
    salary_max_k = job.salary_max // 1000 if job.salary_max else 0
    return {
        'id': job.id,
        'title': job.title or '',
        'company': job.company_name or '',
        'location': f'{job.city or ""}{job.area or ""}'.strip(),
        'salary': f'{salary_min_k}K-{salary_max_k}K' if salary_min_k and salary_max_k else '面议',
        'education': job.education or '',
        'experience': job.experience or '',
        'description': job.job_description or '',
        'status': 'active',
        'skills': job.skill_tags or [],
        'source': job.source or '',
        'collected_at': job.crawl_time.strftime('%Y-%m-%d') if job.crawl_time else '',
    }


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
def list_jobs(skill: str = Query(''), company: str = Query(''), page: int = Query(1), size: int = Query(20)):
    session = get_session()
    try:
        query = session.query(CrawledJob).filter(CrawledJob.data_type == 1)
        if skill:
            query = query.filter(CrawledJob.skill_tags.contains(skill))
        if company:
            query = query.filter(CrawledJob.company_name == company)
        total = query.count()
        jobs = query.offset((page - 1) * size).limit(size).all()
        return {'success': True, 'data': [_format_job(j) for j in jobs], 'total': total, 'page': page}
    finally:
        session.close()


@router.get('/{job_id}')
def get_job(job_id: int):
    session = get_session()
    try:
        job = session.query(CrawledJob).filter(CrawledJob.id == job_id, CrawledJob.data_type == 1).first()
        if not job:
            raise HTTPException(404, '岗位不存在')
        return {'success': True, 'data': _format_job(job)}
    finally:
        session.close()
