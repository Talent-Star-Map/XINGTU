"""
build_kg_by_title.py — 按 title_normalized 聚合的 ETL (替代 build_kg.py 的"按 id"策略)

核心改进:
  - Job 节点按 title_normalized 聚合 (1 个 title = 1 个 Job 节点)
  - JobSnapshot 按 crawl_time 建 (1 次抓取 = 1 个 snapshot,不去重 month)
  - ChangeEvent 按快照两两 diff,产出大量纵向变化事件
  - REQUIRES / PUBLISHED_BY 用所有同 title 行的并集
  - SIMILAR_TO 在新模型下变冗余(同 title 已合并),跳过

用法:
  python -m scripts.build_kg_by_title           # 全量重建 (清空 + 重建)
  python -m scripts.build_kg_by_title --skip-gds

为什么不用 --keep-existing:
  按 id 建图和按 title 建图是两种不同的 schema,不能增量混用。
  必须先清空,再重建。
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from collections import defaultdict
from datetime import datetime
from typing import Any, Dict, List

try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

import pymysql

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import get_neo4j_driver, SessionLocal
from services.skill_synonyms import ADJACENT_SKILLS

# ────────────────────────────────────────────────────────────
# MySQL 配置
# ────────────────────────────────────────────────────────────

DB = {
    "host": "180.76.227.159", "port": 3308,
    "user": "root", "password": "Xingtu123",
    "database": "xingtu", "charset": "utf8mb4",
}


def _mysql_conn():
    return pymysql.connect(**DB, autocommit=True, cursorclass=pymysql.cursors.DictCursor)


def _chunks(lst, size=500):
    for i in range(0, len(lst), size):
        yield lst[i:i+size]


def _normalize_title(t: str) -> str:
    return (t or "").strip().lower().replace(" ", "").replace("　", "")


def _safe_json_loads(raw):
    if raw is None or raw == "":
        return []
    if isinstance(raw, (list, dict)):
        return raw
    try:
        return json.loads(raw)
    except Exception:
        return []


# ────────────────────────────────────────────────────────────
# 抽取 (与 build_kg.py 一致)
# ────────────────────────────────────────────────────────────

def extract_jobs(conn):
    print("[1/6] 抽取 MySQL.jobs ...")
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id, data_type, source, source_url, title, skill_tags, "
            "technology_field, company_name, city, area, salary_min, salary_max, "
            "salary_months, education, experience, job_type, company_type, "
            "job_description, author, summary, article_type, content, "
            "quality_score, hot_score, trend_score, view_count, like_count, "
            "collect_count, comment_count, publish_time, crawl_time, update_time "
            "FROM jobs"
        )
        rows = cur.fetchall()
    out = []
    for r in rows:
        for k in ("publish_time", "crawl_time", "update_time"):
            if isinstance(r.get(k), datetime):
                r[k] = r[k].isoformat()
        r["title_normalized"] = _normalize_title(r.get("title"))
        for k in ("quality_score", "hot_score", "trend_score"):
            if r.get(k) is not None:
                try: r[k] = float(r[k])
                except Exception: r[k] = None
        r["skill_tags"] = _safe_json_loads(r.get("skill_tags"))
        out.append(r)
    print(f"   抽取 {len(out)} 行 (data_type=1 岗位 {sum(1 for r in out if r.get('data_type')==1)})")
    return out


def extract_enterprise_jobs(conn):
    print("[1/6] 抽取 MySQL.enterprise_jobs ...")
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id, enterprise_id, title, description, location, salary_min, "
            "salary_max, salary_range, education, experience, skills_required, "
            "status, created_at, updated_at FROM enterprise_jobs WHERE status='open'"
        )
        rows = cur.fetchall()
    for r in rows:
        for k in ("created_at", "updated_at"):
            if isinstance(r.get(k), datetime):
                r[k] = r[k].isoformat()
        if r.get("skills_required"):
            r["skills_required"] = [s.strip() for s in r["skills_required"].split(",") if s.strip()]
        else:
            r["skills_required"] = []
    print(f"   抽取 {len(rows)} 行")
    return rows


# ────────────────────────────────────────────────────────────
# 核心:按 title_normalized 聚合
# ────────────────────────────────────────────────────────────

def aggregate_by_title(jobs: List[Dict[str, Any]]):
    """按 title_normalized 分组,每个组 = 1 个 Job 节点 + N 个 snapshot"""
    print("[2/6] 按 title_normalized 聚合 ...")
    job_rows = [j for j in jobs if j.get("data_type") == 1]
    article_rows = [j for j in jobs if j.get("data_type") == 2]

    groups: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for j in job_rows:
        if j.get("title_normalized"):
            groups[j["title_normalized"]].append(j)

    aggregated_jobs = []
    for tnorm, rows in groups.items():
        # canonical id = 最小 MySQL id (稳定)
        rows_sorted = sorted(rows, key=lambda r: r["id"])
        canonical = rows_sorted[0]
        aggregated_jobs.append({
            "id": canonical["id"],
            "title": canonical["title"],
            "title_normalized": tnorm,
            "source_count": len(set(r.get("source") or "unknown" for r in rows)),
            "crawl_count": len(rows),
            # 第一次出现 / 最近一次
            "first_seen": min((r.get("crawl_time") or r.get("publish_time") or "") for r in rows),
            "last_seen": max((r.get("crawl_time") or r.get("publish_time") or "") for r in rows),
            # 技能并集
            "skill_tags_union": list(set().union(*(r.get("skill_tags") or [] for r in rows))),
            # 公司并集
            "company_names": list(set(r.get("company_name") for r in rows if r.get("company_name"))),
            # 行业(取第一条非空)
            "industry": next((r.get("technology_field") for r in rows if r.get("technology_field")), None),
            "city": next((r.get("city") for r in rows if r.get("city")), None),
            "education": next((r.get("education") for r in rows if r.get("education")), None),
            "experience": next((r.get("experience") for r in rows if r.get("experience")), None),
            # salary 取最新一次抓取的值
            "salary_min": next((r.get("salary_min") for r in reversed(rows_sorted) if r.get("salary_min")), None),
            "salary_max": next((r.get("salary_max") for r in reversed(rows_sorted) if r.get("salary_max")), None),
            "source_url": canonical.get("source_url"),
            "source": canonical.get("source"),
            # 该组所有原始行 (snapshot 用)
            "_raw_rows": rows_sorted,
        })

    print(f"   618 行聚合为 {len(aggregated_jobs)} 个 Job (title_normalized 去重)")
    print(f"   Article 保持单条 {len(article_rows)}")
    return aggregated_jobs, article_rows


def build_snapshots_and_changes(agg_jobs: List[Dict[str, Any]]):
    """对每个聚合 Job:
       - 按 crawl_time 建 snapshot(每次抓取一个)
       - 两两 diff 出 ChangeEvent
    """
    print("[3/6] 建 JobSnapshot + ChangeEvent ...")
    snapshots = []
    changes = []

    for aj in agg_jobs:
        rows = aj["_raw_rows"]
        # 按 crawl_time 排序 (None 用 publish_time 兜底)
        def sort_key(r):
            t = r.get("crawl_time") or r.get("publish_time") or ""
            return t
        rows_sorted = sorted(rows, key=sort_key)

        job_id = aj["id"]
        for idx, r in enumerate(rows_sorted):
            cap = sort_key(r)
            snap_id = f"snap-{job_id}-{idx}-{cap[:10] if cap else 'no-date'}"
            snapshots.append({
                "snapshot_id": snap_id,
                "job_id_ref": job_id,
                "captured_at": cap,
                "source": r.get("source") or "unknown",
                "title": r.get("title"),
                "salary_min": r.get("salary_min"),
                "salary_max": r.get("salary_max"),
                "salary_avg": ((r.get("salary_min") or 0) + (r.get("salary_max") or 0)) / 2.0
                              if r.get("salary_min") and r.get("salary_max") else None,
                "education": r.get("education"),
                "experience": r.get("experience"),
                "skills_required": r.get("skill_tags") or [],
                "job_description": (r.get("job_description") or "")[:1000],
                "crawl_time_raw": cap,
            })

        # 两两 diff
        for i in range(1, len(rows_sorted)):
            prev, curr = rows_sorted[i - 1], rows_sorted[i]
            prev_t = sort_key(prev)
            curr_t = sort_key(curr)
            if not prev_t or not curr_t:
                continue

            # salary 变化
            pm = prev.get("salary_max")
            cm = curr.get("salary_max")
            if pm and cm:
                delta = (cm - pm) / max(pm, 1)
                if abs(delta) >= 0.05:  # 5% 阈值(同 title 通常涨幅小,放宽)
                    changes.append({
                        "change_id": f"ch-{job_id}-{i}-{curr_t[:10]}-salary",
                        "job_id_ref": job_id,
                        "date": curr_t,
                        "type": "salary_increase" if delta > 0 else "salary_decrease",
                        "magnitude": round(delta, 3),
                        "before": json.dumps({"salary_max": pm}, ensure_ascii=False),
                        "after": json.dumps({"salary_max": cm}, ensure_ascii=False),
                        "source": curr.get("source"),
                    })

            # skill 增减
            prev_sk = set(prev.get("skill_tags") or [])
            curr_sk = set(curr.get("skill_tags") or [])
            added = list(curr_sk - prev_sk)
            removed = list(prev_sk - curr_sk)
            if added:
                changes.append({
                    "change_id": f"ch-{job_id}-{i}-{curr_t[:10]}-skill_added",
                    "job_id_ref": job_id,
                    "date": curr_t,
                    "type": "skill_added",
                    "magnitude": len(added),
                    "before": json.dumps({"skills": sorted(prev_sk)}, ensure_ascii=False),
                    "after": json.dumps({"added_skills": sorted(added)}, ensure_ascii=False),
                    "source": curr.get("source"),
                })
            if removed:
                changes.append({
                    "change_id": f"ch-{job_id}-{i}-{curr_t[:10]}-skill_removed",
                    "job_id_ref": job_id,
                    "date": curr_t,
                    "type": "skill_removed",
                    "magnitude": len(removed),
                    "before": json.dumps({"skills": sorted(prev_sk)}, ensure_ascii=False),
                    "after": json.dumps({"removed_skills": sorted(removed)}, ensure_ascii=False),
                    "source": curr.get("source"),
                })

            # 学历要求变化
            pe = prev.get("education")
            ce = curr.get("education")
            if pe and ce and pe != ce:
                changes.append({
                    "change_id": f"ch-{job_id}-{i}-{curr_t[:10]}-education",
                    "job_id_ref": job_id,
                    "date": curr_t,
                    "type": "education_change",
                    "magnitude": 1,
                    "before": json.dumps({"education": pe}, ensure_ascii=False),
                    "after": json.dumps({"education": ce}, ensure_ascii=False),
                    "source": curr.get("source"),
                })

    print(f"   快照 {len(snapshots)} | 纵向 ChangeEvent {len(changes)}")
    return snapshots, changes


# ────────────────────────────────────────────────────────────
# 写入 Neo4j
# ────────────────────────────────────────────────────────────

CONSTRAINTS = [
    "CREATE CONSTRAINT job_id IF NOT EXISTS FOR (j:Job) REQUIRE j.id IS UNIQUE",
    "CREATE CONSTRAINT skill_canonical IF NOT EXISTS FOR (s:Skill) REQUIRE s.canonical_name IS UNIQUE",
    "CREATE CONSTRAINT company_name IF NOT EXISTS FOR (c:Company) REQUIRE c.name IS UNIQUE",
    "CREATE CONSTRAINT industry_name IF NOT EXISTS FOR (i:Industry) REQUIRE i.name IS UNIQUE",
    "CREATE CONSTRAINT change_id IF NOT EXISTS FOR (c:ChangeEvent) REQUIRE c.change_id IS UNIQUE",
    "CREATE CONSTRAINT article_id IF NOT EXISTS FOR (a:Article) REQUIRE a.id IS UNIQUE",
    "CREATE CONSTRAINT category_name IF NOT EXISTS FOR (c:Category) REQUIRE c.name IS UNIQUE",
    "CREATE CONSTRAINT snapshot_id IF NOT EXISTS FOR (s:JobSnapshot) REQUIRE s.snapshot_id IS UNIQUE",
]


def setup(driver):
    print("[0/6] 清空 + 建约束 ...")
    with driver.session() as s:
        s.run("MATCH (n) DETACH DELETE n")
        try: s.run("DROP INDEX snapshot_vec IF EXISTS")
        except Exception: pass
        for stmt in CONSTRAINTS:
            try: s.run(stmt)
            except Exception as e:
                print(f"   ⚠ constraint warn: {str(e)[:80]}")
        try:
            s.run("CREATE INDEX snapshot_date IF NOT EXISTS FOR (s:JobSnapshot) ON (s.captured_at)")
            s.run("CREATE INDEX change_date IF NOT EXISTS FOR (c:ChangeEvent) ON (c.date)")
            s.run("CREATE INDEX change_job IF NOT EXISTS FOR (c:ChangeEvent) ON (c.job_id_ref)")
        except Exception as e:
            print(f"   ⚠ index warn: {str(e)[:80]}")


def ingest_jobs(driver, agg_jobs, articles):
    print(f"[4/6] 写入 Job ({len(agg_jobs)}) + Article ({len(articles)}) ...")
    with driver.session() as s:
        for batch in _chunks(agg_jobs):
            s.run(
                """
                UNWIND $batch AS j
                MERGE (job:Job {id: j.id})
                SET job.title = j.title,
                    job.title_normalized = j.title_normalized,
                    job.source_count = j.source_count,
                    job.crawl_count = j.crawl_count,
                    job.first_seen = CASE WHEN j.first_seen <> '' THEN datetime(j.first_seen) ELSE null END,
                    job.last_seen = CASE WHEN j.last_seen <> '' THEN datetime(j.last_seen) ELSE null END,
                    job.city = j.city,
                    job.education = j.education,
                    job.experience = j.experience,
                    job.salary_min = j.salary_min,
                    job.salary_max = j.salary_max,
                    job.source = j.source,
                    job.source_url = j.source_url,
                    job.ingested_at = datetime()
                """,
                batch=batch,
            )
        for batch in _chunks(articles):
            s.run(
                """
                UNWIND $batch AS a
                MERGE (art:Article {id: a.id})
                SET art.title = a.title,
                    art.author = a.author,
                    art.summary = a.summary,
                    art.article_type = a.article_type,
                    art.content = a.content,
                    art.source = a.source,
                    art.source_url = a.source_url,
                    art.publish_time = CASE WHEN a.publish_time IS NOT NULL THEN datetime(a.publish_time) ELSE null END,
                    art.ingested_at = datetime()
                """,
                batch=batch,
            )


def ingest_skills_and_edges(driver, agg_jobs, ent_jobs):
    print("[4/6] 写 Skill + Industry + Company + 关系 ...")
    with driver.session() as s:
        # 1. Skill 节点 (去重)
        skill_names = set()
        for aj in agg_jobs:
            for sk in aj["skill_tags_union"]:
                if sk: skill_names.add(sk)
        for ej in ent_jobs:
            for sk in ej.get("skills_required") or []:
                if sk: skill_names.add(sk)
        skill_rows = [{"name": n} for n in skill_names]
        for batch in _chunks(skill_rows):
            s.run(
                """
                UNWIND $batch AS sk
                MERGE (s:Skill {canonical_name: sk.name})
                SET s.display_name = sk.name
                """,
                batch=batch,
            )
        print(f"   Skill 节点 {len(skill_rows)}")

        # 2. Industry 节点
        from collections import Counter
        ind_counter = Counter()
        for aj in agg_jobs:
            tf = aj.get("industry")
            if tf:
                # 用 build_kg 里的 _classify_industry 分类规则
                tfl = tf.lower()
                if any(k in tfl for k in ["人工智能", "大模型", "llm", "ai"]):
                    cat = "AI/大模型"
                elif any(k in tfl for k in ["前端", "react", "vue"]):
                    cat = "前端/全栈"
                elif any(k in tfl for k in ["后端", "java", "python", "go"]):
                    cat = "后端开发"
                elif any(k in tfl for k in ["数据", "大数据"]):
                    cat = "数据工程"
                elif any(k in tfl for k in ["算法", "nlp", "推荐"]):
                    cat = "算法/AI 工程"
                else:
                    cat = "其他"
                ind_counter[cat] += 1
        ind_rows = [{"name": n, "cnt": c} for n, c in ind_counter.items()]
        for batch in _chunks(ind_rows):
            s.run(
                """
                UNWIND $batch AS i
                MERGE (ind:Industry {name: i.name})
                SET ind.job_count = i.cnt
                """,
                batch=batch,
            )

        # 3. Company 节点
        company_set = set()
        for aj in agg_jobs:
            for c in aj["company_names"]:
                if c: company_set.add(c)
        for ej in ent_jobs:
            pass  # enterprise_jobs 没 company_name 字段,跳过
        comp_rows = [{"name": n} for n in company_set]
        for batch in _chunks(comp_rows):
            s.run(
                """
                UNWIND $batch AS c
                MERGE (co:Company {name: c.name})
                """,
                batch=batch,
            )
        print(f"   Industry {len(ind_rows)} | Company {len(comp_rows)}")

        # 4. REQUIRES 边 (Job → Skill)
        req_rows = []
        for aj in agg_jobs:
            for sk in aj["skill_tags_union"]:
                if sk:
                    req_rows.append({"jid": aj["id"], "sk": sk})
        for batch in _chunks(req_rows):
            s.run(
                """
                UNWIND $batch AS r
                MATCH (j:Job {id: r.jid}), (s:Skill {canonical_name: r.sk})
                MERGE (j)-[rel:REQUIRES]->(s)
                SET rel.weight = 1
                """,
                batch=batch,
            )
        print(f"   REQUIRES {len(req_rows)}")

        # 5. BELONGS_TO (Job → Industry)
        bel_rows = []
        for aj in agg_jobs:
            tf = aj.get("industry")
            if not tf: continue
            tfl = tf.lower()
            if any(k in tfl for k in ["人工智能", "大模型", "llm", "ai"]):
                cat = "AI/大模型"
            elif any(k in tfl for k in ["前端", "react", "vue"]):
                cat = "前端/全栈"
            elif any(k in tfl for k in ["后端", "java", "python", "go"]):
                cat = "后端开发"
            elif any(k in tfl for k in ["数据", "大数据"]):
                cat = "数据工程"
            elif any(k in tfl for k in ["算法", "nlp", "推荐"]):
                cat = "算法/AI 工程"
            else:
                cat = "其他"
            bel_rows.append({"jid": aj["id"], "ind": cat})
        for batch in _chunks(bel_rows):
            s.run(
                """
                UNWIND $batch AS b
                MATCH (j:Job {id: b.jid}), (i:Industry {name: b.ind})
                MERGE (j)-[:BELONGS_TO]->(i)
                """,
                batch=batch,
            )
        print(f"   BELONGS_TO {len(bel_rows)}")

        # 6. PUBLISHED_BY (Job → Company)
        pub_rows = []
        for aj in agg_jobs:
            for c in aj["company_names"]:
                if c:
                    pub_rows.append({"jid": aj["id"], "co": c})
        for batch in _chunks(pub_rows):
            s.run(
                """
                UNWIND $batch AS p
                MATCH (j:Job {id: p.jid}), (c:Company {name: p.co})
                MERGE (j)-[:PUBLISHED_BY]->(c)
                """,
                batch=batch,
            )
        print(f"   PUBLISHED_BY {len(pub_rows)}")

        # 7. CO_OCCURS_WITH (Skill ↔ Skill)
        from itertools import combinations
        co_rows = []
        for aj in agg_jobs:
            skills = sorted(set(aj["skill_tags_union"]))
            for a, b in combinations(skills, 2):
                co_rows.append({"a": a, "b": b})
        print(f"   CO_OCCURS_WITH candidate pairs {len(co_rows)}")
        for batch in _chunks(co_rows, 2000):
            s.run(
                """
                UNWIND $batch AS p
                MATCH (a:Skill {canonical_name: p.a}), (b:Skill {canonical_name: p.b})
                MERGE (a)-[r:CO_OCCURS_WITH]-(b)
                ON CREATE SET r.weight = 1
                ON MATCH SET r.weight = r.weight + 1
                """,
                batch=batch,
            )


def ingest_snapshots_and_changes(driver, snapshots, changes):
    print(f"[5/6] 写 JobSnapshot ({len(snapshots)}) + ChangeEvent ({len(changes)}) ...")
    with driver.session() as s:
        for batch in _chunks(snapshots, 300):
            s.run(
                """
                UNWIND $batch AS snap
                MATCH (j:Job {id: snap.job_id_ref})
                MERGE (s:JobSnapshot {snapshot_id: snap.snapshot_id})
                SET s.job_id_ref = snap.job_id_ref,
                    s.captured_at = CASE WHEN snap.captured_at <> '' THEN datetime(snap.captured_at) ELSE null END,
                    s.source = snap.source,
                    s.title = snap.title,
                    s.salary_min = snap.salary_min,
                    s.salary_max = snap.salary_max,
                    s.salary_avg = snap.salary_avg,
                    s.education = snap.education,
                    s.experience = snap.experience,
                    s.skills_required = snap.skills_required,
                    s.job_description = snap.job_description,
                    s.ingested_at = datetime()
                MERGE (j)-[r:HAS_SNAPSHOT]->(s)
                SET r.source = snap.source
                """,
                batch=batch,
            )
        # 标记最近一个快照 is_current
        s.run(
            """
            MATCH (j:Job)-[r:HAS_SNAPSHOT]->(s:JobSnapshot)
            WITH j, s, r
            ORDER BY j.id, s.captured_at DESC
            WITH j, collect({s: s, r: r})[0] AS latest
            SET latest.r.is_current = true
            """
        )
        # 写 ChangeEvent
        for batch in _chunks(changes, 300):
            s.run(
                """
                UNWIND $batch AS ch
                MATCH (j:Job {id: ch.job_id_ref})
                MERGE (c:ChangeEvent {change_id: ch.change_id})
                SET c.job_id_ref = ch.job_id_ref,
                    c.date = CASE WHEN ch.date <> '' THEN datetime(ch.date) ELSE null END,
                    c.type = ch.type,
                    c.magnitude = ch.magnitude,
                    c.before = ch.before,
                    c.after = ch.after,
                    c.source = ch.source,
                    c.reason = null,
                    c.reason_source = null,
                    c.ingested_at = datetime()
                MERGE (j)-[:HAS_CHANGE]->(c)
                """,
                batch=batch,
            )


def ingest_user_and_match(driver):
    """用户/匹配记录(与 build_kg.py 相同)。"""
    print("[6/6] 抽取 user_skills + match_records ...")
    with _mysql_conn() as conn, conn.cursor() as cur:
        cur.execute("SELECT id, username, target_position, skills FROM jobseekers WHERE skills IS NOT NULL AND skills != ''")
        users = cur.fetchall()
        with driver.session() as s:
            for batch in _chunks([{
                "id": u["id"], "username": u["username"] or "",
                "target_position": u["target_position"] or "",
                "skills": [x.strip() for x in (u["skills"] or "").split(",") if x.strip()]
            } for u in users], 500):
                s.run(
                    """
                    UNWIND $batch AS u
                    MERGE (user:User {id: u.id})
                    SET user.username = u.username,
                        user.target_position = u.target_position,
                        user.skills = u.skills,
                        user.role = 'jobseeker',
                        user.ingested_at = datetime()
                    """,
                    batch=batch,
                )
            cur.execute("SELECT user_id, skill_name, mastered, mastered_at FROM user_skills")
            user_skills = cur.fetchall()
            for e in user_skills:
                if isinstance(e.get("mastered_at"), datetime):
                    e["mastered_at"] = e["mastered_at"].isoformat()
                if e.get("mastered") is not None:
                    try: e["mastered"] = int(e["mastered"])
                    except Exception: e["mastered"] = 0
            for batch in _chunks(user_skills, 500):
                s.run(
                    """
                    UNWIND $batch AS e
                    MATCH (u:User {id: e.user_id}), (sk:Skill {canonical_name: e.skill_name})
                    MERGE (u)-[r:MASTERED]->(sk)
                    SET r.mastered = e.mastered,
                        r.mastered_at = CASE WHEN e.mastered_at IS NOT NULL THEN datetime(e.mastered_at) ELSE null END
                    """,
                    batch=batch,
                )
            cur.execute("SELECT jobseeker_id, job_id, match_score, created_at FROM match_records")
            matches = cur.fetchall()
            for m in matches:
                if isinstance(m.get("created_at"), datetime):
                    m["created_at"] = m["created_at"].isoformat()
                if m.get("match_score") is not None:
                    try: m["match_score"] = int(m["match_score"])
                    except Exception: m["match_score"] = None
            for batch in _chunks(matches, 500):
                s.run(
                    """
                    UNWIND $batch AS m
                    MATCH (u:User {id: m.jobseeker_id})
                    OPTIONAL MATCH (j:Job {id: m.job_id})
                    WITH u, j, m
                    WHERE j IS NOT NULL
                    MERGE (u)-[r:MATCHED]->(j)
                    SET r.score = m.match_score,
                        r.computed_at = CASE WHEN m.created_at IS NOT NULL THEN datetime(m.created_at) ELSE null END
                    """,
                    batch=batch,
                )
            print(f"   User {len(users)} | MASTERED {len(user_skills)} | MATCHED {len(matches)}")


# ────────────────────────────────────────────────────────────
# Main
# ────────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--skip-gds", action="store_true", help="不跑 Leiden")
    args = ap.parse_args()

    driver = get_neo4j_driver()
    try:
        setup(driver)
        with _mysql_conn() as conn:
            jobs = extract_jobs(conn)
            ent_jobs = extract_enterprise_jobs(conn)

        agg_jobs, articles = aggregate_by_title(jobs)
        snapshots, changes = build_snapshots_and_changes(agg_jobs)
        ingest_jobs(driver, agg_jobs, articles)
        ingest_skills_and_edges(driver, agg_jobs, ent_jobs)
        ingest_snapshots_and_changes(driver, snapshots, changes)
        ingest_user_and_match(driver)

        # 统计
        with driver.session() as s:
            stats = {}
            for label in ['Job', 'JobSnapshot', 'ChangeEvent', 'Skill', 'Company', 'Industry', 'Article']:
                r = s.run(f'MATCH (n:{label}) RETURN count(n) AS c').single()
                stats[label] = r['c']
            for rel in ['REQUIRES', 'HAS_SNAPSHOT', 'HAS_CHANGE', 'BELONGS_TO', 'PUBLISHED_BY', 'CO_OCCURS_WITH', 'MASTERED', 'MATCHED']:
                try:
                    r = s.run(f'MATCH ()-[r:{rel}]->() RETURN count(r) AS c').single()
                    stats['R:'+rel] = r['c']
                except Exception:
                    stats['R:'+rel] = 0

        print("\n=== 图谱统计 ===")
        for k, v in stats.items():
            print(f"   {k}: {v}")
        print("✅ ETL 完成")

    finally:
        driver.close()


if __name__ == "__main__":
    main()
