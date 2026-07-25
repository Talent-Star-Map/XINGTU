"""管理员后台接口 — 企业/求职者/职位管理

@owner: 张东阳（管理员后台扩展）

接口分组:
    /api/admin/stats          — 概览统计
    /api/admin/jobseekers     — 求职者列表/创建/删除/重置密码
    /api/admin/enterprises    — 企业列表/创建/删除/重置密码
    /api/admin/jobs           — 职位列表/删除（关联企业名）

鉴权:
    所有接口必须携带管理员 token（role=admin），通过 require_admin 依赖统一校验。
    前端通过 ?token=xxx 注入，与 QualityDashboard 一致。
"""

import re
import bcrypt

from fastapi import APIRouter, Query, Depends, HTTPException
from pydantic import BaseModel, Field

from database import (
    get_session, verify_token,
    Jobseeker, Enterprise, Admin, Job, MatchRecord,
)


# ─── 管理员鉴权依赖 — 所有 admin 接口强制校验 token + role=admin ──────────────
def require_admin(token: str = Query(...)):
    """校验 query 参数中的 token 是否为管理员身份"""
    try:
        payload = verify_token(token)
    except ValueError as e:
        raise HTTPException(401, str(e))
    if payload.get('role') != 'admin':
        raise HTTPException(403, '需要管理员权限')
    return payload


# 路由级依赖：注册到此 router 的所有接口都自动应用 require_admin 鉴权
router = APIRouter(prefix='/api/admin', tags=['admin'], dependencies=[Depends(require_admin)])


def _err(code: str, message: str, details=None):
    """统一错误响应格式: {success:false, error:{code, message, details}}"""
    return {'success': False, 'error': {'code': code, 'message': message, 'details': details or {}}}


# ─── 密码强度校验 — 与 auth.py 注册接口保持一致 ─────────────────────────────
def _validate_password(password: str):
    """密码至少 8 位，且包含大小写字母 + 数字"""
    if len(password) < 8:
        raise HTTPException(400, '密码至少8位')
    if not re.search(r'[a-z]', password):
        raise HTTPException(400, '密码需包含小写字母')
    if not re.search(r'[A-Z]', password):
        raise HTTPException(400, '密码需包含大写字母')
    if not re.search(r'\d', password):
        raise HTTPException(400, '密码需包含数字')


def _hash_password(password: str) -> str:
    """bcrypt 加密密码"""
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


# ════════════════════════════════════════════════════════════════════════
# 概览统计
# ════════════════════════════════════════════════════════════════════════
@router.get('/stats')
def admin_stats():
    """管理员首页统计卡片：返回求职者/企业/职位/匹配记录总数"""
    session = get_session()
    try:
        return {
            'success': True,
            'data': {
                'jobseeker_count': session.query(Jobseeker).count(),
                'enterprise_count': session.query(Enterprise).count(),
                'job_count': session.query(Job).count(),
                'match_count': session.query(MatchRecord).count(),
                'admin_count': session.query(Admin).count(),
            },
            'message': 'ok',
        }
    except Exception as e:
        return _err('INTERNAL_ERROR', f'查询统计失败: {e}')
    finally:
        session.close()


# ════════════════════════════════════════════════════════════════════════
# 求职者管理
# ════════════════════════════════════════════════════════════════════════
class JobseekerCreateReq(BaseModel):
    """管理员创建求职者账号的请求体"""
    email: str = Field(..., description='登录邮箱')
    username: str = Field('', description='用户名（可选）')
    password: str = Field(..., description='初始密码，需符合强度规则')


class ResetPasswordReq(BaseModel):
    """重置密码请求体"""
    password: str = Field(..., description='新密码，需符合强度规则')


def _jobseeker_to_dict(js: Jobseeker) -> dict:
    """求职者 ORM → 前端字典"""
    return {
        'id': js.id,
        'email': js.email or '',
        'phone': js.phone or '',
        'username': js.username or '',
        'real_name': js.real_name or '',
        'target_position': js.target_position or '',
        'city': js.city or '',
        'experience': js.experience or '',
        'education': js.education or '',
        'skills': js.skills or '',
        'created_at': js.created_at.strftime('%Y-%m-%d %H:%M') if js.created_at else '',
    }


