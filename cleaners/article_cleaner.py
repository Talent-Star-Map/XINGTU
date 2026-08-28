"""Phase 2 cleaner: basic fields + simple type conversions for article_info."""

import json
import math
import re
from datetime import datetime

import jieba
import jieba.analyse

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

_DOMAIN_KEYWORDS = [
    ("人工智能", [
        "大模型", "LLM", "RAG", "Agent", "智能体", "AIGC", "多模态",
        "Prompt工程", "Embedding", "向量数据库", "知识库问答",
        "生成式AI", "生成式人工智能", "人工智能", "MCP协议", "AI工程化",
        "大语言模型", "AI Agent", "AI智能体", "AI应用", "AI技术",
        "大模型生态", "LLM生态", "AI产业", "人工智能发展",
        "RAG生态", "Agent生态", "智能体生态",
    ]),
    ("后端开发", [
        "Java", "Spring Boot", "Spring Cloud", "微服务", "分布式",
        "高并发", "JVM", "Redis", "MySQL", "Go工程", "Go微服务",
        "Rust", "C++", "Python工程", "Python项目", "服务治理",
        "缓存架构", "数据库架构", "低代码平台", "企业级架构",
        "后端架构", "架构设计", "大型系统", "并发编程",
    ]),
    ("前端开发", [
        "React", "Vue3", "Vue", "前端工程化", "前端架构", "前端性能",
        "Web技术", "TypeScript", "前端生态",
    ]),
    ("数据开发", [
        "数据工程", "数据开发", "数据仓库", "数据湖", "Hive", "Spark",
        "Flink", "实时计算", "流式计算", "大数据", "ETL", "数据管道",
        "数据采集", "数据同步", "数据清洗", "数据加工", "数据平台",
        "数据服务", "数据中台", "数据架构", "数据治理", "数据技术",
        "数据智能",
    ]),
    ("云原生", [
        "Docker", "Kubernetes", "k8s", "云原生", "容器化", "容器",
        "Serverless", "Terraform", "云原生架构", "容器生态",
    ]),
    ("架构设计", [
        "技术架构", "架构演进", "企业架构", "系统架构", "微服务架构",
        "分布式架构", "云原生架构", "开源生态", "技术生态", "技术路线",
        "架构设计", "大型系统架构",
    ]),
    ("测试工程", [
        "测试开发", "自动化测试", "测试工程", "测试实践", "测试框架",
        "测试平台", "测试工具", "JUnit", "PyTest", "Selenium",
        "Playwright", "接口自动化", "接口测试", "性能测试",
        "质量保障", "持续测试", "质量平台", "测试生态",
    ]),
    ("运维安全", [
        "运维", "SRE", "监控", "Prometheus", "Grafana", "ELK",
        "Ansible", "Linux", "安全", "故障", "可观测", "DevOps",
        "CI/CD", "云运维", "自动化运维", "安全漏洞", "网络安全",
        "应用安全", "身份认证", "日志系统",
    ]),
]

_DOMAIN_PRIORITY = [
    "人工智能", "后端开发", "前端开发", "数据开发",
    "云原生", "架构设计", "测试工程", "运维安全", "其他",
]


_TYPE_KEYWORDS = [
    ("技术趋势分析", [
        "技术趋势", "技术演进", "技术生态", "发展趋势", "技术路线",
        "技术分析", "未来", "前景", "展望", "方向",
        "AI应用趋势", "技术发展趋势", "技术生态分析",
    ]),
    ("工程实践", [
        "实践", "项目实践", "应用开发", "优化实践","生产实践",
        "工程实践", "实战", "落地实践", "应用实践", "性能优化实践",
        "部署实践","解决方案",
    ]),
    ("架构设计", [
        "架构设计", "系统架构", "企业级架构", "高并发架构", "微服务架构",
        "分布式架构", "数据架构", "技术架构", "架构演进",
    ]),
    ("技术原理分析", [
        "原理", "源码", "底层", "机制", "实现原理", "深入解析",
        "源码分析", "工作流程", "全面解读", "深入",
    ]),
    ("工具与平台应用", [
        "安装", "配置", "环境搭建", "使用指南", "框架应用", "平台应用",
        "工具实践", "使用教程", "快速开始", "入门", "Docker", "Kubernetes",
        "Terraform", "Playwright", "Selenium",
    ]),
    ("技术对比评估", [
        "技术选型", "方案比较", "对比", "区别", "优缺点", "选择", "评估",
    ]),
    ("经验总结", [
        "经验", "总结", "踩坑", "问题排查", "解决方案", "实践心得",
        "优化经验", "避坑", "故障",
    ]),
]

