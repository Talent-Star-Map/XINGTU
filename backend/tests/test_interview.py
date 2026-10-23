"""Offline contract checks without DB, network or live model calls."""
import json
import os
import sys
from pathlib import Path
os.environ.setdefault('DATABASE_URL', 'sqlite:///:memory:')
os.environ.setdefault('JWT_SECRET', 'interview-offline-test-secret-not-for-production-2026')
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fastapi import HTTPException
from pydantic import ValidationError
from starlette.requests import Request
from unittest.mock import patch
from routers.interview import question, report, InterviewRequest, Turn, router
from auth_guard import require_jobseeker, require_user

me = {'user_id': 1, 'role': 'jobseeker'}
for cached, expected in [(None, 401), ({'user_id': 2, 'role': 'enterprise'}, 403)]:
    request = Request({'type': 'http', 'headers': [], 'query_string': b''})
    if cached:
        request.state.identity = cached
    try:
        require_jobseeker(require_user(request))
        raise AssertionError('unauthorized access accepted')
    except HTTPException as exc:
        assert exc.status_code == expected
assert all(route.dependant.dependencies for route in router.routes)
body = InterviewRequest(role='前端开发')
with patch('routers.interview.complete', return_value={'text': json.dumps({'question': '请介绍一个项目', 'focus': '项目经验'})}) as model:
    assert question(body, me)['focus'] == '项目经验'
    assert '前端开发' in model.call_args.args[2][0]['content']
turn = Turn(question='请介绍项目', answer='我使用 React 编写了组件。')
for fn, req, code in [(question, InterviewRequest(role='前端', history=[turn]*5), 422), (report, body, 422)]:
    try:
        fn(req, me)
        raise AssertionError('invalid turn count accepted')
    except HTTPException as exc:
        assert exc.status_code == code
try:
    InterviewRequest(role='')
    raise AssertionError('empty role accepted')
except ValidationError:
    pass
with patch('routers.interview.complete', side_effect=RuntimeError('secret-provider-error')):
    try:
        question(body, me)
        raise AssertionError('upstream error accepted')
    except HTTPException as exc:
        assert exc.status_code == 503 and 'secret-provider-error' not in exc.detail
item = {'index': 1, 'quote': '使用 React', 'strength': '说明了技术', 'improvement': '补充结果', 'outline': '背景、行动、结果'}
req = InterviewRequest(role='前端', history=[turn])
with patch('routers.interview.complete', return_value={'text': json.dumps({'summary': '练习反馈', 'items': [item]})}):
    assert report(req, me)['items'][0]['quote'] == '使用 React'
for invalid in [{**item, 'quote': '不存在的经历'}, {**item, 'index': True}]:
    with patch('routers.interview.complete', return_value={'text': json.dumps({'items': [invalid]})}):
        try:
            report(req, me)
            raise AssertionError('fabricated citation accepted')
        except HTTPException as exc:
            assert exc.status_code == 502
print('PASS: interview authorization, turn limits, validation, model failures and report citations')


# Stream protocol is evaluated without HTTP/TestClient threads or a real model.
from types import SimpleNamespace
from routers.interview import conversation, speech, SpeechRequest, voice_status
from services.interview_voice import synthesize

def collect_conversation(req):
    with patch('routers.interview.StreamingResponse', side_effect=lambda iterator, **kw: SimpleNamespace(iterator=iterator)):
        response = conversation(req, me)
        return [json.loads(chunk) for chunk in response.iterator]

with patch('routers.interview.stream_complete', return_value=iter(['你好', '。请介绍', '项目。'])):
    events = collect_conversation(body)
    assert ''.join(e['text'] for e in events if e['type'] == 'delta') == '你好。请介绍项目。'
    assert [e['text'] for e in events if e['type'] == 'sentence'] == ['你好。', '请介绍项目。']
    assert events[-1]['type'] == 'done'
with patch('routers.interview.stream_complete', side_effect=RuntimeError('private provider detail')):
    events = collect_conversation(body)
    assert events[-1]['type'] == 'error' and 'private' not in str(events)
with patch('routers.interview.stream_complete', return_value=iter([''])):
    assert collect_conversation(body)[-1]['type'] == 'error'
try:
    conversation(InterviewRequest(role='前端', history=[turn]*30), me)
    raise AssertionError('conversation limit accepted')
