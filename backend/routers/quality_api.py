"""数据质量 API — 管理员鉴权 + 质检报告 + 准确率测试

@owner: 佳豪（幻觉防控质检）
"""
from fastapi import APIRouter, Query, Depends, HTTPException
# services 跨目录引用
from services.quality_checker import full_quality_report, cross_validate, detect_plagiarism, detect_inflation
from database import verify_token, get_session, CrawledJob
import json, os, tempfile


def _load_jobs():
    """从数据库加载岗位数据，用于质检报告"""
    expanded = os.path.join(os.path.dirname(__file__), '..', 'test_data', 'expanded_jobs.json')
    if os.path.exists(expanded):
        with open(expanded, 'r', encoding='utf-8') as f:
            return json.load(f)
    # 从数据库查询
    session = get_session()
    try:
        jobs = session.query(CrawledJob).filter(CrawledJob.data_type == 1).limit(50).all()
        return [{
            'id': j.id, 'title': j.title, 'company': j.company_name,
            'skills': j.skill_tags or [], 'source': j.source or 'unknown',
            'description': j.job_description or '',
        } for j in jobs]
    finally:
        session.close()

# ─── 管理员鉴权依赖 — 所有质检接口必须携带管理员 token 才能访问 ──────────────
def require_admin(token: str = Query(...)):
    """校验 query 参数中的 token 是否为管理员身份"""
    try:
        payload = verify_token(token)
    except ValueError as e:
        raise HTTPException(401, str(e))
    if payload.get('role') != 'admin':
        raise HTTPException(403, '需要管理员权限')
    return payload

# 路由级依赖：注册到此 router 的所有接口都自动应用 require_admin 鉴权
router = APIRouter(prefix='/api/quality', tags=['quality'], dependencies=[Depends(require_admin)])

TEST_DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'test_data')
os.makedirs(TEST_DATA_DIR, exist_ok=True)


def _load_db_source_skills():
    """从爬虫主表按来源聚合技能（真实数据驱动交叉验证）。

    对原始 skill_tags 做技能词典归一与噪声过滤：只有命中技能词典/同义词表的
    标签才参与统计，其余计入 noise_filtered（作为"数据噪声检测"的量化结果）。
    返回 ([(source, [canonical_skill])], noise_filtered_count)。
    """
    from collections import defaultdict
    from services.resume_parser import _JD_SKILLS
    from services.skill_synonyms import SYNONYM_MAP
    _dict_lower = {s.lower() for s in _JD_SKILLS}

    def _canon(tag):
        t = str(tag).strip().lower()
        if not t:
            return None
        for std, syns in SYNONYM_MAP.items():
            if t == std or t in syns:
                return std
        return t if t in _dict_lower else None

    session = get_session()
    noise = 0
    try:
        rows = (session.query(CrawledJob.source, CrawledJob.skill_tags)
                .filter(CrawledJob.data_type == 1).all())
        source_skills = defaultdict(list)
        for source, tags in rows:
            if not tags:
                continue
            for tag in tags:
                canon = _canon(tag)
                if canon:
                    source_skills[source or 'unknown'].append(canon)
                else:
                    noise += 1
        return [(s, v) for s, v in source_skills.items()], noise
    finally:
        session.close()


def _source_skills_for_cross_validation():
    """优先真实数据库多来源；数据不足时回退种子文件。返回 (skills_per_source, mode, noise)。"""
    db, noise = _load_db_source_skills()
    distinct = {s for s, _ in db}
    if len(distinct) >= 2:
        return db, 'database', noise
    expanded = os.path.join(os.path.dirname(__file__), '..', 'test_data', 'expanded_jobs.json')
    if os.path.exists(expanded):
        from collections import defaultdict
        with open(expanded, 'r', encoding='utf-8') as f:
            jobs = json.load(f)
        agg = defaultdict(list)
        for j in jobs:
            agg[j.get('source', 'unknown')].extend(j.get('skills', []))
        return [(s, v) for s, v in agg.items()], 'seed_file', noise
    return db, 'database', noise


@router.get('/report')
def get_quality_report():
    jobs = _load_jobs()
    skills_per_source, _mode, noise = _source_skills_for_cross_validation()
    report = full_quality_report(jobs, skills_per_source)
    report['data_noise'] = {
        'filtered_tags': noise,
        'note': '原始 skill_tags 中命中技能词典/同义词表之外的噪声标签数，'
                '已从多源交叉验证中过滤（数据噪声检测结果）。',
    }
    return {'success': True, 'data': report}


