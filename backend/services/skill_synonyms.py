"""
技能同义词扩展表 + 预处理 + 邻近度计算

标准化流程：
  原始输入 → normalize_preprocess（去版本号/空格/后缀）→ SYNONYM_MAP 查表 → 标准名

@owner: 我和吴家（新岗位发现+求职端趋势+企业端市场洞察）
"""

import re
from typing import Optional

# ──────────────────────────────────────────────
# 同义词表：标准名 → 变体列表
# ──────────────────────────────────────────────

SYNONYM_MAP: dict[str, list[str]] = {
    # ── 编程语言 ──
    "java": ["java8", "java11", "java17", "java21", "jdk", "jdk8", "jdk17"],
    "python": ["python3", "py3", "python2", "py2"],
    "javascript": ["js", "es6", "es2015", "es2020"],
    "typescript": ["ts"],
    "c/c++": ["c++", "cpp", "c语言", "c plus plus"],
    "go": ["golang", "go语言"],
    "rust": ["rust语言"],
    "php": ["php7", "php8"],
    "swift": ["swift语言", "swift5"],
    "kotlin": ["kotlin语言", "kt"],
    "scala": ["scala语言"],
    "r语言": ["r", "r lang"],
    "sql": ["structured query language", "sql语言"],

    # ── 前端 ──
    "vue": ["vue3", "vue2", "vuejs", "vue.js", "vue3.x"],
    "react": ["reactjs", "react.js", "react18"],
    "angular": ["angularjs", "angular2+", "ng"],
    "html": ["html5", "html/css"],
    "css": ["css3", "scss", "sass", "less", "tailwind", "tailwindcss"],
    "jquery": ["jq"],
    "svelte": ["sveltejs"],

    # ── 后端框架 ──
    "spring boot": ["springboot", "spring-boot", "java spring", "spring 框架", "spring framework"],
    "spring cloud": ["springcloud", "spring-cloud"],
    "django": ["django框架"],
    "flask": ["flask框架"],
    "fastapi": ["fast api", "fastapi框架"],
    "express": ["express.js", "expressjs", "express框架"],
    "laravel": ["laravel框架", "php框架"],
    "gin": ["gin框架", "go框架"],
    "node.js": ["nodejs", "node", "node.js框架"],
    "spring": ["spring框架", "spring mvc", "springmvc"],

    # ── 数据库 ──
    "mysql": ["mysql数据库"],
    "postgresql": ["postgres", "pg", "pg数据库"],
    "mongodb": ["mongo", "mongo数据库"],
    "nosql": ["no sql", "非关系型数据库"],
    "redis": ["redis 缓存", "分布式缓存", "缓存层", "redis数据库"],
    "elasticsearch": ["es", "elastic search", "elastic", "搜索引擎"],
    "sqlite": ["sqlite数据库"],
    "oracle": ["oracle数据库"],
    "sql server": ["mssql", "microsoft sql server"],
    "hbase": ["hbase数据库"],
    "neo4j": ["neo4j图数据库", "图数据库"],
    "cassandra": ["cassandra数据库"],

    # ── 大数据 ──
    "hadoop": ["hadoop生态", "hdfs", "mapreduce"],
    "spark": ["pyspark", "spark sql", "spark streaming"],
    "flink": ["apache flink", "flink流处理"],
    "kafka": ["apache kafka", "消息队列", "mq", "kafka消息队列"],
    "hive": ["hive数据仓库", "hive sql"],
    "hbase": ["hbase大数据"],
    "storm": ["apache storm"],
    "大数据": ["big data", "大数据技术"],

    # ── AI / 机器学习 ──
    "机器学习": ["machine learning", "ml", "统计学习"],
    "深度学习": ["deep learning", "dl", "神经网络"],
    "计算机视觉": ["cv", "computer vision", "图像处理", "视觉"],
    "nlp": ["自然语言处理", "nlu", "文本挖掘", "文本处理"],
    "pytorch": ["py torch", "torch"],
    "tensorflow": ["tf", "tensor flow"],
    "keras": ["keras框架"],
    "scikit-learn": ["sklearn", "scikit learn"],
    "pandas": ["pandas数据分析"],
    "numpy": ["np", "numpy数组"],
    "数据科学": ["data science", "ds"],
    "数据分析": ["data analysis", "数据分析工具"],
    "数据挖掘": ["data mining"],
    "推荐系统": ["recommendation system", "推荐算法"],
    "自动驾驶": ["autonomous driving", "无人车"],

    # ── 大模型 / AI 应用 ──
    "大模型": ["llm", "large language model", "基础模型", "gpt", "通用人工智能", "大语言模型"],
    "rag": ["retrieval augmented generation", "检索增强生成", "知识检索", "检索增强"],
    "agent": ["智能体", "ai agent", "llm agent", "ai 智能体"],
    "langchain": ["lang chain", "lang-chain", "langchain框架"],
    "prompt engineering": ["提示词工程", "提示工程", "prompt设计", "提示词"],
    "向量数据库": ["vector database", "vectordb", "milvus", "pinecone", "weaviate", "chroma"],
    "transformer": ["transformer模型", "注意力机制", "attention"],
    "aigc": ["ai生成内容", "生成式ai", "generative ai"],

    # ── DevOps / 云 ──
    "docker": ["container", "容器", "容器化", "docker容器"],
    "kubernetes": ["k8s", "kube", "k8", "容器编排"],
    "ci/cd": ["cicd", "持续集成", "持续部署", "持续交付"],
    "devops": ["devops", "运维开发", "开发运维"],
    "jenkins": ["jenkins CI"],
    "terraform": ["iac", "基础设施即代码"],
    "ansible": ["ansible自动化"],
    "linux": ["linux系统", "linux运维", "ubuntu", "centos", "debian", "redhat"],
    "nginx": ["engine x", "反向代理", "nginx服务器"],
    "git": ["版本控制", "版本管理", "git管理"],
    "maven": ["apache maven", "mvn"],
    "gradle": ["gradle构建"],

    # ── 云平台 ──
    "阿里云": ["alicloud", "aliyun", "阿里云平台"],
    "腾讯云": ["tencent cloud", "tencentcloud"],
    "aws": ["amazon web services", "亚马逊云"],
    "azure": ["microsoft azure", "微软云"],
    "gcp": ["google cloud", "谷歌云"],
    "云计算": ["cloud computing", "云平台"],

    # ── 消息 / 中间件 ──
    "rabbitmq": ["rabbit mq", "消息中间件"],
    "rocketmq": ["rocket mq", "apache rocketmq"],
    "dubbo": ["apache dubbo", "dubbo3", "dubbo框架"],
    "mybatis": ["mybatis-plus", "mybatis 框架", "mybatis-flex", "mybatis框架"],
    "hibernate": ["hibernate框架", "orm"],

    # ── 架构 / 理念 ──
    "微服务": ["microservice", "microservices", "soa", "服务化"],
    "分布式": ["分布式系统", "distributed system", "分布式架构"],
    "高并发": ["high concurrency", "并发编程", "高性能", "高可用"],
    "架构设计": ["系统架构", "架构", "方案设计", "软件架构"],
    "restful": ["rest", "rest api", "rest apis", "restful api"],
    "graphql": ["graph ql"],
    "websocket": ["ws", "web socket"],
    "grpc": ["g rpc", "google rpc"],

    # ── 移动端 ──
    "android": ["安卓", "android开发", "android开发"],
    "ios": ["ios开发", "apple开发"],
    "flutter": ["flutter框架", "dart"],
    "react native": ["rn", "react-native"],
    "小程序": ["微信小程序", "miniprogram", "小程序开发"],
    "uni-app": ["uniapp", "uni app"],

    # ── 安全 ──
    "网络安全": ["cybersecurity", "信息安全", "网络攻防"],
    "渗透测试": ["penetration testing", "pentest", "安全测试"],
    "漏洞挖掘": ["vulnerability", "漏洞分析"],

    # ── 其他 ──
    "区块链": ["blockchain", "web3", "以太坊", "ethereum"],
    "物联网": ["iot", "internet of things", "嵌入式"],
    "ar/vr": ["ar", "vr", "混合现实", "mr", "xr", "增强现实", "虚拟现实"],
    "shell": ["bash", "shell脚本", "shell编程"],
    "markdown": ["md", "markdown语法"],
    "办公软件": ["office", "word", "excel", "ppt"],
}

