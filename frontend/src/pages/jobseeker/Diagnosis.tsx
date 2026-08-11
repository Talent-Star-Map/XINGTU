import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Target, AlertCircle, BookOpen, Sparkles, LogIn } from 'lucide-react'
import { JSNav } from '../../lib/NavContext'
import { SkeletonCard } from '../../components/match/Skeleton'
import MatchScorePanel from '../../components/match/MatchScorePanel'
import GapAnalysisList from '../../components/match/GapAnalysisList'

interface MatchResult {
  score_version: string
  overall: number
  grade: string
  dims: any
  skills: { have: any[]; miss: any[]; extra: string[] }
  summary: string
  recommendations: string[]
}

export default function Diagnosis() {
  const { setPage } = JSNav.use()
  const [job, setJob] = useState<any>(null)
  const [result, setResult] = useState<MatchResult | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState('')

  const buildPhases = (r: MatchResult) => {
    const miss = r.skills.miss; if (!miss.length) return []
    const groups: Record<string, any[]> = { high: [], medium: [], low: [] }
    miss.forEach((s: any) => { const k = s.priority === 'high' ? 'high' : s.priority === 'medium' ? 'medium' : 'low'; groups[k].push(s) })
    const phases: any[] = []; const titles = ['核心技能补齐', '进阶能力提升', '拓宽技能栈']; const baseWeeks = [2, 3, 2]
    ;(['high', 'medium', 'low'] as const).forEach((p, i) => {
      const eta = p === 'high' ? 1 : p === 'medium' ? 0.5 : 0.3
      const weeks = Math.max(baseWeeks[i], Math.ceil(groups[p].length * eta))
      if (groups[p].length) phases.push({ phase: i + 1, title: titles[i], duration: `${weeks} 周`, skills: groups[p].map((s: any) => s.skill), etaPerSkill: eta, goals: groups[p].map((s: any) => `掌握 ${s.skill} 的基本使用`) })
    })
    return phases
  }

  const runAnalyze = useCallback(async (job: any, skills: string[]) => {
    const t = localStorage.getItem('xingtu_token')
    if (!t) { setError('请先登录'); setAnalyzing(false); return }
    setAnalyzing(true); setError('')
    try {
      const body: Record<string, any> = { job_id: job.id, use_profile_skills: true }
      if (skills.length) { body.resume_text = `熟练掌握 ${skills.join('、')}`; body.use_profile_skills = false }
      const r = await fetch(`/api/match/analyze?token=${t}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!r.ok) {
        // 尝试解析后端返回的具体错误信息
        let errMsg = `服务器错误 (${r.status})`
        try {
          const errData = await r.json()
          if (errData.detail) errMsg = errData.detail
          else if (errData.message) errMsg = errData.message
        } catch {}
        // 401 错误给出更友好的提示
        if (r.status === 401) errMsg = '登录已过期，请重新登录'
        setError(errMsg)
        setAnalyzing(false)
        return
      }
      const d = await r.json()
      if (!d.success) {
        const msg = d.message || '分析失败'
        // 针对 NO_PROFILE 错误给出更友好的提示
        if (d.code === 'NO_PROFILE') {
          setError('暂无技能数据。请先在个人主页填写技能，或上传简历后重试。')
        } else {
          setError(msg)
        }
        setAnalyzing(false); return
      }
      setResult(d.data)
      // 存储完整诊断结果，供学习页使用
      const fullResult = {
        job, result: d.data, phases: buildPhases(d.data),
        timestamp: Date.now(),
      }
      localStorage.setItem('jt_diagnosis_result', JSON.stringify(fullResult))
      // 写入历史
      const report = {
        id: Date.now(),
        jobId: job.id, jobTitle: job.title, jobCompany: job.company, jobLocation: job.location,
        jobSalary: job.salary, overall: Math.round(d.data.overall), grade: d.data.grade,
        haveCount: d.data.skills.have.length, missCount: d.data.skills.miss.length,
        phases: buildPhases(d.data), recommendations: d.data.recommendations,
        skills: d.data.skills,
      }
      const history = JSON.parse(localStorage.getItem('jt_diagnosis_history') || '[]')
      history.unshift(report)
      localStorage.setItem('jt_diagnosis_history', JSON.stringify(history))
    } catch (e: any) { setError(e.message || '网络错误') } finally { setAnalyzing(false) }
  }, [])

  useEffect(() => {
    try {
      // 优先检查是否已有诊断结果（从 Dashboard 历史记录进入）
      const resultRaw = localStorage.getItem('jt_diagnosis_result')
      if (resultRaw) {
        const data = JSON.parse(resultRaw)
        if (data.job && data.result) {
          setJob(data.job)
          setResult(data.result)
          return
        }
      }
      // 没有诊断结果，检查是否有待诊断的岗位（从 JobMatch/JobDetail 进入）
      const raw = localStorage.getItem('jt_diagnosis_job')
      const skillsRaw = localStorage.getItem('jt_diagnosis_skills')
      if (raw) {
        const j = JSON.parse(raw)
        const skills = skillsRaw ? JSON.parse(skillsRaw) : []
        setJob(j)
        runAnalyze(j, skills)
      }
    } catch { /* ignore */ }
  }, [runAnalyze])

  const handleGoToLearning = () => {
    // 诊断结果已存储在 jt_diagnosis_result，学习页直接读取
    setPage('learning')
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
        <p className="text-xs mb-4" style={{ color: 'var(--color-on-surface-variant)' }}>{error}</p>
        <div className="flex gap-2 justify-center">
          <button onClick={() => setPage('match')} className="px-4 py-2 rounded-lg text-xs font-semibold border" style={{ borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface-variant)' }}>返回</button>
          {error.includes('过期') && (
            <button onClick={() => { localStorage.removeItem('xingtu_token'); localStorage.removeItem('xingtu_role'); window.location.href = '/login/jobseeker' }}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-white flex items-center gap-1" style={{ background: 'var(--color-primary)' }}>
              <LogIn className="h-3.5 w-3.5" /> 重新登录
            </button>
          )}
        </div>
      </div>
    </div>
  )

  const phases = result ? buildPhases(result) : []
  const totalWeeks = phases.reduce((s: number, p: any) => s + (parseInt(p.duration) || 0), 0)

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => setPage('match')} className="flex items-center gap-1 text-sm font-medium" style={{ color: 'var(--color-on-surface-variant)' }}>
          <ArrowLeft className="h-4 w-4" /> 返回匹配
        </button>
        <h1 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--color-on-surface)' }}>
          <Target className="h-5 w-5" style={{ color: 'var(--color-primary)' }} /> 诊断结果：{job.title}
        </h1>
      </div>

      {analyzing && <div className="space-y-4">{[1, 2, 3].map(i => <SkeletonCard key={i} />)}</div>}

      {!analyzing && result && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <MatchScorePanel result={result} />
          <GapAnalysisList result={result} />

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
                {phases.map((p: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'var(--color-surface)' }}>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                      style={{ background: p.color || 'var(--color-primary)' }}>
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
