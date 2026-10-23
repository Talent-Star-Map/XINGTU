"""Read-only jobseeker aggregates. Sourced postings only; no synthetic history."""
from collections import Counter, defaultdict
from datetime import datetime, timezone
import json
import os
from statistics import median
from urllib.parse import urlsplit

from services.role_catalog import classify_title, _skill_list
from services.skill_synonyms import canonical_name
from services.china_regions import province_for_city


def percentile(values, fraction):
    ordered = sorted(values)
    index = (len(ordered) - 1) * fraction
    low = int(index)
    return ordered[low] + (ordered[min(low + 1, len(ordered) - 1)] - ordered[low]) * (index - low)


def prepare(rows, family='', experience=''):
    output, seen = [], set()
    for row in rows:
        row = dict(row)
        url = str(row.get('source_url') or '').strip()
        source = str(row.get('source') or '')
        match = classify_title(row.get('title'))
        if not match or not source or source == 'ai_discovered' or urlsplit(url).scheme not in ('http', 'https'):
            continue
        identity = (source, url.rstrip('/'))
        if identity in seen:
            continue
        seen.add(identity)
        if family and match[0] != family:
            continue
        if experience and experience not in str(row.get('experience') or ''):
            continue
        row['family'], row['role'] = match
        row['city'] = str(row.get('city') or '').strip() or '地点未注明'
        row['skills'] = sorted({canonical_name(s) for s in _skill_list(row.get('skill_tags'))})
        low, high = row.get('salary_min'), row.get('salary_max')
        # Monthly RMB as stored by the collector; unknown or invalid values remain missing.
        row['salary_mid_k'] = round((low + high) / 2000, 2) if low and high and 0 < low <= high else None
        output.append(row)
    return output


def aggregate(rows):
    cities = defaultdict(list)
    for row in rows:
        cities[row['city']].append(row)
    city_stats = []
    for city, items in cities.items():
        salaries = [r['salary_mid_k'] for r in items if r['salary_mid_k'] is not None]
        city_stats.append({
            'city': city, 'jobs': len(items),
            'companies': len({str(r.get('company_name')).strip() for r in items if r.get('company_name')}),
            'salary_samples': len(salaries),
            'salary_values_k': sorted(salaries),
            'median_salary_k': round(median(salaries), 2) if salaries else None,
            'q1': round(percentile(salaries, .25), 2) if salaries else None,
            'q3': round(percentile(salaries, .75), 2) if salaries else None,
            'minimum': min(salaries) if salaries else None,
            'maximum': max(salaries) if salaries else None,
        })
    counts = Counter(skill for r in rows for skill in r['skills'])
    latest = max((str(r['crawl_time']) for r in rows if r.get('crawl_time')), default=None)
    return {
        'total_jobs': len(rows), 'companies': len({str(r['company_name']).strip() for r in rows if r.get('company_name')}),
        'salary_samples': sum(r['salary_mid_k'] is not None for r in rows), 'latest_collection': latest,
        'cities': sorted(city_stats, key=lambda c: (-c['jobs'], c['city'])),
        'skills': [{'name': name, 'count': count, 'rate': round(100 * count / len(rows), 1)} for name, count in counts.most_common(20)],
        'sources': dict(Counter(r['source'] for r in rows)),
        'family_counts': dict(Counter(r['family'] for r in rows)),
    }


