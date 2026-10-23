"""Validate five-field human revisions against known source snapshots."""
from services.role_discovery import definition_draft

FIELD_NAMES = ('name', 'duties', 'required_skills', 'preferred_skills', 'applications')

def validate_version(fields, evidence, publish=False):
    if not isinstance(fields, dict) or set(fields) != set(FIELD_NAMES):
        raise ValueError('岗位定义须包含五个规定字段')
    by_id = {str(r['snapshot_id']): r for r in evidence}
    clean = {}
    for name in FIELD_NAMES:
        values = fields[name]
        if not isinstance(values, list) or len(values) > 12:
            raise ValueError(f'{name} 须为至多 12 项的列表')
        if publish and not values:
            raise ValueError(f'{name} 缺少原文支持，不能发布')
        clean[name] = []
        for value in values:
            if not isinstance(value, dict):
                raise ValueError(f'{name} 项格式错误')
            text, quote = str(value.get('text') or '').strip(), str(value.get('quote') or '').strip()
            row = by_id.get(str(value.get('snapshot_id')))
            if not text or len(text) > 500 or not quote or len(quote) > 1000 or not row:
                raise ValueError(f'{name} 项缺少有效内容或证据标识')
            source = (str(row.get('title') or '')+'\n'+str(row.get('job_description') or ''))
            if quote not in source:
                raise ValueError(f'{name} 的引文不在原始招聘中')
            clean[name].append({'text': text, 'quote': quote,
                                'snapshot_id': row['snapshot_id'],
                                'source_url': row.get('source_url')})
    return clean
