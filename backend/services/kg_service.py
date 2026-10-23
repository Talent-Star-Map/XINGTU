"""
kg_service.py — 业务代码层:封装 Cypher 查询 + 向量检索,给 routers/kg.py 用

对齐 graph-rag-agent 的 kg_service.py 命名,但场景是岗位图谱。

API 列表(从 routers/kg.py 调用):
  - get_overview()                  总览统计
  - get_jobs(filters, limit)        岗位列表(可带 source/industry 过滤)
  - get_job_detail(job_id)          单 Job 详情 + 邻居
  - get_job_neighbors(job_id, depth, limit)  子图 {nodes, links}
  - get_job_evolution(job_id, metric, from, to)  时序
  - get_job_changes(job_id)         变化事件
  - get_snapshot_at(date, limit)    当时全貌
  - get_timeline_anchors(from, to)  时间轴锚点
  - semantic_search_jobs(query, top_k)   向量检索
  - get_personal_recommend(user_id) 推荐
  - get_gap_analysis(user_id, job_id) 缺口分析
  - get_co_occurring(skill, limit)
"""

from __future__ import annotations

import json
import os
from datetime import datetime
from typing import Any, Dict, List, Optional

from database import get_neo4j_driver, get_openai_embeddings
from services.temporal_graph import cutoff_iso, latest_snapshots, rank_snapshots, snapshot_graph, snapshot_delta, utc_instant

# NEO4J_MOCK 兜底分支移到文件末尾(否则 def 会覆盖 override)


# ────────────────────────────────────────────────────────────
# 基础工具
# ────────────────────────────────────────────────────────────

def _query(cypher: str, params: Optional[dict] = None) -> List[Dict[str, Any]]:
    driver = get_neo4j_driver()
    with driver.session() as s:
        return [dict(r) for r in s.run(cypher, **(params or {}))]


def _record_to_dict(node_or_rel):
    """把 Neo4j Node / Relationship 转 dict。"""
    return dict(node_or_rel)


# ────────────────────────────────────────────────────────────
# 总览
# ────────────────────────────────────────────────────────────

def get_overview() -> Dict[str, Any]:
    rows = _query(
        """
        MATCH (j:Job) WITH count(j) AS jobs
        MATCH (snap:JobSnapshot) WITH jobs, count(snap) AS snapshots
        MATCH (ch:ChangeEvent) WITH jobs, snapshots,
              count(ch) AS changes,
              count(CASE WHEN ch.reason IS NOT NULL THEN 1 END) AS attributed
        MATCH (sk:Skill) WITH jobs, snapshots, changes, attributed, count(sk) AS skills
        MATCH (c:Company) WITH jobs, snapshots, changes, attributed, skills, count(c) AS companies
        MATCH (i:Industry) WITH jobs, snapshots, changes, attributed, skills, companies, count(i) AS industries
        MATCH (a:Article) WITH jobs, snapshots, changes, attributed, skills, companies, industries, count(a) AS articles
        RETURN jobs, snapshots, changes, attributed, skills, companies, industries, articles
        """
    )
    if not rows:
        return {"jobs": 0, "snapshots": 0, "changes": 0, "attributed": 0,
                "skills": 0, "companies": 0, "industries": 0, "articles": 0}
    r = rows[0]
    return {
        "jobs": r["jobs"],
        "snapshots": r["snapshots"],
        "changes": r["changes"],
        "attributed": r["attributed"],
        "skills": r["skills"],
        "companies": r["companies"],
        "industries": r["industries"],
        "articles": r["articles"],
    }


def get_sources_overview() -> List[Dict[str, Any]]:
    return _query(
        """
        MATCH (j:Job)
        WITH j.source AS source, count(j) AS cnt
        RETURN source, cnt
        ORDER BY cnt DESC
        LIMIT 20
        """
    )


# ────────────────────────────────────────────────────────────
# 岗位查询
# ────────────────────────────────────────────────────────────

