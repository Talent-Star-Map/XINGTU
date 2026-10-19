"""管理员数据看板聚合接口。

五个端点，全部只读，供管理端工作台和「数据大屏」取数：

    /overview  — 全局规模 + 今日/近 7 日/近 30 日新增
    /trend     — 按天的新增曲线（求职者/企业/企业岗位/简历）
    /jobs      — 平台岗位画像（城市、薪资、学历、经验、来源、技能热度）
    /funnel    — 简历→诊断→匹配→沟通→反馈各环节规模
    /resumes   — 简历中心运营（模板使用、区块完整度、分享访问）

两个口径上的注意点：
1. `jobs`（爬虫采集）和 `enterprise_jobs`（企业发布）是两张表，统计必须分开报，
   否则「平台岗位数」会把 600 多条采集岗位漏掉，看起来平台只有十来条岗位。
2. 库里的时间字段是 UTC（MySQL 服务器时区就是 UTC），按天聚合必须先转北京时间，
   否则日界整体偏 8 小时——凌晨 0~8 点产生的数据会被算到前一天。
"""

from collections import Counter, OrderedDict
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text

from database import (
    get_session, Jobseeker, Enterprise, Job, MatchRecord, SkillResource,
    Resume, ResumeSection, ResumeTemplate, ResumeShare, CrawledJob,
)
from routers.admin import require_admin
from time_util import to_local

router = APIRouter(
    prefix='/api/admin/analytics',
    tags=['admin-analytics'],
    dependencies=[Depends(require_admin)],
)

SECTION_LABELS = OrderedDict([
    ('personal_info', '个人信息'),
    ('summary', '个人简介'),
    ('work_experience', '工作经历'),
    ('education', '教育背景'),
    ('skills', '技能特长'),
    ('projects', '项目经历'),
])

SALARY_BUCKETS = [
    (0, 8000, '8K 以下'),
    (8000, 12000, '8-12K'),
    (12000, 18000, '12-18K'),
    (18000, 25000, '18-25K'),
    (25000, 35000, '25-35K'),
    (35000, 10 ** 9, '35K 以上'),
]


def _ok(data, message='ok'):
    return {'success': True, 'data': data, 'message': message}


def _cst_today_start_utc() -> datetime:
    """北京时间今天 0 点对应的 UTC naive 时间（数据库存的就是 UTC naive）"""
    cst_now = to_local(datetime.utcnow())
    midnight = cst_now.replace(hour=0, minute=0, second=0, microsecond=0)
    return (midnight - timedelta(hours=8)).replace(tzinfo=None)


def _count_since(session, model, since):
    try:
        return session.query(model).filter(model.created_at >= since).count()
    except Exception:
        return 0


def _raw_count(session, sql: str) -> int:
    try:
        return int(session.execute(text(sql)).scalar() or 0)
    except Exception:
        return 0


# ════════════════════════════════════════════════════════════════════
# 全局概览
# ════════════════════════════════════════════════════════════════════
@router.get('/overview')
def overview():
    session = get_session()
    try:
        day0 = _cst_today_start_utc()
        d7 = day0 - timedelta(days=6)
        d30 = day0 - timedelta(days=29)

        status_rows = session.query(MatchRecord.status).all()
        by_status = Counter((r[0] or 'pending') for r in status_rows)

        share_total = session.query(ResumeShare).count()
        share_visits = session.query(ResumeShare).with_entities(ResumeShare.visit_count).all()
        share_visits = sum(int(v or 0) for (v,) in share_visits)

        return _ok({
            'jobseekers': {
                'total': session.query(Jobseeker).count(),
                'today': _count_since(session, Jobseeker, day0),
                'week': _count_since(session, Jobseeker, d7),
                'month': _count_since(session, Jobseeker, d30),
            },
            'enterprises': {
                'total': session.query(Enterprise).count(),
                'verified': session.query(Enterprise).filter(Enterprise.verified == 1).count(),
                'today': _count_since(session, Enterprise, day0),
                'month': _count_since(session, Enterprise, d30),
            },
            'jobs': {
                # 两张表分开报，别相加
                'enterprise_total': session.query(Job).count(),
                'enterprise_active': session.query(Job).filter(Job.status == 'active').count(),
                'crawled': session.query(CrawledJob).filter(CrawledJob.data_type == 1).count(),
                'articles': session.query(CrawledJob).filter(CrawledJob.data_type == 2).count(),
                'today': _count_since(session, Job, day0),
                'month': _count_since(session, Job, d30),
            },
            'resumes': {
                'total': session.query(Resume).count(),
                'today': _count_since(session, Resume, day0),
                'month': _count_since(session, Resume, d30),
                'shares': share_total,
                'share_visits': share_visits,
            },
            'matches': {
                'total': len(status_rows),
                'by_status': {k: v for k, v in by_status.items()},
                'today': _count_since(session, MatchRecord, day0),
            },
            'diagnosis': {
                'total': _raw_count(session, 'SELECT COUNT(*) FROM diagnosis_history'),
                'week': _raw_count(
                    session,
                    f"SELECT COUNT(*) FROM diagnosis_history WHERE created_at >= '{d7:%Y-%m-%d %H:%M:%S}'",
                ),
            },
            'resources': {'total': session.query(SkillResource).count()},
        })
    finally:
        session.close()


