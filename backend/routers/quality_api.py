"""数据质量 API — 管理员鉴权 + 质检报告 + 准确率测试

@owner: 佳豪（幻觉防控质检）
"""
from fastapi import APIRouter, Query, Depends, HTTPException
# services 跨目录引用
from services.quality_checker import full_quality_report, cross_validate, detect_plagiarism, detect_inflation
from routers.jobs import SEED_JOBS
from database import verify_token
import json, os, tempfile

def _load_jobs():
    """加载扩展数据集（含抄袭/通胀样本），否则用种子数据"""
    # test_data 目录在 backend/ 根，需向上跳一层
    expanded = os.path.join(os.path.dirname(__file__), '..', 'test_data', 'expanded_jobs.json')
    if os.path.exists(expanded):
        with open(expanded, 'r', encoding='utf-8') as f:
            return json.load(f)
    return SEED_JOBS

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

TEST_DATA_DIR = os.path.join(os.path.dirname(__file__), 'test_data')
os.makedirs(TEST_DATA_DIR, exist_ok=True)


@router.get('/report')
def get_quality_report():
    from collections import defaultdict
    source_skills = defaultdict(list)
    jobs = _load_jobs()
    for j in jobs:
        source_skills[j['source']].extend(j.get('skills', []))
    skills_per_source = [(src, skills) for src, skills in source_skills.items()]
    report = full_quality_report(jobs, skills_per_source)
    return {'success': True, 'data': report}


@router.get('/cross-validate')
def api_cross_validate():
    from collections import defaultdict
    source_skills = defaultdict(list)
    jobs = _load_jobs()
    for j in jobs:
        source_skills[j['source']].extend(j.get('skills', []))
    skills_per_source = [(src, skills) for src, skills in source_skills.items()]
    result = cross_validate(skills_per_source)
    verified = {k: v for k, v in result.items() if v['verified']}
    unconfirmed = {k: v for k, v in result.items() if not v['verified']}
    return {
        'success': True,
        'data': {
            'total_sources': len(source_skills),
            'total_unique_skills': len(result),
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
    jd_path = os.path.join(TEST_DATA_DIR, 'scraped_jds.json')
    ans_path = os.path.join(TEST_DATA_DIR, 'standard_answers.json')
    if not os.path.exists(jd_path):
        jd_path = os.path.join(TEST_DATA_DIR, 'sample_jds.json')

    if not os.path.exists(jd_path) or not os.path.exists(ans_path):
        samples = []
        answers = []
        for j in SEED_JOBS[:10]:
            samples.append({'id': j['id'], 'title': j['title'], 'description': j['description']})
            answers.append({'id': j['id'], 'skills': j['skills']})
        with open(jd_path, 'w', encoding='utf-8') as f:
            json.dump(samples, f, ensure_ascii=False, indent=2)
        with open(ans_path, 'w', encoding='utf-8') as f:
            json.dump(answers, f, ensure_ascii=False, indent=2)

    with open(jd_path, 'r', encoding='utf-8') as f:
        samples = json.load(f)
    with open(ans_path, 'r', encoding='utf-8') as f:
        answers = json.load(f)

    from resume_parser import parse_resume

    total_precision = 0
    total_recall = 0
    total_f1 = 0
    details = []

    for sample, answer in zip(samples, answers):
        full_text = f"Job: {sample['title']}\nCompany: {sample.get('company','')}\n{sample['description']}"
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False, encoding='utf-8') as f:
            f.write(full_text)
            tmp = f.name
        result = parse_resume(tmp)
        os.unlink(tmp)
        extracted = result.get('data', {})
        pred_skills = set(s.lower() for s in extracted.get('skills', []))
        true_skills = set(s.lower() for s in answer.get('skills', []))

        tp = len(pred_skills & true_skills)
        fp = len(pred_skills - true_skills)
        fn = len(true_skills - pred_skills)

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
    return {
        'success': True,
        'data': {
            'total_samples': n,
            'avg_precision': round(total_precision / n, 3),
            'avg_recall': round(total_recall / n, 3),
            'avg_f1': round(total_f1 / n, 3),
            'accuracy': round(total_f1 / n * 100, 1),
            'pass': (total_f1 / n) >= 0.9,
            'details': details,
            'note': f'Based on {n} seed JD test data.',
        }
    }


@router.get('/match-test')
def run_match_test():
    match_path = os.path.join(TEST_DATA_DIR, 'match_pairs.json')
    if not os.path.exists(match_path):
        return {'success': False, 'message': 'match_pairs.json not found'}

    with open(match_path, 'r', encoding='utf-8') as f:
        pairs = json.load(f)

    def calc_match(resume_skills, jd_skills):
        r_set = set(s.lower() for s in resume_skills)
        j_set = set(s.lower() for s in jd_skills)
        overlap = r_set & j_set
        skill_score = len(overlap) / max(len(j_set), 1)
        coverage = len(overlap) / max(len(r_set), 1)
        final = round(skill_score * 0.6 + coverage * 0.4, 3)
        return {'score': final, 'matched': list(overlap), 'missing': list(j_set - r_set), 'extra': list(r_set - j_set)}

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

    from resume_parser import parse_resume

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
        pred_skills = set(s.lower() for s in extracted.get('skills', []))
        true_skills = set(s.lower() for s in resume['skills'])

        tp = len(pred_skills & true_skills)
        fp = len(pred_skills - true_skills)
        fn = len(true_skills - pred_skills)

        precision = tp / max(tp + fp, 1)
        recall = tp / max(tp + fn, 1)
        f1 = 2 * precision * recall / max(precision + recall, 0.001)

        total_precision += precision
        total_recall += recall
        total_f1 += f1

        details.append({
            'id': resume['id'],
            'category': resume['category'],
            'extracted': list(pred_skills)[:8],
            'expected': list(true_skills)[:8],
            'precision': round(precision, 3),
            'recall': round(recall, 3),
            'f1': round(f1, 3),
        })

    n = max(len(resumes), 1)
    return {
        'success': True,
        'data': {
            'total_samples': n,
            'avg_precision': round(total_precision / n, 3),
            'avg_recall': round(total_recall / n, 3),
            'avg_f1': round(total_f1 / n, 3),
            'accuracy': round(total_f1 / n * 100, 1),
            'pass': (total_precision / n) >= 0.9,
            'details': details[:3],
            'note': f'{n} annotated resumes, DeepSeek extraction + gold standard comparison.',
        }
    }
