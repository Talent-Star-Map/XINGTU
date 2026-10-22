"""Pure, source-backed graph projection. No LLM inference or source-date mutation."""
import hashlib
import html
import json
import re
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

ONTOLOGY_PATH = Path(__file__).with_name('skill_ontology.json')


def stable(prefix, value):
    return prefix + ':' + hashlib.sha256(str(value).encode()).hexdigest()[:24]


def iso(value):
    if not value:return None
    if isinstance(value, str):
        try:value = datetime.fromisoformat(value.replace('Z', '+00:00'))
        except ValueError:return None
    if value.tzinfo is None:value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat()


def skill_list(value):
    if isinstance(value,str):
        try:value=json.loads(value)
        except ValueError:return []
    return [v.strip() for v in value if isinstance(v,str) and v.strip()] if isinstance(value,list) else []


def source_identity(source, url):
    try:
        parts=urlsplit(str(url or ''))
        if parts.scheme not in ('http','https') or parts.username or parts.password:return None
        if source=='腾讯招聘官网' and parts.hostname=='careers.tencent.com':
            value=parse_qs(parts.query).get('postId',[''])[0]
            return source+':'+value if value.isdigit() else None
        if source=='智联招聘' and parts.hostname in ('www.zhaopin.com','jobs.zhaopin.com'):
            match=re.search(r'/([A-Za-z0-9_-]+)\.html?$',parts.path)
            return source+':'+match[1] if match else None
    except ValueError:pass
    return None


def load_registry(path=ONTOLOGY_PATH):
    registry=json.loads(Path(path).read_text(encoding='utf-8'))
    aliases={}
    for item in registry['concepts']:
        for name in [item['name'],*item['aliases']]:
            key=name.strip().casefold()
            if key in aliases and aliases[key]['id']!=item['id']:
                raise ValueError('ambiguous ontology alias: '+name)
            aliases[key]=item
    return registry,aliases


def text_quote(text, variants):
    for variant in sorted(set(variants),key=len,reverse=True):
        if not variant:continue
        pattern=re.escape(variant)
        if variant.isascii():pattern=r'(?<![A-Za-z0-9])'+pattern+r'(?![A-Za-z0-9])'
        match=re.search(pattern,text,re.I)
        if match:
            start=max(0,match.start()-45);end=min(len(text),match.end()+65)
            return {'quote':text[start:end],'start':start,'end':end}
    return None


LEVEL_PATTERNS=[('lead',r'专家|架构师|负责人|总监|principal|\blead\b'),
                ('senior',r'高级|资深|\bsenior\b'),('mid',r'中级|intermediate'),
                ('entry',r'实习|应届|校招'),('junior',r'初级|\bjunior\b')]
STACKS={'java':{'java','spring','spring boot','spring cloud'},'python':{'python','django','flask','fastapi'},
        'frontend':{'javascript','typescript','react','vue','angular','html','css','tailwind css'},
        'data':{'hadoop','spark','flink','hive','数据分析','数据治理','数据仓库'},
        'ai':{'pytorch','tensorflow','langchain','rag','llm','大模型','机器学习','agent'},
        'cloud':{'docker','kubernetes','linux','devops','云原生'},'go':{'go'},'cpp':{'c','c++','c/c++'}}


