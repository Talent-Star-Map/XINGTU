"""企业端市场数据大屏 — 清洗口径与聚合。

口径固定在这里，前端只负责展示：
- 岗位：jobs.data_type = 1（排除文章/政策）
- 去重：title + company_name + city + salary_min + salary_max
- 有效薪资：2000 ≤ min ≤ max ≤ 100000（元/月）
- 技能：skill_tags JSON → 同义词归一 → 单岗位去重

数据规模小（约 3k 岗位），一次读入内存聚合；结果缓存 5 分钟，
避免每个图表请求都跨公网拉全表。
"""
from __future__ import annotations

import json
import math
import re
import threading
import time
from collections import Counter, defaultdict
from datetime import datetime
from typing import Any, Iterable

from sqlalchemy import text

from database import Job, get_session

CACHE_TTL = 300

EXPERIENCE_ORDER = ['不限', '1年以内', '1-3年', '3-5年', '5年以上', '其他', '未知']
EDUCATION_ORDER = ['不限', '高中及以下', '大专', '本科', '硕士及以上', '其他', '未知']
EXPERIENCE_LEVEL = {'不限': 0, '1年以内': 1, '1-3年': 2, '3-5年': 3, '5年以上': 4}

SALARY_BANDS = {
    '': None,
    'lt10': (0, 10000),
    '10_20': (10000, 20000),
    '20_30': (20000, 30000),
    '30_50': (30000, 50000),
    '50_plus': (50000, 10**9),
}

_SKILL_ALIASES = {
    'python': 'Python',
    'c++': 'C++',
    'cpp': 'C++',
    'c/c++': 'C/C++',
    'c#': 'C#',
    'javascript': 'JavaScript',
    'js': 'JavaScript',
    'typescript': 'TypeScript',
    'ts': 'TypeScript',
    'golang': 'Go',
    'go': 'Go',
    'node': 'Node.js',
    'node.js': 'Node.js',
    'nodejs': 'Node.js',
    'react': 'React',
    'react.js': 'React',
    'vue': 'Vue',
    'vue.js': 'Vue',
    'mysql': 'MySQL',
    'redis': 'Redis',
    'docker': 'Docker',
    'kubernetes': 'Kubernetes',
    'k8s': 'Kubernetes',
    'linux': 'Linux',
    'git': 'Git',
    'java': 'Java',
    'spring': 'Spring',
    'spring boot': 'Spring Boot',
    'springboot': 'Spring Boot',
    'pytorch': 'PyTorch',
    'tensorflow': 'TensorFlow',
    'machine learning': 'Machine Learning',
    'deep learning': 'Deep Learning',
    'ai': 'AI',
    '人工智能': 'AI',
    '大模型': '大模型',
    'llm': '大模型',
    'aigc': 'AIGC',
    'agent': 'AI Agent',
    'ai-agent': 'AI Agent',
    'ai agent': 'AI Agent',
    '智能体': 'AI Agent',
    'rag': 'RAG',
    'nlp': 'NLP',
    'cv': '计算机视觉',
    '计算机视觉': '计算机视觉',
    '数据分析': '数据分析',
    '大数据': '大数据',
    'hadoop': 'Hadoop',
    'spark': 'Spark',
    'flink': 'Flink',
    'sql': 'SQL',
    'postgresql': 'PostgreSQL',
    'mongodb': 'MongoDB',
    'kafka': 'Kafka',
    'rabbitmq': 'RabbitMQ',
    'grpc': 'gRPC',
    'restful': 'RESTful',
    'html': 'HTML',
    'css': 'CSS',
    'css3': 'CSS',
    'webpack': 'Webpack',
    'vite': 'Vite',
    'figma': 'Figma',
    'photoshop': 'Photoshop',
    'selenium': 'Selenium',
    'pytest': 'Pytest',
    'jmeter': 'JMeter',
}

_SOURCE_PRIORITY = {
    '腾讯招聘官网': 0,
    '智联招聘': 1,
    'Boss直聘': 2,
    '猎聘': 3,
    '拉勾': 4,
    '脉脉': 5,
    'ai_discovered': 9,
}

_DATASET: dict[str, Any] | None = None
_DATASET_AT = 0.0
_LOCK = threading.Lock()


# ── 字段归一 ────────────────────────────────────────────────

def canon_skill(raw: Any) -> str | None:
    if raw is None:
        return None
    s = re.sub(r'\s+', ' ', str(raw)).strip().strip(' ,，、;；|')
    if not s or len(s) > 40 or re.fullmatch(r'[\d.+\-]+', s):
        return None
    return _SKILL_ALIASES.get(s.casefold(), s)


