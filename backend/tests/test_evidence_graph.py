"""Adversarial evidence/time/industry regression tests; not scientific accuracy."""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from services.evidence_graph import retrieve, relation_support, industry_scope, evidence_skills

base={'job_id_ref':1,'source':'official','source_url':'https://careers.tencent.com/jobdesc.html?postId=1',
      'title':'Python开发工程师','company_name':'腾讯','job_description':'Python 和 SQL 开发', 'skills_required':['Python','SQL','Java']}
old={**base,'snapshot_id':'a','captured_at':'2026-09-01T00:00:00Z'}
future={**base,'snapshot_id':'b','captured_at':'2026-10-01T00:00:00Z','job_description':'Java Java Java','skills_required':['Java']}
replacement={**base,'snapshot_id':'c','captured_at':'2026-09-02T00:00:00Z','job_description':'仅 SQL','skills_required':['SQL']}
assert industry_scope(base)['status']=='included'
assert industry_scope({**base,'source_url':'https://unverified.example/job/1'})['status']=='review'
assert industry_scope({**base,'title':'Python培训销售'})['status']=='excluded'
assert 'Java' not in evidence_skills('JavaScript',['Java'])
assert retrieve([old,future],'Java','2026-09-03T00:00:00Z')==[]
latest=retrieve([old,replacement],'Python','2026-09-03T00:00:00Z')
assert latest[0]['snapshot_id']=='c' and 'Python' not in latest[0]['skill_evidence']
result=retrieve([old,future],'Python','2026-09-03T00:00:00Z')
assert len(result)==1 and result[0]['snapshot_id']=='a' and 'Java' not in result[0]['skill_evidence']
support=relation_support([old,old,future],'2026-09-03T00:00:00Z')
assert len(support)==2 and all(r['postings']==1 and r['status']=='single_employer' for r in support)
assert retrieve([old],'Python','2026-08-01T00:00:00Z')==[]
print('PASS: industry gate, unsupported skill, token boundary, future exclusion, stale version, recrawl deduplication, employer concentration')
