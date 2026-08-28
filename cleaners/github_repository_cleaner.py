"""GitHub Repository Cleaner

Standalone cleaner for GitHub repository data from article_raw.

Produces article_info-compatible output with GitHub-specific scoring:
- hot_score: Star 50% + Fork 20% + Update recency 30%
- quality_score: README + tech stack + description + tags + engineering info
- trend_score: Update recency + tech trend signals + community + field weight
- technology_field: Reuses domain detection from article_cleaner
- article_type: GitHub project type classification
"""

import json
import math
import re
from datetime import datetime
from utils.content_cleaner import clean_github_content, _remove_symbols


# ============================================================
# Language whitelist
# ============================================================

LANGUAGE_WHITELIST = {
    "python", "java", "javascript", "typescript",
    "c", "c++", "c#", "go", "golang", "rust", "php", "ruby",
    "kotlin", "swift", "dart", "scala", "r",
    "shell", "powershell", "sql",
    "html", "css", "scss", "less", "lua",
    "objective-c", "matlab", "perl", "haskell", "elixir",
    "clojure", "julia", "groovy", "assembly", "webassembly",
    "wasm", "zig", "nim", "ocaml", "f#", "erlang",
    "vue", "svelte",
}

LANGUAGE_ALIASES = {
    "golang": "go",
    "objective-c": "objective-c",
    "objc": "objective-c",
}

LANGUAGE_BLACKLIST = {
    "other",
    "nsis",
    "makefile", "cmake", "dockerfile", "groff",
    "meson", "ninja", "awk", "sed", "batchfile",
    "llvm", "glsl", "hlsl", "cuda", "openscad",
}


# ============================================================
# Noise tags (exact tag-level matching, not substring)
# ============================================================

TAG_NOISE_EXACT = {
    "portfolio", "resume", "personal-site", "my-blog",
    "github-pages", "awesome-list", "awesome-collection",
    "homepage", "personal-website", "blog",
    "template", "starter", "boilerplate", "scaffold", "skeleton",
    "demo", "example", "sample", "playground", "showcase",
    "prototype", "proof-of-concept", "poc", "lab",
    "tutorial", "course", "learning", "learn", "beginner",
    "getting-started", "roadmap", "cheatsheet",
    "dotfiles", "config", "configuration", "settings", "setup",
    "documentation", "docs", "wiki", "manual",
    "ppt", "pptx", "ppt-generator",
    "slides", "slide", "ai-slides", "ai-slide-builder", "ai-ppt-maker",
    "presentation",
}

TAG_NOISE_SUBSTRING_PATTERNS = [
    r"^awesome[\-\s]",
    r"[\-\s]template$",
    r"[\-\s]boilerplate$",
    r"[\-\s]starter[\-\s]kit$",
    r"^my[\-\s]",
]


# ============================================================
# Tech entity detection (non-closed, open-ended)
# ============================================================

TECH_ENTITY_PATTERNS = [
    r"^[a-z0-9][\w\-\+\.]*$",
]

TECH_ENTITY_BLACKLIST_PHRASES = {
    "portfolio", "resume", "personal-site", "my-blog",
    "github-pages", "awesome-list", "awesome-collection",
    "homepage", "personal-website", "blog",
    "template", "starter", "boilerplate", "scaffold", "skeleton",
    "demo", "example", "sample", "playground", "showcase",
    "prototype", "proof-of-concept", "poc", "lab",
    "tutorial", "course", "learning", "learn", "beginner",
    "getting-started", "roadmap", "cheatsheet",
    "dotfiles", "config", "configuration", "settings", "setup",
    "documentation", "docs", "wiki", "manual",
    "ppt", "slides", "presentation",
    "other", "nsis",
}


# ============================================================
# Technology field keywords (matching article_cleaner domains)
# ============================================================

