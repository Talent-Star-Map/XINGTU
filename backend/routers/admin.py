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
    Jobseeker, Enterprise, Admin, Job, MatchRecord, SkillResource, LlmConfig,
)
from services.learning_path import invalidate_cache as _invalidate_resource_cache
from services.llm import (
    CONFIG_KEYS, LLMTier, get_config, is_mock_mode, is_global_enabled,
    invalidate_config_cache, test_connection,
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


def _like_escape(s: str) -> str:
    """转义 LIKE 通配符，防止 % _ 注入"""
    return s.replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_')


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
            kw = f'%{_like_escape(keyword)}%'
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
            kw = f'%{_like_escape(keyword)}%'
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
            kw = f'%{_like_escape(keyword)}%'
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


# ════════════════════════════════════════════════════════════════════════
# 学习资源管理（skill_resources 表）
# ════════════════════════════════════════════════════════════════════════
class ResourceCreateReq(BaseModel):
    """创建/更新学习资源的请求体"""
    skill_name: str = Field(..., description='技能名称，如 Python')
    resource_type: str = Field('文档', description='类型：文档/教程/视频/课程/搜索')
    title: str = Field(..., description='资源标题')
    url: str = Field(..., description='资源链接（必须 http/https 开头）')
    sort_order: int = Field(0, description='排序权重（越小越靠前）')

    def validate_url(self):
        if not self.url.startswith(('http://', 'https://')):
            raise ValueError('URL 必须以 http:// 或 https:// 开头')
        return self


def _resource_to_dict(r: SkillResource) -> dict:
    """资源 ORM → 前端字典"""
    return {
        'id': r.id,
        'skill_name': r.skill_name,
        'resource_type': r.resource_type or '文档',
        'title': r.title,
        'url': r.url,
        'sort_order': r.sort_order or 0,
        'created_at': r.created_at.strftime('%Y-%m-%d %H:%M') if r.created_at else '',
    }


@router.get('/resources')
def list_resources(
    skill: str = Query('', description='按技能名称筛选'),
    keyword: str = Query('', description='按标题/URL 模糊搜索'),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=200),
):
    """学习资源列表（分页 + 筛选）"""
    session = get_session()
    try:
        q = session.query(SkillResource)
        if skill:
            q = q.filter(SkillResource.skill_name == skill)
        if keyword:
            kw = f'%{_like_escape(keyword)}%'
            q = q.filter(
                (SkillResource.title.like(kw)) | (SkillResource.url.like(kw))
            )
        total = q.count()
        rows = q.order_by(SkillResource.skill_name, SkillResource.sort_order).offset((page - 1) * size).limit(size).all()
        return {
            'success': True,
            'data': {
                'list': [_resource_to_dict(r) for r in rows],
                'total': total, 'page': page, 'size': size,
            },
            'message': 'ok',
        }
    except Exception as e:
        return _err('INTERNAL_ERROR', f'查询资源列表失败: {e}')
    finally:
        session.close()


@router.get('/resources/skills')
def list_resource_skills():
    """返回所有有资源的技能名称列表（用于筛选下拉）"""
    session = get_session()
    try:
        rows = session.query(SkillResource.skill_name).distinct().order_by(SkillResource.skill_name).all()
        return {
            'success': True,
            'data': [r[0] for r in rows],
            'message': 'ok',
        }
    except Exception as e:
        return _err('INTERNAL_ERROR', f'查询技能列表失败: {e}')
    finally:
        session.close()


@router.post('/resources')
def create_resource(req: ResourceCreateReq):
    """新增学习资源"""
    session = get_session()
    try:
        r = SkillResource(
            skill_name=req.skill_name.strip(),
            resource_type=req.resource_type,
            title=req.title,
            url=req.url,
            sort_order=req.sort_order,
        )
        session.add(r); session.commit(); session.refresh(r)
        _invalidate_resource_cache()
        return {
            'success': True,
            'data': _resource_to_dict(r),
            'message': f'资源「{r.title}」创建成功',
        }
    except Exception as e:
        session.rollback()
        return _err('CREATE_ERROR', f'创建资源失败: {e}')
    finally:
        session.close()


@router.put('/resources/{res_id}')
def update_resource(res_id: int, req: ResourceCreateReq):
    """更新学习资源"""
    session = get_session()
    try:
        r = session.query(SkillResource).filter(SkillResource.id == res_id).first()
        if not r:
            return _err('NOT_FOUND', f'资源不存在: id={res_id}')
        r.skill_name = req.skill_name.strip()
        r.resource_type = req.resource_type
        r.title = req.title
        r.url = req.url
        r.sort_order = req.sort_order
        session.commit(); session.refresh(r)
        _invalidate_resource_cache()
        return {
            'success': True,
            'data': _resource_to_dict(r),
            'message': f'资源「{r.title}」更新成功',
        }
    except Exception as e:
        session.rollback()
        return _err('UPDATE_ERROR', f'更新资源失败: {e}')
    finally:
        session.close()


@router.delete('/resources/{res_id}')
def delete_resource(res_id: int):
    """删除学习资源"""
    session = get_session()
    try:
        r = session.query(SkillResource).filter(SkillResource.id == res_id).first()
        if not r:
            return _err('NOT_FOUND', f'资源不存在: id={res_id}')
        title = r.title
        session.delete(r); session.commit()
        _invalidate_resource_cache()
        return {'success': True, 'data': {'id': res_id}, 'message': f'资源「{title}」已删除'}
    except Exception as e:
        session.rollback()
        return _err('DELETE_ERROR', f'删除资源失败: {e}')
    finally:
        session.close()


