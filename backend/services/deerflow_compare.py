"""
DeerFlow 风格的候选人深度对比服务

核心理念（借鉴 DeerFlow 的"编排、执行、记忆"三要素）:
    1. 编排 (Plan)  — 将"候选人对比"拆解为多 Agent 协作任务
    2. 执行 (Execute) — 多个专职 Agent 串行执行，前一个的输出作为后一个的记忆
    3. 记忆 (Memory)  — Agent 间传递结构化上下文，避免信息丢失

Agent 流水线:
    Agent 1「技能迁移分析师」
        → 分析技能语义相似度、可迁移能力、技能缺口优先级
        → 输出: 每个候选人的技能深度评估
    Agent 2「综合决策报告师」（携带 Agent 1 的记忆）
        → 结合技能分析 + 经验/学历/地域/薪资，生成最终推荐
        → 输出: 排名建议 + 优势/劣势/风险点 + 推荐理由

与规则引擎的关系:
    规则引擎 (match_engine.py) 提供基础五维度分数 → 作为 Agent 的输入
    DeerFlow 编排提供语义级深度洞察 → 作为规则引擎的补充而非替代

降级策略:
    LongCat API 不可用时，返回明确错误，前端展示"AI 分析暂不可用"
    不影响规则引擎对比的正常使用

@owner: 张东阳（人岗匹配+企业端人才星界面）
"""

import os
import json
import re
import httpx
from typing import List, Dict, Any, Optional


# ─── LongCat API 配置（复用 chat_api 的配置）─────────────────────────

def _get_config() -> Dict[str, str]:
    """读取 LongCat API 配置"""
    return {
        'key': os.getenv('LONGCAT_API_KEY', ''),
        'model': os.getenv('LONGCAT_MODEL', 'LongCat-2.0'),
        'base_url': os.getenv('LONGCAT_BASE_URL', 'https://api.longcat.chat/anthropic'),
    }


def _call_llm(system_prompt: str, user_message: str, max_tokens: int = 2048) -> Optional[str]:
    """
    调用 LongCat API（Anthropic Messages 格式），返回文本内容。
    失败时返回 None，由调用方处理降级。
    """
    cfg = _get_config()
    if not cfg['key']:
        return None

    try:
        with httpx.Client(timeout=60) as client:
            r = client.post(
                f'{cfg["base_url"]}/v1/messages',
                headers={
                    'Content-Type': 'application/json',
                    'Authorization': f'Bearer {cfg["key"]}',
                    'anthropic-version': '2023-06-01',
                },
                json={
                    'model': cfg['model'],
                    'max_tokens': max_tokens,
                    'system': system_prompt,
                    'messages': [{'role': 'user', 'content': user_message}],
                }
            )
            if r.status_code != 200:
                return None
            data = r.json()
            content = data.get('content', [])
            text_parts = [c.get('text', '') for c in content if c.get('type') == 'text']
            return ''.join(text_parts) or None
    except Exception:
        return None


# ─── JSON 提取工具 ───────────────────────────────────────────────────

def _extract_json(text: str) -> Optional[Dict]:
    """
    从 LLM 输出中提取 JSON 对象。
    LLM 可能把 JSON 包在 ```json ... ``` 里，或前后带说明文字。
    """
    if not text:
        return None
    # 尝试直接解析
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    # 尝试提取代码块中的 JSON
    match = re.search(r'```(?:json)?\s*([\s\S]*?)```', text)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass
    # 尝试提取第一个 { ... } 块
    match = re.search(r'\{[\s\S]*\}', text)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            pass
    return None


# ─── Agent 1: 技能迁移分析师 ─────────────────────────────────────────

AGENT1_SYSTEM = """你是「技能迁移分析师」，一位资深技术人才评估专家。

你的职责：对多名候选人进行技能维度的深度对比分析，超越字面匹配，识别可迁移能力。

分析要点：
1. 语义相似技能识别 — 例如"Spring Boot"与"微服务开发"有强关联，"React"与"Vue"同属前端框架生态
2. 可迁移能力评估 — 候选人掌握的技能能否快速迁移到岗位所需技能（如会Docker→学K8s成本低）
3. 技能缺口优先级 — 缺失的核心技能 vs 边缘技能，学习成本高低
4. 技能深度推断 — 从技能组合推断候选人的技术深度（是"会用"还是"精通"）

输出要求：
- 必须返回严格的 JSON 格式（不要包裹在 markdown 中，直接输出 JSON）
- 对每个候选人给出技能维度的深度评估
- 对比候选人之间的技能差异，指出谁在技能维度更有优势及原因"""

