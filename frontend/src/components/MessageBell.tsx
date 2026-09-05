import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, X, MessageSquare, Loader2, ChevronRight } from 'lucide-react'
import ChatDialog from './ChatDialog'

// 求职者 ID:登录时由 auth 接口写入 localStorage
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

export default function MessageBell() {
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // 弹窗尺寸状态 — 用户可拖拽右下角调整
  const [size, setSize] = useState({ width: 360, height: 520 })
  const resizeRef = useRef<{ startX: number; startY: number; startW: number; startH: number } | null>(null)

  // 聊天弹窗状态
  const [chatOpen, setChatOpen] = useState(false)
  const [chatRecordId, setChatRecordId] = useState<number | null>(null)
  const [chatPeer, setChatPeer] = useState<{ id: number; name: string; job_title: string; match: number | null } | null>(null)

  const seekerId = getSeekerId()

  // ── 未读数:首次加载 + 20s 轮询 + xingtu:msg-read 事件即时刷新 ──
  const refreshUnread = useCallback(async () => {
    if (!seekerId) return
    try {
      const r = await fetch(`/api/jobseeker/unread-total?jobseeker_id=${seekerId}`)
      const d = await r.json()
      if (d.success) setUnread(d.data.unread_total || 0)
    } catch { /* ignore */ }
  }, [seekerId])

  useEffect(() => {
    refreshUnread()
    const timer = setInterval(refreshUnread, 20000)
    const onMsgRead = () => refreshUnread()
    window.addEventListener('xingtu:msg-read', onMsgRead)
    return () => {
      clearInterval(timer)
      window.removeEventListener('xingtu:msg-read', onMsgRead)
    }
  }, [refreshUnread])

  // 打开弹窗时拉对话列表
  const loadConversations = useCallback(async () => {
    if (!seekerId) return
    setLoading(true)
    try {
      const r = await fetch(`/api/jobseeker/conversations?jobseeker_id=${seekerId}&size=100`)
      const d = await r.json()
      if (d.success && d.data) {
        setConversations(d.data.conversations || [])
        setUnread(d.data.unread_total || 0)
      }
    } catch { /* ignore */ } finally { setLoading(false) }
  }, [seekerId])

  useEffect(() => {
    if (open) loadConversations()
  }, [open, loadConversations])

  // 外部点击关闭(点在弹窗/铃铛外)
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // ── 拖拽改尺寸(右下角) ──
  const startResize = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    resizeRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startW: size.width,
      startH: size.height,
    }
    document.addEventListener('mousemove', onResize)
    document.addEventListener('mouseup', endResize)
  }
  const onResize = (e: MouseEvent) => {
    if (!resizeRef.current) return
    const dx = e.clientX - resizeRef.current.startX
    const dy = e.clientY - resizeRef.current.startY
    const minW = 280, minH = 360
    const maxW = Math.max(minW, window.innerWidth - 40)
    const maxH = Math.max(minH, window.innerHeight - 40)
    setSize({
      width: Math.max(minW, Math.min(maxW, resizeRef.current.startW + dx)),
      height: Math.max(minH, Math.min(maxH, resizeRef.current.startH + dy)),
    })
  }
  const endResize = () => {
    resizeRef.current = null
    document.removeEventListener('mousemove', onResize)
    document.removeEventListener('mouseup', endResize)
  }

  // 打开聊天弹窗(复用 ChatDialog)
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
    // 关聊天后刷新对话列表(可能有新消息或已读状态变化)
    loadConversations()
  }

  // 今天 HH:mm,昨天"昨天",更早 MM-DD
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
    <div className="relative" ref={wrapperRef}>
      {/* ── 铃铛按钮 ── */}
      <button
        onClick={() => setOpen(o => !o)}
        className="relative p-2.5 rounded-lg transition-colors hover:bg-[var(--color-surface-container)]"
        style={{ color: 'var(--color-on-surface-variant)' }}
        aria-label="消息"
        title="消息"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold leading-none"
            style={{ background: 'var(--accent-red-strong)', color: 'white' }}
          >
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {/* ── 弹窗 ── */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 rounded-2xl border shadow-xl overflow-hidden z-50 flex flex-col"
            style={{
              width: size.width,
              height: size.height,
              borderColor: 'var(--color-outline-variant)',
              background: 'var(--color-surface-container-lowest)',
            }}
          >
            {/* Header */}
            <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--color-outline-variant)' }}>
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" style={{ color: 'var(--color-primary)' }} />
                <span className="text-sm font-bold" style={{ color: 'var(--color-on-surface)' }}>消息</span>
                {unread > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                    style={{ background: 'var(--accent-red-strong)', color: 'white' }}>
                    {unread} 未读
                  </span>
                )}
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded hover:bg-[var(--color-surface-container)]"
                style={{ color: 'var(--color-on-surface-variant)' }}
                aria-label="关闭"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body:对话列表 */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center h-full gap-2" style={{ color: 'var(--color-on-surface-variant)' }}>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-xs">加载中</span>
                </div>
              ) : conversations.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-30" style={{ color: 'var(--color-on-surface-variant)' }} />
                  <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>暂无消息</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--color-on-surface-variant)', opacity: 0.6 }}>
                    在岗位详情页投递后,HR 的回复会出现在这里
                  </p>
                </div>
              ) : (
                conversations.map(conv => (
                  <div
                    key={conv.match_record_id}
                    onClick={() => openChat(conv)}
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors border-b hover:bg-[var(--color-surface-container-low)]"
                    style={{ borderColor: 'var(--color-outline-variant)' }}
                  >
                    <div className="relative shrink-0">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold"
                        style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-primary)' }}
                      >
                        {conv.company_av}
                      </div>
                      {conv.unread_count > 0 && (
                        <span
                          className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold"
                          style={{ background: 'var(--accent-red-strong)', color: 'white' }}
                        >
                          {conv.unread_count > 99 ? '99+' : conv.unread_count}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-sm font-medium truncate" style={{ color: 'var(--color-on-surface)' }}>
                          {conv.company || '招聘方'}
                        </span>
                        <span className="text-[10px] shrink-0 ml-2 tabular-nums" style={{ color: 'var(--color-on-surface-variant)' }}>
                          {formatTime(conv.last_time)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-xs truncate" style={{ color: 'var(--color-on-surface-variant)' }}>
                          {conv.last_message || '暂无消息'}
                        </p>
                        <ChevronRight className="h-3 w-3 shrink-0 ml-2" style={{ color: 'var(--color-on-surface-variant)' }} />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* ── 右下角拖拽手柄 ── */}
            <div
              onMouseDown={startResize}
              className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize"
              style={{
                background:
                  'linear-gradient(135deg, transparent 50%, var(--color-on-surface-variant) 50%, var(--color-on-surface-variant) 55%, transparent 55%, transparent 65%, var(--color-on-surface-variant) 65%, var(--color-on-surface-variant) 70%, transparent 70%, transparent 80%, var(--color-on-surface-variant) 80%, var(--color-on-surface-variant) 85%, transparent 85%)',
                opacity: 0.4,
              }}
              title="拖动调整大小"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 聊天弹窗(复用现有 ChatDialog,关掉后刷新列表) ── */}
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
