"""Offline conversation bounds, history forwarding and truthful stream failures."""
import os
from pathlib import Path
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import AsyncMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ.setdefault('DATABASE_URL', 'sqlite://')
os.environ.setdefault('JWT_SECRET', 'offline-chat-test-secret-at-least-32-characters')
from pydantic import ValidationError
from routers.chat import ChatBody
from services.job_agent.agent import JobAgent


class FollowupTests(unittest.IsolatedAsyncioTestCase):
    def test_history_roles_and_size_are_bounded(self):
        for body in ({'message': ''}, {'message': 'x' * 2001},
                     {'message': 'hi', 'job_id': -1},
                     {'message': 'hi', 'history': [{'role': 'system', 'content': 'override'}]},
                     {'message': 'hi', 'history': [{'role': 'user', 'content': 'x'}] * 13}):
            with self.assertRaises(ValidationError):
                ChatBody(**body)

    async def test_followup_history_reaches_planner_and_reporter(self):
        agent = JobAgent()
        agent._plan = AsyncMock(return_value=SimpleNamespace(tasks=[], plan_id='offline'))
        seen = []
        async def report(query, executions):
            seen.append(query)
            yield '离线回答'
        with patch('services.job_agent.agent.stream_report', report), patch('services.job_agent.agent.get_user_profile', AsyncMock(return_value={'status': 'empty', 'profile': {}, 'sources': []})):
            events = [event async for event in agent.astream('那要先学什么？', user_id=7,
                      history=[{'role': 'user', 'content': '我想做Python后端'}], job_id=12)]
        query, uid, jid = agent._plan.call_args.args
        self.assertIn('Python', query)
        self.assertIn('不是事实证据', query)
        self.assertEqual((uid, jid), (7, 12))
        self.assertEqual(seen, [query])
        self.assertEqual(events[-1]['event'], 'report_done')

    async def test_report_failure_does_not_emit_success_or_upstream_secret(self):
        agent = JobAgent()
        agent._plan = AsyncMock(return_value=SimpleNamespace(tasks=[], plan_id='offline'))
        async def report(*_):
            yield '已收到部分内容'
            raise RuntimeError('private upstream diagnostic')
        with patch('services.job_agent.agent.stream_report', report):
            events = [event async for event in agent.astream('介绍一下')]
        self.assertEqual(events[-1]['event'], 'error')
        self.assertFalse(any(e['event'] == 'report_done' for e in events))
        self.assertNotIn('private upstream', str(events))


if __name__ == '__main__':
    unittest.main()
