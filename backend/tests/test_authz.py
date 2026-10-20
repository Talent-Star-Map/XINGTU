"""权限校验测试 — 未登录 / 角色错误 / 越权访问

覆盖范围（企业端 + 求职端）：
1. 未带 token 调私有接口 → 401
2. 角色不符（求职者调企业接口、企业调求职者接口）→ 403
3. 越权访问他人数据 → 403/404，且不可通过 query/body 伪造身份
4. 私有简历附件下载 → 只有上传者本人能取

运行（需要能连库，与 test_api_contract.py 一样不走离线路径）：
    cd backend && python tests/test_authz.py

脚本会自建临时数据并在结束时清理，不会动现有业务数据。
"""

import os
import sys
import uuid
import traceback

BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(BACKEND_ROOT)
sys.path.insert(0, BACKEND_ROOT)

# database.py 导入期会校验 JWT_SECRET，测试进程内固定一个即可
os.environ.setdefault('JWT_SECRET', 'authz-test-secret-key-32bytes-min!!')

from fastapi.testclient import TestClient  # noqa: E402

from main import app  # noqa: E402
from database import (  # noqa: E402
    get_session, create_token,
    Jobseeker, Enterprise, Job, MatchRecord, Message, Resume, ResumeSection,
)

client = TestClient(app)

PASS = 0
FAIL = 0
FAILED = []


def check(name: str, cond: bool, detail: str = ''):
    global PASS, FAIL
    if cond:
        PASS += 1
        print(f'  [PASS] {name}')
    else:
        FAIL += 1
        FAILED.append(name)
        print(f'  [FAIL] {name}  {detail}')


def status(resp):
    return resp.status_code


def body(resp):
    try:
        return resp.json()
    except Exception:
        return {}


def is_biz_error(resp):
    d = body(resp)
    return d.get('success') is False


# ── 造数据 ──────────────────────────────────────────────────────────
tag = uuid.uuid4().hex[:6]
created = {'seekers': [], 'enterprises': [], 'jobs': [], 'records': [], 'resumes': [], 'file': None}


def build_fixtures():
    session = get_session()
    try:
        a = Jobseeker(email=f'authz_a_{tag}@test.com', username=f'authzA{tag}',
                      password='x', real_name='测试甲', skills='Python,MySQL')
        b = Jobseeker(email=f'authz_b_{tag}@test.com', username=f'authzB{tag}',
                      password='x', real_name='测试乙', skills='Java')
        e1 = Enterprise(email=f'authz_e1_{tag}@test.com', username=f'authzE1{tag}',
                        password='x', company_name=f'甲方公司{tag}')
        e2 = Enterprise(email=f'authz_e2_{tag}@test.com', username=f'authzE2{tag}',
                        password='x', company_name=f'乙方公司{tag}')
        session.add_all([a, b, e1, e2])
        session.commit()
        for obj in (a, b, e1, e2):
            session.refresh(obj)

        job1 = Job(enterprise_id=e1.id, title='甲方的岗位', status='active',
                   skills_required='Python,MySQL', salary_min=15, salary_max=25)
        session.add(job1)
        session.commit()
        session.refresh(job1)

        mr = MatchRecord(job_id=job1.id, jobseeker_id=a.id, status='communicating',
                         match_score=88, skill_match=90, exp_match=80, edu_match=80,
                         salary_match=80, location_match=100)
        session.add(mr)
        session.commit()
        session.refresh(mr)

        session.add(Message(match_record_id=mr.id, sender_type='enterprise',
                            sender_id=e1.id, content='您好，方便聊聊吗？', is_read=0))
        session.commit()

        resume = Resume(user_id=a.id, title='甲的私有简历', template_key='classic')
        session.add(resume)
        session.commit()
        session.refresh(resume)
        session.add(ResumeSection(resume_id=resume.id, section_type='skills', title='技能特长',
                                  content={'categories': [{'id': '1', 'name': '编程语言', 'skills': ['Python']}]},
                                  sort_order=0, visible=1))
        session.commit()

        created.update({
            'seekers': [a.id, b.id], 'enterprises': [e1.id, e2.id],
            'jobs': [job1.id], 'records': [mr.id], 'resumes': [resume.id],
        })
        return {
            'a': a, 'b': b, 'e1': e1, 'e2': e2,
            'job1': job1, 'mr': mr, 'resume': resume,
            'ta': create_token(a.id, 'jobseeker'),
            'tb': create_token(b.id, 'jobseeker'),
            't1': create_token(e1.id, 'enterprise'),
            't2': create_token(e2.id, 'enterprise'),
        }
    finally:
        session.close()


