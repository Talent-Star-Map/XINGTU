"""Skill tags cleaning pipeline: normalize, filter, dedup skill tags."""

import json
import re

from config.article_keywords import (
    AI_KEYWORDS,
    SOFTWARE_AI_KEYWORDS,
    FRONTEND_KEYWORDS,
    BACKEND_KEYWORDS,
    DATA_ENGINEERING_KEYWORDS,
    CLOUD_DEVOPS_KEYWORDS,
    TESTING_KEYWORDS,
    SECURITY_KEYWORDS,
    ARCHITECTURE_KEYWORDS,
)

PRECISE_KEYWORDS = AI_KEYWORDS + FRONTEND_KEYWORDS + BACKEND_KEYWORDS + SECURITY_KEYWORDS
ENGINEERING_KEYWORDS = SOFTWARE_AI_KEYWORDS + DATA_ENGINEERING_KEYWORDS + CLOUD_DEVOPS_KEYWORDS + TESTING_KEYWORDS
ECOSYSTEM_KEYWORDS = ARCHITECTURE_KEYWORDS

_SYNONYM_MAP = {
    "AI": ["人工智能", "ai", "AI技术", "AI大模型", "AI应用"],
    "LLM": ["语言模型", "大语言模型", "大模型", "llm", "LLM技术"],
    "RAG": ["rag", "RAG技术", "RAG应用"],
    "Agent": ["智能体", "agent", "AI Agent", "AI智能体"],
    "MCP": ["mcp", "MCP协议"],
    "Embedding": ["embedding", "Embedding技术"],
    "Prompt": ["prompt", "Prompt工程"],
    "AIGC": ["aigc", "生成式AI", "生成式人工智能"],
    "DevOps": ["devops"],
    "Kubernetes": ["k8s", "kubernetes"],
    "MySQL": ["mysql"],
    "PostgreSQL": ["postgresql", "postgres"],
    "MongoDB": ["mongodb", "mongo"],
    "Vue": ["vue3", "vue.js"],
    "React": ["react.js"],
    "TypeScript": ["typescript"],
    "JavaScript": ["javascript", "js"],
    "Spring Boot": ["springboot"],
    "Spring Cloud": ["springcloud"],
    "LLaMA": ["llama", "LLAMA"],
}

_CASE_MAP = {
    "python": "Python",
    "java": "Java",
    "golang": "Go",
    "redis": "Redis",
    "mysql": "MySQL",
    "docker": "Docker",
    "react": "React",
    "vue": "Vue",
    "llama": "LLaMA",
    "macos": "macOS",
}

_CONTEXT_INVALID_TAGS = {
    "程序员",
    "开发者",
    "工程师",
    "技术人",
    "技术人员",
    "互联网",
    "it",
    "IT",
    "码农",
    "程序开发",
    "开发人员",
    "技术人员",
    "计算机",
    "软件工程师",
}

_INVALID_TAGS = {
    "学习", "就业", "转行", "教程", "入门", "分享", "笔记", "文章",
    "经验", "总结", "简介", "介绍", "基础", "进阶", "指南", "手册",
    "心得", "面试", "简历", "招聘", "薪资", "职业", "发展", "前景",
}

_ARTICLE_TYPE_TAGS = {
    "大模型入门", "Python教程", "学习路线", "经验分享",
    "学习笔记", "技术文章", "入门教程", "进阶指南",
}

_TECH_SUFFIX_RE = re.compile(
    r"(框架|数据库|模型|算法|系统|架构|开发|部署|工程|平台|服务|技术)$"
)

MAX_SKILL_TAGS = 15

_KNOWN_TECH_ENTITIES = set()
for kw in PRECISE_KEYWORDS + ENGINEERING_KEYWORDS:
    _KNOWN_TECH_ENTITIES.add(kw)
for kw in ECOSYSTEM_KEYWORDS:
    if kw.endswith("生态"):
        _KNOWN_TECH_ENTITIES.add(kw[:-2])
    else:
        _KNOWN_TECH_ENTITIES.add(kw)

_TECH_TERMS = set()
for kw in PRECISE_KEYWORDS + ENGINEERING_KEYWORDS:
    for term in re.findall(r'[A-Za-z0-9+#.]+', kw):
        if len(term) >= 2:
            _TECH_TERMS.add(term)
    for term in re.findall(r'[\u4e00-\u9fff]{2,}', kw):
        _TECH_TERMS.add(term)
for kw in ECOSYSTEM_KEYWORDS:
    clean_kw = kw[:-2] if kw.endswith("生态") else kw
    for term in re.findall(r'[A-Za-z0-9+#.]+', clean_kw):
        if len(term) >= 2:
            _TECH_TERMS.add(term)
    for term in re.findall(r'[\u4e00-\u9fff]{2,}', clean_kw):
        _TECH_TERMS.add(term)


def _is_tech_valid(tag):
    if any(tag in entity for entity in _KNOWN_TECH_ENTITIES):
        return True
    if _TECH_SUFFIX_RE.search(tag):
        return True
    return False


def parse_language(language_raw):
    """Parse GitHub language field into a list.

    Supports:
    1. list: ["Python", "Java"]
    2. string: "Python,Java,TypeScript"

    Returns [] when language is empty.
    """
    if language_raw is None:
        return []
    if isinstance(language_raw, list):
        return [str(t).strip() for t in language_raw if isinstance(t, str) and str(t).strip()]
    if isinstance(language_raw, str):
        return [s.strip() for s in language_raw.split(",") if s.strip()]
    return []


def clean_skill_tags(tags_raw, title="", content="", language_raw=None):
    if tags_raw is None:
        tags = []
    elif isinstance(tags_raw, list):
        tags = [str(t).strip() for t in tags_raw if isinstance(t, str) and str(t).strip()]
    elif isinstance(tags_raw, str):
        try:
            parsed = json.loads(tags_raw)
            tags = [str(t).strip() for t in parsed if isinstance(t, str) and str(t).strip()] if isinstance(parsed, list) else []
        except (json.JSONDecodeError, TypeError):
            tags = []
    else:
        tags = []

    if language_raw is not None:
        tags.extend(parse_language(language_raw))

    normalized = []
    for t in tags:
        matched = False
        for standard, synonyms in _SYNONYM_MAP.items():
            if t in synonyms:
                normalized.append(standard)
                matched = True
                break
        if not matched:
            normalized.append(t)

    cased = []
    for t in normalized:
        lower = t.lower()
        cased.append(_CASE_MAP.get(lower, t))

    filtered = [t for t in cased if t not in _INVALID_TAGS and t not in _ARTICLE_TYPE_TAGS and t not in _CONTEXT_INVALID_TAGS]

    valid = [t for t in filtered if _is_tech_valid(t)]

    seen = set()
    deduped = []
    for t in valid:
        if t not in seen:
            seen.add(t)
            deduped.append(t)

    result = deduped[:MAX_SKILL_TAGS]

    if not result:
        supplement = []
        seen_sup = set()
        title_lower = title.lower()
        content_lower = content[:500].lower() if content else ""
        for term in sorted(_TECH_TERMS, key=len, reverse=True):
            if term not in seen_sup:
                if term.lower() in title_lower:
                    supplement.append(term)
                    seen_sup.add(term)
                elif term.lower() in content_lower:
                    supplement.append(term)
                    seen_sup.add(term)
        result = supplement[:MAX_SKILL_TAGS]

    return result