_TYPE_PRIORITY = [
    "架构设计", "工程实践", "技术趋势分析", "技术原理分析",
    "技术对比评估", "工具与平台应用", "经验总结", "其他",
]

_TYPE_WEIGHT = {
    "技术趋势分析": {
        "title": 6,
        "tag": 4,
        "content": 1,
    },
    "架构设计": {
        "title": 6,
        "tag": 4,
        "content": 1,
    },
    "技术原理分析": {
        "title": 6,
        "tag": 4,
        "content": 1,
    },
    "技术对比评估": {
        "title": 6,
        "tag": 4,
        "content": 1,
    },
    "工具与平台应用": {
        "title": 5,
        "tag": 3,
        "content": 1,
    },
    "工程实践": {
        "title": 4,
        "tag": 2,
        "content": 1,
    },
    "经验总结": {
        "title": 4,
        "tag": 2,
        "content": 1,
    },
}

_FIELD_TYPE_BONUS = {
    "人工智能": {
        "技术趋势分析": 3,
        "工程实践": 1,
    },
    "云原生": {
        "架构设计": 3,
        "工具与平台应用": 5,
    },
    "后端开发": {
        "架构设计": 3,
        "技术原理分析": 2,
    },
    "数据开发": {
        "工程实践": 2,
        "架构设计": 2,
    },
    "运维安全": {
        "技术原理分析": 2,
    },
}


def normalize_tags(tags):
    if isinstance(tags, str):
        try:
            tags = json.loads(tags)
        except (json.JSONDecodeError, TypeError):
            tags = []
    if not isinstance(tags, list):
        tags = []
    return tags


def get_article_type(article):
    title = article.get("title") or ""
    tags = normalize_tags(article.get("tags"))
    content = article.get("content") or ""

    scores = {}
    for atype, keywords in _TYPE_KEYWORDS:
        score = 0
        weights = _TYPE_WEIGHT.get(atype, {
            "title": 5,
            "tag": 3,
            "content": 1,
        })
        for kw in keywords:
            p = re.compile(re.escape(kw), re.IGNORECASE)
            if p.search(title):
                score += weights["title"]
            for tag in tags:
                if p.search(tag):
                    score += weights["tag"]
                    break
            if p.search(content):
                score += weights["content"]
        if score > 0:
            scores[atype] = score

    if not scores:
        return "其他"

    field = get_technology_field(article)

    for atype in scores:
        if field in _FIELD_TYPE_BONUS:
            scores[atype] += _FIELD_TYPE_BONUS[field].get(atype, 0)

    max_score = max(scores.values())
    candidates = [t for t, s in scores.items() if s == max_score]
    for atype in _TYPE_PRIORITY:
        if atype in candidates:
            return atype
    return "其他"


