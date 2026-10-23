from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from services.role_definition_review import validate_version, FIELD_NAMES

row = {'snapshot_id': 's1', 'title': 'Java 开发工程师',
       'job_description': '必须掌握 Java。负责支付系统开发。优先熟悉 Redis。用于金融交易场景。',
       'source_url': 'https://example.org/1'}
fields = {k: [{'text': k, 'quote': '负责支付系统开发', 'snapshot_id': 's1'}] for k in FIELD_NAMES}
assert len(validate_version(fields, [row], publish=True)) == 5
for bad in ({**fields, 'applications': []},
            {**fields, 'name': [{'text': 'x', 'quote': '假的原文', 'snapshot_id': 's1'}]},
            {**fields, 'duties': [{'text': 'x', 'quote': '负责支付系统开发', 'snapshot_id': 'other'}]}):
    try:
        validate_version(bad, [row], publish=True)
        raise AssertionError('unsupported publication accepted')
    except ValueError:
        pass
print('PASS: review publication requires five evidence-backed fields')
