import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ChevronLeft, ChevronRight, Download, FileText, Loader2, Maximize2, Minus, Plus, RefreshCw } from 'lucide-react'
import { attachmentHeaders, attachmentSize, downloadAttachment, useAttachmentPage, type AttachmentInfo } from '../../lib/resumeAttachments'

const toolButton = 'inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm hover:bg-slate-100 disabled:opacity-35 disabled:cursor-not-allowed transition-colors'

export default function ResumeAttachmentReader() {
  const [params, setParams] = useSearchParams()
  const filename = params.get('filename') || ''
  const requested = Number(params.get('page') || 1)
  const page = Number.isInteger(requested) && requested > 0 && requested <= 10000 ? requested : 1
  const [item, setItem] = useState<AttachmentInfo | null>(null)
  const [metadataLoading, setMetadataLoading] = useState(true)
  const [metadataError, setMetadataError] = useState('')
  const [metadataAttempt, setMetadataAttempt] = useState(0)
  const [downloading, setDownloading] = useState(false)
  const [notice, setNotice] = useState('')
  const [zoom, setZoom] = useState('fit')
  const [availableWidth, setAvailableWidth] = useState(900)
  const viewport = useRef<HTMLDivElement>(null)
  const { loading, error, preview, pageCount, retry } = useAttachmentPage(item?.path === filename ? item : null, page)
  const paperWidth = zoom === 'fit' ? Math.min(1100, availableWidth) : 794 * Number(zoom) / 100
  const effectiveZoom = zoom === 'fit' ? Math.round(paperWidth / 794 * 100) : Number(zoom)

  useEffect(() => {
    setItem(null); setMetadataError(''); setMetadataLoading(true)
    if (!filename) { setMetadataError('请选择需要查看的简历附件'); setMetadataLoading(false); return }
    let disposed = false
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 15000)
    void (async () => {
      try {
        const response = await fetch(`/api/auth/resume-detail?filename=${encodeURIComponent(filename)}`, { headers: attachmentHeaders(), signal: controller.signal })
        const result = await response.json()
        if (!response.ok || !result.success || !result.data?.attachment) {
          throw new Error(typeof result.detail === 'string' ? result.detail : '简历附件读取失败')
        }
        if (!disposed) setItem(result.data.attachment)
      } catch (e) {
        if (!disposed) setMetadataError(e instanceof Error && e.name !== 'AbortError' ? e.message : '简历附件读取超时，请重试')
      } finally { window.clearTimeout(timeout); if (!disposed) setMetadataLoading(false) }
    })()
    return () => { disposed = true; controller.abort(); window.clearTimeout(timeout) }
  }, [filename, metadataAttempt])

  useEffect(() => {
    const element = viewport.current
    if (!element) return
    const measure = () => setAvailableWidth(Math.max(240, element.clientWidth - 64))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => { viewport.current?.scrollTo({ top: 0, left: 0 }) }, [page])

  const goToPage = (next: number) => {
    if (loading || !Number.isInteger(next) || next < 1 || next > pageCount) return
    const search = new URLSearchParams(params)
    search.set('page', String(next))
    setParams(search, { replace: true })
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement)?.closest('input,textarea,select,button,a,[contenteditable]')) return
      if (event.key === 'ArrowLeft') { event.preventDefault(); goToPage(page - 1) }
      if (event.key === 'ArrowRight') { event.preventDefault(); goToPage(page + 1) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [page, pageCount, loading, params])

  const download = async () => {
    if (!item) return
    setDownloading(true); setNotice('')
    try { await downloadAttachment(item) }
    catch (e) { setNotice(e instanceof Error ? e.message : '下载失败，请重试') }
    finally { setDownloading(false) }
  }
  const fullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await document.documentElement.requestFullscreen()
    } catch { setNotice('当前浏览器不支持全屏，可继续在此页面阅读') }
  }
  const busy = metadataLoading || loading
  const failure = metadataError || error

  return <div className="fixed inset-0 z-[110] flex flex-col bg-slate-100 text-slate-800" aria-label="简历阅读器">
    <header className="h-16 shrink-0 flex items-center gap-4 px-4 sm:px-6 bg-white border-b border-slate-200">
      <Link to="/#/resume" aria-label="返回简历管理" className={`${toolButton} shrink-0`}><ArrowLeft className="h-4 w-4" /><span className="hidden sm:inline">返回简历管理</span></Link>
      <span className="h-6 border-l border-slate-200" />
      <FileText className="h-5 w-5 text-blue-600 shrink-0" />
      <div className="flex-1 min-w-0">
        <h1 className="text-sm font-semibold truncate" title={item?.filename}>{item?.filename || '简历附件'}</h1>
        <p className="text-[11px] text-slate-400 mt-0.5">{item ? [item.extension?.toUpperCase(), attachmentSize(item.size)].filter(Boolean).join(' · ') : '在线阅读'}</p>
      </div>
      <button onClick={download} disabled={!item || downloading} aria-label="下载原文件" className={`${toolButton} !bg-blue-600 !text-white hover:!bg-blue-700`}>
        {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}<span className="hidden sm:inline">下载原文件</span>
      </button>
    </header>

    <div className="shrink-0 min-h-14 flex flex-wrap items-center justify-center gap-2 px-3 py-2 bg-white border-b border-slate-200" role="toolbar" aria-label="阅读工具">
      <button onClick={() => goToPage(page - 1)} disabled={busy || page <= 1} className={toolButton} aria-label="上一页"><ChevronLeft className="h-4 w-4" /></button>
      <form className="flex items-center gap-2 text-sm" onSubmit={event => {
        event.preventDefault()
        const input = event.currentTarget.elements.namedItem('page') as HTMLInputElement
        goToPage(Number(input.value))
      }}>
        <input key={page} aria-label="页码" name="page" type="number" min={1} max={pageCount} defaultValue={page} disabled={busy} className="w-14 rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-center" />
        <span className="text-slate-500">/ {busy && !preview ? '…' : pageCount} 页</span>
      </form>
      <button onClick={() => goToPage(page + 1)} disabled={busy || page >= pageCount} className={toolButton} aria-label="下一页"><ChevronRight className="h-4 w-4" /></button>
      <span className="h-5 border-l border-slate-200 mx-2" />
      <button onClick={() => setZoom(String(Math.max(25, effectiveZoom - 25)))} disabled={effectiveZoom <= 25} className={toolButton} aria-label="缩小"><Minus className="h-4 w-4" /></button>
      <select aria-label="缩放比例" value={zoom} onChange={event => setZoom(event.target.value)} className="text-sm bg-slate-50 border border-slate-200 rounded px-2 py-1.5">
        <option value="fit">适合宽度</option>
        {Array.from(new Set([25, 50, 75, 100, 125, 150, 175, 200, 225, 250, ...(zoom === 'fit' ? [] : [Number(zoom)])])).sort((a, b) => a - b).map(value => <option key={value} value={value}>{value}%</option>)}
      </select>
      <button onClick={() => setZoom(String(Math.min(250, effectiveZoom + 25)))} disabled={effectiveZoom >= 250} className={toolButton} aria-label="放大"><Plus className="h-4 w-4" /></button>
      <span className="h-5 border-l border-slate-200 mx-2" />
      <button onClick={fullscreen} className={toolButton} aria-label="切换全屏"><Maximize2 className="h-4 w-4" /><span className="hidden sm:inline">全屏</span></button>
    </div>

    {notice && <p role="alert" className="shrink-0 px-6 py-2 bg-amber-50 text-amber-800 text-sm">{notice}</p>}
    <div className="flex flex-1 min-h-0">
      <aside className="hidden md:flex w-48 shrink-0 flex-col border-r border-slate-200 bg-slate-50" aria-label="页码导航">
        <div className="px-5 py-5 border-b border-slate-200">
          <h2 className="text-sm font-semibold">页码导航</h2>
          <p className="text-xs text-slate-400 mt-1">{item?.extension?.toUpperCase() || '附件'} · {preview ? `共 ${pageCount} 页` : '正在读取'}</p>
        </div>
        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-3 content-start gap-2">
          {Array.from({ length: pageCount }, (_, index) => index + 1).map(number => <button key={number} onClick={() => goToPage(number)} disabled={busy} aria-label={`跳转第${number}页`} aria-current={number === page ? 'page' : undefined}
            className={`h-14 rounded-md border text-sm transition-colors ${number === page ? 'border-blue-500 bg-blue-50 text-blue-700 font-semibold shadow-sm' : 'border-slate-200 bg-white hover:border-blue-300 text-slate-500'}`}>{number}</button>)}
        </div>
        <p className="text-[11px] text-slate-400 px-5 py-4 border-t border-slate-200">支持键盘 ← → 翻页</p>
      </aside>
      <main ref={viewport} className="flex-1 min-w-0 overflow-auto bg-[#e7e9ee]" aria-label="简历正文">
        {busy ? <div role="status" className="h-full min-h-64 flex flex-col items-center justify-center gap-3 text-slate-500 text-sm"><Loader2 className="h-6 w-6 animate-spin text-blue-600" />正在加载简历页面…</div>
          : failure ? <div role="alert" className="m-8 p-8 rounded-lg bg-white border border-slate-200 text-center text-sm">
            <p>{failure}</p><button onClick={() => metadataError ? setMetadataAttempt(v => v + 1) : retry()} className={`${toolButton} mt-4 text-blue-600`}><RefreshCw className="h-4 w-4" />重试</button>
          </div>
          : preview && <div className="min-w-full w-max px-8 py-8">
            <div data-testid="resume-paper" className="mx-auto bg-white shadow-[0_3px_18px_rgba(15,23,42,0.12)]" style={{ width: paperWidth }}>
              {preview.type.startsWith('image/') ? <img src={preview.url} alt={`${item?.filename} 第${page}页`} className="block w-full h-auto" />
                : <pre className="p-12 whitespace-pre-wrap break-words leading-relaxed" style={{ fontSize: 16 * paperWidth / 794 }}>{preview.text || '附件中没有可预览的文字'}</pre>}
            </div>
            <p className="text-center text-xs text-slate-400 mt-5">第 {page} 页 / 共 {pageCount} 页</p>
          </div>}
      </main>
    </div>
  </div>
}
