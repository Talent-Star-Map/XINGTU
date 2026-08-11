"""
学习资源服务：从数据库读取技能学习资源，未知技能返回通用搜索链接

@owner: 佳豪（求职端"我的"）
"""

from database import get_session, SkillResource
from sqlalchemy import func
import time

# ── 简单内存缓存（TTL 5 分钟）──
_cache: dict[str, list[dict]] = {}
_cache_ts: float = 0
_CACHE_TTL = 300  # 秒


def _fetch_all_resources() -> dict[str, list[dict]]:
    """从数据库加载所有资源，按 skill_name 分组返回（带缓存）"""
    global _cache, _cache_ts
    now = time.time()
    if _cache and (now - _cache_ts) < _CACHE_TTL:
        return _cache

    session = get_session()
    try:
        rows = session.query(SkillResource).order_by(
            SkillResource.skill_name, SkillResource.sort_order
        ).all()
        result: dict[str, list[dict]] = {}
        for r in rows:
            result.setdefault(r.skill_name, []).append({
                "name": r.title,
                "url": r.url,
                "type": r.resource_type,
            })
        _cache = result
        _cache_ts = now
        return result
    except Exception as e:
        print(f'[learning_path] 加载资源失败: {e}')
        return _cache if _cache else {}
    finally:
        session.close()


def invalidate_cache():
    """管理员更新资源后调用，清除缓存"""
    global _cache, _cache_ts
    _cache = {}
    _cache_ts = 0


def get_resources(skills: list[str]) -> list[dict]:
    """根据技能列表返回学习资源，未知技能返回通用搜索链接"""
    all_resources = _fetch_all_resources()
    resources = []
    skill_lower_map = {k.lower(): k for k in all_resources.keys()}

    for skill in skills:
        skill_stripped = skill.strip()
        # 1. 精确匹配
        if skill_stripped in all_resources:
            resources.extend(all_resources[skill_stripped])
        # 2. 大小写不敏感匹配
        elif skill_stripped.lower() in skill_lower_map:
            resources.extend(all_resources[skill_lower_map[skill_stripped.lower()]])
        # 3. 组合技能拆分
        elif '+' in skill_stripped or '&' in skill_stripped:
            parts = [p.strip() for p in skill_stripped.replace('&', '+').split('+') if p.strip()]
            for part in parts:
                if part in all_resources:
                    resources.extend(all_resources[part])
                elif part.lower() in skill_lower_map:
                    resources.extend(all_resources[skill_lower_map[part.lower()]])
                else:
                    resources.append({
                        "name": f"{part} - 菜鸟教程",
                        "url": f"https://www.runoob.com/?s={part}",
                        "type": "搜索",
                    })
        # 4. 未知技能 → 搜索兜底
        else:
            resources.append({
                "name": f"{skill_stripped} - 菜鸟教程",
                "url": f"https://www.runoob.com/?s={skill_stripped}",
                "type": "搜索",
            })
    # 去重（按 url）
    seen = set()
    unique = []
    for r in resources:
        if r["url"] not in seen:
            seen.add(r["url"])
            unique.append(r)
    return unique


def get_all_skill_names() -> list[str]:
    """返回数据库中所有有资源的技能名称列表"""
    session = get_session()
    try:
        rows = session.query(SkillResource.skill_name).distinct().order_by(SkillResource.skill_name).all()
        return [r[0] for r in rows]
    finally:
        session.close()
