"""求职者端 AI 简历中心接口

功能分组:
    /api/resume-center/generate       — AI 生成简历（LLM 路由层）
    /api/resume-center/optimize       — AI 优化某个区块
    /api/resume-center                — 我的简历列表/创建
    /api/resume-center/{resume_id}    — 简历详情/保存/删除
    /api/resume-center/templates      — 可用模板列表
    /api/resume-center/share          — 生成分享 token
    /api/resume-center/share/{token}  — 公开分享页数据（免登录）
    /api/resume-center/{id}/export    — 导出简历 (pdf/html/docx/txt/json)
    /api/resume-center/print/{token}  — Playwright 打印用的公开数据端点

鉴权:
    resume_id 相关操作需求职者 token（?token= 注入）
    分享/打印公开接口免登录
"""

import json
import os
import time
from typing import Literal
from uuid import uuid4

from fastapi import APIRouter, Query, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

from database import (
    get_session, verify_token, get_session,
    Resume, ResumeSection, ResumeShare, ResumeTemplate,
)
from services.resume_gen import generate_resume, optimize_section
from services import print_token

router = APIRouter(prefix='/api/resume-center', tags=['resume-center'])


def _get_user_id(token: str) -> int:
    """校验求职者 token，返回 user_id"""
    try:
        payload = verify_token(token)
    except ValueError as e:
        raise HTTPException(401, str(e))
    if payload.get('role') != 'jobseeker':
        raise HTTPException(403, '需要求职者身份')
    return payload['user_id']


def _err(code: str, message: str):
    return {'success': False, 'error': {'code': code, 'message': message}}


def _resume_to_dict(session, r: Resume) -> dict:
    """简历 ORM → 前端字典（含区块）"""
    sections = session.query(ResumeSection).filter(ResumeSection.resume_id == r.id).order_by(ResumeSection.sort_order).all()
    # updated_at 优先(SQLAlchemy onupdate=func.now() 自动维护),缺失/为空时回退 created_at,
    # 给前端的默认名派生做"最近一次填写保存日期"依据(2026-09-05 简历工作台重命名功能)
    ts = r.updated_at or r.created_at
    return {
        'id': r.id,
        'title': r.title,
        'template_key': r.template_key,
        'language': r.language,
        'created_at': r.created_at.strftime('%Y-%m-%d %H:%M') if r.created_at else '',
        'updated_at': ts.strftime('%Y-%m-%d %H:%M') if ts else '',
        'sections': [{
            'id': s.id,
            'section_type': s.section_type,
            'title': s.title,
            'content': s.content,
            'sort_order': s.sort_order,
            'visible': s.visible,
        } for s in sections],
    }


# ════════════════════════════════════════════════════════════════════
# AI 生成 / 优化
# ════════════════════════════════════════════════════════════════════
class GenerateReq(BaseModel):
    job_title: str = Field(..., description='岗位名称')
    years_of_experience: int = Field(0, description='经验年限')
    skills: list[str] = Field([], description='已有技能')
    industry: str = Field('', description='行业')
    experience: str = Field('', description='工作经历描述')
    language: str = Field('zh', description='语言 zh/en')
    template_key: str = Field('classic', description='模板 key')


@router.post('/generate')
def resume_generate(req: GenerateReq, token: str = Query(...)):
    """AI 生成完整简历并保存"""
    user_id = _get_user_id(token)
    result = generate_resume({
        'job_title': req.job_title,
        'years_of_experience': req.years_of_experience,
        'skills': req.skills,
        'industry': req.industry,
        'experience': req.experience,
        'language': req.language,
    })
    if not result['success']:
        return _err('GENERATE_ERROR', result['error'])

    resume_data = result['data']['resume']
    title = f"{req.job_title or '简历'} - {'AI生成简历' if req.language != 'en' else 'AI Generated'}"

    session = get_session()
    try:
        r = Resume(user_id=user_id, title=title, template_key=req.template_key, language=req.language)
        session.add(r); session.commit(); session.refresh(r)
        for i, (stype, stitle) in enumerate([
            ('personal_info', '个人信息'), ('summary', '个人简介'),
            ('work_experience', '工作经历'), ('education', '教育背景'),
            ('skills', '技能特长'), ('projects', '项目经历'),
        ]):
            if stype in resume_data and resume_data[stype]:
                session.add(ResumeSection(
                    resume_id=r.id, section_type=stype, title=stitle,
                    content=resume_data[stype], sort_order=i,
                ))
        session.commit()
        return {'success': True, 'data': _resume_to_dict(session, r),
                'message': 'AI 简历生成成功', 'source': result['data']['source']}
    except Exception as e:
        session.rollback()
        return _err('SAVE_ERROR', f'保存简历失败: {e}')
    finally:
        session.close()


