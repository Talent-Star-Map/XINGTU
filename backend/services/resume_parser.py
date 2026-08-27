"""简历解析 — 先提取文本，再用规则+大模型抽取结构化字段

@owner: 佳豪（求职端"我的"）
"""

import re, json, os
import PyPDF2

def extract_pdf_text(path: str) -> str:
    """提取 PDF 文本"""
    text = ''
    try:
        with open(path, 'rb') as f:
            reader = PyPDF2.PdfReader(f)
            for page in reader.pages:
                t = page.extract_text()
                if t:
                    text += t + '\n'
    except Exception as e:
        text = f'[PDF解析错误: {e}]'
    return text


def extract_docx_text(path: str) -> str:
    """提取 DOCX 文本"""
    try:
        from docx import Document
        doc = Document(path)
        return '\n'.join(p.text for p in doc.paragraphs if p.text.strip())
    except Exception as e:
        return f'[DOCX解析错误: {e}]'


def extract_txt(path: str) -> str:
    with open(path, 'r', encoding='utf-8', errors='ignore') as f:
        return f.read()


def extract_text(path: str) -> str:
    ext = path.rsplit('.', 1)[-1].lower() if '.' in path else ''
    if ext == 'pdf':
        return extract_pdf_text(path)
    elif ext in ('docx', 'doc'):
        return extract_docx_text(path)
    elif ext == 'txt':
        return extract_txt(path)
    return ''


def rule_based_extract(text: str) -> dict:
    """基于正则的快速提取，作为大模型解析的fallback"""
    result = {
        'name': '', 'phone': '', 'email': '',
        'skills': [], 'education': '', 'school': '',
        'experience': '', 'target_position': '',
    }

    # 邮箱
    m = re.search(r'[\w.+-]+@[\w-]+\.[\w.-]+', text)
    if m: result['email'] = m.group()

    # 手机号
    m = re.search(r'1[3-9]\d{9}', text)
    if m: result['phone'] = m.group()

    # 姓名（常见模式）
    for pat in [r'姓名[：:]\s*(\S{2,4})', r'名字[：:]\s*(\S{2,4})']:
        m = re.search(pat, text)
        if m:
            result['name'] = m.group(1)
            break

    # 技能关键词（与前端 ManualSkillInput 同步）
    skill_keywords = [
        # 编程语言
        'Java', 'Python', 'Go', 'C++', 'Rust', 'TypeScript', 'JavaScript',
        'Scala', 'Kotlin', 'Swift', 'PHP', 'Ruby', 'Shell', 'SQL',
        'Git', 'Maven', 'Gradle', 'CMake', 'Lua', 'Perl', 'MATLAB',
        # 前端框架
        'React', 'Vue', 'Angular', 'Svelte', 'Next.js', 'Nuxt', 'HTML', 'CSS',
        'Node.js', 'jQuery', 'Webpack', 'Vite', 'Tailwind CSS', 'Ant Design',
        'Element Plus', 'Taro', 'uni-app', 'Electron',
        # 后端框架
        'Spring Boot', 'Spring Cloud', 'Django', 'Flask', 'FastAPI', 'Express',
        'MyBatis', 'Hibernate', 'Gin', 'gRPC', 'RESTful', 'Dubbo', 'Netty',
        'Quarkus', 'Koa', 'NestJS', 'Thrift', 'GraphQL',
        # 数据库
        'MySQL', 'PostgreSQL', 'Redis', 'MongoDB', 'Elasticsearch', 'SQLite',
        'Oracle', 'Memcached', 'ClickHouse', 'Neo4j', 'TiDB', 'HBase',
        'Cassandra', 'DynamoDB', 'InfluxDB', 'DuckDB', 'MariaDB',
        # AI/大模型
        '大模型', 'LLM', 'LangChain', 'RAG', 'Agent', 'Prompt Engineering',
        'NLP', 'CV', 'PyTorch', 'TensorFlow', 'Pandas', 'NumPy',
        'MCP 协议', 'MCP', 'Transformer', 'Stable Diffusion', 'Ollama', 'vLLM',
        'LangSmith', 'AutoGPT', 'Whisper', 'LoRA', 'PaddlePaddle', 'MindSpore',
        'OpenCV',
        # 大数据
        'Spark', 'Flink', 'Hadoop', 'Kafka', 'Hive', 'HBase', 'DataX', 'Kettle',
        'Airflow', 'Pulsar', 'Storm', 'Sqoop', 'Canal', 'Doris', 'StarRocks',
        'Presto', 'Trino', 'Superset',
        # 云原生/DevOps
        'Docker', 'Kubernetes', 'K8s', 'CI/CD', 'Jenkins', 'Terraform', 'Nginx',
        'Linux', 'AWS', '阿里云', '腾讯云', 'Serverless', 'GitLab', 'ArgoCD',
        'Prometheus', 'Grafana', 'Istio', 'Consul', 'Vault', 'Ansible', 'Vagrant',
        'Harbor', 'RabbitMQ', 'RocketMQ',
        # 安全/测试
        '渗透测试', 'Burp Suite', 'Metasploit', 'Selenium', 'JMeter', 'Postman',
        'OWASP', 'Nessus', 'Wireshark', 'Appium', 'LoadRunner', 'SonarQube',
        'ZAP',
        # 架构/分布式
        '微服务', '分布式', '高并发', '架构设计', '分布式事务', '分布式缓存',
        '消息队列', '负载均衡', '服务网格', 'DDD', '链路追踪', 'SkyWalking',
        'Seata', 'Nacos', 'Sentinel',
    ]
    found = [s for s in skill_keywords if s.lower() in text.lower()]
    result['skills'] = found

    # 学历
    for edu in ['博士', '硕士', '本科', '大专']:
        if edu in text:
            result['education'] = edu
            break

    # 学校
    m = re.search(r'(?:学校|院校|毕业院校|大学)[：:]*[ \t]*(\S{2,20})', text)
    if m:
        result['school'] = m.group(1)
    elif '大学' in text:
        m = re.search(r'(\S{2,15}大学)', text)
        if m:
            result['school'] = re.sub(r'^(毕业于|就读于|来自)', '', m.group(1))

    # 期望岗位
    for pat in [r'(?:目标岗位|期望岗位|应聘岗位|求职意向)[：:]\s*(\S{2,30})', r'(?:应聘|求职)[：:]\s*(\S{2,20})']:
        m = re.search(pat, text)
        if m:
            result['target_position'] = m.group(1)
            break

    # 工作经验
    m = re.search(r'(?:工作经验|工作经历|工作年限)[：:]\s*(\S{2,20})', text)
    if m: result['experience'] = m.group(1)

    # 个人简介 / 自我评价 — 抓到两个换行之间的纯文本
    for label in ['个人简介', '自我评价', '自我介绍']:
        idx = text.find(label)
        if idx < 0: continue
        after = text[idx + len(label):]
        # 跳过冒号和分隔线
        after = re.sub(r'^[：:\s]*', '', after)
        after = re.sub(r'^[━═－—\s]+', '', after)
        # 取到下一个段落标题或文本结束
        m = re.search(r'([\s\S]+?)(?=\n\s*(?:项目|技能|工作|教育|求职|联系|个人信息|姓名[：:]|手机[：:]|邮箱[：:]|期望|个人简介|自我评价)|\Z)', after)
        if m:
            bio = m.group(1).strip()
            bio = re.sub(r'[━═－—]+', '', bio).strip()
            if len(bio) > 10:
                result['bio'] = bio[:300]
                break

    return result


