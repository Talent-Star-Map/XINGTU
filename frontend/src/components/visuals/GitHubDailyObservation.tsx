import { useState } from 'react'
import GitWordCloud from './GitWordCloud'
import { COLORS, EmptyVisual, VisualCard } from './VisualPrimitives'

type Label = { name: string; count: number }
type Repo = { source_id: string; url: string; primary_language?: string; topics?: string[] }
type Snapshot = { date: string; repo_count: number; skills: Label[]; repos?: Repo[]; source_url?: string }

const polar = (radius: number, angle: number) => [240 + Math.cos(angle) * radius, 220 + Math.sin(angle) * radius]
function petal(radius: number, start: number, end: number) {
  const a = polar(radius, start), b = polar(radius, end)
  return `M240,220 L${a[0]},${a[1]} A${radius},${radius} 0 ${end - start > Math.PI ? 1 : 0},1 ${b[0]},${b[1]} Z`
}

export default function GitHubDailyObservation({ snapshots, message }: { snapshots: Snapshot[]; message?: string }) {
  const [view, setView] = useState<'rose' | 'cloud'>('rose')
  const [date, setDate] = useState('')
  const [selected, setSelected] = useState('')
  const daily = snapshots.find(s => s.date === date) || snapshots[snapshots.length - 1]
  const labels = [...(daily?.skills || [])].filter(s => s.count > 0).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
  const visible = labels.slice(0, view === 'rose' ? 12 : 40)
  const max = Math.max(1, ...visible.map(s => s.count))
  const repos = (daily?.repos || []).filter(r => !selected || [r.primary_language || '', ...(r.topics || [])].some(t => t.toLowerCase() === selected.toLowerCase()))
  const pick = (name: string) => setSelected(s => s === name ? '' : name)
  return <VisualCard title="GitHub每日技术观察" description="观察某一天榜单的技术标签构成；可切换玫瑰图、词云，并点击标签查看来源仓库。">
    {!daily ? <EmptyVisual>{message || '暂无已保存的每日榜单'}</EmptyVisual> : <>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <select aria-label="GitHub榜单日期" value={daily.date} onChange={e => { setDate(e.target.value); setSelected('') }} className="text-xs border rounded-lg px-3 py-2 bg-transparent">{snapshots.map(s => <option key={s.date}>{s.date}</option>)}</select>
        {(['rose', 'cloud'] as const).map(v => <button key={v} aria-pressed={view === v} onClick={() => setView(v)} className={`text-xs border rounded-lg px-3 py-2 ${view === v ? 'bg-blue-50 text-blue-600' : ''}`}>{v === 'rose' ? '玫瑰图' : '词云'}</button>)}
        <span className="text-xs opacity-60">{daily.repo_count} 个仓库 · {labels.length} 个标签</span>
      </div>
      {!visible.length ? <EmptyVisual>当天仓库暂未取得语言或Topics标签，仍可查看下方原始榜单。</EmptyVisual> : view === 'rose' ? <div>
        <svg viewBox="0 0 480 440" className="w-full max-h-[340px]" role="img" aria-label="GitHub每日技术标签玫瑰图">
          {[.25, .5, .75, 1].map(ratio => <circle key={ratio} cx="240" cy="220" r={180 * Math.sqrt(ratio)} fill="none" stroke="currentColor" opacity={.08} />)}
          {visible.map((label, i) => {
            const step = Math.PI * 2 / visible.length
            const start = -Math.PI / 2 + i * step + .025, end = -Math.PI / 2 + (i + 1) * step - .025
            const pos = polar(201, (start + end) / 2)
            return <g key={label.name}><path d={petal(180 * Math.sqrt(label.count / max), start, end)} fill={COLORS[i % COLORS.length]} opacity={!selected || selected === label.name ? .9 : .25} tabIndex={0} role="button" aria-label={`${label.name}：${label.count}个仓库`} onClick={() => pick(label.name)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(label.name) } }} className="cursor-pointer"><title>{label.name} · {label.count} 个仓库 · {Math.round(100 * label.count / daily.repo_count)}% 榜单提及率</title></path><text x={pos[0]} y={pos[1]} textAnchor="middle" dominantBaseline="middle" fontSize="11" fill="currentColor">{i + 1}</text></g>
          })}
        </svg>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">{visible.map((label, i) => <button key={label.name} onClick={() => pick(label.name)} className="flex items-center gap-1.5 text-left min-w-0" style={{ opacity: !selected || selected === label.name ? 1 : .4 }} title={label.name}><i className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} /><span className="truncate">{i + 1}. {label.name}</span><b className="ml-auto">{label.count}</b></button>)}</div>
      </div> : <GitWordCloud words={labels} selected={selected} onPick={pick} />}
      <p className="text-[10px] opacity-60 leading-relaxed mt-4">{view === 'rose' ? '各扇区角度相同，面积对应涉及仓库数；展示前12项。' : '标签紧密排列成Git字形；字号优先按涉及仓库数设置，并随可用位置缩放。精确数量见悬停或标签列表。'} 同一仓库的同一标签只计一次，标签可共现，不表示招聘需求或每日增长率。</p>
      {selected && <div className="rounded-lg border p-3 text-xs mt-3"><div className="flex justify-between gap-2 mb-2"><b>{selected} · 来源仓库</b><button className="text-blue-500" onClick={() => setSelected('')}>清除选择</button></div>{repos.length ? repos.map(r => <a key={r.source_id} href={r.url} target="_blank" rel="noreferrer" className="block py-1 break-all text-blue-600">{r.source_id} ↗</a>) : <span>该标签的仓库明细未完整保存，可在下方榜单查看来源。</span>}</div>}
      <a href={daily.source_url || 'https://github.com/trending?since=daily'} target="_blank" rel="noreferrer" className="inline-block text-xs text-blue-500 mt-4">GitHub Trending daily 原始来源 ↗</a>
    </>}
  </VisualCard>
}
