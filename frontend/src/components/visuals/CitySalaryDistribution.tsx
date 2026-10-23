import type { RegionStat } from './OpportunityMap'
import { EmptyVisual, VisualCard } from './VisualPrimitives'

type SalaryCity = RegionStat & { salary_values_k?: number[] }
export default function CitySalaryDistribution({ cities, scope, onReset, onCity }: { cities: SalaryCity[]; scope: string; onReset: () => void; onCity: (city: string) => void }) {
  const eligible = cities.filter(r => r.salary_samples > 0).sort((a, b) => b.salary_samples - a.salary_samples || (b.median_salary_k || 0) - (a.median_salary_k || 0))
  const rows = eligible.slice(0, 12)
  const max = Math.max(1, ...rows.map(r => r.maximum || 0))
  const samples = cities.reduce((n, r) => n + r.salary_samples, 0)
  return <VisualCard title="城市薪资分布" description="薪资为招聘月薪区间中点。每城至少3条时画箱线图；只有1—2条时显示原始样本点。">
    <div className="text-xs flex flex-wrap justify-between gap-2 mb-4 opacity-70"><span>当前范围：{scope || '全部技术岗位'} · {samples} 条有效薪资</span>{scope && <button className="text-blue-600" onClick={onReset}>查看全部城市薪资</button>}</div>
    {rows.length ? <>
      <div className="space-y-4 py-3">{rows.map(row => <div key={row.city} className="grid grid-cols-[58px_1fr_70px] gap-3 items-center text-xs">
        <button className="text-left hover:text-blue-500 break-words" onClick={() => onCity(row.city)}>{row.city}</button>
        <div className="relative h-7" title={`${row.city} · ${row.salary_samples}条 · 最小${row.minimum}K，中位${row.median_salary_k}K，最大${row.maximum}K`}>
          {row.salary_samples >= 3 ? <>
            <span className="absolute top-3.5 border-t border-blue-400" style={{ left: `${(row.minimum || 0) / max * 100}%`, width: `${((row.maximum || 0) - (row.minimum || 0)) / max * 100}%` }} />
            <span className="absolute top-1 h-5 rounded-sm bg-blue-100 border border-blue-400" style={{ left: `${(row.q1 || 0) / max * 100}%`, width: `${Math.max(.6, ((row.q3 || 0) - (row.q1 || 0)) / max * 100)}%` }} />
            <span className="absolute top-0.5 h-6 border-l-2 border-blue-600" style={{ left: `${(row.median_salary_k || 0) / max * 100}%` }} />
          </> : (row.salary_values_k || []).map((value, i) => <span key={i} className="absolute w-2.5 h-2.5 rounded-full bg-amber-500 -translate-x-1/2" style={{ left: `${value / max * 100}%`, top: i === 1 ? 16 : 5 }} title={`${row.city} · ${value}K/月`} />)}
        </div>
        <span className="text-right">{row.salary_samples >= 3 ? `${row.median_salary_k}K` : '样本点'}<span className="block text-[10px] opacity-50">n={row.salary_samples}{row.salary_samples >= 3 ? ' · 中位' : ''}</span></span>
      </div>)}</div>
      <div className="text-[10px] opacity-50 flex justify-between ml-16 mr-20 mt-2"><span>0K/月</span><span>{max}K/月</span></div>
      <p className="text-[10px] opacity-60 mt-4 leading-relaxed">蓝色：最小—最大值、25%—75%分位箱体及中位线；橙色：样本不足3条，仅展示实际样本点。{eligible.length > 12 ? `共${eligible.length}个有薪资的城市，此处按样本量展示前12个，可按城市筛选。` : ''}</p>
    </> : <EmptyVisual>当前范围没有有效薪资记录。{scope ? <button className="text-blue-600 underline ml-2" onClick={onReset}>清除筛选查看全部</button> : '招聘中未公开或无效的薪资不计为零。'}</EmptyVisual>}
  </VisualCard>
}
