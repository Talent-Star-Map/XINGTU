"""
GitHub Repository Analysis Value Filter

L3:

判断 GitHub 仓库是否具有技术/生态/工程分析价值

保留:
1. AI 基础设施项目
2. LLM 工程项目
3. 开源框架
4. 云原生项目
5. 数据平台
6. 数据库系统
7. 中间件
8. 开发工具
9. 企业级工程项目

过滤:
- Demo
- Example
- Tutorial
- Starter
- LeetCode 刷题
- 学习项目
- 个人主页
- 收藏列表

不负责:
- 热度判断
- Star数判断
- 趋势排名

L1:
判断是否属于 IT 技术领域

L2:
判断是否属于真实工程项目

L3:
判断是否具有技术生态/工程分析价值
"""


import re


# ============================================================
# 技术实体关键词
#
# 只判断技术生态领域
# 不能直接判断价值
# ============================================================

TECH_ENTITY_KEYWORDS = [

    # AI / LLM
    "llm",
    "large language model",
    "large model",
    "人工智能",
    "大模型",
    "大语言模型",
    "agent",
    "智能体",
    "rag",
    "检索增强生成",
    "embedding",
    "向量数据库",
    "vector database",
    "transformer",
    "pytorch",
    "tensorflow",
    "langchain",
    "llamaindex",
    "vllm",
    "ollama",
    "机器学习",
    "深度学习",
    "自然语言处理",
    "计算机视觉",
    # AI Application Engineering
"spring ai",
"langchain4j",
"langchain",
"llamaindex",
"agent framework",
"agent platform",
"mcp",
"mcp server",
"model context protocol",
"ai application",
"ai agent",
"智能体框架",
"智能体平台",
"AI应用",
"大模型应用",
"AI应用架构",
"工作流引擎",

    # Backend
    "spring",
    "spring boot",
    "django",
    "fastapi",
    "golang",
    "python framework",
    "python sdk",
    "java framework",
    "go framework",

    # Cloud Native
    "kubernetes",
    "k8s",
    "docker",
    "container",
    "helm",
    "terraform",
    "istio",
    "云原生",
    "容器",
    "服务网格",
    "微服务",
    "微服务架构",
    "容器化",
    "DevOps",
    "持续集成",
    "持续部署",
    "CI/CD",

    # Database
    "redis",
    "mysql",
    "postgresql",
    "mongodb",
    "clickhouse",
    "数据库",
    "存储系统",
    "tidb",
    "oceanbase",
    "人大金仓",
    "openGauss",
    "polardb",
    "tair",

    # Data
    "spark",
    "flink",
    "hadoop",
    "airflow",
    "数据平台",
    "数据处理",

    # Frontend
    "react",
    "vue",
    "typescript",
    "javascript",
    "前端",

    # DevOps
    "prometheus",
    "grafana",
    "opentelemetry",
    "可观测性",

]


# ============================================================
# 核心工程资产关键词
#
# 表示真实工程资产
# 必须结合分析价值
# ============================================================

STRONG_ENGINEERING_KEYWORDS = [

    "framework",
    "platform",
    "runtime",
    "middleware",
    "compiler",
    "operator",
    "controller",
    "orchestration",
    "infrastructure",
    "service mesh",
    "distributed system",

    "框架",
    "运行时",
    "中间件",
    "编译器",
    "控制器",
    "编排系统",
    "基础设施",
    "分布式系统",

    # ========================================================
    # AI 工程资产
    #
    # 新增:
    # 支撑 LLM 应用生态判断
    # ========================================================
    "agent framework",
"agent platform",
"agent system",
"agent workflow",
"ai framework",
"ai platform",
"llm framework",
"llm application framework",

"mcp server",
"mcp protocol",
"model context protocol",

"spring ai",
"langchain",
"langchain4j",
"llamaindex",

"workflow engine",
"ai workflow",

"推理框架",
"推理服务",
"模型服务",
"模型部署",
"智能体框架",
"智能体平台",
"智能体系统",
"AI应用架构",
"大模型应用架构",
"MCP服务",
"工作流引擎",
]

