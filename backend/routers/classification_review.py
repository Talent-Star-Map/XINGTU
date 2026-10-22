"""Admin-only classification proposals and version-checked human decisions."""
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from pydantic import BaseModel, Field
from auth_guard import require_admin
from services import classification_agent as agent

router=APIRouter(prefix='/api/admin/classification',tags=['岗位分类审核'],dependencies=[Depends(require_admin)])

class Batch(BaseModel):
    ids:list[str]=Field(min_length=1,max_length=5)

class Decision(BaseModel):
    action:Literal['approve','reject','defer']
    version:int=Field(ge=0)
    decision:Literal['classify','non_it','insufficient']='classify'
    nature:str=Field('',max_length=100)
    role:str=Field('',max_length=150)
    note:str=Field(min_length=1,max_length=1500)


def invoke(fn,*args):
    try:return {'success':True,'data':fn(*args)}
    except agent.ReviewConflict as e:raise HTTPException(409,str(e)) from None
    except ValueError as e:raise HTTPException(400,str(e)) from None

@router.get('/tasks')
def tasks(status:Literal['all','new','generating','pending','failed','approved','rejected','deferred']='all',
          search:str=Query('',max_length=150),page:int=Query(1,ge=1)):
    return invoke(agent.task_list,status,search,page)

@router.get('/tasks/{id}')
def detail(id:str):return invoke(agent.detail,id)

@router.post('/tasks/{id}/suggest')
def suggest(id:str,me:dict=Depends(require_admin)):
    return invoke(agent.generate,id,me['user_id'])

@router.post('/suggest-batch')
def batch(body:Batch,background:BackgroundTasks,me:dict=Depends(require_admin)):
    ids=list(dict.fromkeys(body.ids))
    for id in ids:
        invoke(agent.source_row,id)
    def run():
        for id in ids:
            try:agent.generate(id,me['user_id'])
            except (ValueError,agent.ReviewConflict):pass
    background.add_task(run)
    return {'success':True,'data':{'accepted':len(ids)}}

@router.post('/tasks/{id}/decision')
def decide(id:str,body:Decision,me:dict=Depends(require_admin)):
    return invoke(agent.decide,id,body.action,body.version,body.decision,body.nature,body.role,body.note,me['user_id'])
