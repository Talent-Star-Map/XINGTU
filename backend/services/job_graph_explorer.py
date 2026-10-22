"""Read-only multi-view projection from an atomically activated source-backed graph."""
import json
from datetime import datetime, timedelta, timezone
from collections import Counter, defaultdict
from functools import lru_cache
from database import get_neo4j_driver

LEVEL_NAMES={'entry':'应届 / 实习','junior':'初级','mid':'中级','senior':'高级 / 资深','lead':'专家 / 架构 / 负责人','unknown':'级别未注明'}
STACK_NAMES={'java':'Java','python':'Python','frontend':'前端','data':'数据','ai':'AI / Agent','cloud':'云与运维','go':'Go','cpp':'C / C++','other':'未识别技术栈'}


def reference_month(value):
    if not value:return ''
    instant=datetime.fromisoformat(value.replace('Z','+00:00'))
    return instant.astimezone(timezone(timedelta(hours=8))).strftime('%Y-%m')


def query(sql,**params):
    with get_neo4j_driver().session() as s:return s.run(sql,**params).data()


@lru_cache(maxsize=4)
def observations(dataset):
    records=query('''MATCH (:KGDataset {id:$id})-[:KG_CONTAINS]->(o:KGObservation)
        OPTIONAL MATCH (o)-[r:KG_REQUIRES]->(sk:KGSkill)
        OPTIONAL MATCH (sk)-[:KG_IN_CATEGORY]->(c:KGSkillCategory)
        OPTIONAL MATCH (c)-[:KG_SUBCATEGORY_OF]->(parent:KGSkillCategory)
        RETURN properties(o) AS posting,collect(CASE WHEN sk IS NULL THEN null ELSE
            {id:sk.id,name:sk.name,category:sk.category,category_name:c.name,status:r.status,
             category_parent:parent.id,category_parent_name:parent.name,
             quote:r.quote,review_status:sk.review_status} END) AS skills''',id=dataset)
    return [{'posting':row['posting'],'skills':row['skills']} for row in records]


def current_dataset():
    result=query('MATCH (s:KGState {id:"job-explorer"}) MATCH (d:KGDataset {id:s.active_dataset,status:"ready"}) RETURN d.id AS id,d.stats_json AS stats,d.registry_version AS version,toString(d.completed_at) AS updated')
    return result[0] if result else None


