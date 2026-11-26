"""Meaningful offline contract tests; no real credentials, database, GitHub, or LLM."""
import os
import sys
import json
import tempfile
import unittest
import asyncio
from pathlib import Path
from unittest.mock import patch, AsyncMock

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
os.environ['DATABASE_URL']='sqlite://'
os.environ['JWT_SECRET']='career-offline-only-secret-longer-than-32-characters'
from sqlalchemy import create_engine,text
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.dialects.mysql import LONGTEXT,TINYINT
from sqlalchemy.orm import sessionmaker
from services.career_schema import metadata
from services.career_store import CareerStore,CareerStoreError
from services.career_review import apply_rewrites,validated_facts
from services.career_github import repository_parts

@compiles(LONGTEXT,'sqlite')
def sqlite_longtext(*args,**kwargs):return 'TEXT'
@compiles(TINYINT,'sqlite')
def sqlite_tinyint(*args,**kwargs):return 'INTEGER'


class StoreTests(unittest.TestCase):
    def setUp(self):
        self.engine=create_engine('sqlite://')
        metadata.create_all(self.engine)
        with self.engine.begin() as conn:
            conn.execute(text('CREATE TABLE resumes (id INTEGER PRIMARY KEY, user_id INTEGER)'))
        self.store=CareerStore(sessionmaker(bind=self.engine))
        self.thread=self.store.create_thread('jobseeker:1')['id']
    def tearDown(self):self.engine.dispose()
    def test_cross_user_reads_and_mutations_are_rejected(self):
        for fn,args in [(self.store.get_thread,('jobseeker:2',self.thread)),
                        (self.store.messages,('jobseeker:2',self.thread)),
                        (self.store.append_message,('jobseeker:2',self.thread,'user','hello')),
                        (self.store.delete_thread,('jobseeker:2',self.thread))]:
            with self.assertRaises(CareerStoreError):fn(*args)
    def test_idempotency_and_parallel_thread_lock(self):
        run=self.store.create_run('jobseeker:1',self.thread,'market:2','request-one')
        duplicate=self.store.create_run('jobseeker:1',self.thread,'market:2','request-one')
        self.assertEqual(run['id'],duplicate['id']);self.assertFalse(duplicate['created'])
        self.assertTrue(self.store.claim_run('jobseeker:1',run['id']))
        self.assertFalse(self.store.claim_run('jobseeker:1',run['id']))
        self.assertTrue(self.store.acquire_thread_run('jobseeker:1',self.thread,run['id']))
        self.assertFalse(self.store.acquire_thread_run('jobseeker:1',self.thread,'another'))
        self.store.release_thread_run('jobseeker:1',self.thread,'another')
        self.assertFalse(self.store.acquire_thread_run('jobseeker:1',self.thread,'another'))
        self.store.release_thread_run('jobseeker:1',self.thread,run['id'])
        self.assertTrue(self.store.acquire_thread_run('jobseeker:1',self.thread,'another'))
        with self.assertRaises(CareerStoreError):self.store.create_run('jobseeker:1',self.thread,'market:3','request-one')
    def test_memory_conflict_requires_explicit_resolution(self):
        a=self.store.upsert_fact('jobseeker:1','preference','城市','郑州',{'type':'user_message','thread_id':self.thread}, {'quote':'想去郑州'},False)
        self.assertFalse(a['confirmed'])
        b=self.store.upsert_fact('jobseeker:1','preference','城市','上海',{'type':'user_message','thread_id':'other'}, {'quote':'想去上海'},False)
        self.assertEqual(b['status'],'conflict')
        with self.assertRaises(CareerStoreError):self.store.confirm_fact('jobseeker:2',b['id'])
        self.store.confirm_fact('jobseeker:1',b['id'])
        self.assertEqual([f['value'] for f in self.store.list_facts('jobseeker:1')],['上海'])
        with self.assertRaises(CareerStoreError):self.store.upsert_fact('jobseeker:1','skill','Java','Java',{'type':'assistant'}, {'quote':'Java'})
    def test_deleting_thread_retracts_derived_memory(self):
        self.store.upsert_fact('jobseeker:1','skill','Python','Python',{'type':'user_message','thread_id':self.thread},{'quote':'Python'})
        self.store.delete_thread('jobseeker:1',self.thread)
        self.assertEqual(self.store.list_facts('jobseeker:1'),[])
    def test_forgetting_and_refreshing_source_does_not_revive_it(self):
        args=('jobseeker:1','skill','Python','Python',{'type':'resume','attachment':'1_file.json'},{'quote':'Python'})
        fact=self.store.upsert_fact(*args)
        self.store.confirm_fact('jobseeker:1',fact['id'])
        self.assertEqual(self.store.upsert_fact(*args)['status'],'active')
        self.store.delete_fact('jobseeker:1',fact['id'])
        self.assertEqual(self.store.upsert_fact(*args)['status'],'retracted')
        self.assertEqual(self.store.list_facts('jobseeker:1'),[])


