import { useState, useEffect, useCallback, useRef } from 'react'
import { Search, ChevronDown, Loader2, RefreshCw, Mail, X, TrendingUp } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

// 岗位下拉项类型
interface JobOption {
  id: number
  title: string
  status: string
  count: number
}

// 候选人类型（后端字段已按约定映射: experience→exp, match_score→match, avatar_text→av）
interface Candidate {
  id: number
  name: string
  title: string
  skills: string[]
  exp: string
  salary: string
  match: number | null          // 匹配度可能为 null（匹配引擎未计算时）
  av: string
  match_breakdown: { skill: number | null, exp: number | null, salary: number | null }
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

// 匹配度颜色梯度 — 唯一的状态色规则（高=绿/中=主色/低=灰）
function matchColor(v: number | null) {
  if (v === null || v === undefined) return 'var(--color-on-surface-variant)'
  if (v >= 85) return 'var(--accent-green)'
  if (v >= 70) return 'var(--color-primary)'
  return 'var(--color-on-surface-variant)'
}

export default function TalentSearch() {
  // ── 状态 ──
  const [jobs, setJobs] = useState<JobOption[]>([])
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [selectedJob, setSelectedJob] = useState<number | null>(null)  // null = 全部岗位
  const [search, setSearch] = useState('')                              // 输入框受控值
  const [keyword, setKeyword] = useState('')                            // 实际触发查询的关键字
  const [jobOpen, setJobOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [matching, setMatching] = useState(false)        // 匹配引擎运行中
  const [matchInfo, setMatchInfo] = useState<string>('') // 匹配结果提示
  const [expandedId, setExpandedId] = useState<number | null>(null)  // 当前展开详情的候选人 id

  const jobDropdownRef = useRef<HTMLDivElement>(null)

  // ── 拉取候选人 ──
  const loadCandidates = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      // 组装查询参数：job_id / keyword / page / size
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
        // 统一错误格式处理
        setError(d.error?.message || '查询失败')
      }
    } catch (e) {
      setError('网络错误，请稍后重试')
    } finally {
      setLoading(false)
    }
  }, [selectedJob, keyword])

  // 初始化 + 选中岗位变化 / 关键字变化 时重新拉取
  useEffect(() => {
    loadCandidates()
  }, [loadCandidates])

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

  // ── 触发匹配引擎 ──
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
          `匹配完成：${info.total_jobs || 0} 岗位 × ${info.total_seekers || 0} 候选人 → 更新 ${info.updated || 0} 条，过滤 ${info.skipped || 0} 对`
        )
        // 跑完后刷新列表，立即看到真实分数
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

  // ── 搜索：回车键触发 ──
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      setKeyword(search.trim())   // 仅当回车时才把输入框值同步到查询关键字
    }
  }

  // 选中岗位
  const pickJob = (id: number | null) => {
    setSelectedJob(id)
    setJobOpen(false)
  }

  // 清空搜索
  const clearSearch = () => {
    setSearch('')
    setKeyword('')
  }

  // 当前选中岗位标题（null 时显示"全部岗位"）
  const selectedJobTitle = jobs.find(j => j.id === selectedJob)?.title || '全部岗位'
  const totalCount = jobs.reduce((s, j) => s + j.count, 0)

  // 排序：匹配度高的在前，无匹配数据的沉底
  const sorted = [...candidates].sort((a, b) => {
    const av = a.match ?? -1
    const bv = b.match ?? -1
    return bv - av
  })

  return (
    <div className="h-full flex flex-col">
      {/* ── 顶部工具栏：标题 + 计数 + 重新匹配 ── */}
      <header className="shrink-0 border-b" style={{ borderColor: 'var(--color-outline-variant)' }}>
        <div className="max-w-[1400px] mx-auto px-8 py-5 flex items-center justify-between">
          <div className="flex items-baseline gap-3">
            <h1 className="text-lg font-semibold tracking-tight" style={{ color: 'var(--color-on-surface)' }}>候选人</h1>
            <span className="text-xs tabular-nums" style={{ color: 'var(--color-on-surface-variant)' }}>
              {candidates.length} / {totalCount || '—'}
            </span>
          </div>
          <button
            onClick={runMatch}
            disabled={matching}
            className="flex items-center gap-2 h-8 px-3 rounded-lg text-xs font-medium disabled:opacity-50 transition-colors"
            style={{
              border: '1px solid var(--color-outline-variant)',
              background: 'var(--color-surface)',
              color: 'var(--color-on-surface)'
            }}
          >
            {matching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            {matching ? '匹配中' : '重新匹配'}
          </button>
        </div>
      </header>

      {/* ── 过滤栏：搜索 + 岗位筛选 + 已选条件 ── */}
      <div className="shrink-0 border-b" style={{ borderColor: 'var(--color-outline-variant)' }}>
        <div className="max-w-[1400px] mx-auto px-8 py-3 flex items-center gap-3">
          {/* 搜索框 */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--color-on-surface-variant)' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="搜索姓名 / 技能 / 岗位，按 Enter 查询"
              className="w-full h-9 rounded-lg border pl-9 pr-9 text-sm outline-none focus:border-[color:var(--color-primary)]"
              style={{
                borderColor: 'var(--color-outline-variant)',
                background: 'var(--color-surface)',
                color: 'var(--color-on-surface)'
              }}
            />
            {search && (
              <button
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--color-on-surface-variant)' }}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* 岗位筛选下拉 */}
          <div className="relative" ref={jobDropdownRef}>
            <button
              onClick={() => setJobOpen(!jobOpen)}
              className="flex items-center gap-2 h-9 px-3 rounded-lg border text-sm transition-colors"
              style={{
                borderColor: 'var(--color-outline-variant)',
                background: 'var(--color-surface)',
                color: 'var(--color-on-surface)'
              }}
            >
              <span style={{ color: 'var(--color-on-surface-variant)' }} className="text-xs">岗位</span>
              <span className="font-medium">{selectedJobTitle}</span>
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${jobOpen ? 'rotate-180' : ''}`} style={{ color: 'var(--color-on-surface-variant)' }} />
            </button>
            <AnimatePresence>
              {jobOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-1.5 w-72 rounded-lg border py-1 z-50 max-h-80 overflow-y-auto shadow-lg"
                  style={{
                    borderColor: 'var(--color-outline-variant)',
                    background: 'var(--color-surface-container-lowest)'
                  }}
                >
                  {/* 全部岗位选项 */}
                  <button
                    onClick={() => pickJob(null)}
                    className="flex items-center justify-between w-full px-3 py-2 text-sm transition-colors hover:bg-[var(--color-surface-container-high)]"
                    style={{
                      color: selectedJob === null ? 'var(--color-primary)' : 'var(--color-on-surface)',
                      fontWeight: selectedJob === null ? 600 : 400
                    }}
                  >
                    <span>全部岗位</span>
                    <span className="text-xs tabular-nums" style={{ color: 'var(--color-on-surface-variant)' }}>{totalCount}</span>
                  </button>
                  {jobs.map(job => (
                    <button
                      key={job.id}
                      onClick={() => pickJob(job.id)}
                      className="flex items-center justify-between w-full px-3 py-2 text-sm transition-colors hover:bg-[var(--color-surface-container-high)]"
                      style={{
                        color: selectedJob === job.id ? 'var(--color-primary)' : 'var(--color-on-surface)',
                        fontWeight: selectedJob === job.id ? 600 : 400
                      }}
                    >
                      <span className="truncate">{job.title}</span>
                      <span className="text-xs tabular-nums ml-2 shrink-0" style={{ color: 'var(--color-on-surface-variant)' }}>{job.count}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* 已选条件 chips + 匹配结果提示 */}
        {(keyword || selectedJob || matchInfo) && (
          <div className="max-w-[1400px] mx-auto px-8 pb-3 flex items-center gap-2 flex-wrap text-xs">
            {keyword && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded" style={{ background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface-variant)' }}>
                关键词: {keyword}
                <button onClick={clearSearch}><X className="h-3 w-3" /></button>
              </span>
            )}
            {selectedJob && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded" style={{ background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface-variant)' }}>
                岗位: {selectedJobTitle}
                <button onClick={() => pickJob(null)}><X className="h-3 w-3" /></button>
              </span>
            )}
            {matchInfo && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded" style={{ background: 'var(--accent-green-dim)', color: 'var(--accent-green)' }}>
                <TrendingUp className="h-3 w-3" /> {matchInfo}
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── 错误提示 ── */}
      {error && (
        <div className="max-w-[1400px] mx-auto px-8 pt-4">
          <div className="rounded-lg border px-3 py-2 text-xs" style={{ borderColor: 'var(--accent-red)', background: 'var(--accent-red-dim)', color: 'var(--accent-red-strong)' }}>
            {error}
          </div>
        </div>
      )}

      {/* ── 候选人列表 — 行布局而非卡片 ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[1400px] mx-auto px-8 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-20 gap-2" style={{ color: 'var(--color-on-surface-variant)' }}>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">加载中</span>
            </div>
          ) : sorted.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>暂无候选人</p>
              <p className="text-xs mt-1" style={{ color: 'var(--color-on-surface-variant)', opacity: 0.6 }}>
                {keyword || selectedJob ? '调整筛选条件或清除过滤' : '运行"重新匹配"以生成候选人列表'}
              </p>
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--color-outline-variant)' }}>
              {/* 列表头 — 极简、非粗体、灰色 */}
              <div className="grid grid-cols-[1fr_2fr_2fr_1.5fr_80px_40px] gap-4 px-4 py-2 text-[11px] uppercase tracking-wider border-b"
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
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(i * 0.02, 0.2) }}
                  >
                    <div
                      onClick={() => setExpandedId(expanded ? null : c.id)}
                      className="grid grid-cols-[1fr_2fr_2fr_1.5fr_80px_40px] gap-4 px-4 py-3 items-center cursor-pointer transition-colors border-b last:border-b-0"
                      style={{
                        borderColor: 'var(--color-outline-variant)',
                        background: expanded ? 'var(--color-surface-container-low)' : 'var(--color-surface)'
                      }}
                      onMouseEnter={e => {
                        if (!expanded) e.currentTarget.style.background = 'var(--color-surface-container-low)'
                      }}
                      onMouseLeave={e => {
                        if (!expanded) e.currentTarget.style.background = 'var(--color-surface)'
                      }}
                    >
                      {/* 匹配度 — 用细竖条 + 数字，不用大卡片 */}
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-8 rounded-full" style={{ background: matchColor(c.match) }} />
                        <span className="text-sm font-semibold tabular-nums" style={{ color: matchColor(c.match) }}>
                          {c.match ?? '—'}
                          {c.match !== null && <span className="text-xs ml-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>%</span>}
                        </span>
                      </div>

                      {/* 候选人 — 头像 + 姓名 + 岗位标签 */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
                          style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-primary)' }}>
                          {c.av}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium truncate" style={{ color: 'var(--color-on-surface)' }}>{c.name}</span>
                            {c.job_title && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0"
                                style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-primary)' }}>
                                {c.job_title}
                              </span>
                            )}
                          </div>
                          {c.title && (
                            <p className="text-xs truncate mt-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>
                              意向：{c.title}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* 技能 — 前 3 个 + N */}
                      <div className="flex flex-wrap gap-1 items-center">
                        {visibleSkills.map(s => (
                          <span key={s} className="text-[11px] px-1.5 py-0.5 rounded"
                            style={{ background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface-variant)' }}>
                            {s}
                          </span>
                        ))}
                        {hiddenCount > 0 && (
                          <span className="text-[11px] tabular-nums" style={{ color: 'var(--color-on-surface-variant)' }}>
                            +{hiddenCount}
                          </span>
                        )}
                        {c.skills.length === 0 && (
                          <span className="text-[11px]" style={{ color: 'var(--color-on-surface-variant)', opacity: 0.5 }}>—</span>
                        )}
                      </div>

                      {/* 经验 / 期望薪资 — 列对齐 */}
                      <div className="text-xs space-y-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>
                        <div className="tabular-nums">{c.exp || '—'}</div>
                        <div className="tabular-nums">{c.salary || '—'}</div>
                      </div>

                      {/* 综合分数 — 大数字右对齐 */}
                      <div className="text-right">
                        <span className="text-sm font-bold tabular-nums" style={{ color: matchColor(c.match) }}>
                          {c.match ?? '—'}
                        </span>
                      </div>

                      {/* 展开指示 */}
                      <div className="flex justify-end">
                        <ChevronDown
                          className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
                          style={{ color: 'var(--color-on-surface-variant)' }}
                        />
                      </div>
                    </div>

                    {/* 展开详情 — 内联而非弹层，保持上下文 */}
                    <AnimatePresence initial={false}>
                      {expanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden border-b"
                          style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}
                        >
                          <div className="px-4 py-4 grid grid-cols-3 gap-6">
                            {/* 三维度匹配分数 — 紧凑横排 */}
                            <div>
                              <p className="text-[11px] uppercase tracking-wider mb-3" style={{ color: 'var(--color-on-surface-variant)' }}>匹配维度</p>
                              <div className="space-y-2.5">
                                {[
                                  { label: '技能', val: c.match_breakdown.skill, color: 'var(--color-primary)' },
                                  { label: '经验', val: c.match_breakdown.exp, color: 'var(--accent-purple)' },
                                  { label: '薪资', val: c.match_breakdown.salary, color: 'var(--accent-green)' },
                                ].map(item => (
                                  <div key={item.label} className="flex items-center gap-3">
                                    <span className="text-xs w-8" style={{ color: 'var(--color-on-surface-variant)' }}>{item.label}</span>
                                    <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'var(--color-surface-container-high)' }}>
                                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${item.val ?? 0}%`, background: item.color }} />
                                    </div>
                                    <span className="text-xs font-semibold tabular-nums w-8 text-right" style={{ color: item.color }}>
                                      {item.val ?? '—'}
                                    </span>
                                  </div>
                                ))}
                              </div>
                              {c.match === null && (
                                <p className="text-[11px] mt-2" style={{ color: 'var(--color-on-surface-variant)' }}>
                                  匹配引擎尚未计算，点击右上角"重新匹配"
                                </p>
                              )}
                            </div>

                            {/* 全部技能 */}
                            <div>
                              <p className="text-[11px] uppercase tracking-wider mb-3" style={{ color: 'var(--color-on-surface-variant)' }}>
                                技能 ({c.skills.length})
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {c.skills.map(s => (
                                  <span key={s} className="text-xs px-2 py-1 rounded"
                                    style={{ background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface)' }}>
                                    {s}
                                  </span>
                                ))}
                                {c.skills.length === 0 && (
                                  <span className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>未提供</span>
                                )}
                              </div>
                            </div>

                            {/* 操作 */}
                            <div>
                              <p className="text-[11px] uppercase tracking-wider mb-3" style={{ color: 'var(--color-on-surface-variant)' }}>操作</p>
                              <div className="flex flex-col gap-2 items-start">
                                <button
                                  className="inline-flex items-center gap-2 h-8 px-3 rounded-lg text-xs font-medium"
                                  style={{ border: '1px solid var(--color-outline-variant)', background: 'var(--color-surface)', color: 'var(--color-on-surface)' }}
                                >
                                  <Mail className="h-3.5 w-3.5" /> 发起沟通
                                </button>
                                <p className="text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>
                                  状态：{c.match_status === 'accepted' ? '已接受' : c.match_status === 'rejected' ? '已拒绝' : '待沟通'}
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
    </div>
  )
}
