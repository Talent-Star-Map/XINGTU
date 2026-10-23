"""Read-only export of sourced market postings; never exports users or secrets."""
import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit, unquote
import pymysql
from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[2]
config = dotenv_values(ROOT / 'backend/.env')
uri = urlsplit(config['DATABASE_URL'].replace('mysql+pymysql://', 'mysql://'))
connection = pymysql.connect(host=uri.hostname, port=uri.port or 3306,
    user=unquote(uri.username), password=unquote(uri.password), database=uri.path.lstrip('/'),
    charset='utf8mb4', cursorclass=pymysql.cursors.DictCursor, connect_timeout=15)
try:
    with connection.cursor() as cursor:
        cursor.execute("SELECT id,title,source,source_url,company_name,city,job_description,skill_tags,publish_time,crawl_time FROM jobs WHERE data_type=1 AND source_url IS NOT NULL AND source_url<>'' ORDER BY id")
        rows = cursor.fetchall()
finally:
    connection.close()
folder = ROOT / 'data/external/xingtu'
folder.mkdir(parents=True, exist_ok=True)
target = folder / 'sourced_jobs.json'
target.write_text(json.dumps({'exported_at_utc': datetime.now(timezone.utc).isoformat(), 'rows': rows}, ensure_ascii=False, default=str, indent=2), encoding='utf-8')
print(json.dumps({'rows': len(rows), 'nonempty_description': sum(bool(r['job_description']) for r in rows), 'output': str(target)}))
