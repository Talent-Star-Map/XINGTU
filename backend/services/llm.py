"""
统一 LLM 路由层 — 模型无关的「大模型 + 小模型」协同调度

设计原则:
    1. 模型无关: 业务代码只声明「任务档次」(STRONG/FAST/VISION)，不指定具体模型
    2. 配置存库: 管理员端「模型配置」页维护 llm_configs 表，读取优先级 表 > .env > 默认值
    3. 只返回真实模型结果；未启用或配置缺失时明确报错
    4. 大模型+小模型协同: STRONG→大模型(复杂生成/推理), FAST→小模型(简单提取/分类), VISION→多模态(预留)

用法:
    from services.llm import complete, LLMTier
    result = complete(LLMTier.STRONG, system, [{'role':'user','content':'...'}], json_mode=True)
    # result = {text, raw, usage, provider, mock}

配置读取优先级:
    llm_configs 表 (管理员配置) → .env (兼容 DEEPSEEK_API_KEY 等旧配置) → 代码默认值

@owner: XINGTU 团队（LLM 路由层）
"""

import os
import json
import time
import httpx
from typing import Optional
from enum import Enum

from database import get_session, LlmConfig

# ─── 任务档次 ────────────────────────────────────────────────────────────────
class LLMTier(str, Enum):
    STRONG = 'strong'    # 大模型：复杂生成/推理/长文本
    FAST   = 'fast'      # 小模型：简单提取/分类/判断
    VISION = 'vision'    # 多模态：图片理解（预留）


# ─── 配置常量 ────────────────────────────────────────────────────────────────
# llm_configs 表 config_key 白名单（管理员可配置项）
CONFIG_KEYS = [
    'global_enabled', 'mock_mode', 'provider',
    'strong_provider', 'strong_model', 'strong_base_url', 'strong_api_key',
    'fast_provider', 'fast_model', 'fast_base_url', 'fast_api_key',
    'vision_provider', 'vision_model', 'vision_base_url', 'vision_api_key',
]

# 各 tier 默认模型（.env 无配置时的兜底）
_DEFAULT_MODELS = {
    LLMTier.STRONG: 'deepseek-chat',
    LLMTier.FAST:   'deepseek-chat',
    LLMTier.VISION: '',
}
_DEFAULT_BASE_URL = 'https://api.deepseek.com/v1'

# 配置缓存（TTL 30s，管理员改配置后最多 30s 生效）
_CACHE: dict = {'data': None, 'ts': 0.0}
_CACHE_TTL = 30


# ════════════════════════════════════════════════════════════════════════════
# 配置读取
# ════════════════════════════════════════════════════════════════════════════

def _load_config() -> dict:
    """读取 llm_configs 表全量配置（带缓存 TTL），返回 {config_key: config_value}"""
    # Local deployments may pin their provider without changing shared DB config.
    if os.getenv('LLM_CONFIG_SOURCE', '').lower() == 'env':
        return {}
    now = time.time()
    if _CACHE['data'] is not None and now - _CACHE['ts'] < _CACHE_TTL:
        return _CACHE['data']
    cfg: dict = {}
    try:
        session = get_session()
        try:
            rows = session.query(LlmConfig).all()
            for r in rows:
                cfg[r.config_key] = r.config_value
        finally:
            session.close()
    except Exception:
        # 表不存在或连不上库时降级为空配置（走 .env / 默认）
        cfg = {}
    _CACHE['data'] = cfg
    _CACHE['ts'] = now
    return cfg


def invalidate_config_cache():
    """管理员保存配置后调用，立即刷新缓存"""
    _CACHE['data'] = None
    _CACHE['ts'] = 0.0


def get_config(config_key: str, default: str = '') -> str:
    """读取单项配置：llm_configs 表 → .env → default"""
    cfg = _load_config()
    if config_key in cfg and cfg[config_key] != '':
        return cfg[config_key]
    return os.getenv(config_key, default)


def is_mock_mode() -> bool:
    """兼容检测旧配置；模拟输出已移除，旧开关启用时只允许明确报错。"""
    return get_config('mock_mode', '0') == '1'


def is_global_enabled() -> bool:
    """全局 AI 总开关"""
    return get_config('global_enabled', '1') == '1'


def _tier_keys(tier: LLMTier) -> tuple[str, str, str]:
    """返回 (provider_key, model_key, base_url_key)"""
    p = tier.value
    return f'{p}_provider', f'{p}_model', f'{p}_base_url'


def _get_api_key(tier: LLMTier) -> str:
    """获取 tier 的 API Key：表 → .env → ''"""
    key = get_config(f'{tier.value}_api_key', '')
    if key:
        return key
    # 兼容旧配置：DEEPSEEK_API_KEY / LONGCAT_API_KEY
    legacy = {
        LLMTier.STRONG: 'DEEPSEEK_API_KEY',
        LLMTier.FAST: 'DEEPSEEK_API_KEY',
        LLMTier.VISION: '',
    }.get(tier, '')
    return os.getenv(legacy, '') if legacy else ''


def _get_model(tier: LLMTier) -> str:
    """获取 tier 的模型名：表 → env → 默认"""
    return get_config(f'{tier.value}_model', os.getenv('DEEPSEEK_MODEL', _DEFAULT_MODELS[tier]))


def _get_base_url(tier: LLMTier) -> str:
    """获取 tier 的 API 地址：表 → env → 默认"""
    return get_config(f'{tier.value}_base_url', os.getenv('DEEPSEEK_BASE_URL', _DEFAULT_BASE_URL))


