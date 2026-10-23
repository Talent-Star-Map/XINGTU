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
    except Exception:
        # 解析失败返回空串：调用方据此返回「无法提取文本内容」，
        # 不能把错误信息当正文继续抽字段（会生成一份全是垃圾字段的简历）
        return ''
    return text


def _iter_docx_blocks(doc):
    """按文档顺序产出段落与表格

    很多中文简历模板把教育/工作/技能放在表格里，只读 doc.paragraphs 会
    一行都拿不到（实测表格版简历只抽出姓名和求职意向两行）。
    """
    from docx.oxml.ns import qn
    from docx.table import Table
    from docx.text.paragraph import Paragraph

    body = doc.element.body
    for child in body.iterchildren():
        if child.tag == qn('w:p'):
            yield Paragraph(child, doc)
        elif child.tag == qn('w:tbl'):
            yield Table(child, doc)


def extract_docx_text(path: str) -> str:
    """提取 DOCX 文本（段落 + 表格，保持文档顺序）"""
    try:
        from docx import Document
        doc = Document(path)
        lines: list[str] = []
        for block in _iter_docx_blocks(doc):
            if hasattr(block, 'rows'):          # 表格
                from services.resume_text_blocks import is_heading
                for row in block.rows:
                    cells = [c.text.strip().replace('\n', ' ') for c in row.cells if c.text.strip()]
                    if not cells:
                        continue
                    if len(cells) > 1 and is_heading(cells[0]):
                        # 首格是「教育背景」这类小标题：单独成行，后续内容另起一行，
                        # 否则整行变成一个长句，板块切分和条目切分都认不出来
                        lines.append(cells[0])
                        lines.append(' | '.join(cells[1:]))
                    else:
                        # 单元格用 | 分隔：板块切分按小标题走，条目切分按 | 拆字段，
                        # 比拼成一句话更接近这些模板的真实结构
                        lines.append(' | '.join(cells))
            else:                                # 段落
                if block.text.strip():
                    lines.append(block.text.strip())
        return '\n'.join(lines)
    except Exception:
        # .doc 旧二进制格式 python-docx 读不了，这里返回空串让上游报「无法提取文本」
        return ''


def extract_txt(path: str) -> str:
    with open(path, 'r', encoding='utf-8', errors='ignore') as f:
        return f.read()


IMAGE_EXTS = {'png', 'jpg', 'jpeg', 'webp', 'bmp', 'tif', 'tiff'}
# 少于这个字数就认为 PDF 没有可用文字层（扫描件）
_PDF_TEXT_MIN = 40


class TextExtractError(Exception):
    """文本提取失败，message 直接给用户看"""


def extract_text_detail(path: str) -> tuple[str, str]:
    """提取文本并返回 (文本, 来源)

    来源取值：pdf-text / pdf-ocr / docx / doc-convert / txt / image-ocr
    """
    ext = path.rsplit('.', 1)[-1].lower() if '.' in path else ''

    if ext == 'pdf':
        text = extract_pdf_text(path)
        if len(re.sub(r'\s', '', text)) >= _PDF_TEXT_MIN:
            return text, 'pdf-text'
        # 没有文字层：扫描件，走 OCR
        try:
            from services.resume_ocr import extract_text_from_scanned_pdf
            return extract_text_from_scanned_pdf(path), 'pdf-ocr'
        except Exception as e:
            raise TextExtractError(f'这份 PDF 没有文字层，扫描件识别也失败了：{e}')

    if ext == 'docx':
        text = extract_docx_text(path)
        if not text.strip():
            raise TextExtractError('Word 文档里没有可读文字（可能是纯图片排版）')
        return text, 'docx'

    if ext == 'doc':
        from services.doc_convert import DocConvertError, cleanup_converted, doc_to_docx, doc_to_text
        try:
            converted = doc_to_docx(path)
        except DocConvertError as e:
            # 转 docx 不可用时退一步，用 antiword/catdoc 拿纯文本
            try:
                return doc_to_text(path), 'doc-convert'
            except DocConvertError:
                raise TextExtractError(str(e))
        try:
            text = extract_docx_text(converted)
        finally:
            cleanup_converted(converted)
        if not text.strip():
            try:
                return doc_to_text(path), 'doc-convert'
            except DocConvertError:
                raise TextExtractError('这份 .doc 里没有读到文字')
        return text, 'doc-convert'

    if ext == 'txt':
        return extract_txt(path), 'txt'

    if ext in IMAGE_EXTS:
        try:
            from services.resume_ocr import extract_text_from_image
            return extract_text_from_image(path), 'image-ocr'
        except Exception as e:
            raise TextExtractError(f'图片识别失败：{e}')

    raise TextExtractError(f'暂不支持的文件类型：.{ext}')


