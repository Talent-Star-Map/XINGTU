"""统一身份与角色校验（FastAPI 依赖）

背景：企业端 / 求职端接口此前各自处理登录，部分接口直接把前端传来的
`jobseeker_id` / `enterprise_id` 当身份用，任何人改个数字就能读写别人的数据。
这里提供一组依赖，把「身份」唯一来源收敛到 token：

    from auth_guard import require_jobseeker, require_enterprise
    def my_api(me: dict = Depends(require_jobseeker)):
        uid = me['user_id']      # 永远来自 token，绝不用 query/body 里的 id

约定：
- 缺少 token → 401；token 无效/过期 → 401；角色不符 → 403
- 不在这里返回 {"success": false}，用 HTTP 状态码表达鉴权失败，
  业务成功响应结构不受影响
"""

import math
import re
from fastapi import Depends, HTTPException, Request
from fastapi.responses import JSONResponse

from database import verify_token

ROLE_TEXT = {'jobseeker': '求职者', 'enterprise': '企业', 'admin': '管理员'}


def _decode(token: str | None) -> dict:
    if not token or not token.strip():
        raise HTTPException(401, '未登录或缺少 token')
    try:
        payload = verify_token(token)
    except Exception:
        raise HTTPException(401, '登录凭证无效或已过期') from None
    try:
        uid = payload['user_id']
        expiry = payload['exp']
        if (isinstance(uid, bool) or int(uid) <= 0 or str(int(uid)) != str(uid)
                or payload.get('role') not in ROLE_TEXT or isinstance(expiry, bool)
                or not math.isfinite(float(expiry))):
            raise ValueError()
    except (KeyError, ValueError, TypeError, OverflowError):
        raise HTTPException(401, '登录凭证无效') from None
    return {**payload, 'user_id': int(uid)}


def request_token(request: Request) -> str:
    """Accept query tokens and Bearer headers without ambiguous identity."""
    values = request.query_params.getlist('token')
    if len(values) > 1:
        raise HTTPException(401, '登录凭证重复')
    query = values[0] if values else ''
    authorization = request.headers.get('authorization', '')
    header = ''
    if authorization:
        scheme, _, header = authorization.partition(' ')
        if scheme.lower() != 'bearer' or not header.strip():
            raise HTTPException(401, '登录凭证格式错误')
        header = header.strip()
    if query and header and query != header:
        raise HTTPException(401, '登录凭证不一致')
    token = query or header
    if not token:
        raise HTTPException(401, '未登录或缺少 token')
    return token


def require_user(request: Request) -> dict:
    """任意已登录用户"""
    cached = getattr(request.state, 'identity', None)
    return cached if cached is not None else _decode(request_token(request))


def require_role(role: str):
    """生成一个「必须是指定角色」的依赖"""

    def _dep(payload: dict = Depends(require_user)) -> dict:
        if payload.get('role') != role:
            need = ROLE_TEXT.get(role, role)
            got = ROLE_TEXT.get(payload.get('role'), payload.get('role'))
            raise HTTPException(403, f'需要{need}身份，当前为{got}身份')
        return payload

    _dep.__name__ = f'require_{role}'
    return _dep


require_jobseeker = require_role('jobseeker')
require_enterprise = require_role('enterprise')
require_admin = require_role('admin')


PUBLIC_ENDPOINTS = {
    ('POST', '/api/auth/login'), ('POST', '/api/auth/admin/login'),
    ('POST', '/api/auth/register'), ('POST', '/api/auth/send-code'),
    ('GET', '/api/health'),
}


def access_policy(method: str, path: str) -> str:
    """Closed by default: new business endpoints automatically require login."""
    path = path.rstrip('/') or '/'
    if (method, path) in PUBLIC_ENDPOINTS:
        return 'public'
    if method == 'GET' and (re.fullmatch(r'/api/resume-center/share/[a-f0-9]{16}', path)
                            or re.fullmatch(r'/api/resume-center/print/[A-Za-z0-9_-]{32,128}', path)):
        return 'capability'
    if method == 'POST' and path == '/api/collector/observations':
        return 'collector'
    if (path in ('/docs', '/redoc', '/openapi.json') or path.startswith('/docs/')
            or path.startswith(('/api/admin', '/api/quality', '/api/kg/admin'))
            or path == '/api/enterprise/calibrate'):
        return 'admin'
    if path.startswith('/api/enterprise'):
        return 'enterprise'
    if (path.startswith(('/api/jobseeker', '/api/apply', '/api/learning', '/api/match', '/api/resume-center', '/api/kg/personal'))
            or path.startswith('/api/auth/resume-')):
        return 'jobseeker'
    return 'user'


class APIAuthorizationMiddleware:
    """Enforce identity before body parsing or endpoint side effects."""
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        path = scope.get('path', '')
        if (scope['type'] != 'http' or scope.get('method') == 'OPTIONS'
                or not (path == '/api' or path.startswith('/api/')
                        or path in ('/docs', '/redoc', '/openapi.json') or path.startswith('/docs/'))):
            return await self.app(scope, receive, send)
        policy = access_policy(scope['method'], path)
        if policy not in ('public', 'capability', 'collector'):
            try:
                request = Request(scope)
                payload = require_user(request)
                if policy != 'user' and payload['role'] != policy:
                    raise HTTPException(403, f'需要{ROLE_TEXT[policy]}身份')
                request.state.identity = payload
            except HTTPException as exc:
                return await JSONResponse({'detail': exc.detail}, status_code=exc.status_code)(scope, receive, send)
        return await self.app(scope, receive, send)


def assert_owner(owner_id, current_id, message: str = '无权访问该数据'):
    """数据归属校验：不匹配直接 403。用于消息、投递、简历等私有数据。"""
    if owner_id != current_id:
        raise HTTPException(403, message)