# ──────────────────────────────────────────────
# 邻近技能表（学了 A 推荐学 B）
# ──────────────────────────────────────────────

ADJACENT_SKILLS: dict[str, list[str]] = {
    "docker": ["kubernetes", "ci/cd", "linux"],
    "kubernetes": ["docker", "terraform", "ci/cd"],
    "java": ["spring boot", "mybatis", "maven"],
    "spring boot": ["java", "mybatis", "spring cloud", "mysql"],
    "python": ["django", "flask", "fastapi", "pytorch", "tensorflow"],
    "vue": ["javascript", "typescript", "node.js"],
    "react": ["javascript", "typescript", "node.js"],
    "mysql": ["redis", "postgresql", "sql"],
    "redis": ["mysql", "缓存层"],
    "spark": ["hadoop", "kafka", "flink"],
    "kafka": ["flink", "rabbitmq", "spark"],
    "nlp": ["大模型", "langchain", "rag"],
    "大模型": ["langchain", "rag", "agent", "transformer"],
    "langchain": ["rag", "agent", "大模型"],
    "ci/cd": ["docker", "kubernetes", "jenkins", "git"],
    "linux": ["docker", "nginx", "shell"],
    "github": ["gh"],
    "gitlab": ["gl"],
    "mybatis": ["java", "spring boot", "mysql"],
    "微服务": ["分布式", "spring cloud", "dubbo", "kubernetes"],
    "分布式": ["微服务", "高并发", "kafka", "redis"],
    "机器学习": ["深度学习", "pytorch", "tensorflow", "数据科学"],
    "深度学习": ["机器学习", "pytorch", "tensorflow", "计算机视觉"],
    "计算机视觉": ["深度学习", "pytorch", "图像处理"],
    "pytorch": ["深度学习", "机器学习", "tensorflow"],
    "tensorflow": ["深度学习", "机器学习", "pytorch"],
}

