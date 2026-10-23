import { useMemo, useState } from 'react'
import rawMap from '../../assets/maps/china-provinces.geo.json?raw'
import { EmptyVisual } from './VisualPrimitives'

export interface RegionStat { city: string; jobs: number; companies: number; salary_samples: number; median_salary_k: number | null; q1: number | null; q3: number | null; minimum: number | null; maximum: number | null }
const boundary = JSON.parse(rawMap)
const project = ([lon, lat]: number[]) => [(lon - 72) * 10, 620 - Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)) * 520]
const featurePath = (feature: any) => {
  const polys = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates
  return polys.map((polygon: number[][][]) => polygon.map(ring => ring.map((point, i) => {
    const [x, y] = project(point)
    return `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ') + 'Z').join(' ')).join(' ')
}

export default function OpportunityMap({ rows, onPick }: { rows: RegionStat[]; onPick: (province: string) => void }) {
  const [mode, setMode] = useState<'jobs' | 'companies' | 'salary'>('jobs')
  const [hover, setHover] = useState('')
  const values = useMemo(() => new Map(rows.map(row => [row.city, row])), [rows])
  const value = (row?: RegionStat) => !row ? null : mode === 'salary' ? row.salary_samples >= 3 ? row.median_salary_k : null : row[mode]
  const max = Math.max(1, ...rows.map(row => value(row) || 0))
  const active = values.get(hover)
  return <div>
    <div className="flex gap-2 mb-2 flex-wrap">{([['jobs', '岗位数量'], ['companies', '招聘企业数'], ['salary', '薪资中位数']] as const).map(([key, title]) => <button key={key} onClick={() => setMode(key)} className="text-xs px-3 py-2 rounded-lg border" style={{ borderColor: mode === key ? '#4f6ef7' : 'var(--color-outline-variant)', color: mode === key ? '#4f6ef7' : undefined }}>{title}</button>)}</div>
    {!rows.length ? <EmptyVisual>暂无可映射到国内省级区域的岗位</EmptyVisual> : <svg viewBox="0 0 700 540" className="w-full h-auto" aria-label="采集范围内IT招聘分布地图" role="img">
      <defs><linearGradient id="opportunity-legend"><stop offset="0%" stopColor="#e5eaff" /><stop offset="100%" stopColor="#3b55d6" /></linearGradient></defs>
      {boundary.features.filter((f: any) => f.properties.name).map((f: any) => {
        const name = f.properties.name
        const row = values.get(name)
        const n = value(row)
        const ratio = n === null ? 0 : Math.sqrt(n / max)
        return <path key={f.properties.adcode || name} d={featurePath(f)} fill={n === null ? '#e6e9ef' : `hsl(228 74% ${94 - ratio * 42}%)`} stroke={hover === name ? '#182b88' : '#fff'} strokeWidth={hover === name ? 1.8 : .8}
          onMouseEnter={() => setHover(name)} onMouseLeave={() => setHover('')} onFocus={() => setHover(name)} onClick={() => onPick(name)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(name) } }} tabIndex={0} role="button" aria-label={`${name} ${n === null ? '无有效样本' : n}`} className="cursor-pointer transition-colors">
          <title>{name}：{n === null ? '无有效样本' : `${n}${mode === 'salary' ? 'K/月' : '条/家'}`}{row ? `；薪资样本${row.salary_samples}条` : ''}</title>
        </path>
      })}
      <rect x="34" y="490" width="145" height="9" rx="4" fill="url(#opportunity-legend)" /><text x="34" y="517" fontSize="11" fill="#788295">少 / 低</text><text x="142" y="517" fontSize="11" fill="#788295">多 / 高</text>
    </svg>}
    <div className="text-xs min-h-8 leading-relaxed opacity-75">{active ? `${hover} · ${active.jobs}条岗位 · ${active.companies}家招聘企业 · ${active.salary_samples}条有效薪资${active.salary_samples >= 3 ? ` · 中位数${active.median_salary_k}K/月` : ' · 薪资样本不足3条，不作地区排名'}` : '悬停查看统计，点击区域查看对应城市。灰色表示无有效样本，不代表当地没有招聘。'}</div>
    <p className="text-[10px] opacity-50">省级边界：阿里云DataV公开地图数据；招聘地点映射到省级，不代表企业注册地。仅为本次采集样本。</p>
  </div>
}
