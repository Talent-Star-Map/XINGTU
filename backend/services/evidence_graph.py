"""Evidence-only temporal BM25/dense/PPR retrieval. No inferred edge is a fact.

Demand prevalence, extraction validity, and ranking scores are separate quantities.
This module is dependency-free; callers supply observations and optional vectors.
"""
from collections import Counter, defaultdict
from datetime import datetime, timezone
import math
import re
from urllib.parse import urlsplit

from services.role_catalog import classify_title, _skill_list
from services.skill_synonyms import canonical_name
from services.temporal_graph import latest_snapshots, cosine, utc_instant


def industry_scope(row):
    """Conservative policy: verified employer source AND technical job function."""
    match = classify_title(str(row.get('title') or ''))
    title = str(row.get('title') or '')
    if re.search(r'销售|商务拓展|人力资源|行政|财务|招聘专员|市场营销', title):
        return {'status': 'excluded', 'reason': 'nontechnical_function'}
    if match is None or match[1] == '互联网产品与交互':
        return {'status': 'review', 'reason': 'technical_function_not_confirmed'}
    host = (urlsplit(str(row.get('source_url') or '')).hostname or '').lower()
    verified = host == 'careers.tencent.com'
    # Other employers require a reviewed, auditable industry record.
    reviewed = row.get('industry_verified') is True and bool(row.get('industry_evidence_url'))
    if not (verified or reviewed):
        return {'status': 'review', 'reason': 'employer_industry_not_verified', 'role': match[1]}
    return {'status': 'included', 'reason': 'official_employer_and_technical_title',
            'role': match[1], 'family': match[0],
            'employer_group': 'Tencent' if verified else row.get('employer_group', row.get('company_name'))}


def evidence_skills(text, skills):
    """Validate explicit mentions; does not claim required/preferred classification."""
    output = {}
    for raw in _skill_list(skills):
        if not raw:
            continue
        pattern = r'(?<![A-Za-z0-9])' + re.escape(raw) + r'(?![A-Za-z0-9])'
        found = re.search(pattern, text, re.I)
        if found:
            output[canonical_name(raw)] = {'start': found.start(), 'end': found.end(),
                'quote': text[max(0, found.start()-45):min(len(text), found.end()+65)],
                'requirement_type': 'mention_unclassified'}
    return output


def tokens(text):
    words = re.findall(r'[a-z0-9]+(?:[+#.][a-z0-9+#.]*)?|[\u4e00-\u9fff]+', str(text).lower())
    output = []
    for word in words:
        if re.fullmatch(r'[\u4e00-\u9fff]+', word):
            output.extend(word[i:i+2] for i in range(len(word)-1))
            if len(word) == 1:
                output.append(word)
        else:
            output.append(word)
    return output


def bm25_scores(rows, query):
    docs = [Counter(tokens(str(r.get('title', ''))+' '+str(r.get('job_description', '')))) for r in rows]
    lengths = [sum(d.values()) for d in docs]
    avg = sum(lengths)/max(1, len(rows)) or 1
    terms = set(tokens(query))
    df = {t: sum(t in d for d in docs) for t in terms}
    return [sum(math.log(1+(len(rows)-df[t]+.5)/(df[t]+.5))*d[t]*2.2 /
                 (d[t]+1.2*(.25+.75*length/avg)) for t in terms if d[t]) for d,length in zip(docs,lengths)]


def retrieve(rows, query, as_of, top_k=10, query_vector=None, use_graph=True, use_dense=True):
    eligible = latest_snapshots(rows, as_of)
    if not query.strip() or not eligible:
        return []
    lexical = bm25_scores(eligible, query)
    orders = [sorted((i for i,s in enumerate(lexical) if s>0), key=lambda i:(-lexical[i],str(eligible[i].get('snapshot_id'))))]
    dense = [cosine(query_vector, r.get('embedding', [])) if query_vector and use_dense else None for r in eligible]
    if any(s is not None for s in dense):
        orders.append(sorted((i for i,s in enumerate(dense) if s is not None), key=lambda i:(-dense[i],str(eligible[i].get('snapshot_id')))))
    seed = defaultdict(float)
    for order in orders:
        for rank,i in enumerate(order[:100],1):
            seed['d:'+str(i)] += 1/(60+rank)
    if not seed:
        return []
    adjacency = defaultdict(dict)
    evidence = []
    degree = Counter()
    for row in eligible:
        ev = evidence_skills(str(row.get('job_description') or ''), row.get('skills_required', []))
        evidence.append(ev)
        degree.update(ev.keys())
    if use_graph:
        for i,ev in enumerate(evidence):
            for skill in ev:
                d,s = 'd:'+str(i), 's:'+skill
                weight = math.log(1+len(eligible)/(1+degree[skill]))
                adjacency[d][s] = weight
                adjacency[s][d] = weight
    total = sum(seed.values())
    seed = {k:v/total for k,v in seed.items()}
    state = dict(seed)
    if use_graph:
        for _ in range(40):
            nxt = defaultdict(float, {k:.2*v for k,v in seed.items()})
            dangling = 0
            for node,mass in state.items():
                edges = adjacency.get(node, {})
                if not edges:
                    dangling += .8*mass
                    continue
                denom = sum(edges.values())
                for target,w in edges.items():
                    nxt[target] += .8*mass*w/denom
            for node,v in seed.items():
                nxt[node] += dangling*v
            if sum(abs(nxt.get(k,0)-state.get(k,0)) for k in set(nxt)|set(state)) < 1e-9:
                state = dict(nxt)
                break
            state = dict(nxt)
    order = sorted(range(len(eligible)), key=lambda i:(-state.get('d:'+str(i),0),str(eligible[i].get('snapshot_id'))))
    return [{**eligible[i], 'retrieval_score':state.get('d:'+str(i),0), 'bm25_score':lexical[i],
             'dense_score':dense[i], 'skill_evidence':evidence[i],
             'retrieval_mode':('hybrid' if len(orders)>1 else 'bm25')+('_ppr' if use_graph else ''),
             'as_of':as_of} for i in order[:max(1,min(top_k,100))] if state.get('d:'+str(i),0)>0]


def relation_support(rows, as_of, prior_strength=2.0):
    """Role-skill prevalence over independently identified postings, not truth probability."""
    groups = defaultdict(list)
    for row in latest_snapshots(rows, as_of):
        scope = industry_scope(row)
        if scope['status'] == 'included':
            groups[scope['role']].append((row,scope,evidence_skills(str(row.get('job_description') or ''),row.get('skills_required',[]))))
    result = []
    for role,items in groups.items():
        count = Counter(skill for _,_,ev in items for skill in ev)
        for skill,n in count.items():
            employers = {scope['employer_group'] for _,scope,ev in items if skill in ev}
            result.append({'role':role,'skill':skill,'postings':len(items),'mentions':n,
                'prevalence':n/len(items), 'smoothed_prevalence':(n+prior_strength*.5)/(len(items)+prior_strength),
                'independent_employer_groups':len(employers),'status':'single_employer' if len(employers)<2 else 'observed',
                'as_of':as_of,'meaning':'observed_mention_prevalence_not_truth_probability'})
    return result
