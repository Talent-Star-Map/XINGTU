"""简历 → TXT 导出

纯文本序列化,适合:
- ATS(Applicant Tracking System)系统读取
- 邮件正文粘贴
- 极简预览

格式:对齐 11 个 section type,保持可读性。
中文宽度按 UTF-8 字节算(中文 3 字节 / 英文 1 字节)。
编码:UTF-8 with BOM(Windows 记事本兼容)。

@owner: XINGTU 团队(AI 简历中心)
"""

from typing import Any


def build_txt(resume: dict[str, Any]) -> bytes:
    """把简历字典转成 UTF-8 TXT

    Args:
        resume: 与 GET /api/resume-center/{id} 返回 data 结构一致
    Returns:
        带 BOM 的 UTF-8 字节
    """
    lines: list[str] = []
    title = resume.get('title', '简历')
    sections = sorted(resume.get('sections', []), key=lambda s: s.get('sort_order', 0))

    # ── 头部 ─────────────────────────────────────────────────────────
    lines.append('=' * 60)
    lines.append(_center(title, 60))
    lines.append('=' * 60)
    lines.append('')

    # ── 个人信息 ─────────────────────────────────────────────────────
    pi = _extract_personal_info(sections)
    if pi:
        contact_parts = []
        for k in ('jobTitle', 'email', 'phone', 'location', 'website', 'github', 'linkedin'):
            v = pi.get(k)
            if v:
                contact_parts.append(v)
        if contact_parts:
            lines.append('  '.join(contact_parts))
            lines.append('')

    # ── 各 section ───────────────────────────────────────────────────
    for sec in sections:
        if sec.get('visible', 1) == 0:
            continue
        sec_type = sec.get('section_type', '')
        if sec_type == 'personal_info':
            continue
        sec_title = sec.get('title', '')
        content = sec.get('content') or {}
        _render_section(lines, sec_type, sec_title, content)
        lines.append('')

    text = '\n'.join(lines).rstrip() + '\n'
    return ('﻿' + text).encode('utf-8')  # BOM + UTF-8


# ─── helpers ─────────────────────────────────────────────────────────────

def _extract_personal_info(sections: list[dict]) -> dict:
    for s in sections:
        if s.get('section_type') == 'personal_info':
            return s.get('content') or {}
    return {}


def _center(text: str, width: int) -> str:
    """简单居中 — 按字符数(中文算 1 个 width 单位)"""
    text_len = len(text)
    if text_len >= width:
        return text
    pad = (width - text_len) // 2
    return ' ' * pad + text


def _rule(char: str = '-', width: int = 40) -> str:
    return char * width


def _section_header(lines: list[str], title: str) -> None:
    lines.append(_rule('='))
    lines.append(f'【{title}】')
    lines.append(_rule())


def _render_section(lines: list[str], sec_type: str, title: str, content: dict) -> None:
    if sec_type == 'summary':
        _render_summary(lines, title, content)
    elif sec_type == 'work_experience':
        _render_work_experience(lines, title, content)
    elif sec_type == 'education':
        _render_education(lines, title, content)
    elif sec_type == 'skills':
        _render_skills(lines, title, content)
    elif sec_type == 'projects':
        _render_projects(lines, title, content)
    elif sec_type == 'certifications':
        _render_certifications(lines, title, content)
    elif sec_type == 'languages':
        _render_languages(lines, title, content)
    elif sec_type == 'custom':
        _render_custom(lines, title, content)
    elif sec_type == 'github':
        _render_github(lines, title, content)
    # qr_codes 不渲染(纯文本不适合二维码)


def _render_summary(lines: list[str], title: str, content: dict) -> None:
    text = (content.get('text') or '').strip()
    if not text:
        return
    _section_header(lines, title)
    lines.append(_strip_md(text))


def _render_work_experience(lines: list[str], title: str, content: dict) -> None:
    items = content.get('items') or []
    if not items:
        return
    _section_header(lines, title)
    for i, item in enumerate(items, 1):
        head_parts = []
        if item.get('position'):
            head_parts.append(item['position'])
        if item.get('company'):
            head_parts.append(f"@ {item['company']}")
        date_range = _format_date_range(item.get('startDate'), item.get('endDate'))
        if date_range:
            head_parts.append(f"({date_range})")
        if item.get('location'):
            head_parts.append(f"- {item['location']}")
        lines.append(f"{i}. {' '.join(head_parts)}")

        if item.get('description'):
            lines.append(f"   {_strip_md(item['description'])}")
        if item.get('technologies'):
            lines.append(f"   技术栈: {', '.join(item['technologies'])}")
        for h in item.get('highlights') or []:
            lines.append(f"   • {_strip_md(h)}")
        lines.append('')