def deepseek_extract(text: str) -> dict | None:
    """调用 DeepSeek API 做精确简历解析"""
    api_key = os.getenv('DEEPSEEK_API_KEY', '')
    if not api_key:
        return None
    try:
        import requests
        resp = requests.post(
            'https://api.deepseek.com/v1/chat/completions',
            headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'},
            json={
                'model': 'deepseek-chat',
                'messages': [
                    {'role': 'system', 'content': 'You are a job requirement parser. Extract technical skills, programming languages, frameworks, tools, platforms and technologies explicitly mentioned in the text. Only include skills with clear textual evidence. Return ONLY JSON: {"name":"","phone":"","email":"","skills":["skill1","skill2"],"education":"","school":"","experience":"","target_position":"","bio":""}'},
                    {'role': 'user', 'content': f'简历内容：\n{text[:5000]}'}
                ],
                'temperature': 0.1, 'max_tokens': 1000,
            },
            timeout=30
        )
        raw = resp.json()['choices'][0]['message']['content'].strip()
        # 清理可能的markdown包裹
        if raw.startswith('```'): raw = raw.split('\n', 1)[1].rsplit('\n```', 1)[0]
        return json.loads(raw)
    except Exception:
        return None


def parse_resume(file_path: str) -> dict:
    """主入口：提取文本 → 大模型优先 → 规则兜底"""
    text = extract_text(file_path)
    if not text:
        return {'success': False, 'message': '无法提取文本内容', 'data': {}}

    # 大模型优先
    llm_result = deepseek_extract(text)

    # 规则兜底
    rule_result = rule_based_extract(text)

    # 合并
    if llm_result:
        final = {**rule_result, **llm_result}  # 大模型结果覆盖
    else:
        final = rule_result

    # 质检：置信度评分 + 原文溯源
    from services.quality_checker import score_skills, trace_skills
    scored = score_skills(final.get('skills', []), text, method='deepseek' if llm_result else 'rule_based')
    traces = trace_skills(final.get('skills', []), text)

    return {
        'success': True,
        'data': {
            **final,
            'raw_text_preview': text[:3000],
            'method': 'deepseek' if llm_result else 'rule_based',
            'quality': {
                'scored_skills': scored,
                'traces': traces,
                'confidence_avg': round(sum(s['confidence'] for s in scored) / max(len(scored), 1), 2),
                'verified_count': sum(1 for s in scored if s['status'] == 'verified'),
                'unconfirmed_count': sum(1 for s in scored if s['status'] == 'unconfirmed'),
            },
        }
    }


