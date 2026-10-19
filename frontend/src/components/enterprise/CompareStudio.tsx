/**
 * CompareStudio — 人才星候选人对比(雷达 + 维度记分板)
 *
 * 设计取舍(调研结论):
 *  - 雷达图只表达"形状/均衡度",不承担精确读数;每个顶点都标数字会让 4 人以上变成噪声
 *  - 系列超过 5 人时雷达只画匹配度前 5,完整分数交给右侧表格
 *  - 颜色全部走主题 token(亮/暗自适应),不使用硬编码 hex
 *  - 默认低透明填充,悬停某一人选再提亮其多边形,其余淡化
 */
import { useMemo, useState } from 'react'

export interface CompareCandidate {
  id: number
  name: string
  match: number | null
  match_breakdown: {
    skill: number | null
    exp: number | null
    edu: number | null
    location: number | null
    salary: number | null
  }
}

const COLORS = [
  'var(--color-primary)',
  'var(--accent-cyan)',
  'var(--accent-orange)',
  'var(--accent-purple)',
  'var(--accent-green)',
]

export const compareColor = (idx: number) => COLORS[idx % COLORS.length]

const DIMS = [
  { key: 'skill', label: '技能' },
  { key: 'exp', label: '经验' },
  { key: 'edu', label: '学历' },
  { key: 'location', label: '地域' },
  { key: 'salary', label: '薪资' },
] as const

const SIZE = 420
const CX = SIZE / 2
const CY = SIZE / 2
const R = 140

const pointAt = (i: number, radius: number): [number, number] => {
  const angle = (Math.PI * 2 * i) / DIMS.length - Math.PI / 2
  return [CX + radius * Math.cos(angle), CY + radius * Math.sin(angle)]
}

