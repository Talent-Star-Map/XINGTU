"""Read public employer listings; preserve responses and never infer salary."""
import hashlib
import html
import json
import os
import re
import time
from datetime import datetime, timedelta
from pathlib import Path

import pymysql
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from database.mysql import get_connection
from .role_catalog import classify_title

BASE = 'https://careers.tencent.com/tencentcareer/api/post/'
LOGS = Path('/app/logs')


class SourceBlocked(RuntimeError):
    pass


def plain(value):
    return html.unescape(re.sub(r'<[^>]+>', ' ', str(value or ''))).strip()


def extract_skills(text):
    lexicon = json.loads(Path(__file__).with_name('skill_lexicon.json').read_text(encoding='utf-8'))
    found = {}
    for term, canonical in lexicon.items():
        if len(term) < 2:
            continue
        match = re.search(r'(?<![a-zA-Z0-9])' + re.escape(term) + r'(?![a-zA-Z0-9])', text, re.I)
        if match:
            found[canonical] = text[max(0, match.start()-40):min(len(text), match.end()+60)]
    return found


def normalize(post, observed_at):
    post_id = str(post.get('PostId') or '')
    if not post_id.isdigit():
        raise ValueError('missing official post id')
    description = '\n'.join(filter(None, [plain(post.get('Responsibility')), plain(post.get('Requirement'))]))
    title = plain(post.get('RecruitPostName'))
    if not title or len(description) < 30:
        raise ValueError('incomplete employer response')
    evidence = extract_skills(title + '\n' + description)
    return {'source': '腾讯招聘官网', 'source_job_id': post_id,
            'source_url': f'https://careers.tencent.com/jobdesc.html?postId={post_id}',
            'title': title, 'company_name': plain(post.get('ComName')) or '腾讯',
            'city': plain(post.get('LocationName')), 'experience': plain(post.get('RequireWorkYearsName')) or None,
            'description': description, 'skills': sorted(evidence), 'skill_evidence': evidence,
            'category': plain(post.get('CategoryName')), 'observed_at': observed_at}


def persist(record, raw_response):
    """Commit raw and cleaned records together; cloud sync runs after this stage."""
    c = get_connection()
    now = record['observed_at']
    skills = json.dumps(record['skills'], ensure_ascii=False)
    description = (record.get('description') or '')[:20000] or None
    # Append-only source evidence is retained even when the current-state row updates.
    source_key = {'腾讯招聘官网': 'tencent', '智联招聘': 'zhilian'}.get(record['source'])
    if source_key is None:
        c.close()
        raise ValueError('unknown evidence source')
    directory = LOGS / 'source_evidence' / source_key
    directory.mkdir(parents=True, exist_ok=True)
    payload = {'observed_at_utc': now.isoformat(), 'source': record['source'],
               'source_job_id': record['source_job_id'], 'source_url': record['source_url'],
               'response': raw_response, 'skill_evidence': record['skill_evidence']}
    serialized = json.dumps(payload, ensure_ascii=False)
    with (directory / f'{now:%Y%m%d}.jsonl').open('a', encoding='utf-8') as f:
        f.write(serialized + '\n')
    try:
        with c.cursor() as q:
            q.execute('SELECT id,raw_description,raw_skills FROM job_raw WHERE source=%s AND source_job_id=%s LIMIT 1',
                      (record['source'], record['source_job_id']))
            existing = q.fetchone()
            # Public list-only refreshes cannot erase a previously available JD.
            if description is None and existing and existing[1] and existing[2]:
                skills = existing[2]
            values = (record['source_url'], record['title'][:500], record['company_name'][:200],
                      record['city'][:100], record['experience'], description, now, skills)
            if existing:
                raw_id = existing[0]
                q.execute('UPDATE job_raw SET source_url=%s,raw_job_name=%s,raw_company_name=%s,raw_city=%s,raw_experience=%s,raw_description=COALESCE(%s,raw_description),crawl_time=%s,raw_skills=%s WHERE id=%s', values+(raw_id,))
            else:
                q.execute('INSERT INTO job_raw (source_url,raw_job_name,raw_company_name,raw_city,raw_experience,raw_description,crawl_time,raw_skills,source,source_job_id) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)', values+(record['source'],record['source_job_id']))
                raw_id = q.lastrowid
            q.execute('SELECT id FROM job_info WHERE raw_id=%s LIMIT 1', (raw_id,))
            clean = q.fetchone()
            values = (record['title'][:200], record['company_name'][:200], record['city'][:100],
                      record['experience'], record['category'][:100], skills, description, now)
            if clean:
                q.execute('UPDATE job_info SET job_name=%s,company_name=%s,city=%s,experience=%s,job_category=%s,skills=%s,job_description=COALESCE(%s,job_description),crawl_time=%s,sync_status=0 WHERE id=%s', values+(clean[0],))
            else:
                q.execute('INSERT INTO job_info (job_name,company_name,city,experience,job_category,skills,job_description,crawl_time,raw_id,sync_status) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,0)', values+(raw_id,))
            clean_id = clean[0] if clean else q.lastrowid
            if record.get('raw_salary'):
                q.execute('UPDATE job_raw SET raw_salary=%s WHERE id=%s', (record['raw_salary'], raw_id))
            if record.get('education'):
                q.execute('UPDATE job_raw SET raw_education=%s WHERE id=%s', (record['education'], raw_id))
                q.execute('UPDATE job_info SET education=%s WHERE id=%s', (record['education'], clean_id))
        c.commit()
        return not bool(existing)
    except Exception:
        c.rollback()
        raise
    finally:
        c.close()


