"""Regression for false temporal change from independent same-title postings."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from services.posting_evolution import observed_posting_changes
from scripts.build_kg_by_title import build_snapshots_and_changes


def row(identifier, company, url, observed, skills, source='Board A'):
    return dict(id=identifier, title='Java Engineer', company_name=company,
                source=source, source_url=url, crawl_time=observed,
                skill_tags=skills, data_type=1, salary_min=10000,
                salary_max=20000, job_description='Java development')


first = row(1, 'Employer One', 'https://board.example/1', '2026-07-01T10:00:00', ['Java'])
other = row(2, 'Employer Two', 'https://board.example/2', '2026-07-02T10:00:00', ['Rust'])
assert observed_posting_changes([first, other], 1) == []

# A second observation of the same URL can support a text-level change.
updated = row(3, 'Employer One', 'https://board.example/1', '2026-07-03T10:00:00', ['Java', 'SQL'])
events = observed_posting_changes([other, updated, first], 1)
assert len(events) == 1 and events[0]['type'] == 'skill_newly_mentioned'
assert events[0]['reason'] is None and events[0]['source_url'] == first['source_url']

# Equal-time snapshots, changed employers and missing URLs do not prove evolution.
same_time = row(4, 'Employer One', first['source_url'], first['crawl_time'], ['Go'])
missing_url = row(5, 'Employer One', '', '2026-07-04T10:00:00', ['Go'])
assert observed_posting_changes([first, same_time, other, missing_url], 1) == []

omitted = row(6, 'Employer One', first['source_url'], '2026-07-04T10:00:00', [])
events = observed_posting_changes([updated, omitted], 1)
assert all(event['type'] == 'skill_no_longer_mentioned' for event in events)

# Verify the actual graph-builder adapter keeps independent records while
# declining to manufacture an evolution event between them.
snapshots, changes = build_snapshots_and_changes([{'id': 1, '_raw_rows': [first, other]}])
assert len(snapshots) == 2 and changes == []
assert {s['source_job_id'] for s in snapshots} == {1, 2}
assert all(s['source_url'] and s['company_name'] for s in snapshots)
print('PASS: independent postings, repeated evidence, equal timestamps, omitted skills, graph adapter')
