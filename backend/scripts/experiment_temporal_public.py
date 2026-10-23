"""Strict time-split demand forecast on Job-SDF r0 anonymous proportions.

This auxiliary benchmark tests temporal estimation, not named internet jobs.
Feature selection and scaling see only months through 2022-12.
"""
import json
from pathlib import Path
import sys
import numpy as np
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT/'.build-verify/parquet-libs'))
import pyarrow.parquet as pq
path = ROOT/'data/external/job_sdf/dataset/proportion/r0.parquet'
table = pq.read_table(path)
months = table.column_names[2:]
assert months == [f'{y}-{m:02d}' for y in (2021, 2022, 2023) for m in range(1, 13)]
y = np.column_stack([table.column(i).to_numpy(zero_copy_only=False) for i in range(2, 38)]).astype(float)
y = np.nan_to_num(y, nan=0, posinf=0, neginf=0)
assert y.shape[1] == 36 and y.min() >= 0 and y.max() <= 1
scale = np.maximum(np.max(y[:, :24], axis=1), 1e-5)
z = y / scale[:, None]

def features(t):
    return np.stack((z[:, t-1], z[:, t-3], z[:, t-6], z[:, t-12],
                     z[:, t-3:t].mean(axis=1), z[:, t-6:t].mean(axis=1)), axis=1)

X = np.concatenate([features(t) for t in range(12, 24)])
Y = np.concatenate([z[:, t] for t in range(12, 24)])
mean, std = X.mean(axis=0), X.std(axis=0)
std = np.maximum(std, 1e-6)
X = np.column_stack((np.ones(len(X)), (X-mean)/std))

def ridge(lam):
    penalty = np.eye(X.shape[1])*lam
    penalty[0, 0] = 0
    return np.linalg.solve(X.T @ X + penalty, X.T @ Y)

def predict(method, t, coef=None):
    if method == 'persistence': return y[:, t-1]
    if method == 'seasonal': return y[:, t-12]
    v = np.column_stack((np.ones(y.shape[0]), (features(t)-mean)/std)) @ coef
    return np.clip(v * scale, 0, 1)

def metric(method, start, end, coef=None):
    actual = y[:, start:end]
    pred = np.column_stack([predict(method, t, coef) for t in range(start, end)])
    error = np.abs(pred-actual)
    active = actual > 1e-5
    return {'mae': float(error.mean()), 'rmse': float(np.sqrt(np.mean((pred-actual)**2))),
            'active_mae': float(error[active].mean()), 'active_cells': int(active.sum()),
            'cells': int(actual.size)}

fits = [(lam, ridge(lam)) for lam in (0.01, .1, 1, 10, 100, 1000)]
selected_lam, selected_coef = min(fits, key=lambda pair: metric('ridge', 24, 30, pair[1])['mae'])
result = {'dataset': 'Job-SDF r0 anonymized occupation-skill monthly proportions',
          'shape': list(y.shape), 'train_months': [months[0], months[23]],
          'validation_months': [months[24], months[29]],
          'test_months': [months[30], months[35]],
          'fit_targets': [months[12], months[23]],
          'selected_ridge_lambda': selected_lam,
          'validation': {m: metric(m, 24, 30, selected_coef) for m in ('persistence','seasonal','ridge')},
          'test': {m: metric(m, 30, 36, selected_coef) for m in ('persistence','seasonal','ridge')},
          'limitations': ['anonymous entity IDs prevent naming any real job or skill',
                          'historical 2021-2023 dataset, not live 2026 market',
                          'row-level monthly proportions, not posting-version update labels']}
out = ROOT/'docs/paper/experiments/temporal_public_v1'
out.mkdir(parents=True, exist_ok=True)
(out/'results.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(result['test'], ensure_ascii=False, indent=2))
