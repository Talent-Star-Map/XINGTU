"""
review_service.py — 管理员人工审核业务层(2026-09-05)

封装 MySQL review_tasks 表 + Neo4j 节点 is_approved 写入。
被 routers/review.py 调用,也供 ETL 脚本(backend/scripts/build_kg.py /
sync_kg_incremental.py)在生成新节点后调 submit_for_review 提交审核。

设计:
- 任务记录存 MySQL(可分页、可追溯、有 reviewer 字段)
- 节点属性写 Neo4j(:Job / :ChangeEvent 的 is_approved)
- approve / modify_and_approve 同时改 MySQL + Neo4j
- submit_for_review 只写 MySQL(NEO4J 写入是后续审核的副作用)
"""

from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import and_

from database import get_neo4j_driver, get_session, ReviewTask

logger = logging.getLogger(__name__)


# ────────────────────────────────────────────────────────────
# Neo4j 工具
# ────────────────────────────────────────────────────────────

def _neo4j_write(cypher: str, params: Optional[dict] = None) -> List[Dict[str, Any]]:
    driver = get_neo4j_driver()
    with driver.session() as s:
        return [dict(r) for r in s.run(cypher, **(params or {}))]


# ────────────────────────────────────────────────────────────
# ETL / sync 调用:提交新审核任务
# ────────────────────────────────────────────────────────────

def submit_for_review(
    task_type: str,
    target_kind: str,
    target_id: str,
    content: Dict[str, Any],
) -> int:
    """生成 review_tasks 记录。返回 task_id。

    - task_type: 'new_job' | 'skill_change'
    - target_kind: 'Job' | 'ChangeEvent'
    - target_id: Neo4j 节点 id(字符串)
    - content: AI 生成的内容快照(岗位 dict 或 change_event dict)
    """
    if task_type not in ('new_job', 'skill_change'):
        raise ValueError(f'unsupported task_type: {task_type}')
    session = get_session()
    try:
        row = ReviewTask(
            task_type=task_type,
            target_id=str(target_id),
            target_kind=target_kind,
            content_snapshot=content,
            status='pending',
        )
        session.add(row)
        session.commit()
        session.refresh(row)
        return int(row.id)
    except Exception as e:
        session.rollback()
        logger.exception('submit_for_review failed: target_id=%s', target_id)
        raise
    finally:
        session.close()


# ────────────────────────────────────────────────────────────
# 列表 / 详情 / 统计
# ────────────────────────────────────────────────────────────

def list_tasks(
    task_type: Optional[str] = None,
    status: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
) -> Dict[str, Any]:
    """分页查询任务列表。status 多个用逗号分隔(可选)。"""
    session = get_session()
    try:
        q = session.query(ReviewTask)
        if task_type:
            q = q.filter(ReviewTask.task_type == task_type)
        if status:
            statuses = [s.strip() for s in status.split(',') if s.strip()]
            if len(statuses) == 1:
                q = q.filter(ReviewTask.status == statuses[0])
            elif statuses:
                q = q.filter(ReviewTask.status.in_(statuses))
        total = q.count()
        rows = (q.order_by(ReviewTask.id.desc())
                  .offset(max(0, (page - 1) * page_size))
                  .limit(page_size)
                  .all())
        return {
            'total': total,
            'page': page,
            'page_size': page_size,
            'items': [_task_to_dict(r) for r in rows],
        }
    finally:
        session.close()


def get_task(task_id: int) -> Optional[Dict[str, Any]]:
    session = get_session()
    try:
        row = session.query(ReviewTask).filter(ReviewTask.id == task_id).first()
        return _task_to_dict(row) if row else None
    finally:
        session.close()


def get_stats() -> Dict[str, Any]:
    """统计面板用。"""
    session = get_session()
    try:
        def cnt(**flt) -> int:
            return session.query(ReviewTask).filter_by(**flt).count()
        return {
            'pending_new_jobs': cnt(task_type='new_job', status='pending'),
            'pending_skill_changes': cnt(task_type='skill_change', status='pending'),
            'pending_total': cnt(status='pending'),
            'approved_total': cnt(status='approved') + cnt(status='modified'),
            'rejected_total': cnt(status='rejected'),
        }
    finally:
        session.close()


# ────────────────────────────────────────────────────────────
# 审核动作
# ────────────────────────────────────────────────────────────

class ReviewError(Exception):
    """审核失败的统一业务异常(供 router 转 4xx)。"""
    def __init__(self, code: str, message: str, status_code: int = 400):
        self.code = code
        self.message = message
        self.status_code = status_code
        super().__init__(message)


def _load_pending(session, task_id: int) -> ReviewTask:
    row = session.query(ReviewTask).filter(ReviewTask.id == task_id).first()
    if not row:
        raise ReviewError('NOT_FOUND', f'审核任务不存在: id={task_id}', 404)
    if row.status != 'pending':
        raise ReviewError('CONFLICT',
                          f'任务已被处理: status={row.status}', 409)
    return row


