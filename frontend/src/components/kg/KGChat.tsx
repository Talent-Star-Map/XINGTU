import { useEffect, useRef, useState } from 'react'
import { Send, Loader2, BrainCircuit, Plus, Square, Copy, RotateCcw, ArrowUpRight, Sparkles } from 'lucide-react'
import { streamChat, type KgEvent, kgApi } from './api'
import ChangeExplanationCard from './ChangeExplanationCard'

type Tab = 'chat' | 'decision' | 'changes'
type Turn = { id: number; question: string; answer: string; status: 'running' | 'done' | 'error' | 'stopped'; refs: any[]; tasks: any[]; phase: string; error?: string; profileStatus?: 'ready' | 'empty' | 'unavailable' }
interface Props { selectedJobId?: number; onJobPick: (id: number) => void; active?: boolean }
const card = { background: 'var(--color-surface-container-lowest)', borderColor: 'var(--color-outline-variant)' }
const muted = { color: 'var(--color-on-surface-variant)' }
function safeUrl(raw: unknown) { try { const u = new URL(String(raw)); return ['http:', 'https:'].includes(u.protocol) ? u.href : null } catch { return null } }
function AnswerText({ text }: { text: string }) {
  return <div className="space-y-2 text-sm leading-7 break-words">{text.split('\n').map((line, i) => <p key={i} className={/^#{1,4}\s/.test(line) ? 'font-semibold mt-4' : ''}>{line.replace(/^#{1,4}\s/, '').split(/(\*\*[^*]+\*\*)/g).map((part, j) => part.startsWith('**') && part.endsWith('**') ? <strong key={j}>{part.slice(2, -2)}</strong> : part)}</p>)}</div>
}
export default function KGChat({ selectedJobId, onJobPick, active = true }: Props) {
  const [tab, setTab] = useState<Tab>('chat'), [input, setInput] = useState('')
  const [threads, setThreads] = useState<{ chat: Turn[]; decision: Turn[] }>({ chat: [], decision: [] })
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState(''), [copied, setCopied] = useState<number | null>(null)
  const [changes, setChanges] = useState<any[]>([]), [changeState, setChangeState] = useState('idle'), [reload, setReload] = useState(0)
  const abort = useRef<AbortController | null>(null), scroll = useRef<HTMLDivElement>(null), follow = useRef(true), nextId = useRef(0)
  const shown = tab === 'changes' ? [] : threads[tab]
  const stop = () => {
    abort.current?.abort(); abort.current = null; setBusy(false)
    const stopped = (items: Turn[]) => items.map(t => t.status === 'running' ? { ...t, status: 'stopped' as const } : t)
    setThreads(old => ({ chat: stopped(old.chat), decision: stopped(old.decision) }))
  }
  useEffect(() => () => abort.current?.abort(), [])
  useEffect(() => { abort.current?.abort(); abort.current = null; setBusy(false); setThreads({ chat: [], decision: [] }); setChanges([]); setNotice(''); setChangeState('idle'); follow.current = true }, [selectedJobId])
  useEffect(() => {
    if (tab !== 'changes' || !selectedJobId || !active) return
    let current = true; setChangeState('loading'); setChanges([])
    kgApi.jobChanges(selectedJobId).then(data => { if (current) { setChanges(data); setChangeState('ready') } }).catch(() => { if (current) setChangeState('error') })
    return () => { current = false }
  }, [tab, selectedJobId, active, reload])
  useEffect(() => { if (follow.current && scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight }, [threads, busy, tab])
  const send = async (question = input.trim()) => {
    if (!question || busy || abort.current || tab === 'changes') return
    const channel = tab, id = ++nextId.current, controller = new AbortController()
    const history = threads[channel].filter(t => t.status === 'done').flatMap(t => [{ role: 'user', content: t.question.slice(0, 4000) }, { role: 'assistant', content: t.answer.slice(0, 4000) }]).slice(-12)
    abort.current = controller; setBusy(true); setNotice(''); setInput(''); follow.current = true
    setThreads(old => ({ ...old, [channel]: [...old[channel], { id, question, answer: '', status: 'running', refs: [], tasks: [], phase: '正在理解问题' }] }))
    const update = (change: Partial<Turn> | ((t: Turn) => Partial<Turn>)) => {
      if (abort.current !== controller) return
      setThreads(old => ({ ...old, [channel]: old[channel].map(t => t.id === id ? { ...t, ...(typeof change === 'function' ? change(t) : change) } : t) }))
    }
    try {
      await streamChat(question, (e: KgEvent) => {
        if (e.event === 'profile_ready') update({ profileStatus: e.status })
        if (e.event === 'plan_ready') update({ tasks: e.tasks || [], phase: (e.tasks || []).length ? '正在检索相关资料' : '正在组织回答' })
        if (e.event === 'tool_call') update({ phase: '正在核对岗位与技能信息' })
        if (e.event === 'tool_result') update({ phase: '正在整理证据' })
        if (e.event === 'report_token') update(t => ({ answer: t.answer + e.token, phase: '正在生成回答' }))
        if (e.event === 'report_done') update(t => ({ answer: e.answer || t.answer, refs: e.references || [], status: (e.answer || t.answer).trim() ? 'done' : 'error', error: (e.answer || t.answer).trim() ? undefined : '没有生成有效回答，请重试' }))
        if (e.event === 'error') update({ status: 'error', error: e.message || '回答生成失败，请重试' })
      }, history, selectedJobId, controller.signal)
    } catch (e: any) { if (!controller.signal.aborted) update({ status: 'error', error: e.message || '连接中断，请重试' }) }
    finally { if (abort.current === controller) { abort.current = null; setBusy(false) } }
  }
  const copy = async (t: Turn) => { try { await navigator.clipboard.writeText(t.answer); setCopied(t.id); window.setTimeout(() => setCopied(null), 1800) } catch { setNotice('复制未成功，可选择回答文本复制') } }
  const prompts = tab === 'decision' ? ['我目前的技能与这个岗位有什么差距？', '优先补齐哪些技能，如何安排学习？'] : selectedJobId ? ['介绍这个岗位的职责和核心技能', '这些技能要求有哪些原文依据？', '同一招聘信息最近有什么变化？'] : ['Python 后端岗位需要哪些核心技能？', 'Java 和 Python 岗位的技能要求有哪些区别？', '如何根据简历确定下一步学习重点？']
  return <div className="flex min-h-0 h-full flex-col" style={{ background: 'var(--color-surface)' }}>
    <div className="flex shrink-0 items-center gap-1 border-b px-2 sm:px-4" style={{ borderColor: 'var(--color-outline-variant)' }}>{([['chat', '智能问答'], ['decision', '求职建议'], ['changes', '岗位变化']] as const).map(([key, name]) => <button key={key} onClick={() => { stop(); setTab(key); setNotice('') }} className={`px-3 sm:px-4 py-4 text-xs sm:text-sm border-b-2 ${tab === key ? 'text-blue-600 border-blue-500' : 'border-transparent'}`}>{name}</button>)}<button aria-label="新对话" onClick={() => { stop(); setThreads({ chat: [], decision: [] }); setInput(''); setNotice('已开启新对话') }} className="ml-auto flex items-center gap-1 px-2 py-2 text-xs"><Plus className="h-4 w-4" /><span className="hidden sm:inline">新对话</span></button></div>
    <div ref={scroll} aria-label="问答记录" onScroll={() => { const el = scroll.current; if (el) follow.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100 }} className="min-h-0 flex-1 overflow-auto px-4 py-5 sm:px-7">
      {notice && <p role="status" className="text-center text-xs mb-4" style={muted}>{notice}</p>}
      {tab === 'changes' ? !selectedJobId ? <p className="py-10 text-sm text-center" style={muted}>先选择一个岗位，查看有来源支持的前后变化。</p> : changeState === 'loading' ? <p role="status" className="text-sm">正在读取岗位变化…</p> : changeState === 'error' ? <p role="alert" className="text-sm text-red-600">岗位变化读取失败。<button onClick={() => setReload(v => v + 1)} className="ml-2 underline">重新加载</button></p> : <><p className="text-xs mb-4" style={muted}>仅展示可核查的记录差异。未提及某项技能不等于不再需要；没有原因证据时，不推断变化原因。</p><ChangeExplanationCard changes={changes} /></> : <>
        {!shown.length && <div className="mx-auto max-w-2xl py-6 sm:py-10"><div className="inline-flex rounded-2xl bg-blue-50 p-3 text-blue-600 mb-4"><Sparkles className="w-6 h-6" /></div><h2 className="text-xl sm:text-2xl font-semibold mb-3">{tab === 'decision' ? '把岗位要求变成可执行的下一步' : '从一个问题开始，理清你的求职方向'}</h2><p className="text-sm leading-6 mb-6" style={muted}>围绕岗位、技能与已记录变化连续追问，回答下方可查看检索到的来源。</p>{tab === 'decision' && !selectedJobId ? <p className="text-sm border rounded-xl p-4" style={card}>请先使用上方“选择岗位”关联目标岗位。</p> : <div className="grid gap-2">{prompts.map(text => <button key={text} onClick={() => send(text)} className="text-left text-sm border rounded-xl px-4 py-3 hover:border-blue-400 flex justify-between gap-3" style={card}>{text}<ArrowUpRight className="w-4 h-4 shrink-0 text-blue-500" /></button>)}</div>}</div>}
        <div className="space-y-6">{shown.map(t => <article key={t.id} aria-label={`问题：${t.question}`}><div className="flex justify-end mb-4"><p className="max-w-[90%] whitespace-pre-wrap break-words rounded-2xl rounded-tr-sm bg-blue-600 text-white px-4 py-3 text-sm leading-6">{t.question}</p></div><div className="flex gap-3"><div className="mt-1 rounded-lg bg-blue-50 p-1.5 h-fit text-blue-600"><BrainCircuit className="w-4 h-4" /></div><div className="min-w-0 flex-1">
          {t.profileStatus && <p className="text-xs mb-2" style={muted}>{t.profileStatus === 'ready' ? '已读取个人资料，结合问题提供建议' : t.profileStatus === 'empty' ? '个人资料待完善，当前为通用建议' : '个人资料读取失败，当前为通用建议'}</p>}
          {t.answer && <AnswerText text={t.answer} />}{t.status === 'running' && <p role="status" className="flex gap-2 items-center text-xs mt-3" style={muted}><Loader2 className="w-3.5 h-3.5 animate-spin" />{t.phase}</p>}{t.status === 'stopped' && <p className="text-xs mt-3" style={muted}>已停止生成，收到的内容已保留</p>}{t.error && <p role="alert" className="text-xs rounded-lg bg-red-50 text-red-600 p-3 mt-3">{t.error}</p>}
          {!!t.refs.length && <details className="border rounded-xl p-3 mt-4" style={card}><summary className="text-xs font-medium cursor-pointer">参考资料 · {t.refs.length} 条</summary><div className="mt-2 space-y-2">{t.refs.map((r, i) => <div key={i} className="text-xs border-t pt-2" style={{ borderColor: 'var(--color-outline-variant)' }}><button onClick={() => r.job_id && onJobPick(r.job_id)} className="font-semibold text-blue-600 text-left">{r.title || `岗位 #${r.job_id}`}</button><p className="mt-1 opacity-60">{[r.source, r.captured_at ? `观测：${String(r.captured_at).slice(0, 10)}` : null, r.snapshot_id ? `快照：${r.snapshot_id}` : null].filter(Boolean).join(' · ') || '当前岗位记录，未提供完整来源信息'}</p>{safeUrl(r.source_url) && <a href={safeUrl(r.source_url)!} target="_blank" rel="noreferrer" className="inline-flex gap-1 items-center text-blue-600 mt-1">查看原始来源<ArrowUpRight className="w-3 h-3" /></a>}</div>)}</div></details>}
          {t.status === 'done' && !t.refs.length && <p className="text-xs mt-3 leading-5" style={muted}>本次回答未附可核查的岗位来源，具体招聘要求请进一步选择岗位核对。</p>}
          {!!t.tasks.length && <details className="text-xs mt-3" style={muted}><summary className="cursor-pointer">查看检索过程 · {t.tasks.length} 步</summary><ol className="ml-4 list-decimal mt-2 space-y-1">{t.tasks.map((task, i) => <li key={task.task_id || i}>{task.description || '查询相关资料'}</li>)}</ol></details>}
          {t.status !== 'running' && <div className="flex gap-4 mt-3 text-xs" style={muted}>{t.answer && <button onClick={() => copy(t)} className="inline-flex gap-1 items-center"><Copy className="w-3.5 h-3.5" />{copied === t.id ? '已复制' : '复制回答'}</button>}<button disabled={busy} onClick={() => send(t.question)} className="inline-flex gap-1 items-center disabled:opacity-40"><RotateCcw className="w-3.5 h-3.5" />{t.status === 'done' ? '重新回答' : '重试'}</button></div>}
        </div></div></article>)}</div>
      </>}
    </div>
    {tab !== 'changes' && <div className="shrink-0 border-t px-3 pt-3 pb-2 sm:px-5" style={{ borderColor: 'var(--color-outline-variant)' }}><div className="flex items-end gap-2 border rounded-xl p-2" style={card}><textarea value={input} onChange={e => setInput(e.target.value)} maxLength={2000} rows={2} aria-label="向星图提问" onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); if (!busy) send() } }} placeholder={shown.length ? '继续追问，例如：为什么推荐这些技能？' : '输入你想了解的岗位或技能问题…'} disabled={tab === 'decision' && !selectedJobId} className="min-w-0 flex-1 resize-none bg-transparent outline-none px-2 py-1 text-sm leading-6 disabled:opacity-50" />{busy ? <button aria-label="停止生成" onClick={stop} className="rounded-lg bg-slate-800 text-white p-3"><Square className="w-4 h-4" /></button> : <button aria-label="发送消息" onClick={() => send()} disabled={!input.trim() || (tab === 'decision' && !selectedJobId)} className="rounded-lg bg-blue-600 text-white p-3 disabled:opacity-40"><Send className="w-4 h-4" /></button>}</div><p className="mt-2 text-[10px] flex justify-between gap-2" style={muted}><span>Enter 发送 · Shift+Enter 换行 · 对话仅保留在页面内存中</span><span>{input.length}/2000</span></p></div>}
  </div>
}
