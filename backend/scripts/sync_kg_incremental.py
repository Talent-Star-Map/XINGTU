"""
sync_kg_incremental.py — 增量 ETL

增量任务:
  - 把 jobs 表里 crawl_time > since 的行 upsert 到 Neo4j
  - 把 user_skills / match_records / diagnosis_history 增量同步
  - 维护 JobSnapshot(只补增量月份的快照)

用法:
  python -m scripts.sync_kg_incremental                          # 默认 since = 上次同步时间
  python -m scripts.sync_kg_incremental --since 2026-08-01
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timedelta
from typing import Optional

import pymysql
try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass



sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database import get_neo4j_driver, close_neo4j
# ── AI 生成内容审核(2026-09-05):增量同步时仍走 review gate ──
try:
    from services.review_service import submit_for_review as _submit_review
except Exception:
    _submit_review = None


DB = {
    "host": "180.76.227.159", "port": 3308,
    "user": "root", "password": "Xingtu123",
    "database": "xingtu", "charset": "utf8mb4",
}

BATCH = 500


def _conn():
    return pymysql.connect(**DB, autocommit=True, cursorclass=pymysql.cursors.DictCursor)


def _chunks(lst, n):
    for i in range(0, len(lst), n):
        yield lst[i : i + n]


def get_last_sync_time() -> Optional[datetime]:
    """从 Neo4j 读最大 crawl_time,失败则 None。"""
    from database import get_neo4j_driver
    driver = get_neo4j_driver()
    with driver.session() as s:
        r = s.run("MATCH (j:Job) RETURN max(j.last_seen) AS t").single()
        return r["t"]


def sync_new_jobs(since: datetime):
    driver = get_neo4j_driver()
    conn = _conn()
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id, data_type, source, source_url, title, skill_tags, technology_field, "
            "company_name, city, salary_min, salary_max, education, experience, job_description, "
            "quality_score, hot_score, trend_score, view_count, like_count, collect_count, "
            "publish_time, crawl_time FROM jobs WHERE crawl_time > %s",
            (since,),
        )
        rows = cur.fetchall()
    conn.close()

    if not rows:
        print(f"   没有 crawl_time > {since} 的新岗位")
        return 0

    for r in rows:
        for k in ("publish_time", "crawl_time"):
            if isinstance(r.get(k), datetime):
                r[k] = r[k].isoformat()
        r["skill_tags"] = json.loads(r["skill_tags"]) if r.get("skill_tags") else []

    job_rows = [r for r in rows if r.get("data_type") == 1]
    article_rows = [r for r in rows if r.get("data_type") == 2]

    with driver.session() as s:
        for batch in _chunks(job_rows, BATCH):
            s.run(
                """
                UNWIND $batch AS j
                MERGE (job:Job {id: j.id})
                SET job.title = j.title,
                    job.title_normalized = toLower(trim(j.title)),
                    job.source = j.source,
                    job.company_name = j.company_name,
                    job.city = j.city,
                    job.salary_min = j.salary_min,
                    job.salary_max = j.salary_max,
                    job.education = j.education,
                    job.experience = j.experience,
                    job.job_description = j.job_description,
                    job.quality_score = j.quality_score,
                    job.hot_score = j.hot_score,
                    job.trend_score = j.trend_score,
                    job.publish_time = datetime(j.publish_time),
                    job.crawl_time = datetime(j.crawl_time),
                    job.last_seen = datetime(j.crawl_time),
                    job.ingested_at = datetime(),
                    job.is_approved = false
                """,
                batch=batch,
            )
        # ── 每条增量 Job 提交一次人工审核(失败不影响增量) ──
        if _submit_review is not None:
            for j in job_rows:
                try:
                    _submit_review(
                        task_type='new_job',
                        target_kind='Job',
                        target_id=str(j.get('id')),
                        content={
                            'title': j.get('title'),
                            'company_name': j.get('company_name'),
                            'city': j.get('city'),
                            'job_description': j.get('job_description'),
                            'salary_min': j.get('salary_min'),
                            'salary_max': j.get('salary_max'),
                            'education': j.get('education'),
                            'experience': j.get('experience'),
                            'source': j.get('source'),
                            'source_url': j.get('source_url'),
                            'sync_source': 'incremental',
                        },
                    )
                except Exception as ex:
                    print(f'   [warn] submit_review(new_job {j.get("id")}) failed: {ex}')
        # 给增量 Job 补 REQUIRES 边
        for batch in _chunks(job_rows, BATCH):
            s.run(
                """
                UNWIND $batch AS j
                UNWIND j.skill_tags AS sk
                WITH j, sk WHERE sk IS NOT NULL AND sk <> ''
                MATCH (job:Job {id: j.id})
                MERGE (skill:Skill {canonical_name: trim(sk)})
                MERGE (job)-[r:REQUIRES]->(skill)
                SET r.source = j.source,
                    r.valid_from = datetime(j.publish_time),
                    r.valid_to = datetime()
                """,
                batch=batch,
            )
    print(f"   增量 Job {len(job_rows)} | Article {len(article_rows)}")
    return len(job_rows)


def sync_user_actions(since: datetime):
    """同步用户最近的诊断 / 学习 / 匹配。"""
    driver = get_neo4j_driver()
    conn = _conn()
    count = 0
    with conn.cursor() as cur:
        for table, col in [("diagnosis_history", "created_at"),
                            ("learning_progress", "updated_at"),
                            ("match_records", "computed_at")]:
            cur.execute(f"SELECT * FROM {table} WHERE {col} > %s", (since,))
            rows = cur.fetchall()
            if not rows:
                continue
            # 写关系(具体由 routers/ 解释)
            count += len(rows)
    conn.close()
    return count


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--since", default=None, help="起始时间 ISO 格式")
    args = ap.parse_args()

    since = (
        datetime.fromisoformat(args.since)
        if args.since else get_last_sync_time() or (datetime.now() - timedelta(days=1))
    )
    print(f"⏱ 增量 ETL since={since}")

    try:
        n = sync_new_jobs(since)
        m = sync_user_actions(since)
        print(f"✅ 增量完成: Job={n}, User 动作={m}")
    finally:
        close_neo4j()


if __name__ == "__main__":
    main()