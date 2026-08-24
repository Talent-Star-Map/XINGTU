"""
岗位-候选人匹配引擎 — 基于能力图谱的五维度匹配（2026-08 v3 全面优化版）

输入: Job (岗位) + Jobseeker (求职者)
输出: {match_score, skill_match, exp_match, edu_match, location_match, salary_match}

五维度算法:
    ① 技能匹配 (默认权重 0.40) — TF-IDF 加权 + 四级匹配分档 + 核心技能增益
    ② 经验匹配 (默认权重 0.20) — 高斯衰减（落在区间内满分，偏离区间平滑衰减）
    ③ 学历匹配 (默认权重 0.15) — 学历等级映射（博士>硕士>本科>大专>高中）
    ④ 地域匹配 (默认权重 0.15) — 城市层级匹配（同城>同省>不限>异地）
    ⑤ 薪资匹配 (默认权重 0.10) — 双向覆盖率 + 高斯衰减

三阶段流水线（run_match_batch）:
    阶段① 全量计算 — 五维度评分 + 严格化调整项（5 种），技能门槛过滤
    阶段② 池内归一化 — 同岗位候选人池内 z-score/tanh 相对排位微调（±6分）
    阶段③ 落库 — upsert match_records（pending 清理重建，accepted/rejected 保留状态）

反馈闭环（calibrate_weights_from_feedback）:
    从 HR 的 accept/reject 历史学习五维权重（维度区分度法），
    样本充足时自动上调高区分度维度的权重。进程内生效，重启回默认。

最终分数 = clamp(加权总分 + 调整项 + 池内微调, 15, 95)

算法理论依据:
    - TF-IDF (Term Frequency-Inverse Document Frequency): 稀有技能匹配价值更高
    - Gaussian Decay: 经验/薪资偏差用高斯函数平滑衰减，避免硬截断
    - Coverage Ratio: 薪资区间双向覆盖率（较小区间被覆盖的比例）
    - Multi-Criteria Decision Making (MCDM): 多准则加权决策
    - Z-score + tanh: 池内相对定位的有界归一化
    - Discriminative Gap Method: 反馈数据驱动的权重校准

运行模式:
    - 批量计算: run_match_batch()  遍历所有 active 岗位 × 所有求职者，upsert match_records
    - 单岗位计算: run_match_batch(job_id)  只算某个岗位
    - 权重校准: calibrate_weights_from_feedback()  从 HR 反馈学习权重

详细算法文档: docs/匹配算法说明.md

@owner: 张东阳（人岗匹配+企业端人才星界面）
"""

import re
import math
import statistics
from typing import List, Optional, Tuple, Dict
from collections import Counter

from database import get_session, Job, Jobseeker, MatchRecord


# ─── 工具函数：解析字符串中的数字 ───────────────────────────────────────

def split_skills(skills_str: str) -> List[str]:
    """
    把技能字符串按多种分隔符切分成列表。
    支持: 英文逗号 / 中文逗号 / 顿号 / 分号（中英）/ 斜杠 / 竖线
    """
    if not skills_str:
        return []
    return [s.strip() for s in re.split(r'[,，、;；/|｜]+', str(skills_str)) if s.strip()]


def parse_skills(skills_str: str) -> List[str]:
    """把技能字符串解析成技能列表（去空白、转小写、去重）"""
    return list({s.lower() for s in split_skills(skills_str)})


# 中文数字映射（解析"三年以上"这类经验描述用）
_CN_NUM = {'零': 0, '一': 1, '二': 2, '两': 2, '三': 3, '四': 4, '五': 5,
           '六': 6, '七': 7, '八': 8, '九': 9, '十': 10}


def _normalize_num_text(s: str) -> str:
    """把字符串里的中文数字替换成阿拉伯数字，便于后续正则提取（如 三年以上 → 3年以上）"""
    return ''.join(str(_CN_NUM[ch]) if ch in _CN_NUM else ch for ch in s)


def _normalize_range_text(s: str) -> str:
    """统一区间分隔符：全角波浪线/破折号/至 → 半角连字符（３－５年 → 3-5年）"""
    return s.replace('～', '-').replace('—', '-').replace('–', '-').replace('至', '-')


