"""把简历解析结果映射成编辑器区块内容。

解析层（`services/resume_parser.py`）只负责从文本里抠扁平字段，本模块负责把
这些字段变成 `resume_sections.content` 需要的结构：工作经历/教育/项目都是
items 数组，技能是 categories 数组。

单独拆一个模块的原因：解析结果还被 `/api/auth/resume-parse` 和匹配引擎的
画像提取复用，不能因为简历中心要数组就把它的返回形状改掉。

前端各区块的字段名以 `frontend/src/types/resume.ts` 为准，改这里要同步。
"""

from __future__ import annotations

import re

from services.resume_text_blocks import parse_work, parse_education, parse_projects

# 技能分类：命中即归组，未命中进「其他技能」。
# 只做粗分类，目的是让导入后的技能区看起来像人填的，而不是一坨平铺标签。
_SKILL_GROUPS: list[tuple[str, tuple[str, ...]]] = [
    ('编程语言', (
        'python', 'java', 'javascript', 'typescript', 'go', 'golang', 'c++', 'c#',
        'php', 'ruby', 'swift', 'kotlin', 'rust', 'scala', 'matlab', 'shell', 'sql',
    )),
    ('前端开发', (
        'react', 'vue', 'angular', 'next.js', 'nextjs', 'nuxt', 'html', 'css', 'sass',
        'less', 'tailwind', 'webpack', 'vite', 'jquery', 'redux', '小程序', 'flutter',
    )),
    ('后端与框架', (
        'fastapi', 'django', 'flask', 'spring', 'springboot', 'gin', 'express', 'koa',
        'nestjs', 'laravel', 'mybatis', 'hibernate', 'node.js', 'nodejs', 'grpc',
    )),
    ('数据库', (
        'mysql', 'postgresql', 'postgres', 'oracle', 'sqlserver', 'sqlite', 'redis',
        'mongodb', 'elasticsearch', 'clickhouse', 'hive', 'hbase', 'neo4j', 'tidb',
    )),
    ('数据与算法', (
        'pytorch', 'tensorflow', 'sklearn', 'scikit-learn', 'pandas', 'numpy', 'spark',
        'flink', 'hadoop', 'kafka', '机器学习', '深度学习', '数据分析', 'nlp', 'cv',
        '大模型', 'llm', 'rag', 'langchain', 'prompt',
    )),
    ('云与运维', (
        'docker', 'kubernetes', 'k8s', 'linux', 'nginx', 'aws', 'azure', '阿里云',
        'git', 'ci/cd', 'jenkins', 'gitlab', 'devops',
    )),
]

_DEGREE_WORDS = ('博士', '硕士', '研究生', '本科', '大专', '专科', '高中', '中专', 'MBA')

# 英文技能名的边界判定：不能用 `k in low`，否则 sql 命中 mysql、go 命中 django。
# 前面必须是分隔符、后面允许数字（Python3 要算 Python）。
_ASCII_KEY_RE = re.compile(r'^[a-z0-9+#.\- ]+$')


def _skill_hit(low: str, key: str) -> bool:
    if not _ASCII_KEY_RE.match(key):
        return key in low  # 中文技能名按子串
    pattern = rf'(?:^|[^a-z0-9+#.]){re.escape(key)}(?:$|[^a-z+#.])'
    return re.search(pattern, low) is not None


def _sid(prefix: str, idx: int) -> str:
    """稳定的临时 id：导入后进编辑器，保存时后端会重建，不需要全局唯一。"""
    return f'imp-{prefix}-{idx}'


def _norm_date(value) -> str:
    """把 2021.03 / 2021-3 / 2021年3月 / 2021 统一成 2021-03 或 2021。"""
    if value is None:
        return ''
    s = str(value).strip()
    if not s:
        return ''
    if s in ('至今', '今', '现在', 'now', 'present', 'Present'):
        return ''
    m = re.search(r'(19|20)\d{2}', s)
    if not m:
        return ''
    year = m.group(0)
    rest = s[m.end():]
    mm = re.search(r'\d{1,2}', rest)
    if mm:
        month = int(mm.group(0))
        if 1 <= month <= 12:
            return f'{year}-{month:02d}'
    return year


def _split_points(text) -> list[str]:
    """把一段描述拆成要点。只有一条时不拆，免得把一句话切碎。"""
    if not text:
        return []
    s = str(text).strip()
    if not s:
        return []
    parts = [p.strip(' -—·\t') for p in re.split(r'[;；\n]+|(?<=[。！？])', s)]
    parts = [p for p in parts if len(p) >= 6]
    return parts[:6] if len(parts) > 1 else []


