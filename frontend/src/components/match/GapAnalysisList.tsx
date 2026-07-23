import { BookOpen } from 'lucide-react'
import SkillGapCards from './SkillGapCards'

interface Props {
  result: {
    skills: { have: any[]; miss: any[]; extra: string[] }
    summary: string
    recommendations: string[]
  }
  onGoToLearning: () => void
}

export default function GapAnalysisList({ result, onGoToLearning }: Props) {
  return (
    <>
      <SkillGapCards
        have={result.skills.have}
        miss={result.skills.miss}
        extra={result.skills.extra.map((s: string) => ({ skill: s }))}
      />
      <div
        className="rounded-2xl border p-6"
        style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--color-on-surface)' }}>
            <BookOpen className="h-4 w-4" style={{ color: 'var(--accent-purple)' }} /> 诊断总结与改进建议
          </h3>
          <button
            onClick={onGoToLearning}
            className="text-xs font-medium px-3 py-1.5 rounded-lg border flex items-center gap-1"
            style={{ borderColor: 'var(--color-outline-variant)', color: 'var(--color-primary)' }}
          >
            <BookOpen className="h-3 w-3" /> 查看学习报告
          </button>
        </div>
        <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--color-on-surface)' }}>{result.summary}</p>
        {result.recommendations?.length > 0 && (
          <div className="space-y-2 mt-3 pt-3 border-t" style={{ borderColor: 'var(--color-outline-variant)' }}>
            {result.recommendations.map((rec: string, idx: number) => (
              <p key={idx} className="text-xs flex items-start gap-2" style={{ color: 'var(--color-on-surface-variant)' }}>
                <span
                  className="shrink-0 mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold"
                  style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-primary)' }}
                >{idx + 1}</span>{rec}
              </p>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
