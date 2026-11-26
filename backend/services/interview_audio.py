"""CPU-only ASR and ephemeral, user-scoped speaker checks for practice interviews.

Speaker similarity is NOT synthetic-voice detection. Never expose it as a fraud score.
Raw recordings are decoded in memory and discarded; session embeddings expire.
"""
import io
import math
import os
import re
import secrets
import time
import wave
from functools import lru_cache
from pathlib import Path
from threading import BoundedSemaphore, Lock
from urllib.parse import urlparse

from fastapi import HTTPException

ROOT = Path(__file__).resolve().parents[1] / 'resources' / 'interview-models'
SESSIONS = {}
LOCK = Lock()
INFERENCE = BoundedSemaphore(1)
TTL = 7200
MAX_BYTES = 1_000_000
WORDS = ('蓝天', '苹果', '森林', '白云', '星光', '海洋', '阳光', '书本', '春天', '河流', '花园', '明天')


def paths():
    root = Path(os.getenv('INTERVIEW_AUDIO_MODEL_DIR', str(ROOT)))
    return root / 'sensevoice' / 'model.int8.onnx', root / 'sensevoice' / 'tokens.txt', root / 'speaker.onnx'


def status():
    import importlib.util
    asr, tokens, speaker = paths()
    mode = os.getenv('INTERVIEW_ASR_MODE', 'browser')
    api_mode = mode == 'api'
    speaker_ready = speaker.is_file() and importlib.util.find_spec('sherpa_onnx') is not None
    asr_ready = (mode == 'browser' or
                 (bool(os.getenv('INTERVIEW_ASR_URL') and os.getenv('INTERVIEW_ASR_API_KEY') and os.getenv('INTERVIEW_ASR_MODEL'))
                  if api_mode else asr.is_file() and tokens.is_file()))
    ready = speaker_ready and asr_ready
    return {'configured': ready, 'speaker_configured': speaker_ready, 'provider': 'cpu', 'denoiser': 'RNNoise (browser WASM)',
            'asr': 'browser' if mode == 'browser' else 'configured API' if api_mode else 'SenseVoice int8', 'speaker': 'CAM++',
            'notice': '声纹相似度与随机口令仅辅助核验，不能保证识别克隆声音。录音不落盘，声纹仅用于本次练习。'}


@lru_cache(maxsize=2)
def models(speaker_only=False):
    if not (status()['speaker_configured'] if speaker_only else status()['configured']):
        raise HTTPException(503, '面试语音模型未安装，请管理员运行面试模型安装脚本。')
    import sherpa_onnx
    asr, tokens, speaker = paths()
    threads = max(1, min(2, int(os.getenv('INTERVIEW_AUDIO_THREADS', '1'))))
    recognizer = None
    if not speaker_only and os.getenv('INTERVIEW_ASR_MODE', 'browser') == 'cpu':
        recognizer = sherpa_onnx.OfflineRecognizer.from_sense_voice(
            model=str(asr), tokens=str(tokens), num_threads=threads, provider='cpu', language='zh', use_itn=True)
    config = sherpa_onnx.SpeakerEmbeddingExtractorConfig(model=str(speaker), num_threads=threads, provider='cpu')
    if not config.validate():
        raise HTTPException(503, '声纹模型配置不正确。')
    return recognizer, sherpa_onnx.SpeakerEmbeddingExtractor(config)


