import { useMemo, useState } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { COLORS, chartTooltip, EmptyVisual } from './VisualPrimitives'
export interface SkillWindow { date: string; samples?: number; repo_count?: number; counts?: Record<string, number>; skills?: { name: string; count: number }[] }
export default function SkillRiver({ windows, note }: { windows: SkillWindow[]; note: string }) {
  const [focused, setFocused] = useState('')
  const [mode, setMode] = useState<'count' | 'rate'>('count')
  const names = useMemo(() => {
    const totals = new Map<string, number>()
    windows.forEach(w => Object.entries(w.counts || Object.fromEntries((w.skills || []).map(s => [s.name, s.count]))).forEach(([n, v]) => totals.set(n, (totals.get(n) || 0) + v)))
    return [...totals].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([n]) => n)
  }, [windows])
  const data = windows.map(w => {
    const counts = w.counts || Object.fromEntries((w.skills || []).map(s => [s.name, s.count]))
    const samples = w.samples ?? w.repo_count ?? 0
    return { date: w.date, samples, ...Object.fromEntries(names.map((name, i) => [`s${i}`, mode === 'count' ? counts[name] || 0 : samples ? Math.round(1000 * (counts[name] || 0) / samples) / 10 : null])) }
  })
  if (!names.length && windows.length > 0) return <div><EmptyVisual>这些时间窗口没有该类技能记录，切换其他类型查看。</EmptyVisual><p className="text-xs opacity-60">{note}</p></div>
  return <div>
    <div className="flex gap-2 mb-3">{(['count', 'rate'] as const).map(key => <button key={key} onClick={() => setMode(key)} className="text-xs border rounded-lg px-3 py-1.5" style={{ color: mode === key ? '#4f6ef7' : undefined }}>{key === 'count' ? '提及数量' : '样本提及率'}</button>)}</div>
    {windows.length < 2 ? <EmptyVisual>已留存 {windows.length} 个时间窗口。至少两个真实窗口后显示主题河流，不回填历史或预测数据。</EmptyVisual> : mode === 'count' ? <ResponsiveContainer width="100%" height={275}><AreaChart data={data} stackOffset="silhouette"><CartesianGrid vertical={false} strokeDasharray="3 3" opacity={.15} /><XAxis dataKey="date" interval="preserveStartEnd" tick={{ fontSize: 10 }} /><YAxis hide /><Tooltip contentStyle={chartTooltip} />{names.map((name, i) => <Area isAnimationActive={false} key={name} name={name} dataKey={`s${i}`} type="linear" stackId="river" fill={COLORS[i]} stroke={COLORS[i]} fillOpacity={!focused || focused === name ? .82 : .15} />)}</AreaChart></ResponsiveContainer>
      : <ResponsiveContainer width="100%" height={275}><AreaChart data={data}><CartesianGrid vertical={false} strokeDasharray="3 3" opacity={.15} /><XAxis dataKey="date" interval="preserveStartEnd" tick={{ fontSize: 10 }} /><YAxis unit="%" tick={{ fontSize: 10 }} /><Tooltip contentStyle={chartTooltip} />{names.filter(name => !focused || focused === name).map(name => { const i = names.indexOf(name); return <Area isAnimationActive={false} key={name} name={name} dataKey={`s${i}`} type="linear" fill={COLORS[i]} stroke={COLORS[i]} fillOpacity={.1} /> })}</AreaChart></ResponsiveContainer>}
    <div className="flex flex-wrap gap-3 text-xs mb-3">{names.map((name, i) => <button key={name} onClick={() => setFocused(focused === name ? '' : name)} className="flex items-center gap-1.5" style={{ opacity: !focused || focused === name ? 1 : .4 }}><i className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i] }} />{name}</button>)}</div>
    <p className="text-xs leading-relaxed opacity-60">{note} 数量河流的中心线没有数值含义，请通过悬停读数。技能可共现，提及率之和可能超过100%。</p>
    {windows.length > 0 && <details className="mt-3 text-xs"><summary className="cursor-pointer opacity-75">查看时间窗口与样本量</summary><div className="flex flex-wrap gap-2 mt-2">{data.map(w => <span key={w.date} className="border rounded px-2 py-1">{w.date} · {w.samples}条</span>)}</div></details>}
  </div>
}
