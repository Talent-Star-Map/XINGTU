"""Fail-closed evidence guard. The semantic supervisor cannot override these checks."""
import copy
import json
import re
from services.resume_polish import numbers_in, orgs_in, _bare_org_ok


def leaves(value, prefix=''):
    if isinstance(value, dict):
        for key, item in value.items():
            yield from leaves(item, f'{prefix}.{key}' if prefix else str(key))
    elif isinstance(value, list):
        for index, item in enumerate(value):
            yield from leaves(item, f'{prefix}.{index}')
    elif isinstance(value, str) and value:
        yield prefix, value


def validated_facts(proposed, message):
    result = []
    for fact in proposed[:12] if isinstance(proposed, list) else []:
        if not isinstance(fact, dict):
            continue
        quote, value = fact.get('quote'), fact.get('value')
        if (fact.get('kind') not in ('skill','preference','project','work','education') or
            not isinstance(quote,str) or not quote.strip() or quote not in message or
            not isinstance(value,str) or not value.strip() or value not in quote):
            continue
        # Even direct quotations are candidates until the user confirms attribution.
        result.append({**fact, 'key': str(fact.get('key') or value)[:100]})
    return result


def apply_rewrites(base, proposal, evidence):
    result = copy.deepcopy(base)
    registry = {e['id']: e for e in evidence}
    provenance, issues = {}, []
    for path, value in leaves(base):
        def contains(item):
            raw=str(item.get('text',''))
            if value in raw:return True
            try:return any(value==leaf for _,leaf in leaves(json.loads(raw)))
            except (ValueError,TypeError):return False
        matched=[e for e in evidence if contains(e)]
        provenance[path] = {'source_ids': [e['id'] for e in matched], 'original': value,
                            'source_hashes':{e['id']:e['value_hash'] for e in matched if e.get('value_hash')}}
    for rewrite in proposal.get('rewrites', [])[:40]:
        if not isinstance(rewrite,dict):
            issues.append('改写格式不正确'); continue
        path, value, refs = rewrite.get('path',''), rewrite.get('text'), rewrite.get('source_ids',[])
        # Identity/dates/skills/numeric metrics cannot be changed by a model.
        if not re.fullmatch(r'(?:summary\.text|(?:projects|work_experience)\.items\.\d+\.(?:description|highlights\.\d+))', path):
            issues.append('改写触及受保护字段'); continue
        if not isinstance(value,str) or len(value)>1600 or not refs or any(r not in registry for r in refs):
            issues.append('改写缺少有效来源'); continue
        sources = [registry[r] for r in refs]
        if any(e.get('requires_confirmation') or e.get('type')=='github' for e in sources):
            issues.append('项目或解析内容仍需用户确认'); continue
        source_text = '\n'.join(str(e.get('text','')) for e in sources)
        if not numbers_in(value).issubset(numbers_in(source_text)) or not orgs_in(value).issubset(orgs_in(source_text)) or not _bare_org_ok(value,orgs_in(source_text)):
            issues.append('改写新增了无依据的数字或机构'); continue
        try:
            keys=path.split('.'); target=result
            for key in keys[:-1]: target=target[int(key)] if isinstance(target,list) else target[key]
            key=int(keys[-1]) if isinstance(target,list) else keys[-1]
            original=target[key]
            # Existing metrics must not change role, units or disappear.
            if numbers_in(value) != numbers_in(original):
                issues.append('改写改变了原始数字'); continue
            target[key]=value
            provenance[path]={'source_ids':refs,'original':original,'rewritten':True,
                              'source_hashes':{e['id']:e['value_hash'] for e in sources if e.get('value_hash')}}
        except (KeyError,IndexError,TypeError,ValueError):
            issues.append('改写字段不存在')
    return result, provenance, issues


def review_packet(draft, evidence, provenance, job):
    """Contacts never need to leave the server for semantic review."""
    sanitized=copy.deepcopy(draft)
    sanitized.pop('personal_info',None)
    sanitized_evidence=[]
    for e in evidence:
        text=str(e.get('text',''))
        text=re.sub(r'[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}', '[邮箱已隐藏]', text)
        text=re.sub(r'(?<!\d)1[3-9]\d{9}(?!\d)','[电话已隐藏]',text)
        sanitized_evidence.append({**e,'text':text})
    return {'draft':sanitized,'evidence':sanitized_evidence,'provenance':{k:v for k,v in provenance.items() if not k.startswith('personal_info.')},'target_job':job}
