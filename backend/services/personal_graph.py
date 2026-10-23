"""Read-only personal experience graph. @owner Dsegnr

Edges describe supplied fields / text mentions, not verified proficiency.
No LLM, external requests, graph writes or schema changes.
"""
import hashlib
import json
import re

from database import Jobseeker, Resume, ResumeSection
from services.resume_profile import collect_profile


def _text(value):
    return value.strip() if isinstance(value, str) else ''


def _strings(value):
    if isinstance(value, str):
        return [x.strip() for x in re.split(r'[,，、;；\n|｜]+', value) if x.strip()]
    return [_text(x) for x in value if _text(x)] if isinstance(value, list) else []


def _key(name):
    # Only unambiguous spelling aliases; never split C++ or slash-separated skills.
    key = re.sub(r'\s+', ' ', name.strip()).casefold()
    return {'python3': 'python', 'python 3': 'python', 'nodejs': 'node.js',
            'reactjs': 'react', 'react.js': 'react', 'vuejs': 'vue', 'vue.js': 'vue',
            'postgres': 'postgresql', 'golang': 'go'}.get(key, key)


def build_graph(profile, *, name='', source=None, project_source='resume'):
    """Pure mapping, retaining a quote for every edge supporting an experience skill."""
    source = source or {}
    nodes = [{'id': 'person', 'kind': 'person', 'name': name or '我',
              'description': '从当前简历与个人资料整理的经历和技术关系。'}]
    edges, evidence, skills = [], [], {}
    claimed = _strings(profile.get('skills', []))

    def skill(raw):
        key = _key(raw)
        if key not in skills:
            sid = 'skill:' + hashlib.sha256(key.encode()).hexdigest()[:20]
            skills[key] = {'id': sid, 'kind': 'skill', 'name': raw,
                           'aliases': [], 'evidenceIds': [], 'experienceIds': []}
            nodes.append(skills[key])
        node = skills[key]
        if raw not in node['aliases']: node['aliases'].append(raw)
        return node

    for raw in claimed:
        n = skill(raw)
        n['selfDeclared'] = True

    for section, kind, origin in [('projects', 'project', project_source), ('work', 'work', 'resume')]:
        items = profile.get(section, [])
        if not isinstance(items, list): continue
        for i, item in enumerate(items):
            if not isinstance(item, dict): continue
            title = _text(item.get('name')) or _text(item.get('company')) or _text(item.get('title'))
            description = _text(item.get('description'))
            highlights = _strings(item.get('highlights', []))
            technologies = _strings(item.get('technologies', []))
            if not (title or description or highlights or technologies): continue
            eid = f'{kind}:{i}'
            node = {'id': eid, 'kind': kind, 'name': title or ('项目经历' if kind == 'project' else '工作经历'),
                    'role': _text(item.get('position')) or _text(item.get('role')),
                    'startDate': _text(item.get('startDate')), 'endDate': _text(item.get('endDate')),
                    'current': item.get('current') is True, 'description': description,
                    'highlights': highlights, 'evidenceIds': [], 'source': origin,
                    'sourceSection': 'projects' if kind == 'project' else 'work_experience', 'sourceIndex': i}
            nodes.append(node)
            edges.append({'id': 'participates:' + eid, 'source': 'person', 'target': eid, 'kind': 'experience', 'label': '经历'})
            matches = [(t, '技术字段', t) for t in technologies]
            # Search only already-declared skills in the item's body, never infer from its title.
            for raw in claimed:
                if len(raw) < 3 or _key(raw) in {'go'}: continue
                pattern = re.compile(r'(?<![A-Za-z0-9_+#])' + re.escape(raw) + r'(?![A-Za-z0-9_+#])', re.I) if raw.isascii() else re.compile(re.escape(raw), re.I)
                for quote in [description, *highlights]:
                    hit = pattern.search(quote)
                    if hit and not re.search(r'未(?:曾|实际)?(?:使用|接触|掌握)|不(?:会|熟悉|涉及)|无需|without|not\s+us', quote[max(0, hit.start()-16):hit.start()], re.I):
                        matches.append((raw, '原文提及', quote)); break
            seen = set()
            for raw, basis, quote in matches:
                n = skill(raw)
                if n['id'] in seen: continue
                seen.add(n['id'])
                proof_id = f'evidence:{eid}:{len(node["evidenceIds"])}'
                proof = {'id': proof_id, 'experienceId': eid, 'skillId': n['id'], 'quote': quote,
                         'basis': basis, 'source': origin, 'section': node['sourceSection'],
                         'itemIndex': i, 'field': 'technologies' if basis == '技术字段' else 'description/highlights'}
                evidence.append(proof);node['evidenceIds'].append(proof_id);n['evidenceIds'].append(proof_id)
                n['experienceIds'].append(eid)
                edges.append({'id': f'link:{eid}:{n["id"]}', 'source': eid, 'target': n['id'],
                              'kind': 'supported', 'label': '经历列示' if basis == '技术字段' else '原文提及', 'evidenceId': proof_id})
    for n in skills.values():
        if not n['experienceIds']:
            edges.append({'id': 'declares:' + n['id'], 'source': 'person', 'target': n['id'], 'kind': 'declared', 'label': '仅技能记录'})
    return {'nodes': nodes, 'edges': edges, 'evidence': evidence, 'sourceResume': source,
            'summary': {'experiences': sum(n['kind'] in ('project', 'work') for n in nodes),
                        'skills': len(skills), 'supportedSkills': sum(bool(n['experienceIds']) for n in skills.values()),
                        'unlinkedSkills': sum(not n['experienceIds'] for n in skills.values())},
            'notice': '连线表示资料中的经历与技术关联，不代表能力评分或独立核实。'}


def load_personal_graph(session, user_id):
    account = session.query(Jobseeker).filter(Jobseeker.id == user_id).first()
    if not account: return None
    profile = collect_profile(session, user_id)
    latest = session.query(Resume).filter(Resume.user_id == user_id).order_by(Resume.updated_at.desc(), Resume.id.desc()).first()
    source = dict(profile['source_resume'])
    source['updatedAt'] = latest.updated_at.isoformat() if latest and latest.updated_at else None
    project_section = session.query(ResumeSection).filter(ResumeSection.resume_id == latest.id, ResumeSection.section_type == 'projects').first() if latest else None
    has_resume_projects = bool(project_section and isinstance(project_section.content, dict) and project_section.content.get('items'))
    origin = 'resume' if has_resume_projects else 'profile'
    # Preserve structured project technologies in the profile fallback; collect_profile's
    # legacy preview normalizer intentionally drops these fields.
    if not has_resume_projects:
        raw = account.projects
        if isinstance(raw, str):
            try: raw = json.loads(raw)
            except (ValueError, TypeError): raw = []
        if isinstance(raw, dict): raw = [raw]
        if isinstance(raw, list): profile['projects'] = [x for x in raw if isinstance(x, dict)]
    name = profile['basic'].get('fullName') or account.username
    return build_graph(profile, name=name, source=source, project_source=origin)
