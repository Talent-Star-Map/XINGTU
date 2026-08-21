import { memo } from 'react'
import type { EducationContent, EducationItem } from '../../../../types/resume'
import { ItemActions } from '../ItemActions'

const blankItem = (): EducationItem => ({
  id: String(Date.now()) + Math.random().toString(36).slice(2, 6),
  institution: '', degree: '', field: '', location: '',
  startDate: '', endDate: '', gpa: '', highlights: [],
})

const DEGREES = ['', '高中', '大专', '本科', '硕士', '博士', '其他']

function EducationFormImpl({
  content, onChange,
}: { content: EducationContent; onChange: (c: EducationContent) => void }) {
  const items = content?.items || []

  const updateItem = (idx: number, patch: Partial<EducationItem>) => {
    onChange({ items: items.map((it, i) => i === idx ? { ...it, ...patch } : it) })
  }
  const addItem = () => onChange({ items: [...items, blankItem()] })
  const removeItem = (idx: number) => onChange({ items: items.filter((_, i) => i !== idx) })
  const moveItem = (idx: number, dir: -1 | 1) => {
    const next = [...items]; const j = idx + dir
    if (j < 0 || j >= next.length) return
    ;[next[idx], next[j]] = [next[j], next[idx]]
    onChange({ items: next })
  }
  const updateHighlight = (idx: number, sidx: number, value: string) => {
    const arr = [...(items[idx].highlights || [])]; arr[sidx] = value
    updateItem(idx, { highlights: arr })
  }
  const addHighlight = (idx: number) =>
    updateItem(idx, { highlights: [...(items[idx].highlights || []), ''] })
  const removeHighlight = (idx: number, sidx: number) =>
    updateItem(idx, { highlights: (items[idx].highlights || []).filter((_, i) => i !== sidx) })

  return (
    <div className="space-y-4">
      {items.map((it, idx) => (
        <div key={it.id || idx} className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400 font-medium">#{idx + 1}</span>
            <ItemActions
              onAdd={addItem}
              onUp={() => moveItem(idx, -1)}
              onDown={() => moveItem(idx, 1)}
              onDelete={() => removeItem(idx)}
              isFirst={idx === 0}
              isLast={idx === items.length - 1}
              showAdd={idx === items.length - 1}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs text-zinc-500">学校</label>
              <input value={it.institution} onChange={(e) => updateItem(idx, { institution: e.target.value })}
                className="w-full h-9 px-3 rounded-lg border border-zinc-200 text-sm outline-none focus:border-blue-400 bg-white" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-zinc-500">学位</label>
              <select value={it.degree} onChange={(e) => updateItem(idx, { degree: e.target.value })}
                className="w-full h-9 px-3 rounded-lg border border-zinc-200 text-sm outline-none focus:border-blue-400 bg-white">
                {DEGREES.map(d => <option key={d} value={d}>{d || '请选择'}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-zinc-500">专业</label>
              <input value={it.field} onChange={(e) => updateItem(idx, { field: e.target.value })}
                className="w-full h-9 px-3 rounded-lg border border-zinc-200 text-sm outline-none focus:border-blue-400 bg-white" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-zinc-500">GPA</label>
              <input value={it.gpa || ''} onChange={(e) => updateItem(idx, { gpa: e.target.value })}
                placeholder="如 3.8/4.0" className="w-full h-9 px-3 rounded-lg border border-zinc-200 text-sm outline-none focus:border-blue-400 bg-white" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-zinc-500">开始时间</label>
              <input type="month" value={it.startDate} onChange={(e) => updateItem(idx, { startDate: e.target.value })}
                className="w-full h-9 px-3 rounded-lg border border-zinc-200 text-sm outline-none focus:border-blue-400 bg-white" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-zinc-500">结束时间</label>
              <input type="month" value={it.endDate} onChange={(e) => updateItem(idx, { endDate: e.target.value })}
                className="w-full h-9 px-3 rounded-lg border border-zinc-200 text-sm outline-none focus:border-blue-400 bg-white" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-zinc-500">亮点</label>
            {(it.highlights || []).map((h, sidx) => (
              <div key={sidx} className="flex items-center gap-2">
                <input value={h} onChange={(e) => updateHighlight(idx, sidx, e.target.value)}
                  className="flex-1 h-9 px-3 pr-9 rounded-lg border border-zinc-200 text-sm outline-none focus:border-blue-400 bg-white" />
                <button type="button" onClick={() => removeHighlight(idx, sidx)} className="text-zinc-400 hover:text-zinc-700">×</button>
              </div>
            ))}
            <button type="button" onClick={() => addHighlight(idx)}
              className="h-9 px-3 rounded-lg border border-zinc-200 border-dashed text-sm text-zinc-500 hover:bg-white">
              + Add
            </button>
          </div>
        </div>
      ))}

      {items.length === 0 && (
        <button type="button" onClick={addItem}
          className="w-full h-10 rounded-lg border border-zinc-200 border-dashed text-sm text-zinc-500 hover:bg-zinc-50">
          + 添加教育背景
        </button>
      )}
      {items.length > 0 && (
        <button type="button" onClick={addItem}
          className="w-full h-10 rounded-lg border border-zinc-200 border-dashed text-sm text-zinc-500 hover:bg-zinc-50">
          + 添加条目
        </button>
      )}
    </div>
  )
}

export const EducationForm = memo(EducationFormImpl)