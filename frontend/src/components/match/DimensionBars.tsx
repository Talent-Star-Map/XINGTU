interface DimensionScore {
  score: number
  weight: number
  weighted: number
}

interface Props {
  dims: {
    skill: DimensionScore
    experience: DimensionScore
    education: DimensionScore
    salary: DimensionScore
  }
  dimensions: Record<string, any>
}

const DIM_LABELS: Record<string, string> = {
  skill: '技能匹配',
  experience: '经验匹配',
  education: '学历匹配',
  salary: '薪资匹配',
}

const DIM_COLORS: Record<string, string> = {
  skill: 'var(--color-primary)',
  experience: 'var(--accent-purple)',
  education: 'var(--accent-green)',
  salary: 'var(--accent-orange)',
}

const DIM_TOOLTIP: Record<string, string> = {
  skill: `用户技能 ∩ 岗位技能
───────────
岗位技能总数

注: 核心技能权重 ×1.2
  已验证技能 ×1.2`,
  experience: `1 − |用户年限 − JD中点|
───────────────
    JD年限范围

完全匹配 = 100
偏差越大 → 越低`,
  education: `    博士  = 100
    硕士  =  90
    本科  =  75
    大专  =  50

达标 = 100
每差一级 −25`,
  salary: `重叠度 = 用户期望范围 ∩ JD范围
         ────────────────────
              JD范围

完全重叠 = 100
无重叠按距离衰减`,
}

export default function DimensionBars({ dims }: Props) {
  return (
    <div className="rounded-2xl border p-6" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
      <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--color-on-surface)' }}>
        四维度匹配分析
      </h3>
      <div className="grid grid-cols-2 gap-5">
        {(Object.entries(DIM_LABELS) as [string, string][]).map(([key, label]) => {
          const d = dims[key as keyof typeof dims]
          const color = DIM_COLORS[key] || 'var(--color-primary)'
          return (
            <div key={key} className="group relative">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span style={{ color: 'var(--color-on-surface-variant)' }}>{label}</span>
                <span className="font-bold" style={{ color }}>{Math.round(d.score)}%</span>
              </div>
              <div className="h-2 rounded-full" style={{ background: 'var(--color-surface-container)' }}>
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${d.score}%`, background: `linear-gradient(90deg, ${color}66, ${color})` }}
                />
              </div>
              <div className="flex justify-between text-[10px] mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>
                <span>权重 {(d.weight * 100).toFixed(0)}%</span>
                <span>加权 {d.weighted.toFixed(1)}</span>
              </div>

              {/* 悬停 tooltip */}
              <div className="invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-opacity absolute z-20 left-0 right-0 top-full mt-2 rounded-xl border p-4 shadow-xl text-xs pointer-events-none min-w-[200px]"
                style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface)' }}>
                <p className="font-bold mb-2 flex items-center gap-1.5" style={{ color }}>
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                  {label}
                </p>
                <pre className="font-mono text-[11px] leading-relaxed mb-2 whitespace-pre-wrap" style={{ color: 'var(--color-on-surface)' }}>{DIM_TOOLTIP[key]}</pre>
                <div className="pt-2 mt-1 border-t flex items-center justify-between" style={{ borderColor: 'var(--color-outline-variant)' }}>
                  <span style={{ color: 'var(--color-on-surface-variant)' }}>当前计算</span>
                  <span className="font-mono font-bold" style={{ color }}>
                    {Math.round(d.score)} × {(d.weight * 100).toFixed(0)}% = {d.weighted.toFixed(1)}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