# ============================================================
# 应用产品噪声关键词
#
# 过滤：
# 面向普通用户的应用产品
#
# 不属于：
# 技术生态分析
# 工程能力分析
# 基础设施分析
#
# 不直接过滤
# 需要结合工程关键词判断
# ============================================================
APPLICATION_NOISE_KEYWORDS = [

    # AI内容生成
    "短剧",
    "漫剧",
    "剧本生成",
    "视频生成",
    "视频创作",
    "图片生成",
    "绘画生成",
    "ai绘画",
    "文生图",
    "文生视频",
    
    # 内容生产
    "内容生成",
    "文章生成",
    "写作助手",
    "营销文案",
    "广告生成",
    
    # 娱乐应用
    "游戏生成",
    "角色生成",
    "虚拟人",
    "数字人",
    
    # AI消费产品
    "智能客服",
    "聊天机器人",
    "助手应用",
    "个人助手",
    # ========================================================
    # 普通互联网应用
    # ========================================================
    "博客",
    "论坛",
    "社区",
    "商城",
    "电商",
    "官网",
    "导航站",

    "个人主页",
    "个人网站",
    "作品集",

    "cms",
    "内容管理系统",

    # ========================================================
    # 低技术价值业务系统
    #
    # 注意：
    # 企业级后台不能简单过滤
    # 所以只放明显业务应用
    # ========================================================
    "记账",
    "日历",
    "待办",
    "todo",
    "天气应用",
    "音乐播放器",
    "播放器",
    "小游戏",
    "游戏",
    "抽奖",
]

# ============================================================
# 普通工程关键词
#
# 不能单独通过
# 必须结合 README 长度 + 分析价值关键词
# ============================================================

NORMAL_ENGINEERING_KEYWORDS = [

    "api",
    "sdk",
    "library",
    "component",
    "plugin",
    "extension",
    "gateway",
    "connector",
    "cli",

    "接口",
    "开发库",
    "组件",
    "插件",
    "扩展",
    "网关",
    "连接器",
    "命令行工具",

]


# ============================================================
# 分析价值关键词
#
# 架构 / 工程实践 / 性能 / 开源生态 / 技术演进
# ============================================================

ANALYSIS_VALUE_KEYWORDS = [

    # 架构分析
    "architecture",
    "architecture design",
    "system design",
    "架构",
    "架构设计",
    "系统设计",
    "技术架构",
    "源码分析",
    "实现原理",
    "核心架构",
    "模块设计",

    # 工程实践
    "production",
    "production-ready",
    "enterprise",
    "enterprise-grade",
    "生产环境",
    "生产级",
    "企业级",
    "工程化",
    "deployment",
    "部署",
    "上线",
    "工程实践",
    "生产实践",
    "企业实践",
    "落地实践",
    "部署方案",
    "运维方案",
    "技术栈",
    "技术选型",
    "实践经验",

    # 性能优化
    "performance",
    "benchmark",
    "optimization",
    "性能优化",
    "压力测试",
    "性能测试",
    "性能分析",
    "优化方案",

    # 开源生态
    "open source",
    "开源",
    "community",
    "社区",
    "contributors",
    "贡献者",
    "ecosystem",
    "生态",
    "integration",
    "集成",
    "开源项目",
    "开源社区",
    "社区贡献",
    "生态建设",
    "生态集成",

    # 技术演进
    "evolution",
    "migration",
    "upgrade",
    "演进",
    "迁移",
    "升级",
    "重构",
    "技术演进",
    "版本升级",
    "迁移方案",
    "重构方案",

]


# ============================================================
# 低价值项目关键词
#
# 不能直接过滤
# 只作为风险判断
# ============================================================

LOW_VALUE_KEYWORDS = [

    "hello world",
    "toy project",
    "demo",
    "example",
    "sample",
    "tutorial",
    "practice",
    "exercise",
    "learning project",
    "starter project",

    "教程",
    "示例",
    "练习",
    "学习项目",
    "入门",
    "课程项目",
    "实验项目",
    "个人项目",
    "玩具项目",

]