def cleanup():
    session = get_session()
    try:
        for rid in created['records']:
            session.query(Message).filter(Message.match_record_id == rid).delete()
        session.query(MatchRecord).filter(MatchRecord.id.in_(created['records'] or [-1])).delete()
        for resid in created['resumes']:
            session.query(ResumeSection).filter(ResumeSection.resume_id == resid).delete()
        session.query(Resume).filter(Resume.id.in_(created['resumes'] or [-1])).delete()
        session.query(Job).filter(Job.id.in_(created['jobs'] or [-1])).delete()
        session.query(Enterprise).filter(Enterprise.id.in_(created['enterprises'] or [-1])).delete()
        session.query(Jobseeker).filter(Jobseeker.id.in_(created['seekers'] or [-1])).delete()
        session.commit()
    finally:
        session.close()
    path = created.get('file')
    if path and os.path.exists(path):
        os.remove(path)


def make_resume_file(uid: int) -> str:
    d = os.path.join(BACKEND_ROOT, 'uploads', 'resumes')
    os.makedirs(d, exist_ok=True)
    path = os.path.join(d, f'{uid}_authz_{tag}.txt')
    with open(path, 'w', encoding='utf-8') as f:
        f.write('私有简历附件')
    return path


# ── 用例 ────────────────────────────────────────────────────────────
def test_unauthenticated(f):
    print('\n[1] 未登录访问私有接口 → 401')
    check('企业仪表盘无 token', status(client.get('/api/enterprise/dashboard')) == 401)
    check('候选人列表无 token', status(client.get('/api/enterprise/candidates')) == 401)
    check('求职者会话列表无 token', status(client.get('/api/jobseeker/conversations')) == 401)
    check('投递渠道无 token', status(client.get('/api/apply/channel/1')) == 401)
    check('简历列表无 token', status(client.get('/api/resume-center/list')) == 401)
    check('简历附件无 token',
          status(client.get('/api/auth/resume-file?filename=x')) == 401)
    check('伪造 token → 401',
          status(client.get('/api/enterprise/dashboard?token=not-a-real-token')) == 401)


def test_wrong_role(f):
    print('\n[2] 角色不符 → 403')
    check('求职者调企业仪表盘', status(client.get(f"/api/enterprise/dashboard?token={f['ta']}")) == 403)
    check('企业调求职者会话', status(client.get(f"/api/jobseeker/conversations?token={f['t1']}")) == 403)
    check('企业调简历中心', status(client.get(f"/api/resume-center/list?token={f['t1']}")) == 403)
    check('企业调学习数据', status(client.get(f"/api/learning/skills?token={f['t1']}")) == 403)
    check('求职者调匹配分析', status(client.get(f"/api/learning/skills?token={f['ta']}")) == 200)
    check('求职者调管理员看板',
          status(client.get(f"/api/admin/analytics/overview?token={f['ta']}")) == 403)


def test_seeker_idor(f):
    print('\n[3] 求职者越权（他人消息/简历）')
    mr_id = f['mr'].id
    tb = f['tb']

    r = client.get(f'/api/jobseeker/messages/{mr_id}?token={tb}')
    check('乙读甲的会话消息 → 403', status(r) == 403, str(body(r))[:120])

    r = client.post(f'/api/jobseeker/messages?token={tb}', json={'match_record_id': mr_id, 'content': '越权'})
    check('乙往甲的会话发消息 → 403', status(r) == 403, str(body(r))[:120])

    r = client.post(f'/api/jobseeker/messages/read?match_record_id={mr_id}&token={tb}')
    check('乙标记甲的会话已读 → 403', status(r) == 403, str(body(r))[:120])

    # 伪造 jobseeker_id 不再生效：接口已不接受该参数
    r = client.get(f"/api/jobseeker/unread-total?token={tb}&jobseeker_id={f['a'].id}")
    check('乙伪造 jobseeker_id 查未读 → 仍按乙计算',
          status(r) == 200 and body(r).get('data', {}).get('unread_total') == 0,
          str(body(r))[:120])

    resid = f['resume'].id
    r = client.get(f'/api/resume-center/{resid}?token={tb}')
    check('乙读甲的简历 → 拒绝', is_biz_error(r), str(body(r))[:120])

    r = client.put(f'/api/resume-center/{resid}?token={tb}',
                   json={'title': '被篡改', 'sections': []})
    check('乙改甲的简历 → 拒绝', is_biz_error(r), str(body(r))[:120])

    r = client.delete(f'/api/resume-center/{resid}?token={tb}')
    check('乙删甲的简历 → 拒绝', is_biz_error(r), str(body(r))[:120])

    fname = os.path.basename(created['file'])
    r = client.get(f'/api/auth/resume-file?filename={fname}&token={tb}')
    check('乙下载甲的简历附件 → 403', status(r) == 403)
    r = client.get(f'/api/auth/resume-file?filename={fname}&token={f["ta"]}')
    check('甲下载自己的简历附件 → 200', status(r) == 200)