_DOMAIN_KEYWORDS = [
    ("人工智能", [
        "llm", "large language model", "generative ai", "ai agent",
        "agent framework", "rag", "retrieval augmented generation",
        "embedding", "vector database", "machine learning", "deep learning",
        "pytorch", "tensorflow", "artificial intelligence", "aigc",
        "nlp", "natural language processing", "computer vision",
        "transformer", "diffusion model", "chatgpt", "openai",
        "langchain", "llamaindex", "vllm", "ollama",
        "ai", "人工智能", "大模型", "大语言模型", "智能体",
        "生成式ai", "机器学习", "深度学习", "自然语言处理", "计算机视觉",
        "多模态", "知识库", "检索增强生成", "prompt",
        "deepseek", "qwen", "llama", "mistral", "gemma",
        "mcp", "model context protocol",
    ]),
    ("后端开发", [
        "spring", "spring boot", "spring cloud", "django", "fastapi",
        "flask", "express", "nestjs", "gin", "fiber",
        "microservice", "distributed system", "grpc", "rpc",
        "kafka", "rabbitmq", "rocketmq", "redis", "mysql",
        "postgresql", "mongodb", "elasticsearch", "clickhouse",
        "netty", "ktor", "actix",
        "java", "golang", "python", "rust", "c++", "php",
        "后端", "微服务", "分布式", "高并发", "中间件", "消息队列",
        "缓存", "数据库", "架构",
    ]),
    ("前端开发", [
        "react", "vue", "vue3", "angular", "svelte", "next.js",
        "nuxt", "vite", "webpack", "electron", "tauri",
        "typescript", "javascript", "tailwind", "sass",
        "前端", "web", "ui framework", "component library",
    ]),
    ("数据工程", [
        "spark", "flink", "hadoop", "hive", "airflow", "dbt",
        "kafka", "storm", "presto", "trino", "iceberg",
        "data pipeline", "data warehouse", "data lake", "etl",
        "数据工程", "数据平台", "数据仓库", "数据湖", "实时计算",
        "大数据", "数据管道", "数据治理",
    ]),
    ("云原生", [
        "kubernetes", "k8s", "docker", "container", "helm",
        "terraform", "istio", "envoy", "argocd", "argo",
        "prometheus", "grafana", "opentelemetry",
        "cloud native", "serverless", "service mesh",
        "云原生", "容器化", "微服务", "devops", "持续集成", "持续部署",
    ]),
    ("架构", [
        "architecture", "distributed", "cluster", "middleware",
        "gateway", "infrastructure", "service mesh",
        "架构", "分布式", "集群", "中间件", "网关", "基础设施",
    ]),
    ("测试", [
        "selenium", "playwright", "cypress", "jest", "pytest",
        "junit", "testng", "k6", "gatling", "locust",
        "test framework", "test platform", "e2e", "integration test",
        "测试", "自动化测试", "性能测试", "接口测试",
    ]),
    ("运维", [
        "ansible", "terraform", "puppet", "chef", "saltstack",
        "jenkins", "github actions", "gitlab ci", "ci/cd",
        "monitoring", "logging", "observability", "sre",
        "运维", "自动化运维", "监控", "日志", "可观测性",
    ]),
]

_DOMAIN_PRIORITY = [
    "人工智能", "后端开发", "前端开发", "数据工程",
    "云原生", "架构", "测试", "运维", "其他",
]


# ============================================================
# Article type keywords (GitHub project types)
# ============================================================

