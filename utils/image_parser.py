"""Image URL / description parsing for article HTML content."""

import re

from utils.image_ocr import extract_image_text

_MARKDOWN_IMAGE_RE = re.compile(
    r"!\[[^\]]*\]\(\s*([^)\s]+)(?:\s+[\"'][^\"']*[\"'])?\s*\)"
)
_HTML_IMAGE_RE = re.compile(
    r"<img[^>]+src\s*=\s*[\"']([^\"']+)[\"']",
    re.IGNORECASE,
)


def extract_image_urls(content):
    """Extract image URL list from markdown / html content.

    Supports:
        Markdown: ![alt](url)
        HTML:     <img src="url">

    Returns deduplicated URL list preserving order.
    """
    if not content:
        return []

    urls = []
    for m in _MARKDOWN_IMAGE_RE.finditer(content):
        url = m.group(1).strip()
        if url:
            urls.append(url)
    for m in _HTML_IMAGE_RE.finditer(content):
        url = m.group(1).strip()
        if url:
            urls.append(url)

    seen = set()
    result = []
    for url in urls:
        if url not in seen:
            seen.add(url)
            result.append(url)
    return result


_BADGE_DOMAINS = (
    "shields.io",
    "img.shields",
    "badgen.net",
    "forthebadge.com",
    "coveralls.io",
    "codecov.io",
    "travis-ci.org",
    "badge.fury.io",
)

_BADGE_KEYWORDS = (
    "badge",
    "logo",
    "license",
    "star",
    "stargazer",
    "coverage",
    "build",
    "ci",
    "download",
    "version",
    "travis",
    "codecov",
    "discord",
)

_MEANINGLESS_OCR_WORDS = (
    "badge",
    "download",
    "follow",
    "coverage",
)

ENABLE_IMAGE_OCR = False


def _is_meaningless(src):
    """Return True if the image src is a badge / decorative / meaningless image.

    Filtering relies only on the src, not on alt / title.
    """
    src_lower = (src or "").lower()
    if any(domain in src_lower for domain in _BADGE_DOMAINS):
        return True
    if any(keyword in src_lower for keyword in _BADGE_KEYWORDS):
        return True
    return False


def extract_image_name(src):
    """
    从图片URL中提取有意义的文件名。

    示例：

    https://xxx.com/images/system_architecture.png

    返回：

    system architecture
    """
    if not src:
        return ""

    filename = src.split("?")[0].rstrip("/").split("/")[-1]

    filename = re.sub(
        r"\.(png|jpg|jpeg|gif|svg|webp)$",
        "",
        filename,
        flags=re.IGNORECASE,
    )

    filename = filename.replace(
        "_",
        " "
    ).replace(
        "-",
        " "
    )

    filename = filename.strip()

    meaningless = {
        "image",
        "img",
        "picture",
        "pic",
        "default",
        "avatar",
    }

    if filename.lower() in meaningless:
        return ""

    return filename

def is_hex_string(value):

    if len(value) < 20:
        return False

    try:
        bytes.fromhex(value)
        return True
    except Exception:
        return False

def safe_extract_image_text(src):
    """
    Safe OCR wrapper.
    OCR失败不能影响文章采集。
    """
    try:
        result = extract_image_text(src)
        print("[OCR RESULT]", result)
        return result
    except Exception as e:
        print("[OCR ERROR]", e)
        return ""


def clean_ocr_text(text):
    """Clean raw OCR result.

    Drops empty / too-short results and meaningless OCR words.
    Returns cleaned tokens joined by 、, or "" when nothing meaningful remains.
    """
    if not text:
        return ""
    cleaned = text.strip()
    if len(cleaned) < 2:
        return ""
    tokens = [t for t in re.split(r"\s+", cleaned) if t]
    kept = [
        t for t in tokens
        if t.lower() not in _MEANINGLESS_OCR_WORDS
    ]
    if not kept:
        return ""
    return "、".join(kept)


def extract_image_description(img_element):
    """Build a description from a single BeautifulSoup <img> element.

    Priority: alt > title > image filename > empty.
    Badge / decorative / logo images are filtered based on src only.
    OCR is disabled; no image is downloaded.
    """
    try:
        src = (
            img_element.get("src")
            or img_element.get("data-src")
            or ""
        ).strip()
        alt = (img_element.get("alt") or "").strip()
        title = (img_element.get("title") or "").strip()
        print("[IMAGE DEBUG]","src=", src,"alt=", alt,"title=", title)
    except Exception:
        return ""

    if _is_meaningless(src):
        return ""

    if alt:
        return alt

    if title:
        return title

    image_name = extract_image_name(src)

    if image_name:
        return image_name

    return ""