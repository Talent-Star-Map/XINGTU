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

from fastapi import Query, HTTPException

from database import verify_token

ROLE_TEXT = {'jobseeker': '求职者', 'enterprise': '企业', 'admin': '管理员'}


def _decode(token: str | None) -> dict:
    if not token or not token.strip():
        raise HTTPException(401, '未登录或缺少 token')
    try:
        payload = verify_token(token)
    except Exception as e:
        raise HTTPException(401, f'登录已失效：{e}')
    if not payload or 'user_id' not in payload:
        raise HTTPException(401, '登录凭证无效')
    return payload


def require_user(token: str | None = Query(None, description='登录 token')) -> dict:
    """任意已登录用户"""
    return _decode(token)


def require_role(role: str):
    """生成一个「必须是指定角色」的依赖"""

    def _dep(token: str | None = Query(None, description='登录 token')) -> dict:
        payload = _decode(token)
        if payload.get('role') != role:
            need = ROLE_TEXT.get(role, role)
            got = ROLE_TEXT.get(payload.get('role'), payload.get('role'))
            raise HTTPException(403, f'需要{need}身份，当前为{got}身份')
        return payload

    _dep.__name__ = f'require_{role}'
    return _dep


require_jobseeker = require_role('jobseeker')
require_enterprise = require_role('enterprise')


def assert_owner(owner_id, current_id, message: str = '无权访问该数据'):
    """数据归属校验：不匹配直接 403。用于消息、投递、简历等私有数据。"""
    if owner_id != current_id:
        raise HTTPException(403, message)