def _as_list(value) -> list:
    if isinstance(value, list):
        return value
    if isinstance(value, str) and value.strip():
        return [value.strip()]
    return []


def _guess_degree(text: str) -> str:
    s = str(text or '')
    for word in _DEGREE_WORDS:
        if word in s:
            return word
    return ''


_CN_NUM = {'一': 1, '二': 2, '两': 2, '三': 3, '四': 4, '五': 5, '六': 6,
           '七': 7, '八': 8, '九': 9, '十': 10}


def _years_of_experience(*texts) -> str:
    """从「3年工作经验」「三年开发经验」这类文本里推经验年限，推不出就留空。

    简历里写中文数字很常见（尤其是自我评价），只匹配阿拉伯数字会漏掉。
    """
    for t in texts:
        if not t:
            continue
        raw = str(t)
        # 「3 年经验」「三年互联网产品经验」「5年以上后端开发经验」都要能认
        m = re.search(r'(\d+(?:\.\d+)?)\s*年[^。\n]{0,8}?经验', raw)
        if m:
            return f'{m.group(1)}年'
        m = re.search(r'([一二两三四五六七八九十])\s*年[^。\n]{0,8}?经验', raw)
        if m:
            return f'{_CN_NUM.get(m.group(1), 1)}年'
    return ''


def _group_skills(skills: list[str]) -> list[dict]:
    """技能平铺列表 → 分类。保持原始大小写与顺序。"""
    buckets: dict[str, list[str]] = {}
    for raw in skills:
        name = str(raw).strip()
        if not name:
            continue
        low = name.lower()
        target = '其他技能'
        for group_name, keys in _SKILL_GROUPS:
            if any(_skill_hit(low, k) for k in keys):
                target = group_name
                break
        bucket = buckets.setdefault(target, [])
        if name not in bucket:
            bucket.append(name)

    order = [name for name, _ in _SKILL_GROUPS] + ['其他技能']
    return [
        {'id': _sid('skill', i), 'name': name, 'skills': buckets[name]}
        for i, name in enumerate(order) if buckets.get(name)
    ]


# 工作线索：时间区间、公司后缀、任职类动词
# 时间必须是「区间」（两个时间点之间有连接符），单个日期不算 ——
# 否则「2027年6月毕业」这种自我评价会被误判成工作经历。
_WORK_TEXT_HINT = re.compile(
    r'(?:\d{4}\s*[.\-/年]\s*\d{1,2}\s*月?\s*(?:-|–|—|~|～|至|到)\s*(?:\d{4}|\d{1,2}|至今|现在|今))'
    r'|(?:\d{4}\s*[-–—~至到]\s*\d{4})'
    r'|(有限责任公司|有限公司|集团|科技公司|研究院|事务所|工作室)'
    r'|(任职|就职|入职|在职|实习于|担任|岗位职责|汇报给)'
)


def _looks_like_work(text: str) -> bool:
    """一段文字像不像工作经历

    解析层经常把「自我评价」塞进 experience 字段，直接落成工作经历就会出现
    「没有公司、没有时间、内容是自我介绍」的脏条目（实测简历里出现过
    「2027届软件工程本科生，完成过SFT与DPO比较…」被当成一段工作经历）。
    只有命中公司/任职/时间线索才认，否则宁可留空让用户自己补。
    """
    return bool(_WORK_TEXT_HINT.search(text or ''))


def _work_item_valid(item: dict) -> bool:
    """分条校验：有公司或起止时间就算合法；都没有时再看内容像不像工作"""
    if (item.get('company') or '').strip():
        return True
    if (item.get('startDate') or '').strip() or (item.get('endDate') or '').strip():
        return True
    if item.get('current'):
        return True
    return _looks_like_work(item.get('description', '')) or _looks_like_work(item.get('position', ''))


