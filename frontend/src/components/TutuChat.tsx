import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface ChatMsg {
  role: 'user' | 'tutu'
  text: string
}

/** 本地关键词兜底 */
const KEYWORDS: [RegExp, string][] = [
  [/简历|CV/, '建议突出量化成果，用STAR法则描述项目经历。'],
  [/面试/, '面试前了解公司背景，准备3个提问反问HR。'],
  [/薪资|薪酬/, '先调研市场行情，根据能力和经验合理定价。'],
  [/技能|学习/, '点击下方学习路径，图图会帮你规划哦~'],
]

function getLocalReply(q: string): string {
  for (const [re, a] of KEYWORDS) {
    if (re.test(q)) return a
  }
  return '图图还在学习中，试试问我简历优化或面试技巧吧~'
}

export default function TutuChat() {
  const [open, setOpen] = useState(false)
  const [msg, setMsg] = useState('')
  const [chatLog, setChatLog] = useState<ChatMsg[]>([
    { role: 'tutu', text: '你好！我是图图，你的AI学习助手~有什么问题可以问我！' },
  ])
  const chatRef = useRef<HTMLDivElement>(null)

  // 自动滚动到底部
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight
    }
  }, [chatLog])

  const sendMsg = async () => {
    const text = msg.trim()
    if (!text) return
    setMsg('')
    setChatLog((prev) => [...prev, { role: 'user', text }, { role: 'tutu', text: '思考中...' }])

    try {
      // 尝试获取诊断上下文
      let diagnosisContext = null
      try {
        const saved = localStorage.getItem('jt_learning_report')
        if (saved) {
          const report = JSON.parse(saved)
          if (report?.result?.skills?.miss) {
            diagnosisContext = {
              miss_skills: report.result.skills.miss.map((s: any) =>
                typeof s === 'string' ? s : s.skill || s.name || ''
              ).filter(Boolean),
              target_job: report.job?.title || '',
            }
          }
        }
      } catch {}

      // 构建聊天历史（后端取最后6条）
      const history = chatLog
        .filter((m) => m.text !== '思考中...')
        .slice(-6)
        .map((m) => ({
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.text,
        }))

      const r = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, diagnosis: diagnosisContext, history }),
        cache: 'no-store',
      })
      const d = await r.json()
      const reply = d?.answer ? d.answer : getLocalReply(text)
      setChatLog((prev) => [...prev.slice(0, -1), { role: 'tutu', text: reply }])
    } catch {
      setChatLog((prev) => [...prev.slice(0, -1), { role: 'tutu', text: getLocalReply(text) }])
    }
  }

  return (
    <>
      {/* 悬浮按钮 */}
      <motion.button
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center cursor-pointer"
        style={{ background: 'var(--color-primary, #6366f1)' }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
      >
        <span className="text-2xl">{open ? '✕' : '🤖'}</span>
      </motion.button>

      {/* 聊天面板 */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-24 right-6 z-50 w-80 h-96 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
            style={{ background: 'var(--color-surface, #fff)', border: '1px solid var(--color-border, #e5e7eb)' }}
          >
            {/* 头部 */}
            <div
              className="px-4 py-3 flex items-center gap-2"
              style={{ background: 'var(--color-primary, #6366f1)', color: '#fff' }}
            >
              <span className="text-lg">🤖</span>
              <div>
                <div className="font-semibold text-sm">图图</div>
                <div className="text-xs opacity-80">AI 学习助手</div>
              </div>
            </div>

            {/* 消息列表 */}
            <div ref={chatRef} className="flex-1 overflow-y-auto p-3 space-y-3">
              {chatLog.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className="max-w-[85%] px-3 py-2 rounded-xl text-sm leading-relaxed"
                    style={
                      m.role === 'user'
                        ? { background: 'var(--color-primary, #6366f1)', color: '#fff', borderBottomRightRadius: 4 }
                        : { background: 'var(--color-bg, #f3f4f6)', border: '1px solid var(--color-border, #e5e7eb)', borderBottomLeftRadius: 4 }
                    }
                  >
                    {m.role === 'tutu' && (
                      <span className="text-xs font-semibold block mb-1" style={{ color: 'var(--color-primary, #6366f1)' }}>
                        图图
                      </span>
                    )}
                    {m.text}
                  </div>
                </div>
              ))}
            </div>

            {/* 输入区 */}
            <div className="p-3 border-t" style={{ borderColor: 'var(--color-border, #e5e7eb)' }}>
              <div className="flex gap-2">
                <input
                  value={msg}
                  onChange={(e) => setMsg(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendMsg()}
                  placeholder="输入问题..."
                  className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: 'var(--color-bg, #f3f4f6)', border: '1px solid var(--color-border, #e5e7eb)' }}
                />
                <button
                  onClick={sendMsg}
                  className="px-3 py-2 rounded-lg text-sm font-medium text-white cursor-pointer"
                  style={{ background: 'var(--color-primary, #6366f1)' }}
                >
                  发送
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