@router.get('/cross-validate')
def api_cross_validate():
    skills_per_source, mode, noise = _source_skills_for_cross_validation()
    result = cross_validate(skills_per_source)
    verified = {k: v for k, v in result.items() if v['verified']}
    unconfirmed = {k: v for k, v in result.items() if not v['verified']}
    return {
        'success': True,
        'data': {
            'total_sources': len(skills_per_source),
            'data_mode': mode,
            'total_unique_skills': len(result),
            'noise_filtered': noise,
            'verified_count': len(verified),
            'unconfirmed_count': len(unconfirmed),
            'verified': verified,
            'unconfirmed': unconfirmed,
        }
    }


@router.get('/plagiarism')
def api_plagiarism():
    pairs = detect_plagiarism(_load_jobs())
    return {'success': True, 'data': {'total_pairs': len(pairs), 'pairs': pairs}}


@router.get('/inflation')
def api_inflation():
    flagged = detect_inflation(_load_jobs())
    return {'success': True, 'data': {'total_flagged': len(flagged), 'jobs': flagged}}


@router.get('/accuracy-test')
def run_accuracy_test():
    """JD 解析准确率测评。

    口径（对齐赛题与看板）：准确率 = 平均精确率，pass = 精确率 ≥ 0.9；
    召回率与 F1 作为参考指标一并返回。技能匹配按同义词归一后判定。
    数据集缺失时返回明确错误，不再静默回退到不具代表性的兜底样本。
    """
    jd_path = os.path.join(TEST_DATA_DIR, 'scraped_jds.json')
    ans_path = os.path.join(TEST_DATA_DIR, 'standard_answers.json')
    if not os.path.exists(jd_path) or not os.path.exists(ans_path):
        return {'success': False,
                'message': '测试数据集缺失：需要 backend/test_data/scraped_jds.json 与 '
                           'standard_answers.json（标准标注集随部署打包，见软件测试说明附录 A）。'}

    with open(jd_path, 'r', encoding='utf-8') as f:
        samples = json.load(f)
    with open(ans_path, 'r', encoding='utf-8') as f:
        answers = json.load(f)

    from services.resume_parser import extract_jd_skills
    from services.skill_synonyms import is_synonym

    def _match(pred: str, gold: set) -> bool:
        return any(is_synonym(pred, g) for g in gold)

    total_precision = 0
    total_recall = 0
    total_f1 = 0
    details = []

    for sample, answer in zip(samples, answers):
        # 技能提取只用标题+正文，排除公司名等元信息，避免"Oracle 公司"之类的误报
        full_text = f"{sample['title']}\n{sample['description']}"
        result = extract_jd_skills(full_text)
        pred_skills = result.get('skills', [])
        true_skills = [s.lower() for s in answer.get('skills', [])]

        tp = sum(1 for p in pred_skills if _match(p, true_skills))
        fp = len(pred_skills) - tp
        fn = sum(1 for g in true_skills if not any(is_synonym(p, g) for p in pred_skills))

        precision = tp / max(tp + fp, 1)
        recall = tp / max(tp + fn, 1)
        f1 = 2 * precision * recall / max(precision + recall, 0.001)

        total_precision += precision
        total_recall += recall
        total_f1 += f1

        details.append({
            'id': sample['id'],
            'title': sample['title'],
            'extracted': list(pred_skills),
            'expected': list(true_skills),
            'precision': round(precision, 3),
            'recall': round(recall, 3),
            'f1': round(f1, 3),
        })

    n = max(len(samples), 1)
    avg_precision = round(total_precision / n, 3)
    avg_recall = round(total_recall / n, 3)
    avg_f1 = round(total_f1 / n, 3)
    return {
        'success': True,
        'data': {
            'total_samples': n,
            'avg_precision': avg_precision,
            'avg_recall': avg_recall,
            'avg_f1': avg_f1,
            'accuracy': round(avg_precision * 100, 1),
            'pass': avg_precision >= 0.9,
            'details': details,
            'metric': 'precision',
            'note': f'口径：准确率=平均精确率（赛题“解析准确率”），共 {n} 条标注 JD；'
                    f'召回 {avg_recall}、F1 {avg_f1} 为参考。',
        }
    }


