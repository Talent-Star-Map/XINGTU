"""Read-only corpus audit, with a separate historical IT subset. No training."""
import csv
from collections import Counter
from datetime import datetime, timezone
import hashlib
import io
import json
from pathlib import Path
import re
import sys
import zipfile

BASE = Path(__file__).resolve().parents[2]
ROOT = BASE / 'data' / 'external'
sys.path.insert(0, str(BASE / '.build-verify' / 'parquet-libs'))
summary = {}
try:
    import pyarrow.parquet as pq
    for name in ('r0', 'r1', 'r2'):
        table = pq.read_table(ROOT / 'job_sdf' / 'dataset' / 'demand' / (name + '.parquet'))
        summary['job_sdf_' + name] = {'rows': table.num_rows, 'columns': table.column_names,
                                      'schema': str(table.schema)}
except ImportError:
    summary['job_sdf_audit'] = 'pyarrow unavailable'

archive = ROOT / 'linkedin' / 'version13.zip'
if archive.exists():
    pattern = re.compile(r'\b(software|developer|data scientist|data engineer|machine learning|artificial intelligence|cloud|devops|cybersecurity|information security|frontend|backend|full.?stack|network engineer|database|firmware|embedded|site reliability|computer vision|NLP|MLOps|LLM)\b', re.I)
    stats = {'rows': 0, 'it_title_rows': 0, 'dated_it_rows': 0, 'unique_ids': 0,
             'duplicate_ids': 0, 'months': Counter(), 'it_months': Counter(), 'invalid_dates': 0}
    seen = set()
    csv.field_size_limit(10 * 1024 * 1024)
    outpath = ROOT / 'linkedin' / 'historical_it_postings.jsonl'
    with zipfile.ZipFile(archive) as z, outpath.open('w', encoding='utf-8') as out:
        stats['archive_files'] = z.namelist()
        filename = next(n for n in z.namelist() if n.split('/')[-1] == 'postings.csv')
        with z.open(filename) as raw:
            reader = csv.DictReader(io.TextIOWrapper(raw, encoding='utf-8-sig'))
            stats['fields'] = reader.fieldnames
            for row in reader:
                stats['rows'] += 1
                identity = row.get('job_id')
                if identity in seen:
                    stats['duplicate_ids'] += 1
                    continue
                seen.add(identity)
                value = row.get('original_listed_time') or row.get('listed_time')
                time_field = 'original_listed_time' if row.get('original_listed_time') else 'listed_time'
                published = None
                try:
                    number = float(value)
                    published = datetime.fromtimestamp(number / 1000 if number > 1e11 else number, timezone.utc)
                    stats['months'][published.strftime('%Y-%m')] += 1
                except (ValueError, TypeError, OSError, OverflowError):
                    stats['invalid_dates'] += 1
                if not pattern.search(row.get('title', '')):
                    continue
                stats['it_title_rows'] += 1
                if published:
                    stats['dated_it_rows'] += 1
                    stats['it_months'][published.strftime('%Y-%m')] += 1
                record = {'dataset': 'arshkon/linkedin-job-postings', 'version': 13,
                          'corpus_scope': 'historical_research', 'source_job_id': identity,
                          'title': row.get('title'), 'description': row.get('description'),
                          'company_name': row.get('company_name'), 'location': row.get('location'),
                          'source_url': row.get('job_posting_url'), 'language': 'en_unverified',
                          'source_time_field': time_field, 'source_time_raw': value,
                          'published_at_utc': published.isoformat() if published else None,
                          'ingested_at_utc': datetime.now(timezone.utc).isoformat(),
                          'license': 'CC BY-SA 4.0 (uploader metadata)',
                          'content_sha256': hashlib.sha256((row.get('description') or '').encode()).hexdigest()}
                out.write(json.dumps(record, ensure_ascii=False) + '\n')
    stats['unique_ids'] = len(seen)
    summary['linkedin'] = stats
(ROOT / 'audit_summary.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(summary, ensure_ascii=True, indent=2))
