/**
 * SemanticSearchBox — 顶栏 ⌘K 唤起的岗位搜索框。
 * 通过岗位目录搜索选择目标，避免等待语义向量生成。
 */
import { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { kgApi } from './api'

interface Props {
  onPick: (jobId: number) => void
  label?: string
  enabled?: boolean
}

export default function SemanticSearchBox({ onPick, label = '语义搜索', enabled = true }: Props) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [results, setResults] = useState<any[]>([])
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const inpRef = useRef<HTMLInputElement>(null)

  // ⌘K / Ctrl+K 唤起
  useEffect(() => {
    if (!enabled) {
      setOpen(false)
      return
    }
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
      } else if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [enabled])

  useEffect(() => {
    if (open) setTimeout(() => inpRef.current?.focus(), 50)
  }, [open])

  // 防抖搜索
  useEffect(() => {
    let current = true
    setResults([])
    setError('')
    if (!q.trim() || !open || !enabled) { setBusy(false); return }
    setBusy(true)
    const t = setTimeout(async () => {
      setBusy(true)
      try {
        const r = await kgApi.catalogSearch(q.trim(), 8)
        if (current) setResults(r || [])
      } catch {
        if (current) setError('岗位暂时读取失败，请检查连接后重试。')
      } finally {
        if (current) setBusy(false)
      }
    }, 300)
    return () => { current = false; clearTimeout(t) }
  }, [q, open, enabled, revision])

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        disabled={!enabled}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm"
        style={{ background: 'var(--color-surface-container)', color: 'var(--color-on-surface)' }}
      >
        <Search className="w-4 h-4" />
        <span>{label}</span>
        <span className="text-xs px-1.5 py-0.5 rounded ml-2" style={{ background: 'var(--color-surface)' }}>⌘K</span>
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24" style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={() => setOpen(false)}>
      <div role="dialog" aria-modal="true" aria-label="选择岗位"
        className="w-[600px] max-w-[calc(100vw-2rem)] rounded-xl overflow-hidden shadow-2xl"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-outline)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-3 py-2 border-b" style={{ borderColor: 'var(--color-outline-variant)' }}>
          <Search className="w-4 h-4" />
          <input
            ref={inpRef}
            value={q}
            maxLength={200}
            aria-label="搜索岗位"
            onChange={(e) => setQ(e.target.value)}
            placeholder="输入岗位名称或技能，例如 Python、Java、后端"
            className="flex-1 bg-transparent outline-none text-sm"
          />
          {busy && <span className="text-xs">搜索中...</span>}
          <button onClick={() => setOpen(false)} aria-label="关闭岗位搜索"><X size={18} /></button>
        </div>
        <div className="max-h-[400px] overflow-auto">
          {error && <p role="alert" className="px-4 py-6 text-sm text-red-600">{error}<button onClick={() => setRevision(v => v + 1)} className="ml-2 underline">重试</button></p>}
          {!q.trim() && <p className="px-4 py-6 text-sm">输入岗位名称或技能关键词，例如 Python、Java、后端。</p>}
          {results.length === 0 && q.trim() && !busy && !error && (
            <div className="px-4 py-6 text-center text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>无结果</div>
          )}
          {results.map((r: any, i) => (
            <button
              key={`${r.id}-${i}`}
              onClick={() => { onPick(r.id); setOpen(false); setQ('') }}
              className="w-full text-left px-4 py-2 border-b hover:bg-black/5"
              style={{ borderColor: 'var(--color-outline-variant)' }}
            >
              <div className="font-medium text-sm">{r.title}</div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>
                {r.company || r.company_name || ''} {r.source ? `· ${r.source}` : ''}
                {typeof r.score === 'number'
                  ? r.retrieval_mode === 'semantic_exact'
                    ? ` · 余弦相似度 ${r.score.toFixed(3)}`
                    : ` · 关键词命中 ${(r.score * 100).toFixed(0)}%`
                  : ''}
                {r.captured_at ? ` · 快照 ${String(r.captured_at).slice(0, 10)}` : ''}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
