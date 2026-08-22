"""简历导出 — Playwright 引擎 + Fit-One-Page

负责把前端 /print/{token} 路由渲染成 PDF/HTML 二进制。
复用 51 套 React 模板(frontend/src/components/resume/preview/templates/)— 后端
无需重写 HTML,只负责驱动浏览器。

关键设计:
- 浏览器探测:Windows Chrome/Edge / Linux chromium-browser / playwright 自带
- Fit-One-Page:4 阶段缩放,移植自 JadeAI src/lib/pdf/generate-pdf.ts
- prevent_nearly_blank_page:仅当溢出 ≤15% 时触发,默认 PDF 路径
- 异步:Playwright Python SDK 走 asyncio,FastAPI async def 配合

参考:
- JadeAI generate-pdf.ts (TypeScript)
- Playwright Python docs https://playwright.dev/python/docs/api/class-page

@owner: XINGTU 团队(AI 简历中心)
"""

import os
import platform
from pathlib import Path
from typing import Optional

from playwright.async_api import Browser, async_playwright, Page


# ── A4 尺寸(96 DPI,像素) ─────────────────────────────────────────────────
A4_WIDTH_PX = 794   # 210mm
A4_HEIGHT_PX = 1123  # 297mm
MAX_ITERATIONS = 20


# ── Playwright 启动参数(对齐 JadeAI) ────────────────────────────────────
# --no-sandbox / --disable-setuid-sandbox:容器内需要
# --disable-dev-shm-usage:Docker /dev/shm 太小,Chrome 会崩(issue #85)
# --disable-gpu:headless 不需要 GPU
LAUNCH_ARGS = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--font-render-hinting=none',
    '--disable-features=TranslateUI',
]


# ── 浏览器路径候选(按优先级) ─────────────────────────────────────────────

def _candidate_paths() -> list[str]:
    """按平台返回可能的 Chromium 二进制路径(参考 JadeAI generate-pdf.ts)"""
    paths: list[str] = []

    # 1. 环境变量优先
    env = os.environ.get('CHROMIUM_PATH')
    if env:
        paths.append(env)

    if platform.system() == 'Windows':
        # Windows:Chrome + Edge 常见安装路径
        for env_var in ('PROGRAMFILES', 'PROGRAMFILES(X86)', 'LOCALAPPDATA'):
            base = os.environ.get(env_var)
            if not base:
                continue
            paths.append(f"{base}\\Google\\Chrome\\Application\\chrome.exe")
            paths.append(f"{base}\\Microsoft\\Edge\\Application\\msedge.exe")
    else:
        # Linux + macOS
        paths.extend([
            '/usr/bin/chromium',
            '/usr/bin/chromium-browser',
            '/usr/bin/google-chrome',
            '/usr/bin/google-chrome-stable',
            '/snap/bin/chromium',
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        ])

    return paths


async def get_browser() -> Browser:
    """探测并启动 headless Chromium。失败时抛出明确异常,router 转 503。"""
    last_err: Optional[Exception] = None
    for path in _candidate_paths():
        try:
            if path and Path(path).exists():
                browser = await async_playwright().start()
                return await browser.chromium.launch(
                    executable_path=path,
                    headless=True,
                    args=LAUNCH_ARGS,
                )
        except Exception as e:
            last_err = e
            continue

    # 全部探测失败 — 最后一次尝试 playwright 自带 chromium
    try:
        pw = await async_playwright().start()
        return await pw.chromium.launch(headless=True, args=LAUNCH_ARGS)
    except Exception as e:
        last_err = e

    raise RuntimeError(
        'No Chrome/Chromium found. Install Google Chrome / Microsoft Edge, '
        'or set CHROMIUM_PATH env var to a valid Chromium binary.'
    ) from last_err


# ── 主入口 ────────────────────────────────────────────────────────────────

