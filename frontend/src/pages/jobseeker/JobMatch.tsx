import { useState, useEffect, useCallback } from 'react'
import { Sparkles, AlertCircle } from 'lucide-react'
import { JSNav } from '../../lib/NavContext'
import { SkeletonCard } from '../../components/match/Skeleton'
import ResumeUploader from '../../components/match/ResumeUploader'
import JobSelector from '../../components/match/JobSelector'

interface JobSummary { id: number; title: string; company: string; salary: string; location: string; skills: string[] }

export default function JobMatch() {
  const { setPage } = JSNav.use()
  const [jobs, setJobs] = useState<JobSummary[]>([])
  const [analyzing, setAnalyzing] = useState(false)
  const [showSkillInput, setShowSkillInput] = useState(false)
  const [recommendations, setRecommendations] = useState<any[]>([])
  const [selSkills, setSelSkills] = useState<string[]>(() => {
    try { const raw = localStorage.getItem('jt_selected_skills'); return raw ? JSON.parse(raw) : [] } catch { return [] }
  })
  // 是否有技能数据：直接派生，避免闪烁（必须声明在 selSkills 之后）
  const hasProfile = selSkills.length > 0

  useEffect(() => {
    localStorage.setItem('jt_selected_skills', JSON.stringify(selSkills))
  }, [selSkills])
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [selectedCity, setSelectedCity] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  const loadJobs = useCallback(async () => {
    try { const r = await fetch('/api/jobs?size=50'); const d = await r.json()
      if (d.success && d.data?.length) setJobs(d.data.map((j: any) => ({ id: j.id, title: j.title, company: j.company, salary: j.salary, location: j.location, skills: j.skills || [] })))
    } catch { /* noop */ }
  }, [])

  const checkProfile = useCallback(async () => {
    const t = localStorage.getItem('xingtu_token'); if (!t) return
    try { const r = await fetch(`/api/auth/profile?token=${t}`); const d = await r.json()
      if (d.success && d.data?.skills) { const arr = (d.data.skills || '').split(',').map((s: string) => s.trim()).filter(Boolean); if (arr.length > 0 && selSkills.length === 0) setSelSkills(arr) }
    } catch { /* noop */ }
  }, [selSkills])

  useEffect(() => { loadJobs(); checkProfile() }, [loadJobs, checkProfile])

  const handleAutoMatch = useCallback(async (skills: string[]) => {
    const t = localStorage.getItem('xingtu_token'); if (!t) return
    setSelSkills(skills); setAnalyzing(true)
    try { const r = await fetch(`/api/match/recommend?limit=5&token=${t}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ skills, resume_text: skills.length ? `熟练掌握 ${skills.join('、')}，有相关开发经验` : undefined }) })
      const d = await r.json(); if (d.success && d.data) setRecommendations(d.data); else setRecommendations(jobs.map(j => ({ job_id: j.id, title: j.title, company: j.company, salary: j.salary, location: j.location, overall: 50, grade: 'C', top_missing: [] })).sort(() => Math.random() - 0.5).slice(0, 3))
    } catch { setError('网络错误') } finally { setAnalyzing(false) }
  }, [jobs])

  const handleSelectJob = useCallback((job: JobSummary) => {
    localStorage.setItem('jt_job_detail', JSON.stringify(job))
    localStorage.setItem('jt_diagnosis_skills', JSON.stringify(selSkills))
    setPage('job-detail')
  }, [setPage, selSkills])

  const handleDiagnose = useCallback((job: JobSummary) => {
    localStorage.setItem('jt_diagnosis_job', JSON.stringify(job))
    localStorage.setItem('jt_diagnosis_skills', JSON.stringify(selSkills))
    setPage('diagnosis')
  }, [setPage, selSkills])

  if (error) return (
    <div className="max-w-[1400px] mx-auto px-6 py-12">
      <div className="rounded-2xl border p-8 text-center max-w-md mx-auto" style={{ borderColor: 'rgba(220,38,38,0.2)', background: 'rgba(220,38,38,0.04)' }}>
        <AlertCircle className="h-10 w-10 mx-auto mb-3" style={{ color: 'var(--accent-red)' }} />
        <p className="text-sm font-medium mb-1" style={{ color: 'var(--accent-red)' }}>匹配失败</p>
        <p className="text-xs mb-4" style={{ color: 'var(--color-on-surface-variant)' }}>{error}</p>
        <button onClick={() => setError('')} className="px-4 py-2 rounded-lg text-xs font-semibold text-white" style={{ background: 'var(--color-primary)' }}>返回</button>
      </div>
    </div>
  )

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8 space-y-6">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--color-on-surface)' }}>
          岗位
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>基于技能画像推荐最适合的岗位</p>
      </div>
      <ResumeUploader hasProfile={hasProfile} showSkillInput={showSkillInput} selSkills={selSkills} onTagsChange={setSelSkills}
        onConfirm={(s) => { setSelSkills(s); setShowSkillInput(false); handleAutoMatch(s) }}
        onAutoMatch={(s) => { setSelSkills(s); setShowSkillInput(false); handleAutoMatch(s) }}
        onShowSkillInput={() => setShowSkillInput(true)} onSkip={() => setShowSkillInput(false)} onGoToResume={() => setPage('resume')} />
      {analyzing ? (
        <div className="space-y-4">{[1, 2, 3].map(i => <SkeletonCard key={i} />)}</div>
      ) : (
        <JobSelector jobs={jobs} recommendations={recommendations} mode="recommend" search={search}
          selectedCity={selectedCity} showFilters={showFilters}
          selectedJobId={null} onSearchChange={setSearch} onToggleFilters={() => setShowFilters(v => !v)}
          onSelectCity={setSelectedCity} onSelectJob={handleSelectJob} onDiagnose={handleDiagnose}
          onClearRecommendations={() => setRecommendations([])} />
      )}
    </div>
  )
}
