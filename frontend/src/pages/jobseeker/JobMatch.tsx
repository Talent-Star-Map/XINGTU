import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { AlertCircle, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, X } from 'lucide-react'
import { JSNav } from '../../lib/NavContext'
import JobSelector, { type JobSummary, type JobFilters, type SortKey, sortJobs } from '../../components/match/JobSelector'
import ResumeUploader from '../../components/match/ResumeUploader'

const PAGE_SIZE = 20

export default function JobMatch() {
  const { setPage } = JSNav.use()
  const [jobs, setJobs] = useState<JobSummary[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [filters, setFilters] = useState<JobFilters>({ keyword: '', city: '' })
  const [sort, setSort] = useState<SortKey>('match')
  const [page, setPageNum] = useState(1)

  const [recommendations, setRecommendations] = useState<any[]>([])
  const [analyzing, setAnalyzing] = useState(false)
  const analyzingRef = useRef(false)
  const [showSkillInput, setShowSkillInput] = useState(false)
  const [inputPage, setInputPage] = useState('')
  const [selSkills, setSelSkills] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('jt_selected_skills') || '[]') } catch { return [] }
  })

  const hasProfile = selSkills.length > 0
  const recIds = useMemo(() => recommendations.map(r => r.job_id).filter(Boolean), [recommendations])

  useEffect(() => { localStorage.setItem('jt_selected_skills', JSON.stringify(selSkills)) }, [selSkills])

  // 恢复个人资料里的技能（仅在本地没有选择时）
  useEffect(() => {
    const token = localStorage.getItem('xingtu_token') || ''
    if (!token) return
    fetch(`/api/auth/profile?token=${token}`)
      .then(r => r.json())
      .then(d => {
        const raw = d?.data?.skills
        if (!raw || selSkills.length > 0) return
        const list = Array.isArray(raw) ? raw.map(String) : String(raw).split(',').map(s => s.trim()).filter(Boolean)
        if (list.length) setSelSkills(list)
      })
      .catch(() => {})
    // 仅在挂载时执行一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 拉取岗位：推荐态按 id 取，浏览态走服务端分页
  useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams()
    if (recIds.length > 0) {
      params.set('ids', recIds.join(','))
    } else {
      params.set('page', String(page))
      params.set('size', String(PAGE_SIZE))
      if (filters.keyword) params.set('keyword', filters.keyword)
      if (filters.city) params.set('city', filters.city)
    }

    setLoading(true)
    setError('')
    fetch(`/api/jobs?${params.toString()}`)
      .then(r => {
        if (!r.ok) throw new Error(`服务器错误 (${r.status})`)
        return r.json()
      })
      .then(d => {
        if (cancelled) return
        if (d.success) {
          setJobs(d.data || [])
          setTotal(typeof d.total === 'number' ? d.total : (d.data || []).length)
        } else {
          setError(d.message || '岗位加载失败')
        }
      })
      .catch((e: any) => { if (!cancelled) setError(e?.message || '网络错误，无法加载岗位') })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [page, filters.keyword, filters.city, recIds.join(',')])

  // 条件变化即退出推荐态：用户主动搜索/筛选时，继续锁定 10 条推荐会造成「筛选没反应」的错觉
  const handleFiltersChange = useCallback((next: JobFilters) => {
    setFilters(prev => {
      if (prev.keyword === next.keyword && prev.city === next.city) return prev
      setPageNum(1)
      setRecommendations([])
      return next
    })
  }, [])

  const handleAutoMatch = useCallback(async (skills: string[]) => {
    const token = localStorage.getItem('xingtu_token')
    if (!token) { setError('请先登录后再使用智能匹配'); return }
    if (analyzingRef.current) return // 防重复点击：一次只允许一个匹配请求
    setSelSkills(skills)
    setAnalyzing(true)
    analyzingRef.current = true
    setError('')
    try {
      const r = await fetch(`/api/match/recommend?n=10&token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // 只传结构化技能列表，不再拼接「熟练掌握 X、Y」的假简历文本
        // n 双保险：query 和 body 都带（后端 query 优先）
        body: JSON.stringify({ skills, n: 10 }),
      })
      const d = await r.json()
      if (d.success && d.data?.length) {
        setRecommendations(d.data)
        setPageNum(1)
      } else {
        setError(d.message || '没有找到匹配你技能的岗位，试试补充更多技能')
      }
    } catch {
      setError('网络错误，智能匹配失败')
    } finally {
      setAnalyzing(false)
      analyzingRef.current = false
    }
  }, [])

  const clearRecommendations = useCallback(() => {
    setRecommendations([])
    setPageNum(1)
  }, [])

  const handleSelectJob = useCallback((job: JobSummary) => {
    localStorage.setItem('jt_job_detail', JSON.stringify(job))
    localStorage.setItem('jt_diagnosis_skills', JSON.stringify(selSkills))
    setPage('job-detail')
  }, [setPage, selSkills])

  const handleDiagnose = useCallback((job: JobSummary) => {
    localStorage.removeItem('jt_diagnosis_result') // 清除旧诊断结果，确保重新分析
    localStorage.setItem('jt_diagnosis_job', JSON.stringify(job))
    localStorage.setItem('jt_diagnosis_skills', JSON.stringify(selSkills))
    setPage('diagnosis')
  }, [setPage, selSkills])

  const totalPages = recIds.length > 0 ? 1 : Math.max(1, Math.ceil(total / PAGE_SIZE))
  const displayJobs = sortJobs(jobs, sort, recommendations)

  const jumpToPage = (p: number) => {
    setPageNum(Math.max(1, Math.min(p, totalPages)))
    setInputPage('')
  }

  const getPageNumbers = () => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
    const pages: (number | '...')[] = [1]
    if (page > 3) pages.push('...')
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i)
    if (page < totalPages - 2) pages.push('...')
    pages.push(totalPages)
    return pages
  }

  const pageBtn = 'p-2 rounded-lg disabled:opacity-30 hover:bg-black/5 transition-colors'

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8 space-y-6">
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--color-on-surface)' }}>岗位</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>基于技能画像推荐最适合的岗位</p>
      </div>

      {/* 错误提示改为横幅：一次接口失败不该清掉整个页面 */}
      {error && (
        <div className="rounded-xl border px-4 py-3 flex items-start gap-3"
          style={{ borderColor: 'rgba(220,38,38,0.2)', background: 'rgba(220,38,38,0.04)' }}>
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" style={{ color: 'var(--accent-red)' }} />
          <p className="text-xs flex-1" style={{ color: 'var(--accent-red)' }}>{error}</p>
          <button onClick={() => setError('')} aria-label="关闭提示"
            className="p-0.5 rounded hover:bg-black/5">
            <X className="h-3.5 w-3.5" style={{ color: 'var(--accent-red)' }} />
          </button>
        </div>
      )}

      <ResumeUploader hasProfile={hasProfile} showSkillInput={showSkillInput} selSkills={selSkills} onTagsChange={setSelSkills}
        analyzing={analyzing}
        onConfirm={(s) => { setSelSkills(s); setShowSkillInput(false); handleAutoMatch(s) }}
        onAutoMatch={(s) => { setSelSkills(s); setShowSkillInput(false); handleAutoMatch(s) }}
        onShowSkillInput={() => setShowSkillInput(true)} onSkip={() => setShowSkillInput(false)} onGoToResume={() => setPage('resume')} />

      {/* 推荐态：给一个明确的退出入口 */}
      {recommendations.length > 0 && (
        <div className="rounded-xl border p-4 flex items-center justify-between gap-3 flex-wrap"
          style={{ borderColor: 'var(--color-primary-fixed)', background: 'var(--color-primary-fixed)' }}>
          <p className="text-sm font-semibold" style={{ color: 'var(--color-primary)' }}>
            已为你筛出 {recommendations.length} 个匹配岗位
          </p>
          <button onClick={clearRecommendations}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border flex items-center gap-1"
            style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}>
            <X className="h-3 w-3" /> 返回全部岗位
          </button>
        </div>
      )}

      <JobSelector
        jobs={displayJobs}
        recommendations={recommendations}
        mode="recommend"
        selectedJobId={null}
        loading={loading || analyzing}
        filters={filters}
        onFiltersChange={handleFiltersChange}
        sort={sort}
        onSortChange={setSort}
        onSelectJob={handleSelectJob}
        onDiagnose={handleDiagnose}
      />

      {/* 分页 — 推荐态只有一页，不显示 */}
      {recIds.length === 0 && totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 pt-4 flex-wrap">
          <button disabled={page === 1} onClick={() => jumpToPage(1)} aria-label="第一页"
            className={pageBtn} style={{ color: 'var(--color-on-surface-variant)' }}>
            <ChevronsLeft className="h-4 w-4" />
          </button>
          <button disabled={page === 1} onClick={() => jumpToPage(page - 1)} aria-label="上一页"
            className={pageBtn} style={{ color: 'var(--color-on-surface-variant)' }}>
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
          <button disabled={page === totalPages} onClick={() => jumpToPage(page + 1)} aria-label="下一页"
            className={pageBtn} style={{ color: 'var(--color-on-surface-variant)' }}>
            <ChevronRight className="h-4 w-4" />
          </button>
          <button disabled={page === totalPages} onClick={() => jumpToPage(totalPages)} aria-label="最后一页"
            className={pageBtn} style={{ color: 'var(--color-on-surface-variant)' }}>
            <ChevronsRight className="h-4 w-4" />
          </button>
          <span className="text-sm ml-3" style={{ color: 'var(--color-outline-variant)' }}>共 {total} 条</span>
          <span className="text-sm mx-2" style={{ color: 'var(--color-outline-variant)' }}>|</span>
          <span className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>第</span>
          <input type="number" min={1} max={totalPages} value={inputPage} aria-label="跳转到页码"
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
