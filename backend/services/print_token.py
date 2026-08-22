"""简历导出一次性 token 管理

目的:让 Playwright 在无登录态下抓取简历数据,完成 PDF/HTML 渲染后立刻销毁 token。

实现:进程内 dict + asyncio 延迟清理。简单可靠,无需引入 Redis。

生命周期:
    1. resume_center.export_resume() → create(resume_id, user_id) → token
    2. Playwright 用 token 调 GET /api/resume-center/print/{token} 拉数据
    3. 后端 consume(token) → pop + 返回数据
    4. 5 分钟 TTL,过期自动清理(防泄漏)

并发安全:Python GIL 保证 dict pop 原子性,够用。
多副本部署:当前实现只对单进程生效。多副本(负载均衡)需要换成 Redis,
但 XINGTU 默认单实例部署,先不引入额外依赖。

@owner: XINGTU 团队(AI 简历中心)
"""

import asyncio
import secrets
import time
from typing import Optional

# token → {resume_id, user_id, created_at, expires_at}
_tokens: dict[str, dict] = {}


def create(resume_id: int, user_id: int, ttl_seconds: int = 300) -> str:
    """创建一次性打印 token,默认 5 分钟过期"""
    token = secrets.token_urlsafe(32)
    _tokens[token] = {
        "resume_id": resume_id,
        "user_id": user_id,
        "created_at": time.time(),
        "expires_at": time.time() + ttl_seconds,
    }
    _schedule_cleanup(token, ttl_seconds)
    return token


def consume(token: str) -> Optional[dict]:
    """消费 token — pop 后立即不可用,过期返回 None"""
    entry = _tokens.pop(token, None)
    if not entry:
        return None
    if entry["expires_at"] < time.time():
        return None
    return entry


def _schedule_cleanup(token: str, ttl: int) -> None:
    """asyncio 延迟清理过期 token(防止 dict 无限增长)"""
    async def _cleanup():
        try:
            await asyncio.sleep(ttl + 5)
            _tokens.pop(token, None)
        except Exception:
            pass
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            loop.create_task(_cleanup())
    except RuntimeError:
        # 没有 event loop(同步上下文),放弃定时清理;下次 consume 自然过期
        pass