import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, MessageSquare, ChevronRight } from 'lucide-react'
import ChatDialog from '../../components/ChatDialog'

// 对话类型
interface Conversation {
  match_record_id: number
  candidate_name: string
  candidate_av: string
  job_title: string
  match_score: number | null
  last_message: string
  last_time: string
  unread_count: number
  status: string
}

// 状态中文映射
const STATUS_LABEL: Record<string, string> = {
  'pending': '待沟通',
  'communicating': '沟通中',
  'accepted': '已接受',
  'rejected': '已拒绝',
}

export default function Conversations() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [unreadTotal, setUnreadTotal] = useState(0)

  // 聊天弹窗状态
  const [chatOpen, setChatOpen] = useState(false)
  const [chatRecordId, setChatRecordId] = useState<number | null>(null)
  const [chatCandidate, setChatCandidate] = useState<{ id: number; name: string; job_title: string; match: number | null } | null>(null)

  // 加载对话列表
  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const r = await fetch('/api/enterprise/conversations?size=100')
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

  // 打开聊天
  const openChat = (conv: Conversation) => {
    setChatRecordId(conv.match_record_id)
    setChatCandidate({
      id: conv.match_record_id,
      name: conv.candidate_name,
      job_title: conv.job_title,
      match: conv.match_score,
    })
    setChatOpen(true)
  }

  // 聊天关闭后刷新列表（更新未读数）
  const handleChatClose = () => {
    setChatOpen(false)
    load()
  }

  // 格式化时间
  const formatTime = (timeStr: string) => {
    if (!timeStr) return ''
    // 今天显示时间，昨天显示"昨天"，更早显示日期
    const today = new Date()
    const d = new Date(timeStr.replace(' ', 'T'))
    if (isNaN(d.getTime())) return timeStr.slice(5, 11)

    const isToday = d.toDateString() === today.toDateString()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const isYesterday = d.toDateString() === yesterday.toDateString()

    if (isToday) return timeStr.slice(11, 16) // HH:mm
    if (isYesterday) return '昨天'
    return timeStr.slice(5, 10) // MM-DD
  }

  return (
    <div className="h-full flex flex-col">
      {/* ── 顶部标题 ── */}
      <header className="shrink-0 border-b" style={{ borderColor: 'var(--color-outline-variant)' }}>
        <div className="px-14 py-7 flex items-center justify-between">
          <div className="flex items-baseline gap-3">
            <h1 className="text-3xl font-semibold tracking-tight" style={{ color: 'var(--color-on-surface)' }}>消息</h1>
            {unreadTotal > 0 && (
              <span className="text-base tabular-nums" style={{ color: 'var(--accent-red-strong)' }}>
                {unreadTotal} 条未读
              </span>
            )}
          </div>
        </div>
      </header>

      {error && (
        <div className="px-14 pt-6">
          <div className="rounded-lg border px-5 py-4 text-base" style={{ borderColor: 'var(--accent-red)', background: 'var(--accent-red-dim)', color: 'var(--accent-red-strong)' }}>
            {error}
          </div>
        </div>
      )}

      {/* ── 对话列表 ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-14 py-6">
          {loading ? (
            <div className="flex items-center justify-center py-28 gap-2.5" style={{ color: 'var(--color-on-surface-variant)' }}>
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="text-lg">加载中</span>
            </div>
          ) : conversations.length === 0 ? (
            <div className="text-center py-28">
              <MessageSquare className="h-16 w-16 mx-auto mb-4" style={{ color: 'var(--color-on-surface-variant)', opacity: 0.3 }} />
              <p className="text-lg" style={{ color: 'var(--color-on-surface-variant)' }}>暂无对话</p>
              <p className="text-base mt-2" style={{ color: 'var(--color-on-surface-variant)', opacity: 0.6 }}>
                在"人才星"中发起沟通后，对话将出现在这里
              </p>
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--color-outline-variant)' }}>
              {conversations.map((conv, i) => (
                <motion.div
                  key={conv.match_record_id}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(i * 0.02, 0.3) }}
                  onClick={() => openChat(conv)}
                  className="flex items-center gap-4 px-8 py-5 cursor-pointer transition-colors border-b last:border-b-0 hover:bg-[var(--color-surface-container-low)]"
                  style={{ borderColor: 'var(--color-outline-variant)' }}
                >
                  {/* 头像 */}
                  <div className="relative shrink-0">
                    <div className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-semibold"
                      style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-primary)' }}>
                      {conv.candidate_av}
                    </div>
                    {/* 未读红点 */}
                    {conv.unread_count > 0 && (
                      <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[22px] h-5.5 px-1.5 rounded-full text-xs font-bold"
                        style={{ background: 'var(--accent-red-strong)', color: 'white' }}>
                        {conv.unread_count > 99 ? '99+' : conv.unread_count}
                      </span>
                    )}
                  </div>

                  {/* 内容 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-lg font-medium truncate" style={{ color: 'var(--color-on-surface)' }}>
                          {conv.candidate_name}
                        </span>
                        {conv.job_title && (
                          <span className="text-sm px-2 py-0.5 rounded shrink-0"
                            style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-primary)' }}>
                            {conv.job_title}
                          </span>
                        )}
                      </div>
                      <span className="text-sm shrink-0 ml-3 tabular-nums" style={{ color: 'var(--color-on-surface-variant)' }}>
                        {formatTime(conv.last_time)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-base truncate" style={{ color: conv.last_message ? 'var(--color-on-surface-variant)' : 'var(--color-on-surface-variant)' }}>
                        {conv.last_message || (conv.status === 'pending' ? '暂无消息，点击发起沟通' : '暂无消息')}
                      </p>
                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        <span className="text-sm" style={{ color: 'var(--color-on-surface-variant)', opacity: 0.7 }}>
                          {STATUS_LABEL[conv.status] || conv.status}
                        </span>
                        <ChevronRight className="h-5 w-5" style={{ color: 'var(--color-on-surface-variant)' }} />
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── 聊天弹窗 ── */}
      {chatRecordId && chatCandidate && (
        <ChatDialog
          open={chatOpen}
          onClose={handleChatClose}
          matchRecordId={chatRecordId}
          candidate={chatCandidate}
        />
      )}
    </div>
  )
}