"""Evaluation isolation and input-integrity checks; not accuracy claims."""
from pathlib import Path
import copy
import json
import sys

BASE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BASE))
from scripts.run_role_discovery_evaluation import evaluate, quantile95


assert abs(quantile95([0, 10]) - 9.5) < 1e-12
path = BASE.parent / 'data/external/xingtu/internet_technical_observations.json'
if not path.exists():
    path = BASE.parent / 'data/observations.json'
rows = json.loads(path.read_text(encoding='utf-8'))
first, _ = evaluate(rows)
changed = copy.deepcopy(rows)
for row in changed:
    if row['split'] == 'test':
        row['job_description'] = 'test_only_unknown_token_987 No training vocabulary.'
        row['skills_required'] = []
second, _ = evaluate(changed)
assert len(first['folds']) == len(second['folds'])
assert [r['threshold'] for r in first['folds']] == [r['threshold'] for r in second['folds']]
for corrupted in [rows + [copy.deepcopy(rows[0])], [{**rows[0], 'split': 'invalid'}]]:
    try:
        evaluate(corrupted)
    except ValueError:
        pass
    else:
        raise AssertionError('Invalid input accepted')
assert first['is_future_forecast'] is False and first['gold_labels'] is False
print('PASS: validation quantile; frozen calibration under test-text changes; duplicate rejection; split validation; honest task flags')
