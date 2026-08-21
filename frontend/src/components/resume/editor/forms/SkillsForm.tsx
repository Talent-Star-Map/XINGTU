import { memo } from 'react'
import type { SkillsContent } from '../../../../types/resume'
import { ItemActions } from '../ItemActions'

/** 技能分类:每个分类有 name + skills[],支持拖拽排序、新增、删除 */
function SkillsFormImpl({
  content, onChange,
}: { content: SkillsContent; onChange: (c: SkillsContent) => void }) {
  const categories = content?.categories || []

  const updateCategory = (idx: number, patch: any) => {
    onChange({ categories: categories.map((c, i) => i === idx ? { ...c, ...patch } : c) })
  }

  const addCategory = () => {
    onChange({
      categories: [...categories, { id: String(Date.now()), name: '新分类', skills: [] }],
    })
  }

  const removeCategory = (idx: number) => {
    onChange({ categories: categories.filter((_, i) => i !== idx) })
  }

  const moveCategory = (idx: number, dir: -1 | 1) => {
    const next = [...categories]
    const j = idx + dir
    if (j < 0 || j >= next.length) return
    [next[idx], next[j]] = [next[j], next[idx]]
    onChange({ categories: next })
  }

  return (
    <div className="space-y-4">
      {categories.map((cat, idx) => (
        <div key={cat.id || idx} className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-3 space-y-3">
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <label className="text-xs text-zinc-500">技能分类</label>
              <input
                value={cat.name}
                onChange={(e) => updateCategory(idx, { name: e.target.value })}
                placeholder="如 前端框架"
                className="w-full h-9 px-3 rounded-lg border border-zinc-200 text-sm outline-none focus:border-blue-400 bg-white"
              />
            </div>
            <ItemActions
              onAdd={addCategory}
              onUp={() => moveCategory(idx, -1)}
              onDown={() => moveCategory(idx, 1)}
              onDelete={() => removeCategory(idx)}
              isFirst={idx === 0}
              isLast={idx === categories.length - 1}
              showAdd={idx === categories.length - 1}
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs text-zinc-500">技术栈</label>
            {(cat.skills || []).map((skill, sidx) => (
              <div key={sidx} className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <input
                    value={skill}
                    onChange={(e) => {
                      const newSkills = [...(cat.skills || [])]
                      newSkills[sidx] = e.target.value
                      updateCategory(idx, { skills: newSkills })
                    }}
                    className="w-full h-9 px-3 pr-9 rounded-lg border border-zinc-200 text-sm outline-none focus:border-blue-400 bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const newSkills = (cat.skills || []).filter((_, i) => i !== sidx)
                      updateCategory(idx, { skills: newSkills })
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() => updateCategory(idx, { skills: [...(cat.skills || []), ''] })}
              className="h-9 px-3 rounded-lg border border-zinc-200 border-dashed text-sm text-zinc-500 hover:bg-white"
            >
              + Add
            </button>
          </div>
        </div>
      ))}
      {categories.length === 0 && (
        <button
          type="button"
          onClick={addCategory}
          className="w-full h-10 rounded-lg border border-zinc-200 border-dashed text-sm text-zinc-500 hover:bg-zinc-50"
        >
          + 添加技能分类
        </button>
      )}
      {categories.length > 0 && (
        <button
          type="button"
          onClick={addCategory}
          className="w-full h-10 rounded-lg border border-zinc-200 border-dashed text-sm text-zinc-500 hover:bg-zinc-50"
        >
          + 添加条目
        </button>
      )}
    </div>
  )
}

export const SkillsForm = memo(SkillsFormImpl)