import { COLORS } from './VisualPrimitives'
export interface PlanPhase { phase: number; title: string; duration: string; skills: string[] }

export function phaseWindow(duration: string, previousEnd: number): { start: number; end: number } | null {
  const explicit = /第\s*(\d+)\s*[-~—至到]\s*(\d+)\s*周/.exec(duration)
  if (explicit && Number(explicit[2]) >= Number(explicit[1]) && Number(explicit[1]) > 0) return { start: Number(explicit[1]) - 1, end: Number(explicit[2]) }
  const single = /第\s*(\d+)\s*周/.exec(duration)
  if (single && Number(single[1]) > 0) return { start: Number(single[1]) - 1, end: Number(single[1]) }
  const weeks = /^\s*(\d+)\s*周\s*$/.exec(duration)
  if (weeks && Number(weeks[1]) > 0) return { start: previousEnd, end: previousEnd + Number(weeks[1]) }
  return null
}

export default function LearningGantt({ phases }: { phases: PlanPhase[] }) {
  let previous = 0
  const windows = phases.map(p => { const range = phaseWindow(p.duration || '', previous); if (range) previous = range.end; return { ...p, range } })
  if (!windows.some(p => p.range)) return null
  const total = Math.max(...windows.map(p => p.range?.end || 0), 1)
  return <div className="rounded-xl border p-4 mb-6" style={{ borderColor: 'var(--color-outline-variant)' }}>
    <h4 className="text-sm font-semibold">学习计划甘特图</h4><p className="text-xs opacity-60 mt-1 mb-4">时间来自已有学习计划，显示相对周次；不代表已投入时间或已经掌握。</p>
    <div className="overflow-x-auto"><div className="min-w-[450px]">
      <div className="ml-36 flex justify-between text-[10px] opacity-50 mb-3"><span>第1周</span><span>第{Math.ceil(total / 2)}周</span><span>第{total}周</span></div>
      {windows.map((p, i) => <div key={p.phase} className="grid grid-cols-[132px_1fr] items-center gap-3 mb-3 text-xs"><span className="truncate" title={p.title}>{p.phase}. {p.title}</span><div className="h-8 relative rounded bg-slate-100/60">{p.range ? <span className="absolute inset-y-0 rounded flex items-center px-2 text-white text-[10px] overflow-hidden whitespace-nowrap" style={{ left: `${p.range.start / total * 100}%`, width: `${(p.range.end - p.range.start) / total * 100}%`, background: COLORS[i % COLORS.length] }} title={`${p.title} · ${p.duration} · ${p.skills.join('、')}`}>{p.duration}</span> : <span className="opacity-60 px-2 leading-8">时间未明确：{p.duration}</span>}</div></div>)}
    </div></div>
  </div>
}
