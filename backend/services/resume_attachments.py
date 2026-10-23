"""原始简历附件：归属校验、历史元数据及本机 Word/PDF 预览。"""
import json
import mimetypes
from pathlib import Path
import subprocess
import tempfile

from fastapi import HTTPException

EXTENSIONS = {'pdf', 'doc', 'docx', 'txt', 'png', 'jpg', 'jpeg', 'webp', 'bmp', 'tif', 'tiff'}


def owned_path(root: str, uid: int, filename: str) -> Path:
    if (not filename or '/' in filename or '\\' in filename
            or not filename.startswith(f'{uid}_')):
        raise HTTPException(403, '无权访问该附件')
    base = Path(root).resolve()
    path = base / filename
    if path.suffix.lower().lstrip('.') not in EXTENSIONS:
        raise HTTPException(400, '不支持的附件类型')
    if path.is_symlink() or path.resolve().parent != base:
        raise HTTPException(403, '无权访问该附件')
    if not path.is_file():
        raise HTTPException(404, '原附件不存在，可能已删除或未同步到当前后端')
    return path


def cached_data(path: Path) -> dict:
    try:
        data = json.loads(Path(str(path) + '.json').read_text(encoding='utf-8'))
        return data if isinstance(data, dict) else {}
    except (OSError, ValueError):
        return {}


def remember_filename(path: Path, original_filename: str) -> None:
    """独立保存上传名称，不依赖可重建/可覆盖的解析缓存。"""
    name = Path(str(original_filename or path.name).replace('\\', '/')).name
    record = Path(str(path) + '.metadata')
    temporary = Path(str(record) + '.tmp')
    temporary.write_text(json.dumps({'original_filename': name}, ensure_ascii=False), encoding='utf-8')
    temporary.replace(record)


def metadata(path: Path) -> dict:
    from datetime import datetime
    data = cached_data(path)
    try:
        original = json.loads(Path(str(path) + '.metadata').read_text(encoding='utf-8')).get('original_filename')
    except (OSError, ValueError, AttributeError):
        original = None
    stat = path.stat()
    return {
        'path': path.name, 'filename': Path(str(original or data.get('filename') or path.name).replace('\\', '/')).name,
        'date': datetime.fromtimestamp(stat.st_mtime).strftime('%Y-%m-%d %H:%M'),
        'size': stat.st_size, 'extension': path.suffix[1:].lower(),
        'content_type': mimetypes.guess_type(path.name)[0] or 'application/octet-stream',
        'parsed_available': bool(data),
    }


def word_pdf(path: Path) -> bytes:
    from services.doc_convert import _find_soffice
    executable = _find_soffice()
    if not executable:
        raise HTTPException(503, 'Word预览服务暂不可用，请下载原附件查看')
    with tempfile.TemporaryDirectory(prefix='xingtu-attachment-') as folder:
        # 独立配置目录避免并发转换相互抢占；附件只在当前后端转换。
        profile = (Path(folder) / 'profile').as_uri()
        try:
            subprocess.run([
                executable, f'-env:UserInstallation={profile}', '--headless', '--norestore',
                '--convert-to', 'pdf:writer_pdf_Export', '--outdir', folder, str(path.resolve()),
            ], check=True, timeout=60, capture_output=True)
            output = Path(folder) / (path.stem + '.pdf')
            content = output.read_bytes()
            if not content.startswith(b'%PDF-'):
                raise ValueError('invalid PDF')
            return content
        except (subprocess.SubprocessError, OSError, ValueError):
            raise HTTPException(422, '该Word附件无法预览，请下载原文件查看') from None


def pdf_page(source, number: int) -> tuple[bytes, int]:
    """只渲染当前页，兼容没有原生 PDF 插件的浏览器。"""
    from io import BytesIO
    import pypdfium2
    try:
        with pypdfium2.PdfDocument(source) as document:
            total = len(document)
            if number > total:
                raise HTTPException(400, '预览页码超出范围')
            page = document[number - 1]
            try:
                bitmap = page.render(scale=min(1.5, 1600 / max(1, page.get_width())))
                try:
                    output = BytesIO()
                    bitmap.to_pil().save(output, format='PNG')
                    return output.getvalue(), total
                finally:
                    bitmap.close()
            finally:
                page.close()
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(422, '附件无法预览，可能已加密或损坏，请下载原文件查看') from None
