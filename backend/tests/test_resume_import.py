"""
简历导入映射的防脏测试

背景：`resume_import` 里有个兜底分支，解析层只给一段「经历摘要」时就落成一条工作经历。
解析层却常把「自我评价」放进 experience 字段，于是简历里出现过
「没有公司、没有时间、内容是自我介绍」的工作经历条目（实测 id=43 那份）。

这里锁定三类脏数据的过滤规则，离线可跑：

    cd backend && python tests/test_resume_import.py
"""

import os
import sys

BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND_ROOT)

from services.resume_import import build_sections, _looks_like_work  # noqa: E402

PASS = 0
FAIL = 0

BIO_TEXT = ('2027届软件工程本科生，完成过SFT与DPO比较与模型幻觉评测等个人实验项目，'
            '具备方案实现、验证及文档交付实践。')
WORK_TEXT = '2021.07-2024.06 在杭州云栖科技有限公司担任后端开发工程师，负责订单系统重构。'


def check(name, actual, expected):
    global PASS, FAIL
    if actual == expected:
        PASS += 1
        print(f'  PASS  {name}')
    else:
        FAIL += 1
        print(f'  FAIL  {name}\n        期望: {expected!r}\n        实际: {actual!r}')


def sections_of(data: dict) -> dict:
    return {s['section_type']: s['content'] for s in build_sections(data)}


def test_work_like():
    print('\n[1] 文本像不像工作经历')
    check('自我评价判为否', _looks_like_work(BIO_TEXT), False)
    check('带时间的经历判为是', _looks_like_work(WORK_TEXT), True)
    check('只有公司名判为是', _looks_like_work('在某某集团做后端开发'), True)
    check('只有任职动词判为是', _looks_like_work('担任后端工程师'), True)
    # 单个日期不算工作线索：自我评价里写毕业时间很常见
    check('提毕业年月不算工作', _looks_like_work('2027年6月毕业，在校期间做过三个课程项目'), False)
    check('只写年份不算工作', _looks_like_work('2023年参加过实习'), False)
    check('纯年份区间算工作', _looks_like_work('2019-2022 在某某公司'), True)
    check('年月区间算工作', _looks_like_work('2022年7月 - 至今 在某某公司'), True)


def test_bio_not_becomes_work():
    print('\n[2] 自我评价不会被落成工作经历')
    sec = sections_of({'name': '白嘉宁', 'target_position': '大模型开发工程师',
                       'bio': '', 'experience': BIO_TEXT})
    check('没有工作经历区块', 'work_experience' in sec, False)
    check('内容仍保留在简介里', BIO_TEXT[:12] in (sec.get('summary', {}).get('text') or ''), True)


def test_real_experience_kept():
    print('\n[3] 真实经历照常保留')
    sec = sections_of({'name': '张三', 'target_position': '后端开发',
                       'bio': '', 'experience': WORK_TEXT})
    work = sec.get('work_experience', {}).get('items', [])
    check('生成 1 条工作经历', len(work), 1)
    check('描述完整', work[0]['description'], WORK_TEXT)


def test_dirty_llm_items_dropped():
    print('\n[4] 模型给的脏分条被过滤')
    sec = sections_of({
        'name': '李四', 'bio': '五年后端经验',
        'work_experience': [
            {'company': '', 'position': '大模型开发工程师', 'description': BIO_TEXT, 'highlights': []},
            {'company': '字节跳动', 'position': '后端工程师', 'description': '服务治理', 'highlights': []},
            {'company': '某公司', 'startDate': '2020.03', 'description': '', 'highlights': []},
        ],
    })
    work = sec.get('work_experience', {}).get('items', [])
    check('只保留 2 条有效', len(work), 2)
    check('第一条是有公司的', work[0]['company'], '字节跳动')
    check('第二条有起止时间', work[1]['startDate'], '2020-03')


def test_empty_edu_and_project_dropped():
    print('\n[5] 空壳教育/项目条目被丢弃')
    sec = sections_of({
        'name': '王五', 'bio': '测试',
        'education_items': [{'institution': '', 'degree': '', 'field': ''}],
        'projects': [{'name': '', 'description': ''}],
    })
    check('没有教育区块', 'education' in sec, False)
    check('没有项目区块', 'projects' in sec, False)


def test_normal_edu_and_project_kept():
    print('\n[6] 正常教育/项目照常保留')
    sec = sections_of({
        'name': '赵六', 'bio': '测试',
        'education_items': [{'institution': '浙江大学', 'degree': '本科', 'field': '软件工程',
                             'startDate': '2015.09', 'endDate': '2019.06'}],
        'projects': [{'name': '环境监测系统', 'description': 'ESP32 + Python'}],
    })
    edu = sec.get('education', {}).get('items', [])
    proj = sec.get('projects', {}).get('items', [])
    check('教育 1 条', len(edu), 1)
    check('学校正确', edu[0]['institution'], '浙江大学')
    check('项目 1 条', len(proj), 1)
    check('项目名正确', proj[0]['name'], '环境监测系统')


def main():
    test_work_like()
    test_bio_not_becomes_work()
    test_real_experience_kept()
    test_dirty_llm_items_dropped()
    test_empty_edu_and_project_dropped()
    test_normal_edu_and_project_kept()
    print(f'\n结果：PASS {PASS} / FAIL {FAIL}')
    return 0 if FAIL == 0 else 1


if __name__ == '__main__':
    sys.exit(main())
