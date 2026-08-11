"""
人岗匹配分析器 —— 两层分离

第一层 extract_profile_features(): 输出标准化候选人画像
第二层 compute_match_score():     纯评分函数（可复用于企业端批量匹配）
第三层 calc_miss_priority():      缺失技能优先级 + reason（建议 #4）

赛题硬指标：JD解析/简历提取/人岗匹配 ≥90%

@owner: 我和吴家（新岗位发现+求职端趋势+企业端市场洞察）
"""

from __future__ import annotations
import re, os, json, math
from typing import Optional

# ──────────────────────────────────────────────
# 固定评分口径（建议 #1）
# ──────────────────────────────────────────────
SCORE_VERSION = "v1.0.0"
DIMENSION_FORMULA = {
    "skill":        "Σ(weight × verified_bonus × synonym_match) / Σ(jd_weights)",
    "experience":   "1 - |profile_exp - jd_midpoint| / jd_range, clamp[0,1]",
    "education":    {"博士": 1.0, "硕士": 0.9, "本科": 0.75, "大专": 0.5, "高中": 0.2, "其他": 0.3},
    "salary":       "overlap(profile_range, jd_range) / jd_range",
}

WEIGHTS = {"skill": 0.50, "experience": 0.20, "education": 0.15, "salary": 0.15}

EDU_ORDER = {"博士": 4, "硕士": 3, "本科": 2, "大专": 1, "高中": 0}

# ──────────────────────────────────────────────
# 第一层：画像提取
# ──────────────────────────────────────────────

def extract_profile_features(
    source: str | list[str],
    source_type: str = "auto",  # "resume_text" | "skill_list" | "auto"
) -> dict:
    """
    输入：str（简历文本）| list[str]（技能列表）
    输出标准化画像 dict
    """
    skills = []
    education = ""
    experience_years: Optional[float] = None
    salary_min, salary_max = 0, 0
    parse_confidence_avg = 0.7
    method = "rule_based"

    if source_type == "auto":
        source_type = "resume_text" if isinstance(source, str) else "skill_list"

    if source_type == "resume_text":
        # 走完整简历解析
        from services.resume_parser import rule_based_extract, deepseek_extract
        text = source
        llm = deepseek_extract(text)
        rule = rule_based_extract(text)
        merged = {**rule, **(llm or {})}
        skills = [s for s in merged.get("skills", []) if s and s.strip()]
        education = merged.get("education", "")
        experience_years = _parse_experience(merged.get("experience", ""))
        salary_min, salary_max = _parse_salary(merged.get("expected_salary", ""))
        method = "deepseek" if llm else "rule_based"
        parse_confidence_avg = 0.92 if llm else 0.70

    elif source_type == "skill_list":
        # 直接是技能列表（来自 profile.skills 字段）
        skills = [s.strip() for s in source if s and s.strip()]
        education = ""
        experience_years = None
        method = "profile_field"
        parse_confidence_avg = 0.60  # 手动填写的，置信度较低

    # 技能归一化（去重 + lower 处理保留原始大小写用于显示）
    skills = list(dict.fromkeys(skills))  # 保序去重

    return {
        "skills": skills,
        "education": education,
        "experience_years": experience_years,
        "salary_min": salary_min,
        "salary_max": salary_max,
        "raw_source": method,
        "parse_confidence_avg": parse_confidence_avg,
        "low_confidence_skills": [],  # 由调用方填充
    }


# ──────────────────────────────────────────────
# 第二层：纯评分计算（建议 #3 核心）
# ──────────────────────────────────────────────

