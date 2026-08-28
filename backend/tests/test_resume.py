# -*- coding: utf-8 -*-
"""简历提取准确率验证 —— 对应《作品设计实现方案书》§8.3.2「简历提取准确率」。

数据：backend/test_data/resumes_test.json（100 条标注简历，含 text 与标准技能集）
被测：services.resume_parser.rule_based_extract —— 规则路径（无 LLM、无网络、可离线复现）

指标口径
--------
1) 技能级 micro P/R/F1（主指标）：预测技能集 vs 标注技能集，
   两侧一律过 canonical_name() 归一后再比对，避免大小写/同义词造成假阴性。
2) 结构化字段准确率（辅助指标）：姓名/手机/邮箱/学历。
   真值用「模板锚定」方式从 text 里解析（行首 `姓名：` 等标签），
   与被测函数使用的通用正则不同源，用于回归保护。

⚠️ 关于「人工标注」的说明（答辩必答）
-----------------------------------
本测试集的简历文本由生成器按固定模板合成，标注技能集随文本一同产出，
因此**召回上限 = 100%**（已由脚本自检确认），不存在"标注了但文本里没写"的不可达样本。
它不是真实 PDF/Word 简历，不能等同于真实场景准确率；
真实简历验收需另备 real_resumes_annotated.json 走 DeepSeek 路径。
本测试衡量的是"规则解析链路的技能词典覆盖与归一能力"。

用法：
    python tests/test_resume.py             # 全量 100 条
    python tests/test_resume.py --verbose   # 打印每条漏提/误提明细
@owner: 张boy（简历解析 / 人岗匹配）
"""
import json
import os
import re
import sys
from collections import Counter

BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND_ROOT)
os.chdir(BACKEND_ROOT)
os.environ["DEEPSEEK_API_KEY"] = ""          # 强制走纯规则路径，保证可复现
os.environ["JWT_SECRET"] = "unit-test-secret-key-0123456789abcdef"

from services.resume_parser import rule_based_extract          # noqa: E402
from services.skill_synonyms import canonical_name             # noqa: E402

DATA_PATH = os.path.join(BACKEND_ROOT, 'test_data', 'resumes_test.json')
TARGET_F1 = 0.90


# ────────────────────────── 真值解析 ──────────────────────────

def parse_gold_fields(text: str) -> dict:
    """从模板化简历文本里锚定解析真值字段。

    只认行首的显式标签，与被测函数的"全文通用正则"不同源，
    因此不会退化成"用同一条正则自己验自己"。
    """
    gold = {}
    for field, label in (('name', '姓名'), ('phone', '手机'), ('email', '邮箱')):
        m = re.search(r'^%s[：:]\s*(\S+)' % label, text, re.M)
        if m:
            gold[field] = m.group(1).strip()
    m = re.search(r'^学历[：:]\s*([^·\n]+)', text, re.M)
    if m:
        gold['education'] = m.group(1).strip()
    return gold


def prf(tp: int, fp: int, fn: int) -> tuple[float, float, float]:
    p = tp / max(tp + fp, 1)
    r = tp / max(tp + fn, 1)
    f = 2 * p * r / max(p + r, 1e-9)
    return p, r, f


# ────────────────────────── 主流程 ──────────────────────────

def run(verbose=False) -> dict:
    with open(DATA_PATH, encoding='utf-8') as f:
        resumes = json.load(f)

    tp = fp = fn = 0
    fp_hist: Counter = Counter()
    fn_hist: Counter = Counter()
    field_ok: Counter = Counter()
    field_tot: Counter = Counter()
    unreachable = 0          # 标注技能未出现在文本中的条数（理论上应为 0）

    for item in resumes:
        text = item['text']
        pred = {canonical_name(s) for s in rule_based_extract(text)['skills']}
        true = {canonical_name(s) for s in item['skills']}

        # 可达性必须用「原始标注名」比对：canonical_name 会把 Machine Learning
        # 归一成「机器学习」，拿归一后的名字查英文原文会误判为不可达。
        for s in item['skills']:
            if s.lower() not in text.lower():
                unreachable += 1

        tp += len(pred & true)
        for s in pred - true:
            fp += 1
            fp_hist[s] += 1
        for s in true - pred:
            fn += 1
            fn_hist[s] += 1

        got = rule_based_extract(text)
        for field, want in parse_gold_fields(text).items():
            field_tot[field] += 1
            if str(got.get(field, '')).strip() == want:
                field_ok[field] += 1

    p, r, f1 = prf(tp, fp, fn)
    n = len(resumes)

    print('=' * 62)
    print('简历提取准确率验证  (数据: %d 条标注简历, 规则路径)' % n)
    print('=' * 62)
    print('[技能级 micro]  P=%.4f  R=%.4f  F1=%.4f   (TP=%d FP=%d FN=%d)'
          % (p, r, f1, tp, fp, fn))
    print('[真值自洽性]    标注技能未出现在文本中的条数 = %d（应为 0）' % unreachable)
    print('-' * 62)
    for field in ('name', 'phone', 'email', 'education'):
        if field_tot[field]:
            print('[字段 %-9s] %.4f  (%d/%d)'
                  % (field, field_ok[field] / field_tot[field], field_ok[field], field_tot[field]))
    print('-' * 62)
    print('综合技能 F1 = %.4f   目标 ≥ %.2f   → %s'
          % (f1, TARGET_F1, 'PASS' if f1 >= TARGET_F1 else 'FAIL'))

    if verbose:
        print('\n漏提 Top15:', fn_hist.most_common(15))
        print('误提 Top15:', fp_hist.most_common(15))

    return {'precision': p, 'recall': r, 'f1': f1, 'n': n,
            'pass': f1 >= TARGET_F1, 'unreachable': unreachable}


if __name__ == '__main__':
    res = run(verbose=('--verbose' in sys.argv or '-v' in sys.argv))
    sys.exit(0 if res['pass'] else 1)
