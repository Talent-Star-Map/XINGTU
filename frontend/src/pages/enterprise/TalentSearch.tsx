import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Search, ChevronDown, Loader2, RefreshCw, Mail, X, TrendingUp, GitCompare } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import ChatDialog from '../../components/ChatDialog'
import CompareStudio, { compareColor as getCompareColor } from '../../components/enterprise/CompareStudio'
import { EPNav } from '../../lib/NavContext'

// 候选人展开行的五维进度条配置(雷达区已迁移至 CompareStudio)
const DIMENSION_BARS = [
  { key: 'skill', label: '技能', color: 'var(--color-primary)' },
  { key: 'exp', label: '经验', color: 'var(--accent-cyan)' },
  { key: 'edu', label: '学历', color: 'var(--accent-orange)' },
  { key: 'location', label: '地域', color: 'var(--accent-green)' },
  { key: 'salary', label: '薪资', color: 'var(--accent-purple)' },
]

const COMPARE_TABS = [
  { key: 'overview', label: '综合画像' },
  { key: 'skills', label: '技能' },
  { key: 'background', label: '背景' },
  { key: 'salary', label: '薪资期望' },
  { key: 'ai', label: 'AI 深度分析' },
] as const

// 解析 "15K-25K" 这类期望薪资字符串
function parseSalaryRange(s: string): { lo: number; hi: number } | null {
  const nums = (s.match(/\d+(?:\.\d+)?/g) || []).map(Number)
  if (!nums.length) return null
  const lo = nums[0]
  const hi = nums.length > 1 ? nums[1] : nums[0]
  return { lo: Math.min(lo, hi), hi: Math.max(lo, hi) }
}

const EDU_LADDER = ['高中', '大专', '本科', '硕士', '博士']

const eduLevel = (edu: string) => {
  const i = EDU_LADDER.findIndex((x) => (edu || '').includes(x))
  return i
}

const expYears = (exp: string) => {
  const m = (exp || '').match(/(\d+)/)
  return m ? Number(m[1]) : 0
}

// ─── 技能可视化:覆盖度条形 + 技能 × 候选人矩阵 ──────────────────────────
function SkillMatrix({ candidates }: { candidates: Candidate[] }) {
  const rows = useMemo(() => {
    const m = new Map<string, Set<number>>()
    candidates.forEach((c) => (c.skills || []).forEach((s) => {
      if (!m.has(s)) m.set(s, new Set())
      m.get(s)!.add(c.id)
    }))
    return [...m.entries()]
      .map(([skill, ids]) => ({ skill, ids, count: ids.size }))
      .sort((a, b) => b.count - a.count || a.skill.localeCompare(b.skill))
  }, [candidates])

  const commonCount = rows.filter((r) => r.count === candidates.length).length

  return (
    <div className="space-y-7">
      {/* 覆盖度 */}
      <div>
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="text-xs font-medium" style={{ color: 'var(--color-on-surface-variant)' }}>技能覆盖</h3>
          <span className="text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>
            共同 {commonCount} 项 · 合计 {rows.length} 项
          </span>
        </div>
        <div className="space-y-2.5">
          {candidates.map((c, idx) => {
            const total = (c.skills || []).length
            const common = (c.skills || []).filter((s) => rows.find((r) => r.skill === s)?.count === candidates.length).length
            const unique = total - common
            return (
              <div key={c.id} className="flex items-center gap-2.5 text-xs">
                <span className="w-20 truncate" style={{ color: 'var(--color-on-surface)' }}>{c.name}</span>
                <div className="flex-1 h-2 rounded-full overflow-hidden flex" style={{ background: 'var(--color-surface-container)' }}>
                  <span style={{ width: `${(common / Math.max(1, total)) * 100}%`, background: 'var(--accent-green)', opacity: 0.8 }} />
                  <span style={{ width: `${(unique / Math.max(1, total)) * 100}%`, background: getCompareColor(idx), opacity: 0.8 }} />
                </div>
                <span className="w-24 text-right tabular-nums" style={{ color: 'var(--color-on-surface-variant)' }}>
                  共 {common} / 独 {unique}
                </span>
              </div>
            )
          })}
        </div>
        <div className="flex items-center gap-4 mt-2 text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: 'var(--accent-green)', opacity: 0.8 }} />共同技能</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: 'var(--color-primary)', opacity: 0.8 }} />独有技能</span>
        </div>
      </div>

      {/* 技能矩阵 */}
      <div>
        <h3 className="text-xs font-medium mb-2" style={{ color: 'var(--color-on-surface-variant)' }}>技能矩阵</h3>
        <div className="overflow-auto rounded-lg border" style={{ borderColor: 'var(--color-outline-variant)', maxHeight: 420 }}>
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10" style={{ background: 'var(--color-surface)' }}>
              <tr className="border-b" style={{ borderColor: 'var(--color-outline-variant)' }}>
                <th className="text-left font-normal px-3 py-2" style={{ color: 'var(--color-on-surface-variant)' }}>技能</th>
                {candidates.map((c, idx) => (
                  <th key={c.id} className="px-2 py-2 text-center font-normal">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ background: getCompareColor(idx) }} />
                      <span className="truncate max-w-[80px]" style={{ color: 'var(--color-on-surface)' }}>{c.name}</span>
                    </span>
                  </th>
                ))}
                <th className="text-right font-normal px-3 py-2" style={{ color: 'var(--color-on-surface-variant)' }}>覆盖</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.skill} className="border-t" style={{ borderColor: 'var(--color-outline-variant)' }}>
                  <td className="px-3 py-1.5" style={{ color: 'var(--color-on-surface)' }}>{r.skill}</td>
                  {candidates.map((c, idx) => (
                    <td key={c.id} className="px-2 py-1.5 text-center">
                      {r.ids.has(c.id) ? (
                        <span className="inline-block w-2 h-2 rounded-full" style={{ background: getCompareColor(idx) }} />
                      ) : (
                        <span className="inline-block w-2 h-0.5 rounded" style={{ background: 'var(--color-surface-container-highest)' }} />
                      )}
                    </td>
                  ))}
                  <td className="px-3 py-1.5 text-right tabular-nums" style={{ color: 'var(--color-on-surface-variant)' }}>
                    {r.count}/{candidates.length}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── 背景可视化:经验条形 + 学历刻度 ──────────────────────────────────────
