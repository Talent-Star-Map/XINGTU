"""Authenticated private RAG + separately scoped graph context; no generated resume feedback."""
import json
import re
import hashlib
from pathlib import Path
from sqlalchemy import or_, text
from services.career_store import CareerStore


def load_profile(user_id, store=None, stage_materials=False):
    from database import get_session, Jobseeker, Resume, ResumeSection
    from services.resume_profile import collect_profile
    store = store or CareerStore()
    session = get_session()
    try:
        # Exclude every assistant-generated target version from base-material selection.
        generated = session.execute(text('SELECT resume_id FROM resume_target_bindings WHERE owner=:owner'),
                                    {'owner': f'jobseeker:{user_id}'}).scalars().all()
        query = session.query(Resume).filter(Resume.user_id == user_id)
        if generated:
            query = query.filter(~Resume.id.in_(generated))
        latest = query.order_by(Resume.updated_at.desc(), Resume.id.desc()).first()
        # collect_profile's account merge is reused but latest resume is overwritten
        # explicitly, so target resumes can never become the source of new facts.
        profile = collect_profile(session, user_id)
        sections = {}
        if latest:
            sections = {s.section_type: s.content for s in session.query(ResumeSection).filter(
                ResumeSection.resume_id == latest.id, ResumeSection.visible == 1).all()}
        user = session.query(Jobseeker).filter(Jobseeker.id == user_id).first()
        if not user:
            raise ValueError('求职者资料不存在')
        # Account is the primary source, never overwritten by a target resume.
        from services.resume_profile import split_skills, _project_items_from_raw, parse_years
        profile['basic'].update(fullName=user.real_name or '', phone=user.phone or '', email=user.email or '',
                                school=user.school or '', degree=user.education or '', bio=user.bio or '',
                                targetPosition=user.target_position or '', years=parse_years(user.experience),
                                city=user.city or user.target_city or '')
        profile['target_city']=user.target_city or ''
        profile['work'] = (sections.get('work_experience') or {}).get('items', [])
        profile['education'] = (sections.get('education') or {}).get('items', [])
        if not profile['education'] and (user.school or user.education):
            profile['education'] = [{'institution': user.school or '', 'degree': user.education or ''}]
        profile['projects'] = (sections.get('projects') or {}).get('items', []) or _project_items_from_raw(user.projects)
        profile['skills'] = split_skills(user.skills)
        for c in (sections.get('skills') or {}).get('categories', []):
            for skill in c.get('skills', []):
                if isinstance(skill, str) and skill not in profile['skills']:
                    profile['skills'].append(skill)
        profile['source_resume'] = {'id': latest.id if latest else None, 'title': latest.title if latest else ''}
        evidence = [{'id': 'account', 'type': 'user_entered', 'text': json.dumps({
            'basic': profile['basic'], 'projects': _project_items_from_raw(user.projects),
            'skills': split_skills(user.skills)}, ensure_ascii=False)}]
        if latest:
            evidence.append({'id': f'resume:{latest.id}', 'type': 'user_resume', 'text': json.dumps(sections, ensure_ascii=False)})
    finally:
        session.close()
    # Personal-center uploaded resume is a different source than ResumeCenter.
    # Load only authenticated-owned cached parsed fields, with an actual live attachment.
    from routers.auth import UPLOAD_DIR
    folder = Path(UPLOAD_DIR) / 'resumes'
    caches = sorted(folder.glob(f'{user_id}_*.json'), key=lambda p: p.stat().st_mtime, reverse=True)[:3]
    for path in caches:
        if path.is_symlink() or not path.with_suffix('').is_file():
            continue
        try:
            raw = json.loads(path.read_text(encoding='utf-8'))
        except (ValueError, OSError):
            continue
        excerpt = str(raw.get('raw_text_preview') or '')[:12000]
        if excerpt:
            evidence.append({'id': 'attachment:' + path.name, 'type': 'parsed_resume',
                             'text': excerpt, 'partial': True, 'requires_confirmation': True})
            if stage_materials:
                from services.resume_import import build_sections
                digest=hashlib.sha256(path.read_bytes()).hexdigest()
                source={'type':'resume','attachment':path.name,'digest':digest}
                for section in build_sections(raw):
                    kind=section['section_type']
                    if kind=='skills':
                        for category in section['content'].get('categories',[]):
                            for skill in category.get('skills',[]):
                                if isinstance(skill,str) and skill.lower() in excerpt.lower():
                                    store.upsert_fact(f'jobseeker:{user_id}','skill',skill,skill,source,{'text':excerpt,'attachment':path.name},False)
                    elif kind in ('projects','work_experience','education'):
                        for item in section['content'].get('items',[])[:8]:
                            label=item.get('name') or item.get('company') or item.get('institution')
                            if label and label in excerpt:
                                category={'projects':'project','work_experience':'work','education':'education'}[kind]
                                store.upsert_fact(f'jobseeker:{user_id}',category,str(label)[:200],item,source,{'text':excerpt,'attachment':path.name},False)
    facts = store.list_facts(f'jobseeker:{user_id}')
    for fact in facts:
        if fact['status'] == 'active' and fact['confirmed']:
            source=fact.get('source') or {}
            if source.get('attachment'):
                name=source['attachment']
                cached=folder / name
                if (Path(name).name!=name or not name.startswith(f'{user_id}_') or cached.is_symlink()
                        or not cached.is_file() or not cached.with_suffix('').is_file()
                        or hashlib.sha256(cached.read_bytes()).hexdigest()!=source.get('digest')):
                    store.invalidate_source(f'jobseeker:{user_id}',source)
                    continue
            evidence.append({'id': 'fact:' + fact['id'], 'type': 'user_confirmed',
                             'value_hash':hashlib.sha256(json.dumps(fact['value'],ensure_ascii=False,sort_keys=True).encode()).hexdigest(),
                             'text': json.dumps({'name':fact['fact_key'],'value':fact['value']}, ensure_ascii=False)})
            if fact['kind'] == 'skill' and isinstance(fact['value'], str) and fact['value'] not in profile['skills']:
                profile['skills'].append(fact['value'])
            if fact['kind']=='preference' and '城市' in fact['fact_key'] and isinstance(fact['value'],str):
                profile['target_city']=fact['value']
            if fact['kind'] in ('project', 'work', 'education') and isinstance(fact['value'], dict):
                dest = {'project': 'projects', 'work': 'work', 'education': 'education'}[fact['kind']]
                profile[dest].append(fact['value'])
            elif fact['kind'] == 'project' and isinstance(fact['value'], str):
                profile['projects'].append({'name':fact['fact_key'], 'description':fact['value'], 'highlights':[], 'technologies':[]})
            elif fact['kind'] in ('work','education') and isinstance(fact['value'],str):
                # A free text statement cannot establish organization or time fields.
                # Retain as user-confirmed context; ask for structured details before writing.
                pass
    profile['has_any'] = bool(profile['skills'] or profile['projects'] or profile['work'] or profile['basic'].get('fullName'))
    return {'profile': profile, 'evidence': evidence, 'facts': facts}