export default function CompareStudio({ candidates }: { candidates: CompareCandidate[] }) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null)

  const ranks = useMemo(() => {
    const sorted = [...candidates].sort((a, b) => (b.match ?? -1) - (a.match ?? -1))
    return new Map(sorted.map((c, i) => [c.id, i + 1]))
  }, [candidates])

  // 雷达最多画 5 条系列,按匹配度取前 5(颜色仍按原始序号,保持与其它区块一致)
  const shown = useMemo(() => {
    if (candidates.length <= 5) return candidates
    return [...candidates].sort((a, b) => (b.match ?? -1) - (a.match ?? -1)).slice(0, 5)
  }, [candidates])

  const bestByDim = useMemo(() => {
    const best: Record<string, number | null> = {}
    DIMS.forEach((d) => {
      const vals = candidates.map((c) => c.match_breakdown[d.key]).filter((v): v is number => v != null)
      best[d.key] = vals.length ? Math.max(...vals) : null
    })
    return best
  }, [candidates])

  // 每人领先维度数
  const leadCount = useMemo(() => {
    const m = new Map<number, number>()
    candidates.forEach((c) => {
      m.set(c.id, DIMS.filter((d) => {
        const v = c.match_breakdown[d.key]
        return v != null && v === bestByDim[d.key]
      }).length)
    })
    return m
  }, [candidates, bestByDim])

  const rings = [0.25, 0.5, 0.75, 1]

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,440px)_minmax(0,1fr)] gap-10 items-start">
      {/* ── 雷达 ── */}
      <div>
        <div className="mb-5">
          <h3 className="text-xs font-medium mb-2" style={{ color: 'var(--color-on-surface-variant)' }}>总体匹配度</h3>
          <div className="space-y-1.5">
            {candidates.map((c, idx) => (
              <div key={c.id} className="flex items-center gap-2 text-[11px]">
                <span className="w-16 truncate" style={{ color: 'var(--color-on-surface)' }}>{c.name}</span>
                <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-surface-container)' }}>
                  <div className="h-full rounded-full"
                       style={{ width: `${Math.min(100, Math.max(0, c.match ?? 0))}%`, background: compareColor(idx), opacity: 0.85 }} />
                </div>
                <span className="w-8 text-right tabular-nums" style={{ color: 'var(--color-on-surface-variant)' }}>
                  {c.match != null ? Math.round(c.match) : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="text-xs font-medium" style={{ color: 'var(--color-on-surface-variant)' }}>五维匹配</h3>
          <span className="text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>悬停人选可高亮</span>
        </div>
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="w-full max-w-[440px] mx-auto block"
          role="img"
          aria-label="候选人五维匹配雷达图"
        >
          {/* 刻度 */}
          <text x={CX + 6} y={CY - R + 3} fontSize={10} fill="var(--color-on-surface-variant)" opacity={0.8}>100</text>
          <text x={CX + 6} y={CY - R / 2 + 3} fontSize={10} fill="var(--color-on-surface-variant)" opacity={0.6}>50</text>

          {/* 网格环 */}
          {rings.map((ring, ri) => (
            <polygon
              key={ri}
              points={DIMS.map((_, i) => pointAt(i, R * ring).join(',')).join(' ')}
              fill="none"
              stroke="var(--color-outline-variant)"
              strokeWidth={1}
              opacity={ri === rings.length - 1 ? 0.8 : 0.45}
            />
          ))}

          {/* 轴线 */}
          {DIMS.map((d, i) => {
            const [x, y] = pointAt(i, R)
            return (
              <line key={d.key} x1={CX} y1={CY} x2={x} y2={y}
                    stroke="var(--color-outline-variant)" strokeWidth={1} opacity={0.35} />
            )
          })}

          {/* 轴标签 */}
          {DIMS.map((d, i) => {
            const [x, y] = pointAt(i, R + 24)
            const anchor = x < CX - 8 ? 'end' : x > CX + 8 ? 'start' : 'middle'
            return (
              <text key={d.key} x={x} y={y} textAnchor={anchor} dominantBaseline="middle"
                    fontSize={13} fontWeight={500} fill="var(--color-on-surface)">
                {d.label}
              </text>
            )
          })}

          {/* 系列 */}
          {shown.map((c) => {
            const idx = candidates.findIndex((x) => x.id === c.id)
            const color = compareColor(idx >= 0 ? idx : 0)
            const isActive = activeIdx === idx
            const dimmed = activeIdx !== null && !isActive
            const pts = DIMS.map((d, i) => pointAt(i, ((c.match_breakdown[d.key] ?? 0) / 100) * R))
            return (
              <g
                key={c.id}
                style={{ opacity: dimmed ? 0.16 : 1, transition: 'opacity 160ms ease' }}
                onMouseEnter={() => setActiveIdx(idx)}
                onMouseLeave={() => setActiveIdx(null)}
              >
                <polygon
                  points={pts.map((p) => p.join(',')).join(' ')}
                  fill={color}
                  fillOpacity={isActive ? 0.12 : 0.04}
                  stroke={color}
                  strokeWidth={isActive ? 2.25 : 1.5}
                  strokeLinejoin="round"
                  style={{ transition: 'fill-opacity 160ms ease, stroke-width 160ms ease' }}
                />
                {(activeIdx === null || isActive) && pts.map(([x, y], vi) => (
                  <circle key={vi} cx={x} cy={y} r={isActive ? 3.2 : 2} fill={color}
                          stroke="var(--color-surface)" strokeWidth={1.5} />
                ))}
              </g>
            )
          })}
        </svg>

        {/* 图例 */}
        <div className="flex flex-wrap gap-2 mt-3 justify-center">
          {candidates.map((c, idx) => {
            const color = compareColor(idx)
            const on = activeIdx === idx
            return (
              <button
                key={c.id}
                onMouseEnter={() => setActiveIdx(idx)}
                onMouseLeave={() => setActiveIdx(null)}
                onFocus={() => setActiveIdx(idx)}
                onBlur={() => setActiveIdx(null)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs transition-colors"
                style={{
                  borderColor: on ? color : 'var(--color-outline-variant)',
                  background: on ? 'var(--color-surface-container)' : 'transparent',
                  color: 'var(--color-on-surface)',
                }}
              >
                <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                <span className="truncate max-w-[110px]">{c.name}</span>
                <span className="tabular-nums" style={{ color: 'var(--color-on-surface-variant)' }}>
                  {c.match != null ? `${Math.round(c.match)}` : '—'}
                </span>
              </button>
            )
          })}
        </div>
        {candidates.length > 5 && (
          <p className="text-[11px] mt-2 text-center" style={{ color: 'var(--color-on-surface-variant)' }}>
            雷达显示匹配度前 5 人,完整得分见右表
          </p>
        )}
      </div>

      {/* ── 维度记分板 ── */}
      <div>
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="text-xs font-medium" style={{ color: 'var(--color-on-surface-variant)' }}>维度得分</h3>
          <span className="text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>每维最高分加粗</span>
        </div>
        <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--color-outline-variant)' }}>
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: 'var(--color-surface-container-low)' }}>
                <th className="text-left font-normal px-3 py-2" style={{ color: 'var(--color-on-surface-variant)' }}>维度</th>
                {candidates.map((c, idx) => (
                  <th
                    key={c.id}
                    className="text-right font-normal px-3 py-2"
                    onMouseEnter={() => setActiveIdx(idx)}
                    onMouseLeave={() => setActiveIdx(null)}
                    style={{ background: activeIdx === idx ? 'var(--color-surface-container)' : 'transparent' }}
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: compareColor(idx) }} />
                      <span className="truncate max-w-[88px]" style={{ color: 'var(--color-on-surface)' }}>{c.name}</span>
                      <span className="tabular-nums text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>
                        #{ranks.get(c.id)}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DIMS.map((d) => (
                <tr key={d.key} className="border-t" style={{ borderColor: 'var(--color-outline-variant)' }}>
                  <td className="px-3 py-2" style={{ color: 'var(--color-on-surface-variant)' }}>{d.label}</td>
                  {candidates.map((c, idx) => {
                    const v = c.match_breakdown[d.key]
                    const isBest = v != null && v === bestByDim[d.key]
                    return (
                      <td key={c.id} className="px-3 py-2"
                          onMouseEnter={() => setActiveIdx(idx)}
                          onMouseLeave={() => setActiveIdx(null)}
                          style={{ background: activeIdx === idx ? 'var(--color-surface-container-low)' : 'transparent' }}>
                        <div className="flex items-center justify-end gap-2">
                          <span className="tabular-nums"
                                style={{
                                  color: 'var(--color-on-surface)',
                                  fontWeight: isBest ? 700 : 400,
                                }}>
                            {v != null ? Math.round(v) : '—'}
                          </span>
                          <span className="w-10 h-1 rounded-full overflow-hidden shrink-0" style={{ background: 'var(--color-surface-container)' }}>
                            <span className="block h-full rounded-full"
                                  style={{ width: `${Math.min(100, Math.max(0, v ?? 0))}%`, background: compareColor(idx), opacity: isBest ? 1 : 0.55 }} />
                          </span>
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
              <tr className="border-t" style={{ borderColor: 'var(--color-outline-variant)' }}>
                <td className="px-3 py-2" style={{ color: 'var(--color-on-surface-variant)' }}>领先维度</td>
                {candidates.map((c) => {
                  const n = leadCount.get(c.id) ?? 0
                  return (
                    <td key={c.id} className="px-3 py-2 text-right tabular-nums"
                        style={{ color: n > 0 ? 'var(--color-on-surface)' : 'var(--color-on-surface-variant)' }}>
                      {n} 项
                    </td>
                  )
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
