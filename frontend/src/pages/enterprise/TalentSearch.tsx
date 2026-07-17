import { useState, useEffect, useCallback } from 'react'
import { Search, Users, Mail, ChevronDown, Loader2, Sparkles } from 'lucide-react'
import { motion } from 'framer-motion'

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
        setMatchInfo(`匹配完成：${info.total_jobs || 0} 个岗位 × ${info.total_seekers || 0} 位候选人 → 更新 ${info.updated || 0} 条记录`)
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

  // 当前选中岗位标题（null 时显示"全部岗位"）
  const selectedJobTitle = jobs.find(j => j.id === selectedJob)?.title || '全部岗位'

  return (
    <div className="space-y-6 px-6 py-8 max-w-[1400px] mx-auto">
      {/* 标题区 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--color-on-surface)' }}>人才星</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>基于能力图谱精准匹配候选人</p>
        </div>
        {/* 重新匹配按钮 — 触发后端匹配引擎 */}
        <button
          onClick={runMatch}
          disabled={matching}
          className="flex items-center gap-2 h-10 px-4 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
          style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--accent-purple))' }}
        >
          {matching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {matching ? '匹配中...' : '重新匹配'}
        </button>
      </div>

      {/* 匹配结果提示 */}
      {matchInfo && (
        <div className="rounded-xl border p-3 text-xs flex items-center gap-2" style={{ borderColor: 'var(--color-outline-variant)', background: 'rgba(0,229,153,0.06)', color: 'var(--accent-green)' }}>
          <Sparkles className="h-3.5 w-3.5" />
          {matchInfo}
        </div>
      )}

      {/* 搜索 + 岗位筛选 */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4.5 w-4.5" style={{ color: 'var(--color-on-surface-variant)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="搜索姓名/技能/岗位，按回车查询..."
            className="w-full h-11 rounded-xl border pl-11 pr-4 text-sm outline-none"
            style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)', color: 'var(--color-on-surface)' }}
          />
        </div>
        <div className="relative">
          <button
            onClick={() => setJobOpen(!jobOpen)}
            className="flex items-center gap-2 h-11 px-4 rounded-xl border text-sm font-medium"
            style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)', color: 'var(--color-on-surface-variant)' }}
          >
            <Users className="h-4.5 w-4.5" />
            {selectedJobTitle}
            <ChevronDown className="h-4 w-4" />
          </button>
          {jobOpen && (
            <motion.div
              initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
              className="absolute right-0 top-full mt-2 w-72 rounded-xl border py-1 z-50 max-h-80 overflow-y-auto"
              style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}
            >
              {/* 全部岗位选项 */}
              <button
                onClick={() => pickJob(null)}
                className="flex items-center justify-between w-full px-4 py-3 text-sm transition-colors"
                style={{
                  color: selectedJob === null ? 'var(--color-primary)' : 'var(--color-on-surface)',
                  background: selectedJob === null ? 'var(--color-primary-fixed)' : 'transparent',
                }}
              >
                <span>全部岗位</span>
                <span className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                  {jobs.reduce((s, j) => s + j.count, 0)} 人
                </span>
              </button>
              {jobs.map(job => (
                <button
                  key={job.id}
                  onClick={() => pickJob(job.id)}
                  className="flex items-center justify-between w-full px-4 py-3 text-sm transition-colors"
                  style={{
                    color: selectedJob === job.id ? 'var(--color-primary)' : 'var(--color-on-surface)',
                    background: selectedJob === job.id ? 'var(--color-primary-fixed)' : 'transparent',
                  }}
                >
                  <span>{job.title}</span>
                  <span className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>{job.count} 人</span>
                </button>
              ))}
            </motion.div>
          )}
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="rounded-xl border p-4 text-sm" style={{ borderColor: 'var(--color-outline-variant)', background: 'rgba(255,99,99,0.08)', color: '#E5484D' }}>
          {error}
        </div>
      )}

      {/* 候选人列表 */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2" style={{ color: 'var(--color-on-surface-variant)' }}>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">加载候选人中...</span>
          </div>
        ) : candidates.length === 0 ? (
          <div className="text-center py-16 text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
            暂无匹配的候选人
          </div>
        ) : (
          candidates.map((c, i) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: i * 0.04 }}
              className="rounded-xl border p-5 transition-all hover:shadow-md cursor-pointer"
              style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  {/* 头像文字 */}
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-base font-bold" style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-primary)' }}>{c.av}</div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold" style={{ color: 'var(--color-on-surface)' }}>{c.name}</h3>
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-primary)' }}>{c.title}</span>
                    </div>
                    <p className="text-xs mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>{c.exp} · {c.salary}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {/* 匹配度：null 时显示"暂无匹配数据" */}
                  {c.match === null || c.match === undefined ? (
                    <span className="text-xs px-2 py-1 rounded" style={{ background: 'rgba(150,150,150,0.1)', color: 'var(--color-on-surface-variant)' }}>暂无匹配数据</span>
                  ) : (
                    <p className="text-xl font-bold" style={{ color: c.match >= 85 ? 'var(--accent-green)' : 'var(--color-primary)' }}>{c.match}%</p>
                  )}
                  <button className="p-2 rounded-lg border" style={{ borderColor: 'var(--color-outline-variant)', color: 'var(--color-primary)' }}><Mail className="h-4.5 w-4.5" /></button>
                </div>
              </div>
              {/* 技能标签 */}
              <div className="flex flex-wrap gap-2 mt-4">
                {c.skills.map(s => (
                  <span key={s} className="text-xs px-2.5 py-1 rounded-full" style={{ background: '#D5E4FA', color: 'var(--color-on-surface-variant)' }}>{s}</span>
                ))}
              </div>
              {/* 三维度匹配分数条 — 匹配引擎产出，null 时隐藏 */}
              {c.match !== null && c.match !== undefined && (
                <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t" style={{ borderColor: 'var(--color-outline-variant)' }}>
                  {[
                    { label: '技能匹配', val: c.match_breakdown.skill, color: 'var(--color-primary)' },
                    { label: '经验匹配', val: c.match_breakdown.exp, color: 'var(--accent-purple)' },
                    { label: '薪资匹配', val: c.match_breakdown.salary, color: 'var(--accent-green)' },
                  ].map(item => (
                    <div key={item.label}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px]" style={{ color: 'var(--color-on-surface-variant)' }}>{item.label}</span>
                        <span className="text-xs font-semibold" style={{ color: item.color }}>{item.val ?? '-'}%</span>
                      </div>
                      {/* 进度条 */}
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-surface-container-high)' }}>
                        <div className="h-full rounded-full transition-all" style={{ width: `${item.val ?? 0}%`, background: item.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          ))
        )}
      </div>
    </div>
  )
}