def job_snapshot(row):
    from routers.jobs import _format_job
    result = _format_job(row)
    result.update(job_key=f'market:{row.id}', source_url=row.source_url or '',
                  status='unknown', status_label='库内收录，当前招聘状态未核实',
                  evidence_scope='single_job',
                  evidence_id=f'market:{row.id}:{row.crawl_time.isoformat() if row.crawl_time else "unknown"}')
    return result


def get_target(job_key):
    from database import get_session, CrawledJob
    if not re.fullmatch(r'market:[1-9]\d*', str(job_key)):
        raise ValueError('请选择一条实际招聘岗位，职业类别不能直接作为定制简历目标')
    session = get_session()
    try:
        row = session.query(CrawledJob).filter(CrawledJob.id == int(job_key.split(':')[1]), CrawledJob.data_type == 1).first()
        if not row:
            raise ValueError('该岗位已不存在，请重新选择')
        return job_snapshot(row)
    finally:
        session.close()


def retrieve_jobs(query, context, limit=5):
    """Bound SQL recall, rank on actual skills. Graph IDs never become market IDs."""
    from database import get_session, CrawledJob
    from services.skill_synonyms import canonical_name
    words = list(dict.fromkeys(re.findall(r'[A-Za-z][A-Za-z0-9+#.]*|[\u4e00-\u9fff]{2,12}', query)))[:8]
    skills = context.get('profile', {}).get('skills', [])
    if not words:
        words = skills[:4]
    if not words:
        return []
    session = get_session()
    try:
        clauses = []
        for word in words:
            esc = word.replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_')
            clauses += [CrawledJob.title.like('%'+esc+'%', escape='\\'), CrawledJob.skill_tags.like('%'+esc+'%', escape='\\')]
        selection=session.query(CrawledJob).filter(CrawledJob.data_type == 1, or_(*clauses))
        city=context.get('profile',{}).get('target_city','')
        if city and len(city)<=20:
            selection=selection.filter(CrawledJob.city.like('%'+city.replace('%','\\%').replace('_','\\_')+'%',escape='\\'))
        rows = selection.order_by(CrawledJob.crawl_time.desc()).limit(100).all()
        known = {canonical_name(s) for s in skills if isinstance(s, str)}
        result = []
        for row in rows:
            job = job_snapshot(row)
            matched = [s for s in job['skills'] if isinstance(s, str) and canonical_name(s) in known]
            job['matched_skills'] = matched
            job['recommendation_basis'] = '已填技能交集：' + '、'.join(matched) if matched else '符合本次检索方向，能力是否匹配还需核对'
            result.append(job)
        from services.match_analyzer import extract_profile_features,compute_match_score
        features=extract_profile_features(skills,'skill_list')
        basic=context.get('profile',{}).get('basic',{})
        features.update(education=basic.get('degree',''),experience_years=basic.get('years'),target_city=city)
        for job in result:
            analysis=compute_match_score(features,job,{}, {},result)
            job['fit_score']=analysis['overall']
            job['score_version']=analysis.get('score_version')
            job['missing_information']=analysis.get('missing_information',[])
            job['skill_gaps']=[item['skill'] for item in analysis.get('skills',{}).get('miss',[])][:5]
        return sorted(result, key=lambda x: x['fit_score'], reverse=True)[:limit]
    finally:
        session.close()


