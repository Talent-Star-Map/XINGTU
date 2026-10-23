"""
routers/kg.py — 岗位图谱 API 层
===============================

所有接口都封装在 services/kg_service.py,这里只负责 HTTP 收发 + JWT 校验 + 响应包装。

前缀: /api/kg
响应格式: {success: bool, data: ..., message: ...}
"""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Query, Request, HTTPException, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from database import CrawledJob, SessionLocal, verify_token, RoleDefinitionVersion
from time_util import fmt
from services import kg_service
from services.role_catalog import build_public_catalog, filter_catalog_rows
from auth_dependencies import require_admin
from auth_guard import require_jobseeker

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

@router.get('/evidence/search')
def evidence_search(q: str = Query(..., min_length=1, max_length=500),
                    as_of: Optional[str] = None, limit: int = Query(8, ge=1, le=30)):
    from services.evidence_store import load_current_evidence
    from services.evidence_graph import retrieve
    from services.temporal_graph import cutoff_iso
    try:
        cutoff=cutoff_iso(as_of)
    except (ValueError,TypeError):
        raise HTTPException(422,'时间格式无效')
    hits=retrieve(load_current_evidence(),q,cutoff,limit)
    for hit in hits:
        hit.pop('crawl_time',None)
    return _ok({'hits':hits,'as_of':cutoff,'scope_note':'仅返回已核验来源的技术岗位当前观测；不重建采集前的历史。'})


class EvidenceQuestion(BaseModel):
    question: str
    as_of: Optional[str] = None


@router.post('/evidence/answer')
def evidence_answer(payload: EvidenceQuestion, request: Request):
    if _current_user_id(request) is None:
        raise HTTPException(401,'请先登录')
    if not 1 <= len(payload.question.strip()) <= 500:
        raise HTTPException(422,'问题长度须为 1 至 500 字')
    from services.evidence_qa import answer_from_evidence
    data=evidence_search(payload.question,payload.as_of,8)['data']
    try:
        result=answer_from_evidence(payload.question,data['hits'])
    except Exception:
        raise HTTPException(503,'证据生成暂不可用，请查看原文检索结果')
    return _ok({**result,'as_of':data['as_of']})

@router.get("/jobs/overview")
async def jobs_overview():
    return _ok({
        **kg_service.get_overview(),
        "sources": kg_service.get_sources_overview(),
        "pending_changes": kg_service.get_pending_change_count(),
    })


@router.get("/catalog")
def role_catalog(include_unverified: bool = Query(False),
                 tech_stack: Optional[str] = Query(None, max_length=80),
                 level: Optional[str] = None):
    """Build a live catalog; default to postings with a traceable source URL."""
    with SessionLocal() as session:
        records = (session.query(CrawledJob.id, CrawledJob.title, CrawledJob.skill_tags,
                                 CrawledJob.company_name, CrawledJob.source,
                                 CrawledJob.source_url)
                   .filter(CrawledJob.data_type == 1, CrawledJob.title.isnot(None))
                   .order_by(CrawledJob.id.desc())
                   .all())
        rows = [dict(row._mapping) for row in records]
    try:
        filtered = filter_catalog_rows(rows, tech_stack, level)
    except ValueError:
        raise HTTPException(422, '级别参数无效')
    result = build_public_catalog(filtered, include_unverified)
    result['scope_note'] += ' 级别按标题明确表述筛选，未注明级别不推断为初级。'
    result['filters'] = {'tech_stack': tech_stack, 'level': level}
    return _ok(result)


@router.get('/roles/definition')
def role_definition(role: str = Query(..., min_length=1, max_length=100),
                    draft: bool = Query(False)):
    from services.evidence_store import load_current_evidence
    from services.role_discovery import definition_draft
    rows = [r for r in load_current_evidence() if r['scope']['role'] == role]
    if not rows:
        raise HTTPException(404, '该岗位方向暂无可核验正文')
    with SessionLocal() as session:
        published = (session.query(RoleDefinitionVersion)
                     .filter_by(role_name=role, state='published')
                     .order_by(RoleDefinitionVersion.version.desc()).first())
        if published and not draft:
            return _ok({'fields': published.fields, 'role': role,
                        'version': published.version, 'published_at': fmt(published.created_at),
                        'reviewer_id': published.reviewer_id,
                        'scope': '人工审核发布的岗位定义；引用可返回原始招聘'})
    return _ok({**definition_draft(rows), 'role': role, 'evidence_postings': len(rows),
                'scope': '当前岗位样本的定义草稿，不表示发现了新职业'})


class RoleDefinitionRevision(BaseModel):
    fields: dict
    publish: bool = False
    review_note: str = ''


@router.get('/admin/roles/{role}/evidence')
def role_definition_sources(role: str, request: Request):
    token = request.query_params.get('token') or request.headers.get('authorization', '').removeprefix('Bearer ')
    try:
        admin = verify_token(token) if token else {}
    except ValueError:
        raise HTTPException(401, '管理员认证失败')
    if admin.get('role') != 'admin':
        raise HTTPException(403, '需要管理员权限')
    from services.evidence_store import load_current_evidence
    rows = [r for r in load_current_evidence() if r['scope']['role'] == role]
    return _ok([{'snapshot_id': r['snapshot_id'], 'title': r['title'],
                 'source_url': r['source_url'], 'captured_at': r['captured_at'],
                 'job_description': str(r['job_description'])[:6000]}
                for r in rows[:100]])