class EvidenceTests(unittest.TestCase):
    def test_forged_quote_and_wish_cannot_be_auto_confirmed(self):
        self.assertEqual(validated_facts([{'kind':'skill','value':'Java','quote':'我会Java'}],'我想学Java'),[])
    def test_fact_guard_blocks_new_metrics_and_identity(self):
        base={'projects':{'items':[{'description':'查询耗时800ms','highlights':[]}]},'personal_info':{'fullName':'张三'}}
        evidence=[{'id':'account','type':'user_entered','text':'查询耗时800ms'}]
        proposal={'rewrites':[{'path':'projects.items.0.description','text':'查询耗时80ms','source_ids':['account']},
                              {'path':'personal_info.fullName','text':'李四','source_ids':['account']}]}
        result,_,issues=apply_rewrites(base,proposal,evidence)
        self.assertEqual(result,base);self.assertEqual(len(issues),2)
    def test_unconfirmed_repo_does_not_become_personal_achievement(self):
        base={'projects':{'items':[{'description':'已有项目'}]}}
        result,_,issues=apply_rewrites(base,{'rewrites':[{'path':'projects.items.0.description','text':'我实现了缓存','source_ids':['github:1']}]},
                                      [{'id':'github:1','type':'github','text':'仓库实现了缓存'}])
        self.assertTrue(issues);self.assertEqual(result,base)
    def test_github_url_cannot_address_internal_or_arbitrary_hosts(self):
        self.assertEqual(repository_parts('https://github.com/team/project.git'),('team','project'))
        for url in ['http://github.com/a/b','https://127.0.0.1/a/b','https://github.com@evil.test/a/b','https://github.com/a/../secret','https://github.com/a/b?token=secret']:
            with self.assertRaises(ValueError):repository_parts(url)


