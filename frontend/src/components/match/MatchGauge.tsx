import { useMemo } from 'react'

interface Props {
  overall: number
  grade: string
  scoreVersion: string
}

const GRADE_COLORS: Record<string, string> = {
  S: '#00E599',
  A: '#00C8FF',
  B: '#FFB547',
  C: '#FF8C42',
  D: '#FF4D6A',
}

const GRADE_BG: Record<string, string> = {
  S: 'rgba(0,229,153,0.12)',
  A: 'rgba(0,200,255,0.12)',
  B: 'rgba(255,181,71,0.12)',
  C: 'rgba(255,140,66,0.12)',
  D: 'rgba(255,77,106,0.12)',
}

export default function MatchGauge({ overall, grade, scoreVersion }: Props) {
  const color = GRADE_COLORS[grade] || 'var(--color-primary)'
  const bg = GRADE_BG[grade] || 'var(--color-primary-fixed)'

  // SVG 圆形进度条
  const circumference = 2 * Math.PI * 54  // r=54
  const dashOffset = useMemo(() => circumference * (1 - overall / 100), [overall])

  return (
    <div className="rounded-2xl border p-6 text-center" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
      <div className="relative inline-flex items-center justify-center">
        <svg width="140" height="140" viewBox="0 0 140 140" className="-rotate-90">
          {/* 背景圆 */}
          <circle cx="70" cy="70" r="54" fill="none" stroke="var(--color-surface-container)" strokeWidth="10" />
          {/* 进度圆 */}
          <circle
            cx="70" cy="70" r="54" fill="none"
            stroke={color} strokeWidth="10" strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
          />
        </svg>
        {/* 中心文字 */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-extrabold" style={{ color }}>{Math.round(overall)}</span>
          <span className="text-[10px] mt-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>匹配度</span>
        </div>
      </div>

      {/* 等级徽章 */}
      <div className="mt-3 inline-flex items-center gap-2 px-4 py-1.5 rounded-full" style={{ background: bg, border: `1px solid ${color}33` }}>
        <span className="text-base font-extrabold" style={{ color }}>等级 {grade}</span>
        <span className="text-[10px]" style={{ color: 'var(--color-on-surface-variant)' }}>SCORE {scoreVersion}</span>
      </div>

      {/* 等级说明 */}
      <div className="mt-3 flex justify-center gap-3 text-[10px]" style={{ color: 'var(--color-on-surface-variant)' }}>
        {['S 优秀', 'A 良好', 'B 中等', 'C 偏低', 'D 不足'].map(t => (
          <span key={t} className={t.startsWith(grade) ? 'font-bold' : 'opacity-60'} style={t.startsWith(grade) ? { color } : {}}>{t}</span>
        ))}
      </div>
    </div>
  )
}
