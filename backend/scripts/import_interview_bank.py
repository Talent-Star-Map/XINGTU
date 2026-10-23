"""Import an authorized Mianshiya question export, not a scraper for the hosted website."""
import argparse
import hashlib
import json
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from services.interview_context import BANK_PATH

def normalize(rows, source, license_label):
    result = []
    for row in rows:
        title = str(row.get('title') or row.get('question') or '').strip()
        if not title: continue
        tags = row.get('tags') or []
        if isinstance(tags, str): tags = [tags]
        result.append({'id': 'import-' + hashlib.sha256(title.encode()).hexdigest()[:16],
            'title': title[:1500], 'role': str(row.get('role') or ''), 'tags': [str(t) for t in tags],
            'answer': str(row.get('answer') or row.get('content') or '')[:4000],
            'source': source, 'source_url': str(row.get('source_url') or ''),
            'license': license_label, 'review_status': 'approved'})
    return result

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('export', type=Path)
    parser.add_argument('--source', default='面试鸭授权导出')
    parser.add_argument('--license', required=True, help='本批题目许可或授权说明，不能用代码MIT许可替代题目授权')
    args = parser.parse_args()
    data = json.loads(args.export.read_text(encoding='utf-8-sig'))
    rows = data if isinstance(data, list) else data.get('data', data.get('questions', []))
    if not isinstance(rows, list) or not all(isinstance(r, dict) for r in rows):
        parser.error('题目导出需要JSON数组，或data/questions数组')
    incoming = normalize(rows, args.source, args.license)
    existing = json.loads(BANK_PATH.read_text(encoding='utf-8'))
    merged = {row['title'].strip().casefold(): row for row in existing}
    for row in incoming: merged[row['title'].strip().casefold()] = row
    BANK_PATH.write_text(json.dumps(list(merged.values()), ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'Imported {len(incoming)} questions; bank contains {len(merged)} unique titles')
