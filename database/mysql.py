"""MySQL connection utility."""

import os
from pathlib import Path

import pymysql
from dotenv import load_dotenv
from pymysql.connections import Connection

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


def get_connection() -> Connection:
    """Create and return a MySQL connection using environment variables."""
    return pymysql.connect(
        host=os.environ["MYSQL_HOST"],
        port=int(os.environ["MYSQL_PORT"]),
        user=os.environ["MYSQL_USER"],
        password=os.environ["MYSQL_PASSWORD"],
        database=os.environ["MYSQL_DATABASE"],
    )
