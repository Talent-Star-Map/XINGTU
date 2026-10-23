"""Download pinned public research data; never inserts live jobs or trains models."""
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
import requests

ROOT = Path(__file__).resolve().parents[2] / 'data' / 'external'
ROOT.mkdir(parents=True, exist_ok=True)
manifest = []

def fetch(url, relative):
    target = ROOT / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    if not target.exists():
        temp = target.with_suffix(target.suffix + '.partial')
        with requests.get(url, stream=True, timeout=(20, 120)) as response:
            response.raise_for_status()
            with temp.open('wb') as out:
                for block in response.iter_content(1024 * 1024):
                    out.write(block)
        temp.replace(target)
    digest = hashlib.sha256()
    with target.open('rb') as source:
        for block in iter(lambda: source.read(1024 * 1024), b''):
            digest.update(block)
    manifest.append({'path': relative, 'url': url, 'bytes': target.stat().st_size,
                     'sha256': digest.hexdigest(), 'verified_at_utc': datetime.now(timezone.utc).isoformat()})
    (ROOT / 'download_manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    print(relative, target.stat().st_size, flush=True)

metadata = json.loads((ROOT / 'job_sdf_metadata.json').read_text(encoding='utf-8'))
commit = metadata['sha']
for item in metadata['tree']:
    path = item['path']
    if item['type'] == 'blob' and (path.startswith('dataset/') or path == 'README.md'):
        fetch(f'https://raw.githubusercontent.com/Job-SDF/benchmark/{commit}/{path}', 'job_sdf/' + path)
fetch('https://www.kaggle.com/api/v1/datasets/download/arshkon/linkedin-job-postings?datasetVersionNumber=13', 'linkedin/version13.zip')
print('DOWNLOAD COMPLETE', flush=True)
