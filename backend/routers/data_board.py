"""企业端「市场数据大屏」接口。

三块数据：
- /overview   市场全景（KPI、城市、领域、薪资、来源与完整率）
- /skills     技能深潜（需求/溢价、共现网络、岗位簇）
- /benchmark  企业岗位 vs 市场对标
- /jobs       图表下钻的岗位明细
"""
from fastapi import APIRouter, Query

from database import Enterprise, Job, get_session, verify_token
from services.market_board import (
    build_benchmark,
    build_overview,
    build_skills,
    filter_rows,
    get_dataset,
)

router = APIRouter(prefix='/api/enterprise/data-board', tags=['enterprise-data-board'])


def _ok(data, message: str = 'ok'):
    return {'success': True, 'data': data, 'message': message}


def _err(code: str, message: str):
    return {'success': False, 'error': {'code': code, 'message': message}, 'message': message}


def _enterprise_id(token: str) -> int | None:
    if not token:
        return None
    try:
        payload = verify_token(token)
    except Exception:
        return None
    if not payload or payload.get('role') != 'enterprise':
        return None
    return payload.get('user_id')


@router.get('/overview')
def overview(
    token: str = Query(''),
    city: str = Query(''),
    field: str = Query(''),
    experience: str = Query(''),
    education: str = Query(''),
    salary: str = Query(''),
):
    if _enterprise_id(token) is None:
        return _err('UNAUTHORIZED', '需要企业端登录')
    dataset = get_dataset()
    rows = filter_rows(dataset['rows'], city, field, experience, education, salary)
    return _ok(build_overview(dataset, rows))


@router.get('/skills')
def skills(
    token: str = Query(''),
    city: str = Query(''),
    field: str = Query(''),
    experience: str = Query(''),
    education: str = Query(''),
    salary: str = Query(''),
):
    if _enterprise_id(token) is None:
        return _err('UNAUTHORIZED', '需要企业端登录')
    dataset = get_dataset()
    rows = filter_rows(dataset['rows'], city, field, experience, education, salary)
    return _ok(build_skills(dataset, rows))


@router.get('/benchmark')
def benchmark(token: str = Query('')):
    eid = _enterprise_id(token)
    if eid is None:
        return _err('UNAUTHORIZED', '需要企业端登录')

    session = get_session()
    try:
        own_jobs = (
            session.query(Job)
            .filter(Job.enterprise_id == eid, Job.status == 'active')
            .order_by(Job.id)
            .all()
        )
        enterprise = session.query(Enterprise).filter(Enterprise.id == eid).first()
        company_name = (enterprise.company_name if enterprise else '') or ''
        dataset = get_dataset()
        return _ok(build_benchmark(dataset, own_jobs, company_name))
    finally:
        session.close()


@router.get('/jobs')
def board_jobs(
    token: str = Query(''),
    city: str = Query(''),
    field: str = Query(''),
    experience: str = Query(''),
    education: str = Query(''),
    salary: str = Query(''),
    skill: str = Query(''),
    cluster_id: int = Query(0),
    limit: int = Query(20, ge=1, le=100),
):
    if _enterprise_id(token) is None:
        return _err('UNAUTHORIZED', '需要企业端登录')

    dataset = get_dataset()
    rows = filter_rows(dataset['rows'], city, field, experience, education, salary)
    if skill:
        key = skill.casefold()
        rows = [r for r in rows if any(s.casefold() == key for s in r['skills'])]
    if cluster_id:
        cluster = next((c for c in dataset['clusters'] if c['id'] == cluster_id), None)
        allowed = set(cluster['job_ids']) if cluster else set()
        rows = [r for r in rows if r['id'] in allowed]

    rows = sorted(rows, key=lambda r: (-(r['salary_mid'] or 0), r['title']))
    items = [{
        'id': r['id'],
        'title': r['title'],
        'company': r['company'],
        'city': r['city'],
        'field': r['field'],
        'salary_min': r['salary_min'],
        'salary_max': r['salary_max'],
        'salary_mid_k': round(r['salary_mid'] / 1000, 1) if r['salary_mid'] else None,
        'education': r['education'],
        'experience': r['experience'],
        'skills': r['skills'][:8],
        'source': r['source'],
    } for r in rows[:limit]]

    return _ok({'total': len(rows), 'items': items})
