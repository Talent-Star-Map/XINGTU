"""技能接口保留全局/岗位范围，避免合并时误判；只使用模拟数据库。"""
import os
from pathlib import Path
import sys
import unittest
from unittest.mock import MagicMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ['DATABASE_URL'] = 'sqlite://'
os.environ['JWT_SECRET'] = 'offline-skill-tests-secret-at-least-32-characters'
from routers import learning_api


class SkillMarkTests(unittest.TestCase):
    def test_scope_is_returned_and_user_filter_kept(self):
        session = MagicMock()
        session.execute.return_value.fetchall.return_value = [
            (3, 'Python', False, None, None), (2, 'Python', True, None, 9),
        ]
        with patch.object(learning_api, '_get_uid', return_value=(7, 'jobseeker')), \
                patch.object(learning_api, 'get_session', return_value=session):
            result = learning_api.get_skills(token='offline', job_id=9)
        self.assertEqual([r['job_id'] for r in result['data']], [None, 9])
        self.assertFalse(result['data'][0]['mastered'])
        query, params = session.execute.call_args.args
        self.assertIn('WHERE user_id = :uid', str(query))
        self.assertIn('(job_id = :jid OR job_id IS NULL)', str(query))
        self.assertEqual(params, {'uid': 7, 'jid': 9})
        session.commit.assert_not_called()
        session.close.assert_called_once()


if __name__ == '__main__':
    unittest.main()
