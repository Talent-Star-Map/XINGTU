"""
job_agent/agent.py — JobAgent 主入口
====================================

把 Planner + Executor + Reporter 串成 Plan-Execute-Report 主流程,
通过 astream(message, user_id) 异步生成事件流。

事件 schema(SSE):
  {"event": "plan_started"}
  {"event": "plan_ready",      "tasks": [...]}
  {"event": "executor_step",   "task_id": "...", "status": "running"}
  {"event": "tool_call",       "task_id": "...", "tool": "...", "args": {...}}
  {"event": "tool_result",     "task_id": "...", "result": <short str>}
  {"event": "report_token",    "token": "..."}
  {"event": "report_done",     "answer": "...", "references": [...]}
  {"event": "error",           "message": "..."}
"""

from __future__ import annotations

import asyncio
import json
from typing import Any, AsyncIterator, Dict, List, Optional

from .planner import make_plan
from .tools import TOOLS, list_tools
from .reporter import stream_report, collect_references


class JobAgent:
    """单实例即可(无状态,每次 astream 是独立对话)。"""

    def __init__(self):
        self._plan = make_plan
        self._executor = TOOLS

    async def astream(
        self,
        query: str,
        user_id: Optional[int] = None,
        history: Optional[List[Dict[str, str]]] = None,
    ) -> AsyncIterator[Dict[str, Any]]:
        """生成事件流。每条事件是一个 dict,前端 SSE 渲染。"""
        yield {"event": "plan_started", "step": "clarifier"}

        try:
            plan = await self._plan(query, user_id)
            yield {
                "event": "plan_ready",
                "plan_id": plan.plan_id,
                "tasks": [t.model_dump() for t in plan.tasks],
                "execution_mode": plan.execution_mode,
            }
        except Exception as e:
            yield {"event": "error", "message": f"规划失败: {e}"}
            return

        # 2. Execute — 按 plan.tasks 顺序(或并行)执行
        executions: List[Dict[str, Any]] = []
        for task in plan.tasks:
            yield {"event": "executor_step",
                   "task_id": task.task_id,
                   "status": "running",
                   "tool": task.tool,
                   "description": task.description}
            yield {"event": "tool_call",
                   "task_id": task.task_id,
                   "tool": task.tool,
                   "args": task.args}
            fn = self._executor.get(task.tool)
            if fn is None:
                yield {"event": "tool_result",
                       "task_id": task.task_id,
                       "result": f"未知工具: {task.tool}"}
                continue
            try:
                result = await fn(task.args, user_id)
            except Exception as e:
                result = {"error": str(e)[:200]}
            # 把 result 简化成短串给前端展示
            short = _short(result)
            yield {"event": "tool_result",
                   "task_id": task.task_id,
                   "result": short,
                   "full_result": result if not isinstance(result, (str, int, float)) else None}
            executions.append({
                "task_id": task.task_id,
                "tool": task.tool,
                "args": task.args,
                "result": result,
            })

        # 3. Report — 流式生成报告
        full_answer = ""
        async for token in stream_report(query, executions):
            full_answer += token
            yield {"event": "report_token", "token": token}

        # 收集引用
        refs = collect_references(executions)
        yield {
            "event": "report_done",
            "answer": full_answer,
            "references": refs,
            "execution_count": len(executions),
        }


def _short(r: Any, max_chars: int = 200) -> str:
    if r is None: return "null"
    if isinstance(r, str): return r[:max_chars]
    try:
        s = json.dumps(r, ensure_ascii=False, default=str)
    except Exception:
        s = str(r)
    return s[:max_chars]


# 单例
_agent: Optional[JobAgent] = None


def get_job_agent() -> JobAgent:
    global _agent
    if _agent is None:
        _agent = JobAgent()
    return _agent