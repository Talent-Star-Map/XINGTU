"""
kg_service_mock.py — Neo4j 不可用时的兜底实现
===========================================

当 NEO4J_MOCK=1 时被 kg_service 取代,功能等价但数据来源是 MySQL + 内存聚合。

为什么不直接连云 Neo4j?
  - 云端 180.76.227.159:7687 Bolt 握手失败,运维未部署
  - 本地 Docker Desktop 客户端/服务端 API 版本不匹配

数据流:
  1. 模块导入时一次性从 MySQL 拉 jobs + skills + companies + articles
  2. 在内存里建 {job, skill, company, edge} 索引
  3. 每次调用走索引,O(1) 或 O(log n)

性能:
  - 1529 jobs / 662 skills / 274 companies / 893 articles → < 30MB 内存
  - 1136 SIMILAR_TO / 2805 REQUIRES / 4574 CO_OCCURS → < 10MB
  - 启动慢 5-10s,查询快 O(N) 但 N 很小
"""

from __future__ import annotations

import json
import os
import re
import sys
from collections import defaultdict
from datetime import datetime
from functools import lru_cache
from typing import Any, Dict, List, Optional, Set, Tuple

import pymysql


DB = {
    "host": os.getenv("MYSQL_HOST", "180.76.227.159"),
    "port": int(os.getenv("MYSQL_PORT", "3308")),
    "user": os.getenv("MYSQL_USER", "root"),
    "password": os.getenv("MYSQL_PASSWORD", "Xingtu123"),
    "database": os.getenv("MYSQL_DB", "xingtu"),
    "charset": "utf8mb4",
}


# ────────────────────────────────────────────────────────────
# 一次性构建的内存索引
# ────────────────────────────────────────────────────────────

class _KGStore:
    """单例内存图谱。"""

    jobs: Dict[int, Dict[str, Any]] = {}            # id → job row
    jobs_by_title: Dict[str, List[int]] = {}         # title_normalized → [job_ids]
    job_skills: Dict[int, Set[str]] = {}             # job_id → {skill_name}
    skill_jobs: Dict[str, Set[int]] = {}             # skill_name → {job_id}
    job_company: Dict[int, str] = {}                 # job_id → company_name
    company_jobs: Dict[str, Set[int]] = {}           # company → {job_id}
    job_industry: Dict[int, str] = {}                # job_id → industry
    industry_jobs: Dict[str, Set[int]] = {}          # industry → {job_id}
    job_source: Dict[int, str] = {}                  # job_id → source
    similar_to: Dict[int, Set[int]] = defaultdict(set)  # job_id → {similar_job_ids}
    co_occurs: Dict[str, Dict[str, int]] = {}        # skill → {co_skill → weight}
    snapshots: Dict[int, List[Dict[str, Any]]] = {}  # job_id → [snapshot dicts]
    changes: List[Dict[str, Any]] = []               # [{job_id, type, date, before, after, ...}]
    articles: List[Dict[str, Any]] = []              # [article dicts]
    users: Dict[int, Dict[str, Any]] = {}            # id → user
    user_skills: Dict[int, Set[str]] = {}            # user_id → {skill}
    match_records: List[Dict[str, Any]] = []        # [match dicts]

    def __init__(self):
        self._loaded = False

    def ensure_loaded(self):
        if self._loaded:
            return
        self._load()
        self._loaded = True


def _conn():
    return pymysql.connect(**DB, autocommit=True, cursorclass=pymysql.cursors.DictCursor)


def _normalize_title(t: str) -> str:
    return (t or "").strip().lower()


def _classify_industry(field: str) -> str:
    if not field: return "其他"
    f = field.lower()
    if any(k in f for k in ["ai", "大模型", "llm"]): return "AI/大模型"
    if any(k in f for k in ["前端", "react", "vue", "javascript", "typescript"]): return "前端/全栈"
    if any(k in f for k in ["后端", "java", "python", "go", "微服务"]): return "后端开发"
    if any(k in f for k in ["数据", "data", "hadoop", "spark"]): return "数据工程"
    if any(k in f for k in ["算法", "nlp", "推荐", "cv"]): return "算法/AI 工程"
    if any(k in f for k in ["运维", "devops", "sre", "k8s"]): return "运维/SRE"
    if any(k in f for k in ["测试", "qa"]): return "测试/QA"
    if any(k in f for k in ["产品", "pm"]): return "产品/PM"
    if any(k in f for k in ["架构"]): return "架构师"
    return "其他"


