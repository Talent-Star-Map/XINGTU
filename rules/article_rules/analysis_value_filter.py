"""Layer 3: Analysis value filter.

Purpose:
Determine whether a technical article is valuable for:

1. Technology trend analysis
2. Technology ecosystem analysis
3. Architecture evolution analysis
4. Enterprise engineering practice analysis
5. Technology route analysis

Layer 1:
IT domain filtering.

Layer 2:
Hard noise filtering.

Layer 3:
Only judges technical analysis value.
"""


from rules.article_rules.domain_filter import TECH_KEYWORDS as _TECH_KEYWORDS_DICT


# ============================================================
# Flatten technology keywords from Layer1
# ============================================================

TECH_KEYWORDS = []

for values in _TECH_KEYWORDS_DICT.values():
    TECH_KEYWORDS.extend(values)


# ============================================================
# Technology trend signals
# ============================================================

TREND_KEYWORDS = [

    "趋势",
    "发展趋势",
    "技术趋势",
    "未来发展",
    "演进",
    "技术演进",
    "替代",
    "升级",

    "人工智能",
    "大模型",
    "LLM",
    "RAG",
    "Agent",
    "AIGC",
    "MCP",

    "云原生",
    "Kubernetes",
    "Serverless",

]


# ============================================================
# Skill / talent analysis signals
# ============================================================

SKILL_KEYWORDS = [

    "技能",
    "技能需求",
    "技术能力",
    "开发能力",
    "技术栈",
    "能力模型",

    "开发者",
    "工程师",
    "人才需求",
    "岗位需求",

    "掌握",
    "需要具备",

]


# ============================================================
# Ecosystem signals
# ============================================================

ECOSYSTEM_KEYWORDS = [

    "技术生态",
    "生态分析",
    "生态演进",
    "生态建设",
    "生态发展",

    "产业生态",
    "开发者生态",
    "开源生态",

    "技术路线",
    "技术体系",

]


# ============================================================
# Technology route analysis signals
# ============================================================

TECH_ROUTE_KEYWORDS = [

    "技术路线",
    "发展路线",
    "演进路线",
    "技术选型",
    "方案对比",
    "架构演进",
    "技术体系",
    "技术生态",

]


# ============================================================
# Report / survey analysis signals
# ============================================================

REPORT_KEYWORDS = [

    "综述",
    "白皮书",
    "报告",
    "调研",
    "总结",
    "全景分析",

]


# ============================================================
# Engineering practice signals
# ============================================================

PRACTICE_KEYWORDS = [

    "实践",
    "落地",
    "应用",

    "企业实践",
    "工程实践",
    "生产环境",

    "企业级",
    "工程化",

    "平台建设",
    "系统建设",

    "项目",
    "解决方案",

]


ENGINEERING_VALUE_KEYWORDS = [

    "开源项目",
    "开源框架",
    "源码",
    "GitHub",

    "框架",
    "平台",
    "系统",

    "接口",
    "API",
    "插件",
    "组件",

    "架构",
    "设计",

    "性能优化",
    "优化方案",

    "集成",
    "扩展",

    "部署方案",
    "解决方案",

]

# ============================================================
# Strong analysis signals
# Direct keep
# ============================================================

STRONG_ANALYSIS_KEYWORDS = [

    "架构设计",
    "架构演进",

    "技术方案",
    "解决方案",

    "技术选型",

    "企业实践",
    "工程实践",

    "生产环境",
    "企业级",

    "工程化",

    "平台建设",
    "系统建设",

]


# ============================================================
# Low value title signals
# Not directly delete.
# Need content verification.
# ============================================================

LOW_VALUE_TITLE_KEYWORDS = [

    "是什么",
    "简介",
    "介绍",
    "概念",

    "区别",

    "入门",
    "基础",
    "零基础",

    "快速入门",

    "安装",
    "配置",
    "环境搭建",

    "部署",
    "部署教程",

    "教程",
    "使用教程",

    "操作指南",
    "使用指南",

    "手把手",
    "保姆级",

]


# ============================================================
# Pure tutorial signals
# ============================================================

PURE_TUTORIAL_KEYWORDS = [

    "零基础",
    "小白",

    "入门",
    "快速入门",
    "入门教程",

    "是什么",
    "简介",
    "介绍",
    "概念",

    "基础",

    "手把手",
    "手把手教你",

    "保姆级",

    "几分钟学会",

    "一步一步",

    "完整教程",

    "安装教程",

    "配置教程",

    "部署教程",

]


# ============================================================
# Tutorial protection signals
# Tutorial can survive when engineering value exists
# ============================================================

TUTORIAL_VALUE_KEYWORDS = [

    "架构设计",
    "架构演进",

    "技术方案",

    "企业实践",
    "工程实践",

    "生产环境",

    "企业级",

    "工程化",

    "系统设计",

    "平台建设",

    "应用落地",

]


