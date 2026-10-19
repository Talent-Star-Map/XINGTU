import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Building2, Loader2, MapPin, X } from 'lucide-react'

export interface DrawerQuery {
  city?: string
  field?: string
  experience?: string
  education?: string
  salary?: string
  skill?: string
  cluster_id?: number
}

interface JobItem {
  id: number
  title: string
  company: string
  city: string
  field: string
  salary_min: number | null
  salary_max: number | null
  salary_mid_k: number | null
  education: string
  experience: string
  skills: string[]
  source: string
}

export default function JobDrawer({
  open, onClose, title, subtitle, query, token,
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  query: DrawerQuery
  token: string
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [items, setItems] = useState<JobItem[]>([])
  const [total, setTotal] = useState(0)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    const params = new URLSearchParams({ token, limit: '30' })
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') params.set(k, String(v))
    })
    let cancelled = false
    setLoading(true)
    setError('')
    fetch(`/api/enterprise/data-board/jobs?${params.toString()}`)
      .then(r => r.json())
      .then(json => {
        if (cancelled) return
        if (!json.success) throw new Error(json.error?.message || json.message || '加载失败')
        setItems(json.data.items || [])
        setTotal(json.data.total || 0)
      })
      .catch(e => { if (!cancelled) setError(String(e?.message || e)) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [open, token, JSON.stringify(query)])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[120] flex justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-xl flex-col border-l shadow-2xl"
        style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface)' }}>
        <header className="flex items-start justify-between gap-4 border-b px-5 py-4"
          style={{ borderColor: 'var(--color-outline-variant)' }}>
          <div className="min-w-0">
            <h2 className="text-base font-bold" style={{ color: 'var(--color-on-surface)' }}>{title}</h2>
            <p className="mt-1 text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>
              {subtitle || `共 ${total} 个匹配岗位`}
            </p>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 transition-colors hover:bg-[var(--color-surface-container-high)]"
            style={{ color: 'var(--color-on-surface-variant)' }} aria-label="关闭">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {loading && (
            <div className="flex h-40 items-center justify-center gap-2 text-xs"
              style={{ color: 'var(--color-on-surface-variant)' }}>
              <Loader2 className="h-4 w-4 animate-spin" /> 加载岗位…
            </div>
          )}
          {!loading && error && (
            <div className="rounded-lg border px-3 py-2 text-xs"
              style={{ borderColor: 'var(--accent-red)', background: 'var(--accent-red-dim)', color: 'var(--accent-red-strong)' }}>
              {error}
            </div>
          )}
          {!loading && !error && items.length === 0 && (
            <div className="flex h-40 items-center justify-center text-xs"
              style={{ color: 'var(--color-on-surface-variant)' }}>
              当前筛选下没有可展示的岗位
            </div>
          )}
          {!loading && !error && items.map(item => (
            <article key={item.id} className="mb-2 rounded-xl border px-3.5 py-3 transition-colors hover:bg-[var(--color-surface-container-low)]"
              style={{ borderColor: 'var(--color-outline-variant)' }}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-[13px] font-semibold" style={{ color: 'var(--color-on-surface)' }}>{item.title}</h3>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px]"
                    style={{ color: 'var(--color-on-surface-variant)' }}>
                    <span className="inline-flex items-center gap-1"><Building2 className="h-3 w-3" />{item.company}</span>
                    <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{item.city}</span>
                    <span>{item.experience}</span>
                    <span>{item.education}</span>
                  </div>
                </div>
                <span className="shrink-0 text-sm font-bold tabular-nums" style={{ color: 'var(--color-primary)' }}>
                  {item.salary_min != null && item.salary_max != null
                    ? `${Math.round(item.salary_min / 1000)}-${Math.round(item.salary_max / 1000)}K`
                    : '面议'}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {item.skills.slice(0, 7).map(skill => (
                  <span key={skill} className="rounded px-1.5 py-0.5 text-[9px]"
                    style={{ background: 'var(--color-surface-container)', color: 'var(--color-on-surface-variant)' }}>
                    {skill}
                  </span>
                ))}
                <span className="ml-auto text-[9px]" style={{ color: 'var(--color-on-surface-variant)' }}>
                  {item.source} · {item.field}
                </span>
              </div>
            </article>
          ))}
        </div>
      </aside>
    </div>,
    document.body,
  )
}
