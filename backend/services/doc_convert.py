"""旧版 .doc（Word 97-2003 二进制）转换

python-docx 读不了 .doc，必须借外部工具。按可用性依次尝试：

1. LibreOffice（`soffice --headless --convert-to docx`）—— 跨平台，质量最好，服务器/Docker 推荐
2. Windows 上的 Word COM（本机有 Office 就能用，测试环境走这条）
3. antiword / catdoc（体积小，只能拿纯文本，表格结构会丢）

都没有就抛 `DocConvertError`，让接口明确告诉用户「暂不支持 .doc，请另存为 .docx」，
而不是像以前那样返回一行错误字符串被当成简历正文。
"""

from __future__ import annotations

import os
import re
import shutil
import subprocess
import tempfile

CONVERT_TIMEOUT = 60


class DocConvertError(Exception):
    pass


def _find_soffice() -> str | None:
    for name in ('soffice', 'soffice.exe', 'libreoffice'):
        p = shutil.which(name)
        if p:
            return p
    for p in (
        r'C:\Program Files\LibreOffice\program\soffice.exe',
        r'C:\Program Files (x86)\LibreOffice\program\soffice.exe',
        '/usr/bin/soffice',
        '/usr/lib/libreoffice/program/soffice',
    ):
        if os.path.exists(p):
            return p
    return None


def _soffice_to_docx(src: str, outdir: str) -> str | None:
    exe = _find_soffice()
    if not exe:
        return None
    try:
        subprocess.run(
            [exe, '--headless', '--norestore', '--convert-to', 'docx', '--outdir', outdir, src],
            check=True, timeout=CONVERT_TIMEOUT,
            stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        )
    except Exception:
        return None
    base = os.path.splitext(os.path.basename(src))[0] + '.docx'
    dst = os.path.join(outdir, base)
    return dst if os.path.exists(dst) else None


def _word_com_to_docx(src: str, outdir: str) -> str | None:
    """Windows + Office：用 Word 另存为 docx（COM 偶发 RPC 失败，重试一次）"""
    if os.name != 'nt':
        return None
    for _ in range(2):
        dst = _word_com_once(src, outdir)
        if dst:
            return dst
    return None


def _word_com_once(src: str, outdir: str) -> str | None:
    try:
        import win32com.client  # type: ignore
    except Exception:
        return None
    base = os.path.splitext(os.path.basename(src))[0] + '.docx'
    dst = os.path.join(outdir, base)
    word = None
    doc = None
    try:
        word = win32com.client.DispatchEx('Word.Application')
        word.Visible = False
        word.DisplayAlerts = 0
        # 宏一律禁用：简历文件可能带宏
        try:
            word.AutomationSecurity = 3  # msoAutomationSecurityForceDisable
        except Exception:
            pass
        doc = word.Documents.Open(os.path.abspath(src), ReadOnly=True, AddToRecentFiles=False)
        doc.SaveAs2(os.path.abspath(dst), FileFormat=16)  # 16 = wdFormatXMLDocument(.docx)
        return dst if os.path.exists(dst) else None
    except Exception:
        return None
    finally:
        try:
            if doc is not None:
                doc.Close(False)
        except Exception:
            pass
        try:
            if word is not None:
                word.Quit()
        except Exception:
            pass


def _cli_to_text(src: str) -> str | None:
    """antiword / catdoc：只能拿纯文本，够抽字段但丢表格结构"""
    for cmd in (
        ['antiword', '-m', 'UTF-8.txt', src],
        ['catdoc', '-d', 'utf-8', src],
    ):
        if not shutil.which(cmd[0]):
            continue
        try:
            out = subprocess.run(cmd, check=True, timeout=CONVERT_TIMEOUT,
                                 stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            text = out.stdout.decode('utf-8', errors='ignore').strip()
            if text:
                return text
        except Exception:
            continue
    return None


def doc_to_docx(src: str) -> str:
    """把 .doc 转成 .docx，返回临时文件路径（调用方负责删除所在目录）"""
    outdir = tempfile.mkdtemp(prefix='xingtu-doc-')
    dst = _soffice_to_docx(src, outdir) or _word_com_to_docx(src, outdir)
    if dst:
        return dst
    shutil.rmtree(outdir, ignore_errors=True)
    raise DocConvertError(
        '.doc 解析需要 LibreOffice 或 Microsoft Word。'
        '服务器上请安装 LibreOffice（apt install libreoffice-writer），'
        '或把文件另存为 .docx 再上传。'
    )


def _binary_text(src: str) -> str | None:
    """纯 Python 兜底：直接从 OLE 的 WordDocument 流里捞可读文本

    Word 97-2003 的正文以 UTF-16LE 存在 WordDocument 流里，虽然拿不到样式和表格，
    但姓名/电话/学校/经历这些纯文本足够抽取字段。比报错强，作为最后一档。
    """
    try:
        import olefile
    except Exception:
        return None
    try:
        ole = olefile.OleFileIO(src)
    except Exception:
        return None
    try:
        if not ole.exists('WordDocument'):
            return None
        raw = ole.openstream('WordDocument').read()
    finally:
        try:
            ole.close()
        except Exception:
            pass

    def pieces(text: str) -> list[str]:
        out = []
        for chunk in re.findall(r'[\u4e00-\u9fa5A-Za-z0-9@._%+\-/：:，。、；;（）() ]{2,}', text):
            chunk = chunk.strip()
            if len(chunk) < 2:
                continue
            # 过滤纯 ASCII 的短碎片（二进制里的随机字母），中文/带数字的保留
            if chunk.isascii() and (len(chunk) < 4 or not re.search(r'[0-9@]', chunk)):
                continue
            # 二进制头部会解出「卋卋」这类同字重复碎片，去掉以免被当成姓名
            if len(chunk) <= 3 and len(set(chunk)) == 1:
                continue
            out.append(chunk)
        return out

    text = '\n'.join(pieces(raw.decode('utf-16-le', errors='ignore')))
    if len(re.sub(r'\s', '', text)) < 20:
        # 老文档可能是 8 位（cp936）编码
        text = '\n'.join(pieces(raw.decode('gb18030', errors='ignore')))
    text = re.sub(r'\n{3,}', '\n\n', text).strip()
    return text or None


def doc_to_text(src: str) -> str:
    """兜底：把 .doc 抽成纯文本

    顺序：antiword/catdoc → 纯 Python 读 OLE 流。都失败才报错。
    """
    text = _cli_to_text(src)
    if text:
        return text
    text = _binary_text(src)
    if text:
        return text
    raise DocConvertError(
        '.doc 解析需要 LibreOffice / Microsoft Word / antiword 之一，当前环境都没有，'
        '内置兜底也没读到文本。请安装 LibreOffice 或把文件另存为 .docx。'
    )


def cleanup_converted(path: str) -> None:
    """删掉转换产生的临时目录"""
    try:
        shutil.rmtree(os.path.dirname(path), ignore_errors=True)
    except Exception:
        pass
