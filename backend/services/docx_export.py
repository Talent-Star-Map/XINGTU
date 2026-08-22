"""简历 → DOCX 导出

用 python-docx(已在 requirements.txt)构造 Word 文档,A4 + 窄边距,逐 section 渲染。

设计要点:
- 与前端 11 个 section type 对齐(personal_info/summary/work_experience/education/skills/
  projects/certifications/languages/custom/qr_codes/github)
- 复用 frontend/src/components/resume/preview/templates/classic.tsx 的渲染思路
- 简单排版,不追求花哨 — Word 文档重点是"可编辑",不是"高保真"
- 头像/data URL 不进 DOCX(Word 处理 base64 图片容易出错)

@owner: XINGTU 团队(AI 简历中心)
"""

import io
from typing import Any

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Mm, Pt


def build_docx(resume: dict[str, Any]) -> bytes:
    """把简历字典转成 DOCX 二进制

    Args:
        resume: 与 GET /api/resume-center/{id} 返回 data 结构一致
                {id, title, template_key, language, sections: [...]}
    Returns:
        .docx 文件的字节内容
    """
    doc = Document()

    # ── A4 页面 + 窄边距 ────────────────────────────────────────────────
    for section in doc.sections:
        section.page_height = Mm(297)
        section.page_width = Mm(210)
        section.top_margin = Mm(18)
        section.bottom_margin = Mm(18)
        section.left_margin = Mm(20)
        section.right_margin = Mm(20)

    # ── 默认字体:中文用宋体,英文用 Calibri ────────────────────────────
    style = doc.styles['Normal']
    style.font.name = 'Calibri'
    style.font.size = Pt(11)

    # ── 标题 ──────────────────────────────────────────────────────────
    title_para = doc.add_paragraph()
    title_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
    title_run = title_para.add_run(resume.get('title', '简历'))
    title_run.bold = True
    title_run.font.size = Pt(20)

    # ── 按 sort_order 遍历 sections ───────────────────────────────────
    sections = sorted(resume.get('sections', []), key=lambda s: s.get('sort_order', 0))
    pi_data = _extract_personal_info(sections)

    # 个人基本信息块(简化版)— 紧跟标题
    if pi_data:
        _render_personal_info_block(doc, pi_data)

    for sec in sections:
        if sec.get('visible', 1) == 0:
            continue
        sec_type = sec.get('section_type', '')
        if sec_type == 'personal_info':
            continue  # 已在标题下方渲染
        _render_section(doc, sec_type, sec.get('title', ''), sec.get('content') or {})

    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()


# ─── helpers ─────────────────────────────────────────────────────────────

def _extract_personal_info(sections: list[dict]) -> dict:
    for s in sections:
        if s.get('section_type') == 'personal_info':
            return s.get('content') or {}
    return {}


def _render_personal_info_block(doc: Document, pi: dict) -> None:
    """个人信息块 — 单行联系方式"""
    lines = []
    if pi.get('email'):
        lines.append(pi['email'])
    if pi.get('phone'):
        lines.append(pi['phone'])
    if pi.get('location'):
        lines.append(pi['location'])
    if not lines:
        return
    contact = ' · '.join(lines)
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run(contact)
    run.font.size = Pt(10)
    run.font.color.rgb = None  # 用默认灰色


def _render_section(doc: Document, sec_type: str, title: str, content: dict) -> None:
    """单个 section 渲染 — 按 type 分发"""
    if sec_type == 'summary':
        _render_summary(doc, title, content)
    elif sec_type == 'work_experience':
        _render_work_experience(doc, title, content)
    elif sec_type == 'education':
        _render_education(doc, title, content)
    elif sec_type == 'skills':
        _render_skills(doc, title, content)
    elif sec_type == 'projects':
        _render_projects(doc, title, content)
    elif sec_type == 'certifications':
        _render_certifications(doc, title, content)
    elif sec_type == 'languages':
        _render_languages(doc, title, content)
    elif sec_type == 'custom':
        _render_custom(doc, title, content)
    elif sec_type == 'github':
        _render_github(doc, title, content)
    else:
        # qr_codes 等类型不进 DOCX(图片处理复杂)
        pass


def _add_section_heading(doc: Document, title: str) -> None:
    """区块小标题 — 加粗 + 略大字号"""
    p = doc.add_paragraph()
    run = p.add_run(title)
    run.bold = True
    run.font.size = Pt(13)
    # 加点视觉分隔
    p.paragraph_format.space_before = Pt(8)
    p.paragraph_format.space_after = Pt(4)


def _render_summary(doc: Document, title: str, content: dict) -> None:
    text = (content.get('text') or '').strip()
    if not text:
        return
    _add_section_heading(doc, title)
    p = doc.add_paragraph(text)
    p.paragraph_format.space_after = Pt(6)


def _render_work_experience(doc: Document, title: str, content: dict) -> None:
    items = content.get('items') or []
    if not items:
        return
    _add_section_heading(doc, title)
    for item in items:
        _render_work_item(doc, item)