def transcribe(data, samples, recognizer):
    if os.getenv('INTERVIEW_ASR_MODE', 'cpu') != 'api':
        stream = recognizer.create_stream()
        stream.accept_waveform(16000, samples)
        recognizer.decode_stream(stream)
        return stream.result.text
    # Explicitly configured OpenAI-compatible transcription API, not the chat API.
    # No silent fallback: the user must know which service receives recordings.
    import requests
    url = os.getenv('INTERVIEW_ASR_URL', '')
    if urlparse(url).scheme != 'https':
        raise HTTPException(503, '语音 API 必须配置为 HTTPS 地址。')
    try:
        response = requests.post(url, headers={'Authorization': 'Bearer '+os.getenv('INTERVIEW_ASR_API_KEY', '')},
            files={'file': ('answer.wav', data, 'audio/wav')},
            data={'model': os.getenv('INTERVIEW_ASR_MODEL', ''), 'language': 'zh', 'response_format': 'json'}, timeout=(5, 25))
        response.raise_for_status()
        text = response.json().get('text')
        if not isinstance(text, str) or len(text) > 6000:
            raise ValueError('invalid transcription')
        return text
    except Exception:
        raise HTTPException(503, '语音识别 API 暂不可用，请稍后重试。') from None


def _challenge(room):
    room['challenge_id'] = secrets.token_urlsafe(18)
    room['words'] = secrets.SystemRandom().sample(WORDS, 5)
    room['challenge_until'] = time.monotonic() + 90
    return {'session_id': room['id'], 'challenge_id': room['challenge_id'],
            'phrase': '我正在参加星图面试。' + '，'.join(room['words']) + '。', 'expires_in': 90,
            'enrolled': room['embedding'] is not None}


def create_session(user_id):
    if not status()['configured']:
        raise HTTPException(503, '面试语音模型未安装，请管理员运行面试模型安装脚本。')
    now = time.monotonic()
    with LOCK:
        for key in list(SESSIONS):
            if now - SESSIONS[key]['created'] > TTL:
                del SESSIONS[key]
        if len(SESSIONS) >= 256:
            raise HTTPException(503, '面试会话已满，请稍后再试。')
        # At most two rooms per account, including reloads.
        mine = sorted((r for r in SESSIONS.values() if r['user_id'] == user_id), key=lambda r: r['created'])
        for old in mine[:-1]:
            SESSIONS.pop(old['id'], None)
        room = {'id': secrets.token_urlsafe(24), 'user_id': user_id, 'created': now,
                'embedding': None, 'verified': 0, 'checkpoint': now, 'last_audio': 0}
        SESSIONS[room['id']] = room
        return _challenge(room)


def get_room(session_id, user_id):
    room = SESSIONS.get(session_id)
    if room and time.monotonic() - room['created'] > TTL:
        SESSIONS.pop(session_id, None)
        room = None
    if not room or room['user_id'] != user_id:
        raise HTTPException(404, '声音核验会话已失效，请重新开始练习。')
    return room


def challenge(session_id, user_id):
    with LOCK:
        return _challenge(get_room(session_id, user_id))


def close_session(session_id, user_id):
    with LOCK:
        room = get_room(session_id, user_id)
        SESSIONS.pop(room['id'], None)
    return {'closed': True}