def get_technology_field(article):
    title = article.get("title") or ""
    tags = normalize_tags(article.get("tags"))
    content = article.get("content") or ""

    scores = {}
    for domain, keywords in _DOMAIN_KEYWORDS:
        score = 0
        matched = []
        for kw in keywords:
            p = re.compile(re.escape(kw), re.IGNORECASE)
            if p.search(title):
                score += 5
                matched.append(kw)
            for tag in tags:
                if p.search(tag):
                    score += 3
                    if kw not in matched:
                        matched.append(kw)
                    break
            if p.search(content):
                score += 1
                if kw not in matched:
                    matched.append(kw)
        if score > 0:
            scores[domain] = (score, matched)

    if not scores:
        return "其他"

    max_score = max(s for s, _ in scores.values())
    candidates = [d for d, (s, m) in scores.items() if s == max_score]
    for domain in _DOMAIN_PRIORITY:
        if domain in candidates:
            return domain
    return "其他"


def calc_hot_score(read_count, like_count, favorite_count, comment_count):
    def safe_log(v):
        return math.log(max(v or 0, 0) + 1)

    read_s = safe_log(read_count) * 0.4
    like_s = safe_log(like_count) * 0.3
    fav_s = safe_log(favorite_count) * 0.2
    comment_s = safe_log(comment_count) * 0.1

    hot_raw = read_s + like_s + fav_s + comment_s
    return min(round(hot_raw * 13, 2), 100)


_TYPE_SCORE_MAP = {
    "架构设计": 20,
    "技术原理分析": 20,
    "工程实践": 18,
    "技术趋势分析": 18,
    "技术对比评估": 16,
    "工具与平台应用": 14,
    "经验总结": 12,
    "其他": 8,
}

_COMPLETENESS_KEYWORDS = [
    "实现", "原理", "步骤", "流程", "架构", "代码",
    "配置", "部署", "优化", "实践", "方案",
]

_ALL_TECH_KEYWORDS = list(set(
    PRECISE_KEYWORDS + ENGINEERING_KEYWORDS + ECOSYSTEM_KEYWORDS
))


def calculate_quality_score(article):
    title = article.get("title") or ""
    tags = normalize_tags(article.get("tags"))
    content = article.get("content") or ""

    content_length = article.get("content_length") or len(content)
    article_type = article.get("article_type") or ""

    length_score = _calc_length_score(content_length)
    kw_score = _calc_keyword_density(title, tags, content)
    type_score = _calc_type_score(article_type)
    completeness_score = _calc_completeness(content)

    total = length_score + kw_score + type_score + completeness_score
    return min(round(total, 2), 100)


def _calc_length_score(length):
    if length >= 3000:
        return 30
    if length >= 1500:
        return 25
    if length >= 500:
        return 20
    return 10


def _calc_keyword_density(title, tags, content):
    combined = (title + " " + " ".join(tags) + " " + content).lower()
    count = 0
    for kw in _ALL_TECH_KEYWORDS:
        if kw.lower() in combined:
            count += 1
    if count >= 9:
        return 30
    if count >= 4:
        return 20
    if count >= 1:
        return 10
    return 0


def _calc_type_score(article_type):
    return _TYPE_SCORE_MAP.get(article_type, 0)


def _calc_completeness(content):
    lower = content.lower()
    count = sum(1 for kw in _COMPLETENESS_KEYWORDS if kw in lower)
    if count >= 9:
        return 20
    if count >= 6:
        return 15
    if count >= 3:
        return 10
    return 5


_FIELD_TREND_SCORE_MAP = {
    "人工智能": 15,
    "云原生": 13,
    "数据开发": 12,
    "后端开发": 10,
    "前端开发": 10,
    "测试工程": 8,
    "运维安全": 8,
}


def _calc_time_score(publish_time):
    if not publish_time:
        return 10
    try:
        if isinstance(publish_time, str):
            dt = datetime.strptime(publish_time, "%Y-%m-%d %H:%M:%S")
        else:
            dt = publish_time
        days = (datetime.now() - dt).days
        if days <= 180:
            return 30
        if days <= 365:
            return 25
        if days <= 730:
            return 18
        if days <= 1095:
            return 10
        return 5
    except (ValueError, TypeError):
        return 10