def _build_work_items(data: dict, raw_text: str = '') -> list[dict]:
    items = []
    for i, raw in enumerate(_as_list(data.get('work_experience'))):
        if not isinstance(raw, dict):
            continue
        desc = str(raw.get('description') or '').strip()
        highlights = [str(h).strip() for h in _as_list(raw.get('highlights')) if str(h).strip()]
        if not highlights:
            highlights = _split_points(desc)
        items.append({
            'id': _sid('work', i),
            'company': str(raw.get('company') or '').strip(),
            'position': str(raw.get('position') or raw.get('title') or '').strip(),
            'location': str(raw.get('location') or '').strip(),
            'startDate': _norm_date(raw.get('startDate')),
            'endDate': None if raw.get('current') else _norm_date(raw.get('endDate')),
            'current': bool(raw.get('current')),
            'description': desc,
            'technologies': [str(t).strip() for t in _as_list(raw.get('technologies')) if str(t).strip()],
            'highlights': highlights,
        })

    if not items and raw_text:
        # 模型没给分条结构（或没走模型）时，按小标题 + 时间区间从原文切
        for i, w in enumerate(parse_work(raw_text)):
            items.append({
                'id': _sid('work', i),
                'company': str(w.get('company') or '').strip(),
                'position': str(w.get('position') or '').strip(),
                'location': str(w.get('location') or '').strip(),
                'startDate': _norm_date(w.get('startDate')),
                'endDate': None if w.get('current') else _norm_date(w.get('endDate')),
                'current': bool(w.get('current')),
                'description': str(w.get('description') or '').strip(),
                'technologies': [],
                'highlights': [h for h in (w.get('highlights') or []) if h][:6],
            })

    if not items and data.get('experience') and _looks_like_work(str(data['experience'])):
        # 解析层只给了「经历摘要」一段话：落成一条，让用户自己补公司/时间。
        # 必须先确认它像工作经历 —— 否则自我评价也会被塞成一条工作经历，
        # 而这段文字本来已经进了「个人简介」（summary 取 bio or experience）。
        desc = str(data['experience']).strip()
        items.append({
            'id': _sid('work', 0),
            'company': '',
            'position': str(data.get('target_position') or '').strip(),
            'location': '',
            'startDate': '',
            'endDate': None,
            'current': False,
            'description': desc,
            'technologies': [],
            'highlights': _split_points(desc),
        })
    return items


def _build_education_items(data: dict, raw_text: str = '') -> list[dict]:
    items = []
    for i, raw in enumerate(_as_list(data.get('education_items'))):
        if not isinstance(raw, dict):
            continue
        institution = str(raw.get('institution') or raw.get('school') or '').strip()
        degree = str(raw.get('degree') or '').strip()
        # 模型偶尔把「本科」填进 institution，这里纠正回学校名
        if institution in _DEGREE_WORDS:
            degree = degree or institution
            institution = str(data.get('school') or '').strip()
        items.append({
            'id': _sid('edu', i),
            'institution': institution,
            'degree': degree,
            'field': str(raw.get('field') or raw.get('major') or '').strip(),
            'location': str(raw.get('location') or '').strip(),
            'startDate': _norm_date(raw.get('startDate')),
            'endDate': _norm_date(raw.get('endDate')),
            'gpa': str(raw.get('gpa') or '').strip(),
            'highlights': [str(h).strip() for h in _as_list(raw.get('highlights')) if str(h).strip()],
        })

    # 学校、学历、专业全空的条目没有意义（模型偶尔会吐一条空壳）
    items = [x for x in items if (x.get('institution') or '').strip()
             or (x.get('degree') or '').strip() or (x.get('field') or '').strip()]

    if not items and raw_text:
        for i, e in enumerate(parse_education(raw_text)):
            items.append({
                'id': _sid('edu', i),
                'institution': str(e.get('institution') or '').strip(),
                'degree': str(e.get('degree') or '').strip(),
                'field': str(e.get('field') or '').strip(),
                'location': '',
                'startDate': _norm_date(e.get('startDate')),
                'endDate': _norm_date(e.get('endDate')),
                'gpa': '',
                'highlights': [h for h in (e.get('highlights') or []) if h][:6],
            })

    if not items and (data.get('school') or data.get('education')):
        edu_text = str(data.get('education') or '')
        items.append({
            'id': _sid('edu', 0),
            'institution': str(data.get('school') or '').strip(),
            'degree': _guess_degree(edu_text),
            'field': re.sub(r'^(博士|硕士|研究生|本科|大专|专科)', '', edu_text).lstrip('·-— '),
            'location': '',
            'startDate': '',
            'endDate': '',
            'gpa': '',
            'highlights': [],
        })
    return items


