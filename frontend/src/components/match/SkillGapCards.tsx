import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

interface SkillItem {
  skill: string
  priority?: string       // miss 项专用
  reason?: string         // miss 项专用
  confidence?: number     // have 项专用
  verified?: boolean      // have 项专用
  matched_as?: string
  is_core?: boolean
}

interface Props {
  have: SkillItem[]
  miss: SkillItem[]
  extra: SkillItem[]
}

const MAX_VISIBLE = 5  // 每列默认最多显示 5 个

const PRIORITY_LABELS: Record<string, string> = { high: '高', medium: '中', low: '低' }
const PRIORITY_COLORS: Record<string, string> = { high: 'var(--accent-red)', medium: 'var(--accent-orange)', low: 'var(--color-on-surface-variant)' }

function SkillCard({ skill, color, badge, showReason }: {
  skill: string; color: string; badge?: { label: string; color: string }; showReason?: string
}) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div
      className="text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 cursor-default"
      style={{ background: `${color}08`, border: `1px solid ${color}33` }}
      onClick={() => showReason && setExpanded(!expanded)}
    >
      <span style={{ color }}>{skill}</span>
      {badge && (
        <span className="text-[9px] px-1 py-0.5 rounded ml-auto shrink-0" style={{ background: `${badge.color}22`, color: badge.color }}>
          {badge.label}
        </span>
      )}
      {showReason && (
        <ChevronDown className="h-3 w-3 shrink-0 ml-0.5" style={{ color: 'var(--color-outline)', transform: expanded ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }} />
      )}
      {showReason && expanded && (
        <span className="absolute left-0 right-0 top-full mt-1 z-10 rounded-lg p-2 text-[10px] shadow-lg"
          style={{ background: 'var(--color-surface-container-lowest)', border: '1px solid var(--color-outline-variant)', color: 'var(--color-on-surface)' }}>
          {showReason}
        </span>
      )}
    </div>
  )
}

function SkillColumn({ title, count, color, children }: {
  title: string; count: number; color: string; children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color }}>
        <span>{title}</span>
        <span className="px-1.5 py-0.5 rounded text-[10px]" style={{ background: `${color}15` }}>{count}</span>
      </div>
      <div className="space-y-1">
        {children}
      </div>
    </div>
  )
}

export default function SkillGapCards({ have, miss, extra }: Props) {
  const [haveExpanded, setHaveExpanded] = useState(false)
  const [missExpanded, setMissExpanded] = useState(false)
  const [extraExpanded, setExtraExpanded] = useState(false)

  const renderHave = () => {
    const list = haveExpanded ? have : have.slice(0, MAX_VISIBLE)
    return (
      <>
        {list.map(s => (
          <SkillCard key={s.skill} skill={s.skill} color="var(--accent-green)"
            badge={s.verified ? { label: '✓', color: 'var(--accent-green)' }
                  : s.is_core ? { label: '核', color: 'var(--accent-orange)' } : undefined}
          />
        ))}
        {have.length > MAX_VISIBLE && (
          <button onClick={() => setHaveExpanded(!haveExpanded)}
            className="text-[10px] font-medium flex items-center gap-1 pt-1"
            style={{ color: 'var(--color-primary)' }}>
            {haveExpanded ? <><ChevronUp className="h-3 w-3" /> 收起</> : <><ChevronDown className="h-3 w-3" /> 还有 {have.length - MAX_VISIBLE} 项</>}
          </button>
        )}
      </>
    )
  }

  const renderMiss = () => {
    const list = missExpanded ? miss : miss.slice(0, MAX_VISIBLE)
    return (
      <>
        {list.map(s => {
          const pColor = PRIORITY_COLORS[s.priority || 'low']
          return (
            <div key={s.skill} className="relative">
              <SkillCard skill={s.skill} color="var(--accent-red)" showReason={s.reason}
                badge={{ label: PRIORITY_LABELS[s.priority || 'low'], color: pColor }}
              />
            </div>
          )
        })}
        {miss.length > MAX_VISIBLE && (
          <button onClick={() => setMissExpanded(!missExpanded)}
            className="text-[10px] font-medium flex items-center gap-1 pt-1"
            style={{ color: 'var(--color-primary)' }}>
            {missExpanded ? <><ChevronUp className="h-3 w-3" /> 收起</> : <><ChevronDown className="h-3 w-3" /> 还有 {miss.length - MAX_VISIBLE} 项</>}
          </button>
        )}
      </>
    )
  }

  const renderExtra = () => {
    const list = extraExpanded ? extra : extra.slice(0, MAX_VISIBLE)
    return (
      <>
        {list.map(s => (
          <SkillCard key={s.skill} skill={s.skill} color="var(--accent-purple)" />
        ))}
        {extra.length > MAX_VISIBLE && (
          <button onClick={() => setExtraExpanded(!extraExpanded)}
            className="text-[10px] font-medium flex items-center gap-1 pt-1"
            style={{ color: 'var(--color-primary)' }}>
            {extraExpanded ? <><ChevronUp className="h-3 w-3" /> 收起</> : <><ChevronDown className="h-3 w-3" /> 还有 {extra.length - MAX_VISIBLE} 项</>}
          </button>
        )}
      </>
    )
  }

  return (
    <div className="rounded-2xl border p-6" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold" style={{ color: 'var(--color-on-surface)' }}>技能差距对比</h3>
        <span className="text-[10px]" style={{ color: 'var(--color-on-surface-variant)' }}>
          <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: 'var(--accent-green)' }} />已掌握
          <span className="inline-block w-2 h-2 rounded-full mx-1 ml-2" style={{ background: 'var(--accent-red)' }} />待提升
          <span className="inline-block w-2 h-2 rounded-full mx-1 ml-2" style={{ background: 'var(--accent-purple)' }} />加分项
        </span>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <SkillColumn title="✅ 已掌握" count={have.length} color="var(--accent-green)">
            {renderHave()}
            {have.length === 0 && <p className="text-xs py-2 text-center" style={{ color: 'var(--color-outline)' }}>-</p>}
          </SkillColumn>
          <p className="text-[10px] mt-2 text-center" style={{ color: 'var(--color-on-surface-variant)' }}>
            你已具备的技能
          </p>
        </div>
        <div>
          <SkillColumn title="❌ 待提升" count={miss.length} color="var(--accent-red)">
            {renderMiss()}
            {miss.length === 0 && <p className="text-xs py-2 text-center" style={{ color: 'var(--accent-green)' }}>✅ 完全匹配</p>}
          </SkillColumn>
          <p className="text-[10px] mt-2 text-center" style={{ color: 'var(--color-on-surface-variant)' }}>
            岗位需要但你还未掌握
          </p>
        </div>
        <div>
          <SkillColumn title="🌟 加分项" count={extra.length} color="var(--accent-purple)">
            {renderExtra()}
            {extra.length === 0 && <p className="text-xs py-2 text-center" style={{ color: 'var(--color-outline)' }}>-</p>}
          </SkillColumn>
          <p className="text-[10px] mt-2 text-center" style={{ color: 'var(--color-on-surface-variant)' }}>
            你具备但岗位未要求
          </p>
        </div>
      </div>
    </div>
  )
}
