"""Reproducible catalog-relative novelty evaluation; not future-role forecasting.

Usage: python run_role_discovery_evaluation.py --input data.json --output results
Standard library only. Test labels never fit vocabulary or calibrate thresholds.
"""
import argparse
from collections import Counter
import csv
import hashlib
import json
from pathlib import Path
import statistics
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from services.role_discovery import RolePrototypeIndex, definition_draft


def quantile95(values):
    ordered = sorted(values)
    if not ordered:
        raise ValueError('known validation set is empty')
    position = (len(ordered) - 1) * .95
    low = int(position)
    high = min(low + 1, len(ordered) - 1)
    return ordered[low] + (ordered[high] - ordered[low]) * (position - low)


def audit_split(rows):
    identities, texts = {}, {}
    for row in rows:
        split = row.get('split')
        if split not in ('train', 'validation', 'test') or not row.get('role'):
            raise ValueError('each row needs a valid split and weak role label')
        identity = (row.get('source'), row.get('source_job_id') or row.get('source_url') or row.get('id'))
        text = ' '.join((str(row.get('title', '')) + ' ' + str(row.get('job_description', ''))).split())
        fingerprint = hashlib.sha256(text.encode()).hexdigest()
        for lookup, key in ((identities, identity), (texts, fingerprint)):
            if key in lookup:
                raise ValueError('duplicate posting identity or identical text; deduplicate before splitting')
            lookup[key] = split
    return {'posting_identity_duplicates': 0, 'identical_text_duplicates': 0}


def evaluate(rows):
    audit = audit_split(rows)
    counts = {s: Counter(r['role'] for r in rows if r['split'] == s)
              for s in ('train', 'validation', 'test')}
    roles = sorted(role for role in counts['train'] if counts['train'][role] >= 3
                   and counts['validation'][role] >= 2 and counts['test'][role] >= 2)
    if not roles:
        raise ValueError('not enough known-validation/test data for any held-out role')
    methods = [('text_tfidf', 1.0), ('skill_with_text_fallback', 0.0), ('joint_prototype', .7)]
    runs, predictions = [], []
    for heldout in roles:
        train = [r for r in rows if r['split'] == 'train' and r['role'] != heldout]
        known = {r['role'] for r in train}
        validation = [r for r in rows if r['split'] == 'validation' and r['role'] in known]
        test = [r for r in rows if r['split'] == 'test' and r['role'] in known | {heldout}]
        for method, weight in methods:
            model = RolePrototypeIndex(train, weight)
            threshold = quantile95([model.score(r)['novelty'] for r in validation])
            scores = [model.score(r) for r in test]
            labels = [r['role'] == heldout for r in test]
            unknown_scores = [s['novelty'] for s, y in zip(scores, labels) if y]
            known_scores = [s['novelty'] for s, y in zip(scores, labels) if not y]
            tp = sum(y and s['novelty'] > threshold for s, y in zip(scores, labels))
            fp = sum(not y and s['novelty'] > threshold for s, y in zip(scores, labels))
            fn = len(unknown_scores) - tp
            precision = tp / (tp + fp) if tp + fp else 0.0
            recall = tp / len(unknown_scores)
            auc = sum((u > k) + .5 * (u == k) for u in unknown_scores for k in known_scores) / (len(unknown_scores) * len(known_scores))
            runs.append({'heldout_role': heldout, 'method': method, 'train': len(train),
                         'validation_known': len(validation), 'test_unknown': len(unknown_scores),
                         'test_known': len(known_scores), 'threshold': threshold, 'tp': tp, 'fp': fp, 'fn': fn,
                         'precision': precision, 'unknown_recall': recall,
                         'f1': 2 * precision * recall / (precision + recall) if precision + recall else 0.0,
                         'known_false_positive_rate': fp / len(known_scores), 'auroc': auc,
                         'known_class_accuracy': sum(s['nearest_role'] == r['role'] for r, s, y in zip(test, scores, labels) if not y) / len(known_scores)})
            for row, score, label in zip(test, scores, labels):
                predictions.append({'heldout_role': heldout, 'method': method, 'id': row['id'],
                    'title': row.get('title'), 'source_url': row.get('source_url'),
                    'snapshot_id': row.get('snapshot_id'), 'captured_at': row.get('captured_at'),
                    'weak_role_label': row['role'], 'unknown_label': label,
                    'novelty': score['novelty'], 'threshold': threshold,
                    'predicted_candidate': score['novelty'] > threshold,
                    'nearest_role': score['nearest_role'], 'status': 'requires_human_review'})
    metrics = ('auroc', 'precision', 'unknown_recall', 'f1', 'known_false_positive_rate', 'known_class_accuracy')
    summary = {name: {key: statistics.mean(r[key] for r in runs if r['method'] == name)
                      for key in metrics} for name, _ in methods}
    result = {'task': 'catalog-relative unknown-role detection',
              'protocol': 'leave_one_rule_category_out; fixed weights; known-validation-only 95th percentile',
              'is_future_forecast': False, 'gold_labels': False,
              'split_counts': {s: sum(c.values()) for s, c in counts.items()}, 'audit': audit,
              'unique_input_postings': len(rows), 'roles': roles, 'summary': summary, 'folds': runs,
              'limitations': ['single employer', 'one observation day', 'rule-derived labels, not expert gold',
                             'title-derived category labels are not proof of market novelty',
                             'folds share known test records; report macro means, not independent samples',
                             'no prospective or temporal forecasting evaluation',
                             'poor discrimination; not validated for autonomous role publication']}
    return result, predictions


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    raw = args.input.read_bytes()
    rows = json.loads(raw.decode('utf-8-sig'))
    result, predictions = evaluate(rows)
    result['source_sha256'] = hashlib.sha256(raw).hexdigest()
    args.output.mkdir(parents=True, exist_ok=True)
    for name, value in [('results.json', result), ('predictions.json', predictions),
                        ('definition_example.json', definition_draft(rows[:5]))]:
        (args.output / name).write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf-8')
    with (args.output/'predictions.csv').open('w', newline='', encoding='utf-8-sig') as stream:
        writer = csv.DictWriter(stream, fieldnames=list(predictions[0]))
        writer.writeheader(); writer.writerows(predictions)
    with (args.output/'metrics.csv').open('w', newline='', encoding='utf-8-sig') as stream:
        writer = csv.DictWriter(stream, fieldnames=['method', *next(iter(result['summary'].values())).keys()])
        writer.writeheader()
        writer.writerows({'method': k, **v} for k, v in result['summary'].items())
    print(json.dumps({'rows': len(rows), 'folds': len(result['roles']), 'summary': result['summary']}, ensure_ascii=True, indent=2))


if __name__ == '__main__':
    main()
