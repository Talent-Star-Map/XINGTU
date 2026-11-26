import MatchGauge from './MatchGauge'
import DimensionBars from './DimensionBars'
import MatchRadar from '../visuals/MatchRadar'

const MISSING_LABELS: Record<string, string> = { experience: '经验', education: '学历', salary: '期望薪资', location: '意向城市' }

interface Props {
  result: {
    overall: number
    grade: string
    score_version: string
    dims: any
    dimension_formula?: Record<string, any>
    missing_information?: string[]
  }
}

export default function MatchScorePanel({ result }: Props) {
  return (
    <div className="space-y-5">
      {!!result.missing_information?.length && <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>资料未填写：{result.missing_information.map(key => (MISSING_LABELS[key] || key)).join('、')}。缺失项采用固定中性规则，补充后重新计算；分数不代表录用概率。</p>}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
      <div className="md:col-span-2">
        <MatchGauge
          overall={result.overall}
          grade={result.grade}
          scoreVersion={result.score_version}
        />
      </div>
      <div className="md:col-span-3">
        <DimensionBars
          dims={result.dims}
          dimensions={result.dimension_formula}
        />
      </div>
    </div><MatchRadar dims={result.dims} /></div>
  )
}