def collect(max_details=500, max_pages=10, delay=0.8):
    LOGS.mkdir(parents=True, exist_ok=True)
    state_path = LOGS / 'tencent_cursor.json'
    state = json.loads(state_path.read_text()) if state_path.exists() else {'page': 1}
    page = max(1, int(state.get('page', 1)))
    c = get_connection()
    try:
        with c.cursor() as q:
            q.execute('SELECT source_job_id,crawl_time FROM job_raw WHERE source=%s', ('腾讯招聘官网',))
            recent = {str(row[0]) for row in q.fetchall() if row[1] and row[1] > datetime.utcnow()-timedelta(hours=20)}
    finally:
        c.close()
    counts = {'listed': 0, 'eligible': 0, 'new_raw': 0, 'updated_raw': 0, 'detail_failed': 0, 'recent_skipped': 0}
    session = requests.Session()
    session.headers['User-Agent'] = 'XINGTU-JobGraph/1.0'
    session.mount('https://', HTTPAdapter(max_retries=Retry(
        total=2, backoff_factor=1, status_forcelist=(500, 502, 503, 504),
        allowed_methods=('GET',), respect_retry_after_header=False)))

    def fetch(endpoint, params):
        time.sleep(delay)
        response = session.get(BASE+endpoint, params={**params, 'language': 'zh-cn'}, timeout=25)
        if response.status_code in (401, 403, 429):
            raise SourceBlocked(f'official source returned HTTP {response.status_code}')
        response.raise_for_status()
        try:
            body = response.json()
        except ValueError as exc:
            raise SourceBlocked('source returned non-JSON; manual access check required') from exc
        if body.get('Code') != 200 or not isinstance(body.get('Data'), dict):
            raise RuntimeError('official source returned an unsuccessful response')
        return body['Data']

    for _ in range(max_pages):
        listing = fetch('Query', {'pageIndex': page, 'pageSize': 100, 'area': 'cn'})
        posts = listing.get('Posts') or []
        if not posts:
            page = 1
            break
        exhausted = True
        for post in posts:
            counts['listed'] += 1
            if post.get('IsValid') is False or post.get('CategoryName') not in ('技术', '产品', '设计'):
                continue
            counts['eligible'] += 1
            pid = str(post.get('PostId') or '')
            if pid in recent:
                counts['recent_skipped'] += 1
                continue
            if counts['new_raw']+counts['updated_raw']+counts['detail_failed'] >= max_details:
                exhausted = False
                break
            try:
                detail = fetch('ByPostId', {'postId': pid})
                record = normalize(detail, datetime.utcnow())
                is_new = persist(record, detail)
                counts['new_raw' if is_new else 'updated_raw'] += 1
                recent.add(pid)
            except SourceBlocked:
                raise
            except (requests.RequestException, ValueError) as exc:
                counts['detail_failed'] += 1
                print(json.dumps({'detail_failed':pid,'type':type(exc).__name__}), flush=True)
                if counts['detail_failed'] >= 10:
                    raise RuntimeError('ten detail failures; stop rather than hammer the source')
            if (counts['new_raw']+counts['updated_raw']) % 25 == 0:
                print(json.dumps({'progress':counts},ensure_ascii=False),flush=True)
        if exhausted:
            page += 1
        if page > (int(listing.get('Count',0))+99)//100:
            page = 1
            break
        if not exhausted:
            break
    temporary = state_path.with_suffix('.tmp')
    temporary.write_text(json.dumps({'page':page,'updated_at_utc':datetime.utcnow().isoformat()}))
    temporary.replace(state_path)
    session.close()
    counts['next_page'] = page
    counts['status'] = ('partial_failure' if counts['detail_failed'] else 'succeeded') if counts['new_raw']+counts['updated_raw'] else ('unchanged' if counts['recent_skipped'] else 'empty')
    return counts