def get_jobs(
    limit: int = 100,
    source: Optional[str] = None,
    industry: Optional[str] = None,
    skip: int = 0,
) -> List[Dict[str, Any]]:
    # NOTE: 字段 j.is_approved 在当前 Neo4j schema 中不存在(1908 个 Job 节点全 null),
    # 加 coalesce 过滤会把所有岗位都屏蔽掉。Job 节点已经过 build_kg.py 的离线筛选
    # (脏数据/无效岗位不进图),默认返回全部。
    where = []
    params: Dict[str, Any] = {"limit": limit, "skip": skip}
    if source:
        where.append("j.source = $source")
        params["source"] = source
    if industry:
        where.append("(j)-[:BELONGS_TO]->(:Industry {name: $industry})")
        params["industry"] = industry
    cypher = (
        "MATCH (j:Job) "
        + ("WHERE " + " AND ".join(where) + " " if where else "")
        + "OPTIONAL MATCH (j)-[:BELONGS_TO]->(i:Industry) "
        # 实时算 sort_score = 技能需求数×2 + 变化事件数×5 + 相似岗位数
        # 反映"综合性 + 时序活跃度 + 跨源关联度",比 crawl_time 排序更稳定
        + "OPTIONAL MATCH (j)-[:REQUIRES]->(:Skill) WITH j, i, count(*) AS req "
        + "OPTIONAL MATCH (j)-[:HAS_CHANGE]->(:ChangeEvent) WITH j, i, req, count(*) AS chg "
        + "OPTIONAL MATCH (j)-[:SIMILAR_TO]->(:Job) WITH j, i, req, chg, count(*) AS sim "
        + "RETURN j, i.name AS industry, (req * 2 + chg * 5 + sim) AS sort_score "
        + "ORDER BY sort_score DESC, j.crawl_time DESC "
        + "SKIP $skip LIMIT $limit"
    )
    rows = _query(cypher, params)
    out = []
    for r in rows:
        j = _record_to_dict(r["j"])
        out.append({
            "id": j.get("id"),
            "title": j.get("title"),
            "source": j.get("source"),
            "company_name": j.get("company_name"),
            "city": j.get("city"),
            "salary_min": j.get("salary_min"),
            "salary_max": j.get("salary_max"),
            "education": j.get("education"),
            "experience": j.get("experience"),
            "industry": r.get("industry"),
            # 把实时算的 sort_score 暴露成 hot_score 给前端
            # (字段名不变,前端调用方不动)
            "hot_score": int(r.get("sort_score") or 0),
            "trend_score": j.get("trend_score"),
            "crawl_time": str(j.get("crawl_time")) if j.get("crawl_time") else None,
        })
    return out


def get_job_detail(job_id: int) -> Optional[Dict[str, Any]]:
    rows = _query(
        """
        MATCH (j:Job {id: $id})
        OPTIONAL MATCH (j)-[:BELONGS_TO]->(i:Industry)
        OPTIONAL MATCH (j)-[:PUBLISHED_BY]->(c:Company)
        RETURN j, i.name AS industry, c.name AS company
        """,
        {"id": job_id},
    )
    if not rows:
        return None
    r = rows[0]
    j = _record_to_dict(r["j"])
    return {
        "id": j.get("id"),
        "title": j.get("title"),
        "evidence_scope": "role_group_aggregate",
        "evidence_warning": "字段可能汇集不同企业招聘；不能据此断言单个招聘或时序变化",
            "source": j.get("source"),
        "source_url": j.get("source_url"),
        "company_name": r.get("company") or j.get("company_name"),
        "city": j.get("city"),
        "industry": r.get("industry"),
        "salary_min": j.get("salary_min"),
        "salary_max": j.get("salary_max"),
        "education": j.get("education"),
        "experience": j.get("experience"),
        "job_description": j.get("job_description"),
        "job_type": j.get("job_type"),
        "quality_score": j.get("quality_score"),
        "hot_score": j.get("hot_score"),
        "trend_score": j.get("trend_score"),
        "publish_time": str(j.get("publish_time")) if j.get("publish_time") else None,
        "crawl_time": str(j.get("crawl_time")) if j.get("crawl_time") else None,
    }


