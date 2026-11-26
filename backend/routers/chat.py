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
from typing import List, Optional, Literal

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from starlette.concurrency import run_in_threadpool
from pydantic import BaseModel, Field

from auth_dependencies import require_login
from services.job_agent import get_job_agent
from services.job_agent.tools import list_tools
from services import chat_materials

router = APIRouter(prefix='/api/kg/chat', tags=['chat'])


class HistoryTurn(BaseModel):
    role: Literal['user', 'assistant']
    content: str = Field(min_length=1, max_length=4000)


class ChatBody(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    history: Optional[List[HistoryTurn]] = Field(default=None, max_length=12)
    job_id: Optional[int] = Field(default=None, ge=1)
    attachment_ids: List[str] = Field(default_factory=list, max_length=4)


@router.post('/attachments')
async def upload_attachment(file: UploadFile = File(...), payload=Depends(require_login)):
    try:
        data = await file.read(chat_materials.MAX_BYTES + 1)
        material = await run_in_threadpool(chat_materials.prepare_material, file.filename or '', data)
        saved = await run_in_threadpool(chat_materials.save_material, chat_materials.owner_key(payload), material)
        return {'success': True, 'data': saved, 'message': 'ok'}
    except chat_materials.MaterialError as exc:
        raise HTTPException(422, str(exc)) from None
    finally:
        await file.close()


@router.delete('/attachments/{identifier}')
def delete_attachment(identifier: str, payload=Depends(require_login)):
    try:
        chat_materials.remove_material(chat_materials.owner_key(payload), identifier)
    except chat_materials.MaterialError as exc:
        raise HTTPException(404, str(exc)) from None
    return {'success': True, 'data': None, 'message': 'ok'}


@router.post("")
async def chat(body: ChatBody, payload=Depends(require_login)):
    # Enterprise/admin IDs may collide with jobseeker IDs; do not cross roles.
    user_id = int(payload['user_id']) if payload.get('role') == 'jobseeker' else None
    try:
        materials = await run_in_threadpool(chat_materials.load_materials, chat_materials.owner_key(payload), body.attachment_ids)
    except chat_materials.MaterialError as exc:
        raise HTTPException(422, str(exc)) from None

    async def event_gen():
        # 注入 job_id 上下文
        augmented = body.message
        if body.job_id and "job_id" not in augmented:
            augmented += f"\n\n[上下文:用户当前在查看 job_id={body.job_id}]"

        # 正常路径
        try:
            if materials:
                yield 'data: {"event":"materials_started"}\n\n'
            context = await run_in_threadpool(chat_materials.material_context, materials, body.message)
            agent = get_job_agent()
            async for ev in agent.astream(augmented, user_id=user_id,
                                          history=[turn.model_dump() for turn in body.history] if body.history else None,
                                          job_id=body.job_id, material_context=context):
                yield f"data: {json.dumps(ev, ensure_ascii=False)}\n\n"
                await asyncio.sleep(0.005)
            yield "data: [DONE]\n\n"
        except chat_materials.MaterialError as exc:
            yield f"data: {json.dumps({'event': 'error', 'message': str(exc)}, ensure_ascii=False)}\n\n"
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