def extract_text(path: str) -> str:
    """兼容旧调用：只返回文本，失败返回空串"""
    try:
        return extract_text_detail(path)[0]
    except TextExtractError:
        return ''


def _kw_hit(keyword: str, text_lower: str) -> bool:
    """判断技能关键词是否命中文本。

    ASCII 词条用词边界匹配（re.escape 保留 . / + 等字面量），避免
    `Java` 命中 `JavaScript`、`Gin` 命中 `Engine`、`Go` 命中 `Google`。
    中文词条无词边界概念，仍用子串匹配。
    """
    kw = keyword.lower()
    if not kw or not kw.isascii():
        return kw in text_lower
    # 首尾非字母数字的词条（如 `C++`）无法套词边界，退化为子串匹配
    if not kw[0].isalnum() or not kw[-1].isalnum():
        return kw in text_lower
    return re.search(
        r'(?<![a-z0-9])' + re.escape(kw) + r'(?![a-z0-9])', text_lower
    ) is not None


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

    # 手机号：兼容 13900001111 / 139 0000 1111 / 138-0013-8000 / +86 前缀
    m = re.search(r'(?<!\d)(?:\+?86[\s-]?)?(1[3-9]\d)[\s-]?(\d{4})[\s-]?(\d{4})(?!\d)', text)
    if m:
        result['phone'] = m.group(1) + m.group(2) + m.group(3)

    # 姓名（常见模式）
    for pat in [r'姓名[：:]\s*(\S{2,4})', r'名字[：:]\s*(\S{2,4})']:
        m = re.search(pat, text)
        if m:
            result['name'] = m.group(1)
            break
    # 兜底：简历首屏常把姓名单独放一行（没有「姓名：」标签），
    # 取前 6 行里第一个 2~4 字的中文短行，排除常见标题
    if not result['name']:
        skip = {'个人简历', '求职简历', '简历', '个人信息', '联系方式', '教育背景', '工作经历'}
        for line in text.splitlines()[:8]:
            s_line = line.strip()
            # 表格行取第一格（「陈嘉禾 | 求职意向：…」）
            first = re.split(r'\s*\|\s*|\t+|\s{2,}', s_line)[0].strip()
            for cand in (first, s_line):
                if not cand or cand in skip or '：' in cand or ':' in cand:
                    continue
                if re.fullmatch(r'[\u4e00-\u9fa5]{2,4}', cand):
                    result['name'] = cand
                    break
                # 英文简历：John Smith / Li Si
                if re.fullmatch(r"[A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){1,2}", cand) \
                        and not re.search(r'resume|curriculum|vitae', cand, re.I):
                    result['name'] = cand
                    break
            if result['name']:
                break

    # 技能关键词（与前端 ManualSkillInput 同步）
    skill_keywords = [
        # 编程语言
        'Java', 'Python', 'Go', 'C++', 'Rust', 'TypeScript', 'JavaScript',
        'Scala', 'Kotlin', 'Swift', 'PHP', 'Ruby', 'Shell', 'SQL',
        'Git', 'Maven', 'Gradle', 'CMake', 'Lua', 'Perl', 'MATLAB',
        # 前端框架
        'React', 'Vue', 'Angular', 'Svelte', 'Next.js', 'Nuxt', 'HTML', 'CSS',
        'Node.js', 'jQuery', 'Webpack', 'Vite', 'Tailwind', 'Ant Design',
        'Element Plus', 'Taro', 'uni-app', 'Electron',
        # 后端框架
        'Spring Boot', 'Spring Cloud', 'Django', 'Flask', 'FastAPI', 'Express', 'ELK',
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
        'Linux', 'AWS', '阿里云', '腾讯云', '华为云', 'Serverless', 'GitLab', 'GitLab CI', 'ArgoCD',
        'Prometheus', 'Grafana', 'Istio', 'Consul', 'Vault', 'Ansible', 'Vagrant',
        'Harbor', 'RabbitMQ', 'RocketMQ',
        # 公有云与云基础设施
        'GCP', 'Azure', 'EC2', 'S3', 'Lambda', 'VPC', 'CloudFormation',
        'CloudWatch', 'EKS', 'AKS', 'Serverless Framework',
        # 安全/测试
        '渗透测试', 'Burp Suite', 'Metasploit', 'Selenium', 'JMeter', 'Postman',
        'OWASP', 'Nessus', 'Wireshark', 'Appium', 'LoadRunner', 'SonarQube',
        'ZAP', 'Nmap', 'SIEM', 'IDS/IPS', 'Firewall', 'Cryptography',
        'Incident Response', 'Risk Assessment', 'Malware Analysis',
        'Digital Forensics', 'Zero Trust', 'WAF',
        # 前端框架补充
        'Jest', 'Vitest', 'Cypress', 'Playwright', 'Flutter', 'React Native',
        'Redux', 'Pinia', 'Zustand', 'SASS', 'Less',
        # 机器学习工程 / MLOps
        'Scikit-learn', 'XGBoost', 'LightGBM', 'CUDA', 'ONNX', 'Kubeflow',
        'MLflow', 'Feast', 'Feature Store', 'Model Serving', 'Data Pipeline',
        '机器学习', '深度学习', '强化学习', '计算机视觉', '自然语言处理',
        '特征工程', 'A/B Testing', '统计分析', 'Data Visualization',
        # 英文常见写法（文本写英文、标准名归一为中文，两侧都要能命中）
        'Machine Learning', 'Deep Learning', 'Penetration Testing',
        'REST APIs', 'REST API', 'Networking', 'IAM', 'Bash', 'Jupyter',
        'Responsive Design', 'Statistical Analysis', 'Data Pipelines',
        # 移动端
        'iOS', 'Android', 'Core Data', 'App Store', 'Firebase',
        'Push Notifications', 'SwiftUI', 'UIKit', 'ARKit',
        # 架构/分布式
        '微服务', 'Microservices', '分布式', '高并发', '架构设计', '分布式事务', '分布式缓存',
        '消息队列', '负载均衡', '服务网格', 'DDD', '链路追踪', 'SkyWalking',
        'Seata', 'Nacos', 'Sentinel',
    ]
    text_lower = text.lower()
    found = [s for s in skill_keywords if _kw_hit(s, text_lower)]
    # 「GitLab CI」命中时不再单独算一条 GitLab，避免同一概念在简历里出现两次
    _more_specific = {'GitLab': 'GitLab CI'}
    found = [s for s in found if not (s in _more_specific and _more_specific[s] in found)]
    result['skills'] = found

    # 学历（中英双写法：英文简历写 Bachelor/Master/PhD）
    for edu in ['博士', '硕士', '本科', '大专']:
        if edu in text:
            result['education'] = edu
            break
    else:
        for pat, label in ((r'\bPh\.?D\b|Doctor', '博士'),
                           (r'\bMaster', '硕士'),
                           (r'\bBachelor', '本科'),
                           (r'\bAssociate', '大专')):
            if re.search(pat, text, re.I):
                result['education'] = label
                break

    # 学校
    # 注意不能用「大学」当标签再取后面的词：简历里「河南工业大学  本科」这种写法
    # 会把「本科」当成学校名（之前线上就抽成 school='本科'）。标签必须带冒号。
    m = re.search(r'(?:学校|院校|毕业院校)[：:]\s*(\S{2,20})', text)
    if m:
        result['school'] = re.sub(r'^(毕业于|就读于|来自)', '', m.group(1))
    else:
        m = re.search(r'([\u4e00-\u9fa5A-Za-z]{2,15}(?:大学|学院))', text)
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