def retrieve_graph(query):
    from services import kg_service
    matches = kg_service.semantic_search_jobs(query[:200], 3)
    out = []
    for item in matches[:3]:
        jid = item.get('id')
        if jid:
            detail = kg_service.get_job_detail(jid)
            if detail:
                out.append({'type': 'graph_role_context', 'scope': 'role_group_aggregate',
                            'warning': '图谱关联用于职业解释，不能当作具体公司招聘事实或用户技能', 'data': detail})
                neighbors=kg_service.get_job_neighbors(jid,depth=1,limit=12)
                out.append({'type':'graph_relationships','scope':'role_group_aggregate','data':neighbors})
    return out


def private_rag(evidence, query, max_chars=18000):
    """Deterministic per-user retrieval; no external vector service or shared user index."""
    terms=set(re.findall(r'[A-Za-z][A-Za-z0-9+#.]*|[\u4e00-\u9fff]{2,8}',query.lower()))
    def rank(item):
        text=str(item.get('text','')).lower()
        return sum(text.count(term) for term in terms)+(3 if item.get('type')=='user_confirmed' else 0)
    selected=[];budget=max_chars
    for item in sorted(evidence,key=rank,reverse=True):
        content=str(item.get('text',''))
        if len(content)>budget:
            if budget<500:break
            # Preserve explicit partial marker instead of pretending to read the whole source.
            item={**item,'text':content[:budget],'partial':True}
        selected.append(item);budget-=len(str(item.get('text','')))
        if budget<=0:break
    return selected