_TYPE_KEYWORDS = [
    ("AI应用", [
        "ai application", "llm application", "chatbot", "ai tool",
        "ai productivity", "ai assistant", "ai-powered",
        "智能体", "ai应用", "大模型应用", "ai工具",
    ]),
    ("AI基础设施", [
        "inference", "serving", "training", "fine-tuning",
        "model deployment", "vllm", "tensorrt", "onnx",
        "cuda", "gpu", "distributed training",
        "推理框架", "推理服务", "模型部署", "模型训练", "微调",
    ]),
    ("开发框架", [
        "framework", "sdk", "runtime", "library",
        "框架", "运行时", "开发库",
    ]),
    ("后端系统", [
        "server", "api", "gateway", "proxy", "load balancer",
        "database", "storage", "cache", "queue",
        "服务端", "网关", "代理", "数据库", "存储",
    ]),
    ("前端应用", [
        "web app", "desktop app", "mobile app", "ui", "gui",
        "web应用", "桌面应用", "移动应用",
    ]),
    ("数据平台", [
        "data platform", "data pipeline", "analytics",
        "data warehouse", "data lake", "streaming",
        "数据平台", "数据分析", "数据管道",
    ]),
    ("数据库系统", [
        "database engine", "storage engine", "sql engine",
        "nosql", "newsql", "vector database",
        "数据库系统", "存储引擎",
    ]),
    ("云原生基础设施", [
        "container runtime", "orchestration", "service mesh",
        "cloud platform", "paas", "iaas",
        "容器运行时", "编排", "云平台",
    ]),
    ("DevOps工具", [
        "ci/cd", "deployment", "provisioning", "monitoring",
        "logging", "alerting", "incident",
        "持续集成", "部署", "监控", "日志",
    ]),
    ("开发者工具", [
        "cli", "code editor", "ide", "linter", "formatter",
        "debugger", "profiler", "code generation",
        "命令行", "代码编辑器", "调试器", "代码生成",
    ]),
    ("安全工具", [
        "security", "vulnerability", "scanner", "penetration",
        "firewall", "encryption", "authentication",
        "安全", "漏洞", "扫描", "加密", "认证",
    ]),
    ("测试工具", [
        "test framework", "test runner", "mock", "fuzzing",
        "benchmark", "load test",
        "测试框架", "基准测试", "压力测试",
    ]),
]


# ============================================================
# Trend signal keywords
# ============================================================

TREND_SIGNAL_KEYWORDS = [
    "llm", "ai agent", "rag", "mcp", "langchain", "llamaindex",
    "deepseek", "qwen", "openai", "anthropic",
    "kubernetes", "docker", "cloud native", "serverless",
    "rust", "go", "typescript",
    "vector database", "embedding", "fine-tuning",
    "distributed", "microservice", "streaming",
    "real-time", "edge computing", "wasm",
]


# ============================================================
# Engineering keywords for quality assessment
# ============================================================

ENGINEERING_KEYWORDS = [
    "install", "setup", "deploy", "deployment", "architecture",
    "feature", "api", "configuration", "getting started",
    "quick start", "usage", "example", "contribution",
    "安装", "部署", "架构", "功能", "配置", "快速开始",
    "使用", "贡献", "运行", "构建",
]


# ============================================================
# Strong tech keywords (for trend scoring)
# ============================================================

STRONG_TECH_KEYWORDS = [
    "llm", "large language model", "ai agent", "rag",
    "retrieval augmented generation", "vector database",
    "kubernetes", "cloud native", "microservice",
    "distributed system", "stream processing",
    "machine learning", "deep learning",
    "inference", "model serving", "fine-tuning",
    "mcp", "model context protocol",
]


# ============================================================
# Tool functions
# ============================================================

def _safe_int(value, default=0):
    if value is None:
        return default
    try:
        return int(value)
    except (ValueError, TypeError):
        return default


def _safe_float(value, default=0.0):
    if value is None:
        return default
    try:
        return float(value)
    except (ValueError, TypeError):
        return default


def _normalize_text(text):
    if not text:
        return ""
    return re.sub(r"\s+", " ", str(text)).lower().strip()


def _contains_any(text, keywords):
    if not text:
        return False
    text_lower = text.lower()
    for kw in keywords:
        if kw.lower() in text_lower:
            return True
    return False


