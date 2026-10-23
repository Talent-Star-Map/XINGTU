import { useEffect, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowUpRight, Database, ExternalLink, RefreshCw } from 'lucide-react'
import OpportunityMap, { type RegionStat } from './OpportunityMap'
import SkillRiver from './SkillRiver'
import SkillChangeRiver from './SkillChangeRiver'
import GitHubDailyObservation from './GitHubDailyObservation'
import CitySalaryDistribution from './CitySalaryDistribution'
import { COLORS, EmptyVisual, VisualCard, chartTooltip } from './VisualPrimitives'

export default function JobseekerInsights() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [family, setFamily] = useState('')
  const [experience, setExperience] = useState('')
  const [city, setCity] = useState('')
  const [skill, setSkill] = useState('')
  const [province, setProvince] = useState('')
  const [reload, setReload] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => { controller.abort(); setError('数据读取超时，请重试'); setLoading(false) }, 30000)
    setLoading(true); setError('')
    const query = new URLSearchParams({ family, experience, city, skill })
    fetch(`/api/trend/visuals?${query}`, { signal: controller.signal }).then(async response => {
      const result = await response.json()
      if (!response.ok || !result.success) throw new Error('招聘可视化数据加载失败')
      if (!controller.signal.aborted) setData(result.data)
    }).catch(e => { if (!controller.signal.aborted) setError(e.message || '数据加载失败，请重试') })
      .finally(() => { window.clearTimeout(timeout); if (!controller.signal.aborted) setLoading(false) })
    return () => { controller.abort(); window.clearTimeout(timeout) }
  }, [family, experience, city, skill, reload])
  const daily = data?.github?.history?.at(-1)
  const latest = data?.latest_collection ? `${data.latest_collection} UTC` : '暂无记录'
  const reset = () => { setFamily(''); setExperience(''); setCity(''); setSkill(''); setProvince('') }
  return <div className="space-y-5">
    <div className="rounded-2xl border p-5 flex items-start justify-between gap-4 flex-wrap" style={{ background: 'var(--color-surface-container-lowest)', borderColor: 'var(--color-outline-variant)' }}>
      <div><p className="text-xs font-semibold tracking-wider text-blue-500 mb-1">JOB MARKET OBSERVATORY</p><h2 className="text-xl font-bold">从技能到城市，找到你的下一站</h2><p className="text-xs mt-2 opacity-60">招聘样本与开源技术分开观察，每个结论都可以回到来源。</p></div>
      <button onClick={() => setReload(v => v + 1)} disabled={loading} className="text-xs border rounded-lg px-3 py-2 flex items-center gap-2"><RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />{loading ? '更新中' : '刷新数据'}</button>
      <div className="w-full flex flex-wrap gap-2 mt-1 text-sm">
        <select aria-label="岗位方向" className="border rounded-lg px-3 py-2 bg-transparent" value={family} onChange={e => { setFamily(e.target.value); setCity(''); setSkill('') }}><option value="">全部技术方向</option>{data?.families?.map((f: string) => <option key={f}>{f}</option>)}</select>
        <select aria-label="经验要求" className="border rounded-lg px-3 py-2 bg-transparent" value={experience} onChange={e => setExperience(e.target.value)}><option value="">全部经验要求</option>{['应届', '不限', '1-3', '3-5', '5-10'].map(v => <option key={v} value={v}>{v.includes('-') ? `${v}年` : v}</option>)}</select>
        <select aria-label="工作城市" className="border rounded-lg px-3 py-2 bg-transparent" value={city} onChange={e => setCity(e.target.value)}><option value="">全部工作城市</option>{data?.city_options?.map((v: string) => <option key={v}>{v}</option>)}</select>
        <button onClick={reset} className="px-2 text-xs opacity-60">重置筛选</button>
        {skill && <button onClick={() => setSkill('')} className="px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-xs">原文列表：{skill} ×</button>}
      </div>
    </div>
    {error && <p role="alert" className="rounded-xl border p-4 text-sm text-red-500">{error}<button className="ml-3 underline" onClick={() => setReload(v => v + 1)}>重试</button></p>}
    {loading && <p role="status" className="text-xs opacity-60">正在读取真实招聘与GitHub数据…</p>}
    {data && <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[
        ['可追溯招聘样本', data.total_jobs, '按来源链接去重'], ['招聘企业', data.companies, '按企业名称去重'],
        ['有效薪资样本', data.salary_samples, `${data.total_jobs ? Math.round(data.salary_samples / data.total_jobs * 100) : 0}% 薪资覆盖率`],
        ['GitHub仓库', data.github.repo_count ?? '—', '开源观察独立样本'],
      ].map(([label, value, note]) => <div key={label} className="rounded-xl border p-4" style={{ background: 'var(--color-surface-container-lowest)', borderColor: 'var(--color-outline-variant)' }}><p className="text-xs opacity-60">{label}</p><p className="text-3xl font-bold tabular-nums mt-2">{value}</p><p className="text-[10px] mt-2 opacity-50">{note}</p></div>)}</div>
      <div className="grid lg:grid-cols-2 gap-5 items-start">
        <VisualCard title="招聘技能需求排行" description="标签在去重招聘样本中的出现次数；点击条形查看对应招聘来源。">
          {data.skills.length ? <ResponsiveContainer width="100%" height={340}><BarChart layout="vertical" data={data.skills.slice(0, 12)} margin={{ left: 8, right: 24 }}><CartesianGrid horizontal={false} opacity={.15} /><XAxis type="number" tick={{ fontSize: 10 }} /><YAxis type="category" dataKey="name" width={105} tick={{ fontSize: 11 }} /><Tooltip contentStyle={chartTooltip} formatter={(value: any) => [value, '招聘提及数']} /><Bar isAnimationActive={false} dataKey="count" radius={[0, 5, 5, 0]} onClick={(row: any) => setSkill(row.name)} cursor="pointer">{data.skills.slice(0, 12).map((r: any, i: number) => <Cell key={r.name} fill={COLORS[i % COLORS.length]} />)}</Bar></BarChart></ResponsiveContainer> : <EmptyVisual>当前条件下没有可统计的技能标签</EmptyVisual>}
        </VisualCard>
        <VisualCard title="GitHub技术标签热度" description={`来自仓库语言与Topics，不与招聘技能热度混算。最近采集：${data.github.latest_collection || '暂无'} UTC`}>
          {data.github.status === 'available' && data.github.skills.length ? <ResponsiveContainer width="100%" height={340}><BarChart layout="vertical" data={data.github.skills.slice(0, 12)} margin={{ right: 24 }}><CartesianGrid horizontal={false} opacity={.15} /><XAxis type="number" tick={{ fontSize: 10 }} /><YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} /><Tooltip contentStyle={chartTooltip} formatter={(value: any) => [value, '涉及仓库数']} /><Bar isAnimationActive={false} dataKey="count" fill="#13a89e" radius={[0, 5, 5, 0]} /></BarChart></ResponsiveContainer> : <EmptyVisual>{data.github.message || '暂无GitHub标签样本'}</EmptyVisual>}
          <p className="text-[10px] leading-relaxed opacity-50 mt-2">{data.github.method}</p>
        </VisualCard>
      </div>
      <div className="grid lg:grid-cols-2 gap-5 items-start">
        {data.history.length >= 2 ? <VisualCard title="招聘技能演化 · 主题河流" description="按周对比留存的招聘重复观测；每条色带是一项技能。"><SkillRiver windows={data.history} note={data.history_note} /></VisualCard> : <SkillChangeRiver scopeNote="展示已有技能差异记录；使用本卡片的岗位筛选，独立于页面上方的招聘样本筛选。" />}
        <GitHubDailyObservation snapshots={data.github.history || []} message={data.github.message} />
      </div>
      {daily && <VisualCard title={`GitHub每日榜单 · ${daily.date}`} description={`本次保存${daily.repo_count}个仓库；来自GitHub Trending daily。每天北京时间09:00采集，榜单仅代表抓取时刻。`} action={<a href={daily.source_url || 'https://github.com/trending?since=daily'} target="_blank" rel="noreferrer" className="text-xs text-blue-500 whitespace-nowrap">查看来源 ↗</a>}>
        <div className="overflow-x-auto"><table className="w-full text-xs"><thead className="opacity-60 border-b"><tr>{['榜单序号', '开源仓库', '语言', '总Stars', '榜单当日Stars'].map(v => <th key={v} className="p-3 text-left whitespace-nowrap">{v}</th>)}</tr></thead><tbody>{(daily.repos || []).map((r: any) => <tr key={r.source_id} className="border-b last:border-0"><td className="p-3 opacity-50">{r.rank}</td><td className="p-3"><a href={r.url} target="_blank" rel="noreferrer" className="font-semibold hover:text-blue-500">{r.source_id}</a><p className="opacity-50 mt-1 max-w-md truncate">{r.description}</p></td><td className="p-3">{r.primary_language || '未注明'}</td><td className="p-3">{r.stars?.toLocaleString() ?? '未公开'}</td><td className="p-3 text-emerald-600">{r.stars_today === null ? '未公开' : `+${r.stars_today}`}</td></tr>)}</tbody></table></div>
      </VisualCard>}
      <div className="grid lg:grid-cols-2 gap-5 items-start">
        <VisualCard title="城市机会地图" description={`按工作城市汇总到省级。${data.unmapped_jobs}条海外或未匹配地点留在城市列表，不强行定位。`}>
          <OpportunityMap rows={data.provinces} onPick={setProvince} />
          {province && <div className="mt-3 text-xs rounded-lg border p-3"><p className="font-semibold mb-2">{province} · 点击城市筛选</p><div className="flex flex-wrap gap-2">{(data.province_cities?.[province] || []).map((name: string) => <button key={name} className="border px-2 py-1 rounded" onClick={() => { setCity(name); setProvince('') }}>{name}</button>)}{!(data.province_cities?.[province] || []).length && '当前筛选下暂无样本'}</div></div>}
        </VisualCard>
        <CitySalaryDistribution cities={data.cities} scope={[family, experience, city].filter(Boolean).join(" · ")} onReset={reset} onCity={setCity} />
      </div>
      <VisualCard title="城市机会对比" description="条形展示岗位数量，数字保留有效薪资覆盖率和中位数，避免只看薪资忽略样本。">
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="text-xs opacity-60 border-b"><tr>{['工作城市', '采集岗位', '招聘企业', '有效薪资', '月薪中位数'].map(h => <th key={h} className="p-3 text-left font-medium">{h}</th>)}</tr></thead><tbody>{data.cities.slice(0, 15).map((r: RegionStat) => <tr key={r.city} className="border-b last:border-0"><td className="p-3"><button onClick={() => setCity(r.city)} className="hover:text-blue-500">{r.city}</button></td><td className="p-3"><div className="relative min-w-28"><div className="absolute inset-y-0 left-0 rounded bg-blue-100/60" style={{ width: `${100 * r.jobs / Math.max(1, data.cities[0]?.jobs)}%` }} /><span className="relative px-2 tabular-nums">{r.jobs}</span></div></td><td className="p-3">{r.companies}</td><td className="p-3">{r.salary_samples}条 / {Math.round(r.salary_samples / r.jobs * 100)}%</td><td className="p-3">{r.salary_samples >= 3 ? `${r.median_salary_k}K` : '样本不足'}</td></tr>)}</tbody></table></div>
      </VisualCard>
      <VisualCard title={skill ? `招聘原文 · ${skill}` : '招聘样本与数据来源'} description={`筛选后共${data.evidence_total}条，展示前30条。最近采集：${latest}`} action={<Database className="h-4 w-4 opacity-40" />}>
        <div className="grid md:grid-cols-2 gap-3">{data.evidence.map((r: any) => <a key={r.id} href={r.url} target="_blank" rel="noreferrer" className="rounded-lg border p-3 hover:border-blue-400 transition-colors" style={{ borderColor: 'var(--color-outline-variant)' }}><div className="flex items-start justify-between gap-2"><span className="text-sm font-semibold">{r.title}</span><ExternalLink className="h-3.5 w-3.5 opacity-50 shrink-0" /></div><p className="text-xs opacity-65 mt-1">{r.company || '企业未注明'} · {r.city} · {r.salary_mid_k === null ? '薪资未公开' : `区间中点${r.salary_mid_k}K/月`}</p><p className="text-[10px] opacity-45 mt-2">{r.source} · {r.collected_at || '时间未记录'} UTC</p></a>)}</div>
        <p className="text-xs opacity-60 leading-relaxed mt-4">{data.method}</p>
      </VisualCard>
      <VisualCard title="GitHub来源仓库" description="按当前Stars排序的已采集仓库。不是历史增速排名。"><div className="grid md:grid-cols-2 gap-x-6 gap-y-2">{data.github.repos.map((r: any) => <a key={r.name} href={r.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 border-b py-2 text-xs"><span className="flex-1 truncate font-medium">{r.name}</span><span className="opacity-50">{r.language} · ★ {r.stars.toLocaleString()}</span><ArrowUpRight className="h-3.5 w-3.5" /></a>)}</div></VisualCard>
    </>}
  </div>
}