async def render_pdf(url: str, fit_one_page: bool = False, timeout_ms: int = 30_000) -> bytes:
    """加载 URL 并导出 A4 PDF

    Args:
        url: 前端 /print/{token} 路由(完整 URL,带 scheme)
        fit_one_page: True=强制缩到一页;False=防近空白页(默认)
        timeout_ms: 加载超时(默认 30 秒)
    Returns:
        PDF 字节内容
    Raises:
        RuntimeError: 浏览器未找到 / 渲染失败
    """
    browser = await get_browser()
    try:
        context = await browser.new_context(
            viewport={'width': A4_WIDTH_PX, 'height': A4_HEIGHT_PX},
            device_scale_factor=2,  # 高分辨率输出
        )
        page = await context.new_page()
        try:
            await page.goto(url, wait_until='networkidle', timeout=timeout_ms)
            # 等 React 模板渲染 + 字体加载
            await page.wait_for_selector('.resume-export', timeout=timeout_ms)
            await page.evaluate('document.fonts.ready')
            # 双 rAF:确保字体替换后布局稳定
            await page.evaluate(
                'new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))'
            )

            if fit_one_page:
                await fit_content_to_one_page(page)
            else:
                await prevent_nearly_blank_page(page)

            pdf_bytes = await page.pdf(
                format='A4',
                print_background=True,
                margin={'top': '0', 'right': '0', 'bottom': '0', 'left': '0'},
                prefer_css_page_size=True,
            )
            return pdf_bytes
        finally:
            await context.close()
    finally:
        await browser.close()


async def render_html(url: str, timeout_ms: int = 30_000) -> bytes:
    """加载 URL 并返回完整 HTML(含所有 CSS 内联)

    用于 HTML 导出 / JadeAI issue#85 的浏览器打印 fallback
    """
    browser = await get_browser()
    try:
        context = await browser.new_context(
            viewport={'width': A4_WIDTH_PX, 'height': A4_HEIGHT_PX},
        )
        page = await context.new_page()
        try:
            await page.goto(url, wait_until='networkidle', timeout=timeout_ms)
            await page.wait_for_selector('.resume-export', timeout=timeout_ms)
            await page.evaluate('document.fonts.ready')
            content = await page.content()
            return content.encode('utf-8')
        finally:
            await context.close()
    finally:
        await browser.close()


# ── 高度测量 ──────────────────────────────────────────────────────────────

async def _measure_height(page: Page) -> int:
    """document.documentElement.scrollHeight(包含所有内容的高度)"""
    return await page.evaluate('document.documentElement.scrollHeight')


async def _viewport_height(page: Page) -> int:
    return await page.evaluate('window.innerHeight')


# ── Fit-One-Page 算法(移植自 JadeAI generate-pdf.ts::fitContentToOnePage) ─