def github_data():
    from pymongo import MongoClient
    uri = os.getenv('MONGO_URI') or os.getenv('MONGODB_URI')
    if not uri:
        return {'status': 'unavailable', 'message': 'GitHub数据连接未配置', 'skills': [], 'history': [], 'repos': []}
    with MongoClient(uri, serverSelectionTimeoutMS=4000, connectTimeoutMS=4000, socketTimeoutMS=8000) as client:
        db = client['xingtu_raw']
        docs = list(db.raw_github_repos.find({}, {'_id': 0, 'primary_language': 1, 'topics': 1, 'stars': 1,
            'source_id': 1, 'url': 1, 'name': 1, 'crawled_at': 1}).sort('crawled_at', -1))
        # Stable repository identity: multiple observations must not multiply popularity.
        unique = {}
        for row in docs:
            if row.get('source_id'):
                unique.setdefault(row['source_id'], row)
        counts = Counter()
        for row in unique.values():
            tags = [row.get('primary_language')] + (row.get('topics') or [])
            counts.update({canonical_name(t) for t in tags if isinstance(t, str) and t.strip()})
        history = list(db.github_daily_snapshots.find({}, {'_id': 0}).sort('date', -1).limit(60))
        return {'status': 'available', 'repo_count': len(unique),
                'latest_collection': max((str(r['crawled_at']) for r in unique.values() if r.get('crawled_at')), default=None),
                'skills': [{'name': n, 'count': c} for n, c in counts.most_common(20)],
                'history': sorted(history, key=lambda r: r['date']),
                'repos': [{'name': r.get('source_id'), 'url': r.get('url'), 'stars': r.get('stars', 0),
                           'language': r.get('primary_language')} for r in sorted(unique.values(), key=lambda r: r.get('stars') or 0, reverse=True)[:10]],
                'method': '按仓库主语言和Topics标签计数，同一仓库同一标签只计一次；标签不等于已核验的技能要求。'}


def load_visuals(family='', experience='', city='', skill=''):
    from database import get_session
    from sqlalchemy import text
    with get_session() as session:
        rows = session.execute(text('SELECT id,title,source,source_url,company_name,city,skill_tags,experience,education,salary_min,salary_max,crawl_time FROM jobs WHERE data_type=1')).mappings().all()
        families = sorted({classify_title(r['title'])[0] for r in rows if classify_title(r['title'])})
        prepared = prepare(rows, family, experience)
        scoped = [r for r in prepared if not city or r['city'] == city]
        observations = session.execute(text('SELECT source,source_url,title,company_name,observed_at,skill_tags FROM job_observations ORDER BY observed_at')).mappings().all()
    # A dated current row is not historical evidence. Only append-only observations count.
    windows = defaultdict(dict)
    for r in observations:
        match = classify_title(r['title'])
        if not match or not r['source_url'] or not r['observed_at'] or (family and match[0] != family):
            continue
        week = r['observed_at'].date().toordinal()
        start = r['observed_at'].date().fromordinal(week - r['observed_at'].weekday()).isoformat()
        windows[start][(r['source'], r['source_url'])] = r
    history = []
    # No city/experience on legacy observations: never silently mix scopes.
    if not city and not experience:
        for date, records in sorted(windows.items()):
            counts = Counter(s for r in records.values() for s in {canonical_name(v) for v in _skill_list(r['skill_tags'])})
            history.append({'date': date, 'samples': len(records), 'counts': dict(counts)})
    try:
        github = github_data()
    except Exception:
        github = {'status': 'unavailable', 'message': 'GitHub数据暂时读取失败，请重试', 'skills': [], 'history': [], 'repos': []}
    evidence = [r for r in scoped if not skill or skill in r['skills']]
    regional = [{**r, 'city': province_for_city(r['city'])} for r in scoped if province_for_city(r['city'])]
    province_cities = defaultdict(set)
    for r in scoped:
        if province_for_city(r['city']):
            province_cities[province_for_city(r['city'])].add(r['city'])
    return {**aggregate(scoped), 'families': families, 'city_options': sorted({r['city'] for r in prepared}),
            'history': history, 'github': github, 'provinces': aggregate(regional)['cities'],
            'unmapped_jobs': len(scoped) - len(regional),
            'province_cities': {name: sorted(cities) for name, cities in province_cities.items()},
            'evidence': [{'id': r['id'], 'title': r['title'], 'city': r['city'], 'company': r['company_name'],
                          'source': r['source'], 'url': r['source_url'], 'skills': r['skills'],
                          'salary_mid_k': r['salary_mid_k'], 'collected_at': str(r['crawl_time']) if r['crawl_time'] else None}
                         for r in evidence[:30]],
            'evidence_total': len(evidence), 'generated_at': datetime.now(timezone.utc).isoformat(),
            'method': '有原始链接且能识别技术职能的招聘记录；按来源与链接去重。薪资为招聘月薪上下限中点，非实际工资。企业数按名称去重，仅代表本次采集样本。',
            'history_note': '技能演化仅使用实际留存的重复观测；至少两个窗口才绘制河流。城市或经验筛选下，旧历史记录字段不足，暂不绘制。'}
