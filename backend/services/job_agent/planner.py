"""
job_agent/planner.py — Planner
==============================

简化版 Plan-Execute-Report 的 Plan 部分:
  Clarifier  →  TaskDecomposer  →  PlanReviewer
但实际一次 LLM 调用就完成(三步合并),保证低延迟。

输入: user_query (str) + 上下文(user_id)
输出: PlanSpec(dict-like)
"""

from __future__ import annotations

import json
import re
import uuid
from typing import Any, Dict, List, Optional

from langchain_core.messages import HumanMessage, SystemMessage

from database import get_llm_fast
from .core import TASK_TYPES, PlanSpec, TaskNode


PLANNER_PROMPT = """你是星图(XINGTU)平台的任务规划助手,基于岗位知识图谱。

你的任务:把用户的查询分解为可执行的子任务序列。严格使用以下工具之一:
{tools}

判断规则:
- "薪资/趋势/演化" → get_job_evolution(需要先 semantic_search 或 get_job_details 拿 job_id)
- "为什么变/变化原因" → get_job_changes
- "我能/适合/差距" → get_user_profile → get_gap_analysis 或 get_personal_recommend
- "找/搜索/列出岗位" → semantic_search 或 keyword_search
- "市场全貌/某时间点" → snapshot_at / timeline_anchors / get_overview
- "技能 X 还搭配什么" → get_skill_co_occurrence
- 如果需要先知道 job_id 才能做下一件事,用 depends_on 串起来

输出严格 JSON(不要任何解释/前缀):
{{
  "plan_id": "uuid",
  "tasks": [
    {{
      "task_id": "t1",
      "description": "中文描述",
      "tool": "<工具名>",
      "args": {{}},
      "depends_on": [],
      "priority": 1
    }}
  ],
  "execution_mode": "sequential"
}}

要求:
1. 子任务原子化(每个 tool 只做一件事)
2. depends_on 写清顺序
3. 任务数控制在 1-5 个
4. 如果查询模糊,直接挑最合理的工具先做,不要追问
"""

CLARIFIER_KEYWORDS = {
    "适合": "personal",
    "我": "personal",
    "差距": "personal",
    "推荐": "personal",
    "趋势": "evolution",
    "演化": "evolution",
    "薪资变化": "evolution",
    "为什么": "changes",
    "原因": "changes",
    "变化": "changes",
    "市场": "market",
    "全貌": "market",
    "搭配": "skill",
    "共现": "skill",
}


def _heuristic_plan(query: str, user_id: Optional[int]) -> Optional[List[Dict[str, Any]]]:
    """不调 LLM 的快速兜底规划 — 用关键词路由。"""
    q = query.lower()
    tasks = []
    if any(k in query for k in ["适合", "推荐", "差距", "我能", "我该"]):
        tasks.append({
            "task_id": "t1",
            "description": "取当前用户画像",
            "tool": "get_user_profile",
            "args": {},
            "depends_on": [],
            "priority": 1,
        })
        if any(k in query for k in ["适合", "差距"]):
            tasks.append({
                "task_id": "t2",
                "description": "先搜索相关岗位",
                "tool": "semantic_search",
                "args": {"query": query, "top_k": 5},
                "depends_on": ["t1"],
                "priority": 1,
            })
            tasks.append({
                "task_id": "t3",
                "description": "对搜索到的岗位做缺口分析",
                "tool": "get_personal_recommend",
                "args": {"limit": 5},
                "depends_on": ["t2"],
                "priority": 2,
            })
        else:
            tasks.append({
                "task_id": "t2",
                "description": "基于用户技能推荐岗位",
                "tool": "get_personal_recommend",
                "args": {"limit": 5},
                "depends_on": ["t1"],
                "priority": 1,
            })
        return tasks

    if any(k in query for k in ["趋势", "演化", "薪资变化", "时序", "走势"]):
        tasks.append({
            "task_id": "t1",
            "description": "语义搜索定位岗位",
            "tool": "semantic_search",
            "args": {"query": query, "top_k": 3},
            "depends_on": [],
            "priority": 1,
        })
        return tasks

    if any(k in query for k in ["为什么", "原因", "变化"]):
        tasks.append({
            "task_id": "t1",
            "description": "语义搜索定位岗位",
            "tool": "semantic_search",
            "args": {"query": query, "top_k": 3},
            "depends_on": [],
            "priority": 1,
        })
        return tasks

    if any(k in query for k in ["搭配", "组合", "共现", "邻近"]):
        tasks.append({
            "task_id": "t1",
            "description": "查找技能的共现技能",
            "tool": "get_skill_co_occurrence",
            "args": {"skill": query, "limit": 20},
            "depends_on": [],
            "priority": 1,
        })
        return tasks

    # 默认:语义搜索
    tasks.append({
        "task_id": "t1",
        "description": f"搜索: {query}",
        "tool": "semantic_search",
        "args": {"query": query, "top_k": 10},
        "depends_on": [],
        "priority": 1,
    })
    return tasks


async def make_plan(query: str, user_id: Optional[int] = None) -> PlanSpec:
    """主入口:返回 PlanSpec。"""
    tools_desc = "\n".join(f"- {k}: {v}" for k, v in TASK_TYPES.items())
    plan_id = f"plan-{uuid.uuid4().hex[:8]}"
    user_hint = f"用户已登录(user_id={user_id})。" if user_id else "用户未登录。"

    # 1. 启发式先出兜底方案(快、稳)
    heuristic_tasks = _heuristic_plan(query, user_id)

    # 2. 尝试调 LLM 改进(若可用)
    try:
        llm = get_llm_fast()
        prompt = PLANNER_PROMPT.format(tools=tools_desc) + (
            f"\n\n用户查询: {query}\n{user_hint}\n兜底方案(可改):\n"
            f"{json.dumps(heuristic_tasks, ensure_ascii=False, indent=2)}\n\n"
            "请生成最终 PlanSpec JSON。"
        )
        resp = await llm.ainvoke([
            SystemMessage(content="你是任务规划器,只输出 JSON。"),
            HumanMessage(content=prompt),
        ])
        raw = (resp.content or "").strip()
        # 取 JSON 块
        m = re.search(r"\{[\s\S]*\}", raw)
        if m:
            data = json.loads(m.group(0))
            tasks_raw = data.get("tasks") or heuristic_tasks
            tasks = [_coerce_task(t) for t in tasks_raw]
            return PlanSpec(
                plan_id=data.get("plan_id", plan_id),
                user_query=query,
                tasks=tasks,
                execution_mode=data.get("execution_mode", "sequential"),
            )
    except Exception as e:
        # LLM 失败就用启发式
        pass

    return PlanSpec(
        plan_id=plan_id,
        user_query=query,
        tasks=[_coerce_task(t) for t in heuristic_tasks],
        execution_mode="sequential",
    )


def _coerce_task(t: Dict[str, Any]) -> TaskNode:
    tool = t.get("tool", "semantic_search")
    if tool not in TASK_TYPES:
        tool = "semantic_search"
    return TaskNode(
        task_id=t.get("task_id") or f"t-{uuid.uuid4().hex[:6]}",
        description=t.get("description", ""),
        tool=tool,
        args=t.get("args", {}) or {},
        depends_on=t.get("depends_on", []) or [],
        priority=t.get("priority", 1),
    )