@router.get('/jobseekers')
def list_jobseekers(
    keyword: str = Query('', description='按邮箱/用户名/姓名/手机号模糊搜索'),
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1, le=100),
):
    """求职者列表（分页 + 关键字搜索）"""
    session = get_session()
    try:
        q = session.query(Jobseeker)
        if keyword:
            kw = f'%{keyword}%'
            q = q.filter(
                (Jobseeker.email.like(kw)) |
                (Jobseeker.username.like(kw)) |
                (Jobseeker.real_name.like(kw)) |
                (Jobseeker.phone.like(kw))
            )
        total = q.count()
        rows = q.order_by(Jobseeker.id.desc()).offset((page - 1) * size).limit(size).all()
        return {
            'success': True,
            'data': {
                'list': [_jobseeker_to_dict(js) for js in rows],
                'total': total, 'page': page, 'size': size,
            },
            'message': 'ok',
        }
    except Exception as e:
        return _err('INTERNAL_ERROR', f'查询求职者列表失败: {e}')
    finally:
        session.close()


@router.post('/jobseekers')
def create_jobseeker(req: JobseekerCreateReq):
    """管理员创建求职者账号（无需邮箱验证码）"""
    _validate_password(req.password)
    session = get_session()
    try:
        # 邮箱唯一性校验
        if req.email and session.query(Jobseeker).filter(Jobseeker.email == req.email).first():
            return _err('DUPLICATE_EMAIL', '该邮箱已注册')
        js = Jobseeker(
            email=req.email,
            username=req.username or req.email.split('@')[0],
            password=_hash_password(req.password),
        )
        session.add(js); session.commit(); session.refresh(js)
        return {
            'success': True,
            'data': _jobseeker_to_dict(js),
            'message': f'求职者「{js.username}」创建成功',
        }
    except Exception as e:
        session.rollback()
        return _err('CREATE_ERROR', f'创建求职者失败: {e}')
    finally:
        session.close()


@router.delete('/jobseekers/{js_id}')
def delete_jobseeker(js_id: int):
    """删除求职者 — 同时清理其匹配记录"""
    session = get_session()
    try:
        js = session.query(Jobseeker).filter(Jobseeker.id == js_id).first()
        if not js:
            return _err('NOT_FOUND', f'求职者不存在: id={js_id}')
        name = js.real_name or js.username or js.email or f'id={js_id}'
        # 先清理匹配记录外键
        session.query(MatchRecord).filter(MatchRecord.jobseeker_id == js_id).delete()
        session.delete(js); session.commit()
        return {'success': True, 'data': {'id': js_id}, 'message': f'求职者「{name}」已删除'}
    except Exception as e:
        session.rollback()
        return _err('DELETE_ERROR', f'删除求职者失败: {e}')
    finally:
        session.close()


@router.post('/jobseekers/{js_id}/reset-password')
def reset_jobseeker_password(js_id: int, req: ResetPasswordReq):
    """重置求职者密码"""
    _validate_password(req.password)
    session = get_session()
    try:
        js = session.query(Jobseeker).filter(Jobseeker.id == js_id).first()
        if not js:
            return _err('NOT_FOUND', f'求职者不存在: id={js_id}')
        js.password = _hash_password(req.password)
        session.commit()
        return {'success': True, 'message': '密码已重置'}
    except Exception as e:
        session.rollback()
        return _err('RESET_ERROR', f'重置密码失败: {e}')
    finally:
        session.close()


# ════════════════════════════════════════════════════════════════════════
# 企业管理
# ════════════════════════════════════════════════════════════════════════
class EnterpriseCreateReq(BaseModel):
    """管理员创建企业账号的请求体"""
    email: str = Field(..., description='登录邮箱')
    username: str = Field('', description='用户名（可选）')
    password: str = Field(..., description='初始密码')
    company_name: str = Field('', description='企业名称（可选，可后续补充）')


