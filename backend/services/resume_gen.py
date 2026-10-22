"""
AI 简历生成/优化服务 — 调用 LLM 路由层（services/llm.py）

职责：
    1. build_resume_from_profile(profile, params, polish) — 基于用户已有资料构建 6 区块简历
    2. optimize_section(section) — 优化某个区块的措辞

设计要点（2026-10-22 改造）：
    - **不再凭空生成**：事实层（姓名/手机/邮箱/学校/学历/公司/职位/时间/项目）全部来自
      用户已填资料与已有简历，本地构建，模型碰不到这些字段
    - **润色由用户选择**：polish=False 直接用本地版本；polish=True 才交给模型改写措辞，
      并且结果要过 `resume_polish.guard_sections` 校验（数字、公司名、学校名都必须在已知范围内）
    - Mock 模式或 AI 总开关关闭时不调模型，避免把示例简历「张小明」当成生成结果
    - 复用 services/llm.py 的统一入口 complete(tier, system, messages, json_mode)
    - max_tokens 给足（8K 会截断 JSON，见 JadeAI issue#87）
    - 输出结构严格对齐前端 types/resume.ts 的区块结构

@owner: XINGTU 团队（AI 简历中心）
"""

import json
import re
from typing import Optional

from services.llm import complete, LLMTier
from services.resume_import import _group_skills
from services.resume_polish import polish_sections, numbers_in, orgs_in

# ─── 6 大区块定义 ────────────────────────────────────────────────────────────
SECTION_TITLES = {
    'personal_info': '个人信息',
    'summary': '个人简介',
    'work_experience': '工作经历',
    'education': '教育背景',
    'skills': '技能特长',
    'projects': '项目经历',
}


def _optimize_system_prompt() -> str:
    return """你是一位简历优化专家。根据用户的要求，优化给定简历区块的内容。

绝对规则：
- 只能改措辞，不得新增事实：不虚构公司、学校、项目、时间、业绩数字
- 原文出现的数字必须原样保留，不能改大也不能新增
- 人名、联系方式、公司名、学校名、日期一律不动
- 使用强动词、量化已有成果（没有数字就不要硬造数字）
- CRITICAL: 直接返回优化后的区块 JSON（结构和输入一致），不要 markdown 代码块，不要说明文字"""


def _try_parse_json(text: str) -> Optional[dict]:
    """容错解析 LLM 输出的 JSON"""
    if not text:
        return None
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    m = re.search(r'```(?:json)?\s*([\s\S]*?)```', text)
    if m:
        try:
            return json.loads(m.group(1))
        except json.JSONDecodeError:
            pass
    m = re.search(r'\{[\s\S]*\}', text)
    if m:
        try:
            return json.loads(m.group(0))
        except json.JSONDecodeError:
            pass
    return None


def _template_summary(profile: dict, params: dict, job_title: str, skills: list[str]) -> str:
    """用已知事实拼一句简介（不调模型）

    只陈述资料里存在的内容：年限、目标岗位、技能、学校学历。没有的就不写。
    """
    basic = profile.get('basic') or {}
    years = params.get('years_of_experience')
    if years in (None, ''):
        years = basic.get('years')
    bits: list[str] = []
    if years:
        bits.append(f'{years} 年{job_title}经验' if job_title else f'{years} 年工作经验')
    elif job_title:
        # 应届生（0 年）或年限未知：写求职意向，不虚报经验
        prefix = '应届生，求职意向：' if years == 0 else '求职意向：'
        bits.append(f'{prefix}{job_title}')
    if skills:
        bits.append('熟悉 ' + '、'.join(skills[:6]))
    # 学校优先取教育经历里的（比个人资料里的 school 干净），学历同理
    edu0 = (profile.get('education') or [{}])[0] if profile.get('education') else {}
    school = edu0.get('institution') or basic.get('school') or ''
    degree = edu0.get('degree') or basic.get('degree') or ''
    if school:
        bits.append(f'{school}{degree}' if degree and degree not in school else school)
    elif degree:
        bits.append(degree)
    body = ('，'.join(bits) + '。') if bits else ''
    # 自我评价放在最前，去掉自带句号再拼，避免出现「。，」这种断句
    head = str(basic.get('bio') or '').strip().rstrip('。.')
    if head:
        return head + '。' + body
    return body


