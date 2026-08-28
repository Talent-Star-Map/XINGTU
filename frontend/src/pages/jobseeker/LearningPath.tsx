import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, MessageCircle, BookOpen, Video, FileText, CheckCircle, ArrowRight, Star, Compass, Rocket, Brain, Zap, Target, RotateCcw, ExternalLink, Play, Clock } from 'lucide-react'
import { JSNav } from '../../lib/NavContext'
import { useLearning } from '../../lib/LearningContext'
import { groupMissingSkills, activePhases, estimateWeeks, PHASE_TITLES } from '../../lib/learningPhases'

interface Phase { phase: string; title: string; duration: string; icon: any; skills: string[]; resources: { name: string; type: string; url: string }[]; color: string; tip: string }
interface DiagnosisResult { overall: number; grade: string; phases: any[]; recommendations: string[]; skills: { have: any[]; miss: any[]; extra: string[] } }
interface Job { id: number; title: string; company: string; salary: string; location: string; skills: string[] }

const typeIcons: Record<string, any> = { '文档': FileText, '课程': Video, '教程': BookOpen, '文章': FileText, '项目': Rocket, '视频': Play }
const typeColors: Record<string, string> = { '文档': 'var(--color-primary)', '视频': '#ef4444', '教程': 'var(--accent-green)', '课程': 'var(--accent-purple)' }

const tutuKnowledge: { keywords: string[]; answer: string }[] = [
  { keywords: ['langchain', 'langchain'], answer: 'LangChain 是当前最主流的 LLM 应用开发框架。建议从官方文档的 Quickstart 开始，先理解 Chain、Agent、Memory 三个核心概念，然后动手写一个简单的 QA 应用。 📚' },
  { keywords: ['rag', '检索增强', '知识库'], answer: 'RAG（检索增强生成）是企业级 LLM 应用的核心模式。关键步骤：文档分割 → 向量化 → 存储到向量数据库 → 检索相关片段 → 送入 LLM 生成。推荐先掌握 Chroma 或 Milvus 作为向量数据库。 🔍' },
  { keywords: ['agent', '智能体', '工具调用'], answer: 'Agent 是让 LLM 具备行动能力的关键技术。核心思路：LLM 作为大脑，根据任务目标决定调用什么工具（搜索、计算、API等），然后根据工具结果做下一步决策。建议从 LangChain 的 ReAct Agent 入门。 🤖' },
  { keywords: ['prompt', '提示词', 'prompt engineering'], answer: 'Prompt Engineering 是操控 LLM 的核心技能。关键原则：1）明确角色设定 2）给出具体任务 3）提供示例（Few-shot）4）指定输出格式。推荐学习吴恩达的 ChatGPT Prompt Engineering 课程。 ✍️' },
  { keywords: ['部署', '生产', '上线', 'docker', 'kubernetes'], answer: 'LLM 应用部署关键点：1）模型服务化（FastAPI/Flask）2）容器化（Docker）3）负载均衡 4）监控告警 5）成本控制。建议先用 Docker + FastAPI 做单机部署，再进阶到 K8s。 🚀' },
  { keywords: ['向量数据库', 'embedding', '向量化', 'chroma', 'milvus'], answer: '向量数据库是 RAG 的存储核心。轻量级推荐 Chroma（本地开发）和 Qdrant（生产环境），大规模场景用 Milvus 或 Weaviate。关键指标：检索速度、召回率、支持的数据规模。 💾' },
  { keywords: ['mcp', '协议', 'model context protocol'], answer: 'MCP（Model Context Protocol）是 Anthropic 提出的标准协议，让 LLM 能标准化地连接各种数据源和工具。它定义了 Client-Server 架构，类似"AI 的 USB-C 接口"。建议关注官方规范文档。 🔌' },
  { keywords: ['怎么学', '如何开始', '入门', '新手', '初学'], answer: '学习建议：1）先选一个目标岗位，明确技能要求 2）对照差距，按优先级补核心技能 3）每个技能配合动手项目 4）定期重新诊断看进步。星星已经帮你规划好了路径，按阶段推进就行！ 🌟' },
  { keywords: ['面试', '简历', '求职', '找工作'], answer: '求职建议：1）简历突出项目经验，量化成果 2）准备 2-3 个核心项目的深度讲解 3）刷 LeetCode + 系统设计 4）了解目标公司的技术栈。匹配度提升到 80+ 会更有竞争力！ 💪' },
  { keywords: ['谢谢', '感谢', 'thanks', 'thank'], answer: '不客气！有问题随时找我。加油学习，早日拿到心仪 Offer！ 🎉' },
  { keywords: ['你好', 'hi', 'hello', '嗨'], answer: '你好呀！我是图图，你的 AI 学习助手。可以问我任何关于技能学习、求职、技术的问题哦~ 😊' },
]