def _render_work_item(doc: Document, item: dict) -> None:
    # 标题行:公司 + 职位
    head = item.get('position') or item.get('company') or ''
    if item.get('company') and item.get('position'):
        head = f"{item['position']} — {item['company']}"
    elif item.get('company'):
        head = item['company']
    date_range = _format_date_range(item.get('startDate'), item.get('endDate'))

    p = doc.add_paragraph()
    run = p.add_run(head)
    run.bold = True
    if date_range:
        p.add_run(f"  ({date_range})").italic = True
    if item.get('location'):
        p.add_run(f"  · {item['location']}").italic = True

    if item.get('description'):
        doc.add_paragraph(_strip_md(item['description']))

    if item.get('technologies'):
        tech_p = doc.add_paragraph()
        tech_run = tech_p.add_run('技术栈: ' + ', '.join(item['technologies']))
        tech_run.italic = True
        tech_run.font.size = Pt(10)

    for h in item.get('highlights') or []:
        doc.add_paragraph(_strip_md(h), style='List Bullet')


def _render_education(doc: Document, title: str, content: dict) -> None:
    items = content.get('items') or []
    if not items:
        return
    _add_section_heading(doc, title)
    for item in items:
        degree = ' · '.join(filter(None, [item.get('degree'), item.get('field')]))
        head = degree or item.get('institution') or ''
        date_range = _format_date_range(item.get('startDate'), item.get('endDate'))

        p = doc.add_paragraph()
        run = p.add_run(head)
        run.bold = True
        if item.get('institution'):
            p.add_run(f" — {item['institution']}").italic = True
        if date_range:
            p.add_run(f"  ({date_range})").italic = True

        if item.get('gpa'):
            doc.add_paragraph(f"GPA: {item['gpa']}")

        for h in item.get('highlights') or []:
            doc.add_paragraph(_strip_md(h), style='List Bullet')


def _render_skills(doc: Document, title: str, content: dict) -> None:
    categories = content.get('categories') or []
    if not categories:
        return
    _add_section_heading(doc, title)
    for cat in categories:
        p = doc.add_paragraph()
        run = p.add_run(f"{cat.get('name', '')}: ")
        run.bold = True
        p.add_run(', '.join(cat.get('skills') or []))


def _render_projects(doc: Document, title: str, content: dict) -> None:
    items = content.get('items') or []
    if not items:
        return
    _add_section_heading(doc, title)
    for item in items:
        date_range = _format_date_range(item.get('startDate'), item.get('endDate'))
        p = doc.add_paragraph()
        run = p.add_run(item.get('name', ''))
        run.bold = True
        if date_range:
            p.add_run(f"  ({date_range})").italic = True

        if item.get('description'):
            doc.add_paragraph(_strip_md(item['description']))
        if item.get('technologies'):
            tech_p = doc.add_paragraph()
            tech_run = tech_p.add_run('技术栈: ' + ', '.join(item['technologies']))
            tech_run.italic = True
            tech_run.font.size = Pt(10)
        for h in item.get('highlights') or []:
            doc.add_paragraph(_strip_md(h), style='List Bullet')


def _render_certifications(doc: Document, title: str, content: dict) -> None:
    items = content.get('items') or []
    if not items:
        return
    _add_section_heading(doc, title)
    for item in items:
        p = doc.add_paragraph()
        run = p.add_run(item.get('name', ''))
        run.bold = True
        meta = []
        if item.get('issuer'):
            meta.append(item['issuer'])
        if item.get('date'):
            meta.append(item['date'])
        if meta:
            p.add_run(f" — {', '.join(meta)}").italic = True


def _render_languages(doc: Document, title: str, content: dict) -> None:
    items = content.get('items') or []
    if not items:
        return
    _add_section_heading(doc, title)
    for item in items:
        p = doc.add_paragraph()
        run = p.add_run(item.get('language', ''))
        run.bold = True
        if item.get('proficiency'):
            p.add_run(f" — {item['proficiency']}").italic = True


def _render_custom(doc: Document, title: str, content: dict) -> None:
    items = content.get('items') or []
    if not items:
        return
    _add_section_heading(doc, title)
    for item in items:
        p = doc.add_paragraph()
        run = p.add_run(item.get('title', ''))
        run.bold = True
        if item.get('subtitle'):
            p.add_run(f" — {item['subtitle']}").italic = True
        if item.get('date'):
            p.add_run(f"  ({item['date']})").italic = True
        if item.get('description'):
            doc.add_paragraph(_strip_md(item['description']))


def _render_github(doc: Document, title: str, content: dict) -> None:
    items = content.get('items') or []
    if not items:
        return
    _add_section_heading(doc, title)
    for item in items:
        p = doc.add_paragraph()
        run = p.add_run(item.get('name', ''))
        run.bold = True
        if item.get('stars') is not None:
            p.add_run(f"  ★ {item['stars']:,}").italic = True
        if item.get('language'):
            p.add_paragraph(item['language']).runs[0].font.size = Pt(10)
        if item.get('description'):
            doc.add_paragraph(_strip_md(item['description']))


def _format_date_range(start: str | None, end: str | None) -> str:
    if not start and not end:
        return ''
    return f"{start or ''} – {end or '至今'}"


def _strip_md(text: str) -> str:
    """去掉简单 Markdown 标记,纯 DOCX 不渲染 MD"""
    if not text:
        return ''
    return text.replace('**', '').replace('__', '').replace('`', '').strip()