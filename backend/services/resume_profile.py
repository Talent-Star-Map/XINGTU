"""
用户资料汇总 —— AI 生成简历的唯一事实来源

背景（2026-10-22）：
    原先 `/api/resume-center/generate` 只把弹窗里的「岗位名/年限/行业/技能」拼进提示词，
    姓名、邮箱、公司、学校全部由模型编造（实际会生成「张明轩 / 云帆科技 / 北京邮电大学」）。
    用户要求「不能凭空捏造，要根据用户已有资料生成」，所以这里把用户已经填过的东西
    汇总成一个 profile，生成时只允许使用其中的事实。

资料来源（按优先级合并）：
    1. jobseekers 表：real_name / phone / email / city / school / education /
       target_position / experience / skills / bio
    2. 用户已有简历（最近更新的一份）：工作、教育、项目、技能区块
    3. user_skills 表（学习路径里勾了「已掌握」的技能）

设计原则：
    - 只读，不改任何数据
    - 缺什么就返回空，不做任何推测（不猜城市、不猜毕业时间）
    - 输出的 filled / missing 给前端弹窗展示，让用户知道这次生成会用到什么
"""

import json
import re
from typing import Optional

from sqlalchemy import text

from database import Jobseeker, Resume, ResumeSection

# 技能分隔符：中英文逗号、顿号、分号、斜杠、竖线、换行
_SKILL_SPLIT = re.compile(r'[,，、;；/|｜\n\r\t]+')


def split_skills(raw) -> list[str]:
    """把「Python、Java, MySQL」这类字符串拆成技能列表（去重保序）"""
    if not raw:
        return []
    if isinstance(raw, (list, tuple)):
        items: list[str] = []
        for x in raw:
            items.extend(split_skills(x))
        return items
    out: list[str] = []
    for part in _SKILL_SPLIT.split(str(raw)):
        name = part.strip().strip('·-—*• ')
        if name and len(name) <= 40 and name not in out:
            out.append(name)
    return out


def parse_years(raw) -> Optional[int]:
    """从「3年」「三年工作经验」「应届生」这类文本里解析年限，解析不出返回 None"""
    if raw is None:
        return None
    s = str(raw).strip()
    if not s:
        return None
    m = re.search(r'(\d+(?:\.\d+)?)\s*年', s)
    if m:
        return int(float(m.group(1)))
    if re.fullmatch(r'\d+', s):
        return int(s)
    cn = {'一': 1, '二': 2, '两': 2, '三': 3, '四': 4, '五': 5,
          '六': 6, '七': 7, '八': 8, '九': 9, '十': 10}
    m = re.search(r'([一二两三四五六七八九十])\s*年', s)
    if m:
        return cn.get(m.group(1))
    if '应届' in s or '在校' in s or '实习' in s:
        return 0
    return None


# 早期「AI 生成简历」保存下来的标题样式
_AI_TITLE_HINT = re.compile(r'AI生成|AI 生成|AI润色|AI 润色|资料生成', re.I)

# 学历词：用来把误写进「学校」字段的学历拆出来
_DEGREE_WORDS = ('博士', '硕士', '本科', '大专', '专科', '研究生')


def normalize_school_degree(school: str, degree: str) -> tuple[str, str]:
    """清洗「数据科学与大数据技术（本科）」这类把学历塞进学校的写法

    老解析器把专业和学历一起写进了 school，直接拼进简介会出现「…（本科）本科」。
    这里只做括号剥离与学历回填，不猜学校名（猜错比留空更糟）。
    """
    s = (school or '').strip()
    d = (degree or '').strip()
    if not s:
        return s, d
    for w in _DEGREE_WORDS:
        if f'（{w}）' in s or f'({w})' in s:
            s = s.replace(f'（{w}）', '').replace(f'({w})', '').strip()
            d = d or w
    return s, d


def _renumber(items: list[dict], prefix: str) -> list[dict]:
    """给条目重编 id（复制自已有简历时 id 会重复）"""
    out = []
    for i, item in enumerate(items or []):
        if not isinstance(item, dict):
            continue
        copy = dict(item)
        copy['id'] = f'{prefix}-{i + 1}'
        out.append(copy)
    return out


def _section_map(session, resume_id: int) -> dict[str, dict]:
    """取某份简历的 区块类型 → content"""
    rows = (session.query(ResumeSection)
            .filter(ResumeSection.resume_id == resume_id)
            .order_by(ResumeSection.sort_order).all())
    out: dict[str, dict] = {}
    for r in rows:
        if isinstance(r.content, dict):
            out.setdefault(r.section_type, r.content)
    return out


def _skills_from_sections(sections: dict[str, dict]) -> list[str]:
    out: list[str] = []
    cats = (sections.get('skills') or {}).get('categories') or []
    for cat in cats:
        for s in (cat or {}).get('skills') or []:
            name = str(s).strip()
            if name and name not in out:
                out.append(name)
    return out


def _mastered_skills(session, user_id: int) -> list[str]:
    """学习路径里标记为「已掌握」的技能；表不存在或查询失败时返回空"""
    try:
        rows = session.execute(
            text('SELECT skill_name FROM user_skills WHERE user_id = :uid AND mastered = 1'),
            {'uid': user_id},
        ).fetchall()
    except Exception:
        return []
    out: list[str] = []
    for (name,) in rows:
        name = str(name or '').strip()
        if name and name not in out:
            out.append(name)
    return out


