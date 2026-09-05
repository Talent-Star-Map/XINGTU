"""
build_kg.py — 全量 ETL: MySQL → Neo4j (以 Job 为主体)
=============================================================

执行内容:
  1. 清空 Neo4j 全图(谨慎!加 --keep-existing 才跳过)
  2. 创建约束 / 索引 / 向量索引
  3. 抽 Job / Skill / Category / Industry / Company / Article
  4. 建关系: REQUIRES / BELONGS_TO / PUBLISHED_BY / HAS_SNAPSHOT / HAS_CHANGE /
              SIMILAR_TO / NEXT / CO_OCCURS_WITH / IN_COMMUNITY
  5. 建 JobSnapshot(按 publish_time + data_type=1)
  6. 建 ChangeEvent(快照两两 diff)
  7. 建 Community(GDS Leiden,如未安装则跳过)

用法:
  python -m scripts.build_kg                  # 全量重建
  python -m scripts.build_kg --keep-existing  # 不清空,增量补
  python -m scripts.build_kg --skip-gds       # 不跑 Leiden

要求:
  - Neo4j 5.x 已部署并启动(bot = NEO4J_URI)
  - GDS 插件(可选,装了就跑社区检测)
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime
from typing import Any, Dict, Iterable, List

# Windows console UTF-8
try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

import pymysql

# 让脚本能以 python -m scripts.build_kg 形式执行
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import (
    SessionLocal,
    get_neo4j_driver,
    close_neo4j,
)
from services.skill_synonyms import ADJACENT_SKILLS
# ── AI 生成内容审核(2026-09-05):写入 Neo4j 后提交人工审核 ──
try:
    from services.review_service import submit_for_review as _submit_review
except Exception:  # 脚本独立跑时容错,不让 import 失败
    _submit_review = None

# ────────────────────────────────────────────────────────────
# MySQL 数据源 — 全部用 SQLAlchemy Session
# ────────────────────────────────────────────────────────────

DB = {
    "host": "180.76.227.159", "port": 3308,
    "user": "root", "password": "Xingtu123",
    "database": "xingtu", "charset": "utf8mb4",
}


def _mysql_conn():
    return pymysql.connect(**DB, autocommit=True, cursorclass=pymysql.cursors.DictCursor)


def _safe_json_loads(raw):
    if raw is None or raw == "":
        return []
    if isinstance(raw, (list, dict)):
        return raw
    try:
        return json.loads(raw)
    except Exception:
        return []


def _normalize_title(title: str) -> str:
    """用于聚合:去空白 + 转小写。"""
    return (title or "").strip().lower()


def _normalize_skill_name(s: str) -> str:
    """用于去重 + 节点 key,保留原大小写但 trim。"""
    return (s or "").strip()


def _classify_industry(tech_field: str) -> str:
    """根据 technology_field 字段粗分行业(用作 Industry 节点)。"""
    if not tech_field:
        return "其他"
    tf = tech_field.lower()
    if any(k in tf for k in ["人工智能", "大模型", "llm", "ai"]):
        return "AI/大模型"
    if any(k in tf for k in ["前端", "react", "vue", "javascript", "typescript"]):
        return "前端/全栈"
    if any(k in tf for k in ["后端", "java", "python", "go", "微服务"]):
        return "后端开发"
    if any(k in tf for k in ["数据", "data", "大数据", "hadoop", "spark"]):
        return "数据工程"
    if any(k in tf for k in ["算法", "nlp", "推荐", "搜索", "cv", "计算机视觉"]):
        return "算法/AI 工程"
    if any(k in tf for k in ["运维", "devops", "sre", "k8s", "kubernetes"]):
        return "运维/SRE"
    if any(k in tf for k in ["测试", "qa", "质量"]):
        return "测试/QA"
    if any(k in tf for k in ["安全", "security", "网络安全"]):
        return "安全/网络安全"
    if any(k in tf for k in ["产品", "pm"]):
        return "产品/PM"
    if any(k in tf for k in ["架构", "架构师"]):
        return "架构师"
    return "其他"


# ────────────────────────────────────────────────────────────
# Neo4j 操作封装
# ────────────────────────────────────────────────────────────

CONSTRAINTS = [
    "CREATE CONSTRAINT job_id IF NOT EXISTS FOR (j:Job) REQUIRE j.id IS UNIQUE",
    "CREATE CONSTRAINT skill_canonical IF NOT EXISTS FOR (s:Skill) REQUIRE s.canonical_name IS UNIQUE",
    "CREATE CONSTRAINT company_name IF NOT EXISTS FOR (c:Company) REQUIRE c.name IS UNIQUE",
    "CREATE CONSTRAINT industry_name IF NOT EXISTS FOR (i:Industry) REQUIRE i.name IS UNIQUE",
    # Node Key 需要 Enterprise,改 用 composite index
    "CREATE CONSTRAINT change_id IF NOT EXISTS FOR (c:ChangeEvent) REQUIRE c.change_id IS UNIQUE",
    "CREATE CONSTRAINT article_id IF NOT EXISTS FOR (a:Article) REQUIRE a.id IS UNIQUE",
    "CREATE CONSTRAINT category_name IF NOT EXISTS FOR (c:Category) REQUIRE c.name IS UNIQUE",
    "CREATE CONSTRAINT snapshot_id IF NOT EXISTS FOR (s:JobSnapshot) REQUIRE s.snapshot_id IS UNIQUE",
]


def create_constraints_and_indexes(driver):
    print("[1/8] 创建约束 + 索引 ...")
    with driver.session() as s:
        for stmt in CONSTRAINTS:
            try:
                s.run(stmt)
            except Exception as e:
                print(f"   ⚠ constraint warn: {str(e)[:80]}")
        # 普通索引(Neo4j 5 语法)
        try:
            s.run("CREATE INDEX job_publish IF NOT EXISTS FOR (j:Job) ON (j.publish_time)")
            s.run("CREATE INDEX job_source IF NOT EXISTS FOR (j:Job) ON (j.source)")
            s.run("CREATE INDEX snapshot_date IF NOT EXISTS FOR (s:JobSnapshot) ON (s.captured_at)")
            s.run("CREATE INDEX change_date IF NOT EXISTS FOR (c:ChangeEvent) ON (c.date)")
            s.run("CREATE INDEX change_job IF NOT EXISTS FOR (c:ChangeEvent) ON (c.job_id_ref)")
            s.run("CREATE INDEX change_type IF NOT EXISTS FOR (c:ChangeEvent) ON (c.type)")
        except Exception as e:
            print(f"   ⚠ index warn: {str(e)[:80]}")


def drop_vector_index(driver):
    """删除已存在的向量索引,以便重建。"""
    with driver.session() as s:
        s.run("DROP INDEX snapshot_vec IF EXISTS")


def create_vector_index(driver, dim: int = 1536):
    """为 JobSnapshot.embedding 建 Neo4j 5.x 向量索引。"""
    print(f"[1.5/8] 创建向量索引 (dim={dim}) ...")
    with driver.session() as s:
        try:
            s.run(
                "CREATE VECTOR INDEX snapshot_vec IF NOT EXISTS "
                "FOR (s:JobSnapshot) ON (s.embedding) "
                "OPTIONS {indexConfig: {`vector.dimensions`: $dim, `vector.similarity_function`: 'cosine'}}",
                dim=dim,
            )
        except Exception as e:
            print(f"   ⚠ vector index warn: {str(e)[:120]}")


def wipe_graph(driver):
    print("[0/8] 清空 Neo4j 全图 (DETACH DELETE) ...")
    with driver.session() as s:
        s.run("MATCH (n) DETACH DELETE n")


# ────────────────────────────────────────────────────────────
# 抽取 → 批量写
# ────────────────────────────────────────────────────────────

BATCH = 500


def _chunks(lst: List, size: int):
    for i in range(0, len(lst), size):
        yield lst[i : i + size]


def extract_jobs(conn) -> List[Dict[str, Any]]:
    """从 jobs 表抽数据。data_type=1 是岗位,data_type=2 是文章,data_type=3 其他。"""
    print("[2/8] 抽取 MySQL.jobs ...")
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
        # 标准化 datetime 为 ISO 字符串,方便序列化
        for k in ("publish_time", "crawl_time", "update_time"):
            if isinstance(r.get(k), datetime):
                r[k] = r[k].isoformat()
        # title_normalized 给跨源去重用
        r["title_normalized"] = _normalize_title(r.get("title"))
        # Decimal → float (Neo4j driver 不支持 Decimal)
        for k in ("quality_score", "hot_score", "trend_score"):
            if r.get(k) is not None:
                try:
                    r[k] = float(r[k])
                except Exception:
                    r[k] = None
        # JSON 字段
        r["skill_tags"] = _safe_json_loads(r.get("skill_tags"))
        out.append(r)
    print(f"   抽取 {len(out)} 行 (data_type=1 岗位 {sum(1 for r in out if r.get('data_type')==1)})")
    return out


def extract_enterprise_jobs(conn) -> List[Dict[str, Any]]:
    print("[2/8] 抽取 MySQL.enterprise_jobs ...")
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
        for k in ("salary_min", "salary_max", "enterprise_id"):
            if r.get(k) is not None:
                try: r[k] = int(r[k])
                except Exception: r[k] = None
        # skills_required 是逗号分隔字符串
        if r.get("skills_required"):
            r["skills_required"] = [s.strip() for s in r["skills_required"].split(",") if s.strip()]
        else:
            r["skills_required"] = []
    print(f"   抽取 {len(rows)} 行")
    return rows


def ingest_jobs(driver, jobs: List[Dict[str, Any]]):
    """把所有 jobs 行写为 (:Job) 或 (:Article)。"""
    print("[3/8] 写入 Job + Article 节点 ...")
    job_rows = [j for j in jobs if j.get("data_type") == 1]
    article_rows = [j for j in jobs if j.get("data_type") == 2]

    with driver.session() as s:
        # Job 节点
        for batch in _chunks(job_rows, BATCH):
            s.run(
                """
                UNWIND $batch AS j
                MERGE (job:Job {id: j.id})
                SET job.title = j.title,
                    job.title_normalized = toLower(trim(j.title)),
                    job.source = j.source,
                    job.source_url = j.source_url,
                    job.technology_field = j.technology_field,
                    job.company_name = j.company_name,
                    job.city = j.city,
                    job.area = j.area,
                    job.salary_min = j.salary_min,
                    job.salary_max = j.salary_max,
                    job.salary_months = j.salary_months,
                    job.education = j.education,
                    job.experience = j.experience,
                    job.job_type = j.job_type,
                    job.job_description = j.job_description,
                    job.quality_score = j.quality_score,
                    job.hot_score = j.hot_score,
                    job.trend_score = j.trend_score,
                    job.view_count = j.view_count,
                    job.like_count = j.like_count,
                    job.collect_count = j.collect_count,
                    job.publish_time = datetime(j.publish_time),
                    job.crawl_time = datetime(j.crawl_time),
                    job.first_seen = datetime(j.crawl_time),
                    job.last_seen = datetime(j.crawl_time),
                    job.ingested_at = datetime(),
                    job.is_approved = false
                """,
                batch=batch,
            )
        # ── 每条新岗位提交一次人工审核(失败不影响 ETL) ──
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
                        },
                    )
                except Exception as ex:
                    print(f'   [warn] submit_review(new_job {j.get("id")}) failed: {ex}')
        # Article 节点(数据集中有 893 篇)
        for batch in _chunks(article_rows, BATCH):
            s.run(
                """
                UNWIND $batch AS j
                MERGE (a:Article {id: j.id})
                SET a.title = j.title,
                    a.source = j.source,
                    a.author = j.author,
                    a.summary = j.summary,
                    a.article_type = j.article_type,
                    a.content = j.content,
                    a.publish_time = datetime(j.publish_time),
                    a.crawl_time = datetime(j.crawl_time),
                    a.ingested_at = datetime()
                """,
                batch=batch,
            )
        print(f"   Job {len(job_rows)} | Article {len(article_rows)}")


def ingest_skills_and_edges(driver, jobs: List[Dict[str, Any]], ent_jobs: List[Dict[str, Any]]):
    """抽取所有 skill + 建 REQUIRES / BELONGS_TO / PUBLISHED_BY / CO_OCCURS_WITH。"""
    print("[4/8] 抽取 Skill + 建关系 ...")

    skill_freq: Dict[str, int] = {}
    skill_cooccur: Dict[tuple, int] = {}
    industry_set: set = set()
    company_set: set = set()

    # 遍历岗位
    for j in jobs:
        if j.get("data_type") != 1:
            continue
        skills = [_normalize_skill_name(s) for s in (j.get("skill_tags") or [])]
        skills = [s for s in skills if s]
        for s in skills:
            skill_freq[s] = skill_freq.get(s, 0) + 1
        for i in range(len(skills)):
            for k in range(i + 1, len(skills)):
                a, b = sorted([skills[i].lower(), skills[k].lower()])
                skill_cooccur[(a, b)] = skill_cooccur.get((a, b), 0) + 1
        if j.get("company_name"):
            company_set.add(j["company_name"])
        ind = _classify_industry(j.get("technology_field") or "")
        industry_set.add(ind)

    # 加上 ADJACENT_SKILLS 作为基础共现
    for a, adj in ADJACENT_SKILLS.items():
        for b in adj:
            k = tuple(sorted([a.lower(), b.lower()]))
            if k not in skill_cooccur:
                skill_cooccur[k] = 1

    with driver.session() as s:
        # Skill 节点
        skill_payload = [{"canonical_name": k, "display_name": k, "importance": v}
                          for k, v in skill_freq.items()]
        for batch in _chunks(skill_payload, BATCH):
            s.run(
                """
                UNWIND $batch AS s
                MERGE (sk:Skill {canonical_name: s.canonical_name})
                SET sk.display_name = s.display_name,
                    sk.importance = s.importance,
                    sk.ingested_at = datetime()
                """,
                batch=batch,
            )
        print(f"   Skill 节点 {len(skill_payload)}")

        # Category 节点(7 大类)
        cats = [
            {"name": "语言", "color": "#3b82f6", "display_name": "编程语言"},
            {"name": "框架", "color": "#10b981", "display_name": "开发框架"},
            {"name": "数据库", "color": "#f59e0b", "display_name": "数据库与存储"},
            {"name": "云原生", "color": "#8b5cf6", "display_name": "云原生与运维"},
            {"name": "AI", "color": "#ec4899", "display_name": "AI 与大模型"},
            {"name": "数据", "color": "#06b6d4", "display_name": "数据工程"},
            {"name": "工程", "color": "#84cc16", "display_name": "工程实践"},
        ]
        s.run(
            """
            UNWIND $cats AS c
            MERGE (cat:Category {name: c.name})
            SET cat.color = c.color, cat.display_name = c.display_name
            """,
            cats=cats,
        )

        # Industry 节点
        ind_payload = [{"name": n} for n in industry_set]
        for batch in _chunks(ind_payload, BATCH):
            s.run(
                "UNWIND $batch AS i MERGE (:Industry {name: i.name})",
                batch=batch,
            )
        print(f"   Industry 节点 {len(ind_payload)}")

        # Company 节点
        comp_payload = [{"name": n} for n in company_set if n]
        for batch in _chunks(comp_payload, BATCH):
            s.run(
                "UNWIND $batch AS c MERGE (:Company {name: c.name})",
                batch=batch,
            )
        print(f"   Company 节点 {len(comp_payload)}")

        # REQUIRES 边(Job -> Skill)
        job_skills = []
        for j in jobs:
            if j.get("data_type") != 1:
                continue
            for sk in (j.get("skill_tags") or []):
                sk_norm = _normalize_skill_name(sk)
                if sk_norm:
                    job_skills.append({
                        "job_id": j["id"],
                        "skill": sk_norm,
                        "source": j.get("source") or "unknown",
                        "valid_from": j.get("publish_time"),
                    })
        for batch in _chunks(job_skills, BATCH):
            s.run(
                """
                UNWIND $batch AS e
                MATCH (j:Job {id: e.job_id}), (sk:Skill {canonical_name: e.skill})
                MERGE (j)-[r:REQUIRES]->(sk)
                SET r.source = e.source,
                    r.valid_from = datetime(e.valid_from),
                    r.valid_to = datetime(),
                    r.ingested_at = datetime()
                """,
                batch=batch,
            )
        print(f"   REQUIRES 边 {len(job_skills)}")

        # BELONGS_TO(Job -> Industry) + PUBLISHED_BY(Job -> Company)
        ind_payload = []
        comp_payload = []
        for j in jobs:
            if j.get("data_type") != 1:
                continue
            ind_payload.append({"job_id": j["id"], "ind": _classify_industry(j.get("technology_field") or "")})
            if j.get("company_name"):
                comp_payload.append({"job_id": j["id"], "company": j["company_name"]})
        for batch in _chunks(ind_payload, BATCH):
            s.run(
                """
                UNWIND $batch AS e
                MATCH (j:Job {id: e.job_id}), (i:Industry {name: e.ind})
                MERGE (j)-[:BELONGS_TO]->(i)
                """,
                batch=batch,
            )
        for batch in _chunks(comp_payload, BATCH):
            s.run(
                """
                UNWIND $batch AS e
                MATCH (j:Job {id: e.job_id}), (c:Company {name: e.company})
                MERGE (j)-[:PUBLISHED_BY]->(c)
                """,
                batch=batch,
            )
        print(f"   BELONGS_TO {len(ind_payload)} | PUBLISHED_BY {len(comp_payload)}")

        # CO_OCCURS_WITH(Skill <-> Skill)
        co_payload = [{"a": a, "b": b, "weight": w} for (a, b), w in skill_cooccur.items()]
        for batch in _chunks(co_payload, BATCH):
            s.run(
                """
                UNWIND $batch AS e
                MATCH (s1:Skill), (s2:Skill)
                WHERE toLower(s1.canonical_name) = e.a AND toLower(s2.canonical_name) = e.b
                MERGE (s1)-[r:CO_OCCURS_WITH]-(s2)
                SET r.weight = e.weight
                """,
                batch=batch,
            )
        print(f"   CO_OCCURS_WITH {len(co_payload)}")


def ingest_snapshots_and_changes(driver, jobs: List[Dict[str, Any]]):
    """按 (job_id, source, month) 建 JobSnapshot,再做两两 diff 生成 ChangeEvent。"""
    print("[5/8] 建 JobSnapshot + ChangeEvent ...")

    # 按 job_id 分组并按 publish_time 排序
    by_job: Dict[int, List[Dict[str, Any]]] = {}
    for j in jobs:
        if j.get("data_type") != 1 or not j.get("publish_time"):
            continue
        by_job.setdefault(j["id"], []).append(j)
    for k in by_job:
        by_job[k].sort(key=lambda r: r["publish_time"])

    snapshots = []
    for job_id, rows in by_job.items():
        # 同一 (month, source) 聚合
        seen = {}
        for r in rows:
            pub = r["publish_time"]
            if isinstance(pub, str):
                month = pub[:7]  # YYYY-MM
            else:
                month = pub.strftime("%Y-%m")
            key = (month, r.get("source") or "unknown")
            if key in seen:
                # 累加
                ex = seen[key]
                if r.get("salary_min") and ex.get("salary_min"):
                    ex["salary_min"] = (ex["salary_min"] + r["salary_min"]) // 2
                if r.get("salary_max") and ex.get("salary_max"):
                    ex["salary_max"] = (ex["salary_max"] + r["salary_max"]) // 2
            else:
                pub_iso = pub if isinstance(pub, str) else pub.isoformat()
                seen[key] = {
                    "snapshot_id": f"snap-{job_id}-{month}-{r.get('source') or 'unk'}",
                    "job_id_ref": job_id,
                    "captured_at": pub_iso,
                    "source": r.get("source") or "unknown",
                    "title": r.get("title"),
                    "salary_min": r.get("salary_min"),
                    "salary_max": r.get("salary_max"),
                    "education": r.get("education"),
                    "experience": r.get("experience"),
                    "skills_required": r.get("skill_tags") or [],
                    "job_description": r.get("job_description") or "",
                }
        snapshots.extend(seen.values())

    print(f"   生成 {len(snapshots)} 个快照 ...")

    with driver.session() as s:
        for batch in _chunks(snapshots, BATCH):
            s.run(
                """
                UNWIND $batch AS snap
                MATCH (j:Job {id: snap.job_id_ref})
                MERGE (s:JobSnapshot {snapshot_id: snap.snapshot_id})
                SET s.job_id_ref = snap.job_id_ref,
                    s.captured_at = datetime(snap.captured_at),
                    s.source = snap.source,
                    s.title = snap.title,
                    s.salary_min = snap.salary_min,
                    s.salary_max = snap.salary_max,
                    s.salary_avg = CASE WHEN snap.salary_min IS NOT NULL AND snap.salary_max IS NOT NULL
                                       THEN (snap.salary_min + snap.salary_max) / 2.0
                                       ELSE null END,
                    s.education = snap.education,
                    s.experience = snap.experience,
                    s.skills_required = snap.skills_required,
                    s.job_description = snap.job_description,
                    s.ingested_at = datetime()
                MERGE (j)-[r:HAS_SNAPSHOT]->(s)
                SET r.source = snap.source,
                    r.is_current = false
                """,
                batch=batch,
            )
        # 标记最近一个快照为 is_current
        s.run(
            """
            MATCH (j:Job)-[r:HAS_SNAPSHOT]->(s:JobSnapshot)
            WITH j, s, r
            ORDER BY j.id, s.captured_at DESC
            WITH j, collect({s: s, r: r})[0] AS latest
            SET latest.r.is_current = true
            """
        )

        # 2. 对每个 Job 的快照排序后两两比较,生成 ChangeEvent
        changes = []
        for job_id, rows in by_job.items():
            sorted_rows = sorted(rows, key=lambda r: r["publish_time"])
            for i in range(1, len(sorted_rows)):
                prev, curr = sorted_rows[i - 1], sorted_rows[i]
                # salary 变化
                if curr.get("salary_max") and prev.get("salary_max"):
                    delta = (curr["salary_max"] - prev["salary_max"]) / max(prev["salary_max"], 1)
                    if abs(delta) >= 0.10:  # 10% 阈值
                        changes.append({
                            "change_id": f"ch-{job_id}-{curr.get('source')}-{i}-salary",
                            "job_id_ref": job_id,
                            "date": curr["publish_time"],
                            "type": "salary_increase" if delta > 0 else "salary_decrease",
                            "magnitude": round(delta, 3),
                            "before": json.dumps({"salary_max": prev.get("salary_max")}),
                            "after": json.dumps({"salary_max": curr.get("salary_max")}),
                            "source": curr.get("source"),
                        })
                # skill 增减
                prev_sk = set(prev.get("skill_tags") or [])
                curr_sk = set(curr.get("skill_tags") or [])
                added = list(curr_sk - prev_sk)
                removed = list(prev_sk - curr_sk)
                if added:
                    changes.append({
                        "change_id": f"ch-{job_id}-{curr.get('source')}-{i}-skill_added",
                        "job_id_ref": job_id,
                        "date": curr["publish_time"],
                        "type": "skill_added",
                        "magnitude": len(added),
                        "before": json.dumps({"skills": list(prev_sk)}),
                        "after": json.dumps({"added_skills": added}),
                        "source": curr.get("source"),
                    })
                if removed:
                    changes.append({
                        "change_id": f"ch-{job_id}-{curr.get('source')}-{i}-skill_removed",
                        "job_id_ref": job_id,
                        "date": curr["publish_time"],
                        "type": "skill_removed",
                        "magnitude": len(removed),
                        "before": json.dumps({"skills": list(prev_sk)}),
                        "after": json.dumps({"removed_skills": removed}),
                        "source": curr.get("source"),
                    })
                # 学历要求变化
                if prev.get("education") and curr.get("education") and prev["education"] != curr["education"]:
                    changes.append({
                        "change_id": f"ch-{job_id}-{curr.get('source')}-{i}-education",
                        "job_id_ref": job_id,
                        "date": curr["publish_time"],
                        "type": "education_change",
                        "magnitude": 1,
                        "before": json.dumps({"education": prev["education"]}),
                        "after": json.dumps({"education": curr["education"]}),
                        "source": curr.get("source"),
                    })

        print(f"   纵向 ChangeEvent {len(changes)} (单岗位多次抓取)")

        # ─── 横向 ChangeEvent: 同 title_normalized 跨 source 的市场信号 ───
        # 同一岗位在不同平台发布 → 多源验证事件
        title_groups: Dict[str, List[Dict[str, Any]]] = {}
        for j in jobs:
            if j.get("data_type") != 1 or not j.get("title_normalized"):
                continue
            title_groups.setdefault(j["title_normalized"], []).append(j)

        cross_changes = 0
        for tnorm, rows in title_groups.items():
            if len(rows) < 2:
                continue
            # 按 publish_time 排序
            rows_sorted = sorted(rows, key=lambda r: r.get("publish_time") or "")
            for i in range(1, len(rows_sorted)):
                prev, curr = rows_sorted[i - 1], rows_sorted[i]
                src_prev = prev.get("source") or "unknown"
                src_curr = curr.get("source") or "unknown"
                if src_prev == src_curr:
                    continue
                # 跨源出现事件
                cross_changes += 1
                changes.append({
                    "change_id": f"ch-cross-{tnorm[:40]}-{curr['id']}-market_signal",
                    "job_id_ref": curr["id"],
                    "date": curr["publish_time"],
                    "type": "market_signal",
                    "magnitude": round((curr.get("salary_max") or 0) / 1000, 1),
                    "before": json.dumps({
                        "source": src_prev,
                        "salary_max": prev.get("salary_max"),
                        "publish_time": prev.get("publish_time"),
                    }, ensure_ascii=False),
                    "after": json.dumps({
                        "source": src_curr,
                        "salary_max": curr.get("salary_max"),
                        "publish_time": curr.get("publish_time"),
                    }, ensure_ascii=False),
                    "source": f"{src_prev}→{src_curr}",
                })
                # 跨源薪资差异(若变化 ≥ 15%)
                if curr.get("salary_max") and prev.get("salary_max"):
                    delta = (curr["salary_max"] - prev["salary_max"]) / max(prev["salary_max"], 1)
                    if abs(delta) >= 0.15:
                        changes.append({
                            "change_id": f"ch-cross-{tnorm[:40]}-{curr['id']}-salary_diff",
                            "job_id_ref": curr["id"],
                            "date": curr["publish_time"],
                            "type": "salary_increase" if delta > 0 else "salary_decrease",
                            "magnitude": round(delta, 3),
                            "before": json.dumps({"salary_max": prev.get("salary_max"), "source": src_prev}, ensure_ascii=False),
                            "after": json.dumps({"salary_max": curr.get("salary_max"), "source": src_curr}, ensure_ascii=False),
                            "source": f"{src_prev}→{src_curr}",
                        })
        print(f"   横向 ChangeEvent {cross_changes} (跨源信号) | 总计 {len(changes)}")

        # 一次性写入所有 ChangeEvent
        if changes:
            for batch in _chunks(changes, BATCH):
                s.run(
                    """
                    UNWIND $batch AS ch
                    MATCH (j:Job {id: ch.job_id_ref})
                    MERGE (c:ChangeEvent {change_id: ch.change_id})
                    SET c.date = datetime(ch.date),
                        c.type = ch.type,
                        c.magnitude = ch.magnitude,
                        c.before = ch.before,
                        c.after = ch.after,
                        c.source = ch.source,
                        c.reason = null,
                        c.reason_source = null,
                        c.ingested_at = datetime(),
                        c.is_approved = false
                    MERGE (j)-[:HAS_CHANGE]->(c)
                    """,
                    batch=batch,
                )
            # ── 每条能力变更提交一次人工审核(失败不影响 ETL) ──
            if _submit_review is not None:
                for ch in changes:
                    try:
                        _submit_review(
                            task_type='skill_change',
                            target_kind='ChangeEvent',
                            target_id=str(ch.get('change_id')),
                            content={
                                'job_id_ref': ch.get('job_id_ref'),
                                'date': str(ch.get('date')),
                                'type': ch.get('type'),
                                'magnitude': ch.get('magnitude'),
                                'before': ch.get('before'),
                                'after': ch.get('after'),
                                'source': ch.get('source'),
                            },
                        )
                    except Exception as ex:
                        print(f'   [warn] submit_review(skill_change {ch.get("change_id")}) failed: {ex}')


def ingest_similar_jobs(driver, jobs: List[Dict[str, Any]]):
    """同 title_normalized 的 Job 之间建 SIMILAR_TO 边。"""
    print("[6/8] 建 SIMILAR_TO 边 ...")
    with driver.session() as s:
        s.run(
            """
            MATCH (j1:Job), (j2:Job)
            WHERE j1.title_normalized = j2.title_normalized
              AND j1.id < j2.id
            MERGE (j1)-[r:SIMILAR_TO]-(j2)
            SET r.basis = 'title',
                r.similarity = 1.0
            """
        )


def ingest_user_and_match(driver):
    """抽取用户技能 + 匹配记录。"""
    print("[7/8] 抽取 user_skills + match_records ...")
    with _mysql_conn() as conn, conn.cursor() as cur:
        # Users
        cur.execute("SELECT id, username, target_position, skills FROM jobseekers WHERE skills IS NOT NULL AND skills != ''")
        users = cur.fetchall()
        with driver.session() as s:
            for batch in _chunks([{
                "id": u["id"], "username": u["username"] or "",
                "target_position": u["target_position"] or "",
                "skills": [x.strip() for x in (u["skills"] or "").split(",") if x.strip()]
            } for u in users], BATCH):
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
            # User -> MASTERED -> Skill
            cur.execute("SELECT user_id, skill_name, mastered, mastered_at FROM user_skills")
            user_skills = cur.fetchall()
            for e in user_skills:
                if isinstance(e.get("mastered_at"), datetime):
                    e["mastered_at"] = e["mastered_at"].isoformat()
                if e.get("mastered") is not None:
                    try: e["mastered"] = int(e["mastered"])
                    except Exception: e["mastered"] = 0
            for batch in _chunks(user_skills, BATCH):
                s.run(
                    """
                    UNWIND $batch AS e
                    MATCH (u:User {id: e.user_id}), (sk:Skill {canonical_name: e.skill_name})
                    MERGE (u)-[r:MASTERED]->(sk)
                    SET r.mastered = e.mastered,
                        r.mastered_at = datetime(e.mastered_at)
                    """,
                    batch=batch,
                )

            # match_records: User -> MATCHED -> Job
            cur.execute("SELECT jobseeker_id, job_id, match_score, created_at FROM match_records")
            matches = cur.fetchall()
            for m in matches:
                if isinstance(m.get("created_at"), datetime):
                    m["created_at"] = m["created_at"].isoformat()
                if m.get("match_score") is not None:
                    try: m["match_score"] = int(m["match_score"])
                    except Exception: m["match_score"] = None
            for batch in _chunks(matches, BATCH):
                s.run(
                    """
                    UNWIND $batch AS m
                    MATCH (u:User {id: m.jobseeker_id}), (j:Job {id: m.job_id})
                    MERGE (u)-[r:MATCHED]->(j)
                    SET r.score = m.match_score,
                        r.computed_at = datetime(m.created_at)
                    """,
                    batch=batch,
                )
            print(f"   User {len(users)} | MASTERED {len(user_skills)} | MATCHED {len(matches)}")


def run_gds_leiden(driver):
    """GDS Leiden 社区检测(可选)。失败不致命。"""
    print("[8/8] GDS Leiden 社区检测 ...")
    with driver.session() as s:
        try:
            # 1. 投影
            s.run(
                "CALL gds.graph.project("
                "'jobGraph', 'Job', ['REQUIRES','SIMILAR_TO','BELONGS_TO'],"
                "{relationshipProperties: 'weight'})"
            )
            # 2. Leiden
            s.run(
                "CALL gds.leiden.write('jobGraph', {writeProperty: 'community_id',"
                "nodeLabels: ['Job'], relationshipTypes: ['REQUIRES','SIMILAR_TO']})"
            )
            # 3. 创建 Community 节点
            s.run(
                """
                MATCH (j:Job) WHERE j.community_id IS NOT NULL
                WITH j.community_id AS cid, collect(j) AS jobs
                MERGE (c:Community {id: cid})
                SET c.size = size(jobs),
                    c.summary = 'Community of ' + size(jobs) + ' jobs'
                WITH c, jobs
                UNWIND jobs AS j
                MERGE (j)-[:IN_COMMUNITY]->(c)
                """
            )
            print("   ✅ GDS Leiden 跑完")
        except Exception as e:
            msg = str(e)[:200]
            print(f"   ⚠ GDS Leiden 跳过: {msg}")


# ────────────────────────────────────────────────────────────
# Main
# ────────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--keep-existing", action="store_true", help="不清空旧数据")
    ap.add_argument("--skip-gds", action="store_true", help="不跑 Leiden")
    args = ap.parse_args()

    driver = get_neo4j_driver()
    try:
        if not args.keep_existing:
            wipe_graph(driver)
            drop_vector_index(driver)

        create_constraints_and_indexes(driver)
        create_vector_index(driver, dim=1536)

        with _mysql_conn() as conn:
            jobs = extract_jobs(conn)
            ent_jobs = extract_enterprise_jobs(conn)

        ingest_jobs(driver, jobs)
        ingest_skills_and_edges(driver, jobs, ent_jobs)
        ingest_snapshots_and_changes(driver, jobs)
        ingest_similar_jobs(driver, jobs)
        ingest_user_and_match(driver)

        if not args.skip_gds:
            run_gds_leiden(driver)
        else:
            print("[8/8] GDS Leiden 跳过 (--skip-gds)")

        # 统计
        with driver.session() as s:
            print("\n=== 图谱统计 ===")
            for label in ["Job", "JobSnapshot", "ChangeEvent", "Skill", "Company",
                          "Industry", "Category", "Article", "User", "Community"]:
                r = s.run(f"MATCH (n: {label}) RETURN count(n) AS c").single()
                print(f"   {label}: {r['c']}")
            for rel in ["REQUIRES", "HAS_SNAPSHOT", "HAS_CHANGE", "BELONGS_TO",
                        "PUBLISHED_BY", "SIMILAR_TO", "CO_OCCURS_WITH",
                        "IN_COMMUNITY", "MASTERED", "MATCHED"]:
                try:
                    r = s.run(f"MATCH ()-[r: {rel}]->() RETURN count(r) AS c").single()
                    print(f"   {rel}: {r['c']}")
                except Exception:
                    pass

        print("\n✅ ETL 完成")
    finally:
        close_neo4j()


if __name__ == "__main__":
    main()