class WorkflowTests(unittest.IsolatedAsyncioTestCase):
    async def test_api_requires_jobseeker_and_scopes_owner_from_identity(self):
        import httpx
        from fastapi import FastAPI
        from auth_guard import require_user
        from routers import career_assistant as api
        app=FastAPI();app.include_router(api.router)
        transport=httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport,base_url='http://test') as client:
            self.assertEqual((await client.get('/api/career-assistant/threads')).status_code,401)
            app.dependency_overrides[require_user]=lambda:{'user_id':2,'role':'enterprise'}
            self.assertEqual((await client.get('/api/career-assistant/threads')).status_code,403)
            app.dependency_overrides[require_user]=lambda:{'user_id':7,'role':'jobseeker'}
            with patch.object(api,'call',return_value=[]) as call:
                response=await client.get('/api/career-assistant/threads?user_id=99')
                self.assertEqual(response.status_code,200)
                call.assert_called_once_with('list_threads','jobseeker:7')

    async def test_repository_network_failure_is_recoverable(self):
        import httpx
        from services.career_github import inspect_repository
        with patch('services.career_github.httpx.AsyncClient.get',AsyncMock(side_effect=httpx.ConnectError('unavailable'))):
            with self.assertRaisesRegex(ValueError,'跳过'):
                await inspect_repository('https://github.com/team/project')

    async def test_runtime_agents_overlap_and_supervisor_blocks_save(self):
        from services import career_workflow as workflow
        temp=tempfile.TemporaryDirectory()
        engine=create_engine('sqlite:///'+str(Path(temp.name)/'test.sqlite'),connect_args={'check_same_thread':False})
        metadata.create_all(engine)
        store=CareerStore(sessionmaker(bind=engine))
        owner='jobseeker:1';tid=store.create_thread(owner)['id']
        run=store.create_run(owner,tid,'market:7','test-request')
        store.update_run(owner,run['id'],'pending',{'request':{'message':'帮我做一份简历','source_job_key':'market:7'}})
        context={'profile':{'basic':{'fullName':'张三','years':None,'bio':''},'skills':['Python'],'projects':[],'work':[],'education':[],'has_any':True},
                 'evidence':[{'id':'account','type':'user_entered','text':'Python 张三'}],'facts':[]}
        target={'job_key':'market:7','title':'Python开发','description':'使用Python','skills':['Python']}
        started=[];ready=asyncio.Event()
        async def branch(label):
            started.append(label)
            if len(started)==2:ready.set()
            await asyncio.wait_for(ready.wait(),.5)
            return {'questions':[],'requirements':[]}
        async def personal(_):return await branch('profile')
        async def job(_):return await branch('job')
        with patch.object(workflow.career_context,'load_profile',return_value=context),patch.object(workflow.career_context,'retrieve_graph',return_value=[]),\
             patch.object(workflow.career_context,'get_target',return_value=target),\
             patch.object(workflow.career_deerflow,'plan_turn',AsyncMock(return_value={'intent':'create_resume','facts':[]})),\
             patch.object(workflow.career_deerflow,'analyze_profile',personal),\
             patch.object(workflow.career_deerflow,'analyze_job',job),\
             patch.object(workflow.career_deerflow,'compose_resume',AsyncMock(return_value={'rewrites':[],'questions':[]})),\
             patch.object(workflow.career_deerflow,'supervise',AsyncMock(return_value={'approved':False,'questions':['请确认职责']})),\
             patch.object(workflow,'save_resume') as save:
            await workflow.execute_run(owner,run['id'],store)
        self.assertEqual(set(started),{'profile','job'});save.assert_not_called()
        self.assertEqual(store.get_run(owner,run['id'])['status'],'needs_input')
        self.assertIsNone(store.get_thread(owner,tid)['active_run_id'])
        engine.dispose();temp.cleanup()

    async def test_approved_resume_transaction_and_repeated_save(self):
        from services.career_workflow import save_resume
        from database import Resume,ResumeSection
        from services.career_context import load_profile
        from database import Jobseeker,Base
        from services.career_review import apply_rewrites
        engine=create_engine('sqlite://')
        metadata.create_all(engine)
        for table in (Jobseeker.__table__,Resume.__table__,ResumeSection.__table__):table.create(engine)
        with engine.begin() as conn:conn.execute(text('CREATE TABLE user_skills (id INTEGER, user_id INTEGER,skill_name TEXT,mastered INTEGER,job_id INTEGER)'))
        factory=sessionmaker(bind=engine);store=CareerStore(factory)
        s=factory();s.add(Jobseeker(id=1,password='unused',real_name='张三',skills='Python',school='示例大学',education='本科'));s.commit();s.close()
        owner='jobseeker:1';thread=store.create_thread(owner)['id']
        run=store.create_run(owner,thread,'market:7','save-once')
        sections={'personal_info':{'fullName':'张三','jobTitle':'Python开发'},'skills':{'categories':[{'name':'编程','skills':['Python']}]},
                  'projects':{'items':[]},'work_experience':{'items':[]},'education':{'items':[]},'summary':{'text':''}}
        job={'job_key':'market:7','title':'Python开发','company':'示例公司','description':'Python开发','skills':['Python']}
        with patch('database.get_session',factory):
            result=save_resume(owner,run['id'],sections,job,{},store)
            again=save_resume(owner,run['id'],sections,job,{},store)
            context=load_profile(1,store)
        self.assertEqual(result['resume_id'],again['resume_id'])
        self.assertIn('resumeId=',result['url'])
        self.assertIsNone(context['profile']['source_resume']['id'])
        self.assertEqual(store.recover_run(owner,run['id']),'completed')
        recovered=store.get_run(owner,run['id'])
        self.assertEqual(recovered['payload']['events'][0]['event'],'resume_ready')
        s=factory();self.assertEqual(s.query(Resume).count(),1);s.close();engine.dispose()


if __name__=='__main__':unittest.main()