async def fit_content_to_one_page(page: Page) -> None:
    """强制把内容塞进一页 — 4 阶段迭代缩放

    阶段 1:压缩 section 间距 -2px × 3 次
    阶段 2:压缩行间距(line-height) -0.05 × 2 次
    阶段 3:压缩容器内边距 -4px × 3 次
    阶段 4:整体 transform: scale,最低 0.85

    每个阶段后检查是否已经塞进一页,达到就停止。
    """
    base_spacing = await page.evaluate(
        """() => {
            const el = document.querySelector('.resume-export');
            if (!el) return 16;
            return parseFloat(getComputedStyle(el).getPropertyValue('--base-section-spacing')) || 16;
        }"""
    )
    base_line_height = await page.evaluate(
        """() => {
            const el = document.querySelector('.resume-export');
            if (!el) return 1.5;
            return parseFloat(getComputedStyle(el).getPropertyValue('--base-line-spacing')) || 1.5;
        }"""
    )

    await page.add_style_tag(content=_SHRINK_BASE_RULES)

    max_section_steps = 3
    max_line_steps = 2
    max_padding_steps = 3

    # 阶段 1: section 间距
    for i in range(max_section_steps):
        delta = 2 * (i + 1)
        await page.evaluate(
            """(delta) => {
                const root = document.querySelector('.resume-export');
                if (!root) return;
                root.style.setProperty('--fit-section-spacing', `-${delta}px`);
                root.querySelectorAll('[data-section]').forEach(el => {
                    el.style.marginBottom = `calc(var(--base-section-spacing, 16px) - ${delta}px)`;
                });
            }""",
            delta,
        )
        await _wait_reflow(page)
        if await _is_single_page(page):
            return

    # 阶段 2: 行间距
    for i in range(max_line_steps):
        delta = 0.05 * (i + 1)
        await page.evaluate(
            """(delta) => {
                const root = document.querySelector('.resume-export');
                if (!root) return;
                root.querySelectorAll('p, li, span, td').forEach(el => {
                    el.style.lineHeight = `calc(var(--base-line-spacing, 1.5) - ${delta})`;
                });
            }""",
            delta,
        )
        await _wait_reflow(page)
        if await _is_single_page(page):
            return

    # 阶段 3: 容器内边距
    for i in range(max_padding_steps):
        delta = 4 * (i + 1)
        await page.evaluate(
            """(delta) => {
                const root = document.querySelector('.resume-export');
                if (!root) return;
                const target = root.querySelector(':scope > div');
                if (target) {
                    target.style.paddingLeft = `calc(var(--base-padding-left, 32px) - ${delta}px)`;
                    target.style.paddingRight = `calc(var(--base-padding-right, 32px) - ${delta}px)`;
                }
            }""",
            delta,
        )
        await _wait_reflow(page)
        if await _is_single_page(page):
            return

    # 阶段 4: 整体缩放(收尾)
    for scale in (0.95, 0.90, 0.85):
        await page.evaluate(
            """(scale) => {
                const root = document.querySelector('.resume-export > div');
                if (!root) return;
                root.style.transform = `scale(${scale})`;
                root.style.transformOrigin = 'top center';
            }""",
            scale,
        )
        await _wait_reflow(page)
        if await _is_single_page(page):
            return


async def prevent_nearly_blank_page(page: Page) -> None:
    """防"几乎全空的第二页" — 仅当超出 ≤15% 时触发

    比 fitContentToOnePage 轻很多:只做一次 transform: scale 整体微缩,
    不改分页规则,所以多页排版不受影响。
    """
    viewport_h = await _viewport_height(page)
    doc_h = await _measure_height(page)
    if doc_h <= viewport_h:
        return  # 本来就 1 页
    overflow = (doc_h - viewport_h) / viewport_h
    if overflow > 0.15:
        return  # 内容太多,不适合微缩,让 Puppeteer 正常多页输出

    scale = max(0.95, 1 - overflow * 1.5)
    await page.evaluate(
        """(scale) => {
            const root = document.querySelector('.resume-export > div');
            if (!root) return;
            root.style.transform = `scale(${scale})`;
            root.style.transformOrigin = 'top center';
        }""",
        scale,
    )
    await _wait_reflow(page)


# ── helpers ──────────────────────────────────────────────────────────────

async def _is_single_page(page: Page) -> bool:
    """内容高度 ≤ 视口高度(放得进一页)"""
    doc_h = await _measure_height(page)
    win_h = await _viewport_height(page)
    return doc_h <= win_h + 1


async def _wait_reflow(page: Page) -> None:
    """等 CSS 应用后 reflow(双 rAF)"""
    await page.evaluate(
        'new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))'
    )


# 注入的全局样式 — 防止 Puppeteer 把整个 section 推到下一页
# (break-inside:avoid + overflow:hidden 会让 Chrome 视为 monolithic,不碎片化)
_SHRINK_BASE_RULES = """
  .resume-export > div,
  .resume-export [data-section],
  .resume-export [data-section] * {
    break-inside: auto !important;
    overflow: visible !important;
  }
  .resume-export h2,
  .resume-export h3 {
    break-after: avoid !important;
  }
"""