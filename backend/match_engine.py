"""
岗位-候选人匹配引擎 — 基于能力图谱的三维度匹配

输入: Job (岗位) + Jobseeker (求职者)
输出: {match_score, skill_match, exp_match, salary_match}

三维度算法:
    ① 技能匹配 (权重 0.6) — 岗位要求技能 vs 求职者拥有技能的覆盖率（Jaccard 变体）
    ② 经验匹配 (权重 0.25) — 候选人经验年限是否落在岗位要求区间
    ③ 薪资匹配 (权重 0.15) — 岗位薪资区间 vs 求职者期望区间重叠度

最终分数 = skill*0.6 + exp*0.25 + salary*0.15  (0-100)

运行模式:
    - 批量计算: run_match_batch()  遍历所有 active 岗位 × 所有求职者，upsert match_records
    - 单岗位计算: calc_match_for_job(job_id)  只算某个岗位
"""

import re
from typing import List, Optional, Tuple

from database import get_session, Job, Jobseeker, MatchRecord


# ─── 工具函数：解析字符串中的数字 ───────────────────────────────────────

def parse_skills(skills_str: str) -> List[str]:
    """把逗号分隔的技能字符串解析成技能列表（去空白、转小写、去重）"""
    if not skills_str:
        return []
    return list({s.strip().lower() for s in skills_str.split(',') if s.strip()})


def parse_years(exp_str: str) -> Optional[float]:
    """
    从经验字符串中提取年数。
    支持: "4年" / "3-5年" / "5年+" / "5年以上" / "1年以下"
    返回: 单值返回该值；区间返回下限；无法解析返回 None
    """
    if not exp_str:
        return None
    # 找所有数字
    nums = re.findall(r'(\d+(?:\.\d+)?)', exp_str)
    if not nums:
        return None
    # 取第一个数字作为年限代表值
    return float(nums[0])


def parse_exp_range(exp_str: str) -> Tuple[Optional[float], Optional[float]]:
    """
    解析经验要求区间，如 "3-5年" → (3.0, 5.0)；"5年+" → (5.0, None)
    返回 (下限, 上限)，None 表示无界
    """
    if not exp_str:
        return None, None
    nums = re.findall(r'(\d+(?:\.\d+)?)', exp_str)
    if not nums:
        return None, None
    # 含 "+" 或 "以上" → 只有下限
    if '+' in exp_str or '以上' in exp_str:
        return float(nums[0]), None
    # 含 "-" 或 "至" → 区间
    if '-' in exp_str or '至' in exp_str or len(nums) >= 2:
        return float(nums[0]), float(nums[1]) if len(nums) >= 2 else None
    # 单值 → 0 ~ 该值（容忍下限）
    return 0.0, float(nums[0])


def parse_salary_k(salary_str: str) -> Tuple[Optional[int], Optional[int]]:
    """
    解析薪资字符串，返回 (min_K, max_K) 单位 K。
    支持: "30K-50K" / "30k-50k" / "20K-30K" / "面议"→(None,None)
    """
    if not salary_str:
        return None, None
    if '面议' in salary_str:
        return None, None
    nums = re.findall(r'(\d+)', salary_str)
    if not nums:
        return None, None
    if len(nums) >= 2:
        return int(nums[0]), int(nums[1])
    return int(nums[0]), None


# ─── 三维度匹配算法 ───────────────────────────────────────────────────

def calc_skill_match(job_skills_str: str, seeker_skills_str: str) -> int:
    """
    技能匹配度：求职者覆盖岗位要求技能的比例
    算法: |岗位要求 ∩ 求职者拥有| / |岗位要求| * 100
    岗位无要求技能时返回 100（视为无门槛）
    """
    job_set = set(parse_skills(job_skills_str))
    seek_set = set(parse_skills(seeker_skills_str))
    if not job_set:
        return 100
    coverage = len(job_set & seek_set) / len(job_set)
    return int(coverage * 100)