const getTutuResponse = (msg: string): string => {
  const lower = msg.toLowerCase()
  for (const item of tutuKnowledge) {
    if (item.keywords.some(k => lower.includes(k))) return item.answer
  }
  return '这个问题很有意思！建议你：1）在左侧学习路径中找到对应阶段 2）完成该阶段的学习目标 3）动手做一个小项目巩固。如果还有具体问题，可以换个方式问我哦~ 🤔'
}

/** 从诊断结果构建学习阶段（兼容 Diagnosis.tsx 和 LearningPath.tsx 两种数据格式） */
function buildPhases(diagnosis: DiagnosisResult | null): Phase[] {
  if (!diagnosis) return []
  // 已有 phases 且非空
  if (diagnosis.phases?.length) {
    const colorPool = ['#00C8FF', '#7C3AED', '#00E599', '#FF8C42']
    const iconPool = [Rocket, Brain, Zap, Compass]
    return diagnosis.phases.map((p: any, i: number) => ({
      phase: `第${['一', '二', '三', '四'][i]}阶段`,
      title: p.title,
      duration: p.duration,
      icon: iconPool[i % iconPool.length],
      skills: p.skills || [],
      resources: [],
      color: colorPool[i % colorPool.length],
      tip: p.goals?.[0] || `掌握 ${p.skills?.slice(0, 2).join('、')} 的核心用法`,
    }))
  }
  // 从 skills.miss 构建（分组与周期算法与诊断页共用 lib/learningPhases，避免两处算出不同结果）
  const groups = groupMissingSkills(diagnosis.skills?.miss)
  const colorPool = ['#00C8FF', '#7C3AED', '#00E599']
  const iconPool = [Rocket, Zap, Compass]
  const phases: Phase[] = []
  activePhases(groups).forEach((p, i) => {
    phases.push({
      phase: `第${['一', '二', '三'][i]}阶段`,
      title: PHASE_TITLES[p],
      duration: `${estimateWeeks(p, groups[p].length)} 周`,
      icon: iconPool[i % iconPool.length],
      skills: groups[p],
      resources: [],
      color: colorPool[i % colorPool.length],
      tip: `掌握 ${groups[p].slice(0, 2).join('、')} 的核心用法`,
    })
  })
  return phases
}

/** 获取技能对应的学习资源 */
async function fetchResources(skills: string[]): Promise<{ name: string; type: string; url: string }[]> {
  if (!skills.length) return []
  try {
    const r = await fetch('/api/chat/resources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skills }),
    })
    const d = await r.json()
    return d.resources || []
  } catch {
    return []
  }
}

