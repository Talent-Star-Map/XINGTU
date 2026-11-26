"""Authenticated small-star threads, memory and persistent career runs."""
import asyncio
import hashlib
import json
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from datetime import datetime
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from auth_guard import require_jobseeker
from services.career_store import CareerStore, CareerStoreError
from services.career_workflow import start_run

router=APIRouter(prefix='/api/career-assistant',tags=['career-assistant'])


def owner(me):return f'jobseeker:{me["user_id"]}'
def ok(data):return {'success':True,'data':data}


def call(method,*args,**kwargs):
    try:return getattr(CareerStore(),method)(*args,**kwargs)
    except CareerStoreError as exc:raise HTTPException(404,str(exc)) from None
    except SQLAlchemyError:raise HTTPException(503,'小星资料库尚未就绪，请联系管理员执行 career_assistant.sql') from None


@router.get('/threads')
def threads(me=Depends(require_jobseeker)):return ok(call('list_threads',owner(me)))
@router.post('/threads')
def create_thread(me=Depends(require_jobseeker)):return ok(call('create_thread',owner(me)))
@router.get('/threads/{tid}/messages')
def messages(tid:str,me=Depends(require_jobseeker)):return ok(call('messages',owner(me),tid))
@router.delete('/threads/{tid}')
def delete_thread(tid:str,me=Depends(require_jobseeker)):
    current=call('get_thread',owner(me),tid)
    if current.get('active_run_id'):raise HTTPException(409,'请等待此对话的任务完成后再删除')
    call('delete_thread',owner(me),tid);return ok(None)


@router.get('/threads/{tid}/run')
async def latest_run(tid:str,me=Depends(require_jobseeker)):
    run=call('latest_run',owner(me),tid)
    if run:
        status=call('recover_run',owner(me),run['id'])
        if status=='pending':start_run(owner(me),run['id'])
        run=call('get_run',owner(me),run['id'])
    return ok({'id':run['id'],'status':run['status'],'events':run['payload'].get('events',[])} if run else None)


@router.get('/threads/{tid}')
def thread_detail(tid:str,me=Depends(require_jobseeker)):
    return ok(call('get_thread',owner(me),tid))


class MemoryValue(BaseModel):
    value: Any = None


@router.get('/memory')
def memory(me=Depends(require_jobseeker)):return ok(call('list_facts',owner(me)))
@router.post('/memory/{fid}/confirm')
def confirm(fid:str,body:MemoryValue,me=Depends(require_jobseeker)):
    return ok(call('confirm_fact',owner(me),fid,body.value))
@router.patch('/memory/{fid}')
def edit(fid:str,body:MemoryValue,me=Depends(require_jobseeker)):
    return ok(call('confirm_fact',owner(me),fid,body.value))
@router.delete('/memory/{fid}')
def forget(fid:str,me=Depends(require_jobseeker)):
    call('delete_fact',owner(me),fid);return ok(None)


class ThreadSettings(BaseModel):
    memory_enabled:bool


@router.patch('/threads/{tid}')
def settings(tid:str,body:ThreadSettings,me=Depends(require_jobseeker)):
    current=call('get_thread',owner(me),tid)
    return ok(call('update_thread',owner(me),tid,{**current['metadata'],'memory_enabled':body.memory_enabled}))


class Turn(BaseModel):
    message:str=Field(min_length=1,max_length=4000)
    request_id:str=Field(min_length=8,max_length=100,pattern=r'^[a-zA-Z0-9_-]+$')
    source_job_key:str|None=Field(default=None,pattern=r'^market:[1-9]\d*$')
    github_url:str|None=Field(default=None,max_length=300)
    attachment_ids:list[str]=Field(default_factory=list,max_length=4)


@router.post('/threads/{tid}/turn')
async def turn(tid:str,body:Turn,request:Request,me=Depends(require_jobseeker)):
    actor=owner(me)
    await asyncio.to_thread(call,'get_thread',actor,tid)
    fingerprint=hashlib.sha256(json.dumps(body.model_dump(exclude={'request_id'}),ensure_ascii=False,sort_keys=True).encode()).hexdigest()
    run=await asyncio.to_thread(call,'create_run',actor,tid,body.source_job_key or '',body.request_id,
                              {'request':body.model_dump(),'events':[],'fingerprint':fingerprint})
    if not run['created'] and run['payload'].get('fingerprint') not in (None,fingerprint):
        raise HTTPException(409,'请求标识已用于其他消息，请重新发送')
    if run['status']=='pending':start_run(actor,run['id'])

    async def stream():
        count=0
        yield 'data: '+json.dumps({'event':'run','run_id':run['id'],'status':run['status']})+'\n\n'
        while not await request.is_disconnected():
            current=await asyncio.to_thread(call,'get_run',actor,run['id'])
            events=current['payload'].get('events',[])
            for event in events[count:]:yield 'data: '+json.dumps(event,ensure_ascii=False)+'\n\n'
            count=len(events)
            if current['status'] in ('completed','failed','needs_input','cancelled','ready'):
                yield 'data: [DONE]\n\n';return
            yield ': heartbeat\n\n'
            await asyncio.sleep(.5)
    return StreamingResponse(stream(),media_type='text/event-stream',headers={'Cache-Control':'no-store','X-Accel-Buffering':'no'})


@router.get('/runs/{rid}')
def run_status(rid:str,me=Depends(require_jobseeker)):
    run=call('get_run',owner(me),rid)
    # Requests can contain personal data; only return UI events and run state.
    return ok({'id':run['id'],'status':run['status'],'events':run['payload'].get('events',[]),'resume':run['payload'].get('resume')})