def parse_years(exp_str: str) -> Optional[float]:
    """
    从经验字符串中提取年数。
    支持: "4年" / "3-5年" / "5年+" / "5年以上" / "三年" / "应届"
    返回: 单值返回该值；区间返回下限；应届返回 0；无法解析返回 None
    """
    if not exp_str:
        return None
    s = _normalize_range_text(_normalize_num_text(str(exp_str)))
    if '应届' in s or '在校' in s:
        return 0.0
    nums = re.findall(r'(\d+(?:\.\d+)?)', s)
    if not nums:
        return None
    return float(nums[0])


def parse_exp_range(exp_str: str) -> Tuple[Optional[float], Optional[float]]:
    """
    解析经验要求区间，如 "3-5年" → (3.0, 5.0)；"5年+" → (5.0, None)；"应届" → (0.0, 1.0)
    返回 (下限, 上限)，None 表示无界
    """
    if not exp_str:
        return None, None
    s = _normalize_range_text(_normalize_num_text(str(exp_str)))
    if '应届' in s or '在校' in s:
        return 0.0, 1.0
    nums = re.findall(r'(\d+(?:\.\d+)?)', s)
    if not nums:
        return None, None
    if '+' in s or '以上' in s:
        return float(nums[0]), None
    if '-' in s or len(nums) >= 2:
        return float(nums[0]), float(nums[1]) if len(nums) >= 2 else None
    return 0.0, float(nums[0])


def parse_salary_k(salary_str: str) -> Tuple[Optional[int], Optional[int]]:
    """
    解析薪资字符串，返回 (min_K, max_K) 单位 K（千/月）。
    支持: "30K-50K" / "30k-50k" / "2万-3万" / "1.5万-2.5万" / "20K以上" / "面议"→(None,None)
    单位规则: 含"万"的数值 ×10 换算成 K；无数值单位默认按 K 处理
    """
    if not salary_str or '面议' in salary_str:
        return None, None
    s = _normalize_range_text(str(salary_str))
    wan = '万' in s  # 含"万"则整体按万换算
    nums = re.findall(r'(\d+(?:\.\d+)?)', s)
    if not nums:
        return None, None
    vals = [int(round(float(n) * (10 if wan else 1))) for n in nums]
    if len(vals) >= 2:
        return vals[0], vals[1]
    return vals[0], None


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

# 总分边界（调整后）— 拉宽区间提升区分度
TOTAL_FLOOR = 15   # 严重不匹配的最低分
TOTAL_CEIL  = 95   # 完美匹配的最高分


# 已知易混淆的包含对 — 子串成立但语义不同的技能（黑名单防误判）
_CONFUSABLE_CONTAINMENT = {('java', 'javascript'), ('javascript', 'java')}


def _containment_match(jd_skill_lower: str, seek_set_lower: set) -> bool:
    """
    子串包含匹配（L3 级部分匹配）:
        JD 技能是求职者技能的子串（或反之），如 "pytorch" ⊂ "pytorch框架"。

    防误判规则:
        - 较短一方长度 ≥ 4（排除 "js"⊂"json" 这类短词误判）
        - 黑名单对（java ⊄ javascript，语义不同不算匹配）
    """
    if len(jd_skill_lower) < 4:
        return False
    for s in seek_set_lower:
        if len(s) < 4:
            continue
        if (jd_skill_lower, s) in _CONFUSABLE_CONTAINMENT or (s, jd_skill_lower) in _CONFUSABLE_CONTAINMENT:
            continue
        if jd_skill_lower in s or s in jd_skill_lower:
            return True
    return False


def calc_skill_match_weighted(
    job_skills_str: str,
    seeker_skills_str: str,
    idf_weights: Optional[Dict[str, float]] = None,
) -> int:
    """
    技能匹配度（TF-IDF 加权 + 匹配质量分级 + 保底机制）

    匹配质量四级分档:
        - L1 直接匹配:    权重 1.0（技能名完全一致）
        - L2 同义词匹配:  权重 0.9（如 "Python3"↔"Python"，查 skill_synonyms.SYNONYM_MAP）
        - L3 子串包含:    权重 0.7（如 "pytorch" ⊂ "pytorch框架"，≥4字符防误判）
        - L4 邻近技能:    权重 0.45（如 JD要K8s，求职者有Docker，查 ADJACENT_SKILLS）
        - 无匹配:        权重 0

    最终分数 = FLOOR + raw_ratio × (CEIL - FLOOR)，范围 20~92
    """
    detail = calc_skill_match_detailed(job_skills_str, seeker_skills_str, idf_weights)
    return detail['score']


