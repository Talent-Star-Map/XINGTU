"""Content cleaning pipeline for article_info."""

import re
import html
from bs4 import BeautifulSoup

AD_KEYWORDS = [
    "公众号", "微信公众号", "扫码关注", "关注公众号", "微信搜索",
    "交流群", "微信群", "QQ群", "加入群聊",
    "资料领取", "免费资料", "源码下载", "点击下载",
    "网盘", "提取码",
    "课程", "培训", "视频教程", "报名", "试听",
    "添加微信", "联系方式",
]

NOISE_KEYWORDS = [
    "版权声明",
    "本文原创",
    "转载请注明出处",
    "转载",
    "本文地址",
    "原文地址",
    "参考地址",
    "文章来源",
    "作者简介",
    "关注作者",
    "点赞收藏关注",
    "点赞",
    "收藏",
    "关注我",
    "关注公众号",
    "欢迎关注"
    "三连",
    "欢迎交流",
    "欢迎讨论",
    "欢迎留言",
    "欢迎评论",
    "欢迎大家",
]

SPEECH_KEYWORDS = [
    "兄弟们","小伙伴们","大家好","各位朋友",
    "朋友们","同学们","伙伴们","各位看官",
    "今天给大家","今天我们","本文主要","这篇文章",
    "最近很多朋友","废话不多说","话不多说","直接开始",
    "下面开始",
]



def clean_content(content: str) -> str:
    if not content:
        return ""

    text = _remove_html(content)
    text = _unescape_entities(text)
    text = _remove_images(text)
    text = _remove_symbols(text)
    text = _remove_markdown_symbols(text)
    lines = text.split("\n")
    lines = [_clean_line(l) for l in lines]
    lines = [l for l in lines if l is not None]
    text = "\n".join(lines)
    text = _normalize_whitespace(text)
    return text.strip()


def _remove_html(raw: str) -> str:
    soup = BeautifulSoup(raw, "html.parser")
    return soup.get_text()


def _unescape_entities(text: str) -> str:
    return html.unescape(text)


def _remove_images(text: str) -> str:
    text = re.sub(r"!\[.*?\]\(.*?\)", "", text)
    return text


def _remove_symbols(text):
    emoji_pattern = re.compile(
        "["
        "\U00010000-\U0010ffff"
        "\u2600-\u26FF"
        "\u2700-\u27BF"
        "\u2B50"
        "\uFE0F"
        "\u200D"
        "]",
        flags=re.UNICODE,
    )
    text = emoji_pattern.sub("", text)

    text = re.sub(
        r"[★☆▶️👉🔥🚀🌟✨💡🎯📌✅❌⭐]",
        "",
        text
    )

    return text


def _remove_markdown_symbols(text: str) -> str:
    text = re.sub(r"^[#>*~-]+", "", text, flags=re.MULTILINE)
    text = re.sub(r"[•●○◆◇■□]", "", text)
    return text



def _clean_line(line: str):
    s = line.strip()
    if not s:
        return None
    if len(s) < 5:
        return None
    if re.fullmatch(r"[-*#=_]{3,}", s):
        return None
    if re.search(r"https?://|www\.", s):
        return None
    if _contains_any(s, AD_KEYWORDS):
        return None
    if _contains_any(s, NOISE_KEYWORDS):
        return None
    if _contains_any(s, SPEECH_KEYWORDS):
        return None
    return s


def _contains_any(text: str, keywords: list) -> bool:
    for kw in keywords:
        if kw in text:
            return True
    return False


def _normalize_whitespace(text: str) -> str:
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text


def clean_github_content(content: str) -> str:
    if not content:
        return ""

    text = _remove_html(content)
    text = _unescape_entities(text)
    text = _remove_images(text)
    text = _remove_symbols(text)
    text = _remove_markdown_symbols(text)
    lines = text.split("\n")
    lines = [_clean_github_line(l) for l in lines]
    lines = [l for l in lines if l is not None]
    text = "\n".join(lines)
    text = _normalize_whitespace(text)
    return text.strip()


def _clean_github_line(line: str):
    s = line.strip()
    if not s:
        return None
    if len(s) < 5:
        return None
    if re.fullmatch(r"[-*#=_]{3,}", s):
        return None
    if _contains_any(s, AD_KEYWORDS):
        return None
    if _contains_any(s, NOISE_KEYWORDS):
        return None
    if _contains_any(s, SPEECH_KEYWORDS):
        return None
    return s