def _apply_approval_to_neo4j(task: ReviewTask, modified: Optional[Dict[str, Any]] = None) -> None:
    """把审核通过的结果写回 Neo4j:is_approved=true + (若有)覆盖字段。"""
    target_id = task.target_id
    content = modified or task.content_snapshot
    if task.task_type == 'new_job':
        # 新岗位:is_approved=true;若 modified 则覆盖核心字段
        # (Neo4j SET 接受 dict 展开,但要保证字段名匹配)
        set_clauses = ['j.is_approved = true']
        for k in ('title', 'company_name', 'city', 'job_description',
                  'salary_min', 'salary_max', 'education', 'experience'):
            if k in content and content[k] is not None:
                set_clauses.append(f'j.{k} = ${k}')
        params = {'id': target_id, **{k: content[k] for k in content if k in (
            'title', 'company_name', 'city', 'job_description',
            'salary_min', 'salary_max', 'education', 'experience')}}
        cypher = f"MATCH (j:Job {{id: $id}}) SET {', '.join(set_clauses)} RETURN j.id AS id"
        _neo4j_write(cypher, params)
    elif task.task_type == 'skill_change':
        # 能力变更:仅标 is_approved=true(差分结果默认就生效)
        _neo4j_write(
            "MATCH (c:ChangeEvent {change_id: $id}) SET c.is_approved = true RETURN c.change_id AS id",
            {'id': target_id},
        )
    else:
        raise ReviewError('BAD_TASK_TYPE', f'未知 task_type: {task.task_type}', 400)


def approve(task_id: int, reviewer_id: int, comment: str = '') -> Dict[str, Any]:
    """通过审核。"""
    session = get_session()
    try:
        row = _load_pending(session, task_id)
        # 1) Neo4j 写入
        _apply_approval_to_neo4j(row)
        # 2) MySQL 状态更新
        row.status = 'approved'
        row.reviewer_id = reviewer_id
        row.review_comment = comment or ''
        row.reviewed_at = datetime.utcnow()
        session.commit()
        session.refresh(row)
        return _task_to_dict(row)
    except ReviewError:
        session.rollback()
        raise
    except Exception as e:
        session.rollback()
        logger.exception('approve failed: task_id=%s', task_id)
        raise ReviewError('INTERNAL', f'审核失败: {e}', 500)
    finally:
        session.close()


def reject(task_id: int, reviewer_id: int, comment: str = '') -> Dict[str, Any]:
    """驳回审核。不动 Neo4j 节点(默认未审核状态)。"""
    if not comment.strip():
        raise ReviewError('COMMENT_REQUIRED', '驳回必须填写理由', 400)
    session = get_session()
    try:
        row = _load_pending(session, task_id)
        row.status = 'rejected'
        row.reviewer_id = reviewer_id
        row.review_comment = comment
        row.reviewed_at = datetime.utcnow()
        session.commit()
        session.refresh(row)
        return _task_to_dict(row)
    except ReviewError:
        session.rollback()
        raise
    except Exception as e:
        session.rollback()
        logger.exception('reject failed: task_id=%s', task_id)
        raise ReviewError('INTERNAL', f'驳回失败: {e}', 500)
    finally:
        session.close()


def modify_and_approve(
    task_id: int,
    modified_content: Dict[str, Any],
    reviewer_id: int,
    comment: str = '',
) -> Dict[str, Any]:
    """修改后通过。modified_content 覆盖 content_snapshot 的核心字段并写回 Neo4j。"""
    if not isinstance(modified_content, dict):
        raise ReviewError('BAD_CONTENT', 'modified_content 必须是 JSON 对象', 400)
    session = get_session()
    try:
        row = _load_pending(session, task_id)
        # 1) Neo4j 写入(用 modified_content)
        _apply_approval_to_neo4j(row, modified=modified_content)
        # 2) MySQL 状态更新
        row.modified_content = modified_content
        row.status = 'modified'
        row.reviewer_id = reviewer_id
        row.review_comment = comment or ''
        row.reviewed_at = datetime.utcnow()
        session.commit()
        session.refresh(row)
        return _task_to_dict(row)
    except ReviewError:
        session.rollback()
        raise
    except Exception as e:
        session.rollback()
        logger.exception('modify_and_approve failed: task_id=%s', task_id)
        raise ReviewError('INTERNAL', f'修改审核失败: {e}', 500)
    finally:
        session.close()


# ────────────────────────────────────────────────────────────
# 序列化
# ────────────────────────────────────────────────────────────

def _task_to_dict(r: ReviewTask) -> Dict[str, Any]:
    return {
        'id': r.id,
        'task_type': r.task_type,
        'target_id': r.target_id,
        'target_kind': r.target_kind,
        'content_snapshot': r.content_snapshot,
        'modified_content': r.modified_content,
        'status': r.status,
        'reviewer_id': r.reviewer_id,
        'review_comment': r.review_comment or '',
        'created_at': r.created_at.strftime('%Y-%m-%d %H:%M:%S') if r.created_at else '',
        'reviewed_at': r.reviewed_at.strftime('%Y-%m-%d %H:%M:%S') if r.reviewed_at else None,
    }