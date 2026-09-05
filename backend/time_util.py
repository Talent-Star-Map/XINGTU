"""时间展示统一转北京时间

MySQL 服务器时区是 UTC（实测：SELECT NOW() 比北京时间晚 8 小时），
created_at 等字段由 func.now() 写入的是 UTC 时间。
直接 strftime 给前端会让消息时间比实际晚 8 小时（上午发的消息显示成凌晨）。
所有对外返回的时间字符串统一走这里的 fmt()。
"""

from datetime import datetime, timedelta, timezone

CST = timezone(timedelta(hours=8))


def to_local(dt: datetime):
    """把数据库时间（naive，实为 UTC）转成北京时间 aware datetime"""
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(CST)


def fmt(dt: datetime, pattern: str = '%Y-%m-%d %H:%M') -> str:
    """数据库时间 → 北京时间字符串；空值返回空串（前端按「无」处理）"""
    d = to_local(dt)
    return d.strftime(pattern) if d else ''
