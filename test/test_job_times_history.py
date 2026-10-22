"""Offline integration: source normalization -> raw/clean SQL -> cloud SQL -> immutable history.

SQLite adapts the small SQL surface used here. No configured database or API calls.
"""
import json
import sqlite3
import sys
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from repair_pipeline.job_times import parse_source_time, time_fields, tencent_times
from repair_pipeline.job_history import capture_weekly_snapshot, week_start, snapshot_payload
from repair_pipeline import tencent, zhilian
from sync.job_sync import job_to_dict, COLUMNS
import pymysql

sqlite3.register_adapter(datetime, lambda value: value.isoformat(" "))
from datetime import date
sqlite3.register_adapter(date, lambda value: value.isoformat())
sqlite3.register_converter("TIMESTAMP", lambda value: datetime.fromisoformat(value.decode()))


class Cursor:
    def __init__(self, db, dictionary=False):
        self.db = db; self.raw = db.raw.cursor(); self.dictionary = dictionary; self.virtual = None
    def __enter__(self): return self
    def __exit__(self, *args): self.raw.close()
    @property
    def lastrowid(self): return self.raw.lastrowid
    def execute(self, sql, params=()):
        self.virtual = None
        if 'GET_LOCK(' in sql or 'RELEASE_LOCK(' in sql:
            self.virtual = [(1,)]; return 1
        return self.raw.execute(sql.replace('%s', '?'), params)
    def executemany(self, sql, values):
        if self.db.fail_items: raise RuntimeError('injected snapshot storage failure')
        return self.raw.executemany(sql.replace('%s', '?'), values)
    def convert(self, row):
        if row is None or not self.dictionary:return row
        return dict(zip([x[0] for x in self.raw.description], row))
    def fetchone(self): return self.convert(self.virtual.pop(0) if self.virtual else self.raw.fetchone())
    def fetchall(self): return [self.convert(r) for r in self.raw.fetchall()]


class DB:
    def __init__(self):
        self.raw = sqlite3.connect(':memory:', detect_types=sqlite3.PARSE_DECLTYPES)
        self.fail_items = False
    def cursor(self, kind=None): return Cursor(self, kind is pymysql.cursors.DictCursor)
    def commit(self): self.raw.commit()
    def rollback(self): self.raw.rollback()
    def begin(self): self.raw.execute('BEGIN')
    def close(self): pass


def setup_db():
    db = DB()
    db.raw.executescript('''
        CREATE TABLE job_raw (id INTEGER PRIMARY KEY,source TEXT,source_job_id TEXT,source_url TEXT,
            raw_job_name TEXT,raw_company_name TEXT,raw_city TEXT,raw_experience TEXT,
            raw_description TEXT,crawl_time TIMESTAMP,raw_skills TEXT,raw_salary TEXT,raw_education TEXT,
            publish_time TIMESTAMP,source_update_time TIMESTAMP,publish_time_evidence TEXT);
        CREATE TABLE job_info (id INTEGER PRIMARY KEY,raw_id INTEGER,job_name TEXT,company_name TEXT,
            city TEXT,experience TEXT,job_category TEXT,skills TEXT,job_description TEXT,crawl_time TIMESTAMP,
            education TEXT,sync_status INTEGER,publish_time TIMESTAMP,source_update_time TIMESTAMP,publish_time_evidence TEXT);
        CREATE TABLE job_weekly_snapshot_runs (week_start DATE PRIMARY KEY,captured_at TIMESTAMP,row_count INTEGER);
        CREATE TABLE job_weekly_snapshots (week_start DATE,job_id INTEGER,captured_at TIMESTAMP,
            publish_time TIMESTAMP,crawl_time TIMESTAMP,observed_this_week INTEGER,content_hash TEXT,
            snapshot TEXT,PRIMARY KEY(week_start,job_id));
    ''')
    dates = {'publish_time', 'crawl_time', 'update_time', 'source_update_time'}
    columns = ','.join('`'+k+'` '+('TIMESTAMP' if k in dates else 'TEXT') for k in COLUMNS)
    db.raw.execute('CREATE TABLE jobs (id INTEGER PRIMARY KEY,'+columns+')')
    db.raw.commit()
    return db


