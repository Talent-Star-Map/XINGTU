"""
AI 生成简历的「不捏造」测试

覆盖三件事：
    1. 资料为空时，生成结果里不能出现任何姓名/公司/学校（这些只能来自用户）
    2. 资料完整时，事实层（姓名/手机/邮箱/城市/公司/学校/时间）必须与资料逐字一致
    3. 润色结果只要编造了公司名或数字，对应字段必须被丢弃、回退成资料原文

离线可跑：不连数据库、不调模型（润色路径用 mock 的 AI 输出走 guard）。
"""

import os
import sys

BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND_ROOT)

# services.llm 在 import 时会读 DATABASE_URL（只建 engine，不连接）。
# 这里给一个占位地址，测试全程不碰数据库、不调模型。
os.environ.setdefault('DATABASE_URL', 'mysql+pymysql://root:placeholder@127.0.0.1:13308/xingtu')
os.environ.setdefault('JWT_SECRET', 'test-only-secret-key-at-least-32-bytes-long!!')

import services.resume_gen as gen_mod
from services.resume_gen import build_resume_from_profile, _local_sections
from services.resume_polish import guard_sections

PASS = 0
FAIL = 0


def check(name: str, actual, expected, note: str = ''):
    global PASS, FAIL
    ok = actual == expected
    if ok:
        PASS += 1
        print(f'  PASS  {name}')
    else:
        FAIL += 1
        print(f'  FAIL  {name}\n        期望: {expected!r}\n        实际: {actual!r}{("  ← " + note) if note else ""}')


def assert_in(name: str, needle: str, haystack: str):
    global PASS, FAIL
    if needle in (haystack or ''):
        PASS += 1
        print(f'  PASS  {name}')
    else:
        FAIL += 1
        print(f'  FAIL  {name}\n        期望包含: {needle!r}\n        实际: {haystack!r}')


def assert_not_in(name: str, needle: str, haystack: str):
    global PASS, FAIL
    if needle not in (haystack or ''):
        PASS += 1
        print(f'  PASS  {name}')
    else:
        FAIL += 1
        print(f'  FAIL  {name}\n        不应出现: {needle!r}\n        实际: {haystack!r}')


def empty_profile() -> dict:
    return {
        'basic': {'fullName': '', 'phone': '', 'email': '', 'city': '', 'school': '',
                  'degree': '', 'targetPosition': '', 'expectedSalary': '', 'bio': '', 'years': None},
        'skills': [], 'work': [], 'education': [], 'projects': [],
        'filled': [], 'missing': ['姓名', '手机号', '邮箱', '学校', '工作经历'],
        'has_any': False, 'source_resume': {'id': None, 'title': ''},
    }


def full_profile() -> dict:
    return {
        'basic': {
            'fullName': '李思远', 'phone': '13900001111', 'email': 'lisiyuan@example.com',
            'city': '杭州', 'school': '浙江大学', 'degree': '本科',
            'targetPosition': 'Java后端开发工程师', 'expectedSalary': '25k',
            'bio': '五年 Java 后端经验，擅长高并发与稳定性建设。', 'years': 5,
        },
        'skills': ['Java', 'Spring Boot', 'MySQL', 'Redis', 'Kafka'],
        'work': [
            {'id': 'work-1', 'company': '阿里巴巴集团', 'position': '后端开发工程师',
             'location': '杭州', 'startDate': '2019-07', 'endDate': '2022-06', 'current': False,
             'description': '', 'technologies': [], 'highlights': ['交易链路重构，峰值 QPS 从 8000 提升到 20000']},
            {'id': 'work-2', 'company': '字节跳动', 'position': '高级后端工程师',
             'location': '杭州', 'startDate': '2022-07', 'endDate': '', 'current': True,
             'description': '', 'technologies': [], 'highlights': []},
        ],
        'education': [
            {'id': 'edu-1', 'institution': '浙江大学', 'degree': '本科', 'field': '软件工程',
             'location': '杭州', 'startDate': '2015-09', 'endDate': '2019-06', 'gpa': '', 'highlights': []},
        ],
        'projects': [],
        'filled': ['姓名', '手机号', '邮箱', '学校', '学历', '技能', '工作经历', '教育经历'],
        'missing': ['项目经历'],
        'has_any': True,
        'source_resume': {'id': 7, 'title': 'Java 后端 - 我的简历'},
    }


