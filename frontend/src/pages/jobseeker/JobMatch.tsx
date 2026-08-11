import { useState, useEffect, useCallback } from 'react'
import { AlertCircle, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { JSNav } from '../../lib/NavContext'
import { SkeletonCard } from '../../components/match/Skeleton'
import ResumeUploader from '../../components/match/ResumeUploader'
import JobSelector from '../../components/match/JobSelector'

interface JobSummary { id: number; title: string; company: string; salary: string; location: string; skills: string[] }

const PAGE_SIZE = 20

export default function JobMatch() {
  const { setPage } = JSNav.use()
  const [allJobs, setAllJobs] = useState<JobSummary[]>([])
  const [filtered, setFiltered] = useState<JobSummary[]>([])
  const [analyzing, setAnalyzing] = useState(false)
  const [showSkillInput, setShowSkillInput] = useState(false)
  const [recommendations, setRecommendations] = useState<any[]>([])
  const [selSkills, setSelSkills] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('jt_selected_skills') || '[]') } catch { return [] }
  })
  const hasProfile = selSkills.length > 0
  const [page, setPageNum] = useState(1)
  const [error, setError] = useState('')
  const [inputPage, setInputPage] = useState('')

  useEffect(() => { localStorage.setItem('jt_selected_skills', JSON.stringify(selSkills)) }, [selSkills])

  // 加载全部数据
  useEffect(() => {
    fetch('/api/jobs?size=500').then(r => r.json()).then(d => {
      if (d.success && d.data?.length) {
        const mapped = d.data.map((j: any) => ({
          id: j.id, title: j.title, company: j.company,
          salary: j.salary, location: j.location, skills: j.skills || []
        }))
        setAllJobs(mapped)
        setFiltered(mapped)
      }
    }).catch(() => {})
    // 恢复用户技能
    fetch('/api/auth/profile?token=' + (localStorage.getItem('xingtu_token') || ''))
      .then(r => r.json()).then(d => {
        if (d.success && d.data?.skills && selSkills.length === 0) {
          setSelSkills(d.data.skills.split(',').map((s: string) => s.trim()).filter(Boolean))
        }
      }).catch(() => {})
  }, [])

  const total = filtered.length
  const totalPages = Math.ceil(total / PAGE_SIZE)
  const currentJobs = recommendations.length > 0
    ? recommendations.map(r => filtered.find(j => j.id === r.job_id)).filter(Boolean)
    : filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // 搜索/筛选变化时回调
  const handleFilterChange = useCallback((list: JobSummary[]) => {
    setFiltered(list)
    setPageNum(1)
  }, [])

  const handleAutoMatch = useCallback(async (skills: string[]) => {
    const t = localStorage.getItem('xingtu_token'); if (!t) return
    setSelSkills(skills); setAnalyzing(true)
    try {
      const r = await fetch(`/api/match/recommend?n=10&token=${t}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skills, resume_text: `熟练掌握 ${skills.join('、')}，有相关开发经验` })
      })
      const d = await r.json()
      if (d.success && d.data) setRecommendations(d.data)
    } catch { setError('网络错误') } finally { setAnalyzing(false) }
  }, [])

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

  const jumpToPage = (p: number) => {
    setPageNum(Math.max(1, Math.min(p, totalPages)))
    setInputPage('')
  }

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

  const getPageNumbers = () => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
    const pages: (number | '...')[] = [1]
    if (page > 3) pages.push('...')
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i)
    if (page < totalPages - 2) pages.push('...')
    pages.push(totalPages)
    return pages
  }

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8 space-y-6">
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--color-on-surface)' }}>岗位</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>基于技能画像推荐最适合的岗位</p>
      </div>
      <ResumeUploader hasProfile={hasProfile} showSkillInput={showSkillInput} selSkills={selSkills} onTagsChange={setSelSkills}
        onConfirm={(s) => { setSelSkills(s); setShowSkillInput(false); handleAutoMatch(s) }}
        onAutoMatch={(s) => { setSelSkills(s); setShowSkillInput(false); handleAutoMatch(s) }}
        onShowSkillInput={() => setShowSkillInput(true)} onSkip={() => setShowSkillInput(false)} onGoToResume={() => setPage('resume')} />
      {analyzing ? (
        <div className="space-y-4">{[1, 2, 3].map(i => <SkeletonCard key={i} />)}</div>
      ) : (
        <JobSelector jobs={allJobs} displayJobs={currentJobs} recommendations={recommendations} mode="recommend"
          selectedJobId={null} onSelectJob={handleSelectJob} onDiagnose={handleDiagnose}
          onFilterChange={handleFilterChange} />
      )}
      {/* 分页 - 有推荐结果时不显示 */}
      {recommendations.length === 0 && totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 pt-4 flex-wrap">
          <button disabled={page === 1} onClick={() => jumpToPage(1)}
            className="p-2 rounded-lg disabled:opacity-30 hover:bg-black/5 transition-colors"
            style={{ color: 'var(--color-on-surface-variant)' }}>
            <ChevronsLeft className="h-4 w-4" />
          </button>
          <button disabled={page === 1} onClick={() => jumpToPage(page - 1)}
            className="p-2 rounded-lg disabled:opacity-30 hover:bg-black/5 transition-colors"
            style={{ color: 'var(--color-on-surface-variant)' }}>
            <ChevronLeft className="h-4 w-4" />
          </button>
          {getPageNumbers().map((n, i) =>
            n === '...' ? (
              <span key={`e${i}`} className="px-1 text-sm" style={{ color: 'var(--color-outline-variant)' }}>...</span>
            ) : (
              <button key={n} onClick={() => jumpToPage(n)}
                className="w-9 h-9 rounded-lg text-sm font-medium transition-all"
                style={{
                  background: n === page ? 'var(--color-primary)' : 'transparent',
                  color: n === page ? 'var(--color-on-primary)' : 'var(--color-on-surface-variant)',
                }}>{n}</button>
            )
          )}
          <button disabled={page === totalPages} onClick={() => jumpToPage(page + 1)}
            className="p-2 rounded-lg disabled:opacity-30 hover:bg-black/5 transition-colors"
            style={{ color: 'var(--color-on-surface-variant)' }}>
            <ChevronRight className="h-4 w-4" />
          </button>
          <button disabled={page === totalPages} onClick={() => jumpToPage(totalPages)}
            className="p-2 rounded-lg disabled:opacity-30 hover:bg-black/5 transition-colors"
            style={{ color: 'var(--color-on-surface-variant)' }}>
            <ChevronsRight className="h-4 w-4" />
          </button>
          <span className="text-sm ml-3" style={{ color: 'var(--color-outline-variant)' }}>共 {total} 条</span>
          <span className="text-sm mx-2" style={{ color: 'var(--color-outline-variant)' }}>|</span>
          <span className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>第</span>
          <input type="number" min={1} max={totalPages} value={inputPage}
            onChange={e => setInputPage(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && inputPage) jumpToPage(parseInt(inputPage)) }}
            className="w-12 h-8 rounded border text-center text-sm outline-none focus:border-[var(--color-primary)]"
            style={{ borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface)' }} />
          <span className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>/ {totalPages} 页</span>
          <button onClick={() => inputPage && jumpToPage(parseInt(inputPage))}
            className="h-8 px-3 ml-1 rounded-lg text-sm font-medium text-white"
            style={{ background: 'var(--color-primary)' }}>跳转</button>
        </div>
      )}
    </div>
  )
}