# ════════════════════════════════════════════════════════════════════
# 新增趋势
# ════════════════════════════════════════════════════════════════════
@router.get('/trend')
def trend(days: int = Query(30, ge=7, le=90)):
    session = get_session()
    try:
        day0 = _cst_today_start_utc()
        start = day0 - timedelta(days=days - 1)
        buckets: OrderedDict[str, dict] = OrderedDict()
        for i in range(days):
            d = (to_local(start) + timedelta(days=i)).date()
            key = d.isoformat()
            buckets[key] = {'date': key, 'jobseeker': 0, 'enterprise': 0, 'job': 0, 'resume': 0}

        def fill(model, field):
            rows = session.query(model.created_at).filter(model.created_at >= start).all()
            for (ts,) in rows:
                if not ts:
                    continue
                key = to_local(ts).date().isoformat()
                if key in buckets:
                    buckets[key][field] += 1

        fill(Jobseeker, 'jobseeker')
        fill(Enterprise, 'enterprise')
        fill(Job, 'job')
        fill(Resume, 'resume')

        items = list(buckets.values())
        return _ok({
            'days': days,
            'items': items,
            'totals': {
                'jobseeker': sum(i['jobseeker'] for i in items),
                'enterprise': sum(i['enterprise'] for i in items),
                'job': sum(i['job'] for i in items),
                'resume': sum(i['resume'] for i in items),
            },
        })
    finally:
        session.close()


# ════════════════════════════════════════════════════════════════════
# 岗位画像（基于爬虫采集的 jobs 表）
# ════════════════════════════════════════════════════════════════════
def _salary_bucket(low, high):
    mid = ((low or 0) + (high or 0)) / 2
    if mid <= 0:
        return None
    for lo, hi, label in SALARY_BUCKETS:
        if lo <= mid < hi:
            return label
    return SALARY_BUCKETS[-1][2]


@router.get('/jobs')
def jobs_profile(top: int = Query(10, ge=5, le=30)):
    session = get_session()
    try:
        rows = session.query(
            CrawledJob.city, CrawledJob.technology_field, CrawledJob.education,
            CrawledJob.experience, CrawledJob.source, CrawledJob.salary_min,
            CrawledJob.salary_max, CrawledJob.skill_tags,
        ).filter(CrawledJob.data_type == 1).all()

        city, field, edu, exp, source = Counter(), Counter(), Counter(), Counter(), Counter()
        salary = Counter()
        skills: dict[str, list] = {}

        for city_v, field_v, edu_v, exp_v, src_v, low, high, tags in rows:
            if city_v:
                city[city_v] += 1
            if field_v:
                field[field_v] += 1
            if edu_v:
                edu[edu_v] += 1
            if exp_v:
                exp[exp_v] += 1
            if src_v:
                source[src_v] += 1
            bucket = _salary_bucket(low, high)
            if bucket:
                salary[bucket] += 1
            for tag in (tags or []):
                name = str(tag).strip()
                if not name:
                    continue
                key = name.lower()
                entry = skills.setdefault(key, [name, 0])
                entry[1] += 1

        def top_list(counter: Counter, limit: int):
            return [{'name': k, 'value': v} for k, v in counter.most_common(limit)]

        skill_list = sorted(skills.values(), key=lambda x: -x[1])[:15]
        return _ok({
            'total': len(rows),
            'city': top_list(city, top),
            'field': top_list(field, top),
            'education': top_list(edu, 8),
            'experience': top_list(exp, 8),
            'source': top_list(source, 8),
            'salary': [
                {'name': label, 'value': salary.get(label, 0)}
                for _, _, label in SALARY_BUCKETS
            ],
            'skills': [{'name': n, 'value': c} for n, c in skill_list],
        })
    finally:
        session.close()


