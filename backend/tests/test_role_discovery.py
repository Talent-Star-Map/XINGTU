"""Controlled regressions, not scientific gold-label accuracy."""
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from services.role_discovery import RolePrototypeIndex, definition_draft, requirement_evidence
from services.posting_evolution import observed_posting_changes
from services.role_evolution import role_skill_trends

def row(i, title, text, skills, role='Java工程师', month=1):
    return {'id': i, 'snapshot_id': str(i), 'role': role, 'title': title,
            'job_description': text, 'skills_required': skills, 'source': 'official',
            'source_url': 'https://example.org/jobs/1', 'company_name': 'A',
            'captured_at': f'2026-{month:02d}-15T00:00:00Z'}

r = row(1, 'Java工程师', '负责开发服务。必须掌握Java；Python经验优先；无需掌握Rust。应用于支付业务。', ['Java', 'Python', 'Rust'])
ev = requirement_evidence(r)
assert {k: v['type'] for k, v in ev.items()} == {'Java': 'required', 'Python': 'preferred', 'Rust': 'negated'}
draft = definition_draft([r])
assert not draft['missing_fields']
assert [v['text'] for v in draft['fields']['required_skills']] == ['Java']
assert definition_draft([{**r, 'source_url': ''}])['missing_fields']
index = RolePrototypeIndex([r])
assert index.score(r)['nearest_role'] == 'Java工程师'
assert 'futuretoken' not in index.idf
index.score({**r, 'job_description': 'futuretoken'})
assert 'futuretoken' not in index.idf  # test vocabulary never changes training state
later = row(2, 'Java工程师', 'Java经验优先；必须掌握Python。', ['Java', 'Python'], month=2)
changes = observed_posting_changes([r, later], 1)
assert any(c['type'] == 'skill_requirement_modified' for c in changes)
assert any(c['type'] == 'skill_no_longer_mentioned' for c in changes)
# Distinct teams count once per company but neither team's skills disappear.
rows = [r, {**r, 'id': 3, 'source_url': 'https://example.org/jobs/2', 'skills_required': ['SQL']}]
trends = role_skill_trends(rows, '2026-01-01', '2026-02-01', '2026-02-01', '2026-03-01')
assert {t['skill'] for t in trends} >= {'SQL', 'Java'}
assert all(t['earlier']['employers'] == 1 for t in trends)
print('PASS: five fields, requirement polarity, modification evidence, frozen vocabulary, employer union')
