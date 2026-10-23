"""Live generation integration smoke test; not an answer-accuracy benchmark."""
import json
import sys
from pathlib import Path
from dotenv import load_dotenv
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'backend'))
load_dotenv(ROOT/'backend/.env')
from services.evidence_graph import retrieve
from services.evidence_qa import answer_from_evidence
rows=json.loads((ROOT/'data/external/xingtu/internet_technical_observations.json').read_text(encoding='utf-8'))
cutoff=max(r['captured_at'] for r in rows)
results=[]
for q in ['这些招聘描述对大模型训练有哪些明确的技术要求？','Python相关岗位提到了哪些数据库技术？','现有证据能否证明整个互联网行业的技能需求在2026年持续增长？']:
    evidence=retrieve(rows,q,cutoff,8)
    try:
        answer=answer_from_evidence(q,evidence)
        result={'question':q,'retrieved':len(evidence),'answer':answer}
    except Exception as exc:
        result={'question':q,'error_type':type(exc).__name__}
    results.append(result)
    print(json.dumps({'completed':len(results),'status':result.get('answer',{}).get('answer_status',result.get('error_type'))}),flush=True)
out=ROOT/'docs/paper/experiments/evidence_graph_v1/llm_smoke.json'
out.write_text(json.dumps({'protocol':'live-generation-smoke-not-qa-accuracy','results':results},ensure_ascii=False,indent=2),encoding='utf-8')
