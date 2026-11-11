"""Online speech synthesis using Edge TTS; no local model or GPU required."""
import asyncio
import importlib.util
from fastapi import HTTPException

VOICE = "zh-CN-XiaoxiaoNeural"


def voice_available():
    return importlib.util.find_spec("edge_tts") is not None


async def _synthesize(text: str) -> bytes:
    import edge_tts
    audio = bytearray()
    communicate = edge_tts.Communicate(text=text, voice=VOICE, rate="+0%", pitch="+0Hz", volume="+0%")
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            audio.extend(chunk["data"])
            if len(audio) > 8 * 1024 * 1024:
                raise ValueError("audio too large")
    if not audio:
        raise ValueError("empty audio")
    return bytes(audio)


def synthesize(text: str) -> bytes:
    if not voice_available():
        raise HTTPException(503, "尚未安装 edge-tts，请在后端 Python 环境安装后重试。")
    try:
        return asyncio.run(asyncio.wait_for(_synthesize(text), timeout=45))
    except Exception:
        raise HTTPException(502, "在线语音合成失败，请检查网络后重试，或使用系统语音。") from None
