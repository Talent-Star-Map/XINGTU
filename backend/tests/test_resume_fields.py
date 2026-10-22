"""简历字段抽取准确性测试（比 test_resume 更严格：不只技能，还看姓名/联系方式/教育/经历）

`test_resume.py` 只看技能 F1；这个脚本用人工写的 12 份"像真简历"的文本，
逐字段核对：姓名、手机、邮箱、学校、学历、期望岗位、现居、工作/教育/项目分条。

直接 python 跑，不连库、不调模型（强制走规则路径，保证可复现）：
    cd backend && python tests/test_resume_fields.py
"""

import os
import re
import sys

BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(BACKEND_ROOT)
sys.path.insert(0, BACKEND_ROOT)

from services.resume_parser import rule_based_extract  # noqa: E402
from services.resume_import import build_sections  # noqa: E402

PASS = 0
FAIL = 0
FAILED = []


def check(case: str, field: str, got, want):
    global PASS, FAIL
    ok = got == want if not callable(want) else want(got)
    if ok:
        PASS += 1
    else:
        FAIL += 1
        FAILED.append(f'{case} / {field}: got={got!r} want={want!r}')


CASES = []


def case(title, text, **expect):
    CASES.append((title, text, expect))


# 1. 标准单栏中文简历：姓名单独一行、手机带空格、两段工作
case(
    '标准中文',
    """李思远
求职意向：Java后端开发工程师
手机：139 0000 1111  邮箱：lisiyuan@example.com  现居：杭州
教育背景
浙江大学  本科  软件工程  2015.09-2019.06
工作经历
阿里巴巴集团  后端开发工程师  2019.07-2022.06
负责交易链路重构，峰值 QPS 从 8k 提升到 20k
字节跳动  高级后端工程师  2022.07-至今
主导服务治理平台，故障恢复时间缩短 60%
技能特长
Java、Spring Boot、MySQL、Redis
自我评价
五年 Java 后端经验，擅长高并发与稳定性建设。""",
    name='李思远', phone='13900001111', email='lisiyuan@example.com',
    school='浙江大学', education='本科', target_position='Java后端开发工程师',
    work_count=2, work0=('阿里巴巴集团', '后端开发工程师', '2019-07', '2022-06'),
    work1_current=True,
)

# 2. 姓名带标签 + 性别年龄挤在同一行
case(
    '姓名带标签',
    """姓名：王雨桐    性别：女    年龄：26
求职意向：数据分析师
电话：138-0013-8000
邮箱：wangyt@example.com
教育经历
复旦大学 本科 统计学 2016年9月-2020年6月
工作经历
拼多多 数据分析师 2020年7月-2023年5月
搭建用户增长看板，日活口径统一
""",
    name='王雨桐', phone='13800138000', email='wangyt@example.com',
    school='复旦大学', education='本科', target_position='数据分析师',
    work_count=1, work0=('拼多多', '数据分析师', '2020-07', '2023-05'),
)

# 3. 表格导出的文本（单元格用 | 分隔）
case(
    '表格文本',
    """陈嘉禾 | 求职意向：Python后端开发
联系方式 | 13700002222 | chenjh@example.com
教育背景 | 华中科技大学 | 本科 | 计算机科学与技术 | 2014.09-2018.06
工作经历 | 小米科技 | Python开发工程师 | 2018.07-2021.08
工作经历 | 蔚来汽车 | 高级后端工程师 | 2021.09-至今
技能特长 | Python、Django、MySQL、Redis""",
    name='陈嘉禾', phone='13700002222', email='chenjh@example.com',
    school='华中科技大学', education='本科', target_position='Python后端开发',
    work_count=2,
)

# 4. 教育放最后 + 无「教育背景」小标题
case(
    '教育在最后',
    """赵敏
求职意向：测试开发工程师
手机 13511112222
邮箱 zhaomin@example.com
工作经历
美团 测试开发工程师 2019.03-2023.08
负责自动化测试平台建设，用例执行效率提升 3 倍
浙江大学 硕士 软件工程 2016.09-2019.03
""",
    name='赵敏', phone='13511112222', email='zhaomin@example.com',
    school='浙江大学', education='硕士', target_position='测试开发工程师',
    work_count=1, work0=('美团', '测试开发工程师', '2019-03', '2023-08'),
)

# 5. 英文简历
case(
    '英文简历',
    """John Smith
Target Position: Backend Engineer
Phone: +86 13600003333
Email: john.smith@example.com
Education
Tsinghua University  Bachelor  Computer Science  2015.09-2019.06
Work Experience
Google  Software Engineer  2019.07-2022.06
Built search ranking service
""",
    name='John Smith', phone='13600003333', email='john.smith@example.com',
    education=lambda v: v in ('本科', 'Bachelor', ''),
)

