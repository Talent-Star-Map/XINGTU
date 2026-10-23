"""Real-source pilot: corpus audit and held-out posting prevalence prediction.

Labels are rule-extracted mentions, NOT expert truth. Same-day grouped splits
measure cross-sectional transfer, NOT future forecasting or end-to-end RAG QA.
"""
import copy
from collections import Counter, defaultdict
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import platform
import sys
import time
import numpy as np
import torch
from torch import nn
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'backend'))
from services.evidence_graph import industry_scope, evidence_skills, retrieve

OUT=ROOT/'docs/paper/experiments/evidence_graph_v1'
OUT.mkdir(parents=True,exist_ok=True)
source=ROOT/'data/external/xingtu/sourced_jobs.json'
payload=json.loads(source.read_text(encoding='utf-8'))
audit=Counter(); selected=[]; seen=set(); manifest=[]
for row in payload['rows']:
    scope=industry_scope(row)
    audit[scope['status']]+=1
    record={'id':row['id'],'scope':scope}
    if scope['status']!='included':
        manifest.append(record);continue
    text=str(row.get('job_description') or '').strip()
    digest=hashlib.sha256(' '.join(text.split()).encode()).hexdigest()
    if not text or digest in seen:
        audit['empty_or_duplicate_description']+=1;manifest.append(record);continue
    seen.add(digest)
    evidence=evidence_skills(text,row.get('skill_tags',[]))
    # Whole duplicate text groups use the same split; never split graph inverses.
    bucket=int(digest[:8],16)%10
    split='train' if bucket<6 else 'validation' if bucket<8 else 'test'
    snap={**row,'job_id_ref':row['id'],'source_job_id':row['id'],'snapshot_id':digest,
          'captured_at':str(row['crawl_time']).replace(' ','T')+'Z',
          'skills_required':list(evidence),'role':scope['role'],'family':scope['family'],'split':split}
    selected.append(snap)
    record.update(content_sha256=digest,split=split,skills=len(evidence));manifest.append(record)
