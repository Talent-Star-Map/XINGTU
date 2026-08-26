"""
routers/kg.py — 岗位图谱 API 层
===============================

所有接口都封装在 services/kg_service.py,这里只负责 HTTP 收发 + JWT 校验 + 响应包装。

前缀: /api/kg
响应格式: {success: bool, data: ..., message: ...}
"""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Query, Request, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from database import verify_token
from services import kg_service

router = APIRouter(prefix='/api/kg', tags=['kg'])


def _ok(data, message: str = "ok"):
    return {"success": True, "data": data, "message": message}


def _err(message: str, status: int = 400):
    return JSONResponse(status_code=status,
                         content={"success": False, "data": None, "message": message})


def _current_user_id(request: Request) -> Optional[int]:
    """优先从 query (?token=...) 取,再从 header。"""
    token = request.query_params.get("token") or request.headers.get("authorization", "").replace("Bearer ", "")
    if not token:
        return None
    try:
        payload = verify_token(token)
        return int(payload.get("user_id"))
    except Exception:
        return None


# ────────────────────────────────────────────────────────────
# 公共端点
# ────────────────────────────────────────────────────────────

@router.get("/jobs/overview")
async def jobs_overview():
    return _ok({
        **kg_service.get_overview(),
        "sources": kg_service.get_sources_overview(),
        "pending_changes": kg_service.get_pending_change_count(),
    })


@router.get("/jobs/graph")
async def jobs_graph(
    limit_jobs: int = Query(200, le=500),
    limit_skills: int = Query(80, le=200),
):
    return _ok(kg_service.get_overview_graph(limit_jobs, limit_skills))


@router.get("/jobs")
async def list_jobs(
    limit: int = Query(100, le=500),
    skip: int = Query(0),
    source: Optional[str] = Query(None),
    industry: Optional[str] = Query(None),
):
    return _ok(kg_service.get_jobs(limit, source, industry, skip))


@router.get("/jobs/{job_id}")
async def job_detail(job_id: int):
    data = kg_service.get_job_detail(job_id)
    if not data:
        raise HTTPException(404, "Job not found")
    return _ok(data)


@router.get("/jobs/{job_id}/neighbors")
async def job_neighbors(
    job_id: int,
    depth: int = Query(1, ge=1, le=2),
    limit: int = Query(50, le=200),
):
    return _ok(kg_service.get_job_neighbors(job_id, depth, limit))


@router.get("/jobs/{job_id}/evolution")
async def job_evolution(
    job_id: int,
    metric: str = Query("salary_avg"),
    from_date: Optional[str] = Query(None, alias="from"),
    to_date: Optional[str] = Query(None, alias="to"),
):
    return _ok(kg_service.get_job_evolution(job_id, metric, from_date, to_date))


@router.get("/jobs/{job_id}/changes")
async def job_changes(job_id: int):
    return _ok(kg_service.get_job_changes(job_id))


@router.get("/snapshot/at")
async def snapshot_at(
    date: str = Query(..., description="ISO date 2026-08-01"),
    limit: int = Query(100, le=300),
):
    return _ok(kg_service.get_snapshot_at(date, limit))


@router.get("/snapshot/timeline")
async def snapshot_timeline(
    from_date: Optional[str] = Query(None, alias="from"),
    to_date: Optional[str] = Query(None, alias="to"),
    bucket: str = Query("month"),
):
    return _ok(kg_service.get_timeline_anchors(from_date, to_date, bucket))


@router.get("/skills/{skill_name}/co-occurring")
async def skill_co_occurring(skill_name: str, limit: int = Query(20)):
    return _ok(kg_service.get_co_occurring(skill_name, limit))


class SemanticSearchBody(BaseModel):
    query: str
    top_k: int = 20


@router.post("/semantic-search")
async def semantic_search(body: SemanticSearchBody):
    if not body.query.strip():
        raise HTTPException(400, "query 不能为空")
    results = kg_service.semantic_search_jobs(body.query, body.top_k)
    if not results:
        # 降级:关键词
        results = kg_service.fallback_keyword_search(body.query, body.top_k)
    return _ok(results)


# ────────────────────────────────────────────────────────────
# 个性化(需要登录)
# ────────────────────────────────────────────────────────────

@router.get("/personal/recommend")
async def personal_recommend(request: Request, limit: int = Query(5)):
    uid = _current_user_id(request)
    if not uid:
        raise HTTPException(401, "未登录")
    return _ok(kg_service.get_personal_recommend(uid, limit))


@router.get("/personal/gap")
async def personal_gap(request: Request, job_id: int = Query(...)):
    uid = _current_user_id(request)
    if not uid:
        raise HTTPException(401, "未登录")
    return _ok(kg_service.get_gap_analysis(uid, job_id))


# ────────────────────────────────────────────────────────────
# 管理员
# ────────────────────────────────────────────────────────────

@router.post("/admin/rebuild")
async def admin_rebuild():
    """触发全量重建(异步,这里只放占位)。"""
    import subprocess, sys, os
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    subprocess.Popen(
        [sys.executable, "-m", "scripts.build_kg"],
        cwd=backend_dir,
        stdout=open(os.path.join(backend_dir, "logs", "build_kg.log"), "a", encoding="utf-8"),
        stderr=subprocess.STDOUT,
    )
    return _ok({"status": "started"}, "ETL 已启动,查看 logs/build_kg.log")


@router.post("/admin/sync")
async def admin_sync(since: Optional[str] = None):
    import subprocess, sys, os
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    cmd = [sys.executable, "-m", "scripts.sync_kg_incremental"]
    if since:
        cmd += ["--since", since]
    subprocess.Popen(
        cmd,
        cwd=backend_dir,
        stdout=open(os.path.join(backend_dir, "logs", "sync_kg.log"), "a", encoding="utf-8"),
        stderr=subprocess.STDOUT,
    )
    return _ok({"status": "started"}, "增量已启动")


@router.post("/admin/attribute")
async def admin_attribute(limit: int = 50):
    import subprocess, sys, os
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    subprocess.Popen(
        [sys.executable, "-m", "scripts.llm_attribute_changes", "--limit", str(limit)],
        cwd=backend_dir,
        stdout=open(os.path.join(backend_dir, "logs", "attribute.log"), "a", encoding="utf-8"),
        stderr=subprocess.STDOUT,
    )
    return _ok({"status": "started"}, f"归因已启动 (limit={limit})")