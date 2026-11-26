import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Send, Square, RotateCcw } from 'lucide-react'

type Message = { id: number; role: 'user' | 'assistant'; text: string; failed?: boolean }
const greeting: Message = { id: 0, role: 'assistant', text: '你好，我是小星 ✦\n想聊聊技能学习、简历或面试？我陪你一起想办法。' }

export default function CompanionGeneralChat({ active }: { active: boolean }) {
  const [messages, setMessages] = useState<Message[]>([greeting])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [authenticated] = useState(() => Boolean(localStorage.getItem('xingtu_token')))
  const request = useRef<AbortController | null>(null)
  const messageId = useRef(0)
  const transcript = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLTextAreaElement>(null)

  useEffect(() => () => request.current?.abort(), [])
  useEffect(() => {
    if (transcript.current) transcript.current.scrollTop = transcript.current.scrollHeight
  }, [messages, sending, active])
  useEffect(() => { if (active && authenticated) input.current?.focus() }, [active, authenticated])

  const send = async (text: string, retryId?: number) => {
    text = text.trim()
    if (!text || request.current || !authenticated || text.length > 2000) return
    const token = localStorage.getItem('xingtu_token')
    if (!token) { setError('请先登录，再来找小星聊天。'); return }
    const controller = new AbortController()
    request.current = controller
    const id = retryId ?? ++messageId.current
    // A retry must not duplicate its failed user message in model history.
    const history = messages.filter(m => m.id !== 0 && !m.failed && m.id !== retryId)
      .slice(-6).map(m => ({ role: m.role, content: m.text }))
    setMessages(previous => retryId === undefined
      ? [...previous, { id, role: 'user', text }]
      : previous.map(m => m.id === retryId ? { ...m, failed: false } : m))
    if (retryId === undefined) setDraft('')
    setSending(true)
    setError('')
    let timedOut = false
    const timeout = window.setTimeout(() => { timedOut = true; controller.abort() }, 40000)
    try {
      const response = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: text, history }), cache: 'no-store', signal: controller.signal,
      })
      if (response.status === 401) throw new Error('登录已过期，请重新登录后再聊。')
      if (response.status === 403) throw new Error('当前账号暂时无法使用聊天功能。')
      if (response.status === 429) throw new Error('消息发送有些频繁，稍等一下再试。')
      if (!response.ok) throw new Error('AI 服务暂时不可用，请稍后重试。')
      const data = await response.json()
      if (typeof data.answer !== 'string' || !data.answer.trim()) throw new Error('没有收到有效回答，请重试。')
      // Logout or account switching must never surface another user's answer.
      if (controller.signal.aborted || localStorage.getItem('xingtu_token') !== token) return
      setMessages(previous => [...previous, { id: ++messageId.current, role: 'assistant', text: data.answer.trim() }])
    } catch (cause) {
      if (localStorage.getItem('xingtu_token') !== token) return
      const message = controller.signal.aborted
        ? (timedOut ? '等待回答超时了，可以再试一次。' : '已停止本次回答。')
        : cause instanceof Error && !['TypeError', 'SyntaxError'].includes(cause.name)
          ? cause.message : '连接没有成功，请检查网络后重试。'
      setError(message)
      setMessages(previous => previous.map(m => m.id === id ? { ...m, failed: true } : m))
    } finally {
      window.clearTimeout(timeout)
      if (request.current === controller) { request.current = null; setSending(false) }
    }
  }

  const submit = (event: FormEvent) => { event.preventDefault(); void send(draft) }
  return <div className="xiaogui-chat">
    <div ref={transcript} className="xiaogui-chat-messages" role="log" aria-label="与小星的聊天记录" aria-live="polite" aria-relevant="additions">
      {messages.map(message => <div key={message.id} className={`xiaogui-chat-message ${message.role}${message.failed ? ' failed' : ''}`}>
        <span className="xiaogui-chat-author">{message.role === 'assistant' ? '小星' : '你'}</span>
        <div>{message.text}</div>
        {message.failed && <button type="button" disabled={sending} onClick={() => void send(message.text, message.id)}><RotateCcw size={12} />重新发送</button>}
      </div>)}
      {sending && <div className="xiaogui-chat-thinking" role="status">小星正在认真想<span>…</span></div>}
    </div>
    {!authenticated && <p className="xiaogui-chat-notice">登录星图后，就可以和小星聊天啦。</p>}
    {error && <p className="xiaogui-chat-error" role="alert">{error}</p>}
    <form onSubmit={submit} className="xiaogui-chat-form">
      <label className="xiaogui-live" htmlFor="xiaogui-chat-input">想对小星说的话</label>
      <textarea id="xiaogui-chat-input" ref={input} value={draft} onChange={event => setDraft(event.target.value)} maxLength={2000} rows={2} disabled={!authenticated}
        placeholder={authenticated ? '和小星聊聊…' : '登录后开启聊天'}
        onKeyDown={event => {
          if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) { event.preventDefault(); void send(draft) }
        }} />
      {sending ? <button type="button" className="xiaogui-chat-send" aria-label="停止回答" onClick={() => request.current?.abort()}><Square size={16} /></button>
        : <button type="submit" className="xiaogui-chat-send" disabled={!authenticated || !draft.trim()} aria-label="发送消息"><Send size={18} /></button>}
    </form>
    <div className="xiaogui-chat-hint">Enter 发送 · Shift + Enter 换行 · AI 回答仅供参考</div>
  </div>
}
