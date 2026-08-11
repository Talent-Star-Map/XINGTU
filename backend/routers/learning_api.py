"""
学习数据 API — 技能掌握 / 诊断历史 / 学习进度

GET  /api/learning/skills      ← 获取用户已掌握技能
POST /api/learning/skills      ← 标记/取消技能掌握
GET  /api/learning/history     ← 获取诊断历史
POST /api/learning/history     ← 新增诊断历史
GET  /api/learning/progress    ← 获取学习进度
POST /api/learning/progress    ← 更新学习进度
"""

from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import json

from database import get_session, get_user_model_by_role, verify_token
from sqlalchemy import text

router = APIRouter(prefix='/api/learning', tags=['learning'])


def _get_uid(token: str) -> tuple[int, str]:
    """验证 token，返回 (user_id, role)"""
    try:
        payload = verify_token(token)
    except ValueError as e:
        raise HTTPException(401, str(e))
    return payload['user_id'], payload.get('role', 'jobseeker')


# ─── 技能掌握 ────────────────────────────────────

class SkillReq(BaseModel):
    skill_name: str
    job_id: Optional[int] = None
    mastered: bool = True


@router.get('/skills')
def get_skills(token: str = Query(...), job_id: Optional[int] = Query(None)):
    uid, role = _get_uid(token)
    session = get_session()
    try:
        query = 'SELECT id, skill_name, mastered, mastered_at FROM user_skills WHERE user_id = :uid'
        params = {'uid': uid}
        if job_id is not None:
            query += ' AND (job_id = :jid OR job_id IS NULL)'
            params['jid'] = job_id
        result = session.execute(text(query), params)
        rows = result.fetchall()
        return {
            'success': True,
            'data': [{
                'id': r[0], 'skill_name': r[1],
                'mastered': bool(r[2]), 'mastered_at': str(r[3]) if r[3] else None
            } for r in rows]
        }
    finally:
        session.close()


@router.post('/skills')
def toggle_skill(req: SkillReq, token: str = Query(...)):
    uid, role = _get_uid(token)
    session = get_session()
    try:
        # 检查是否已存在
        result = session.execute(
            text('SELECT id, mastered FROM user_skills WHERE user_id = :uid AND skill_name = :skill AND (job_id = :jid OR job_id IS NULL)'),
            {'uid': uid, 'skill': req.skill_name, 'jid': req.job_id}
        )
        row = result.fetchone()

        if row:
            # 已存在，更新状态
            if req.mastered:
                session.execute(
                    text('UPDATE user_skills SET mastered = 1, mastered_at = NOW() WHERE id = :id'),
                    {'id': row[0]}
                )
            else:
                session.execute(
                    text('UPDATE user_skills SET mastered = 0, mastered_at = NULL WHERE id = :id'),
                    {'id': row[0]}
                )
        else:
            # 新增
            if req.mastered:
                session.execute(
                    text('INSERT INTO user_skills (user_id, job_id, skill_name, mastered, mastered_at) VALUES (:uid, :jid, :skill, :m, NOW())'),
                    {'uid': uid, 'jid': req.job_id, 'skill': req.skill_name, 'm': 1}
                )
            else:
                session.execute(
                    text('INSERT INTO user_skills (user_id, job_id, skill_name, mastered, mastered_at) VALUES (:uid, :jid, :skill, :m, NULL)'),
                    {'uid': uid, 'jid': req.job_id, 'skill': req.skill_name, 'm': 0}
                )
        session.commit()
        return {'success': True, 'message': '已更新'}
    except Exception as e:
        session.rollback()
        raise HTTPException(500, str(e))
    finally:
        session.close()


# ─── 诊断历史 ────────────────────────────────────

class HistoryReq(BaseModel):
    job_id: int
    job_title: str = ''
    job_company: str = ''
    job_location: str = ''
    job_salary: str = ''
    overall: float = 0
    grade: str = ''
    have_count: int = 0
    miss_count: int = 0
    skills: Optional[dict] = None
    phases: Optional[list] = None
    recommendations: Optional[list] = None


@router.get('/history')
def get_history(token: str = Query(...), limit: int = Query(20)):
    uid, role = _get_uid(token)
    session = get_session()
    try:
        result = session.execute(
            text('SELECT id, job_id, job_title, job_company, job_location, job_salary, '
                 'overall, grade, have_count, miss_count, skills, phases, recommendations, created_at '
                 'FROM diagnosis_history WHERE user_id = :uid ORDER BY created_at DESC LIMIT :limit'),
            {'uid': uid, 'limit': limit}
        )
        rows = result.fetchall()
        data = []
        for r in rows:
            skills_val = json.loads(r[10]) if r[10] else {'have': [], 'miss': [], 'extra': []}
            phases_val = json.loads(r[11]) if r[11] else []
            recs_val = json.loads(r[12]) if r[12] else []
            data.append({
                'id': r[0], 'job_id': r[1], 'job_title': r[2], 'job_company': r[3],
                'job_location': r[4], 'job_salary': r[5], 'overall': float(r[6]),
                'grade': r[7], 'have_count': r[8], 'miss_count': r[9],
                'skills': skills_val, 'phases': phases_val,
                'recommendations': recs_val, 'created_at': str(r[13]) if r[13] else ''
            })
        return {'success': True, 'data': data}
    finally:
        session.close()


