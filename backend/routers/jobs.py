"""岗位数据 + 按技能查询 + 企业统计

@owner: 静怡、议桓（多源异构数据采集+求职端岗位界面+企业端行业报告）
"""

from fastapi import APIRouter, Query, HTTPException

router = APIRouter(prefix='/api/jobs', tags=['jobs'])

SEED_JOBS = [
    {'id': 1, 'title': 'Java后端开发工程师', 'company': '字节跳动', 'location': '北京', 'salary': '25K-40K', 'education': '本科', 'experience': '3-5年', 'description': '负责电商核心系统后端设计与开发，参与高并发分布式系统架构优化', 'status': 'active', 'skills': ['Java', 'Spring Boot', 'MyBatis', 'MySQL', 'Redis', 'Docker', 'Kubernetes', '微服务', '分布式', 'RabbitMQ', 'Git'], 'source': 'Boss直聘', 'collected_at': '2026-07-10'},
    {'id': 2, 'title': 'AI应用开发工程师', 'company': '华为', 'location': '深圳', 'salary': '30K-50K', 'education': '硕士', 'experience': '2-5年', 'description': '基于大模型和RAG技术构建企业级AI应用，负责Agent框架设计与实现', 'status': 'active', 'skills': ['Python', '大模型', 'RAG', 'LangChain', 'FastAPI', 'Docker', 'Elasticsearch', 'Git', 'Linux', 'AI'], 'source': 'Boss直聘', 'collected_at': '2026-07-11'},
    {'id': 3, 'title': '大模型算法工程师', 'company': '百度', 'location': '北京', 'salary': '40K-70K', 'education': '硕士', 'experience': '3-5年', 'description': '负责大语言模型训练与微调，优化模型推理性能，探索Agent与多模态技术', 'status': 'active', 'skills': ['Python', '大模型', 'PyTorch', 'TensorFlow', 'NLP', 'RAG', 'LangChain', 'AI', 'Linux', 'Docker', 'Git'], 'source': '拉勾', 'collected_at': '2026-07-11'},
    {'id': 4, 'title': '前端开发工程师', 'company': '腾讯', 'location': '深圳', 'salary': '20K-35K', 'education': '本科', 'experience': '2-4年', 'description': '负责企业级SaaS产品前端架构设计与开发，优化性能和用户体验', 'status': 'active', 'skills': ['React', 'TypeScript', 'Vue', 'JavaScript', 'HTML', 'CSS', 'Node.js', 'Git', 'Nginx', 'Docker', 'CI/CD'], 'source': 'Boss直聘', 'collected_at': '2026-07-09'},
    {'id': 5, 'title': '云原生工程师', 'company': '阿里云', 'location': '杭州', 'salary': '30K-45K', 'education': '本科', 'experience': '3-5年', 'description': '负责Kubernetes平台建设与运维，设计微服务治理方案，推动DevOps实践', 'status': 'active', 'skills': ['Docker', 'Kubernetes', 'Go', 'Python', 'Linux', 'Jenkins', 'AWS', 'Nginx', '微服务', '分布式', 'CI/CD', 'Git'], 'source': '拉勾', 'collected_at': '2026-07-10'},
    {'id': 6, 'title': '数据工程师', 'company': '美团', 'location': '北京', 'salary': '28K-45K', 'education': '本科', 'experience': '3-5年', 'description': '负责大数据平台建设，ETL流程优化，实时数据处理Pipeline开发', 'status': 'closed', 'skills': ['Python', 'Spark', 'Flink', 'Kafka', 'Hadoop', 'MySQL', 'Redis', 'Elasticsearch', 'Docker', 'Linux', 'Git'], 'source': 'Boss直聘', 'collected_at': '2026-07-08'},
    {'id': 7, 'title': 'DevOps工程师', 'company': '网易', 'location': '广州', 'salary': '25K-38K', 'education': '本科', 'experience': '2-5年', 'description': '负责CI/CD流水线建设，容器化平台运维，监控告警体系搭建', 'status': 'active', 'skills': ['Docker', 'Kubernetes', 'Jenkins', 'Linux', 'AWS', 'Python', 'Go', 'Nginx', 'CI/CD', 'Git', 'RabbitMQ'], 'source': '拉勾', 'collected_at': '2026-07-11'},
    {'id': 8, 'title': 'Python后端开发', 'company': '小红书', 'location': '上海', 'salary': '22K-35K', 'education': '本科', 'experience': '1-3年', 'description': '负责内容推荐系统后端开发，使用FastAPI + PostgreSQL，参与微服务拆分', 'status': 'active', 'skills': ['Python', 'FastAPI', 'Django', 'PostgreSQL', 'Redis', 'Docker', 'Kubernetes', 'Elasticsearch', '微服务', 'Git', 'Linux'], 'source': 'Boss直聘', 'collected_at': '2026-07-10'},
    {'id': 9, 'title': '全栈开发工程师', 'company': '字节跳动', 'location': '上海', 'salary': '28K-42K', 'education': '本科', 'experience': '3-5年', 'description': '负责内部工具平台全栈开发，React前端 + Go后端，参与架构设计', 'status': 'active', 'skills': ['React', 'TypeScript', 'Go', 'Python', 'MySQL', 'Redis', 'Docker', 'Kubernetes', 'Nginx', 'Git', 'CI/CD'], 'source': 'Boss直聘', 'collected_at': '2026-07-12'},
    {'id': 10, 'title': 'AI Agent开发工程师', 'company': '商汤科技', 'location': '上海', 'salary': '35K-55K', 'education': '硕士', 'experience': '2-5年', 'description': '负责多Agent协作框架开发，集成大模型与工具调用，构建自主决策系统', 'status': 'active', 'skills': ['Python', '大模型', 'LangChain', 'RAG', 'Agent', 'FastAPI', 'Docker', 'Kubernetes', 'Elasticsearch', 'AI', 'Git', 'Linux'], 'source': '拉勾', 'collected_at': '2026-07-12'},
    {'id': 11, 'title': 'Go后端开发工程师', 'company': '滴滴出行', 'location': '北京', 'salary': '28K-40K', 'education': '本科', 'experience': '3-5年', 'description': '负责出行核心调度系统后端开发，高并发场景优化，微服务治理', 'status': 'closed', 'skills': ['Go', 'Redis', 'MySQL', 'Kafka', 'Docker', 'Kubernetes', '微服务', '分布式', '高并发', 'Git', 'Linux', 'Nginx'], 'source': 'Boss直聘', 'collected_at': '2026-07-09'},
    {'id': 12, 'title': 'NLP算法工程师', 'company': '科大讯飞', 'location': '合肥', 'salary': '30K-48K', 'education': '硕士', 'experience': '2-5年', 'description': '负责自然语言处理模型研发，包括文本分类、信息抽取、对话系统', 'status': 'active', 'skills': ['Python', 'NLP', 'PyTorch', 'TensorFlow', '大模型', 'RAG', 'Transformer', 'Docker', 'Git', 'Linux', 'AI'], 'source': '拉勾', 'collected_at': '2026-07-10'},
    {'id': 13, 'title': '测试开发工程师', 'company': '京东', 'location': '北京', 'salary': '20K-32K', 'education': '本科', 'experience': '2-4年', 'description': '负责自动化测试框架开发，性能测试平台建设，CI/CD集成测试', 'status': 'active', 'skills': ['Python', 'Java', 'Jenkins', 'Docker', 'Linux', 'MySQL', 'Git', 'CI/CD', 'Selenium', 'JMeter'], 'source': 'Boss直聘', 'collected_at': '2026-07-08'},
    {'id': 14, 'title': '数据库管理员(DBA)', 'company': '蚂蚁集团', 'location': '杭州', 'salary': '30K-50K', 'education': '本科', 'experience': '5年+', 'description': '负责MySQL/PostgreSQL数据库运维、性能优化、高可用架构设计', 'status': 'closed', 'skills': ['MySQL', 'PostgreSQL', 'Redis', 'MongoDB', 'Linux', 'Docker', 'Kubernetes', 'Python', 'Shell', '高可用'], 'source': '拉勾', 'collected_at': '2026-07-11'},
    {'id': 15, 'title': '安全工程师', 'company': '奇安信', 'location': '北京', 'salary': '25K-40K', 'education': '本科', 'experience': '3-5年', 'description': '负责Web安全漏洞挖掘、渗透测试、安全架构评审，SDL流程建设', 'status': 'draft', 'skills': ['Python', 'Go', 'Linux', 'Docker', 'Kubernetes', 'Nginx', 'Git', 'BurpSuite', 'Metasploit'], 'source': 'Boss直聘', 'collected_at': '2026-07-12'},
]