def _calc_trend_keyword_score(article):
    title = article.get("title") or ""
    tags = normalize_tags(article.get("tags"))
    content = article.get("content") or ""

    combined = (title + " " + " ".join(tags) + " " + content).lower()

    count1 = sum(1 for kw in PRECISE_KEYWORDS if kw.lower() in combined)
    prec = min(count1 * 5, 20)

    count2 = sum(1 for kw in ENGINEERING_KEYWORDS if kw.lower() in combined)
    eng = min(count2 * 3, 10)

    count3 = sum(1 for kw in ECOSYSTEM_KEYWORDS if kw.lower() in combined)
    eco = min(count3 * 2, 5)

    return min(prec + eng + eco, 35)


def _calc_hot_influence(hot_score):
    return min((hot_score or 0) * 0.2, 20)


def _calc_field_score(technology_field):
    return _FIELD_TREND_SCORE_MAP.get(technology_field, 5)


def calculate_trend_score(article):
    time_score = _calc_time_score(article.get("publish_time"))
    kw_score = _calc_trend_keyword_score(article)
    hot_part = _calc_hot_influence(article.get("hot_score"))
    field_score = _calc_field_score(article.get("technology_field"))

    total = time_score + kw_score + hot_part + field_score
    return min(round(total, 2), 100)


jieba.setLogLevel(20)


_SUMMARY_FILTER_KEYWORDS = [
    "点击关注", "扫码获取", "免费领取", "加微信", "私信", "下载地址",
    "大家好", "我是", "本文记录", "今天分享",
    "最近很多朋友问", "众所周知", "相信大家",
]

SUMMARY_NOISE_PATTERNS = [
    # Markdown
    r"^#+",
    r"^-+",
    r"^\*+",
    r"^>+",

    # 多级章节编号
    # 例如：
    # 1.6
    # 4.7.1
    r"^\d+[\.\、]\s+",

    # 普通数字编号
    # 例如：
    # 1.
    # 1、
    r"^\d+[\.\、]\s*",

    # 括号编号
    r"^[\(（]\d+[\)）]\s*",

    # 中文编号
    r"^[一二三四五六七八九十]+[\、\.]\s*",

    # 中文括号编号
    r"^[\(（][一二三四五六七八九十]+[\)）]\s*",

    # 圆圈数字
    r"^[①②③④⑤⑥⑦⑧⑨⑩]\s*",
]

SUMMARY_BAD_END = [
    "主要包括",
    "包括",
    "如下",
    "例如",
    "以及",
]

SUMMARY_LIST_PATTERNS = [
    r"^\d+[\.\、]",
    r"^\d+(\.\d+)+",
    r"^[\(（]\d+[\)）]",
    r"^[一二三四五六七八九十]+[\、\.]",
    r"^[①②③④⑤⑥⑦⑧⑨⑩]",
]

SUMMARY_SECTION_PATTERNS = [
    r"[。；;]\s*.{0,10}生成：",
    r"[。；;]\s*.{0,10}诊断：",
    r"[。；;]\s*.{0,10}应用：",
]


def _split_sentences(text):
    text = re.sub(r"\n+", "\n", text)

    parts = re.split(
        r"(?<=[。！？\?])|\n",
        text
    )

    return [
        s.strip()
        for s in parts
        if len(s.strip()) >= 10
    ]


