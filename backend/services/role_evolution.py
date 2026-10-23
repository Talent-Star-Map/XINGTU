"""Role-population skill signals from independent employer observations.

Unlike ``posting_evolution``, this compares two cross-sectional windows. It
cannot establish that an individual job advertisement changed or that a
technology caused demand. A signal is only an observed recruitment-text trend.
"""
from collections import defaultdict
from math import sqrt

from services.posting_evolution import _skills, _time, posting_identity


def _wilson(successes: int, trials: int, z: float = 1.96):
    if not trials:
        return (0.0, 1.0)
    p = successes / trials
    denominator = 1 + z * z / trials
    center = (p + z * z / (2 * trials)) / denominator
    half_width = z * sqrt(p * (1 - p) / trials + z * z / (4 * trials * trials)) / denominator
    return (max(0.0, center - half_width), min(1.0, center + half_width))


def _window(observations, start, end):
    """Latest version per listing, then union skills within each employer.

    Keeping only one listing per employer silently discarded other teams' skills.
    Employer unions measure presence in any observed listing, not posting frequency.
    """
    chosen = {}
    sources = set()
    for row in observations:
        observed = _time(row)
        company = str(row.get('company_name') or '').strip().casefold()
        source = str(row.get('source') or '').strip()
        skills = _skills(row)
        if not observed or not start <= observed < end or not company or not source or skills is None:
            continue
        key = (observed, str(row.get('id') or row.get('source_url') or ''))
        identity = posting_identity(row) or (source, company, str(row.get('id') or ''))
        if not identity[-1]:
            continue
        if identity not in chosen or key > chosen[identity][0]:
            chosen[identity] = (key, skills, source, company)
    employers = defaultdict(set)
    for _, skills, source, company in chosen.values():
        sources.add(source)
        employers[company].update(skills)
    return list(employers.values()), sorted(sources)


def role_skill_trends(observations, earlier_start, earlier_end, later_start,
                      later_end, minimum_employers=5, minimum_sources=2):
    """Return conservative candidates when Wilson intervals do not overlap.

    Dates are half-open UTC intervals. `confirmed` here means supported by
    sampling criteria only; final domain confirmation still requires review.
    """
    bounds = [_time({'captured_at': value}) for value in
              (earlier_start, earlier_end, later_start, later_end)]
    if any(value is None for value in bounds) or not (bounds[0] < bounds[1] <= bounds[2] < bounds[3]):
        raise ValueError('non-overlapping, increasing observation windows are required')
    before, before_sources = _window(observations, bounds[0], bounds[1])
    after, after_sources = _window(observations, bounds[2], bounds[3])
    skills = sorted(set().union(*before, *after)) if before or after else []
    results = []
    for skill in skills:
        b_count = sum(skill in group for group in before)
        a_count = sum(skill in group for group in after)
        b_interval = _wilson(b_count, len(before))
        a_interval = _wilson(a_count, len(after))
        sufficient = len(before) >= minimum_employers and len(after) >= minimum_employers
        source_diverse = len(set(before_sources + after_sources)) >= minimum_sources
        direction = ('increase' if a_interval[0] > b_interval[1] else
                     'decrease' if b_interval[0] > a_interval[1] else 'uncertain')
        status = ('insufficient_coverage' if not sufficient else
                  'single_source_candidate' if not source_diverse and direction != 'uncertain' else
                  'trend_candidate' if direction != 'uncertain' else 'uncertain')
        results.append({'skill': skill, 'direction': direction, 'status': status,
                        'earlier': {'employers': len(before), 'mentions': b_count,
                                    'rate': b_count / len(before) if before else None,
                                    'wilson_95': b_interval, 'sources': before_sources},
                        'later': {'employers': len(after), 'mentions': a_count,
                                  'rate': a_count / len(after) if after else None,
                                  'wilson_95': a_interval, 'sources': after_sources},
                        'causal_reason': None})
    return results
