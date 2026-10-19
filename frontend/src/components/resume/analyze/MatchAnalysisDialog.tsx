import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Search, Loader2, X, Target, ArrowRight, TrendingUp, BookOpen,
  CheckCircle2, AlertCircle, Briefcase, MapPin, Wallet,
} from 'lucide-react'

const getToken = () => localStorage.getItem('xingtu_token') || ''
const withToken = (url: string) => `${url}${url.includes('?') ? '&' : '?'}token=${getToken()}`

interface JobLite {
  id: number
  title: string
  company: string
  location?: string
  salary?: string
  education?: string
  experience?: string
  skills: string[]
}

interface Analysis {
  overall: number
  grade: string
  dims: Record<string, { score: number; weight: number; weighted: number }>
  skills: {
    have: { skill: string; matched_as: string; is_core: boolean; match_level: string }[]
    miss: { skill: string; priority: string; reason?: string; is_core: boolean; adjacent: boolean }[]
    extra: string[]
  }
  summary: string
  recommendations: string[]
}

interface Props {
  resumeId: number | string
  resumeTitle: string
  /** 简历里是否有技能内容：没有时后端会直接拒绝分析，前端先拦住 */
  hasSkills?: boolean
  onClose: () => void
  onToast: (msg: string) => void
}

const DIM_LABELS: Record<string, string> = {
  skill: '技能匹配',
  experience: '经验匹配',
  education: '学历匹配',
  salary: '薪资匹配',
}

const PRIORITY_COLOR: Record<string, string> = {
  high: 'var(--accent-red, #ef4444)',
  medium: 'var(--accent-orange, #f59e0b)',
  low: 'var(--color-on-surface-variant)',
}

function gradeColor(score: number): string {
  if (score >= 90) return '#10b981'
  if (score >= 80) return 'var(--accent-blue, #3b82f6)'
  if (score >= 70) return '#8b5cf6'
  if (score >= 60) return '#f59e0b'
  return '#ef4444'
}

