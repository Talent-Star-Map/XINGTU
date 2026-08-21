"""
AI 简历生成/优化服务 — 调用 LLM 路由层（services/llm.py）

职责：
    1. generate_resume(params) — 根据岗位信息生成完整 6 区块简历 JSON
    2. optimize_section(section) — 优化某个区块的措辞

设计要点：
    - 复用 services/llm.py 的统一入口 complete(tier, system, messages, json_mode)
    - 开发期 Mock 模式返回预设假数据，不消耗外部 API
    - max_tokens 给足 16384（对齐 JadeAI issue#87：8K 会截断 JSON 导致解析失败）
    - 输出结构严格对齐前端 types/resume.ts 的区块结构

@owner: XINGTU 团队（AI 简历中心）
"""

import json
import re
from typing import Optional

from services.llm import complete, LLMTier

# ─── 6 大区块定义 ────────────────────────────────────────────────────────────
SECTION_TITLES = {
    'personal_info': '个人信息',
    'summary': '个人简介',
    'work_experience': '工作经历',
    'education': '教育背景',
    'skills': '专业技能',
    'projects': '项目经历',
}

# 生成结果的结构化 schema（提示词里写死，要求 LLM 严格返回）
GENERATE_SCHEMA_DESC = """返回一个 JSON 对象，必须包含以下 6 个顶层键，结构严格如下：
{
  "personal_info": { "fullName": "", "jobTitle": "", "email": "", "phone": "", "location": "", "website": "", "github": "", "linkedin": "" },
  "summary": { "text": "一段 2-3 句话的个人简介" },
  "work_experience": { "items": [ { "id": "1", "company": "", "position": "", "location": "", "startDate": "YYYY-MM", "endDate": "YYYY-MM 或 null", "current": false, "description": "", "technologies": [], "highlights": [] } ] },
  "education": { "items": [ { "id": "1", "institution": "", "degree": "", "field": "", "location": "", "startDate": "YYYY-MM", "endDate": "YYYY-MM", "gpa": "", "highlights": [] } ] },
  "skills": { "categories": [ { "id": "1", "name": "分类名", "skills": ["技能1", "技能2"] } ] },
  "projects": { "items": [ { "id": "1", "name": "", "url": "", "startDate": "", "endDate": "", "description": "", "technologies": [], "highlights": [] } ] }
}
注意：
- 直接输出 JSON，不要 markdown 代码块，不要任何说明文字
- 工作经历条目数随经验年限：1-2(初级) / 2-3(中级) / 3-4(高级)
- 每个工作/项目条目 3-5 条 highlight，用具体可量化的成果（如"性能提升40%"）
- 技能按类别组织（如"编程语言"/"AI框架"/"工具"）
"""


def _generate_system_prompt(language: str) -> str:
    lang = 'English' if language == 'en' else 'Simplified Chinese'
    return f"""你是一位专业的简历撰写专家。请用{lang}生成一份完整、真实、专业的简历。

生成规范：
- 内容要具体可量化（如"性能提升 40%""带领 8 人团队"）
- 公司名/学校名/项目名要合理可信
- 使用强动词开头（如"主导""构建""优化"）
- 日期格式 YYYY-MM
- 个人信息生成合理的姓名、邮箱、电话、城市，不要用明显假数据
- CRITICAL: 你是 JSON API，整个响应必须是一个合法的 JSON 对象，以 {{ 开头以 }} 结尾，不要 markdown 语法，不要代码块"""


def _optimize_system_prompt() -> str:
    return """你是一位简历优化专家。根据用户的要求，优化给定简历区块的内容。
要求：
- 保持事实不变，只改进表达：更专业、更简洁、更有说服力
- 使用强动词、量化成果
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


def generate_resume(params: dict) -> dict:
    """根据岗位信息生成完整简历 JSON

    params:
        job_title: str           岗位名称
        years_of_experience: int 经验年限
        skills: list[str]        已有技能（可选）
        industry: str            行业（可选）
        experience: str          工作经历描述（可选，会被解析进 work_experience）
        language: str            语言 zh/en
    返回:
        {success, data: {resume: <6区块dict>, source: 'mock'|'llm'}, error}
    """
    job_title = params.get('job_title', '')
    years = params.get('years_of_experience', 0)
    skills = params.get('skills', [])
    industry = params.get('industry', '')
    experience = params.get('experience', '')
    language = params.get('language', 'zh')

    skills_ctx = f'\n要包含的技能: {", ".join(skills)}' if skills else ''
    industry_ctx = f'\n行业: {industry}' if industry else ''
    exp_ctx = f'\n\n候选人提供的工作经历描述（请解析进 work_experience 并用于生成 summary/skills/projects）:\n---\n{experience}\n---' if experience else ''

    prompt = f"""为「{job_title}」岗位生成本简历（{years} 年经验）。{skills_ctx}{industry_ctx}{exp_ctx}

{GENERATE_SCHEMA_DESC}"""

    try:
        result = complete(
            LLMTier.STRONG,
            _generate_system_prompt(language),
            [{'role': 'user', 'content': prompt}],
            json_mode=True,
            max_tokens=16384,
        )
        data = result.get('raw')
        if not data:
            data = _try_parse_json(result.get('text', ''))
        if not data:
            return {'success': False, 'error': '模型输出无法解析为 JSON'}
        return {'success': True, 'data': {'resume': data, 'source': result.get('provider', 'llm')}, 'error': None}
    except Exception as e:
        return {'success': False, 'error': str(e)}


def optimize_section(section_type: str, content: dict, instruction: str = '优化措辞', language: str = 'zh') -> dict:
    """优化简历某个区块的内容

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
        return {'success': True, 'data': {'content': data, 'source': result.get('provider', 'llm')}, 'error': None}
    except Exception as e:
        return {'success': False, 'error': str(e)}