def _load_jobs(store: _KGStore):
    print("[mock] loading jobs from MySQL...", file=sys.stderr)
    with _conn() as c, c.cursor() as cur:
        cur.execute(
            "SELECT id, data_type, source, source_url, title, skill_tags, technology_field, "
            "company_name, city, salary_min, salary_max, education, experience, job_description, "
            "quality_score, hot_score, trend_score, view_count, like_count, collect_count, "
            "publish_time, crawl_time FROM jobs"
        )
        for r in cur.fetchall():
            r["title_normalized"] = _normalize_title(r.get("title"))
            r["industry"] = _classify_industry(r.get("technology_field"))
            r["skill_tags"] = _safe_json(r.get("skill_tags"))
            for k in ("quality_score", "hot_score", "trend_score"):
                if r.get(k) is not None:
                    try: r[k] = float(r[k])
                    except Exception: r[k] = None
            if r.get("publish_time"):
                r["publish_time"] = r["publish_time"].isoformat() if isinstance(r["publish_time"], datetime) else r["publish_time"]
            if r.get("crawl_time"):
                r["crawl_time"] = r["crawl_time"].isoformat() if isinstance(r["crawl_time"], datetime) else r["crawl_time"]

            if r.get("data_type") == 1:  # Job
                store.jobs[r["id"]] = r
                store.jobs_by_title.setdefault(r["title_normalized"], []).append(r["id"])
                store.job_source[r["id"]] = r.get("source") or "unknown"
                store.job_industry[r["id"]] = r["industry"]
                store.industry_jobs[r["industry"]].add(r["id"]) if False else store.industry_jobs.setdefault(r["industry"], set()).add(r["id"])
                if r.get("company_name"):
                    store.job_company[r["id"]] = r["company_name"]
                    store.company_jobs.setdefault(r["company_name"], set()).add(r["id"])
                skills = set(r["skill_tags"]) if r["skill_tags"] else set()
                store.job_skills[r["id"]] = skills
                for s in skills:
                    store.skill_jobs.setdefault(s, set()).add(r["id"])
            elif r.get("data_type") == 2:  # Article
                store.articles.append({
                    "id": r["id"],
                    "title": r.get("title"),
                    "summary": r.get("job_description", "")[:300] if r.get("job_description") else "",
                    "source": r.get("source"),
                    "publish_time": r.get("publish_time"),
                })


def _safe_json(raw):
    if not raw: return []
    if isinstance(raw, (list, dict)): return raw
    try: return json.loads(raw)
    except Exception: return []


def _build_similar(store: _KGStore):
    """title_normalized 一致的 jobs 之间建相似边。"""
    for tnorm, ids in store.jobs_by_title.items():
        for i, a in enumerate(ids):
            for b in ids[i+1:]:
                store.similar_to[a].add(b)
                store.similar_to[b].add(a)


def _build_cooccurs(store: _KGStore):
    """同一 job 内的技能两两共现。"""
    for jid, skills in store.job_skills.items():
        sl = list(skills)
        for i, a in enumerate(sl):
            for b in sl[i+1:]:
                co = store.co_occurs.setdefault(a, {})
                co[b] = co.get(b, 0) + 1
                co2 = store.co_occurs.setdefault(b, {})
                co2[a] = co2.get(a, 0) + 1


def _build_snapshots_and_changes(store: _KGStore):
    """每个 job 一个 snapshot(简化),跨源 job 生成 ChangeEvent。"""
    for jid, job in store.jobs.items():
        snap = {
            "job_id_ref": jid,
            "captured_at": job.get("publish_time"),
            "source": job.get("source"),
            "title": job.get("title"),
            "salary_min": job.get("salary_min"),
            "salary_max": job.get("salary_max"),
            "salary_avg": ((job.get("salary_min") or 0) + (job.get("salary_max") or 0)) / 2 if job.get("salary_min") and job.get("salary_max") else None,
            "skills_required": job.get("skill_tags") or [],
            "job_description": (job.get("job_description") or "")[:1500],
        }
        store.snapshots.setdefault(jid, []).append(snap)

    # 跨源 ChangeEvent
    for tnorm, ids in store.jobs_by_title.items():
        if len(ids) < 2: continue
        rows = [store.jobs[i] for i in ids]
        rows.sort(key=lambda r: r.get("publish_time") or "")
        for i in range(1, len(rows)):
            prev, curr = rows[i-1], rows[i]
            sp, sc = prev.get("source") or "unk", curr.get("source") or "unk"
            if sp == sc: continue
            store.changes.append({
                "change_id": f"mock-cross-{tnorm[:40]}-{curr['id']}",
                "job_id_ref": curr["id"],
                "date": curr.get("publish_time"),
                "type": "market_signal",
                "magnitude": round((curr.get("salary_max") or 0) / 1000, 1),
                "before": {"source": sp, "salary_max": prev.get("salary_max"), "publish_time": prev.get("publish_time")},
                "after": {"source": sc, "salary_max": curr.get("salary_max"), "publish_time": curr.get("publish_time")},
                "source": f"{sp}→{sc}",
                "reason": None,
                "reason_source": None,
            })
            if curr.get("salary_max") and prev.get("salary_max"):
                delta = (curr["salary_max"] - prev["salary_max"]) / max(prev["salary_max"], 1)
                if abs(delta) >= 0.15:
                    store.changes.append({
                        "change_id": f"mock-diff-{tnorm[:40]}-{curr['id']}",
                        "job_id_ref": curr["id"],
                        "date": curr.get("publish_time"),
                        "type": "salary_increase" if delta > 0 else "salary_decrease",
                        "magnitude": round(delta, 3),
                        "before": {"salary_max": prev.get("salary_max"), "source": sp},
                        "after": {"salary_max": curr.get("salary_max"), "source": sc},
                        "source": f"{sp}→{sc}",
                        "reason": None,
                        "reason_source": None,
                    })


