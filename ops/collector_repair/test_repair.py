"""Offline regression checks: provenance, text evidence and correct field mapping."""
from datetime import datetime
import importlib.util
from pathlib import Path
import sys
import types

fake=types.ModuleType('database.mysql'); fake.get_connection=lambda: None
sys.modules['database']=types.ModuleType('database')
sys.modules['database.mysql']=fake
from repair_pipeline.tencent import normalize, extract_skills
from repair_pipeline.zhilian import (normalize as normalize_zhilian, validate_job_url,
                                    challenge_reason, search_listings)
spec=importlib.util.spec_from_file_location('job_sync',Path(__file__).with_name('job_sync.py'))
sync=importlib.util.module_from_spec(spec); spec.loader.exec_module(sync)

post={'PostId':'123456','RecruitPostName':'后端开发工程师', 'CategoryName':'技术',
      'Responsibility':'负责后端平台研发、接口设计以及稳定性维护，使用Python和FastAPI实现服务。',
      'Requirement':'熟悉Docker，了解RAG。', 'LastUpdateTime':'2026年09月23日'}
r=normalize(post,datetime(2026,9,23))
assert r['source_url']=='https://careers.tencent.com/jobdesc.html?postId=123456'
assert 'Python' in r['skills'] and 'RAG' in r['skills']
assert 'CUDA' not in r['skills']
assert 'java' not in {s.lower() for s in extract_skills('JavaScript开发')}
assert all(quote in r['title']+'\n'+r['description'] for quote in r['skill_evidence'].values())
try: normalize({**post,'PostId':'javascript:bad'},datetime.utcnow())
except ValueError: pass
else: raise AssertionError('invalid identifier accepted')
mapped=sync.job_to_dict({'job_name':'岗位','company_name':'企业','job_description':'实际描述','source_url':r['source_url'],'source':'官方来源','skills':['Python']})
assert mapped['company_name']=='企业' and mapped['job_description']=='实际描述'
assert mapped['source']=='官方来源' and mapped['salary_min'] is None
assert 'author' not in mapped and 'content' not in mapped
try: sync.job_to_dict({'job_name':'无来源','skills':[]})
except ValueError: pass
else: raise AssertionError('missing provenance accepted')
try: sync.job_to_dict({'job_name':'无来源名称','source_url':r['source_url'],'skills':[]})
except ValueError: pass
else: raise AssertionError('missing source name silently attributed to Zhilian')
for bad in ('https://evilzhaopin.com/abc.htm', 'https://www.zhaopin.com.evil.test/abc.htm',
            'https://www.zhaopin.com/companydetail/CZ123.htm',
            'javascript:alert(1)', 'https://www.zhaopin.com/sou/?kw=Python'):
    try: validate_job_url(bad)
    except ValueError: pass
    else: raise AssertionError('untrusted job identity accepted: '+bad)
assert challenge_reason('Security Verification','', 'https://www.zhaopin.com/sou/')
assert challenge_reason('职位列表','', 'https://passport.zhaopin.com/login')
assert not challenge_reason('Python招聘','职位列表', 'https://www.zhaopin.com/sou/')
description='负责Python后端服务开发与FastAPI接口设计，参与Docker容器部署和服务稳定性维护。'
import json
state={'positionList':[{'name':'Python开发','companyName':'测试企业','number':'CC123J456',
    'positionURL':'https://www.zhaopin.com/jobdetail/CC123J456.htm?tracking=x',
    'salaryReal':'hidden','jobDetailData':{'private':'ignored'}}], 'cookiesData':{'secret':'ignored'}}
parsed=search_listings(['__INITIAL_STATE__='+json.dumps(state)+';'])
assert parsed[0]=={'url':'https://www.zhaopin.com/jobdetail/CC123J456.htm','id':'CC123J456','title':'Python开发','company':'测试企业'}
assert search_listings(['__INITIAL_STATE__={"positionList":[],"listLoadError":false};'])==[]
try: search_listings(['__INITIAL_STATE__={"positionList":[],"listLoadError":true};'])
except ValueError: pass
else: raise AssertionError('search load failure treated as an empty successful search')
try: search_listings(['__INITIAL_STATE__='+json.dumps(state)+'; evil()'])
except ValueError: pass
else: raise AssertionError('unexpected code after page JSON accepted')
z=normalize_zhilian({'url':'https://jobs.zhaopin.com/CC123J456.htm','title':'Python开发工程师','company':'测试企业'},description,datetime(2026,10,15))
assert z['source']=='智联招聘' and z['source_job_id']=='CC123J456'
assert 'Python' in z['skills'] and 'Docker' in z['skills']
assert 'publish_time' not in z
assert z['observed_at']==datetime(2026,10,15)
try: normalize_zhilian({'url':z['source_url'],'title':'Python开发','company':'企业'},'Security Verification',datetime.utcnow())
except ValueError: pass
else: raise AssertionError('verification page treated as a job')
public=normalize_zhilian({'url':z['source_url'],'title':'Python开发','company':'企业','salary':'**-**元','tags':['Python','Docker']},None,datetime(2026,10,15))
assert public['description'] is None and public['raw_salary'] is None
assert public['description_scope']=='login_required' and 'Docker' in public['skills']
print('PASS: literal skill evidence, token boundaries, source identity, correct mapping, unknown salary, missing provenance rejection')
print('PASS: dual-source attribution, strict job URLs, challenge detection, public-only parsing and UTC observations')