def calc_exp_match(job_exp_str: str, seeker_exp_str: str) -> int:
    """
    经验匹配度：候选人年限是否落在岗位要求区间
    - 落在区间内: 100
    - 低于下限: 按比例线性衰减
    - 高于上限: 轻微扣分（overqualified，每超 1 年扣 10）
    """
    lo, hi = parse_exp_range(job_exp_str)
    years = parse_years(seeker_exp_str)
    # 任一无法解析，给中性分 50（避免完全拉零导致总分失真）
    if lo is None and hi is None or years is None:
        return 50

    # 只有下限（"5年+"）
    if hi is None:
        if years >= lo:
            return 100
        return max(0, int(years / lo * 100))

    # 区间判断
    if lo <= years <= hi:
        return 100
    if years < lo and lo > 0:
        return max(0, int(years / lo * 100))
    # years > hi
    return max(0, 100 - int(years - hi) * 10)


def calc_salary_match(job_salary_str: str, job_min: Optional[int], job_max: Optional[int],
                      seeker_salary_str: str) -> int:
    """
    薪资匹配度：岗位薪资区间 vs 求职者期望区间重叠度
    - 完全重叠: 100
    - 部分重叠: 按重叠比例
    - 无重叠: 按差距衰减
    """
    # 优先用 DB 里的数值字段
    j_min, j_max = (job_min, job_max) if job_min and job_max else parse_salary_k(job_salary_str)
    s_min, s_max = parse_salary_k(seeker_salary_str)

    # 任一方无法解析，给中性分 60
    if not j_min or not j_max or not s_min or not s_max:
        return 60

    # 计算重叠
    overlap = min(j_max, s_max) - max(j_min, s_min)
    if overlap >= 0:
        # 有重叠：重叠越长，匹配度越高
        union = max(j_max, s_max) - min(j_min, s_min) or 1
        return int(overlap / union * 100) if union else 100
    # 无重叠：差距越大分数越低（每差 5K 扣 20 分）
    gap = max(j_min, s_min) - min(j_max, s_max)
    return max(0, 100 - int(gap / 5) * 20)


# ─── 加权汇总 ────────────────────────────────────────────────────────

# 三维度权重 — 技能最重要，经验次之，薪资最次
WEIGHTS = {'skill': 0.6, 'exp': 0.25, 'salary': 0.15}


def calc_total_score(skill: int, exp: int, salary: int) -> int:
    """加权汇总三维度分数，返回 0-100"""
    return int(skill * WEIGHTS['skill'] + exp * WEIGHTS['exp'] + salary * WEIGHTS['salary'])


def has_skill_overlap(job_skills_str: str, seeker_skills_str: str) -> bool:
    """
    判断岗位要求技能与求职者技能是否有交集。
    用作匹配引擎的门槛：无任何技能交集的岗位-求职者对不创建匹配记录。
    例：岗位[Python,LangChain] vs 求职者[Java,MySQL] → False，跳过
    """
    job_set = set(parse_skills(job_skills_str))
    seek_set = set(parse_skills(seeker_skills_str))
    # 岗位无要求技能时视为有交集（无门槛岗位允许所有人匹配）
    if not job_set:
        return True
    return len(job_set & seek_set) > 0


def match_one(job: Job, seeker: Jobseeker) -> dict:
    """对单个 岗位-求职者 计算匹配，返回四分数"""
    skill = calc_skill_match(job.skills_required, seeker.skills)
    exp = calc_exp_match(job.experience, seeker.experience)
    salary = calc_salary_match(job.salary_range, job.salary_min, job.salary_max, seeker.expected_salary)
    total = calc_total_score(skill, exp, salary)
    return {'match_score': total, 'skill_match': skill, 'exp_match': exp, 'salary_match': salary}


# ─── 批量计算：写入 match_records 表 ──────────────────────────────────