function BackgroundCharts({ candidates }: { candidates: Candidate[] }) {
  const maxYears = Math.max(1, ...candidates.map((c) => expYears(c.exp)))
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
      {/* 经验 */}
      <div>
        <h3 className="text-xs font-medium mb-3" style={{ color: 'var(--color-on-surface-variant)' }}>工作经验(年)</h3>
        <div className="space-y-3">
          {candidates.map((c, idx) => (
            <div key={c.id} className="flex items-center gap-2.5 text-xs">
              <span className="w-20 truncate" style={{ color: 'var(--color-on-surface)' }}>{c.name}</span>
              <div className="flex-1 h-2 rounded-full" style={{ background: 'var(--color-surface-container)' }}>
                <div className="h-full rounded-full" style={{ width: `${(expYears(c.exp) / maxYears) * 100}%`, background: getCompareColor(idx), opacity: 0.8 }} />
              </div>
              <span className="w-16 text-right tabular-nums" style={{ color: 'var(--color-on-surface-variant)' }}>{c.exp || '—'}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 学历 */}
      <div>
        <h3 className="text-xs font-medium mb-3" style={{ color: 'var(--color-on-surface-variant)' }}>学历</h3>
        <div className="space-y-3">
          {candidates.map((c, idx) => {
            const lv = eduLevel(c.education)
            return (
              <div key={c.id} className="flex items-center gap-2.5 text-xs">
                <span className="w-20 truncate" style={{ color: 'var(--color-on-surface)' }}>{c.name}</span>
                <div className="relative flex-1 h-4">
                  <div className="absolute inset-x-0 top-1/2 h-px" style={{ background: 'var(--color-outline-variant)' }} />
                  {EDU_LADDER.map((_, i) => (
                    <div key={i} className="absolute top-1/2 -translate-y-1/2 w-px h-2"
                         style={{ left: `${(i / (EDU_LADDER.length - 1)) * 100}%`, background: 'var(--color-outline-variant)' }} />
                  ))}
                  {lv >= 0 && (
                    <span className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full"
                          style={{ left: `${(lv / (EDU_LADDER.length - 1)) * 100}%`, background: getCompareColor(idx) }} />
                  )}
                </div>
                <span className="w-16 text-right" style={{ color: 'var(--color-on-surface-variant)' }}>{c.education || '—'}</span>
              </div>
            )
          })}
        </div>
        <div className="flex justify-between mt-1.5 pl-[90px] pr-[70px] text-[10px]"
             style={{ color: 'var(--color-on-surface-variant)' }}>
          {EDU_LADDER.map((l) => <span key={l}>{l}</span>)}
        </div>
      </div>

      {/* 城市 / 意向岗位 */}
      <div className="lg:col-span-2">
        <div className="grid grid-cols-2 gap-8 text-xs">
          <div>
            <h3 className="text-xs font-medium mb-2" style={{ color: 'var(--color-on-surface-variant)' }}>意向城市</h3>
            <div className="space-y-1.5">
              {candidates.map((c, idx) => (
                <div key={c.id} className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5" style={{ color: 'var(--color-on-surface)' }}>
                    <span className="w-2 h-2 rounded-full" style={{ background: getCompareColor(idx) }} />{c.name}
                  </span>
                  <span style={{ color: 'var(--color-on-surface-variant)' }}>{c.city || '—'}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-xs font-medium mb-2" style={{ color: 'var(--color-on-surface-variant)' }}>意向岗位</h3>
            <div className="space-y-1.5">
              {candidates.map((c, idx) => (
                <div key={c.id} className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5" style={{ color: 'var(--color-on-surface)' }}>
                    <span className="w-2 h-2 rounded-full" style={{ background: getCompareColor(idx) }} />{c.name}
                  </span>
                  <span style={{ color: 'var(--color-on-surface-variant)' }}>{c.title || '—'}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// 岗位下拉项类型
interface JobOption {
  id: number
  title: string
  status: string
  count: number
}

// 候选人类型（五维度版 — 后端字段已按约定映射）
interface Candidate {
  id: number
  jobseeker_id: number
  name: string
  title: string
  skills: string[]
  exp: string
  salary: string
  education: string
  city: string
  match: number | null
  av: string
  // 五维度匹配分数
  match_breakdown: {
    skill: number | null
    exp: number | null
    edu: number | null
    location: number | null
    salary: number | null
  }
  match_status: string
  job_title: string
}

// 统一响应格式
interface ApiResponse {
  success: boolean
  data?: {
    jobs: JobOption[]
    candidates: Candidate[]
    total: number
    page: number
    size: number
  }
  error?: { code: string, message: string, details?: any }
  message?: string
}

// 对比接口返回类型
interface CompareData {
  candidates: Candidate[]
  skill_analysis: {
    common: string[]
    unique: Record<number, string[]>
  }
  dimension_ranking: Array<{
    dimension: string
    best_id: number
    best_name: string
    best_score: number | null
    scores: Record<number, number | null>
  }>
}

// AI 深度对比结果（DeerFlow 编排产出）
interface DeepCompareData {
  ranking: Array<{
    candidate_id: number
    candidate_name: string
    rank: number
    strengths: string[]
    weaknesses: string[]
    risks: string[]
    recommendation: string
  }>
  overall_summary: string
  key_insights: string[]
  skill_analysis?: any
}

// 匹配度颜色梯度
function matchColor(v: number | null) {
  if (v === null || v === undefined) return 'var(--color-on-surface-variant)'
  if (v >= 85) return 'var(--accent-green)'
  if (v >= 70) return 'var(--color-primary)'
  return 'var(--color-on-surface-variant)'
}

export default function TalentSearch() {
  const { params } = EPNav.use()

  // ── 状态 ──
  const [jobs, setJobs] = useState<JobOption[]>([])
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [selectedJob, setSelectedJob] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [keyword, setKeyword] = useState('')
  const [jobOpen, setJobOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [matching, setMatching] = useState(false)
  const [matchInfo, setMatchInfo] = useState<string>('')
  const [expandedId, setExpandedId] = useState<number | null>(null)

  // ── 对比功能状态 ──
  const [compareSelected, setCompareSelected] = useState<Set<number>>(new Set())
  const [showCompare, setShowCompare] = useState(false)
  const [compareData, setCompareData] = useState<CompareData | null>(null)
  const [compareLoading, setCompareLoading] = useState(false)
  const [maxCompare, setMaxCompare] = useState(4)  // 最多对比人数，可手动设置（2-10）
  const autoCompareTriggered = useRef(false)  // 防止自动对比重复触发
  // 反选人面板（点对比按钮后弹出，勾选候选人再确认开始对比）
  const [comparePickerOpen, setComparePickerOpen] = useState(false)
  // 对比工作台的多维视图
  const [compareTab, setCompareTab] = useState<'overview' | 'skills' | 'background' | 'salary' | 'ai'>('overview')

  // ── AI 深度对比状态（DeerFlow 编排）──
  const [deepCompareData, setDeepCompareData] = useState<DeepCompareData | null>(null)
  const [deepCompareLoading, setDeepCompareLoading] = useState(false)
  const [deepCompareError, setDeepCompareError] = useState('')
  const [aiExpanded, setAiExpanded] = useState<Set<number>>(new Set())

  // ── 沟通对话状态 ──
  const [chatOpen, setChatOpen] = useState(false)
  const [chatCandidate, setChatCandidate] = useState<{ id: number; name: string; job_title: string; match: number | null } | null>(null)

  const jobDropdownRef = useRef<HTMLDivElement>(null)

  // ── 拉取候选人 ──
  const loadCandidates = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (selectedJob) params.set('job_id', String(selectedJob))
      if (keyword) params.set('keyword', keyword)
      params.set('page', '1')
      params.set('size', '20')

      const r = await fetch(`/api/enterprise/candidates?${params.toString()}`)
      const d: ApiResponse = await r.json()
      if (d.success && d.data) {
        setJobs(d.data.jobs)
        setCandidates(d.data.candidates)
      } else {
        setError(d.error?.message || '查询失败')
      }
    } catch (e) {
      setError('网络错误，请稍后重试')
    } finally {
      setLoading(false)
    }
  }, [selectedJob, keyword])

  useEffect(() => { loadCandidates() }, [loadCandidates])

  // 从岗位管理跳转过来时，自动选中指定岗位
  useEffect(() => {
    if (params.filterJobId && jobs.length > 0) {
      const exists = jobs.find(j => j.id === params.filterJobId)
      if (exists) {
        setSelectedJob(params.filterJobId)
      }
    }
  }, [params.filterJobId, jobs])

  // 自动对比模式：从岗位管理跳转时，自动选中候选人并打开对比弹窗
  useEffect(() => {
    if (params.autoCompare && params.filterJobId && candidates.length > 0 && !loading && !autoCompareTriggered.current) {
      autoCompareTriggered.current = true
      const ids = new Set<number>()
      // 选中所有候选人（最多不超过 maxCompare 上限）
      for (const c of candidates) {
        if (ids.size >= maxCompare) break
        ids.add(c.id)
      }
      if (ids.size >= 2) {
        setCompareSelected(ids)
        // 延迟触发对比，等 setCompareSelected 生效
        setTimeout(() => {
          const btn = document.querySelector('[data-compare-btn]') as HTMLButtonElement
          if (btn) btn.click()
        }, 100)
      }
    }
  }, [params.autoCompare, params.filterJobId, candidates, loading, maxCompare])

  // 点击外部关闭岗位下拉
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (jobDropdownRef.current && !jobDropdownRef.current.contains(e.target as Node)) {
        setJobOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // ── 触发五维度匹配引擎 ──
  const runMatch = async () => {
    setMatching(true)
    setMatchInfo('')
    setError('')
    try {
      const r = await fetch('/api/enterprise/run-match', { method: 'POST' })
      const d = await r.json()
      if (d.success) {
        const info = d.data || {}
        setMatchInfo(
          `五维度匹配完成：${info.total_jobs || 0} 岗位 × ${info.total_seekers || 0} 候选人 → 更新 ${info.updated || 0} 条，过滤 ${info.skipped || 0} 对`
        )
        await loadCandidates()
      } else {
        setError(d.error?.message || '匹配失败')
      }
    } catch (e) {
      setError('匹配请求失败')
    } finally {
      setMatching(false)
    }
  }

  // ── 候选人对比 ──
  const runCompare = async () => {
    if (compareSelected.size < 2) return
    setCompareLoading(true)
    setShowCompare(true)
    setCompareTab('overview')
    setDeepCompareData(null)
    setDeepCompareError('')
    try {
      const r = await fetch('/api/enterprise/candidates/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(compareSelected) }),
      })
      const d = await r.json()
      if (d.success) {
        setCompareData(d.data)
      } else {
        setError(d.error?.message || '对比失败')
        setShowCompare(false)
      }
    } catch {
      setError('对比请求失败')
      setShowCompare(false)
    } finally {
      setCompareLoading(false)
    }
  }

  // 触发 AI 深度对比（DeerFlow 多 Agent 编排）
  const runDeepCompare = async () => {
    if (compareSelected.size < 2) return
    setDeepCompareLoading(true)
    setDeepCompareError('')
    setDeepCompareData(null)
    try {
      const r = await fetch('/api/enterprise/candidates/deep-compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(compareSelected) }),
      })
      const d = await r.json()
      if (d.success) {
        setDeepCompareData(d.data)
        const top = [...(d.data?.ranking || [])].sort((a: any, b: any) => a.rank - b.rank)[0]
        setAiExpanded(new Set(top ? [top.candidate_id] : []))
      } else {
        setDeepCompareError(d.error?.message || 'AI 分析失败')
      }
    } catch {
      setDeepCompareError('AI 分析请求失败，请检查网络')
    } finally {
      setDeepCompareLoading(false)
    }
  }

  // 勾选/取消勾选候选人
  const toggleCompare = (id: number) => {
    const next = new Set(compareSelected)
    if (next.has(id)) {
      next.delete(id)
    } else {
      if (next.size >= maxCompare) return // 达到上限，不可再选
      next.add(id)
    }
    setCompareSelected(next)
  }

  // 打开对比（反选人逻辑）：
  //   已选≥2人 → 直接对比（兼容岗位管理自动跳转场景）
  //   未选够   → 弹出选人面板，勾选候选人再确认
  // 打开对比工作台：已选≥2人直接进入，否则先选人
  const openCompare = () => {
    if (compareSelected.size >= 2) {
      runCompare()
    } else {
      setComparePickerOpen(true)
    }
  }

  // 选人面板确认
  const confirmCompare = () => {
    if (compareSelected.size < 2) return
    setComparePickerOpen(false)
    runCompare()
  }

  // 搜索
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') setKeyword(search.trim())
  }

  const pickJob = (id: number | null) => { setSelectedJob(id); setJobOpen(false) }
  const clearSearch = () => { setSearch(''); setKeyword('') }

  const selectedJobTitle = jobs.find(j => j.id === selectedJob)?.title || '全部岗位'
  const totalCount = jobs.reduce((s, j) => s + j.count, 0)

  // 排序：匹配度高的在前
  const sorted = [...candidates].sort((a, b) => {
    const av = a.match ?? -1
    const bv = b.match ?? -1
    return bv - av
  })

  return (
    <div className="h-full flex flex-col">
      {/* ── 顶部工具栏 ── */}
      <header className="shrink-0 border-b" style={{ borderColor: 'var(--color-outline-variant)' }}>
        <div className="px-14 py-7 flex items-center justify-between">
          <div className="flex items-baseline gap-3">
            <h1 className="text-3xl font-semibold tracking-tight" style={{ color: 'var(--color-on-surface)' }}>候选人</h1>
            <span className="text-base tabular-nums" style={{ color: 'var(--color-on-surface-variant)' }}>
              {candidates.length} / {totalCount || '—'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={runMatch}
              disabled={matching}
              className="flex items-center gap-2 h-12 px-5 rounded-lg text-base font-medium disabled:opacity-50 transition-colors"
              style={{ border: '1px solid var(--color-outline-variant)', background: 'var(--color-surface)', color: 'var(--color-on-surface)' }}
            >
              {matching ? <Loader2 className="h-5 w-5 animate-spin" /> : <RefreshCw className="h-5 w-5" />}
              {matching ? '五维度匹配中' : '重新匹配'}
            </button>
            <button
              onClick={openCompare}
              disabled={compareLoading || deepCompareLoading}
              data-compare-btn
              className="flex items-center gap-2 h-12 px-5 rounded-lg text-base font-medium disabled:opacity-50 transition-colors"
              style={{ background: 'var(--color-primary)', color: 'white' }}
            >
              {compareLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <GitCompare className="h-5 w-5" />}
              对比
            </button>
          </div>
        </div>
      </header>

      {/* ── 过滤栏 ── */}
      <div className="shrink-0 border-b" style={{ borderColor: 'var(--color-outline-variant)' }}>
        <div className="px-14 py-5 flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5" style={{ color: 'var(--color-on-surface-variant)' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="搜索姓名 / 技能 / 岗位，按 Enter 查询"
              className="w-full h-12 rounded-lg border pl-12 pr-10 text-base outline-none focus:border-[color:var(--color-primary)]"
              style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface)', color: 'var(--color-on-surface)' }}
            />
            {search && (
              <button onClick={clearSearch} className="absolute right-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-on-surface-variant)' }}>
                <X className="h-5 w-5" />
              </button>
            )}
          </div>

          <div className="relative" ref={jobDropdownRef}>
            <button
              onClick={() => setJobOpen(!jobOpen)}
              className="flex items-center gap-2 h-12 px-5 rounded-lg border text-base transition-colors"
              style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface)', color: 'var(--color-on-surface)' }}
            >
              <span style={{ color: 'var(--color-on-surface-variant)' }} className="text-base">岗位</span>
              <span className="font-medium">{selectedJobTitle}</span>
              <ChevronDown className={`h-5 w-5 transition-transform ${jobOpen ? 'rotate-180' : ''}`} style={{ color: 'var(--color-on-surface-variant)' }} />
            </button>
            <AnimatePresence>
              {jobOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-1.5 w-96 rounded-lg border py-2 z-50 max-h-96 overflow-y-auto shadow-lg"
                  style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}
                >
                  <button
                    onClick={() => pickJob(null)}
                    className="flex items-center justify-between w-full px-5 py-3 text-base transition-colors hover:bg-[var(--color-surface-container-high)]"
                    style={{ color: selectedJob === null ? 'var(--color-primary)' : 'var(--color-on-surface)', fontWeight: selectedJob === null ? 600 : 400 }}
                  >
                    <span>全部岗位</span>
                    <span className="text-base tabular-nums" style={{ color: 'var(--color-on-surface-variant)' }}>{totalCount}</span>
                  </button>
                  {jobs.map(job => (
                    <button
                      key={job.id}
                      onClick={() => pickJob(job.id)}
                      className="flex items-center justify-between w-full px-5 py-3 text-base transition-colors hover:bg-[var(--color-surface-container-high)]"
                      style={{ color: selectedJob === job.id ? 'var(--color-primary)' : 'var(--color-on-surface)', fontWeight: selectedJob === job.id ? 600 : 400 }}
                    >
                      <span className="truncate">{job.title}</span>
                      <span className="text-base tabular-nums ml-3 shrink-0" style={{ color: 'var(--color-on-surface-variant)' }}>{job.count}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {(keyword || selectedJob || matchInfo) && (
          <div className="px-14 pb-5 flex items-center gap-2.5 flex-wrap text-base">
            {keyword && (
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface-variant)' }}>
                关键词: {keyword}
                <button onClick={clearSearch}><X className="h-4 w-4" /></button>
              </span>
            )}
            {selectedJob && (
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface-variant)' }}>
                岗位: {selectedJobTitle}
                <button onClick={() => pickJob(null)}><X className="h-4 w-4" /></button>
              </span>
            )}
            {matchInfo && (
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: 'var(--accent-green-dim)', color: 'var(--accent-green)' }}>
                <TrendingUp className="h-4 w-4" /> {matchInfo}
              </span>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="px-14 pt-6">
          <div className="rounded-lg border px-5 py-4 text-base" style={{ borderColor: 'var(--accent-red)', background: 'var(--accent-red-dim)', color: 'var(--accent-red-strong)' }}>
            {error}
          </div>
        </div>
      )}

      {/* ── 候选人列表（含勾选列）── */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-14 py-6">
          {loading ? (
            <div className="flex items-center justify-center py-28 gap-2.5" style={{ color: 'var(--color-on-surface-variant)' }}>
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="text-lg">加载中</span>
            </div>
          ) : sorted.length === 0 ? (
            <div className="text-center py-28">
              <p className="text-lg" style={{ color: 'var(--color-on-surface-variant)' }}>暂无候选人</p>
              <p className="text-base mt-2" style={{ color: 'var(--color-on-surface-variant)', opacity: 0.6 }}>
                {keyword || selectedJob ? '调整筛选条件或清除过滤' : '运行"重新匹配"以生成候选人列表'}
              </p>
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--color-outline-variant)' }}>
              {/* 列表头 */}
              <div className="grid grid-cols-[1fr_2fr_2fr_1.5fr_120px_56px] gap-8 px-8 py-4 text-sm uppercase tracking-wider border-b"
                style={{ color: 'var(--color-on-surface-variant)', borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-low)' }}>
                <span>匹配</span>
                <span>候选人</span>
                <span>技能</span>
                <span>经验 / 期望</span>
                <span className="text-right">分数</span>
                <span></span>
              </div>

              {/* 行 */}
              {sorted.map((c, i) => {
                const expanded = expandedId === c.id
                const visibleSkills = c.skills.slice(0, 3)
                const hiddenCount = c.skills.length - visibleSkills.length
                return (
                  <motion.div key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i * 0.02, 0.2) }}>
                    <div
                      onClick={() => setExpandedId(expanded ? null : c.id)}
                      className="grid grid-cols-[1fr_2fr_2fr_1.5fr_120px_56px] gap-8 px-8 py-5 items-center cursor-pointer transition-colors border-b last:border-b-0"
                      style={{
                        borderColor: 'var(--color-outline-variant)',
                        background: expanded ? 'var(--color-surface-container-low)' : 'var(--color-surface)',
                      }}
                      onMouseEnter={e => { if (!expanded) e.currentTarget.style.background = 'var(--color-surface-container-low)' }}
                      onMouseLeave={e => { if (!expanded) e.currentTarget.style.background = 'var(--color-surface)' }}
                    >

                      {/* 匹配度 */}
                      <div className="flex items-center gap-3">
                        <div className="w-1.5 h-12 rounded-full" style={{ background: matchColor(c.match) }} />
                        <span className="text-2xl font-semibold tabular-nums" style={{ color: matchColor(c.match) }}>
                          {c.match ?? '—'}
                          {c.match !== null && <span className="text-base ml-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>%</span>}
                        </span>
                      </div>

                      {/* 候选人 */}
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-12 h-12 rounded-full flex items-center justify-center text-base font-semibold shrink-0"
                          style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-primary)' }}>
                          {c.av}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-medium truncate" style={{ color: 'var(--color-on-surface)' }}>{c.name}</span>
                            {c.job_title && (
                              <span className="text-sm px-2 py-0.5 rounded-lg font-medium shrink-0" style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-primary)' }}>
                                {c.job_title}
                              </span>
                            )}
                          </div>
                          {c.title && <p className="text-sm truncate mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>意向：{c.title}</p>}
                        </div>
                      </div>

                      {/* 技能 */}
                      <div className="flex flex-wrap gap-1.5 items-center">
                        {visibleSkills.map(s => (
                          <span key={s} className="text-sm px-2.5 py-1 rounded-lg" style={{ background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface-variant)' }}>{s}</span>
                        ))}
                        {hiddenCount > 0 && <span className="text-sm tabular-nums" style={{ color: 'var(--color-on-surface-variant)' }}>+{hiddenCount}</span>}
                        {c.skills.length === 0 && <span className="text-sm" style={{ color: 'var(--color-on-surface-variant)', opacity: 0.5 }}>—</span>}
                      </div>

                      {/* 经验 / 期望薪资 */}
                      <div className="text-base space-y-1.5" style={{ color: 'var(--color-on-surface-variant)' }}>
                        <div className="tabular-nums">{c.exp || '—'}</div>
                        <div className="tabular-nums">{c.salary || '—'}</div>
                      </div>

                      {/* 综合分数 */}
                      <div className="text-right">
                        <span className="text-2xl font-bold tabular-nums" style={{ color: matchColor(c.match) }}>{c.match ?? '—'}</span>
                      </div>

                      {/* 展开指示 */}
                      <div className="flex justify-end">
                        <ChevronDown className={`h-6 w-6 transition-transform ${expanded ? 'rotate-180' : ''}`} style={{ color: 'var(--color-on-surface-variant)' }} />
                      </div>
                    </div>

                    {/* 展开详情 — 五维度 */}
                    <AnimatePresence initial={false}>
                      {expanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden border-b"
                          style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}
                        >
                          <div className="px-8 py-7 grid grid-cols-3 gap-10">
                            {/* 五维度匹配分数 */}
                            <div>
                              <p className="text-sm uppercase tracking-wider mb-5" style={{ color: 'var(--color-on-surface-variant)' }}>匹配维度（五维）</p>
                              <div className="space-y-4">
                                {DIMENSION_BARS.map(item => (
                                  <div key={item.key} className="flex items-center gap-3">
                                    <span className="text-base w-12" style={{ color: 'var(--color-on-surface-variant)' }}>{item.label}</span>
                                    <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--color-surface-container-high)' }}>
                                      <div className="h-full rounded-full transition-all duration-500"
                                        style={{ width: `${c.match_breakdown[item.key as keyof typeof c.match_breakdown] ?? 0}%`, background: item.color }} />
                                    </div>
                                    <span className="text-base font-semibold tabular-nums w-12 text-right" style={{ color: item.color }}>
                                      {c.match_breakdown[item.key as keyof typeof c.match_breakdown] ?? '—'}
                                    </span>
                                  </div>
                                ))}
                              </div>
                              {c.match === null && (
                                <p className="text-sm mt-4" style={{ color: 'var(--color-on-surface-variant)' }}>匹配引擎尚未计算，点击右上角"重新匹配"</p>
                              )}
                            </div>

                            {/* 全部技能 */}
                            <div>
                              <p className="text-sm uppercase tracking-wider mb-5" style={{ color: 'var(--color-on-surface-variant)' }}>技能 ({c.skills.length})</p>
                              <div className="flex flex-wrap gap-2">
                                {c.skills.map(s => (
                                  <span key={s} className="text-sm px-2.5 py-1 rounded-lg" style={{ background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface)' }}>{s}</span>
                                ))}
                                {c.skills.length === 0 && <span className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>未提供</span>}
                              </div>
                              {/* 学历 + 城市 */}
                              <div className="mt-5 space-y-2">
                                <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
                                  学历：<span style={{ color: 'var(--color-on-surface)' }}>{c.education || '未提供'}</span>
                                </p>
                                <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
                                  意向城市：<span style={{ color: 'var(--color-on-surface)' }}>{c.city || '未提供'}</span>
                                </p>
                              </div>
                            </div>

                            {/* 操作 */}
                            <div>
                              <p className="text-sm uppercase tracking-wider mb-5" style={{ color: 'var(--color-on-surface-variant)' }}>操作</p>
                              <div className="flex flex-col gap-3 items-start">
                                <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setChatCandidate({ id: c.id, name: c.name, job_title: c.job_title, match: c.match })
                                  setChatOpen(true)
                                }}
                                className="inline-flex items-center gap-2 h-11 px-5 rounded-lg text-base font-medium"
                                style={{ border: '1px solid var(--color-outline-variant)', background: 'var(--color-surface)', color: 'var(--color-on-surface)' }}>
                                <Mail className="h-5 w-5" /> 发起沟通
                              </button>
                                <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
                                  状态：{c.match_status === 'accepted' ? '已接受' : c.match_status === 'rejected' ? '已拒绝' : c.match_status === 'communicating' ? '沟通中' : '待沟通'}
                                </p>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── 反选人面板：点对比按钮后弹出，勾选候选人再确认 ── */}
      <AnimatePresence>
        {comparePickerOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-8"
            style={{ background: 'var(--color-scrim, rgba(0,0,0,0.5))' }}
            onClick={() => setComparePickerOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="rounded-2xl border w-full max-w-3xl flex flex-col max-h-[85vh]"
              style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface)' }}
              onClick={e => e.stopPropagation()}
            >
              {/* 头 */}
              <div className="flex items-center justify-between px-8 py-5 border-b shrink-0" style={{ borderColor: 'var(--color-outline-variant)' }}>
                <div className="flex items-center gap-3">
                  <GitCompare className="h-6 w-6" style={{ color: 'var(--color-primary)' }} />
                  <h2 className="text-xl font-semibold" style={{ color: 'var(--color-on-surface)' }}>
                    对比 · 选择候选人
                  </h2>
                </div>
                <button onClick={() => setComparePickerOpen(false)} className="p-2 rounded-lg transition-colors hover:bg-[var(--color-surface-container-high)]">
                  <X className="h-6 w-6" style={{ color: 'var(--color-on-surface-variant)' }} />
                </button>
              </div>

              {/* 当前筛选列表（含上限设置）*/}
              <div className="flex items-center justify-between px-8 py-3 border-b shrink-0" style={{ borderColor: 'var(--color-outline-variant)' }}>
                <span className="text-base" style={{ color: 'var(--color-on-surface-variant)' }}>
                  以下为当前列表的 {candidates.length} 位候选人，勾选 2~{maxCompare} 位进行对比
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>上限</span>
                  <select
                    value={maxCompare}
                    onChange={e => {
                      const v = Number(e.target.value)
                      setMaxCompare(v)
                      if (compareSelected.size > v) {
                        const trimmed = new Set(Array.from(compareSelected).slice(0, v))
                        setCompareSelected(trimmed)
                      }
                    }}
                    className="h-9 px-2 rounded border text-sm"
                    style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface)', color: 'var(--color-on-surface)' }}
                  >
                    {[2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                      <option key={n} value={n}>{n} 人</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 候选人列表（滚动）*/}
              <div className="flex-1 overflow-y-auto px-4 py-3">
                {candidates.map((c, idx) => {
                  const isChecked = compareSelected.has(c.id)
                  return (
                    <div
                      key={c.id}
                      onClick={() => toggleCompare(c.id)}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-colors"
                      style={{ background: isChecked ? 'var(--color-primary-fixed)' : 'var(--color-surface-container-low)', marginBottom: 8 }}
                    >
                      {/* 勾选圈 */}
                      <div className="w-6 h-6 rounded border-2 flex items-center justify-center shrink-0"
                        style={{ borderColor: isChecked ? 'var(--color-primary)' : 'var(--color-outline-variant)',
                                 background: isChecked ? 'var(--color-primary)' : 'transparent' }}>
                        {isChecked && <span style={{ color: 'white', fontSize: 14, fontWeight: 700 }}>✓</span>}
                      </div>
                      {/* 色标 + 头像 + 信息 */}
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: getCompareColor(idx) }} />
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold shrink-0"
                          style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-primary)' }}>
                          {c.av}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-base font-medium truncate" style={{ color: 'var(--color-on-surface)' }}>{c.name}</span>
                            {c.job_title && (
                              <span className="text-sm px-2 py-0.5 rounded-lg font-medium shrink-0" style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-primary)' }}>
                                {c.job_title}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1.5 items-center mt-1">
                            {c.skills.slice(0, 3).map(s => (
                              <span key={s} className="text-xs px-2 py-0.5 rounded" style={{ background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface-variant)' }}>{s}</span>
                            ))}
                            {c.skills.length > 3 && (
                              <span className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>+{c.skills.length - 3}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      {/* 综合分数 */}
                      <span className="text-lg font-bold tabular-nums shrink-0" style={{ color: matchColor(c.match) }}>{c.match ?? '—'}</span>
                    </div>
                  )
                })}
              </div>

              {/* 底部操作 */}
              <div className="flex items-center justify-between px-8 py-4 border-t shrink-0" style={{ borderColor: 'var(--color-outline-variant)' }}>
                <span className="text-base" style={{ color: 'var(--color-on-surface)', opacity: 0.7 }}>
                  已选 <span className="font-semibold tabular-nums">{compareSelected.size}</span>/{maxCompare}
                </span>
                <div className="flex items-center gap-3">
                  <button onClick={() => setCompareSelected(new Set())} className="text-base transition-colors hover:text-[var(--color-on-surface)]"
                    style={{ color: 'var(--color-on-surface-variant)' }}>
                    清空选择
                  </button>
                  <button onClick={() => setComparePickerOpen(false)} className="h-11 px-6 rounded-lg text-base font-medium"
                    style={{ border: '1px solid var(--color-outline-variant)', color: 'var(--color-on-surface)', background: 'var(--color-surface)' }}>
                    取消
                  </button>
                  <button
                    onClick={confirmCompare}
                    disabled={compareSelected.size < 2}
                    className="flex items-center gap-2 h-11 px-6 rounded-lg text-base font-medium disabled:opacity-50"
                    style={{ background: 'var(--color-primary)', color: 'white' }}
                  >
                    {compareLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <GitCompare className="h-5 w-5" />}
                    开始对比
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 对比弹窗 ── */}
      <AnimatePresence>
        {showCompare && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-8"
            style={{ background: 'var(--color-scrim, rgba(0,0,0,0.5))' }}
            onClick={() => { setShowCompare(false); setCompareData(null); setDeepCompareData(null); setDeepCompareError('') }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="rounded-2xl border w-full max-w-6xl max-h-[90vh] overflow-y-auto"
              style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface)' }}
              onClick={e => e.stopPropagation()}
            >
              {/* 弹窗头 + 多维视图切换 */}
              <div className="sticky top-0 z-10 border-b" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface)' }}>
                <div className="flex items-center justify-between px-8 py-5">
                  <div className="flex items-center gap-3">
                    <GitCompare className="h-6 w-6" style={{ color: 'var(--color-primary)' }} />
                    <h2 className="text-2xl font-semibold" style={{ color: 'var(--color-on-surface)' }}>候选人对比</h2>
                    <span className="text-sm tabular-nums" style={{ color: 'var(--color-on-surface-variant)' }}>
                      {compareData?.candidates.length ?? 0} 人
                    </span>
                  </div>
                  <button onClick={() => { setShowCompare(false); setCompareData(null); setDeepCompareData(null); setDeepCompareError('') }} className="p-2 rounded-lg transition-colors hover:bg-[var(--color-surface-container-high)]">
                    <X className="h-6 w-6" style={{ color: 'var(--color-on-surface-variant)' }} />
                  </button>
                </div>
                <div className="flex items-center gap-1 px-8 pb-3">
                  {COMPARE_TABS.map(t => {
                    const on = compareTab === t.key
                    return (
                      <button
                        key={t.key}
                        onClick={() => setCompareTab(t.key)}
                        className="px-3 py-1.5 rounded-lg text-sm transition-colors"
                        style={{
                          background: on ? 'var(--color-surface-container)' : 'transparent',
                          color: on ? 'var(--color-on-surface)' : 'var(--color-on-surface-variant)',
                          fontWeight: on ? 600 : 400,
                        }}
                      >
                        {t.label}
                        {t.key === 'ai' && deepCompareLoading && (
                          <Loader2 className="inline-block ml-1.5 h-3.5 w-3.5 animate-spin" />
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              {compareLoading ? (
                <div className="flex items-center justify-center py-28 gap-2.5" style={{ color: 'var(--color-on-surface-variant)' }}>
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="text-lg">加载对比数据</span>
                </div>
              ) : compareData ? (
                <div className="px-8 py-8">
                  {compareTab === 'overview' && (
                    <CompareStudio candidates={compareData.candidates} />
                  )}

                  {/* ── 技能对比 ── */}
                  {compareTab === 'skills' && (
                    <SkillMatrix candidates={compareData.candidates} />
                  )}

                  {/* ── 背景对比 ── */}
                  {compareTab === 'background' && (
                    <BackgroundCharts candidates={compareData.candidates} />
                  )}

                  {/* ── 薪资期望 ── */}
                  {compareTab === 'salary' && (() => {
                    const maxHi = Math.max(1, ...compareData.candidates.map(c => parseSalaryRange(c.salary)?.hi ?? 0))
                    return (
                      <div className="space-y-8">
                        <div className="rounded-xl border p-6" style={{ borderColor: 'var(--color-outline-variant)' }}>
                          <div className="flex items-baseline justify-between mb-4">
                            <h3 className="text-sm font-semibold" style={{ color: 'var(--color-on-surface)' }}>期望薪资</h3>
                            <span className="text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>按期望区间叠加对比</span>
                          </div>
                          <div className="space-y-4">
                            {compareData.candidates.map((c, idx) => {
                              const r = parseSalaryRange(c.salary)
                              const color = getCompareColor(idx)
                              return (
                                <div key={c.id}>
                                  <div className="flex items-baseline justify-between text-xs mb-1.5">
                                    <span className="flex items-center gap-1.5">
                                      <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                                      <span style={{ color: 'var(--color-on-surface)' }}>{c.name}</span>
                                    </span>
                                    <span className="tabular-nums" style={{ color: 'var(--color-on-surface-variant)' }}>{c.salary || '未填写'}</span>
                                  </div>
                                  <div className="relative h-2 rounded-full" style={{ background: 'var(--color-surface-container)' }}>
                                    {r && (
                                      <div className="absolute inset-y-0 rounded-full"
                                           style={{
                                             left: `${(r.lo / maxHi) * 100}%`,
                                             width: `${Math.max(2, ((r.hi - r.lo) / maxHi) * 100)}%`,
                                             background: color,
                                             opacity: 0.8,
                                           }} />
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                          <div className="flex justify-between text-[10px] mt-2 tabular-nums" style={{ color: 'var(--color-on-surface-variant)' }}>
                            <span>0K</span>
                            <span>{maxHi}K</span>
                          </div>
                        </div>
                        <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-outline-variant)' }}>
                          <table className="w-full text-xs">
                            <thead>
                              <tr style={{ background: 'var(--color-surface-container-low)' }}>
                                {['候选人', '意向岗位', '期望城市', '经验', '期望薪资'].map(h => (
                                  <th key={h} className="text-left font-normal px-4 py-2" style={{ color: 'var(--color-on-surface-variant)' }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {compareData.candidates.map(c => (
                                <tr key={c.id} className="border-t" style={{ borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface)' }}>
                                  <td className="px-4 py-2">{c.name}</td>
                                  <td className="px-4 py-2">{c.title || '—'}</td>
                                  <td className="px-4 py-2">{c.city || '—'}</td>
                                  <td className="px-4 py-2">{c.exp || '—'}</td>
                                  <td className="px-4 py-2 tabular-nums">{c.salary || '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )
                  })()}

                  {/* ── AI 深度分析 ── */}
                  {compareTab === 'ai' && (
                    <div className="space-y-6">
                      {!deepCompareData && !deepCompareLoading && !deepCompareError && (
                        <div className="rounded-xl border p-8" style={{ borderColor: 'var(--color-outline-variant)' }}>
                          <h3 className="text-base font-semibold" style={{ color: 'var(--color-on-surface)' }}>AI 深度分析</h3>
                          <p className="text-sm mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>
                            DeerFlow 多 Agent 编排:技能迁移分析、优势 / 劣势 / 风险与推荐排序
                          </p>
                          <button onClick={runDeepCompare}
                                  className="mt-4 px-4 py-2 rounded-lg text-sm font-medium"
                                  style={{ background: 'var(--color-primary)', color: 'white' }}>
                            启动分析
                          </button>
                        </div>
                      )}
                      {deepCompareLoading && (
                        <div className="flex flex-col items-center gap-3 py-16">
                          <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--color-primary)' }} />
                          <span className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>AI Agent 分析中,预计 10-20 秒...</span>
                        </div>
                      )}
                      {deepCompareError && !deepCompareLoading && (
                        <div className="space-y-3">
                          <div className="rounded-lg px-4 py-3 text-sm" style={{ background: 'var(--accent-red-dim)', color: 'var(--accent-red-strong)' }}>
                            {deepCompareError}
                          </div>
                          <button onClick={runDeepCompare} className="text-sm px-3 py-1.5 rounded-lg border"
                                  style={{ borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface)' }}>
                            重试
                          </button>
                        </div>
                      )}
                      {deepCompareData && !deepCompareLoading && (
                        <div className="space-y-6">
                          <div className="rounded-lg p-5" style={{ background: 'var(--color-primary-fixed-dim)' }}>
                            <p className="text-base leading-relaxed" style={{ color: 'var(--color-on-surface)' }}>
                              {deepCompareData.overall_summary}
                            </p>
                          </div>
                          <div className="space-y-2">
                            {[...deepCompareData.ranking].sort((a, b) => a.rank - b.rank).map((item) => {
                              const total = item.strengths.length + item.weaknesses.length + item.risks.length
                              const open = aiExpanded.has(item.candidate_id)
                              const toggle = () => {
                                const next = new Set(aiExpanded)
                                if (next.has(item.candidate_id)) next.delete(item.candidate_id)
                                else next.add(item.candidate_id)
                                setAiExpanded(next)
                              }
                              return (
                                <div key={item.candidate_id} className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--color-outline-variant)' }}>
                                  <button onClick={toggle} className="w-full flex items-center gap-3 px-4 py-3 text-left">
                                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-bold shrink-0"
                                          style={{
                                            background: item.rank === 1 ? 'var(--accent-green)' : 'var(--color-surface-container-high)',
                                            color: item.rank === 1 ? 'white' : 'var(--color-on-surface-variant)',
                                          }}>
                                      {item.rank}
                                    </span>
                                    <span className="text-sm font-semibold shrink-0" style={{ color: 'var(--color-on-surface)' }}>{item.candidate_name}</span>
                                    <div className="flex-1 h-2 rounded-full overflow-hidden flex min-w-[80px]" style={{ background: 'var(--color-surface-container)' }}>
                                      <span style={{ width: `${(item.strengths.length / Math.max(1, total)) * 100}%`, background: 'var(--accent-green)', opacity: 0.85 }} />
                                      <span style={{ width: `${(item.weaknesses.length / Math.max(1, total)) * 100}%`, background: 'var(--accent-orange)', opacity: 0.85 }} />
                                      <span style={{ width: `${(item.risks.length / Math.max(1, total)) * 100}%`, background: 'var(--accent-red)', opacity: 0.85 }} />
                                    </div>
                                    <span className="text-[11px] tabular-nums shrink-0" style={{ color: 'var(--color-on-surface-variant)' }}>
                                      优势 {item.strengths.length} · 劣势 {item.weaknesses.length} · 风险 {item.risks.length}
                                    </span>
                                    <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
                                                 style={{ color: 'var(--color-on-surface-variant)' }} />
                                  </button>
                                  {open && (
                                    <div className="px-4 pb-4 space-y-4 border-t" style={{ borderColor: 'var(--color-outline-variant)' }}>
                                      <div className="grid grid-cols-3 gap-4 pt-4">
                                        <div>
                                          <p className="text-sm font-medium mb-2" style={{ color: 'var(--accent-green)' }}>优势</p>
                                          <ul className="space-y-1.5">
                                            {item.strengths.map((s, i) => (
                                              <li key={i} className="text-sm flex gap-1.5" style={{ color: 'var(--color-on-surface)' }}>
                                                <span style={{ color: 'var(--accent-green)' }}>+</span> {s}
                                              </li>
                                            ))}
                                          </ul>
                                        </div>
                                        <div>
                                          <p className="text-sm font-medium mb-2" style={{ color: 'var(--accent-orange)' }}>劣势</p>
                                          <ul className="space-y-1.5">
                                            {item.weaknesses.map((s, i) => (
                                              <li key={i} className="text-sm flex gap-1.5" style={{ color: 'var(--color-on-surface)' }}>
                                                <span style={{ color: 'var(--accent-orange)' }}>-</span> {s}
                                              </li>
                                            ))}
                                          </ul>
                                        </div>
                                        <div>
                                          <p className="text-sm font-medium mb-2" style={{ color: 'var(--accent-red-strong)' }}>风险</p>
                                          <ul className="space-y-1.5">
                                            {item.risks.map((s, i) => (
                                              <li key={i} className="text-sm flex gap-1.5" style={{ color: 'var(--color-on-surface)' }}>
                                                <span style={{ color: 'var(--accent-red-strong)' }}>!</span> {s}
                                              </li>
                                            ))}
                                          </ul>
                                        </div>
                                      </div>
                                      <div className="rounded p-3" style={{ background: 'var(--color-surface-container-low)' }}>
                                        <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
                                          <span className="font-medium" style={{ color: 'var(--color-on-surface)' }}>推荐理由:</span>
                                          {item.recommendation}
                                        </p>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                          {deepCompareData.key_insights.length > 0 && (
                            <div className="rounded-lg p-5" style={{ background: 'var(--color-surface-container-low)' }}>
                              <p className="text-sm font-medium mb-3" style={{ color: 'var(--color-primary)' }}>关键洞察</p>
                              <ul className="space-y-2">
                                {deepCompareData.key_insights.map((insight, i) => (
                                  <li key={i} className="text-base flex gap-2" style={{ color: 'var(--color-on-surface)' }}>
                                    <span style={{ color: 'var(--color-primary)' }}>•</span> {insight}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : null}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 沟通对话弹窗 ── */}
      {chatCandidate && (
        <ChatDialog
          open={chatOpen}
          onClose={() => setChatOpen(false)}
          matchRecordId={chatCandidate.id}
          candidate={chatCandidate}
        />
      )}
    </div>
  )
}
