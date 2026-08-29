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
# 固定评分口径 — v2（2026-08-29 算法升级）
# ──────────────────────────────────────────────
# v2 变更：
#   ① 修复 verified 倒挂 — 旧版 unverified 匹配只计 ×0.8，技能分天花板被压到 80；
#      现在完全匹配即计满分，已通过交叉验证的技能额外 ×1.1
#   ② 技能匹配分档：exact 1.0 / synonym 0.9 / containment 0.7；邻接技能不计分仅标注
#      （旧版只有同义词一层，JD 写 ReactJS、用户会 React 也算 0 分）
#   ③ 经验公式重写 — 旧版「JD 5年以上 → 10年经验 0 分」「3-5年 边缘仅 50 分」；
#      新版区间内 85~100 梯度，「X年以上」≥X 饱和 90+，不足高斯衰减，超出缓衰减至 60
#   ④ 薪资不重叠改高斯衰减（旧版差 20K 直接 0 分），支持「万」单位换算
#   维度函数拆至 services/dimension_scores.py，解释层拆至 services/match_explain.py
SCORE_VERSION = "v2.0.0"
# 技能匹配分档系数（L1 exact = 1.0 固定）
# 系数经离线扫参标定（2026-08-29，test_job_agent 100 简历 × 104 JD 排序召回，基线 MRR 0.9525）：
#   adjacent=0.45 → MRR 0.9083（邻接得分会顶掉严格重合的正解）
#   adjacent=0.2  → MRR 0.9508
#   adjacent=0.0  → MRR 0.9575（反超基线）→ 定档 0.0：邻接技能仅用于建议文案标注，
#   不参与计分；containment 是真实同义技能（ReactJS⊃React），扫参证明无损 MRR，保留 0.7
CREDIT_SYNONYM = 0.9
CREDIT_CONTAINMENT = 0.7
CREDIT_ADJACENT = 0.0
DIMENSION_FORMULA = {
    "skill":        "Σ(weight × level_credit × verified_bonus) / Σ(jd_weights)；level: exact 1.0 / synonym 0.9 / containment 0.7（adjacent 不计分，仅标注）",
    "experience":   "区间内 85~100 梯度；「X年以上」≥X 饱和 90+；不足高斯衰减(sigma=lo/3)；超出缓衰减至 60",
    "education":    {"博士": 1.0, "硕士": 0.9, "本科": 0.75, "大专": 0.5, "高中": 0.2, "其他": 0.3},
    "salary":       "有重叠: 50+覆盖率×50；无重叠: 50×exp(-(gap/15K)²/2)",
}

WEIGHTS = {"skill": 0.50, "experience": 0.20, "education": 0.15, "salary": 0.15}

EDU_ORDER = {"博士": 4, "硕士": 3, "本科": 2, "大专": 1, "高中": 0}

# v2：维度评分与解释层拆分到独立模块，此处 re-export 保持旧引用可用
from services.dimension_scores import (  # noqa: E402
    parse_years_mid, parse_jd_exp_range,
    calc_experience_score, calc_education_score, calc_salary_score,
    build_exp_comparison, build_salary_comparison,
)
from services.match_explain import (  # noqa: E402
    generate_summary, generate_recommendations,
)


def _parse_salary(salary_str: str) -> tuple[int, int]:
    """兼容别名（旧私有接口）：'25K-40K' → (25, 40)"""
    nums = re.findall(r'\d+', str(salary_str or ''))
    if not nums:
        return 0, 0
    if len(nums) >= 2:
        return int(nums[0]), int(nums[1])
    return int(nums[0]), int(nums[0])


