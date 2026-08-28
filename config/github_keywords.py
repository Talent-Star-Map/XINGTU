"""
GitHub repository keyword configuration.

Used for:
1. GitHub repository technical filtering
2. Open source ecosystem analysis
3. Technology trend analysis
"""

AI_KEYWORDS = [
    "LLM应用实践", "RAG技术实践", "Agent应用",
    "智能体开发", "MCP协议", "AIGC应用", "多模态AI",
    "AI工程化", "大语言模型", "大模型应用开发",
    "LLM应用开发", "生成式AI", "生成式人工智能",
    "AI Agent", "AI智能体", "智能体应用", "AI应用趋势",
    "AI应用生态", "AI原生应用", "多模态大模型", "大模型推理",
    "大模型部署", "大模型微调", "Prompt工程", "Embedding技术",
    "知识库问答", "检索增强生成", "RAG系统",
    "Spring AI应用实践", "Python人工智能应用", "RAG系统开发", "RAG应用开发",
    "Agent开发实践", "智能体开发实践", "LLM应用部署",
    "AI应用开发", "AI工程实践", "LLM生态",
    "Agent生态", "智能体生态","Agent framework","Agent platform",
    "RAG system","RAG","LLM deployment","LLM inference","AI infrastructure",
    "LangChain application","LangGraph workflow","LlamaIndex application",
    "AI编程助手", "代码生成", "Copilot", "智能编码",
    "AI辅助开发", "AI代码审查", "AI测试生成", "AI开发工具",
    "智能IDE", "软件开发智能化", "AI软件工程",
]

FRONTEND_KEYWORDS = [
    "Vue3架构", "前端工程化", "前端性能优化",
    "前端架构演进","Serverless架构","React工程化", "前端架构设计",
    "TypeScript工程实践", "前端生态",
    "frontend engineering",
        "frontend architecture",
        "React application",
        "Vue application",
        "TypeScript application",
        "Web performance optimization",
        "design system",
        "component library",
]

BACKEND_KEYWORDS = [
    "Java架构设计", "Spring Cloud微服务", "微服务架构",
    "分布式系统设计", "高并发架构","Spring Boot实践",
    "Java并发编程", "Java企业级开发","Java工程实践",
    "Redis性能优化", "Redis高并发",
    "Redis应用实践", "Redis集群实践",
    "缓存架构设计", "Python工程实践",
    "Go并发编程", "Rust性能优化", "C++性能优化", "Python项目实践",
    "Go工程实践", "Go微服务", "C++性能优化实践",
    "Spring Boot microservice","Spring Cloud architecture","distributed system framework",
    "distributed architecture","microservice architecture","RPC framework",
    "gRPC service","Kafka platform","Redis cluster",
    "Redis middleware","database middleware",
]

DATA_ENGINEERING_KEYWORDS = [
    "数据工程", "数据开发实践",
    "数据平台建设", "数据中台", "数据架构设计", "数据仓库建设",
    "数据湖架构", "实时数据处理", "数据治理",
    "Python数据工程", "数据开发实践", "ETL开发",
    "数据管道设计", "数据采集系统", "数据仓库实践", "数据湖实践",
    "Hive实践", "Spark实践", "Flink实践", "实时计算",
    "流式计算", "大数据开发", "数据平台开发",
    "数据架构演进", "数据基础设施","数据治理体系","data platform",
    "data pipeline","stream processing","real time computing","data warehouse",
    "data lake","Apache Spark","Apache Flink","data engineering platform",
    "real time data processing",
]

CLOUD_DEVOPS_KEYWORDS = [
    "云原生架构", "Kubernetes实践", "Docker容器化", "DevOps实践",
    "CI/CD实践", "Kubernetes部署实践", "容器化部署",
    "微服务部署", "服务治理",
    "Prometheus监控", "Grafana监控", "ELK日志系统",
    "自动化运维", "Ansible自动化", "Terraform实践",
    "Kubernetes运维","DevOps平台建设", "CI/CD流水线",
    "Kubernetes operator",
        "Kubernetes platform",
        "Kubernetes deployment",
        "cloud native architecture",
        "container orchestration",
        "Docker deployment",
        "DevOps automation platform",
        "CI/CD pipeline",
        "GitOps workflow",
        "Infrastructure as Code",
        "Terraform automation",
        "Prometheus monitoring",
]

TESTING_SECURITY_KEYWORDS = [
    "测试开发", "自动化测试", "软件测试技术",
    "测试工程化", "性能测试实践", "接口自动化测试",
    "测试平台建设", "测试体系建设", "自动化测试实践", "接口测试实践",
    "测试框架开发", "测试平台开发", "测试工具开发", "JUnit测试",
    "PyTest测试", "Selenium自动化测试", "Playwright自动化测试", "接口自动化",
    "持续集成测试", "质量平台建设",
    "质量工程体系","安全工程", "应用安全", "云安全",
    "应用安全实践", "安全漏洞分析", "网络安全实践", "身份认证系统",
    "安全技术生态", "云安全发展趋势", "企业安全体系",
]

ARCHITECTURE_KEYWORDS = [
    "架构演进","技术选型", "企业级架构", "开源生态", "技术生态",
    "企业技术架构","微服务架构演进", "分布式架构演进", "云原生架构演进",
    "服务端架构演进", "系统架构设计",
    "大型系统架构","数据库生态", "数据技术生态", "大数据生态", "研发效能提升",
    "研发流程优化", "系统可靠性工程", "企业技术架构",
]

DATABASE_KEYWORDS = [
    "数据库系统","分布式数据库", "数据库设计实践","MySQL性能优化", 
    "数据库架构设计","向量数据库", "MySQL优化实践","distributed database",
    "database engine","database middleware","storage engine","vector database",
]

# 开源生态
OPEN_SOURCE_KEYWORDS = [
    "open source infrastructure",
    "open source AI framework",
    "open source DevOps platform",
    "open source developer platform",
    "开源工具","开源框架","开发者工具","基础设施平台",
    "自动化平台","开源生态",
]

# ==============================
# All Keyword Groups
# ==============================

GITHUB_KEYWORD_GROUPS = {
    "AI生态": AI_KEYWORDS ,
    "云原生": CLOUD_DEVOPS_KEYWORDS,
    "前端生态": FRONTEND_KEYWORDS ,
    "后端架构": BACKEND_KEYWORDS,
    "数据工程": DATA_ENGINEERING_KEYWORDS,
    "数据库": DATABASE_KEYWORDS,
    "测试安全": TESTING_SECURITY_KEYWORDS,
    "技术架构": ARCHITECTURE_KEYWORDS ,
    "开源生态": OPEN_SOURCE_KEYWORDS,
}