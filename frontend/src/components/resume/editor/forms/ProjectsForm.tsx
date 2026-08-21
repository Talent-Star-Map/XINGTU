import { memo } from 'react'
import type { ProjectsContent, ProjectItem } from '../../../../types/resume'
import { ItemActions } from '../ItemActions'

const blankItem = (): ProjectItem => ({
  id: String(Date.now()) + Math.random().toString(36).slice(2, 6),
  name: '', url: '', startDate: '', endDate: '',
  description: '', technologies: [], highlights: [],
})

function ProjectsFormImpl({
  content, onChange,
}: { content: ProjectsContent; onChange: (c: ProjectsContent) => void }) {
  const items = content?.items || []
  const updateItem = (idx: number, patch: Partial<ProjectItem>) => {
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
  const updateArr = (idx: number, field: 'technologies' | 'highlights', sidx: number, value: string) => {
    const arr = [...(items[idx][field] || [])]; arr[sidx] = value
    updateItem(idx, { [field]: arr } as any)
  }
  const addArr = (idx: number, field: 'technologies' | 'highlights') =>
    updateItem(idx, { [field]: [...(items[idx][field] || []), ''] } as any)
  const removeArr = (idx: number, field: 'technologies' | 'highlights', sidx: number) =>
    updateItem(idx, { [field]: (items[idx][field] || []).filter((_, i) => i !== sidx) } as any)

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
              <label className="text-xs text-zinc-500">项目名称</label>
              <input value={it.name} onChange={(e) => updateItem(idx, { name: e.target.value })}
                className="w-full h-9 px-3 rounded-lg border border-zinc-200 text-sm outline-none focus:border-blue-400 bg-white" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-zinc-500">个人网站</label>
              <input value={it.url || ''} onChange={(e) => updateItem(idx, { url: e.target.value })}
                placeholder="https://..." className="w-full h-9 px-3 rounded-lg border border-zinc-200 text-sm outline-none focus:border-blue-400 bg-white" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-zinc-500">开始时间</label>
              <input type="month" value={it.startDate || ''} onChange={(e) => updateItem(idx, { startDate: e.target.value })}
                className="w-full h-9 px-3 rounded-lg border border-zinc-200 text-sm outline-none focus:border-blue-400 bg-white" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-zinc-500">结束时间</label>
              <input type="month" value={it.endDate || ''} onChange={(e) => updateItem(idx, { endDate: e.target.value })}
                className="w-full h-9 px-3 rounded-lg border border-zinc-200 text-sm outline-none focus:border-blue-400 bg-white" />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-zinc-500">描述</label>
            <textarea value={it.description} onChange={(e) => updateItem(idx, { description: e.target.value })}
              rows={2} className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm outline-none focus:border-blue-400 bg-white resize-y" />
          </div>

          <div className="space-y-2">
            <label className="text-xs text-zinc-500">技术栈</label>
            {(it.technologies || []).map((t, sidx) => (
              <div key={sidx} className="flex items-center gap-2">
                <input value={t} onChange={(e) => updateArr(idx, 'technologies', sidx, e.target.value)}
                  className="flex-1 h-9 px-3 pr-9 rounded-lg border border-zinc-200 text-sm outline-none focus:border-blue-400 bg-white" />
                <button type="button" onClick={() => removeArr(idx, 'technologies', sidx)} className="text-zinc-400 hover:text-zinc-700">×</button>
              </div>
            ))}
            <button type="button" onClick={() => addArr(idx, 'technologies')}
              className="h-9 px-3 rounded-lg border border-zinc-200 border-dashed text-sm text-zinc-500 hover:bg-white">+ Add</button>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-zinc-500">亮点</label>
            {(it.highlights || []).map((h, sidx) => (
              <div key={sidx} className="flex items-center gap-2">
                <input value={h} onChange={(e) => updateArr(idx, 'highlights', sidx, e.target.value)}
                  className="flex-1 h-9 px-3 pr-9 rounded-lg border border-zinc-200 text-sm outline-none focus:border-blue-400 bg-white" />
                <button type="button" onClick={() => removeArr(idx, 'highlights', sidx)} className="text-zinc-400 hover:text-zinc-700">×</button>
              </div>
            ))}
            <button type="button" onClick={() => addArr(idx, 'highlights')}
              className="h-9 px-3 rounded-lg border border-zinc-200 border-dashed text-sm text-zinc-500 hover:bg-white">+ Add</button>
          </div>
        </div>
      ))}

      {items.length === 0 && (
        <button type="button" onClick={addItem}
          className="w-full h-10 rounded-lg border border-zinc-200 border-dashed text-sm text-zinc-500 hover:bg-zinc-50">
          + 添加项目经历
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

export const ProjectsForm = memo(ProjectsFormImpl)