class OptimizeReq(BaseModel):
    section_type: str = Field(..., description='区块类型')
    content: dict = Field(..., description='区块内容')
    instruction: str = Field('优化措辞', description='优化要求')
    language: str = Field('zh', description='语言')


@router.post('/optimize')
def resume_optimize(req: OptimizeReq, token: str = Query(...)):
    """AI 优化某个区块"""
    _get_user_id(token)  # 仅校验登录
    result = optimize_section(req.section_type, req.content, req.instruction, req.language)
    if not result['success']:
        return _err('OPTIMIZE_ERROR', result['error'])
    return {'success': True, 'data': {'content': result['data']['content']},
            'message': '优化完成', 'source': result['data']['source']}


# ════════════════════════════════════════════════════════════════════
# 简历 CRUD
# ════════════════════════════════════════════════════════════════════
@router.get('/list')
def resume_list(token: str = Query(...)):
    """我的简历列表"""
    user_id = _get_user_id(token)
    session = get_session()
    try:
        rows = session.query(Resume).filter(Resume.user_id == user_id).order_by(Resume.id.desc()).all()
        return {'success': True, 'data': [_resume_to_dict(session, r) for r in rows], 'message': 'ok'}
    except Exception as e:
        return _err('QUERY_ERROR', f'查询简历失败: {e}')
    finally:
        session.close()


class CreateReq(BaseModel):
    title: str = Field('未命名简历', description='简历标题')
    template_key: str = Field('classic', description='模板 key')


# ─── 新建空简历时自动创建的默认区块 ─────────────────────────────────────────────
# 与前端 types/resume.ts 中的 PersonalInfoContent 等保持一致(空值即可)
_DEFAULT_SECTION_CONTENT: dict[str, dict] = {
    'personal_info': {
        'fullName': '', 'jobTitle': '', 'age': '', 'gender': '', 'politicalStatus': '',
        'ethnicity': '', 'hometown': '', 'maritalStatus': '', 'yearsOfExperience': '',
        'educationLevel': '', 'email': '', 'phone': '', 'wechat': '', 'location': '',
        'website': '', 'linkedin': '', 'github': '',
    },
    'summary': {'text': ''},
    'education': {'items': []},
    'skills': {'categories': []},
    'projects': {'items': []},
}

# 默认简历区块顺序(用户点"新建"时插入这些,与前端 RESUME_MODULE_TYPES 严格对齐,
# 但工作经历用户可自由从 0 增删,所以不放默认里)
_DEFAULT_RESUME_SECTIONS: list[tuple[str, str]] = [
    ('personal_info', '个人信息'),
    ('summary', '个人简介'),
    ('education', '教育背景'),
    ('skills', '技能特长'),
    ('projects', '项目经历'),
]


@router.post('')
def resume_create(req: CreateReq, token: str = Query(...)):
    """新建空简历 — 同时插入 5 个默认区块(个人信息/简介/教育/技能/项目)"""
    user_id = _get_user_id(token)
    session = get_session()
    try:
        r = Resume(user_id=user_id, title=req.title, template_key=req.template_key)
        session.add(r); session.commit(); session.refresh(r)
        # 自动创建默认区块,让简历编辑器侧栏"简历模块"列表非空
        for i, (stype, stitle) in enumerate(_DEFAULT_RESUME_SECTIONS):
            session.add(ResumeSection(
                resume_id=r.id, section_type=stype, title=stitle,
                content=_DEFAULT_SECTION_CONTENT.get(stype, {}),
                sort_order=i, visible=1,
            ))
        session.commit()
        return {'success': True, 'data': _resume_to_dict(session, r), 'message': '简历已创建,已初始化 5 个默认模块'}
    except Exception as e:
        session.rollback()
        return _err('CREATE_ERROR', f'创建简历失败: {e}')
    finally:
        session.close()


@router.get('/{resume_id}')
def resume_detail(resume_id: int, token: str = Query(...)):
    """简历详情"""
    user_id = _get_user_id(token)
    session = get_session()
    try:
        r = session.query(Resume).filter(Resume.id == resume_id, Resume.user_id == user_id).first()
        if not r:
            return _err('NOT_FOUND', f'简历不存在: id={resume_id}')
        return {'success': True, 'data': _resume_to_dict(session, r), 'message': 'ok'}
    except Exception as e:
        return _err('QUERY_ERROR', f'查询简历失败: {e}')
    finally:
        session.close()


