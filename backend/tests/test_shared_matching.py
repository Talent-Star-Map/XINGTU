"""Offline pair consistency and ranking separation; no cloud reads/writes."""
import os
from pathlib import Path
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch
from uuid import uuid4

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ['DATABASE_URL'] = 'sqlite:///:memory:'
os.environ['JWT_SECRET'] = uuid4().hex + uuid4().hex
os.environ['DEEPSEEK_API_KEY'] = ''

from services.match_analyzer import compute_match_score
from services.match_contract import complete_profile, cache_fingerprint, salary_range_k, SCORE_VERSION
from services.match_engine import match_one, apply_pool_normalization, set_active_weights, WEIGHTS


def fixtures():
    person = SimpleNamespace(id=1,skills='Python,SQL',education='本科',experience='3年',
                             expected_salary='15K-25K',target_city='北京',city='北京')
    job = SimpleNamespace(id=3,title='Python开发',skills_required='Python,SQL',education='本科',
                          experience='3-5年',salary_min=15,salary_max=25,salary_range='15K-25K',location='北京')
    profile = complete_profile({'skills':['Python','SQL']},person)
    required = {'id':3,'title':job.title,'company':'Example','skills':['Python','SQL'],
                'education':job.education,'experience':job.experience,'salary':job.salary_range,'location':job.location}
    return person,job,profile,required


class SharedMatchingTests(unittest.TestCase):
    def tearDown(self): set_active_weights(WEIGHTS)

    def test_sources_do_not_change_scores_or_weighted_contributions(self):
        _,_,profile,job=fixtures()
        base=compute_match_score(profile,job,{}, {}, [])
        quality={s:{'verified':True,'confidence':1,'sources':['site1','site2']} for s in job['skills']}
        enriched=compute_match_score(profile,job,quality,{},[])
        self.assertEqual(base['overall'],enriched['overall'])
        self.assertEqual(base['dims'],enriched['dims'])
        self.assertEqual(enriched['dims']['skill']['score'],100)

    def test_enterprise_adapter_matches_all_five_dimensions(self):
        person,job,profile,required=fixtures()
        direct=compute_match_score(profile,required,{}, {}, [])
        enterprise=match_one(job,person,{'python':99,'sql':.01})
        self.assertEqual(direct['overall'],enterprise['match_score'])
        for key,name in [('skill','skill'),('exp','experience'),('edu','education'),('location','location'),('salary','salary')]:
            self.assertEqual(direct['dims'][name]['score'],enterprise[key+'_match'])
        self.assertEqual(enterprise['score_version'],SCORE_VERSION)

    def test_pool_and_feedback_affect_priority_only(self):
        person,job,_,_=fixtures()
        before=match_one(job,person)
        set_active_weights({'skill':.1,'exp':.1,'edu':.1,'location':.6,'salary':.1})
        after=match_one(job,person)
        self.assertEqual(before['match_score'],after['match_score'])
        self.assertNotEqual(before['ranking_score'],after['ranking_score'])
        pool=[after, {'match_score':30}, {'match_score':60}, {'match_score':10}]
        fixed=[r['match_score'] for r in pool]
        self.assertIsNotNone(apply_pool_normalization(pool))
        self.assertEqual(fixed,[r['match_score'] for r in pool])
        self.assertTrue(all(0<=r['ranking_score']<=100 for r in pool))

    def test_bounds_and_visible_weighted_sum(self):
        _,_,profile,job=fixtures()
        for skills in ([],['SQL'],['Python','SQL'],['Go'],['Python','SQL']*10):
            result=compute_match_score({**profile,'skills':skills},job,{}, {}, [])
            self.assertTrue(0<=result['overall']<=100)
            self.assertTrue(all(0<=d['score']<=100 for d in result['dims'].values()))
            self.assertEqual(result['overall'],round(sum(d['weighted'] for d in result['dims'].values())))
        self.assertEqual(compute_match_score(profile,{**job,'skills':[]},{},{},[])['dims']['skill']['score'],0)

    def test_cache_invalidates_for_inputs_version_and_request_size(self):
        _,_,profile,job=fixtures()
        key=cache_fingerprint(profile,job,n=5)
        for p,j,options in [({**profile,'education':'硕士'},job,{'n':5}),
                            ({**profile,'experience_years':0},job,{'n':5}),
                            ({**profile,'salary_min':25},job,{'n':5}),
                            (profile,{**job,'skills':['Go']},{'n':5}),
                            (profile,job,{'n':10})]:
            self.assertNotEqual(key,cache_fingerprint(p,j,**options))
        with patch('services.match_contract.SCORE_VERSION','new-version'):
            self.assertNotEqual(key,cache_fingerprint(profile,job,n=5))

    def test_old_candidate_record_does_not_leak_old_scores(self):
        from routers.enterprise import _candidate_dict
        person,job,_,_=fixtures()
        person.real_name='Fixture';person.username='fixture';person.target_position='Python开发'
        record=SimpleNamespace(id=9,status='pending',match_score=999,skill_match=110)
        payload=_candidate_dict(record,person,job)
        self.assertEqual(payload['match'],match_one(job,person)['match_score'])
        self.assertLessEqual(payload['match_breakdown']['skill'],100)
        self.assertEqual(payload['score_version'],SCORE_VERSION)
        self.assertIn('recommendation_score',payload)

    def test_location_with_district_uses_same_city(self):
        from services.match_contract import location_score
        self.assertEqual(location_score('北京市海淀区','北京'),90)
        self.assertEqual(location_score('广东省深圳市南山区','深圳'),90)

    def test_profile_completion_keeps_zero_experience_and_salary_units(self):
        person,_,_,_=fixtures()
        self.assertEqual(complete_profile({'experience_years':0},person)['experience_years'],0)
        self.assertEqual(salary_range_k('1.5万-2.5万'),(15,25))
        self.assertEqual(salary_range_k('15000-25000元/月'),(15,25))
        self.assertEqual(salary_range_k('15K-25K·14薪'),(15,25))

    def test_analyze_and_recommend_entrypoints_use_the_same_inputs(self):
        from routers import match_api
        person,_,_,job=fixtures()
        class Session:
            def query(self,*args): return self
            def filter(self,*args): return self
            def first(self): return person
            def close(self): pass
        with tempfile.TemporaryDirectory() as cache, \
             patch('database.verify_token',return_value={'user_id':1,'role':'jobseeker'}), \
             patch.object(match_api,'get_session',side_effect=Session), \
             patch.object(match_api,'load_job_by_id',return_value=job), \
             patch.object(match_api,'load_all_jobs',return_value=[job]), \
             patch.object(match_api,'_remember_diagnosis'), \
             patch.object(match_api,'MATCH_CACHE_DIR',cache):
            analyzed=match_api.api_match_analyze(match_api.AnalyzeReq(job_id=3,skills=['Python','SQL']),token='test')['data']
            recommended=match_api.api_match_recommend(match_api.RecommendReq(skills=['Python','SQL']),n=1,token='test')['data'][0]
            self.assertEqual(analyzed['overall'],recommended['overall'])
            self.assertEqual(analyzed['dims'],recommended['dimensions'])
            # A changed profile must bypass the cache despite identical user/job IDs.
            person.experience='0年'
            updated=match_api.api_match_analyze(match_api.AnalyzeReq(job_id=3,skills=['Python','SQL']),token='test')['data']
            self.assertFalse(updated['cache_hit'])
            self.assertNotEqual(updated['overall'],analyzed['overall'])


if __name__=='__main__': unittest.main()
