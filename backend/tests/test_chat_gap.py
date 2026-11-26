"""Exercise the real gap calculation without cloud database clients."""
import ast
from pathlib import Path
import sys
import types
import unittest
from unittest.mock import patch

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))


class ChatGapTests(unittest.TestCase):
    def setUp(self):
        source = BACKEND / 'services/kg_service.py'
        tree = ast.parse(source.read_text(encoding='utf-8'))
        function = next(node for node in tree.body
                        if isinstance(node, ast.FunctionDef) and node.name == 'get_gap_analysis')
        self.rows = [{'id': 42, 'skills': ['Python', 'SQL']}]
        self.profile = {'status': 'ready', 'profile': {'skills': ['python']}, 'sources': ['fixture']}
        module = types.ModuleType('services.chat_profile')
        module.load_chat_profile = self.load_profile
        mocked = patch.dict(sys.modules, {'services.chat_profile': module})
        mocked.start()
        self.addCleanup(mocked.stop)
        namespace = {'Dict': dict, 'Any': object, '_query': self.query}
        isolated = ast.fix_missing_locations(ast.Module(body=[function], type_ignores=[]))
        exec(compile(isolated, str(source), 'exec'), namespace)
        self.analyze = namespace['get_gap_analysis']

    def load_profile(self, user_id):
        self.assertEqual(user_id, 7)
        return self.profile

    def query(self, statement, parameters):
        self.assertEqual(parameters, {'jid': 42})
        self.assertIn('coalesce(req.canonical_name,req.name)', statement)
        return self.rows

    def test_current_profile_and_skill_aliases(self):
        result = self.analyze(7, 42)
        self.assertEqual(result['have'], ['Python'])
        self.assertEqual(result['need'], ['SQL'])
        self.assertEqual(result['match_rate'], 0.5)

    def test_missing_profile_has_no_match_rate(self):
        self.profile = {'status': 'empty', 'profile': {}, 'sources': []}
        self.assertIsNone(self.analyze(7, 42)['match_rate'])

    def test_missing_job_has_actionable_error(self):
        self.rows = []
        self.assertIn('重新选择岗位', self.analyze(7, 42)['error'])

    def test_job_without_skills_has_no_match_rate(self):
        self.rows[0]['skills'] = []
        self.assertIsNone(self.analyze(7, 42)['match_rate'])


if __name__ == '__main__':
    unittest.main()
