import { memo } from 'react'
import type { SummaryContent } from '../../../../types/resume'

function SummaryFormImpl({
  content, onChange,
}: { content: SummaryContent; onChange: (c: SummaryContent) => void }) {
  const text = content?.text ?? ''
  return (
    <div className="space-y-2">
      <label className="block text-xs text-zinc-500">个人简介</label>
      <textarea
        value={text}
        onChange={(e) => onChange({ ...content, text: e.target.value })}
        placeholder="用 2-3 句话概括你的职业背景和核心优势..."
        rows={5}
        className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm outline-none focus:border-blue-400 resize-y"
        style={{ background: 'var(--color-surface)' }}
      />
    </div>
  )
}

// memo:content 引用不变时跳过重渲染
export const SummaryForm = memo(SummaryFormImpl)