def generate_summary(content):
    if not content or len(content) < 50:
        return ""

    chinese_chars = len(re.findall(r"[\u4e00-\u9fa5]", content))
    english_chars = len(re.findall(r"[A-Za-z]", content))
    total_chars = chinese_chars + english_chars

    if total_chars > 0:
        english_ratio = english_chars / total_chars
        chinese_ratio = chinese_chars / total_chars

        if english_ratio > 0.6 and chinese_ratio < 0.25:
            code_like = len(re.findall(
                r"[{}();=<>\[\]_/\\]",
                content
            ))
            if code_like / max(len(content), 1) < 0.05:
                return ""
 

    code_blocks = len(re.findall(r"```[\s\S]*?```", content))

    if code_blocks >= 3 and len(content) < code_blocks * 500:
        return ""

    sentences = _split_sentences(content)
    if len(sentences) < 3:
        summary = clean_summary(content[:300])

        if _is_bad_summary(summary):
            return ""

        return summary

    keywords = jieba.analyse.textrank(content, topK=30, withWeight=True)
    word_scores = dict(keywords)

    scored = []
    for i, sent in enumerate(sentences):
        words = [w for w in jieba.lcut(sent) if len(w) > 1]
        score = sum(word_scores.get(w, 0) for w in words)
        scored.append((score, i, sent))

    best_window = []
    best_score = -1
    min_window = 3
    max_window = 7

    for start in range(len(scored)):
        ws = 0
        for end in range(start, min(len(scored), start + max_window)):
            ws += scored[end][0]
            count = end - start + 1
            if count >= min_window:
                adjusted = ws * (1.0 + count * 0.05)
                if adjusted > best_score:
                    best_score = adjusted
                    best_window = scored[start:end + 1]

    if not best_window:
        best_window = scored[:3]

    filtered = []
    for _, _, sent in best_window:
        sent = clean_summary(sent)
        if not sent:
            continue
        lower = sent.lower()
        if any(kw in lower for kw in _SUMMARY_FILTER_KEYWORDS):
            continue
        if len(sent) < 20:
            continue
        filtered.append(sent)

    if not filtered:
        filtered = [sent for _, _, sent in best_window[:3]]

    summary = "".join(filtered)

    if len(summary) > 300:
        cut = summary[:300]
        last_sep = -1
        for sep in "。！？\n":
            pos = cut.rfind(sep)
            if pos > last_sep:
                last_sep = pos
        if last_sep >= 80:
            summary = cut[:last_sep + 1]
        else:
            summary = cut[:80]

    if len(summary) < 50 and len(sentences) > 0:
        for s in sentences:
            lower = s.lower()
            if any(kw in lower for kw in _SUMMARY_FILTER_KEYWORDS):
                continue
            summary += s
            if len(summary) >= 50:
                break

    if _is_bad_summary(summary):
        return ""

    summary = clean_summary(summary)

    if _is_bad_summary(summary):
        return ""

    if len(summary) < 50:
        return ""

    return summary


def clean_summary(summary: str) -> str:
    if not summary:
        return ""

    from utils.content_cleaner import _remove_symbols
    summary = _remove_symbols(summary)

    lines = summary.split("\n")

    cleaned = []

    for line in lines:
        line = line.strip()

        if not line:
            continue

        for pattern in SUMMARY_NOISE_PATTERNS:
            line = re.sub(pattern, "", line).strip()

        if not line:
            continue

        cleaned.append(line)

    summary = " ".join(cleaned)

    summary = re.sub(
        r"[\*\#\>\-\_\|]+",
        "",
        summary
    )

    summary = re.sub(
        r"\s+",
        " ",
        summary
    )

    summary = re.sub(
        r"^[^a-zA-Z0-9\u4e00-\u9fa5]+",
        "",
        summary
    )
    summary = summary.strip()
    # 过滤无意义开头符号，例如：，。！？：；、等
    summary = re.sub(
        r"^[，。！？；：、,.!?;:\-\_\s]+",
        "",
        summary
    )

    return summary.strip()


def _contains_summary_list(summary: str) -> bool:
    lines = summary.split("\n")

    hit = 0

    for line in lines:
        line = line.strip()
        if not line:
            continue
        for pattern in SUMMARY_LIST_PATTERNS:
            if re.match(pattern, line):
                hit += 1
                break

    return hit >= 3


def _is_section_summary(summary):
    count = 0

    for pattern in SUMMARY_SECTION_PATTERNS:
        if re.search(pattern, summary):
            count += 1

    return count >= 2


