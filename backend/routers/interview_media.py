"""Bounded, authenticated raw-audio endpoints. No recordings are persisted."""
from fastapi import APIRouter, Depends, HTTPException, Request, Query
from starlette.concurrency import run_in_threadpool
from auth_guard import require_jobseeker
from services import interview_audio as audio
from urllib.parse import unquote

router = APIRouter(prefix='/audio')


@router.get('/status')
def status(me: dict = Depends(require_jobseeker)):
    return audio.status()


@router.post('/session')
def create(me: dict = Depends(require_jobseeker)):
    return audio.create_session(me['user_id'])


@router.post('/challenge')
def challenge(session_id: str = Query(min_length=1, max_length=80), me: dict = Depends(require_jobseeker)):
    return audio.challenge(session_id, me['user_id'])


@router.delete('/session')
def close(session_id: str = Query(min_length=1, max_length=80), me: dict = Depends(require_jobseeker)):
    return audio.close_session(session_id, me['user_id'])


@router.post('/recognize')
async def recognize(request: Request, session_id: str = Query(min_length=1, max_length=80),
                    challenge_id: str = Query(default='', max_length=80), me: dict = Depends(require_jobseeker)):
    audio.get_room(session_id, me['user_id'])
    data = bytearray()
    async for chunk in request.stream():
        data.extend(chunk)
        if len(data) > audio.MAX_BYTES:
            raise HTTPException(413, '录音过长，请分段回答。')
    return await run_in_threadpool(audio.analyze, bytes(data), session_id, me['user_id'], challenge_id)


@router.post('/verify')
async def verify(request: Request, session_id: str = Query(min_length=1, max_length=80),
                 challenge_id: str = Query(default='', max_length=80), me: dict = Depends(require_jobseeker)):
    """Browser transcript is untrusted client data, not server-verified ASR evidence."""
    audio.get_room(session_id, me['user_id'])
    encoded = request.headers.get('x-interview-transcript', '')
    if len(encoded) > 4608:
        raise HTTPException(413, '识别文字过长，请分段回答。')
    transcript = unquote(encoded).strip()
    if not transcript or len(transcript) > 512:
        raise HTTPException(422, '请先完成浏览器语音识别。')
    data = bytearray()
    async for chunk in request.stream():
        data.extend(chunk)
        if len(data) > audio.MAX_BYTES:
            raise HTTPException(413, '录音过长，请分段回答。')
    return await run_in_threadpool(audio.analyze, bytes(data), session_id, me['user_id'], challenge_id, transcript)