def _load_users(store: _KGStore):
    with _conn() as c, c.cursor() as cur:
        cur.execute("SELECT id, username, target_position, skills FROM jobseekers WHERE skills IS NOT NULL AND skills != ''")
        for u in cur.fetchall():
            store.users[u["id"]] = {
                "id": u["id"], "username": u.get("username") or "",
                "target_position": u.get("target_position") or "",
                "skills": [x.strip() for x in (u.get("skills") or "").split(",") if x.strip()],
            }
        cur.execute("SELECT user_id, skill_name FROM user_skills")
        for r in cur.fetchall():
            store.user_skills.setdefault(r["user_id"], set()).add(r["skill_name"])
        cur.execute("SELECT jobseeker_id, job_id, match_score FROM match_records")
        for m in cur.fetchall():
            store.match_records.append(m)


def get_store() -> _KGStore:
    s = _KGStore()
    s.ensure_loaded()
    return s


# ────────────────────────────────────────────────────────────
# 加载钩子(单例,模块级一次性)
# ────────────────────────────────────────────────────────────

_INSTANCE: Optional[_KGStore] = None


def _store() -> _KGStore:
    global _INSTANCE
    if _INSTANCE is None:
        s = _KGStore()
        _load_jobs(s)
        _build_similar(s)
        _build_cooccurs(s)
        _build_snapshots_and_changes(s)
        _load_users(s)
        print(f"[mock] loaded {len(s.jobs)} jobs, {len(s.similar_to)} sim edges, "
              f"{sum(len(v) for v in s.similar_to.values())//2} sim links, "
              f"{sum(len(v) for v in s.co_occurs.values())//2} co-occurs, "
              f"{len(s.changes)} changes, {len(s.users)} users", file=sys.stderr)
        _INSTANCE = s
    return _INSTANCE


# ────────────────────────────────────────────────────────────
# kg_service 兼容接口
# ────────────────────────────────────────────────────────────

def get_overview() -> Dict[str, Any]:
    s = _store()
    skills = set()
    for jid in s.jobs:
        skills.update(s.job_skills.get(jid, set()))
    return {
        "jobs": len(s.jobs),
        "snapshots": sum(len(v) for v in s.snapshots.values()),
        "changes": len(s.changes),
        "attributed": 0,
        "skills": len(skills),
        "companies": len(s.company_jobs),
        "industries": len(s.industry_jobs),
        "articles": len(s.articles),
    }


def get_sources_overview() -> Dict[str, int]:
    s = _store()
    out: Dict[str, int] = defaultdict(int)
    for jid, src in s.job_source.items():
        out[src] += 1
    return dict(out)


def get_pending_change_count() -> int:
    return sum(1 for c in _store().changes if c.get("reason") is None)


def get_jobs(limit: int, source: Optional[str], industry: Optional[str], skip: int = 0) -> List[Dict[str, Any]]:
    s = _store()
    out = []
    for jid, j in sorted(s.jobs.items()):
        if source and j.get("source") != source: continue
        if industry and s.job_industry.get(jid) != industry: continue
        out.append(j)
    out = out[skip:skip+limit]
    # 精简输出
    return [{
        "id": j["id"],
        "title": j.get("title"),
        "company_name": j.get("company_name"),
        "city": j.get("city"),
        "salary_min": j.get("salary_min"),
        "salary_max": j.get("salary_max"),
        "source": j.get("source"),
        "industry": s.job_industry.get(j["id"]),
        "quality_score": j.get("quality_score"),
        "hot_score": j.get("hot_score"),
        "trend_score": j.get("trend_score"),
        "publish_time": j.get("publish_time"),
    } for j in out]


