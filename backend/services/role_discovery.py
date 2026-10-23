"""Train-only role prototypes and evidence-bound definition candidates.

Novelty is relative to a supplied catalog, never proof of a market-first role.
No database, provider, or mutable import-time data is needed by this module.
"""
from collections import Counter, defaultdict
import math
import re

from services.evidence_graph import tokens, evidence_skills


def requirement_evidence(row):
    text = str(row.get('job_description') or '')
    evidence = evidence_skills(text, row.get('skills_required', row.get('skill_tags', [])))
    output = {}
    for skill, match in evidence.items():
        pos = match['start']
        boundaries = list(re.finditer(r'[，,。；;\n]', text))
        start = max([m.end() for m in boundaries if m.end() <= pos] or [0])
        end = min([m.start() for m in boundaries if m.start() >= match['end']] or [len(text)])
        quote = text[start:end].strip()
        prefix = text[start:pos]
        kind = ('negated' if re.search(r'不要求|无需|不需要|不必|not required|no need', prefix, re.I) else
                'preferred' if re.search(r'优先|加分|更佳|preferred|nice.to.have|a plus', quote, re.I) else
                'required' if re.search(r'必须|必备|要求|熟练|掌握|熟悉|required|must|proficien', quote, re.I) else
                'unclassified')
        output[skill] = {'type': kind, 'quote': quote, 'snapshot_id': row.get('snapshot_id'),
                         'source_url': row.get('source_url')}
    return output


class RolePrototypeIndex:
    """TF-IDF text and skill prototypes fit exclusively on reference documents."""
    def __init__(self, rows, text_weight=.7):
        if not rows:
            raise ValueError('reference catalog is empty')
        if not 0 <= text_weight <= 1:
            raise ValueError('text_weight must be in [0, 1]')
        self.text_weight = text_weight
        self.idf = {}
        df = Counter()
        for row in rows:
            df.update(set(tokens(self._text(row))))
        self.idf = {t: math.log((1 + len(rows)) / (1 + n)) + 1 for t, n in df.items()}
        grouped = defaultdict(list)
        for row in rows:
            grouped[row['role']].append(row)
        self.prototypes = {}
        for role, records in grouped.items():
            text, skills = Counter(), Counter()
            for row in records:
                text.update(self.vector(row))
                skills.update(self.skill_vector(row))
            self.prototypes[role] = (self.normalize(text), self.normalize(skills))

    @staticmethod
    def _text(row):
        return str(row.get('title', '')) + ' ' + str(row.get('job_description', ''))

    @staticmethod
    def normalize(vector):
        norm = math.sqrt(sum(v*v for v in vector.values()))
        return {k: v/norm for k, v in vector.items()} if norm else {}

    def vector(self, row):
        counts = Counter(tokens(self._text(row)))
        return self.normalize({t: (1 + math.log(n))*self.idf[t] for t, n in counts.items() if t in self.idf})

    def skill_vector(self, row):
        # Only literal source-supported mentions contribute to similarity.
        skills = evidence_skills(str(row.get('job_description') or ''), row.get('skills_required', []))
        return self.normalize({s: 1.0 for s in skills})

    def score(self, row):
        text, skills = self.vector(row), self.skill_vector(row)
        scores = []
        for role, (ptext, pskills) in self.prototypes.items():
            ts = sum(v*ptext.get(k, 0) for k, v in text.items())
            ss = sum(v*pskills.get(k, 0) for k, v in skills.items())
            weight = self.text_weight if skills and pskills else 1.0
            scores.append({'role': role, 'similarity': weight*ts + (1-weight)*ss,
                           'text_similarity': ts, 'skill_similarity': ss})
        scores.sort(key=lambda item: (-item['similarity'], item['role']))
        return {'nearest_role': scores[0]['role'], 'novelty': 1-scores[0]['similarity'],
                'comparisons': scores[:3], 'scope': 'catalog_relative_novelty'}


def definition_draft(rows):
    """Extractive five-field draft; missing evidence remains empty for review.

    Unlike free generation, text is copied from sources. This is a usable fallback
    and does not claim semantically verified LLM output.
    """
    fields = {k: [] for k in ('name', 'duties', 'required_skills', 'preferred_skills', 'applications')}
    seen = {k: set() for k in fields}
    def add(field, value, quote, row):
        if value not in seen[field] and len(fields[field]) < 12:
            seen[field].add(value)
            fields[field].append({'text': value, 'quote': quote, 'snapshot_id': row.get('snapshot_id'),
                                  'source_url': row.get('source_url')})
    for row in rows:
        if not row.get('source_url') or not row.get('snapshot_id'):
            continue
        title = str(row.get('title') or '').strip()
        if title:
            add('name', title, title, row)
        for sentence in re.split(r'[。；;\n]', str(row.get('job_description') or '')):
            sentence = sentence.strip()
            if re.search(r'负责|设计|研发|维护|开发|responsib|develop|design', sentence, re.I):
                add('duties', sentence, sentence, row)
            if re.search(r'应用于|应用场景|面向.*业务|用于|业务场景', sentence):
                add('applications', sentence, sentence, row)
        for skill, item in requirement_evidence(row).items():
            field = {'required': 'required_skills', 'preferred': 'preferred_skills'}.get(item['type'])
            if field:
                add(field, skill, item['quote'], row)
    return {'fields': fields, 'missing_fields': [k for k, v in fields.items() if not v],
            'status': 'draft_requires_review', 'generation': 'extractive',
            'note': '名称为来源候选，必需及优先为规则判读，发布前需人工复核。'}
