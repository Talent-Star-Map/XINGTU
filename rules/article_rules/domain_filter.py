"""Layer 1: IT / Internet domain filter.

This module determines whether an article belongs to the IT / Internet
domain.  It checks the article's category, tags, title, and summary
fields in that order of priority, and returns True as soon as any one
of them matches a known IT keyword.

Usage
-----
    from rules.article_rules.domain_filter import is_it_domain

    if is_it_domain(article_dict):
        ...                     # belongs to IT domain
    else:
        ...                     # not IT, discard

Only Layer-1 logic lives here.
Layer 2 (technical article) and Layer 3 (trend / value) must go into
separate modules.
"""

# ────────────────────────────────────────────────────────────
#  Keyword lists for Layer 1 – IT / Internet domain
# ────────────────────────────────────────────────────────────

CATEGORY_KEYWORDS = [
    "前端", "后端", "人工智能", "ai", "开发", "编程",
    "云原生", "数据库", "运维", "大数据", "移动开发",
    "架构", "软件工程", "测试", "安全", "网络安全",
    "算法", "深度学习", "机器学习", "数据科学",
    "devops", "嵌入式",
    "云计算", "容器", "微服务", "全栈",
    "前端开发", "后端开发", "移动端", "客户端",
    "服务端", "数据处理", "数据分析", "数据挖掘",
    "游戏开发", "渲染", "计算机视觉",
    "计算机网络", "操作系统", "编译原理",
    "ui", "ux",
    "机器人", "自动驾驶",
    "分布式", "高并发", "高可用",
    "性能优化", "系统设计",
    "鸿蒙", "harmonyos",
    "it", "互联网", "信息技术",
]

TECH_KEYWORDS = {
    "后端开发": [
        "Java",
        "JVM",
        "Spring",
        "Spring Boot",
        "Spring Cloud",
        "MyBatis",
        "MyBatis Plus",
        "Hibernate",
        "Python",
        "Django",
        "Flask",
        "FastAPI",
        "Go",
        "Gin",
        "C++",
        "C#",
        ".NET",
        "PHP",
        "Node.js",
        "Ruby",
        "微服务",
        "分布式",
        "高并发",
        "服务治理",
        "接口开发",
        "全栈工程师",
        "云计算",
    ],
    "前端开发": [
        "Vue",
        "Vue3",
        "React",
        "Angular",
        "JavaScript",
        "TypeScript",
        "HTML5",
        "CSS3",
        "Webpack",
        "Vite",
        "前端工程化",
        "小程序开发",
    ],
    "移动研发": [
        "Android",
        "iOS",
        "Flutter",
        "鸿蒙开发",
        "HarmonyOS",
        "小程序开发",
        "U3D",
        "Unity",
    ],
    "人工智能/算法": [
        "人工智能",
        "AI",
        "机器学习",
        "深度学习",
        "自然语言处理",
        "NLP",
        "计算机视觉",
        "机器视觉",
        "图像识别",
        "推荐算法",
        "算法工程师",
        "大模型",
        "LLM",
        "RAG",
        "Agent",
        "ChatGPT",
        "AIGC",
    ],
    "数据开发": [
        "数据分析",
        "数据挖掘",
        "大数据",
        "Spark",
        "Flink",
        "数据仓库",
        "数据湖",
        "ETL",
        "BI",
        "Hive",
        "Hadoop",
        "爬虫",
    ],
    "数据库": [
        "MySQL",
        "Oracle",
        "SQL Server",
        "Redis",
        "MongoDB",
        "PostgreSQL",
        "数据库设计",
        "数据库优化",
    ],
    "云原生": [
        "Docker",
        "Kubernetes",
        "K8S",
        "云原生",
        "DevOps",
        "CI/CD",
        "Linux",
        "容器化",
    ],
    "测试": [
        "软件测试",
        "自动化测试",
        "测试开发",
        "性能测试",
        "接口测试",
        "安全测试",
    ],
    "运维安全": [
        "运维工程师",
        "系统工程师",
        "网络工程师",
        "DBA",
        "系统安全",
        "信息安全",
        "渗透测试",
    ],
    "硬件嵌入式": [
        "嵌入式开发",
        "嵌入式",
        "硬件测试",
        "单片机",
        "计算机硬件维护",
    ],
    "IT支持实施": [
        "技术支持工程师",
        "实施工程师",
        "实施顾问",
        "解决方案工程师",
    ],
}

def build_all_keywords():
    """将分类关键词展开为一个列表，用于领域匹配。"""
    keywords = []

    for values in TECH_KEYWORDS.values():
        keywords.extend(values)

    return keywords


ALL_TECH_KEYWORDS = build_all_keywords()

def contains_any(text: str, keywords: list) -> bool:
    """Return True if *text* contains any of the *keywords* (case-insensitive)."""
    if not text:
        return False
    lower_text = text.lower()
    for kw in keywords:
        if kw.lower() in lower_text:
            return True
    return False


def is_it_domain(article: dict) -> bool:
    """Return True if *article* belongs to the IT / Internet domain.

    Checks the following fields in order:
      1. category
      2. tags
      3. title
      4. summary

    Returns True at the first match.  If none matches, returns False.
    """
    # ① category
    category = article.get("category")
    if category and contains_any(category, CATEGORY_KEYWORDS):
        return True

    # ② tags
    tags = article.get("tags")
    if tags:
        if isinstance(tags, list):
            tag_text = " ".join(str(t) for t in tags)
        elif isinstance(tags, str):
            tag_text = tags
        else:
            tag_text = ""

        if contains_any(tag_text, ALL_TECH_KEYWORDS):
            return True

    # ③ title
    title = article.get("title")
    if title and contains_any(title, ALL_TECH_KEYWORDS):
        return True

    # ④ summary
    summary = article.get("summary")
    if summary and contains_any(summary, ALL_TECH_KEYWORDS):
        return True