def _count_hits(text, keywords):
    if not text:
        return 0
    text_lower = text.lower()
    return sum(1 for kw in keywords if kw.lower() in text_lower)


# ============================================================
# Tags + Language cleaning
# ============================================================

def clean_tags_and_language(raw_tags, raw_language):
    """Merge and clean GitHub tags + language into a unified JSON list.

    Processing order:
    1. Parse raw tags (JSON string or list)
    2. Split language by comma
    3. Normalize case and whitespace
    4. Filter noise
    5. Deduplicate
    6. Merge language + topic tags
    7. Return JSON-compatible list
    """
    tags = _parse_raw_tags(raw_tags)
    languages = _parse_raw_language(raw_language)

    combined = []
    for tag in tags:
        normalized = _normalize_tag(tag)
        if normalized and not _is_noise_tag(normalized):
            combined.append(normalized)

    for lang in languages:
        normalized = _normalize_language(lang)
        if normalized and normalized not in combined:
            combined.append(normalized)

    seen = set()
    result = []
    for tag in combined:
        key = tag.lower()
        if key not in seen:
            seen.add(key)
            result.append(tag)

    return result


def _parse_raw_tags(raw_tags):
    if not raw_tags:
        return []
    if isinstance(raw_tags, list):
        return raw_tags
    if isinstance(raw_tags, str):
        if not raw_tags.strip():
            return []
        try:
            parsed = json.loads(raw_tags)
            if isinstance(parsed, list):
                return parsed
        except (json.JSONDecodeError, TypeError):
            pass
    return []


def _parse_raw_language(raw_language):
    if not raw_language:
        return []
    if isinstance(raw_language, str):
        parts = re.split(r"[,;/]", raw_language)
        return [p.strip() for p in parts if p.strip()]
    return []


def _normalize_tag(tag):
    if not tag:
        return ""
    tag = str(tag).strip()
    tag = re.sub(r"\s+", "-", tag)
    tag = tag.lower()
    if not tag or len(tag) < 2:
        return ""
    if re.match(r"^[0-9]+$", tag):
        return ""
    return tag


def _normalize_language(lang):
    if not lang:
        return ""
    lang = str(lang).strip()
    if not lang:
        return ""
    lang_lower = lang.lower()
    if lang_lower in LANGUAGE_BLACKLIST:
        return ""
    if lang_lower in LANGUAGE_ALIASES:
        return LANGUAGE_ALIASES[lang_lower]
    if lang_lower in LANGUAGE_WHITELIST:
        return lang_lower
    if len(lang) <= 15 and re.match(r"^[a-zA-Z][\w\+\-\.]*$", lang):
        return lang_lower
    return ""


def _is_noise_tag(tag):
    if tag in TAG_NOISE_EXACT:
        return True
    for phrase in TECH_ENTITY_BLACKLIST_PHRASES:
        if tag == phrase:
            return True
    for pattern in TAG_NOISE_SUBSTRING_PATTERNS:
        if re.match(pattern, tag):
            return True
    return False


# ============================================================
# Technology field detection
# ============================================================

def get_technology_field(raw_article):
    """Detect technology field from tags, language, summary, and content."""
    tags = _parse_raw_tags(raw_article.get("tags"))
    language = raw_article.get("language") or ""
    summary = raw_article.get("summary") or ""
    content = raw_article.get("content") or ""

    combined_text = " ".join([
        " ".join(tags),
        language,
        summary,
        content[:2000],
    ])

    scores = {}
    for domain, keywords in _DOMAIN_KEYWORDS:
        score = _count_hits(combined_text, keywords)
        if score > 0:
            scores[domain] = score

    if not scores:
        return "其他"

    max_score = max(scores.values())
    candidates = [d for d, s in scores.items() if s == max_score]
    for domain in _DOMAIN_PRIORITY:
        if domain in candidates:
            return domain
    return "其他"


# ============================================================
# Article type detection (GitHub project type)
# ============================================================

