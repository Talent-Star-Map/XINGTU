import { memo } from 'react'
import type { QrCodesContent, QrCodeItem } from '../../../../types/resume'
import { ItemActions } from '../ItemActions'

const blank = (): QrCodeItem => ({
  id: String(Date.now()) + Math.random().toString(36).slice(2, 6),
  label: '', url: '',
})

function QrCodesFormImpl({
  content, onChange,
}: { content: QrCodesContent; onChange: (c: QrCodesContent) => void }) {
  const items = content?.items || []
  const update = (idx: number, patch: Partial<QrCodeItem>) =>
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
      <p className="text-xs text-zinc-500">添加二维码用于简历分享(如作品集、GitHub、LinkedIn 等)</p>
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
              <label className="text-xs text-zinc-500">标签</label>
              <input value={it.label} onChange={(e) => update(idx, { label: e.target.value })}
                placeholder="如 GitHub" className="w-full h-9 px-3 rounded-lg border border-zinc-200 text-sm outline-none focus:border-blue-400 bg-white" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-zinc-500">URL</label>
              <input value={it.url} onChange={(e) => update(idx, { url: e.target.value })}
                placeholder="https://..." className="w-full h-9 px-3 rounded-lg border border-zinc-200 text-sm outline-none focus:border-blue-400 bg-white" />
            </div>
          </div>
        </div>
      ))}

      {items.length === 0 && (
        <button type="button" onClick={add}
          className="w-full h-10 rounded-lg border border-zinc-200 border-dashed text-sm text-zinc-500 hover:bg-zinc-50">
          + 添加二维码
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

export const QrCodesForm = memo(QrCodesFormImpl)