def _enterprise_to_dict(ent: Enterprise) -> dict:
    """企业 ORM → 前端字典"""
    return {
        'id': ent.id,
        'email': ent.email or '',
        'phone': ent.phone or '',
        'username': ent.username or '',
        'company_name': ent.company_name or '',
        'industry': ent.industry or '',
        'city': ent.city or '',
        'verified': ent.verified or 0,
        'created_at': ent.created_at.strftime('%Y-%m-%d %H:%M') if ent.created_at else '',
    }


@router.get('/enterprises')
def list_enterprises(
    keyword: str = Query('', description='按邮箱/用户名/公司名/手机号模糊搜索'),
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1, le=100),
):
    """企业列表（分页 + 关键字搜索）"""
    session = get_session()
    try:
        q = session.query(Enterprise)
        if keyword:
            kw = f'%{keyword}%'
            q = q.filter(
                (Enterprise.email.like(kw)) |
                (Enterprise.username.like(kw)) |
                (Enterprise.company_name.like(kw)) |
                (Enterprise.phone.like(kw))
            )
        total = q.count()
        rows = q.order_by(Enterprise.id.desc()).offset((page - 1) * size).limit(size).all()
        return {
            'success': True,
            'data': {
                'list': [_enterprise_to_dict(ent) for ent in rows],
                'total': total, 'page': page, 'size': size,
            },
            'message': 'ok',
        }
    except Exception as e:
        return _err('INTERNAL_ERROR', f'查询企业列表失败: {e}')
    finally:
        session.close()


@router.post('/enterprises')
def create_enterprise(req: EnterpriseCreateReq):
    """管理员创建企业账号"""
    _validate_password(req.password)
    session = get_session()
    try:
        if req.email and session.query(Enterprise).filter(Enterprise.email == req.email).first():
            return _err('DUPLICATE_EMAIL', '该邮箱已注册')
        ent = Enterprise(
            email=req.email,
            username=req.username or req.email.split('@')[0],
            password=_hash_password(req.password),
            company_name=req.company_name,
        )
        session.add(ent); session.commit(); session.refresh(ent)
        return {
            'success': True,
            'data': _enterprise_to_dict(ent),
            'message': f'企业「{ent.company_name or ent.username}」创建成功',
        }
    except Exception as e:
        session.rollback()
        return _err('CREATE_ERROR', f'创建企业失败: {e}')
    finally:
        session.close()


@router.delete('/enterprises/{ent_id}')
def delete_enterprise(ent_id: int):
    """删除企业 — 同时清理其发布的岗位及关联匹配记录"""
    session = get_session()
    try:
        ent = session.query(Enterprise).filter(Enterprise.id == ent_id).first()
        if not ent:
            return _err('NOT_FOUND', f'企业不存在: id={ent_id}')
        name = ent.company_name or ent.username or ent.email or f'id={ent_id}'
        # 找到该企业发布的所有岗位 id
        job_ids = [j.id for j in session.query(Job).filter(Job.enterprise_id == ent_id).all()]
        if job_ids:
            # 先清理这些岗位的匹配记录
            session.query(MatchRecord).filter(MatchRecord.job_id.in_(job_ids)).delete(synchronize_session=False)
            # 再删岗位
            session.query(Job).filter(Job.enterprise_id == ent_id).delete(synchronize_session=False)
        session.delete(ent); session.commit()
        return {'success': True, 'data': {'id': ent_id}, 'message': f'企业「{name}」及其岗位已删除'}
    except Exception as e:
        session.rollback()
        return _err('DELETE_ERROR', f'删除企业失败: {e}')
    finally:
        session.close()


@router.post('/enterprises/{ent_id}/reset-password')
def reset_enterprise_password(ent_id: int, req: ResetPasswordReq):
    """重置企业密码"""
    _validate_password(req.password)
    session = get_session()
    try:
        ent = session.query(Enterprise).filter(Enterprise.id == ent_id).first()
        if not ent:
            return _err('NOT_FOUND', f'企业不存在: id={ent_id}')
        ent.password = _hash_password(req.password)
        session.commit()
        return {'success': True, 'message': '密码已重置'}
    except Exception as e:
        session.rollback()
        return _err('RESET_ERROR', f'重置密码失败: {e}')
    finally:
        session.close()


