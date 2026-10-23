"""Read the authenticated jobseeker's career context; never accept identity from a prompt."""
import json
import re
from sqlalchemy import func, text
from database import Jobseeker, Resume, ResumeSection, get_session


def clean(value, limit=220):
    if not isinstance(value, (str, int, float)):
        return ''
    value = str(value).strip()
    value = re.sub(r'[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}', '[邮箱已省略]', value)
    value = re.sub(r'(?<!\d)1[3-9]\d{9}(?!\d)', '[电话已省略]', value)
    return value[:limit]


def skill_list(value):
    values = value if isinstance(value, list) else re.split(r'[,，、;；\n]+', value or '')
    output = {}
    for item in values:
        if isinstance(item, str) and item.strip():
            name = clean(item, 50)
            output.setdefault(name.casefold(), name)
    return list(output.values())


def merge_skills(account, sections, marks):
    resume_skills = [skill for category in (sections.get('skills', {}).get('categories') or [])
                     if isinstance(category, dict) for skill in (category.get('skills') or []) if isinstance(skill, str)]
    resume_skills = skill_list(resume_skills)
    source = 'latest_resume' if resume_skills else 'account'
    skills = {name.casefold(): name for name in (resume_skills or skill_list(account))}
    grouped = {}
    for mark in marks:
        name = clean(mark.get('skill_name'), 50)
        if name:
            grouped.setdefault(name.casefold(), []).append(mark)
    for key, records in grouped.items():
        global_mark = next((r for r in records if r.get('job_id') is None), None)
        mastered = bool(global_mark['mastered']) if global_mark else any(r['mastered'] for r in records)
        if global_mark and not mastered:
            skills.pop(key, None)
        elif mastered:
            skills.setdefault(key, clean(records[0]['skill_name'], 50))
    return list(skills.values())[:50], source


def section_items(sections, kind, fields):
    result = []
    for item in (sections.get(kind, {}).get('items') or [])[:3]:
        if not isinstance(item, dict):
            continue
        record = {key: clean(item.get(key)) for key in fields if clean(item.get(key))}
        for key in ('highlights', 'technologies'):
            values = item.get(key)
            if isinstance(values, list):
                record[key] = [clean(v, 140) for v in values[:3] if clean(v)]
        if record:
            result.append(record)
    return result


def build_context(user, sections, marks, resume_id=None):
    skills, skill_source = merge_skills(user.get('skills'), sections, marks)
    personal = sections.get('personal_info', {})
    fields = {key: clean(user.get(key)) for key in ('target_position', 'target_city', 'expected_salary', 'experience', 'education', 'school')}
    fields['target_position'] = clean(personal.get('jobTitle')) or fields['target_position']
    fields['skills'] = skills
    fields['education_records'] = section_items(sections, 'education', ('institution', 'degree', 'field', 'startDate', 'endDate'))
    if fields['education_records']:
        fields['education'] = fields['education_records'][0].get('degree') or fields['education']
        fields['school'] = fields['education_records'][0].get('institution') or fields['school']
    fields['work_experience'] = section_items(sections, 'work_experience', ('company', 'position', 'startDate', 'endDate', 'description'))
    fields['projects'] = section_items(sections, 'projects', ('name', 'description', 'startDate', 'endDate'))
    fields['summary'] = clean(sections.get('summary', {}).get('text') or user.get('bio'), 400)
    missing = [key for key in ('target_position', 'skills', 'education') if not fields.get(key)]
    result = {'status': 'ready' if any(fields.values()) else 'empty', 'profile': fields,
              'sources': ['account'] + (['latest_resume'] if resume_id else []) + (['skill_marks'] if marks else []),
              'skill_source': skill_source, 'resume_id': resume_id, 'missing': missing,
              'interpretation': '用户填写、简历提及及用户确认的资料；不是经过认证的能力等级，不得将项目或在校经历改称工作经历。'}
    # Keep the whole record within Reporter's complete-record evidence budget.
    while len(json.dumps(result, ensure_ascii=False)) > 4800:
        longest = max(('projects', 'work_experience', 'education_records', 'skills'), key=lambda k: len(json.dumps(fields[k], ensure_ascii=False)))
        if fields[longest]:
            fields[longest].pop()
        else:
            break
        result['truncated'] = True
    return result


def load_chat_profile(user_id, session=None):
    owned = session is None
    session = session or get_session()
    try:
        user = session.query(Jobseeker).filter(Jobseeker.id == user_id).first()
        if not user:
            return {'status': 'empty', 'profile': {}, 'sources': [], 'missing': ['personal_profile']}
        resume = session.query(Resume).filter(Resume.user_id == user_id).order_by(func.coalesce(Resume.updated_at, Resume.created_at).desc(), Resume.id.desc()).first()
        sections = {}
        if resume:
            for section in session.query(ResumeSection).filter(ResumeSection.resume_id == resume.id).order_by(ResumeSection.sort_order).all():
                if isinstance(section.content, dict) and section.visible is not False and section.visible != 0:
                    sections.setdefault(section.section_type, section.content)
        marks = [dict(row) for row in session.execute(text('SELECT skill_name, mastered, job_id FROM user_skills WHERE user_id=:uid ORDER BY id DESC'), {'uid': user_id}).mappings().all()]
        account = {key: getattr(user, key, None) for key in ('skills', 'target_position', 'target_city', 'expected_salary', 'experience', 'education', 'school', 'bio')}
        return build_context(account, sections, marks, resume.id if resume else None)
    finally:
        if owned:
            session.close()
