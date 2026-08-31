import { useState, useEffect, useCallback, useRef } from 'react'
import { Search, ChevronDown, Loader2, RefreshCw, Mail, X, TrendingUp, GitCompare } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import ChatDialog from '../../components/ChatDialog'
import { EPNav } from '../../lib/NavContext'

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

// 动态对比颜色生成（HSL 色相均匀分布，支持任意人数）
// 预设 10 种基础色，超出部分用 HSL 自动生成
const COMPARE_COLOR_POOL = [
  'var(--color-primary)',
  'var(--accent-green)',
  'var(--accent-purple)',
  'var(--accent-orange)',
  '#E91E63',  // 玫红
  '#00BCD4',  // 青色
  '#795548',  // 棕色
  '#607D8B',  // 灰蓝
  '#FF5722',  // 深橙
  '#3F51B5',  // 靛蓝
]

function getCompareColor(idx: number): string {
  if (idx < COMPARE_COLOR_POOL.length) return COMPARE_COLOR_POOL[idx]
  // 超出预设池时用 HSL 自动生成：色相均匀分布，饱和度 65%，亮度 50%
  const hue = (idx * 137.5) % 360  // 黄金角分割，确保相邻颜色区分明显
  return `hsl(${hue}, 65%, 50%)`
}

// 五维度标签
const DIMENSIONS = [
  { key: 'skill', label: '技能', color: 'var(--color-primary)' },
  { key: 'exp', label: '经验', color: 'var(--accent-purple)' },
  { key: 'edu', label: '学历', color: 'var(--accent-orange)' },
  { key: 'location', label: '地域', color: 'var(--accent-green)' },
  { key: 'salary', label: '薪资', color: 'var(--color-on-surface-variant)' },
]