class TimeTests(unittest.TestCase):
    now = datetime(2026, 10, 22, 7, 0)
    def test_absolute_and_utc(self):
        self.assertEqual(parse_source_time('2026-10-20',self.now),(datetime(2026,10,19,16),'day'))
        self.assertEqual(parse_source_time('2026-10-20T09:30:00+08:00',self.now)[0],datetime(2026,10,20,1,30))
        self.assertEqual(parse_source_time('2026-10-20T01:30:00Z',self.now)[0],datetime(2026,10,20,1,30))
        self.assertEqual(parse_source_time('2026/10/20',self.now)[0],datetime(2026,10,19,16))
    def test_relative_and_invalid(self):
        self.assertEqual(parse_source_time('发布于 昨天',self.now)[0],datetime(2026,10,20,16))
        self.assertEqual(parse_source_time('2小时前',self.now),(datetime(2026,10,22,5),'relative_hour'))
        for raw in ('刚刚活跃','长期招聘','2026-02-30','2027-01-01','',None):
            self.assertEqual(parse_source_time(raw,self.now),(None,None))
    def test_update_is_not_publication(self):
        data=tencent_times({'LastUpdateTime':'2026-10-20'},self.now)
        self.assertIsNone(data['publish_time']); self.assertIsNotNone(data['source_update_time'])
        data=time_fields('更新时间：2026-10-20',None,self.now,'visible')
        self.assertIsNone(data['publish_time']);self.assertIsNotNone(data['source_update_time'])
        self.assertEqual(tencent_times({},self.now)['publish_time'],None)
    def test_explicit_pub_and_update_independent(self):
        data=tencent_times({'PublishTime':'2026-10-18','LastUpdateTime':'2026-10-20'},self.now)
        self.assertLess(data['publish_time'],data['source_update_time'])
        self.assertEqual(data['publish_time_evidence']['source_field'],'PublishTime')
    def test_zhilian_normalization_keeps_missing(self):
        item={'url':'https://www.zhaopin.com/jobdetail/ABC123.html','title':'Python开发工程师','company':'测试公司'}
        row=zhilian.normalize(item,'需要 Python 开发经验。负责后端开发与数据库设计，维护生产服务和测试流程。',self.now)
        self.assertIsNone(row['publish_time']);self.assertNotEqual(row['publish_time'],row['observed_at'])
        item.update(publish_time_raw='发布日期：2026-10-20',publish_time_source='visible_label')
        self.assertIsNotNone(zhilian.normalize(item,None,self.now)['publish_time'])
    def test_shanghai_week_boundary(self):
        self.assertEqual(str(week_start(datetime(2026,10,25,15,59))),'2026-10-19')
        self.assertEqual(str(week_start(datetime(2026,10,25,16,0))),'2026-10-26')
    def test_not_seen_is_not_closed(self):
        payload,_,seen=snapshot_payload({'id':1,'crawl_time':datetime(2026,10,1)},self.now)
        self.assertEqual(seen,0)
        self.assertEqual(json.loads(payload)['snapshot_meta']['presence'],'not_observed_this_week')