# ================= JD 专用技能提取（幻觉防控口径，@owner: 佳豪） =================

_JD_SKILLS = [
    'a/b testing', 'agent', 'agile', 'agile scrum', 'airflow', 'android', 'angular', 'ansible',
    'api testing', 'app store', 'auto scaling', 'aws', 'azure', 'backup recovery', 'bash', 'bdd',
    'burp suite', 'c#', 'c++', 'cassandra', 'ci/cd', 'clickhouse', 'code review', 'competitive analysis',
    'core data', 'cost optimization', 'cryptography', 'css', 'cuda', 'cypress', 'data analysis', 'data pipeline',
    'data visualization', 'deep learning', 'distributed', 'distributed training', 'django', 'docker', 'dubbo', 'dynamodb',
    'elasticsearch', 'electron', 'express', 'fastapi', 'feature engineering', 'feature store', 'firebase', 'firewall',
    'flask', 'flink', 'flutter', 'gcp', 'gin', 'git', 'go', 'gradle',
    'grafana', 'graphql', 'grpc', 'hadoop', 'helm', 'hibernate', 'high availability', 'high concurrency',
    'hive', 'html', 'iam', 'ids/ips', 'incident response', 'ios', 'istio', 'java',
    'javascript', 'jenkins', 'jest', 'jira', 'jmeter', 'jquery', 'junit', 'jvm',
    'k8s', 'kafka', 'kotlin', 'kpi definition', 'kubernetes', 'langchain', 'linux', 'llm',
    'load balancing', 'lora', 'machine learning', 'maven', 'microservices', 'mlops', 'mobile ui design', 'model serving',
    'mongodb', 'mybatis', 'mybatis-plus', 'mysql', 'nacos', 'neo4j', 'netty', 'networking',
    'next.js', 'nginx', 'nlp', 'nmap', 'node.js', 'numpy', 'oauth', 'onnx',
    'opencv', 'oracle', 'owasp', 'pandas', 'penetration testing', 'performance optimization', 'performance testing', 'performance tuning',
    'php', 'postgresql', 'postman', 'presto', 'prometheus', 'prompt engineering', 'push notifications', 'python',
    'pytorch', 'query optimization', 'rabbitmq', 'rag', 'react', 'react native', 'redis', 'redux',
    'regression testing', 'replication', 'responsive design', 'rest', 'rest api', 'rest apis', 'risk assessment', 'roadmap planning',
    'rocketmq', 'ruby', 'rust', 'scala', 'scrum', 'security', 'security groups', 'selenium',
    'sentinel', 'serverless', 'shell', 'shell scripting', 'siem', 'spark', 'spring boot', 'spring cloud',
    'spring security', 'sql', 'sqlite', 'stakeholder management', 'statistical analysis', 'svelte', 'swift', 'system design',
    'tailwind css', 'tdd', 'tensorflow', 'terraform', 'test automation', 'transformer', 'trino', 'typescript',
    'unit testing', 'user research', 'vite', 'vpn', 'vue', 'webpack', 'websocket', 'whisper',
    'wireframing', 'wireshark', '分布式', '大模型', '微服务', '高并发',
]

_AMBIGUOUS = {'go', 'c', 'r'}


def _term_patterns(skill: str):
    """返回 (pattern, flags) 列表；短词 'Go/C/R' 走大小写敏感匹配避免误报。"""
    cl = skill.strip().lower()
    if cl in _AMBIGUOUS:
        return [(r'(?<![a-zA-Z])' + re.escape(skill.strip()) + r'(?![a-zA-Z])', 0)]
    return [(r'(?<![a-zA-Z0-9])' + re.escape(cl) + r'(?![a-zA-Z0-9])', re.IGNORECASE)]


