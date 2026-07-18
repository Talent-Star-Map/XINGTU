import { useState } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, MessageCircle, BookOpen, Video, FileText, CheckCircle, ArrowRight, Star, Compass, Rocket, Brain, Zap } from 'lucide-react'

const phases = [
  { phase: '第一阶段', title: 'LLM 应用开发入门', duration: '1-2周', icon: Rocket,
    skills: ['Prompt Engineering', 'LangChain核心概念', 'LLM API调用'],
    resources: [{ name: 'LangChain 官方文档', type: '文档' }, { name: '吴恩达 Prompt 课程', type: '课程' }],
    color: '#00C8FF', tip: '打好大模型基础，理解 LLM 工作原理' },
  { phase: '第二阶段', title: 'RAG 应用开发', duration: '2-3周', icon: Brain,
    skills: ['向量数据库', '文档分割技术', '检索增强生成'],
    resources: [{ name: 'RAG 实战教程', type: '教程' }, { name: '向量数据库选型', type: '文章' }],
    color: '#7C3AED', tip: '掌握企业级应用的核心模式——RAG' },
  { phase: '第三阶段', title: 'Agent 开发实战', duration: '3-4周', icon: Zap,
    skills: ['Agent框架', '工具调用', 'MCP协议'],
    resources: [{ name: 'LangChain Agent 教程', type: '课程' }],
    color: '#00E599', tip: '构建能自主决策的智能体应用' },
  { phase: '第四阶段', title: '企业级部署', duration: '2-3周', icon: Compass,
    skills: ['模型部署', '性能优化', '安全监控'],
    resources: [{ name: 'FastAPI 生产部署', type: '文档' }],
    color: '#FF8C42', tip: '将应用部署到生产环境，接受真实流量考验' },
]

const typeIcons: Record<string, any> = { '文档': FileText, '课程': Video, '教程': BookOpen, '文章': FileText, '项目': Rocket }