# ════════════════════════════════════════════════════════════════════════
# 职位管理（企业端发布的岗位，即 enterprise_jobs 表）
# ════════════════════════════════════════════════════════════════════════
def _job_to_dict(j: Job, ent_name: str = '', candidates: int = 0) -> dict:
    """职位 ORM → 前端字典（带企业名和候选人数）"""
    return {
        'id': j.id,
        'enterprise_id': j.enterprise_id,
        'enterprise_name': ent_name,
        'title': j.title,
        'location': j.location or '',
        'salary_range': j.salary_range or '',
        'experience': j.experience or '',
        'education': j.education or '',
        'skills_required': j.skills_required or '',
        'status': j.status or 'active',
        'candidates': candidates,
        'created_at': j.created_at.strftime('%Y-%m-%d %H:%M') if j.created_at else '',
    }


@router.get('/jobs')
def list_jobs(
    keyword: str = Query('', description='按岗位名/技能/企业名模糊搜索'),
    status: str = Query('', description='按状态过滤: active/closed/draft'),
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1, le=100),
):
    """职位列表（分页 + 关键字 + 状态过滤，关联企业名）"""
    session = get_session()
    try:
        q = session.query(Job, Enterprise).outerjoin(Enterprise, Job.enterprise_id == Enterprise.id)
        if status:
            q = q.filter(Job.status == status)
        if keyword:
            kw = f'%{keyword}%'
            q = q.filter(
                (Job.title.like(kw)) |
                (Job.skills_required.like(kw)) |
                (Enterprise.company_name.like(kw))
            )
        total = q.count()
        rows = q.order_by(Job.id.desc()).offset((page - 1) * size).limit(size).all()

        # 一次性查出所有候选人数（避免 N+1）
        job_ids = [j.id for j, _ in rows]
        cnt_map = {}
        if job_ids:
            from sqlalchemy import func as _func
            cnt_rows = (session.query(MatchRecord.job_id, _func.count())
                        .filter(MatchRecord.job_id.in_(job_ids))
                        .group_by(MatchRecord.job_id).all())
            cnt_map = {jid: c for jid, c in cnt_rows}

        jobs = [_job_to_dict(j, ent.company_name or '', cnt_map.get(j.id, 0)) for j, ent in rows]
        return {
            'success': True,
            'data': {
                'list': jobs,
                'total': total, 'page': page, 'size': size,
            },
            'message': 'ok',
        }
    except Exception as e:
        return _err('INTERNAL_ERROR', f'查询职位列表失败: {e}')
    finally:
        session.close()


@router.delete('/jobs/{job_id}')
def delete_job(job_id: int):
    """删除职位 — 同时清理关联匹配记录"""
    session = get_session()
    try:
        job = session.query(Job).filter(Job.id == job_id).first()
        if not job:
            return _err('NOT_FOUND', f'职位不存在: id={job_id}')
        title = job.title
        session.query(MatchRecord).filter(MatchRecord.job_id == job_id).delete()
        session.delete(job); session.commit()
        return {'success': True, 'data': {'id': job_id}, 'message': f'职位「{title}」已删除'}
    except Exception as e:
        session.rollback()
        return _err('DELETE_ERROR', f'删除职位失败: {e}')
    finally:
        session.close()


# ════════════════════════════════════════════════════════════════════════
# 管理员账号管理（仅列出，便于查看；不提供创建/删除，沿用 seed_admin.sql）
# ════════════════════════════════════════════════════════════════════════
@router.get('/admins')
def list_admins():
    """管理员账号列表（只读，不返回密码）"""
    session = get_session()
    try:
        rows = session.query(Admin).order_by(Admin.id.asc()).all()
        return {
            'success': True,
            'data': {
                'list': [{
                    'id': a.id,
                    'email': a.email,
                    'username': a.username or '',
                    'created_at': a.created_at.strftime('%Y-%m-%d %H:%M') if a.created_at else '',
                } for a in rows],
            },
            'message': 'ok',
        }
    except Exception as e:
        return _err('INTERNAL_ERROR', f'查询管理员列表失败: {e}')
    finally:
        session.close()
