"""Independent-employer trends must be separate from posting versions."""
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from services.role_evolution import role_skill_trends


def record(i, month, skills, company=None, source=None):
    return {'id': i, 'company_name': company or f'Employer {i}',
            'source': source or ('Board A' if i % 2 else 'Board B'),
            'crawl_time': f'2026-{month:02d}-15T12:00:00', 'skill_tags': skills}


rows = [record(i, 1, ['Java']) for i in range(1, 13)]
rows += [record(i, 3, ['Java', 'Rust']) for i in range(1, 13)]
rows += [record(100, 3, ['Rust'], company='Employer 1')]
arguments = ('2026-01-01', '2026-02-01', '2026-03-01', '2026-04-01')
trend = {item['skill']: item for item in role_skill_trends(rows, *arguments)}
assert trend['Rust']['direction'] == 'increase'
assert trend['Rust']['status'] == 'trend_candidate'
assert trend['Rust']['earlier']['employers'] == 12
assert trend['Rust']['later']['employers'] == 12  # repeat company cannot vote twice
assert trend['Rust']['causal_reason'] is None
assert trend['Java']['direction'] == 'uncertain' or trend['Java']['direction'] == 'decrease'

single_platform = [record(i, 1, ['Java'], source='Board A') for i in range(1, 13)]
single_platform += [record(i, 3, ['Java', 'Rust'], source='Board A') for i in range(1, 13)]
single = {item['skill']: item for item in role_skill_trends(single_platform, *arguments)}
assert single['Rust']['status'] == 'single_source_candidate'

thin = role_skill_trends([rows[0], rows[12]], *arguments)
assert all(item['status'] == 'insufficient_coverage' for item in thin)
print('PASS: source diversity, employer deduplication, conservative change, sparse coverage')
