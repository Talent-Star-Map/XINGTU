"""
岗位-候选人匹配引擎 — 基于能力图谱的五维度匹配（2026-08 升级）

输入: Job (岗位) + Jobseeker (求职者)
输出: {match_score, skill_match, exp_match, edu_match, location_match, salary_match}

五维度算法:
    ① 技能匹配 (权重 0.40) — TF-IDF 加权 + 核心技能增益 + 邻近技能部分得分
    ② 经验匹配 (权重 0.20) — 高斯衰减（落在区间内满分，偏离区间平滑衰减）
    ③ 学历匹配 (权重 0.15) — 学历等级映射（博士>硕士>本科>大专>高中）
    ④ 地域匹配 (权重 0.15) — 城市层级匹配（同城>同省>不限>异地）
    ⑤ 薪资匹配 (权重 0.10) — IoU 区间重叠度

最终分数 = skill×0.40 + exp×0.20 + edu×0.15 + location×0.15 + salary×0.10  (0-100)

算法理论依据:
    - TF-IDF (Term Frequency-Inverse Document Frequency): 稀有技能匹配价值更高
    - Gaussian Decay: 经验偏差用高斯函数平滑衰减，避免硬截断
    - IoU (Intersection over Union): 薪资区间重叠度，目标检测领域经典指标
    - Multi-Criteria Decision Making (MCDM): 多准则加权决策

运行模式:
    - 批量计算: run_match_batch()  遍历所有 active 岗位 × 所有求职者，upsert match_records
    - 单岗位计算: calc_match_for_job(job_id)  只算某个岗位

@owner: 张东阳（人岗匹配+企业端人才星界面）
"""

import re
import math
from typing import List, Optional, Tuple, Dict
from collections import Counter

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
    nums = re.findall(r'(\d+(?:\.\d+)?)', exp_str)
    if not nums:
        return None
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
    if '+' in exp_str or '以上' in exp_str:
        return float(nums[0]), None
    if '-' in exp_str or '至' in exp_str or len(nums) >= 2:
        return float(nums[0]), float(nums[1]) if len(nums) >= 2 else None
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


# ─── 学历等级映射 ─────────────────────────────────────────────────────

# 学历 → 等级数值（越高越优）
EDU_LEVEL = {
    '博士': 5, '博士研究生': 5,
    '硕士': 4, '研究生': 4, 'master': 4,
    '本科': 3, '学士': 3, 'bachelor': 3, '本硕': 3,
    '大专': 2, '专科': 2, '高职': 2,
    '高中': 1, '中专': 1, '中技': 1,
}

def parse_edu_level(edu_str: str) -> int:
    """解析学历字符串，返回等级数值（0=未知）"""
    if not edu_str:
        return 0
    s = str(edu_str).strip().lower()
    for keyword, level in EDU_LEVEL.items():
        if keyword in s:
            return level
    return 0


# ─── 地域匹配辅助 ─────────────────────────────────────────────────────

# 主要城市 → 省级映射（用于"同省"判断）
CITY_PROVINCE = {
    '北京': '北京', '上海': '上海', '广州': '广东', '深圳': '广东',
    '杭州': '浙江', '宁波': '浙江', '温州': '浙江',
    '南京': '江苏', '苏州': '江苏', '无锡': '江苏', '常州': '江苏',
    '成都': '四川', '武汉': '湖北', '西安': '陕西', '长沙': '湖南',
    '重庆': '重庆', '天津': '天津', '青岛': '山东', '济南': '山东',
    '郑州': '河南', '合肥': '安徽', '福州': '福建', '厦门': '福建',
    '大连': '辽宁', '沈阳': '辽宁', '哈尔滨': '黑龙江', '长春': '吉林',
    '昆明': '云南', '南宁': '广西', '贵阳': '贵州', '南昌': '江西',
    '石家庄': '河北', '太原': '山西', '兰州': '甘肃', '海口': '海南',
    '乌鲁木齐': '新疆', '呼和浩特': '内蒙古', '银川': '宁夏', '西宁': '青海',
    '拉萨': '西藏',
}

def parse_city(city_str: str) -> str:
    """从城市字符串中提取标准城市名"""
    if not city_str:
        return ''
    s = str(city_str).strip()
    # 移除"市"、"区"等后缀，取前2-3字
    for city in CITY_PROVINCE:
        if city in s:
            return city
    # 兜底：取前两个字
    return s[:2] if len(s) >= 2 else s


def get_province(city: str) -> str:
    """获取城市所属省份"""
    return CITY_PROVINCE.get(city, '')


