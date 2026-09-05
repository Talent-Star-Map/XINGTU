import { useState, useEffect, useRef } from 'react'
import { X, Send, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface Message {
  id: number
  sender_type: string
  sender_id: number
  content: string
  is_read: number
  created_at: string
}

interface Candidate {
  id: number
  name: string
  job_title: string
  match: number | null
}

interface ChatDialogProps {
  open: boolean
  onClose: () => void
  matchRecordId: number
  candidate: Candidate
  /** 谁在用这个弹窗：enterprise（默认，TalentSearch/消息页）或 jobseeker（求职端消息页） */
  role?: 'enterprise' | 'jobseeker'
}

export default function ChatDialog({ open, onClose, matchRecordId, candidate, role = 'enterprise' }: ChatDialogProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const apiBase = role === 'jobseeker' ? '/api/jobseeker' : '/api/enterprise'

  // 求职者端接口需要带自己的 id 做会话归属校验
  const seekerId = (() => {
    if (role !== 'jobseeker') return null
    try {
      const u = JSON.parse(localStorage.getItem('xingtu_user') || 'null')
      return u?.id ?? null
    } catch { return null }
  })()

  // 加载消息历史
  const loadMessages = async () => {
    setLoading(true)
    try {
      const qs = role === 'jobseeker' ? `?size=100&jobseeker_id=${seekerId}` : '?size=100'
      const r = await fetch(`${apiBase}/messages/${matchRecordId}${qs}`)
      const d = await r.json()
      if (d.success && d.data) {
        setMessages(d.data.messages)
      }
    } catch {
      // 忽略加载错误
    } finally {
      setLoading(false)
    }
  }

  // 打开时加载消息
  useEffect(() => {
    if (open) {
      loadMessages()
      setInput('')
      // 标记已读 — 完成后广播事件，导航栏/列表的红点立即刷新（否则要等轮询）
      const readQs = role === 'jobseeker'
        ? `?match_record_id=${matchRecordId}&jobseeker_id=${seekerId}`
        : `?match_record_id=${matchRecordId}`
      fetch(`${apiBase}/messages/read${readQs}`, { method: 'POST' })
        .then(() => window.dispatchEvent(new Event('xingtu:msg-read')))
        .catch(() => {})
    }
  }, [open, matchRecordId])

  // 新消息自动滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // 发送消息
  const handleSend = async () => {
    const text = input.trim()
    if (!text || sending) return

    setSending(true)
    setInput('')
    try {
      // 求职端与企业端统一 POST /messages（路径带 {id} 会抢走 /messages/read 的匹配）
      const url = `${apiBase}/messages`
      const body = role === 'jobseeker'
        ? { match_record_id: matchRecordId, jobseeker_id: seekerId, content: text }
        : { match_record_id: matchRecordId, content: text }
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const d = await r.json()
      if (d.success) {
        // 乐观更新：将新消息插入列表
        setMessages(prev => [...prev, {
          id: d.data.id,
          sender_type: role,
          sender_id: 0,
          content: text,
          is_read: 0,
          created_at: d.data.created_at || new Date().toLocaleString(),
        }])
      }
    } catch {
      // 忽略发送错误
    } finally {
      setSending(false)
    }
  }

  // 回车发送
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-8"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="rounded-2xl border w-full max-w-xl h-[600px] flex flex-col overflow-hidden"
            style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* 头部 */}
            <div className="flex items-center justify-between px-6 py-4 border-b shrink-0"
              style={{ borderColor: 'var(--color-outline-variant)' }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-base font-semibold"
                  style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-primary)' }}>
                  {candidate.name[0]}
                </div>
                <div>
                  <p className="text-base font-medium" style={{ color: 'var(--color-on-surface)' }}>{candidate.name}</p>
                  <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
                    {candidate.job_title || '未指定岗位'} · 匹配度 {candidate.match ?? '—'}%
                  </p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 rounded-lg transition-colors hover:bg-[var(--color-surface-container-high)]">
                <X className="h-5 w-5" style={{ color: 'var(--color-on-surface-variant)' }} />
              </button>
            </div>

            {/* 消息列表 */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {loading ? (
                <div className="flex items-center justify-center py-20 gap-2.5" style={{ color: 'var(--color-on-surface-variant)' }}>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-base">加载消息</span>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-2">
                  <p className="text-base" style={{ color: 'var(--color-on-surface-variant)' }}>暂无消息</p>
                  <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)', opacity: 0.6 }}>发送第一条消息开始沟通</p>
                </div>
              ) : (
                messages.map(msg => {
                  const isMine = msg.sender_type === role
                  return (
                    <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-base`}
                        style={{
                          background: isMine ? 'var(--color-primary)' : 'var(--color-surface-container-high)',
                          color: isMine ? 'white' : 'var(--color-on-surface)',
                        }}>
                        <p>{msg.content}</p>
                        <p className="text-xs mt-1 opacity-60 text-right">
                          {msg.created_at?.slice(11, 16) || ''}
                        </p>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* 输入框 */}
            <div className="shrink-0 px-6 py-4 border-t flex items-center gap-3"
              style={{ borderColor: 'var(--color-outline-variant)' }}>
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="输入消息，按 Enter 发送"
                disabled={sending}
                className="flex-1 h-11 px-4 rounded-lg border text-base outline-none focus:border-[color:var(--color-primary)] disabled:opacity-50"
                style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface)', color: 'var(--color-on-surface)' }}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || sending}
                className="h-11 w-11 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50"
                style={{ background: 'var(--color-primary)', color: 'white' }}
              >
                {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}