# ============================================================
# Security/event content
# ============================================================

EVENT_KEYWORDS = [

    "漏洞",
    "攻击",
    "安全事件",
    "事故",
    "曝光",
    "通报",

]

EVENT_ANALYSIS_KEYWORDS = [

    "治理",
    "防御",
    "体系",
    "架构",
    "安全方案",
    "安全实践",

]

# ============================================================
# Tags low value signals
# Only auxiliary judgment
# ============================================================

LOW_VALUE_TAG_KEYWORDS = [

    "学习",
    "入门",
    "教程",
    "笔记",
    "新手",

]

# ============================================================
# Utils
# ============================================================

def contains_any(text: str, keywords: list) -> bool:

    if not text:
        return False

    text = text.lower()

    for keyword in keywords:
        if keyword.lower() in text:
            return True

    return False


def has_any_analysis_signal(text: str) -> bool:

    return (
        contains_any(text, TREND_KEYWORDS)
        or contains_any(text, SKILL_KEYWORDS)
        or contains_any(text, ECOSYSTEM_KEYWORDS)
        or contains_any(text, PRACTICE_KEYWORDS)
        or contains_any(text, STRONG_ANALYSIS_KEYWORDS)
        or contains_any(text, TECH_ROUTE_KEYWORDS)
        or contains_any(text, REPORT_KEYWORDS)
    )


def count_analysis_signals(text: str) -> int:

    count = 0
    if contains_any(text, TREND_KEYWORDS):
        count += 1
    if contains_any(text, SKILL_KEYWORDS):
        count += 1
    if contains_any(text, ECOSYSTEM_KEYWORDS):
        count += 1
    if contains_any(text, PRACTICE_KEYWORDS):
        count += 1
    if contains_any(text, STRONG_ANALYSIS_KEYWORDS):
        count += 1
    if contains_any(text, TECH_ROUTE_KEYWORDS):
        count += 1
    if contains_any(text, REPORT_KEYWORDS):
        count += 1
    return count

def is_pure_tutorial(title: str) -> bool:

    return contains_any(
        title,
        PURE_TUTORIAL_KEYWORDS
    )


def has_low_value_tag(tags: str) -> bool:

    return contains_any(
        tags,
        LOW_VALUE_TAG_KEYWORDS
    )


def has_engineering_value(text: str) -> bool:

    return contains_any(
        text,
        ENGINEERING_VALUE_KEYWORDS
    )


# ============================================================
# Main function
# ============================================================

def has_analysis_value(article: dict) -> bool:
    """
    Determine whether article should enter analysis database.

    Keep:
    - technology trend
    - ecosystem evolution
    - architecture evolution
    - enterprise practice
    - engineering application

    Remove:
    - pure basic explanation
    - pure tutorial
    - no analysis signal technical sharing
    """

    title = article.get("title") or ""

    summary = article.get("summary") or ""

    content = article.get("content") or ""

    tags = article.get("tags") or ""


    if isinstance(content, str):
        content_preview = content[:3000]
    else:
        content_preview = str(content)[:3000]


    if isinstance(tags, list):
        tag_text = " ".join(tags)
    else:
        tag_text = str(tags)


    full_text = (
        title
        +
        summary
        +
        content_preview
        +
        tag_text
    )


    # ========================================================
    # 1. Must contain technology content
    # ========================================================

    if not contains_any(
        full_text,
        TECH_KEYWORDS
    ):
        return False



    # ========================================================
    # 2. Event/security news
    # Need analysis context
    # ========================================================

    if contains_any(
        full_text,
        EVENT_KEYWORDS
    ):

        if not contains_any(
            full_text,
            EVENT_ANALYSIS_KEYWORDS
        ):
            return False


    # ========================================================
    # 3. Pure tutorial judgement
    #
    # Title only triggers suspicion.
    # Content decides.
    # ========================================================

    if is_pure_tutorial(title):

        if contains_any(
            full_text,
            TUTORIAL_VALUE_KEYWORDS
        ):
            return True

        if has_low_value_tag(tag_text):
            return False

        return False


    # ========================================================
    # 4. Low value title judgement
    #
    # Example:
    # LangChain是什么
    # Docker安装教程
    #
    # Need content support.
    # ========================================================
    if contains_any(
        title,
        LOW_VALUE_TITLE_KEYWORDS
    ):
        if count_analysis_signals(
            content_preview
        ) < 2:
            return False

    # ========================================================
    # 5. Strong analysis value
    # ========================================================
    if contains_any(
        full_text,
        STRONG_ANALYSIS_KEYWORDS
    ):
        return True

    # ========================================================
    # 6. Normal analysis signals
    # ========================================================

    if has_any_analysis_signal(
        full_text
    ):
        return True

    # ========================================================
    # 7. Default reject
    # ========================================================
    return False