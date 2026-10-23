"""Leave-one-rule-category-out novelty evaluation on actual posting texts.

Category labels are weak rules, not expert emerging-role truth. Fixed variants
use no test tuning. Each fold calibrates a 95th-percentile threshold on known
validation examples only. Test labels only enter final metrics.
"""
from pathlib import Path
import sys, json, hashlib
from collections import Counter
import numpy as np
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT/'backend'))
from services.role_discovery import RolePrototypeIndex, definition_draft

path = ROOT/'data/external/xingtu/internet_technical_observations.json'
rows = json.loads(path.read_text(encoding='utf-8'))
counts = {split: Counter(r['role'] for r in rows if r['split'] == split)
          for split in ('train', 'validation', 'test')}
roles = sorted(r for r in counts['train'] if counts['train'][r] >= 3
               and counts['validation'][r] >= 2 and counts['test'][r] >= 2)
out = ROOT/'docs/paper/experiments/role_discovery_v1'
out.mkdir(parents=True, exist_ok=True)
runs, predictions = [], []
for heldout in roles:
    train = [r for r in rows if r['split'] == 'train' and r['role'] != heldout]
    known_roles = {r['role'] for r in train}
    val = [r for r in rows if r['split'] == 'validation' and r['role'] in known_roles]
    test = [r for r in rows if r['split'] == 'test' and (r['role'] in known_roles or r['role'] == heldout)]
    labels = np.array([r['role'] == heldout for r in test])
    for name, weight in [('text_tfidf', 1.0), ('skill_with_text_fallback', 0.0), ('joint_prototype', .7)]:
        model = RolePrototypeIndex(train, weight)
        threshold = float(np.quantile([model.score(r)['novelty'] for r in val], .95))
        scored = [model.score(r) for r in test]
        scores = np.array([r['novelty'] for r in scored])
        unknown, known = scores[labels], scores[~labels]
        auc = float(((unknown[:, None] > known).sum() + .5*(unknown[:, None] == known).sum())/(len(unknown)*len(known)))
        run = {'heldout_role': heldout, 'method': name, 'train': len(train), 'validation_known': len(val),
               'test_unknown': len(unknown), 'test_known': len(known), 'auroc': auc,
               'threshold': threshold, 'unknown_recall': float((unknown > threshold).mean()),
               'known_false_positive_rate': float((known > threshold).mean()),
               'known_class_accuracy': float(np.mean([s['nearest_role'] == r['role'] for s, r, y in zip(scored, test, labels) if not y]))}
        runs.append(run)
        predictions.extend({'fold': heldout, 'method': name, 'id': r['id'], 'unknown': bool(y),
                            'novelty': s['novelty'], 'nearest_role': s['nearest_role']}
                           for r, s, y in zip(test, scored, labels))
summary = {}
for name in ('text_tfidf', 'skill_with_text_fallback', 'joint_prototype'):
    subset = [r for r in runs if r['method'] == name]
    summary[name] = {key: float(np.mean([r[key] for r in subset])) for key in
                     ('auroc', 'unknown_recall', 'known_false_positive_rate', 'known_class_accuracy')}
result = {'protocol': 'leave_one_rule_category_out; fixed weights; known-validation calibration',
          'source_sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'roles': roles,
          'limitations': ['single employer', 'one observation day', 'rule category labels',
                         'catalog novelty is not actual market emergence', 'folds share known test records'],
          'summary': summary, 'folds': runs}
(out/'results.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
(out/'predictions.json').write_text(json.dumps(predictions, ensure_ascii=False, indent=2), encoding='utf-8')
(out/'definition_example.json').write_text(json.dumps(definition_draft(rows[:5]), ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(summary, ensure_ascii=False, indent=2))