# ──────────────────────────────────────────────
# 预处理：去版本号、空格、后缀 → 统一格式
# ──────────────────────────────────────────────

# 需要去掉的后缀（在 normalize 时剥离）
_SUFFIXES = [
    "框架", "语言", "技术", "工具", "平台", "开发", "编程",
    "系统", "数据库", "服务器", "平台", "引擎",
]

# 特殊大小写映射（小写 -> 正确的 Title Case）
_CASE_MAP = {
    # 编程语言
    'python': 'Python', 'java': 'Java', 'javascript': 'JavaScript',
    'typescript': 'TypeScript', 'go': 'Go', 'rust': 'Rust', 'c/c++': 'C/C++',
    'c': 'C', 'c#': 'C#', 'kotlin': 'Kotlin', 'swift': 'Swift', 'r': 'R',
    'php': 'PHP', 'scala': 'Scala', 'ruby': 'Ruby', 'lua': 'Lua', 'dart': 'Dart',
    # 前端
    'react': 'React', 'vue': 'Vue', 'angular': 'Angular', 'svelte': 'Svelte',
    'html': 'HTML', 'css': 'CSS', 'node': 'Node.js', 'tailwindcss': 'TailwindCSS',
    'nextjs': 'Next.js', 'nuxtjs': 'Nuxt.js', 'webpack': 'Webpack', 'vite': 'Vite',
    # 后端 & 框架
    'spring boot': 'Spring Boot', 'spring cloud': 'Spring Cloud', 'spring': 'Spring',
    'mybatis': 'MyBatis', 'django': 'Django', 'flask': 'Flask', 'fastapi': 'FastAPI',
    'express': 'Express', 'gin': 'Gin', 'springboot+vue': 'SpringBoot+Vue',
    'ssm': 'SSM', 'ssm+vue': 'SSM+Vue',
    # 数据库
    'mysql': 'MySQL', 'postgresql': 'PostgreSQL', 'oracle': 'Oracle',
    'sql server': 'SQL Server', 'mongodb': 'MongoDB', 'elasticsearch': 'Elasticsearch',
    'redis': 'Redis', 'hbase': 'HBase', 'neo4j': 'Neo4j', 'influxdb': 'InfluxDB',
    # 大数据 & AI
    'hadoop': 'Hadoop', 'spark': 'Spark', 'flink': 'Flink', 'kafka': 'Kafka',
    'pytorch': 'PyTorch', 'tensorflow': 'TensorFlow', 'keras': 'Keras',
    'scikit-learn': 'Scikit-learn', 'xgboost': 'XGBoost', 'lightgbm': 'LightGBM',
    'pandas': 'Pandas', 'numpy': 'NumPy', 'opencv': 'OpenCV',
    'langchain': 'LangChain', 'llamaindex': 'LlamaIndex',
    # DevOps & 云
    'docker': 'Docker', 'kubernetes': 'Kubernetes', 'jenkins': 'Jenkins',
    'gitlab ci': 'GitLab CI', 'ansible': 'Ansible', 'terraform': 'Terraform',
    'aws': 'AWS', 'azure': 'Azure', 'gcp': 'GCP', 'aliyun': '阿里云',
    'nginx': 'Nginx', 'apache': 'Apache', 'tomcat': 'Tomcat',
    'git': 'Git', 'github': 'GitHub', 'gitlab': 'GitLab',
    # 消息 & 中间件
    'rabbitmq': 'RabbitMQ', 'rocketmq': 'RocketMQ', 'activemq': 'ActiveMQ',
    'zookeeper': 'Zookeeper', 'etcd': 'Etcd', 'consul': 'Consul',
    # 移动 & 安卓
    'android': 'Android', 'ios': 'iOS', 'react native': 'React Native',
    'flutter': 'Flutter', 'uni-app': 'Uni-App', 'swiftui': 'SwiftUI',
    # 安全
    'owasp': 'OWASP', 'sql注入': 'SQL注入', 'xss': 'XSS',
    # 其他
    'ci/cd': 'CI/CD', 'linux': 'Linux', 'vim': 'Vim', 'jetpack compose': 'Jetpack Compose',
    'rag': 'RAG', 'nlp': 'NLP', 'cv': 'CV', 'ai': 'AI', 'bi': 'BI',
    'nosql': 'NoSQL', 'rpa': 'RPA', 'uml': 'UML', 'soa': 'SOA', 'sql': 'SQL',
    'microservices': 'Microservices', 'graphql': 'GraphQL', 'restful': 'RESTful',
    'etl': 'ETL', 'datax': 'DataX', 'kettle': 'Kettle',
    'clickhouse': 'ClickHouse', 'presto': 'Presto', 'trino': 'Trino',
    'doris': 'Doris', 'druid': 'Druid', 'starrocks': 'StarRocks',
    'mpvue': 'MpVue', 'taro': 'Taro', 'weex': 'Weex',
    'cocoa': 'Cocoa', 'xamarin': 'Xamarin', 'gradle': 'Gradle',
    'maven': 'Maven', 'npm': 'NPM', 'pip': 'Pip',
}

