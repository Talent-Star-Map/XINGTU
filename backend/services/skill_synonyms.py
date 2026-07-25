"""
技能同义词扩展表 + 邻近度计算（精简版）
只保留核心 IT 技能，避免过多噪音导致 FP

@owner: 我和吴家（新岗位发现+求职端趋势+企业端市场洞察）
"""

from typing import Optional

SYNONYM_MAP: dict[str, list[str]] = {
    "kubernetes": ["k8s", "kube", "k8", "容器编排"],
    "docker": ["container", "容器", "容器化"],
    "spring boot": ["springboot", "spring-boot", "java spring", "spring 框架"],
    "spring cloud": ["springcloud", "spring-cloud"],
    "mybatis": ["mybatis-plus", "mybatis 框架", "mybatis-flex"],
    "dubbo": ["apache dubbo", "dubbo3"],
    "java": ["java8", "java11", "java17", "jdk"],
    "大模型": ["llm", "large language model", "基础模型", "gpt", "通用人工智能"],
    "rag": ["retrieval augmented generation", "检索增强生成", "知识检索"],
    "agent": ["智能体", "ai agent", "llm agent"],
    "langchain": ["lang chain", "lang-chain"],
    "nlp": ["自然语言处理", "nlu", "文本挖掘"],
    "prompt engineering": ["提示词工程", "提示工程", "prompt设计"],
    "postgresql": ["postgres", "pg"],
    "elasticsearch": ["es", "elastic search"],
    "redis": ["redis 缓存", "分布式缓存", "缓存层"],
    "vector database": ["向量数据库", "vectordb", "milvus", "pinecone", "weaviate", "chroma"],
    "typescript": ["ts"],
    "javascript": ["js", "es6"],
    "vue": ["vue3", "vue2", "vuejs", "vue.js"],
    "react": ["reactjs", "react.js"],
    "node.js": ["nodejs", "node"],
    "ci/cd": ["cicd", "持续集成", "持续部署", "devops"],
    "terraform": ["iac"],
    "nginx": ["engine x", "反向代理"],
    "linux": ["linux系统", "linux运维", "ubuntu", "centos"],
    "kafka": ["apache kafka", "消息队列", "mq"],
    "rabbitmq": ["rabbit mq", "消息中间件"],
    "rocketmq": ["rocket mq", "apache rocketmq"],
    "git": ["github", "gitlab", "版本控制", "版本管理"],
    "maven": ["apache maven", "mvn"],
    "分布式": ["分布式系统", "distributed system", "分布式架构"],
    "微服务": ["microservice", "microservices", "soa", "服务化"],
    "高并发": ["high concurrency", "并发编程", "高性能"],
    "架构设计": ["系统架构", "架构", "方案设计"],
    "distributed": ["分布式"],
    "microservices": ["微服务"],
    "restful": ["rest", "rest api", "restful api"],
    "graphql": ["graph ql"],
    "websocket": ["ws", "web socket"],
    "microservice": ["微服务", "microservices"],
}

# 邻近技能表
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
    "git": ["github", "gitlab", "ci/cd"],
    "mybatis": ["java", "spring boot", "mysql"],
    "微服务": ["分布式", "spring cloud", "dubbo", "kubernetes"],
    "分布式": ["微服务", "高并发", "kafka", "redis"],
}


def _build_reverse_map() -> dict:
    reverse: dict[str, list[str]] = {}
    for standard, synonyms in SYNONYM_MAP.items():
        for s in synonyms:
            key = s.strip().lower()
            if key not in reverse: reverse[key] = []
            if standard not in reverse[key]: reverse[key].append(standard)
        for s in synonyms:
            k = s.strip().lower()
            if k not in reverse: reverse[k] = []
            for other in synonyms:
                ok = other.strip().lower()
                if ok != k and ok not in reverse[k]: reverse[k].append(ok)
    return reverse

_REVERSE_MAP = _build_reverse_map()


def normalize_skill(skill: str) -> list[str]:
    s = skill.strip().lower()
    if not s: return []
    result = {s}
    if s in SYNONYM_MAP: result.update(SYNONYM_MAP[s])
    if s in _REVERSE_MAP: result.update(_REVERSE_MAP[s])
    return sorted(result)


def is_synonym(s1: str, s2: str) -> bool:
    a, b = s1.strip().lower(), s2.strip().lower()
    if not a or not b: return False
    if a == b: return True
    if a in SYNONYM_MAP and b in SYNONYM_MAP[a]: return True
    if b in SYNONYM_MAP and a in SYNONYM_MAP[b]: return True
    if a in _REVERSE_MAP and b in _REVERSE_MAP[a]: return True
    if b in _REVERSE_MAP and a in _REVERSE_MAP[b]: return True
    if a in b or b in a: return True
    return False


def get_skill_popularity(skill: str, all_jobs: Optional[list[dict]] = None) -> float:
    if not all_jobs:
        try:
            from jobs import SEED_JOBS
            all_jobs = SEED_JOBS
        except ImportError: return 0.0
    s = skill.strip().lower()
    if not s: return 0.0
    count = sum(1 for jd in all_jobs if any(s == js.strip().lower() or is_synonym(s, js) for js in jd.get("skills", [])))
    return round(count / max(len(all_jobs), 1), 3)


def has_adjacent_skill(skill: str, profile_skills: list[str]) -> bool:
    s = skill.strip().lower()
    profile_set = {x.strip().lower() for x in profile_skills}
    for adj in ADJACENT_SKILLS.get(s, []):
        if adj in profile_set or any(is_synonym(adj, ps) for ps in profile_set): return True
    return False


def best_match_in_profile(jd_skill: str, profile_skills: list[str]) -> Optional[str]:
    s = jd_skill.strip().lower()
    for ps in profile_skills:
        ps_lower = ps.strip().lower()
        if not ps_lower: continue
        if s == ps_lower or is_synonym(s, ps_lower): return ps
    return None