def get_job_neighbors(job_id: int, depth: int = 1, limit: int = 50) -> Dict[str, Any]:
    """返回 React-Force-Graph 期望的 {nodes, links} 结构。"""
    rows = _query(
        """
        MATCH (j:Job {id: $id})
        MATCH path = (j)-[*1..2]-(n)
        WITH j, collect(distinct n) AS ns
        UNWIND ns + [j] AS node
        WITH collect(distinct node) AS all_nodes
        UNWIND all_nodes AS a
        UNWIND all_nodes AS b
        WITH a, b,
             [(a)-[r]-(b) | {type: type(r), source: r.source, weight: r.weight}][0] AS rel
        WHERE a <> b AND id(a) < id(b) AND rel IS NOT NULL
        WITH collect({source: a, target: b, rel: rel}) AS edges,
             collect(distinct a) + collect(distinct b) AS ns
        UNWIND ns AS n
        WITH edges, collect(distinct n) AS unodes
        RETURN unodes, edges
        LIMIT $limit
        """,
        {"id": job_id, "limit": limit},
    )
    nodes = []
    links = []
    seen_node = set()
    for row in rows:
        for n in row["unodes"]:
            nid = n.id
            if nid in seen_node:
                continue
            seen_node.add(nid)
            labels = list(n.labels)
            label = labels[0] if labels else "Unknown"
            props = _record_to_dict(n)
            nodes.append({
                "id": f"{label}:{props.get('id', props.get('canonical_name', props.get('name', nid)))}",
                "label": label,
                "name": (props.get("title") or props.get("canonical_name")
                         or props.get("name") or props.get("display_name") or ""),
                "source": props.get("source"),
            })
        for e in row["edges"]:
            s = e["source"]
            t = e["target"]
            sid = next((n["id"] for n in nodes
                        if n["id"].endswith(str(_record_to_dict(s).get("id",
                            _record_to_dict(s).get("canonical_name",
                            _record_to_dict(s).get("name", s.id)))))), None)
            tid = next((n["id"] for n in nodes
                        if n["id"].endswith(str(_record_to_dict(t).get("id",
                            _record_to_dict(t).get("canonical_name",
                            _record_to_dict(t).get("name", t.id)))))), None)
            if sid and tid:
                links.append({"source": sid, "target": tid,
                              "type": e["rel"]["type"]})
    return {"nodes": nodes, "links": links}


# ────────────────────────────────────────────────────────────
# 时序 + 演化
# ────────────────────────────────────────────────────────────

