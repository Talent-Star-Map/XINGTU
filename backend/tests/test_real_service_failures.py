"""真实模型不可用时必须报错，不能返回演示数据。全程离线。"""
import os
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ['DATABASE_URL'] = 'sqlite://'
os.environ['JWT_SECRET'] = 'offline-real-service-regression-secret-at-least-32'

from fastapi import FastAPI
from fastapi.testclient import TestClient
from database import create_token
from routers import chat, chat_api
from services import llm

app = FastAPI()
app.include_router(chat.router)
app.include_router(chat_api.router)
client = TestClient(app)


class RealServiceTests(unittest.TestCase):
    def setUp(self):
        self.headers = {'Authorization': 'Bearer ' + create_token(1, 'jobseeker')}

    def test_missing_chat_key_returns_service_error_without_answer(self):
        with patch.object(chat_api, '_get_config', return_value={'key': ''}):
            response = client.post('/api/chat', headers=self.headers, json={'message': '如何学习Python'})
        self.assertEqual(response.status_code, 503)
        self.assertNotIn('answer', response.json())

    def test_agent_failure_emits_error_without_demo_or_internal_details(self):
        with patch.object(chat, 'get_job_agent', side_effect=llm.LLMConfigError('private configuration detail')):
            response = client.post('/api/kg/chat', headers=self.headers, json={'message': '岗位需要什么技能'})
        self.assertEqual(response.status_code, 200)
        self.assertIn('"event": "error"', response.text)
        for value in ['demo', 'plan_ready', 'report_done', 'private configuration detail']:
            self.assertNotIn(value, response.text)

    def test_legacy_mock_flag_cannot_produce_fake_resume(self):
        with patch.object(llm, 'is_global_enabled', return_value=True), \
                patch.object(llm, 'is_mock_mode', return_value=True), \
                patch.object(llm, 'OpenAICompatibleProvider') as provider:
            with self.assertRaises(llm.LLMConfigError):
                llm.complete(llm.LLMTier.STRONG, '生成简历', [], json_mode=True)
            provider.assert_not_called()
            self.assertFalse(llm.test_connection(llm.LLMTier.STRONG)['success'])

    def test_missing_model_credentials_never_make_external_call(self):
        with patch.object(llm.httpx, 'Client') as http:
            with self.assertRaises(llm.LLMConfigError):
                llm.OpenAICompatibleProvider('', 'https://example.invalid', 'model').complete('test', [])
            http.assert_not_called()

    def test_real_provider_result_is_preserved(self):
        result = {'text': '模型实际返回内容', 'mock': False}
        with patch.object(llm, 'is_global_enabled', return_value=True), \
                patch.object(llm, 'is_mock_mode', return_value=False), \
                patch.object(llm, '_get_api_key', return_value='offline-key'), \
                patch.object(llm.OpenAICompatibleProvider, 'complete', return_value=result):
            self.assertEqual(llm.complete(llm.LLMTier.FAST, 'test', []), result)


if __name__ == '__main__':
    unittest.main()