except HTTPException as exc:
    assert exc.status_code == 422
with patch.dict(os.environ, {'INTERVIEW_TTS_URL': '', 'INTERVIEW_TTS_REF_AUDIO': ''}):
    assert voice_status(me)['configured'] is False
    try:
        synthesize('你好')
        raise AssertionError('missing TTS configuration accepted')
    except HTTPException as exc:
        assert exc.status_code == 503
with patch('services.interview_voice.synthesize', return_value=b'RIFF-test-WAVE'):
    response = speech(SpeechRequest(text='你好'), me)
    assert response.media_type == 'audio/wav' and response.headers['cache-control'] == 'no-store'
print('PASS: streamed text, sentence boundaries, stream failure, free conversation limits and voice configuration')

# Exercise actual GPT-SoVITS adapter contract through an in-process HTTP transport.
import httpx
wav = b'RIFF' + bytes(4) + b'WAVE' + bytes(32)
captured = []
def tts_handler(request):
    captured.append(json.loads(request.content))
    return httpx.Response(200, content=wav)
real_client = httpx.Client
with patch.dict(os.environ, {'INTERVIEW_TTS_URL': 'http://tts.internal:9880', 'INTERVIEW_TTS_REF_AUDIO': '/voices/authorized.wav'}):
    with patch('services.interview_voice.httpx.Client', side_effect=lambda **kw: real_client(transport=httpx.MockTransport(tts_handler), **kw)):
        assert synthesize('请介绍你的项目。') == wav
    assert captured[0]['ref_audio_path'] == '/voices/authorized.wav' and captured[0]['streaming_mode'] is False
    with patch('services.interview_voice.httpx.Client', side_effect=lambda **kw: real_client(transport=httpx.MockTransport(lambda r: httpx.Response(200, json={'error': 'private path'})), **kw)):
        try:
            synthesize('你好')
            raise AssertionError('non-audio payload accepted')
        except HTTPException as exc:
            assert exc.status_code == 502 and 'private path' not in exc.detail
print('PASS: GPT-SoVITS reference configuration, WAV transport and invalid audio rejection')


from services import interview_context as ic
from routers.interview import PrepareRequest, prepare_interview
profile = {'basic': {'targetPosition': '前端开发', 'years': 2, 'phone': 'never-send'},
           'skills': ['React'], 'projects': [{'name': '我的项目'}], 'work': [], 'has_any': True,
           'source_resume': {'id': 7, 'title': '本人简历'}}
with patch.object(ic, 'read_profile', return_value=profile), patch.object(ic, 'skill_evidence', return_value=[]):
    for count in (6, 7, 8):
        ready = prepare_interview(PrepareRequest(role='前端开发', target_questions=count), me)
        ctx = ic.get_context(ready['context_id'], 1)
        assert len(ctx['plan']) == count and 'phone' not in str(ctx['candidate'])
        assert any('React' in entry.get('focus', '') for entry in ctx['plan'])
        try:
            ic.get_context(ready['context_id'], 2)
            raise AssertionError('foreign context accepted')
        except HTTPException as exc:
            assert exc.status_code == 404
    cid = ready['context_id']
    with patch('routers.interview.stream_complete', return_value=iter(['收到。下一个问题。'])):
        events = collect_conversation(InterviewRequest(role='前端', context_id=cid, history=[Turn(question='问题', answer='请问什么意思', main_index=1)]))
        assert events[0]['main_index'] == 1 and events[0]['clarification']
    with patch('routers.interview.stream_complete', return_value=iter(['谢谢，面试结束。'])):
        events = collect_conversation(InterviewRequest(role='前端', context_id=cid, history=[Turn(question='问题', answer='我会继续提升', main_index=8)]))
        assert events[0]['complete'] is True and events[0]['target_questions'] == 8
with patch.object(ic, 'read_profile', return_value=profile), patch.object(ic, 'skill_evidence', return_value=[]), patch.object(ic, 'retrieve_questions', return_value=[]):
    ready = ic.prepare(1, '未知岗位', 8)
    titles = [row['title'] for row in ic.get_context(ready['context_id'], 1)['plan']]
    assert len(set(titles)) == 8
assert ic.is_clarification('我想了解一下这个概念')
print('PASS: automatic profile context, owner isolation, 6-8 question plan, clarification and completion')