def get_job_evolution(
    job_id: int,
    metric: str = "salary_avg",
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Return labelled listing observations, never a role-wide time series.

    Only a verified source/company/URL identity may form a longitudinal chain.
    Multiple advertisements in the same title group remain separate series.
    """
    metric_map = {
        "salary_avg": "s.salary_avg",
        "salary_max": "s.salary_max",
        "salary_min": "s.salary_min",
        "snapshot_count": "1",
    }
    field = metric_map.get(metric, "s.salary_avg")
    params: Dict[str, Any] = {"id": job_id}
    where = ""
    if from_date:
        where += " AND s.captured_at >= datetime($from)"
        params["from"] = from_date
    if to_date:
        where += " AND s.captured_at <= datetime($to)"
        params["to"] = to_date
    cypher = (
        f"MATCH (j:Job {{id: $id}})-[:HAS_SNAPSHOT]->(s:JobSnapshot) "
        f"WHERE s.source_url IS NOT NULL AND s.company_name IS NOT NULL {where} "
        f"WITH s, {field} AS val "
        f"RETURN s.captured_at AS date, "
        f"       val AS value, "
        f"       s.title AS title, s.source AS source, s.snapshot_id AS snapshot_id, "
        f"       s.source_url AS source_url, s.company_name AS company_name, "
        f"       s.source_job_id AS source_job_id "
        f"ORDER BY s.captured_at ASC, s.snapshot_id ASC"
    )
    rows = _query(cypher, params)
    out = []
    for r in rows:
        from services.posting_evolution import posting_identity
        identity = posting_identity(r)
        if identity is None:
            continue
        out.append({
            "date": str(r["date"]) if r.get("date") else None,
            "value": float(r["value"]) if r.get("value") is not None else None,
            "title": r.get("title"),
            "source": r.get("source"),
            "snapshot_id": r.get("snapshot_id"),
            "source_url": r.get("source_url"),
            "company_name": r.get("company_name"),
            "source_job_id": r.get("source_job_id"),
            "series_key": "|".join(identity),
            "comparison_scope": "same_posting_observations",
        })
    return out


def _latest_snapshot_rows(as_of: str, limit: Optional[int] = None) -> List[Dict[str, Any]]:
    # Select by advertisement identity BEFORE similarity ranking. Never join
    # current REQUIRES edges or current title/company into historical evidence.
    cypher = """
        MATCH (j:Job)-[:HAS_SNAPSHOT]->(snap:JobSnapshot)
        WHERE snap.captured_at <= datetime($as_of)
        RETURN properties(snap) AS snapshot, j.id AS job_id
    """
    params = {"as_of": as_of}
    rows = _query(cypher, params)
    selected = latest_snapshots([{**r["snapshot"], "job_id_ref": r["job_id"]} for r in rows], as_of)
    return selected[:max(1, min(int(limit), 300))] if limit is not None else selected


def get_snapshot_at(date: str, limit: int = 100) -> Dict[str, Any]:
    """Snapshot skills at a UTC cutoff; unknown skill lists remain unknown."""
    as_of = cutoff_iso(date)
    return snapshot_graph(_latest_snapshot_rows(as_of, limit), as_of)


def get_timeline_anchors(from_date: Optional[str] = None, to_date: Optional[str] = None,
                          bucket: str = "month") -> List[Dict[str, Any]]:
    """返回按月/周聚合的时间轴锚点(每个 bucket 的 snapshot 数 + job 数)。"""
    bucket_expr = (
        "toString(s.captured_at.year) + '-' + "
        "toString(s.captured_at.month)"
    )
    if bucket == "week":
        bucket_expr = (
            "toString(s.captured_at.year) + '-W' + "
            "toString(s.captured_at.week)"
        )

    params: Dict[str, Any] = {}
    where = ""
    if from_date:
        where += " AND s.captured_at >= datetime($from)"
        params["from"] = from_date
    if to_date:
        where += " AND s.captured_at <= datetime($to)"
        params["to"] = to_date
    cypher = (
        f"MATCH (s:JobSnapshot) WHERE true {where} "
        f"WITH {bucket_expr} AS bucket, "
        f"     count(s) AS snapshots, "
        f"     count(distinct s.job_id_ref) AS jobs "
        f"RETURN bucket, snapshots, jobs "
        f"ORDER BY bucket"
    )
    rows = _query(cypher, params)
    return [{"bucket": r["bucket"], "snapshots": r["snapshots"], "jobs": r["jobs"]}
            for r in rows]


# ────────────────────────────────────────────────────────────
# 变化事件
# ────────────────────────────────────────────────────────────

def get_job_skill_deltas(job_id: int) -> List[Dict[str, Any]]:
    """Derive changes only within a confirmed advertisement identity.

    Historical ChangeEvent annotations remain in storage, but are not treated
    as verified causes by this read path. Equal-time observations are not trends.
    """
    if globals().get("__mocked__"):
        return []  # Demo graph has no verified snapshot history.
    rows = _query("""
        MATCH (:Job {id: $id})-[:HAS_SNAPSHOT]->(s:JobSnapshot)
        RETURN properties(s) AS snapshot
        ORDER BY s.captured_at, s.snapshot_id
    """, {"id": job_id})
    from services.posting_evolution import posting_identity
    previous, out, observations = {}, [], {}
    for row in rows:
        snap = {**row["snapshot"], "job_id_ref": job_id}
        identity = posting_identity(snap)
        if not snap.get("captured_at") or identity is None:
            continue
        key = (identity, utc_instant(snap["captured_at"]))
        current = observations.get(key)
        if current is None or str(snap.get("snapshot_id") or "") > str(current.get("snapshot_id") or ""):
            observations[key] = snap
    for snap in sorted(observations.values(), key=lambda item: utc_instant(item["captured_at"])):
        identity = posting_identity(snap)
        old = previous.get(identity)
        if old and utc_instant(old["captured_at"]) < utc_instant(snap["captured_at"]):
            delta = snapshot_delta(old, snap)
            # Preserve fields consumed by existing change-event UI.
            out.append({**delta, "change_id": f"{old.get('snapshot_id')}->{snap.get('snapshot_id')}",
                        "date": str(snap["captured_at"]), "type": "skill_observation",
                        "magnitude": delta["skill_distance"], "source": snap.get("source"),
                        "before": {"skills": old.get("skills_required")},
                        "after": {"skills": snap.get("skills_required")},
                        "reason": None, "reason_source": None})
        previous[identity] = snap
    return sorted(out, key=lambda item: utc_instant(item["date"]), reverse=True)


def get_job_changes(job_id: int) -> List[Dict[str, Any]]:
    """Expose only differences with a verified source advertisement identity.

    Historical ChangeEvent nodes built by title-only comparisons are retained in
    storage for audit, but must not be presented as factual role evolution.
    """
    return get_job_skill_deltas(job_id)


def get_pending_change_count() -> int:
    rows = _query("MATCH (c:ChangeEvent) WHERE c.reason IS NULL AND c.source_url IS NOT NULL RETURN count(c) AS c")
    return rows[0]["c"] if rows else 0


# ────────────────────────────────────────────────────────────
# 语义搜索(向量)
# ────────────────────────────────────────────────────────────

def semantic_search_jobs(query: str, top_k: int = 20,
                         as_of: Optional[str] = None) -> List[Dict[str, Any]]:
    """Time-consistent exact semantic retrieval with explicit lexical fallback.

    O(J*d) scoring is intentional for the current small graph. This trades ANN
    throughput for complete temporal filtering; benchmark before scaling up.
    """
    cutoff = cutoff_iso(as_of)
    rows = _latest_snapshot_rows(cutoff)
    if not query.strip() or not rows:
        return []
    try:
        vector = get_openai_embeddings().embed_query(query)
    except Exception:
        # Do not expose provider errors/credentials. DB errors still propagate.
        vector = None
    return rank_snapshots(rows, query, top_k, cutoff, vector)


def fallback_keyword_search(query: str, top_k: int = 20,
                            as_of: Optional[str] = None) -> List[Dict[str, Any]]:
    cutoff = cutoff_iso(as_of)
    return rank_snapshots(_latest_snapshot_rows(cutoff), query, top_k, cutoff)


# ────────────────────────────────────────────────────────────
# 共现 + 技能关系
# ────────────────────────────────────────────────────────────

def get_co_occurring(skill: str, limit: int = 20) -> List[Dict[str, Any]]:
    rows = _query(
        """
        MATCH (s1:Skill)-[r:CO_OCCURS_WITH]-(s2:Skill)
        WHERE toLower(s1.canonical_name) = toLower($sk)
        RETURN s2.canonical_name AS skill, r.weight AS weight
        ORDER BY r.weight DESC LIMIT $limit
        """,
        {"sk": skill, "limit": limit},
    )
    return rows


# ────────────────────────────────────────────────────────────
# 个性化
# ────────────────────────────────────────────────────────────

def get_personal_recommend(user_id: int, limit: int = 5) -> List[Dict[str, Any]]:
    """基于用户的技能,推荐匹配度最高的 Job。"""
    rows = _query(
        """
        MATCH (u:User {id: $uid})-[:MASTERED]->(sk:Skill)
        WITH u, collect(sk.canonical_name) AS user_skills
        MATCH (j:Job)-[:REQUIRES]->(sk:Skill)
        WHERE sk.canonical_name IN user_skills
        WITH j, count(distinct sk) AS overlap, collect(distinct sk.canonical_name) AS matched
        RETURN j.id AS id, j.title AS title, j.source AS source,
               j.company_name AS company, j.salary_min AS salary_min,
               j.salary_max AS salary_max, overlap, matched
        ORDER BY overlap DESC, j.hot_score DESC
        LIMIT $limit
        """,
        {"uid": user_id, "limit": limit},
    )
    return rows


def get_gap_analysis(user_id: int, job_id: int) -> Dict[str, Any]:
    """用户对目标 Job 的技能缺口分析。"""
    rows = _query(
        """
        MATCH (u:User {id: $uid})
        OPTIONAL MATCH (u)-[:MASTERED]->(sk:Skill)
        WITH u, collect(distinct sk.canonical_name) AS user_skills
        MATCH (j:Job {id: $jid})-[:REQUIRES]->(req:Skill)
        WITH j, req.canonical_name AS required, user_skills,
             [(u)-[:MASTERED]->(sk:Skill {canonical_name: required}) | sk][0] AS mastered
        RETURN required, mastered IS NOT NULL AS mastered
        """,
        {"uid": user_id, "jid": job_id},
    )
    have, lack = [], []
    for r in rows:
        if r["mastered"]:
            have.append(r["required"])
        else:
            lack.append(r["required"])
    return {"have": have, "need": lack,
            "match_rate": round(len(have) / max(len(have) + len(lack), 1), 2)}


# ────────────────────────────────────────────────────────────
# 全图(用于单页首屏)
# ────────────────────────────────────────────────────────────

def get_overview_graph(
    limit_jobs: int = 200,
    limit_skills: int = 120,
    tech_stack: Optional[str] = None,
    level: Optional[str] = None,
) -> Dict[str, Any]:
    """单页首次加载的全图:Job + Skill + REQUIRES。

    可选过滤:
    - tech_stack: java / python / frontend / backend / ai / bigdata / test / devops / mobile / product / design
    - level:      entry / junior / mid / senior / lead

    拆分两个 query,避免 list comprehension 在 WITH 里产生笛卡尔积。
    关键修复:
    - Neo4j 5.x dict(node) 不暴露 id 属性,必须用 toString(id(node)) 取元素 id
    - Skill 节点当前 schema 用 `name`(不是 `canonical_name`),做 name-or-canonical 回退
    - 过滤 source IS NULL(GitHub 项目/教程被误标 Job)
    - title / company 客户端兜底过滤脏数据
    """
    # ── 构建 WHERE 片段 ──
    job_where = ["j.source IS NOT NULL"]
    job_params: Dict[str, Any] = {"lj": limit_jobs}

    # 脏数据 title 黑名单(GitHub 项目/教程/AI demo 名混进来)
    title_blacklist = ['pipeshub', 'kirara-ai', 'mindsdb', 'oh-my-zsh', 'awesome-',
                       'spring cloud', 'spring ai', 'springboot',
                       '教程', '实战', '最佳实践', 'demo', 'hands-on']
    for i, kw in enumerate(title_blacklist):
        param = f"tb{i}"
        # Neo4j 不支持 NOT CONTAINS,必须用 NOT(... CONTAINS ...)
        job_where.append(f"NOT (toLower(coalesce(j.title, '')) CONTAINS toLower(${param}))")
        job_params[param] = kw

    # tech_stack 过滤
    if tech_stack:
        ts_kw = _TECH_STACK_KEYWORDS.get(tech_stack)
        if ts_kw:
            ts_clauses = []
            for i, k in enumerate(ts_kw):
                pn = f"ts{i}__" + _safe_param(k)
                ts_clauses.append(f"toLower(coalesce(j.title, '')) CONTAINS toLower(${pn})")
                job_params[pn] = k
            job_where.append("(" + " OR ".join(ts_clauses) + ")")

    # level 过滤(experience 字段是字符串:"经验不限" / "1-3年" / "3-5年" 等)
    if level:
        lvl_kws = _LEVEL_KEYWORDS.get(level)
        if lvl_kws:
            lv_clauses = []
            for i, kw in enumerate(lvl_kws):
                pn = f"lv{i}"
                # 用 CONTAINS 做子串匹配,空串走 IS NULL
                if kw == "":
                    lv_clauses.append("(j.experience IS NULL OR j.experience = '')")
                else:
                    lv_clauses.append(f"j.experience CONTAINS ${pn}")
                    job_params[pn] = kw
            job_where.append("(" + " OR ".join(lv_clauses) + ")")

    job_cypher = (
        "MATCH (j:Job) WHERE " + " AND ".join(job_where) + " "
        "WITH j ORDER BY j.hot_score DESC LIMIT $lj "
        "OPTIONAL MATCH (j)-[:REQUIRES]->(sk:Skill) "
        "WITH j, collect(distinct sk) AS sks "
        "WITH collect({j: j, sks: sks}) AS jobs_data "
        "RETURN jobs_data"
    )

    skill_cypher = (
        "MATCH (j:Job)-[:REQUIRES]->(sk:Skill) "
        "WHERE " + " AND ".join(job_where) + " "
        "WITH j, sk, j.hot_score AS hs "
        "ORDER BY hs DESC LIMIT $lj "
        "WITH collect(DISTINCT sk)[..$ls] AS all_skills "
        "RETURN all_skills"
    )
    job_params["ls"] = limit_skills

    rows = _query(job_cypher, job_params)
    skills_rows = _query(skill_cypher, dict(job_params))

    nodes: List[Dict[str, Any]] = []
    links: List[Dict[str, Any]] = []
    seen = set()

    def _jid(j: Dict[str, Any]) -> str:
        """Job 节点 id。Neo4j 5.x dict(node) 不暴露 id 属性,只能用元素 id。"""
        # 优先用 j.id(应用层 id),fallback 用 Neo4j 元素 id
        real_id = j.get("id")
        if real_id is not None:
            return f"job:{real_id}"
        return f"job:{j.get('elementId', '')}"

    def _skid(sk: Dict[str, Any]) -> str:
        name = sk.get("name") or sk.get("canonical_name") or sk.get("display_name")
        return f"skill:{name}"

    if rows and rows[0].get("jobs_data"):
        for jd in rows[0]["jobs_data"]:
            j = _record_to_dict(jd["j"])
            jid = _jid(j)
            if jid not in seen:
                seen.add(jid)
                nodes.append({
                    "id": jid,
                    "type": "Job",
                    "label": "Job",
                    "name": j.get("title"),
                    "source": j.get("source"),
                    "experience": j.get("experience"),
                    "salary_avg": ((j.get("salary_min") or 0) + (j.get("salary_max") or 0)) / 2 if j.get("salary_min") else 0,
                })
            for sk in jd["sks"]:
                sn = _record_to_dict(sk)
                sid = _skid(sn)
                if not sid.endswith(":"):
                    if sid not in seen:
                        seen.add(sid)
                        nodes.append({
                            "id": sid,
                            "type": "Skill",
                            "label": "Skill",
                            "name": sn.get("name") or sn.get("canonical_name") or sn.get("display_name"),
                        })
                    links.append({"source": jid, "target": sid, "type": "REQUIRES"})
    return {"nodes": nodes, "links": links}


# ────────────────────────────────────────────────────────────
# 按 Cluster 聚合的图谱(消歧 + 对齐)
# ────────────────────────────────────────────────────────────

def get_cluster_graph(
    limit_clusters: int = 50,
    limit_skills: int = 60,
    tech_stack: Optional[str] = None,
    level: Optional[str] = None,
) -> Dict[str, Any]:
    """按 Cluster 节点聚合的图谱(消歧 + 对齐)。

    与 get_overview_graph 的差别:
    - Job 节点先聚成 Cluster(同一 canonical_name = 1 个 cluster)
    - 节点列表只展示 Cluster,不再展示数百个相似 Job 节点
    - Skill 边按 cluster 聚合(成员 Job 的 skill 取并集)
    - 节点 metadata 加 member_count / sample_title / avg_salary,前端可悬浮展示

    若 Neo4j 没有 Cluster 节点,降级到 get_overview_graph。
    """
    cluster_cypher = (
        "MATCH (c:Cluster) "
        "WITH c ORDER BY c.member_count DESC LIMIT $lc "
        "OPTIONAL MATCH (c)<-[:BELONGS_TO]-(j:Job)-[:REQUIRES]->(sk:Skill) "
        "WITH c, collect(DISTINCT j) AS members, collect(DISTINCT sk) AS skills "
        "RETURN c, members, skills"
    )
    rows = _query(cluster_cypher, {"lc": limit_clusters})

    if not rows:
        # 兜底:Neo4j 还没有 Cluster 节点,降级
        return get_overview_graph(
            limit_jobs=limit_clusters * 5,
            limit_skills=limit_skills,
            tech_stack=tech_stack,
            level=level,
        )

    # tech_stack / level 过滤
    def _cluster_match(c) -> bool:
        if tech_stack and c.get("tech_stack") != tech_stack:
            return False
        if level:
            kws = _LEVEL_KEYWORDS.get(level, [])
            members = c.get("members", [])
            exps = [m.get("experience") for m in members if m.get("experience")]
            if not any(any(kw in (e or "") for kw in kws) for e in exps):
                return False
        return True

    nodes: List[Dict[str, Any]] = []
    links: List[Dict[str, Any]] = []
    seen = set()

    for rec in rows:
        c = _record_to_dict(rec["c"]) if rec.get("c") else {}
        members = [_record_to_dict(m) for m in rec.get("members") or []]
        skills = [_record_to_dict(s) for s in rec.get("skills") or []]

        if not _cluster_match(c):
            continue

        cid = f"cluster:{c.get('id')}"
        if cid in seen:
            continue
        seen.add(cid)

        # 计算聚合指标
        member_count = c.get("member_count") or len(members)
        sample_title = c.get("canonical_name") or (
            members[0].get("title") if members else "(空)"
        )
        salaries = []
        for m in members:
            smin = m.get("salary_min") or 0
            smax = m.get("salary_max") or 0
            if smin and smax:
                salaries.append((smin + smax) / 2)
            elif smin:
                salaries.append(smin)
            elif smax:
                salaries.append(smax)
        avg_salary = round(sum(salaries) / len(salaries), 0) if salaries else 0

        nodes.append({
            "id": cid,
            "type": "Cluster",
            "label": "Cluster",
            "name": sample_title,
            "tech_stack": c.get("tech_stack"),
            "member_count": member_count,
            "avg_salary": avg_salary,
            # 抽样 3 个代表 Job,前端悬浮展示
            "sample_members": [
                m.get("title") for m in members[:3] if m.get("title")
            ],
        })

        for sk in skills:
            sn = sk
            sid = f"skill:{sn.get('name') or sn.get('canonical_name') or sn.get('display_name')}"
            if sid.endswith(":"):
                continue
            if sid not in seen:
                seen.add(sid)
                nodes.append({
                    "id": sid,
                    "type": "Skill",
                    "label": "Skill",
                    "name": sn.get("name") or sn.get("canonical_name") or sn.get("display_name"),
                })
            links.append({"source": cid, "target": sid, "type": "REQUIRES"})

    return {"nodes": nodes, "links": links}


def _safe_param(s: str) -> str:
    """Neo4j 参数名只允许字母数字下划线,做最简替换。"""
    return ''.join(c if c.isalnum() or c == '_' else '_' for c in s)


# tech_stack → title 关键词(用于全图过滤)
_TECH_STACK_KEYWORDS: Dict[str, List[str]] = {
    'java':     ['java', 'jvm', 'spring'],
    'python':   ['python', 'django', 'flask', 'fastapi'],
    'frontend': ['前端', 'vue', 'react', 'h5', 'web前端', 'javascript'],
    'backend':  ['后端', '服务端', 'server'],
    'ai':       ['ai', '算法', '深度学习', '机器学习', 'nlp', '大模型', 'llm', 'agent', 'rag'],
    'bigdata':  ['大数据', 'hadoop', 'spark', '数仓', 'flink'],
    'test':     ['测试', 'qa'],
    'devops':   ['运维', 'devops', 'sre', 'dba', 'linux'],
    'mobile':   ['android', 'ios', '移动', 'flutter'],
    'product':  ['产品'],
    'design':   ['设计', 'ui', 'ux'],
}

# level → experience 字符串关键词列表(j.experience 是字符串,如 "1-3年" / "经验不限")
# "" 表示 NULL 或空字符串(数据缺失,默认放 entry 级)
_LEVEL_KEYWORDS: Dict[str, List[str]] = {
    'entry':  ['', '应届', '经验不限', '1年以下', '在校'],  # 应届/不限
    'junior': ['1-3年', '1-3'],                            # 初级 1-3 年
    'mid':    ['3-5年', '3-5', '2-5年', '2-4年', '2-3年'], # 中级 3-5 年(含 2-5/2-4/2-3)
    'senior': ['5-10年', '5-7年', '5-8年', '5-9年', '8-10年', '10年'],  # 高级(去掉单 '5年' 避免误匹配 '2-5年')
    'lead':   ['10年以上', '10年+'],                       # 资深
}

# ────────────────────────────────────────────────────────────
# NEO4J_MOCK 兜底(必须在所有 def 之后)
# ────────────────────────────────────────────────────────────
import os as _os_mock
if _os_mock.getenv("NEO4J_MOCK") == "1":
    from services import kg_service_mock as _impl_mock  # noqa: E402
    for _nm in (
        "get_overview", "get_sources_overview", "get_pending_change_count",
        "get_jobs", "get_overview_graph", "get_job_detail", "get_job_neighbors",
        "get_job_evolution", "get_job_changes", "get_snapshot_at",
        "get_timeline_anchors", "get_co_occurring", "semantic_search_jobs",
        "fallback_keyword_search", "get_personal_recommend", "get_gap_analysis",
    ):
        globals()[_nm] = getattr(_impl_mock, _nm)
    import sys as _sys_mock
    _sys_mock.modules[__name__].__mocked__ = True
    del _nm, _os_mock, _impl_mock, _sys_mock