# 兼容别名：routers/match_api.py 等外部仍在引用旧私有名
_parse_experience = parse_years_mid

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
    skill_popularity: Optional[dict] = None,
    all_jobs: Optional[list[dict]] = None,
) -> dict:
    """
    纯函数，不含 I/O，可复用于企业端批量匹配

    profile: extract_profile_features 的输出
    job:     jobs.py 中单个 JD dict（含 skills/experience/education/salary）
    quality_context: quality_checker.cross_validate 的全部技能验证状态
    skill_popularity: 预计算的技能频率 {技能名: 出现比例}，避免重复遍历
    all_jobs: 岗位池，注入后不回源数据库（离线评测/批量匹配用）
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
        has_adjacent_skill, containment_match, normalize_preprocess,
    )

    for idx, jd_skill in enumerate(jd_skills):
        s_lower = jd_skill.strip().lower()
        if not s_lower:
            continue
        # 核心度权重：JD 技能列表前 1/3 为核心技能（+0.2）
        is_core = 0.2 if idx < max(len(jd_skills) // 3, 1) else 0.0
        weight = 1.0 + is_core
        jd_total_weight += weight

        # 查找 profile 中的匹配技能（四级分档）
        matched_skill = best_match_in_profile(jd_skill, profile["skills"])
        q_info = quality_context.get(jd_skill, {})
        verified = q_info.get("verified", False)
        # v2 修复 verified 倒挂：旧版 unverified 匹配只计 ×0.8（技能分天花板 80），
        # 现在匹配即计满档分，已通过交叉验证的技能额外 ×1.1
        verified_bonus = 1.1 if verified else 1.0

        if matched_skill:
            # L1 直接匹配 → 1.0 / L2 同义词匹配 → 0.9（如 "Python3"↔"Python"）
            exact = normalize_preprocess(jd_skill) == normalize_preprocess(matched_skill)
            credit = 1.0 if exact else CREDIT_SYNONYM
            weighted_score += weight * credit * verified_bonus

            have.append({
                "skill": jd_skill,
                "matched_as": matched_skill,
                "confidence": q_info.get("confidence", 0.75),
                "verified": verified,
                "is_core": is_core > 0,
                "match_level": "exact" if exact else "synonym",
                "matched_in_text": True,
            })
        else:
            # L3 子串包含（如 JD "ReactJS" ⊃ 用户 "React"）→ 0.7 部分得分
            contain_skill = containment_match(jd_skill, profile["skills"])
            if contain_skill:
                weighted_score += weight * CREDIT_CONTAINMENT * verified_bonus
                have.append({
                    "skill": jd_skill,
                    "matched_as": contain_skill,
                    "confidence": 0.6,
                    "verified": verified,
                    "is_core": is_core > 0,
                    "match_level": "containment",
                    "matched_in_text": True,
                })
            else:
                priority, reason = calc_miss_priority(jd_skill, job, profile["skills"], quality_context, skill_popularity)
                adjacent = has_adjacent_skill(jd_skill, profile["skills"])
                if adjacent:
                    # L4 邻接技能（如 JD 要 K8s，用户有 Docker）→ 0.45 部分得分；
                    # 仍列入 miss 诚实展示缺口，建议文案会标注「有邻接基础」
                    weighted_score += weight * CREDIT_ADJACENT
                miss.append({
                    "skill": jd_skill,
                    "priority": priority,
                    "reason": reason,
                    "is_core": is_core > 0,
                    "adjacent": adjacent,
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
    exp_score = calc_experience_score(profile.get("experience_years"), job.get("experience", ""))

    # ── 学历匹配 ──
    edu_score = calc_education_score(profile.get("education", ""), job.get("education", ""))

    # ── 薪资匹配 ──
    salary_score = calc_salary_score(
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
    recommendations = generate_recommendations(have, miss, job, quality_context, all_jobs, skill_popularity)

    # ── 具体比较文本 ──
    comparison = {
        'experience': build_exp_comparison(profile.get("experience_years"), job.get("experience", "")),
        'salary': build_salary_comparison(profile.get("salary_min", 0), profile.get("salary_max", 0), job.get("salary", "")),
    }

    # ── 自然语言总结 ──
    summary = generate_summary(have, miss, job, overall, grade, comparison)

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
    skill_popularity: Optional[dict] = None,
) -> tuple[str, str]:
    """
    priority = f(岗位核心度, JD出现频次, 与已有技能邻近度, 学习成本)
    返回：("high"|"medium"|"low", reason_str)
    skill_popularity: 预计算的技能频率字典，避免重复遍历全部岗位
    """
    from services.skill_synonyms import get_skill_popularity, has_adjacent_skill, normalize_preprocess

    jd_skills = job.get("skills", [])
    idx = next((i for i, s in enumerate(jd_skills) if s == jd_skill), len(jd_skills))
    is_core = idx < max(len(jd_skills) // 3, 1)

    # 优先用预计算的频率，避免重复遍历 1500+ 岗位
    if skill_popularity is not None:
        s_key = normalize_preprocess(jd_skill)
        freq = skill_popularity.get(s_key, 0.0)
    else:
        try:
            from routers.jobs import load_all_jobs
            all_jobs = load_all_jobs()
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

