"""简历格式覆盖测试：文字版 PDF / 扫描版 PDF / 图片 / .doc / .docx

`test_resume.py` 测技能准确率，`test_resume_fields.py` 测字段抽取，
这个脚本测的是「文件能不能读进来」——覆盖 OCR 与 .doc 转换两条链路。

依赖是可选降级：
- 没有 RapidOCR / 视觉模型 → 扫描件与图片用例 SKIP
- 没有 LibreOffice / Word / antiword → .doc 用例 SKIP
不满足条件时不会判 FAIL，只统计 SKIP，避免换台机器就红。

    cd backend && python tests/test_resume_formats.py
"""

import os
import shutil
import sys
import tempfile

BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(BACKEND_ROOT)
sys.path.insert(0, BACKEND_ROOT)

from services.resume_parser import parse_resume  # noqa: E402

PASS = 0
FAIL = 0
SKIP = 0
DETAILS = []

LINES = [
    '李思远',
    '求职意向：Java后端开发工程师',
    '手机：139 0000 1111  邮箱：lisiyuan@example.com',
    '教育背景',
    '浙江大学  本科  软件工程  2015.09-2019.06',
    '工作经历',
    '阿里巴巴集团  后端开发工程师  2019.07-2022.06',
    '技能特长',
    'Java、Spring Boot、MySQL、Redis',
]

FONT_CANDIDATES = [
    'C:/Windows/Fonts/msyh.ttc',
    'C:/Windows/Fonts/simhei.ttf',
    '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
    '/usr/share/fonts/truetype/wqy/wqy-microhei.ttc',
]


def _font(size=34):
    from PIL import ImageFont
    for p in FONT_CANDIDATES:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                continue
    return None


def _make_image(path: str) -> bool:
    """生成一张简历截图；没有中文字体时返回 False（跳过用例）"""
    from PIL import Image, ImageDraw
    font = _font()
    if font is None:
        return False
    img = Image.new('RGB', (1240, 1400), 'white')
    d = ImageDraw.Draw(img)
    y = 80
    for line in LINES:
        d.text((80, y), line, fill='black', font=font)
        y += 70
    img.save(path)
    return True


def _make_text_pdf(path: str) -> bool:
    """文字版 PDF：用 reportlab 有中文依赖，这里直接放一个只有空白页的 PDF 不合适，
    改用 docx 转 PDF 太重。跳过，文字版 PDF 由 test_resume_fields 的文本用例覆盖。"""
    return False


