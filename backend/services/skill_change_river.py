"""Aggregate recorded skill-diff candidates, never reconstruct skill stocks."""
import json
from collections import Counter, defaultdict

from services.skill_synonyms import canonical_name


def _items(value):
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except (ValueError, TypeError):
            return []
    return value if isinstance(value, list) else []


def aggregate_changes(rows):
    # One observation per job/day; repeated runs must not inflate the river.
    latest = {}
    jobs = {}
    for row in rows:
        when = row.get('created_at')
        if not when:
            continue
        date = when.strftime('%Y-%m-%d') if hasattr(when, 'strftime') else str(when)[:10]
        key = (date, row['job_id'])
        if key not in latest or (str(when), row['id']) > (str(latest[key]['created_at']), latest[key]['id']):
            latest[key] = row
        jobs[row['job_id']] = {'id': row['job_id'], 'title': row.get('job_title') or f"岗位 #{row['job_id']}"}
    buckets = defaultdict(lambda: {'samples': 0, 'added': Counter(), 'removed': Counter(), 'modified': Counter(), 'sources': set(), 'runs': set()})
    for (date, _), row in latest.items():
        bucket = buckets[date]
        bucket['samples'] += 1
        for kind in ('added', 'removed', 'modified'):
            labels = set()
            for item in _items(row.get(kind + '_skills')):
                raw = item.get('skill') if isinstance(item, dict) else item
                if isinstance(raw, str) and raw.strip():
                    labels.add(canonical_name(raw.strip()))
            bucket[kind].update(labels)
        for source in _items(row.get('data_sources')):
            if isinstance(source, dict) and source.get('source'):
                bucket['sources'].add(str(source['source']))
        if row.get('run_id'):
            bucket['runs'].add(str(row['run_id']))
    return {
        'record_count': len(rows), 'observation_count': len(latest), 'job_count': len(jobs),
        'jobs': sorted(jobs.values(), key=lambda job: job['id']),
        'windows': [{'date': date, 'samples': bucket['samples'],
                     **{kind: dict(bucket[kind]) for kind in ('added', 'removed', 'modified')},
                     'sources': sorted(bucket['sources']), 'run_ids': sorted(bucket['runs'])}
                    for date, bucket in sorted(buckets.items())],
        'method': '来源：job_skill_changes。按记录日期分窗，同一岗位同日保留最后一条记录，同一技能每个岗位每天计一次。统计差异候选涉及的岗位数，不是技能存量或已验证的招聘需求变化；无记录的日期不补零。',
    }
