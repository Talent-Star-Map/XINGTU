import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, BookOpen, Video, FileText, CheckCircle, ArrowRight, Compass, Rocket, Brain, Zap, Target, RotateCcw, ExternalLink, Play } from 'lucide-react'
import { JSNav } from '../../lib/NavContext'
import { useLearning } from '../../lib/LearningContext'
import { groupMissingSkills, activePhases, estimateWeeks, PHASE_TITLES } from '../../lib/learningPhases'

interface Phase { phase: string; title: string; duration: string; icon: any; skills: string[]; resources: { name: string; type: string; url: string }[]; color: string; tip: string }
interface DiagnosisResult { overall: number; grade: string; phases: any[]; recommendations: string[]; skills: { have: any[]; miss: any[]; extra: string[] } }
interface Job { id: number; title: string; company: string; salary: string; location: string; skills: string[] }

const typeIcons: Record<string, any> = { '文档': FileText, '课程': Video, '教程': BookOpen, '文章': FileText, '项目': Rocket, '视频': Play }
const typeColors: Record<string, string> = { '文档': 'var(--color-primary)', '视频': '#ef4444', '教程': 'var(--accent-green)', '课程': 'var(--accent-purple)' }

/** 从诊断结果构建学习阶段（兼容 Diagnosis.tsx 和 LearningPath.tsx 两种数据格式） */
function buildPhases(diagnosis: DiagnosisResult | null): Phase[] {
  if (!diagnosis) return []
  // 已有 phases 且非空
  if (diagnosis.phases?.length) {
    const colorPool = ['#4263EB', '#8060C7', '#168B83', '#B47B26']
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
  const colorPool = ['#4263EB', '#8060C7', '#168B83']
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
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('xingtu_token') || ''}` },
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
    { role: 'tutu', text: '我是小星，可以结合你的岗位诊断解释知识点、拆解学习任务。今天想先学什么？' },
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
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('xingtu_token') || ''}`,
        },
        body: JSON.stringify({ message: text, diagnosis: diagnosisContext, history }),
        cache: 'no-store',
      })
      const d = await r.json()
      if (r.status === 401 || r.status === 403) {
        setChatLog(prev => [...prev.slice(0, -1), { role: 'tutu', text: '请先登录，登录过期后请重新登录。' }])
        return
      }
      if (!r.ok || !d?.answer) throw new Error('AI response unavailable')
      const reply = d.answer
      setChatLog(prev => [...prev.slice(0, -1), { role: 'tutu', text: reply }])
    } catch (e) {
      setChatLog(prev => [...prev.slice(0, -1), { role: 'tutu', text: 'AI 学习助手暂不可用，请稍后重试。' }])
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

  const panelStyle = { borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }
  const mutedStyle = { color: 'var(--color-on-surface-variant)' }
  const heading = <header className="flex flex-wrap items-end justify-between gap-4">
    <div>
      <p className="text-[11px] font-semibold tracking-[0.2em] uppercase mb-2" style={{ color: 'var(--color-primary)' }}>YOUR LEARNING JOURNEY</p>
      <h1 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--color-on-surface)' }}>学习中心</h1>
      <p className="mt-2 text-sm" style={mutedStyle}>从岗位要求出发，把每一次学习变成看得见的进步。</p>
    </div>
    <span className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs" style={panelStyle}><span className="h-1.5 w-1.5 rounded-full bg-violet-400" />小星陪你一起成长</span>
  </header>

  if (!targetJob || !diagnosis) {
    return <div className="learning-center max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-7">
      {heading}
      <section className="grid overflow-hidden rounded-3xl border lg:grid-cols-[1.15fr_0.85fr]" style={panelStyle}>
        <div className="p-7 sm:p-10 lg:p-12">
          <span className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium" style={{ color: 'var(--color-primary)', background: 'var(--color-primary-fixed)' }}><Compass className="h-3.5 w-3.5" />从一个目标开始</span>
          <h2 className="mt-6 text-3xl sm:text-4xl font-bold leading-[1.35] tracking-tight">你的下一步，<br />值得一条清晰的路径。</h2>
          <p className="mt-4 max-w-md text-sm leading-7" style={mutedStyle}>选择感兴趣的岗位，完成能力诊断。我们会结合岗位要求与已填写的技能，为你整理学习重点、阶段计划和相关资源。</p>
          <button onClick={() => setPage('match')} className="mt-7 inline-flex items-center gap-3 rounded-xl px-5 py-3.5 text-sm font-semibold transition hover:opacity-90 focus-visible:outline-offset-4" style={{ background: 'var(--color-primary)', color: 'var(--color-on-primary)' }}>选择目标岗位<ArrowRight className="h-4 w-4" /></button>
          <p className="mt-3 text-xs" style={mutedStyle}>完成岗位诊断后，在这里开启你的学习计划。</p>
        </div>
        <div className="relative flex min-h-72 items-center justify-center overflow-hidden p-8" style={{ background: 'linear-gradient(145deg, #eeecff, #f5f6ff 55%, #e8f2ff)' }} aria-hidden="true">
          <div className="absolute h-64 w-64 rounded-full border border-white bg-white/40" />
          <div className="absolute h-80 w-80 rounded-full border border-white/80" />
          <div className="relative w-64 -rotate-3 rounded-2xl border border-white bg-white/90 p-5 shadow-[0_16px_55px_-20px_rgba(69,61,120,0.25)]">
            <div className="flex items-center justify-between"><span className="text-[10px] tracking-widest font-semibold text-violet-500">LEARNING ROADMAP</span><Compass className="h-4 w-4 text-violet-400" /></div>
            <div className="mt-5 space-y-4">{[{ icon: Target, text: '找到目标', detail: '明确想去的方向' }, { icon: BookOpen, text: '补齐技能', detail: '让学习更有针对性' }, { icon: Rocket, text: '实践与成长', detail: '把知识变成自己的能力' }].map((item, index) => <div key={item.text} className="flex items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-500"><item.icon className="h-4 w-4" /></span><div><p className="text-xs font-semibold text-slate-700">{item.text}</p><p className="mt-0.5 text-[10px] text-slate-400">{item.detail}</p></div><span className="ml-auto text-xs text-violet-200">0{index + 1}</span></div>)}</div>
            <div className="mt-5 h-1 rounded-full bg-violet-50"><div className="h-full w-1/3 rounded-full bg-violet-300" /></div>
          </div>
        </div>
      </section>
      <section aria-label="学习流程" className="grid gap-4 md:grid-cols-3">
        {[{ icon: Target, title: '选择目标岗位', text: '从真实岗位出发，明确职责和技能要求。' }, { icon: Brain, title: '了解能力差距', text: '结合你的资料，梳理需要优先提升的技能。' }, { icon: BookOpen, title: '按计划逐步学习', text: '查看阶段任务与资源，记录自己的掌握情况。' }].map((item, index) => <div key={item.title} className="rounded-2xl border p-5" style={panelStyle}><div className="flex items-center justify-between"><item.icon className="h-5 w-5" style={{ color: 'var(--color-primary)' }} /><span className="text-xs font-medium opacity-40">0{index + 1}</span></div><h3 className="mt-4 text-sm font-semibold">{item.title}</h3><p className="mt-2 text-xs leading-6" style={mutedStyle}>{item.text}</p></div>)}
      </section>
    </div>
  }

  return (
    <div className="learning-center max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
      {heading}
      <section className="rounded-2xl border p-5 sm:p-7" style={panelStyle}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0"><p className="text-xs mb-2" style={mutedStyle}>当前学习目标</p><h2 className="text-xl font-bold">{targetJob.title}</h2><p className="mt-1 text-sm" style={mutedStyle}>{targetJob.company}</p></div>
          <button onClick={() => { localStorage.removeItem('jt_diagnosis_result'); setPage('match') }} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs" style={{ borderColor: 'var(--color-outline-variant)', color: 'var(--color-primary)' }}><RotateCcw className="h-3.5 w-3.5" />更换目标 / 重新诊断</button>
        </div>
      </section>
      {!phases.length && <section className="rounded-2xl border p-6" style={panelStyle}><CheckCircle className="h-6 w-6 mb-3 text-emerald-500" /><h2 className="font-semibold">当前没有待补齐的学习阶段</h2><p className="mt-2 text-sm leading-6" style={mutedStyle}>可继续向小星提问，安排项目实践，或更换岗位重新诊断。技能记录反映自评情况，实际能力仍需通过实践验证。</p></section>}
      {phases.length > 0 && <section aria-label="选择学习阶段" className="rounded-2xl border p-4 sm:p-5" style={panelStyle}>
        <div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-sm font-semibold">你的学习路径</h2><span className="text-xs" style={mutedStyle}>选择阶段，专注当前任务</span></div>
        <div className={`grid gap-3 ${phases.length > 2 ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2'}`}>
          {phases.map((phase, index) => {
            const selected = index === step
            return <button key={phase.phase} onClick={() => changeStep(index)} aria-pressed={selected} className="group flex items-center gap-3 rounded-xl border p-4 text-left transition-colors hover:border-blue-300 focus-visible:outline-offset-4" style={{ borderColor: selected ? 'var(--color-primary)' : 'var(--color-outline-variant)', background: selected ? 'var(--color-primary-fixed)' : 'var(--color-surface-container-lowest)' }}>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-semibold" style={{ background: selected ? 'var(--color-primary)' : 'var(--color-surface-container)', color: selected ? 'var(--color-on-primary)' : 'var(--color-on-surface-variant)' }}>{String(index + 1).padStart(2, '0')}</span>
              <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{phase.title}</span><span className="mt-1 block text-xs" style={mutedStyle}>{phase.duration} · {phase.skills.length} 项技能</span></span>
              {selected && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: 'var(--color-primary)' }} />}
            </button>
          })}
        </div>
      </section>}

      <div className="grid grid-cols-12 gap-5">
        {/* 左侧：当前阶段详情 */}
        <div className="col-span-12 lg:col-span-7 space-y-4">
          <AnimatePresence mode="wait">
            {phases[step] && (
              <motion.div key={step} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }}>
                <div className="rounded-2xl border p-5 sm:p-6" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
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
                      ) : <div className="rounded-xl border border-dashed px-4 py-5" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface)' }}><p className="text-xs leading-6" style={mutedStyle}>点击上方技能，查找对应的课程、文档与教程。</p></div>}
                    </div>
                  )}
                  <div className="mt-4 pt-4 border-t flex items-center gap-2 text-xs" style={{ borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface-variant)' }}>
                    <Sparkles className="h-3.5 w-3.5" style={{ color: '#FFD700' }} />
                    学习建议：{phases[step].tip}
                  </div>
                  <p className="text-[10px] mt-2" style={{ color: 'var(--color-on-surface-variant)' }}>💡 点击技能标签获取资源，点击 <span style={{ color: 'var(--accent-green)' }}>+ / ✓</span> 标记掌握状态</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 右侧：小星聊天 */}
        <div className="col-span-12 lg:col-span-5">
          <div className="rounded-2xl border flex flex-col lg:sticky lg:top-24 overflow-hidden" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)', height: 440 }}>
            <div className="flex items-center gap-3 px-5 py-4 border-b" style={{ borderColor: 'var(--color-outline-variant)' }}>
              <img src="/mascot/xiaogui/idle.png" alt="" className="h-10 w-10 rounded-xl bg-violet-50 object-contain" />
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--color-on-surface)' }}>小星</p>
                <p className="text-[10px]" style={{ color: 'var(--color-on-surface-variant)' }}>AI 学习助手 · 结合当前诊断</p>
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
                    {c.role === 'tutu' && <span className="text-xs font-bold mr-1" style={{ color: 'var(--color-primary)' }}>小星</span>}
                    <p className="text-sm leading-6 whitespace-pre-wrap">{c.text}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t flex gap-2" style={{ borderColor: 'var(--color-outline-variant)' }}>
              <input value={msg} onChange={e => setMsg(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMsg()}
                placeholder="问问小星学习问题..." className="min-w-0 flex-1 rounded-xl border px-3 py-2 text-xs outline-none"
                style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface)', color: 'var(--color-on-surface)' }} />
              <button onClick={sendMsg} className="px-4 py-2 rounded-xl text-xs font-semibold" style={{ background: 'var(--color-primary)', color: 'var(--color-on-primary)' }}>发送</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