(OUT/'split_manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
(ROOT/'data/external/xingtu/internet_technical_observations.json').write_text(json.dumps(selected,ensure_ascii=False,indent=2),encoding='utf-8')
roles=sorted({r['role'] for r in selected if r['split']=='train'})
skills=sorted({s for r in selected if r['split']=='train' for s in r['skills_required']})
def matrix(split):
    counts=np.zeros((len(roles),len(skills)),dtype=np.float32);denom=np.zeros(len(roles),dtype=np.float32)
    for row in selected:
        if row['split']!=split or row['role'] not in roles:continue
        i=roles.index(row['role']);denom[i]+=1
        for s in row['skills_required']:
            if s in skills:counts[i,skills.index(s)]+=1
    return counts/np.maximum(denom[:,None],1),denom
train,nt=matrix('train');validation,nv=matrix('validation');test,ne=matrix('test')
mask=(nt>=3)&(nv>=2)&(ne>=2)
if not mask.any():raise RuntimeError('Insufficient role coverage for an honest held-out pilot')
def metrics(pred,target):
    diff=(pred-target)[mask]
    ndcgs=[]
    for p,t in zip(pred[mask],target[mask]):
        order=np.argsort(-p,kind='stable')[:10];ideal=np.argsort(-t,kind='stable')[:10]
        dcg=lambda indices:float(np.sum(t[indices]/np.log2(np.arange(len(indices))+2)))
        denom=dcg(ideal)
        if denom:ndcgs.append(dcg(order)/denom)
    positive=target[mask]>0
    return {'mae':float(np.abs(diff).mean()),'rmse':float(np.sqrt((diff**2).mean())),
            'positive_mae':float(np.abs(diff)[positive].mean()),'ndcg_at_10':float(np.mean(ndcgs))}
results={'empirical_frequency':metrics(train,test),
         'laplace_frequency':metrics((train*nt[:,None]+1)/(nt[:,None]+2),test)}
torch.set_num_threads(2)
class ConfidenceEmbedding(nn.Module):
    def __init__(self,d):
        super().__init__();self.roles=nn.Embedding(len(roles),d);self.skills=nn.Embedding(len(skills),d)
        nn.init.normal_(self.roles.weight,std=.1);nn.init.normal_(self.skills.weight,std=.1)
        self.relation=nn.Parameter(torch.ones(d));self.bias=nn.Parameter(torch.tensor(-3.0))
    def forward(self):return torch.sigmoid((self.roles.weight*self.relation)@self.skills.weight.T+self.bias)
start=time.perf_counter();runs=[]
for seed in (17,29,43):
    torch.manual_seed(seed);best=None
    for dim in (16,32):
        model=ConfidenceEmbedding(dim);optimizer=torch.optim.Adam(model.parameters(),lr=.01,weight_decay=1e-4)
        y=torch.tensor(train);weight=torch.where(y>0,1.,.1)*(torch.tensor(nt)>0)[:,None]
        local_best=1e9;patience=0
        for epoch in range(600):
            optimizer.zero_grad();pred=model();loss=(((pred-y)**2)*weight).sum()/weight.sum();loss.backward();optimizer.step()
            if epoch%10==0:
                values=model().detach().numpy();score=metrics(values,validation)['mae']
                if score<local_best-1e-7:
                    local_best=score;checkpoint=copy.deepcopy(model.state_dict());best_epoch=epoch;patience=0
                else:patience+=1
                if patience>=8:break
        model.load_state_dict(checkpoint)
        if best is None or local_best<best[0]:best=(local_best,copy.deepcopy(model),dim,best_epoch)
    _,model,dim,epoch=best
    runs.append({'seed':seed,'dimension':dim,'epoch':epoch,'validation_mae':best[0],**metrics(model().detach().numpy(),test)})
    checkpoint=ROOT/'data/external/xingtu'/f'confidence_embedding_seed{seed}.pt'
    torch.save({'state_dict':model.state_dict(),'roles':roles,'skills':skills,'dimension':dim,
                'protocol':'weak-mention-prevalence-pilot-not-official-UKGE'},checkpoint)
results['distmult_confidence_pilot']={'runs':runs,'mean':{key:float(np.mean([r[key] for r in runs])) for key in ('mae','rmse','positive_mae','ndcg_at_10')}}
# Retrieval timings only: no generated queries used as human gold labels.
timings={};cutoff=max(r['captured_at'] for r in selected)
for use_graph in (False,True):
    durations=[]
    for query in ('大模型训练 Python','云原生 Kubernetes','数据开发 SQL','推荐系统 算法','软件测试'):
        t=time.perf_counter();retrieve(selected,query,cutoff,10,use_graph=use_graph);durations.append((time.perf_counter()-t)*1000)
    timings['bm25_ppr' if use_graph else 'bm25']={'queries':5,'median_ms':float(np.median(durations)),'max_ms':float(max(durations)), 'scope':'in-memory CPU retrieval, not API latency'}
report={'protocol':'real-source-weak-mention-prevalence-pilot-v1',
 'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'created_at_utc':datetime.now(timezone.utc).isoformat(),
 'python':platform.python_version(),'torch':torch.__version__,'device':'cpu',
 'source_rows':len(payload['rows']),'audit':dict(audit),'deduplicated_technical_postings':len(selected),
 'families':dict(Counter(r['family'] for r in selected)), 'splits':dict(Counter(r['split'] for r in selected)),
 'training_roles':len(roles),'training_skills':len(skills),'evaluated_roles':int(mask.sum()),
 'evaluated_role_names':[r for r,m in zip(roles,mask) if m],
 'employer_groups':1,'observation_days':sorted({r['captured_at'][:10] for r in selected}),
 'limitations':['single employer group','rule-based mention labels, no expert gold','cross-sectional hash split, not temporal forecasting',
 'DistMult-confidence component implementation; not a full official UKGE/BEUrRE reproduction','no LLM QA accuracy measured'],
 'metrics':results,'retrieval_timing':timings,'elapsed_seconds':time.perf_counter()-start}
(OUT/'results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=True,indent=2))