def _is_bad_summary(summary: str) -> bool:
    if not summary:
        return True

    for kw in SUMMARY_BAD_END:
        if summary.endswith(kw):
            return True

    if _contains_summary_list(summary):
        return True

    if _is_section_summary(summary):
        return True

    return False


def clean_article_basic(raw_article):
    """将 article_raw 的一行转换为 article_info 基础字段字典。

    返回的字典包含 dao.insert 所需的全部字段，但 content / content_length /
    technology_field / article_type / hot_score / quality_score / trend_score /
    skill_tags / summary 等需要由调用方根据具体数据源进一步填充或覆盖。
    """
    tags = normalize_tags(raw_article.get("tags"))
    content = raw_article.get("content") or ""
    source = raw_article.get("source") or ""
    source_article_id = raw_article.get("source_article_id") or ""
    source_url = raw_article.get("source_url") or ""
    title = raw_article.get("title") or ""
    author = raw_article.get("author") or ""
    publish_time = raw_article.get("publish_time")
    crawl_time = raw_article.get("crawl_time") or datetime.now()
    update_time = datetime.now()

    view_count = raw_article.get("read_count") or 0
    like_count = raw_article.get("like_count") or 0
    collect_count = raw_article.get("favorite_count") or 0
    comment_count = raw_article.get("comment_count") or 0

    return {
        "data_type": 2,
        "source": source,
        "source_article_id": source_article_id,
        "source_url": source_url,
        "title": title,
        "author": author,
        "content": content,
        "content_length": len(content),
        "skill_tags": json.dumps(tags or [], ensure_ascii=False),
        "view_count": view_count,
        "like_count": like_count,
        "collect_count": collect_count,
        "comment_count": comment_count,
        "publish_time": publish_time,
        "crawl_time": crawl_time,
        "update_time": update_time,
    }


def clean_article_full(raw_article):
    """将 article_raw 的一行完整清洗为 article_info 所需字段。

    在 clean_article_basic 的基础上补齐 content_length / technology_field /
    article_type / hot_score / quality_score / trend_score / summary 等字段，
    返回值可直接传入 ArticleInfoDAO.insert（全部字段以 %(name)s 占位）。

    当 source == "GitHub" 时，分发到独立的 GitHub cleaner 处理。
    """
    source = raw_article.get("source") or ""

    if source == "GitHub":
        from cleaners.github_repository_cleaner import clean_github_full
        update_time = raw_article.get("update_time")
        return clean_github_full(raw_article, update_time)

    tags = normalize_tags(raw_article.get("tags"))
    content = raw_article.get("content") or ""
    source_article_id = raw_article.get("source_article_id") or ""
    title = raw_article.get("title") or ""
    source_url = raw_article.get("source_url") or ""
    author = raw_article.get("author") or ""
    publish_time = raw_article.get("publish_time")
    crawl_time = raw_article.get("crawl_time") or datetime.now()
    update_time = datetime.now()

    view_count = raw_article.get("read_count") or 0
    like_count = raw_article.get("like_count") or 0
    collect_count = raw_article.get("favorite_count") or 0
    comment_count = raw_article.get("comment_count") or 0

    content_length = len(content)

    base = {
        "data_type": 2,
        "source": source,
        "source_article_id": source_article_id,
        "source_url": source_url,
        "title": title,
        "author": author,
        "content": content,
        "content_length": content_length,
        "skill_tags": json.dumps(tags or [], ensure_ascii=False),
        "view_count": view_count,
        "like_count": like_count,
        "collect_count": collect_count,
        "comment_count": comment_count,
        "publish_time": publish_time,
        "crawl_time": crawl_time,
        "update_time": update_time,
    }

    base["technology_field"] = get_technology_field(base)
    base["article_type"] = get_article_type(base)
    base["hot_score"] = calc_hot_score(
        view_count, like_count, collect_count, comment_count
    )
    base["quality_score"] = calculate_quality_score(base)
    base["trend_score"] = calculate_trend_score(base)
    base["summary"] = generate_summary(content)

    return base