def _project_items_from_raw(raw) -> list[dict]:
    """jobseekers.projects 是个文本字段，兼容 JSON 数组与普通字符串"""
    if not raw:
        return []
    data = raw
    if isinstance(raw, str):
        s = raw.strip()
        if not s:
            return []
        try:
            data = json.loads(s)
        except Exception:
            return []
    if isinstance(data, dict):
        data = [data]
    if not isinstance(data, list):
        return []
    items: list[dict] = []
    for i, x in enumerate(data):
        if isinstance(x, str):
            name, desc = x.strip(), ''
        elif isinstance(x, dict):
            name = str(x.get('name') or x.get('title') or x.get('project') or '').strip()
            desc = str(x.get('description') or x.get('desc') or x.get('detail') or '').strip()
        else:
            continue
        if not name and not desc:
            continue
        items.append({
            'id': f'proj-{i + 1}',
            'name': name or desc[:30],
            'url': '',
            'startDate': '',
            'endDate': '',
            'description': desc if name else '',
            'technologies': [],
            'highlights': [],
        })
    return items


def collect_profile(session, user_id: int) -> dict:
    """汇总用户已有资料（账号资料 + 最近更新的一份简历）"""
    seeker = session.query(Jobseeker).filter(Jobseeker.id == user_id).first()

    latest = (session.query(Resume)
              .filter(Resume.user_id == user_id)
              .order_by(Resume.updated_at.desc(), Resume.id.desc())
              .first())
    sections = _section_map(session, latest.id) if latest else {}

    school_raw = (seeker.school or '').strip() if seeker else ''
    degree_raw = (seeker.education or '').strip() if seeker else ''
    school_clean, degree_clean = normalize_school_degree(school_raw, degree_raw)
    basic = {
        'fullName': (seeker.real_name or '').strip() if seeker else '',
        'phone': (seeker.phone or '').strip() if seeker else '',
        'email': (seeker.email or '').strip() if seeker else '',
        'city': ((seeker.city or '') or (seeker.target_city or '')).strip() if seeker else '',
        'school': school_clean,
        'degree': degree_clean,
        'targetPosition': (seeker.target_position or '').strip() if seeker else '',
        'expectedSalary': (seeker.expected_salary or '').strip() if seeker else '',
        'bio': (seeker.bio or '').strip() if seeker else '',
        'years': parse_years(seeker.experience) if seeker else None,
    }

    # 技能：个人资料 > 已有简历 > 学习路径已掌握
    profile_skills = split_skills(seeker.skills) if seeker else []
    resume_skills = _skills_from_sections(sections)
    learned = _mastered_skills(session, user_id)
    skills: list[str] = []
    for group in (profile_skills, resume_skills, learned):
        for s in group:
            if s not in skills:
                skills.append(s)

    work = _renumber((sections.get('work_experience') or {}).get('items') or [], 'work')
    education = _renumber((sections.get('education') or {}).get('items') or [], 'edu')
    projects = _renumber((sections.get('projects') or {}).get('items') or [], 'proj')
    if not projects and seeker:
        projects = _project_items_from_raw(seeker.projects)

    # 个人资料里只有学校/学历、没有教育条目时，补一条（时间留空，不猜）
    if not education and (basic['school'] or basic['degree']):
        education = [{
            'id': 'edu-1',
            'institution': basic['school'],
            'degree': basic['degree'],
            'field': '',
            'location': '',
            'startDate': '',
            'endDate': '',
            'gpa': '',
            'highlights': [],
        }]

    filled: list[str] = []
    missing: list[str] = []
    checks = [
        ('姓名', basic['fullName']),
        ('手机号', basic['phone']),
        ('邮箱', basic['email']),
        ('所在城市', basic['city']),
        ('学校', basic['school'] or (education[0].get('institution') if education else '')),
        ('学历', basic['degree'] or (education[0].get('degree') if education else '')),
        ('目标岗位', basic['targetPosition']),
        ('技能', skills),
        ('工作经历', work),
        ('教育经历', education),
        ('项目经历', projects),
    ]
    for label, value in checks:
        (filled if value else missing).append(label)

    return {
        'basic': basic,
        'skills': skills,
        'work': work,
        'education': education,
        'projects': projects,
        'filled': filled,
        'missing': missing,
        'has_any': bool(filled),
        'source_resume': {
            'id': latest.id if latest else None,
            'title': latest.title if latest else '',
            # 标题里带这些字样说明内容是模型写过的，前端要提醒用户核对再使用
            'ai_generated': bool(latest and _AI_TITLE_HINT.search(latest.title or '')),
        },
        'skill_sources': {
            'profile': len(profile_skills),
            'resume': len(resume_skills),
            'learned': len(learned),
        },
    }


def profile_preview(profile: dict) -> dict:
    """给前端弹窗看的精简版（不含经历明细，避免几百行 JSON 传过去）"""
    basic = profile['basic']
    edu0 = (profile.get('education') or [{}])[0] if profile.get('education') else {}
    return {
        'fullName': basic['fullName'],
        'phone': basic['phone'],
        'email': basic['email'],
        'city': basic['city'],
        # 教育经历里的学校更可信：个人资料的 school 字段历史上有把专业写进去的
        'school': edu0.get('institution') or basic['school'],
        'degree': edu0.get('degree') or basic['degree'],
        'targetPosition': basic['targetPosition'],
        'years': basic['years'],
        'skills': profile['skills'][:20],
        'skillCount': len(profile['skills']),
        'workCount': len(profile['work']),
        'educationCount': len(profile['education']),
        'projectCount': len(profile['projects']),
        'filled': profile['filled'],
        'missing': profile['missing'],
        'hasAny': profile['has_any'],
        'sourceResume': {
            'id': (profile.get('source_resume') or {}).get('id'),
            'title': (profile.get('source_resume') or {}).get('title', ''),
            'aiGenerated': bool((profile.get('source_resume') or {}).get('ai_generated')),
        },
    }
