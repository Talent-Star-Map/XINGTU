"""Run one full article pipeline: collect -> clean -> insert article_info."""

from __future__ import annotations

from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
import builtins
import sys

_original_stdout = sys.stdout

import pymysql

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from cleaners.article_cleaner import clean_article_full
from dao.article_info_dao import ArticleInfoDAO
from database.mysql import get_connection


@contextmanager
def patched_input(return_value=""):
    original_input = builtins.input
    builtins.input = lambda prompt="": return_value
    try:
        yield
    finally:
        builtins.input = original_input


def count_article_raw_in_window(start_time, end_time):
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT COUNT(*)
                FROM article_raw
                WHERE crawl_time >= %s AND crawl_time <= %s
                """,
                (start_time, end_time),
            )
            return cursor.fetchone()[0]
    finally:
        conn.close()


def fetch_new_article_raw_rows(start_time, end_time):
    conn = get_connection()
    try:
        cursor = conn.cursor(pymysql.cursors.DictCursor)
        cursor.execute(
            """
            SELECT r.*
            FROM article_raw r
            WHERE r.crawl_time >= %s
              AND r.crawl_time <= %s
              AND NOT EXISTS (
                  SELECT 1
                  FROM article_info i
                  WHERE i.source = r.source
                    AND i.source_article_id = r.source_article_id
              )
            ORDER BY r.crawl_time ASC, r.id ASC
            """,
            (start_time, end_time),
        )
        return cursor.fetchall()
    finally:
        conn.close()


def run_collector(collector_func):
    start_time = datetime.now()
    sys.stdout = _original_stdout
    collector_func()
    sys.stdout = _original_stdout
    end_time = datetime.now()
    count = count_article_raw_in_window(start_time, end_time)
    return start_time, end_time, count


def clean_and_insert_rows(rows):
    dao = ArticleInfoDAO()
    inserted_count = 0
    filtered_count = 0

    for row in rows:
        cleaned = clean_article_full(row)
        if cleaned is None:
            filtered_count += 1
            continue

        result = dao.insert(cleaned)
        if result is True:
            inserted_count += 1
        elif result == "exists":
            continue
        else:
            filtered_count += 1

    return inserted_count, filtered_count


def main():
    sys.stdout = _original_stdout
    from collectors.csdn.collector import collect_csdn
    from collectors.juejin.collector import collect_juejin

    print("开始CSDN采集")
    with patched_input():
        csdn_start, csdn_end, csdn_count = run_collector(collect_csdn)
    sys.stdout = _original_stdout
    print(f"CSDN采集数量: {csdn_count}")

    sys.stdout = _original_stdout
    print("开始掘金采集")
    juejin_start, juejin_end, juejin_count = run_collector(collect_juejin)
    sys.stdout = _original_stdout
    print(f"掘金采集数量: {juejin_count}")

    sys.stdout = _original_stdout
    print("开始清洗")
    window_start = min(csdn_start, juejin_start)
    window_end = max(csdn_end, juejin_end)
    rows = fetch_new_article_raw_rows(window_start, window_end)
    inserted_count, filtered_count = clean_and_insert_rows(rows)

    sys.stdout = _original_stdout
    print(f"成功进入article_info数量: {inserted_count}")
    print(f"被过滤数量: {filtered_count}")


if __name__ == "__main__":
    main()