def compile_postings(raw_rows, job_rows, clean_rows=None):
    registry,aliases=load_registry()
    clean_by_raw={r['raw_id']:r for r in (clean_rows or []) if r.get('raw_id') is not None}
    raw_by_key={}
    excluded=Counter();inputs=[]
    for raw in raw_rows:
        key=source_identity(raw.get('source'),raw.get('source_url'))
        if not key:excluded['raw_untraceable_source']+=1;continue
        raw_by_key[key]=raw
        clean=clean_by_raw.get(raw['id'],{})
        inputs.append({'identity':key,'raw_id':raw['id'],'sql_ids':[],
            'source':raw['source'],'source_url':raw['source_url'],
            'title':clean.get('job_name') or raw.get('raw_job_name'),'company':clean.get('company_name') or raw.get('raw_company_name'),
            'city':clean.get('city') or raw.get('raw_city'),'description':clean.get('job_description') or raw.get('raw_description'),
            'skills':skill_list(clean.get('skills') or raw.get('raw_skills')),
            'experience':clean.get('experience') or raw.get('raw_experience'),'education':clean.get('education') or raw.get('raw_education'),
            'publish_time':clean.get('publish_time') or raw.get('publish_time'),'crawl_time':clean.get('crawl_time') or raw.get('crawl_time')})
    for row in job_rows:
        if row.get('data_type')!=1:excluded['not_job']+=1;continue
        key=source_identity(row.get('source'),row.get('source_url'))
        if not key:excluded['untraceable_or_demo']+=1;continue
        inputs.append({'identity':key,'raw_id':raw_by_key.get(key,{}).get('id'),'sql_ids':[row['id']],
            'source':row['source'],'source_url':row['source_url'],'title':row.get('title'),'company':row.get('company_name'),
            'city':row.get('city'),'description':row.get('job_description'),'skills':skill_list(row.get('skill_tags')),
            'experience':row.get('experience'),'education':row.get('education'),'publish_time':row.get('publish_time'),
            'crawl_time':row.get('crawl_time')})
    merged={}
    for row in inputs:
        key=row['identity']
        if key not in merged:merged[key]=row;continue
        current=merged[key]
        current['sql_ids']=sorted(set(current['sql_ids']+row['sql_ids']))
        current['skills']=sorted(set(current['skills']+row['skills']))
        # Raw/source-backed evidence takes priority; SQL contributes missing values.
        for field,value in row.items():
            if field not in ('skills','sql_ids') and value and not current.get(field):current[field]=value
    postings=[];concepts={};roles={};domains={};requirements=[];observations=[]
    for row in merged.values():
        title=str(row.get('title') or '').strip()
        if not title:excluded['missing_title']+=1;continue
        description=html.unescape(re.sub(r'<[^>]+>',' ',str(row.get('description') or ''))).strip()
        if re.search(r'登录后.{0,10}查看|登录.{0,10}查看完整',description):description=''
        complete=len(re.sub(r'\s+','',description))>=80
        match=next(((family,role) for family,role,pattern in registry['roles'] if re.search(pattern,title,re.I)),None)
        family,role=match or ('待归类方向','待归类岗位')
        did=stable('domain',family);rid=stable('role',role);pid=stable('posting',row['identity'])
        level=next((name for name,pattern in LEVEL_PATTERNS if re.search(pattern,title,re.I)),'unknown')
        published=iso(row.get('publish_time'));captured=iso(row.get('crawl_time'))
        tags=[];edges=[]
        for raw_skill in row['skills']:
            concept=aliases.get(raw_skill.casefold())
            if concept is None:
                concept={'id':stable('unmapped',raw_skill.casefold()),'name':raw_skill,'aliases':[],
                         'category':'other','parent_ids':[],'review_status':'unmapped_pending_review'}
            quote=text_quote(description,[raw_skill,concept['name'],*concept['aliases']]) if description else None
            # A tag absent from the full JD is pending, not a verified requirement.
            status='body_quote' if quote else 'list_tag' if not description else 'unverified_tag'
            concepts[concept['id']]=concept;tags.append(concept['name'].casefold())
            edges.append({'skill_id':concept['id'],'status':status,'quote':quote['quote'] if quote else '',
                          'start':quote['start'] if quote else -1,'end':quote['end'] if quote else -1})
        stacks=[name for name,terms in STACKS.items() if set(tags)&terms]
        if not stacks:stacks=['other']
        source_parts=urlsplit(row['source_url'])
        canonical_url=('https://careers.tencent.com/jobdesc.html?postId='+row['identity'].rsplit(':',1)[1]
                       if row['source']=='腾讯招聘官网' else 'https://'+source_parts.hostname+source_parts.path)
        props={'posting_id':pid,'source':row['source'],'source_url':canonical_url,'original_source_url':row['source_url'],'raw_id':row.get('raw_id') or 0,
               'sql_ids':row['sql_ids'],'title':title,'company':row.get('company') or '',
               'city':row.get('city') or '', 'experience':row.get('experience') or '', 'education':row.get('education') or '',
               'description':description,'description_available':bool(description),'complete_body_heuristic':complete,
               'publish_time':published or '', 'captured_at':captured or '',
               'reference_time':published or captured or '', 'time_basis':'published' if published else 'collected_proxy' if captured else 'unknown',
               'level':level,'level_basis':'title_explicit' if level!='unknown' else 'unknown','stacks':stacks,
               'domain_id':did,'role_id':rid,'role_name':role,'domain_name':family,'classification_basis':'title_rule' if match else 'unclassified'}
        oid=stable('observation',json.dumps([props,sorted({e['skill_id'] for e in edges})],sort_keys=True,ensure_ascii=False))
        props['id']=oid
        postings.append({'id':pid,'identity':row['identity'],'source':row['source'],'source_url':canonical_url})
        observations.append(props)
        for edge in {e['skill_id']:e for e in edges}.values():requirements.append({'observation_id':oid,**edge})
        domains[did]={'id':did,'name':family};roles[rid]={'id':rid,'name':role,'domain_id':did}
    digest=hashlib.sha256(json.dumps([registry['version'],sorted(o['id'] for o in observations)],ensure_ascii=False).encode()).hexdigest()
    return {'dataset_id':'jd-v2:'+digest[:24],'registry_version':registry['version'],
            'domains':list(domains.values()),'roles':list(roles.values()),'postings':postings,'observations':observations,
            'skills':list(concepts.values()),'categories':registry['categories'],'requirements':requirements,
            'stats':{'postings':len(postings),'full_text_candidates':sum(o['complete_body_heuristic'] for o in observations),
                     'missing_body':sum(not o['description_available'] for o in observations),
                     'date_proxy':sum(o['time_basis']=='collected_proxy' for o in observations),
                     'unclassified':sum(o['classification_basis']=='unclassified' for o in observations),
                     'excluded':dict(excluded)}}