def _parse_json_loose(text: str) -> dict | None:
    """容错解析模型输出（可能带 markdown 包裹或前后解释文字）"""
    if not text:
        return None
    try:
        return json.loads(text)
    except Exception:
        pass
    m = re.search(r'```(?:json)?\s*([\s\S]*?)```', text)
    if m:
        try:
            return json.loads(m.group(1))
        except Exception:
            pass
    m = re.search(r'\{[\s\S]*\}', text)
    if m:
        try:
            return json.loads(m.group(0))
        except Exception:
            pass
    return None


RESUME_EXTRACT_PROMPT = (
    '你是简历信息抽取器。只输出 JSON，不要任何解释或 markdown。\n'
    '规则：只抽有明确文本证据的内容；抽不到就留空字符串或空数组；禁止编造公司、学校、时间。\n'
    '返回字段：\n'
    '- name 姓名；phone 11 位手机号（去掉空格和横线）；email 邮箱；\n'
    '- school 学校全称；education 学历（博士/硕士/本科/大专）；\n'
    '- target_position 求职意向/期望岗位；location 现居城市；\n'
    '- experience 工作经历摘要（1-2 句）；bio 自我评价（≤200 字）；\n'
    '- skills 技术技能标签数组（保留原文写法）；\n'
    '- years_of_experience 经验年限，如 "3年"；\n'
    '- work_experience: [{company, position, location, startDate, endDate, current, description, technologies[], highlights[]}]，'
    '日期格式 YYYY-MM，在职时 endDate 留空且 current=true；\n'
    '- education_items: [{institution, degree, field, startDate, endDate, highlights[]}]；\n'
    '- projects: [{name, role, startDate, endDate, description, technologies[], highlights[]}]。\n'
    'highlights 每段 2-4 条，保留原文数字与指标。'
)


