import { useState } from 'react'
import { CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts'
import { COLORS, EmptyVisual, VisualCard, chartTooltip } from './VisualPrimitives'
import type { JobSummary } from '../match/JobSelector'

export default function JobComparison({ jobs, recommendations, onPick }: { jobs: JobSummary[]; recommendations: any[]; onPick: (job: JobSummary) => void }) {
  const [open, setOpen] = useState(true)
  if (!recommendations.length || !jobs.length) return null
  const available = recommendations.map(r => ({ ...r, job: jobs.find(j => j.id === r.job_id) })).filter(r => r.job)
  const points = available.flatMap(r => {
    const match = /([\d.]+)\s*[kK]\s*[-~—至]\s*([\d.]+)\s*[kK]?/.exec(r.salary || '')
    if (!match || Number(match[1]) <= 0 || Number(match[2]) < Number(match[1])) return []
    return [{ ...r, salary_mid: (Number(match[1]) + Number(match[2])) / 2 }]
  })
  const skillCounts = new Map<string, number>()
  available.forEach(r => new Set<string>([...(r.matched_skills_full || []), ...(r.missing_skills_full || [])]).forEach(s => skillCounts.set(s, (skillCounts.get(s) || 0) + 1)))
  const skills = [...skillCounts].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([name]) => name)
  return <VisualCard title="比较你的推荐机会" description="使用本次推荐结果及招聘公开薪资；面议不画成零薪资。" action={<button onClick={() => setOpen(v => !v)} className="text-xs opacity-60">{open ? '收起' : '展开'}</button>}>
    {open && <div className="space-y-6">
      <div><h3 className="text-sm font-semibold mb-2">匹配度 × 招聘薪资</h3>{points.length ? <ResponsiveContainer width="100%" height={275}><ScatterChart margin={{ bottom: 15, left: 5, right: 20 }}><CartesianGrid strokeDasharray="3 3" opacity={.15} /><XAxis type="number" dataKey="overall" domain={[0, 100]} name="匹配分" unit="分" tick={{ fontSize: 10 }} /><YAxis type="number" dataKey="salary_mid" name="月薪区间中点" unit="K" tick={{ fontSize: 10 }} /><ZAxis range={[70, 70]} /><Tooltip contentStyle={chartTooltip} cursor={{ strokeDasharray: '3 3' }} content={({ active, payload }: any) => active && payload?.length ? <div className="bg-white text-slate-700 border shadow rounded p-3 text-xs"><b>{payload[0].payload.title}</b><p>{payload[0].payload.company}</p><p>匹配{payload[0].payload.overall}分 · {payload[0].payload.salary}</p></div> : null} /><Scatter isAnimationActive={false} data={points} fill={COLORS[0]} onClick={(r: any) => r.job && onPick(r.job)} cursor="pointer" /></ScatterChart></ResponsiveContainer> : <EmptyVisual>本次推荐暂没有可解析的公开薪资，保留下方技能与岗位对比。</EmptyVisual>}</div>
      {!!skills.length && <div><h3 className="text-sm font-semibold mb-3">岗位 × 技能缺口热力图</h3><p className="text-xs opacity-60 mb-3">蓝色已覆盖，橙色待补齐，灰色不在该岗位技能清单。点击岗位查看具体诊断。</p><div className="overflow-auto"><table className="text-xs w-full"><thead><tr><th className="text-left min-w-36 p-2">推荐岗位</th>{skills.map(s => <th key={s} className="min-w-20 max-w-28 px-2 py-3 font-medium break-words">{s}</th>)}</tr></thead><tbody>{available.map(r => <tr key={r.job_id}><td className="p-2 max-w-44"><button onClick={() => onPick(r.job!)} className="text-left hover:text-blue-500"><span className="block truncate">{r.title}</span><span className="opacity-50 text-[10px]">{r.company}</span></button></td>{skills.map(s => { const have = (r.matched_skills_full || []).includes(s); const miss = (r.missing_skills_full || []).includes(s); return <td key={s} className="p-1"><div className="rounded-md py-3 text-center" style={{ background: have ? '#dce5ff' : miss ? '#ffebd5' : 'var(--color-surface-container)', color: have ? '#3153c4' : miss ? '#a65d16' : '#8b94a5' }} title={`${r.title} · ${s} · ${have ? '本次诊断已覆盖' : miss ? '本次诊断待补齐' : '岗位未列出'}`}>{have ? '已覆盖' : miss ? '待补齐' : '—'}</div></td> })}</tr>)}</tbody></table></div></div>}
      <div className="overflow-auto"><h3 className="text-sm font-semibold mb-2">推荐岗位对比表</h3><table className="w-full text-xs"><thead className="opacity-60 border-b"><tr>{['岗位', '匹配分', '薪资', '地点', '技能覆盖'].map(n => <th key={n} className="p-3 text-left">{n}</th>)}</tr></thead><tbody>{available.map(r => <tr key={r.job_id} className="border-b last:border-0"><td className="p-3"><button onClick={() => onPick(r.job!)} className="text-left hover:text-blue-500">{r.title}</button></td><td className="p-3 min-w-28"><div className="relative"><i className="absolute inset-y-0 left-0 rounded bg-blue-100/70" style={{ width: `${r.overall}%` }} /><span className="relative px-2">{r.overall}分</span></div></td><td className="p-3 whitespace-nowrap">{r.salary || '未公开'}</td><td className="p-3">{r.location || '未注明'}</td><td className="p-3">{r.matched_count}/{r.job_skill_count}</td></tr>)}</tbody></table></div>
    </div>}
  </VisualCard>
}
