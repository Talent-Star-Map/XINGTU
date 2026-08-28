"""Public OCR utility for article collectors.

Provides:
    extract_image_text(image_url) -> str

Uses local PaddleOCR (lazy loaded on first call, instance reused).
On download failure / OCR failure / empty result, returns "".
"""

import io

import requests
from PIL import Image

_ocr_engine = None
OCR_ENABLED = False

DOWNLOAD_TIMEOUT = 20
MAX_IMAGE_SIZE = 2000
MIN_IMAGE_WIDTH = 100
MIN_IMAGE_HEIGHT = 100

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
    "Referer": "https://github.com/",
}


def get_ocr_engine():
    """Lazy init and reuse a single PaddleOCR instance."""
    global _ocr_engine
    if _ocr_engine is None:
        print("[OCR] 初始化PaddleOCR...")
        from paddleocr import PaddleOCR

        _ocr_engine = PaddleOCR(
            lang="ch",
        )
        print("[OCR] PaddleOCR初始化完成")
        return _ocr_engine


def _download_image(image_url):
    resp = requests.get(
        image_url,
        headers=HEADERS,
        timeout=DOWNLOAD_TIMEOUT,
        stream=True,
    )
    resp.raise_for_status()
    return resp.content


def _to_array(image_url):
    data = _download_image(image_url)
    print("[IMAGE SIZE]",len(data))

    image = Image.open(io.BytesIO(data))
    if image.width < MIN_IMAGE_WIDTH:
        return None
    if image.height < MIN_IMAGE_HEIGHT:
        return None
    if image.mode not in ("RGB", "L"):
        image = image.convert("RGB")
    if max(image.size) > MAX_IMAGE_SIZE:
        image.thumbnail((MAX_IMAGE_SIZE, MAX_IMAGE_SIZE))
    import numpy as np

    return np.array(image)


def _extract_lines(result):
    """Parse PaddleOCR 3.x output into a list of text lines."""
    lines = []
    if not result:
        return lines
    try:
        for page in result:
            # PaddleOCR 3.x OCRResult对象
            if hasattr(page, "rec_texts"):
                texts = page.rec_texts
                if texts:
                    for text in texts:
                        text = str(text).strip()
                        if text:
                            lines.append(text)
            # 兼容dict返回
            elif isinstance(page, dict):
                texts = page.get("rec_texts", [])
                for text in texts:
                    text = str(text).strip()
                    if text:
                        lines.append(text)
    except Exception:
        return []
    return lines


def extract_image_text(image_url):
    """Download the image and run local OCR."""

    if not image_url:
        return ""

    try:
        image_array = _to_array(image_url)

        print(
            f"[OCR] 图片下载成功: {image_url}"
        )

        engine = get_ocr_engine()

        print(
            "[OCR] 开始识别"
        )

        result = engine.predict(image_array)

        lines = _extract_lines(result)

        print(
            f"[OCR] 识别结果: {lines}"
        )

        return "\n".join(lines)

    except Exception as e:

        print(
            f"[OCR失败] {image_url}"
        )

        print(
            e
        )

        return ""
