"""通用问题和闲聊不进入岗位检索。"""
import os
import sys
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ.setdefault('DATABASE_URL', 'sqlite://')
os.environ.setdefault('JWT_SECRET', 'offline-chat-test-secret-at-least-32-characters')

from services.job_agent.planner import answer_mode
from services.job_agent.agent import JobAgent


class AnswerModeTests(unittest.IsolatedAsyncioTestCase):
    def test_general_and_chat_do_not_look_like_evidence_search(self):
        self.assertEqual(answer_mode('你好'), 'chat')
        self.assertEqual(answer_mode('今天天气怎么样'), 'chat')
        self.assertEqual(answer_mode('Python 后端岗位需要哪些核心技能？'), 'general')
        self.assertEqual(answer_mode('Java 和 Python 岗位的技能要求有哪些区别？'), 'general')
        self.assertEqual(answer_mode('如何根据简历确定下一步学习重点？'), 'general')
        self.assertEqual(answer_mode('帮我找 Python 后端岗位'), 'evidence')
        self.assertEqual(answer_mode('这个岗位最近的薪资趋势'), 'evidence')
        self.assertEqual(answer_mode('Python 后端需要哪些核心技能', job_id=12), 'evidence')

    async def test_general_question_skips_job_search(self):
        async def report(query, executions, mode='evidence'):
            self.assertEqual(mode, 'general')
            self.assertNotIn('semantic_search', query)
            yield 'Python 后端通常需要 Web 框架、数据库和接口设计。'

        agent = JobAgent()
        with patch.object(agent, '_plan', AsyncMock(side_effect=AssertionError('should not plan'))), \
             patch('services.job_agent.agent.stream_report', report), \
             patch('services.job_agent.agent.get_user_profile', AsyncMock(return_value={'status': 'empty', 'profile': {}, 'sources': []})):
            events = [event async for event in agent.astream('Python 后端岗位需要哪些核心技能？')]
        self.assertEqual(events[-1]['event'], 'report_done')
        self.assertIn('Web 框架', events[-1]['answer'])
        self.assertEqual(events[-1]['references'], [])
        ready = next(event for event in events if event['event'] == 'plan_ready')
        self.assertEqual(ready['tasks'], [])


if __name__ == '__main__':
    unittest.main()
