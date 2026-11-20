"""No network: evidence replay, missing history, scope and retry regressions."""
from datetime import datetime
import json
from pathlib import Path
import tempfile
import sqlite3
import unittest
from unittest.mock import patch

from repair_pipeline.observations import observation, skill_delta, sync_observations, save_observation
from repair_pipeline.salary import monthly_salary


def record(**changes):
    return dict(source='official', source_job_id='123', source_url='https://example.org/jobs/123',
                title='Python engineer', company_name='Example', description='Python SQL',
                description_scope='full_public', skills=['Python', 'SQL'],
                observed_at='2026-11-20T01:00:00', **changes)


class Connection:
    def __init__(self):
        self.commits = self.rollbacks = 0
    def commit(self): self.commits += 1
    def rollback(self): self.rollbacks += 1
    def close(self): pass


class LocalSQL:
    """Execute the production inserts locally, with SQL placeholder adaptation."""
    def __init__(self):
        self.db = sqlite3.connect(':memory:', detect_types=sqlite3.PARSE_DECLTYPES)
        self.db.row_factory = sqlite3.Row
        self.db.executescript('''
          CREATE TABLE jobs(id INTEGER PRIMARY KEY, source TEXT,source_url TEXT,data_type INTEGER);
          CREATE TABLE job_observations(id INTEGER PRIMARY KEY,observation_key TEXT UNIQUE,source TEXT,
            source_job_id TEXT,source_url TEXT,company_name TEXT,title TEXT,observed_at TIMESTAMP,
            content_hash TEXT,raw_text TEXT,skill_tags TEXT,extraction TEXT,ingested_at TIMESTAMP);
          CREATE TABLE job_skill_changes(id INTEGER PRIMARY KEY,job_id INTEGER,added_skills TEXT,
            removed_skills TEXT,modified_skills TEXT,data_sources TEXT,run_id TEXT,created_at TIMESTAMP);
        ''')
    def cursor(self, *args): return self
    def __enter__(self): return self
    def __exit__(self, *args): pass
    def execute(self, sql, values=()):
        self.result = self.db.execute(sql.replace('%s','?').replace('UTC_TIMESTAMP()', 'CURRENT_TIMESTAMP'),values)
    def fetchone(self):
        row = self.result.fetchone()
        return dict(row) if row else None
    def commit(self): self.db.commit()
    def rollback(self): self.db.rollback()
    def close(self): self.db.close()


class ObservationTests(unittest.TestCase):
    def test_real_sql_retry_and_diff_are_atomic(self):
        sql = LocalSQL()
        sql.execute('INSERT INTO jobs VALUES (1,?,?,1)', ('official','https://example.org/jobs/123'))
        self.assertTrue(save_observation(sql, record()))
        sql.commit()
        self.assertFalse(save_observation(sql, record()))
        later = {**record(), 'observed_at': '2026-11-21T01:00:00', 'skills': ['Python','Docker']}
        self.assertTrue(save_observation(sql, later))
        sql.commit()
        self.assertFalse(save_observation(sql, later))
        self.assertEqual(sql.db.execute('SELECT COUNT(*) FROM job_observations').fetchone()[0], 2)
        changes = sql.db.execute('SELECT * FROM job_skill_changes').fetchall()
        self.assertEqual(len(changes), 1)
        self.assertEqual(json.loads(changes[0]['removed_skills']), ['SQL'])
        # A missing current job must roll back both the observation and its delta.
        sql.execute('DELETE FROM jobs'); sql.commit()
        later = {**later, 'observed_at': '2026-11-22T01:00:00', 'skills': ['Python']}
        with self.assertRaises(RuntimeError): save_observation(sql, later)
        sql.rollback()
        self.assertEqual(sql.db.execute('SELECT COUNT(*) FROM job_observations').fetchone()[0], 2)
        sql.close()

    def test_public_salary_only_and_no_annual_or_masked_inference(self):
        self.assertEqual(monthly_salary('15-25K·14薪'), (15000,25000,14))
        self.assertEqual(monthly_salary('1.5万-2万/月'), (15000,20000,None))
        self.assertEqual(monthly_salary('15000-25000元/月'), (15000,25000,None))
        for raw in ('薪资面议', '***', '30-50万/年', '200-300元/天', '25-15K', '15-25', ''):
            self.assertIsNone(monthly_salary(raw), raw)

    def test_same_instant_and_aliases_are_idempotent(self):
        a = observation(record())
        b = observation({**record(), 'observed_at': '2026-11-20T09:00:00+08:00', 'skills': ['sql', 'python', 'Python']})
        self.assertEqual(a['observation_key'], b['observation_key'])
        self.assertEqual(a['observed_at'], datetime(2026, 11, 20, 1))

    def test_missing_identity_or_time_is_rejected(self):
        for fields in ({'source_url': ''}, {'source_job_id': ''}, {'observed_at': ''}):
            with self.assertRaises(ValueError): observation({**record(), **fields})

    def test_actual_skill_delta(self):
        old = observation(record())
        new = observation({**record(), 'observed_at': '2026-11-21T01:00:00', 'skills': ['Python', 'Docker']})
        self.assertEqual(skill_delta(old, new), (['Docker'], ['SQL']))
        self.assertIsNone(skill_delta(new, old))
        self.assertIsNone(skill_delta(None, old))
        self.assertIsNone(skill_delta(old, {**new, 'company_name': 'Different employer'}))

    def test_partial_listing_cannot_create_removals_or_additions(self):
        old = observation(record())
        partial = observation({**record(), 'observed_at': '2026-11-21T01:00:00',
                               'description_scope': 'login_required', 'skills': []})
        self.assertIsNone(skill_delta(old, partial))
        self.assertIsNone(skill_delta(partial, {**old, 'observed_at': datetime(2026,11,22)}))

    def test_legacy_not_fabricated_partial_line_waits_and_restart_resumes(self):
        with tempfile.TemporaryDirectory() as temporary:
            logs = Path(temporary)
            folder = logs / 'source_evidence' / 'official'
            folder.mkdir(parents=True)
            path = folder / '20261120.jsonl'
            path.write_bytes((json.dumps({'response': 'legacy'}) + '\n' +
                              json.dumps({'observation': record()}) + '\n' + '{"unfinished":').encode())
            c = Connection()
            with patch('repair_pipeline.observations.save_observation', return_value=True) as save:
                first = sync_observations(logs, lambda: c)
                self.assertEqual((first['inserted'], first['legacy_skipped']), (1, 1))
                save.assert_called_once()
                self.assertEqual(sync_observations(logs, lambda: c)['inserted'], 0)

    def test_failed_write_does_not_advance_outbox(self):
        with tempfile.TemporaryDirectory() as temporary:
            logs = Path(temporary)
            folder = logs / 'source_evidence' / 'official'
            folder.mkdir(parents=True)
            (folder / '20261120.jsonl').write_text(json.dumps({'observation': record()})+'\n')
            c = Connection()
            with patch('repair_pipeline.observations.save_observation', side_effect=RuntimeError('offline')):
                with self.assertRaises(RuntimeError): sync_observations(logs, lambda: c)
            self.assertFalse((logs / 'observation_offsets.json').exists())
            self.assertEqual(c.rollbacks, 1)
            with patch('repair_pipeline.observations.save_observation', return_value=True):
                self.assertEqual(sync_observations(logs, lambda: c)['inserted'], 1)


if __name__ == '__main__': unittest.main()
