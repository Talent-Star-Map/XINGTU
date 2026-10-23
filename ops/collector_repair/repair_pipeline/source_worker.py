"""Bounded source subprocess; the scheduler owns the single pipeline lock."""
import argparse
import importlib
import json
from datetime import datetime
from pathlib import Path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('source', choices=('tencent', 'zhilian'))
    parser.add_argument('--max-details', type=int, required=True)
    parser.add_argument('--max-pages', type=int, required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    result = {'started_at_utc': datetime.utcnow().isoformat()}
    try:
        collector = importlib.import_module('.' + args.source, __package__)
        result.update(collector.collect(max_details=args.max_details, max_pages=args.max_pages))
    except Exception as exc:
        from .tencent import SourceBlocked
        result.update(status='blocked' if isinstance(exc, SourceBlocked) else 'failed', error_type=type(exc).__name__)
        if isinstance(exc, SourceBlocked):
            result['reason'] = str(exc)
    result['finished_at_utc'] = datetime.utcnow().isoformat()
    output = Path(args.output)
    temp = output.with_suffix('.tmp')
    temp.write_text(json.dumps(result, ensure_ascii=False), encoding='utf-8')
    temp.replace(output)
    print(json.dumps({'source': args.source, **result}, ensure_ascii=False), flush=True)
    return 0 if result.get('status') in ('succeeded', 'unchanged') else 1


if __name__ == '__main__':
    raise SystemExit(main())