class SaveSectionsReq(BaseModel):
    sections: list[dict] = Field(..., description='区块列表 [{section_type, title, content, sort_order, visible}]')
    template_key: str = Field('', description='可选，更新模板')
    title: str = Field('', description='可选，更新标题')


@router.put('/{resume_id}')
def resume_save(resume_id: int, req: SaveSectionsReq, token: str = Query(...)):
    """保存简历（更新区块 + 可选模板/标题）"""
    user_id = _get_user_id(token)
    session = get_session()
    try:
        r = session.query(Resume).filter(Resume.id == resume_id, Resume.user_id == user_id).first()
        if not r:
            return _err('NOT_FOUND', f'简历不存在: id={resume_id}')
        if req.template_key:
            r.template_key = req.template_key
        if req.title:
            r.title = req.title
        # 重建区块（简单可靠：删旧插新）
        session.query(ResumeSection).filter(ResumeSection.resume_id == resume_id).delete()
        for i, sec in enumerate(req.sections):
            session.add(ResumeSection(
                resume_id=resume_id,
                section_type=sec.get('section_type', ''),
                title=sec.get('title', ''),
                content=sec.get('content'),
                sort_order=sec.get('sort_order', i),
                visible=sec.get('visible', 1),
            ))
        session.commit()
        return {'success': True, 'data': _resume_to_dict(session, r), 'message': '简历已保存'}
    except Exception as e:
        session.rollback()
        return _err('SAVE_ERROR', f'保存简历失败: {e}')
    finally:
        session.close()


@router.delete('/{resume_id}')
def resume_delete(resume_id: int, token: str = Query(...)):
    """删除简历"""
    user_id = _get_user_id(token)
    session = get_session()
    try:
        r = session.query(Resume).filter(Resume.id == resume_id, Resume.user_id == user_id).first()
        if not r:
            return _err('NOT_FOUND', f'简历不存在: id={resume_id}')
        session.query(ResumeSection).filter(ResumeSection.resume_id == resume_id).delete()
        session.query(ResumeShare).filter(ResumeShare.resume_id == resume_id).delete()
        session.delete(r); session.commit()
        return {'success': True, 'data': {'id': resume_id}, 'message': '简历已删除'}
    except Exception as e:
        session.rollback()
        return _err('DELETE_ERROR', f'删除简历失败: {e}')
    finally:
        session.close()


# ════════════════════════════════════════════════════════════════════
# 模板列表
# ════════════════════════════════════════════════════════════════════
@router.get('/templates/list')
def template_list():
    """可用模板列表（上架的）"""
    session = get_session()
    try:
        rows = session.query(ResumeTemplate).filter(ResumeTemplate.is_active == 1).order_by(ResumeTemplate.sort_order, ResumeTemplate.id).all()
        return {
            'success': True,
            'data': [{
                'id': t.id, 'name': t.name, 'template_key': t.template_key,
                'category': t.category, 'thumbnail': t.thumbnail,
            } for t in rows],
            'message': 'ok',
        }
    except Exception as e:
        return _err('QUERY_ERROR', f'查询模板失败: {e}')
    finally:
        session.close()


# ════════════════════════════════════════════════════════════════════
# 分享
# ════════════════════════════════════════════════════════════════════
@router.post('/share/{resume_id}')
def resume_share(resume_id: int, token: str = Query(...)):
    """生成分享 token"""
    user_id = _get_user_id(token)
    session = get_session()
    try:
        r = session.query(Resume).filter(Resume.id == resume_id, Resume.user_id == user_id).first()
        if not r:
            return _err('NOT_FOUND', f'简历不存在: id={resume_id}')
        token_str = uuid4().hex[:16]
        share = ResumeShare(resume_id=resume_id, token=token_str)
        session.add(share); session.commit()
        return {'success': True, 'data': {'token': token_str}, 'message': '分享链接已生成'}
    except Exception as e:
        session.rollback()
        return _err('SHARE_ERROR', f'生成分享链接失败: {e}')
    finally:
        session.close()


@router.get('/share/{share_token}')
def resume_share_page(share_token: str):
    """公开分享页数据（免登录）"""
    session = get_session()
    try:
        share = session.query(ResumeShare).filter(ResumeShare.token == share_token).first()
        if not share:
            return _err('NOT_FOUND', '分享链接不存在或已失效')
        r = session.query(Resume).filter(Resume.id == share.resume_id).first()
        if not r:
            return _err('NOT_FOUND', '简历不存在')
        share.visit_count = (share.visit_count or 0) + 1
        session.commit()
        return {'success': True, 'data': _resume_to_dict(session, r), 'message': 'ok'}
    except Exception as e:
        return _err('QUERY_ERROR', f'读取分享失败: {e}')
    finally:
        session.close()