def get_article_type(raw_article):
    """Detect GitHub project type from tags, language, summary, content."""
    tags = _parse_raw_tags(raw_article.get("tags"))
    language = raw_article.get("language") or ""
    summary = raw_article.get("summary") or ""
    content = raw_article.get("content") or ""

    combined_text = " ".join([
        " ".join(tags),
        language,
        summary,
        content[:2000],
    ])

    scores = {}
    for ptype, keywords in _TYPE_KEYWORDS:
        score = _count_hits(combined_text, keywords)
        if score > 0:
            scores[ptype] = score

    if not scores:
        return "其他"

    max_score = max(scores.values())
    candidates = [t for t, s in scores.items() if s == max_score]
    return candidates[0]


# ============================================================
# hot_score: Star 50% + Fork 20% + Update 30%
# ============================================================

def calc_hot_score(like_count, favorite_count, update_time):
    """Calculate GitHub hot_score.

    Formula:
        hot_score = 100 * (
            0.50 * star_score
          + 0.20 * fork_score
          + 0.30 * update_score
        )

    star_score: log(1 + star) normalized to 0~1
    fork_score: log(1 + fork) normalized to 0~1
    update_score: exponential decay based on days since last update
    """
    star_raw = _safe_float(like_count)
    fork_raw = _safe_float(favorite_count)

    star_compressed = math.log(1 + star_raw)
    fork_compressed = math.log(1 + fork_raw)

    star_max = math.log(1 + 50000)
    fork_max = math.log(1 + 10000)

    star_score = min(star_compressed / star_max, 1.0) if star_max > 0 else 0
    fork_score = min(fork_compressed / fork_max, 1.0) if fork_max > 0 else 0

    update_score = _calc_update_score(update_time)

    hot = 100 * (
        0.50 * star_score
        + 0.20 * fork_score
        + 0.30 * update_score
    )
    return min(round(hot, 2), 100)


def _calc_update_score(update_time):
    """Exponential decay: score = e^(-days/365)."""
    if not update_time:
        return 0.3
    try:
        if isinstance(update_time, str):
            update_date = datetime.fromisoformat(
                update_time.replace("Z", "+00:00")
            ).replace(tzinfo=None)
        else:
            update_date = update_time
        days = (datetime.now() - update_date).days
        if days < 0:
            days = 0
        return math.exp(-days / 365)
    except Exception:
        return 0.3


# ============================================================
# quality_score
# ============================================================

def calculate_quality_score(raw_article):
    """Calculate GitHub quality_score.

    Weights:
        README completeness  30%
        Tech stack clarity   25%
        Description quality  20%
        Tag richness         15%
        Engineering info     10%

    Returns: float in [0, 100]
    """
    content = raw_article.get("content") or ""
    summary = raw_article.get("summary") or ""
    tags = _parse_raw_tags(raw_article.get("tags"))
    language = raw_article.get("language") or ""

    readme_score = _calc_readme_score(content)
    tech_stack_score = _calc_tech_stack_score(tags, language)
    desc_score = _calc_description_score(summary)
    tag_score = _calc_tag_richness_score(tags)
    eng_score = _calc_engineering_info_score(content)

    total = (
        readme_score * 0.30
        + tech_stack_score * 0.25
        + desc_score * 0.20
        + tag_score * 0.15
        + eng_score * 0.10
    )
    return min(round(total, 2), 100)


def _calc_readme_score(content):
    if not content:
        return 0
    score = 0
    length = len(content)
    if length >= 5000:
        score += 40
    elif length >= 2000:
        score += 30
    elif length >= 500:
        score += 20
    else:
        score += 10
    lower = content.lower()
    if re.search(r"^#\s+", content, re.MULTILINE):
        score += 15
    if re.search(r"^##\s+", content, re.MULTILINE):
        score += 10
    paragraphs = [p.strip() for p in content.split("\n\n") if len(p.strip()) > 50]
    if len(paragraphs) >= 3:
        score += 15
    elif len(paragraphs) >= 1:
        score += 8
    if re.search(r"```", content):
        score += 10
    if _contains_any(lower, ["install", "setup", "quick start", "getting started"]):
        score += 10
    return min(score, 100)