def parse_skills(raw: Any) -> list[str]:
    if raw is None:
        return []
    if isinstance(raw, (list, tuple)):
        arr: Iterable[Any] = raw
    else:
        s = str(raw).strip()
        if not s:
            return []
        try:
            parsed = json.loads(s)
            arr = parsed if isinstance(parsed, list) else re.split(r'[,，、;；]', s)
        except (ValueError, TypeError):
            arr = re.split(r'[,，、;；]', s)
    out: list[str] = []
    seen: set[str] = set()
    for item in arr:
        name = canon_skill(item)
        if not name:
            continue
        key = name.casefold()
        if key in seen:
            continue
        seen.add(key)
        out.append(name)
    return out


def norm_experience(raw: Any) -> str:
    s = str(raw or '').strip()
    if not s:
        return '未知'
    if '不限' in s:
        return '不限'
    if '1年以内' in s or '一年以内' in s:
        return '1年以内'
    if '1-3' in s or '2-5' in s or '一年以上' in s or '两年以上' in s:
        return '1-3年'
    if '3-5' in s or '三年以上' in s:
        return '3-5年'
    if '5-' in s or '5年以上' in s or '五年以上' in s:
        return '5年以上'
    if '10年' in s or '十年' in s:
        return '5年以上'
    return '其他'


def norm_education(raw: Any) -> str:
    s = str(raw or '').strip()
    if not s:
        return '未知'
    if '不限' in s:
        return '不限'
    if '博士' in s:
        return '硕士及以上'
    if '硕士' in s or 'MBA' in s or 'EMBA' in s:
        return '硕士及以上'
    if '本科' in s:
        return '本科'
    if '大专' in s or '专科' in s:
        return '大专'
    if any(k in s for k in ('高中', '中专', '中技', '初中')):
        return '高中及以下'
    return '其他'


FIELD_ORDER = ['后端开发', '前端开发', '人工智能', '数据开发', '测试', '运维/安全', '产品', '设计', '硬件/芯片', '其他']

_RAW_FIELD_MAP = {
    '后端开发': '后端开发',
    '前端开发': '前端开发',
    '人工智能': '人工智能',
    '人工智能与大模型': '人工智能',
    '数据开发': '数据开发',
    '数据技术': '数据开发',
    '测试': '测试',
    '测试开发': '测试',
    '运维开发': '运维/安全',
    '网络安全': '运维/安全',
    '云计算与安全': '运维/安全',
    '全栈开发': '后端开发',
    '软件研发': '后端开发',
    '质量与产品': '测试',
    '项目管理': '其他',
    '产品': '产品',
    '设计': '设计',
    '技术': '其他',
    '其他': '其他',
}


def normalize_field(title: str, skills: list[str], raw_field: Any = '') -> str:
    clean_title = re.sub(r'^[\[【][^\]】]{1,10}[\]】]\s*', '', str(title or '').strip())
    text = f"{clean_title} {' '.join(skills)}".casefold()
    if any(k in text for k in ('芯片', '硬件', '光互连', 'fpga', 'asic', '电子工程')):
        return '硬件/芯片'
    if '产品经理' in text or '产品策划' in text or text.startswith('产品'):
        return '产品'
    if any(k in text for k in ('设计师', '交互设计', '视觉设计', '美术', '插画', '平面设计')) \
            or re.search(r'(^|[^a-z])(ui|ux)([^a-z]|$)', text):
        return '设计'
    if any(k in text for k in (
        '算法', 'machine learning', '深度学习', '大模型', 'pytorch', 'tensorflow',
        '多模态', '强化学习', '计算机视觉', '视觉', '图像', 'nlp', 'aigc', '智能体', '算子',
        '推理框架', '训练框架', '模型训练', 'agent', 'embedding',
    )) or re.search(r'(^|[^a-z])(ai|rag)([^a-z]|$)', text):
        return '人工智能'
    if any(k in text for k in ('数据开发', '大数据', '数仓', '数据分析', '数据工程', 'etl', 'spark', 'flink', 'hadoop')):
        return '数据开发'
    if any(k in text for k in ('测试', 'qa', '质量')):
        return '测试'
    if '全栈' in text:
        return '后端开发'
    if any(k in text for k in ('前端', 'web', 'h5', 'react', 'vue', '客户端', 'ios', 'android', '小程序')):
        return '前端开发'
    if any(k in text for k in ('运维', '安全', 'sre', 'devops', '网络', '云原生', '系统工程')):
        return '运维/安全'
    if any(k in text for k in (
        '后端', '后台', '服务端', 'java', 'golang', 'python', 'c++', 'c/c++',
        'php', 'node', '架构', '微服务', '中间件', '存储', '数据库', '开发',
    )):
        return '后端开发'
    return _RAW_FIELD_MAP.get(str(raw_field or '').strip(), '其他')


