"""Offline HTTP regression checks: no cloud DB, email, model calls or ETL runs."""
import contextlib
from datetime import datetime, timedelta, timezone
import io
import os
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sqlalchemy.engine import URL
os.environ['DATABASE_URL'] = URL.create(
    'mysql+pymysql', username='test', password='test',
    host='127.0.0.1', port=1, database='offline',
).render_as_string(hide_password=False)
os.environ['JWT_SECRET'] = 'offline-security-regression-secret-at-least-32-bytes'

import jwt
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import VerifyCode, create_token, JWT_SECRET, JWT_ALGO
from routers import auth, chat, chat_api, kg

app = FastAPI()
for module in (auth, chat, chat_api, kg):
    app.include_router(module.router)
client = TestClient(app)


class AuthBoundaryTests(unittest.TestCase):
    admin_paths = ('/api/kg/admin/rebuild', '/api/kg/admin/sync', '/api/kg/admin/attribute')

    def test_anonymous_invalid_expired_and_forged_tokens_cannot_start_admin_jobs(self):
        expired = jwt.encode({'user_id': 1, 'role': 'admin',
                              'exp': datetime.now(timezone.utc) - timedelta(seconds=10)},
                             JWT_SECRET, algorithm=JWT_ALGO)
        forged = jwt.encode({'user_id': 1, 'role': 'admin',
                             'exp': datetime.now(timezone.utc) + timedelta(hours=1)},
                            'a-different-signing-secret-at-least-32-bytes', algorithm=JWT_ALGO)
        with patch('subprocess.Popen') as spawn:
            for path in self.admin_paths:
                for token in (None, 'invalid', expired, forged):
                    response = client.post(path, params={'token': token} if token else {})
                    self.assertEqual(response.status_code, 401, (path, response.text))
            spawn.assert_not_called()

    def test_non_admin_roles_cannot_start_admin_jobs(self):
        with patch('subprocess.Popen') as spawn:
            for role in ('jobseeker', 'enterprise'):
                for path in self.admin_paths:
                    response = client.post(path, headers={'Authorization': f'Bearer {create_token(1, role)}'})
                    self.assertEqual(response.status_code, 403)
            spawn.assert_not_called()

    def test_admin_can_start_jobs_using_query_or_header_token(self):
        token = create_token(1, 'admin')
        with patch('subprocess.Popen') as spawn, patch('builtins.open', unittest.mock.mock_open()):
            for index, path in enumerate(self.admin_paths):
                options = {'params': {'token': token}} if index % 2 else {'headers': {'Authorization': f'Bearer {token}'}}
                response = client.post(path, **options)
                self.assertEqual(response.status_code, 200, response.text)
                self.assertTrue(response.json()['success'])
            self.assertEqual(spawn.call_count, 3)

    def test_chat_rejects_unauthenticated_requests_before_provider_access(self):
        with patch.object(chat_api, '_get_config') as config, patch.object(chat, 'get_job_agent') as agent:
            for path in ('/api/chat', '/api/kg/chat'):
                for token in (None, 'invalid'):
                    response = client.post(path, json={'message': 'hello'},
                                           params={'token': token} if token else {})
                    self.assertEqual(response.status_code, 401)
            config.assert_not_called()
            agent.assert_not_called()

    def test_chat_accepts_valid_login_and_passes_identity_to_agent(self):
        token = create_token(7, 'jobseeker')
        with patch.object(chat_api, '_get_config', return_value={'key': ''}):
            response = client.post('/api/chat', params={'token': token}, json={'message': 'hello'})
            self.assertEqual(response.status_code, 503)

        class Agent:
            async def astream(self, query, **kwargs):
                self.user_id = kwargs['user_id']
                yield {'event': 'report_done', 'answer': 'ok'}

        agent = Agent()
        with patch.object(chat, 'get_job_agent', return_value=agent):
            response = client.post('/api/kg/chat', headers={'Authorization': f'Bearer {token}'},
                                   json={'message': 'hello'})
            self.assertEqual(response.status_code, 200)
            self.assertIn('report_done', response.text)
            self.assertEqual(agent.user_id, 7)


class VerificationCodeTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
        VerifyCode.__table__.create(self.engine)
        self.session_factory = sessionmaker(bind=self.engine)
        self.sessions = patch.object(auth, 'get_session', side_effect=self.session_factory)
        self.sessions.start()

    def tearDown(self):
        self.sessions.stop()
        self.engine.dispose()

    def test_send_failure_does_not_leak_or_persist_new_code(self):
        with self.session_factory() as session:
            session.add(VerifyCode(target='test@example.com', code='111111'))
            session.commit()
        stdout, stderr = io.StringIO(), io.StringIO()
        with patch.object(auth.secrets, 'choice', return_value='6'), \
                patch.object(auth, 'send_email', side_effect=RuntimeError('SMTP error includes 666666')), \
                contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
            response = client.post('/api/auth/send-code', json={'account': 'test@example.com'})
        self.assertEqual(response.status_code, 503)
        self.assertFalse(response.json()['success'])
        self.assertNotIn('666666', response.text + stdout.getvalue() + stderr.getvalue())
        self.assertNotIn('code', response.json())
        with self.session_factory() as session:
            self.assertEqual([r.code for r in session.query(VerifyCode).all()], ['111111'])

    def test_success_stores_delivered_code_without_returning_it(self):
        with patch.object(auth.secrets, 'choice', return_value='6'), patch.object(auth, 'send_email') as send:
            response = client.post('/api/auth/send-code', json={'account': 'test@example.com'})
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()['success'])
        self.assertNotIn('666666', response.text)
        send.assert_called_once_with('test@example.com', '666666')
        with self.session_factory() as session:
            self.assertEqual(session.query(VerifyCode).one().code, '666666')


if __name__ == '__main__':
    unittest.main()