@router.post('/admin/roles/{role}/versions')
def save_role_definition(role: str, body: RoleDefinitionRevision, request: Request):
    token = request.query_params.get('token') or request.headers.get('authorization', '').removeprefix('Bearer ')
    try:
        admin = verify_token(token) if token else {}
    except ValueError:
        raise HTTPException(401, '管理员认证失败')
    if admin.get('role') != 'admin':
        raise HTTPException(403, '需要管理员权限')
    if not 1 <= len(role) <= 100 or len(body.review_note) > 2000:
        raise HTTPException(422, '岗位名称或审核说明长度无效')
    from services.evidence_store import load_current_evidence
    from services.role_definition_review import validate_version
    evidence = [r for r in load_current_evidence() if r['scope']['role'] == role]
    if not evidence:
        raise HTTPException(404, '该岗位方向暂无可核验正文')
    try:
        fields = validate_version(body.fields, evidence, body.publish)
    except ValueError as exc:
        raise HTTPException(422, str(exc))
    with SessionLocal() as session:
        last = (session.query(RoleDefinitionVersion)
                .filter_by(role_name=role)
                .order_by(RoleDefinitionVersion.version.desc()).first())
        version = last.version + 1 if last else 1
        item = RoleDefinitionVersion(role_name=role, version=version, fields=fields,
                    state='published' if body.publish else 'draft',
                    reviewer_id=int(admin['user_id']), review_note=body.review_note)
        session.add(item)
        try:
            session.commit()
        except Exception:
            session.rollback()
            raise HTTPException(409, '版本冲突，请刷新后重试')
        session.refresh(item)
        return _ok({'role': role, 'version': version, 'state': item.state,
                    'created_at': fmt(item.created_at)})


@router.get('/admin/roles/{role}/versions')
def role_definition_history(role: str, request: Request):
    token = request.query_params.get('token') or request.headers.get('authorization', '').removeprefix('Bearer ')
    try:
        admin = verify_token(token) if token else {}
    except ValueError:
        raise HTTPException(401, '管理员认证失败')
    if admin.get('role') != 'admin':
        raise HTTPException(403, '需要管理员权限')
    with SessionLocal() as session:
        versions = (session.query(RoleDefinitionVersion).filter_by(role_name=role)
                    .order_by(RoleDefinitionVersion.version.desc()).limit(100).all())
        return _ok([{'version': v.version, 'state': v.state, 'fields': v.fields,
                     'reviewer_id': v.reviewer_id, 'review_note': v.review_note,
                     'created_at': fmt(v.created_at)} for v in versions])


@router.get("/jobs/graph")
async def jobs_graph(
    limit_jobs: int = Query(200, le=500),
    limit_skills: int = Query(120, le=300),
    tech_stack: Optional[str] = Query(None, description="技术栈: java/python/frontend/backend/ai/bigdata/test/devops/mobile/product/design"),
    level: Optional[str] = Query(None, description="级别: entry/junior/mid/senior/lead"),
    mode: str = Query("cluster", description="cluster=按 Cluster 聚合(消歧对齐),raw=原始 Job 节点"),
):
    """岗位图谱。

    默认 mode=cluster:同一 canonical_name 的 Job 折叠为 1 个 Cluster 节点,
    避免「Java」/「Java工程师」/「java开发工程师」这种变体铺满画布。

    mode=raw:返回所有 Job 节点(用于调试)。
    """
    if mode == 'raw':
        return _ok(kg_service.get_overview_graph(limit_jobs, limit_skills, tech_stack, level))
    return _ok(kg_service.get_cluster_graph(limit_jobs, limit_skills, tech_stack, level))


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
    as_of: Optional[str] = None


@router.post("/semantic-search")
async def semantic_search(body: SemanticSearchBody):
    if not body.query.strip():
        raise HTTPException(400, "query 不能为空")
    try:
        results = kg_service.semantic_search_jobs(body.query, body.top_k, body.as_of)
    except ValueError:
        raise HTTPException(400, "as_of must be an ISO 8601 date/time")
    if not results:
        # 降级:关键词
        results = kg_service.fallback_keyword_search(body.query, body.top_k, body.as_of)
    return _ok(results)


# ────────────────────────────────────────────────────────────
# 个性化(需要登录)
# ────────────────────────────────────────────────────────────

@router.get('/personal/graph')
def personal_graph(me: dict = Depends(require_jobseeker)):
    """Current user's latest resume/profile only; no schema or data writes."""
    from services.personal_graph import load_personal_graph
    with SessionLocal() as session:
        graph = load_personal_graph(session, me['user_id'])
    if graph is None:
        raise HTTPException(404, '用户资料不存在')
    return _ok(graph)


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

@router.post("/admin/rebuild", dependencies=[Depends(require_admin)])
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


@router.post("/admin/sync", dependencies=[Depends(require_admin)])
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


@router.post("/admin/attribute", dependencies=[Depends(require_admin)])
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