def normalize_preprocess(skill: str) -> str:
    """
    技能名预处理：
    1. 去首尾空格 + lower
    2. 去版本号（Java 8 → java, Python3.11 → python）
    3. 去常见后缀（Java语言 → java, Django框架 → django）
    4. 统一分隔符（react.js → react）
    """
    s = skill.strip().lower()
    if not s:
        return ""

    # 去版本号：Python3.11 → python, Java 8 → java, ES2020 → es
    s = re.sub(r'[\s]*\d+(\.\d+)*\s*$', '', s)
    # 去 "v" 前缀版本：Vue3 → vue, Node16 → node
    s = re.sub(r'[\s]*v?\d+(\.\d+)*\s*$', '', s)

    # 去常见后缀
    for suffix in _SUFFIXES:
        if s.endswith(suffix) and len(s) > len(suffix):
            s = s[:-len(suffix)].strip()

    # 统一分隔符：react.js → react, node.js → node
    s = s.replace('.js', '').replace('.ts', '')
    # 只去 - 和 _，保留空格（多词技能如 "spring boot" 需要空格）
    s = s.replace('-', '').replace('_', '')

    return s


# ──────────────────────────────────────────────
# 构建反向索引
# ──────────────────────────────────────────────

def _build_reverse_map() -> dict:
    reverse: dict[str, list[str]] = {}
    for standard, synonyms in SYNONYM_MAP.items():
        std_key = normalize_preprocess(standard)
        all_variants = [normalize_preprocess(s) for s in synonyms]
        # 每个变体 → 标准名 + 其他变体
        for v in all_variants:
            if v not in reverse:
                reverse[v] = []
            if std_key not in reverse[v]:
                reverse[v].append(std_key)
            for other in all_variants:
                if other != v and other not in reverse[v]:
                    reverse[v].append(other)
        # 标准名 → 所有变体
        if std_key not in reverse:
            reverse[std_key] = []
        for v in all_variants:
            if v not in reverse[std_key]:
                reverse[std_key].append(v)
    return reverse


_REVERSE_MAP = _build_reverse_map()

# 标准名也加入反向索引（标准名 → 同义词列表）
for _std, _syns in SYNONYM_MAP.items():
    _k = normalize_preprocess(_std)
    if _k not in _REVERSE_MAP:
        _REVERSE_MAP[_k] = []
    for _s in _syns:
        _sk = normalize_preprocess(_s)
        if _sk not in _REVERSE_MAP[_k]:
            _REVERSE_MAP[_k].append(_sk)


# ──────────────────────────────────────────────
# 公开 API
# ──────────────────────────────────────────────

