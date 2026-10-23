"""
routers/chat.py — 智能问答 (SSE 流式)
======================================

POST /api/kg/chat        body: {message, history?, job_id?}
GET  /api/kg/chat/tools  返回工具清单

SSE 事件 schema 参见 services/job_agent/agent.py

只转发真实智能体执行事件；模型不可用时返回错误，不生成演示内容。
"""

from __future__ import annotations

import asyncio
import json
from typing import List, Optional

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from auth_dependencies import require_login
from services.job_agent import get_job_agent
from services.job_agent.tools import list_tools

router = APIRouter(prefix='/api/kg/chat', tags=['chat'])


class ChatBody(BaseModel):
    message: str
    history: Optional[List[dict]] = None
    job_id: Optional[int] = None


@router.post("")
async def chat(body: ChatBody, payload=Depends(require_login)):
    user_id = int(payload['user_id'])

    async def event_gen():
        # 注入 job_id 上下文
        augmented = body.message
        if body.job_id and "job_id" not in augmented:
            augmented += f"\n\n[上下文:用户当前在查看 job_id={body.job_id}]"

        # 正常路径
        try:
            agent = get_job_agent()
            async for ev in agent.astream(augmented, user_id=user_id,
                                          history=body.history,
                                          job_id=body.job_id):
                yield f"data: {json.dumps(ev, ensure_ascii=False)}\n\n"
                await asyncio.sleep(0.005)
            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'event': 'error', 'message': '智能问答服务暂不可用，请稍后重试'}, ensure_ascii=False)}\n\n"

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