@router.post('/history')
def add_history(req: HistoryReq, token: str = Query(...)):
    uid, role = _get_uid(token)
    session = get_session()
    try:
        session.execute(
            text('INSERT INTO diagnosis_history '
                 '(user_id, job_id, job_title, job_company, job_location, job_salary, '
                 'overall, grade, have_count, miss_count, skills, phases, recommendations) '
                 'VALUES (:uid, :jid, :title, :company, :loc, :salary, '
                 ':overall, :grade, :have, :miss, :skills, :phases, :recs)'),
            {
                'uid': uid, 'jid': req.job_id, 'title': req.job_title,
                'company': req.job_company, 'loc': req.job_location, 'salary': req.job_salary,
                'overall': req.overall, 'grade': req.grade,
                'have': req.have_count, 'miss': req.miss_count,
                'skills': json.dumps(req.skills or {}, ensure_ascii=False),
                'phases': json.dumps(req.phases or [], ensure_ascii=False),
                'recs': json.dumps(req.recommendations or [], ensure_ascii=False),
            }
        )
        session.commit()
        return {'success': True, 'message': '已保存'}
    except Exception as e:
        session.rollback()
        raise HTTPException(500, str(e))
    finally:
        session.close()


# ─── 学习进度 ────────────────────────────────────

class ProgressReq(BaseModel):
    job_id: int
    skill_name: str
    status: str = 'pending'  # pending / learning / mastered
    study_minutes: int = 0


@router.get('/progress')
def get_progress(token: str = Query(...), job_id: Optional[int] = Query(None)):
    uid, role = _get_uid(token)
    session = get_session()
    try:
        query = 'SELECT id, job_id, skill_name, status, started_at, mastered_at, study_minutes FROM learning_progress WHERE user_id = :uid'
        params = {'uid': uid}
        if job_id is not None:
            query += ' AND job_id = :jid'
            params['jid'] = job_id
        result = session.execute(text(query), params)
        rows = result.fetchall()
        return {
            'success': True,
            'data': [{
                'id': r[0], 'job_id': r[1], 'skill_name': r[2], 'status': r[3],
                'started_at': str(r[4]) if r[4] else None,
                'mastered_at': str(r[5]) if r[5] else None,
                'study_minutes': r[6]
            } for r in rows]
        }
    finally:
        session.close()


@router.post('/progress')
def update_progress(req: ProgressReq, token: str = Query(...)):
    uid, role = _get_uid(token)
    session = get_session()
    try:
        # upsert
        result = session.execute(
            text('SELECT id FROM learning_progress WHERE user_id = :uid AND job_id = :jid AND skill_name = :skill'),
            {'uid': uid, 'jid': req.job_id, 'skill': req.skill_name}
        )
        row = result.fetchone()

        if req.status == 'mastered':
            if row:
                session.execute(
                    text('UPDATE learning_progress SET status = :s, mastered_at = NOW(), study_minutes = study_minutes + :mins WHERE id = :id'),
                    {'s': req.status, 'mins': req.study_minutes, 'id': row[0]}
                )
            else:
                session.execute(
                    text('INSERT INTO learning_progress (user_id, job_id, skill_name, status, mastered_at, study_minutes) '
                         'VALUES (:uid, :jid, :skill, :s, NOW(), :mins)'),
                    {'uid': uid, 'jid': req.job_id, 'skill': req.skill_name, 's': req.status, 'mins': req.study_minutes}
                )
        elif req.status == 'learning':
            if row:
                session.execute(
                    text('UPDATE learning_progress SET status = :s, study_minutes = study_minutes + :mins WHERE id = :id'),
                    {'s': req.status, 'mins': req.study_minutes, 'id': row[0]}
                )
            else:
                session.execute(
                    text('INSERT INTO learning_progress (user_id, job_id, skill_name, status, started_at, study_minutes) '
                         'VALUES (:uid, :jid, :skill, :s, NOW(), :mins)'),
                    {'uid': uid, 'jid': req.job_id, 'skill': req.skill_name, 's': req.status, 'mins': req.study_minutes}
                )
        else:  # pending
            if row:
                session.execute(
                    text('UPDATE learning_progress SET status = :s WHERE id = :id'),
                    {'s': req.status, 'id': row[0]}
                )
            else:
                session.execute(
                    text('INSERT INTO learning_progress (user_id, job_id, skill_name, status) VALUES (:uid, :jid, :skill, :s)'),
                    {'uid': uid, 'jid': req.job_id, 'skill': req.skill_name, 's': req.status}
                )

        session.commit()
        return {'success': True, 'message': '已更新'}
    except Exception as e:
        session.rollback()
        raise HTTPException(500, str(e))
    finally:
        session.close()