def get_overview_graph(limit_jobs: int, limit_skills: int) -> Dict[str, Any]:
    s = _store()
    # 选 top jobs by hot_score
    jobs_sorted = sorted(s.jobs.values(),
                         key=lambda j: (j.get("hot_score") or 0, j.get("quality_score") or 0),
                         reverse=True)
    job_ids = [j["id"] for j in jobs_sorted[:limit_jobs]]

    # 节点: jobs + skills(从选中的 jobs 抽)
    nodes = []
    seen_skills: Dict[str, int] = {}
    for jid in job_ids:
        nodes.append({
            "id": f"job:{jid}",
            "label": s.jobs[jid].get("title") or f"Job {jid}",
            "type": "Job",
            "company": s.jobs[jid].get("company_name"),
            "city": s.jobs[jid].get("city"),
            "source": s.jobs[jid].get("source"),
            "salary_max": s.jobs[jid].get("salary_max"),
        })
        for sk in s.job_skills.get(jid, set()):
            seen_skills[sk] = seen_skills.get(sk, 0) + 1
    # top skills
    top_skills = sorted(seen_skills.items(), key=lambda x: x[1], reverse=True)[:limit_skills]
    skill_idx = {sk: i for i, (sk, _) in enumerate(top_skills)}
    for sk, cnt in top_skills:
        nodes.append({
            "id": f"skill:{sk}",
            "label": sk,
            "type": "Skill",
            "job_count": cnt,
        })

    # 边: REQUIRES + SIMILAR_TO + CO_OCCURS
    links = []
    for jid in job_ids:
        for sk in s.job_skills.get(jid, set()):
            if sk in skill_idx:
                links.append({
                    "source": f"job:{jid}",
                    "target": f"skill:{sk}",
                    "type": "REQUIRES",
                })
    # SIMILAR_TO (只画前 200 条,避免太密)
    sim_count = 0
    for a in job_ids:
        for b in s.similar_to.get(a, set()):
            if b in set(job_ids) and a < b:
                links.append({
                    "source": f"job:{a}",
                    "target": f"job:{b}",
                    "type": "SIMILAR_TO",
                })
                sim_count += 1
                if sim_count > 200: break
        if sim_count > 200: break
    return {"nodes": nodes, "links": links}


def get_job_detail(job_id: int) -> Optional[Dict[str, Any]]:
    s = _store()
    j = s.jobs.get(job_id)
    if not j: return None
    return {
        "id": j["id"],
        "title": j.get("title"),
        "company_name": j.get("company_name"),
        "city": j.get("city"),
        "salary_min": j.get("salary_min"),
        "salary_max": j.get("salary_max"),
        "source": j.get("source"),
        "industry": s.job_industry.get(job_id),
        "education": j.get("education"),
        "experience": j.get("experience"),
        "job_description": j.get("job_description"),
        "skill_tags": j.get("skill_tags"),
        "quality_score": j.get("quality_score"),
        "hot_score": j.get("hot_score"),
        "trend_score": j.get("trend_score"),
        "publish_time": j.get("publish_time"),
        "snapshots": s.snapshots.get(job_id, []),
        "changes": [c for c in s.changes if c.get("job_id_ref") == job_id],
        "similar_jobs": [
            {"id": b, "title": s.jobs[b].get("title")}
            for b in list(s.similar_to.get(job_id, set()))[:10]
            if b in s.jobs
        ],
    }


def get_job_neighbors(job_id: int, depth: int, limit: int) -> Dict[str, Any]:
    s = _store()
    j = s.jobs.get(job_id)
    if not j: return {"nodes": [], "links": []}
    nodes = [{"id": f"job:{job_id}", "label": j.get("title"), "type": "Job"}]
    links = []
    seen_jobs = {job_id}
    seen_skills: Set[str] = set()
    for sk in s.job_skills.get(job_id, set()):
        nodes.append({"id": f"skill:{sk}", "label": sk, "type": "Skill"})
        links.append({"source": f"job:{job_id}", "target": f"skill:{sk}", "type": "REQUIRES"})
        seen_skills.add(sk)
    for b in list(s.similar_to.get(job_id, set()))[:limit]:
        if b in s.jobs:
            nodes.append({"id": f"job:{b}", "label": s.jobs[b].get("title"), "type": "Job"})
            links.append({"source": f"job:{job_id}", "target": f"job:{b}", "type": "SIMILAR_TO"})
            seen_jobs.add(b)
    return {"nodes": nodes[:limit+50], "links": links[:limit*3]}