def get_provider_name(tier: LLMTier) -> str:
    """当前 tier 的真实模型 Provider 名。"""
    return get_config(f'{tier.value}_provider', 'openai-compatible')


# ════════════════════════════════════════════════════════════════════════════
# OpenAI 兼容 Provider — DeepSeek / 通义千问 / Kimi / Qwen 等
# ════════════════════════════════════════════════════════════════════════════
class OpenAICompatibleProvider:
    """OpenAI 兼容格式 Provider（/v1/chat/completions）"""
    name = 'openai-compatible'

    def __init__(self, api_key: str, base_url: str, model: str):
        self.api_key = api_key
        self.base_url = base_url.rstrip('/')
        self.model = model

    def complete(self, system: str, messages: list[dict], json_mode: bool = False,
                 max_tokens: int = 2048, **kwargs) -> dict:
        if not self.api_key:
            raise LLMConfigError('未配置 API Key，请在管理员端「模型配置」中填写')
        if not self.model:
            raise LLMConfigError('未配置模型名，请在管理员端「模型配置」中填写')

        full_messages = [{'role': 'system', 'content': system}] + list(messages)
        payload = {
            'model': self.model,
            'messages': full_messages,
            'max_tokens': max_tokens,
        }
        if json_mode:
            payload['response_format'] = {'type': 'json_object'}

        with httpx.Client(timeout=60) as client:
            r = client.post(
                f'{self.base_url}/chat/completions',
                headers={'Content-Type': 'application/json',
                         'Authorization': f'Bearer {self.api_key}'},
                json=payload,
            )
            if r.status_code != 200:
                raise LLMAPIError(f'模型 API 返回 {r.status_code}: {r.text[:200]}')
            data = r.json()
            content = data.get('choices', [{}])[0].get('message', {}).get('content', '') or ''
            usage = data.get('usage') or {}

        raw = None
        if json_mode:
            raw = _try_parse_json(content)
        return {'text': content, 'raw': raw, 'usage': usage,
                'provider': self.name, 'mock': False, 'model': self.model}


# ════════════════════════════════════════════════════════════════════════════
# 异常与工具
# ════════════════════════════════════════════════════════════════════════════
class LLMConfigError(Exception):
    """配置错误：缺 key / 缺模型名等"""
    pass


class LLMAPIError(Exception):
    """上游 API 调用失败"""
    pass


def _try_parse_json(text: str) -> Optional[dict]:
    """容错解析 JSON：直接解析 → 去代码块 → 取第一个 {..}"""
    if not text:
        return None
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    import re
    m = re.search(r'```(?:json)?\s*([\s\S]*?)```', text)
    if m:
        try:
            return json.loads(m.group(1))
        except json.JSONDecodeError:
            pass
    m = re.search(r'\{[\s\S]*\}', text)
    if m:
        try:
            return json.loads(m.group(0))
        except json.JSONDecodeError:
            pass
    return None


# ════════════════════════════════════════════════════════════════════════════
# 路由入口
# ════════════════════════════════════════════════════════════════════════════
def complete(tier: LLMTier, system: str, messages: list[dict],
             json_mode: bool = False, max_tokens: int = 2048, **kwargs) -> dict:
    """业务层唯一入口：按任务档次路由到对应 Provider

    参数:
        tier:       任务档次（STRONG=大模型 / FAST=小模型 / VISION=多模态）
        system:     系统提示词
        messages:   对话消息列表，如 [{'role':'user','content':'...'}]
        json_mode:  是否要求 JSON 输出（返回 raw=解析后的 dict）
        max_tokens: 最大输出 token 数
    返回:
        {text, raw, usage, provider, mock[, model]}
    抛错:
        LLMConfigError — 配置缺失；LLMAPIError — 上游调用失败
    """
    if not is_global_enabled():
        raise LLMConfigError('AI 功能已由管理员关闭，请在管理员端「模型配置」中开启')

    if is_mock_mode():
        raise LLMConfigError('模拟输出已停用，请使用真实模型配置')

    provider = OpenAICompatibleProvider(
        api_key=_get_api_key(tier),
        base_url=_get_base_url(tier),
        model=_get_model(tier),
    )
    return provider.complete(system, messages, json_mode, max_tokens, **kwargs)


def test_connection(tier: LLMTier) -> dict:
    """测试指定档次的模型连通性（管理员配置页用）

    返回: {success, provider, model, mock, message, latency_ms, usage}
    """
    if not is_global_enabled():
        return {'success': False, 'message': '全局 AI 总开关已关闭，请先开启'}
    if is_mock_mode():
        return {'success': False, 'message': '模拟输出已停用，请使用真实模型配置'}
    start = time.time()
    provider = OpenAICompatibleProvider(
        api_key=_get_api_key(tier),
        base_url=_get_base_url(tier),
        model=_get_model(tier),
    )
    try:
        result = provider.complete(
            '你是连通性测试助手。', [{'role': 'user', 'content': '请只回复"连接成功"四个字。'}],
            json_mode=False, max_tokens=16,
        )
        latency = int((time.time() - start) * 1000)
        return {'success': True, 'provider': provider.name, 'model': provider.model,
                'mock': False, 'message': f'连接成功，响应: {result["text"][:50]}',
                'latency_ms': latency, 'usage': result.get('usage')}
    except (LLMConfigError, LLMAPIError) as e:
        latency = int((time.time() - start) * 1000)
        return {'success': False, 'provider': provider.name, 'model': provider.model,
                'mock': False, 'message': str(e), 'latency_ms': latency}
