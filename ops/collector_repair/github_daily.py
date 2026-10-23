"""Daily GitHub Trending observation. Public sources, bounded API requests, no LLM.

Run inside xingtu-collector: python /app/github_daily.py
Keeps one immutable successful board per Asia/Shanghai day. Failures never create
an empty successful day. Latest repository enrichment is separate from history.
"""
from collections import Counter
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import time
from zoneinfo import ZoneInfo

import requests
from bs4 import BeautifulSoup
from pymongo import MongoClient

BOARD_URL = 'https://github.com/trending?since=daily'


def parse_board(html):
    soup = BeautifulSoup(html, 'html.parser')
    rows = []
    seen = set()
    for article in soup.select('article.Box-row'):
        link = article.select_one('h2 a')
        href = link.get('href', '') if link else ''
        name = href.strip('/')
        if not re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+', name) or name in seen:
            continue
        seen.add(name)
        language = article.select_one('[itemprop="programmingLanguage"]')
        star = article.select_one('a[href$="/stargazers"]')
        gain = re.search(r'([\d,]+)\s+stars?\s+today', article.get_text(' ', strip=True))
        rows.append({'source_id': name, 'url': 'https://github.com/' + name,
                     'rank': len(rows) + 1, 'primary_language': language.get_text(strip=True) if language else None,
                     'stars': int(re.sub(r'\D', '', star.get_text()) or 0) if star else None,
                     'stars_today': int(gain[1].replace(',', '')) if gain else None,
                     'description': (article.select_one('p').get_text(' ', strip=True) if article.select_one('p') else '')})
    if len(rows) < 5:
        raise ValueError('trending_board_missing_or_incomplete')
    return rows[:25]


def labels_for(repo):
    # Labels are observed programming languages/topics, not inferred job skills.
    return sorted({str(v).strip().lower() for v in [repo.get('primary_language'), *(repo.get('topics') or [])] if v and str(v).strip()})


def mongo_client():
    uri = os.getenv('MONGO_URI') or os.getenv('MONGODB_URI')
    if uri:
        return MongoClient(uri, serverSelectionTimeoutMS=10000)
    return MongoClient(host=os.getenv('MONGO_HOST', 'mongo'), port=int(os.getenv('MONGO_PORT', '27017')),
                       username=os.environ['MONGO_USER'], password=os.environ['MONGO_PASSWORD'],
                       authSource=os.getenv('MONGO_AUTH_DB', 'admin'), serverSelectionTimeoutMS=10000)


def collect(now=None, session=None, client=None):
    now = now or datetime.now(timezone.utc)
    date = now.astimezone(ZoneInfo('Asia/Shanghai')).date().isoformat()
    own_client = client is None
    client = client or mongo_client()
    db = client['xingtu_raw']
    try:
        if db.github_daily_snapshots.find_one({'_id': date}):
            return {'status': 'unchanged', 'date': date, 'reason': 'successful_daily_snapshot_exists'}
        session = session or requests.Session()
        session.headers.update({'User-Agent': 'XINGTU-TechnicalObservatory/1.0'})
        response = session.get(BOARD_URL, timeout=30)
        response.raise_for_status()
        rows = parse_board(response.text)
        api_headers = {'Accept': 'application/vnd.github+json'}
        if os.getenv('GITHUB_TOKEN'):
            api_headers['Authorization'] = 'Bearer ' + os.environ['GITHUB_TOKEN']
        enriched, failed = 0, 0
        for row in rows:
            time.sleep(.5)
            try:
                response = session.get('https://api.github.com/repos/' + row['source_id'], headers=api_headers, timeout=20)
                response.raise_for_status()
                details = response.json()
                row.update(topics=details.get('topics') or [], stars=details.get('stargazers_count'),
                           primary_language=details.get('language'), forks=details.get('forks_count'),
                           pushed_at=details.get('pushed_at'))
                enriched += 1
            except (requests.RequestException, ValueError):
                failed += 1
                row['topics'] = []
                row['enrichment_status'] = 'unavailable'
        counts = Counter(label for row in rows for label in labels_for(row))
        snapshot = {'date': date, 'captured_at': now, 'source_url': BOARD_URL,
                    'period': 'daily', 'timezone': 'Asia/Shanghai', 'repo_count': len(rows), 'repos': rows,
                    'skills': [{'name': name, 'count': count} for name, count in counts.most_common()],
                    'enriched_repos': enriched, 'enrichment_failed': failed,
                    'label_method': 'observed_primary_language_and_topics', 'status': 'succeeded'}
        # Snapshot is the durable source of truth. A retry cannot overwrite the day.
        result = db.github_daily_snapshots.update_one({'_id': date}, {'$setOnInsert': snapshot}, upsert=True)
        for row in rows:
            if row.get('enrichment_status') == 'unavailable':
                continue
            raw = {**row, 'source': 'github', 'name': row['source_id'].split('/')[-1], 'crawled_at': now}
            digest = hashlib.sha256(json.dumps({'language': row.get('primary_language'), 'topics': row.get('topics'), 'description': row.get('description')}, sort_keys=True).encode()).hexdigest()
            prior = db.raw_github_repos.find_one({'source': 'github', 'source_id': row['source_id']}, {'analysis_content_hash': 1})
            if not prior or prior.get('analysis_content_hash') != digest:
                raw['analysis_status'] = 'pending'
            raw['analysis_content_hash'] = digest
            db.raw_github_repos.update_one({'source': 'github', 'source_id': row['source_id']},
                {'$set': raw, '$setOnInsert': {'first_seen': now}}, upsert=True)
        return {'status': 'succeeded' if result.upserted_id else 'unchanged', 'date': date,
                'repos': len(rows), 'enriched': enriched, 'enrichment_failed': failed}
    finally:
        if own_client:
            client.close()


if __name__ == '__main__':
    try:
        result = collect()
    except Exception as error:
        result = {'status': 'failed', 'error_type': type(error).__name__}
    print(json.dumps(result, ensure_ascii=False), flush=True)
    raise SystemExit(0 if result['status'] in ('succeeded', 'unchanged') else 1)
