"""Neo4j 知识图谱构建器 — 从 MongoDB + MySQL 灌图。

节点:
- Entity(name, type, hot_score, mention_count) — 技术实体(skill/tool/role/concept/framework)
- Source(source, source_id, url, title) — GitHub repo / discussion
- Job(job_id, title, salary, company, source_url) — JD 岗位
- Skill(name) — 岗位技能(从 JD 抽出来的)

关系:
- (Entity)-[:MENTIONED_IN {confidence, hot_score}]->(Source)
- (Job)-[:REQUIRES]->(Skill)
- (Skill)-[:EVOLVES_WITH {hot_score, trend}]->(Entity) — Skill 与 Entity 名字相同时挂接
- (Job)-[:NEAR_ENTITY]->(Entity) — 通过 title/description 跟 Entity 名字模糊匹配

幂等:用 MERGE 保证可重复跑。
"""
import os
import time
from datetime import datetime, timezone
from typing import Dict, List, Any

from neo4j import GraphDatabase
from pymongo import MongoClient
import pymysql


# ========== 配置 ==========

NEO4J_URI = os.environ.get("NEO4J_URI", "bolt://127.0.0.1:7687")
NEO4J_USER = os.environ.get("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.environ.get("NEO4J_PASSWORD", "")

MONGO_HOST = os.environ.get("MONGO_HOST", "127.0.0.1")
MONGO_PORT = int(os.environ.get("MONGO_PORT", "27017"))
MONGO_USER = os.environ.get("MONGO_USER", "admin")
MONGO_PASSWORD = os.environ.get("MONGO_PASSWORD", "")
MONGO_AUTH_DB = os.environ.get("MONGO_AUTH_DB", "admin")
ANALYZED_DB = "xingtu_analyzed"
RAW_DB = "xingtu_raw"

MYSQL_HOST = os.environ.get("MYSQL_HOST", "127.0.0.1")
MYSQL_PORT = int(os.environ.get("MYSQL_PORT", "3308"))
MYSQL_USER = os.environ.get("MYSQL_USER", "root")
MYSQL_PASSWORD = os.environ.get("MYSQL_PASSWORD", "")
MYSQL_DB = os.environ.get("MYSQL_DB", "xingtu")


# ========== 工具 ==========

def log(*a):
    print("[INFO]", *a, flush=True)


def log_warn(*a):
    print("[WARN]", *a, flush=True)


def log_err(*a):
    print("[ERROR]", *a, flush=True)


def get_neo4j():
    return GraphDatabase.driver(
        NEO4J_URI,
        auth=(NEO4J_USER, NEO4J_PASSWORD),
        max_connection_pool_size=10,
        connection_timeout=30,
    )


def get_mongo():
    uri = f"mongodb://{MONGO_USER}:{MONGO_PASSWORD}@{MONGO_HOST}:{MONGO_PORT}/?authSource={MONGO_AUTH_DB}"
    return MongoClient(uri, serverSelectionTimeoutMS=5000)


def get_mysql():
    return pymysql.connect(
        host=MYSQL_HOST,
        port=MYSQL_PORT,
        user=MYSQL_USER,
        password=MYSQL_PASSWORD,
        database=MYSQL_DB,
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor,
    )


def run_cypher(driver, cypher: str, params: Dict = None, batch_size: int = 500):
    """批量执行 cypher,params 是 list of dict 时自动分批。"""
    params = params or {}
    if isinstance(params, list):
        total = len(params)
        if total == 0:
            return 0
        log(f"  执行 {total} 条 (批大小 {batch_size})")
        affected = 0
        with driver.session() as session:
            for i in range(0, total, batch_size):
                batch = params[i : i + batch_size]
                session.run(cypher, batch=batch)
                affected += len(batch)
        return affected
    else:
        with driver.session() as session:
            result = session.run(cypher, params)
            return result.consume().counters


# ========== 约束/索引 ==========

CONSTRAINTS = [
    "CREATE CONSTRAINT entity_id IF NOT EXISTS FOR (e:Entity) REQUIRE e.entity_id IS UNIQUE",
    "CREATE CONSTRAINT source_id IF NOT EXISTS FOR (s:Source) REQUIRE s.source_id IS UNIQUE",
    "CREATE CONSTRAINT job_id IF NOT EXISTS FOR (j:Job) REQUIRE j.job_id IS UNIQUE",
    "CREATE CONSTRAINT skill_name IF NOT EXISTS FOR (s:Skill) REQUIRE s.name IS UNIQUE",
    "CREATE INDEX entity_type IF NOT EXISTS FOR (e:Entity) ON (e.type)",
    "CREATE INDEX entity_hot IF NOT EXISTS FOR (e:Entity) ON (e.hot_score)",
    "CREATE INDEX job_title IF NOT EXISTS FOR (j:Job) ON (j.title)",
]


def ensure_schema(driver):
    with driver.session() as session:
        for c in CONSTRAINTS:
            try:
                session.run(c)
            except Exception as e:
                log_warn(f"约束失败(可能已存在): {c[:50]}...: {e}")
    log("✓ Neo4j 约束/索引就绪")


# ========== 灌图 ==========

def build_entities(driver, mongo_client):
    """从 xingtu_analyzed.analyzed_entities 灌 Entity 节点。"""
    db = mongo_client[ANALYZED_DB]
    entities = list(db["analyzed_entities"].find({}, {"_id": 0}))
    log(f"待灌 Entity: {len(entities)}")

    rows = []
    for e in entities:
        rows.append({
            "entity_id": e["entity_id"],
            "name": e["name"],
            "type": e["type"],
            "aliases": e.get("aliases", []),
            "hot_score": float(e.get("max_confidence", 0.0)) * 100 + float(e.get("hot_score", 0.0)),
            "mention_count": int(e.get("mention_count", 0)),
            "first_seen": e.get("first_seen"),
            "last_seen": e.get("last_seen"),
        })

    cypher = """
    UNWIND $batch AS row
    MERGE (e:Entity {entity_id: row.entity_id})
    SET e.name = row.name,
        e.type = row.type,
        e.aliases = row.aliases,
        e.hot_score = row.hot_score,
        e.mention_count = row.mention_count,
        e.first_seen = row.first_seen,
        e.last_seen = row.last_seen
    """
    n = run_cypher(driver, cypher, rows)
    log(f"✓ Entity 写入 {n} 条")
    return n


def build_sources_and_mentions(driver, mongo_client):
    """从 xingtu_raw + xingtu_analyzed.mentions 灌 Source 节点和 MENTIONED_IN 关系。"""
    raw_db = mongo_client[RAW_DB]
    ana_db = mongo_client[ANALYZED_DB]

    # Source 节点:GitHub repos
    repos = list(raw_db["raw_github_repos"].find({}, {"_id": 0, "source_id": 1, "name": 1, "url": 1, "description": 1, "stars": 1, "primary_language": 1}))
    log(f"待灌 Source(repo): {len(repos)}")
    repo_rows = [{
        "source_id": r["source_id"],
        "source": "github_repo",
        "name": r.get("name") or r["source_id"].split("/")[-1],
        "url": r.get("url"),
        "description": (r.get("description") or "")[:200],
        "stars": r.get("stars", 0),
        "language": r.get("primary_language"),
    } for r in repos]
    cypher = """
    UNWIND $batch AS row
    MERGE (s:Source {source_id: row.source_id})
    SET s.source = row.source,
        s.name = row.name,
        s.url = row.url,
        s.description = row.description,
        s.stars = row.stars,
        s.language = row.language
    """
    run_cypher(driver, cypher, repo_rows)

    # Source 节点:discussions
    discs = list(raw_db["raw_github_discussions"].find({}, {"_id": 0, "source_id": 1, "source_repo": 1, "title": 1, "url": 1}))
    log(f"待灌 Source(discussion): {len(discs)}")
    disc_rows = [{
        "source_id": d["source_id"],
        "source": "github_discussion",
        "name": d.get("title", "")[:120],
        "url": d.get("url"),
        "description": (d.get("source_repo") or ""),
        "stars": 0,
        "language": None,
    } for d in discs]
    cypher2 = """
    UNWIND $batch AS row
    MERGE (s:Source {source_id: row.source_id})
    SET s.source = row.source,
        s.name = row.name,
        s.url = row.url,
        s.description = row.description,
        s.stars = row.stars,
        s.language = row.language
    """
    run_cypher(driver, cypher2, disc_rows)

    # MENTIONED_IN 关系
    mentions = list(ana_db["analyzed_mentions"].find({}, {"_id": 0}))
    log(f"待灌 MENTIONED_IN: {len(mentions)}")
    # 拼 entity_id
    from analyzer.entity_extractor import normalize_name  # 复用
    rows = []
    for m in mentions:
        entity_id = f"{m['entity_type']}:{normalize_name(m['entity_name'])}"
        rows.append({
            "entity_id": entity_id,
            "source_id": m["source_id"],
            "confidence": float(m.get("confidence", 0.5)),
            "hot_score": float(m.get("hot_score", 0.0)),
            "source_kind": m.get("source_kind", "repo"),
        })
    cypher3 = """
    UNWIND $batch AS row
    MATCH (e:Entity {entity_id: row.entity_id})
    MATCH (s:Source {source_id: row.source_id})
    MERGE (e)-[r:MENTIONED_IN]->(s)
    SET r.confidence = row.confidence,
        r.hot_score = row.hot_score,
        r.source_kind = row.source_kind
    """
    n = run_cypher(driver, cypher3, rows, batch_size=1000)
    log(f"✓ MENTIONED_IN 关系写入 {n} 条")
    return n


def build_jobs_and_skills(driver):
    """从 MySQL xingtu.jobs 灌 Job 节点、Skill 节点、REQUIRES 关系。"""
    conn = get_mysql()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id, title, company, salary, location, source_url, raw_description, skills
                FROM jobs
                WHERE skills IS NOT NULL AND skills != ''
            """)
            rows = cur.fetchall()
        log(f"待灌 Job: {len(rows)}")
    finally:
        conn.close()

    job_rows = []
    skill_set = set()
    rel_rows = []
    for j in rows:
        job_id = str(j["id"])
        title = j.get("title") or ""
        skills_raw = j.get("skills") or ""
        # skills 字段可能是 JSON 数组、逗号分隔、Python 列表字符串
        skills = parse_skills(skills_raw)
        for s in skills:
            s_norm = s.strip()
            if s_norm:
                skill_set.add(s_norm)
                rel_rows.append({"job_id": job_id, "skill_name": s_norm})
        job_rows.append({
            "job_id": job_id,
            "title": title[:200],
            "company": (j.get("company") or "")[:100],
            "salary": (j.get("salary") or "")[:50],
            "location": (j.get("location") or "")[:50],
            "source_url": j.get("source_url"),
        })

    # Job 节点
    if job_rows:
        cypher_job = """
        UNWIND $batch AS row
        MERGE (j:Job {job_id: row.job_id})
        SET j.title = row.title,
            j.company = row.company,
            j.salary = row.salary,
            j.location = row.location,
            j.source_url = row.source_url
        """
        n = run_cypher(driver, cypher_job, job_rows, batch_size=500)
        log(f"✓ Job 节点写入 {n} 条")

    # Skill 节点
    if skill_set:
        cypher_skill = """
        UNWIND $batch AS row
        MERGE (s:Skill {name: row.name})
        """
        run_cypher(driver, cypher_skill, [{"name": s} for s in skill_set], batch_size=1000)
        log(f"✓ Skill 节点写入 {len(skill_set)} 条")

    # REQUIRES 关系
    if rel_rows:
        cypher_rel = """
        UNWIND $batch AS row
        MATCH (j:Job {job_id: row.job_id})
        MATCH (s:Skill {name: row.skill_name})
        MERGE (j)-[r:REQUIRES]->(s)
        """
        n = run_cypher(driver, cypher_rel, rel_rows, batch_size=1000)
        log(f"✓ REQUIRES 关系写入 {n} 条")
        return len(job_rows), len(skill_set), n
    return len(job_rows), len(skill_set), 0


def parse_skills(raw: str) -> List[str]:
    """解析 skills 字段,支持 JSON 数组 / 逗号分隔 / Python list 字符串。"""
    raw = (raw or "").strip()
    if not raw:
        return []
    # JSON 数组
    if raw.startswith("["):
        try:
            import json
            return [str(x) for x in json.loads(raw)]
        except Exception:
            pass
    # Python list 字符串
    if raw.startswith("[") and raw.endswith("]"):
        try:
            inner = raw.strip("[]")
            return [x.strip().strip("'\"") for x in inner.split(",") if x.strip()]
        except Exception:
            pass
    # 逗号分隔
    return [x.strip() for x in raw.replace("、", ",").replace("/", ",").split(",") if x.strip()]


def link_skills_to_entities(driver):
    """把 Skill 跟 Entity 接上(名字相同或别名匹配)。"""
    cypher = """
    MATCH (s:Skill)
    OPTIONAL MATCH (e:Entity)
    WHERE toLower(e.name) = toLower(s.name)
       OR any(a IN coalesce(e.aliases, []) WHERE toLower(a) = toLower(s.name))
    WITH s, collect(DISTINCT e) AS entities
    WHERE size(entities) > 0
    UNWIND entities AS e
    MERGE (s)-[r:LINKS_TO]->(e)
    SET r.connected_at = datetime()
    RETURN count(r) AS cnt
    """
    with driver.session() as session:
        result = session.run(cypher).single()
        cnt = result["cnt"] if result else 0
    log(f"✓ Skill ↔ Entity 关联 {cnt} 条")
    return cnt


# ========== 主流程 ==========

def main():
    log("=== Neo4j Builder 启动 ===")
    driver = get_neo4j()
    mongo = get_mongo()
    try:
        ensure_schema(driver)
        build_entities(driver, mongo)
        build_sources_and_mentions(driver, mongo)
        build_jobs_and_skills(driver)
        link_skills_to_entities(driver)

        # 统计
        with driver.session() as session:
            stats = session.run("""
                MATCH (n)
                RETURN
                    count{(n:Entity)} AS entities,
                    count{(n:Source)} AS sources,
                    count{(n:Job)} AS jobs,
                    count{(n:Skill)} AS skills,
                    count{()-[:MENTIONED_IN]->()} AS mentions,
                    count{()-[:REQUIRES]->()} AS requires,
                    count{()-[:LINKS_TO]->()} AS links
            """).single()
            log(f"\n=== 图谱现状 ===")
            for k, v in stats.items():
                log(f"  {k}: {v}")
    finally:
        driver.close()
        mongo.close()
    log("=== 完成 ===")


if __name__ == "__main__":
    main()