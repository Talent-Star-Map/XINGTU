"""Authenticated read-only graph views; collection pipeline owns graph updates."""
from fastapi import APIRouter, Query
from services.job_graph_explorer import graph_view

router=APIRouter(prefix='/api/kg/explorer',tags=['岗位图谱分层视图'])


@router.get('/view')
def explorer_view(view: str=Query('overview',pattern='^(overview|skills|stack|level|time)$'),
                  domain: str=Query('',max_length=100),role: str=Query('',max_length=150),
                  stack: str=Query('',max_length=50),level: str=Query('',max_length=30),
                  month: str=Query('',pattern='^(|[0-9]{4}-[0-9]{2})$'),source: str=Query('',max_length=100),
                  skill: str=Query('',max_length=100),limit_roles:int=Query(40,ge=1,le=80),
                  limit_skills:int=Query(12,ge=1,le=30)):
    return {'success':True,'data':graph_view(view,domain,role,stack,level,month,source,skill,limit_roles,limit_skills)}


@router.get('/employment')
def employment(stage:str=Query('nature',pattern='^(nature|roles|skills|postings|skill_roles|skill_jds)$'),
               nature:str=Query('',max_length=100),role:str=Query('',max_length=150),
               skill:str=Query('',max_length=100),source:str=Query('',max_length=100),
               level:str=Query('',max_length=30),page:int=Query(1,ge=1,le=10000)):
    from services.job_graph_explorer import employment_view
    return {'success':True,'data':employment_view(stage,nature,role,skill,source,level,page)}
