"""Database connection options shared by deployment maintenance scripts."""
import os
from urllib.parse import urlsplit,unquote

def mysql_connection_config():
    url=urlsplit(os.environ['DATABASE_URL'])
    if not url.hostname or not url.path.strip('/'):
        raise RuntimeError('DATABASE_URL must identify the deployment database')
    return dict(host=url.hostname,port=url.port or 3306,
                user=unquote(url.username or ''),password=unquote(url.password or ''),
                database=url.path.lstrip('/'),charset='utf8mb4')
