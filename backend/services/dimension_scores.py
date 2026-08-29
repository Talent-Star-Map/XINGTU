"""
人岗匹配维度评分函数库 v2（从 match_analyzer.py 拆出）

v2 关键修正（2026-08-29）：
  ① 经验匹配（旧版两个硬伤）：
     - 旧公式 `1 - |用户年 - JD中点| / JD范围` 在 JD 为「5年以上」时 range=1，
       10 年经验 → 0 分（资深候选人被清零）
     - 「3-5年」区间边缘只有 50 分（差半年就腰斩）
     新版：区间内梯度 85~100（中心 100）；「X年以上」≥X 即 90+ 饱和，
       超出不惩罚；低于下限高斯衰减（sigma=lo/3，能力不足是硬伤）；
       超出区间上限轻微衰减（60 底，经验多不是硬伤）。
  ② 薪资匹配：无重叠从线性 `100 - dist*5`（差 20K 直接 0 分）改为
     高斯衰减（sigma=15K），与有重叠时 overlap→0 的 50 分底连续衔接。
     新增「万」单位换算（"2万-3万" → 20-30K，旧版会解析成 2-3K 严重失真）。
  ③ 学历匹配：沿用等级映射（达标 100，差一级 -25），口径未变。

权重口径不变：技能 50% / 经验 20% / 学历 15% / 薪资 15%（见 CLAUDE.md）。

@owner: 张boy（人岗匹配模块）
"""

from __future__ import annotations
import re
import math
from typing import Optional

# 经验/薪资衰减参数（集中定义，调参不改公式）
_EXP_FLOOR = 20.0        # 经验不足的保底分
_EXP_EDGE = 85.0         # 区间边缘分
_EXP_OVER_BOTTOM = 60.0  # 超出区间上限的衰减底分
_SALARY_GAP_SIGMA = 15.0  # 薪资不重叠时的高斯衰减宽度（K）
_SALARY_NEUTRAL = 70.0   # 信息缺失时的中性分

_CN_NUM = {'零': 0, '一': 1, '二': 2, '两': 2, '三': 3, '四': 4, '五': 5,
           '六': 6, '七': 7, '八': 8, '九': 9, '十': 10}


def _normalize_range_text(s: str) -> str:
    """中文数字 → 阿拉伯数字；统一区间分隔符为 '-'"""
    s = ''.join(str(_CN_NUM[ch]) if ch in _CN_NUM else ch for ch in s)
    return s.replace('～', '-').replace('—', '-').replace('–', '-').replace('至', '-')


def parse_years_mid(exp_str: str) -> Optional[float]:
    """求职者年限提取：'3-5年'→4.0（取中点），'5年+'→5.0，无数字→None"""
    if not exp_str:
        return None
    s = _normalize_range_text(str(exp_str))
    nums = re.findall(r'\d+(?:\.\d+)?', s)
    if not nums:
        return None
    if len(nums) >= 2:
        return (float(nums[0]) + float(nums[1])) / 2
    return float(nums[0])


def parse_jd_exp_range(jd_exp: str) -> tuple[Optional[float], Optional[float]]:
    """
    JD 经验要求解析 → (lo, hi)，hi=None 表示开放式（"5年以上"）。
    '3-5年'→(3,5)  '5年以上'/'5年+'→(5,None)  '应届'→(0,1)  '经验不限'→(None,None)
    '3年'（单值）→(0,3)，与企业端引擎口径一致
    """
    if not jd_exp:
        return None, None
    s = _normalize_range_text(str(jd_exp))
    if '应届' in s or '在校' in s:
        return 0.0, 1.0
    if '不限' in s or '无要求' in s:
        return None, None
    nums = [float(n) for n in re.findall(r'(\d+(?:\.\d+)?)', s)]
    if not nums:
        return None, None
    if '+' in s or '以上' in s:
        return nums[0], None
    if len(nums) >= 2:
        return nums[0], nums[1]
    return 0.0, nums[0]


def calc_experience_score(profile_years: Optional[float], jd_exp: str) -> float:
    """
    经验匹配 v2（区间梯度 + 高斯衰减 + 超出饱和）

    - 用户未填经验           → 50（中性）
    - JD 不限经验            → 80（对任何人都适用，不算减分项）
    - 应届岗且用户在区间内    → 100
    - 区间 [lo,hi] 内        → 中心 100，边缘 85（梯度）
    - 「X年以上」且 ≥X       → 90~100（超出不惩罚，饱和）
    - 低于下限               → 85 高斯衰减到 20（sigma=lo/3）
    - 高于区间上限           → 85 缓衰减到 60（经验多不是硬伤）
    """
    if profile_years is None:
        return 50.0
    lo, hi = parse_jd_exp_range(jd_exp)
    if lo is None:
        return 80.0

    if hi is None:  # "X年以上"
        if profile_years >= lo:
            excess = min((profile_years - lo) / max(lo, 1.0), 1.0)
            return 90.0 + excess * 10.0
        sigma = max(lo / 3.0, 0.5)
        d = lo - profile_years
        return _EXP_FLOOR + math.exp(-(d * d) / (2 * sigma * sigma)) * (_EXP_EDGE - _EXP_FLOOR)

    # 应届/实习岗：区间内直接满分
    if lo == 0 and hi <= 1.5:
        if profile_years <= hi:
            return 100.0
    # 低于下限：高斯衰减（能力不足是硬伤，衰减快）
    if profile_years < lo:
        sigma = max(lo / 3.0, 0.5)
        d = lo - profile_years
        return _EXP_FLOOR + math.exp(-(d * d) / (2 * sigma * sigma)) * (_EXP_EDGE - _EXP_FLOOR)
    # 区间内：中心 100 → 边缘 85
    if profile_years <= hi:
        if hi <= lo:
            return 100.0
        mid = (lo + hi) / 2
        half = (hi - lo) / 2
        offset = abs(profile_years - mid) / half
        return 100.0 - offset * (100.0 - _EXP_EDGE)
    # 高于上限：缓衰减到 60（overqualified 不是大问题）
    sigma = max((hi - lo) / 2.0, 1.0) if hi > lo else 2.0
    d = profile_years - hi
    return _EXP_OVER_BOTTOM + math.exp(-(d * d) / (2 * sigma * sigma)) * (_EXP_EDGE - _EXP_OVER_BOTTOM)