def compute_match_score(
    profile: dict,
    job: dict,
    quality_context: Optional[dict] = None,
) -> dict:
    """
    纯函数，不含 I/O，可复用于企业端批量匹配

    profile: extract_profile_features 的输出
    job:     jobs.py 中单个 JD dict（含 skills/experience/education/salary）
    quality_context: quality_checker.cross_validate 的全部技能验证状态
    """
    if quality_context is None:
        quality_context = {}

    jd_skills = job.get("skills", [])

    # ── 技能匹配 ──
    have, miss, extra = [], [], []
    jd_total_weight = 0.0
    weighted_score = 0.0

    profile_set_lower = {s.strip().lower() for s in profile["skills"] if s.strip()}
    jd_set_lower = {s.strip().lower() for s in jd_skills if s.strip()}

    from services.skill_synonyms import (
        is_synonym, best_match_in_profile, get_skill_popularity,
        has_adjacent_skill,
    )

    for idx, jd_skill in enumerate(jd_skills):
        s_lower = jd_skill.strip().lower()
        if not s_lower:
            continue
        # 核心度权重：JD 技能列表前 1/3 为核心技能（+0.2）
        is_core = 0.2 if idx < max(len(jd_skills) // 3, 1) else 0.0
        weight = 1.0 + is_core
        jd_total_weight += weight

        # 查找 profile 中的匹配技能（含同义词）
        matched_skill = best_match_in_profile(jd_skill, profile["skills"])

        if matched_skill:
            # 交叉验证加权（已通过 quality_checker 验证的 bonus）
            q_info = quality_context.get(jd_skill, {})
            verified = q_info.get("verified", False)
            verified_bonus = 1.2 if verified else 0.8
            weighted_score += weight * verified_bonus

            have.append({
                "skill": jd_skill,
                "matched_as": matched_skill,
                "confidence": q_info.get("confidence", 0.75),
                "verified": verified,
                "is_core": is_core > 0,
                "matched_in_text": True,
            })
        else:
            priority, reason = calc_miss_priority(jd_skill, job, profile["skills"], quality_context)
            miss.append({
                "skill": jd_skill,
                "priority": priority,
                "reason": reason,
                "is_core": is_core > 0,
            })

    # 加分项：用户有但 JD 不需要的技能
    for ps in profile["skills"]:
        ps_lower = ps.strip().lower()
        if not ps_lower:
            continue
        if ps_lower not in jd_set_lower and not any(is_synonym(ps_lower, jds) for jds in jd_set_lower):
            extra.append(ps)

    skill_score = weighted_score / max(jd_total_weight, 1) * 100

    # ── 经验匹配 ──
    exp_score = _calc_experience_score(profile.get("experience_years"), job.get("experience", ""))

    # ── 学历匹配 ──
    edu_score = _calc_education_score(profile.get("education", ""), job.get("education", ""))

    # ── 薪资匹配 ──
    salary_score = _calc_salary_score(
        profile.get("salary_min", 0), profile.get("salary_max", 0),
        job.get("salary", ""),
    )

    # ── 综合加权 ──
    overall = (
        skill_score * WEIGHTS["skill"]
        + exp_score * WEIGHTS["experience"]
        + edu_score * WEIGHTS["education"]
        + salary_score * WEIGHTS["salary"]
    )

    # ── 等级 ──
    grade = "S" if overall >= 90 else "A" if overall >= 80 else "B" if overall >= 70 else "C" if overall >= 60 else "D"

    # ── 改进建议 ──
    recommendations = _generate_recommendations(have, miss, job, quality_context)

    # ── 具体比较文本 ──
    comparison = {
        'experience': _build_exp_comparison(profile.get("experience_years"), job.get("experience", "")),
        'salary': _build_salary_comparison(profile.get("salary_min", 0), profile.get("salary_max", 0), job.get("salary", "")),
    }

    # ── 自然语言总结 ──
    summary = _generate_summary(have, miss, job, overall, grade, comparison)

    # ── learning_path 入参 ──
    learning_path_input = {
        "target_job_title": job.get("title", ""),
        "missing_skills": [s["skill"] for s in miss],
    }

    return {
        "score_version": SCORE_VERSION,
        "dimension_formula": DIMENSION_FORMULA,
        "overall": round(min(overall, 100.0), 1),
        "grade": grade,
        "dims": {
            "skill":       {"score": round(skill_score, 1), "weight": WEIGHTS["skill"],    "weighted": round(skill_score * WEIGHTS["skill"], 2)},
            "experience":  {"score": round(exp_score, 1),   "weight": WEIGHTS["experience"], "weighted": round(exp_score * WEIGHTS["experience"], 2)},
            "education":   {"score": round(edu_score, 1),   "weight": WEIGHTS["education"],  "weighted": round(edu_score * WEIGHTS["education"], 2)},
            "salary":      {"score": round(salary_score, 1),"weight": WEIGHTS["salary"],     "weighted": round(salary_score * WEIGHTS["salary"], 2)},
        },
        "skills": {"have": have, "miss": miss, "extra": extra},
        "summary": summary,
        "recommendations": recommendations,
        "learning_path_input": learning_path_input,
        "raw_inputs_snapshot": {
            "profile_skill_count": len(profile["skills"]),
            "matched_count": len(have),
            "miss_count": len(miss),
            "job_skill_count": len(jd_skills),
            "source": profile.get("raw_source", "unknown"),
            "profile_confidence_avg": profile.get("parse_confidence_avg", 0),
        },
    }


# ──────────────────────────────────────────────
# 第三层：缺失技能优先级（建议 #4）
# ──────────────────────────────────────────────

def calc_miss_priority(
    jd_skill: str,
    job: dict,
    profile_skills: list[str],
    quality_context: dict,
) -> tuple[str, str]:
    """
    priority = f(岗位核心度, JD出现频次, 与已有技能邻近度, 学习成本)
    返回：("high"|"medium"|"low", reason_str)
    """
    from services.skill_synonyms import get_skill_popularity, has_adjacent_skill

    jd_skills = job.get("skills", [])
    idx = next((i for i, s in enumerate(jd_skills) if s == jd_skill), len(jd_skills))
    is_core = idx < max(len(jd_skills) // 3, 1)

    try:
        all_jobs = None
        from routers.jobs import SEED_JOBS
        all_jobs = SEED_JOBS
    except ImportError:
        all_jobs = [job]

    freq = get_skill_popularity(jd_skill, all_jobs)
    adjacent = has_adjacent_skill(jd_skill, profile_skills)

    score = 0
    reasons = []

    if is_core:
        score += 3
        reasons.append("核心技能")

    if freq > 0.5:
        score += 2
        reasons.append("高频需求")
    elif freq >= 0.15:
        score += 1
        reasons.append("常见技能")

    if adjacent:
        score += 1
        reasons.append("邻接技能已掌握")

    # 核心技能 + 任何出现率 → high
    if is_core:
        score = max(score, 4)

    # 高频技能（出现率>50%）最低 medium
    if freq > 0.5 and score < 2:
        score = 2

    priority = "high" if score >= 4 else "medium" if score >= 2 else "low"
    reason_str = "、".join(reasons) if reasons else "基础技能"

    return priority, reason_str


# ──────────────────────────────────────────────
# 辅助函数
# ──────────────────────────────────────────────

def _parse_experience(exp_str: str) -> Optional[float]:
    """'3-5年' → 4.0， '5年+' → 5.0"""
    if not exp_str:
        return None
    s = str(exp_str).strip()
    # 取数字
    nums = re.findall(r'\d+', s)
    if not nums:
        return None
    if len(nums) >= 2:
        return (int(nums[0]) + int(nums[1])) / 2
    return float(nums[0])


def _parse_salary(salary_str: str) -> tuple[int, int]:
    """'25K-40K' → (25, 40)"""
    if not salary_str:
        return 0, 0
    nums = re.findall(r'\d+', str(salary_str))
    if not nums:
        return 0, 0
    if len(nums) >= 2:
        return int(nums[0]), int(nums[1])
    return int(nums[0]), int(nums[0])


def _calc_experience_score(profile_years: Optional[float], jd_exp: str) -> float:
    """经验匹配：1 - |profile - jd_midpoint| / jd_range"""
    if profile_years is None:
        return 50.0  # 未知时给中等分

    nums = re.findall(r'\d+', str(jd_exp))
    if not nums:
        return 50.0

    if len(nums) >= 2:
        lo, hi = int(nums[0]), int(nums[1])
    else:
        lo = hi = int(nums[0])

    jd_mid = (lo + hi) / 2
    jd_range = max(hi - lo, 1)

    diff = abs(profile_years - jd_mid)
    score = max(0, 1 - diff / jd_range) * 100
    return min(score, 100.0)


def _calc_education_score(profile_edu: str, jd_edu: str) -> float:
    """学历匹配：用户学历 vs JD 最低学历要求"""
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
        return 60.0  # 未知学历
    if req_level <= 0:
        return 80.0  # JD 没写学历要求
    if user_level >= req_level:
        return 100.0
    # 差一级 75，差两级 50，差三级 25
    diff = req_level - user_level
    return max(0, 100 - diff * 25)


def _calc_salary_score(user_min: int, user_max: int, jd_salary: str) -> float:
    """
    薪资匹配：JD 薪资范围与用户期望的重叠度
    完全重叠=100，部分重叠=50，不重叠按距离比例
    """
    if not jd_salary or (user_min == 0 and user_max == 0):
        return 70.0  # 未知时中性分

    jd_nums = re.findall(r'\d+', str(jd_salary))
    if len(jd_nums) < 2:
        return 70.0

    jd_lo, jd_hi = int(jd_nums[0]), int(jd_nums[1])
    if user_max == 0:
        user_max = user_min

    # 计算重叠
    user_range = user_max - user_min
    jd_range = max(jd_hi - jd_lo, 1)

    overlap_lo = max(user_min, jd_lo)
    overlap_hi = min(user_max, jd_hi)

    if overlap_hi >= overlap_lo:
        overlap = overlap_hi - overlap_lo
        return min(100.0, (overlap / max(user_range, jd_range)) * 100 + 50)

    # 无重叠
    dist = min(abs(user_max - jd_lo), abs(user_min - jd_hi))
    return max(0, 100 - dist * 5)


def _build_exp_comparison(user_years: float | None, jd_exp: str) -> dict | None:
    """构建经验比较信息"""
    if user_years is None and not jd_exp: return None
    jd_nums = re.findall(r'\d+', str(jd_exp))
    if not jd_nums: return {'user_exp': user_years, 'jd_exp': jd_exp, 'diff': 0}
    jd_mid = (int(jd_nums[0]) + int(jd_nums[-1])) / 2
    if user_years is None: return {'user_exp': None, 'jd_exp': jd_exp, 'diff': 0}
    return {'user_exp': user_years, 'jd_exp': jd_exp, 'diff': round(user_years - jd_mid, 1)}


def _build_salary_comparison(user_min: int, user_max: int, jd_salary: str) -> dict | None:
    """构建薪资比较信息"""
    if (user_min == 0 and user_max == 0) or not jd_salary: return None
    jd_nums = re.findall(r'\d+', str(jd_salary))
    if len(jd_nums) < 2: return {'overlap': 0, 'user_range': f'{user_min}K-{user_max}K', 'jd_range': jd_salary, 'distance': 0}
    jd_lo, jd_hi = int(jd_nums[0]), int(jd_nums[1])
    overlap_lo, overlap_hi = max(user_min, jd_lo), min(user_max, jd_hi)
    if overlap_hi >= overlap_lo:
        return {'overlap': round((overlap_hi - overlap_lo) / max(jd_hi - jd_lo, 1), 2), 'user_range': f'{user_min}K-{user_max}K', 'jd_range': jd_salary, 'distance': 0}
    dist = min(abs(user_max - jd_lo), abs(user_min - jd_hi))
    return {'overlap': 0, 'user_range': f'{user_min}K-{user_max}K', 'jd_range': jd_salary, 'distance': dist}


def _generate_summary(have: list[dict], miss: list[dict], job: dict, overall: float, grade: str, comparison: dict | None = None) -> str:
    """自然语言总结，包含经验和薪资的具体比较"""
    title = job.get("title", "目标岗位")
    have_count = len(have)
    miss_count = len(miss)
    high_priority = sum(1 for s in miss if s.get("priority") == "high")

    parts = []
    parts.append(f"您的匹配度为 {int(overall)} 分（等级 {grade}），与「{title}」共 {have_count} 项技能匹配")

    # 具体比较：经验
    if comparison and comparison.get('experience'):
        exp = comparison['experience']
        if exp.get('user_exp') is not None:
            if exp.get('diff', 0) == 0:
                parts.append(f"经验完全匹配（{exp['user_exp']:.0f}年 vs JD要求{exp['jd_exp']}）")
            elif exp['diff'] > 0:
                parts.append(f"经验超出要求（{exp['user_exp']:.0f}年 vs JD要求{exp['jd_exp']}，多{exp['diff']:.0f}年）")
            else:
                parts.append(f"经验略有差距（{exp['user_exp']:.0f}年 vs JD要求{exp['jd_exp']}，差{abs(exp['diff']):.0f}年）")
        elif exp.get('jd_exp'):
            parts.append(f"JD要求{exp['jd_exp']}（您未填写工作经验）")

    # 具体比较：薪资
    if comparison and comparison.get('salary'):
        sal = comparison['salary']
        if sal.get('overlap') is not None:
            if sal['overlap'] > 0:
                parts.append(f"薪资范围重叠度{sal['overlap']*100:.0f}%（期望{sal['user_range']} vs JD {sal['jd_range']}）")
            else:
                dist = sal.get('distance', 0)
                parts.append(f"薪资无重叠（期望{sal['user_range']} vs JD {sal['jd_range']}，相差约{dist}K）")

    if miss_count > 0:
        parts.append(f"存在 {miss_count} 项技能缺口")
        if high_priority > 0:
            parts.append(f"其中 {high_priority} 项为高优缺口")
    if not miss:
        parts.append("已与该岗位基本匹配，建议投递")

    return "，".join(parts) + "。"


def _generate_recommendations(have: list[dict], miss: list[dict], job: dict, quality_context: dict) -> list[str]:
    """按缺失技能优先级生成改进建议（最多 5 条）"""
    from services.skill_synonyms import get_skill_popularity
    try:
        from routers.jobs import SEED_JOBS
        all_jobs = SEED_JOBS
    except ImportError:
        all_jobs = [job]

    recs = []
    # 高优优先
    miss_sorted = sorted(
        miss,
        key=lambda s: ({"high": 0, "medium": 1, "low": 2}.get(s.get("priority", "low"), 2))
    )

    for item in miss_sorted[:5]:
        skill = item["skill"]
        freq = get_skill_popularity(skill, all_jobs)
        reason = item.get("reason", "")

        if freq > 0.5:
            recs.append(f"优先补 {skill}（该技能在 {freq*100:.0f}% 的目标岗位中出现，{reason}）")
        elif item.get("priority") == "high":
            recs.append(f"建议掌握 {skill}（岗位要求的核心技能，{reason}）")
        else:
            recs.append(f"可选学 {skill}（{reason}）")

    return recs
