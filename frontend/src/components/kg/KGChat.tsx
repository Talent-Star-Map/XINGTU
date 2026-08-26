/**
 * KGChat — 右栏智能问答(Plan-Execute-Report 多 Agent,SSE 流式)
 * 三个 Tab: 智能问答 / 决策建议 / 变化归因
 */
import { useEffect, useRef, useState } from 'react'
import { Send, Loader2, BrainCircuit, ListChecks, GitBranch } from 'lucide-react'
import { streamChat, type KgEvent, kgApi } from './api'
import ChangeExplanationCard from './ChangeExplanationCard'

type Tab = 'chat' | 'decision' | 'changes'

interface Props {
  selectedJobId?: number
  onJobPick: (jobId: number) => void
}

interface Trace {
  tool: string
  args?: any
  result?: string
}

export default function KGChat({ selectedJobId, onJobPick }: Props) {
  const [tab, setTab] = useState<Tab>('chat')
  const [input, setInput] = useState('')
  const [answer, setAnswer] = useState('')
  const [plan, setPlan] = useState<any[]>([])
  const [traces, setTraces] = useState<Trace[]>([])
  const [refs, setRefs] = useState<any[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [changes, setChanges] = useState<any[]>([])
  const [showTrace, setShowTrace] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // 切换到变化归因 tab 时,自动加载当前 Job 的变化
  useEffect(() => {
    if (tab === 'changes' && selectedJobId) {
      kgApi.jobChanges(selectedJobId).then(setChanges).catch(() => setChanges([]))
    }
  }, [tab, selectedJobId])

  // 决策建议 tab 触发一次分析
  useEffect(() => {
    if (tab === 'decision' && selectedJobId) {
      handleSend('我当前适合这个岗位吗?差距在哪?')
    } else if (tab === 'decision' && !selectedJobId) {
      setError('请先在左侧选中一个岗位')
    }
  }, [tab])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [answer, traces.length])

  const handleSend = async (msg?: string) => {
    const text = msg ?? input.trim()
    if (!text || busy) return
    setError(null)
    setAnswer('')
    setPlan([])
    setTraces([])
    setRefs([])
    setBusy(true)
    abortRef.current = new AbortController()

    try {
      streamChat(text, (ev: KgEvent) => {
        if (ev.event === 'plan_ready') {
          setPlan(ev.tasks || [])
        } else if (ev.event === 'tool_call') {
          setTraces((p) => [...p, { tool: ev.tool, args: ev.args }])
        } else if (ev.event === 'tool_result') {
          setTraces((p) => {
            const cp = [...p]
            for (let i = cp.length - 1; i >= 0; i--) {
              if (!cp[i].result) { cp[i].result = ev.result; break }
            }
            return cp
          })
        } else if (ev.event === 'report_token') {
          setAnswer((p) => p + ev.token)
        } else if (ev.event === 'report_done') {
          setRefs(ev.references || [])
          setBusy(false)
        } else if (ev.event === 'error') {
          setError(ev.message)
          setBusy(false)
        }
      }, undefined, selectedJobId, abortRef.current.signal)
      setInput('')
    } catch (e: any) {
      setError(String(e?.message || e))
      setBusy(false)
    }
  }

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: 'chat', label: '智能问答', icon: BrainCircuit },
    { key: 'decision', label: '决策建议', icon: ListChecks },
    { key: 'changes', label: '变化归因', icon: GitBranch },
  ]

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--color-surface)' }}>
      <div className="flex border-b" style={{ borderColor: 'var(--color-outline-variant)' }}>
        {tabs.map((t) => {
          const Icon = t.icon
          const active = tab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="flex-1 py-2 text-xs flex items-center justify-center gap-1.5"
              style={{
                color: active ? 'var(--color-primary)' : 'var(--color-on-surface-variant)',
                borderBottom: active ? '2px solid var(--color-primary)' : '2px solid transparent',
              }}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          )
        })}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-auto p-3 text-sm">
        {tab === 'changes' && selectedJobId ? (
          <ChangeExplanationCard changes={changes} />
        ) : tab === 'changes' && !selectedJobId ? (
          <div className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>请先在左侧选中一个岗位</div>
        ) : (
          <>
            {plan.length > 0 && (
              <div className="mb-3 p-2 rounded" style={{ background: 'var(--color-surface-container)' }}>
                <div className="text-xs font-semibold mb-1">📋 任务计划</div>
                <ol className="text-xs space-y-0.5 list-decimal list-inside">
                  {plan.map((t) => (
                    <li key={t.task_id}>
                      <span style={{ color: 'var(--color-primary)' }}>{t.tool}</span>: {t.description}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {traces.length > 0 && (
              <button
                onClick={() => setShowTrace((v) => !v)}
                className="text-xs mb-2 underline"
                style={{ color: 'var(--color-on-surface-variant)' }}
              >
                {showTrace ? '收起' : '展开'} 工具调用过程 ({traces.length})
              </button>
            )}

            {showTrace && traces.map((t, i) => (
              <div key={i} className="text-xs mb-1.5 p-1.5 rounded font-mono"
                   style={{ background: 'var(--color-surface-container)' }}>
                <div className="text-[var(--color-primary)]">→ {t.tool}</div>
                {t.result && <div className="text-[var(--color-on-surface-variant)] mt-0.5">{t.result}</div>}
              </div>
            ))}

            {error && (
              <div className="text-xs px-2 py-1.5 rounded mb-2"
                   style={{ background: 'rgba(239,68,68,0.1)', color: '#dc2626' }}>
                {error}
              </div>
            )}

            {answer && (
              <div className="whitespace-pre-wrap text-sm leading-relaxed">{answer}</div>
            )}

            {refs.length > 0 && (
              <div className="mt-3 pt-2 border-t" style={{ borderColor: 'var(--color-outline-variant)' }}>
                <div className="text-xs font-semibold mb-1">引用</div>
                <div className="flex flex-wrap gap-1">
                  {refs.map((r, i) => (
                    <button
                      key={i}
                      onClick={() => onJobPick(r.job_id)}
                      className="text-xs px-2 py-0.5 rounded"
                      style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-primary)' }}
                    >
                      #{r.job_id} {r.title}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!answer && !busy && plan.length === 0 && (
              <div className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                <p>试试问:</p>
                <ul className="mt-1 space-y-1">
                  <li>· "Java 后端薪资趋势?"</li>
                  <li>· "我适合做 AI 吗?"</li>
                  <li>· "前端必备技能搭配?"</li>
                  {selectedJobId && <li>· "这个岗位最近有什么变化?"</li>}
                </ul>
              </div>
            )}
          </>
        )}
      </div>

      <div className="border-t p-2 flex gap-2" style={{ borderColor: 'var(--color-outline-variant)' }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="向星图提问..."
          className="flex-1 px-2 py-1.5 rounded text-sm outline-none"
          style={{ background: 'var(--color-surface-container)' }}
          disabled={busy && tab === 'decision'}
        />
        <button
          onClick={() => handleSend()}
          disabled={busy || !input.trim()}
          className="px-3 py-1.5 rounded disabled:opacity-50"
          style={{ background: 'var(--color-primary)', color: 'var(--color-on-primary)' }}
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )
}