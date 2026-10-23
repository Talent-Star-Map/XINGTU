"""User-scoped interview preparation and local question-bank retrieval."""
import json
import re
import time
import secrets
from pathlib import Path
from collections import Counter
from threading import Lock
from fastapi import HTTPException
from database import get_session, CrawledJob
from services.resume_profile import collect_profile

BANK_PATH = Path(__file__).resolve().parents[1] / 'resources' / 'interview_questions.json'
ROOMS = {}
LOCK = Lock()
TTL = 7200

def load_bank():
    rows = json.loads(BANK_PATH.read_text(encoding='utf-8'))
    return [r for r in rows if r.get('review_status') == 'approved' and r.get('title') and r.get('source')]

def retrieve_questions(role, skills, limit=8):
    terms = [role.lower()] + [str(s).lower() for s in skills]
    groups = [(['java', '后端', 'spring'], ['java', '后端']), (['前端', 'react', 'vue'], ['前端']),
              (['数据分析', '分析师'], ['数据分析']), (['ai', '大模型', 'rag', '智能体'], ['ai应用']),
              (['产品'], ['产品']), (['测试'], ['测试']), (['运维', 'sre'], ['运维'])]
    expanded = list(terms)
    for triggers, extra in groups:
        if any(t in role.lower() for t in triggers): expanded += extra
    scored = []
    for row in load_bank():
        text = ' '.join([row.get('role', ''), row['title'], *row.get('tags', [])]).lower()
        score = sum(3 if term in row.get('role', '').lower() else 1 for term in expanded if term and term in text)
        if score: scored.append((score, row))
    return [r for _, r in sorted(scored, key=lambda pair: -pair[0])[:limit]]

def sanitized_profile(profile):
    basic = profile.get('basic') or {}
    def compact(items, keys, count):
        return [{key: str(item[key])[:700] for key in keys if item.get(key)}
                for item in items[:count] if isinstance(item, dict)]
    return {'experience_years': basic.get('years'), 'bio': str(basic.get('bio', ''))[:500],
            'skills': [str(s)[:60] for s in profile.get('skills', [])[:40]],
            'projects': compact(profile.get('projects', []), ('name', 'description', 'technologies', 'highlights'), 4),
            'work': compact(profile.get('work', []), ('company', 'position', 'description', 'highlights'), 3),
            'education': compact(profile.get('education', []), ('institution', 'degree', 'field'), 2),
            'resume': profile.get('source_resume', {})}

def read_profile(user_id):
    with get_session() as session:
        return collect_profile(session, user_id)

def skill_evidence(role):
    # SQL postings are the original evidence underpinning the role/skill graph.
    with get_session() as session:
        words = re.findall(r'[a-zA-Z+#.]+|[\u4e00-\u9fff]{2,}', role)
        query = session.query(CrawledJob).filter(CrawledJob.data_type == 1, CrawledJob.source_url.isnot(None), CrawledJob.source_url != '')
        from sqlalchemy import or_
        patterns = [word for word in words if len(word) >= 2]
        if not patterns: return []
        patterns = [p.replace('%', '').replace('_', '').replace('\\', '') for p in patterns]
        query = query.filter(or_(*[CrawledJob.title.ilike('%' + p + '%') for p in patterns]))
        rows = query.order_by(CrawledJob.crawl_time.desc()).limit(30).all()
        return [{'id': row.id, 'title': row.title, 'skills': row.skill_tags or [],
                 'source_url': row.source_url, 'text': (row.job_description or '')[:1500]} for row in rows[:10]]

def prepare(user_id, role, target=7):
    profile = read_profile(user_id)
    evidence = skill_evidence(role)
    skills = []
    for row in evidence:
        raw = row['skills']
        if isinstance(raw, str):
            try: raw = json.loads(raw)
            except ValueError: raw = re.split('[,，、]', raw)
        if isinstance(raw, list): skills += [str(s) for s in raw]
    skills = [name for name, _ in Counter(skills).most_common(20)]
    questions = retrieve_questions(role, skills or profile.get('skills', []))
    plan = [{'title': '请简要介绍与你应聘岗位有关的经历，重点讲讲你最熟悉的项目。', 'focus': '经历与岗位', 'source': '星图面试流程'}]
    plan.append({'title': '选择你最熟悉的一个项目，介绍你承担的部分、关键难点和结果。', 'focus': '项目深挖', 'source': '星图项目练习'})
    for row in questions[:target-3]:
        plan.append({'title': row['title'], 'focus': ' / '.join(row.get('tags', [])[:3]),
                     'rubric': row.get('answer', '')[:1000], 'source': row['source'], 'source_url': row.get('source_url', ''), 'id': row['id']})
    while len(plan) < target-1:
        plan.append({'title': ['如果现有方案无法满足性能目标，你会如何定位和改进？', '你如何验证自己交付的功能可靠，并处理上线后的异常？', '遇到不熟悉的问题时，你如何拆解任务并验证方案？', '与同事对技术方案有分歧时，你会如何用证据推动决策？', '需求与交付时间发生冲突时，你会如何确定优先级？'][(len(plan)-2)%5], 'focus': '场景与方法', 'source': '星图通用练习'})
    plan.append({'title': '结合目标岗位，你最希望提升的能力是什么，你准备如何验证进步？', 'focus': '复盘与成长', 'source': '星图面试流程'})
    context = {'candidate': sanitized_profile(profile), 'postings': evidence, 'skills': skills, 'plan': plan[:target], 'role': role}
    identifier = secrets.token_urlsafe(24)
    with LOCK:
        now = time.monotonic()
        for key in list(ROOMS):
            if ROOMS[key]['expires'] < now: del ROOMS[key]
        if len(ROOMS) >= 256:
            raise HTTPException(503, '面试准备人数较多，请稍后重试')
        ROOMS[identifier] = {'owner': user_id, 'expires': now+TTL, 'context': context}
    return {'context_id': identifier, 'target_questions': target, 'skills': skills[:8],
            'resume_title': profile.get('source_resume', {}).get('title', ''),
            'profile_available': bool(profile.get('has_any')), 'question_bank_count': len(questions),
            'question_sources': sorted({q['source'] for q in questions}), 'job_evidence_count': len(evidence)}

def get_context(identifier, user_id):
    with LOCK:
        room = ROOMS.get(identifier)
        if not room or room['owner'] != user_id or room['expires'] < time.monotonic():
            raise HTTPException(404, '面试上下文已失效，请重新开始面试')
        return room['context']

def is_clarification(answer):
    return bool(re.search(r'^(请问|我想了解|我有个疑问)|能.{0,5}(解释|举例|重复|再说)|什么意思|没听清|再说一遍|换.{0,3}(题|问题)|我想问|我有.{0,3}问题|可以.{0,4}(解释|举例)|您能|你能.{0,5}(解释|举例)', answer))
