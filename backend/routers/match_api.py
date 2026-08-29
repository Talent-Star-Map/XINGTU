"""
人岗匹配 API —— 3 个路由

POST /api/match/analyze      ←→ 主分析入口（同步）
GET  /api/match/recommend    ←→ 推荐岗位（同步版，≤20 岗位）
                             ←→ TODO: 多岗位异步版 endpoint scaffold
DELETE /api/match/cache      ←→ 删除用户所有匹配缓存 + 简历缓存（建议 #8）

建议 #5：异步版 endpoint 预留 task_id / 轮询接口（TODO）

@owner: 我和吴家（新岗位发现+求职端趋势+企业端市场洞察）
"""

from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
import os, re, json, glob, hashlib
from collections import defaultdict

from database import get_session, get_user_model_by_role
# 跨模块引用：routers/services 已分目录
from routers.jobs import load_all_jobs, load_job_by_id
from services.match_analyzer import compute_match_score, extract_profile_features, SCORE_VERSION
from services.quality_checker import cross_validate

router = APIRouter(prefix='/api/match', tags=['match'])

# uploads 目录在 backend/ 根，不在 routers/，需向上跳一层
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), '..', 'uploads')
# match_cache 目录在 backend/ 根，需向上跳一层
MATCH_CACHE_DIR = os.path.join(os.path.dirname(__file__), '..', 'match_cache')
os.makedirs(MATCH_CACHE_DIR, exist_ok=True)

def _cleanup_old_cache():
    """启动时清理超过1小时的缓存文件"""
    import glob as _glob
    from datetime import datetime, timezone, timedelta
    cutoff = datetime.now(timezone.utc) - timedelta(hours=1)
    for f in _glob.glob(os.path.join(MATCH_CACHE_DIR, '*.json')):
        try:
            with open(f, 'r', encoding='utf-8') as fp:
                data = json.load(fp)
            created = data.get('created_at', '')
            if created:
                ct = datetime.fromisoformat(created)
                if ct.tzinfo is None:
                    ct = ct.replace(tzinfo=timezone.utc)
                if ct < cutoff:
                    os.remove(f)
        except Exception:
            pass

_cleanup_old_cache()


# ──────────────────────────────────────────────
# 请求/响应 schema
# ──────────────────────────────────────────────

class AnalyzeReq(BaseModel):
    job_id: int
    # 优先使用显式技能列表：直接是结构化的，不必对假文本跑一遍 LLM
    skills: list[str] = Field(default_factory=list)
    resume_text: Optional[str] = None
    use_profile_skills: bool = True
    use_parsed_resume_cache: bool = True


# ──────────────────────────────────────────────
# 主分析入口
# ──────────────────────────────────────────────

