"""Validate and fingerprint one collector observation before append-only storage."""
from datetime import datetime, timezone
from hashlib import sha256
import json


def prepare_observation(payload: dict) -> dict:
    source = str(payload.get('source') or '').strip().casefold()
    source_job_id = str(payload.get('source_job_id') or '').strip()
    raw_text = payload.get('raw_text')
    raw_time = payload.get('observed_at')
    if not source or not source_job_id or not isinstance(raw_text, str) or not raw_text.strip() or not raw_time:
        raise ValueError('source, source_job_id, raw_text, observed_at are required')
    try:
        observed = raw_time if isinstance(raw_time, datetime) else datetime.fromisoformat(str(raw_time).replace('Z', '+00:00'))
    except ValueError as exc:
        raise ValueError('observed_at must be ISO 8601') from exc
    if observed.tzinfo is None:
        raise ValueError('observed_at requires an explicit UTC offset')
    observed = observed.astimezone(timezone.utc)
    if observed > datetime.now(timezone.utc):
        raise ValueError('future observations are not accepted')
    skills = payload.get('skill_tags')
    if skills is not None and (not isinstance(skills, list) or any(not isinstance(item, str) for item in skills)):
        raise ValueError('skill_tags must be an array of strings or null')
    extraction = payload.get('extraction')
    if extraction is not None and not isinstance(extraction, dict):
        raise ValueError('extraction must be an object or null')
    content_hash = sha256(raw_text.encode('utf-8')).hexdigest()
    key_material = json.dumps([source, source_job_id, observed.isoformat(), content_hash],
                              ensure_ascii=False, separators=(',', ':'))
    return {
        'observation_key': sha256(key_material.encode('utf-8')).hexdigest(),
        'source': source, 'source_job_id': source_job_id,
        'source_url': str(payload.get('source_url') or '').strip() or None,
        'company_name': str(payload.get('company_name') or '').strip() or None,
        'title': str(payload.get('title') or '').strip() or None,
        'observed_at': observed.replace(tzinfo=None),
        'content_hash': content_hash, 'raw_text': raw_text,
        'skill_tags': skills, 'extraction': extraction,
    }
