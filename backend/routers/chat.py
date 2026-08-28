"""
routers/chat.py — 智能问答 (SSE 流式)
======================================

POST /api/kg/chat        body: {message, history?, job_id?}
GET  /api/kg/chat/tools  返回工具清单

SSE 事件 schema 参见 services/job_agent/agent.py

降级:若 .env 中 DEEPSEEK_API_KEY / OPENAI_API_KEY 仍是占位符,
走 _demo_stream 演示模式(返回固定 plan + tool_call + 提示文本,不真调 LLM)。
"""

from __future__ import annotations

import asyncio
import json
import os
from typing import List, Optional

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from database import verify_token
from services.job_agent import get_job_agent
from services.job_agent.tools import list_tools

router = APIRouter(prefix='/api/kg/chat', tags=['chat'])


def _current_user_id(request: Request) -> Optional[int]:
    token = request.query_params.get("token") or request.headers.get("authorization", "").replace("Bearer ", "")
    if not token:
        return None
    try:
        payload = verify_token(token)
        return int(payload.get("user_id"))
    except Exception:
        return None


def _llm_configured() -> bool:
    """检测 LLM 是否真的配置(占位符视为未配置)。"""
    for k in ("DEEPSEEK_API_KEY", "OPENAI_API_KEY"):
        v = os.getenv(k, "")
        if v and not v.startswith("你的"):
            return True
    return False


class ChatBody(BaseModel):
    message: str
    history: Optional[List[dict]] = None
    job_id: Optional[int] = None


async def _demo_stream(message: str, job_id: Optional[int]):
    """演示模式 — LLM 未配置时,emit 一段固定 plan + report,前端能渲染但不真回答。"""
    yield {"event": "plan_started", "step": "clarifier", "mode": "demo"}
    await asyncio.sleep(0.1)

    # 演示 plan
    yield {
        "event": "plan_ready",
        "plan_id": "demo-1",
        "tasks": [
            {"task_id": "t1", "tool": "semantic_search", "description": f"语义搜索: '{message[:40]}' 相关岗位"},
            {"task_id": "t2", "tool": "list_tools",      "description": "列举可用工具"},
        ],
        "execution_mode": "sequential",
    }
    await asyncio.sleep(0.2)

    # 演示工具调用
    for tid, tname, desc, result in [
        ("t1", "semantic_search", "语义搜索定位岗位",
         {"demo": True, "matches": []}),
        ("t2", "list_tools", "列举可用工具",
         ["search_jobs", "get_job_evolution", "get_skill_co_occurrence",
          "get_user_profile", "get_gap_analysis", "get_market_trend"]),
    ]:
        yield {"event": "executor_step", "task_id": tid, "status": "running",
               "tool": tname, "description": desc}
        yield {"event": "tool_call", "task_id": tid, "tool": tname, "args": {"q": message[:40]}}
        await asyncio.sleep(0.15)
        yield {"event": "tool_result", "task_id": tid,
               "result": "(演示模式 — LLM 未配置)", "full_result": result}
        await asyncio.sleep(0.1)

    # 演示 report(逐 token)
    demo_text = (
        "⚠️ **演示模式 — LLM 未配置**\n\n"
        "当前 .env 中 `DEEPSEEK_API_KEY` 是占位符(`你的deepseek_api_key`),"
        "智能问答**不会真调大模型**,只能看到 plan + tool_call 的流程骨架。\n\n"
        "要恢复真 LLM 回复,请:\n"
        "1. 去 https://platform.deepseek.com 申请 API key\n"
        "2. 打开 `backend/.env`,把 `DEEPSEEK_API_KEY` 的值改成你的真实 key\n"
        "3. 重启 uvicorn\n\n"
        f"你刚才的提问:**{message[:80]}**\n\n"
        "等 LLM 配置好之后,这里会根据工具调用结果(streaming)生成完整回答。"
    )
    for tok in demo_text.split(""):
        if tok:
            yield {"event": "report_token", "token": tok}
            await asyncio.sleep(0.005)

    yield {
        "event": "report_done",
        "answer": demo_text,
        "references": [],
        "execution_count": 2,
        "mode": "demo",
    }


@router.post("")
async def chat(body: ChatBody, request: Request):
    user_id = _current_user_id(request)

    async def event_gen():
        # 注入 job_id 上下文
        augmented = body.message
        if body.job_id and "job_id" not in augmented:
            augmented += f"\n\n[上下文:用户当前在查看 job_id={body.job_id}]"

        # 降级:无 LLM key → 演示模式
        if not _llm_configured():
            async for ev in _demo_stream(augmented, body.job_id):
                yield f"data: {json.dumps(ev, ensure_ascii=False)}\n\n"
                await asyncio.sleep(0.005)
            yield "data: [DONE]\n\n"
            return

        # 正常路径
        try:
            agent = get_job_agent()
            async for ev in agent.astream(augmented, user_id=user_id, history=body.history):
                yield f"data: {json.dumps(ev, ensure_ascii=False)}\n\n"
                await asyncio.sleep(0.005)
            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'event': 'error', 'message': str(e)[:200]}, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # 禁用 nginx buffering
            "Connection": "keep-alive",
        },
    )


@router.get("/tools")
async def chat_tools():
    return {"success": True, "data": list_tools(), "message": "ok"}