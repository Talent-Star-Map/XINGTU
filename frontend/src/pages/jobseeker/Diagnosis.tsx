import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Target, AlertCircle } from 'lucide-react'
import { JSNav } from '../../lib/NavContext'
import { SkeletonCard } from '../../components/match/Skeleton'
import MatchScorePanel from '../../components/match/MatchScorePanel'
import GapAnalysisList from '../../components/match/GapAnalysisList'
import LearningPath from '../../components/match/LearningPath'

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
    const t = localStorage.getItem('xingtu_token'); if (!t) return
    setAnalyzing(true); setError('')
    try {
      const body: Record<string, any> = { job_id: job.id, use_profile_skills: true }
      if (skills.length) { body.resume_text = `熟练掌握 ${skills.join('、')}`; body.use_profile_skills = false }
      const r = await fetch(`/api/match/analyze?token=${t}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const d = await r.json()
      if (!d.success) { setError(d.message || '分析失败'); setAnalyzing(false); return }
      setResult(d.data)
      const report = {
        id: Date.now(),
        jobTitle: job.title, jobCompany: job.company, jobLocation: job.location,
        jobSalary: job.salary, overall: Math.round(d.data.overall), grade: d.data.grade,
        haveCount: d.data.skills.have.length, missCount: d.data.skills.miss.length,
        phases: buildPhases(d.data), recommendations: d.data.recommendations,
      }
      // 同时写入单条（兼容详情页）和历史数组
      localStorage.setItem('jt_learning_report', JSON.stringify(report))
      const history = JSON.parse(localStorage.getItem('jt_diagnosis_history') || '[]')
      history.unshift(report)
      localStorage.setItem('jt_diagnosis_history', JSON.stringify(history))
    } catch (e: any) { setError(e.message || '网络错误') } finally { setAnalyzing(false) }
  }, [])

  useEffect(() => {
    try {
      const raw = localStorage.getItem('jt_diagnosis_job')
      const skillsRaw = localStorage.getItem('jt_diagnosis_skills')
      if (raw) {
        const j = JSON.parse(raw)
        const skills = skillsRaw ? JSON.parse(skillsRaw) : []
        setJob(j)
        runAnalyze(j, skills)
        localStorage.removeItem('jt_diagnosis_job')
        localStorage.removeItem('jt_diagnosis_skills')
      }
    } catch { /* ignore */ }
  }, [runAnalyze])

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
        <button onClick={() => setPage('match')} className="px-4 py-2 rounded-lg text-xs font-semibold text-white" style={{ background: 'var(--color-primary)' }}>返回</button>
      </div>
    </div>
  )

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
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
          <MatchScorePanel result={result} />
          <GapAnalysisList result={result} onGoToLearning={() => setPage('learning')} />
          <LearningPath
            phases={buildPhases(result)}
            totalWeeks={`${buildPhases(result).reduce((s: number, p: any) => s + (parseInt(p.duration) || 0), 0)} 周`}
            targetJobTitle={job.title}
            storageKey={job.id ? `jt_tl_${job.id}` : undefined}
          />
        </motion.div>
      )}
    </div>
  )
}
