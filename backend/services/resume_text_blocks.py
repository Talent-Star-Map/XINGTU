"""从简历纯文本里按板块切出分条经历。

存在的理由：`resume_parser` 的规则路径只抽扁平字段（一段 experience 摘要），
简历中心要生成「可编辑的工作经历卡片」就必须有分条结构。没有模型密钥时
（或模型调用失败回退到规则路径）就靠这里按小标题 + 时间区间把文本切成条目。

只做保守启发式：认不出结构就返回空列表，由调用方回退成一条摘要，
宁可不切也不要切错。
"""

from __future__ import annotations

import re

# 板块标题别名 —— 简历里「项目经历 / 项目经验 / 实践经历」混着写的情况很常见
BLOCK_ALIASES: dict[str, tuple[str, ...]] = {
    'work': ('工作经历', '工作经验', '职业经历', '实习经历', '工作背景'),
    'education': ('教育背景', '教育经历', '学习经历', '学历背景'),
    'projects': ('项目经历', '项目经验', '实践经历', '项目实践'),
}

_ALL_HEADINGS = (
    '个人信息', '联系方式', '个人简介', '自我评价', '自我介绍', '求职意向',
    '技能特长', '专业技能', '技能清单', '证书', '荣誉奖项', '获奖情况',
    '语言能力', '兴趣爱好', '作品集',
) + tuple(h for group in BLOCK_ALIASES.values() for h in group)

_DATE_RANGE = re.compile(
    r'((?:19|20)\d{2}(?:\s*[.\-/年]\s*\d{1,2}\s*月?)?)'
    r'\s*(?:-|–|—|~|至|到)+\s*'
    r'((?:19|20)\d{2}(?:\s*[.\-/年]\s*\d{1,2}\s*月?)?|至今|今|现在)'
)

_DEGREE_WORDS = ('博士', '硕士', '研究生', '本科', '大专', '专科', '高中', '中专')

_SCHOOL_HINT = re.compile(r'[\u4e00-\u9fa5A-Za-z]{2,15}(?:大学|学院|学校|中学)')


def _is_heading(line: str) -> bool:
    s = line.strip(' \t：:|｜·-—')
    if not s or len(s) > 10:
        return False
    return any(s == h or s.startswith(h) for h in _ALL_HEADINGS)


def _find_block(lines: list[str], aliases: tuple[str, ...]) -> list[str]:
    """找到小标题，返回它到下一个标题之间的内容行"""
    for i, line in enumerate(lines):
        s = line.strip(' \t：:|｜·-—')
        if any(s == a or (a in s and len(s) <= len(a) + 4) for a in aliases):
            block: list[str] = []
            for nxt in lines[i + 1:]:
                if not nxt.strip():
                    continue
                if _is_heading(nxt):
                    break
                block.append(nxt.strip())
            return block
    return []


def _entries(lines: list[str]) -> list[dict]:
    """按「带时间区间的行」切条目；没有时间区间时整段算一条"""
    entries: list[dict] = []
    cur: dict | None = None
    for line in lines:
        has_range = bool(_DATE_RANGE.search(line))
        if has_range or cur is None:
            if cur:
                entries.append(cur)
            cur = {'header': line, 'body': [], 'range': _DATE_RANGE.search(line)}
        else:
            cur['body'].append(line)
    if cur:
        entries.append(cur)
    return entries


def _dates(entry: dict) -> tuple[str, str, bool]:
    m = entry.get('range')
    if not m:
        return '', '', False
    start, end = m.group(1), m.group(2)
    current = end in ('至今', '今', '现在')
    return start, ('' if current else end), current


def _header_parts(header: str) -> list[str]:
    """去掉时间区间，按两空格/竖线拆出公司、职位等字段"""
    text = _DATE_RANGE.sub(' ', header).strip(' \t|｜·-—')
    parts = [p.strip(' \t|｜') for p in re.split(r'\s{2,}|\t+|\||｜|·', text) if p.strip()]
    return parts


def parse_work(text: str) -> list[dict]:
    lines = [l.strip() for l in (text or '').splitlines()]
    out = []
    for entry in _entries(_find_block(lines, BLOCK_ALIASES['work'])):
        parts = _header_parts(entry['header'])
        start, end, current = _dates(entry)
        body = entry['body']
        out.append({
            'company': parts[0] if parts else '',
            'position': parts[1] if len(parts) > 1 else '',
            'location': parts[2] if len(parts) > 2 else '',
            'startDate': start,
            'endDate': end,
            'current': current,
            'description': ' '.join(body),
            'technologies': [],
            'highlights': body,
        })
    return out


def parse_education(text: str) -> list[dict]:
    lines = [l.strip() for l in (text or '').splitlines()]
    out = []
    for entry in _entries(_find_block(lines, BLOCK_ALIASES['education'])):
        parts = _header_parts(entry['header'])
        start, end, _ = _dates(entry)
        institution = next((p for p in parts if _SCHOOL_HINT.search(p)), '')
        degree = next((p for p in parts if any(d in p for d in _DEGREE_WORDS)), '')
        rest = [p for p in parts if p not in (institution, degree)]
        major = ''
        for p in rest:
            if not re.fullmatch(r'[\d\s.\-/年月]+', p):
                major = p
                break
        out.append({
            'institution': institution or (parts[0] if parts else ''),
            'degree': degree,
            'field': major,
            'startDate': start,
            'endDate': end,
            'highlights': entry['body'],
        })
    return out


def parse_projects(text: str) -> list[dict]:
    lines = [l.strip() for l in (text or '').splitlines()]
    out = []
    for entry in _entries(_find_block(lines, BLOCK_ALIASES['projects'])):
        parts = _header_parts(entry['header'])
        start, end, _ = _dates(entry)
        body = entry['body']
        out.append({
            'name': parts[0] if parts else '',
            'role': parts[1] if len(parts) > 1 else '',
            'startDate': start,
            'endDate': end,
            'description': ' '.join(body),
            'technologies': [],
            'highlights': body,
        })
    return out
