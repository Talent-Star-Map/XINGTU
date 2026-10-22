import { useEffect, useState } from 'react'
import { Bot, Check, ExternalLink, Loader2, RefreshCw, X } from 'lucide-react'

type Task = { id: string; title: string; company: string; original_role: string; original_nature: string; status: string; version: number; suggestion_json?: string; error?: string; retryable?: boolean }
type Proposal = { decision: string; nature: string; role: string; reason: string; quotes: string[]; confidence: number }
const states: Record<string, string> = { new: '待生成', generating: '生成中', pending: '待审核', failed: '生成失败', approved: '已通过', rejected: '已驳回', deferred: '保留待确认' }
const decode = (value?: string) => { try { return JSON.parse(value || '{}') } catch { return {} } }
async function api(path: string, body?: unknown) {
  const response = await fetch('/api/admin/classification' + path, { method: body === undefined ? 'GET' : 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('xingtu_token') || ''}`, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
  const result = await response.json()
  if (!response.ok || !result.success) throw new Error(typeof result.detail === 'string' ? result.detail : '请求失败，请刷新或检查管理员登录状态')
  return result.data
}

export default function AdminClassificationReview() {
  const [data, setData] = useState<any>({ items: [], counts: {}, natures: [], roles: [] })
  const [status, setStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<string[]>([])
  const [detail, setDetail] = useState<any>(null)
  const [decision, setDecision] = useState('classify')
  const [nature, setNature] = useState('')
  const [role, setRole] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [revision, setRevision] = useState(0)
  const refresh = () => setRevision(v => v + 1)
  useEffect(() => {
    let active = true
    const load = () => api(`/tasks?${new URLSearchParams({ status, search, page: String(page) })}`).then(value => { if (active) setData(value) }).catch(e => { if (active) setMessage(e.message) })
    load()
    const timer = setInterval(load, 15000)
    return () => { active = false; clearInterval(timer) }
  }, [status, search, page, revision])
  useEffect(() => setSelected([]), [status, search, page])
  const open = (value: any) => {
    setDetail(value)
    const review = value.review || {}
    const proposal = decode(review.suggestion_json)
    setDecision(review.status === 'approved' ? review.decision : proposal.decision || 'classify')
    setNature(review.status === 'approved' ? review.approved_nature : proposal.nature || '')
    setRole(review.status === 'approved' ? review.approved_role : proposal.role || '')
    setNote('')
  }
  const inspect = async (id: string) => { try { open(await api(`/tasks/${encodeURIComponent(id)}`)) } catch (e) { setMessage((e as Error).message) } }
  const generate = async (id: string) => {
    setBusy(true); setMessage('Agent 正在检索知识库并调用模型生成建议…')
    try { open(await api(`/tasks/${encodeURIComponent(id)}/suggest`, {})); setMessage('建议已生成，请核对原文后审核') }
    catch (e) { setMessage((e as Error).message) }
    finally { setBusy(false); refresh() }
  }
  const batch = async () => {
    setBusy(true)
    try { const result = await api('/suggest-batch', { ids: selected }); setMessage(`已提交 ${result.accepted} 条，后台依次生成；列表每 15 秒刷新。若服务重启或生成失败，可重试。`); setSelected([]) }
    catch (e) { setMessage((e as Error).message) }
    finally { setBusy(false); refresh() }
  }
  const review = async (action: string) => {
    if (!note.trim()) { setMessage('请填写审核说明'); return }
    setBusy(true)
    try {
      open(await api(`/tasks/${encodeURIComponent(detail.posting.id)}/decision`, { action, version: detail.review?.version || 0, decision, nature, role, note }))
      setMessage(action === 'approve' ? '审核已通过，求职图谱下次读取时生效' : '审核结果已保存'); refresh()
    } catch (e) { setMessage((e as Error).message) }
    finally { setBusy(false) }
  }
  const surface = { background: 'var(--color-surface)', borderColor: 'var(--color-outline-variant)' }
  const proposal: Proposal = decode(detail?.review?.suggestion_json)
  const kb = decode(detail?.review?.knowledge_json)
  return <div className="space-y-4 p-4 md:p-6">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="flex items-center gap-2 text-xl font-bold"><Bot className="h-5 w-5" />岗位分类审核</h1><p className="mt-2 text-xs opacity-70">知识库检索 + 大模型建议 → 人工确认。模型建议不会自动发布，原始 JD 和原始分类保留。</p></div><button onClick={refresh} className="flex items-center gap-1 rounded-lg border px-3 py-2 text-xs"><RefreshCw className="h-3 w-3" />刷新</button></header>
    <div className="flex flex-wrap gap-2">{Object.entries(states).map(([key, label]) => <button key={key} onClick={() => { setStatus(key); setPage(1) }} className="rounded-lg border px-3 py-2 text-xs" style={{ ...surface, borderColor: status === key ? 'var(--color-primary)' : surface.borderColor }}>{label} {data.counts[key] || 0}</button>)}</div>
    <div className="flex flex-wrap items-center gap-3"><input aria-label="搜索待分类岗位" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="搜索岗位名称、企业" className="rounded-lg border p-2 text-sm" style={surface} /><button className="text-xs underline" onClick={() => { setStatus('all'); setPage(1) }}>全部状态</button><button disabled={busy || !selected.length} onClick={batch} className="rounded-lg bg-blue-600 px-3 py-2 text-xs text-white disabled:opacity-40">为选中项生成建议（{selected.length}/5）</button></div>
    {message && <p role="status" className="rounded-lg border p-3 text-sm" style={surface}>{message}</p>}
    <div className="overflow-x-auto rounded-xl border" style={surface}><table className="w-full text-left text-xs"><thead><tr className="border-b"><th className="p-3">选择</th><th className="p-3">原始招聘</th><th className="p-3">当前分类</th><th className="p-3">Agent 建议</th><th className="p-3">状态</th><th className="p-3">操作</th></tr></thead><tbody>{data.items.map((item: Task) => {
      const suggestion = decode(item.suggestion_json)
      return <tr key={item.id} className="border-b last:border-0"><td className="p-3"><input aria-label={`选择${item.title}`} type="checkbox" checked={selected.includes(item.id)} disabled={busy || item.status === 'approved' || (item.status === 'generating' && !item.retryable) || (!selected.includes(item.id) && selected.length >= 5)} onChange={e => setSelected(v => e.target.checked ? [...v, item.id] : v.filter(id => id !== item.id))} /></td><td className="p-3"><strong>{item.title}</strong><div className="mt-1 opacity-60">{item.company}</div></td><td className="p-3">{item.original_nature}<br />{item.original_role}</td><td className="max-w-64 p-3">{suggestion.decision === 'classify' ? `${suggestion.nature} / ${suggestion.role}` : suggestion.decision === 'non_it' ? '疑似非 IT 招聘' : suggestion.decision === 'insufficient' ? '证据不足，建议保留待确认' : '尚无建议'}{item.error && <p className="mt-1 text-red-500">{item.error}</p>}</td><td className="p-3">{states[item.status] || item.status}{item.retryable && <p className="mt-1 text-amber-500">已超时，可重新生成</p>}</td><td className="p-3"><div className="flex gap-3"><button className="text-blue-500" disabled={busy} onClick={() => inspect(item.id)}>查看 / 审核</button><button className="text-blue-500 disabled:opacity-40" disabled={busy || (item.status === 'generating' && !item.retryable) || item.status === 'approved'} onClick={() => generate(item.id)}>生成建议</button></div></td></tr>
    })}</tbody></table>{!data.items.length && <p className="p-8 text-center text-sm opacity-60">当前筛选无待处理岗位</p>}</div>
    <div className="flex items-center justify-end gap-3 text-xs"><span>共 {data.total || 0} 条</span><button disabled={page <= 1} onClick={() => setPage(v => v - 1)}>上一页</button><span>第 {page} 页</span><button disabled={page * 20 >= data.total} onClick={() => setPage(v => v + 1)}>下一页</button></div>
    {detail && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3"><section role="dialog" aria-modal="true" aria-label="岗位分类审核表单" className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl border p-5" style={surface}>
      <div className="mb-4 flex items-start justify-between gap-3"><h2 className="text-lg font-semibold">{detail.posting.title}</h2><button aria-label="关闭审核表单" disabled={busy} onClick={() => setDetail(null)}><X className="h-5 w-5" /></button></div>
      {message && <p role="status" className="mb-3 text-sm text-blue-500">{message}</p>}
      <div className="grid gap-5 md:grid-cols-2"><div className="space-y-3 text-xs"><p>{detail.posting.company} · {detail.posting.source}</p><a href={detail.posting.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-500">原始招聘<ExternalLink className="h-3 w-3" /></a><h3 className="font-semibold">招聘原文</h3><p className="max-h-80 overflow-y-auto whitespace-pre-wrap rounded-lg border p-3 leading-6">{detail.posting.description || '未采集到正文，仅有标题，不能凭空补充职责。'}</p><p>已有技能：{detail.skills.map((s: any) => s.name).join('、') || '无'}</p></div>
      <div className="space-y-3 text-xs"><p>状态：{states[detail.review.status || 'new']} · 版本 {detail.review.version || 0}</p><h3 className="font-semibold">Agent 建议与依据</h3><p className="leading-6">{proposal.reason || '尚未生成模型建议，也可根据原始 JD 手动审核。'}</p>{proposal.confidence !== undefined && <p>模型自报置信度：{Math.round(proposal.confidence * 100)}%（仅供参考）</p>}{proposal.quotes?.map((q, i) => <blockquote key={i} className="rounded-lg border p-2 leading-5">{q}</blockquote>)}
        <details><summary className="cursor-pointer">检索到的知识库参考</summary><p className="my-2">词表版本：{kb.registry_version || '尚未检索'} · 模型：{detail.review.model || '无'}</p><p>匹配技能：{kb.related_skills?.map((s: any) => s.name).join('、') || '无'}</p>{kb.reference_examples?.map((r: any) => <p key={r.observation_id} className="mt-2 border-t pt-2">{r.title} → {r.nature} / {r.role}<br /><span className="opacity-60">{r.excerpt}</span></p>)}</details>
        <label className="block">处理结论<select value={decision} onChange={e => setDecision(e.target.value)} className="mt-1 block w-full rounded border p-2" style={surface}><option value="classify">归入已有分类</option><option value="non_it">非 IT 招聘，审核后从就业图谱排除</option><option value="insufficient">证据不足，保留待确认</option></select></label>
        {decision === 'classify' && <><label className="block">工作性质<select aria-label="审核工作性质" value={nature} onChange={e => setNature(e.target.value)} className="mt-1 block w-full rounded border p-2" style={surface}><option value="">请选择</option>{data.natures.map((v: string) => <option key={v}>{v}</option>)}</select></label><label className="block">岗位方向<select aria-label="审核岗位方向" value={role} onChange={e => setRole(e.target.value)} className="mt-1 block w-full rounded border p-2" style={surface}><option value="">请选择</option>{data.roles.map((v: string) => <option key={v}>{v}</option>)}</select></label></>}
        <label className="block">审核说明（必填）<textarea aria-label="审核说明" value={note} onChange={e => setNote(e.target.value)} maxLength={1500} className="mt-1 block w-full rounded border p-2" style={surface} /></label>
        <div className="flex flex-wrap gap-2"><button disabled={busy || detail.review.status === 'generating' || decision === 'insufficient'} onClick={() => review('approve')} className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-white disabled:opacity-40"><Check className="h-3 w-3" />通过 / 修改后通过</button><button disabled={busy || detail.review.status === 'generating'} onClick={() => review('reject')} className="rounded-lg border px-3 py-2 disabled:opacity-40">驳回</button><button disabled={busy || detail.review.status === 'generating'} onClick={() => review('defer')} className="rounded-lg border px-3 py-2 disabled:opacity-40">保留待确认</button><button disabled={busy || detail.review.status === 'approved' || (detail.review.status === 'generating' && !detail.review.retryable)} onClick={() => generate(detail.posting.id)} className="rounded-lg border px-3 py-2 disabled:opacity-40">重新生成建议</button></div>
      </div></div>
      <details className="mt-5 text-xs"><summary className="cursor-pointer">审核与生成历史</summary>{detail.history.map((e: any) => <div key={e.id} className="mt-2 rounded-lg border p-3"><p>{e.at} · {e.action} · 操作者 {e.actor}</p><pre className="mt-2 whitespace-pre-wrap">{JSON.stringify(decode(e.content), null, 2)}</pre></div>)}</details>
    </section></div>}
    {busy && <span role="status" className="flex items-center gap-2 text-xs"><Loader2 className="h-4 w-4 animate-spin" />处理中…</span>}
  </div>
}
