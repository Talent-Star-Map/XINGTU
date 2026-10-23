"""Deterministic verification of LLM-proposed skill evidence spans.

The model proposes a claim and quote; only verbatim source spans can enter the
evidence store. This does not establish that a requirement is mandatory or
that an unseen skill is a validated new concept.
"""
import re


def verify_skill_quote(text: str, skill: str, quote: str, aliases=()):
    """Return offsets for a verbatim quote containing the named skill/alias."""
    if not isinstance(text, str) or not isinstance(skill, str) or not isinstance(quote, str):
        return None
    quote = quote.strip()
    if not skill.strip() or not quote or len(quote) > 500:
        return None
    start = text.find(quote)
    if start < 0:
        return None
    names = [skill.strip(), *(str(alias).strip() for alias in aliases)]
    for name in names:
        if not name:
            continue
        pattern = r'(?<![A-Za-z0-9])' + re.escape(name) + r'(?![A-Za-z0-9])'
        if re.search(pattern, quote, 0 if name.casefold() in {'go', 'r', 'c'} else re.IGNORECASE):
            return {'quote': quote, 'start': start, 'end': start + len(quote)}
    return None
