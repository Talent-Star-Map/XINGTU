import { memo } from 'react'
import type { CustomContent, CustomItem } from '../../../../types/resume'
import { ItemActions } from '../ItemActions'

const blank = (): CustomItem => ({
  id: String(Date.now()) + Math.random().toString(36).slice(2, 6),
  title: '', subtitle: '', date: '', description: '',
})

function CustomFormImpl({
  content, onChange,
}: { content: CustomContent; onChange: (c: CustomContent) => void }) {
  const items = content?.items || []
  const update = (idx: number, patch: Partial<CustomItem>) =>
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
              <label className="text-xs text-zinc-500">标题</label>
              <input value={it.title} onChange={(e) => update(idx, { title: e.target.value })}
                className="w-full h-9 px-3 rounded-lg border border-zinc-200 text-sm outline-none focus:border-blue-400 bg-white" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-zinc-500">副标题</label>
              <input value={it.subtitle || ''} onChange={(e) => update(idx, { subtitle: e.target.value })}
                className="w-full h-9 px-3 rounded-lg border border-zinc-200 text-sm outline-none focus:border-blue-400 bg-white" />
            </div>
            <div className="space-y-1 col-span-2">
              <label className="text-xs text-zinc-500">日期</label>
              <input value={it.date || ''} onChange={(e) => update(idx, { date: e.target.value })}
                placeholder="2024年 或 2024-01" className="w-full h-9 px-3 rounded-lg border border-zinc-200 text-sm outline-none focus:border-blue-400 bg-white" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-zinc-500">描述</label>
            <textarea value={it.description} onChange={(e) => update(idx, { description: e.target.value })}
              rows={2} className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm outline-none focus:border-blue-400 bg-white resize-y" />
          </div>
        </div>
      ))}

      {items.length === 0 && (
        <button type="button" onClick={add}
          className="w-full h-10 rounded-lg border border-zinc-200 border-dashed text-sm text-zinc-500 hover:bg-zinc-50">
          + 添加自定义条目
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

export const CustomForm = memo(CustomFormImpl)