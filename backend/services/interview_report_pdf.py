"""Render interview feedback as selectable text over the supplied PDF stationery."""
from copy import copy
from html import escape
from io import BytesIO
from pathlib import Path

from playwright.async_api import async_playwright
from PyPDF2 import PdfReader, PdfWriter

from services.resume_export import LAUNCH_ARGS, _candidate_paths


BACKGROUND = Path(__file__).resolve().parents[1] / 'resources' / 'interview-report-background.pdf'


async def render_interview_report(role, summary, rounds, notice) -> bytes:
    background = PdfReader(BACKGROUND).pages[0]
    width, height = background.mediabox.width, background.mediabox.height
    sections = []
    for index, fields in enumerate(rounds, start=1):
        paragraphs = ''.join(f'<p><b>{label}</b>{escape(value)}</p>' for label, value in fields)
        sections.append(f'<section><h2>第 {index} 轮反馈</h2>{paragraphs}</section>')
    html = f'''<!doctype html>
<html lang="zh-CN"><meta charset="utf-8"><title>星图模拟面试报告</title>
<style>
  @page {{ size: {width}pt {height}pt; margin: 72pt 54pt 176pt; }}
  body {{ margin: 0; color: #202c3b; font: 11pt/1.65 "Microsoft YaHei", "Noto Sans CJK SC", sans-serif; }}
  h1, h2 {{ color: #18395e; break-after: avoid; }}
  h1 {{ margin: 0 0 8pt; font-size: 23pt; }}
  h2 {{ border-top: 1px solid #cad6e4; margin: 16pt 0 5pt; padding-top: 6pt; font-size: 13pt; }}
  p {{ margin: 0 0 5pt; white-space: pre-wrap; overflow-wrap: anywhere; }}
  b {{ color: #18395e; }}
  .notice {{ margin-top: 16pt; color: #485a70; font-size: 9pt; }}
</style>
<body><h1>星图模拟面试练习报告</h1>
<p><b>岗位　</b>{escape(role)}</p>
<h2>总体反馈</h2><p>{escape(summary)}</p>
{''.join(sections)}<p class="notice">{escape(notice)}</p></body></html>'''

    executable = next((path for path in _candidate_paths() if Path(path).is_file()), None)
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(executable_path=executable, args=LAUNCH_ARGS)
        try:
            page = await browser.new_page()
            await page.set_content(html)
            text_pdf = await page.pdf(prefer_css_page_size=True)
        finally:
            await browser.close()

    writer = PdfWriter()
    writer.add_metadata({'/Title': '星图模拟面试报告'})
    for page in PdfReader(BytesIO(text_pdf)).pages:
        output_page = copy(background)
        output_page.merge_page(page)
        writer.add_page(output_page)
    output = BytesIO()
    writer.write(output)
    return output.getvalue()
