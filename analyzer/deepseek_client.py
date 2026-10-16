"""DeepSeek API 客户端 — 同步版本,适合 cron 任务。

DeepSeek 兼容 OpenAI Chat Completions 协议,但走自家 endpoint。
- 默认 base_url: https://api.deepseek.com
- 默认 model: deepseek-chat
- 价格:输入 ¥1/M tokens(cached),输出 ¥2/M tokens
"""
import json
import os
import time
from typing import Dict, Any, Optional

import requests


DEEPSEEK_API_BASE = os.environ.get("DEEPSEEK_API_BASE", "https://api.deepseek.com")
DEEPSEEK_API_KEY = os.environ.get("DEEPSEEK_API_KEY", "")
DEEPSEEK_MODEL = os.environ.get("DEEPSEEK_MODEL", "deepseek-chat")
REQUEST_TIMEOUT = int(os.environ.get("DEEPSEEK_TIMEOUT", "60"))


class DeepSeekError(Exception):
    pass


def chat_completion(
    messages,
    model: Optional[str] = None,
    temperature: float = 0.1,
    max_tokens: int = 1024,
    response_format: Optional[Dict] = None,
) -> Dict[str, Any]:
    """调 DeepSeek chat completion。

    messages: [{"role": "system|user|assistant", "content": "..."}]
    返回: dict with keys: content, usage, model
    """
    if not DEEPSEEK_API_KEY:
        raise DeepSeekError("DEEPSEEK_API_KEY not set")

    url = f"{DEEPSEEK_API_BASE}/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model or DEEPSEEK_MODEL,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "stream": False,
    }
    if response_format:
        payload["response_format"] = response_format

    last_err = None
    for attempt in range(3):
        try:
            r = requests.post(url, headers=headers, json=payload, timeout=REQUEST_TIMEOUT)
            if r.status_code == 429:
                # 限流,退避
                wait = 2 ** attempt * 5
                last_err = f"429 rate limit"
                time.sleep(wait)
                continue
            r.raise_for_status()
            data = r.json()
            choice = data["choices"][0]
            return {
                "content": choice["message"]["content"],
                "usage": data.get("usage", {}),
                "model": data.get("model"),
            }
        except requests.RequestException as e:
            last_err = str(e)
            time.sleep(2 ** attempt)
    raise DeepSeekError(f"DeepSeek API 调用失败(3 次重试): {last_err}")


def extract_json(content: str) -> Any:
    """从模型输出中提取 JSON。容忍 markdown ```json ``` 包裹。"""
    content = content.strip()
    # 去掉可能的 markdown 代码块
    if content.startswith("```"):
        # 去掉首行 ```json
        lines = content.split("\n")
        lines = [l for l in lines if not l.strip().startswith("```")]
        content = "\n".join(lines).strip()
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        # 尝试从大块文本里找 [ ... ]
        start = content.find("[")
        end = content.rfind("]")
        if start != -1 and end != -1:
            try:
                return json.loads(content[start : end + 1])
            except json.JSONDecodeError:
                pass
        raise DeepSeekError(f"无法解析 JSON: {content[:200]}")