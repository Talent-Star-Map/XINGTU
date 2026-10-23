"""Server-configured GPT-SoVITS adapter. Never accepts user-supplied URLs/paths."""
import os
import httpx
from fastapi import HTTPException


def voice_config():
    base = os.getenv('INTERVIEW_TTS_URL', '').rstrip('/')
    reference = os.getenv('INTERVIEW_TTS_REF_AUDIO', '')
    return base, reference


def synthesize(text: str) -> bytes:
    base, reference = voice_config()
    if not base or not reference:
        raise HTTPException(503, 'GPT-SoVITS 尚未配置，请配置语音服务地址和参考音频路径。')
    payload = {'text': text, 'text_lang': 'zh', 'ref_audio_path': reference,
               'prompt_text': os.getenv('INTERVIEW_TTS_PROMPT_TEXT', ''),
               'prompt_lang': os.getenv('INTERVIEW_TTS_PROMPT_LANG', 'zh'),
               'media_type': 'wav', 'streaming_mode': False,
               'text_split_method': 'cut5', 'batch_size': 1, 'parallel_infer': True,
               'speed_factor': 1.0}
    headers = {}
    token = os.getenv('INTERVIEW_TTS_TOKEN', '')
    if token:
        headers['Authorization'] = f'Bearer {token}'
    try:
        # Complete short-sentence WAVs are independently playable across browsers.
        with httpx.Client(timeout=httpx.Timeout(45, connect=5), follow_redirects=False) as client:
            with client.stream('POST', base + '/tts', json=payload, headers=headers) as response:
                response.raise_for_status()
                audio = bytearray()
                for chunk in response.iter_bytes():
                    audio.extend(chunk)
                    if len(audio) > 8 * 1024 * 1024:
                        raise ValueError('audio too large')
                if len(audio) < 44 or audio[:4] != b'RIFF' or audio[8:12] != b'WAVE':
                    raise ValueError('invalid WAV response')
                return bytes(audio)
    except Exception:
        raise HTTPException(502, '语音合成失败，请检查 GPT-SoVITS 服务；可重播或使用系统语音。') from None
