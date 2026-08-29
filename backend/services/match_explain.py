"""
人岗匹配解释层（从 match_analyzer.py 拆出）

职责：
  - generate_summary():           诊断结果的自然语言总结
  - generate_recommendations():   按缺失技能优先级生成改进建议

v2 变更（2026-08-29）：
  - generate_recommendations 新增 skill_popularity 参数：调用方已预计算
    全岗位池技能频率时直接查表，不再对每个 miss 技能重复遍历 1500+ 岗位
    （旧版在 10 个 miss 时会多跑 10 次全池统计）。
  - 建议文案区分「完全缺失 / 有邻接技能」两种情形，给用户更准确的预期。

@owner: 张boy（人岗匹配模块）
"""

from __future__ import annotations
from typing import Optional


def generate_summary(have: list[dict], miss: list[dict], job: dict,
                     overall: float, grade: str,
                     comparison: Optional[dict] = None) -> str:
    """自然语言总结，包含经验和薪资的具体比较"""
    title = job.get("title", "目标岗位")
    have_count = len(have)
    miss_count = len(miss)
    high_priority = sum(1 for s in miss if s.get("priority") == "high")

    parts = []
    parts.append(f"您的匹配度为 {int(overall)} 分（等级 {grade}），与「{title}」共 {have_count} 项技能匹配")

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
    else:
        parts.append("已与该岗位基本匹配，建议投递")

    return "，".join(parts) + "。"


def _popularity_lookup(skill: str, skill_popularity: Optional[dict],
                       all_jobs: Optional[list[dict]], job: dict) -> float:
    """查技能流行度：优先用预计算表，否则回退全池统计（离线兜底用）"""
    if skill_popularity is not None:
        from services.skill_synonyms import normalize_preprocess
        return skill_popularity.get(normalize_preprocess(skill), 0.0)
    if all_jobs:
        from services.skill_synonyms import get_skill_popularity
        return get_skill_popularity(skill, all_jobs)
    return 0.0


def generate_recommendations(have: list[dict], miss: list[dict], job: dict,
                             quality_context: dict,
                             all_jobs: Optional[list[dict]] = None,
                             skill_popularity: Optional[dict] = None) -> list[str]:
    """按缺失技能优先级生成改进建议（最多 5 条）

    skill_popularity: 预计算的技能频率表（recommend 接口传入，避免逐技能全池遍历）
    """
    if all_jobs is None:
        try:
            from routers.jobs import load_all_jobs
            all_jobs = load_all_jobs()
        except Exception:
            # 数据库不可用不能拖垮匹配主流程，退化为只按当前岗位判断
            all_jobs = [job]

    recs = []
    miss_sorted = sorted(
        miss,
        key=lambda s: ({"high": 0, "medium": 1, "low": 2}.get(s.get("priority", "low"), 2))
    )

    for item in miss_sorted[:5]:
        skill = item["skill"]
        freq = _popularity_lookup(skill, skill_popularity, all_jobs, job)
        reason = item.get("reason", "")
        adjacent = item.get("adjacent", False)
        base = "有相关邻接技能，" if adjacent else ""

        if freq > 0.5:
            recs.append(f"优先补 {skill}（该技能在 {freq*100:.0f}% 的目标岗位中出现，{base}{reason}）")
        elif item.get("priority") == "high":
            recs.append(f"建议掌握 {skill}（岗位要求的核心技能，{base}{reason}）")
        else:
            recs.append(f"可选学 {skill}（{base}{reason}）")

    return recs