def decode_wav(data):
    import numpy as np
    if len(data) > MAX_BYTES:
        raise HTTPException(413, '录音过长，请分段回答。')
    try:
        with wave.open(io.BytesIO(data), 'rb') as wav:
            if wav.getnchannels() != 1 or wav.getsampwidth() != 2 or wav.getframerate() != 16000 or wav.getcomptype() != 'NONE':
                raise ValueError()
            frames = wav.getnframes()
            if not 16000 <= frames <= 16000 * 28:
                raise ValueError()
            raw = wav.readframes(frames)
            if len(raw) != frames * 2:
                raise ValueError()
        audio = np.frombuffer(raw, dtype='<i2').astype('float32') / 32768
    except (ValueError, wave.Error, EOFError):
        raise HTTPException(422, '需要 1–28 秒、16kHz 单声道 PCM16 WAV 录音。') from None
    # Reject silence before ASR (models can hallucinate words on silence).
    frames = audio[:len(audio)//320*320].reshape(-1, 320)
    rms = np.sqrt(np.mean(frames * frames, axis=1))
    if int(np.sum(rms > 0.008)) < 25:
        raise HTTPException(422, '有效声音太短或太轻，请靠近麦克风重试。')
    return audio


def normalize(text):
    return re.sub(r'[^\u4e00-\u9fff0-9a-z]', '', text.lower())


def phrase_matches(text, words):
    text = normalize(text)
    start = 0
    for word in words:
        found = text.find(word, start)
        if found < 0:
            return False
        start = found + len(word)
    return True


def analyze(data, session_id, user_id, challenge_id='', browser_text=None):
    import numpy as np
    if not INFERENCE.acquire(blocking=False):
        raise HTTPException(429, '语音服务正在处理其他录音，请稍后重试。')
    try:
        with LOCK:
            room = get_room(session_id, user_id)
            now = time.monotonic()
            if now - room['last_audio'] < 0.8:
                raise HTTPException(429, '提交过于频繁，请稍后重试。')
            room['last_audio'] = now
            baseline = room['embedding']
            if challenge_id:
                if challenge_id != room.get('challenge_id') or now > room['challenge_until']:
                    raise HTTPException(409, '口令已过期或已使用，请更换口令。')
                words = list(room['words'])
                room['challenge_id'] = ''  # one attempt, including failed recognition
            elif baseline is None:
                raise HTTPException(409, '请先完成本人声音录入。')
            elif now - room['checkpoint'] > 180:
                return {'accepted': False, 'checkpoint_required': True, 'text': '', 'reason': '请朗读新口令后继续。'}
        audio = decode_wav(data)
        recognizer, extractor = models(speaker_only=True) if browser_text is not None else models()
        if browser_text is None and os.getenv('INTERVIEW_ASR_MODE', 'browser') == 'browser':
            raise HTTPException(409, '当前使用浏览器语音识别，请通过声音比对接口提交。')
        text = browser_text.strip() if browser_text is not None else re.sub(r'<\|.*?\|>', '', transcribe(data, audio, recognizer)).strip()
        if not text or (challenge_id and not phrase_matches(text, words)):
            return {'accepted': False, 'text': '', 'reason': '未听清完整口令，请更换口令后重新朗读。' if challenge_id else '没有识别到清晰回答，请重试。'}
        speaker_stream = extractor.create_stream()
        speaker_stream.accept_waveform(sample_rate=16000, waveform=audio)
        speaker_stream.input_finished()
        if not extractor.is_ready(speaker_stream):
            return {'accepted': False, 'text': '', 'reason': '声音样本太短，请完整朗读或继续回答。'}
        embedding = np.array(extractor.compute(speaker_stream), dtype='float32')
        norm = float(np.linalg.norm(embedding))
        if not math.isfinite(norm) or norm <= 0:
            raise HTTPException(422, '声音样本无效，请重试。')
        embedding /= norm
        score = float(np.dot(baseline, embedding)) if baseline is not None else None
        threshold = float(os.getenv('INTERVIEW_SPEAKER_THRESHOLD', '0.55'))
        accepted = score is None or score >= threshold
        with LOCK:
            # A deleted/expired session must not be resurrected by a late inference.
            current = get_room(session_id, user_id)
            if accepted:
                if baseline is None:
                    if len(audio) < 16000 * 4:
                        return {'accepted': False, 'text': '', 'reason': '录入声音请至少持续 4 秒，完整朗读屏幕口令。'}
                    current['embedding'] = embedding
                current['verified'] = time.monotonic()
                if challenge_id:
                    current['checkpoint'] = time.monotonic()
        return {'accepted': accepted, 'text': text if accepted and not challenge_id else '',
                'speaker_similarity': round(score, 3) if score is not None else None,
                'reason': '' if accepted else '本次声音与录入样本差异较大，请本人重新朗读口令核验。',
                'checkpoint_required': not accepted,
                'transcription_source': 'browser_unverified' if browser_text is not None else 'server',
                'notice': '声音相似度不是身份真实性或合成语音检测结论。'}
    finally:
        INFERENCE.release()