AGENT1_OUTPUT_TEMPLATE = """{
  "skill_analysis": [
    {
      "candidate_id": <ID>,
      "candidate_name": "<姓名>",
      "transferable_skills": ["可迁移到岗位的技能说明1", "..."],
      "skill_gaps": [{"skill": "缺失技能", "priority": "high/medium/low", "learn_cost": "低/中/高"}],
      "depth_assessment": "技能深度推断（一句话）",
      "comparative_advantage": "相对于其他候选人的技能优势（一句话）"
    }
  ]
}"""


def _run_agent1(candidates: List[Dict], job_info: Dict) -> Optional[Dict]:
    """
    执行 Agent 1：技能迁移分析

    参数:
        candidates: 候选人列表（含 id, name, skills, match_breakdown）
        job_info: 岗位信息（含 title, skills_required, experience, education 等）
    返回:
        技能分析结果 dict，失败返回 None
    """
    # 构造候选人技能摘要
    candidate_summaries = []
    for c in candidates:
        candidate_summaries.append(
            f"- 候选人ID:{c['id']} 姓名:{c['name']}\n"
            f"  技能: {', '.join(c.get('skills', [])) or '未填写'}\n"
            f"  技能匹配分: {c.get('match_breakdown', {}).get('skill', '未知')}/100\n"
            f"  经验: {c.get('exp', '未知')}  学历: {c.get('education', '未知')}"
        )

    user_message = f"""请对以下候选人进行技能维度的深度对比分析。

【目标岗位】
岗位名称: {job_info.get('title', '未知')}
要求技能: {', '.join(job_info.get('skills_required', [])) or '未指定'}
经验要求: {job_info.get('experience', '不限')}
学历要求: {job_info.get('education', '不限')}

【候选人列表】
{chr(10).join(candidate_summaries)}

请返回如下 JSON 格式（直接输出 JSON，不要 markdown 代码块）:
{AGENT1_OUTPUT_TEMPLATE}"""

    raw = _call_llm(AGENT1_SYSTEM, user_message, max_tokens=2048)
    if not raw:
        return None
    return _extract_json(raw)


# ─── Agent 2: 综合决策报告师 ─────────────────────────────────────────

AGENT2_SYSTEM = """你是「综合决策报告师」，一位有 10 年经验的技术招聘决策顾问。

你的职责：综合技能分析结果与五维度评分，生成最终的候选人对比决策报告。

你将收到：
1. 技能迁移分析师的输出（Agent 1 的记忆）
2. 候选人的五维度匹配分数（技能/经验/学历/地域/薪资）
3. 岗位要求信息

输出要求：
- 必须返回严格的 JSON 格式（不要包裹在 markdown 中，直接输出 JSON）
- 给出明确的排名建议（rank 1=最推荐）
- 每个候选人列出 2-3 条优势、1-2 条劣势、1-2 条风险点
- 推荐理由要具体、可执行（不要"该候选人综合能力较强"这种空话）
- 给出整体对比总结和关键洞察"""

AGENT2_OUTPUT_TEMPLATE = """{
  "ranking": [
    {
      "candidate_id": <ID>,
      "candidate_name": "<姓名>",
      "rank": 1,
      "strengths": ["优势1", "优势2"],
      "weaknesses": ["劣势1"],
      "risks": ["风险点1"],
      "recommendation": "具体推荐理由（2-3句话）"
    }
  ],
  "overall_summary": "整体对比总结（3-4句话）",
  "key_insights": ["关键洞察1", "关键洞察2"]
}"""


