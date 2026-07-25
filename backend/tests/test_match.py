"""
人岗匹配准确率测试 —— train/dev/test 划分（建议 #2）

- 同义词表调参只看 dev
- 最终只报 test F1
- 避免"针对测试集调参"的质疑

⚠️ BENCHMARK DISCLAIMER（比赛答辩必答）：
  本测试使用「JD 描述文本 + 技能标签嵌入」生成的合成简历作为输入代理（proxy）。
  这仅用于验证 core 技能提取 pipeline（extract_profile_features）的逻辑正确性。
  不等于「真实简历解析准确率」。

  真实准确率应以「100 份人工标注的真实简历 + DeepSeek 提取 vs 人工标准答案」为准。
  该真实测试应另行准备 test_data/real_resumes_annotated.json（格式同）。

  因此本 benchmark 的 F1 是「上限参考值」，不能直接作为比赛评分依据。
  比赛要求 ≥90% 的准确率测试必须用真实简历数据运行。

用法：
  python test_match.py                # 跑完整测试
  python test_match.py --verbose      # 输出 test split 明细

@owner: 我和吴家（新岗位发现+求职端趋势+企业端市场洞察）
"""

import json, os, sys, random, math
from collections import defaultdict

# 测试文件在 backend/tests/ 下，test_data 在 backend/ 根，需向上跳一层
BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND_ROOT)
TEST_DATA_DIR = os.path.join(BACKEND_ROOT, 'test_data')
TRAIN_DEV_TEST_SPLIT = {"train": 0.7, "dev": 0.1, "test": 0.2}
RANDOM_SEED = 42


def load_test_data():
    """加载 100 条标注 JD + 标准答案"""
    jd_path = os.path.join(TEST_DATA_DIR, 'scraped_jds.json')
    ans_path = os.path.join(TEST_DATA_DIR, 'standard_answers.json')

    if not os.path.exists(jd_path) or not os.path.exists(ans_path):
        print('未找到测试数据，正在用内置模板生成 100 条 JD...')
        # jd_scraper 已迁移到 scripts/ 子目录
        from scripts.jd_scraper import generate_sample_jds
        jds = generate_sample_jds(100)
        answers = [{'id': j['id'], 'title': j['title'], 'skills': j['skills']} for j in jds]
        os.makedirs(TEST_DATA_DIR, exist_ok=True)
        with open(jd_path, 'w', encoding='utf-8') as f:
            json.dump(jds, f, ensure_ascii=False, indent=2)
        with open(ans_path, 'w', encoding='utf-8') as f:
            json.dump(answers, f, ensure_ascii=False, indent=2)
        return jds, answers

    with open(jd_path, 'r', encoding='utf-8') as f:
        jds = json.load(f)
    with open(ans_path, 'r', encoding='utf-8') as f:
        answers = json.load(f)
    return jds, answers


def split_data(jds, answers):
    """train/dev/test 划分"""
    random.seed(RANDOM_SEED)
    paired = list(zip(jds, answers))
    random.shuffle(paired)

    n = len(paired)
    n_train = max(int(n * TRAIN_DEV_TEST_SPLIT["train"]), 1)
    n_dev = max(int(n * TRAIN_DEV_TEST_SPLIT["dev"]), 1)
    # test 拿剩下的

    train = paired[:n_train]
    dev = paired[n_train:n_train + n_dev]
    test = paired[n_train + n_dev:]

    return train, dev, test


def build_jd_text(jd: dict) -> str:
    """构造一段标准化技能描述（只含技能关键词，无自然语言噪音）"""
    skills = jd.get('skills', [])
    # 直接用换行拼接技能，模拟简历「技能标签」区块
    return "熟练掌握 " + "、".join(skills)


def evaluate_split(split_data, split_name, verbose=False):
    """
    对一组 (jd, answer) 跑匹配分析，计算 P/R/F1
    用"技能提取准确率"作为代理指标
    """
    from match_analyzer import extract_profile_features

    total_tp, total_fp, total_fn = 0, 0, 0
    per_jd_results = []

    for jd, answer in split_data:
        # 构造模拟简历文本（把 JD 技能嵌入）
        jd_text = build_jd_text(jd)
        true_skills = set(s.strip().lower() for s in answer.get('skills', []))

        # 提取
        profile = extract_profile_features(jd_text, "resume_text")
        pred_skills = set(s.strip().lower() for s in profile.get('skills', []))

        tp = len(pred_skills & true_skills)
        fp = len(pred_skills - true_skills)
        fn = len(true_skills - pred_skills)

        total_tp += tp
        total_fp += fp
        total_fn += fn

        if verbose:
            per_jd_results.append({
                'id': jd.get('id', ''),
                'title': jd.get('title', ''),
                'precision': tp / max(tp + fp, 1),
                'recall': tp / max(tp + fn, 1),
                'pred_count': len(pred_skills),
                'true_count': len(true_skills),
            })

    precision = total_tp / max(total_tp + total_fp, 1)
    recall = total_tp / max(total_tp + total_fn, 1)
    f1 = 2 * precision * recall / max(precision + recall, 0.001)

    return {
        'split': split_name,
        'n_samples': len(split_data),
        'TP': total_tp, 'FP': total_fp, 'FN': total_fn,
        'precision': round(precision, 4),
        'recall': round(recall, 4),
        'f1': round(f1, 4),
        'pass': f1 >= 0.90,
        'details': per_jd_results if verbose else [],
    }


def run_full_test(verbose=False):
    jds, answers = load_test_data()
    train, dev, test = split_data(jds, answers)

    print(f'数据划分: train={len(train)}, dev={len(dev)}, test={len(test)}')
    print('=' * 60)

    train_result = evaluate_split(train, 'train', verbose=False)
    dev_result = evaluate_split(dev, 'dev', verbose=False)
    test_result = evaluate_split(test, 'test', verbose=verbose)

    print(f"[train]  P={train_result['precision']:.3f}  R={train_result['recall']:.3f}  F1={train_result['f1']:.3f}  (n={train_result['n_samples']})")
    print(f"[dev]    P={dev_result['precision']:.3f}  R={dev_result['recall']:.3f}  F1={dev_result['f1']:.3f}  (n={dev_result['n_samples']})  ← 仅用于调参")
    print(f"[test]   P={test_result['precision']:.3f}  R={test_result['recall']:.3f}  F1={test_result['f1']:.3f}  (n={test_result['n_samples']})  ← 最终指标")
    print('=' * 60)

    if test_result['pass']:
        print(f'[PASS] Test F1={test_result["f1"]:.3f} >= 0.90')
    else:
        print(f'[FAIL] Test F1={test_result["f1"]:.3f} < 0.90')
        print('   Suggestion: add more synonyms in skill_synonyms.py or expand resume_parser skill_keywords')

    if verbose and test_result['details']:
        print('\n--- test split 明细 ---')
        for d in test_result['details'][:10]:
            print(f"  {d['id']}: P={d['precision']:.2f} R={d['recall']:.2f} pred={d['pred_count']} true={d['true_count']}")

    return {
        'train_f1': train_result['f1'],
        'dev_f1': dev_result['f1'],
        'test_f1': test_result['f1'],
        'pass': test_result['pass'],
    }


if __name__ == '__main__':
    quick = '--quick' in sys.argv
    verbose = '--verbose' in sys.argv or '-v' in sys.argv
    result = run_full_test(verbose=verbose)
    sys.exit(0 if result['pass'] else 1)