def run_match_batch(job_id: Optional[int] = None) -> dict:
    """
    批量执行匹配，将分数 upsert 到 match_records 表。
    - job_id 为 None: 遍历所有 active 岗位 × 所有求职者
    - job_id 指定: 仅算该岗位

    匹配门槛：岗位要求技能与求职者技能必须有交集，否则跳过（不创建匹配记录）。
    清理策略：每次重算前，删除 pending 状态的旧记录，保留已处理(accepted/rejected)的记录。

    返回: {total_jobs, total_seekers, total_matches, updated, skipped, sample}
    """
    session = get_session()
    try:
        # 拉取岗位（仅 active）
        job_q = session.query(Job).filter(Job.status == 'active')
        if job_id:
            job_q = job_q.filter(Job.id == job_id)
        jobs = job_q.all()

        # 拉取所有求职者
        seekers = session.query(Jobseeker).all()

        # 清理旧的 pending 记录（保留已处理的 accepted/rejected，避免丢失 HR 的操作）
        # 注：如果指定了 job_id，只清理该岗位的 pending 记录
        del_q = session.query(MatchRecord).filter(MatchRecord.status == 'pending')
        if job_id:
            del_q = del_q.filter(MatchRecord.job_id == job_id)
        deleted_count = del_q.delete(synchronize_session=False)

        updated = 0
        skipped = 0  # 因技能无交集被跳过的数量
        sample = None  # 保留一份样本用于前端展示

        for job in jobs:
            for seeker in seekers:
                # 门槛检查：技能无交集则跳过，不创建匹配记录
                if not has_skill_overlap(job.skills_required, seeker.skills):
                    skipped += 1
                    continue

                scores = match_one(job, seeker)

                # upsert: 已有记录则更新分数，否则新增
                # 注：上面已清理 pending 记录，这里查到的非 pending 记录会被更新分数
                mr = session.query(MatchRecord).filter(
                    MatchRecord.job_id == job.id,
                    MatchRecord.jobseeker_id == seeker.id,
                ).first()

                if mr:
                    # 更新现有记录的分数（保留原 status）
                    mr.match_score = scores['match_score']
                    mr.skill_match = scores['skill_match']
                    mr.exp_match = scores['exp_match']
                    mr.salary_match = scores['salary_match']
                else:
                    # 新增匹配记录
                    mr = MatchRecord(
                        job_id=job.id,
                        jobseeker_id=seeker.id,
                        match_score=scores['match_score'],
                        skill_match=scores['skill_match'],
                        exp_match=scores['exp_match'],
                        salary_match=scores['salary_match'],
                        status='pending',
                    )
                    session.add(mr)
                updated += 1

                # 保存第一个样本（岗位名 + 候选人名 + 分数）便于前端展示
                if sample is None:
                    sample = {
                        'job_title': job.title,
                        'seeker_name': seeker.real_name or seeker.username,
                        'skill': scores['skill_match'],
                        'exp': scores['exp_match'],
                        'salary': scores['salary_match'],
                        'total': scores['match_score'],
                    }

        session.commit()
        return {
            'total_jobs': len(jobs),
            'total_seekers': len(seekers),
            'total_matches': updated,
            'updated': updated,
            'skipped': skipped,            # 被门槛过滤掉的数量
            'cleaned': deleted_count,      # 清理的旧 pending 记录数
            'sample': sample,
        }
    except Exception as e:
        session.rollback()
        raise
    finally:
        session.close()


# ─── CLI: python -m match_engine ──────────────────────────────────────

if __name__ == '__main__':
    print('开始批量匹配...')
    result = run_match_batch()
    print(f"\n===== 匹配完成 =====")
    print(f"  岗位数:     {result['total_jobs']}")
    print(f"  求职者数:   {result['total_seekers']}")
    print(f"  匹配记录数: {result['total_matches']}")
    if result['sample']:
        s = result['sample']
        print(f"\n  样本: {s['job_title']} ↔ {s['seeker_name']}")
        print(f"        技能 {s['skill']} | 经验 {s['exp']} | 薪资 {s['salary']} → 总分 {s['total']}")
