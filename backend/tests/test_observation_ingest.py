"""Offline checks for stable identity, idempotency and retained recrawls."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from services.observation_ingest import prepare_observation


def main():
    base = {'source': 'Zhilian', 'source_job_id': 'listing-12',
            'company_name': '甲公司', 'raw_text': '招聘 Python 工程师',
            'observed_at': '2026-07-01T08:00:00+08:00', 'skill_tags': ['Python']}
    first = prepare_observation(base)
    assert first['observed_at'].isoformat() == '2026-07-01T00:00:00'
    assert first['observation_key'] == prepare_observation(dict(base))['observation_key']
    later = prepare_observation({**base, 'observed_at': '2026-07-02T00:00:00Z'})
    assert later['content_hash'] == first['content_hash']
    assert later['observation_key'] != first['observation_key']
    assert prepare_observation({**base, 'raw_text': '招聘 Python 和 RAG 工程师'})['content_hash'] != first['content_hash']
    for invalid in ({**base, 'source_job_id': ''},
                    {**base, 'observed_at': '2026-07-01T00:00:00'},
                    {**base, 'skill_tags': 'Python'}):
        try:
            prepare_observation(invalid)
        except ValueError:
            pass
        else:
            raise AssertionError('invalid observation accepted')
    print('PASS: UTC time, retry idempotency, unchanged recrawls, validation')


if __name__ == '__main__':
    main()
