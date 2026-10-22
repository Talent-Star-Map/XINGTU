"""图片 / 扫描件文字识别（OCR）

用途：图片简历、扫描版 PDF 走这里拿到纯文本，再交给 `resume_parser` 的结构化流程。

后端优先级：
1. RapidOCR（onnxruntime + 中文模型，离线、无 torch）—— 默认
2. 视觉大模型（`services/llm.complete(LLMTier.VISION, ...)`，管理员配置了多模态模型才走）
3. 都没装 → 抛 `OCRError`，由上层返回「无法识别」而不是静默产出空简历

设计要点：
- OCR 会把同一行拆成多个块（「阿里巴巴集团」「后端开发工程师 2019.07-…」），
  这里按 y 坐标合并成一行，用两个空格连接，保持和 `resume_text_blocks` 的字段切分一致
- 扫描件只取前 3 页，避免一份 20 页 PDF 卡住上传请求
"""

from __future__ import annotations

import os
import tempfile

MAX_PDF_PAGES = 3
# 渲染倍率：1.0 约 72dpi，2.0 约 144dpi，中文简历 2.0 足够且不至于太慢
PDF_RENDER_SCALE = 2.0
# PDF 文本层少于这个字数就认为没有文字层（扫描件）
TEXT_LAYER_MIN_CHARS = 40


class OCRError(Exception):
    """没有可用的 OCR 后端，或识别失败"""


_rapid = None


def _get_rapid():
    """懒加载 RapidOCR（首次初始化约 1 秒，别放在模块导入期）"""
    global _rapid
    if _rapid is not None:
        return _rapid
    try:
        from rapidocr_onnxruntime import RapidOCR
    except Exception as e:
        raise OCRError(f'未安装离线 OCR（rapidocr_onnxruntime）：{e}')
    _rapid = RapidOCR()
    return _rapid


def _group_blocks_to_lines(result) -> str:
    """把 OCR 的文本块按 y 坐标合并成行

    result 每项是 [box, text, score]，box 是四个角点。
    同一视觉行（y 中心相差小于行高 60%）的块用两个空格连接，
    这样「公司 职位 时间」还在同一行，后续能按两空格切字段。
    """
    if not result:
        return ''
    blocks = []
    for box, text, _score in result:
        text = (text or '').strip()
        if not text:
            continue
        ys = [p[1] for p in box]
        xs = [p[0] for p in box]
        blocks.append({
            'text': text,
            'y': sum(ys) / len(ys),
            'x': min(xs),
            'h': max(ys) - min(ys),
        })
    if not blocks:
        return ''
    blocks.sort(key=lambda b: (b['y'], b['x']))

    lines: list[list[dict]] = []
    for b in blocks:
        if lines:
            row = lines[-1]
            row_y = sum(i['y'] for i in row) / len(row)
            tol = max(row[0]['h'], b['h']) * 0.6
            if abs(b['y'] - row_y) <= tol:
                row.append(b)
                continue
        lines.append([b])

    out = []
    for row in lines:
        row.sort(key=lambda b: b['x'])
        # 同一行内间隔过大的两块（左右分栏）补两个空格，避免被粘成一个词
        parts = []
        for i, b in enumerate(row):
            parts.append(b['text'])
        out.append('  '.join(parts))
    return '\n'.join(out)


def ocr_image(path: str) -> str:
    """识别单张图片（png/jpg/webp/bmp/tif）"""
    ext = path.rsplit('.', 1)[-1].lower() if '.' in path else ''
    if ext == 'pdf':
        return ocr_pdf(path)
    engine = _get_rapid()
    result, _ = engine(path)
    text = _group_blocks_to_lines(result)
    if not text.strip():
        raise OCRError('图片里没有识别到文字，请确认是清晰的简历截图或扫描件')
    return text


def _render_pdf_pages(path: str) -> list[str]:
    """把 PDF 前几页渲染成临时 PNG，返回文件路径列表"""
    try:
        import pypdfium2 as pdfium
    except Exception as e:
        raise OCRError(f'未安装 PDF 渲染库（pypdfium2）：{e}')
    tmpdir = tempfile.mkdtemp(prefix='xingtu-pdf-')
    paths = []
    pdf = pdfium.PdfDocument(path)
    try:
        n = min(len(pdf), MAX_PDF_PAGES)
        for i in range(n):
            page = pdf[i]
            bitmap = page.render(scale=PDF_RENDER_SCALE)
            pil = bitmap.to_pil()
            p = os.path.join(tmpdir, f'page_{i}.png')
            pil.save(p)
            paths.append(p)
    finally:
        try:
            pdf.close()
        except Exception:
            pass
    return paths


def ocr_pdf(path: str) -> str:
    """扫描版 PDF：先渲染成图片再 OCR（最多前 3 页）"""
    pages = _render_pdf_pages(path)
    texts = []
    for p in pages:
        try:
            texts.append(ocr_image(p))
        finally:
            try:
                os.remove(p)
            except OSError:
                pass
    text = '\n'.join(t for t in texts if t.strip())
    if not text.strip():
        raise OCRError('PDF 没有文字层，OCR 也没有识别到内容')
    return text


def vision_extract_text(path: str) -> str:
    """用多模态大模型读图（管理员配置了 vision 档模型才可用）

    目前作为 RapidOCR 的备选：RapidOCR 没安装时尝试走 API。
    """
    import base64
    import mimetypes

    from services.llm import LLMTier, complete, is_global_enabled, is_mock_mode

    if is_mock_mode() or not is_global_enabled():
        raise OCRError('未启用视觉模型')
    mime = mimetypes.guess_type(path)[0] or 'image/png'
    with open(path, 'rb') as f:
        b64 = base64.b64encode(f.read()).decode()
    try:
        result = complete(
            LLMTier.VISION,
            '你是 OCR 引擎。请把图片中的简历原文逐行转成纯文本，保持原有顺序与换行，不要改写、不要总结、不要加解释。',
            [{'role': 'user', 'content': [
                {'type': 'text', 'text': '请转写这张简历图片的全部文字。'},
                {'type': 'image_url', 'image_url': {'url': f'data:{mime};base64,{b64}'}},
            ]}],
        )
    except Exception as e:
        raise OCRError(f'视觉模型调用失败：{e}')
    text = (result.get('text') or '').strip()
    if not text:
        raise OCRError('视觉模型没有返回文字')
    return text


def extract_text_from_image(path: str) -> str:
    """图片 → 文本：优先离线 OCR，失败再试视觉模型"""
    try:
        return ocr_image(path)
    except OCRError as e:
        first_err = e
    try:
        return vision_extract_text(path)
    except OCRError:
        raise first_err


def extract_text_from_scanned_pdf(path: str) -> str:
    """扫描版 PDF → 文本：优先离线 OCR，失败再试视觉模型（逐页）"""
    try:
        return ocr_pdf(path)
    except OCRError as e:
        first_err = e
    try:
        texts = []
        for p in _render_pdf_pages(path):
            try:
                texts.append(vision_extract_text(p))
            finally:
                try:
                    os.remove(p)
                except OSError:
                    pass
        text = '\n'.join(t for t in texts if t.strip())
        if text.strip():
            return text
    except OCRError:
        pass
    raise first_err