def _local_sections(profile: dict, params: dict) -> dict:
    """本地构建 6 区块 —— 只搬运资料，不生成事实"""
    basic = profile.get('basic') or {}
    job_title = (params.get('job_title') or basic.get('targetPosition') or '').strip()

    skills: list[str] = []
    for s in list(params.get('skills') or []) + list(profile.get('skills') or []):
        name = str(s).strip()
        if name and name not in skills:
            skills.append(name)

    work = []
    for i, item in enumerate(profile.get('work') or []):
        work.append({
            'id': str(i + 1),
            'company': item.get('company', ''),
            'position': item.get('position', ''),
            'location': item.get('location', ''),
            'startDate': item.get('startDate') or '',
            'endDate': item.get('endDate') or None,
            'current': bool(item.get('current')),
            'description': item.get('description', ''),
            'technologies': item.get('technologies') or [],
            'highlights': item.get('highlights') or [],
        })

    education = []
    for i, item in enumerate(profile.get('education') or []):
        education.append({
            'id': str(i + 1),
            'institution': item.get('institution', ''),
            'degree': item.get('degree', ''),
            'field': item.get('field', ''),
            'location': item.get('location', ''),
            'startDate': item.get('startDate') or '',
            'endDate': item.get('endDate') or '',
            'gpa': item.get('gpa', ''),
            'highlights': item.get('highlights') or [],
        })

    projects = []
    for i, item in enumerate(profile.get('projects') or []):
        projects.append({
            'id': str(i + 1),
            'name': item.get('name', ''),
            'url': item.get('url', ''),
            'startDate': item.get('startDate') or '',
            'endDate': item.get('endDate') or '',
            'description': item.get('description', ''),
            'technologies': item.get('technologies') or [],
            'highlights': item.get('highlights') or [],
        })

    return {
        'personal_info': {
            'fullName': basic.get('fullName', ''),
            'jobTitle': job_title,
            'email': basic.get('email', ''),
            'phone': basic.get('phone', ''),
            'location': basic.get('city', ''),
            'website': '', 'github': '', 'linkedin': '',
        },
        'summary': {'text': _template_summary(profile, params, job_title, skills)},
        'work_experience': {'items': work},
        'education': {'items': education},
        'skills': {'categories': _group_skills(skills) if skills else []},
        'projects': {'items': projects},
    }


def build_resume_from_profile(profile: dict, params: dict, polish: bool = True) -> dict:
    """按用户已有资料生成简历

    profile: services/resume_profile.collect_profile() 的返回值
    params:  job_title / years_of_experience / skills / industry / language
    polish:  是否让模型润色措辞（用户自主选择）

    返回 {success, data: {resume, source, polished, profile_meta, warnings}, error}
    """
    sections = _local_sections(profile, params)
    polished = False
    source = 'profile'

    warnings: list[str] = []
    if not profile.get('has_any'):
        warnings.append('你的账号还没有填写任何资料，已生成空白框架，请先补个人信息')
    elif profile.get('missing'):
        warnings.append('资料里还缺：' + '、'.join(profile['missing']))
    if not (sections['work_experience']['items'] or sections['projects']['items']):
        warnings.append('没有工作或项目经历，这部分留空了，请在编辑器里补充')

    if polish:
        result = polish_sections(sections, profile, params)
        if result:
            sections = result['sections']
            polished = True
            source = 'profile+ai'
        else:
            # 模型没配、Mock 模式、输出不合规都会走到这里：如实告诉用户，别假装润色过
            warnings.append('AI 润色这次没有生效（模型未启用或返回内容不合规），已使用资料原文')

    return {
        'success': True,
        'data': {
            'resume': sections,
            'source': source,
            'polished': polished,
            'profile_meta': {
                'filled': profile.get('filled') or [],
                'missing': profile.get('missing') or [],
                'has_any': bool(profile.get('has_any')),
                'skill_count': len(profile.get('skills') or []),
                'work_count': len(profile.get('work') or []),
                'source_resume_id': (profile.get('source_resume') or {}).get('id'),
            },
            'warnings': warnings,
        },
        'error': None,
    }


def optimize_section(section_type: str, content: dict, instruction: str = '优化措辞', language: str = 'zh') -> dict:
    """优化简历某个区块的内容（编辑器里用户主动点的那次）

    section_type: personal_info/summary/work_experience/education/skills/projects
    content:      该区块当前内容（dict）
    instruction:  用户想怎么改
    返回: {success, data: {content: 优化后dict, source}, error}
    """
    prompt = f"""请优化以下「{SECTION_TITLES.get(section_type, section_type)}」区块。用户要求：{instruction}

原始内容（JSON）:
{json.dumps(content, ensure_ascii=False)}

返回优化后的区块 JSON（结构和输入一致，直接输出 JSON，不要 markdown 代码块）。"""

    try:
        result = complete(
            LLMTier.STRONG,
            _optimize_system_prompt(),
            [{'role': 'user', 'content': prompt}],
            json_mode=True,
            max_tokens=8192,
        )
        data = result.get('raw')
        if not data:
            data = _try_parse_json(result.get('text', ''))
        if not data:
            return {'success': False, 'error': '模型输出无法解析为 JSON'}
        # 逐区块优化也守着同一条线：不许出现原文没有的数字、公司或学校
        src = json.dumps(content, ensure_ascii=False)
        dst = json.dumps(data, ensure_ascii=False)
        extra_nums = numbers_in(dst) - numbers_in(src)
        src_orgs = orgs_in(src)
        extra_orgs = {o for o in orgs_in(dst)
                      if not any(o == k or o in k or k in o for k in src_orgs)}
        if extra_nums or extra_orgs:
            return {
                'success': False,
                'error': '优化结果里出现了原文没有的内容，已取消本次优化（请重试或换个说法）',
            }
        return {'success': True, 'data': {'content': data, 'source': result.get('provider', 'llm')}, 'error': None}
    except Exception as e:
        return {'success': False, 'error': str(e)}
