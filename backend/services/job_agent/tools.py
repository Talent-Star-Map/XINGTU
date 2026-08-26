"""
job_agent/tools.py — 7 个工具,Planner 输出的 tool 名直接对应函数名。
"""

from __future__ import annotations

from typing import Any, Dict, Optional

from services import kg_service


# ────────────────────────────────────────────────────────────
# 工具集 — 每个函数都接 (args, user_id) → 返回 dict 或 str
# ────────────────────────────────────────────────────────────

async def semantic_search(args: Dict[str, Any], user_id: Optional[int] = None) -> Any:
    q = args.get("query", "")
    k = int(args.get("top_k", 10))
    results = kg_service.semantic_search_jobs(q, k)
    if not results:
        results = kg_service.fallback_keyword_search(q, k)
    return results


async def keyword_search(args: Dict[str, Any], user_id: Optional[int] = None) -> Any:
    q = args.get("query", "")
    k = int(args.get("top_k", 10))
    return kg_service.fallback_keyword_search(q, k)


async def get_job_details(args: Dict[str, Any], user_id: Optional[int] = None) -> Any:
    jid = int(args.get("job_id", 0))
    detail = kg_service.get_job_detail(jid)
    if not detail:
        return f"找不到 job_id={jid} 的岗位"
    return detail


async def get_job_evolution(args: Dict[str, Any], user_id: Optional[int] = None) -> Any:
    jid = int(args.get("job_id", 0))
    metric = args.get("metric", "salary_avg")
    from_d = args.get("from")
    to_d = args.get("to")
    series = kg_service.get_job_evolution(jid, metric, from_d, to_d)
    return {"metric": metric, "series": series}


async def get_job_changes(args: Dict[str, Any], user_id: Optional[int] = None) -> Any:
    jid = int(args.get("job_id", 0))
    return kg_service.get_job_changes(jid)


async def get_skill_co_occurrence(args: Dict[str, Any], user_id: Optional[int] = None) -> Any:
    sk = args.get("skill", "")
    limit = int(args.get("limit", 20))
    return kg_service.get_co_occurring(sk, limit)


async def get_user_profile(args: Dict[str, Any], user_id: Optional[int] = None) -> Any:
    """取用户技能 + target_position;如果未登录则返回 None。"""
    if not user_id:
        return {"logged_in": False}
    # 简单从 MySQL 取
    from database import SessionLocal, Jobseeker
    s = SessionLocal()
    try:
        u = s.query(Jobseeker).filter(Jobseeker.id == user_id).first()
        if not u:
            return {"logged_in": False}
        return {
            "logged_in": True,
            "id": u.id,
            "username": u.username,
            "target_position": u.target_position or "",
            "skills": [x.strip() for x in (u.skills or "").split(",") if x.strip()],
            "experience": u.experience or "",
            "education": u.education or "",
        }
    finally:
        s.close()


async def get_gap_analysis(args: Dict[str, Any], user_id: Optional[int] = None) -> Any:
    if not user_id:
        return {"logged_in": False}
    jid = int(args.get("job_id", 0))
    return kg_service.get_gap_analysis(user_id, jid)


async def get_personal_recommend(args: Dict[str, Any], user_id: Optional[int] = None) -> Any:
    if not user_id:
        return {"logged_in": False}
    limit = int(args.get("limit", 5))
    return kg_service.get_personal_recommend(user_id, limit)


async def get_overview(args: Dict[str, Any], user_id: Optional[int] = None) -> Any:
    return kg_service.get_overview()


async def snapshot_at(args: Dict[str, Any], user_id: Optional[int] = None) -> Any:
    date = args.get("date", "2026-08-01")
    limit = int(args.get("limit", 100))
    return kg_service.get_snapshot_at(date, limit)


async def timeline_anchors(args: Dict[str, Any], user_id: Optional[int] = None) -> Any:
    from_d = args.get("from")
    to_d = args.get("to")
    bucket = args.get("bucket", "month")
    return kg_service.get_timeline_anchors(from_d, to_d, bucket)


# ────────────────────────────────────────────────────────────
# 工具注册表
# ────────────────────────────────────────────────────────────

TOOLS = {
    "semantic_search":         semantic_search,
    "keyword_search":          keyword_search,
    "get_job_details":         get_job_details,
    "get_job_evolution":       get_job_evolution,
    "get_job_changes":         get_job_changes,
    "get_skill_co_occurrence": get_skill_co_occurrence,
    "get_user_profile":        get_user_profile,
    "get_gap_analysis":        get_gap_analysis,
    "get_personal_recommend":  get_personal_recommend,
    "get_overview":            get_overview,
    "snapshot_at":             snapshot_at,
    "timeline_anchors":        timeline_anchors,
}


def list_tools() -> list:
    """给前端展示工具能力清单。"""
    from .core import TASK_TYPES
    return [{"name": k, "description": v} for k, v in TASK_TYPES.items()]