import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Loader2, MessageSquare, ChevronRight } from 'lucide-react'
import ChatDialog from '../../components/ChatDialog'

// 求职者 ID：登录时由 auth 接口写入 localStorage
const getSeekerId = (): number | null => {
  try {
    const u = JSON.parse(localStorage.getItem('xingtu_user') || 'null')
    return u?.id ?? null
  } catch { return null }
}

interface Conversation {
  match_record_id: number
  job_title: string
  company: string
  company_av: string
  match_score: number | null
  last_message: string
  last_time: string
  unread_count: number
}

export default function Messages() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [unreadTotal, setUnreadTotal] = useState(0)
  const seekerId = getSeekerId()

  // 聊天弹窗状态
  const [chatOpen, setChatOpen] = useState(false)
  const [chatRecordId, setChatRecordId] = useState<number | null>(null)
  const [chatPeer, setChatPeer] = useState<{ id: number; name: string; job_title: string; match: number | null } | null>(null)

  const load = async () => {
    if (!seekerId) { setError('请先登录后查看消息'); setLoading(false); return }
    setLoading(true)
    setError('')
    try {
      const r = await fetch(`/api/jobseeker/conversations?jobseeker_id=${seekerId}&size=100`)
      const d = await r.json()
      if (d.success && d.data) {
        setConversations(d.data.conversations)
        setUnreadTotal(d.data.unread_total || 0)
      } else {
        setError(d.error?.message || '加载失败')
      }
    } catch {
      setError('网络错误，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const openChat = (conv: Conversation) => {
    setChatRecordId(conv.match_record_id)
    setChatPeer({
      id: conv.match_record_id,
      name: conv.company || conv.job_title || '招聘方',
      job_title: conv.job_title,
      match: conv.match_score,
    })
    setChatOpen(true)
  }

  const handleChatClose = () => {
    setChatOpen(false)
    load()
  }

  // 今天显示 HH:mm，昨天显示"昨天"，更早显示 MM-DD
  const formatTime = (timeStr: string) => {
    if (!timeStr) return ''
    const today = new Date()
    const d = new Date(timeStr.replace(' ', 'T'))
    if (isNaN(d.getTime())) return timeStr.slice(5, 11)
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    if (d.toDateString() === today.toDateString()) return timeStr.slice(11, 16)
    if (d.toDateString() === yesterday.toDateString()) return '昨天'
    return timeStr.slice(5, 10)
  }

  return (
    <div className="h-full flex flex-col">
      {/* ── 顶部标题 ── */}
      <header className="shrink-0 border-b" style={{ borderColor: 'var(--color-outline-variant)' }}>
        <div className="px-8 py-7 flex items-baseline gap-3">
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--color-on-surface)' }}>消息</h1>
          {unreadTotal > 0 && (
            <span className="text-sm tabular-nums" style={{ color: 'var(--accent-red-strong)' }}>
              {unreadTotal} 条未读
            </span>
          )}
        </div>
      </header>

      {error && (
        <div className="px-8 pt-6">
          <div className="rounded-lg border px-5 py-4 text-sm" style={{ borderColor: 'var(--accent-red)', background: 'var(--accent-red-dim)', color: 'var(--accent-red-strong)' }}>
            {error}
          </div>
        </div>
      )}

      {/* ── 对话列表 ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-8 py-6">
          {loading ? (
            <div className="flex items-center justify-center py-28 gap-2.5" style={{ color: 'var(--color-on-surface-variant)' }}>
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="text-base">加载中</span>
            </div>
          ) : conversations.length === 0 ? (
            <div className="text-center py-28">
              <MessageSquare className="h-14 w-14 mx-auto mb-4" style={{ color: 'var(--color-on-surface-variant)', opacity: 0.3 }} />
              <p className="text-base" style={{ color: 'var(--color-on-surface-variant)' }}>暂无沟通</p>
              <p className="text-sm mt-2" style={{ color: 'var(--color-on-surface-variant)', opacity: 0.6 }}>
                在岗位详情页「去投递」后，与 HR 的对话会出现在这里
              </p>
            </div>
          ) : (
            <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-outline-variant)' }}>
              {conversations.map((conv, i) => (
                <motion.div
                  key={conv.match_record_id}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(i * 0.02, 0.3) }}
                  onClick={() => openChat(conv)}
                  className="flex items-center gap-4 px-6 py-4 cursor-pointer transition-colors border-b last:border-b-0 hover:bg-[var(--color-surface-container-low)]"
                  style={{ borderColor: 'var(--color-outline-variant)' }}
                >
                  {/* 企业头像 + 未读红点 */}
                  <div className="relative shrink-0">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-semibold"
                      style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-primary)' }}>
                      {conv.company_av}
                    </div>
                    {conv.unread_count > 0 && (
                      <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-bold"
                        style={{ background: 'var(--accent-red-strong)', color: 'white' }}>
                        {conv.unread_count > 99 ? '99+' : conv.unread_count}
                      </span>
                    )}
                  </div>

                  {/* 内容 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-base font-medium truncate" style={{ color: 'var(--color-on-surface)' }}>
                          {conv.company || '招聘方'}
                        </span>
                        {conv.job_title && (
                          <span className="text-xs px-2 py-0.5 rounded-lg shrink-0"
                            style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-primary)' }}>
                            {conv.job_title}
                          </span>
                        )}
                      </div>
                      <span className="text-xs shrink-0 ml-3 tabular-nums" style={{ color: 'var(--color-on-surface-variant)' }}>
                        {formatTime(conv.last_time)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-sm truncate" style={{ color: 'var(--color-on-surface-variant)' }}>
                        {conv.last_message || '暂无消息'}
                      </p>
                      <ChevronRight className="h-4 w-4 shrink-0 ml-3" style={{ color: 'var(--color-on-surface-variant)' }} />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── 聊天弹窗（求职者视角） ── */}
      {chatRecordId && chatPeer && seekerId && (
        <ChatDialog
          open={chatOpen}
          onClose={handleChatClose}
          matchRecordId={chatRecordId}
          candidate={chatPeer}
          role="jobseeker"
        />
      )}
    </div>
  )
}
