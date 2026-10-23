"""Conservative changes within one identifiable job advertisement.

Two advertisements with the same title describe a role population, not two
successive versions of one fact. A missing skill mention is only a text change.
"""
from collections import defaultdict
from datetime import datetime, timezone
from hashlib import sha256
import json


def posting_identity(row):
    """Return a stable source-specific listing identity, or None if unknown."""
    source = str(row.get('source') or '').strip().casefold()
    company = str(row.get('company_name') or '').strip().casefold()
    url = str(row.get('source_url') or '').strip()
    if not source or not company or not url or not url.startswith(('http://', 'https://')):
        return None
    return (source, company, url)


def _time(row):
    value = row.get('crawl_time') or row.get('captured_at') or row.get('publish_time')
    if not value:
        return None
    try:
        dt = value if isinstance(value, datetime) else datetime.fromisoformat(str(value).replace('Z', '+00:00'))
        return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt.astimezone(timezone.utc)
    except (TypeError, ValueError):
        return None


def _skills(row):
    if row.get('_skill_tags_known') is False:
        return None
    raw = row.get('skill_tags', row.get('skills_required'))
    if raw is None:
        return None
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except ValueError:
            raw = raw.replace('；', ',').replace('，', ',').split(',')
    if not isinstance(raw, (list, tuple, set)):
        return None
    return {str(skill).strip() for skill in raw if str(skill).strip()}


def observed_posting_changes(rows, role_id):
    """Compare strict later observations of the same sourced URL and company.

    Returns observed text/field changes, never inferred market-wide demand or
    causes. Undated or unidentified records cannot establish longitudinal facts.
    """
    histories = defaultdict(list)
    for row in rows:
        identity, captured = posting_identity(row), _time(row)
        if identity and captured:
            histories[identity].append((captured, row))
    events = []
    for identity, history in histories.items():
        history.sort(key=lambda pair: (pair[0], str(pair[1].get('id') or '')))
        for (old_time, before), (new_time, after) in zip(history, history[1:]):
            if new_time <= old_time:
                continue
            token = sha256('\x1f'.join(identity).encode()).hexdigest()[:12]
            prefix = f'ch-{role_id}-{token}-{after.get("id") or new_time.isoformat()}'
            evidence = {'before_posting_id': before.get('id'), 'after_posting_id': after.get('id'),
                        'source_url': identity[2], 'same_posting': True}

            def append(kind, magnitude, left, right):
                events.append({'change_id': f'{prefix}-{kind}', 'job_id_ref': role_id,
                               'date': new_time.isoformat(), 'type': kind,
                               'magnitude': magnitude,
                               'before': json.dumps({**evidence, **left}, ensure_ascii=False),
                               'after': json.dumps({**evidence, **right}, ensure_ascii=False),
                               'source': after.get('source'), 'source_url': identity[2],
                               'reason': None, 'reason_source': None})

            old_skills, new_skills = _skills(before), _skills(after)
            if old_skills is not None and new_skills is not None:
                added = sorted(new_skills - old_skills)
                omitted = sorted(old_skills - new_skills)
                if added:
                    append('skill_newly_mentioned', len(added), {'skills': sorted(old_skills)},
                           {'newly_mentioned': added})
                if omitted:
                    append('skill_no_longer_mentioned', len(omitted), {'skills': sorted(old_skills)},
                           {'no_longer_mentioned': omitted})
                from services.role_discovery import requirement_evidence
                old_req, new_req = requirement_evidence(before), requirement_evidence(after)
                modified = [{'skill': skill, 'before_type': old_req[skill]['type'],
                             'after_type': new_req[skill]['type'],
                             'before_quote': old_req[skill]['quote'],
                             'after_quote': new_req[skill]['quote']}
                            for skill in sorted(old_req.keys() & new_req.keys())
                            if old_req[skill]['type'] != new_req[skill]['type']
                            and 'unclassified' not in (old_req[skill]['type'], new_req[skill]['type'])]
                if modified:
                    append('skill_requirement_modified', len(modified),
                           {'requirement_types': {s: v['type'] for s, v in old_req.items()}},
                           {'modified': modified, 'review_required': True})
            old_salary, new_salary = before.get('salary_max'), after.get('salary_max')
            if old_salary and new_salary and old_salary != new_salary:
                append('salary_listing_change', (new_salary - old_salary) / old_salary,
                       {'salary_max': old_salary}, {'salary_max': new_salary})
            old_education, new_education = before.get('education'), after.get('education')
            if old_education and new_education and old_education != new_education:
                append('education_listing_change', 1, {'education': old_education},
                       {'education': new_education})
    return sorted(events, key=lambda event: (event['date'], event['change_id']))