@router.post('/analyze')
def api_match_analyze(req: AnalyzeReq, token: str = Query(...)):
    # 1. 鉴权
    from database import verify_token
    try:
        payload = verify_token(token)
    except ValueError as e:
        raise HTTPException(401, str(e))

    user_id = payload['user_id']
    role = payload.get('role', 'jobseeker')

    # 2. 加载岗位（实时查库，不用启动期的静态快照）
    job = load_job_by_id(req.job_id)
    if not job:
        raise HTTPException(404, '岗位不存在')

    # 3. 加载用户（按 role 选表）
    Model = get_user_model_by_role(role)
    session = get_session()
    user = session.query(Model).filter(Model.id == user_id).first()
    session.close()
    if not user:
        raise HTTPException(404, '用户不存在')

    # 4. 构图 quality_context（交叉验证状态）
    all_jobs_for_validation = load_all_jobs()
    source_skills_map = defaultdict(list)
    for j in all_jobs_for_validation:
        source_skills_map[j['source']].extend(j.get('skills', []))
    skills_per_source = [(src, skills) for src, skills in source_skills_map.items()]
    quality_context = cross_validate(skills_per_source)

    # 5. 提取 profile_features（按优先级）
    #    显式技能列表 > 简历原文 > 简历解析缓存 > 个人资料技能字段
    profile = None
    cache_path = None

    # 5a. 前端直接传了技能列表 —— 结构化数据，无需再走 LLM 解析
    if req.skills and len(req.skills) > 0:
        profile = extract_profile_features(req.skills, "skill_list")
        profile["raw_source"] = "skill_list"

    # 5b. 传了真实简历文本
    if profile is None and req.resume_text and req.resume_text.strip():
        profile = extract_profile_features(req.resume_text, "resume_text")

    if profile is None:
        # 5c. 找最新解析缓存
        cache_files = sorted(
            glob.glob(os.path.join(UPLOAD_DIR, 'resumes', f'{user_id}_*.json')),
            key=os.path.getmtime,
            reverse=True,
        )
        if cache_files and req.use_parsed_resume_cache:
            cache_path = cache_files[0]
            try:
                with open(cache_path, 'r', encoding='utf-8') as f:
                    cache = json.load(f)
                skills = cache.get('skills', [])
                if skills:
                    profile = extract_profile_features(skills, "skill_list")
                    profile["raw_source"] = "resume_cache"
            except Exception:
                profile = None

        # 5c. fallback 到 profile.skills 字段
        if profile is None and req.use_profile_skills:
            user_skills = (user.skills or '').split(',') if user.skills else []
            user_skills = [s.strip() for s in user_skills if s.strip()]
            if user_skills:
                profile = extract_profile_features(user_skills, "skill_list")
                profile["raw_source"] = "profile_field"
                # 补全其他字段
                if user.education:
                    profile["education"] = user.education
                if user.expected_salary:
                    s = user.expected_salary
                    import re as _re
                    nums = _re.findall(r'\d+', s)
                    if len(nums) >= 2:
                        profile["salary_min"] = int(nums[0])
                        profile["salary_max"] = int(nums[1])

    # 6. 始终从数据库补全 education / salary / experience（确保用户填的数据被使用）
    if profile is not None:
        if not profile.get("education") and user.education:
            profile["education"] = user.education
        if not profile.get("salary_min") and user.expected_salary:
            import re as _re
            nums = _re.findall(r'\d+', str(user.expected_salary))
            if len(nums) >= 2:
                profile["salary_min"] = int(nums[0])
                profile["salary_max"] = int(nums[1])
        if not profile.get("experience_years") and user.experience:
            try:
                from services.match_analyzer import _parse_experience
                profile["experience_years"] = _parse_experience(user.experience)
            except: pass

    if profile is None:
        return {
            'success': False,
            'code': 'NO_PROFILE',
            'message': '无可用技能数据。请先在个人主页上传简历或在个人资料中填写技能字段',
            'data': {'has_profile': False},
        }

    # 6. 检查缓存（3 分钟有效）
    cache_key = f"{user_id}_{req.job_id}"
    match_cache_path = os.path.join(MATCH_CACHE_DIR, f"{cache_key}.json")
    cache_hit = False
    from datetime import datetime, timezone
    computed_at = datetime.now(timezone.utc).isoformat()

    try:
        if os.path.exists(match_cache_path):
            with open(match_cache_path, 'r', encoding='utf-8') as f:
                cached = json.load(f)
            cached_at = cached.get("created_at", "")
            # 检查是否在 3 分钟内
            if cached_at:
                cached_time = datetime.fromisoformat(cached_at)
                # 确保两个时间都有时区信息
                if cached_time.tzinfo is None:
                    cached_time = cached_time.replace(tzinfo=timezone.utc)
                now = datetime.now(timezone.utc)
                if (now - cached_time).total_seconds() < 180:  # 3 min
                    cached_result = cached.get("result", {})
                    cached_result["cache_hit"] = True
                    cached_result["computed_at"] = cached.get("created_at")
                    return {'success': True, 'data': cached_result}
    except Exception:
        pass

    # 7. 计算 match score（all_jobs 已在上方为 cross_validate 加载，直接复用，
    #    避免 _generate_recommendations 内部再回源 load_all_jobs() 白跑一次）
    result = compute_match_score(profile, job, quality_context, all_jobs=all_jobs_for_validation)
    result["has_profile"] = True
    result["cache_hit"] = False
    result["computed_at"] = computed_at

    # 8. 写入缓存
    try:
        with open(match_cache_path, 'w', encoding='utf-8') as f:
            json.dump({
                "created_at": computed_at,
                "result": result,
            }, f, ensure_ascii=False)
    except Exception:
        pass

    return {'success': True, 'data': result}


# ──────────────────────────────────────────────
# 推荐岗位
# ──────────────────────────────────────────────

class RecommendReq(BaseModel):
    n: int = Field(default=5, description='返回数量')
    skills: list[str] = []
    resume_text: str | None = None


