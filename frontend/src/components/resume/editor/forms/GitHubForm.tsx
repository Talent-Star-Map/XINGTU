import { memo } from 'react'
import type { GitHubContent, GitHubRepoItem } from '../../../../types/resume'
import { ItemActions } from '../ItemActions'

const blank = (): GitHubRepoItem => ({
  id: String(Date.now()) + Math.random().toString(36).slice(2, 6),
  repoUrl: '', name: '', stars: 0, language: '', description: '',
})

function GitHubFormImpl({
  content, onChange,
}: { content: GitHubContent; onChange: (c: GitHubContent) => void }) {
  const items = content?.items || []
  const update = (idx: number, patch: Partial<GitHubRepoItem>) =>
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
              <label className="text-xs text-zinc-500">仓库 URL</label>
              <input value={it.repoUrl} onChange={(e) => update(idx, { repoUrl: e.target.value })}
                placeholder="https://github.com/..." className="w-full h-9 px-3 rounded-lg border border-zinc-200 text-sm outline-none focus:border-blue-400 bg-white" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-zinc-500">仓库名</label>
              <input value={it.name} onChange={(e) => update(idx, { name: e.target.value })}
                className="w-full h-9 px-3 rounded-lg border border-zinc-200 text-sm outline-none focus:border-blue-400 bg-white" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-zinc-500">Stars 数</label>
              <input type="number" value={it.stars} onChange={(e) => update(idx, { stars: Number(e.target.value) || 0 })}
                className="w-full h-9 px-3 rounded-lg border border-zinc-200 text-sm outline-none focus:border-blue-400 bg-white" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-zinc-500">主语言</label>
              <input value={it.language} onChange={(e) => update(idx, { language: e.target.value })}
                placeholder="如 TypeScript" className="w-full h-9 px-3 rounded-lg border border-zinc-200 text-sm outline-none focus:border-blue-400 bg-white" />
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
          + 添加 GitHub 仓库
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

export const GitHubForm = memo(GitHubFormImpl)