def _build_project_items(data: dict, raw_text: str = '') -> list[dict]:
    items = []
    for i, raw in enumerate(_as_list(data.get('projects'))):
        if not isinstance(raw, dict):
            continue
        desc = str(raw.get('description') or '').strip()
        highlights = [str(h).strip() for h in _as_list(raw.get('highlights')) if str(h).strip()]
        if not highlights:
            highlights = _split_points(desc)
        items.append({
            'id': _sid('proj', i),
            'name': str(raw.get('name') or '').strip(),
            'url': str(raw.get('url') or '').strip(),
            'startDate': _norm_date(raw.get('startDate')),
            'endDate': _norm_date(raw.get('endDate')),
            'description': desc,
            'technologies': [str(t).strip() for t in _as_list(raw.get('technologies')) if str(t).strip()],
            'highlights': highlights,
        })
    # 既没名字也没描述的项目条目直接丢掉
    items = [x for x in items if (x.get('name') or '').strip() or (x.get('description') or '').strip()]

    if not items and raw_text:
        for i, p in enumerate(parse_projects(raw_text)):
            items.append({
                'id': _sid('proj', i),
                'name': str(p.get('name') or '').strip(),
                'url': '',
                'startDate': _norm_date(p.get('startDate')),
                'endDate': _norm_date(p.get('endDate')),
                'description': str(p.get('description') or '').strip(),
                'technologies': [],
                'highlights': [h for h in (p.get('highlights') or []) if h][:6],
            })
    return items


def build_sections(data: dict) -> list[dict]:
    """解析结果 → 简历区块列表（顺序与编辑器侧栏一致）。

    返回值里同时带 section_type 和 type：后端 PUT 读前者，编辑器读后者。
    """
    data = data or {}
    edu_text = str(data.get('education') or '')
    years = _years_of_experience(
        data.get('years_of_experience'), data.get('experience'), data.get('raw_text_preview'),
    )

    sections: list[dict] = [{
        'section_type': 'personal_info',
        'title': '个人信息',
        'content': {
            'fullName': str(data.get('name') or '').strip(),
            'jobTitle': str(data.get('target_position') or '').strip(),
            'age': '', 'gender': '', 'politicalStatus': '', 'ethnicity': '', 'hometown': '',
            'maritalStatus': '', 'yearsOfExperience': years, 'educationLevel': _guess_degree(edu_text),
            'email': str(data.get('email') or '').strip(),
            'phone': str(data.get('phone') or '').strip(),
            'wechat': '',
            'location': str(data.get('location') or data.get('city') or '').strip(),
            'website': '', 'linkedin': '',
            'github': str(data.get('github') or '').strip(),
        },
    }, {
        'section_type': 'summary',
        'title': '个人简介',
        'content': {'text': str(data.get('bio') or data.get('experience') or '').strip()},
    }]

    raw_text = str(data.get('raw_text_preview') or '')
    work = [w for w in _build_work_items(data, raw_text) if _work_item_valid(w)]
    if work:
        sections.append({'section_type': 'work_experience', 'title': '工作经历',
                         'content': {'items': work}})

    edu = _build_education_items(data, raw_text)
    if edu:
        sections.append({'section_type': 'education', 'title': '教育背景',
                         'content': {'items': edu}})

    categories = _group_skills([str(s) for s in _as_list(data.get('skills'))])
    if categories:
        sections.append({'section_type': 'skills', 'title': '技能特长',
                         'content': {'categories': categories}})

    projects = _build_project_items(data, raw_text)
    if projects:
        sections.append({'section_type': 'projects', 'title': '项目经历',
                         'content': {'items': projects}})

    certs = [c for c in _as_list(data.get('certifications')) if isinstance(c, dict)]
    if certs:
        sections.append({'section_type': 'certifications', 'title': '证书资质',
                         'content': {'items': [{
                             'id': _sid('cert', i),
                             'name': str(c.get('name') or '').strip(),
                             'issuer': str(c.get('issuer') or '').strip(),
                             'date': _norm_date(c.get('date')),
                             'url': '',
                         } for i, c in enumerate(certs)]}})

    # sort_order 由调用方写入，这里只保证顺序
    for i, sec in enumerate(sections):
        sec['sort_order'] = i
        sec['visible'] = 1
    return sections


def build_title(data: dict) -> str:
    """导入后的简历标题：岗位优先，其次姓名，都没有就用「导入简历」。"""
    data = data or {}
    job = str(data.get('target_position') or '').strip()
    name = str(data.get('name') or '').strip()
    if job and name:
        return f'{name} - {job}'
    if job:
        return f'{job} - 导入简历'
    if name:
        return f'{name} - 导入简历'
    return '导入简历'
