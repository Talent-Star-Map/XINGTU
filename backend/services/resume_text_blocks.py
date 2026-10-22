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


def is_heading(line: str) -> bool:
    """公开的小标题判断（表格解析按行拆分时也要用同一套规则）"""
    return _is_heading(line)


def _cells(line: str) -> list[str]:
    """按 | / 全角｜ / 制表符拆单元格（表格导出的文本会带这些分隔符）"""
    return [c.strip() for c in re.split(r'\s*[|｜]\s*|\t+', line) if c.strip()]


def _heading_of(line: str) -> str:
    """取一行的「小标题」候选：表格行看第一格，普通行看整行"""
    cells = _cells(line)
    return cells[0] if cells else ''


def _find_blocks(lines: list[str], aliases: tuple[str, ...]) -> list[list[str]]:
    """收集所有命中别名的板块

    一份简历可能同时有「实习经历」和「工作经历」两个标题，只看第一个会漏掉一半经历。
    表格行（`工作经历 | 小米 | 工程师 | 2018.07-2021.08`）的小标题在第一格，
    剩余单元格作为该板块的第一条内容。
    """
    blocks: list[list[str]] = []
    current: list[str] | None = None
    for line in lines:
        head = _heading_of(line)
        is_alias = any(head == a or (a in head and len(head) <= len(a) + 4) for a in aliases)
        if is_alias:
            cells = _cells(line)
            current = []
            blocks.append(current)
            if len(cells) > 1:
                current.append(' | '.join(cells[1:]))
            continue
        if current is None:
            continue
        if _is_heading(head):
            current = None
            continue
        current.append(line.strip())
    return blocks


def _find_block(lines: list[str], aliases: tuple[str, ...]) -> list[str]:
    """兼容旧调用：返回第一个命中板块的内容行"""
    blocks = _find_blocks(lines, aliases)
    return blocks[0] if blocks else []


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
    work_lines: list[str] = []
    for block in _find_blocks(lines, BLOCK_ALIASES['work']):
        work_lines.extend(block)
    for entry in _entries(work_lines):
        header = entry['header']
        # 「浙江大学 硕士 软件工程 2016.09-2019.03」这类教育行常被写在经历末尾，
        # 带日期区间会被切成一条假工作经历，这里按「学校 + 学历词」排除
        if _SCHOOL_HINT.search(header) and any(d in header for d in _DEGREE_WORDS):
            continue
        parts = _header_parts(header)
        # 表格模板常把「公司 职位」写在同一格，这里按空格再拆一次
        if len(parts) == 1 and len(parts[0].split()) > 1:
            tokens = parts[0].split()
            parts = [tokens[0], ' '.join(tokens[1:])]
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
    edu_lines: list[str] = []
    for block in _find_blocks(lines, BLOCK_ALIASES['education']):
        edu_lines.extend(block)
    for entry in _entries(edu_lines):
        parts = _header_parts(entry['header'])
        start, end, _ = _dates(entry)
        school_hit = next((_SCHOOL_HINT.search(p) for p in parts if _SCHOOL_HINT.search(p)), None)
        institution = school_hit.group(0) if school_hit else ''
        degree = next((d for d in _DEGREE_WORDS if any(d in p for p in parts)), '')
        # 专业：从「学校 学历 专业」这一格里去掉学校与学历词后剩下的内容
        major = ''
        for p in parts:
            if not _SCHOOL_HINT.search(p):
                continue
            rest = _SCHOOL_HINT.sub(' ', p)
            for d in _DEGREE_WORDS:
                rest = rest.replace(d, ' ')
            rest = re.sub(r'\s+', ' ', rest).strip()
            if rest and not re.fullmatch(r'[\d\s.\-/年月]+', rest):
                major = rest
            break
        if not major:
            # 段落式写法「浙江大学  本科  软件工程」：学校单独成段，专业在后面一段
            for p in parts:
                if p == institution or p == degree or not p:
                    continue
                if re.fullmatch(r'[\d\s.\-/年月]+', p):
                    continue
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
    proj_lines: list[str] = []
    for block in _find_blocks(lines, BLOCK_ALIASES['projects']):
        proj_lines.extend(block)
    for entry in _entries(proj_lines):
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
