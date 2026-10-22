import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ExternalLink, Layers, Loader2, Network, RotateCcw } from 'lucide-react'
import JobGraphCanvas, { JOB_GRAPH_LEGEND } from './JobGraphCanvas'
import type { GraphNode } from './JobGraphCanvas'
import NodeListPanel from './NodeListPanel'

type Stage = 'nature' | 'roles' | 'skills' | 'postings' | 'skill_roles' | 'skill_jds'
const steps: { id: Stage; name: string }[] = [
  { id: 'nature', name: '工作性质' }, { id: 'roles', name: '岗位方向' },
  { id: 'skills', name: '岗位技能/岗位招聘' }, { id: 'skill_roles', name: '技能方向' }, { id: 'skill_jds', name: 'JD 技能' },
]

export default function JobGraphExplorer() {
  const [stage, setStage] = useState<Stage>('nature')
  const [nature, setNature] = useState('')
  const [role, setRole] = useState('')
  const [skill, setSkill] = useState('')
  const [skillName, setSkillName] = useState('')
  const [source, setSource] = useState('')
  const [level, setLevel] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [showList, setShowList] = useState(false)
  useEffect(() => {
    const abort = new AbortController()
    setLoading(true); setError('')
    const params = new URLSearchParams({ stage, nature, role, skill, source, level, page: String(page) })
    fetch(`/api/kg/explorer/employment?${params}`, {
      signal: abort.signal, cache: 'no-store', headers: { Authorization: `Bearer ${localStorage.getItem('xingtu_token') || ''}` },
    }).then(async response => {
      if (!response.ok) throw new Error(response.status === 401 ? '登录已过期，请重新登录' : '图谱暂时无法加载')
      const body = await response.json()
      if (!body.success) throw new Error(body.message || '图谱加载失败')
      return body.data
    }).then(value => {
      if (!abort.signal.aborted) setData(value)
    }).catch(reason => { if (!abort.signal.aborted) setError(reason.message || '图谱加载失败') })
      .finally(() => { if (!abort.signal.aborted) setLoading(false) })
    return () => abort.abort()
  }, [stage, nature, role, skill, source, level, page, revision])
  const canvasData = useMemo(() => ({ nodes: data?.nodes || [], links: data?.links || [] }), [data?.nodes, data?.links])
  const go = (next: Stage) => {
    setStage(next); setPage(1)
    setSkill(''); setSkillName('')
    if (next === 'skill_roles' || next === 'skill_jds') { setNature(''); setRole('') }
    if (next === 'nature' || next === 'roles') setRole('')
    if (next === 'nature') setNature('')
  }
  const pick = (id?: string) => {
    const node: GraphNode | undefined = data?.nodes.find((n: GraphNode) => n.id === id)
    if (!node) return
    if (node.type === 'Nature') { setNature(node.name || ''); go('roles') }
    if (node.type === 'Cluster') { setRole(node.name || ''); go('skills') }
    if (node.type === 'Skill') {
      setSkill(node.id); setSkillName(node.name || ''); setPage(1)
      if (stage !== 'skill_roles' && stage !== 'skill_jds') {
        setStage('skill_jds'); setNature(''); setRole('')
      }
    }
    // Recruitment nodes lock their floating JD in the canvas, without reloading data.
  }
  const panelStyle = { background: 'var(--color-surface)', borderColor: 'var(--color-outline-variant)' }
  const muted = { color: 'var(--color-on-surface-variant)' }
  const activeStep = stage === 'postings' ? 'skills' : stage
  const stepIndex = steps.findIndex(item => item.id === activeStep)
  const reverseView = stage === 'skill_roles' || stage === 'skill_jds'
  const hints = {
    nature: '点击一种工作性质，选择你想做的工作',
    roles: '点击岗位方向，查看该方向涉及的全部已提取技能点',
    skills: '岗位技能与岗位招聘是同级视图，可在上方切换',
    postings: '悬停查看招聘概览，点击节点固定浮窗，点击金锁解锁',
    skill_roles: '点击技能，只展示该技能及与它关联的岗位方向',
    skill_jds: '点击技能，只展示该技能及与它关联的企业招聘；点击招聘节点可固定浮窗',
  }
  return <div className="flex h-full min-h-0 flex-col gap-2 overflow-auto p-2 md:p-3" style={{ background: 'var(--color-background)' }}>
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 px-1">
      <h1 className="flex items-center gap-2 text-sm font-semibold"><Network className="h-4 w-4 text-blue-500" />求职岗位图谱<span className="text-[11px] font-normal" style={muted} title="当前筛选范围内，通过来源校验并跨表去重后纳入图谱的招聘数量，非云库原始记录总数">{!loading && data?.ready ? `已纳入图谱 ${data.postings} 条招聘` : ''}</span></h1>
      <div className="flex gap-3 text-[11px]"><button onClick={() => setRevision(v => v + 1)} className="flex items-center gap-1"><RotateCcw className="h-3 w-3" />刷新</button></div>
    </header>
    <div className="px-1 text-[10px]" style={muted}>图谱版本更新于 {data?.updated_at ? new Date(data.updated_at).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) : '—'} · 查看最新版本可点击刷新</div>
    <section className="flex shrink-0 flex-wrap items-center gap-2 rounded-xl border p-2" style={panelStyle}>
      <nav aria-label="岗位图谱视图" className="flex flex-wrap items-center gap-1">
        {steps.map((item, index) => <button key={item.id} disabled={(item.id === 'skills' && !role) || (item.id === 'roles' && !nature)} aria-current={activeStep === item.id ? 'page' : undefined} onClick={() => go(item.id)} className="rounded-lg px-3 py-1.5 text-xs disabled:opacity-40" style={{ background: activeStep === item.id ? 'var(--color-primary)' : 'var(--color-surface-container)', color: activeStep === item.id ? '#fff' : 'var(--color-on-surface)' }}>{index + 1}. {item.name}</button>)}
      </nav>
      <div className="flex items-center gap-2 lg:ml-auto">
        <select aria-label="招聘来源" className="h-8 max-w-[150px] rounded-lg border bg-transparent px-2 text-xs" value={source} onChange={e => { setSource(e.target.value); setPage(1) }}><option value="">全部来源</option>{(data?.choices?.sources || []).map((s: string) => <option key={s}>{s}</option>)}</select>
        <select aria-label="岗位级别" className="h-8 max-w-[150px] rounded-lg border bg-transparent px-2 text-xs" value={level} onChange={e => { setLevel(e.target.value); setPage(1) }}><option value="">全部级别</option>{Object.entries(data?.choices?.levels || {}).map(([key, label]) => <option key={key} value={key}>{String(label)}</option>)}</select>
        <button className="text-xs text-blue-500" onClick={() => { setSource(''); setLevel(''); go('nature') }}>重选工作</button>
      </div>
    </section>
    <section className="flex min-h-[420px] flex-1 overflow-hidden rounded-xl border" style={panelStyle}>
      {showList && <aside className="hidden w-52 shrink-0 border-r lg:block" style={{ borderColor: 'var(--color-outline-variant)' }}><NodeListPanel key={stage} nodes={data?.nodes || []} onSelect={pick} /></aside>}
      <main className="flex min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b px-3 py-2 text-[11px]" style={{ borderColor: 'var(--color-outline-variant)' }}>
          <div className="flex items-center gap-3"><button aria-expanded={showList} className="hidden items-center gap-1 lg:flex" onClick={() => setShowList(v => !v)}><Layers className="h-3 w-3" />{showList ? '收起目录' : '节点目录'}</button>{stepIndex > 0 && <button className="flex items-center gap-1 text-blue-500" onClick={() => go(reverseView ? 'nature' : stage === 'postings' || stage === 'skills' ? 'roles' : 'nature')}><ArrowLeft className="h-3 w-3" />上一步</button>}<span>{[nature, role, skillName].filter(Boolean).join(' / ') || '你想做哪类工作？'}</span></div>
          {(stage === 'skills' || stage === 'postings') && <div role="group" aria-label="岗位展示内容" className="flex gap-1 rounded-lg bg-black/5 p-1">{([{ id: 'skills', name: '岗位技能' }, { id: 'postings', name: '岗位招聘' }] as const).map(item => <button key={item.id} aria-pressed={stage === item.id} className="rounded-md px-3 py-1" style={{ background: stage === item.id ? 'var(--color-primary)' : undefined, color: stage === item.id ? '#fff' : undefined }} onClick={() => go(item.id)}>{item.name}</button>)}</div>}
          {reverseView && skill && <button className="text-blue-500" onClick={() => { setSkill(''); setSkillName(''); setPage(1) }}>重选技能</button>}
          {(stage === 'postings' || stage === 'skill_jds') && data?.pages > 1 && <div className="flex items-center gap-2"><span>每页最多 12 条招聘</span><button disabled={loading || page <= 1} className="disabled:opacity-30" onClick={() => setPage(v => v - 1)}>上一页</button><span>{data.page} / {data.pages}</span><button disabled={loading || data.page >= data.pages} className="disabled:opacity-30" onClick={() => setPage(data.page + 1)}>下一页</button></div>}
        </div>
        <div className="relative min-h-0 flex-1 bg-[#080e20]">
          {loading || error || !data?.nodes?.length ? <div role="status" className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-sm text-slate-300">{loading && <Loader2 className="h-7 w-7 animate-spin" />}<span>{loading ? '正在展开岗位图谱…' : error || '当前条件下暂无已采集样本，可更换筛选或返回上一步'}</span>{!loading && <button className="rounded-lg border border-slate-600 px-3 py-2" onClick={() => go('nature')}>返回工作性质</button>}</div> : <JobGraphCanvas data={canvasData} onSelect={pick} lockPopoverOnClick renderNodePopover={renderEmploymentPopover} />}
        </div>
        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t px-3 py-2 text-[11px]" style={{ ...muted, borderColor: 'var(--color-outline-variant)' }}>
          <div aria-label="节点颜色图例" className="flex flex-wrap gap-3">{JOB_GRAPH_LEGEND.map(item => <span key={item.type} title={item.hint} className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full" style={{ background: item.color }} />{item.label}</span>)}</div>
          <span>{hints[stage]}</span>
        </footer>
      </main>
    </section>
  </div>
}

function renderEmploymentPopover(node: GraphNode) {
  const item = node.recruitment
  if (!item) return <div className="space-y-2 leading-5"><p>{node.member_count || 0} 条相关招聘</p><p className="text-slate-400">{node.type === 'Nature' ? '点击查看该工作性质下的岗位方向' : node.type === 'Cluster' ? '点击继续探索岗位技能和企业招聘' : '点击查看要求这项技能的具体企业招聘'}</p></div>
  return <div className="space-y-4">
    <div className="text-[11px] font-semibold tracking-wider text-slate-400">企业招聘</div>
    <div className="space-y-3 text-sm text-slate-300">
      <p className="flex items-start gap-2"><span aria-hidden="true">🏢</span>{item.company || '企业未注明'}</p>
      <p className="flex items-center gap-2"><span aria-hidden="true">📍</span>{item.city || '城市未注明'}</p>
      <p className="flex items-center gap-2 text-amber-300"><span aria-hidden="true">💰</span>{item.salary_text || '薪资未注明'}</p>
      <p className="text-xs text-slate-400">{item.source}</p>
    </div>
    <a href={item.source_url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 px-4 py-3 text-sm font-semibold text-white">查看详情<ExternalLink className="h-3 w-3" /></a>
  </div>
}