# 6. 中文数字年限 + 多项目
case(
    '中文数字年限',
    """孙悦
求职意向：产品经理
手机：13922224444  邮箱：sunyue@example.com
三年互联网产品经验，主导过两个从 0 到 1 的产品。
项目经历
星图招聘平台  产品负责人  2022.03-2023.12
完成人岗匹配功能设计，匹配准确率提升 15%
""",
    name='孙悦', phone='13922224444', email='sunyue@example.com',
    target_position='产品经理', years='3年', project_count=1,
)

# 7. 手机号 +86 前缀、邮箱大写
case(
    '加号与大小写',
    """周航
求职意向：算法工程师
手机：+86 13733335555
邮箱：ZhouHang@Example.COM
教育背景
北京邮电大学 硕士 计算机技术 2017.09-2020.06
工作经历
百度 算法工程师 2020.07-2023.06
负责推荐排序模型迭代，CTR 提升 4.2%
""",
    name='周航', phone='13733335555', email='zhouhang@example.com',
    school='北京邮电大学', education='硕士',
    work_count=1, work0=('百度', '算法工程师', '2020-07', '2023-06'),
)

# 8. 两段教育（本科 + 硕士）
case(
    '两段教育',
    """吴倩
求职意向：前端开发工程师
手机：13844446666  邮箱：wuqian@example.com
教育背景
南京大学 硕士 软件工程 2018.09-2021.06
南京邮电大学 本科 计算机科学与技术 2014.09-2018.06
工作经历
网易 前端开发工程师 2021.07-至今
负责组件库建设，复用率提升 40%
""",
    name='吴倩', phone='13844446666', education='硕士',
    edu_count=2,
)

# 9. 实习经历 + 正式工作
case(
    '实习加正式',
    """郑凯
求职意向：后端开发工程师
手机：13955557777  邮箱：zhengkai@example.com
教育背景
电子科技大学 本科 软件工程 2016.09-2020.06
实习经历
腾讯 后端开发实习生 2019.07-2019.12
参与消息队列改造
工作经历
字节跳动 后端开发工程师 2020.07-2023.09
负责直播互动服务
""",
    name='郑凯', phone='13955557777', work_count=2,
)

# 10. 只有技能与教育，没有经历
case(
    '无经历',
    """黄蕾
求职意向：数据挖掘工程师
手机：13666668888  邮箱：huanglei@example.com
教育背景
武汉大学 本科 信息管理与信息系统 2017.09-2021.06
技能特长
Python、SQL、Pandas、scikit-learn""",
    name='黄蕾', phone='13666668888', school='武汉大学', education='本科',
    work_count=0,
)


def run():
    print('=' * 66)
    print('简历字段抽取准确性测试（规则路径，12 份文本简历）')
    print('=' * 66)
    for name, text, expect in CASES:
        parsed = rule_based_extract(text)
        parsed['raw_text_preview'] = text
        sections = {s['section_type']: s['content'] for s in build_sections(parsed)}
        work = (sections.get('work_experience') or {}).get('items') or []
        edu = (sections.get('education') or {}).get('items') or []
        proj = (sections.get('projects') or {}).get('items') or []

        if 'name' in expect:
            check(name, 'name', parsed.get('name'), expect['name'])
        if 'phone' in expect:
            check(name, 'phone', parsed.get('phone'), expect['phone'])
        if 'email' in expect:
            check(name, 'email', (parsed.get('email') or '').lower(), expect['email'])
        if 'school' in expect:
            check(name, 'school', parsed.get('school'), expect['school'])
        if 'education' in expect:
            check(name, 'education', parsed.get('education'), expect['education'])
        if 'target_position' in expect:
            check(name, 'target_position', parsed.get('target_position'), expect['target_position'])
        if 'work_count' in expect:
            check(name, 'work_count', len(work), expect['work_count'])
        if 'work0' in expect:
            w = work[0] if work else {}
            got = (w.get('company'), w.get('position'), w.get('startDate'), w.get('endDate'))
            check(name, 'work0', got, expect['work0'])
        if 'work1_current' in expect:
            check(name, 'work1_current', bool(work[1].get('current')) if len(work) > 1 else None,
                  expect['work1_current'])
        if 'edu_count' in expect:
            check(name, 'edu_count', len(edu), expect['edu_count'])
        if 'project_count' in expect:
            check(name, 'project_count', len(proj), expect['project_count'])
        if 'years' in expect:
            check(name, 'years', (sections.get('personal_info') or {}).get('yearsOfExperience'),
                  expect['years'])

    print(f'\n结果：PASS {PASS} / FAIL {FAIL}')
    if FAILED:
        print('失败明细：')
        for f in FAILED:
            print('  -', f)
    print(f'总计 → {"PASS" if FAIL == 0 else "FAIL"}')
    return 0 if FAIL == 0 else 1


if __name__ == '__main__':
    sys.exit(run())
