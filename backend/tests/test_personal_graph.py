"""Offline graph mapping and ownership regression; never connects to cloud data."""
import os, sys, unittest
from pathlib import Path
from datetime import datetime
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
os.environ['DATABASE_URL']='sqlite://'
os.environ['JWT_SECRET']='personal-graph-offline-test-secret-abcdefghijklmnopqrstuvwxyz'
from sqlalchemy import create_engine, text
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import sessionmaker
from fastapi import FastAPI
from fastapi.testclient import TestClient
import database
from services.personal_graph import build_graph,load_personal_graph

class MappingTests(unittest.TestCase):
    def test_explicit_technologies_shared_nodes_and_quotes(self):
        g=build_graph({'skills':['Python','python3','Docker'], 'projects':[{'name':'A','technologies':['Python','FastAPI']},{'name':'B','technologies':['python3']}], 'work':[{'company':'C','description':'使用Python构建接口'}]})
        self.assertEqual(g['summary'],{'experiences':3,'skills':3,'supportedSkills':2,'unlinkedSkills':1})
        self.assertEqual(len(g['evidence']),4)
        skills=[n for n in g['nodes'] if n['kind']=='skill']
        self.assertEqual(len(next(n for n in skills if n['name']=='Python')['experienceIds']),3)
        for e in g['edges']:
            if e['kind']=='supported': self.assertTrue(any(p['id']==e['evidenceId'] for p in g['evidence']))
    def test_no_title_company_substring_or_negated_inference(self):
        g=build_graph({'skills':['Java','Python','Go'], 'projects':[{'name':'Python Go','description':'JavaScript实现；未使用Python'}], 'work':[{'company':'Java公司'}]})
        self.assertEqual(g['summary']['supportedSkills'],0)
        self.assertEqual(len(g['evidence']),0)
    def test_empty_malformed_and_stable_ids(self):
        self.assertEqual(build_graph({})['summary']['skills'],0)
        self.assertEqual(len(build_graph({'projects':[None,{},1]})['nodes']),1)
        a=build_graph({'skills':['Python','Java']});b=build_graph({'skills':['Java','Python']})
        self.assertEqual({n['name']:n['id'] for n in a['nodes']},{n['name']:n['id'] for n in b['nodes']})

class OwnershipTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine=create_engine('sqlite://',connect_args={'check_same_thread':False},poolclass=StaticPool)
        database.Jobseeker.__table__.create(cls.engine)
        database.Resume.__table__.create(cls.engine)
        database.ResumeSection.__table__.create(cls.engine)
        cls.sessions=sessionmaker(bind=cls.engine)
        with cls.engine.begin() as c:
            c.execute(text('CREATE TABLE user_skills(user_id INTEGER,skill_name TEXT,mastered INTEGER)'))
        with cls.sessions() as s:
            s.add_all([database.Jobseeker(id=1,username='Owner',password='unused',skills='Python',projects='[{"name":"Account Project","technologies":["FastAPI"]}]'),database.Jobseeker(id=2,username='Other',password='unused',skills='Secret')])
            s.add_all([database.Resume(id=1,user_id=1,title='Old',updated_at=datetime(2025,1,1)),database.Resume(id=2,user_id=1,title='Latest',updated_at=datetime(2026,1,1)),database.Resume(id=3,user_id=2,title='Private other',updated_at=datetime(2027,1,1))])
            s.add_all([database.ResumeSection(resume_id=1,section_type='projects',title='p',content={'items':[{'name':'Old project'}]}),database.ResumeSection(resume_id=2,section_type='projects',title='p',content={'items':[{'name':'Own project','description':'使用Python实现服务'}]}),database.ResumeSection(resume_id=3,section_type='projects',title='p',content={'items':[{'name':'Other private project'}]})])
            s.commit()
    @classmethod
    def tearDownClass(cls): cls.engine.dispose()
    def test_latest_own_resume_only_and_no_contact_leak(self):
        with self.sessions() as s: g=load_personal_graph(s,1)
        names=[n['name'] for n in g['nodes']]
        self.assertIn('Own project',names)
        self.assertNotIn('Old project',names)
        self.assertNotIn('Other private project',names)
        self.assertNotIn('email',str(g))
        self.assertEqual(g['sourceResume']['id'],2)
    def test_account_structured_fallback_preserves_technologies(self):
        with self.sessions() as s:
            s.query(database.ResumeSection).filter(database.ResumeSection.resume_id==2).delete()
            s.flush(); g=load_personal_graph(s,1);s.rollback()
        self.assertIn('FastAPI',[n['name'] for n in g['nodes']])
        self.assertEqual(g['evidence'][0]['source'],'profile')
    def test_http_auth_roles_and_query_cannot_choose_another_user(self):
        from routers import kg
        app=FastAPI();app.include_router(kg.router)
        client=TestClient(app)
        self.assertEqual(client.get('/api/kg/personal/graph').status_code,401)
        self.assertEqual(client.get('/api/kg/personal/graph',headers={'Authorization':'Bearer invalid'}).status_code,401)
        with patch.object(kg,'SessionLocal',self.sessions):
            for role in ['enterprise','admin']:
                self.assertEqual(client.get('/api/kg/personal/graph',headers={'Authorization':'Bearer '+database.create_token(1,role)}).status_code,403)
            r=client.get('/api/kg/personal/graph?user_id=2&resume_id=3',headers={'Authorization':'Bearer '+database.create_token(1,'jobseeker')})
            self.assertEqual(r.status_code,200,r.text)
            self.assertEqual(r.json()['data']['sourceResume']['id'],2)
            self.assertNotIn('Other private project',r.text)
            self.assertEqual(client.get('/api/kg/personal/graph',headers={'Authorization':'Bearer '+database.create_token(999,'jobseeker')}).status_code,404)

if __name__=='__main__': unittest.main()