def _salary_mid(lo: Any, hi: Any) -> float | None:
    try:
        lo_f, hi_f = float(lo), float(hi)
    except (TypeError, ValueError):
        return None
    if lo_f < 2000 or hi_f > 100000 or hi_f < lo_f:
        return None
    return (lo_f + hi_f) / 2


def _source_priority(source: str | None) -> int:
    return _SOURCE_PRIORITY.get((source or '').strip(), 6)


def _month_of(value: Any) -> str | None:
    if hasattr(value, 'strftime'):
        return value.strftime('%Y-%m')
    return None


# ── 数据集 ──────────────────────────────────────────────────

def clean_jobs(raw_rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    seen: set[tuple] = set()
    ordered = sorted(
        raw_rows,
        key=lambda r: (_source_priority(r.get('source')), -(r.get('id') or 0)),
    )
    for r in ordered:
        title = (r.get('title') or '').strip()
        if not title:
            continue
        company = (r.get('company_name') or '').strip() or '未知企业'
        city = (r.get('city') or '').strip() or '未知'
        lo, hi = r.get('salary_min'), r.get('salary_max')
        key = (title.casefold(), company.casefold(), city, lo, hi)
        if key in seen:
            continue
        seen.add(key)
        months = r.get('salary_months')
        skills = parse_skills(r.get('skill_tags'))
        rows.append({
            'id': r.get('id'),
            'title': title,
            'company': company,
            'city': city,
            'field': normalize_field(title, skills, r.get('technology_field')),
            'raw_field': (r.get('technology_field') or '').strip() or '其他',
            'salary_min': lo,
            'salary_max': hi,
            'salary_mid': _salary_mid(lo, hi),
            'salary_months': int(months) if isinstance(months, int) and 10 <= months <= 24 else None,
            'education': norm_education(r.get('education')),
            'experience': norm_experience(r.get('experience')),
            'skills': skills,
            'source': (r.get('source') or '未知').strip(),
            'publish_month': _month_of(r.get('publish_time')),
            'crawl_month': _month_of(r.get('crawl_time')),
            'has_publish': r.get('publish_time') is not None,
        })
    return rows


def _load_clusters(session) -> list[dict[str, Any]]:
    rows = session.execute(text("""
        SELECT c.id, c.canonical_name, c.tech_stack, c.member_count, m.job_id
        FROM job_clusters c
        LEFT JOIN job_cluster_members m ON m.cluster_id = c.id
        ORDER BY c.member_count DESC, c.id
    """)).mappings().all()
    groups: dict[int, dict[str, Any]] = {}
    for r in rows:
        cid = int(r['id'])
        group = groups.setdefault(cid, {
            'id': cid,
            'name': r['canonical_name'] or f'Cluster {cid}',
            'tech_stack': r['tech_stack'] or 'other',
            'member_count': int(r['member_count'] or 0),
            'job_ids': [],
        })
        if r['job_id'] is not None:
            group['job_ids'].append(int(r['job_id']))
    return list(groups.values())


def _load_skill_changes(session) -> list[dict[str, Any]]:
    rows = session.execute(text("""
        SELECT added_skills, removed_skills, created_at
        FROM job_skill_changes
        ORDER BY created_at
    """)).mappings().all()
    out = []
    for r in rows:
        out.append({
            'added': parse_skills(r['added_skills']),
            'removed': parse_skills(r['removed_skills']),
            'at': r['created_at'].strftime('%Y-%m-%d') if hasattr(r['created_at'], 'strftime') else None,
        })
    return out


def get_dataset() -> dict[str, Any]:
    global _DATASET, _DATASET_AT
    now = time.time()
    with _LOCK:
        if _DATASET is not None and now - _DATASET_AT < CACHE_TTL:
            return _DATASET

    session = get_session()
    try:
        raw = session.execute(text("""
            SELECT id, title, skill_tags, technology_field, company_name, city,
                   salary_min, salary_max, salary_months, education, experience,
                   source, publish_time, crawl_time
            FROM jobs
            WHERE data_type = 1
        """)).mappings().all()
        clusters = _load_clusters(session)
        changes = _load_skill_changes(session)
    finally:
        session.close()

    raw_rows = [dict(r) for r in raw]
    rows = clean_jobs(raw_rows)
    dataset = {
        'rows': rows,
        'clusters': clusters,
        'changes': changes,
        'raw_count': len(raw_rows),
        'loaded_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
    }
    with _LOCK:
        _DATASET = dataset
        _DATASET_AT = time.time()
    return dataset


# ── 过滤与统计工具 ──────────────────────────────────────────

def filter_rows(
    rows: list[dict[str, Any]],
    city: str = '',
    field: str = '',
    experience: str = '',
    education: str = '',
    salary: str = '',
) -> list[dict[str, Any]]:
    out = rows
    if city:
        out = [r for r in out if r['city'] == city]
    if field:
        out = [r for r in out if r['field'] == field]
    if experience:
        out = [r for r in out if r['experience'] == experience]
    if education:
        out = [r for r in out if r['education'] == education]
    band = SALARY_BANDS.get(salary)
    if band:
        out = [r for r in out if r['salary_mid'] is not None and band[0] <= r['salary_mid'] < band[1]]
    return out


def quantile(values: list[float], q: float) -> float | None:
    if not values:
        return None
    s = sorted(values)
    if len(s) == 1:
        return float(s[0])
    pos = (len(s) - 1) * q
    lo = math.floor(pos)
    hi = min(lo + 1, len(s) - 1)
    return s[lo] + (s[hi] - s[lo]) * (pos - lo)


def salary_stats(values: Iterable[float | None]) -> dict[str, Any]:
    vals = sorted(float(v) for v in values if v is not None)
    if not vals:
        return {'sample': 0, 'p25': None, 'p50': None, 'p75': None, 'avg': None}
    return {
        'sample': len(vals),
        'p25': round((quantile(vals, 0.25) or 0) / 1000, 1),
        'p50': round((quantile(vals, 0.5) or 0) / 1000, 1),
        'p75': round((quantile(vals, 0.75) or 0) / 1000, 1),
        'avg': round((sum(vals) / len(vals)) / 1000, 1),
    }


def _share(part: int, total: int) -> float:
    return round(part / total * 100, 1) if total else 0.0


# ── 市场全景 ────────────────────────────────────────────────

def build_overview(dataset: dict[str, Any], rows: list[dict[str, Any]]) -> dict[str, Any]:
    all_rows = dataset['rows']
    total = len(rows)
    all_total = len(all_rows)
    salary_vals = [r['salary_mid'] for r in rows if r['salary_mid'] is not None]
    median_mid = quantile(salary_vals, 0.5)
    p75_mid = quantile(salary_vals, 0.75)
    p25_mid = quantile(salary_vals, 0.25)

    kpis = {
        'jobs': total,
        'companies': len({r['company'] for r in rows if r['company'] != '未知企业'}),
        'cities': len({r['city'] for r in rows if r['city'] != '未知'}),
        'salary_samples': len(salary_vals),
        'salary_coverage': _share(len(salary_vals), total),
        'p25_salary_k': round(p25_mid / 1000, 1) if p25_mid else None,
        'median_salary_k': round(median_mid / 1000, 1) if median_mid else None,
        'p75_salary_k': round(p75_mid / 1000, 1) if p75_mid else None,
        'high_salary_ratio': _share(sum(1 for v in salary_vals if v >= 20000), len(salary_vals)),
        'skills': len({s.casefold() for r in rows for s in r['skills']}),
    }

    # 城市
    city_groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for r in rows:
        city_groups[r['city']].append(r)
    cities = []
    for city, rs in city_groups.items():
        if city == '未知':
            continue
        field_name = Counter(r['field'] for r in rs).most_common(1)
        cities.append({
            'city': city,
            'jobs': len(rs),
            'share': _share(len(rs), total),
            'companies': len({r['company'] for r in rs if r['company'] != '未知企业'}),
            'skills': len({s.casefold() for r in rs for s in r['skills']}),
            'top_field': field_name[0][0] if field_name else '其他',
            'salary': salary_stats(r['salary_mid'] for r in rs),
        })
    cities.sort(key=lambda x: -x['jobs'])
    cities = cities[:14]

    # 技术领域
    field_groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for r in rows:
        field_groups[r['field']].append(r)
    fields = []
    for field_name, rs in field_groups.items():
        city_name = Counter(r['city'] for r in rs if r['city'] != '未知').most_common(1)
        fields.append({
            'field': field_name,
            'jobs': len(rs),
            'share': _share(len(rs), total),
            'top_city': city_name[0][0] if city_name else '未知',
            'salary': salary_stats(r['salary_mid'] for r in rs),
        })
    fields.sort(key=lambda x: -x['jobs'])

    # 薪资直方图
    bins = [
        (0, 5, '<5K'), (5, 10, '5-10K'), (10, 15, '10-15K'), (15, 20, '15-20K'),
        (20, 30, '20-30K'), (30, 40, '30-40K'), (40, 60, '40-60K'), (60, 10**9, '60K+'),
    ]
    salary_hist = []
    for lo, hi, label in bins:
        count = sum(1 for v in salary_vals if lo <= v / 1000 < hi)
        salary_hist.append({'label': label, 'count': count, 'share': _share(count, len(salary_vals))})

    # 经验 / 学历薪资带
    def group_stats(key: str, order: list[str]) -> list[dict[str, Any]]:
        groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for r in rows:
            groups[r[key]].append(r)
        out = []
        for label in order:
            rs = groups.get(label, [])
            if not rs:
                continue
            out.append({
                'label': label,
                'jobs': len(rs),
                **salary_stats(r['salary_mid'] for r in rs),
            })
        return out

    salary_by_experience = group_stats('experience', EXPERIENCE_ORDER)
    salary_by_education = group_stats('education', EDUCATION_ORDER)

    # 城市 × 领域热力
    top_cities = [c['city'] for c in cities[:8]]
    top_fields = [f['field'] for f in fields[:8]]
    heat = [[0 for _ in top_fields] for _ in top_cities]
    city_idx = {c: i for i, c in enumerate(top_cities)}
    field_idx = {f: i for i, f in enumerate(top_fields)}
    for r in rows:
        ci, fi = city_idx.get(r['city']), field_idx.get(r['field'])
        if ci is not None and fi is not None:
            heat[ci][fi] += 1

    # 数据来源
    source_groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for r in rows:
        source_groups[r['source']].append(r)
    source_mix = []
    for source, rs in source_groups.items():
        source_mix.append({
            'source': source,
            'jobs': len(rs),
            'share': _share(len(rs), total),
            'salary': salary_stats(r['salary_mid'] for r in rs),
        })
    source_mix.sort(key=lambda x: -x['jobs'])
    source_mix = source_mix[:10]

    # 字段完整率
    checks = [
        ('city', '城市', lambda r: r['city'] != '未知'),
        ('company', '企业', lambda r: r['company'] != '未知企业'),
        ('salary', '薪资', lambda r: r['salary_mid'] is not None),
        ('education', '学历', lambda r: r['education'] != '未知'),
        ('experience', '经验', lambda r: r['experience'] != '未知'),
        ('skills', '技能标签', lambda r: bool(r['skills'])),
        ('publish', '发布时间', lambda r: r['has_publish']),
    ]
    completeness = [
        {'key': key, 'label': label, 'covered': sum(1 for r in rows if fn(r)), 'total': total,
         'pct': _share(sum(1 for r in rows if fn(r)), total)}
        for key, label, fn in checks
    ]

    # 薪资月数
    month_buckets = Counter()
    for r in rows:
        if r['salary_mid'] is None:
            continue
        m = r['salary_months']
        if m is None:
            month_buckets['未标注'] += 1
        elif m <= 12:
            month_buckets['12薪'] += 1
        elif m == 13:
            month_buckets['13薪'] += 1
        elif m == 14:
            month_buckets['14薪'] += 1
        else:
            month_buckets['15薪及以上'] += 1
    salary_months = [{'label': k, 'count': v} for k, v in month_buckets.most_common()]

    # 发布时间覆盖（只统计有发布时间的样本，明确不是全市场规模；未来日期不进入覆盖图）
    current_month = datetime.now().strftime('%Y-%m')
    publish_counter = Counter(
        r['publish_month'] for r in rows
        if r['publish_month'] and r['publish_month'] <= current_month
    )
    publish_months = [{'month': k, 'count': v} for k, v in sorted(publish_counter.items())]
    crawl_counter = Counter(r['crawl_month'] for r in rows if r['crawl_month'])
    crawl_months = [{'month': k, 'count': v} for k, v in sorted(crawl_counter.items())]

    # 自动结论
    insights = []
    if cities:
        top = cities[0]
        insight = f"{top['city']} 岗位量最高（{top['jobs']} 个，占 {top['share']}%）"
        if top['salary']['p50'] is not None:
            insight += f"，薪资中位数 {top['salary']['p50']}K"
        insights.append(insight)
    high_fields = [f for f in fields if f['salary']['sample'] >= 20]
    if high_fields:
        best = max(high_fields, key=lambda f: f['salary']['p50'] or 0)
        insights.append(
            f"{best['field']} 薪资中位数最高（{best['salary']['p50']}K，样本 {best['salary']['sample']} 个）"
        )
    exp_known = [e for e in salary_by_experience if e['label'] in EXPERIENCE_LEVEL and e['sample'] >= 10]
    if len(exp_known) >= 2:
        lo = min(exp_known, key=lambda e: EXPERIENCE_LEVEL[e['label']])
        hi = max(exp_known, key=lambda e: EXPERIENCE_LEVEL[e['label']])
        if lo['p50'] and hi['p50'] and hi['p50'] > lo['p50']:
            insights.append(f"{hi['label']} 岗位薪资中位数比 {lo['label']} 高 {round((hi['p50'] / lo['p50'] - 1) * 100)}%")
    if kpis['salary_coverage'] < 50:
        insights.append(f"仅 {kpis['salary_coverage']}% 的岗位带有效薪资，薪资结论按样本量解读")
    if source_mix:
        insights.append(f"样本主要来自 {source_mix[0]['source']}（{source_mix[0]['share']}%），来源结构会影响结论外推")

    filter_meta = {
        'cities': sorted({r['city'] for r in all_rows if r['city'] != '未知'}),
        'fields': [f for f in FIELD_ORDER if any(r['field'] == f for r in all_rows)],
        'experiences': [x for x in EXPERIENCE_ORDER if any(r['experience'] == x for r in all_rows)],
        'educations': [x for x in EDUCATION_ORDER if any(r['education'] == x for r in all_rows)],
        'salary_bands': [
            {'value': 'lt10', 'label': '10K 以下'},
            {'value': '10_20', 'label': '10-20K'},
            {'value': '20_30', 'label': '20-30K'},
            {'value': '30_50', 'label': '30-50K'},
            {'value': '50_plus', 'label': '50K 以上'},
        ],
    }

    return {
        'kpis': kpis,
        'cities': cities,
        'fields': fields,
        'salary_hist': salary_hist,
        'salary_by_experience': salary_by_experience,
        'salary_by_education': salary_by_education,
        'field_city_heat': {'cities': top_cities, 'fields': top_fields, 'values': heat},
        'source_mix': source_mix,
        'completeness': completeness,
        'salary_months': salary_months,
        'time_coverage': {
            'publish_months': publish_months,
            'crawl_months': crawl_months,
            'publish_samples': sum(v for _, v in publish_counter.items()),
        },
        'insights': insights,
        'filters': filter_meta,
        'meta': {
            'filtered_jobs': total,
            'all_jobs': all_total,
            'raw_jobs': dataset['raw_count'],
            'dedup_removed': dataset['raw_count'] - all_total,
            'loaded_at': dataset['loaded_at'],
            'is_filtered': total != all_total,
        },
    }


# ── 技能深潜 ────────────────────────────────────────────────

def build_skills(dataset: dict[str, Any], rows: list[dict[str, Any]]) -> dict[str, Any]:
    total = len(rows)
    salary_vals = [r['salary_mid'] for r in rows if r['salary_mid'] is not None]
    overall_median = quantile(salary_vals, 0.5)

    demand: Counter[str] = Counter()
    skill_salary: dict[str, list[float]] = defaultdict(list)
    skill_field: dict[str, Counter[str]] = defaultdict(Counter)
    for r in rows:
        for skill in {s for s in r['skills']}:
            demand[skill] += 1
            if r['salary_mid'] is not None:
                skill_salary[skill].append(r['salary_mid'])
            skill_field[skill][r['field']] += 1

    ranked = demand.most_common(32)
    demand_values = [c for _, c in ranked]
    demand_mid = quantile(demand_values, 0.5) or 0
    top_skills = []
    for name, count in ranked:
        vals = skill_salary[name]
        median = quantile(vals, 0.5)
        premium = round((median / overall_median - 1) * 100, 1) if median and overall_median else None
        if premium is None:
            quadrant = '样本不足'
        elif count >= demand_mid and premium >= 0:
            quadrant = '高需求高溢价'
        elif count >= demand_mid:
            quadrant = '市场标配'
        elif premium >= 0:
            quadrant = '小众溢价'
        else:
            quadrant = '长尾技能'
        top_skills.append({
            'name': name,
            'demand': count,
            'share': _share(count, total),
            'salary_sample': len(vals),
            'median_salary_k': round(median / 1000, 1) if median else None,
            'premium_pct': premium,
            'quadrant': quadrant,
            'field': skill_field[name].most_common(1)[0][0] if skill_field[name] else '其他',
        })

    # 共现网络：Top 30 技能，按共现次数与 lift 过滤
    network_names = [name for name, _ in demand.most_common(30)]
    network_set = set(network_names)
    pair_count: Counter[tuple[str, str]] = Counter()
    for r in rows:
        present = sorted({s for s in r['skills'] if s in network_set})
        for i in range(len(present)):
            for j in range(i + 1, len(present)):
                pair_count[(present[i], present[j])] += 1

    links = []
    for (a, b), count in pair_count.items():
        if count < 3:
            continue
        expected = demand[a] * demand[b] / total if total else 0
        lift = round(count / expected, 2) if expected else 0
        if lift < 1.05:
            continue
        links.append({'source': a, 'target': b, 'weight': count, 'lift': lift})
    links.sort(key=lambda x: (-x['weight'], -x['lift']))
    links = links[:90]

    linked_names = {name for link in links for name in (link['source'], link['target'])}
    nodes = [{
        'id': s['name'],
        'name': s['name'],
        'value': s['demand'],
        'median_salary_k': s['median_salary_k'],
        'premium_pct': s['premium_pct'],
        'field': s['field'],
    } for s in top_skills if s['name'] in network_set and s['name'] in linked_names]

    # 岗位簇景观（跟随筛选条件，只统计当前样本内的成员）
    row_by_id = {r['id']: r for r in dataset['rows']}
    filtered_ids = {r['id'] for r in rows}
    clusters = []
    for c in dataset['clusters']:
        members = [row_by_id[jid] for jid in c['job_ids'] if jid in filtered_ids]
        if not members:
            continue
        skill_counter: Counter[str] = Counter()
        for r in members:
            skill_counter.update({s for s in r['skills']})
        cities = Counter(r['city'] for r in members if r['city'] != '未知')
        clusters.append({
            'id': c['id'],
            'name': c['name'],
            'tech_stack': c['tech_stack'],
            'member_count': len(members),
            'global_member_count': c['member_count'],
            'share': _share(len(members), total),
            'top_city': cities.most_common(1)[0][0] if cities else '未知',
            'salary': salary_stats(r['salary_mid'] for r in members),
            'top_skills': [{'name': k, 'count': v} for k, v in skill_counter.most_common(6)],
        })
    clusters.sort(key=lambda x: -x['member_count'])
    clusters = clusters[:20]

    # 能力变更监测（原始记录，窗口很短，明确标注）
    added: Counter[str] = Counter()
    removed: Counter[str] = Counter()
    for change in dataset['changes']:
        added.update(set(change['added']))
        removed.update(set(change['removed']))
    change_monitor = {
        'records': len(dataset['changes']),
        'window': {
            'start': min((c['at'] for c in dataset['changes'] if c['at']), default=None),
            'end': max((c['at'] for c in dataset['changes'] if c['at']), default=None),
        },
        'added': [{'name': k, 'count': v} for k, v in added.most_common(8)],
        'removed': [{'name': k, 'count': v} for k, v in removed.most_common(8)],
        'note': '按岗位能力 diff 原始记录统计，仅覆盖最近几天，不能当作长期趋势',
    }

    return {
        'top_skills': top_skills,
        'network': {'nodes': nodes, 'links': links},
        'clusters': clusters,
        'change_monitor': change_monitor,
        'meta': {
            'jobs': total,
            'salary_samples': len(salary_vals),
            'skills': len(demand),
            'overall_median_salary_k': round(overall_median / 1000, 1) if overall_median else None,
        },
    }


# ── 招聘对标 ────────────────────────────────────────────────

def _peer_rows(
    rows: list[dict[str, Any]], own_skills: list[str], field: str,
) -> tuple[list[dict[str, Any]], str]:
    own_set = {s.casefold() for s in own_skills}
    scored = []
    for r in rows:
        overlap = len(own_set & {s.casefold() for s in r['skills']})
        if overlap:
            scored.append((overlap, r))
    strong = [r for overlap, r in scored if overlap >= 2]
    if len(strong) >= 8:
        return strong, 'same_skill'
    same_field = [r for r in rows if r['field'] == field]
    if len(same_field) >= 8:
        return same_field, 'same_field'
    if scored:
        return [r for _, r in scored], 'same_skill'
    return rows, 'market'


def build_benchmark(dataset: dict[str, Any], own_jobs: list[Job], company_name: str = '') -> dict[str, Any]:
    rows = dataset['rows']
    market_salary = [r['salary_mid'] for r in rows if r['salary_mid'] is not None]
    market_median = quantile(market_salary, 0.5)

    all_skill_demand: Counter[str] = Counter()
    for r in rows:
        all_skill_demand.update({s.casefold() for s in r['skills']})
    max_demand = max(all_skill_demand.values(), default=1)

    jobs_out = []
    for job in own_jobs:
        own_skills = parse_skills(job.skills_required)
        own_set = {s.casefold() for s in own_skills}
        field = normalize_field(job.title or '', own_skills)
        peers, peer_basis = _peer_rows(rows, own_skills, field)
        peer_salaries = [r['salary_mid'] for r in peers if r['salary_mid'] is not None]
        salary_basis = peer_basis if peer_basis in ('same_skill', 'same_field') else 'market'

        # 同技能薪资样本不足时，逐级降级到同领域 / 全市场，避免用 6 条样本下结论
        if len(peer_salaries) < 10:
            field_salaries = [
                r['salary_mid'] for r in rows
                if r['field'] == field and r['salary_mid'] is not None
            ]
            if len(field_salaries) > len(peer_salaries):
                peer_salaries = field_salaries
                salary_basis = 'same_field'
            if len(peer_salaries) < 10:
                peer_salaries = market_salary
                salary_basis = 'market'

        lo, hi = job.salary_min, job.salary_max
        own_mid_k = ((lo + hi) / 2) if lo and hi else None
        salary_pct = None
        if peer_salaries and own_mid_k:
            below = sum(1 for v in peer_salaries if v <= own_mid_k * 1000)
            salary_pct = _share(below, len(peer_salaries))

        peer_demand: Counter[str] = Counter()
        display_name: dict[str, str] = {}
        for r in peers:
            for skill in r['skills']:
                key = skill.casefold()
                peer_demand[key] += 1
                display_name.setdefault(key, skill)

        top10 = [k for k, _ in peer_demand.most_common(10)]
        coverage = _share(sum(1 for k in top10 if k in own_set), len(top10)) if top10 else None

        missing = []
        for key, count in peer_demand.most_common(30):
            if key in own_set:
                continue
            vals = [r['salary_mid'] for r in peers if any(s.casefold() == key for s in r['skills']) and r['salary_mid']]
            median = quantile(vals, 0.5)
            missing.append({
                'name': display_name.get(key, key),
                'demand': count,
                'share': _share(count, len(peers)),
                'median_salary_k': round(median / 1000, 1) if median else None,
            })
            if len(missing) >= 5:
                break

        heat = None
        if own_skills:
            heat = round(sum(all_skill_demand.get(s.casefold(), 0) / max_demand for s in own_skills) / len(own_skills) * 100, 1)

        own_level = EXPERIENCE_LEVEL.get(norm_experience(job.experience))
        friendly = None
        if own_level is not None:
            peer_levels = [EXPERIENCE_LEVEL.get(r['experience']) for r in peers]
            peer_levels = [x for x in peer_levels if x is not None]
            if peer_levels:
                stricter_share = sum(1 for x in peer_levels if x <= own_level) / len(peer_levels) * 100
                friendly = round(100 - stricter_share, 1)

        radar = [
            {'axis': '薪资竞争力', 'value': salary_pct},
            {'axis': '技能覆盖', 'value': coverage},
            {'axis': '技能热度', 'value': heat},
            {'axis': '门槛友好度', 'value': friendly},
        ]
        valid = [x['value'] for x in radar if x['value'] is not None]
        score = round(sum(valid) / len(valid), 1) if valid else None

        jobs_out.append({
            'id': job.id,
            'title': job.title,
            'location': job.location or '',
            'salary_min_k': lo,
            'salary_max_k': hi,
            'own_mid_k': own_mid_k,
            'salary_percentile': salary_pct,
            'market_salary': salary_stats(peer_salaries),
            'peer_count': len(peers),
            'peer_basis': peer_basis,
            'salary_basis': salary_basis,
            'salary_sample': len(peer_salaries),
            'skills': own_skills,
            'field': field,
            'skill_coverage': coverage,
            'skill_heat': heat,
            'experience_friendly': friendly,
            'radar': radar,
            'competitiveness': score,
            'missing_skills': missing,
            'peer_top_skills': [{'name': display_name.get(k, k), 'count': c} for k, c in peer_demand.most_common(8)],
        })

    jobs_out.sort(key=lambda x: (x['competitiveness'] is None, -(x['competitiveness'] or 0)))

    # 全企业汇总
    missing_counter: Counter[str] = Counter()
    for j in jobs_out:
        for m in j['missing_skills']:
            missing_counter[m['name']] += 1
    own_medians = [j['own_mid_k'] for j in jobs_out if j['own_mid_k']]
    own_median = quantile(own_medians, 0.5) if own_medians else None
    overall_missing = []
    for name, count in missing_counter.most_common(8):
        salary = next(
            (m['median_salary_k'] for j in jobs_out for m in j['missing_skills'] if m['name'] == name),
            None,
        )
        overall_missing.append({'name': name, 'jobs': count, 'median_salary_k': salary})

    scored_jobs = [j['competitiveness'] for j in jobs_out if j['competitiveness'] is not None]
    summary = {
        'company_name': company_name,
        'own_jobs': len(jobs_out),
        'own_median_salary_k': round(own_median, 1) if own_median else None,
        'market_median_salary_k': round(market_median / 1000, 1) if market_median else None,
        'salary_gap_pct': round((own_median * 1000 / market_median - 1) * 100, 1) if own_median and market_median else None,
        'avg_competitiveness': round(sum(scored_jobs) / len(scored_jobs), 1) if scored_jobs else None,
        'missing_skills': overall_missing,
    }

    market_counter: Counter[str] = Counter()
    for r in rows:
        market_counter.update({s for s in r['skills']})
    market_top_skills = []
    for name, count in market_counter.most_common(10):
        vals = [r['salary_mid'] for r in rows if name in r['skills'] and r['salary_mid']]
        median = quantile(vals, 0.5)
        market_top_skills.append({
            'name': name,
            'demand': count,
            'share': _share(count, len(rows)),
            'median_salary_k': round(median / 1000, 1) if median else None,
        })

    return {
        'has_jobs': bool(jobs_out),
        'summary': summary,
        'jobs': jobs_out,
        'market': {
            'median_salary_k': round(market_median / 1000, 1) if market_median else None,
            'salary_sample': len(market_salary),
            'top_skills': market_top_skills,
        },
        'meta': {
            'loaded_at': dataset['loaded_at'],
            'market_jobs': len(rows),
        },
    }
