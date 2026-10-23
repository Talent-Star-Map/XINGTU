"""Authenticated append-only ingestion from the separate crawler service."""
import hmac
import os
from datetime import datetime

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError

from database import JobObservation, SessionLocal
from services.observation_ingest import prepare_observation

router = APIRouter(prefix='/api/collector', tags=['collector'])


class ObservationIn(BaseModel):
    source: str = Field(min_length=1, max_length=80)
    source_job_id: str = Field(min_length=1, max_length=200)
    source_url: str | None = Field(default=None, max_length=1000)
    company_name: str | None = Field(default=None, max_length=255)
    title: str | None = Field(default=None, max_length=255)
    observed_at: datetime
    raw_text: str = Field(min_length=1, max_length=100000)
    skill_tags: list[str] | None = None
    extraction: dict | None = None


@router.post('/observations')
def append_observation(payload: ObservationIn, x_collector_token: str = Header(default='')):
    expected = os.getenv('COLLECTOR_INGEST_TOKEN', '')
    if not expected:
        raise HTTPException(503, '采集接入尚未配置')
    if not hmac.compare_digest(x_collector_token, expected):
        raise HTTPException(403, '无权写入采集观测')
    try:
        data = prepare_observation(payload.model_dump())
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    with SessionLocal() as session:
        record = JobObservation(**data)
        session.add(record)
        try:
            session.commit()
            return {'success': True, 'data': {'observation_id': record.id, 'created': True}, 'message': 'ok'}
        except IntegrityError:
            session.rollback()
            existing = session.query(JobObservation.id).filter_by(
                observation_key=data['observation_key']).scalar()
            if existing is None:
                raise
            return {'success': True, 'data': {'observation_id': existing, 'created': False}, 'message': 'ok'}
