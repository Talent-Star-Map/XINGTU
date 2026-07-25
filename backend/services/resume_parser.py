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
    m = re.search(r'(?:学校|院校|毕业院校|大学)[：:\s]*(\S{2,20})', text)
    if m:
        result['school'] = m.group(1)
    elif '大学' in text:
        m = re.search(r'(\S{2,15}大学)', text)
        if m: result['school'] = m.group(1)

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
    from quality_checker import score_skills, trace_skills
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
