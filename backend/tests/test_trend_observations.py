"""Run directly; no database or API keys needed."""
import ast
from datetime import datetime
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from services.trend_observations import monthly_observations

rows = monthly_observations({'2025-12': 2, '2026-03': 3}, 4, datetime(2026, 3, 31))
assert [r['month'] for r in rows] == ['2025-12', '2026-01', '2026-02', '2026-03']
assert [r['count'] for r in rows] == [2, 0, 0, 3]
assert [r['cum_count'] for r in rows] == [2, 2, 2, 5]
assert all(not r['coverage_known'] for r in rows)
assert not rows[1]['has_observations']
assert all(r['count'] == 0 for r in monthly_observations({}, 12, datetime(2026, 1, 1)))

# Execute the actual endpoint with an injected read-only database double.
source = Path(__file__).resolve().parents[1] / 'routers' / 'trend.py'
tree = ast.parse(source.read_text(encoding='utf-8'))
endpoint = next(n for n in tree.body if isinstance(n, ast.AsyncFunctionDef) and n.name == 'growth_trend')
endpoint.decorator_list = []
endpoint.args.defaults = [ast.Constant(12)]
queries = []
class Session:
    closed = False
    def execute(self, sql, params):
        assert 'UPDATE ' not in sql.upper() and 'INSERT ' not in sql.upper()
        assert 'crawl_time IS NOT NULL' in sql and 'crawl_time <= :now_utc' in sql
        assert 'COALESCE' not in sql and 'INTERVAL 8 HOUR' in sql
        queries.append(sql)
        return self
    def fetchall(self):
        return []
    def close(self):
        self.closed = True
session = Session()
from datetime import timezone
namespace = dict(datetime=datetime, timezone=timezone, text=lambda x: x,
                 get_session=lambda: session, _ok=lambda data: data)
exec(compile(ast.fix_missing_locations(ast.Module(body=[endpoint], type_ignores=[])), str(source), 'exec'), namespace)
import asyncio
result = asyncio.run(namespace['growth_trend'](6))
assert len(result) == 6 and all(r['count'] == 0 for r in result)
assert len(queries) == 1 and session.closed
print('PASS: calendar boundaries, empty data, observation semantics, read-only endpoint')