def deepseek_extract(text: str) -> dict | None:
    """用大模型抽取简历字段（走 services/llm.py 的统一路由层）

    与模型配置页联动：管理员关掉 AI 或处于 Mock 模式时直接返回 None，
    由规则路径兜底。Mock 返回的是示例简历（张小明），绝不能当解析结果用。
    """
    if not text or not text.strip():
        return None
    try:
        from services.llm import complete, LLMTier, is_mock_mode, is_global_enabled
        if is_mock_mode() or not is_global_enabled():
            return None
        result = complete(
            LLMTier.FAST,
            RESUME_EXTRACT_PROMPT,
            [{'role': 'user', 'content': f'简历原文：\n{text[:6000]}'}],
            json_mode=True,
            max_tokens=2600,
        )
    except Exception:
        # 没配 key / 网络不通 / 上游 5xx —— 一律回退规则路径，不要让上传失败
        return None

    raw = result.get('raw') or _parse_json_loose(result.get('text', ''))
    if not isinstance(raw, dict):
        return None
    return raw


def parse_resume(file_path: str) -> dict:
    """主入口：提取文本（文本层 / OCR / .doc 转换）→ 大模型优先 → 规则兜底"""
    try:
        text, via = extract_text_detail(file_path)
    except TextExtractError as e:
        return {'success': False, 'message': str(e), 'data': {}}
    if not text.strip():
        return {'success': False, 'message': '无法提取文本内容', 'data': {}}

    # 大模型优先
    llm_result = deepseek_extract(text)

    # 规则兜底
    rule_result = rule_based_extract(text)

    # 合并：大模型结果优先，但空值不覆盖规则抽取到的内容。
    # 原因：模型经常把 name/school 这类字段留空（或返回空数组），
    # 直接 {**rule, **llm} 会把规则已经正确抽到的姓名冲掉。
    final = dict(rule_result)
    for key, value in (llm_result or {}).items():
        if isinstance(value, str):
            if value.strip():
                final[key] = value.strip()
        elif isinstance(value, list):
            if value:
                final[key] = value
        elif value not in (None, ''):
            final[key] = value

    # 质检：置信度评分 + 原文溯源
    from services.quality_checker import score_skills, trace_skills
    scored = score_skills(final.get('skills', []), text, method='deepseek' if llm_result else 'rule_based')
    traces = trace_skills(final.get('skills', []), text)

    return {
        'success': True,
        'data': {
            **final,
            'raw_text_preview': text[:3000],
            'extract_via': via,
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
            os.getenv('DEEPSEEK_BASE_URL', 'https://api.deepseek.com/v1').rstrip('/') + '/chat/completions',
            headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'},
            json={
                'model': os.getenv('DEEPSEEK_MODEL', 'deepseek-chat'),
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
    from services.evidence_extraction import verify_skill_quote
    rule_items = _jd_rule_extract(text)
    llm_items = _jd_llm_extract(text)
    _dict_lower = {s.lower() for s in _JD_SKILLS}

    merged: list[dict] = []
    novel_candidates: list[dict] = []
    seen: set[str] = set()

    def _has_evidence(skill: str) -> bool:
        return any(re.search(p, text, flags) for p, flags in _term_patterns(skill)) or \
               bool(_evidence_sentences(skill, text)[0] != '(原文未找到明确提及)')

    for it in llm_items:
        if not isinstance(it, dict):
            continue
        s = str(it.get('skill', '')).strip()
        if not s or not _has_evidence(s):
            continue  # 幻觉过滤：无原文证据即剔除
        canonical = s.lower()
        for std, syns in SYNONYM_MAP.items():
            if s.lower() == std or s.lower() in syns:
                canonical = std
                break
        quote = verify_skill_quote(text, s, str(it.get('evidence', '')))
        # Open vocabulary is useful for emerging roles, but never merge an
        # unreviewed concept into the canonical skill graph.
        if canonical not in _dict_lower and canonical not in SYNONYM_MAP:
            if quote is not None:
                novel_candidates.append({'skill': s, 'evidence': quote,
                                         'status': 'review_required'})
            continue
        if canonical in seen:
            continue
        seen.add(canonical)
        # Never return a model-invented quote. Recover a literal rule sentence
        # only for an already-known concept; novel concepts require a valid quote.
        ev = quote['quote'] if quote is not None else _evidence_sentences(s, text)[0]
        if ev == '(原文未找到明确提及)' or ev not in text:
            continue
        merged.append({'skill': canonical, 'evidence': [ev]})

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
            'novel_candidates': novel_candidates,
            'method': 'llm+rule' if llm_items else 'rule'}