def _render_education(lines: list[str], title: str, content: dict) -> None:
    items = content.get('items') or []
    if not items:
        return
    _section_header(lines, title)
    for i, item in enumerate(items, 1):
        head = ' · '.join(filter(None, [item.get('degree'), item.get('field')]))
        if item.get('institution'):
            head = f"{head} — {item['institution']}" if head else item['institution']
        date_range = _format_date_range(item.get('startDate'), item.get('endDate'))
        if date_range:
            head += f" ({date_range})"
        lines.append(f"{i}. {head}")
        if item.get('gpa'):
            lines.append(f"   GPA: {item['gpa']}")
        for h in item.get('highlights') or []:
            lines.append(f"   • {_strip_md(h)}")
        lines.append('')


def _render_skills(lines: list[str], title: str, content: dict) -> None:
    categories = content.get('categories') or []
    if not categories:
        return
    _section_header(lines, title)
    for cat in categories:
        skills = ', '.join(cat.get('skills') or [])
        lines.append(f"• {cat.get('name', '')}: {skills}")


def _render_projects(lines: list[str], title: str, content: dict) -> None:
    items = content.get('items') or []
    if not items:
        return
    _section_header(lines, title)
    for i, item in enumerate(items, 1):
        date_range = _format_date_range(item.get('startDate'), item.get('endDate'))
        head = item.get('name', '')
        if date_range:
            head += f" ({date_range})"
        lines.append(f"{i}. {head}")
        if item.get('description'):
            lines.append(f"   {_strip_md(item['description'])}")
        if item.get('technologies'):
            lines.append(f"   技术栈: {', '.join(item['technologies'])}")
        for h in item.get('highlights') or []:
            lines.append(f"   • {_strip_md(h)}")
        lines.append('')


def _render_certifications(lines: list[str], title: str, content: dict) -> None:
    items = content.get('items') or []
    if not items:
        return
    _section_header(lines, title)
    for item in items:
        meta = []
        if item.get('issuer'):
            meta.append(item['issuer'])
        if item.get('date'):
            meta.append(item['date'])
        suffix = f" — {', '.join(meta)}" if meta else ''
        lines.append(f"• {item.get('name', '')}{suffix}")


def _render_languages(lines: list[str], title: str, content: dict) -> None:
    items = content.get('items') or []
    if not items:
        return
    _section_header(lines, title)
    for item in items:
        prof = f" — {item['proficiency']}" if item.get('proficiency') else ''
        lines.append(f"• {item.get('language', '')}{prof}")


def _render_custom(lines: list[str], title: str, content: dict) -> None:
    items = content.get('items') or []
    if not items:
        return
    _section_header(lines, title)
    for i, item in enumerate(items, 1):
        head = item.get('title', '')
        if item.get('subtitle'):
            head += f" — {item['subtitle']}"
        if item.get('date'):
            head += f" ({item['date']})"
        lines.append(f"{i}. {head}")
        if item.get('description'):
            lines.append(f"   {_strip_md(item['description'])}")
        lines.append('')


def _render_github(lines: list[str], title: str, content: dict) -> None:
    items = content.get('items') or []
    if not items:
        return
    _section_header(lines, title)
    for item in items:
        stars = f"  ★ {item['stars']:,}" if item.get('stars') is not None else ''
        lines.append(f"• {item.get('name', '')}{stars}")
        if item.get('language'):
            lines.append(f"   语言: {item['language']}")
        if item.get('description'):
            lines.append(f"   {_strip_md(item['description'])}")


def _format_date_range(start: str | None, end: str | None) -> str:
    if not start and not end:
        return ''
    return f"{start or ''} – {end or '至今'}"


def _strip_md(text: str) -> str:
    """去掉简单 Markdown 标记"""
    if not text:
        return ''
    return text.replace('**', '').replace('__', '').replace('`', '').strip()