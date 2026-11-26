"""Offline upload and chat integration tests; no provider or cloud requests."""
import io
import json
import os
from pathlib import Path
import sys
import tempfile
import time
import types
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ.setdefault('DATABASE_URL', 'sqlite://')
os.environ.setdefault('JWT_SECRET', 'offline-material-test-secret-at-least-32-characters')
from services import chat_materials as materials


class MaterialTests(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        mocked = patch.object(materials, 'ROOT', Path(directory.name))
        mocked.start()
        self.addCleanup(mocked.stop)

    def test_owner_role_expiry_and_deletion(self):
        item = materials.save_material('jobseeker:7', materials.prepare_material('项目.md', '示例项目 Python'.encode()))
        self.assertEqual(materials.load_materials('jobseeker:7', [item['id']])[0]['text'], '示例项目 Python')
        for owner in ('jobseeker:8', 'enterprise:7'):
            with self.assertRaises(materials.MaterialError):
                materials.load_materials(owner, [item['id']])
        with self.assertRaises(materials.MaterialError):
            materials.load_materials('jobseeker:7', ['../bad'])
        with patch.object(materials.time, 'time', return_value=time.time() + materials.TTL + 1):
            with self.assertRaises(materials.MaterialError):
                materials.load_materials('jobseeker:7', [item['id']])
        self.assertFalse((materials.ROOT / f"{item['id']}.json").exists())
        item = materials.save_material('jobseeker:7', materials.prepare_material('a.txt', b'hello'))
        materials.remove_material('jobseeker:7', item['id'])
        with self.assertRaises(materials.MaterialError):
            materials.load_materials('jobseeker:7', [item['id']])

    def test_docx_tables_and_text_limits(self):
        from docx import Document
        document = Document()
        document.add_paragraph('项目说明')
        document.add_table(rows=1, cols=1).cell(0, 0).text = 'Python 项目'
        stream = io.BytesIO()
        document.save(stream)
        item = materials.prepare_material('a.docx', stream.getvalue())
        self.assertIn('Python 项目', item['text'])
        item = materials.prepare_material('a.txt', b'a' * (materials.TEXT_LIMIT + 1))
        self.assertTrue(item['truncated'])
        self.assertEqual(len(item['text']), materials.TEXT_LIMIT)
        for name, data in [('a.exe', b'bad'), ('a.pdf', b'bad'), ('a.png', b'bad'), ('a.txt', b''), ('a.txt', b'x' * (materials.MAX_BYTES + 1))]:
            with self.assertRaises(materials.MaterialError):
                materials.prepare_material(name, data)

    def test_image_payload_and_explicit_missing_vision(self):
        from PIL import Image
        stream = io.BytesIO()
        Image.new('RGB', (40, 30), 'purple').save(stream, format='PNG')
        item = materials.prepare_material('示例.png', stream.getvalue())
        fake = types.ModuleType('services.llm')
        fake.LLMTier = types.SimpleNamespace(VISION='vision')
        fake.get_config = lambda key: ''
        calls = []
        def complete(*args, **kwargs):
            calls.append((args, kwargs))
            return {'text': '紫色矩形'}
        fake.complete = complete
        with patch.dict(sys.modules, {'services.llm': fake}):
            with self.assertRaisesRegex(materials.MaterialError, '尚未配置'):
                materials.material_context([item], '有什么？')
            self.assertEqual(calls, [])
            fake.get_config = lambda key: 'offline-config'
            context = materials.material_context([item], '有什么？')
        self.assertIn('紫色矩形', context[0]['text'])
        content = calls[0][0][2][0]['content']
        self.assertTrue(content[-1]['image_url']['url'].startswith('data:image/jpeg;base64,'))
        self.assertIn('示例.png', context[0]['name'])


class ChatMaterialIntegrationTests(unittest.IsolatedAsyncioTestCase):
    async def test_attachment_only_question_uses_materials_in_general_answer(self):
        from services.job_agent.agent import JobAgent
        seen = []
        async def report(query, executions, mode='evidence'):
            seen.append((query, mode))
            yield '根据 demo.txt 的建议'
        with patch('services.job_agent.agent.stream_report', report):
            events = [event async for event in JobAgent().astream('分析一下这个', material_context=[{'name': 'demo.txt', 'text': 'Python project'}])]
        self.assertEqual(seen[0][1], 'general')
        self.assertIn('demo.txt', seen[0][0])
        self.assertIn('Python project', seen[0][0])
        self.assertEqual(events[-1]['event'], 'report_done')

    async def test_materials_reach_agent_and_wrong_owner_is_rejected(self):
        from routers.chat import chat, ChatBody
        from fastapi import HTTPException
        seen = []
        class Agent:
            async def astream(self, *args, **kwargs):
                seen.append(kwargs)
                yield {'event': 'report_done', 'answer': '示例回答'}
        with tempfile.TemporaryDirectory() as directory, patch.object(materials, 'ROOT', Path(directory)), patch('routers.chat.get_job_agent', return_value=Agent()):
            item = materials.save_material('jobseeker:7', materials.prepare_material('demo.txt', b'Python project'))
            body = ChatBody(message='请结合材料给出建议', attachment_ids=[item['id']])
            response = await chat(body, {'role': 'jobseeker', 'user_id': 7})
            events = [event async for event in response.body_iterator]
            self.assertIn('materials_started', events[0])
            self.assertEqual(seen[0]['material_context'][0]['text'], 'Python project')
            with self.assertRaises(HTTPException) as error:
                await chat(body, {'role': 'enterprise', 'user_id': 7})
            self.assertEqual(error.exception.status_code, 422)


if __name__ == '__main__':
    unittest.main()
