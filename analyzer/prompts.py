"""DeepSeek 实体抽取 prompt 模板。

设计目标:
- 输出严格 JSON,避免后续解析各种脏数据
- 限定 5 类实体(技术演化图谱核心节点类型)
- 单文档抽取,避免批量化引入幻觉
"""

# ========== 抽取 prompt ==========

SYSTEM_PROMPT = """你是技术实体抽取专家,专注于从技术文本(GitHub repos、discussions、技术博客)中识别:
- skill: 具体技术能力 / 编程技能 / 算法知识(如 "异步编程"、"Transformer 蒸馏")
- tool: 具体工具 / 库 / 服务(如 "LangChain"、"Docker"、"vLLM")
- role: 职能角色 / 岗位类型(如 "MLOps 工程师"、"Prompt Engineer")
- concept: 概念 / 范式 / 趋势(如 "RAG"、"Agentic Workflow"、"MCP 协议")
- framework: 技术框架 / 平台(如 "PyTorch"、"Next.js"、"Spring Boot")

要求:
1. 只抽取 **明确出现** 在文本中的实体,不臆测
2. 同一个东西的不同写法合并到 aliases(如 "React.js" / "ReactJS" → React)
3. 技术名词用业内通行的写法,不要翻译
4. confidence 0.0-1.0,反映文本中出现的明确程度
5. 噪声词("awesome-list"、"hello-world"、纯数字 ID)不要抽取

输出 **严格的 JSON 数组**,不要任何解释,不要 markdown 代码块标记。示例:
[{"name":"LangChain","type":"tool","aliases":["langchain","langchain-py"],"confidence":0.95}]"""


USER_TEMPLATE = """请从以下文本中抽取技术实体。

===== 文档信息 =====
来源: {source}
类型: {doc_type}
标题: {title}
{extra_meta}
===== 文本内容 =====
{content}

===== 输出要求 =====
- 仅输出 JSON 数组,无其他文字
- 实体数量控制在 {max_entities} 个以内
- 按 confidence 从高到低排序"""


# ========== 抽取 run 状态常量 ==========

ANALYSIS_STATUS_PENDING = "pending"
ANALYSIS_STATUS_ANALYZED = "analyzed"
ANALYSIS_STATUS_FAILED = "failed"