export default function LearningPath() {
  const [step, setStep] = useState(0)
  const [chat, setChat] = useState(false)
  const [msg, setMsg] = useState('')
  const [chatLog, setChatLog] = useState<{ role: string; text: string }[]>([
    { role: 'tutu', text: '你好呀！我是图图，有什么学习上的问题可以问我哦~ 😊' },
  ])

  const sendMsg = () => {
    if (!msg.trim()) return
    setChatLog(prev => [...prev, { role: 'user', text: msg }])
    setTimeout(() => {
      setChatLog(prev => [...prev, {
        role: 'tutu', text: '好问题！建议你先从 LangChain 官方文档入手，配合实际的代码练习效果更好。星星已经为你规划好了学习路径，按阶段推进就好！ 🌟'
      }])
    }, 800)
    setMsg('')
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      {/* ─── 头部：星星 & 图图 ─── */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl border p-6" style={{ borderColor: 'var(--color-outline-variant)', background: 'linear-gradient(135deg, var(--color-primary-fixed) 0%, var(--color-surface-container-lowest) 100%)' }}>
        <div className="flex items-center gap-6">
          {/* 星星 */}
          <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            className="flex flex-col items-center gap-1">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl" style={{ background: 'linear-gradient(135deg, #FFD700, #FFA500)' }}>
                <Star className="h-8 w-8 text-white" />
              </div>
              <motion.div className="absolute -top-1 -right-1 text-xs" animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 2, repeat: Infinity }}>✨</motion.div>
            </div>
            <span className="text-xs font-bold mt-1" style={{ color: 'var(--accent-orange)' }}>星星</span>
            <span className="text-[9px]" style={{ color: 'var(--color-on-surface-variant)' }}>路径规划师</span>
          </motion.div>

          <div className="flex-1 text-center">
            <h1 className="text-lg md:text-2xl font-extrabold gradient-text">星星 ✦ 图图</h1>
            <p className="text-sm mt-1 font-medium" style={{ color: 'var(--color-on-surface)' }}>带你斩获心仪 Offer 🎯</p>
            <p className="text-xs mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>星星规划路径 · 图图解答疑惑 · 双倍助力，轻松上岸</p>
          </div>

          {/* 图图 */}
          <motion.div animate={{ y: [0, 6, 0] }} transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
            className="flex flex-col items-center gap-1">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl" style={{ background: 'linear-gradient(135deg, #00C8FF, #7C3AED)' }}>
                <MessageCircle className="h-8 w-8 text-white" />
              </div>
              <motion.div className="absolute -top-1 -right-1 text-xs" animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 2.5, repeat: Infinity, delay: 0.5 }}>💬</motion.div>
            </div>
            <span className="text-xs font-bold mt-1" style={{ color: 'var(--color-primary)' }}>图图</span>
            <span className="text-[9px]" style={{ color: 'var(--color-on-surface-variant)' }}>答疑精灵</span>
          </motion.div>
        </div>
      </motion.div>

      {/* ─── 路径进度 ─── */}
      <div className="rounded-2xl border p-5" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold" style={{ color: 'var(--color-on-surface)' }}>目标岗位：AI 应用开发工程师</h2>
          <span className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>预计 8-12 周</span>
        </div>

        {/* 时间轴路径 */}
        <div className="relative">
          {/* 连接线 */}
          <div className="absolute top-7 left-[18px] right-[18px] h-0.5" style={{ background: 'var(--color-outline-variant)' }}>
            <motion.div className="h-full" style={{ background: 'linear-gradient(90deg, var(--color-primary), var(--accent-purple))' }}
              initial={{ width: '0%' }} animate={{ width: `${((step + 1) / phases.length) * 100}%` }} transition={{ duration: 0.5 }} />
          </div>

          <div className="flex justify-between relative">
            {phases.map((p, i) => {
              const active = i <= step
              const current = i === step
              return (
                <button key={p.phase} onClick={() => setStep(i)} className="flex flex-col items-center gap-2 relative z-10">
                  <motion.div className={`flex items-center justify-center rounded-xl transition-all ${current ? 'ring-2 ring-offset-2' : ''}`}
                    style={{
                      width: 44, height: 44,
                      background: active ? `linear-gradient(135deg, ${p.color}, ${p.color}cc)` : 'var(--color-surface)',
                      borderColor: active ? p.color : 'var(--color-outline-variant)',
                      borderWidth: current ? 2 : 1,
                    }}
                    animate={current ? { scale: [1, 1.08, 1] } : {}}
                    transition={{ duration: 2, repeat: current ? Infinity : 0 }}>
                    <p.icon className="h-5 w-5" style={{ color: active ? 'var(--color-on-primary)' : 'var(--color-on-surface-variant)' }} />
                  </motion.div>
                  <span className="text-[10px] font-semibold text-center leading-tight" style={{ color: active ? p.color : 'var(--color-on-surface-variant)', maxWidth: 64 }}>{p.title.replace('实战', '').replace('部署', '部署').replace('入门', '入门')}</span>
                  <span className="text-[9px]" style={{ color: 'var(--color-on-surface-variant)' }}>{p.duration}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-5">
        {/* 左侧：当前阶段详情 */}
        <div className="col-span-3 space-y-4">
          {phases.map((p, i) => (
            <motion.div key={p.phase} initial={{ opacity: 0, y: 10 }} animate={i === step ? { opacity: 1, y: 0 } : { opacity: 0, height: 0, overflow: 'hidden' }} transition={{ duration: 0.3 }}>
              {i === step && (
                <div className="rounded-2xl border p-5" style={{ borderColor: `${p.color}30`, background: 'var(--color-surface-container-lowest)' }}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: `${p.color}15` }}>
                      <p.icon className="h-5 w-5" style={{ color: p.color }} />
                    </div>
                    <div>
                      <h3 className="text-base font-bold" style={{ color: 'var(--color-on-surface)' }}>{p.phase}：{p.title}</h3>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>{p.duration} · {p.tip}</p>
                    </div>
                  </div>

                  <div className="mb-4">
                    <p className="text-xs font-semibold mb-2" style={{ color: 'var(--color-on-surface-variant)' }}>🎯 学习目标</p>
                    <div className="flex flex-wrap gap-2">
                      {p.skills.map(s => (
                        <span key={s} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: `${p.color}10`, color: p.color }}>
                          <CheckCircle className="h-3 w-3" />{s}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold mb-2" style={{ color: 'var(--color-on-surface-variant)' }}>📚 推荐资源</p>
                    <div className="space-y-2">
                      {p.resources.map((r, j) => {
                        const Icon = typeIcons[r.type] || BookOpen
                        return (
                          <div key={j} className="flex items-center gap-3 p-2.5 rounded-xl" style={{ background: 'var(--color-surface)' }}>
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: `${p.color}10` }}>
                              <Icon className="h-4 w-4" style={{ color: p.color }} />
                            </div>
                            <div className="flex-1"><p className="text-sm font-medium">{r.name}</p><p className="text-[10px]" style={{ color: 'var(--color-on-surface-variant)' }}>{r.type}</p></div>
                            <ArrowRight className="h-4 w-4" style={{ color: 'var(--color-on-surface-variant)' }} />
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t flex items-center gap-2 text-xs" style={{ borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface-variant)' }}>
                    <Sparkles className="h-3.5 w-3.5" style={{ color: '#FFD700' }} />
                    星星建议：{p.tip}
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {/* 右侧：图图聊天 */}
        <div className="col-span-2">
          <div className="rounded-2xl border flex flex-col" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)', height: 420 }}>
            <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: 'var(--color-outline-variant)' }}>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'linear-gradient(135deg, #00C8FF, #7C3AED)' }}>
                <MessageCircle className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--color-on-surface)' }}>图图</p>
                <p className="text-[10px]" style={{ color: 'var(--color-on-surface-variant)' }}>在线答疑精灵</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {chatLog.map((c, i) => (
                <div key={i} className={`flex ${c.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${c.role === 'user' ? 'rounded-br-sm' : 'rounded-bl-sm'}`}
                    style={{
                      background: c.role === 'user' ? 'var(--color-primary)' : 'var(--color-surface)',
                      color: c.role === 'user' ? 'var(--color-on-primary)' : 'var(--color-on-surface)',
                      border: c.role === 'user' ? 'none' : '1px solid var(--color-outline-variant)',
                    }}>
                    {c.role === 'tutu' && <span className="text-xs font-bold mr-1" style={{ color: 'var(--color-primary)' }}>图图</span>}
                    <p className="text-xs leading-relaxed">{c.text}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3 border-t flex gap-2" style={{ borderColor: 'var(--color-outline-variant)' }}>
              <input value={msg} onChange={e => setMsg(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMsg()}
                placeholder="问问图图..." className="flex-1 rounded-xl border px-3 py-2 text-xs outline-none"
                style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface)', color: 'var(--color-on-surface)' }} />
              <button onClick={sendMsg} className="px-4 py-2 rounded-xl text-xs font-semibold" style={{ background: 'var(--color-primary)', color: 'var(--color-on-primary)' }}>发送</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