# ════════════════════════════════════════════════════════════════════
# 行为漏斗
# ════════════════════════════════════════════════════════════════════
@router.get('/funnel')
def funnel():
    session = get_session()
    try:
        resume_total = session.query(Resume).count()
        diagnosis_total = _raw_count(session, 'SELECT COUNT(*) FROM diagnosis_history')
        status_rows = session.query(MatchRecord.status).all()
        by_status = Counter((r[0] or 'pending') for r in status_rows)
        match_total = len(status_rows)
        communicating = sum(v for k, v in by_status.items() if k in ('communicating', 'accepted', 'rejected'))
        feedback = by_status.get('accepted', 0) + by_status.get('rejected', 0)

        def step(key, label, value, hint=''):
            ratio = round(value / resume_total * 100, 1) if resume_total else 0
            return {'key': key, 'label': label, 'value': value,
                    'ratio': ratio, 'hint': hint}

        return _ok({
            'base': resume_total,
            'steps': [
                step('resume', '创建简历', resume_total),
                step('diagnosis', '岗位诊断', diagnosis_total, '同一用户可多次诊断'),
                step('match', '进入匹配', match_total, '企业端批量匹配生成'),
                step('communicating', '开始沟通', communicating),
                step('feedback', '企业反馈', feedback, '已录用 / 不合适'),
            ],
            'status': [
                {'name': k, 'value': v}
                for k, v in sorted(by_status.items(), key=lambda x: -x[1])
            ],
        })
    finally:
        session.close()


# ════════════════════════════════════════════════════════════════════
# 简历中心运营
# ════════════════════════════════════════════════════════════════════
@router.get('/resumes')
def resumes():
    session = get_session()
    try:
        day0 = _cst_today_start_utc()
        month_ago = day0 - timedelta(days=29)

        rows = session.query(Resume.id, Resume.title, Resume.template_key).all()
        total = len(rows)
        ai_generated = sum(1 for _, title, _ in rows if 'AI生成' in (title or ''))

        templates = {t.template_key: t.name for t in session.query(ResumeTemplate).all()}
        tpl_counter = Counter((key or 'classic') for _, _, key in rows)
        tpl_top = [{
            'key': key,
            'name': templates.get(key, key),
            'value': count,
            'ratio': round(count / total * 100, 1) if total else 0,
        } for key, count in tpl_counter.most_common(8)]

        # 区块填充率：同一份简历的同一类型只算一次
        filled: dict[str, set] = {k: set() for k in SECTION_LABELS}
        for rid, stype, content in session.query(
            ResumeSection.resume_id, ResumeSection.section_type, ResumeSection.content,
        ).all():
            if stype not in filled or not content:
                continue
            if isinstance(content, dict):
                body = [v for k, v in content.items() if k not in ('items', 'categories')]
                lists = [content.get('items') or [], content.get('categories') or []]
                if any(v not in (None, '', [], {}) for v in body) or any(lists):
                    filled[stype].add(rid)
            else:
                filled[stype].add(rid)

        section_fill = [{
            'key': stype,
            'label': label,
            'value': len(filled[stype]),
            'rate': round(len(filled[stype]) / total * 100, 1) if total else 0,
        } for stype, label in SECTION_LABELS.items()]

        share_rows = (
            session.query(ResumeShare, Resume)
            .outerjoin(Resume, Resume.id == ResumeShare.resume_id)
            .all()
        )
        visits = sum(int(s.visit_count or 0) for s, _ in share_rows)
        top_shared = sorted(share_rows, key=lambda x: -(x[0].visit_count or 0))[:5]

        return _ok({
            'total': total,
            'month_new': session.query(Resume).filter(Resume.created_at >= month_ago).count(),
            'ai_generated': ai_generated,
            'ai_ratio': round(ai_generated / total * 100, 1) if total else 0,
            'templates': tpl_top,
            'sections': section_fill,
            'shares': {
                'links': len(share_rows),
                'visits': visits,
                'top': [{
                    'title': (r.title if r else '已删除的简历'),
                    'value': int(s.visit_count or 0),
                } for s, r in top_shared if (s.visit_count or 0) > 0],
            },
        })
    finally:
        session.close()