@router.post('/recommend')
def api_match_recommend(
    req: RecommendReq,
    n: Optional[int] = Query(None, ge=1, le=50),
    token: str = Query(...),
):
    """推荐岗位 Top N（支持传入技能列表或 resume_text）

    n 兼容两种传法：query `?n=10`（前端在用）或 body `{"n": 10}`；
    都缺省时用 RecommendReq 的默认值。
    """
    from database import verify_token
    try:
        payload = verify_token(token)
    except ValueError as e:
        raise HTTPException(401, str(e))

    user_id = payload['user_id']
    role = payload.get('role', 'jobseeker')

    # 1. 优先使用请求中传入的技能列表（用户显式选择，最准确）
    profile = None

    if req.skills and len(req.skills) > 0:
        profile = extract_profile_features(req.skills, "skill_list")
        profile["raw_source"] = "manual_input"
    elif req.resume_text and req.resume_text.strip():
        profile = extract_profile_features(req.resume_text, "resume_text")

    # 2. fallback：用户已解析的简历缓存
    if profile is None:
        role_model = get_user_model_by_role(role)
        session = get_session()
        user = session.query(role_model).filter(role_model.id == user_id).first()
        session.close()

        import glob as _glob
        cache_files = sorted(
            _glob.glob(os.path.join(UPLOAD_DIR, 'resumes', f'{user_id}_*.json')),
            key=os.path.getmtime,
            reverse=True,
        )
        if cache_files:
            try:
                with open(cache_files[0], 'r', encoding='utf-8') as f:
                    cache = json.load(f)
                skills = cache.get('skills', [])
                if skills:
                    profile = extract_profile_features(skills, "skill_list")
                    profile["raw_source"] = "resume_cache"
            except Exception:
                pass

    # 3. fallback：profile.skills 字段
    if profile is None:
        import glob as _glob
        session = get_session()
        role_model = get_user_model_by_role(role)
        user = session.query(role_model).filter(role_model.id == user_id).first()
        session.close()
        if user and user.skills:
            skills = [s.strip() for s in user.skills.split(',') if s.strip()]
            if skills:
                profile = extract_profile_features(skills, "skill_list")
                profile["raw_source"] = "profile_field"

    if profile is None:
        return {'success': False, 'code': 'NO_PROFILE', 'data': [], 'message': '无可用技能数据'}

    # 结果缓存（5 分钟）：同一用户同一技能组合重复点击秒出。
    # 岗位池是实时查的，但 5 分钟内爬虫新岗位不会丢失太多，体验优先
    from datetime import datetime, timezone, timedelta
    cache_key = hashlib.md5(
        f"{user_id}:{','.join(sorted(s.lower() for s in profile.get('skills', [])))}".encode()
    ).hexdigest()
    rec_cache_path = os.path.join(MATCH_CACHE_DIR, f"rec_{cache_key}.json")
    try:
        if os.path.exists(rec_cache_path):
            with open(rec_cache_path, 'r', encoding='utf-8') as f:
                cached = json.load(f)
            if cached.get('created_at'):
                ct = datetime.fromisoformat(cached['created_at'])
                if ct.tzinfo is None:
                    ct = ct.replace(tzinfo=timezone.utc)
                if datetime.now(timezone.utc) - ct < timedelta(minutes=5):
                    return {'success': True, 'data': cached['data'],
                            'score_version': SCORE_VERSION, 'cache_hit': True}
    except Exception:
        pass

    # 实时读取岗位池：用启动期快照会导致爬虫新写入的岗位永远不会被推荐
    all_jobs = load_all_jobs()

    # 快速预筛选：只保留技能有重叠的岗位（避免全量计算）
    user_skills_lower = set(s.lower() for s in profile.get("skills", []) if s)
    candidate_jobs = []
    for job in all_jobs:
        job_skills = set(s.lower() for s in job.get("skills", []) if s)
        overlap = len(user_skills_lower & job_skills)
        if overlap >= 1:  # 至少1个技能重叠
            candidate_jobs.append((overlap, job))
    # 按重叠数降序，最多取50个详细计算
    candidate_jobs.sort(key=lambda x: x[0], reverse=True)
    candidate_jobs = [job for _, job in candidate_jobs[:50]]

    # 预计算技能频率：一次遍历全部岗位，统计每个技能出现次数
    from services.skill_synonyms import normalize_preprocess, is_synonym
    skill_popularity = {}
    total_jobs = len(all_jobs)
    for jd in all_jobs:
        for js in jd.get("skills", []):
            s_key = normalize_preprocess(js)
            if s_key:
                skill_popularity[s_key] = skill_popularity.get(s_key, 0) + 1
    # 转为比例
    for k in skill_popularity:
        skill_popularity[k] = round(skill_popularity[k] / max(total_jobs, 1), 3)

    # 详细计算匹配分数
    # ⚠️ 必须传 all_jobs：compute_match_score 内部 _generate_recommendations 会
    #    回源 load_all_jobs()，不传的话每个候选岗位都重复拉一次全量岗位池，
    #    50 个候选就是 50 次全表读取（实测 ~64s，智能匹配直接卡死）
    scores = []
    for job in candidate_jobs:
        result = compute_match_score(profile, job, {}, skill_popularity, all_jobs)
        have_skills = [s["skill"] for s in result["skills"]["have"]]
        miss_high = [s["skill"] for s in result["skills"]["miss"] if s.get("priority") == "high"]
        # 推荐理由：命中技能数 + 核心命中 + 主要缺口（前端轮播卡片直接展示）
        core_hit = sum(1 for s in result["skills"]["have"] if s.get("is_core"))
        reason = f"命中 {len(have_skills)}/{len(job.get('skills', []))} 项技能"
        if core_hit:
            reason += f"（含 {core_hit} 项核心）"
        if miss_high:
            reason += f"，缺口：{'、'.join(miss_high[:2])}"
        scores.append({
            "job_id": job["id"],
            "title": job["title"],
            "company": job["company"],
            "salary": job.get("salary", ""),
            "location": job.get("location", ""),
            "overall": result["overall"],
            "grade": result["grade"],
            "matched_count": len(result["skills"]["have"]),
            "matched_skills": have_skills[:5],
            "job_skill_count": len(job.get("skills", [])),
            "top_missing": miss_high[:3],
            "recommend_reason": reason,
        })

    scores.sort(key=lambda x: x["overall"], reverse=True)
    n = n or req.n
    # v2 推荐多样性：结果多于请求数时，同类岗位（标题主体相同，如多个"Java工程师"）
    # 每类最多保留 3 条，避免 Top10 全是同质岗位；不足时从被裁掉的池子里回填
    result_data = scores[:n]
    if len(scores) > n:
        def _cluster(title: str) -> str:
            base = re.split(r'[(（\[【/··]', str(title))[0].strip()
            return base[:4] if base else str(title)
        picked, dropped = [], []
        cluster_cnt: dict = defaultdict(int)
        cap = max(n // 3, 3)  # 每类上限：n=10 → 3，避免一类岗位刷屏
        for s in scores:
            c = _cluster(s['title'])
            if cluster_cnt[c] < cap:
                cluster_cnt[c] += 1
                picked.append(s)
            else:
                dropped.append(s)
        # 多样性优先，不足 n 条时按原排序从被裁池回填
        result_data = picked[:n]
        if len(result_data) < n:
            result_data += dropped[:n - len(result_data)]
    # 写缓存（失败不影响主流程）
    try:
        with open(rec_cache_path, 'w', encoding='utf-8') as f:
            json.dump({'created_at': datetime.now(timezone.utc).isoformat(), 'data': result_data},
                      f, ensure_ascii=False)
    except Exception:
        pass
    return {'success': True, 'data': result_data, 'score_version': SCORE_VERSION}


# ──────────────────────────────────────────────
# TODO: 异步推荐（建议 #5）
# ──────────────────────────────────────────────

# @router.post('/recommend/async')
# def api_recommend_async(req, token):
#     """多岗位异步分析——返回 task_id，前端轮询 /recommend/status/{task_id}"""
#     ...
#
# @router.get('/recommend/status/{task_id}')
# def api_recommend_status(task_id, token):
#     ...


# ──────────────────────────────────────────────
# 删除缓存（建议 #8 合规）
# ──────────────────────────────────────────────

@router.delete('/cache')
def api_clear_cache(token: str = Query(...)):
    from database import verify_token
    try:
        payload = verify_token(token)
    except ValueError as e:
        raise HTTPException(401, str(e))

    user_id = payload['user_id']
    deleted = []

    # 删除匹配缓存
    for f in glob.glob(os.path.join(MATCH_CACHE_DIR, f'{user_id}_*.json')):
        try:
            os.remove(f)
            deleted.append(os.path.basename(f))
        except Exception:
            pass

    # 删除简历缓存 + 原文件
    for f in glob.glob(os.path.join(UPLOAD_DIR, 'resumes', f'{user_id}_*')):
        try:
            os.remove(f)
            deleted.append(os.path.basename(f))
        except Exception:
            pass

    # 清理当前用户的 profile 技能/bio（按 role 选表）
    role = payload.get('role', 'jobseeker')
    Model = get_user_model_by_role(role)
    session = get_session()
    user = session.query(Model).filter(Model.id == user_id).first()
    if user:
        user.skills = ''
        user.bio = ''
    session.commit()
    session.close()

    return {
        'success': True,
        'message': f'已清理 {len(deleted)} 个缓存文件',
        'data': {'deleted_count': len(deleted)},
    }