# ════════════════════════════════════════════════════════════════════
# 导出 (PDF / HTML / DOCX / TXT / JSON)
# ════════════════════════════════════════════════════════════════════

# 公开端点供 Playwright 抓取简历数据 — 路径在 /export/{id} 之前注册,避免被 :resume_id 吞掉
@router.get('/print/{token}', include_in_schema=False)
def resume_print_data(token: str):
    """Playwright 渲染 PDF/HTML 时调用的公开端点,一次性 token"""
    entry = print_token.consume(token)
    if not entry:
        raise HTTPException(404, '打印链接无效或已过期')
    session = get_session()
    try:
        r = session.query(Resume).filter(Resume.id == entry['resume_id']).first()
        if not r:
            raise HTTPException(404, '简历不存在或已被删除')
        return {'success': True, 'data': _resume_to_dict(session, r), 'message': 'ok'}
    finally:
        session.close()


@router.post('/{resume_id}/export')
async def resume_export(
    resume_id: int,
    format: Literal['pdf', 'html', 'docx', 'txt', 'json'] = Query(...),
    fit_one_page: bool = Query(False, description='PDF 强制一页装下'),
    token: str = Query(...),
):
    """导出简历为 5 种格式之一

    - pdf/html: 通过 Playwright 渲染前端 /print/{token} 路由
    - docx/txt/json: 服务端直接生成,无需浏览器
    """
    user_id = _get_user_id(token)
    session = get_session()
    try:
        r = session.query(Resume).filter(Resume.id == resume_id, Resume.user_id == user_id).first()
        if not r:
            raise HTTPException(404, '简历不存在或无权访问')
        resume_data = _resume_to_dict(session, r)

        ts = int(time.time())
        safe_title = (r.title or 'resume').replace('/', '_').replace('\\', '_').strip() or 'resume'
        filename_base = f"{safe_title}-{ts}"

        # ── JSON / TXT / DOCX: 服务端直接生成,无需 Playwright ──────
        if format == 'json':
            payload = json.dumps(resume_data, ensure_ascii=False, indent=2).encode('utf-8')
            return Response(
                content=payload,
                media_type='application/json',
                headers={'Content-Disposition': f'attachment; filename="{filename_base}.json"'},
            )

        if format == 'txt':
            from services.txt_export import build_txt
            payload = build_txt(resume_data)
            return Response(
                content=payload,
                media_type='text/plain; charset=utf-8',
                headers={'Content-Disposition': f'attachment; filename="{filename_base}.txt"'},
            )

        if format == 'docx':
            from services.docx_export import build_docx
            payload = build_docx(resume_data)
            return Response(
                content=payload,
                media_type='application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                headers={'Content-Disposition': f'attachment; filename="{filename_base}.docx"'},
            )

        # ── PDF / HTML: Playwright 渲染 ──────────────────────────────
        # 生成一次性 print_token,Playwright 用它抓取公开 /print/{token}
        ptok = print_token.create(resume_id=resume_id, user_id=user_id, ttl_seconds=300)
        frontend_base = os.environ.get('FRONTEND_BASE_URL', 'http://127.0.0.1:5173').rstrip('/')
        print_url = f"{frontend_base}/print/{ptok}"

        from services.resume_export import render_pdf, render_html

        if format == 'html':
            html_bytes = await render_html(print_url)
            return Response(
                content=html_bytes,
                media_type='text/html; charset=utf-8',
                headers={'Content-Disposition': f'attachment; filename="{filename_base}.html"'},
            )

        # pdf
        pdf_bytes = await render_pdf(print_url, fit_one_page=fit_one_page)
        return Response(
            content=pdf_bytes,
            media_type='application/pdf',
            headers={'Content-Disposition': f'attachment; filename="{filename_base}.pdf"'},
        )
    except HTTPException:
        raise
    except Exception as e:
        # 容错:暴露真实错误信息(对齐 JadeAI issue#85)
        msg = str(e) or '导出失败'
        if 'No Chrome' in msg or 'Chromium' in msg or 'chrome' in msg.lower():
            raise HTTPException(503, f'未检测到 Chrome/Edge 浏览器,请安装或设置 CHROMIUM_PATH 环境变量')
        if 'timeout' in msg.lower() or 'TimeoutError' in msg:
            raise HTTPException(504, 'PDF 渲染超时,请稍后重试')
        raise HTTPException(500, f'导出失败: {msg}')
    finally:
        session.close()
