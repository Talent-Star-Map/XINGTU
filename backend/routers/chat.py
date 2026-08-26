"""
routers/chat.py — 智能问答 (SSE 流式)
======================================

POST /api/kg/chat        body: {message, history?, job_id?}
GET  /api/kg/chat/tools  返回工具清单

SSE 事件 schema 参见 services/job_agent/agent.py
"""

from __future__ import annotations

import asyncio
import json
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


class ChatBody(BaseModel):
    message: str
    history: Optional[List[dict]] = None
    job_id: Optional[int] = None


@router.post("")
async def chat(body: ChatBody, request: Request):
    user_id = _current_user_id(request)

    async def event_gen():
        agent = get_job_agent()
        # 注入 job_id 上下文
        augmented = body.message
        if body.job_id and "job_id" not in augmented:
            augmented += f"\n\n[上下文:用户当前在查看 job_id={body.job_id}]"
        try:
            async for ev in agent.astream(augmented, user_id=user_id, history=body.history):
                # SSE 格式: data: {json}\n\n
                yield f"data: {json.dumps(ev, ensure_ascii=False)}\n\n"
                # 让前端有反应时间
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