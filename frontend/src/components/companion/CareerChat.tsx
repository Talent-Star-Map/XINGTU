import CareerMemoryFact from './CareerMemoryFact'
import { useEffect, useRef, useState } from 'react'
import { careerApi, careerTurn, careerThreadKey, initializeCareer, type CareerEvent, type CareerThread } from '../../lib/careerApi'
import { petAsset } from '../../lib/companion'
import { kgApi, type ChatAttachment } from '../kg/api'

type Message = { id: string; role: string; content: string; metadata?: { run_id?: string; events?: CareerEvent[] } }
export default function CareerChat({ compact = false, active = true }: { compact?: boolean; active?: boolean }) {
  const [threads, setThreads] = useState<CareerThread[]>([]), [tid, setTid] = useState('')
  const [messages, setMessages] = useState<Message[]>([]), [input, setInput] = useState('')
  const [events, setEvents] = useState<CareerEvent[]>([]), [busy, setBusy] = useState(false)
  const [error, setError] = useState(''), [status, setStatus] = useState(''), [memory, setMemory] = useState<any[] | null>(null)
  const [remember, setRemember] = useState(true), [github, setGithub] = useState('')
  const [attachments,setAttachments]=useState<ChatAttachment[]>([]), [uploading,setUploading]=useState(false)
  const fileInput=useRef<HTMLInputElement>(null), uploadLock=useRef(false)
  const abort = useRef<AbortController | null>(null), generation = useRef(0), actor = useRef('')
  const bottom = useRef<HTMLDivElement>(null)
  const polling = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function followRun(id: string, seq: number) {
    try {
      const run=await careerApi(`/threads/${id}/run`)
      if (seq!==generation.current || actor.current!==localStorage.getItem('xingtu_token') || !run) return
      if (['pending','running','reviewing'].includes(run.status)) {
        setBusy(true); setEvents(run.events || [])
        const latest=(run.events || []).filter((e: CareerEvent)=>e.event==='status').at(-1)
        setStatus(latest?.message || '正在恢复小星的任务进度…')
        polling.current=setTimeout(()=>void followRun(id,seq),1200)
      } else {
        setBusy(false);setStatus('')
        if (run.status==='ready') setEvents(run.events || [])
        else {
          const rows=await careerApi(`/threads/${id}/messages`)
          if (seq===generation.current) {
            setMessages(rows)
            setEvents(rows.some((m: Message)=>m.role==='assistant' && m.metadata?.run_id===run.id)?[]:(run.events || []).filter((e: CareerEvent)=>e.event!=='status'))
          }
        }
      }
    } catch (e) { if (seq===generation.current) {setBusy(false);setError((e as Error).message)} }
  }

  async function select(id: string) {
    const seq = ++generation.current
    if (polling.current) clearTimeout(polling.current)
    abort.current?.abort(); abort.current = null; setBusy(false); setEvents([]); setError(''); setStatus('')
    setTid(id); setMemory(null); setMessages([]); setAttachments([]); localStorage.setItem(careerThreadKey(), id)
    try {
      const data = await careerApi(`/threads/${id}/messages`)
      if (generation.current === seq) {
        setMessages(data)
        const detail=await careerApi(`/threads/${id}`)
        if (generation.current===seq) {setRemember(detail.metadata?.memory_enabled!==false); void followRun(id,seq)}
      }
    } catch (e) { if (generation.current === seq) { setMessages([]); setError(String((e as Error).message)) } }
  }
  async function refresh() {
    const current = localStorage.getItem('xingtu_token') || ''
    actor.current = current
    try {
      const list = await initializeCareer()
      if (actor.current !== current || localStorage.getItem('xingtu_token') !== current) return
      setThreads(list)
      const selected = localStorage.getItem(careerThreadKey())
      const thread = list.find((t: CareerThread) => t.id === selected) || list[0] || await careerApi('/threads', 'POST')
      if (actor.current !== current || localStorage.getItem('xingtu_token') !== current) return
      setRemember(thread.metadata?.memory_enabled !== false)
      await select(thread.id)
    } catch (e) { if (actor.current === current) setError((e as Error).message) }
  }
  useEffect(() => {
    if (!active) return
    void refresh()
    const checkActor = () => {
      if (actor.current !== (localStorage.getItem('xingtu_token') || '')) {
        ++generation.current; abort.current?.abort(); setMessages([]); setEvents([]); setMemory(null); setTid(''); void refresh()
      }
    }
    window.addEventListener('storage', checkActor)
    const timer = window.setInterval(checkActor, 1500)
    return () => { ++generation.current; abort.current?.abort(); if(polling.current)clearTimeout(polling.current); window.removeEventListener('storage', checkActor); window.clearInterval(timer) }
  }, [active])
  useEffect(() => { bottom.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }) }, [events, messages, status])

  async function uploadFiles(files: FileList | null) {
    if (!files?.length || uploadLock.current) return
    const batch=Array.from(files)
    if (attachments.length+batch.length>4 || batch.some(file=>file.size>10*1024*1024)) {setError('最多添加4个材料，每个不能超过10MB');return}
    const seq=generation.current, auth=actor.current
    uploadLock.current=true;setUploading(true);setError('')
    try {
      for (const file of batch) {
        const saved=await kgApi.uploadAttachment(file)
        if (seq===generation.current && auth===localStorage.getItem('xingtu_token')) setAttachments(old=>[...old,saved])
        else {void kgApi.removeAttachment(saved.id).catch(()=>{});break}
      }
    } catch(e) {if(seq===generation.current)setError((e as Error).message)}
    finally {uploadLock.current=false;setUploading(false);if(fileInput.current)fileInput.current.value=''}
  }
  async function send(text = input, jobKey?: string) {
    if (!tid || busy || uploadLock.current || !text.trim()) return
    const seq = generation.current, auth = actor.current, controller = new AbortController()
    abort.current = controller; setBusy(true); setError(''); setEvents([]); setStatus('小星正在整理任务…'); setInput('')
    const repo=github.trim();setGithub('')
    setMessages(old => [...old, { id: crypto.randomUUID(), role: 'user', content: text }])
    try {
      await careerTurn(tid, { message: text, request_id: crypto.randomUUID(), attachment_ids:attachments.map(item=>item.id), ...(jobKey ? { source_job_key: jobKey } : {}), ...(repo ? { github_url: repo } : {}) }, event => {
        if (generation.current !== seq || auth !== localStorage.getItem('xingtu_token')) return
        if (event.event === 'status') setStatus(event.message)
        else if (event.event === 'error') setError(event.message)
        else if (event.event !== 'run') setEvents(old => [...old, event])
      }, controller.signal)
    } catch (e) {
      if (!controller.signal.aborted && generation.current === seq) setError((e as Error).message)
    } finally {
      if (generation.current === seq) {
        abort.current = null; setBusy(false); setStatus('')
        try { const rows = await careerApi(`/threads/${tid}/messages`); if (generation.current === seq) { setMessages(rows); void followRun(tid,seq) } } catch { /* current response remains visible */ }
      }
    }
  }
  async function loadMemory() { try { setMemory(await careerApi('/memory')) } catch (e) { setError((e as Error).message) } }
  function renderEvents(items: CareerEvent[]) { return items.map((e, i) => {
    if (e.event === 'answer') return <p key={i} className="whitespace-pre-wrap text-sm leading-7">{e.answer}</p>
    if (e.event === 'jobs') return <div key={i} className="grid gap-3">{e.jobs.map((j: any) => <article key={j.job_key} className="rounded-xl border p-3" style={{ borderColor: 'var(--color-outline-variant)' }}>
      <strong>{j.title}</strong><p className="text-sm">{j.company}　{j.location}　{j.salary}</p>
      <p className="mt-1 text-xs opacity-70">{j.recommendation_basis}</p><p className="text-xs opacity-70">来源：{j.source || '未记录'}　采集：{j.collected_at || '未记录'}　{j.status_label}</p>
      {typeof j.fit_score==='number' && <p className="my-1 text-xs opacity-70">岗位适配参考：{j.fit_score} 分（非录用概率）{j.missing_information?.length?'，部分个人信息未填写':''}{j.skill_gaps?.length?`。待补齐：${j.skill_gaps.join('、')}`:''}</p>}
      <div className="mt-2 flex flex-wrap gap-3 text-sm"><button disabled={busy} className="text-blue-600 disabled:opacity-40" onClick={() => send('请针对这个岗位制作简历', j.job_key)}>为此岗位制作简历</button>
      {j.source_url?.startsWith('https://') && <a href={j.source_url} target="_blank" rel="noreferrer">查看原始招聘</a>}</div>
    </article>)}</div>
    if (e.event === 'questions') return <div key={i} className="rounded-xl border border-amber-300 p-3 text-sm"><strong>需要你确认</strong>{e.questions.map((q: any) => <p key={q.id} className="mt-2">{q.question}</p>)}<button className="mt-2 text-blue-600" onClick={loadMemory}>打开个人记忆核对</button></div>
    if (e.event === 'resume_ready') return <article key={i} className="rounded-xl border border-emerald-400 p-4"><strong>{e.title}</strong><p className="my-2 text-sm">已保存至简历中心，可以修改和导出。</p><a className="text-blue-600" href={e.url}>打开这份简历 →</a></article>
    if (e.event === 'memory_candidates') return <div key={i} className="my-3 text-sm"><p>已整理出 {e.facts?.length || 0} 条待确认资料，确认后才能用于简历。</p><button onClick={loadMemory} className="text-blue-600">核对个人记忆</button></div>
    if (e.event === 'error') return <p key={i} role="alert" className="my-2 text-sm text-red-600">{e.message}</p>
    if (e.event === 'repository_evidence') return <div key={i} className="my-3 rounded border p-3 text-sm"><strong>项目实现依据：{e.repository}</strong><p className="my-1 text-xs opacity-70">仅读取部分文件，未执行测试。以下不代表你本人完成，需确认个人贡献。</p>{e.findings.map((f:any,j:number)=><div key={j} className="my-2"><p>{f.description}</p><blockquote className="break-words border-l-2 pl-2 text-xs opacity-70">{f.quote}</blockquote><a className="text-blue-600" href={f.url} target="_blank" rel="noreferrer">查看 {f.path}</a></div>)}</div>
    return null
  }) }
  return <section className="flex h-full min-h-0 flex-col" style={{ color: 'var(--color-on-surface)' }}>
    <header className="flex flex-wrap items-center gap-2 border-b p-3" style={{ borderColor: 'var(--color-outline-variant)' }}>
      <span className="xiaogui-portrait h-10 w-10"><img src={petAsset('idle')} alt="小星" /></span><div><strong>{compact ? '小星' : '智能助手'}</strong>{!compact && <p className="text-xs opacity-65">小星陪你了解岗位、规划求职、定制简历</p>}</div>
      {!compact && <select aria-label="选择对话" value={tid} className="min-w-0 max-w-44 rounded border bg-transparent p-1 text-sm" onChange={e => { void select(e.target.value) }}>{threads.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}</select>}
      <button className="ml-auto text-sm text-blue-600" disabled={busy} onClick={async () => { try { const t = await careerApi('/threads','POST'); setThreads(old => [t,...old]); await select(t.id) } catch (e) { setError((e as Error).message) } }}>新对话</button>
      <button className="text-sm text-blue-600" onClick={loadMemory}>个人记忆</button>
      {compact && <a href="#/ai-chat" className="text-sm text-blue-600">展开</a>}
    </header>
    <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
      {!messages.length && !busy && <div className="mx-auto max-w-3xl py-6 sm:py-12"><span className="xiaogui-portrait mb-4 inline-flex h-20 w-20"><img src={petAsset('idle')} alt="小星" /></span><h2 className="text-xl font-semibold">你好，我是小星，你的智能求职助手</h2><p className="mt-3 text-sm leading-7 opacity-75">岗位技能、求职建议、岗位变化都可以问我。我也能帮你查找真实岗位，结合个人资料定制简历；不确定的信息会先和你确认。</p><div className="mt-6 grid gap-3 sm:grid-cols-2">{['Python 后端岗位需要哪些核心技能？','近期岗位的技能要求有哪些变化？','帮我找适合我的真实岗位','根据目标岗位帮我制作一份简历'].map(question=><button key={question} disabled={!tid} onClick={()=>void send(question)} className="rounded-xl border p-4 text-left text-sm transition-colors hover:bg-blue-50/40 disabled:opacity-50" style={{borderColor:'var(--color-outline-variant)'}}>{question}<span className="float-right ml-2 text-blue-600" aria-hidden="true">↗</span></button>)}</div></div>}
      {messages.map(m => <article key={m.id} className="mb-5"><div className="flex items-center gap-2">{m.role !== 'user' && <span className="xiaogui-portrait h-8 w-8"><img src={petAsset('idle')} alt="" /></span>}<strong className="text-sm">{m.role === 'user' ? '你' : '小星'}</strong></div><p className="mt-2 whitespace-pre-wrap text-sm leading-7">{m.content}</p>{m.metadata?.events && renderEvents(m.metadata.events)}</article>)}
      {renderEvents(events)}{status && <p role="status" className="my-3 text-sm text-blue-600">{status}</p>}
      {error && <p role="alert" className="my-3 rounded border border-red-300 p-3 text-sm text-red-600">{error}</p>}
      <div ref={bottom} />
    </div>
    {memory !== null && <aside className="max-h-72 overflow-y-auto border-t p-3" aria-label="个人记忆" style={{ borderColor: 'var(--color-outline-variant)' }}><div className="flex items-center justify-between"><strong>个人记忆</strong><button onClick={() => setMemory(null)}>关闭</button></div>
      <label className="my-2 flex gap-2 text-sm"><input type="checkbox" checked={remember} onChange={async e => { const next=e.target.checked; try { await careerApi(`/threads/${tid}`,'PATCH',{memory_enabled:next}); setRemember(next) } catch (e) { setError((e as Error).message) } }} />从本次对话提取待确认记忆</label>
      <p className="text-xs opacity-70">只有你确认过的聊天资料才用于简历。关闭提取不会删除已有记忆。</p>
      {memory.map(f => <CareerMemoryFact key={f.id} fact={f} onUpdate={loadMemory} onError={setError}/>)}
    </aside>}
    <form className="border-t p-3" style={{ borderColor: 'var(--color-outline-variant)' }} onSubmit={e => { e.preventDefault(); void send() }}>
      <input ref={fileInput} type="file" multiple className="hidden" accept=".pdf,.docx,.txt,.md,.png,.jpg,.jpeg,.webp" onChange={e=>void uploadFiles(e.target.files)} />
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs"><button type="button" disabled={busy||uploading} onClick={()=>fileInput.current?.click()} className="rounded border px-3 py-2 disabled:opacity-40">{uploading?'正在上传…':'添加文档 / 图片'}</button><span className="opacity-60">最多4个，每个10MB，材料1小时内有效</span>{attachments.map(item=><span key={item.id} className="rounded border px-2 py-1">{item.name}<button type="button" disabled={busy} aria-label={`移除${item.name}`} className="ml-2" onClick={()=>{setAttachments(old=>old.filter(value=>value.id!==item.id));void kgApi.removeAttachment(item.id).catch(()=>{})}}>×</button></span>)}</div>
      {!compact && <input value={github} onChange={e => setGithub(e.target.value)} placeholder="可选：GitHub 公开仓库链接（只读，不执行代码）" aria-label="GitHub 仓库" className="mb-2 w-full rounded border bg-transparent px-3 py-2 text-xs" />}
      <div className="flex gap-2"><textarea value={input} onChange={e => setInput(e.target.value)} maxLength={4000} rows={2} aria-label="和小星对话" placeholder="问小星岗位、技能或求职问题，也可以让我为目标岗位制作简历…" className="min-w-0 flex-1 resize-none rounded border bg-transparent p-2 text-sm" /><button disabled={busy || !input.trim() || !tid} className="rounded-lg bg-blue-600 px-4 text-sm text-white disabled:opacity-40">{busy ? '处理中' : '发送'}</button></div>
      <p className="mt-1 text-[11px] opacity-60">对话保存在当前账号中。简历创建前必须经过证据核对。</p>
    </form>
  </section>
}
