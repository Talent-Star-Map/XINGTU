"""Replay the durable source evidence outbox into existing observation tables.

Only normalized observations captured by the collector are accepted. Old log
lines without that payload are skipped; current rows never become fake history.
SQL and cursor advancement are ordered so a crash retries an idempotent write.
"""
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path

from .skill_synonyms import canonical_name


def observation(record):
    source, identity, url = (record.get(k) for k in ('source', 'source_job_id', 'source_url'))
    if not source or not identity or not str(url).startswith(('https://', 'http://')):
        raise ValueError('source identity required')
    when = datetime.fromisoformat(record['observed_at'].replace('Z', '+00:00'))
    if when.tzinfo:
        when = when.astimezone(timezone.utc).replace(tzinfo=None)
    when = when.replace(microsecond=0)  # Existing table stores DATETIME, not DATETIME(6).
    skills = sorted({canonical_name(s) for s in record['skills'] if isinstance(s, str) and s.strip()})
    scope = record['description_scope']
    from .salary import monthly_salary
    salary = monthly_salary(record.get('raw_salary'))
    extraction = {'description_scope': scope, 'method': 'public_text_lexicon_v1',
                  **{k: record.get(k) for k in ('city', 'experience', 'education')}}
    if salary:
        extraction.update(salary_min=salary[0], salary_max=salary[1], salary_months=salary[2])
    content = json.dumps({'title': record['title'], 'text': record.get('description') or '',
                          'skills': skills, 'extraction': extraction}, sort_keys=True, ensure_ascii=False)
    digest = hashlib.sha256(content.encode()).hexdigest()
    key = hashlib.sha256(json.dumps([source, identity, when.isoformat(), digest]).encode()).hexdigest()
    return {'observation_key': key, 'source': source, 'source_job_id': str(identity),
            'source_url': url, 'company_name': record.get('company_name'), 'title': record['title'],
            'observed_at': when, 'content_hash': digest, 'raw_text': record.get('description') or '',
            'skill_tags': skills, 'extraction': extraction}


def skill_delta(previous, current):
    """Compare complete public JDs only; a clipped listing is not a skill removal."""
    if not previous or previous['observed_at'] >= current['observed_at']:
        return None
    if any(previous.get(k) != current.get(k) for k in ('source', 'source_job_id', 'source_url', 'company_name')):
        return None
    def decoded(value):
        return json.loads(value) if isinstance(value, str) else value
    if any(decoded(r['extraction']).get('description_scope') != 'full_public' for r in (previous, current)):
        return None
    before, after = (set(decoded(r['skill_tags']) or []) for r in (previous, current))
    added, removed = sorted(after - before), sorted(before - after)
    return (added, removed) if added or removed else None


def save_observation(connection, record):
    import pymysql
    row = observation(record)
    with connection.cursor(pymysql.cursors.DictCursor) as q:
        q.execute('SELECT id FROM job_observations WHERE observation_key=%s', (row['observation_key'],))
        if q.fetchone():
            return False
        q.execute('SELECT * FROM job_observations WHERE source=%s AND source_job_id=%s '
                  'AND observed_at<%s ORDER BY observed_at DESC,id DESC LIMIT 1',
                  (row['source'], row['source_job_id'], row['observed_at']))
        previous = q.fetchone()
        columns = tuple(row)
        values = tuple(json.dumps(row[k], ensure_ascii=False) if k in ('skill_tags', 'extraction') else row[k] for k in columns)
        q.execute('INSERT INTO job_observations (' + ','.join(columns) + ',ingested_at) VALUES (' +
                  ','.join(['%s'] * len(columns)) + ',UTC_TIMESTAMP())', values)
        delta = skill_delta(previous, row)
        if delta:
            q.execute('SELECT id FROM jobs WHERE source=%s AND source_url=%s AND data_type=1 ORDER BY id LIMIT 1',
                      (row['source'], row['source_url']))
            job = q.fetchone()
            if not job:
                raise RuntimeError('synchronize current job before its skill changes')
            sources = [{'source': row['source'], 'company': row['company_name'], 'job_id': job['id'],
                        'url': row['source_url'], 'previous_observation': previous['observation_key'],
                        'observation': row['observation_key']}]
            q.execute('INSERT INTO job_skill_changes (job_id,added_skills,removed_skills,modified_skills,data_sources,run_id,created_at) '
                      'VALUES (%s,%s,%s,%s,%s,%s,%s)',
                      (job['id'], json.dumps(delta[0]), json.dumps(delta[1]), '[]',
                       json.dumps(sources, ensure_ascii=False), 'obs:' + row['observation_key'][:40], row['observed_at']))
    return True


def sync_observations(logs=Path('/app/logs'), connection_factory=None):
    if connection_factory is None:
        from sync.job_sync import get_server_connection
        connection_factory = get_server_connection
    state_file = logs / 'observation_offsets.json'
    offsets = json.loads(state_file.read_text(encoding='utf-8')) if state_file.exists() else {}
    counts = {'inserted': 0, 'legacy_skipped': 0, 'status': 'succeeded'}
    connection = connection_factory()
    try:
        for path in sorted((logs / 'source_evidence').glob('*/*.jsonl')):
            name = str(path.relative_to(logs))
            offset = offsets.get(name, 0)
            if path.stat().st_size < offset:
                raise RuntimeError('append-only evidence file was truncated')
            with path.open('rb') as stream:
                stream.seek(offset)
                while True:
                    line = stream.readline()
                    if not line or not line.endswith(b'\n'):
                        break
                    payload = json.loads(line)
                    record = payload.get('observation')
                    if record:
                        counts['inserted'] += int(save_observation(connection, record))
                    else:
                        counts['legacy_skipped'] += 1
                        offsets[name] = stream.tell()
                        continue
                    connection.commit()
                    offsets[name] = stream.tell()
                    temporary = state_file.with_suffix('.tmp')
                    temporary.write_text(json.dumps(offsets), encoding='utf-8')
                    temporary.replace(state_file)
                if name in offsets:
                    temporary = state_file.with_suffix('.tmp')
                    temporary.write_text(json.dumps(offsets), encoding='utf-8')
                    temporary.replace(state_file)
        return counts
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