export default function LearningPath() {
  const { setPage } = JSNav.use()
  const { masteredSkills, toggleMastered } = useLearning()
  const [targetJob, setTargetJob] = useState<Job | null>(null)
  const [diagnosis, setDiagnosis] = useState<DiagnosisResult | null>(null)
  const [step, setStep] = useState(0)
  const [msg, setMsg] = useState('')
  const [chatLog, setChatLog] = useState<{ role: string; text: string }[]>([
    { role: 'tutu', text: '你好呀！我是图图，你的 AI 学习助手。我已经了解了你的诊断结果，可以针对性地帮你学习~ 😊' },
  ])
  const [resources, setResources] = useState<{ name: string; type: string; url: string }[]>([])
  const [loadingResources, setLoadingResources] = useState(false)
  const [resourcesLoaded, setResourcesLoaded] = useState(false)
  const [resourceFilter, setResourceFilter] = useState<string>('all')
  const chatRef = useRef<HTMLDivElement>(null)

  // 切换阶段时清空资源
  const changeStep = (i: number) => {
    setStep(i)
    setResources([])
    setResourcesLoaded(false)
    setResourceFilter('all')
  }

  // 计算阶段进度
  const getPhaseProgress = (skills: string[]) => {
    if (!skills.length) return 0
    const mastered = skills.filter(s => masteredSkills.has(s)).length
    return Math.round((mastered / skills.length) * 100)
  }

  // 直接从诊断结果读取数据
  useEffect(() => {
    try {
      const raw = localStorage.getItem('jt_diagnosis_result')
      if (raw) {
        const data = JSON.parse(raw)
        // 检查诊断结果是否在24小时内，超过则视为过期
        const age = Date.now() - (data.timestamp || 0)
        if (age < 24 * 60 * 60 * 1000) {
          setTargetJob(data.job)
          setDiagnosis(data.result)
        } else {
          // 诊断结果过期，清除并引导重新诊断
          localStorage.removeItem('jt_diagnosis_result')
        }
      }
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [chatLog])

  const sendMsg = async () => {
    const text = msg.trim()
    if (!text) return
    setMsg('')
    setChatLog(prev => [...prev, { role: 'user', text }, { role: 'tutu', text: '思考中...' }])
    try {
      // 构造诊断上下文
      const phases = buildPhases(diagnosis)
      const diagnosisContext = diagnosis ? {
        miss_skills: (diagnosis.skills?.miss || []).map((s: any) => typeof s === 'string' ? s : (s.skill || s.name || '')).filter(Boolean),
        phases: phases.map(p => p.title),
        target_job: targetJob?.title || '',
      } : null
      // 构建聊天历史（后端取最后6条）
      const history = chatLog
        .filter(m => m.text !== '思考中...')
        .slice(-6)
        .map(m => ({
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
      const reply = (d && d.answer) ? d.answer : getTutuResponse(text)
      setChatLog(prev => [...prev.slice(0, -1), { role: 'tutu', text: reply }])
    } catch (e) {
      setChatLog(prev => [...prev.slice(0, -1), { role: 'tutu', text: getTutuResponse(text) }])
    }
  }

  const loadResources = async (skills: string[]) => {
    setLoadingResources(true)
    setResourcesLoaded(true)
    const res = await fetchResources(skills)
    setResources(res)
    setLoadingResources(false)
  }

  const phases = buildPhases(diagnosis)

  // 未有诊断结果
  if (!targetJob || !diagnosis) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl border p-6" style={{ borderColor: 'var(--color-outline-variant)', background: 'linear-gradient(135deg, var(--color-primary-fixed) 0%, var(--color-surface-container-lowest) 100%)' }}>
          <div className="flex items-center gap-6">
            <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }} className="flex flex-col items-center gap-1">
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl" style={{ background: 'linear-gradient(135deg, #FFD700, #FFA500)' }}>
                  <Star className="h-8 w-8 text-white" />
                </div>
                <motion.div className="absolute -top-1 -right-1 text-xs" animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 2, repeat: Infinity }}>✨</motion.div>
              </div>
              <span className="text-xs font-bold mt-1" style={{ color: 'var(--accent-orange)' }}>星星</span>
            </motion.div>
            <div className="flex-1">
              <h1 className="text-lg md:text-2xl font-extrabold gradient-text">星星 ✦ 图图</h1>
              <p className="text-sm mt-1 font-medium" style={{ color: 'var(--color-on-surface)' }}>请先完成岗位诊断，再进入学习 🎯</p>
            </div>
            <motion.div animate={{ y: [0, 6, 0] }} transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }} className="flex flex-col items-center gap-1">
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl" style={{ background: 'linear-gradient(135deg, #00C8FF, #7C3AED)' }}>
                  <MessageCircle className="h-8 w-8 text-white" />
                </div>
                <motion.div className="absolute -top-1 -right-1 text-xs" animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 2.5, repeat: Infinity, delay: 0.5 }}>💬</motion.div>
              </div>
              <span className="text-xs font-bold mt-1" style={{ color: 'var(--color-primary)' }}>图图</span>
            </motion.div>
          </div>
        </motion.div>
        <div className="rounded-2xl border p-8 text-center" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
          <Target className="h-12 w-12 mx-auto mb-4" style={{ color: 'var(--color-primary)' }} />
          <p className="text-sm font-medium mb-2" style={{ color: 'var(--color-on-surface)' }}>还没有诊断结果</p>
          <p className="text-xs mb-4" style={{ color: 'var(--color-on-surface-variant)' }}>请先在岗位页面选择岗位进行诊断，然后进入学习</p>
          <button onClick={() => setPage('match')}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
            style={{ background: 'var(--color-primary)' }}>
            去选择岗位
          </button>
        </div>
      </div>
    )
  }

  // 有诊断结果
  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      {/* 头部 */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl border p-6" style={{ borderColor: 'var(--color-outline-variant)', background: 'linear-gradient(135deg, var(--color-primary-fixed) 0%, var(--color-surface-container-lowest) 100%)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }} className="flex flex-col items-center gap-1">
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl" style={{ background: 'linear-gradient(135deg, #FFD700, #FFA500)' }}>
                  <Star className="h-8 w-8 text-white" />
                </div>
                <motion.div className="absolute -top-1 -right-1 text-xs" animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 2, repeat: Infinity }}>✨</motion.div>
              </div>
              <span className="text-xs font-bold mt-1" style={{ color: 'var(--accent-orange)' }}>星星</span>
              <span className="text-[9px]" style={{ color: 'var(--color-on-surface-variant)' }}>路径规划师</span>
            </motion.div>
            <div className="flex-1">
              <h1 className="text-lg md:text-2xl font-extrabold gradient-text">星星 ✦ 图图</h1>
              <p className="text-sm mt-1 font-medium" style={{ color: 'var(--color-on-surface)' }}>目标：{targetJob.title} · {targetJob.company}</p>
              <div className="flex items-center gap-4 mt-2">
                <span className="text-xs flex items-center gap-1" style={{ color: 'var(--color-primary)' }}><Target className="h-3.5 w-3.5" /> 匹配度 {diagnosis ? Math.round(diagnosis.overall) : '-'}{diagnosis?.grade && <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ background: 'var(--color-primary)', color: 'white' }}>{diagnosis.grade}</span>}</span>
                <span className="text-xs flex items-center gap-1" style={{ color: 'var(--accent-green)' }}><CheckCircle className="h-3.5 w-3.5" /> 已掌握 {masteredSkills.size}</span>
                <span className="text-xs flex items-center gap-1" style={{ color: 'var(--accent-red)' }}><Zap className="h-3.5 w-3.5" /> 待提升 {diagnosis?.skills?.miss?.length || 0}</span>
              </div>
              <p className="text-[11px] mt-2" style={{ color: 'var(--color-on-surface-variant)' }}>
                {diagnosis?.skills?.miss && diagnosis.skills.miss.length > 0
                  ? `你还有 ${diagnosis.skills.miss.length} 项技能待提升，按下方路径逐步掌握 💪`
                  : '🎉 所有技能已掌握，可以重新诊断查看进步！'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => { localStorage.removeItem('jt_diagnosis_result'); setPage('match') }} className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium border" style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}><RotateCcw className="h-3.5 w-3.5" /> 重新诊断</button>
            <button onClick={() => { setTargetJob(null); setDiagnosis(null); localStorage.removeItem('jt_diagnosis_result'); localStorage.removeItem('jt_diagnosis_job'); localStorage.removeItem('jt_diagnosis_skills'); setPage('match') }} className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium border" style={{ borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface-variant)' }}>换岗位</button>
          </div>
        </div>
      </motion.div>

      {/* 当前重点快捷区 */}
      {phases.length > 0 && phases[step] && (
        <div className="rounded-2xl border p-4" style={{ borderColor: `${phases[step].color}30`, background: `${phases[step].color}08` }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold" style={{ color: phases[step].color }}>📌 当前重点</span>
              <div className="flex items-center gap-2">
                {phases[step].skills.slice(0, 3).map(s => {
                  const isMastered = masteredSkills.has(s)
                  return (
                    <button key={s} onClick={() => toggleMastered(s)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all hover:scale-105"
                      style={{
                        background: isMastered ? 'var(--accent-green)' : 'white',
                        color: isMastered ? 'white' : phases[step].color,
                        border: `1px solid ${isMastered ? 'var(--accent-green)' : phases[step].color}40`,
                      }}>
                      {isMastered ? <CheckCircle className="h-3 w-3" /> : <span className="h-3 w-3 flex items-center justify-center rounded-full border text-[8px]" style={{ borderColor: phases[step].color }}>+</span>}
                      {s}
                    </button>
                  )
                })}
                {phases[step].skills.length > 3 && (
                  <span className="text-[10px]" style={{ color: 'var(--color-on-surface-variant)' }}>+{phases[step].skills.length - 3}</span>
                )}
              </div>
            </div>
            <button onClick={() => loadResources(phases[step].skills)}
              className="text-[11px] px-3 py-1.5 rounded-lg font-medium transition-all hover:opacity-80"
              style={{ color: phases[step].color, background: `${phases[step].color}15`, border: `1px solid ${phases[step].color}30` }}>
              查看资源 →
            </button>
          </div>
        </div>
      )}

      {/* 路径进度 */}
      {phases.length > 0 && (
        <div className="rounded-2xl border p-5" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold" style={{ color: 'var(--color-on-surface)' }}>学习路径</h2>
            <span className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>预计 {phases.reduce((s, p) => s + (parseInt(p.duration) || 0), 0)} 周</span>
          </div>
          <div className="relative">
            <div className="absolute top-7 left-[18px] right-[18px] h-0.5" style={{ background: 'var(--color-outline-variant)' }}>
              <motion.div className="h-full" style={{ background: 'linear-gradient(90deg, var(--color-primary), var(--accent-purple))' }}
                initial={{ width: '0%' }} animate={{ width: `${((step + 1) / phases.length) * 100}%` }} transition={{ duration: 0.5 }} />
            </div>
            <div className="flex justify-between relative">
              {phases.map((p, i) => {
                const active = i <= step
                const current = i === step
                return (
                  <button key={p.phase} onClick={() => changeStep(i)} className="flex flex-col items-center gap-2 relative z-10">
                    <motion.div className={`flex items-center justify-center rounded-xl transition-all ${current ? 'ring-2 ring-offset-2' : ''}`}
                      style={{ width: 44, height: 44, background: active ? `linear-gradient(135deg, ${p.color}, ${p.color}cc)` : 'var(--color-surface)', borderColor: active ? p.color : 'var(--color-outline-variant)', borderWidth: current ? 2 : 1 }}
                      animate={current ? { scale: [1, 1.08, 1] } : {}} transition={{ duration: 2, repeat: current ? Infinity : 0 }}>
                      <p.icon className="h-5 w-5" style={{ color: active ? 'var(--color-on-primary)' : 'var(--color-on-surface-variant)' }} />
                    </motion.div>
                    <span className="text-[10px] font-semibold text-center leading-tight" style={{ color: active ? p.color : 'var(--color-on-surface-variant)', maxWidth: 64 }}>{p.title}</span>
                    <div className="w-14 flex flex-col items-center gap-0.5">
                      <div className="w-full h-1 rounded-full" style={{ background: 'var(--color-surface)' }}>
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${getPhaseProgress(p.skills)}%`, background: p.color }} />
                      </div>
                      <span className="text-[9px]" style={{ color: 'var(--color-on-surface-variant)' }}>{getPhaseProgress(p.skills)}% · {p.duration}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-12 gap-5">
        {/* 左侧：当前阶段详情 */}
        <div className="col-span-7 space-y-4">
          <AnimatePresence mode="wait">
            {phases[step] && (
              <motion.div key={step} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }}>
                <div className="rounded-2xl border p-5" style={{ borderColor: `${phases[step].color}30`, background: 'var(--color-surface-container-lowest)' }}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: `${phases[step].color}15` }}>
                      {(() => { const Icon = phases[step].icon; return <Icon className="h-5 w-5" style={{ color: phases[step].color }} /> })()}
                    </div>
                    <div>
                      <h3 className="text-base font-bold" style={{ color: 'var(--color-on-surface)' }}>{phases[step].phase}：{phases[step].title}</h3>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>{phases[step].duration} · {phases[step].tip}</p>
                    </div>
                  </div>
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold" style={{ color: 'var(--color-on-surface-variant)' }}>学习目标</p>
                      <span className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                        {phases[step].skills.filter(s => masteredSkills.has(s)).length}/{phases[step].skills.length} 已掌握
                      </span>
                    </div>
                    {/* 阶段进度条 */}
                    <div className="h-2 rounded-full mb-3" style={{ background: 'var(--color-surface)' }}>
                      <motion.div className="h-full rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${getPhaseProgress(phases[step].skills)}%` }}
                        transition={{ duration: 0.5 }}
                        style={{ background: `linear-gradient(90deg, ${phases[step].color}, ${phases[step].color}cc)` }} />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {phases[step].skills.map(s => {
                        const isMastered = masteredSkills.has(s)
                        return (
                          <div key={s} className="flex items-center gap-1">
                            <button onClick={() => loadResources([s])}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-80"
                              style={{
                                background: isMastered ? `${phases[step].color}25` : `${phases[step].color}10`,
                                color: phases[step].color,
                                textDecoration: isMastered ? 'line-through' : 'none',
                                opacity: isMastered ? 0.7 : 1,
                              }}>
                              {isMastered ? <CheckCircle className="h-3 w-3" /> : <BookOpen className="h-3 w-3" />}{s}
                            </button>
                            <button onClick={() => toggleMastered(s)}
                              className="h-6 w-6 rounded-full flex items-center justify-center text-xs transition-all hover:scale-110"
                              title={isMastered ? '取消掌握' : '标记为已掌握'}
                              style={{
                                background: isMastered ? 'var(--accent-green)' : 'var(--color-surface)',
                                color: isMastered ? '#fff' : 'var(--color-on-surface-variant)',
                                border: `1px solid ${isMastered ? 'var(--accent-green)' : 'var(--color-outline-variant)'}`,
                              }}>
                              {isMastered ? '✓' : '+'}
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                  {/* 学习资源区 */}
                  {phases[step].skills.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold" style={{ color: 'var(--color-on-surface-variant)' }}>学习资源</p>
                        {resources.length === 0 && !loadingResources && (
                          <button onClick={() => loadResources(phases[step].skills)}
                            className="text-[10px] px-2 py-1 rounded-md transition-all hover:opacity-80"
                            style={{ color: phases[step].color, background: `${phases[step].color}15` }}>
                            查看全部 →
                          </button>
                        )}
                      </div>
                      {loadingResources ? (
                        <div className="space-y-2">
                          {[1, 2].map(i => <div key={i} className="h-10 rounded-xl animate-pulse" style={{ background: 'var(--color-surface)' }} />)}
                        </div>
                      ) : resourcesLoaded && resources.length === 0 ? (
                        <div className="text-center py-4">
                          <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>暂无学习资源</p>
                          <p className="text-[10px] mt-1" style={{ color: 'var(--color-outline)' }}>管理员可在后台上传该技能的学习资源</p>
                        </div>
                      ) : resources.length > 0 ? (
                        <>
                          {/* 资源类型筛选 */}
                          <div className="flex gap-1.5 mb-2">
                            {['all', '视频', '文档', '教程'].map(type => {
                              const count = type === 'all' ? resources.length : resources.filter(r => r.type === type).length
                              if (type !== 'all' && count === 0) return null
                              return (
                                <button key={type} onClick={() => setResourceFilter(type)}
                                  className="px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all"
                                  style={{
                                    background: resourceFilter === type ? `${phases[step].color}20` : 'transparent',
                                    color: resourceFilter === type ? phases[step].color : 'var(--color-on-surface-variant)',
                                    border: `1px solid ${resourceFilter === type ? phases[step].color : 'var(--color-outline-variant)'}`,
                                  }}>
                                  {type === 'all' ? '全部' : type} ({count})
                                </button>
                              )
                            })}
                          </div>
                          <div className="space-y-2">
                            {resources
                              .filter(r => resourceFilter === 'all' || r.type === resourceFilter)
                              .slice(0, 6)
                              .map((r, j) => {
                                const isVideo = r.type === '视频'
                                const rColor = typeColors[r.type] || phases[step].color
                                return (
                                  <a key={j} href={r.url} target="_blank" rel="noopener noreferrer"
                                    className="flex items-center gap-3 p-2.5 rounded-xl transition-all hover:shadow-sm group"
                                    style={{ background: isVideo ? '#fef2f2' : 'var(--color-surface)', border: isVideo ? '1px solid #fecaca' : 'none' }}>
                                    <div className="flex h-8 w-8 items-center justify-center shrink-0 rounded-lg relative"
                                      style={{ background: `${rColor}15` }}>
                                      {(() => { const Icon = typeIcons[r.type] || BookOpen; return <Icon className="h-4 w-4" style={{ color: rColor }} /> })()}
                                      {isVideo && (
                                        <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full flex items-center justify-center"
                                          style={{ background: '#ef4444' }}>
                                          <Play className="h-2 w-2 text-white" fill="white" />
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-medium truncate group-hover:text-[var(--color-primary)]">{r.name}</p>
                                      <div className="flex items-center gap-1.5 mt-0.5">
                                        <span className="text-[10px] px-1.5 py-0.5 rounded"
                                          style={{ background: `${rColor}10`, color: rColor }}>
                                          {r.type}
                                        </span>
                                        {isVideo && <span className="text-[10px]" style={{ color: 'var(--color-on-surface-variant)' }}>视频教程</span>}
                                      </div>
                                    </div>
                                    <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--color-on-surface-variant)' }} />
                                  </a>
                                )
                              })}
                          </div>
                        </>
                      ) : null}
                    </div>
                  )}
                  <div className="mt-4 pt-4 border-t flex items-center gap-2 text-xs" style={{ borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface-variant)' }}>
                    <Sparkles className="h-3.5 w-3.5" style={{ color: '#FFD700' }} />
                    星星建议：{phases[step].tip}
                  </div>
                  <p className="text-[10px] mt-2" style={{ color: 'var(--color-on-surface-variant)' }}>💡 点击技能标签获取资源，点击 <span style={{ color: 'var(--accent-green)' }}>+ / ✓</span> 标记掌握状态</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 右侧：图图聊天 */}
        <div className="col-span-5">
          <div className="rounded-2xl border flex flex-col sticky top-24" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)', height: 480 }}>
            <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: 'var(--color-outline-variant)' }}>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'linear-gradient(135deg, #00C8FF, #7C3AED)' }}>
                <MessageCircle className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--color-on-surface)' }}>图图</p>
                <p className="text-[10px]" style={{ color: 'var(--color-on-surface-variant)' }}>AI 学习助手 · 已结合诊断结果</p>
              </div>
            </div>

            <div ref={chatRef} className="flex-1 overflow-y-auto p-4 space-y-3">
              {chatLog.map((c, i) => (
                <div key={i} className={`flex ${c.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${c.role === 'user' ? 'rounded-br-sm' : 'rounded-bl-sm'}`}
                    style={{
                      background: c.role === 'user' ? 'var(--color-primary)' : 'var(--color-surface)',
                      color: c.role === 'user' ? 'var(--color-on-primary)' : 'var(--color-on-surface)',
                      border: c.role === 'user' ? 'none' : '1px solid var(--color-outline-variant)',
                    }}>
                    {c.role === 'tutu' && <span className="text-xs font-bold mr-1" style={{ color: 'var(--color-primary)' }}>图图</span>}
                    <p className="text-xs leading-relaxed whitespace-pre-wrap">{c.text}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3 border-t flex gap-2" style={{ borderColor: 'var(--color-outline-variant)' }}>
              <input value={msg} onChange={e => setMsg(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMsg()}
                placeholder="问问图图学习问题..." className="flex-1 rounded-xl border px-3 py-2 text-xs outline-none"
                style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface)', color: 'var(--color-on-surface)' }} />
              <button onClick={sendMsg} className="px-4 py-2 rounded-xl text-xs font-semibold" style={{ background: 'var(--color-primary)', color: 'var(--color-on-primary)' }}>发送</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}