PARAMS = {'job_title': 'Java后端开发工程师', 'years_of_experience': 5, 'skills': [],
          'industry': '互联网', 'language': 'zh'}


def test_empty_profile():
    print('\n[1] 空资料：不允许凭空生成')
    res = build_resume_from_profile(empty_profile(), PARAMS, polish=False)
    d = res['data']
    sec = d['resume']
    check('success', res['success'], True)
    check('姓名留空', sec['personal_info']['fullName'], '')
    check('手机留空', sec['personal_info']['phone'], '')
    check('邮箱留空', sec['personal_info']['email'], '')
    check('城市留空', sec['personal_info']['location'], '')
    check('工作经历为空', len(sec['work_experience']['items']), 0)
    check('教育经历为空', len(sec['education']['items']), 0)
    check('未润色', d['polished'], False)
    check('来源=profile', d['source'], 'profile')
    check('有提示', bool(d['warnings']), True)
    summary = sec['summary']['text']
    assert_not_in('简介不含编造学校', '大学', summary)
    assert_in('简介只写求职意向', 'Java后端开发工程师', summary)


def test_full_profile():
    print('\n[2] 有资料：事实层逐字一致')
    res = build_resume_from_profile(full_profile(), PARAMS, polish=False)
    sec = res['data']['resume']
    pi = sec['personal_info']
    check('姓名', pi['fullName'], '李思远')
    check('手机', pi['phone'], '13900001111')
    check('邮箱', pi['email'], 'lisiyuan@example.com')
    check('城市', pi['location'], '杭州')
    check('目标岗位', pi['jobTitle'], 'Java后端开发工程师')
    work = sec['work_experience']['items']
    check('工作条数', len(work), 2)
    check('第 1 家公司', work[0]['company'], '阿里巴巴集团')
    check('第 1 家起止', (work[0]['startDate'], work[0]['endDate']), ('2019-07', '2022-06'))
    check('第 2 家在职', work[1]['current'], True)
    check('第 1 家亮点原样保留', work[0]['highlights'][0], '交易链路重构，峰值 QPS 从 8000 提升到 20000')
    edu = sec['education']['items']
    check('学校', edu[0]['institution'], '浙江大学')
    check('专业', edu[0]['field'], '软件工程')
    skills_flat = [s for c in sec['skills']['categories'] for s in c['skills']]
    check('技能数量', len(skills_flat), 5)
    assert_in('技能含 Java', 'Java', skills_flat)
    summary = sec['summary']['text']
    assert_in('简介引用真实学校', '浙江大学', summary)
    assert_in('简介引用真实年限', '5 年', summary)
    assert_not_in('简介不含编造内容', '云帆科技', summary)


def test_user_input_skills_merge():
    print('\n[3] 弹窗补充的技能与资料技能合并去重')
    params = dict(PARAMS, skills=['Python', 'Java'])
    sec = build_resume_from_profile(full_profile(), params, polish=False)['data']['resume']
    flat = [s for c in sec['skills']['categories'] for s in c['skills']]
    check('Java 不重复', flat.count('Java'), 1)
    check('补充的 Python 进入', 'Python' in flat, True)
    check('资料原有技能保留', 'Kafka' in flat, True)


def test_guard_blocks_fabrication():
    print('\n[4] 润色 guard：编造的公司/数字必须被丢弃')
    profile = full_profile()
    local = _local_sections(profile, PARAMS)
    ai = {
        # 编造了资料里没有的公司
        'summary': {'text': '在腾讯负责核心交易系统，主导架构升级。'},
        'work': [
            {'index': 1,
             'description': '负责交易链路重构',
             # 第 1 条：原文有 8000/20000，可以留；第 2 条：原文没有 40%，必须丢
             'highlights': ['交易链路重构，峰值 QPS 从 8000 提升到 20000',
                            '主导性能优化，响应时间下降 40%']},
            # 第 2 条：原文没有任何描述，只允许写无数字、无未知公司的通用职责
            {'index': 2,
             'description': '负责服务治理平台的接口设计与稳定性建设',
             'highlights': ['带领 8 人团队完成平台重构']},
        ],
    }
    merged = guard_sections(local, ai, profile)

    check('summary 编造公司被拒（回退本地）', merged['summary']['text'], local['summary']['text'])
    w1 = merged['work_experience']['items'][0]
    check('合规亮点保留', '交易链路重构，峰值 QPS 从 8000 提升到 20000' in w1['highlights'], True)
    check('编造数字的亮点被丢弃', len(w1['highlights']), 1)
    assert_not_in('丢弃的是 40% 那条', '40%', ' '.join(w1['highlights']))
    check('AI 写的描述采用', w1['description'], '负责交易链路重构')

    w2 = merged['work_experience']['items'][1]
    check('通用职责被采用', w2['description'], '负责服务治理平台的接口设计与稳定性建设')
    check('无依据的 8 人团队被丢弃', w2['highlights'], [])
    check('公司名仍是资料里的', w2['company'], '字节跳动')
    check('职位未被改动', w2['position'], '高级后端工程师')


