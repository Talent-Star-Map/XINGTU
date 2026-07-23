import { AlertTriangle } from 'lucide-react'

interface Props {
  confidenceAvg: number
  lowConfidenceSkills: string[]
  onDismiss: () => void
}

export default function LowConfidenceBanner({ confidenceAvg, lowConfidenceSkills, onDismiss }: Props) {
  return (
    <div className="rounded-xl border p-4 flex items-start gap-3"
      style={{ borderColor: 'rgba(255,181,71,0.3)', background: 'rgba(255,181,71,0.06)' }}>
      <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" style={{ color: 'var(--accent-orange)' }} />
      <div className="flex-1">
        <p className="text-xs font-semibold" style={{ color: 'var(--accent-orange)' }}>
          简历解析置信度较低 ({confidenceAvg})
        </p>
        <p className="text-[10px] mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>
          以下技能建议确认是否准确，或补充简历后重新解析：
        </p>
        {lowConfidenceSkills.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {lowConfidenceSkills.map(s => (
              <span key={s} className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--color-surface)', color: 'var(--color-on-surface-variant)', border: '1px solid var(--color-outline-variant)' }}>{s}</span>
            ))}
          </div>
        )}
      </div>
      <button onClick={onDismiss} className="text-xs shrink-0" style={{ color: 'var(--color-outline)' }}>✕</button>
    </div>
  )
}
