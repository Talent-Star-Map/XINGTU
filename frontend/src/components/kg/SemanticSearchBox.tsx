/**
 * SemanticSearchBox — 顶栏 ⌘K 唤起的语义搜索框
 * 输入 → 调 /api/kg/semantic-search → 下拉结果 → 点击选中并跳到节点。
 */
import { useEffect, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { kgApi } from './api'

interface Props {
  onPick: (jobId: number) => void
}

export default function SemanticSearchBox({ onPick }: Props) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [results, setResults] = useState<any[]>([])
  const inpRef = useRef<HTMLInputElement>(null)

  // ⌘K / Ctrl+K 唤起
  useEffect(() => {
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
  }, [])

  useEffect(() => {
    if (open) setTimeout(() => inpRef.current?.focus(), 50)
  }, [open])

  // 防抖搜索
  useEffect(() => {
    if (!q.trim()) { setResults([]); return }
    const t = setTimeout(async () => {
      setBusy(true)
      try {
        const r = await kgApi.semanticSearch(q, 8)
        setResults(r || [])
      } catch (e) {
        setResults([])
      } finally {
        setBusy(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [q])

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm"
        style={{ background: 'var(--color-surface-container)', color: 'var(--color-on-surface)' }}
      >
        <Search className="w-4 h-4" />
        <span>语义搜索</span>
        <span className="text-xs px-1.5 py-0.5 rounded ml-2" style={{ background: 'var(--color-surface)' }}>⌘K</span>
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24" style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={() => setOpen(false)}>
      <div
        className="w-[600px] rounded-xl overflow-hidden shadow-2xl"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-outline)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-3 py-2 border-b" style={{ borderColor: 'var(--color-outline-variant)' }}>
          <Search className="w-4 h-4" />
          <input
            ref={inpRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="输入自然语言,例如:AI 方向、Java 后端、应届生可投..."
            className="flex-1 bg-transparent outline-none text-sm"
          />
          {busy && <span className="text-xs">搜索中...</span>}
        </div>
        <div className="max-h-[400px] overflow-auto">
          {results.length === 0 && q && !busy && (
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
                {typeof r.score === 'number' ? ` · 相似度 ${(r.score * 100).toFixed(1)}%` : ''}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}