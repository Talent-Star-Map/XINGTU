"""
GitHub Repository Domain Filter

L1:
判断GitHub仓库是否属于IT技术领域

负责:
1. AI生态
2. 云原生
3. 软件工程
4. 数据工程
5. 数据库
6. 架构系统
7. 开发工具

不负责:
- 热度判断
- 技术趋势判断
- 企业实践价值判断
"""


import re


# ==============================
# GitHub 技术领域关键词
# 只用于领域判断
# ==============================


DOMAIN_KEYWORDS = [

    # AI / LLM
    "llm", "large language model", "generative ai", "ai agent", "agent framework",
    "rag", "retrieval augmented generation", "embedding", "vector database", "machine learning",
    "deep learning", "pytorch", "tensorflow", "artificial intelligence", "aigc",
    "llama", "qwen", "chatgpt", "transformers",
    "diffusion model", "computer vision", "nlp",
    "人工智能", "大模型", "大语言模型", "智能体", "智能体开发",
    "生成式人工智能", "机器学习", "深度学习", "自然语言处理", "计算机视觉",
    "多模态模型", "知识库", "知识库问答", "检索增强生成",

    # Cloud Native
    "kubernetes", "docker", "container", "cloud native", "service mesh",
    "terraform", "helm", "containerd", "istio", "envoy",
    "prometheus", "grafana", "argo", "argocd", "cloud computing",
    "infrastructure as code",
    "云原生", "云原生架构", "容器化", "微服务", "DevOps",
    "持续集成", "持续部署", "可观测性", "SRE",

    # Backend
    "backend", "microservice", "distributed system",
    "middleware", "gateway", "spring", "spring boot", "spring cloud",
    "java backend", "golang backend", "grpc", "rpc", "message queue",
    "mq", "rocketmq", "kafka", "rabbitmq", "netty",
    "后端", "后端开发", "分布式系统", "分布式架构", "微服务架构",
    "消息队列", "中间件", "高并发", "高可用", "系统架构",

    # Frontend
    "frontend", "react", "vue", "typescript", "javascript",
    "angular", "svelte", "next.js", "nuxt", "vite",
    "webpack", "electron", "web development", "ui framework", "component library",
    "前端", "前端开发", "前端工程化", "前端架构", "Web开发", "组件库",

    # Data
    "data engineering", "data platform", "data warehouse", "data lake", "spark",
    "flink", "hadoop", "big data", "stream processing", "real time computing",
    "etl", "airflow", "iceberg", "trino", "presto",
    "数据工程", "数据平台", "数据仓库", "数据湖", "实时计算",
    "大数据", "数据治理", "数据管道",

    # Database
    "database", "storage engine", "redis", "mysql", "postgresql",
    "mongodb", "elasticsearch", "clickhouse", "tidb", "oceanbase",
    "distributed database", "nosql", "sql",
    "数据库", "数据库系统", "数据库架构", "缓存", "存储系统", "分布式数据库",

    # DevOps
    "devops", "ci/cd", "gitops", "observability", "jenkins",
    "github actions", "gitlab ci", "monitoring", "logging",
    "sre", "release engineering",
    "DevOps实践", "自动化运维", "持续交付", "持续部署", "监控系统",
    "日志系统", "运维平台", "云平台",

    # Programming language
    "python", "java", "golang", "rust", "c++",
    "cpp", "c#", "kotlin", "swift", "php",
    "ruby",

    #Security
    "cyber security", "security", "network security", "application security", "oauth",
    "jwt", "openssl", "firewall", "vulnerability",
    "网络安全", "应用安全", "安全工程", "漏洞分析", "身份认证", "安全体系",

    #Operating System / Infrastructure
    "linux", "kernel", "operating system", "compiler", "runtime",
    "virtual machine",
    "操作系统", "内核", "编译器", "虚拟化", "基础设施",

]


# ==============================
# 基础排除关键词
# ==============================


EXCLUDE_KEYWORDS = [

    "wallpaper", "game", "anime", "music", "movie",
    "font", "theme", "icon", "website template", "blog template",
    "portfolio template", "resume template", "tutorial only", "course", "learning",
    "awesome list", "collection", "ebook", "book", "interview",
    "cheatsheet", "developer roadmap",
]


def normalize_text(text):

    if not text:
        return ""
    return re.sub(
        r"\s+",
        " ",
        str(text)
    ).lower()



def is_github_domain(repository):

    """
    判断GitHub仓库是否属于IT技术领域

    判断顺序:

    tags
    title
    summary
    language
    README前500字符

    """

    title = repository.get(
        "title",
        ""
    )
    summary = repository.get(
        "summary",
        ""
    )
    language = repository.get(
        "language",
        ""
    )
    tags = repository.get(
        "tags",
        []
    )
    content = repository.get(
        "content",
        ""
    )
    text_parts = []
    if tags:
        for tag in tags:
            if isinstance(tag, str):
                text_parts.append(tag)
    text_parts.append(title)
    text_parts.append(summary)
    text_parts.append(language)

    if content:
        text_parts.append(
            content[:500]
        )
    text = normalize_text(
        " ".join(
            [
                item
                for item in text_parts
                if isinstance(item, str)
        ]
        )
    )
    # 排除明显非技术仓库
    for keyword in EXCLUDE_KEYWORDS:
        if keyword in text:
            return False

    # 技术领域判断
    for keyword in DOMAIN_KEYWORDS:
        keyword = keyword.lower()
        if keyword in text:
            return True
    return False