def sync_projection(driver, model):
    """Stage a versioned dataset, activate only after count validation; never delete legacy nodes."""
    constraints=[('KGDataset','id'),('KGState','id'),('KGPosting','id'),('KGObservation','id'),
                 ('KGRole','id'),('KGDomain','id'),('KGSkill','id'),('KGSkillCategory','id')]
    def batches(values,size=200):
        for start in range(0,len(values),size):yield values[start:start+size]
    with driver.session() as session:
        for label,key in constraints:
            session.run(f'CREATE CONSTRAINT {label.lower()}_id IF NOT EXISTS FOR (n:{label}) REQUIRE n.{key} IS UNIQUE').consume()
        existing=session.run('MATCH (s:KGState {id:"job-explorer"}) RETURN s.active_dataset AS id').single()
        if existing and existing['id']==model['dataset_id']:return {'status':'unchanged','dataset_id':model['dataset_id'],**model['stats']}
        dataset=model['dataset_id']
        session.run('MERGE (d:KGDataset {id:$id}) SET d.status="building",d.registry_version=$version,d.started_at=datetime()',id=dataset,version=model['registry_version']).consume()
        queries=[
            ('domains','UNWIND $rows AS row MERGE (n:KGDomain {id:row.id}) SET n += row'),
            ('roles','UNWIND $rows AS row MERGE (n:KGRole {id:row.id}) SET n += row WITH n,row MATCH (d:KGDomain {id:row.domain_id}) MERGE (d)-[:KG_HAS_ROLE]->(n)'),
            ('categories','UNWIND $rows AS row MERGE (n:KGSkillCategory {id:row.id}) SET n.name=row.name'),
            ('skills','UNWIND $rows AS row MERGE (n:KGSkill {id:row.id}) SET n += row WITH n,row MATCH (c:KGSkillCategory {id:row.category}) MERGE (n)-[:KG_IN_CATEGORY]->(c)'),
            ('postings','UNWIND $rows AS row MERGE (n:KGPosting {id:row.id}) SET n += row'),
            ('observations','UNWIND $rows AS row MERGE (o:KGObservation {id:row.id}) ON CREATE SET o += row WITH o,row MATCH (p:KGPosting {id:row.posting_id}),(r:KGRole {id:row.role_id}),(d:KGDataset {id:$dataset}) MERGE (d)-[:KG_CONTAINS]->(o) MERGE (p)-[:KG_OBSERVED]->(o) MERGE (o)-[:KG_CLASSIFIED_AS]->(r)'),
            ('requirements','UNWIND $rows AS row MATCH (o:KGObservation {id:row.observation_id}),(s:KGSkill {id:row.skill_id}) MERGE (o)-[r:KG_REQUIRES]->(s) SET r.status=row.status,r.quote=row.quote,r.start=row.start,r.end=row.end'),
        ]
        for key,query in queries:
            for batch in batches(model[key]):session.run(query,rows=batch,dataset=dataset).consume()
        for category in model['categories']:
            if category['parent']:
                session.run('MATCH (c:KGSkillCategory {id:$child}),(p:KGSkillCategory {id:$parent}) MERGE (c)-[:KG_SUBCATEGORY_OF]->(p)',child=category['id'],parent=category['parent']).consume()
        count=session.run('MATCH (:KGDataset {id:$id})-[:KG_CONTAINS]->(o) RETURN count(o) AS n',id=dataset).single()['n']
        if count!=len(model['observations']):raise RuntimeError('graph observation count mismatch; old dataset stays active')
        def activate(tx):
            tx.run('MATCH (d:KGDataset {id:$id}) SET d.status="ready",d.completed_at=datetime(),d.stats_json=$stats MERGE (s:KGState {id:"job-explorer"}) SET s.previous_dataset=s.active_dataset,s.active_dataset=d.id,s.updated_at=datetime()',id=dataset,stats=json.dumps(model['stats'],ensure_ascii=False)).consume()
        session.execute_write(activate)
        return {'status':'succeeded','dataset_id':dataset,**model['stats']}