def _calc_tech_stack_score(tags, language):
    score = 0
    langs = _parse_raw_language(language)
    valid_langs = [l for l in langs if l.lower() in LANGUAGE_WHITELIST or l.lower() in LANGUAGE_ALIASES]
    if len(valid_langs) >= 3:
        score += 40
    elif len(valid_langs) >= 1:
        score += 25
    tech_tags = [t for t in tags if not _is_noise_tag(t)]
    if len(tech_tags) >= 5:
        score += 35
    elif len(tech_tags) >= 2:
        score += 25
    elif len(tech_tags) >= 1:
        score += 15
    combined = " ".join(tags) + " " + language
    if _contains_any(combined, ["python", "java", "javascript", "typescript", "go", "rust", "c++", "kotlin"]):
        score += 25
    return min(score, 100)


def _calc_description_score(summary):
    if not summary:
        return 0
    length = len(summary.strip())
    if length >= 200:
        return 60
    if length >= 100:
        return 45
    if length >= 50:
        return 30
    if length >= 20:
        return 15
    return 5


def _calc_tag_richness_score(tags):
    if not tags:
        return 0
    tech_tags = [t for t in tags if not _is_noise_tag(t)]
    count = len(tech_tags)
    if count >= 8:
        return 50
    if count >= 5:
        return 40
    if count >= 3:
        return 30
    if count >= 1:
        return 20
    return 0


def _calc_engineering_info_score(content):
    if not content:
        return 0
    lower = content.lower()
    hit_count = _count_hits(lower, ENGINEERING_KEYWORDS)
    if hit_count >= 6:
        return 80
    if hit_count >= 4:
        return 60
    if hit_count >= 2:
        return 40
    if hit_count >= 1:
        return 20
    return 0


# ============================================================
# trend_score
# ============================================================

def calculate_trend_score(raw_article, technology_field):
    """Calculate GitHub trend_score.

    Components:
        Update recency       30%
        Tech trend signals   30%
        Community recognition 20%
        Field weight          20%

    Returns: float in [0, 100]
    """
    update_time = raw_article.get("update_time")
    tags = _parse_raw_tags(raw_article.get("tags"))
    summary = raw_article.get("summary") or ""
    content = raw_article.get("content") or ""
    like_count = _safe_float(raw_article.get("like_count"))
    favorite_count = _safe_float(raw_article.get("favorite_count"))

    update_part = _calc_update_score(update_time) * 30

    trend_text = " ".join(tags) + " " + summary + " " + content[:3000]
    trend_hits = _count_hits(trend_text, TREND_SIGNAL_KEYWORDS)
    strong_hits = _count_hits(trend_text, STRONG_TECH_KEYWORDS)
    trend_signals = min((trend_hits * 3 + strong_hits * 5), 30)

    community_raw = math.log(1 + like_count) + math.log(1 + favorite_count) * 0.5
    community_max = math.log(1 + 50000) + math.log(1 + 10000) * 0.5
    community_part = min(community_raw / community_max, 1.0) * 20 if community_max > 0 else 0

    field_weights = {
        "人工智能": 20,
        "云原生": 17,
        "数据工程": 15,
        "后端开发": 13,
        "前端开发": 12,
        "架构": 14,
        "测试": 10,
        "运维": 10,
    }
    field_part = field_weights.get(technology_field, 8)

    total = update_part + trend_signals + community_part + field_part
    return min(round(total, 2), 100)


# ============================================================
# Summary generation
# ============================================================