def _run_agent2(
    candidates: List[Dict],
    job_info: Dict,
    skill_analysis: Optional[Dict],
) -> Optional[Dict]:
    """
    执行 Agent 2：综合决策报告（携带 Agent 1 的记忆）

    参数:
        candidates: 候选人列表（含五维度分数）
        job_info: 岗位信息
        skill_analysis: Agent 1 的输出（作为记忆传入）
    返回:
        最终决策报告 dict，失败返回 None
    """
    # 构造候选人五维度分数摘要
    candidate_scores = []
    for c in candidates:
        mb = c.get('match_breakdown', {})
        candidate_scores.append(
            f"- 候选人ID:{c['id']} 姓名:{c['name']}\n"
            f"  技能:{mb.get('skill', '?')} 经验:{mb.get('exp', '?')} "
            f"学历:{mb.get('edu', '?')} 地域:{mb.get('location', '?')} "
            f"薪资:{mb.get('salary', '?')} 总分:{c.get('match', '?')}\n"
            f"  意向城市: {c.get('city', '未知')}  期望薪资: {c.get('salary', '未知')}"
        )

    # Agent 1 的记忆（技能分析结果）
    skill_memory = json.dumps(skill_analysis, ensure_ascii=False, indent=2) if skill_analysis else '（技能分析不可用，请基于五维度分数自行判断）'

    user_message = f"""请综合以下信息，生成候选人对比决策报告。

【目标岗位】
{job_info.get('title', '未知')} | 要求: {', '.join(job_info.get('skills_required', [])) or '未指定'} | 经验: {job_info.get('experience', '不限')} | 学历: {job_info.get('education', '不限')}

【候选人五维度评分】
{chr(10).join(candidate_scores)}

【技能迁移分析师的分析结果（Agent 记忆）】
{skill_memory}

请综合技能分析记忆与五维度评分，返回如下 JSON 格式（直接输出 JSON，不要 markdown 代码块）:
{AGENT2_OUTPUT_TEMPLATE}"""

    raw = _call_llm(AGENT2_SYSTEM, user_message, max_tokens=2048)
    if not raw:
        return None
    return _extract_json(raw)


# ─── 编排器：串联 Agent 流水线 ────────────────────────────────────────

def run_deep_compare(candidates: List[Dict], job_info: Dict) -> Dict:
    """
    DeerFlow 编排入口 — 串联 Agent 流水线执行候选人深度对比

    流程:
        1. Agent 1「技能迁移分析师」执行 → 产出技能深度分析
        2. Agent 2「综合决策报告师」携带 Agent 1 记忆执行 → 产出最终报告

    参数:
        candidates: 候选人列表（来自规则引擎 compare API 的输出）
        job_info: 岗位信息
    返回:
        {
          "success": bool,
          "data": { ranking, overall_summary, key_insights, skill_analysis } | None,
          "error": str | None,
          "agents_trace": [...]   # Agent 执行轨迹（调试用）
        }
    """
    trace = []

    # ── Agent 1: 技能迁移分析 ──
    trace.append({'agent': '技能迁移分析师', 'status': 'running'})
    skill_analysis = _run_agent1(candidates, job_info)
    if skill_analysis:
        trace[-1]['status'] = 'done'
    else:
        trace[-1]['status'] = 'failed'
        # Agent 1 失败不终止，Agent 2 可以降级独立运行
    trace[-1]['has_output'] = skill_analysis is not None

    # ── Agent 2: 综合决策报告（携带 Agent 1 记忆）──
    trace.append({'agent': '综合决策报告师', 'status': 'running', 'memory_from': '技能迁移分析师'})
    final_report = _run_agent2(candidates, job_info, skill_analysis)
    if final_report:
        trace[-1]['status'] = 'done'
    else:
        trace[-1]['status'] = 'failed'
    trace[-1]['has_output'] = final_report is not None

    # ── 汇总输出 ──
    if not final_report:
        return {
            'success': False,
            'data': None,
            'error': 'AI 分析服务暂不可用，请稍后重试（LongCat API 未配置或调用失败）',
            'agents_trace': trace,
        }

    # 合并技能分析到最终输出（供前端展示）
    final_report['skill_analysis'] = skill_analysis
    return {
        'success': True,
        'data': final_report,
        'error': None,
        'agents_trace': trace,
    }
