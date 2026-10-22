"""Additive schema upgrade and immutable weekly JD snapshots (SQL destination).

One complete snapshot per Asia/Shanghai Monday-start week, on the first healthy
collection/sync run. Transaction rollback makes a failed attempt retryable.
"""
import hashlib
import json
from datetime import datetime, timedelta, timezone

import pymysql
from .job_times import SHANGHAI, utc

EXTRA_COLUMNS = {
    'source_update_time': 'DATETIME NULL',
    'publish_time_evidence': 'JSON NULL',
}

RUNS_DDL = '''CREATE TABLE IF NOT EXISTS job_weekly_snapshot_runs (
    week_start DATE PRIMARY KEY,
    captured_at DATETIME NOT NULL,
    row_count INT NOT NULL DEFAULT 0,
    timezone_name VARCHAR(40) NOT NULL DEFAULT 'Asia/Shanghai'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'''

ITEMS_DDL = '''CREATE TABLE IF NOT EXISTS job_weekly_snapshots (
    week_start DATE NOT NULL,
    job_id BIGINT NOT NULL,
    captured_at DATETIME NOT NULL,
    publish_time DATETIME NULL,
    crawl_time DATETIME NULL,
    observed_this_week TINYINT NOT NULL,
    content_hash CHAR(64) NOT NULL,
    snapshot JSON NOT NULL,
    PRIMARY KEY (week_start, job_id),
    KEY idx_weekly_job (job_id, week_start)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'''


def ensure_schema(source_factory=None, destination_factory=None):
    from database.mysql import get_connection
    from sync.job_sync import get_server_connection
    changes = []
    for factory, tables in ((source_factory or get_connection, ('job_raw', 'job_info')),
                            (destination_factory or get_server_connection, ('jobs',))):
        connection = factory()
        try:
            with connection.cursor() as q:
                for table in tables:
                    q.execute('SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=%s', (table,))
                    existing = {row[0] for row in q.fetchall()}
                    if not existing:
                        raise RuntimeError('required table missing: ' + table)
                    for name, definition in EXTRA_COLUMNS.items():
                        if name not in existing:
                            q.execute(f'ALTER TABLE `{table}` ADD COLUMN `{name}` {definition}')
                            changes.append(table + '.' + name)
                if tables == ('jobs',):
                    q.execute(RUNS_DDL); q.execute(ITEMS_DDL)
            connection.commit()
        finally:
            connection.close()
    return {'status': 'succeeded', 'added_columns': changes}


def week_start(now):
    local = utc(now).astimezone(SHANGHAI)
    return local.date() - timedelta(days=local.weekday())


def snapshot_payload(row, now):
    payload = dict(row)
    monday = datetime.combine(week_start(now), datetime.min.time(), tzinfo=SHANGHAI).astimezone(timezone.utc)
    crawl = row.get('crawl_time')
    seen = bool(crawl and monday <= utc(crawl) <= utc(now))
    payload['snapshot_meta'] = {
        'observed_this_week': seen,
        # Not observed is NOT proof that the job closed or disappeared.
        'presence': 'observed_this_week' if seen else 'not_observed_this_week',
        'week_timezone': 'Asia/Shanghai',
    }
    content = {k: v for k, v in row.items() if k not in ('crawl_time', 'update_time', 'publish_time_evidence')}
    digest = hashlib.sha256(json.dumps(content, sort_keys=True, ensure_ascii=False, default=str).encode()).hexdigest()
    return json.dumps(payload, ensure_ascii=False, default=str), digest, int(seen)


def capture_weekly_snapshot(now=None, connection_factory=None):
    from sync.job_sync import get_server_connection
    now = utc(now or datetime.now(timezone.utc)).replace(tzinfo=None)
    week = week_start(now)
    connection = (connection_factory or get_server_connection)()
    locked = False
    try:
        with connection.cursor() as q:
            q.execute("SELECT GET_LOCK('xingtu_job_weekly_snapshot', 0)")
            locked = q.fetchone()[0] == 1
            if not locked:
                return {'status': 'unchanged', 'reason': 'snapshot_already_running'}
            connection.begin()
            q.execute('SELECT row_count FROM job_weekly_snapshot_runs WHERE week_start=%s', (week,))
            existing = q.fetchone()
            if existing is not None:
                connection.rollback()
                return {'status': 'unchanged', 'week_start': str(week), 'row_count': existing[0]}
            with connection.cursor(pymysql.cursors.DictCursor) as rows_cursor:
                rows_cursor.execute("SELECT * FROM jobs WHERE data_type=1 AND source IN ('腾讯招聘官网','智联招聘') AND source_url IS NOT NULL AND source_url<>'' AND crawl_time IS NOT NULL ORDER BY id")
                rows = rows_cursor.fetchall()
            if not rows:
                connection.rollback()
                return {'status': 'empty', 'reason': 'no_source_backed_jobs'}
            q.execute('INSERT INTO job_weekly_snapshot_runs (week_start,captured_at,row_count) VALUES (%s,%s,%s)', (week, now, len(rows)))
            values = []
            for row in rows:
                payload, digest, seen = snapshot_payload(row, now)
                values.append((week, row['id'], now, row.get('publish_time'), row['crawl_time'], seen, digest, payload))
            q.executemany('INSERT INTO job_weekly_snapshots (week_start,job_id,captured_at,publish_time,crawl_time,observed_this_week,content_hash,snapshot) VALUES (%s,%s,%s,%s,%s,%s,%s,%s)', values)
        connection.commit()
        return {'status': 'succeeded', 'week_start': str(week), 'row_count': len(rows)}
    except Exception:
        connection.rollback()
        raise
    finally:
        if locked:
            with connection.cursor() as q:
                q.execute("SELECT RELEASE_LOCK('xingtu_job_weekly_snapshot')")
        connection.close()


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--migrate', action='store_true', help='Add nullable time columns and snapshot tables; do not alter existing dates')
    parser.add_argument('--snapshot', action='store_true', help='Capture this week once from synchronized source-backed jobs')
    args = parser.parse_args()
    if not args.migrate and not args.snapshot:
        parser.error('choose --migrate or --snapshot')
    if args.migrate:
        print(json.dumps(ensure_schema(), ensure_ascii=False))
    if args.snapshot:
        print(json.dumps(capture_weekly_snapshot(), ensure_ascii=False))