@router.get('/stats')
def job_stats(company: str = Query('')):
    """企业岗位统计 — 传 company 过滤公司名"""
    if company:
        company_jobs = [j for j in SEED_JOBS if j['company'] == company]
    else:
        company_jobs = SEED_JOBS
    active = sum(1 for j in company_jobs if j.get('status') == 'active')
    closed = sum(1 for j in company_jobs if j.get('status') == 'closed')
    draft = sum(1 for j in company_jobs if j.get('status') == 'draft')
    total = len(company_jobs)
    return {'success': True, 'data': {'total': total, 'active': active, 'closed': closed, 'draft': draft, 'company': company}}

@router.get('')
def list_jobs(skill: str = Query(''), company: str = Query(''), page: int = Query(1), size: int = Query(20)):
    if skill:
        keyword = skill.lower()
        results = [j for j in SEED_JOBS if any(keyword in s.lower() for s in j.get('skills', []))]
    elif company:
        results = [j for j in SEED_JOBS if j['company'] == company]
    else:
        results = list(SEED_JOBS)
    total = len(results)
    start = (page - 1) * size
    return {'success': True, 'data': results[start:start + size], 'total': total, 'page': page}

@router.get('/{job_id}')
def get_job(job_id: int):
    for j in SEED_JOBS:
        if j['id'] == job_id:
            return {'success': True, 'data': j}
    raise HTTPException(404, '岗位不存在')
