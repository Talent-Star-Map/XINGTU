"""Offline tests of profile selection, minimization and authenticated identity."""
import os
import sys
import json
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ.setdefault('DATABASE_URL', 'sqlite://')
os.environ.setdefault('JWT_SECRET', 'offline-chat-test-secret-at-least-32-characters')
from services.chat_profile import build_context, merge_skills, load_chat_profile
from services.job_agent.tools import get_user_profile
from services.job_agent.agent import JobAgent
from routers.chat import chat, ChatBody


class ProfileTests(unittest.IsolatedAsyncioTestCase):
    def test_resume_replaces_stale_skills_and_global_removal_wins(self):
        sections = {'skills': {'categories': [{'skills': ['Python', 'python', 'SQL']}]}}
        marks = [{'skill_name': 'Python', 'mastered': False, 'job_id': None},
                 {'skill_name': 'Python', 'mastered': True, 'job_id': 4},
                 {'skill_name': 'Docker', 'mastered': True, 'job_id': None}]
        self.assertEqual(merge_skills('Java,Vue', sections, marks), (['SQL', 'Docker'], 'latest_resume'))
        self.assertEqual(merge_skills('Java', {'skills': {'categories': [{'skills': [' ']}]}}, []), (['Java'], 'account'))

    def test_context_whitelist_redacts_contacts_and_uses_resume_education(self):
        context = build_context({'password': 'private-secret', 'email': 'private@example.com',
                                 'bio': '联系 private@example.com 13812345678', 'skills': 'Python'},
                                {'education': {'items': [{'institution': '示例大学', 'degree': '本科'}]}}, [])
        encoded = json.dumps(context, ensure_ascii=False)
        self.assertNotIn('private-secret', encoded)
        self.assertNotIn('private@example.com', encoded)
        self.assertNotIn('13812345678', encoded)
        self.assertEqual(context['profile']['education'], '本科')
        self.assertNotIn('education', context['missing'])

    def test_loader_scopes_user_resume_sections_and_marks(self):
        session = MagicMock()
        user_query, resume_query, section_query = MagicMock(), MagicMock(), MagicMock()
        session.query.side_effect = [user_query, resume_query, section_query]
        user_query.filter.return_value.first.return_value = SimpleNamespace(skills='Python')
        resume_query.filter.return_value.order_by.return_value.first.return_value = SimpleNamespace(id=99)
        section_query.filter.return_value.order_by.return_value.all.return_value = []
        session.execute.return_value.mappings.return_value.all.return_value = []
        self.assertEqual(load_chat_profile(7, session)['status'], 'ready')
        for query, expected in ((user_query, 7), (resume_query, 7), (section_query, 99)):
            predicate = query.filter.call_args.args[0]
            self.assertEqual(list(predicate.compile().params.values()), [expected])
        self.assertEqual(session.execute.call_args.args[1], {'uid': 7})
        session.close.assert_not_called()

    async def test_tool_ignores_forged_identity_and_hides_failures(self):
        with patch('services.chat_profile.load_chat_profile', return_value={'status': 'empty'}) as loader:
            await get_user_profile({'user_id': 888}, 7)
            loader.assert_called_once_with(7)
        with patch('services.chat_profile.load_chat_profile', side_effect=RuntimeError('secret')):
            result = await get_user_profile({}, 7)
            self.assertEqual(result['status'], 'unavailable')
            self.assertNotIn('secret', str(result))

    async def test_profile_reaches_reporter_without_planner_tool_and_is_per_request(self):
        agent = JobAgent()
        agent._plan = AsyncMock(return_value=SimpleNamespace(tasks=[], plan_id='test'))
        profiles = [{'status': 'ready', 'profile': {'skills': ['Python']}, 'sources': ['account']},
                    {'status': 'unavailable', 'profile': {}, 'sources': []}]
        seen = []
        async def report(query, executions):
            seen.append((query, executions))
            yield '建议'
        with patch('services.job_agent.agent.get_user_profile', AsyncMock(side_effect=profiles)) as loader, patch('services.job_agent.agent.stream_report', report):
            first = [e async for e in agent.astream('我先学什么', 7)]
            second = [e async for e in agent.astream('我先学什么', 8)]
        self.assertEqual([c.args[1] for c in loader.call_args_list], [7, 8])
        self.assertIn('Python', seen[0][0])
        self.assertNotIn('Python', seen[1][0])
        self.assertEqual(seen[0][1][0]['result'], profiles[0])
        self.assertEqual(first[1]['status'], 'ready')
        self.assertEqual(second[1]['status'], 'unavailable')
        self.assertEqual(second[-1]['event'], 'report_done')

    async def test_enterprise_id_cannot_load_jobseeker_profile(self):
        calls = []
        class Agent:
            async def astream(self, *args, **kwargs):
                calls.append(kwargs['user_id'])
                yield {'event': 'report_done', 'answer': 'ok'}
        with patch('routers.chat.get_job_agent', return_value=Agent()):
            for role in ('enterprise', 'admin', 'jobseeker'):
                response = await chat(ChatBody(message='你好'), {'user_id': 7, 'role': role})
                async for _ in response.body_iterator:
                    pass
        self.assertEqual(calls, [None, None, 7])


if __name__ == '__main__':
    unittest.main()
