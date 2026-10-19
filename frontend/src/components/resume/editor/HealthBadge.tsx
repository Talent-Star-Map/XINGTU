import { useEffect, useRef, useState } from 'react'
import { Activity, ChevronDown, AlertTriangle, CheckCircle2 } from 'lucide-react'
import type { HealthReport } from '../../../lib/resumeHealth'

const LEVEL_COLOR: Record<HealthReport['level'], string> = {
  excellent: '#10b981',
  good: 'var(--accent-blue, #3b82f6)',
  fair: '#f59e0b',
  poor: '#ef4444',
}

/** 编辑器工具栏上的健康度胶囊 + 展开明细
 *
 *  放在工具栏而不是预览面板，是因为右侧预览区已经被模板占满，
 *  再塞一块会挤压简历画布；工具栏空间刚好，点开才展开明细。
 */
export default function HealthBadge({ report }: { report: HealthReport }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const color = LEVEL_COLOR[report.level]

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(v => !v)}
        className="h-8 px-2 inline-flex items-center gap-1.5 rounded text-xs hover:bg-zinc-100"
        style={{ color }} title="简历健康度">
        <Activity className="h-3.5 w-3.5" />
        <span className="tabular-nums font-medium">{report.total}<span className="text-[10px] opacity-50">/100</span></span>
        <span className="opacity-70">{report.levelText}</span>
        <ChevronDown className="h-3 w-3 opacity-60" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-80 rounded-xl border shadow-xl z-50 overflow-hidden"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-outline-variant)' }}>
          <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--color-outline-variant)' }}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold" style={{ color: 'var(--color-on-surface)' }}>简历健康度</span>
              <span className="text-sm font-bold tabular-nums" style={{ color }}>{report.total} / 100</span>
            </div>
            <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-surface-container-high)' }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${report.total}%`, background: color }} />
            </div>
            <p className="mt-1.5 text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>
              {report.issues.length === 0 ? '各项都齐了，可以直接导出投递' : `还有 ${report.issues.length} 项可以改进`}
            </p>
          </div>

          <ul className="max-h-72 overflow-auto py-1">
            {report.items.map(item => {
              const ok = item.score >= item.max
              return (
                <li key={item.key} className="px-4 py-2 flex items-start gap-2">
                  {ok
                    ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: '#10b981' }} />
                    : <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: '#f59e0b' }} />}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-medium" style={{ color: 'var(--color-on-surface)' }}>{item.label}</span>
                      <span className="text-[10px] tabular-nums shrink-0" style={{ color: 'var(--color-on-surface-variant)' }}>
                        {item.score}/{item.max}
                      </span>
                    </div>
                    <p className="text-[10px] leading-relaxed mt-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>
                      {item.hint}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