def _evidence_sentences(skill: str, text: str) -> list[str]:
    from services.skill_synonyms import normalize_skill
    sentences = [s.strip() for s in re.split(r'[。；;.\n]', text) if s.strip()]
    variants = {skill.strip().lower()} | {v.lower() for v in normalize_skill(skill)}
    out = []
    for sent in sentences:
        for v in variants:
            if len(v) < 2:
                continue
            if v in _AMBIGUOUS:
                hit = re.search(r'(?<![a-zA-Z])' + re.escape(v) + r'(?![a-zA-Z])', sent)
            else:
                hit = re.search(r'(?<![a-zA-Z0-9])' + re.escape(v) + r'(?![a-zA-Z0-9])', sent, re.IGNORECASE)
            if hit:
                out.append(sent)
                break
    return out[:2] or ['(原文未找到明确提及)']


def _jd_rule_extract(text: str) -> list[tuple[str, list[str]]]:
    """规则词典扫描：只收正文明确出现（词边界）的技能，附原文句子。"""
    from services.skill_synonyms import SYNONYM_MAP
    found: list[tuple[str, list[str]]] = []
    seen: set[str] = set()
    for c in _JD_SKILLS:
        hit = any(re.search(p, text, flags) for p, flags in _term_patterns(c))
        if not hit:
            continue
        canonical = c.strip().lower()
        for std, syns in SYNONYM_MAP.items():
            if canonical == std or canonical in syns:
                canonical = std
                break
        if canonical in seen:
            continue
        seen.add(canonical)
        found.append((canonical, _evidence_sentences(c, text)))
    return found


def _jd_llm_extract(text: str):
    """JD 专用 LLM 提取：强制逐条返回原文证据。"""
    api_key = os.getenv('DEEPSEEK_API_KEY', '')
    if not api_key:
        return []
    try:
        import requests
        resp = requests.post(
            'https://api.deepseek.com/v1/chat/completions',
            headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'},
            json={
                'model': 'deepseek-chat',
                'messages': [
                    {'role': 'system', 'content':
                     '你是岗位描述（JD）技能解析器。只提取正文中明确出现的技术技能、编程语言、框架、工具、平台。'
                     '禁止推测、禁止补充正文没有的技能。返回 JSON：'
                     '{"skills":[{"skill":"技能名","evidence":"包含该技能的原文句子"}]}'},
                    {'role': 'user', 'content': f'岗位描述：\n{text[:6000]}'},
                ],
                'temperature': 0.0, 'max_tokens': 1500,
            },
            timeout=60,
        )
        raw = resp.json()['choices'][0]['message']['content'].strip()
        if raw.startswith('```'):
            raw = raw.split('\n', 1)[1].rsplit('\n```', 1)[0]
        data = json.loads(raw)
        return data.get('skills', [])
    except Exception:
        return []


def extract_jd_skills(text: str) -> dict:
    """JD 技能提取主入口：规则 + LLM，全部经"原文证据"硬过滤，返回规范技能名与证据。"""
    from services.skill_synonyms import SYNONYM_MAP
    rule_items = _jd_rule_extract(text)
    llm_items = _jd_llm_extract(text)
    _dict_lower = {s.lower() for s in _JD_SKILLS}

    merged: list[dict] = []
    seen: set[str] = set()

    def _has_evidence(skill: str) -> bool:
        return any(re.search(p, text, flags) for p, flags in _term_patterns(skill)) or \
               bool(_evidence_sentences(skill, text)[0] != '(原文未找到明确提及)')

    for it in llm_items:
        s = str(it.get('skill', '')).strip()
        if not s or not _has_evidence(s):
            continue  # 幻觉过滤：无原文证据即剔除
        canonical = s.lower()
        for std, syns in SYNONYM_MAP.items():
            if s.lower() == std or s.lower() in syns:
                canonical = std
                break
        # 词典约束：只保留技能词典/同义词表内的技能，避免 LLM 输出领域外词汇
        if canonical not in _dict_lower and canonical not in SYNONYM_MAP:
            continue
        if canonical in seen:
            continue
        seen.add(canonical)
        ev = str(it.get('evidence', '')).strip()
        merged.append({'skill': canonical, 'evidence': [ev] if ev else _evidence_sentences(s, text)})

    for canon, ev in rule_items:
        if canon not in seen:
            seen.add(canon)
            merged.append({'skill': canon, 'evidence': ev})

    # 重叠词去重：优先保留更长/更具体的技能（如 agile scrum 优先于 agile，
    # javascript 优先于 java），降低规则扫描的冗余误报。
    final_items = []
    accepted: list[str] = []
    for m in sorted(merged, key=lambda x: -len(x['skill'])):
        sk = m['skill']
        if any(sk != a and sk in a for a in accepted):
            continue
        accepted.append(sk)
        final_items.append(m)

    skills = [m['skill'] for m in final_items]
    evidence = {m['skill']: m['evidence'] for m in final_items}
    return {'skills': skills, 'evidence': evidence,
            'method': 'llm+rule' if llm_items else 'rule'}
