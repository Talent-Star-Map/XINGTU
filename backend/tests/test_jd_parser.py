# -*- coding: utf-8 -*-
"""JD 技能解析准确率验证 —— 对应《作品设计实现方案书》§8.3.1「JD 解析准确率」。

数据：backend/test_data/scraped_jds.json（104 条 JD）+ standard_answers.json（标注技能集）
被测：services.resume_parser.extract_jd_skills —— 词典约束 + 原文证据 + 同义词归一

⚠️ 为什么真值要取「有原文证据」子集（答辩必答）
---------------------------------------------
生成 JD 时，standard_answers 存的是该岗位的完整技能画像，
但 description 里往往只写出其中一部分。实测：800 个标注技能中只有 463 个
（57.9%）真的出现在 description 文本里。

也就是说，若拿「全量标注」当真值，即使完美解析器，召回率天花板也只有 57.9%，
F1 上限约 0.71 —— 这个口径在数学上不可能达到 90%，用它验收是自欺欺人。

因此本测试采用两口径并列，以「有原文证据子集」为准：
  - 有证据子集：标注技能且该技能名在 title+description 中出现 → 可召回真值
  - 全量标注  ：仅作参考，同时打印召回天花板，防止误读

这与项目「幻觉防控」原则一致：正文无证据的技能不应算作解析目标。

用法：
    python tests/test_jd_parser.py            # 全量 104 条
    python tests/test_jd_parser.py --verbose  # 打印漏提/误提明细
@owner: 张boy（简历解析 / 人岗匹配）
"""
import json
import os
import sys
from collections import Counter

BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND_ROOT)
os.chdir(BACKEND_ROOT)
os.environ["DEEPSEEK_API_KEY"] = ""          # 强制走纯规则路径，保证可复现
os.environ["JWT_SECRET"] = "unit-test-secret-key-0123456789abcdef"

from services.resume_parser import extract_jd_skills            # noqa: E402
from services.skill_synonyms import canonical_name              # noqa: E402

TEST_DATA = os.path.join(BACKEND_ROOT, 'test_data')
TARGET_F1 = 0.90


def prf(tp: int, fp: int, fn: int) -> tuple[float, float, float]:
    p = tp / max(tp + fp, 1)
    r = tp / max(tp + fn, 1)
    f = 2 * p * r / max(p + r, 1e-9)
    return p, r, f


def run(verbose=False) -> dict:
    with open(os.path.join(TEST_DATA, 'scraped_jds.json'), encoding='utf-8') as f:
        jds = json.load(f)
    with open(os.path.join(TEST_DATA, 'standard_answers.json'), encoding='utf-8') as f:
        answers = {a['id']: a['skills'] for a in json.load(f)}

    tp = fp = fn = 0
    fn_hist: Counter = Counter()
    fp_hist: Counter = Counter()
    labelled = 0            # 全量标注技能数
    evidenced = 0           # 其中有原文证据的条数

    for jd in jds:
        text = '%s\n%s' % (jd.get('title') or '', jd.get('description') or '')
        pred = {canonical_name(s) for s in extract_jd_skills(text)['skills']}

        gold_raw = answers.get(jd['id'], [])
        gold = set()
        for s in gold_raw:
            labelled += 1
            if s.lower() in text.lower():
                evidenced += 1
                gold.add(canonical_name(s))

        tp += len(pred & gold)
        for s in pred - gold:
            fp += 1
            fp_hist[s] += 1
        for s in gold - pred:
            fn += 1
            fn_hist[s] += 1

    p, r, f1 = prf(tp, fp, fn)
    n = len(jds)

    print('=' * 62)
    print('JD 技能解析准确率验证  (数据: %d 条 JD)' % n)
    print('=' * 62)
    print('[真值口径]   标注技能 %d 个，其中 %d 个在 title+description 中有原文证据'
          % (labelled, evidenced))
    print('[有证据子集] P=%.4f  R=%.4f  F1=%.4f   (TP=%d FP=%d FN=%d)'
          % (p, r, f1, tp, fp, fn))
    print('[参考]       若按全量标注计，召回天花板 = %.4f，F1 上限 ≈ %.4f'
          % (evidenced / max(labelled, 1),
             2 * p * (evidenced / max(labelled, 1)) / max(p + evidenced / max(labelled, 1), 1e-9)))
    print('-' * 62)
    print('JD 解析 F1 = %.4f   目标 ≥ %.2f   → %s'
          % (f1, TARGET_F1, 'PASS' if f1 >= TARGET_F1 else 'FAIL'))

    if verbose:
        print('\n漏提 Top15:', fn_hist.most_common(15))
        print('误提 Top15:', fp_hist.most_common(15))

    return {'precision': p, 'recall': r, 'f1': f1, 'n': n,
            'labelled': labelled, 'evidenced': evidenced, 'pass': f1 >= TARGET_F1}


if __name__ == '__main__':
    res = run(verbose=('--verbose' in sys.argv or '-v' in sys.argv))
    sys.exit(0 if res['pass'] else 1)