def graph_view(view='overview',domain='',role='',stack='',level='',month='',source='',skill='',limit_roles=40,limit_skills=16):
    current=current_dataset()
    if not current:return {'ready':False,'nodes':[],'links':[],'message':'图谱尚未完成来源数据导入'}
    all_rows=observations(current['id'])
    choices={'domains':sorted({r['posting']['domain_name'] for r in all_rows}),
             'roles':sorted({r['posting']['role_name'] for r in all_rows if not domain or r['posting']['domain_name']==domain}),
             'stacks':STACK_NAMES,'levels':LEVEL_NAMES,'sources':sorted({r['posting']['source'] for r in all_rows})}
    rows=[]
    timeline=defaultdict(lambda:{'published':0,'collected_proxy':0})
    for row in all_rows:
        p=row['posting']
        if domain and p['domain_name']!=domain:continue
        if role and p['role_name']!=role:continue
        if stack and stack not in p['stacks']:continue
        if level and p['level']!=level:continue
        if source and p['source']!=source:continue
        period=reference_month(p['reference_time'])
        if period:timeline[period][p['time_basis']]+=1
        if month and period!=month:continue
        rows.append(row)
    groups=defaultdict(list)
    for row in rows:groups[row['posting']['role_name']].append(row)
    if view=='skills' and not role and groups:
        effective_role=sorted(groups,key=lambda name:(name=='待归类岗位',-len(groups[name]),name))[0]
        rows=groups[effective_role]
        groups={effective_role:rows}
    ranked=sorted(groups,key=lambda name:(name=='待归类岗位',-len(groups[name]),name))[:limit_roles]
    nodes={};links=[]
    def node(key,**props):nodes[key]={'id':key,**props}
    for name in ranked:
        members=groups[name];p=members[0]['posting'];rid=p['role_id'];did=p['domain_id']
        node(rid,type='Cluster',name=name,label=name,member_count=len(members),domain=p['domain_name'])
        if view in ('overview','time'):
            node(did,type='Industry',name=p['domain_name'],label=p['domain_name'])
            links.append({'source':did,'target':rid,'type':'HAS_ROLE'})
            continue
        if view=='skills' and not role and name!=ranked[0]:
            del nodes[rid];continue
        supported=Counter();tag_only=Counter();skillmap={}
        full=sum(m['posting']['complete_body_heuristic'] for m in members)
        for member in members:
            for sk in member['skills']:
                skillmap[sk['id']]=sk
                if sk['status']=='body_quote' and member['posting']['complete_body_heuristic']:supported[sk['id']]+=1
                elif sk['status']=='list_tag':tag_only[sk['id']]+=1
        # Verified full-text evidence first, list tags explicitly distinguished.
        ordered=sorted(skillmap,key=lambda k:(-supported[k],-tag_only[k],skillmap[k]['name']))
        ordered=[k for k in ordered if supported[k] or tag_only[k]][:limit_skills]
        for sid in ordered:
            sk=skillmap[sid];count=supported[sid];category=sk.get('category') or 'other';cid='category:'+category
            node(sid,type='Skill',name=sk['name'],label=sk['name'],category=sk.get('category_name'),
                 evidence_count=count,list_tag_count=tag_only[sid],review_status=sk['review_status'])
            links.append({'source':rid,'target':sid,'type':'REQUIRES' if count else 'LIST_TAG',
                          'evidence_count':count,'denominator':full,'frequency':round(count/full,3) if full else None})
            if view=='skills':
                node(cid,type='Category',name=sk.get('category_name') or '待归类技能',label=sk.get('category_name') or '待归类技能')
                links.append({'source':sid,'target':cid,'type':'IN_CATEGORY'})
                if sk.get('category_parent'):
                    parent_id='category:'+sk['category_parent']
                    node(parent_id,type='Category',name=sk['category_parent_name'],label=sk['category_parent_name'])
                    if not any(e['source']==cid and e['target']==parent_id for e in links):
                        links.append({'source':cid,'target':parent_id,'type':'SUBCATEGORY_OF'})
    # Attach bounded, node-specific evidence; never show unrelated global samples on hover.
    ordered_rows=sorted(rows,key=lambda r:r['posting']['reference_time'] or '',reverse=True)
    sample_fields=('posting_id','title','company','city','source','source_url','level','experience','education','reference_time','time_basis','description_available')
    for n in nodes.values():
        matches=[]
        for row in ordered_rows:
            p=row['posting'];quote=None
            if n['type']=='Cluster':belongs=p['role_id']==n['id']
            elif n['type']=='Industry':belongs=p['domain_id']==n['id']
            else:
                skills=[s for s in row['skills'] if s['status'] in ('body_quote','list_tag') and
                        (s['id']==n['id'] if n['type']=='Skill' else
                         n['id'] in ('category:'+str(s.get('category')), 'category:'+str(s.get('category_parent'))))]
                belongs=bool(skills)
                quote=next((s['quote'] for s in skills if s['status']=='body_quote'),None)
            if belongs:
                matches.append({**{k:p.get(k) for k in sample_fields},'quote':quote})
        n['recruitment_count']=len(matches)
        n['recruitment_samples']=matches[:6]
    sample=ordered_rows[:12]
    samples=[]
    for row in sample:
        p=row['posting']
        samples.append({k:p.get(k) for k in ('posting_id','title','company','city','source','source_url','sql_ids','level','experience','education','reference_time','time_basis','description_available')})
    selected_skill=None
    if skill:
        evidence=[]
        for row in rows:
            p=row['posting']
            for sk in row['skills']:
                if sk['id']==skill:
                    selected_skill={'name':sk['name'],'category':sk['category_name'],'review_status':sk['review_status']}
                    if len(evidence)<8:evidence.append({'title':p['title'],'source_url':p['source_url'],'quote':sk['quote'],'status':sk['status']})
        if selected_skill:
            selected_skill['evidence']=evidence
            selected_skill['full_text_denominator']=sum(r['posting']['complete_body_heuristic'] for r in rows)
            selected_skill['body_mentions']=sum(r['posting']['complete_body_heuristic'] and any(s['id']==skill and s['status']=='body_quote' for s in r['skills']) for r in rows)
            selected_skill['list_tags']=sum(any(s['id']==skill and s['status']=='list_tag' for s in r['skills']) for r in rows)
    return {'ready':True,'dataset_id':current['id'],'updated_at':current['updated'],'view':view,
            'nodes':list(nodes.values()),'links':links,'choices':choices,
            'summary':{'postings':len(rows),'roles':len(groups),'displayed_roles':len(ranked),
                       'with_body':sum(r['posting']['description_available'] for r in rows),
                       'full_text_candidates':sum(r['posting']['complete_body_heuristic'] for r in rows),
                       'date_proxy':sum(r['posting']['time_basis']=='collected_proxy' for r in rows),
                       'unknown_level':sum(r['posting']['level']=='unknown' for r in rows)},
            'timeline':[{'month':m,**timeline[m]} for m in sorted(timeline)],
            'samples':samples,'selected_skill':selected_skill,
            'scope_note':'每个方向的技能取自招聘样本；频率分母仅含可用正文样本，不表示所有招聘必需。历史日期优先发布时间，缺失使用有标记的采集日期。时间分布不是历史增长曲线。'}


