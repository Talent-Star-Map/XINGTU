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
