import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Loader2 } from 'lucide-react'
import { EPNav } from '../../lib/NavContext'

// 仪表盘数据类型
interface DashboardData {
  metrics: {
    active_jobs: number        // 在招岗位数
    total_candidates: number   // 匹配候选人总数（去重）
    high_match: number         // 高匹配度候选人数 (>=85)
    pending_count: number      // 待处理匹配记录数
  }
  recent_jobs: Array<{
    id: number
    title: string
    status: string
    candidates: number
    created_at: string
  }>
  match_distribution: {
    high: number
    mid: number
    low: number
  }
}

// 状态文案与颜色映射（后端 status: active/closed/draft → 前端中文）
const STATUS_MAP: Record<string, { label: string, color: string }> = {
  'active':  { label: '招聘中', color: 'var(--accent-green)' },
  'draft':   { label: '草稿',   color: 'var(--accent-orange)' },
  'closed':  { label: '已关闭', color: 'var(--color-on-surface-variant)' },
}

export default function Dashboard() {
  const { setPage } = EPNav.use()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // 拉取仪表盘汇总数据
  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const r = await fetch('/api/enterprise/dashboard')
      const d = await r.json()
      if (d.success) setData(d.data)
      else setError(d.error?.message || '加载失败')
    } catch {
      setError('网络错误')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full gap-2" style={{ color: 'var(--color-on-surface-variant)' }}>
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">加载中</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="rounded-lg border px-3 py-2 text-xs" style={{ borderColor: 'var(--accent-red)', background: 'var(--accent-red-dim)', color: 'var(--accent-red-strong)' }}>
          {error}
        </div>
      </div>
    )
  }

  if (!data) return null

  // 指标 — utility copy，不是营销文案
  const metrics = [
    { label: '在招职位', value: data.metrics.active_jobs, action: () => setPage('jobs') },
    { label: '匹配候选人', value: data.metrics.total_candidates, action: () => setPage('talent') },
    { label: '高匹配人才 (≥85)', value: data.metrics.high_match, action: () => setPage('talent') },
    { label: '待沟通', value: data.metrics.pending_count, action: () => setPage('talent') },
  ]

  // 匹配度分布 — 用于水平条形图
  const distributions = [
    { label: '高匹配 (≥85)', val: data.match_distribution.high, color: 'var(--accent-green)' },
    { label: '中匹配 (60-84)', val: data.match_distribution.mid, color: 'var(--color-primary)' },
    { label: '低匹配 (<60)', val: data.match_distribution.low, color: 'var(--color-on-surface-variant)' },
  ]
  const totalDist = distributions.reduce((s, d) => s + d.val, 0) || 1

  // 快捷入口 — 仅一个 accent 色，去掉营销文案
  const shortcuts = [
    { label: '人才星', desc: '查看匹配的候选人', page: 'talent' as const },
    { label: '岗位管理', desc: '发布与编辑岗位', page: 'jobs' as const },
    { label: '市场洞察', desc: '技能需求与趋势', page: 'market' as const },
  ]

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-14 py-12 space-y-12">
        {/* ── KPI 区 — 无卡片，列对齐 ── */}
        <section>
          <h2 className="text-base font-medium uppercase tracking-wider mb-6" style={{ color: 'var(--color-on-surface-variant)' }}>核心指标</h2>
          <div className="grid grid-cols-4 border-y" style={{ borderColor: 'var(--color-outline-variant)' }}>
            {metrics.map((m, i) => (
              <motion.div
                key={m.label}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                transition={{ delay: i * 0.04 }}
                onClick={m.action}
                className={`py-9 px-3 ${i < 3 ? 'border-r' : ''} cursor-pointer transition-colors hover:bg-[var(--color-surface-container-low)]`}
                style={{ borderColor: 'var(--color-outline-variant)' }}
              >
                <p className="text-base mb-3" style={{ color: 'var(--color-on-surface-variant)' }}>{m.label}</p>
                <p className="text-6xl font-semibold tabular-nums tracking-tight" style={{ color: 'var(--color-on-surface)' }}>
                  {m.value}
                </p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ── 双栏：近期岗位 + 匹配分布 ── */}
        <section className="grid grid-cols-3 gap-12">
          {/* 近期岗位 — 列表，无卡片 */}
          <div className="col-span-2">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-base font-medium uppercase tracking-wider" style={{ color: 'var(--color-on-surface-variant)' }}>近期岗位</h2>
              <button
                onClick={() => setPage('jobs')}
                className="flex items-center gap-2 text-base transition-colors hover:text-[var(--color-primary)]"
                style={{ color: 'var(--color-on-surface-variant)' }}
              >
                全部岗位 <ArrowRight className="h-5 w-5" />
              </button>
            </div>
            {data.recent_jobs.length > 0 ? (
              <div className="border-t" style={{ borderColor: 'var(--color-outline-variant)' }}>
                {data.recent_jobs.map((job, i) => {
                  const st = STATUS_MAP[job.status] || STATUS_MAP['active']
                  return (
                    <div
                      key={job.id}
                      onClick={() => setPage('jobs', { selectedJobId: job.id })}
                      className="flex items-center justify-between py-5 border-b transition-colors hover:bg-[var(--color-surface-container-low)] cursor-pointer -mx-3 px-3 rounded"
                      style={{ borderColor: 'var(--color-outline-variant)' }}
                    >
                      <div className="flex items-center gap-5 min-w-0">
                        <span className="text-base tabular-nums w-10" style={{ color: 'var(--color-on-surface-variant)' }}>{String(i + 1).padStart(2, '0')}</span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-medium truncate" style={{ color: 'var(--color-on-surface)' }}>{job.title}</span>
                            <span className="text-sm" style={{ color: st.color }}>· {st.label}</span>
                          </div>
                          <p className="text-sm mt-1.5 tabular-nums" style={{ color: 'var(--color-on-surface-variant)' }}>{job.created_at}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-semibold tabular-nums" style={{ color: 'var(--color-on-surface)' }}>{job.candidates}</p>
                        <p className="text-sm mt-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>候选人</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-lg py-12 text-center" style={{ color: 'var(--color-on-surface-variant)' }}>暂无岗位</p>
            )}
          </div>

          {/* 匹配度分布 — 水平条形图 */}
          <div>
            <h2 className="text-base font-medium uppercase tracking-wider mb-6" style={{ color: 'var(--color-on-surface-variant)' }}>匹配度分布</h2>
            <div className="space-y-6">
              {distributions.map(item => (
                <div key={item.label}>
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-base" style={{ color: 'var(--color-on-surface-variant)' }}>{item.label}</span>
                    <span className="text-base font-semibold tabular-nums" style={{ color: item.color }}>
                      {item.val}
                      <span className="text-sm ml-1.5" style={{ color: 'var(--color-on-surface-variant)' }}>
                        ({Math.round(item.val / totalDist * 100)}%)
                      </span>
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--color-surface-container-high)' }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${item.val / totalDist * 100}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                      className="h-full rounded-full"
                      style={{ background: item.color }}
                    />
                  </div>
                </div>
              ))}
              <div className="pt-5 mt-5 border-t" style={{ borderColor: 'var(--color-outline-variant)' }}>
                <p className="text-base tabular-nums" style={{ color: 'var(--color-on-surface-variant)' }}>
                  总计 {totalDist} 位候选人
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── 快捷入口 — 列布局，单一 accent 色 ── */}
        <section>
          <h2 className="text-base font-medium uppercase tracking-wider mb-6" style={{ color: 'var(--color-on-surface-variant)' }}>快捷入口</h2>
          <div className="grid grid-cols-3 border-y" style={{ borderColor: 'var(--color-outline-variant)' }}>
            {shortcuts.map((item, i) => (
              <motion.button
                key={item.label}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => setPage(item.page)}
                className={`text-left py-8 px-6 transition-colors hover:bg-[var(--color-surface-container-low)] ${i < 2 ? 'border-r' : ''}`}
                style={{ borderColor: 'var(--color-outline-variant)' }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xl font-medium" style={{ color: 'var(--color-on-surface)' }}>{item.label}</p>
                    <p className="text-base mt-1.5" style={{ color: 'var(--color-on-surface-variant)' }}>{item.desc}</p>
                  </div>
                  <ArrowRight className="h-6 w-6" style={{ color: 'var(--color-on-surface-variant)' }} />
                </div>
              </motion.button>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