# Work functions are independent of academic/technical domains. Explicit title
# evidence wins; existing role names are only used when title evidence is absent.
def work_nature(p):
    import re
    if p.get('reviewed_nature'):return p['reviewed_nature']
    title=p.get('title') or ''
    for name, pattern in (
        ('产品与设计',r'产品经理|产品设计|交互|用户体验|UI设计|UX设计'),
        ('测试与质量',r'测试|质量|评测'),
        ('运维与技术支持',r'运维|SRE|DevOps|DBA|技术支持|实施工程'),
        ('安全与风控',r'安全|渗透|漏洞|风控'),
        ('数据分析与运营',r'数据分析|商业分析|商业智能|数据运营|数据标注'),
        ('算法与研究',r'算法|研究|预训练|模型训练'),
        ('工程开发',r'开发|研发|工程师|前端|后端|全栈|嵌入式|程序')):
        if re.search(pattern,title,re.I):return name
    role=p.get('role_name','')
    if role=='待归类岗位':return '待确认工作性质'
    if role=='互联网产品与交互':return '产品与设计'
    if role=='软件测试与质量':return '测试与质量'
    if role=='运维与SRE':return '运维与技术支持'
    if role=='网络与信息安全':return '安全与风控'
    if role in ('数据分析与BI','AI数据与标注'):return '数据分析与运营'
    if role in ('大模型训练与算法','机器学习与算法','推荐搜索与广告算法','多模态与视觉语音'):return '算法与研究'
    return '工程开发'