// ─── SVG 雷达图组件 ───────────────────────────────────────────────────
function RadarChart({ candidates }: { candidates: Candidate[] }) {
  const size = 320
  const center = size / 2
  const maxRadius = 110
  const axes = DIMENSIONS
  const n = axes.length

  // 计算各轴的坐标点
  const getAxisPoint = (index: number, radius: number) => {
    const angle = (Math.PI * 2 * index) / n - Math.PI / 2
    return {
      x: center + radius * Math.cos(angle),
      y: center + radius * Math.sin(angle),
    }
  }

  // 生成候选人的多边形点
  const getPolygonPoints = (c: Candidate) => {
    return axes.map((axis, i) => {
      const score = c.match_breakdown[axis.key as keyof typeof c.match_breakdown] ?? 0
      const radius = (score / 100) * maxRadius
      const pt = getAxisPoint(i, radius)
      return `${pt.x},${pt.y}`
    }).join(' ')
  }

  // 网格圈（5层，每层20%）
  const gridRings = [0.2, 0.4, 0.6, 0.8, 1.0]

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* 网格多边形 */}
      {gridRings.map((ring, ri) => (
        <polygon
          key={ri}
          points={axes.map((_, i) => {
            const pt = getAxisPoint(i, maxRadius * ring)
            return `${pt.x},${pt.y}`
          }).join(' ')}
          fill="none"
          stroke="var(--color-outline-variant)"
          strokeWidth={1}
          opacity={0.5}
        />
      ))}

      {/* 轴线 */}
      {axes.map((_, i) => {
        const pt = getAxisPoint(i, maxRadius)
        return (
          <line
            key={i}
            x1={center} y1={center}
            x2={pt.x} y2={pt.y}
            stroke="var(--color-outline-variant)"
            strokeWidth={1}
            opacity={0.5}
          />
        )
      })}

      {/* 候选人多边形 */}
      {candidates.map((c, idx) => (
        <polygon
          key={c.id}
          points={getPolygonPoints(c)}
          fill={getCompareColor(idx)}
          fillOpacity={0.12}
          stroke={getCompareColor(idx)}
          strokeWidth={2}
        />
      ))}

      {/* 轴标签 */}
      {axes.map((axis, i) => {
        const pt = getAxisPoint(i, maxRadius + 22)
        return (
          <text
            key={axis.key}
            x={pt.x} y={pt.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={13}
            fontWeight={500}
            fill="var(--color-on-surface)"
          >
            {axis.label}
          </text>
        )
      })}

      {/* 顶点数值标签 */}
      {candidates.map((c, idx) => (
        axes.map((axis, i) => {
          const score = c.match_breakdown[axis.key as keyof typeof c.match_breakdown] ?? 0
          const radius = (score / 100) * maxRadius
          const pt = getAxisPoint(i, radius)
          return (
            <text
              key={`${c.id}-${axis.key}`}
              x={pt.x} y={pt.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={10}
              fontWeight={600}
              fill={getCompareColor(idx)}
            >
              {score}
            </text>
          )
        })
      ))}
    </svg>
  )
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
  const [comparePickerMode, setComparePickerMode] = useState<'radar' | 'deep' | null>(null)

  // ── AI 深度对比状态（DeerFlow 编排）──
  const [deepCompareData, setDeepCompareData] = useState<DeepCompareData | null>(null)
  const [deepCompareLoading, setDeepCompareLoading] = useState(false)
  const [deepCompareError, setDeepCompareError] = useState('')
  const [showDeepPanel, setShowDeepPanel] = useState(false)  // 主界面 AI 分析结果浮层

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
  const openCompare = (type: 'radar' | 'deep') => {
    if (compareSelected.size >= 2) {
      if (type === 'deep') {
        setShowDeepPanel(true)
        runDeepCompare()
      } else {
        runCompare()
      }
    } else {
      setComparePickerMode(type)
      setComparePickerOpen(true)
    }
  }

  // 选人面板确认：关闭面板并按所选类型发起对比
  const confirmCompare = () => {
    if (compareSelected.size < 2) return
    setComparePickerOpen(false)
    if (comparePickerMode === 'deep') {
      setShowDeepPanel(true)
      runDeepCompare()
    } else {
      runCompare()
    }
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
              onClick={() => openCompare('radar')}
              disabled={compareLoading}
              data-compare-btn
              className="flex items-center gap-2 h-12 px-5 rounded-lg text-base font-medium disabled:opacity-50 transition-colors"
              style={{ border: '1px solid var(--color-outline-variant)', background: 'var(--color-surface)', color: 'var(--color-on-surface)' }}
            >
              {compareLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <GitCompare className="h-5 w-5" />}
              雷达对比
            </button>
            <button
              onClick={() => openCompare('deep')}
              disabled={deepCompareLoading}
              className="flex items-center gap-2 h-12 px-5 rounded-lg text-base font-medium disabled:opacity-50 transition-colors"
              style={{ background: 'var(--color-primary)', color: 'white' }}
            >
              {deepCompareLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <span className="text-lg">🦌</span>}
              AI 深度对比
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
                                {DIMENSIONS.map(item => (
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
                  {comparePickerMode === 'deep'
                    ? <span className="text-2xl">🦌</span>
                    : <GitCompare className="h-6 w-6" style={{ color: 'var(--color-primary)' }} />}
                  <h2 className="text-xl font-semibold" style={{ color: 'var(--color-on-surface)' }}>
                    {comparePickerMode === 'deep' ? 'AI 深度对比' : '雷达对比'} · 选择候选人
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
                    {comparePickerMode === 'deep' ? <span className="text-lg">🦌</span> : <GitCompare className="h-5 w-5" />}
                    开始{comparePickerMode === 'deep' ? ' AI 深度对比' : '雷达对比'}
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
              {/* 弹窗头 */}
              <div className="flex items-center justify-between px-8 py-6 border-b sticky top-0 z-10" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface)' }}>
                <div className="flex items-center gap-3">
                  <GitCompare className="h-6 w-6" style={{ color: 'var(--color-primary)' }} />
                  <h2 className="text-2xl font-semibold" style={{ color: 'var(--color-on-surface)' }}>候选人对比</h2>
                </div>
                <button onClick={() => { setShowCompare(false); setCompareData(null); setDeepCompareData(null); setDeepCompareError('') }} className="p-2 rounded-lg transition-colors hover:bg-[var(--color-surface-container-high)]">
                  <X className="h-6 w-6" style={{ color: 'var(--color-on-surface-variant)' }} />
                </button>
              </div>

              {compareLoading ? (
                <div className="flex items-center justify-center py-28 gap-2.5" style={{ color: 'var(--color-on-surface-variant)' }}>
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="text-lg">加载对比数据</span>
                </div>
              ) : compareData ? (
                <div className="px-8 py-8 space-y-10">
                  {/* ── 雷达图 ── */}
                  <div className="flex flex-col items-center justify-center">
                    <RadarChart candidates={compareData.candidates} />
                    {/* 图例 */}
                    <div className="flex flex-wrap gap-4 mt-4 justify-center">
                      {compareData.candidates.map((c, idx) => (
                        <div key={c.id} className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full" style={{ background: getCompareColor(idx) }} />
                          <span className="text-base font-medium" style={{ color: 'var(--color-on-surface)' }}>{c.name}</span>
                          <span className="text-base tabular-nums" style={{ color: 'var(--color-on-surface-variant)' }}>{c.match}分</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ── 技能对比 ── */}
                  <div className="grid grid-cols-2 gap-12">
                    {/* 共同技能 */}
                    <div>
                      <h3 className="text-base font-medium uppercase tracking-wider mb-5" style={{ color: 'var(--color-on-surface-variant)' }}>
                        共同技能 ({compareData.skill_analysis.common.length})
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {compareData.skill_analysis.common.length > 0 ? (
                          compareData.skill_analysis.common.map(s => (
                            <span key={s} className="text-sm px-3 py-1.5 rounded-lg"
                              style={{ background: 'var(--accent-green-dim)', color: 'var(--accent-green)' }}>{s}</span>
                          ))
                        ) : (
                          <span className="text-base" style={{ color: 'var(--color-on-surface-variant)' }}>无共同技能</span>
                        )}
                      </div>
                    </div>

                    {/* 各候选人独有技能 */}
                    <div>
                      <h3 className="text-base font-medium uppercase tracking-wider mb-5" style={{ color: 'var(--color-on-surface-variant)' }}>独有技能</h3>
                      <div className="space-y-4">
                        {compareData.candidates.map((c, idx) => {
                          const unique = compareData.skill_analysis.unique[c.id] || []
                          return (
                            <div key={c.id}>
                              <div className="flex items-center gap-2 mb-2">
                                <span className="w-2.5 h-2.5 rounded-full" style={{ background: getCompareColor(idx) }} />
                                <span className="text-base font-medium" style={{ color: 'var(--color-on-surface)' }}>{c.name}</span>
                                <span className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>({unique.length})</span>
                              </div>
                              <div className="flex flex-wrap gap-2 ml-4.5">
                                {unique.length > 0 ? unique.map(s => (
                                  <span key={s} className="text-sm px-3 py-1.5 rounded-lg"
                                    style={{ background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface)' }}>{s}</span>
                                )) : (
                                  <span className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>无独有技能</span>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>

                  {/* ── 基本信息对比 ── */}
                  <div>
                    <h3 className="text-base font-medium uppercase tracking-wider mb-5" style={{ color: 'var(--color-on-surface-variant)' }}>基本信息</h3>
                    <div className="overflow-hidden rounded-lg border" style={{ borderColor: 'var(--color-outline-variant)' }}>
                      <table className="w-full">
                        <thead>
                          <tr className="border-b" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-low)' }}>
                            <th className="text-left px-5 py-3 text-sm font-medium" style={{ color: 'var(--color-on-surface-variant)' }}>项目</th>
                            {compareData.candidates.map((c, idx) => (
                              <th key={c.id} className="text-left px-5 py-3 text-sm font-medium">
                                <div className="flex items-center gap-1.5">
                                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: getCompareColor(idx) }} />
                                  <span style={{ color: 'var(--color-on-surface)' }}>{c.name}</span>
                                </div>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            { label: '意向岗位', key: 'title' as const },
                            { label: '经验', key: 'exp' as const },
                            { label: '学历', key: 'education' as const },
                            { label: '意向城市', key: 'city' as const },
                            { label: '期望薪资', key: 'salary' as const },
                          ].map(row => (
                            <tr key={row.key} className="border-b last:border-b-0" style={{ borderColor: 'var(--color-outline-variant)' }}>
                              <td className="px-5 py-3 text-base" style={{ color: 'var(--color-on-surface-variant)' }}>{row.label}</td>
                              {compareData.candidates.map(c => (
                                <td key={c.id} className="px-5 py-3 text-base" style={{ color: 'var(--color-on-surface)' }}>
                                  {c[row.key] || '—'}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : null}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── AI 深度对比结果浮层（主界面，DeerFlow 多 Agent 编排）── */}
      <AnimatePresence>
        {showDeepPanel && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-8"
            style={{ background: 'var(--color-scrim, rgba(0,0,0,0.5))' }}
            onClick={() => setShowDeepPanel(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="rounded-2xl border-2 w-full max-w-4xl max-h-[90vh] overflow-y-auto"
              style={{ borderColor: 'var(--color-primary)', background: 'var(--color-surface)' }}
              onClick={e => e.stopPropagation()}
            >
              {/* 浮层头 */}
              <div className="flex items-center justify-between px-8 py-6 border-b sticky top-0 z-10"
                style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface)' }}>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🦌</span>
                  <div>
                    <h2 className="text-2xl font-semibold" style={{ color: 'var(--color-on-surface)' }}>AI 深度对比</h2>
                    <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>DeerFlow 多 Agent 编排 · 技能迁移分析 + 综合决策</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!deepCompareLoading && !deepCompareData && !deepCompareError && (
                    <button onClick={runDeepCompare}
                      className="flex items-center gap-2 h-10 px-5 rounded-lg text-sm font-medium transition-colors"
                      style={{ background: 'var(--color-primary)', color: 'white' }}>
                      启动分析
                    </button>
                  )}
                  <button onClick={() => setShowDeepPanel(false)}
                    className="p-2 rounded-lg transition-colors hover:bg-[var(--color-surface-container-high)]">
                    <X className="h-6 w-6" style={{ color: 'var(--color-on-surface-variant)' }} />
                  </button>
                </div>
              </div>

              {/* 浮层内容 */}
              <div className="px-8 py-8">
                {deepCompareLoading && (
                  <div className="flex flex-col items-center gap-4 py-16">
                    <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--color-primary)' }} />
                    <span className="text-base" style={{ color: 'var(--color-on-surface-variant)' }}>AI Agent 分析中，预计 10-20 秒...</span>
                  </div>
                )}

                {deepCompareError && !deepCompareLoading && (
                  <div className="rounded-lg px-5 py-4 text-base" style={{ background: 'var(--accent-red-dim)', color: 'var(--accent-red-strong)' }}>
                    {deepCompareError}
                  </div>
                )}

                {!deepCompareData && !deepCompareLoading && !deepCompareError && (
                  <div className="py-16 text-center">
                    <p className="text-base" style={{ color: 'var(--color-on-surface-variant)' }}>
                      点击「启动分析」，多 Agent 协同分析候选人技能迁移能力与综合匹配度
                    </p>
                  </div>
                )}

                {deepCompareData && !deepCompareLoading && (
                  <div className="space-y-6">
                    {/* 整体总结 */}
                    <div className="rounded-lg p-5" style={{ background: 'var(--color-primary-fixed-dim)' }}>
                      <p className="text-base leading-relaxed" style={{ color: 'var(--color-on-surface)' }}>
                        {deepCompareData.overall_summary}
                      </p>
                    </div>

                    {/* 排名推荐 */}
                    <div className="space-y-4">
                      {[...deepCompareData.ranking].sort((a, b) => a.rank - b.rank).map((item) => (
                        <div key={item.candidate_id} className="rounded-lg border p-5" style={{ borderColor: 'var(--color-outline-variant)' }}>
                          <div className="flex items-center gap-3 mb-4">
                            <span className="inline-flex items-center justify-center w-9 h-9 rounded-full text-lg font-bold"
                              style={{
                                background: item.rank === 1 ? 'var(--accent-green)' : 'var(--color-surface-container-high)',
                                color: item.rank === 1 ? 'white' : 'var(--color-on-surface-variant)'
                              }}>
                              {item.rank}
                            </span>
                            <span className="text-lg font-semibold" style={{ color: 'var(--color-on-surface)' }}>
                              {item.candidate_name}
                            </span>
                            {item.rank === 1 && (
                              <span className="text-sm px-2.5 py-1 rounded-lg" style={{ background: 'var(--accent-green-dim)', color: 'var(--accent-green)' }}>
                                最推荐
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-3 gap-4 mb-4">
                            {/* 优势 */}
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
                            {/* 劣势 */}
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
                            {/* 风险 */}
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

                          {/* 推荐理由 */}
                          <div className="rounded p-3" style={{ background: 'var(--color-surface-container-low)' }}>
                            <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
                              <span className="font-medium" style={{ color: 'var(--color-on-surface)' }}>推荐理由：</span>
                              {item.recommendation}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* 关键洞察 */}
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