@router.post('/resources/batch')
def batch_import_resources(items: list[ResourceCreateReq]):
    """批量导入学习资源（用于初始数据迁移，上限 200 条）"""
    if len(items) > 200:
        return _err('BATCH_TOO_LARGE', '单次批量导入上限 200 条')
    session = get_session()
    try:
        created = 0
        for item in items:
            r = SkillResource(
                skill_name=item.skill_name.strip(),
                resource_type=item.resource_type,
                title=item.title,
                url=item.url,
                sort_order=item.sort_order,
            )
            session.add(r)
            created += 1
        session.commit()
        _invalidate_resource_cache()
        return {
            'success': True,
            'data': {'count': created},
            'message': f'成功导入 {created} 条资源',
        }
    except Exception as e:
        session.rollback()
        return _err('BATCH_ERROR', f'批量导入失败: {e}')
    finally:
        session.close()


# ════════════════════════════════════════════════════════════════════════
# 模型配置管理（LLM 路由层配置 — 管理员可视化配置模型）
# ════════════════════════════════════════════════════════════════════════

# 允许写入的配置项白名单（同 services.llm.CONFIG_KEYS）
_LLM_CONFIG_KEYS = set(CONFIG_KEYS)


def _mask_key(value: str) -> str:
    """API Key 掩码：sk-abc12345 → sk-***45，不回显明文"""
    if not value:
        return ''
    if len(value) <= 8:
        return '*' * 4
    return value[:4] + '***' + value[-4:]


class LlmConfigReq(BaseModel):
    """保存模型配置的请求体：{config_key: value} 字典，只接受白名单 key"""
    configs: dict = Field(..., description='模型配置键值对')


class LlmTestReq(BaseModel):
    """测试模型连通性的请求体"""
    tier: str = Field('strong', description='测试档次: strong/fast/vision')


@router.get('/llm-config')
def get_llm_config():
    """读取模型配置（API Key 掩码返回，不回显明文）"""
    session = get_session()
    try:
        cfg = {}
        for key in CONFIG_KEYS:
            cfg[key] = get_config(key, '')
        # 掩码 api_key（只显示首尾）
        for key in list(cfg):
            if key.endswith('api_key') and cfg[key]:
                cfg[key] = _mask_key(cfg[key])
        return {
            'success': True,
            'data': {
                'configs': cfg,
                'mock_mode': is_mock_mode(),
                'global_enabled': is_global_enabled(),
                'resolved': {
                    # 当前实际生效的模型（含 env/默认回退），供前端展示
                    'strong': {
                        'provider': get_config('strong_provider', 'openai-compatible'),
                        'model': get_config('strong_model', ''),
                        'base_url': get_config('strong_base_url', ''),
                    },
                    'fast': {
                        'provider': get_config('fast_provider', 'openai-compatible'),
                        'model': get_config('fast_model', ''),
                        'base_url': get_config('fast_base_url', ''),
                    },
                    'vision': {
                        'provider': get_config('vision_provider', ''),
                        'model': get_config('vision_model', ''),
                        'base_url': get_config('vision_base_url', ''),
                    },
                },
            },
            'message': 'ok',
        }
    except Exception as e:
        return _err('INTERNAL_ERROR', f'读取模型配置失败: {e}')
    finally:
        session.close()


@router.post('/llm-config')
def save_llm_config(req: LlmConfigReq):
    """保存模型配置（upsert 到 llm_configs 表）"""
    # 校验只接受白名单 key
    invalid = [k for k in req.configs if k not in _LLM_CONFIG_KEYS]
    if invalid:
        return _err('INVALID_KEY', f'不允许的配置项: {", ".join(invalid)}')
    session = get_session()
    try:
        for key, value in req.configs.items():
            row = session.query(LlmConfig).filter(LlmConfig.config_key == key).first()
            v = str(value).strip()
            if row:
                if v == '':
                    # 空值 = 删除该配置（回退到 .env / 默认）
                    session.delete(row)
                else:
                    row.config_value = v
            elif v != '':
                session.add(LlmConfig(config_key=key, config_value=v))
        session.commit()
        # 立即刷新路由层缓存
        invalidate_config_cache()
        return {
            'success': True,
            'message': '模型配置已保存（约 30 秒内全站生效）',
        }
    except Exception as e:
        session.rollback()
        return _err('SAVE_ERROR', f'保存模型配置失败: {e}')
    finally:
        session.close()


@router.post('/llm-config/test')
def test_llm_config(req: LlmTestReq):
    """测试模型连通性（发一条真实请求验证当前配置）"""
    tier_map = {'strong': LLMTier.STRONG, 'fast': LLMTier.FAST, 'vision': LLMTier.VISION}
    tier = tier_map.get(req.tier)
    if not tier:
        return _err('INVALID_TIER', f'不支持的测试档次: {req.tier}，可选 strong/fast/vision')
    try:
        result = test_connection(tier)
        if result.get('success'):
            return {'success': True, 'data': result, 'message': '连接测试成功'}
        return _err('TEST_FAILED', result.get('message', '连接失败'), {'detail': result})
    except Exception as e:
        return _err('TEST_ERROR', f'测试连接异常: {e}')
