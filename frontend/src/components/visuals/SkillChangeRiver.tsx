import { useEffect, useState } from 'react'
import SkillRiver from './SkillRiver'
import { EmptyVisual, VisualCard } from './VisualPrimitives'

type Kind = 'added' | 'removed' | 'modified'
type RiverData = {
  record_count: number; observation_count: number; job_count: number; method: string
  jobs: { id: number; title: string }[]
  windows: ({ date: string; samples: number; sources: string[]; run_ids: string[] } & Record<Kind, Record<string, number>>)[]
}

export default function SkillChangeRiver({ scopeNote = '' }: { scopeNote?: string }) {
  const [data, setData] = useState<RiverData | null>(null)
  const [kind, setKind] = useState<Kind>('added')
  const [job, setJob] = useState('')
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => { controller.abort(); setError('技能演化读取超时，请重试') }, 30000)
    setError(''); setData(null)
    const token = localStorage.getItem('xingtu_token') || ''
    fetch('/api/trend/skill-change-river', { signal: controller.signal, headers: { Authorization: `Bearer ${token}` } })
      .then(async r => { const body = await r.json(); if (!r.ok || !body.success) throw new Error('技能演化数据读取失败'); if (!controller.signal.aborted) setData(body.data) })
      .catch(e => { if (!controller.signal.aborted) setError(e.message || '技能演化数据读取失败') })
      .finally(() => window.clearTimeout(timeout))
    return () => { controller.abort(); window.clearTimeout(timeout) }
  }, [retry])
  // Filtering is requested from the same aggregate endpoint so daily de-duplication stays consistent.
  const [filtered, setFiltered] = useState<RiverData | null>(null)
  const [filterError, setFilterError] = useState('')
  useEffect(() => {
    setFiltered(null); setFilterError('')
    if (!job) return
    const controller = new AbortController()
    const timeout = window.setTimeout(() => { controller.abort(); setFilterError('岗位历史读取超时，请重新选择') }, 30000)
    fetch(`/api/trend/skill-change-river?job_id=${job}`, { signal: controller.signal, headers: { Authorization: `Bearer ${localStorage.getItem('xingtu_token') || ''}` } })
      .then(async r => { const body = await r.json(); if (!r.ok || !body.success) throw new Error('岗位历史读取失败'); if (!controller.signal.aborted) setFiltered(body.data) })
      .catch(e => { if (!controller.signal.aborted) setFilterError(e.message) })
      .finally(() => window.clearTimeout(timeout))
    return () => { controller.abort(); window.clearTimeout(timeout) }
  }, [job, retry])
  const active = job ? filtered : data
  const labels = { added: '候选新增', removed: '候选缺失', modified: '候选修改' }
  return <VisualCard title="技能演化 · 主题河流" description="按真实差异记录日期，观察不同技能涉及的岗位数量；下方可查看具体差异与来源。">
    {scopeNote && <p className="text-xs opacity-60 mb-3">{scopeNote}</p>}
    {error ? <p role="alert" className="text-sm text-red-500">{error}<button onClick={() => setRetry(v => v + 1)} className="ml-3 underline">重试</button></p> : !data ? <EmptyVisual>正在读取技能演化记录…</EmptyVisual> : <>
      <div className="flex flex-wrap gap-2 items-center mb-4">
        <select aria-label="技能演化岗位" value={job} onChange={e => setJob(e.target.value)} className="text-sm border rounded-lg px-3 py-2 bg-transparent max-w-full"><option value="">全部有记录岗位</option>{data.jobs.map(j => <option key={j.id} value={j.id}>{j.title} · #{j.id}</option>)}</select>
        {(['added', 'removed', 'modified'] as Kind[]).map(k => <button key={k} onClick={() => setKind(k)} className={`text-xs border rounded-lg px-3 py-2 ${kind === k ? 'bg-blue-50 text-blue-600 border-blue-200' : ''}`}>{labels[k]}</button>)}
      </div>
      {filterError ? <p role="alert" className="text-sm text-red-500">{filterError}</p> : !active ? <EmptyVisual>正在读取岗位历史…</EmptyVisual> : <>
        <p className="text-xs opacity-60 mb-4">{active.record_count} 条原始记录 · 去重后 {active.observation_count} 条岗位日观察 · {active.job_count} 个岗位 · {active.windows.length} 个日期窗口</p>
        <SkillRiver key={`${job}:${kind}`} windows={active.windows.map(w => ({ date: w.date, samples: w.samples, counts: w[kind] }))} note={`${active.method} 当前显示${labels[kind]}；提及率的分母是当日有差异记录的岗位数。`} />
        <details className="text-xs mt-4"><summary className="cursor-pointer opacity-75">查看数据来源与运行批次</summary><div className="space-y-2 mt-3">{active.windows.map(w => <div key={w.date} className="border rounded-lg p-3 break-words"><b>{w.date}</b> · {w.samples} 个岗位<p className="mt-1 opacity-70">来源：{w.sources.join('、') || '记录未提供来源名称'}</p><p className="mt-1 opacity-70">批次：{w.run_ids.join('、') || '记录未提供批次编号'}</p></div>)}</div></details>
      </>}
    </>}
  </VisualCard>
}
