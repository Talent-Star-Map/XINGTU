import MatchGauge from './MatchGauge'
import DimensionBars from './DimensionBars'

interface Props {
  result: {
    overall: number
    grade: string
    score_version: string
    dims: any
    dimension_formula?: Record<string, any>
  }
}

export default function MatchScorePanel({ result }: Props) {
  return (
    <div className="grid grid-cols-5 gap-6">
      <div className="col-span-2">
        <MatchGauge
          overall={result.overall}
          grade={result.grade}
          scoreVersion={result.score_version}
        />
      </div>
      <div className="col-span-3">
        <DimensionBars
          dims={result.dims}
          dimensions={result.dimension_formula}
        />
      </div>
    </div>
  )
}