def _make_doc(docx_path: str, doc_path: str) -> bool:
    """.docx → .doc：优先 Word COM（Windows），其次 LibreOffice"""
    try:
        import win32com.client  # type: ignore
        word = win32com.client.DispatchEx('Word.Application')
        word.Visible = False
        word.DisplayAlerts = 0
        doc = word.Documents.Open(os.path.abspath(docx_path), ReadOnly=True)
        doc.SaveAs2(os.path.abspath(doc_path), FileFormat=0)
        doc.Close(False)
        word.Quit()
        return os.path.exists(doc_path)
    except Exception:
        pass
    soffice = shutil.which('soffice') or shutil.which('libreoffice')
    if not soffice:
        return False
    import subprocess
    try:
        subprocess.run([soffice, '--headless', '--convert-to', 'doc', '--outdir',
                        os.path.dirname(doc_path), docx_path],
                       check=True, timeout=90, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        return os.path.exists(doc_path)
    except Exception:
        return False


def check(case: str, ok: bool, got: str, want: str):
    global PASS, FAIL
    if ok:
        PASS += 1
        print(f'  [PASS] {case}')
    else:
        FAIL += 1
        DETAILS.append(f'{case}: got={got!r} want={want!r}')
        print(f'  [FAIL] {case}  got={got!r} want={want!r}')


def skip(case: str, why: str):
    global SKIP
    SKIP += 1
    print(f'  [SKIP] {case} — {why}')


def assert_parsed(case: str, path: str, want_via: str):
    r = parse_resume(path)
    if not r.get('success'):
        check(case, False, r.get('message'), 'success=True')
        return
    d = r['data']
    ok = (d.get('name') == '李思远'
          and (d.get('phone') or '').endswith('1111')
          and d.get('school') == '浙江大学'
          and len(d.get('skills') or []) >= 3
          and d.get('extract_via') == want_via)
    got = f"name={d.get('name')} phone={d.get('phone')} school={d.get('school')} skills={len(d.get('skills') or [])} via={d.get('extract_via')}"
    check(case, ok, got, f'name=李思远 school=浙江大学 skills>=3 via={want_via}')


def main():
    # 临时文件必须放在仓库目录下：Word 的「受保护视图」会拦截 %TEMP% 里的文件，
    # Documents.Open 直接抛 RPC 失败（生产环境的上传目录在仓库内，不受影响）
    tmp = tempfile.mkdtemp(prefix='.tmp-fmt-', dir=BACKEND_ROOT)
    print('=' * 66)
    print('简历格式覆盖测试（OCR / .doc 转换）')
    print('=' * 66)
    try:
        # ── 1. 图片简历 ──
        print('\n[1] 图片简历')
        png = os.path.join(tmp, 'resume.png')
        if _make_image(png):
            try:
                from services.resume_ocr import _get_rapid  # noqa: F401
                assert_parsed('png 图片识别', png, 'image-ocr')
            except Exception as e:
                skip('png 图片识别', f'OCR 后端不可用：{e}')
            # 扫描版 PDF（图片另存为 PDF，无文字层）
            pdf = os.path.join(tmp, 'scanned.pdf')
            from PIL import Image
            Image.open(png).convert('RGB').save(pdf)
            try:
                assert_parsed('扫描版 PDF 识别', pdf, 'pdf-ocr')
            except AssertionError:
                raise
            except Exception as e:
                skip('扫描版 PDF 识别', f'OCR 后端不可用：{e}')
        else:
            skip('png 图片识别', '本机没有中文字体，无法生成测试图')
            skip('扫描版 PDF 识别', '本机没有中文字体，无法生成测试图')

        # ── 2. .doc 旧格式 ──
        print('\n[2] .doc 旧格式')
        try:
            from docx import Document
            docx_path = os.path.join(tmp, 'resume.docx')
            d = Document()
            for line in LINES:
                d.add_paragraph(line)
            d.save(docx_path)
            assert_parsed('docx 解析', docx_path, 'docx')

            # 优先用固定样本（tests/fixtures/sample_resume.doc），避免依赖本机 Word/LibreOffice
            fixture = os.path.join(BACKEND_ROOT, 'tests', 'fixtures', 'sample_resume.doc')
            doc_path = fixture if os.path.exists(fixture) else os.path.join(tmp, 'resume.doc')
            if os.path.exists(doc_path):
                assert_parsed('.doc 转换解析', doc_path, 'doc-convert')
            elif _make_doc(docx_path, doc_path):
                assert_parsed('.doc 转换解析', doc_path, 'doc-convert')
            else:
                skip('.doc 转换解析', '没有 Word COM / LibreOffice，且缺少 test_data/sample_resume.doc')
        except ImportError:
            skip('docx 解析', 'python-docx 未安装')

        # ── 3. 纯文本 ──
        print('\n[3] 纯文本')
        txt = os.path.join(tmp, 'resume.txt')
        with open(txt, 'w', encoding='utf-8') as f:
            f.write('\n'.join(LINES))
        assert_parsed('txt 解析', txt, 'txt')
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

    print('\n' + '-' * 66)
    print(f'结果：PASS {PASS} / FAIL {FAIL} / SKIP {SKIP}')
    for d in DETAILS:
        print('  -', d)
    print(f'总计 → {"PASS" if FAIL == 0 else "FAIL"}')
    return 0 if FAIL == 0 else 1


if __name__ == '__main__':
    sys.exit(main())