def test_guard_keeps_unknown_org_out():
    print('\n[5] 润色 guard：描述里塞进未知学校/公司也要拦')
    profile = full_profile()
    local = _local_sections(profile, PARAMS)
    ai = {'work': [{'index': 1, 'highlights': ['毕业于北京大学，后在美团主导交易链路重构']}]}
    merged = guard_sections(local, ai, profile)
    assert_not_in('未知学校/公司被拦', '北京大学', ' '.join(merged['work_experience']['items'][0]['highlights']))
    assert_in('原有亮点仍在', '交易链路重构', ' '.join(merged['work_experience']['items'][0]['highlights']))


def test_polish_off_means_no_model():
    print('\n[6] 关闭润色：不调模型，source 固定为 profile')
    res = build_resume_from_profile(full_profile(), PARAMS, polish=False)
    check('source', res['data']['source'], 'profile')
    check('polished', res['data']['polished'], False)
    check('没有任何模型来源标记', 'ai' in res['data']['source'], False)


def test_none_fields_and_polish_fallback():
    print('\n[7] 边界：空日期字段 + 润色不可用')
    p = full_profile()
    p['education'][0]['startDate'] = None
    p['education'][0]['endDate'] = None
    p['projects'] = [{'id': 'p1', 'name': '某课程设计', 'startDate': None, 'endDate': None,
                      'description': '', 'highlights': []}]

    # 模拟模型不可用（没配 key / Mock 模式 / 输出不合规），不能抛异常也不能假装润色过
    original = gen_mod.polish_sections
    gen_mod.polish_sections = lambda *a, **k: None
    try:
        res = gen_mod.build_resume_from_profile(p, PARAMS, polish=True)
    finally:
        gen_mod.polish_sections = original

    sec = res['data']['resume']
    check('教育开始时间为字符串', sec['education']['items'][0]['startDate'], '')
    check('教育结束时间为字符串', sec['education']['items'][0]['endDate'], '')
    check('项目结束时间为字符串', sec['projects']['items'][0]['endDate'], '')
    check('未润色不假装成功', res['data']['polished'], False)
    check('来源标记为 profile', res['data']['source'], 'profile')
    check('告知润色未生效', any('润色' in w for w in res['data']['warnings']), True)
    check('事实仍未被改动', sec['work_experience']['items'][0]['company'], '阿里巴巴集团')


def test_guard_survives_broken_ai_output():
    print('\n[8] 边界：模型返回结构异常时不崩')
    profile = full_profile()
    local = _local_sections(profile, PARAMS)
    weird = {'summary': '只有一句话', 'work': 'oops', 'projects': [{'index': '1/x'}]}
    merged = guard_sections(local, weird, profile)
    check('返回结构完整', sorted(merged.keys()), sorted(local.keys()))
    check('简介保持本地版本', merged['summary']['text'], local['summary']['text'])
    check('工作条目未丢', len(merged['work_experience']['items']), 2)
    # 完全空的 AI 输出也要能走通
    merged2 = guard_sections(local, {}, profile)
    check('空输出也不改动事实', merged2['work_experience']['items'][0]['company'], '阿里巴巴集团')


def main():
    test_empty_profile()
    test_full_profile()
    test_user_input_skills_merge()
    test_guard_blocks_fabrication()
    test_guard_keeps_unknown_org_out()
    test_polish_off_means_no_model()
    test_none_fields_and_polish_fallback()
    test_guard_survives_broken_ai_output()
    print(f'\n结果：PASS {PASS} / FAIL {FAIL}')
    return 0 if FAIL == 0 else 1


if __name__ == '__main__':
    sys.exit(main())
