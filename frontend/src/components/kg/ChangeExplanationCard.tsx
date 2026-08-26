/**
 * ChangeExplanationCard — 变化归因卡片
 * 折叠显示一行变化(+12% 薪资),展开显示完整 LLM 归因。
 */
import { useState } from 'react'

interface Change {
  change_id: string
  date?: string
  type?: string
  magnitude?: number
  before?: any
  after?: any
  reason?: string
  reason_source?: string
}

export default function ChangeExplanationCard({ changes }: { changes: Change[] }) {
  const [openId, setOpenId] = useState<string | null>(null)

  if (!changes || changes.length === 0) {
    return <div className="text-xs px-3 py-2" style={{ color: 'var(--color-on-surface-variant)' }}>暂无变化事件</div>
  }

  const fmtDate = (d?: string) => d ? d.slice(0, 10) : ''
  const fmtPct = (v?: number) => v == null ? '' : `${v > 0 ? '+' : ''}${Math.round((v || 0) * 100)}%`
  const label = (c: Change) => {
    switch (c.type) {
      case 'salary_increase': return `📈 薪资上调 ${fmtPct(c.magnitude)}`
      case 'salary_decrease': return `📉 薪资下调 ${fmtPct(c.magnitude)}`
      case 'skill_added':     return `➕ 新增 ${c.magnitude} 项技能要求`
      case 'skill_removed':   return `➖ 移除 ${c.magnitude} 项技能要求`
      case 'education_change':return `🎓 学历门槛变化`
      default:                return c.type || '变化'
    }
  }

  return (
    <div className="overflow-auto">
      {changes.map((c) => {
        const open = openId === c.change_id
        return (
          <div
            key={c.change_id}
            className="border-b px-3 py-2 cursor-pointer text-sm"
            style={{ borderColor: 'var(--color-outline-variant)' }}
            onClick={() => setOpenId(open ? null : c.change_id)}
          >
            <div className="flex items-center justify-between">
              <span className="font-medium">{label(c)}</span>
              <span className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>{fmtDate(c.date)}</span>
            </div>
            {!open && c.reason && (
              <div className="text-xs mt-1 line-clamp-1" style={{ color: 'var(--color-on-surface-variant)' }}>
                {c.reason}
              </div>
            )}
            {open && (
              <div className="mt-2 text-xs space-y-1">
                <div><b>归因:</b> {c.reason || <i style={{ color: 'var(--color-on-surface-variant)' }}>暂无(待 LLM 归因)</i>}</div>
                {c.reason_source && <div><b>来源模型:</b> {c.reason_source}</div>}
                <details>
                  <summary>前后对比</summary>
                  <pre className="text-[10px] mt-1 p-1 rounded overflow-auto" style={{ background: 'var(--color-surface-container)' }}>
                    {JSON.stringify({ before: c.before, after: c.after }, null, 2)}
                  </pre>
                </details>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}