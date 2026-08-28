import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Target, AlertCircle, BookOpen, Sparkles, LogIn, RefreshCw } from 'lucide-react'
import { JSNav } from '../../lib/NavContext'
import { SkeletonCard } from '../../components/match/Skeleton'
import MatchScorePanel from '../../components/match/MatchScorePanel'
import GapAnalysisList from '../../components/match/GapAnalysisList'
import { groupMissingSkills, activePhases, estimateWeeks, totalWeeksOf, PHASE_TITLES } from '../../lib/learningPhases'

interface MatchResult {
  score_version: string
  overall: number
  grade: string
  dims: any
  skills: { have: any[]; miss: any[]; extra: string[] }
  summary: string
  recommendations: string[]
}

/** 诊断结果缓存有效期，与学习中心保持一致 */
const RESULT_TTL = 24 * 60 * 60 * 1000

type ErrorCode = 'AUTH_EXPIRED' | 'NO_PROFILE' | 'NOT_FOUND' | 'NETWORK' | 'SERVER'

interface ErrorState { code: ErrorCode; message: string }

function formatTime(ts?: number) {
  if (!ts) return ''
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function Diagnosis() {
  const { setPage } = JSNav.use()
  const [job, setJob] = useState<any>(null)
  const [result, setResult] = useState<MatchResult | null>(null)
  const [resultAt, setResultAt] = useState<number | undefined>()
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState<ErrorState | null>(null)

  const persistResult = useCallback((jobData: any, matchResult: MatchResult) => {
    const groups = groupMissingSkills(matchResult.skills?.miss)
    const phases = activePhases(groups).map((p, i) => ({
      phase: i + 1,
      title: PHASE_TITLES[p],
      duration: `${estimateWeeks(p, groups[p].length)} 周`,
      skills: groups[p],
      goals: groups[p].map(s => `掌握 ${s} 的基本使用`),
    }))
    const timestamp = Date.now()
    const fullResult = { job: jobData, result: matchResult, phases, timestamp }
    localStorage.setItem('jt_diagnosis_result', JSON.stringify(fullResult))

    const report = {
      id: timestamp,
      timestamp,
      jobId: jobData.id,
      jobTitle: jobData.title,
      jobCompany: jobData.company,
      jobLocation: jobData.location,
      jobSalary: jobData.salary,
      overall: Math.round(matchResult.overall),
      grade: matchResult.grade,
      haveCount: matchResult.skills.have.length,
      missCount: matchResult.skills.miss.length,
      phases,
      recommendations: matchResult.recommendations,
      skills: matchResult.skills,
      dims: matchResult.dims || null,
    }
    const history = JSON.parse(localStorage.getItem('jt_diagnosis_history') || '[]')
    history.unshift(report)
    localStorage.setItem('jt_diagnosis_history', JSON.stringify(history))
    setResultAt(timestamp)
  }, [])

  const runAnalyze = useCallback(async (jobData: any, skills: string[]) => {
    const token = localStorage.getItem('xingtu_token')
    if (!token) { setError({ code: 'AUTH_EXPIRED', message: '请先登录' }); return }
    setAnalyzing(true)
    setError(null)
    try {
      // 直接传技能数组，不再拼接「熟练掌握 X、Y」这种假简历文本
      // （后端会因此对假文本跑一次 LLM，并把置信度虚标成 0.92）
      const body: Record<string, any> = { job_id: jobData.id, use_profile_skills: true }
      if (skills.length) { body.skills = skills; body.use_profile_skills = false }

      const r = await fetch(`/api/match/analyze?token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!r.ok) {
        let message = `服务器错误 (${r.status})`
        try {
          const errData = await r.json()
          message = errData.detail || errData.message || message
        } catch { /* 响应体不是 JSON，保留默认文案 */ }
        if (r.status === 401) {
          setError({ code: 'AUTH_EXPIRED', message: '登录已过期，请重新登录' })
        } else if (r.status === 404) {
          setError({ code: 'NOT_FOUND', message: '岗位不存在，可能已被下线' })
        } else {
          setError({ code: 'SERVER', message })
        }
        return
      }

      const d = await r.json()
      if (!d.success) {
        if (d.code === 'NO_PROFILE') {
          setError({ code: 'NO_PROFILE', message: '暂无技能数据。请先在个人主页填写技能，或上传简历后重试。' })
        } else {
          setError({ code: 'SERVER', message: d.message || '分析失败' })
        }
        return
      }

      setResult(d.data)
      persistResult(jobData, d.data)
    } catch (e: any) {
      setError({ code: 'NETWORK', message: e?.message || '网络错误，请检查网络后重试' })
    } finally {
      setAnalyzing(false)
    }
  }, [persistResult])

  useEffect(() => {
    try {
      // 优先复用未过期的诊断结果（从 Dashboard 历史记录进入）
      const resultRaw = localStorage.getItem('jt_diagnosis_result')
      if (resultRaw) {
        const data = JSON.parse(resultRaw)
        const age = Date.now() - (data.timestamp || 0)
        if (data.job && data.result && age < RESULT_TTL) {
          setJob(data.job)
          setResult(data.result)
          setResultAt(data.timestamp)
          return
        }
        // 过期或结构不完整，清掉避免读到陈旧数据
        localStorage.removeItem('jt_diagnosis_result')
      }

      // 没有可用结果，检查是否有待诊断的岗位（从 JobMatch/JobDetail 进入）
      const raw = localStorage.getItem('jt_diagnosis_job')
      if (raw) {
        const j = JSON.parse(raw)
        const skillsRaw = localStorage.getItem('jt_diagnosis_skills')
        let skills: string[] = []
        try { skills = skillsRaw ? JSON.parse(skillsRaw) : [] } catch { skills = [] }
        setJob(j)
        runAnalyze(j, skills)
      }
    } catch { /* ignore */ }
  }, [runAnalyze])

  const handleGoToLearning = () => setPage('learning')

  const handleRediagnose = () => {
    if (!job) return
    localStorage.removeItem('jt_diagnosis_result')
    setResult(null)
    setResultAt(undefined)
    const skillsRaw = localStorage.getItem('jt_diagnosis_skills')
    let skills: string[] = []
    try { skills = skillsRaw ? JSON.parse(skillsRaw) : [] } catch { skills = [] }
    runAnalyze(job, skills)
  }

  if (!job) return (
    <div className="max-w-[1400px] mx-auto px-6 py-12">
      <div className="rounded-2xl border p-8 text-center max-w-md mx-auto" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
        <AlertCircle className="h-10 w-10 mx-auto mb-3" style={{ color: 'var(--color-outline)' }} />
        <p className="text-sm font-medium mb-4" style={{ color: 'var(--color-on-surface-variant)' }}>未选择岗位</p>
        <button onClick={() => setPage('match')} className="px-4 py-2 rounded-lg text-xs font-semibold text-white" style={{ background: 'var(--color-primary)' }}>返回匹配</button>
      </div>
    </div>
  )

  if (error) return (
    <div className="max-w-[1400px] mx-auto px-6 py-12">
      <div className="rounded-2xl border p-8 text-center max-w-md mx-auto" style={{ borderColor: 'rgba(220,38,38,0.2)', background: 'rgba(220,38,38,0.04)' }}>
        <AlertCircle className="h-10 w-10 mx-auto mb-3" style={{ color: 'var(--accent-red)' }} />
        <p className="text-sm font-medium mb-1" style={{ color: 'var(--accent-red)' }}>分析失败</p>
        <p className="text-xs mb-4" style={{ color: 'var(--color-on-surface-variant)' }}>{error.message}</p>
        <div className="flex gap-2 justify-center">
          {error.code !== 'AUTH_EXPIRED' && (
            <button onClick={handleRediagnose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-white flex items-center gap-1" style={{ background: 'var(--color-primary)' }}>
              <RefreshCw className="h-3.5 w-3.5" /> 重试
            </button>
          )}
          <button onClick={() => setPage('match')}
            className="px-4 py-2 rounded-lg text-xs font-semibold border" style={{ borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface-variant)' }}>返回</button>
          {error.code === 'AUTH_EXPIRED' && (
            <button onClick={() => { localStorage.removeItem('xingtu_token'); localStorage.removeItem('xingtu_role'); window.location.href = '/login/jobseeker' }}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-white flex items-center gap-1" style={{ background: 'var(--color-primary)' }}>
              <LogIn className="h-3.5 w-3.5" /> 重新登录
            </button>
          )}
        </div>
      </div>
    </div>
  )

  const groups = result ? groupMissingSkills(result.skills?.miss) : { high: [], medium: [], low: [] }
  const phases = activePhases(groups).map((p, i) => ({
    phase: i + 1,
    title: PHASE_TITLES[p],
    duration: `${estimateWeeks(p, groups[p].length)} 周`,
    skills: groups[p],
  }))
  const totalWeeks = totalWeeksOf(groups)

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        <button onClick={() => setPage('match')} className="flex items-center gap-1 text-sm font-medium" style={{ color: 'var(--color-on-surface-variant)' }}>
          <ArrowLeft className="h-4 w-4" /> 返回匹配
        </button>
        <h1 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--color-on-surface)' }}>
          <Target className="h-5 w-5" style={{ color: 'var(--color-primary)' }} /> 诊断结果：{job.title}
        </h1>
        {resultAt && !analyzing && (
          <div className="ml-auto flex items-center gap-3">
            <span className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>诊断于 {formatTime(resultAt)}</span>
            <button onClick={handleRediagnose}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border"
              style={{ borderColor: 'var(--color-outline-variant)', color: 'var(--color-primary)' }}>
              <RefreshCw className="h-3 w-3" /> 重新诊断
            </button>
          </div>
        )}
      </div>

      {analyzing && <div className="space-y-4">{[1, 2, 3].map(i => <SkeletonCard key={i} />)}</div>}

      {!analyzing && result && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <MatchScorePanel result={result} />
          <GapAnalysisList result={result} onGoToLearning={handleGoToLearning} />

          {/* 学习路径概览 + 进入学习按钮 */}
          {phases.length > 0 && (
            <div className="rounded-2xl border p-6" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold" style={{ color: 'var(--color-on-surface)' }}>学习路径规划</h3>
                  <p className="text-sm mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>
                    预计 {totalWeeks} 周完成，共 {phases.length} 个阶段
                  </p>
                </div>
                <button onClick={handleGoToLearning}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity"
                  style={{ background: 'var(--color-primary)' }}>
                  <BookOpen className="h-4 w-4" /> 进入学习
                </button>
              </div>
              <div className="space-y-3">
                {phases.map((p, i) => (
                  <div key={p.phase} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'var(--color-surface)' }}>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                      style={{ background: 'var(--color-primary)' }}>
                      {i + 1}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium" style={{ color: 'var(--color-on-surface)' }}>{p.title}</p>
                      <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                        {p.skills.slice(0, 3).join('、')}{p.skills.length > 3 ? ` 等${p.skills.length}项` : ''} · {p.duration}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 快捷操作 */}
          <div className="flex gap-3">
            <button onClick={() => setPage('match')}
              className="flex-1 h-11 rounded-xl text-sm font-semibold border flex items-center justify-center gap-2"
              style={{ borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface-variant)' }}>
              <Sparkles className="h-4 w-4" /> 匹配其他岗位
            </button>
            <button onClick={handleGoToLearning}
              className="flex-1 h-11 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2"
              style={{ background: 'var(--color-primary)' }}>
              <BookOpen className="h-4 w-4" /> 开始学习
            </button>
          </div>
        </motion.div>
      )}
    </div>
  )
}
