"""验证码接口离线回归：内存数据库、模拟邮件，不访问实际邮箱或云数据库。"""
import contextlib
import io
import os
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ['DATABASE_URL'] = 'sqlite://'
os.environ['JWT_SECRET'] = 'offline-verification-code-test-secret-at-least-32'

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import VerifyCode
from routers import auth

app = FastAPI()
app.include_router(auth.router)
client = TestClient(app)


class VerificationCodeSecurityTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
        VerifyCode.__table__.create(self.engine)
        self.sessions = sessionmaker(bind=self.engine)
        self.session_patch = patch.object(auth, 'get_session', side_effect=self.sessions)
        self.session_patch.start()

    def tearDown(self):
        self.session_patch.stop()
        self.engine.dispose()

    def stored_codes(self):
        with self.sessions() as session:
            return [item.code for item in session.query(VerifyCode).all()]

    def test_send_failure_never_returns_or_logs_code_and_preserves_previous_code(self):
        with self.sessions() as session:
            session.add(VerifyCode(target='test@example.com', code='111111'))
            session.commit()
        stdout, stderr = io.StringIO(), io.StringIO()
        with patch.object(auth.secrets, 'choice', return_value='6'), \
                patch.object(auth, 'send_email', side_effect=RuntimeError('SMTP failed with code 666666')), \
                contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
            response = client.post('/api/auth/send-code', json={'account': 'test@example.com'})
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json(), {'success': False, 'message': '验证码发送失败，请稍后重试'})
        self.assertNotIn('666666', response.text + stdout.getvalue() + stderr.getvalue())
        self.assertNotIn('SMTP', response.text)
        self.assertEqual(self.stored_codes(), ['111111'])

    def test_failed_first_send_does_not_save_undelivered_code(self):
        with patch.object(auth, 'send_email', side_effect=TimeoutError('mail timeout')):
            response = client.post('/api/auth/send-code', json={'account': 'test@example.com'})
        self.assertEqual(response.status_code, 503)
        self.assertEqual(self.stored_codes(), [])

    def test_success_saves_delivered_code_without_returning_it(self):
        with self.sessions() as session:
            session.add(VerifyCode(target='test@example.com', code='111111'))
            session.commit()
        with patch.object(auth.secrets, 'choice', return_value='6'), patch.object(auth, 'send_email') as send:
            response = client.post('/api/auth/send-code', json={'account': 'test@example.com'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'success': True, 'message': '验证码已发送到邮箱'})
        self.assertNotIn('666666', response.text)
        send.assert_called_once_with('test@example.com', '666666')
        self.assertEqual(self.stored_codes(), ['666666'])

    def test_invalid_account_does_not_send_or_store_code(self):
        with patch.object(auth, 'send_email') as send:
            response = client.post('/api/auth/send-code', json={'account': 'not-an-email'})
        self.assertEqual(response.status_code, 400)
        send.assert_not_called()
        self.assertEqual(self.stored_codes(), [])

    def test_database_failure_does_not_send_code(self):
        from unittest.mock import MagicMock
        session = MagicMock()
        session.flush.side_effect = RuntimeError('storage unavailable')
        with patch.object(auth, 'get_session', return_value=session), patch.object(auth, 'send_email') as send:
            response = client.post('/api/auth/send-code', json={'account': 'test@example.com'})
        self.assertEqual(response.status_code, 503)
        send.assert_not_called()
        session.rollback.assert_called_once()
        session.close.assert_called_once()

    def test_smtp_connection_has_timeout(self):
        with patch.object(auth.smtplib, 'SMTP_SSL') as smtp:
            auth.send_email('test@example.com', '666666')
        smtp.assert_called_once_with(auth.SMTP_HOST, auth.SMTP_PORT, timeout=10)


if __name__ == '__main__':
    unittest.main()
