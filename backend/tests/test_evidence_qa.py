import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from services.evidence_qa import validate_claims
rows=[{'snapshot_id':'1','job_description':'熟悉 Python，了解 SQL。'}]
result=validate_claims({'claims':[{'text':'提及 Python','citations':[{'id':'1','quote':'熟悉 Python'}]},
 {'text':'编造','citations':[{'id':'2','quote':'熟悉 Python'}]},
 {'text':'错误引文','citations':[{'id':'1','quote':'熟悉 Java'}]}]},rows)
assert len(result['claims'])==1 and result['rejected_claims']==2
assert validate_claims({'claims':[]},rows)['answer_status']=='insufficient_evidence'
print('PASS: unknown citations, fabricated quotations, and unsupported claims rejected')