export default function MatchAnalysisDialog({ resumeId, resumeTitle, hasSkills = true, onClose, onToast }: Props) {
  const [keyword, setKeyword] = useState('')
  const [jobs, setJobs] = useState<JobLite[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<JobLite | null>(null)
  const [salaryMin, setSalaryMin] = useState('')
  const [salaryMax, setSalaryMax] = useState('')
  const [showSalary, setShowSalary] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState<{ analysis: Analysis; job: JobLite; resumeSkills: string[] } | null>(null)

  const loadJobs = useCallback(async (kw: string) => {
    setSearching(true)
    try {
      const params = new URLSearchParams({ page: '1', size: '8' })
      if (kw.trim()) params.set('keyword', kw.trim())
      const r = await fetch(`/api/jobs?${params.toString()}`)
      const d = await r.json()
      if (d.success) setJobs(d.data || [])
    } catch {
      onToast('岗位列表加载失败')
    } finally {
      setSearching(false)
    }
  }, [onToast])

  useEffect(() => {
    const t = setTimeout(() => { loadJobs(keyword) }, 300)
    return () => clearTimeout(t)
  }, [keyword, loadJobs])

  const runAnalyze = async () => {
    if (!selected) { onToast('先选一个目标岗位'); return }
    setAnalyzing(true)
    try {
      const r = await fetch(withToken(`/api/resume-center/${resumeId}/analyze`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: selected.id,
          salary_min: Number(salaryMin || 0) * 1000,
          salary_max: Number(salaryMax || 0) * 1000,
        }),
      })
      const d = await r.json()
      if (!d.success) { onToast(d.error?.message || '分析失败'); return }
      setResult({
        analysis: d.data.analysis,
        job: d.data.job,
        resumeSkills: d.data.profile_echo?.skills || [],
      })
    } catch {
      onToast('网络错误，分析失败')
    } finally {
      setAnalyzing(false)
    }
  }

  const goDiagnosis = () => {
    if (!result) return
    localStorage.removeItem('jt_diagnosis_result')
    localStorage.setItem('jt_diagnosis_job', JSON.stringify(result.job))
    // 这里放的是「我的技能」，不是岗位要求的技能：诊断页会把它当 profile 传给匹配接口，
    // 传成岗位技能会让诊断结果和刚才这次分析对不上
    localStorage.setItem('jt_diagnosis_skills', JSON.stringify(result.resumeSkills))
    window.location.hash = '#/diagnosis'
    onClose()
  }

  const goJobDetail = () => {
    if (!result) return
    localStorage.setItem('jt_job_detail', JSON.stringify(result.job))
    window.location.hash = '#/job-detail'
    onClose()
  }

  const score = result?.analysis.overall ?? 0
  const ring = useMemo(() => {
    const r = 46
    const c = 2 * Math.PI * r
    return { r, c, dash: (score / 100) * c }
  }, [score])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={onClose}>
      <motion.div initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        className="w-full max-w-4xl max-h-[88vh] overflow-hidden rounded-2xl shadow-2xl flex flex-col"
        style={{ background: 'var(--color-surface-container-lowest)' }}
        onClick={e => e.stopPropagation()}>

        {/* 头部 */}
        <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: 'var(--color-outline-variant)' }}>
          <div className="min-w-0">
            <h3 className="text-base font-semibold flex items-center gap-2" style={{ color: 'var(--color-on-surface)' }}>
              <Target className="h-4 w-4" style={{ color: 'var(--accent-blue)' }} /> 简历岗位匹配分析
            </h3>
            <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--color-on-surface-variant)' }}>
              {resumeTitle} · 与平台岗位比一次，看清差距
            </p>
          </div>
          <button onClick={onClose} style={{ color: 'var(--color-on-surface-variant)' }}><X className="h-4 w-4" /></button>
        </div>

        {!result ? (
          <>
            {/* 选岗位 */}
            <div className="flex-1 overflow-auto px-6 py-4">
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--color-on-surface-variant)' }} />
                <input value={keyword} onChange={e => setKeyword(e.target.value)}
                  placeholder="搜岗位名、公司或技能，如 Python、后端"
                  className="w-full h-10 pl-9 pr-3 rounded-xl text-sm border outline-none"
                  style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface)', color: 'var(--color-on-surface)' }} />
              </div>

              <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-outline-variant)' }}>
                {searching ? (
                  <div className="flex items-center justify-center py-10 gap-2 text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
                    <Loader2 className="h-4 w-4 animate-spin" /> 加载岗位…
                  </div>
                ) : jobs.length === 0 ? (
                  <p className="py-10 text-center text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
                    没有找到岗位，换个关键词试试
                  </p>
                ) : (
                  <ul className="divide-y" style={{ borderColor: 'var(--color-outline-variant)' }}>
                    {jobs.map(j => {
                      const active = selected?.id === j.id
                      return (
                        <li key={j.id}>
                          <button onClick={() => setSelected(j)}
                            className="w-full px-4 py-3 text-left transition-colors hover:bg-black/[0.03]"
                            style={{ background: active ? 'var(--accent-blue-dim, #dbeafe)' : 'transparent' }}>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium truncate" style={{ color: 'var(--color-on-surface)' }}>{j.title}</span>
                              {active && <CheckCircle2 className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--accent-blue)' }} />}
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>
                              <span className="inline-flex items-center gap-1"><Briefcase className="h-3 w-3" />{j.company || '—'}</span>
                              <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{j.location || '不限'}</span>
                              <span className="inline-flex items-center gap-1"><Wallet className="h-3 w-3" />{j.salary}</span>
                              <span>{j.experience || '经验不限'} · {j.education || '学历不限'}</span>
                            </div>
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {(j.skills || []).slice(0, 6).map(s => (
                                <span key={s} className="text-[10px] px-1.5 py-0.5 rounded"
                                  style={{ background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface-variant)' }}>{s}</span>
                              ))}
                            </div>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>

              {/* 期望薪资（可选） */}
              <div className="mt-4">
                <button onClick={() => setShowSalary(v => !v)} className="text-xs underline"
                  style={{ color: 'var(--color-on-surface-variant)' }}>
                  {showSalary ? '收起' : '补充期望薪资（可选，能提高薪资维度准确度）'}
                </button>
                {showSalary && (
                  <div className="mt-2 flex items-center gap-2 text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                    <input value={salaryMin} onChange={e => setSalaryMin(e.target.value.replace(/\D/g, ''))}
                      placeholder="最低 K" className="w-24 h-8 px-2 rounded-lg border outline-none"
                      style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface)', color: 'var(--color-on-surface)' }} />
                    <span>—</span>
                    <input value={salaryMax} onChange={e => setSalaryMax(e.target.value.replace(/\D/g, ''))}
                      placeholder="最高 K" className="w-24 h-8 px-2 rounded-lg border outline-none"
                      style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface)', color: 'var(--color-on-surface)' }} />
                    <span>K / 月，不填按中性分计算</span>
                  </div>
                )}
              </div>
            </div>

            <div className="shrink-0 flex items-center justify-between px-6 py-3 border-t"
              style={{ borderColor: 'var(--color-outline-variant)' }}>
              <span className="text-xs" style={{ color: hasSkills ? 'var(--color-on-surface-variant)' : '#b45309' }}>
                {!hasSkills
                  ? '这份简历还没有技能内容，先在「技能特长」里补几项'
                  : selected ? `已选：${selected.title}` : '选一个岗位开始分析'}
              </span>
              <button onClick={runAnalyze} disabled={!selected || analyzing || !hasSkills}
                className="h-9 px-5 rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50"
                style={{ background: 'var(--accent-blue)', color: '#fff' }}>
                {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <TrendingUp className="h-4 w-4" />}
                {analyzing ? '分析中…' : '开始分析'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex-1 overflow-auto px-6 py-5">
              {/* 概览 */}
              <div className="flex items-center gap-6 rounded-2xl p-5"
                style={{ background: 'var(--color-surface-container)' }}>
                <div className="relative shrink-0">
                  <svg width="112" height="112" viewBox="0 0 112 112">
                    <circle cx="56" cy="56" r={ring.r} fill="none" stroke="var(--color-surface-container-high)" strokeWidth="10" />
                    <circle cx="56" cy="56" r={ring.r} fill="none" stroke={gradeColor(score)} strokeWidth="10"
                      strokeLinecap="round" strokeDasharray={`${ring.dash} ${ring.c}`}
                      transform="rotate(-90 56 56)" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold tabular-nums" style={{ color: gradeColor(score) }}>{score}</span>
                    <span className="text-[10px]" style={{ color: 'var(--color-on-surface-variant)' }}>{result.analysis.grade} 级</span>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color: 'var(--color-on-surface)' }}>
                    {result.job.title} · {result.job.company}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>
                    {result.analysis.summary}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-3 text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>
                    <span>{result.job.location || '地点不限'}</span>
                    <span>{result.job.salary}</span>
                    <span>{result.job.experience || '经验不限'}</span>
                  </div>
                </div>
              </div>

              {/* 四维 */}
              <div className="mt-4 grid grid-cols-2 gap-3">
                {Object.entries(result.analysis.dims).map(([key, d]) => (
                  <div key={key} className="rounded-xl border p-3" style={{ borderColor: 'var(--color-outline-variant)' }}>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span style={{ color: 'var(--color-on-surface)' }}>{DIM_LABELS[key] || key}</span>
                      <span className="tabular-nums" style={{ color: 'var(--color-on-surface-variant)' }}>
                        {d.score} <span className="text-[10px]">× {Math.round(d.weight * 100)}%</span>
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-surface-container-high)' }}>
                      <div className="h-full rounded-full" style={{ width: `${Math.min(d.score, 100)}%`, background: gradeColor(d.score) }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* 命中 / 缺失 */}
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold mb-2 flex items-center gap-1" style={{ color: 'var(--color-on-surface)' }}>
                    <CheckCircle2 className="h-3.5 w-3.5" style={{ color: '#10b981' }} />
                    已命中 {result.analysis.skills.have.length}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {result.analysis.skills.have.length === 0 && (
                      <span className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>岗位要求的技能暂时都没对上</span>
                    )}
                    {result.analysis.skills.have.map(h => (
                      <span key={h.skill} className="text-[11px] px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(16,185,129,0.12)', color: '#059669' }}>
                        {h.skill}{h.match_level !== 'exact' ? ` ≈ ${h.matched_as}` : ''}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold mb-2 flex items-center gap-1" style={{ color: 'var(--color-on-surface)' }}>
                    <AlertCircle className="h-3.5 w-3.5" style={{ color: 'var(--accent-orange, #f59e0b)' }} />
                    还缺 {result.analysis.skills.miss.length}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {result.analysis.skills.miss.length === 0 && (
                      <span className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>岗位要求的技能全部命中</span>
                    )}
                    {result.analysis.skills.miss.map(m => (
                      <span key={m.skill} className="text-[11px] px-2 py-0.5 rounded-full"
                        style={{ background: 'var(--color-surface-container-high)', color: PRIORITY_COLOR[m.priority] }}>
                        {m.skill}{m.adjacent ? ' ·有邻接基础' : ''}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* 建议 */}
              {result.analysis.recommendations.length > 0 && (
                <div className="mt-4 rounded-xl border p-3" style={{ borderColor: 'var(--color-outline-variant)' }}>
                  <p className="text-xs font-semibold mb-2" style={{ color: 'var(--color-on-surface)' }}>改进建议</p>
                  <ul className="space-y-1">
                    {result.analysis.recommendations.map((r, i) => (
                      <li key={i} className="text-[11px] leading-relaxed flex gap-1.5" style={{ color: 'var(--color-on-surface-variant)' }}>
                        <span style={{ color: 'var(--accent-blue)' }}>·</span><span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="shrink-0 flex items-center justify-between px-6 py-3 border-t"
              style={{ borderColor: 'var(--color-outline-variant)' }}>
              <button onClick={() => setResult(null)} className="text-xs underline" style={{ color: 'var(--color-on-surface-variant)' }}>
                换一个岗位
              </button>
              <div className="flex items-center gap-2">
                <button onClick={goJobDetail} className="h-9 px-4 rounded-lg text-sm border"
                  style={{ borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface-variant)' }}>
                  看岗位详情
                </button>
                <button onClick={goDiagnosis} className="h-9 px-4 rounded-lg text-sm font-medium flex items-center gap-1.5"
                  style={{ background: 'var(--accent-blue)', color: '#fff' }}>
                  <BookOpen className="h-4 w-4" /> 去诊断看学习路径 <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </>
        )}
      </motion.div>
    </div>
  )
}
