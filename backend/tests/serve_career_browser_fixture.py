"""Local synthetic integration fixture. Never load .env or production services."""
import os
from pathlib import Path
import sys
import json
import threading
from datetime import datetime
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
root=Path(__file__).resolve().parents[2]
folder=root/'tmp/career-browser'
folder.mkdir(parents=True,exist_ok=True)
os.environ.update(DATABASE_URL='sqlite:///'+str(folder/'fixture.sqlite'),
                  JWT_SECRET='career-browser-fixture-secret-32-characters-long',
                  LLM_CONFIG_SOURCE='env',DEEPSEEK_API_KEY='offline-only',
                  DEEPSEEK_BASE_URL='http://127.0.0.1:18882/v1',DEEPSEEK_MODEL='offline',
                  CAREER_SDK_PYTHON=str(root/'tmp/career-sdk/test-venv/Scripts/python.exe'),
                  DEER_FLOW_HOME=str(folder/'sdk-runtime'),XINGTU_SKIP_DB_INIT='1')
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.dialects.mysql import LONGTEXT,TINYINT
@compiles(LONGTEXT,'sqlite')
def _text(*args,**kwargs):return 'TEXT'
@compiles(TINYINT,'sqlite')
def _int(*args,**kwargs):return 'INTEGER'
from database import engine,Jobseeker,CrawledJob,Resume,ResumeSection,ResumeTemplate,get_session,create_token
from services.career_schema import metadata
from sqlalchemy import text
metadata.create_all(engine)
for table in (Jobseeker.__table__,CrawledJob.__table__,Resume.__table__,ResumeSection.__table__,ResumeTemplate.__table__):table.create(engine,checkfirst=True)
with engine.begin() as c:c.execute(text('CREATE TABLE IF NOT EXISTS user_skills (id INTEGER,user_id INTEGER,skill_name TEXT,mastered INTEGER,job_id INTEGER)'))
s=get_session()
if not s.query(Jobseeker).filter(Jobseeker.id==1).first():
    s.add(Jobseeker(id=1,password='unused',real_name='测试同学',skills='Python,SQL',school='示例大学',education='本科',target_city='郑州',
                    projects=json.dumps([{'name':'校园信息检索系统','description':'使用 Python 实现信息查询接口，负责接口开发和测试。'}],ensure_ascii=False)))
    s.add(CrawledJob(id=7,data_type=1,title='Python开发实习生',company_name='示例科技公司',city='郑州',
                    salary_min=4000,salary_max=6000,source='离线测试招聘源',source_url='https://example.com/jobs/7',
                    crawl_time=datetime(2026,11,26),skill_tags=['Python','SQL'],job_description='使用 Python 开发查询接口，熟悉 SQL。'))
    s.add(ResumeTemplate(id=1,name='经典简历',template_key='classic',sort_order=0,is_active=1))
    s.commit()
s.close()
(folder/'token.txt').write_text(create_token(1,'jobseeker'))


class Handler(BaseHTTPRequestHandler):
    def log_message(self,*args):pass
    def do_POST(self):
        body=json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        messages=json.dumps(body.get('messages'),ensure_ascii=False)
        if body.get('tools'):raise AssertionError('Executable tools must be disabled')
        if '求职意图与资料整理Agent' in messages:
            value={'intent':'recommend_jobs','query':'Python','facts':[],'answer':'可以先查看真实岗位。'}
        elif '个人资料证据Agent' in messages:value={'questions':[],'summary':'已有用户填写的项目与技能'}
        elif '岗位要求分析Agent' in messages:value={'requirements':[{'text':'Python','quote':'Python'}],'resume_focus':'突出接口开发'}
        elif '岗位定制简历Agent' in messages:value={'rewrites':[],'questions':[]}
        else:value={'approved':True,'issues':[],'questions':[]}
        answer=json.dumps(value,ensure_ascii=False)
        self.send_response(200)
        if body.get('stream'):
            self.send_header('Content-Type','text/event-stream');self.end_headers()
            for delta,finish in [({'role':'assistant','content':answer},None),({},'stop')]:
                payload={'id':'fixture','object':'chat.completion.chunk','created':1,'model':'offline',
                         'choices':[{'index':0,'delta':delta,'finish_reason':finish}]}
                self.wfile.write(('data: '+json.dumps(payload)+'\n\n').encode())
            self.wfile.write(b'data: [DONE]\n\n');self.wfile.flush()
        else:
            self.send_header('Content-Type','application/json');self.end_headers()
            self.wfile.write(json.dumps({'id':'fixture','object':'chat.completion','created':1,'model':'offline',
                'choices':[{'index':0,'message':{'role':'assistant','content':answer},'finish_reason':'stop'}]}).encode())


if __name__=='__main__':
    model=ThreadingHTTPServer(('127.0.0.1',18882),Handler)
    threading.Thread(target=model.serve_forever,daemon=True).start()
    from fastapi import FastAPI
    from auth_guard import APIAuthorizationMiddleware
    from routers.career_assistant import router
    from routers.resume_center import router as resumes
    import routers.resume_center as resume_router
    from services.career_context import retrieve_graph
    import services.career_context as context
    context.retrieve_graph=lambda _:[]
    app=FastAPI()
    app.add_middleware(APIAuthorizationMiddleware)
    app.include_router(router);app.include_router(resumes)
    @app.get('/api/{path:path}')
    def other(path:str):return {'success':True,'data':[]}
    import uvicorn
    server=uvicorn.Server(uvicorn.Config(app,host='127.0.0.1',port=18881,log_level='warning'))
    @app.post('/api/career-assistant/fixture-stop')
    def fixture_stop():
        from services.career_deerflow import _workers
        while not _workers.empty():_workers.get_nowait().close()
        server.should_exit=True
        return {'success':True}
    server.run()
