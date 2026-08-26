"""JobAgent — Plan-Execute-Report 多 Agent

对外暴露:
  JobAgent   主入口,astream(message, ...) 异步生成事件

事件 schema(给前端 SSE 渲染):
  {"event": "plan_started",        "step": "clarifier"}
  {"event": "plan_ready",          "tasks": [...]}
  {"event": "tool_call",           "tool": "...", "args": {...}}
  {"event": "tool_result",         "tool": "...", "result": "..."}
  {"event": "report_token",        "token": "..."}     # 流式文字
  {"event": "report_done",         "answer": "...", "references": [...]}
  {"event": "error",               "message": "..."}

简化版:不照搬 graph-rag-agent 的 4-7 层抽象,而是保留 Plan-Execute-Report
核心精神(任务分解 → 执行 → 报告)但用最简实现:
  - Planner = 单 LLM 调用,prompt 引导输出 PlanSpec JSON
  - Executor = 按 PlanSpec 类型分发到 7 个 tool 函数
  - Reporter = 单 LLM 调用,把所有 tool 结果拼成答案
"""

from .agent import JobAgent, get_job_agent

__all__ = ["JobAgent", "get_job_agent"]