def normalize_skill(skill: str) -> list[str]:
    """返回技能的所有等价名称（含原始名）"""
    s = normalize_preprocess(skill)
    if not s:
        return []
    result = {s}
    if s in SYNONYM_MAP:
        result.update(SYNONYM_MAP[s])
    if s in _REVERSE_MAP:
        result.update(_REVERSE_MAP[s])
    return sorted(result)


def is_synonym(s1: str, s2: str) -> bool:
    """判断两个技能名是否为同义词"""
    a = normalize_preprocess(s1)
    b = normalize_preprocess(s2)
    if not a or not b:
        return False
    if a == b:
        return True
    if a in SYNONYM_MAP and b in SYNONYM_MAP[a]:
        return True
    if b in SYNONYM_MAP and a in SYNONYM_MAP[b]:
        return True
    if a in _REVERSE_MAP and b in _REVERSE_MAP[a]:
        return True
    if b in _REVERSE_MAP and a in _REVERSE_MAP[b]:
        return True
    return False


def get_skill_popularity(skill: str, all_jobs: Optional[list[dict]] = None) -> float:
    """技能在所有岗位中的出现比例"""
    if not all_jobs:
        try:
            from routers.jobs import load_all_jobs
            all_jobs = load_all_jobs()
        except ImportError:
            return 0.0
    s = normalize_preprocess(skill)
    if not s:
        return 0.0
    count = sum(
        1 for jd in all_jobs
        if any(s == normalize_preprocess(js) or is_synonym(s, js) for js in jd.get("skills", []))
    )
    return round(count / max(len(all_jobs), 1), 3)


def has_adjacent_skill(skill: str, profile_skills: list[str]) -> bool:
    """用户是否掌握了邻接技能"""
    s = normalize_preprocess(skill)
    profile_set = {normalize_preprocess(x) for x in profile_skills}
    for adj in ADJACENT_SKILLS.get(s, []):
        adj_key = normalize_preprocess(adj)
        if adj_key in profile_set:
            return True
        if any(is_synonym(adj, ps) for ps in profile_skills):
            return True
    return False


def best_match_in_profile(jd_skill: str, profile_skills: list[str]) -> Optional[str]:
    """在用户技能列表中找到 JD 技能的最佳匹配，返回原始技能名"""
    s = normalize_preprocess(jd_skill)
    for ps in profile_skills:
        ps_key = normalize_preprocess(ps)
        if not ps_key:
            continue
        if s == ps_key or is_synonym(jd_skill, ps):
            return ps
    return None


# 已知易混淆的包含对 — 子串成立但语义不同（防误判黑名单，与企业端 match_engine 口径一致）
_CONFUSABLE_CONTAINMENT = {('java', 'javascript'), ('javascript', 'java')}


def containment_match(jd_skill: str, profile_skills: list[str]) -> Optional[str]:
    """
    子串包含匹配（L3 级部分匹配）：JD 技能是求职者技能的子串（或反之）。
    如 JD 写 "ReactJS"，用户技能是 "React" → 返回 "React"。

    防误判规则：
        - 较短一方长度 ≥ 4（排除 "js" ⊂ "json" 这类短词误判）
        - 黑名单对（java ⊄ javascript，语义不同不算匹配）

    返回匹配到的用户技能名（原始大小写）；无匹配返回 None。
    供 match_analyzer 计算部分得分（×0.7）使用。
    """
    jd_key = normalize_preprocess(jd_skill)
    if len(jd_key) < 4:
        return None
    for ps in profile_skills:
        ps_key = normalize_preprocess(ps)
        if len(ps_key) < 4:
            continue
        if (jd_key, ps_key) in _CONFUSABLE_CONTAINMENT or (ps_key, jd_key) in _CONFUSABLE_CONTAINMENT:
            continue
        if jd_key in ps_key or ps_key in jd_key:
            return ps
    return None


def canonical_name(skill: str) -> str:
    """
    返回技能的标准名（Title Case，用于存储和显示）
    例：Python3 → Python, machine learning → 机器学习, react.js → React, Docker → Docker
    找不到映射时返回预处理结果的 Title Case
    """
    key = normalize_preprocess(skill)
    if not key:
        return skill.strip()
    # 从 SYNONYM_MAP 找标准名
    if key in SYNONYM_MAP:
        return _CASE_MAP.get(key, key)
    # 从反向索引找标准名
    if key in _REVERSE_MAP:
        for candidate in _REVERSE_MAP[key]:
            if candidate in SYNONYM_MAP:
                return _CASE_MAP.get(candidate, candidate)
    # 找不到映射，返回预处理结果（尝试 Title Case）
    return _CASE_MAP.get(key, key)
