"""All-route access regression: isolated SQLite, temporary files, no cloud calls.

Run in a network-disabled test container; no real data, mail or model requests.
"""
import importlib.util
import os
from pathlib import Path
import re
import sys
import tempfile
import unittest
from unittest.mock import patch

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))
os.environ['DATABASE_URL'] = 'sqlite://'
os.environ['JWT_SECRET'] = 'all-api-auth-offline-secret-abcdefghijklmnopqrstuvwxyz'
os.environ['XINGTU_SKIP_DB_INIT'] = '1'
os.environ['DEEPSEEK_API_KEY'] = ''
os.environ['NEO4J_MOCK'] = 'true'

from fastapi import FastAPI
from fastapi.testclient import TestClient
from fastapi.routing import APIRoute
import jwt
from sqlalchemy import BigInteger, create_engine, text
from sqlalchemy.dialects.mysql import LONGTEXT, TINYINT
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.pool import StaticPool

@compiles(BigInteger, 'sqlite')
def bigint_sqlite(*args, **kwargs): return 'INTEGER'

@compiles(TINYINT, 'sqlite')
def tinyint_sqlite(*args, **kwargs): return 'INTEGER'

@compiles(LONGTEXT, 'sqlite')
def longtext_sqlite(*args, **kwargs): return 'TEXT'

import database
database.engine.dispose()
database.engine = create_engine('sqlite://',connect_args={'check_same_thread':False},poolclass=StaticPool)
database.SessionLocal.configure(bind=database.engine)
database.Base.metadata.create_all(database.engine)
database.ResumeBase.metadata.create_all(database.engine)
with database.engine.begin() as connection:
    connection.execute(text('CREATE TABLE user_skills (id INTEGER PRIMARY KEY, user_id INTEGER, job_id INTEGER, skill_name TEXT, mastered INTEGER, mastered_at TEXT)'))
    connection.execute(text("INSERT INTO user_skills VALUES (1,1,NULL,'Python',1,NULL),(2,2,NULL,'Java',1,NULL)"))

from main import app
from auth_guard import access_policy, APIAuthorizationMiddleware, request_token
from routers import auth, enterprise, match_api, quality_api, data_board

client = TestClient(app)


def header(role='jobseeker', uid=1):
    return {'Authorization':'Bearer '+database.create_token(uid,role)}


