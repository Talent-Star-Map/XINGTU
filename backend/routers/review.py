"""
routers/review.py — 管理员人工审核 API(2026-09-05)

端点:
    GET  /api/admin/review/tasks               — 列表(分页/筛选)
    GET  /api/admin/review/tasks/{id}          — 详情
    POST /api/admin/review/tasks/{id}/approve  — 通过
    POST /api/admin/review/tasks/{id}/reject   — 驳回(必填理由)
    PUT  /api/admin/review/tasks/{id}/modify   — 修改后通过(modified_content 覆盖)
    GET  /api/admin/review/stats               — 看板统计

鉴权:
    复用 routers/admin.py 的 require_admin(token) 依赖(role=admin)。
    前端通过 ?token=xxx 注入,与其他管理员端点一致。
"""

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from routers.admin import require_admin
from services import review_service
from services.review_service import ReviewError

router = APIRouter(prefix='/api/admin/review', tags=['admin-review'],
                   dependencies=[Depends(require_admin)])


def _err(code: str, message: str, status_code: int = 400):
    from fastapi import HTTPException
    return HTTPException(status_code=status_code,
                         detail={'success': False, 'error': {'code': code, 'message': message}})


# ════════════════════════════════════════════════════════════════
# 请求体
# ════════════════════════════════════════════════════════════════
class ReviewActionReq(BaseModel):
    """通过 / 驳回的请求体"""
    comment: str = Field('', description='审核意见(驳回必填)')


class ModifyReq(BaseModel):
    """修改后通过的请求体"""
    modified_content: dict = Field(..., description='修改后的内容(JSON 对象)')
    comment: str = Field('', description='审核意见')


# ════════════════════════════════════════════════════════════════
# 端点
# ════════════════════════════════════════════════════════════════
@router.get('/tasks')
def list_tasks(
    task_type: str | None = Query(None, description='new_job | skill_change'),
    status: str | None = Query(None, description='pending|approved|rejected|modified,逗号分隔可多选'),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    try:
        data = review_service.list_tasks(task_type, status, page, page_size)
        return {'success': True, 'data': data, 'message': 'ok'}
    except ReviewError as e:
        raise _err(e.code, e.message, e.status_code)
    except Exception as e:
        raise _err('INTERNAL', f'查询失败: {e}', 500)


@router.get('/tasks/{task_id}')
def get_task(task_id: int):
    try:
        data = review_service.get_task(task_id)
        if not data:
            raise _err('NOT_FOUND', f'任务不存在: id={task_id}', 404)
        return {'success': True, 'data': data, 'message': 'ok'}
    except ReviewError as e:
        raise _err(e.code, e.message, e.status_code)
    except Exception as e:
        raise _err('INTERNAL', f'查询失败: {e}', 500)


@router.post('/tasks/{task_id}/approve')
def approve_task(task_id: int, req: ReviewActionReq,
                 admin=Depends(require_admin)):
    try:
        reviewer_id = int(admin.get('user_id', 0)) or None
        data = review_service.approve(task_id, reviewer_id, req.comment)
        return {'success': True, 'data': data, 'message': '审核已通过'}
    except ReviewError as e:
        raise _err(e.code, e.message, e.status_code)
    except Exception as e:
        raise _err('INTERNAL', f'通过失败: {e}', 500)


@router.post('/tasks/{task_id}/reject')
def reject_task(task_id: int, req: ReviewActionReq,
                admin=Depends(require_admin)):
    try:
        reviewer_id = int(admin.get('user_id', 0)) or None
        data = review_service.reject(task_id, reviewer_id, req.comment)
        return {'success': True, 'data': data, 'message': '已驳回'}
    except ReviewError as e:
        raise _err(e.code, e.message, e.status_code)
    except Exception as e:
        raise _err('INTERNAL', f'驳回失败: {e}', 500)


@router.put('/tasks/{task_id}/modify')
def modify_task(task_id: int, req: ModifyReq,
                admin=Depends(require_admin)):
    try:
        reviewer_id = int(admin.get('user_id', 0)) or None
        data = review_service.modify_and_approve(
            task_id, req.modified_content, reviewer_id, req.comment)
        return {'success': True, 'data': data, 'message': '已修改并通过'}
    except ReviewError as e:
        raise _err(e.code, e.message, e.status_code)
    except Exception as e:
        raise _err('INTERNAL', f'修改审核失败: {e}', 500)


@router.get('/stats')
def stats():
    try:
        data = review_service.get_stats()
        return {'success': True, 'data': data, 'message': 'ok'}
    except Exception as e:
        raise _err('INTERNAL', f'统计失败: {e}', 500)