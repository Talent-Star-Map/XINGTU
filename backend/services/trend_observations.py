"""月度观测统计：缺少观测不等于市场中不存在新岗位。"""
from datetime import datetime


def monthly_observations(buckets, months, now):
    """桶值来自带采集时间的记录；累计值仅累计当前展示窗口。"""
    if not 1 <= months <= 12:
        raise ValueError('months must be between 1 and 12')
    result = []
    cumulative = 0
    for offset in range(months - 1, -1, -1):
        index = now.year * 12 + now.month - 1 - offset
        year, month = divmod(index, 12)
        key = f'{year:04d}-{month + 1:02d}'
        count = int(buckets.get(key, 0))
        cumulative += count
        result.append({'month': key, 'count': count, 'cum_count': cumulative,
                       'is_real': True, 'has_observations': count > 0,
                       'coverage_known': False})
    return result