class AllAPIAccessTests(unittest.TestCase):
    def test_every_registered_private_api_rejects_anonymous_and_invalid_tokens(self):
        count=0
        for route in app.routes:
            if not isinstance(route,APIRoute) or not route.path.startswith('/api/'):
                continue
            path=re.sub(r'\{[^}]+\}', '1', route.path)
            for method in route.methods:
                if access_policy(method,path) in ('public','capability','collector'):continue
                for headers in ({},{'Authorization':'Bearer invalid'}):
                    response=client.request(method,path,headers=headers)
                    self.assertEqual(response.status_code,401,(method,path,response.text))
                count+=1
        self.assertGreater(count,100)
        print(f'ALL-ROUTE AUDIT: {count} protected method/path combinations, anonymous and invalid tokens rejected')

    def test_every_role_specific_route_rejects_other_roles_before_business_logic(self):
        count=0
        for route in app.routes:
            if not isinstance(route,APIRoute):continue
            path=re.sub(r'\{[^}]+\}', '1', route.path)
            for method in route.methods:
                policy=access_policy(method,path)
                if policy not in ('admin','enterprise','jobseeker'):continue
                for role in {'admin','enterprise','jobseeker'}-{policy}:
                    response=client.request(method,path,headers=header(role))
                    self.assertEqual(response.status_code,403,(method,path,role,response.text))
                    count+=1
        print(f'ROLE AUDIT: {count} wrong-role requests rejected')

    def test_default_deny_also_covers_future_business_routes(self):
        isolated=FastAPI()
        isolated.add_middleware(APIAuthorizationMiddleware)
        @isolated.get('/api/future-feature')
        def future():return {'ok':True}
        with TestClient(isolated) as local:
            self.assertEqual(local.get('/api/future-feature').status_code,401)
            self.assertEqual(local.get('/api/future-feature',headers=header()).status_code,200)

    def test_expired_forged_missing_claims_and_conflicting_credentials(self):
        base={'user_id':1,'role':'jobseeker','exp':4102444800}
        cases=[jwt.encode({**base,'exp':1},database.JWT_SECRET,algorithm='HS256'),
               jwt.encode(base,'a-different-secret-abcdefghijklmnopqrstuvwxyz',algorithm='HS256'),
               jwt.encode({'user_id':1,'role':'jobseeker'},database.JWT_SECRET,algorithm='HS256'),
               jwt.encode({**base,'user_id':True},database.JWT_SECRET,algorithm='HS256'),
               jwt.encode({**base,'role':'superuser'},database.JWT_SECRET,algorithm='HS256')]
        for token in cases:
            self.assertEqual(client.get('/api/jobs/stats',headers={'Authorization':'Bearer '+token}).status_code,401)
        self.assertEqual(client.get('/api/jobs/stats',headers=header(),params={'token':database.create_token(2,'jobseeker')}).status_code,401)
        self.assertEqual(client.get('/api/jobs/stats?token=x&token=y').status_code,401)

    def test_header_tokens_work_with_legacy_query_handlers_and_data_is_owned(self):
        response=client.get('/api/learning/skills?user_id=2',headers=header())
        self.assertEqual(response.status_code,200,response.text)
        self.assertEqual([row['skill_name'] for row in response.json()['data']],['Python'])
        self.assertEqual(client.get('/api/resume-center/list',headers=header()).status_code,200)
        self.assertEqual(client.get('/api/jobs/stats',headers=header('enterprise')).status_code,200)
        with patch.object(quality_api,'_load_jobs',return_value=[]):
            self.assertEqual(client.get('/api/quality/plagiarism',headers=header('admin')).status_code,200)
        with patch.object(data_board,'get_dataset',return_value={'rows':[]}),patch.object(data_board,'build_overview',return_value={}):
            self.assertEqual(client.get('/api/enterprise/data-board/overview',headers=header('enterprise')).status_code,200)

    def test_wrong_role_cache_clear_cannot_delete_before_rejection(self):
        with tempfile.TemporaryDirectory() as folder:
            cache=Path(folder)/'cache';resumes=Path(folder)/'uploads'/'resumes'
            cache.mkdir();resumes.mkdir(parents=True)
            a=cache/'1_fixture.json';b=resumes/'1_fixture.txt'
            a.write_text('{}');b.write_text('fake resume')
            with patch.object(match_api,'MATCH_CACHE_DIR',str(cache)),patch.object(match_api,'UPLOAD_DIR',str(resumes.parent)):
                self.assertEqual(client.delete('/api/match/cache',headers=header('enterprise')).status_code,403)
                self.assertTrue(a.exists());self.assertTrue(b.exists())
                # Route alone must also enforce role before deletion, without middleware.
                isolated=FastAPI();isolated.include_router(match_api.router)
                with TestClient(isolated) as local:
                    self.assertEqual(local.delete('/api/match/cache',headers=header('enterprise')).status_code,403)
                self.assertTrue(a.exists());self.assertTrue(b.exists())

    def test_global_weight_calibration_requires_admin(self):
        with patch.object(enterprise,'calibrate_weights_from_feedback',return_value={'message':'offline'}) as calibrate:
            self.assertEqual(client.post('/api/enterprise/calibrate',headers=header('enterprise')).status_code,403)
            calibrate.assert_not_called()
            self.assertEqual(client.post('/api/enterprise/calibrate',headers=header('admin')).status_code,200)
            calibrate.assert_called_once()

    def test_public_bootstrap_and_capability_endpoints_are_narrow(self):
        for path in ('/api/auth/login','/api/auth/register','/api/auth/send-code','/api/auth/admin/login'):
            self.assertEqual(client.post(path,json={}).status_code,422)
        self.assertEqual(client.get('/api/health').status_code,200)
        self.assertEqual(client.get('/api/resume-center/share/'+'a'*16).json()['success'],False)
        self.assertEqual(client.get('/api/resume-center/print/'+'a'*43).status_code,404)
        self.assertEqual(client.get('/api/resume-center/share-info/1').status_code,401)
        self.assertEqual(client.delete('/api/resume-center/share/1').status_code,401)
        self.assertEqual(client.get('/api/resume-center/templates/list').status_code,401)
        self.assertEqual(client.get('/uploads/resumes/1_fake.txt').status_code,404)
        self.assertEqual(client.get('/openapi.json').status_code,401)
        with patch.dict(os.environ,{'COLLECTOR_INGEST_TOKEN':'isolated-collector-key'}):
            response=client.post('/api/collector/observations',json={'source':'test','source_job_id':'1','raw_text':'fixture','observed_at':'2026-01-01T00:00:00Z'})
            collector_registered = any(getattr(route, 'path', '') == '/api/collector/observations' for route in app.routes)
            self.assertEqual(response.status_code,403 if collector_registered else 404)

    def test_enterprise_cannot_self_verify_via_profile_update(self):
        session=database.get_session()
        try:
            user=database.Enterprise(email='profile-test@example.test',username='profile-test',password='fixture',verified=0)
            session.add(user);session.commit();uid=user.id
        finally:session.close()
        response=client.put('/api/auth/profile',headers=header('enterprise',uid),json={'verified':1,'company_desc':'updated'})
        self.assertEqual(response.status_code,200,response.text)
        with database.get_session() as session:
            user=session.query(database.Enterprise).filter_by(id=uid).one()
            self.assertEqual(user.verified,0);self.assertEqual(user.company_desc,'updated')

    def test_existing_ownership_regressions(self):
        spec=importlib.util.spec_from_file_location('ownership_suite',BACKEND/'tests'/'test_authz.py')
        suite=importlib.util.module_from_spec(spec);spec.loader.exec_module(suite)
        with tempfile.TemporaryDirectory() as folder,patch.object(auth,'UPLOAD_DIR',str(Path(folder)/'uploads')):
            suite.BACKEND_ROOT=folder
            try:suite.main()
            except SystemExit as result:self.assertEqual(result.code,0)


if __name__=='__main__':unittest.main(verbosity=2)
