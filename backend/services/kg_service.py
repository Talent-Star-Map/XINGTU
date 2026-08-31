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
    """给定 Job,按 snapshot 时间序列返回某项 metric 的轨迹。"""
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
        f"WHERE true {where} "
        f"WITH s, {field} AS val "
        f"RETURN s.captured_at AS date, "
        f"       coalesce(val, 0) AS value, "
        f"       s.title AS title, s.source AS source "
        f"ORDER BY s.captured_at ASC"
    )
    rows = _query(cypher, params)
    out = []
    for r in rows:
        out.append({
            "date": str(r["date"]) if r.get("date") else None,
            "value": float(r["value"]) if r.get("value") is not None else 0.0,
            "title": r.get("title"),
            "source": r.get("source"),
        })
    return out


def get_snapshot_at(date: str, limit: int = 100) -> Dict[str, Any]:
    """在指定日期,当时的 Job + Skill 关系子图。"""
    rows = _query(
        """
        MATCH (s:JobSnapshot)
        WHERE s.captured_at <= datetime($date)
        WITH s
        ORDER BY s.captured_at DESC
        WITH s.job_id_ref AS job_id, collect(s)[0] AS latest
        MATCH (j:Job {id: job_id})-[:REQUIRES]->(sk:Skill)
        WITH j, latest, collect(distinct sk) AS skills
        RETURN j, latest, skills LIMIT $limit
        """,
        {"date": date, "limit": limit},
    )
    nodes = []
    links = []
    seen = set()
    for r in rows:
        j = _record_to_dict(r["j"])
        jid = f"Job:{j.get('id')}"
        if jid not in seen:
            seen.add(jid)
            nodes.append({"id": jid, "label": "Job", "name": j.get("title"),
                          "source": j.get("source")})
        for sk in r["skills"]:
            sn = _record_to_dict(sk)
            sid = f"Skill:{sn.get('canonical_name')}"
            if sid not in seen:
                seen.add(sid)
                nodes.append({"id": sid, "label": "Skill",
                              "name": sn.get("display_name")})
            links.append({"source": jid, "target": sid, "type": "REQUIRES"})
    return {"nodes": nodes, "links": links}


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

def get_job_changes(job_id: int) -> List[Dict[str, Any]]:
    rows = _query(
        """
        MATCH (j:Job {id: $id})-[:HAS_CHANGE]->(c:ChangeEvent)
        RETURN c.change_id AS change_id,
               c.date AS date,
               c.type AS type,
               c.magnitude AS magnitude,
               c.before AS before,
               c.after AS after,
               c.reason AS reason,
               c.reason_source AS reason_source,
               c.source AS source
        ORDER BY c.date DESC
        """,
        {"id": job_id},
    )
    out = []
    for r in rows:
        before = r.get("before")
        after = r.get("after")
        if isinstance(before, str):
            try: before = json.loads(before)
            except: pass
        if isinstance(after, str):
            try: after = json.loads(after)
            except: pass
        out.append({
            "change_id": r["change_id"],
            "date": str(r["date"]) if r.get("date") else None,
            "type": r["type"],
            "magnitude": r["magnitude"],
            "before": before,
            "after": after,
            "reason": r["reason"],
            "reason_source": r["reason_source"],
            "source": r["source"],
        })
    return out


def get_pending_change_count() -> int:
    rows = _query("MATCH (c:ChangeEvent) WHERE c.reason IS NULL RETURN count(c) AS c")
    return rows[0]["c"] if rows else 0


# ────────────────────────────────────────────────────────────
# 语义搜索(向量)
# ────────────────────────────────────────────────────────────

def semantic_search_jobs(query: str, top_k: int = 20) -> List[Dict[str, Any]]:
    """用 OpenAI embedding + Neo4j 向量索引检索最相关的 Job。"""
    try:
        embeddings = get_openai_embeddings()
    except RuntimeError:
        return []

    vec = embeddings.embed_query(query)

    rows = _query(
        """
        CALL db.index.vector.queryNodes('snapshot_vec', $k, $vec)
        YIELD node AS snap, score
        MATCH (j:Job)-[:HAS_SNAPSHOT]->(snap)
        RETURN j.id AS id, j.title AS title, j.source AS source,
               j.company_name AS company, snap.title AS snap_title,
               score
        ORDER BY score DESC LIMIT $k
        """,
        {"k": top_k, "vec": vec},
    )
    return rows


def fallback_keyword_search(query: str, top_k: int = 20) -> List[Dict[str, Any]]:
    """向量索引不可用时的降级:模糊匹配 title + job_description。"""
    rows = _query(
        """
        MATCH (j:Job)
        WHERE j.title CONTAINS $q
           OR coalesce(j.job_description, '') CONTAINS $q
        RETURN j.id AS id, j.title AS title, j.source AS source,
               j.company_name AS company
        LIMIT $k
        """,
        {"q": query, "k": top_k},
    )
    return rows


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
    limit_skills: int = 80,
) -> Dict[str, Any]:
    """单页首次加载的全图:Job + Skill + REQUIRES。

    拆两个 query:原写法把 `[(j)-[:REQUIRES]->(sk:Skill) | sk][..$ls]` list comprehension
    跟 collect({map}) 放在同一 WITH,Neo4j 会按边笛卡尔积逐行分裂,导致 jobs_data 只返 1 项。
    """
    rows = _query(
        """
        MATCH (j:Job)
        WITH j ORDER BY j.hot_score DESC LIMIT $lj
        OPTIONAL MATCH (j)-[:REQUIRES]->(sk:Skill)
        WITH j, collect(distinct sk) AS sks
        WITH collect({j: j, sks: sks}) AS jobs_data
        RETURN jobs_data
        """,
        {"lj": limit_jobs},
    )
    skills_rows = _query(
        """
        MATCH (j:Job)-[:REQUIRES]->(sk:Skill)
        WITH j, sk, j.hot_score AS hs
        ORDER BY hs DESC LIMIT $lj
        WITH collect(DISTINCT sk)[..$ls] AS all_skills
        RETURN all_skills
        """,
        {"lj": limit_jobs, "ls": limit_skills},
    )
    nodes = []
    links = []
    seen = set()
    if rows and rows[0].get("jobs_data"):
        for jd in rows[0]["jobs_data"]:
            j = _record_to_dict(jd["j"])
            jid = f"job:{j['id']}"
            if jid not in seen:
                seen.add(jid)
                nodes.append({
                    "id": jid,
                    "type": "Job",            # 给 NodeListPanel 分组用(原来是 'Other')
                    "label": "Job",            # 给 react-force-graph 渲染图用
                    "name": j.get("title"),    # 显示名
                    "source": j.get("source"),
                    "salary_avg": ((j.get("salary_min") or 0) + (j.get("salary_max") or 0)) / 2 if j.get("salary_min") else 0,
                })
            for sk in jd["sks"]:
                sn = _record_to_dict(sk)
                sid = f"skill:{sn.get('canonical_name')}"
                if sid not in seen:
                    seen.add(sid)
                    nodes.append({
                        "id": sid,
                        "type": "Skill",         # 给 NodeListPanel 分组用
                        "label": "Skill",        # 给 react-force-graph 渲染图用
                        "name": sn.get("display_name") or sn.get("canonical_name"),
                    })
                links.append({"source": jid, "target": sid, "type": "REQUIRES"})
    return {"nodes": nodes, "links": links}

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