def calc_skill_match_detailed(
    job_skills_str: str,
    seeker_skills_str: str,
    idf_weights: Optional[Dict[str, float]] = None,
) -> dict:
    """
    技能匹配详细分析（增强版）— 返回分数 + 核心技能缺失数 + 匹配率

    供 calc_adjustments() 使用，实现核心技能硬门槛等严格逻辑。

    返回:
        {
          'score': int,               # 技能匹配分（20~92）
          'core_miss_count': int,     # 核心技能缺失数
          'match_ratio': float,       # 原始匹配率（0~1）
          'seeker_skill_count': int,  # 求职者技能总数
          'job_skill_count': int,     # 岗位要求技能总数
        }
    """
    from services.skill_synonyms import is_synonym, best_match_in_profile, has_adjacent_skill

    job_skills = [s.strip() for s in (job_skills_str or '').split(',') if s.strip()]
    seek_skills = [s.strip() for s in (seeker_skills_str or '').split(',') if s.strip()]

    # 岗位无技能要求 → 给 CEIL（不是 100），留区分空间
    if not job_skills:
        return {'score': CEIL, 'core_miss_count': 0, 'match_ratio': 1.0,
                'seeker_skill_count': len(seek_skills), 'job_skill_count': 0}

    # 求职者无技能 → 保底线（不是 0）
    if not seek_skills:
        return {'score': FLOOR, 'core_miss_count': len(job_skills), 'match_ratio': 0.0,
                'seeker_skill_count': 0, 'job_skill_count': len(job_skills)}

    seek_set_lower = {s.lower() for s in seek_skills}

    # 核心技能分界点（前 1/3 为核心）
    core_threshold = max(len(job_skills) // 3, 1)
    core_miss_count = 0  # 核心技能缺失计数（用于硬门槛惩罚）

    total_weight = 0.0
    matched_weight = 0.0

    for idx, jd_skill in enumerate(job_skills):
        s_lower = jd_skill.lower()

        # IDF 权重（默认 1.0）
        idf = 1.0
        if idf_weights and s_lower in idf_weights:
            idf = idf_weights[s_lower]

        # 核心技能增益（从 1.5 提升到 2.0，强化核心技能重要性）
        core_bonus = 2.0 if idx < core_threshold else 1.0
        weight = idf * core_bonus
        total_weight += weight

        # 匹配质量四级分档（严格递减，用于区分人才）
        if s_lower in seek_set_lower:
            # L1 直接匹配 → 1.0（技能名完全一致）
            matched_weight += weight * 1.0
        else:
            matched = best_match_in_profile(jd_skill, seek_skills)
            if matched:
                # L2 同义词匹配 → 0.9（如 "Python3"↔"Python"）
                matched_weight += weight * 0.9
            elif _containment_match(s_lower, seek_set_lower):
                # L3 子串包含匹配 → 0.7（如 "pytorch" ⊂ "pytorch框架"）
                matched_weight += weight * 0.7
            elif has_adjacent_skill(jd_skill, seek_skills):
                # L4 邻近技能 → 0.45（如 JD要K8s，求职者有Docker）
                matched_weight += weight * 0.45
            else:
                # 无匹配 — 核心技能缺失则计数（触发硬门槛惩罚）
                if idx < core_threshold:
                    core_miss_count += 1

    if total_weight == 0:
        return {'score': FLOOR, 'core_miss_count': core_miss_count, 'match_ratio': 0.0,
                'seeker_skill_count': len(seek_skills), 'job_skill_count': len(job_skills)}

    # 原始匹配率 0~1 → 映射到 FLOOR~CEIL 区间
    raw_ratio = matched_weight / total_weight
    score = FLOOR + raw_ratio * (CEIL - FLOOR)
    return {
        'score': int(min(max(score, FLOOR), CEIL)),
        'core_miss_count': core_miss_count,
        'match_ratio': raw_ratio,
        'seeker_skill_count': len(seek_skills),
        'job_skill_count': len(job_skills),
    }


def calc_exp_match_gaussian(job_exp_str: str, seeker_exp_str: str) -> int:
    """
    经验匹配度（区间内梯度 + 区间外高斯衰减到保底）— 严格版

    严格化改进（相比旧版）:
        - 低于下限衰减更快：sigma 从 lo/2 缩小到 lo/3，能力不足惩罚加重
        - 区间内梯度更陡：边缘从 85 降到 80，中点保持 92

    区间内:
        - 正好在区间中点 → 92（CEIL）
        - 在区间边缘     → 80（严格化，原来是85）

    区间外:
        - 高斯衰减，从 80 平滑降到 FLOOR(20)
        - 低于下限衰减更快（sigma=lo/3，能力不足是硬伤）
        - 高于上限衰减更缓（sigma=区间宽度/2，overqualified 不是大问题）

    无法解析: 50（中性分）
    """
    lo, hi = parse_exp_range(job_exp_str)
    years = parse_years(seeker_exp_str)

    if (lo is None and hi is None) or years is None:
        return 50

    # 区间内峰值分数
    PEAK = CEIL       # 92 — 正好在区间中点
    EDGE = 80         # 区间边缘（严格化，原 85）
    OUTER_START = 80  # 刚出区间边缘时的分数

    # 只有下限（"5年+"）
    if hi is None:
        if years >= lo:
            if lo == 0:
                return PEAK
            excess_ratio = min((years - lo) / max(lo, 1), 1.0)
            return int(EDGE + excess_ratio * (PEAK - EDGE))
        # 低于下限：高斯衰减到 FLOOR（sigma 缩小，衰减更快）
        sigma = max(lo / 3, 0.5)  # 严格化：lo/3（原 lo/2）
        d = lo - years
        raw = math.exp(-(d * d) / (2 * sigma * sigma))
        return int(FLOOR + raw * (OUTER_START - FLOOR))

    # 区间内：梯度打分
    if lo <= years <= hi:
        if hi == lo:
            return PEAK  # 单值要求，刚好满足
        mid = (lo + hi) / 2
        half_range = (hi - lo) / 2
        offset_ratio = abs(years - mid) / half_range
        return int(PEAK - offset_ratio * (PEAK - EDGE))

    # 低于下限：高斯衰减到 FLOOR（sigma 缩小，衰减更快）
    if years < lo:
        sigma = max(lo / 3, 0.5)  # 严格化：lo/3（原 lo/2）
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

# 五维度默认权重 — 技能最重要，经验/学历/地域次之，薪资最后
WEIGHTS = {
    'skill': 0.40,       # 技能匹配（TF-IDF 加权 + 四级分档 + 核心技能增益）
    'exp': 0.20,         # 经验匹配（高斯衰减）
    'edu': 0.15,         # 学历匹配（等级映射）
    'location': 0.15,    # 地域匹配（层级匹配）
    'salary': 0.10,      # 薪资匹配（双向覆盖率 + 高斯衰减）
}

# 当前生效权重（反馈闭环校准后会更新；进程内生效，服务重启回到默认 WEIGHTS）
_active_weights = dict(WEIGHTS)


def get_active_weights() -> Dict[str, float]:
    """获取当前生效的五维权重（默认 WEIGHTS，反馈校准后为学习值）"""
    return dict(_active_weights)


def set_active_weights(new_weights: Dict[str, float]) -> Dict[str, float]:
    """
    更新生效权重（供反馈闭环校准 / 外部校准 API 调用）。

    防御性处理:
        - 缺失维度 → 沿用当前值
        - 非法值（≤0 或无法转 float）→ 回退默认权重
        - 最终归一化到 Σw = 1，保证总分仍在 0-100 量纲
    """
    global _active_weights
    merged = {}
    for key in WEIGHTS:
        try:
            val = float(new_weights.get(key, _active_weights[key]))
        except (TypeError, ValueError):
            val = WEIGHTS[key]
        merged[key] = val if val > 0 else WEIGHTS[key]
    total = sum(merged.values()) or 1.0
    _active_weights = {k: round(v / total, 4) for k, v in merged.items()}
    return dict(_active_weights)


def calc_total_score(skill: int, exp: int, edu: int, location: int, salary: int) -> int:
    """加权汇总五维度分数（MCDM 多准则加权决策，使用当前生效权重），返回 0-100"""
    w = _active_weights
    return int(
        skill * w['skill']
        + exp * w['exp']
        + edu * w['edu']
        + location * w['location']
        + salary * w['salary']
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


def calc_adjustments(
    skill_detail: dict,
    exp_score: int,
    edu_score: int,
    location_score: int,
    salary_score: int,
    job: 'Job',
    seeker: 'Jobseeker',
) -> dict:
    """
    计算五维度之外的严格化调整项 — 实现多因素综合区分人才

    调整项（均可正可负，叠加到基础加权总分上）:
        1. core_skill_penalty  — 核心技能硬门槛：每个缺失核心技能扣 8 分
        2. ecosystem_bonus     — 技能生态链加分：高匹配率（>85%）且技能数充足，+5 分
        3. exp_skill_consistency — 经验-技能一致性：
           经验长但技能少（<3个）→ 可疑，扣 6 分
           经验短但技能多（>15个）→ 可能虚标，扣 4 分
        4. red_flag_penalty    — 红旗惩罚：任何维度 < 30 分，扣 10 分
        5. balance_bonus       — 均衡性加分：五维度标准差小（全面匹配），+3 分

    返回: {调整项名: 分值}，总分 = base_score + sum(调整项)
    """
    adjustments = {}

    # 1. 核心技能硬门槛惩罚
    core_miss = skill_detail.get('core_miss_count', 0)
    adjustments['core_skill_penalty'] = -core_miss * 8

    # 2. 技能生态链加分（高匹配率 + 技能数充足）
    match_ratio = skill_detail.get('match_ratio', 0)
    seeker_skill_count = skill_detail.get('seeker_skill_count', 0)
    if match_ratio > 0.85 and seeker_skill_count >= 5:
        adjustments['ecosystem_bonus'] = 5
    elif match_ratio > 0.7 and seeker_skill_count >= 3:
        adjustments['ecosystem_bonus'] = 2
    else:
        adjustments['ecosystem_bonus'] = 0

    # 3. 经验-技能一致性校验
    exp_years = parse_years(seeker.experience or '')
    if exp_years is not None:
        if exp_years >= 3 and seeker_skill_count < 3:
            # 经验长但技能少 — 简历可能注水或能力单一
            adjustments['exp_skill_consistency'] = -6
        elif exp_years < 1 and seeker_skill_count > 15:
            # 经验短但技能多 — 可能虚标
            adjustments['exp_skill_consistency'] = -4
        else:
            adjustments['exp_skill_consistency'] = 0
    else:
        adjustments['exp_skill_consistency'] = 0

    # 4. 红旗惩罚：任何维度严重不匹配（<30）
    dim_scores = [skill_detail['score'], exp_score, edu_score, location_score, salary_score]
    if min(dim_scores) < 30:
        adjustments['red_flag_penalty'] = -10
    else:
        adjustments['red_flag_penalty'] = 0

    # 5. 均衡性加分：五维度标准差小 → 全面匹配
    import statistics
    if len(dim_scores) >= 2:
        stdev = statistics.stdev(dim_scores)
        # 标准差 < 8 说明各维度均衡，加分
        if stdev < 8:
            adjustments['balance_bonus'] = 3
        elif stdev < 15:
            adjustments['balance_bonus'] = 1
        else:
            adjustments['balance_bonus'] = 0
    else:
        adjustments['balance_bonus'] = 0

    return adjustments


# ─── 池内归一化（同岗位候选人池内相对定位微调）──────────────────────

POOL_ADJUST_MAX = 6   # 池内归一化单条记录最大调整幅度（±6 分）
POOL_MIN_SIZE = 3     # 候选人池最少人数（少于则不做归一化）


def apply_pool_normalization(score_dicts: List[dict]) -> Optional[dict]:
    """
    池内归一化 — z-score + tanh 压缩的相对位置微调（优化3）。

    动机:
        绝对分只反映"候选人 vs 岗位要求"，不反映"候选人在同一岗位
        候选人池中的相对排位"。同为 75 分，池内第一和池内垫底对 HR
        的意义完全不同。本步骤在绝对分之上叠加有界的相对位置信息。

    算法:
        1. 对同一岗位的候选人池，统计总分的 mean 和 stdev
        2. z = (score − mean) / stdev           （标准化，无界）
        3. adjust = tanh(z) × POOL_ADJUST_MAX   （tanh 压缩到 ±6 内）
        4. final = clamp(score + adjust, TOTAL_FLOOR, TOTAL_CEIL)

    为什么用 tanh 而非直接用 z 或 percentile:
        - 直接用 z: 无界，离群值（如一个 95 分吊打全池）会把他人分数
          压得极低，绝对意义失真
        - percentile: 只保留序关系，丢弃分差信息（第1名领先20分和领先
          2分得到的归一化结果一样）
        - tanh(z): 有界 + 平滑 + 保留分差信息，兼顾两者

    原地修改 score_dicts 中每个 dict 的 match_score，
    并附加 pool_z / pool_adjust 字段（前端展示与文档说明用）。

    返回池统计信息；池太小（<POOL_MIN_SIZE）或无区分度（stdev≈0）时
    不做调整，返回 None。
    """
    totals = [m['match_score'] for m in score_dicts]
    if len(totals) < POOL_MIN_SIZE:
        return None
    mean = statistics.mean(totals)
    stdev = statistics.stdev(totals)
    if stdev < 1e-6:
        return None  # 池内所有人同分，无区分度

    for m in score_dicts:
        z = (m['match_score'] - mean) / stdev
        adjust = math.tanh(z) * POOL_ADJUST_MAX
        m['pool_z'] = round(z, 2)
        m['pool_adjust'] = round(adjust, 1)
        m['match_score'] = int(min(max(m['match_score'] + adjust, TOTAL_FLOOR), TOTAL_CEIL))

    return {'pool_size': len(totals), 'mean': round(mean, 1), 'stdev': round(stdev, 2)}


# ─── 反馈闭环（accept/reject 数据驱动权重校准）──────────────────────

CALIB_MIN_SAMPLES = 6      # 每类反馈（accepted/rejected）的最少样本数
CALIB_LEARNING_RATE = 0.3  # 学习率 λ：控制单次校准的权重调整幅度


def calibrate_weights_from_feedback() -> dict:
    """
    反馈闭环 — 从 HR 的 accept/reject 历史数据学习五维权重（优化4）。

    原理（维度区分度法 Discriminative Gap Method）:
        若某维度真正影响 HR 的录用决策，那么 accepted 组在该维度的
        平均分应显著高于 rejected 组。分差 Δd 越大 → 该维度越有区分度
        → 权重上调；分差小（甚至为负）→ HR 决策不依赖它 → 权重下调。

    算法步骤:
        1. 取所有 status ∈ {accepted, rejected} 的 match_records
        2. 对每个维度 d 计算 Δd = mean(accepted_d) − mean(rejected_d)
        3. 归一化: Δnorm = Δd / max|Δ|（线性压缩到 [−1, 1]）
        4. 更新: w' = w × (1 + λ·Δnorm)，λ = 0.3（防小样本震荡）
        5. 裁剪 w' ≥ 0.01（防权重归零）并归一化 Σw' = 1
        6. 写入 _active_weights（进程内生效，重启回到默认）

    样本不足（accepted 或 rejected < 6 条）时不校准，返回当前权重。

    返回: {calibrated, weights, default_weights, gaps, samples, message}
    """
    dims = ['skill', 'exp', 'edu', 'location', 'salary']
    fields = {'skill': 'skill_match', 'exp': 'exp_match', 'edu': 'edu_match',
              'location': 'location_match', 'salary': 'salary_match'}

    session = get_session()
    try:
        records = session.query(MatchRecord).filter(
            MatchRecord.status.in_(['accepted', 'rejected'])
        ).all()
        accepted = [r for r in records if r.status == 'accepted']
        rejected = [r for r in records if r.status == 'rejected']

        # 样本不足时不校准 — 避免小样本噪声污染权重
        if len(accepted) < CALIB_MIN_SAMPLES or len(rejected) < CALIB_MIN_SAMPLES:
            return {
                'calibrated': False,
                'weights': dict(_active_weights),
                'default_weights': dict(WEIGHTS),
                'samples': {'accepted': len(accepted), 'rejected': len(rejected)},
                'message': f'反馈样本不足（两类各需 ≥{CALIB_MIN_SAMPLES} 条），保持当前权重',
            }

        # ① 每个维度的 accepted/rejected 均值分差（区分度）
        gaps = {}
        for d in dims:
            a = [getattr(r, fields[d]) for r in accepted if getattr(r, fields[d]) is not None]
            rj = [getattr(r, fields[d]) for r in rejected if getattr(r, fields[d]) is not None]
            gaps[d] = round(statistics.mean(a) - statistics.mean(rj), 2) if a and rj else 0.0

        # ② 分差归一化 + 乘法更新
        max_abs = max(abs(g) for g in gaps.values()) or 1.0
        new_weights = {
            d: _active_weights[d] * (1 + CALIB_LEARNING_RATE * (gaps[d] / max_abs))
            for d in dims
        }
        # ③ 防归零裁剪 + 归一化到和为 1
        new_weights = {d: max(w, 0.01) for d, w in new_weights.items()}
        total = sum(new_weights.values())
        new_weights = {d: round(w / total, 4) for d, w in new_weights.items()}

        applied = set_active_weights(new_weights)
        return {
            'calibrated': True,
            'weights': applied,
            'default_weights': dict(WEIGHTS),
            'gaps': gaps,
            'samples': {'accepted': len(accepted), 'rejected': len(rejected)},
            'message': '权重已根据 HR 反馈校准（维度区分度法），建议重新执行批量匹配',
        }
    finally:
        session.close()


def match_one(job: Job, seeker: Jobseeker, idf_weights: Optional[Dict[str, float]] = None) -> dict:
    """
    对单个 岗位-求职者 计算五维度匹配分数（增强版 — 含严格化调整项）

    流程:
        1. 五维度基础评分（TF-IDF + 高斯 + 等级 + 层级 + IoU）
        2. 计算调整项（核心技能硬门槛 + 生态链 + 一致性 + 红旗 + 均衡性）
        3. 最终分数 = clamp(基础分 + 调整项, TOTAL_FLOOR, TOTAL_CEIL)

    参数:
        job: 岗位 ORM 对象
        seeker: 求职者 ORM 对象
        idf_weights: 技能 IDF 权重表（由 compute_idf_weights 预计算）
    """
    # ── 五维度基础评分 ──
    skill_detail = calc_skill_match_detailed(job.skills_required, seeker.skills, idf_weights)
    skill = skill_detail['score']
    exp = calc_exp_match_gaussian(job.experience, seeker.experience)
    edu = calc_edu_match(job.education, seeker.education)
    location = calc_location_match(job.location, seeker.target_city, seeker.city)
    salary = calc_salary_match(job.salary_range, job.salary_min, job.salary_max, seeker.expected_salary)

    # ── 基础加权总分 ──
    base_score = calc_total_score(skill, exp, edu, location, salary)

    # ── 严格化调整项 ──
    adjustments = calc_adjustments(skill_detail, exp, edu, location, salary, job, seeker)
    adjustment_total = sum(adjustments.values())

    # ── 最终分数：基础分 + 调整项，限制在 [TOTAL_FLOOR, TOTAL_CEIL] ──
    final_score = int(min(max(base_score + adjustment_total, TOTAL_FLOOR), TOTAL_CEIL))

    return {
        'match_score': final_score,
        'skill_match': skill,
        'exp_match': exp,
        'edu_match': edu,
        'location_match': location,
        'salary_match': salary,
        'adjustments': adjustments,         # 调整项明细（调试/展示用）
        'base_score': base_score,           # 基础分（调整前）
        'adjustment_total': adjustment_total,  # 调整项合计
    }


# ─── 批量计算：写入 match_records 表 ──────────────────────────────────

def run_match_batch(job_id: Optional[int] = None, apply_pool_norm: bool = True) -> dict:
    """
    批量执行匹配（三阶段流水线），将分数 upsert 到 match_records 表。

    阶段① 全量计算: 遍历 岗位×求职者，五维度评分 + 严格化调整项
              （技能门槛过滤在本阶段：无交集的配对直接跳过）
    阶段② 池内归一化: 同岗位候选人池内 z-score/tanh 微调（增强池内区分度）
    阶段③ 落库: upsert match_records — pending 记录先清后写，
              accepted/rejected 记录保留状态、仅刷新分数

    参数:
        job_id: 指定则只算该岗位；None 算所有 active 岗位
        apply_pool_norm: 是否执行阶段②（默认开启）

    返回: {total_jobs, total_seekers, total_matches, updated, skipped,
           cleaned, pools_normalized, pool_stats, sample, dimensions, algorithm}
    """
    session = get_session()
    try:
        # 拉取岗位（仅 active）
        job_q = session.query(Job).filter(Job.status == 'active')
        if job_id:
            job_q = job_q.filter(Job.id == job_id)
        jobs = job_q.all()

        # 预计算 IDF 权重（TF-IDF 算法核心步骤：稀有技能价值更高）
        idf_weights = compute_idf_weights(jobs)

        # 拉取所有求职者
        seekers = session.query(Jobseeker).all()

        # 清理旧的 pending 记录（保留已处理的 accepted/rejected）
        del_q = session.query(MatchRecord).filter(MatchRecord.status == 'pending')
        if job_id:
            del_q = del_q.filter(MatchRecord.job_id == job_id)
        deleted_count = del_q.delete(synchronize_session=False)

        # ── 阶段① 全量计算：按岗位分池 ──
        pool_by_job: Dict[int, list] = {}   # job.id -> [(job, seeker, scores), ...]
        skipped = 0
        for job in jobs:
            for seeker in seekers:
                # 门槛检查：技能无交集（含同义词）则跳过，不产生匹配记录
                if not has_skill_overlap(job.skills_required, seeker.skills):
                    skipped += 1
                    continue
                scores = match_one(job, seeker, idf_weights)
                pool_by_job.setdefault(job.id, []).append((job, seeker, scores))

        # ── 阶段② 池内归一化（同岗位池内相对排位微调）──
        pools_normalized = 0
        pool_stats = []
        if apply_pool_norm:
            for pool in pool_by_job.values():
                info = apply_pool_normalization([scores for _, _, scores in pool])
                if info:
                    pools_normalized += 1
                    pool_stats.append(info)

        # ── 阶段③ upsert 落库 ──
        updated = 0
        sample = None
        for pool in pool_by_job.values():
            for job, seeker, scores in pool:
                # upsert: 已有记录则只更新分数（保留原 status），否则新增
                mr = session.query(MatchRecord).filter(
                    MatchRecord.job_id == job.id,
                    MatchRecord.jobseeker_id == seeker.id,
                ).first()

                if mr:
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
                        'base_score': scores.get('base_score'),
                        'adjustment_total': scores.get('adjustment_total'),
                        'adjustments': scores.get('adjustments'),
                        'pool_z': scores.get('pool_z'),
                        'pool_adjust': scores.get('pool_adjust'),
                    }

        session.commit()
        return {
            'total_jobs': len(jobs),
            'total_seekers': len(seekers),
            'total_matches': updated,
            'updated': updated,
            'skipped': skipped,
            'cleaned': deleted_count,
            'pools_normalized': pools_normalized,          # 实际做了归一化的岗位池数
            'pool_stats': pool_stats[:5],                   # 池统计样例（最多展示5个）
            'sample': sample,
            'dimensions': 5,  # 标记当前使用五维度算法
            'weights': dict(_active_weights),              # 本次计算使用的权重
            'algorithm': 'TF-IDF + Gaussian + Coverage + Level Mapping + Strict Adjustments + PoolNorm (v3)',
        }
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


# ─── CLI: python -m services.match_engine ────────────────────────────

if __name__ == '__main__':
    print('开始五维度批量匹配（v3：TF-IDF + 严格化调整 + 池内归一化）...')
    result = run_match_batch()
    print(f"\n===== 匹配完成（{result.get('algorithm', 'unknown')}）=====")
    print(f"  岗位数:     {result['total_jobs']}")
    print(f"  求职者数:   {result['total_seekers']}")
    print(f"  匹配记录数: {result['total_matches']}")
    print(f"  被门槛过滤: {result['skipped']}")
    print(f"  池内归一化: {result.get('pools_normalized', 0)} 个岗位池")
    if result['sample']:
        s = result['sample']
        print(f"\n  样本: {s['job_title']} ↔ {s['seeker_name']}")
        print(f"        技能 {s['skill']} | 经验 {s['exp']} | 学历 {s['edu']} | 地域 {s['location']} | 薪资 {s['salary']} → 总分 {s['total']}")
    print(f"\n  权重: 技能{result['weights']['skill']} 经验{result['weights']['exp']} 学历{result['weights']['edu']} 地域{result['weights']['location']} 薪资{result['weights']['salary']}")
