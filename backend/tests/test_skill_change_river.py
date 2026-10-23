import unittest
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from services.skill_change_river import aggregate_changes


def record(id=1, **kwargs):
    return dict(id=id, job_id=10, created_at='2026-09-05 08:00:00',
                added_skills=['Python', 'python'], removed_skills=[], modified_skills=[],
                data_sources=[{'source': 'GitHub'}], run_id='run-1', job_title='开发工程师', **kwargs)


class SkillChangeRiverTests(unittest.TestCase):
    def test_latest_job_day_wins_without_backfilling_missing_days(self):
        first = record()
        later = {**first, 'id': 2, 'created_at': '2026-09-05 10:00:00', 'added_skills': ['SQL']}
        next_day = {**first, 'id': 3, 'created_at': '2026-09-08 08:00:00'}
        result = aggregate_changes([first, later, next_day])
        self.assertEqual(result['observation_count'], 2)
        self.assertEqual([w['date'] for w in result['windows']], ['2026-09-05', '2026-09-08'])
        self.assertEqual(result['windows'][0]['added'], {'SQL': 1})
        self.assertEqual(result['windows'][1]['added'], {'Python': 1})

    def test_distinct_jobs_count_and_changes_are_separate(self):
        first = record()
        second = {**first, 'id': 2, 'job_id': 11, 'removed_skills': '["Rust"]',
                  'modified_skills': [{'skill': 'Python', 'from': 1, 'to': 2}, {'from': 1}]}
        result = aggregate_changes([first, second])
        window = result['windows'][0]
        self.assertEqual(window['samples'], 2)
        self.assertEqual(window['added'], {'Python': 2})
        self.assertEqual(window['removed'], {'Rust': 1})
        self.assertEqual(window['modified'], {'Python': 1})
        self.assertEqual(window['sources'], ['GitHub'])

    def test_undated_records_do_not_invent_windows(self):
        self.assertEqual(aggregate_changes([{**record(), 'created_at': None}])['windows'], [])


if __name__ == '__main__':
    unittest.main()
