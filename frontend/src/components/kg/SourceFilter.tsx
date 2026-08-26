/**
 * SourceFilter — 顶栏来源多选筛选
 * 显示来源徽章,点击切换激活状态,影响主图节点。
 */
import { useState } from 'react'
import { Filter } from 'lucide-react'

interface Props {
  sources: { source: string; cnt: number }[]
  active: Set<string>
  onChange: (active: Set<string>) => void
}

export default function SourceFilter({ sources, active, onChange }: Props) {
  const [open, setOpen] = useState(false)

  const toggle = (s: string) => {
    const next = new Set(active)
    if (next.has(s)) next.delete(s)
    else next.add(s)
    onChange(next)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm"
        style={{ background: 'var(--color-surface-container)' }}
      >
        <Filter className="w-3.5 h-3.5" />
        来源 ({active.size || 'all'})
      </button>
      {open && (
        <div
          className="absolute top-full mt-1 right-0 z-40 w-64 rounded-lg shadow-lg overflow-hidden"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-outline)' }}
        >
          <div className="flex items-center justify-between px-3 py-2 border-b"
               style={{ borderColor: 'var(--color-outline-variant)' }}>
            <span className="text-xs font-semibold">数据来源</span>
            <button
              onClick={() => onChange(new Set())}
              className="text-xs underline"
              style={{ color: 'var(--color-primary)' }}
            >
              全选
            </button>
          </div>
          <div className="max-h-72 overflow-auto">
            {sources.map((s) => {
              const on = active.size === 0 || active.has(s.source)
              return (
                <label
                  key={s.source}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer hover:bg-black/5"
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggle(s.source)}
                  />
                  <span className="flex-1">{s.source || '(未知)'}</span>
                  <span style={{ color: 'var(--color-on-surface-variant)' }}>{s.cnt}</span>
                </label>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}