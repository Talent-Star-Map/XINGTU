"""Shared, deterministic matching contract. Source evidence never adds points."""
import hashlib
import json
import math
import re

SCORE_VERSION = 'v3.0.0-shared'
WEIGHTS = {'skill': .40, 'experience': .20, 'education': .15, 'location': .15, 'salary': .10}


def bounded(value):
    value = float(value)
    return round(min(100, max(0, value))) if math.isfinite(value) else 0


def dimensions(scores):
    result = {k: {'score': bounded(scores[k]), 'weight': weight} for k, weight in WEIGHTS.items()}
    for item in result.values():
        item['weighted'] = round(item['score'] * item['weight'], 2)
    return result, bounded(sum(item['weighted'] for item in result.values()))


def salary_range_k(value):
    """Monthly ranges in K, preserving decimals and ignoring a trailing N薪."""
    text = str(value or '').strip()
    if not text or any(word in text for word in ('面议', '保密', '元/天', '/年', '万年')):
        return 0, 0
    text = re.split(r'[·・]', text)[0]
    nums = re.findall(r'\d+(?:\.\d+)?', text)
    if not nums:
        return 0, 0
    factor = 10 if '万' in text else .001 if '元' in text and not re.search(r'[kK千]', text) else 1
    values = [float(n) * factor for n in nums[:2]]
    low, high = values[0], values[-1]
    return (low, high) if 0 <= low <= high else (0, 0)


def complete_profile(profile, person):
    """The same fallback for diagnosis, recommendations and enterprise matching."""
    from services.dimension_scores import parse_years_mid
    output = dict(profile)
    def get(key):
        return person.get(key) if isinstance(person, dict) else getattr(person, key, None)
    if not output.get('education'):
        output['education'] = get('education') or ''
    if output.get('experience_years') is None:
        output['experience_years'] = parse_years_mid(get('experience') or '')
    if not output.get('salary_min') and not output.get('salary_max'):
        output['salary_min'], output['salary_max'] = salary_range_k(get('expected_salary'))
    for key in ('target_city', 'city'):
        if not output.get(key):
            output[key] = get(key) or ''
    return output


def location_score(location, target_city='', current_city=''):
    from services.china_regions import province_for_city
    target = target_city or current_city
    if any(word in str(value).lower() for value in (location, target) for word in ('远程', 'remote', '不限', '全国', 'anywhere')):
        return 75
    if not location or not target:
        return 55
    def cities(value):
        return {part.strip().removesuffix('市') for part in re.split(r'[,，、/|;；\s]+', str(value)) if part.strip()}
    left, right = cities(location), cities(target)
    if left & right:
        return 90
    a = {province_for_city(c) for c in left} - {None}
    b = {province_for_city(c) for c in right} - {None}
    return 72 if a & b else 25


def cache_fingerprint(profile, job=None, **options):
    # Full normalized inputs + algorithm version; never just user/job IDs or skills.
    payload = {'version': SCORE_VERSION, 'profile': profile, 'job': job, 'options': options}
    return hashlib.sha256(json.dumps(payload, sort_keys=True, ensure_ascii=False, default=str).encode()).hexdigest()
