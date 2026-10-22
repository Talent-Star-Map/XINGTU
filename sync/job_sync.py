"""Provenance-keyed job synchronization. Replaces the article-shaped mapping."""
import json
import os
from datetime import datetime
from pathlib import Path

import pymysql
from database.mysql import get_connection

COLUMNS = ('data_type','source','source_url','title','skill_tags','technology_field',
           'company_name','city','area','salary_min','salary_max','salary_months',
           'education','experience','job_type','company_type','job_description',
           'summary','publish_time','crawl_time','update_time','source_update_time','publish_time_evidence')


def get_server_connection():
    return pymysql.connect(host=os.environ['SERVER_DB_HOST'], port=int(os.environ['SERVER_DB_PORT']),
                           user=os.environ['SERVER_DB_USER'], password=os.environ['SERVER_DB_PASSWORD'],
                           database=os.environ['SERVER_DB_NAME'], charset='utf8mb4',
                           connect_timeout=10, read_timeout=30, write_timeout=30)


def job_to_dict(job):
    skills = job.get('skills') or []
    if isinstance(skills, str):
        skills = json.loads(skills)
    if not isinstance(skills,list):
        raise ValueError('skills must be a JSON array')
    url = str(job.get('source_url') or '').strip()
    if not url.startswith(('https://','http://')):
        raise ValueError('source URL required for production synchronization')
    source_name = str(job.get('source') or '').strip()
    if not source_name:
        raise ValueError('source name required for production synchronization')
    description = job.get('job_description') or ''
    data = {name: job.get(name) for name in COLUMNS}
    evidence = data.get('publish_time_evidence')
    if isinstance(evidence, dict):
        data['publish_time_evidence'] = json.dumps(evidence, ensure_ascii=False)
    data.update(data_type=1, source=source_name, source_url=url,
                title=job.get('job_name') or '', skill_tags=json.dumps(skills,ensure_ascii=False),
                technology_field=job.get('job_category'), job_description=description,
                summary=description[:500], update_time=datetime.utcnow())
    return data


def sync_jobs(backfill=False):
    source = get_connection()
    dest = get_server_connection()
    counts = {'inserted':0,'updated':0,'failed':0}
    try:
        with source.cursor(pymysql.cursors.DictCursor) as q:
            q.execute('SELECT j.*, r.source_url, r.source FROM job_info j LEFT JOIN job_raw r ON j.raw_id=r.id'
                      + ('' if backfill else ' WHERE j.sync_status=0'))
            rows=q.fetchall()
        if backfill:
            with dest.cursor(pymysql.cursors.DictCursor) as q:
                q.execute('SELECT * FROM jobs WHERE data_type=1 AND source_url IS NOT NULL AND source_url<>%s', ('',))
                before=q.fetchall()
            directory=Path('/app/logs/repair_backups'); directory.mkdir(parents=True,exist_ok=True)
            path=directory/f'jobs_before_backfill_{datetime.utcnow():%Y%m%dT%H%M%S}.json'
            path.write_text(json.dumps(before,ensure_ascii=False,default=str),encoding='utf-8')
            path.chmod(0o600)
        for row in rows:
            try:
                data=job_to_dict(row)
                with dest.cursor() as q:
                    q.execute('SELECT id FROM jobs WHERE data_type=1 AND source_url=%s ORDER BY id LIMIT 1 FOR UPDATE',(data['source_url'],))
                    existing=q.fetchone()
                    if existing:
                        # Backfill cannot erase populated fields when source has no value.
                        changed={k:v for k,v in data.items() if v is not None and v!='' and k not in ('data_type','source_url')}
                        q.execute('UPDATE jobs SET '+','.join(f'`{k}`=%s' for k in changed)+' WHERE id=%s',tuple(changed.values())+(existing[0],))
                        kind='updated'
                    else:
                        q.execute('INSERT INTO jobs ('+','.join(COLUMNS)+') VALUES ('+','.join(['%s']*len(COLUMNS))+')',tuple(data[k] for k in COLUMNS))
                        kind='inserted'
                dest.commit()
                with source.cursor() as q:
                    q.execute('UPDATE job_info SET sync_status=1 WHERE id=%s',(row['id'],))
                source.commit()
                counts[kind]+=1
            except Exception as exc:
                dest.rollback(); source.rollback(); counts['failed']+=1
                print(json.dumps({'sync_failed_id':row['id'],'error_type':type(exc).__name__}),flush=True)
        counts['status']='failed' if counts['failed'] else ('succeeded' if rows else 'unchanged')
        print(json.dumps({'sql_sync':counts}),flush=True)
        if counts['failed']:
            raise RuntimeError(f"{counts['failed']} job records failed synchronization")
        return counts
    finally:
        source.close(); dest.close()


if __name__=='__main__':
    import sys
    sync_jobs(backfill='--backfill' in sys.argv)