def calc_education_score(profile_edu: str, jd_edu: str) -> float:
    """学历匹配（口径未变）：达标=100，差一级-25；用户未知=60，JD 无要求=80"""
    def _level(s: str) -> int:
        s = str(s).lower()
        if not s:
            return -1
        if "博士" in s:
            return 4
        if "硕士" in s or "研究生" in s:
            return 3
        if "本科" in s or "学士" in s:
            return 2
        if "大专" in s or "专科" in s:
            return 1
        return 0

    user_level = _level(profile_edu)
    req_level = _level(jd_edu)
    if user_level < 0:
        return 60.0
    if req_level <= 0:
        return 80.0
    if user_level >= req_level:
        return 100.0
    return max(0.0, 100.0 - (req_level - user_level) * 25)


def calc_salary_score(user_min: int, user_max: int, jd_salary: str) -> float:
    """
    薪资匹配 v2（覆盖率 + 高斯衰减，全程连续）

    - 信息缺失/面议            → 70（中性）
    - 有重叠                   → 50 + 覆盖率×50（覆盖率=重叠区/较大区间，完全覆盖=100）
    - 无重叠                   → 50×exp(-(gap/15K)²/2)：差 15K→30 分，30K→11 分，平滑归零
    - 支持「万」单位（"2万-3万"→20-30K），旧版按 K 直读会失真 10 倍
    """
    if not jd_salary or (user_min == 0 and user_max == 0):
        return _SALARY_NEUTRAL
    s = _normalize_range_text(str(jd_salary))
    if '面议' in s:
        return _SALARY_NEUTRAL
    wan = '万' in s
    nums = re.findall(r'\d+(?:\.\d+)?', s)
    if not nums:
        return _SALARY_NEUTRAL
    vals = [float(n) * (10 if wan else 1) for n in nums]
    jd_lo = vals[0]
    jd_hi = vals[1] if len(vals) >= 2 else vals[0]
    if user_max == 0:
        user_max = user_min

    overlap = min(user_max, jd_hi) - max(user_min, jd_lo)
    if overlap >= 0:
        max_range = max(jd_hi - jd_lo, user_max - user_min, 1.0)
        return 50.0 + (overlap / max_range) * 50.0
    # 无重叠：高斯衰减，overlap→0⁻ 时与 50 分连续衔接
    gap = max(user_min, jd_lo) - min(user_max, jd_hi)
    sigma = _SALARY_GAP_SIGMA
    return 50.0 * math.exp(-(gap * gap) / (2 * sigma * sigma))


# ─── 比较文本构建（供 summary / 前端具体比较展示用）─────────────────

def build_exp_comparison(user_years: Optional[float], jd_exp: str) -> Optional[dict]:
    """构建经验比较信息"""
    if user_years is None and not jd_exp:
        return None
    lo, hi = parse_jd_exp_range(jd_exp)
    if lo is None:
        return {'user_exp': user_years, 'jd_exp': jd_exp, 'diff': 0}
    jd_mid = hi if hi is not None and hi > lo else lo
    if user_years is None:
        return {'user_exp': None, 'jd_exp': jd_exp, 'diff': 0}
    return {'user_exp': user_years, 'jd_exp': jd_exp, 'diff': round(user_years - jd_mid, 1)}


def build_salary_comparison(user_min: int, user_max: int, jd_salary: str) -> Optional[dict]:
    """构建薪资比较信息"""
    if (user_min == 0 and user_max == 0) or not jd_salary:
        return None
    nums = re.findall(r'\d+', str(jd_salary))
    if len(nums) < 2:
        return {'overlap': 0, 'user_range': f'{user_min}K-{user_max}K', 'jd_range': jd_salary, 'distance': 0}
    jd_lo, jd_hi = int(nums[0]), int(nums[1])
    overlap_lo, overlap_hi = max(user_min, jd_lo), min(user_max, jd_hi)
    if overlap_hi >= overlap_lo:
        ratio = (overlap_hi - overlap_lo) / max(jd_hi - jd_lo, 1)
        return {'overlap': round(ratio, 2), 'user_range': f'{user_min}K-{user_max}K',
                'jd_range': jd_salary, 'distance': 0}
    dist = min(abs(user_max - jd_lo), abs(user_min - jd_hi))
    return {'overlap': 0, 'user_range': f'{user_min}K-{user_max}K', 'jd_range': jd_salary, 'distance': dist}
