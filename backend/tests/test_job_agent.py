# -*- coding: utf-8 -*-
"""人岗匹配准确率验证 —— 对应《作品设计实现方案书》§8.3.3「人岗匹配准确率」。

数据：backend/test_data/match_pairs.json（100 组简历技能 × 岗位技能 × 真值覆盖率）
      backend/test_data/resumes_test.json（100 份标注简历）
      backend/test_data/scraped_jds.json（104 条 JD，作为排序候选池）
被测：services.match_analyzer.extract_profile_features / compute_match_score

两项指标
--------
A. 匹配分一致性（match_pairs.json）
   真值 = 标注的 JD 技能覆盖率 |简历技能 ∩ 岗位技能| / |岗位技能|
   系统 = compute_match_score 的技能维度覆盖率 |have| / (|have| + |miss|)
   报 MAE、Pearson 相关、档位一致率。

   ⚠️ 该项是"一致性"而非"准确率"：测试集的简历技能与岗位技能取自同一词表，
      同义词匹配派不上用场，系统与朴素集合交集高度重合（Pearson ≈ 1.0）。
      它能守住回归（算法改动导致分漂移会被抓到），但不足以证明匹配质量。

B. 排序召回（主指标，resumes × 全量 JD 候选池）
   对每份简历，在 104 条 JD 上打分；真值最优岗位 = 覆盖率最高的 JD。
   报 Top-1 / Top-3 / Top-5 召回率与 MRR。
   这才是"人岗匹配"在真实场景的用法：从大量岗位里把对的排到前面。

用法：
    python tests/test_job_agent.py              # 全量（排序部分约 4-5 分钟）
    python tests/test_job_agent.py --quick      # 只跑 30 份简历做冒烟
    python tests/test_job_agent.py --skip-rank  # 只跑 A 项
@owner: 张boy（简历解析 / 人岗匹配）
"""
import json
import math
import os
import statistics
import sys

BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND_ROOT)
os.chdir(BACKEND_ROOT)
os.environ["DEEPSEEK_API_KEY"] = ""
os.environ["JWT_SECRET"] = "unit-test-secret-key-0123456789abcdef"

from services.match_analyzer import (                      # noqa: E402
    extract_profile_features, compute_match_score,
)
from services.skill_synonyms import normalize_preprocess    # noqa: E402

TEST_DATA = os.path.join(BACKEND_ROOT, 'test_data')
TARGET_MAE = 0.05
TARGET_TOP5 = 0.90


def _pearson(a: list, b: list) -> float:
    ma, mb = statistics.mean(a), statistics.mean(b)
    num = sum((x - ma) * (y - mb) for x, y in zip(a, b))
    den = math.sqrt(sum((x - ma) ** 2 for x in a) * sum((y - mb) ** 2 for y in b))
    return num / max(den, 1e-9)


def _load():
    with open(os.path.join(TEST_DATA, 'match_pairs.json'), encoding='utf-8') as f:
        pairs = json.load(f)
    with open(os.path.join(TEST_DATA, 'resumes_test.json'), encoding='utf-8') as f:
        resumes = json.load(f)
    with open(os.path.join(TEST_DATA, 'scraped_jds.json'), encoding='utf-8') as f:
        jds = json.load(f)
    # 技能流行度预计算：注入后 compute_match_score 不回源数据库，保证离线可复现
    pop = {}
    for j in jds:
        for s in j.get('skills', []):
            k = normalize_preprocess(s)
            if k:
                pop[k] = pop.get(k, 0.0) + 1 / len(jds)
    return pairs, resumes, jds, pop


def part_a(pairs, jds, pop) -> dict:
    truth, pred = [], []
    for p in pairs:
        profile = extract_profile_features(p['resume_skills'], 'skill_list')
        r = compute_match_score(
            profile,
            {'title': p['jd_title'], 'skills': p['jd_skills']},
            skill_popularity=pop, all_jobs=jds,
        )
        have = len(r['skills']['have'])
        miss = len(r['skills']['miss'])
        truth.append(p['match_score'])
        pred.append(have / max(have + miss, 1))

    mae = statistics.mean(abs(a - b) for a, b in zip(truth, pred))

    # 档位：按覆盖率分高/中/低（阈值固定，不随测试集浮动）
    def bucket(v):
        return 2 if v >= 0.5 else (1 if v >= 0.25 else 0)
    agree = sum(1 for a, b in zip(truth, pred) if bucket(a) == bucket(b))

    print('=' * 62)
    print('A. 匹配分一致性  (数据: %d 组简历 × 岗位)' % len(pairs))
    print('=' * 62)
    print('  MAE                = %.4f   (目标 ≤ %.2f)' % (mae, TARGET_MAE))
    print('  Pearson 相关       = %.4f' % _pearson(truth, pred))
    print('  档位一致率         = %d/%d = %.4f'
          % (agree, len(pairs), agree / max(len(pairs), 1)))
    print('  真值覆盖 min/max   = %.3f / %.3f' % (min(truth), max(truth)))
    return {'mae': mae, 'pearson': _pearson(truth, pred),
            'bucket': agree / max(len(pairs), 1), 'pass': mae <= TARGET_MAE}


def part_b(resumes, jds, pop, limit=None) -> dict:
    pool = jds
    rows = resumes[:limit] if limit else resumes
    hits = {1: 0, 3: 0, 5: 0}
    mrr = 0.0

    for r in rows:
        # 用「标注技能」而非解析技能作画像，隔离解析误差，单独考察匹配算法
        profile = extract_profile_features(r['skills'], 'skill_list')
        R = {s.lower() for s in r['skills']}
        scores, cover = [], []
        for j in pool:
            J = {s.lower() for s in j.get('skills', [])}
            cover.append(len(R & J) / max(len(J), 1))
            out = compute_match_score(
                profile,
                {'title': j.get('title', ''), 'skills': j.get('skills', []),
                 'experience': j.get('experience', ''), 'education': j.get('education', '')},
                skill_popularity=pop, all_jobs=pool,
            )
            scores.append(out['overall'])

        gold = max(range(len(pool)), key=lambda i: cover[i])
        order = sorted(range(len(pool)), key=lambda i: (-scores[i], i))
        rank = order.index(gold) + 1
        for k in (1, 3, 5):
            if rank <= k:
                hits[k] += 1
        mrr += 1.0 / rank

    n = len(rows)
    print('-' * 62)
    print('B. 排序召回  (查询: %d 份简历, 候选池: %d 条 JD)' % (n, len(pool)))
    print('-' * 62)
    for k in (1, 3, 5):
        print('  Top-%d 召回率       = %d/%d = %.4f' % (k, hits[k], n, hits[k] / n))
    print('  MRR               = %.4f' % (mrr / n))
    print('  目标 Top-5 ≥ %.2f   → %s'
          % (TARGET_TOP5, 'PASS' if hits[5] / n >= TARGET_TOP5 else 'FAIL'))
    return {'top1': hits[1] / n, 'top3': hits[3] / n, 'top5': hits[5] / n,
            'mrr': mrr / n, 'pass': hits[5] / n >= TARGET_TOP5}


def main():
    quick = '--quick' in sys.argv
    skip_rank = '--skip-rank' in sys.argv
    pairs, resumes, jds, pop = _load()

    a = part_a(pairs, jds, pop)
    if skip_rank:
        sys.exit(0 if a['pass'] else 1)

    b = part_b(resumes, jds, pop, limit=30 if quick else None)
    ok = a['pass'] and b['pass']
    print('=' * 62)
    print('总计 → %s' % ('PASS' if ok else 'FAIL'))
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