class StorageTests(unittest.TestCase):
    def setUp(self):
        self.db=setup_db();self.folder=tempfile.TemporaryDirectory()
        self.now=datetime(2026,10,22,7)
    def tearDown(self): self.db.raw.close();self.folder.cleanup()
    def record(self, pub='2026-10-20'):
        return tencent.normalize({'PostId':'123','RecruitPostName':'Python开发工程师',
            'Responsibility':'负责 Python 服务端研发及日常测试维护，参与数据库设计和系统性能优化。',
            'Requirement':'熟悉 MySQL、Linux 和 Git。','CategoryName':'技术',
            'PublishTime':pub,'LastUpdateTime':'2026-10-21'},self.now)
    def persist(self,row):
        with patch.object(tencent,'get_connection',return_value=self.db),patch.object(tencent,'LOGS',Path(self.folder.name)):
            tencent.persist(row,{'fixture':True})
    def sync_one(self):
        with self.db.cursor(pymysql.cursors.DictCursor) as q:
            q.execute('SELECT j.*,r.source,r.source_url FROM job_info j JOIN job_raw r ON j.raw_id=r.id')
            values=job_to_dict(q.fetchone())
            q.execute('DELETE FROM jobs')
            q.execute('INSERT INTO jobs (id,'+','.join(COLUMNS)+') VALUES (1,'+','.join(['%s']*len(COLUMNS))+')',tuple(values[k] for k in COLUMNS))
        self.db.commit()
    def snapshot(self,now=None):return capture_weekly_snapshot(now or self.now,lambda:self.db)
    def test_full_time_pipeline(self):
        row=self.record();self.persist(row)
        raw=self.db.raw.execute('SELECT publish_time,crawl_time FROM job_raw').fetchone()
        clean=self.db.raw.execute('SELECT publish_time,crawl_time FROM job_info').fetchone()
        self.assertEqual(raw,clean);self.assertNotEqual(raw[0],raw[1])
        self.sync_one()
        self.assertEqual(self.db.raw.execute('SELECT publish_time FROM jobs').fetchone()[0],row['publish_time'])
        self.assertEqual(self.snapshot()['row_count'],1)
        snap=json.loads(self.db.raw.execute('SELECT snapshot FROM job_weekly_snapshots').fetchone()[0])
        self.assertEqual(snap['publish_time_evidence'],json.dumps(row['publish_time_evidence'],ensure_ascii=False))
    def test_missing_does_not_invent_or_erase_known_publication(self):
        row=self.record(None);self.persist(row)
        self.assertIsNone(self.db.raw.execute('SELECT publish_time FROM job_info').fetchone()[0])
        self.persist(self.record())
        known=self.db.raw.execute('SELECT publish_time FROM job_info').fetchone()[0]
        self.persist(self.record(None))
        self.assertEqual(self.db.raw.execute('SELECT publish_time FROM job_info').fetchone()[0],known)
    def test_week_is_idempotent_and_next_week_is_new(self):
        self.persist(self.record());self.sync_one();self.snapshot()
        original=self.db.raw.execute('SELECT snapshot FROM job_weekly_snapshots').fetchone()[0]
        self.db.raw.execute("UPDATE jobs SET title='Changed title'");self.db.commit()
        self.assertEqual(self.snapshot()['status'],'unchanged')
        self.assertEqual(self.db.raw.execute('SELECT snapshot FROM job_weekly_snapshots').fetchone()[0],original)
        self.assertEqual(self.snapshot(datetime(2026,10,26,7))['status'],'succeeded')
        self.assertEqual(self.db.raw.execute('SELECT COUNT(*) FROM job_weekly_snapshots').fetchone()[0],2)
    def test_failure_rolls_back_and_retry_succeeds(self):
        self.persist(self.record());self.sync_one();self.db.fail_items=True
        with self.assertRaises(RuntimeError):self.snapshot()
        self.assertEqual(self.db.raw.execute('SELECT COUNT(*) FROM job_weekly_snapshot_runs').fetchone()[0],0)
        self.db.fail_items=False;self.assertEqual(self.snapshot()['status'],'succeeded')
    def test_empty_does_not_lock_in_empty_week(self):
        self.assertEqual(self.snapshot()['status'],'empty')
        self.assertEqual(self.db.raw.execute('SELECT COUNT(*) FROM job_weekly_snapshot_runs').fetchone()[0],0)


if __name__=='__main__':unittest.main(verbosity=2)
