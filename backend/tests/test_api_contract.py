"""
API Contract Tests for /api/match/analyze

验证:
1. 必需字段完整性
2. 字段类型稳定性
3. 边界值处理
4. 错误码规范

@owner: 阳总&洋总（人岗匹配）
"""

import os, sys, json, uuid
# 测试文件在 backend/tests/ 下，需要把 sys.path 指向 backend/ 根才能 import main/database
BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(BACKEND_ROOT)
sys.path.insert(0, BACKEND_ROOT)

JWT_SECRET = "test-secret-key-for-contract-32bytes!!"
os.environ['JWT_SECRET'] = JWT_SECRET

from main import app
from fastapi.testclient import TestClient

client = TestClient(app)

# ─── helpers ────────────────────────────────────────────────────────

def register_test_user(suffix: str = ""):
    email = f"contract_{uuid.uuid4().hex[:6]}{suffix}@test.com"
    r = client.post('/api/auth/send-code', json={'account': email})
    assert r.status_code == 200, f"send-code failed: {r.json()}"
    from database import get_session, Jobseeker, VerifyCode
    session = get_session()
    vc = session.query(VerifyCode).filter(VerifyCode.target == email).order_by(VerifyCode.id.desc()).first()
    code = vc.code if vc else '0'
    session.close()
    r = client.post('/api/auth/register', json={'account': email, 'password': 'TestPass123', 'code': code, 'role': 'jobseeker'})
    assert r.status_code == 200, f"register failed: {r.json()}"
    r = client.post('/api/auth/login', json={'account': email, 'password': 'TestPass123', 'role': 'jobseeker'})
    return r.json()['data']['token'], email

TOKEN, EMAIL = register_test_user()

# ─── test: 认证失败 ─────────────────────────────────────────────────

def test_analyze_no_token():
    r = client.post('/api/match/analyze', json={'job_id': 1})
    assert r.status_code == 422, f"expected 422, got {r.status_code}"

def test_analyze_invalid_token():
    r = client.post('/api/match/analyze?token=invalid_token', json={'job_id': 1})
    assert r.status_code == 401
    assert r.json()['detail'] in ('登录已过期', '无效的登录凭证')

# ─── test: 必需字段存在性 ─────────────────────────────────────────────

REQUIRED_RESPONSE_FIELDS = {
    'success': bool,
    'data': dict,
}

REQUIRED_DATA_FIELDS = {
    'score_version': str,
    'overall': (int, float),
    'grade': str,
    'dims': dict,
    'skills': dict,
    'summary': str,
    'recommendations': list,
    'learning_path_input': dict,
    'raw_inputs_snapshot': dict,
    'has_profile': bool,
}

REQUIRED_DIM_FIELDS = {'skill', 'experience', 'education', 'salary'}
REQUIRED_SKILL_FIELDS = {'have', 'miss', 'extra'}

def test_analyze_response_structure():
    r = client.post(f'/api/match/analyze?token={TOKEN}', json={'job_id': 1, 'resume_text': 'Java Spring Boot MySQL', 'use_profile_skills': False})
    assert r.status_code == 200, f"status={r.status_code} body={r.json()}"
    body = r.json()
    # top level
    for field, typ in REQUIRED_RESPONSE_FIELDS.items():
        assert field in body, f"missing field: {field}"
        assert isinstance(body[field], typ), f"field {field} expected {typ}, got {type(body[field])}"
    # data level
    data = body['data']
    for field, typ in REQUIRED_DATA_FIELDS.items():
        assert field in data, f"missing data field: {field}"
        assert isinstance(data[field], typ) or (typ == (int, float) and isinstance(data[field], (int, float))), f"data.{field} expected {typ}, got {type(data[field])}"
    # dims
    assert set(data['dims'].keys()) >= REQUIRED_DIM_FIELDS, f"dims missing: {data['dims'].keys()}"
    for dim_key in REQUIRED_DIM_FIELDS:
        dim = data['dims'][dim_key]
        assert 'score' in dim and 'weight' in dim and 'weighted' in dim, f"dim {dim_key} missing subfields"
        assert isinstance(dim['score'], (int, float))
        assert isinstance(dim['weight'], (int, float))
    # skills
    assert set(data['skills'].keys()) >= REQUIRED_SKILL_FIELDS, f"skills missing: {data['skills'].keys()}"

# ─── test: 类型稳定性 ─────────────────────────────────────────────────

def test_analyze_field_types():
    r = client.post(f'/api/match/analyze?token={TOKEN}', json={'job_id': 2, 'resume_text': 'Python RAG LangChain', 'use_profile_skills': False})
    assert r.status_code == 200
    data = r.json()['data']
    # overall is numeric 0-100
    assert 0 <= data['overall'] <= 100, f"overall out of range: {data['overall']}"
    # grade is one of S/A/B/C/D
    assert data['grade'] in ('S', 'A', 'B', 'C', 'D'), f"invalid grade: {data['grade']}"
    # recommendations are strings
    for rec in data['recommendations']:
        assert isinstance(rec, str), f"recommendation not string: {type(rec)}"
    # miss items have priority
    for item in data['skills']['miss']:
        assert 'priority' in item and 'reason' in item
        assert item['priority'] in ('high', 'medium', 'low')

# ─── test: 边界值 ─────────────────────────────────────────────────────

def test_analyze_no_profile():
    token, _ = register_test_user("_noprofile")
    r = client.post(f'/api/match/analyze?token={token}', json={'job_id': 1})
    assert r.status_code == 200
    body = r.json()
    assert body['success'] is False
    assert body['code'] == 'NO_PROFILE'

def test_analyze_invalid_job_id():
    r = client.post(f'/api/match/analyze?token={TOKEN}', json={'job_id': 9999, 'resume_text': 'Java'})
    assert r.status_code == 404

# ─── test: recommend 字段 ─────────────────────────────────────────────

def test_recommend_response_fields():
    r = client.post(f'/api/match/recommend?token={TOKEN}', json={'n': 3, 'skills': ['Java', 'Python', 'MySQL']})
    assert r.status_code == 200, f"status={r.status_code} body={r.json()}"
    body = r.json()
    assert body['success'] is True
    assert isinstance(body['data'], list)
    for item in body['data']:
        assert 'job_id' in item and 'title' in item and 'overall' in item
        assert 'matched_count' in item and 'matched_skills' in item and 'top_missing' in item
        assert isinstance(item['matched_count'], int)

# ─── run all ─────────────────────────────────────────────────────────

if __name__ == '__main__':
    tests = [
        test_analyze_no_token, test_analyze_invalid_token,
        test_analyze_response_structure, test_analyze_field_types,
        test_analyze_no_profile, test_analyze_invalid_job_id,
        test_recommend_response_fields,
    ]
    failed = 0
    for t in tests:
        try: t(); print(f"  [PASS] {t.__name__}")
        except AssertionError as e: print(f"  [FAIL] {t.__name__}: {e}"); failed += 1
        except Exception as e: print(f"  [FAIL] {t.__name__}: {type(e).__name__}: {e}"); failed += 1
    print(f"\n{'ALL PASS' if not failed else f'FAIL {failed}/{len(tests)}'}")
    sys.exit(failed)