def generate_summary(raw_article):
    """Generate summary for GitHub repository.

    Rules:
    1. About/summary non-empty and sufficient -> use directly
    2. About/summary empty or too short -> extract from README
    3. Never unconditionally overwrite About with README
    """
    about = raw_article.get("summary") or ""
    about = about.strip()

    if about and len(about) >= 50:
        return about

    content = raw_article.get("content") or ""
    if not content or len(content) < 100:
        return about if about else ""

    lines = [line.strip() for line in content.split("\n") if line.strip()]

    meaningful_lines = []
    for line in lines:
        if line.startswith("#"):
            continue
        if re.match(r"^[`#\-\*\|>]", line):
            continue
        if len(line) < 20:
            continue
        if _contains_any(line.lower(), [
            "click here", "badge", "shield", "build passing",
            "license", "contributions welcome", "star this",
        ]):
            continue
        meaningful_lines.append(line)

    if not meaningful_lines:
        return about if about else ""

    combined = " ".join(meaningful_lines[:5])

    if about and len(about) >= 20:
        return about + " " + combined[:200]

    if len(combined) > 300:
        combined = combined[:300]
        last_sep = -1
        for sep in ".!?\n":
            pos = combined.rfind(sep)
            if pos > last_sep:
                last_sep = pos
        if last_sep >= 80:
            combined = combined[:last_sep + 1]

    return combined if combined else about


# ============================================================
# Main cleaning function
# ============================================================

def _parse_update_time(value):
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        value = value.strip()
        if not value:
            return None
        try:
            return datetime.fromisoformat(
                value.replace("Z", "+00:00")
            ).replace(tzinfo=None)
        except ValueError:
            return None
    return None


def clean_github_full(raw_article, update_time=None):
    """Clean a GitHub article_raw record into article_info format.

    Input:
        raw_article: dict from article_raw table
        update_time: GitHub latest commit time, passed directly from Collector
    Output: dict compatible with ArticleInfoDAO.insert()

    This function does NOT access the network. It only processes
    data already present in article_raw.
    """
    source = raw_article.get("source") or "GitHub"
    source_article_id = raw_article.get("source_article_id") or ""
    source_url = raw_article.get("source_url") or ""
    title = raw_article.get("title") or ""
    author = raw_article.get("author") or ""
    raw_tags = raw_article.get("tags")
    raw_language = raw_article.get("language") or ""
    content = raw_article.get("content") or ""
    publish_time = raw_article.get("publish_time")
    crawl_time = raw_article.get("crawl_time") or datetime.now()
    update_time = _parse_update_time(update_time)

    like_count = _safe_int(raw_article.get("like_count"))
    favorite_count = _safe_int(raw_article.get("favorite_count"))

    cleaned_tags = clean_tags_and_language(raw_tags, raw_language)
    cleaned_content = clean_github_content(content)
    cleaned_summary = _remove_symbols(raw_article.get("summary") or "").strip()
    content_length = len(cleaned_content)
    technology_field = get_technology_field(raw_article)
    article_type = get_article_type(raw_article)
    hot_score = calc_hot_score(like_count, favorite_count, update_time)
    quality_score = calculate_quality_score(raw_article)
    trend_score = calculate_trend_score(raw_article, technology_field)

    base = {
        "data_type": 2,
        "source": source,
        "source_article_id": source_article_id,
        "source_url": source_url,
        "title": title,
        "author": author,
        "content": cleaned_content,
        "content_length": content_length,
        "skill_tags": json.dumps(cleaned_tags, ensure_ascii=False),
        "view_count": None,
        "like_count": like_count,
        "collect_count": favorite_count,
        "comment_count": None,
        "publish_time": publish_time,
        "crawl_time": crawl_time,
        "update_time": update_time,
    }

    base["technology_field"] = technology_field
    base["article_type"] = article_type
    base["hot_score"] = hot_score
    base["quality_score"] = quality_score
    base["trend_score"] = trend_score
    base["summary"] = cleaned_summary

    return base