def employment_view(stage='nature',nature='',role='',skill='',source='',level='',page=1):
    current=current_dataset()
    if not current:return {'ready':False,'nodes':[],'links':[],'message':'招聘图谱尚未导入'}
    from services.classification_agent import apply_approved
    all_rows=apply_approved(observations(current['id']))
    filtered=[r for r in all_rows if (not source or r['posting']['source']==source) and
              (not level or r['posting']['level']==level)]
    natures=Counter(work_nature(r['posting']) for r in filtered)
    rows=[r for r in filtered if not nature or work_nature(r['posting'])==nature]
    roles=Counter(r['posting']['role_name'] for r in rows)
    if role:rows=[r for r in rows if r['posting']['role_name']==role]
    nodes={};links=[]
    def node(id,type,name,**props):nodes[id]={'id':id,'type':type,'name':name,'label':name,**props}
    def edge(a,b,type,**props):links.append({'source':a,'target':b,'type':type,**props})
    def supported(r):return [s for s in r['skills'] if s['status'] in ('body_quote','list_tag')]
    rid=rows[0]['posting']['role_id'] if rows and role else ''
    count=len(rows);pages=1
    if stage in ('skill_roles','skill_jds'):
        # Reverse lookup deliberately starts across roles/natures; source/level still apply.
        rows=filtered
        skillmap={s['id']:s for r in rows for s in supported(r)}
        if not skill:
            counts=Counter(s['id'] for r in rows for s in supported(r))
            for sid,s in skillmap.items():node(sid,'Skill',s['name'],member_count=counts[sid])
            count=len(rows)
        else:
            rows=[r for r in rows if any(s['id']==skill for s in supported(r))]
            count=len(rows)
            selected=skillmap.get(skill)
            if selected:node(skill,'Skill',selected['name'],member_count=count)
            if stage=='skill_roles':
                grouped=defaultdict(list)
                for r in rows:grouped[r['posting']['role_id']].append(r)
                for id,members in grouped.items():
                    node(id,'Cluster',members[0]['posting']['role_name'],member_count=len(members))
                    edge(id,skill,'REQUIRES')
            else:
                pages=max(1,(count+11)//12);page=min(max(1,page),pages)
                batch=sorted(rows,key=lambda r:r['posting'].get('reference_time') or '',reverse=True)[(page-1)*12:page*12]
                for r in batch:
                    p=r['posting'];id='recruitment:'+p['posting_id']
                    item={k:p.get(k) for k in ('posting_id','title','company','city','source','source_url')}
                    node(id,'Recruitment',p.get('company') or '企业未注明',company=p.get('company'),city=p.get('city'),recruitment=item)
                    status=next(s['status'] for s in supported(r) if s['id']==skill)
                    edge(id,skill,'REQUIRES' if status=='body_quote' else 'LIST_TAG')
    elif stage=='nature':
        for name,number in natures.items():node('nature:'+name,'Nature',name,member_count=number)
    elif stage=='roles':
        if nature:node('nature:'+nature,'Nature',nature,member_count=len(rows))
        for name,number in roles.items():
            r=next(r for r in rows if r['posting']['role_name']==name)
            id=r['posting']['role_id'];node(id,'Cluster',name,member_count=number)
            if nature:edge('nature:'+nature,id,'HAS_ROLE')
    elif stage=='skills':
        if rid:node(rid,'Cluster',role,member_count=len(rows))
        counts=Counter(s['id'] for r in rows for s in supported(r))
        for r in rows:
            for s in supported(r):
                node(s['id'],'Skill',s['name'],member_count=counts[s['id']],category=s.get('category_name'))
        for id in counts:
            if rid:edge(rid,id,'REQUIRES')
    elif stage=='postings':
        if skill:rows=[r for r in rows if any(s['id']==skill for s in supported(r))]
        count=len(rows);pages=max(1,(count+11)//12);page=min(max(1,page),pages)
        batch=sorted(rows,key=lambda r:r['posting'].get('reference_time') or '',reverse=True)[(page-1)*12:page*12]
        if rid:node(rid,'Cluster',role,member_count=count)
        for r in batch:
            p=r['posting'];id='recruitment:'+p['posting_id']
            item={k:p.get(k) for k in ('posting_id','title','company','city','source','source_url','experience','education','description','reference_time','time_basis')}
            item['skills']=[{'id':s['id'],'name':s['name'],'status':s['status'],'quote':s.get('quote')} for s in supported(r)]
            # One node represents a company's particular recruitment, not the whole company.
            node(id,'Recruitment',p.get('company') or '企业未注明',company=p.get('company'),city=p.get('city'),recruitment=item)
            if rid:edge(rid,id,'HAS_POSTING')
            for s in supported(r):
                node(s['id'],'Skill',s['name'])
                edge(id,s['id'],'REQUIRES' if s['status']=='body_quote' else 'LIST_TAG')
    return {'ready':True,'dataset_id':current['id'],'updated_at':current.get('updated'),'nodes':list(nodes.values()),'links':links,'stage':stage,
            'page':page,'pages':pages,'postings':count,'roles':len(roles),
            'choices':{'natures':sorted(natures),'roles':sorted(roles),'sources':sorted({r['posting']['source'] for r in all_rows}),'levels':LEVEL_NAMES},
            'classification_note':'工作性质按招聘标题和已有岗位方向规则归类，边界交叉岗位仍需人工核验。'}