def test_enterprise_idor(f):
    print('\n[4] 企业越权（他人岗位/会话/候选人）')
    job_id = f['job1'].id
    mr_id = f['mr'].id
    t2 = f['t2']

    r = client.get(f'/api/enterprise/jobs/{job_id}?token={t2}')
    check('乙企业读甲企业岗位 → 404', status(r) == 404, str(body(r))[:120])

    r = client.put(f'/api/enterprise/jobs/{job_id}?token={t2}',
                   json={'title': '被篡改', 'status': 'active'})
    check('乙企业改甲企业岗位 → 404', status(r) == 404)

    r = client.patch(f'/api/enterprise/jobs/{job_id}/status?token={t2}', json={'status': 'closed'})
    check('乙企业关甲企业岗位 → 404', status(r) == 404)

    r = client.delete(f'/api/enterprise/jobs/{job_id}?token={t2}')
    check('乙企业删甲企业岗位 → 404', status(r) == 404)

    r = client.get(f'/api/enterprise/messages/{mr_id}?token={t2}')
    check('乙企业读甲企业会话 → 404', status(r) == 404)

    r = client.post(f'/api/enterprise/messages?token={t2}',
                    json={'match_record_id': mr_id, 'content': '越权'})
    check('乙企业往甲企业会话发消息 → 404', status(r) == 404)

    r = client.post(f'/api/enterprise/messages/read?match_record_id={mr_id}&token={t2}')
    check('乙企业标记甲企业会话已读 → 404', status(r) == 404)

    r = client.get(f'/api/enterprise/candidates?token={t2}&size=100')
    ids = [c.get('id') for c in (body(r).get('data', {}).get('candidates') or [])]
    check('乙企业候选人列表看不到甲的候选人', status(r) == 200 and mr_id not in ids,
          f'ids={ids[:5]}')

    r = client.get(f'/api/enterprise/candidates?token={t2}&job_id={job_id}')
    check('乙企业按甲企业岗位 id 筛选 → 404', status(r) == 404)

    r = client.get(f'/api/enterprise/conversations?token={t2}&size=100')
    check('乙企业会话列表为空',
          status(r) == 200 and body(r).get('data', {}).get('total') == 0,
          str(body(r).get('data', {}).get('total')))

    r = client.get(f'/api/enterprise/dashboard?token={t2}')
    d = body(r).get('data', {})
    check('乙企业仪表盘不统计甲企业数据',
          status(r) == 200 and d.get('metrics', {}).get('total_candidates') == 0,
          str(d.get('metrics')))

    # 甲企业自己访问应当正常
    r = client.get(f'/api/enterprise/jobs/{job_id}?token={f["t1"]}')
    check('甲企业读自己的岗位 → 200', status(r) == 200)
    r = client.get(f'/api/enterprise/messages/{mr_id}?token={f["t1"]}')
    check('甲企业读自己的会话 → 200', status(r) == 200)


def main():
    f = None
    try:
        print('=' * 62)
        print('权限校验测试：未登录 / 角色错误 / 越权访问')
        print('=' * 62)
        f = build_fixtures()
        created['file'] = make_resume_file(f['a'].id)

        test_unauthenticated(f)
        test_wrong_role(f)
        test_seeker_idor(f)
        test_enterprise_idor(f)
    except Exception:
        traceback.print_exc()
        print('\n[ERROR] 测试执行异常')
        code = 2
    else:
        code = 0 if FAIL == 0 else 1
    finally:
        try:
            cleanup()
        except Exception:
            traceback.print_exc()

    print('\n' + '-' * 62)
    print(f'结果：PASS {PASS} / FAIL {FAIL}')
    if FAILED:
        print('失败项：')
        for name in FAILED:
            print(f'  - {name}')
    print(f'总计 → {"PASS" if FAIL == 0 else "FAIL"}')
    sys.exit(code)


if __name__ == '__main__':
    main()