@router.get('/match-test')
def run_match_test():
    match_path = os.path.join(TEST_DATA_DIR, 'match_pairs.json')
    if not os.path.exists(match_path):
        return {'success': False, 'message': 'match_pairs.json not found'}

    with open(match_path, 'r', encoding='utf-8') as f:
        pairs = json.load(f)

    from services.skill_synonyms import is_synonym

    def calc_match(resume_skills, jd_skills):
        r_set = [s.lower() for s in resume_skills]
        j_set = [s.lower() for s in jd_skills]
        overlap = [s for s in j_set if any(is_synonym(s, r) for r in r_set)]
        skill_score = len(overlap) / max(len(j_set), 1)
        coverage = len(set(s for s in r_set if any(is_synonym(s, j) for j in j_set))) / max(len(r_set), 1)
        final = round(skill_score * 0.6 + coverage * 0.4, 3)
        missing = [s for s in j_set if not any(is_synonym(s, r) for r in r_set)]
        extra = [s for s in r_set if not any(is_synonym(s, j) for j in j_set)]
        return {'score': final, 'matched': overlap, 'missing': missing, 'extra': extra}

    errors = []
    details = []
    for pair in pairs:
        result = calc_match(pair['resume_skills'], pair['jd_skills'])
        expected = pair['match_score']
        error = abs(result['score'] - expected)
        details.append({
            'id': pair['id'],
            'resume_skills': pair['resume_skills'],
            'jd_title': pair['jd_title'],
            'jd_skills': pair['jd_skills'],
            'expected': expected,
            'system_score': result['score'],
            'error': round(error, 3),
            'matched': result['matched'],
            'missing': result['missing'],
        })
        errors.append(error)

    avg_error = sum(errors) / max(len(errors), 1)
    correct = sum(1 for e in errors if e < 0.1)
    accuracy = round(correct / max(len(errors), 1) * 100, 1)

    return {
        'success': True,
        'data': {
            'total_pairs': len(pairs),
            'avg_error': round(avg_error, 3),
            'correct_count': correct,
            'accuracy': accuracy,
            'pass': accuracy >= 90,
            'details': details[:5],
        }
    }


@router.get('/resume-test')
def run_resume_test():
    """简历提取准确率测试 — 100份标注简历"""
    resume_path = os.path.join(TEST_DATA_DIR, 'resumes_test.json')
    if not os.path.exists(resume_path):
        return {'success': False, 'message': 'resumes_test.json not found'}

    with open(resume_path, 'r', encoding='utf-8') as f:
        resumes = json.load(f)

    from services.resume_parser import parse_resume
    from services.skill_synonyms import is_synonym

    total_precision = 0
    total_recall = 0
    total_f1 = 0
    details = []

    for resume in resumes:
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False, encoding='utf-8') as f:
            f.write(resume['text'])
            tmp = f.name
        result = parse_resume(tmp)
        os.unlink(tmp)
        extracted = result.get('data', {})
        pred_skills = [s.lower() for s in extracted.get('skills', [])]
        true_skills = [s.lower() for s in resume['skills']]

        tp = sum(1 for p in pred_skills if any(is_synonym(p, t) for t in true_skills))
        fp = len(pred_skills) - tp
        fn = sum(1 for t in true_skills if not any(is_synonym(p, t) for p in pred_skills))

        precision = tp / max(tp + fp, 1)
        recall = tp / max(tp + fn, 1)
        f1 = 2 * precision * recall / max(precision + recall, 0.001)

        total_precision += precision
        total_recall += recall
        total_f1 += f1

        details.append({
            'id': resume['id'],
            'category': resume['category'],
            'extracted': pred_skills[:8],
            'expected': true_skills[:8],
            'precision': round(precision, 3),
            'recall': round(recall, 3),
            'f1': round(f1, 3),
        })

    n = max(len(resumes), 1)
    avg_precision = round(total_precision / n, 3)
    avg_recall = round(total_recall / n, 3)
    avg_f1 = round(total_f1 / n, 3)
    return {
        'success': True,
        'data': {
            'total_samples': n,
            'avg_precision': avg_precision,
            'avg_recall': avg_recall,
            'avg_f1': avg_f1,
            'accuracy': round(avg_precision * 100, 1),
            'pass': avg_precision >= 0.9,
            'details': details[:3],
            'metric': 'precision',
            'note': f'口径：准确率=平均精确率，共 {n} 份标注简历；召回 {avg_recall}、F1 {avg_f1} 为参考。',
        }
    }