def get_job_evolution(job_id: int, metric: str, from_date: Optional[str], to_date: Optional[str]) -> List[Dict[str, Any]]:
    snaps = _store().snapshots.get(job_id, [])
    return [{
        "date": sp.get("captured_at"),
        "salary_avg": sp.get("salary_avg"),
        "salary_min": sp.get("salary_min"),
        "salary_max": sp.get("salary_max"),
        "source": sp.get("source"),
    } for sp in snaps]


def get_job_changes(job_id: int) -> List[Dict[str, Any]]:
    return [c for c in _store().changes if c.get("job_id_ref") == job_id]


def get_snapshot_at(date: str, limit: int) -> Dict[str, Any]:
    s = _store()
    nodes = []
    for jid, j in sorted(s.jobs.items())[:limit]:
        nodes.append({
            "id": f"job:{jid}",
            "label": j.get("title"),
            "type": "Job",
            "source": j.get("source"),
        })
    return {"nodes": nodes, "links": [], "date": date}


def get_timeline_anchors(from_date: Optional[str], to_date: Optional[str], bucket: str) -> List[Dict[str, Any]]:
    s = _store()
    months = set()
    for j in s.jobs.values():
        pt = j.get("publish_time")
        if pt and isinstance(pt, str): months.add(pt[:7])
    return [{"date": m, "job_count": sum(1 for j in s.jobs.values() if (j.get("publish_time") or "")[:7] == m)} for m in sorted(months)]


def get_co_occurring(skill: str, limit: int) -> List[Dict[str, Any]]:
    s = _store()
    co = s.co_occurs.get(skill, {})
    items = sorted(co.items(), key=lambda x: x[1], reverse=True)[:limit]
    return [{"skill": sk, "weight": w} for sk, w in items]


def semantic_search_jobs(query: str, top_k: int) -> List[Dict[str, Any]]:
    """无 embedding, 用关键词 LIKE。"""
    s = _store()
    q = query.lower()
    out = []
    for j in s.jobs.values():
        t = (j.get("title") or "").lower()
        desc = (j.get("job_description") or "").lower()
        score = 0
        for token in q.split():
            if token in t: score += 3
            if token in desc: score += 1
            if token in " ".join(j.get("skill_tags") or []).lower(): score += 2
        if score > 0:
            out.append((score, j))
    out.sort(reverse=True, key=lambda x: x[0])
    return [{
        "id": j["id"], "title": j.get("title"),
        "company_name": j.get("company_name"), "city": j.get("city"),
        "salary_max": j.get("salary_max"), "score": sc,
        "source": j.get("source"),
    } for sc, j in out[:top_k]]


def fallback_keyword_search(query: str, top_k: int) -> List[Dict[str, Any]]:
    return semantic_search_jobs(query, top_k)


def get_personal_recommend(user_id: int, limit: int) -> List[Dict[str, Any]]:
    s = _store()
    user = s.users.get(user_id) or {}
    user_skill_set = set((user.get("skills") or [])) | s.user_skills.get(user_id, set())
    target = (user.get("target_position") or "").lower()
    scores = []
    for jid, j in s.jobs.items():
        score = 0
        j_skills = set(j.get("skill_tags") or [])
        overlap = user_skill_set & j_skills
        score += len(overlap) * 10
        if target and target in (j.get("title") or "").lower(): score += 20
        score += (j.get("quality_score") or 0) * 5
        if score > 0:
            scores.append((score, j))
    scores.sort(reverse=True, key=lambda x: x[0])
    return [{
        "id": j["id"], "title": j.get("title"),
        "company_name": j.get("company_name"), "city": j.get("city"),
        "salary_max": j.get("salary_max"), "score": sc,
        "matched_skills": list(user_skill_set & set(j.get("skill_tags") or [])),
    } for sc, j in scores[:limit]]


def get_gap_analysis(user_id: int, job_id: int) -> Dict[str, Any]:
    s = _store()
    j = s.jobs.get(job_id)
    if not j: return {"error": "job not found"}
    user = s.users.get(user_id) or {}
    user_skills = set((user.get("skills") or [])) | s.user_skills.get(user_id, set())
    job_skills = set(j.get("skill_tags") or [])
    return {
        "job_id": job_id,
        "title": j.get("title"),
        "user_skills": sorted(user_skills),
        "job_skills": sorted(job_skills),
        "matched": sorted(user_skills & job_skills),
        "missing": sorted(job_skills - user_skills),
        "extra": sorted(user_skills - job_skills),
        "match_rate": round(len(user_skills & job_skills) / max(len(job_skills), 1), 2),
    }