# ─── 五维度匹配算法（区分度优化版）───────────────────────────────────
#
# 设计原则:
#   1. 保底线 FLOOR=20  — 每维度最低 20 分，避免"不匹配=0分"的极端惩罚
#   2. 天花板 CEIL=92   — 每维度最高 92 分，即使完美匹配也留 8 分区分空间
#   3. 区间内梯度打分   — 落在要求区间内不直接给满分，按偏离中点程度给 85~92
#   4. 区间外平滑衰减   — 高斯衰减到保底线，不会骤降到 0
#   5. 匹配质量分级     — 直接匹配(1.0) > 同义词匹配(0.9) > 邻近技能(0.45)
#
# 最终各维度分数范围: 20 ~ 92，总分范围约 20 ~ 92，有充足区分度

FLOOR = 20   # 每维度保底线
CEIL  = 92   # 每维度天花板


def calc_skill_match_weighted(
    job_skills_str: str,
    seeker_skills_str: str,
    idf_weights: Optional[Dict[str, float]] = None,
) -> int:
    """
    技能匹配度（TF-IDF 加权 + 匹配质量分级 + 保底机制）

    匹配质量分级:
        - 直接匹配:  权重 1.0（技能名完全一致）
        - 同义词匹配: 权重 0.9（如 "Python3"↔"Python"）
        - 邻近技能:  权重 0.45（如 JD要K8s，求职者有Docker）
        - 无匹配:    权重 0

    最终分数 = FLOOR + raw_ratio × (CEIL - FLOOR)，范围 20~92
    """
    from services.skill_synonyms import is_synonym, best_match_in_profile, has_adjacent_skill

    job_skills = [s.strip() for s in (job_skills_str or '').split(',') if s.strip()]
    seek_skills = [s.strip() for s in (seeker_skills_str or '').split(',') if s.strip()]

    # 岗位无技能要求 → 给 CEIL（不是 100），留区分空间
    if not job_skills:
        return CEIL

    # 求职者无技能 → 保底线（不是 0）
    if not seek_skills:
        return FLOOR

    # 区分直接匹配和同义词匹配
    seek_set_lower = {s.lower() for s in seek_skills}

    # 核心技能分界点（前 1/3 为核心）
    core_threshold = max(len(job_skills) // 3, 1)

    total_weight = 0.0
    matched_weight = 0.0

    for idx, jd_skill in enumerate(job_skills):
        s_lower = jd_skill.lower()

        # IDF 权重（默认 1.0）
        idf = 1.0
        if idf_weights and s_lower in idf_weights:
            idf = idf_weights[s_lower]

        # 核心技能增益
        core_bonus = 1.5 if idx < core_threshold else 1.0
        weight = idf * core_bonus
        total_weight += weight

        # 匹配质量分级
        if s_lower in seek_set_lower:
            # 直接匹配 → 1.0
            matched_weight += weight * 1.0
        else:
            matched = best_match_in_profile(jd_skill, seek_skills)
            if matched:
                # 同义词匹配 → 0.9
                matched_weight += weight * 0.9
            elif has_adjacent_skill(jd_skill, seek_skills):
                # 邻近技能 → 0.45
                matched_weight += weight * 0.45

    if total_weight == 0:
        return FLOOR

    # 原始匹配率 0~1 → 映射到 FLOOR~CEIL 区间
    raw_ratio = matched_weight / total_weight
    score = FLOOR + raw_ratio * (CEIL - FLOOR)
    return int(min(max(score, FLOOR), CEIL))


def calc_exp_match_gaussian(job_exp_str: str, seeker_exp_str: str) -> int:
    """
    经验匹配度（区间内梯度 + 区间外高斯衰减到保底）

    区间内:
        - 正好在区间中点 → 92（CEIL）
        - 在区间边缘     → 85
        （不再统一给 100，区间内也有区分度）

    区间外:
        - 高斯衰减，从 85 平滑降到 FLOOR(20)
        - 低于下限衰减更快（能力不足是硬伤）
        - 高于上限衰减更缓（overqualified 不是大问题）

    无法解析: 50（中性分）
    """
    lo, hi = parse_exp_range(job_exp_str)
    years = parse_years(seeker_exp_str)

    if (lo is None and hi is None) or years is None:
        return 50

    # 区间内峰值分数（不再直接 100）
    PEAK = CEIL       # 92 — 正好在区间中点
    EDGE = 85         # 区间边缘
    # 区间外衰减起点
    OUTER_START = 85  # 刚出区间边缘时的分数

    # 只有下限（"5年+"）
    if hi is None:
        if years >= lo:
            # 超过下限：lo 处给 EDGE(85)，远超给 PEAK(92)
            if lo == 0:
                return PEAK
            excess_ratio = min((years - lo) / max(lo, 1), 1.0)
            return int(EDGE + excess_ratio * (PEAK - EDGE))
        # 低于下限：高斯衰减到 FLOOR
        sigma = max(lo / 2, 1)
        d = lo - years
        raw = math.exp(-(d * d) / (2 * sigma * sigma))
        return int(FLOOR + raw * (OUTER_START - FLOOR))

    # 区间内：梯度打分
    if lo <= years <= hi:
        if hi == lo:
            return PEAK  # 单值要求，刚好满足
        mid = (lo + hi) / 2
        half_range = (hi - lo) / 2
        # 偏离中点的比例 0(中点)~1(边缘)
        offset_ratio = abs(years - mid) / half_range
        return int(PEAK - offset_ratio * (PEAK - EDGE))

    # 低于下限：高斯衰减到 FLOOR
    if years < lo:
        sigma = max(lo / 2, 1)
        d = lo - years
        raw = math.exp(-(d * d) / (2 * sigma * sigma))
        return int(FLOOR + raw * (OUTER_START - FLOOR))

    # 高于上限：衰减更缓
    sigma = max((hi - lo) / 2, 1) if hi > lo else 2
    d = years - hi
    raw = math.exp(-(d * d) / (2 * sigma * sigma))
    return int(FLOOR + raw * (OUTER_START - FLOOR))


def calc_edu_match(job_edu_str: str, seeker_edu_str: str) -> int:
    """
    学历匹配度（等级映射 + 梯度打分 + 保底）

    - 刚好满足要求 → 88（不是 100，留区分空间）
    - 高一级       → 92
    - 高两级+      → 92（不再加分，overqualified 不额外奖励）
    - 低于一级     → 65
    - 低于两级     → 40
    - 低于三级+    → 20（保底线）
    - JD 无要求    → 75
    - 求职者未知   → 50
    """
    req_level = parse_edu_level(job_edu_str)
    user_level = parse_edu_level(seeker_edu_str)

    # JD 无学历要求
    if req_level <= 0:
        return 75
    # 求职者学历未知
    if user_level <= 0:
        return 50

    # 满足或超出要求
    if user_level >= req_level:
        diff = user_level - req_level
        if diff == 0:
            return 88  # 刚好满足
        elif diff == 1:
            return 92  # 高一级
        else:
            return 92  # 高两级以上不再额外加分

    # 低于要求：梯度递减，保底 FLOOR
    diff = req_level - user_level
    score = 88 - diff * 23  # 差1级→65, 差2级→42, 差3级→19→保底20
    return max(FLOOR, int(score))


def calc_location_match(job_location: str, seeker_target_city: str, seeker_city: str) -> int:
    """
    地域匹配度（层级匹配 + 保底）

    - 同城       → 90（不是 100）
    - 同省不同城 → 72
    - 远程/不限  → 75
    - 信息缺失   → 55
    - 不同省     → 25（保底不是 0，保留可能性）
    """
    remote_keywords = ['远程', 'remote', '不限', '全国', 'anywhere']
    job_remote = any(kw in (job_location or '').lower() for kw in remote_keywords)
    seeker_remote = any(kw in (s or '').lower() for s in [seeker_target_city, seeker_city] for kw in remote_keywords)

    if job_remote or seeker_remote:
        return 75

    job_city = parse_city(job_location or '')
    seeker_city_parsed = parse_city(seeker_target_city or '') or parse_city(seeker_city or '')

    if not job_city or not seeker_city_parsed:
        return 55  # 信息缺失，给中性偏低分

    if job_city == seeker_city_parsed:
        return 90  # 同城（不是 100）

    # 同省判断
    job_prov = get_province(job_city)
    seeker_prov = get_province(seeker_city_parsed)
    if job_prov and seeker_prov and job_prov == seeker_prov:
        return 72  # 同省不同城

    return 25  # 不同省（保底不是 0）


def calc_salary_match(job_salary_str: str, job_min: Optional[int], job_max: Optional[int],
                      seeker_salary_str: str) -> int:
    """
    薪资匹配度（双向覆盖率 + 高斯衰减 + 保底）

    算法:
        - 有重叠: 用双向覆盖率（overlap / min(job_range, seeker_range)）
          比IoU更合理：求职者期望区间完全被岗位覆盖 → 92分
        - 无重叠: 从50分高斯衰减到FLOOR(20)，确保不高于有重叠的情况
        - 无法解析: 55

    连续性保证: overlap→0+ 时覆盖率→0，分数→50；gap→0 时高斯→1.0，分数→50
    """
    j_min, j_max = (job_min, job_max) if job_min and job_max else parse_salary_k(job_salary_str)
    s_min, s_max = parse_salary_k(seeker_salary_str)

    if not j_min or not j_max or not s_min or not s_max:
        return 55

    SALARY_FLOOR = 50  # 有重叠的最低分（overlap→0时）
    overlap = min(j_max, s_max) - max(j_min, s_min)

    if overlap > 0:
        # 双向覆盖率：重叠区占较小区间的比例
        job_range = j_max - j_min
        seeker_range = s_max - s_min
        min_range = min(job_range, seeker_range) or 1
        coverage = overlap / min_range
        # coverage=1（小区间完全在大区间内）→ CEIL(92)
        # coverage→0（勉强重叠）→ SALARY_FLOOR(50)
        score = SALARY_FLOOR + coverage * (CEIL - SALARY_FLOOR)
        return int(min(max(score, FLOOR), CEIL))

    # 无重叠：从 SALARY_FLOOR(50) 高斯衰减到 FLOOR(20)
    gap = max(j_min, s_min) - min(j_max, s_max)
    sigma = 10  # 10K 标准差
    raw = math.exp(-(gap * gap) / (2 * sigma * sigma))
    return int(FLOOR + raw * (SALARY_FLOOR - FLOOR))


# ─── TF-IDF 权重计算 ─────────────────────────────────────────────────

def compute_idf_weights(jobs: List[Job]) -> Dict[str, float]:
    """
    计算所有技能的 IDF 权重

    公式: idf(skill) = log(1 + N / (1 + df(skill)))
    其中 N = 岗位总数，df = 包含该技能的岗位数

    稀有技能（少数岗位要求）→ 高 IDF → 匹配时得分更高
    常见技能（所有岗位都要求）→ 低 IDF → 匹配时得分较低

    这是信息检索领域的经典算法，确保稀有技能的匹配价值被正确体现
    """
    if not jobs:
        return {}

    N = len(jobs)
    skill_doc_freq = Counter()  # 每个技能出现在多少个岗位中

    for job in jobs:
        job_skills = set(parse_skills(job.skills_required or ''))
        for skill in job_skills:
            skill_doc_freq[skill] += 1

    idf_weights = {}
    for skill, df in skill_doc_freq.items():
        idf_weights[skill] = math.log(1 + N / (1 + df))

    return idf_weights


# ─── 加权汇总 ────────────────────────────────────────────────────────

# 五维度权重 — 技能最重要，经验/学历/地域次之，薪资最后
WEIGHTS = {
    'skill': 0.40,       # 技能匹配（TF-IDF 加权，含核心技能增益）
    'exp': 0.20,         # 经验匹配（高斯衰减）
    'edu': 0.15,         # 学历匹配（等级映射）
    'location': 0.15,    # 地域匹配（层级匹配）
    'salary': 0.10,      # 薪资匹配（IoU）
}


def calc_total_score(skill: int, exp: int, edu: int, location: int, salary: int) -> int:
    """加权汇总五维度分数，返回 0-100"""
    return int(
        skill * WEIGHTS['skill']
        + exp * WEIGHTS['exp']
        + edu * WEIGHTS['edu']
        + location * WEIGHTS['location']
        + salary * WEIGHTS['salary']
    )


def has_skill_overlap(job_skills_str: str, seeker_skills_str: str) -> bool:
    """
    判断岗位要求技能与求职者技能是否有交集（含同义词）。
    用作匹配引擎的门槛：无任何技能交集的岗位-求职者对不创建匹配记录。
    """
    from services.skill_synonyms import is_synonym

    # parse_skills 返回 list，需转 set 才能用 & 求交集
    job_set = set(parse_skills(job_skills_str))
    seek_set = set(parse_skills(seeker_skills_str))
    if not job_set:
        return True  # 无门槛岗位允许所有人匹配

    # 先检查直接交集
    if job_set & seek_set:
        return True

    # 再检查同义词交集
    for j in job_set:
        for s in seek_set:
            if is_synonym(j, s):
                return True

    return False


def match_one(job: Job, seeker: Jobseeker, idf_weights: Optional[Dict[str, float]] = None) -> dict:
    """
    对单个 岗位-求职者 计算五维度匹配分数

    参数:
        job: 岗位 ORM 对象
        seeker: 求职者 ORM 对象
        idf_weights: 技能 IDF 权重表（由 compute_idf_weights 预计算）
    """
    skill = calc_skill_match_weighted(job.skills_required, seeker.skills, idf_weights)
    exp = calc_exp_match_gaussian(job.experience, seeker.experience)
    edu = calc_edu_match(job.education, seeker.education)
    location = calc_location_match(job.location, seeker.target_city, seeker.city)
    salary = calc_salary_match(job.salary_range, job.salary_min, job.salary_max, seeker.expected_salary)
    total = calc_total_score(skill, exp, edu, location, salary)
    return {
        'match_score': total,
        'skill_match': skill,
        'exp_match': exp,
        'edu_match': edu,
        'location_match': location,
        'salary_match': salary,
    }


# ─── 批量计算：写入 match_records 表 ──────────────────────────────────

def run_match_batch(job_id: Optional[int] = None) -> dict:
    """
    批量执行匹配，将分数 upsert 到 match_records 表。
    - job_id 为 None: 遍历所有 active 岗位 × 所有求职者
    - job_id 指定: 仅算该岗位

    匹配门槛：岗位要求技能与求职者技能必须有交集（含同义词），否则跳过。
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

        # 预计算 IDF 权重（TF-IDF 算法核心步骤）
        idf_weights = compute_idf_weights(jobs)

        # 拉取所有求职者
        seekers = session.query(Jobseeker).all()

        # 清理旧的 pending 记录（保留已处理的 accepted/rejected）
        del_q = session.query(MatchRecord).filter(MatchRecord.status == 'pending')
        if job_id:
            del_q = del_q.filter(MatchRecord.job_id == job_id)
        deleted_count = del_q.delete(synchronize_session=False)

        updated = 0
        skipped = 0
        sample = None

        for job in jobs:
            for seeker in seekers:
                # 门槛检查：技能无交集（含同义词）则跳过
                if not has_skill_overlap(job.skills_required, seeker.skills):
                    skipped += 1
                    continue

                scores = match_one(job, seeker, idf_weights)

                # upsert: 已有记录则更新分数，否则新增
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
                    mr.edu_match = scores['edu_match']
                    mr.location_match = scores['location_match']
                else:
                    mr = MatchRecord(
                        job_id=job.id,
                        jobseeker_id=seeker.id,
                        match_score=scores['match_score'],
                        skill_match=scores['skill_match'],
                        exp_match=scores['exp_match'],
                        salary_match=scores['salary_match'],
                        edu_match=scores['edu_match'],
                        location_match=scores['location_match'],
                        status='pending',
                    )
                    session.add(mr)
                updated += 1

                if sample is None:
                    sample = {
                        'job_title': job.title,
                        'seeker_name': seeker.real_name or seeker.username,
                        'skill': scores['skill_match'],
                        'exp': scores['exp_match'],
                        'edu': scores['edu_match'],
                        'location': scores['location_match'],
                        'salary': scores['salary_match'],
                        'total': scores['match_score'],
                    }

        session.commit()
        return {
            'total_jobs': len(jobs),
            'total_seekers': len(seekers),
            'total_matches': updated,
            'updated': updated,
            'skipped': skipped,
            'cleaned': deleted_count,
            'sample': sample,
            'dimensions': 5,  # 标记当前使用五维度算法
            'algorithm': 'TF-IDF + Gaussian + IoU + Level Mapping',
        }
    except Exception as e:
        session.rollback()
        raise
    finally:
        session.close()


# ─── CLI: python -m match_engine ──────────────────────────────────────

if __name__ == '__main__':
    print('开始五维度批量匹配...')
    result = run_match_batch()
    print(f"\n===== 匹配完成（{result.get('algorithm', 'unknown')}）=====")
    print(f"  岗位数:     {result['total_jobs']}")
    print(f"  求职者数:   {result['total_seekers']}")
    print(f"  匹配记录数: {result['total_matches']}")
    print(f"  被门槛过滤: {result['skipped']}")
    if result['sample']:
        s = result['sample']
        print(f"\n  样本: {s['job_title']} ↔ {s['seeker_name']}")
        print(f"        技能 {s['skill']} | 经验 {s['exp']} | 学历 {s['edu']} | 地域 {s['location']} | 薪资 {s['salary']} → 总分 {s['total']}")
    print(f"\n  权重: 技能{WEIGHTS['skill']} 经验{WEIGHTS['exp']} 学历{WEIGHTS['edu']} 地域{WEIGHTS['location']} 薪资{WEIGHTS['salary']}")
