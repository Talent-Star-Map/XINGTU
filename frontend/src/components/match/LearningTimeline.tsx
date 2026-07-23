import { useState } from 'react'
import { motion } from 'framer-motion'
import { BookOpen, CheckCircle, ChevronDown, ChevronRight } from 'lucide-react'

interface LearningPhase {
  phase: number
  title: string
  duration: string
  skills: string[]
  goals: string[]
  resources: { name: string; url?: string; type?: string }[]
}

interface Props {
  phases: LearningPhase[]
  totalWeeks: string
  targetJobTitle: string
  storageKey?: string
}

export default function LearningTimeline({ phases, totalWeeks, targetJobTitle, storageKey }: Props) {
  const [expanded, setExpanded] = useState<number>(() => {
    if (storageKey) { try { const v = localStorage.getItem(storageKey); if (v !== null) return parseInt(v, 10) } catch {/* */} }
    return 0
  })

  const handleToggle = (idx: number) => {
    const next = expanded === idx ? -1 : idx
    setExpanded(next)
    if (storageKey) { try { localStorage.setItem(storageKey, String(next)) } catch {/* */} }
  }

  const phaseColors = ['#00C8FF', '#7C3AED', '#00E599', '#FF8C42']

  return (
    <div className="rounded-2xl border p-6" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--color-on-surface)' }}>
          <BookOpen className="h-4 w-4" style={{ color: 'var(--color-primary)' }} />
          学习路径规划
        </h3>
        <span className="text-xs px-2 py-1 rounded-full" style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-primary)' }}>
          预计 {totalWeeks}
        </span>
      </div>
      <p className="text-xs mb-4" style={{ color: 'var(--color-on-surface-variant)' }}>
        基于您与「{targetJobTitle}」的差距，为您生成分阶段提升路线：
      </p>

      {/* 纵向时间轴 */}
      <div className="relative">
        <div className="absolute left-5 top-2 bottom-2 w-0.5" style={{ background: 'var(--color-outline-variant)' }} />

        {phases.map((p, idx) => {
          const color = phaseColors[idx % phaseColors.length]
          const isOpen = expanded === idx
          return (
            <div key={p.phase} className="relative pl-12 pb-4 last:pb-0">
              {/* 圆点 */}
              <div
                className="absolute left-3 top-2 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                style={{ background: color }}
              >
                {p.phase}
              </div>

              {/* 卡片 */}
              <div
                className="rounded-xl border cursor-pointer transition-all"
                style={{ borderColor: isOpen ? `${color}55` : 'var(--color-outline-variant)', background: 'var(--color-surface)' }}
                onClick={() => handleToggle(idx)}
              >
                <div className="flex items-center justify-between px-4 py-3">
                  <div>
                    <h4 className="text-sm font-semibold" style={{ color: 'var(--color-on-surface)' }}>
                      第 {p.phase} 阶段：{p.title}
                    </h4>
                    <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>{p.duration}</p>
                  </div>
                  {isOpen
                    ? <ChevronDown className="h-4 w-4" style={{ color }} />
                    : <ChevronRight className="h-4 w-4" style={{ color: 'var(--color-outline)' }} />
                  }
                </div>

                {/* 展开内容 */}
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    transition={{ duration: 0.2 }}
                    className="px-4 pb-4 space-y-3 border-t"
                    style={{ borderColor: 'var(--color-outline-variant)' }}
                  >
                    <div>
                      <p className="text-xs font-semibold mt-3 mb-1.5" style={{ color: 'var(--color-on-surface-variant)' }}>学习技能</p>
                      <div className="flex flex-wrap gap-1.5">
                        {p.skills.map(s => (
                          <span key={s} className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium" style={{ background: `${color}15`, color }}>
                            {s}
                            {p.etaPerSkill && <span className="opacity-60">· {p.etaPerSkill}w</span>}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--color-on-surface-variant)' }}>学习目标</p>
                      <div className="space-y-1">
                        {p.goals.map(g => (
                          <p key={g} className="text-[10px] flex items-start gap-1.5" style={{ color: 'var(--color-on-surface)' }}>
                            <CheckCircle className="h-3 w-3 mt-0.5 shrink-0" style={{ color }} /> {g}
                          </p>
                        ))}
                      </div>
                    </div>
                    {p.resources && p.resources.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--color-on-surface-variant)' }}>推荐资源</p>
                        <div className="space-y-1">
                          {p.resources.map((r, i) => (
                            <p key={i} className="text-[10px]" style={{ color: 'var(--color-on-surface)' }}>
                              📎 {r.url ? <a href={r.url} target="_blank" className="underline" style={{ color }}>{r.name}</a> : r.name}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
