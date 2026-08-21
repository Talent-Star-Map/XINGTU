import { memo } from 'react'
import type { CertificationsContent, CertificationItem } from '../../../../types/resume'
import { ItemActions } from '../ItemActions'

const blank = (): CertificationItem => ({
  id: String(Date.now()) + Math.random().toString(36).slice(2, 6),
  name: '', issuer: '', date: '', url: '',
})

function CertificationsFormImpl({
  content, onChange,
}: { content: CertificationsContent; onChange: (c: CertificationsContent) => void }) {
  const items = content?.items || []
  const update = (idx: number, patch: Partial<CertificationItem>) =>
    onChange({ items: items.map((it, i) => i === idx ? { ...it, ...patch } : it) })
  const add = () => onChange({ items: [...items, blank()] })
  const remove = (idx: number) => onChange({ items: items.filter((_, i) => i !== idx) })
  const move = (idx: number, dir: -1 | 1) => {
    const next = [...items]; const j = idx + dir
    if (j < 0 || j >= next.length) return
    ;[next[idx], next[j]] = [next[j], next[idx]]
    onChange({ items: next })
  }

  return (
    <div className="space-y-3">
      {items.map((it, idx) => (
        <div key={it.id || idx} className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400 font-medium">#{idx + 1}</span>
            <ItemActions
              onAdd={add}
              onUp={() => move(idx, -1)}
              onDown={() => move(idx, 1)}
              onDelete={() => remove(idx)}
              isFirst={idx === 0}
              isLast={idx === items.length - 1}
              showAdd={idx === items.length - 1}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs text-zinc-500">证书名</label>
              <input value={it.name} onChange={(e) => update(idx, { name: e.target.value })}
                className="w-full h-9 px-3 rounded-lg border border-zinc-200 text-sm outline-none focus:border-blue-400 bg-white" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-zinc-500">颁发机构</label>
              <input value={it.issuer} onChange={(e) => update(idx, { issuer: e.target.value })}
                className="w-full h-9 px-3 rounded-lg border border-zinc-200 text-sm outline-none focus:border-blue-400 bg-white" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-zinc-500">获得日期</label>
              <input type="month" value={it.date} onChange={(e) => update(idx, { date: e.target.value })}
                className="w-full h-9 px-3 rounded-lg border border-zinc-200 text-sm outline-none focus:border-blue-400 bg-white" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-zinc-500">证书链接(选填)</label>
              <input value={it.url || ''} onChange={(e) => update(idx, { url: e.target.value })}
                placeholder="https://..." className="w-full h-9 px-3 rounded-lg border border-zinc-200 text-sm outline-none focus:border-blue-400 bg-white" />
            </div>
          </div>
        </div>
      ))}

      {items.length === 0 && (
        <button type="button" onClick={add}
          className="w-full h-10 rounded-lg border border-zinc-200 border-dashed text-sm text-zinc-500 hover:bg-zinc-50">
          + 添加资格证书
        </button>
      )}
      {items.length > 0 && (
        <button type="button" onClick={add}
          className="w-full h-10 rounded-lg border border-zinc-200 border-dashed text-sm text-zinc-500 hover:bg-zinc-50">
          + 添加条目
        </button>
      )}
    </div>
  )
}

export const CertificationsForm = memo(CertificationsFormImpl)