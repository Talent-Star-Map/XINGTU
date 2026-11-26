"""Offline regression tests: tenant isolation, one-use challenges, PCM validation, API mode."""
import io
import os
from pathlib import Path
import sys
import time
import unittest
from unittest.mock import patch
import wave

os.environ['DATABASE_URL'] = 'sqlite:///:memory:'
os.environ['JWT_SECRET'] = 'interview-audio-test-only-secret-at-least-32-characters'
os.environ['INTERVIEW_ASR_MODE'] = 'cpu'
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from services import interview_audio as audio
from routers.interview_media import router
from auth_guard import require_jobseeker


def wav(seconds=5, silent=False):
    data = (np.zeros(16000*seconds) if silent else np.sin(np.arange(16000*seconds)*0.08)*6000).astype('<i2')
    buffer = io.BytesIO()
    with wave.open(buffer, 'wb') as output:
        output.setnchannels(1); output.setsampwidth(2); output.setframerate(16000); output.writeframes(data.tobytes())
    return buffer.getvalue()


class AudioChecks(unittest.TestCase):
    def setUp(self):
        audio.SESSIONS.clear()
        self.config = patch.object(audio, 'status', return_value={'configured': True})
        self.config.start()
        self.addCleanup(self.config.stop)

    def room(self):
        value = audio.create_session(1)
        return value, audio.get_room(value['session_id'], 1)

    def test_owner_expiry_and_memory_delete(self):
        value, room = self.room()
        with self.assertRaises(HTTPException) as failure:
            audio.get_room(value['session_id'], 2)
        self.assertEqual(failure.exception.status_code, 404)
        room['created'] -= audio.TTL + 1
        with self.assertRaises(HTTPException): audio.get_room(value['session_id'], 1)
        value, _ = self.room()
        audio.close_session(value['session_id'], 1)
        self.assertNotIn(value['session_id'], audio.SESSIONS)

    def test_invalid_audio_and_silence(self):
        self.assertEqual(len(audio.decode_wav(wav())), 80000)
        for invalid in (b'garbage', wav(silent=True), wav()[:-20], wav(29), b'x'*(audio.MAX_BYTES+1)):
            with self.assertRaises(HTTPException): audio.decode_wav(invalid)

    def test_challenge_order_replay_expiry_and_requires_enrollment(self):
        self.assertTrue(audio.phrase_matches('苹果，森林。蓝天！', ['苹果', '森林', '蓝天']))
        self.assertFalse(audio.phrase_matches('森林苹果蓝天', ['苹果', '森林', '蓝天']))
        value, room = self.room()
        with self.assertRaises(HTTPException): audio.analyze(wav(), room['id'], 1)
        room['last_audio'] = 0
        room['challenge_until'] = 0
        with self.assertRaises(HTTPException): audio.analyze(wav(), room['id'], 1, value['challenge_id'])
        value = audio.challenge(room['id'], 1); room['last_audio'] = 0
        # Failed recognition consumes the challenge too.
        with patch.object(audio, 'models', return_value=(None, None)), patch.object(audio, 'transcribe', return_value='不正确口令'):
            result = audio.analyze(wav(), room['id'], 1, value['challenge_id'])
        self.assertFalse(result['accepted']); room['last_audio'] = 0
        with self.assertRaises(HTTPException): audio.analyze(wav(), room['id'], 1, value['challenge_id'])

    def test_checkpoint_required_and_bounded_rooms(self):
        _, room = self.room(); room['embedding'] = np.ones(4); room['checkpoint'] -= 181
        result = audio.analyze(wav(), room['id'], 1)
        self.assertTrue(result['checkpoint_required']); self.assertFalse(result['accepted'])
        for _ in range(5): audio.create_session(1)
        self.assertLessEqual(len(audio.SESSIONS), 2)

    def test_busy_and_authenticated_endpoints(self):
        _, room = self.room()
        with patch.object(audio.INFERENCE, 'acquire', return_value=False):
            with self.assertRaises(HTTPException) as failure: audio.analyze(wav(), room['id'], 1)
            self.assertEqual(failure.exception.status_code, 429)
        app = FastAPI(); app.include_router(router, prefix='/api/interview')
        client = TestClient(app)
        self.assertEqual(client.get('/api/interview/audio/status').status_code, 401)
        app.dependency_overrides[require_jobseeker] = lambda: {'user_id': 1, 'role': 'jobseeker'}
        self.assertEqual(client.post('/api/interview/audio/session').status_code, 200)
        self.assertEqual(client.post('/api/interview/audio/recognize', params={'session_id': room['id']}, content=b'x'*(audio.MAX_BYTES+1)).status_code, 413)

    def test_api_mode_uses_recording_not_client_transcript(self):
        fake = unittest.mock.Mock()
        fake.json.return_value = {'text': '真实录音识别结果'}
        with patch.dict(os.environ, {'INTERVIEW_ASR_MODE': 'api', 'INTERVIEW_ASR_URL': 'https://asr.example.test/v1/audio/transcriptions', 'INTERVIEW_ASR_MODEL': 'test', 'INTERVIEW_ASR_API_KEY': 'test-key'}), patch('requests.post', return_value=fake) as post:
            self.assertEqual(audio.transcribe(b'pcm-recording', None, None), '真实录音识别结果')
            self.assertEqual(post.call_args.kwargs['files']['file'][1], b'pcm-recording')

    def test_browser_mode_never_runs_server_transcription(self):
        _, room = self.room()
        room['embedding'] = np.array([1.0, 0.0], dtype='float32')
        extractor = unittest.mock.Mock()
        extractor.is_ready.return_value = True
        extractor.compute.return_value = [1.0, 0.0]
        with patch.dict(os.environ, {'INTERVIEW_ASR_MODE': 'browser'}), patch.object(audio, 'models', return_value=(None, extractor)) as models, patch.object(audio, 'transcribe', side_effect=AssertionError('server ASR invoked')):
            value = audio.analyze(wav(), room['id'], 1, browser_text='浏览器识别的真实回答')
            self.assertTrue(value['accepted'])
            self.assertEqual(value['transcription_source'], 'browser_unverified')
            models.assert_called_once_with(speaker_only=True)


if __name__ == '__main__': unittest.main()