AI_ENGINEERING_KEYWORDS = [
"模型训练",
"推理框架",
"推理服务",
"模型部署",
"模型服务",
"向量数据库",
"RAG",
"Agent框架",
"Agent平台",
"MCP Server",
"工作流引擎",
"AI基础设施",
"CUDA",
"推理优化",
"模型压缩",
"微调",
"fine tuning",
"inference",
"serving",
"AI application architecture",
"llm application",
"llm application framework",
"agent workflow",
"agent system",
"multi agent",
"multi-agent",
"Spring AI",
"LangChain4j",
"AI应用架构",
"大模型应用",
"多智能体",
"智能体系统",
]


# ============================================================
# 工具函数
# ============================================================

def normalize_text(text):
    if not text:
        return ""
    return re.sub(
        r"\s+",
        " ",
        str(text)
    ).lower()


def contains_any(text, keywords):
    if not text:
        return False
    text = text.lower()
    for keyword in keywords:
        if keyword.lower() in text:
            return True
    return False


# ============================================================
# 辅助价值判断函数
# ============================================================

def has_strong_engineering_value(text):

    return contains_any(
        text,
        STRONG_ENGINEERING_KEYWORDS
    )


def has_normal_engineering_value(text):

    return contains_any(
        text,
        NORMAL_ENGINEERING_KEYWORDS
    )


def has_analysis_signal(text):

    return contains_any(
        text,
        ANALYSIS_VALUE_KEYWORDS
    )


def has_normal_analysis_value(
    text,
    readme_preview
):
    if not has_normal_engineering_value(text):
        return False
    if len(readme_preview) < 500:
        return False
    if not has_analysis_signal(text):
        return False
    return True

def has_application_noise(text):
    return contains_any(
        text,
        APPLICATION_NOISE_KEYWORDS
    )

def has_ai_engineering_value(text):
    return contains_any(
        text,
        AI_ENGINEERING_KEYWORDS
    )

# ============================================================
# 主过滤函数
# ============================================================

def has_analysis_value(repository: dict) -> bool:
    """
    判断 GitHub 仓库是否具有分析价值

    True:
        进入分析数据库
    False:
        丢弃
    """
    title = repository.get(
        "title",
        ""
    )
    summary = repository.get(
        "summary",
        ""
    )
    content = repository.get(
        "content",
        ""
    )

    if isinstance(content, str):
        readme_preview = content[:3000]
    else:
        readme_preview = str(content)[:3000]

    full_text = normalize_text(
        title
        +
        summary
        +
        readme_preview
    )
    analysis_text = normalize_text(
        summary
        +
        readme_preview
    )

    # ========================================================
    # Step 2:
    # 技术实体过滤
    # ========================================================

    if not contains_any(
        full_text,
        TECH_ENTITY_KEYWORDS
    ):
        return False

    # ========================================================
    # AI应用产品过滤
    #
    # AI短剧、AI内容生成等消费应用
    # 不属于AI工程生态分析目标
    # ========================================================
    if has_application_noise(full_text):
        if not (
            has_strong_engineering_value(full_text)
            or has_normal_analysis_value(analysis_text, readme_preview)
        ):
            return False

    # ========================================================
    # Step 3:
    # 强工程项目判断
    #
    # 强工程关键词 + 分析价值关键词
    # ========================================================

    if (
        (
            has_strong_engineering_value(analysis_text)
            or has_ai_engineering_value(analysis_text)
        )
        and has_analysis_signal(analysis_text)
    ):
        return True

    # ========================================================
    # Step 4:
    # 普通工程项目判断
    #
    # 普通工程关键词 + README长度 >= 500 + 分析价值关键词
    # ========================================================

    if has_normal_analysis_value(
        analysis_text,
        readme_preview
    ):
        return True

    # ========================================================
    # Step 5:
    # 低价值风险判断
    #
    # 低价值关键词不直接过滤
    # 作为风险信号，二次确认
    # ========================================================

    title_low_value = contains_any(
        title,
        LOW_VALUE_KEYWORDS
    )

    if title_low_value:
        # 二次确认:
        # 1. 存在强工程价值
        # 或 2. 满足普通工程价值
        if (
            has_strong_engineering_value(full_text)
            or has_normal_analysis_value(
                full_text,
                readme_preview
            )
        ):
            return True
        return False

    # ========================================================
    # Step 6:
    # README 长度保护
    # ========================================================

    if len(readme_preview) < 300:
        return False

    # ========================================================
    # Step 7:
    # 默认拒绝
    # ========================================================
    return False