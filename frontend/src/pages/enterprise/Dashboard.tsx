import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Loader2, Briefcase, Users, TrendingUp, MessageSquare, BarChart3, Rocket, Search, FileText } from 'lucide-react'
import { EPNav } from '../../lib/NavContext'

interface DashboardData {
  metrics: {
    active_jobs: number
    total_candidates: number
    high_match: number
    pending_count: number
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

const STATUS_MAP: Record<string, { label: string, color: string, bg: string }> = {
  'active':  { label: '招聘中', color: 'var(--accent-green)', bg: 'var(--accent-green-dim)' },
  'draft':   { label: '草稿',   color: 'var(--accent-orange)', bg: 'var(--accent-orange-dim)' },
  'closed':  { label: '已关闭', color: 'var(--color-on-surface-variant)', bg: 'var(--color-surface-container-high)' },
}

const METRIC_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b']
const METRIC_ICONS = [Briefcase, Users, TrendingUp, MessageSquare]

export default function Dashboard() {
  const { setPage } = EPNav.use()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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

  const metrics = [
    { label: '在招职位', value: data.metrics.active_jobs, icon: Briefcase, action: () => setPage('jobs') },
    { label: '匹配候选人', value: data.metrics.total_candidates, icon: Users, action: () => setPage('talent') },
    { label: '高匹配人才', value: data.metrics.high_match, icon: TrendingUp, action: () => setPage('talent') },
    { label: '待沟通', value: data.metrics.pending_count, icon: MessageSquare, action: () => setPage('talent') },
  ]

  const distributions = [
    { label: '高匹配 (≥85)', val: data.match_distribution.high, color: 'var(--accent-green)' },
    { label: '中匹配 (60-84)', val: data.match_distribution.mid, color: 'var(--color-primary)' },
    { label: '低匹配 (<60)', val: data.match_distribution.low, color: 'var(--color-on-surface-variant)' },
  ]
  const totalDist = distributions.reduce((s, d) => s + d.val, 0) || 1

  const shortcuts = [
    { label: '人才星', desc: '查看匹配的候选人', page: 'talent' as const, icon: Search, color: '#3b82f6' },
    { label: '岗位管理', desc: '发布与编辑岗位', page: 'jobs' as const, icon: Briefcase, color: '#8b5cf6' },
    { label: '市场洞察', desc: '技能需求与趋势', page: 'market' as const, icon: BarChart3, color: '#10b981' },
    // 行业报告页面在 EnterpriseShell 里注册的 key 是 industry，不是 report
    { label: '行业报告', desc: '行业人才分布', page: 'industry' as const, icon: FileText, color: '#f59e0b' },
  ]

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      {/* 头部渐变横幅 */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl p-6" style={{ background: 'linear-gradient(135deg, var(--color-primary-fixed) 0%, var(--color-surface-container-lowest) 100%)' }}>
        <div className="absolute top-0 right-0 w-48 h-48 rounded-full blur-3xl opacity-20" style={{ background: 'var(--color-primary)' }} />
        <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full blur-3xl opacity-10" style={{ background: 'var(--accent-purple)' }} />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <Rocket className="h-4 w-4" style={{ color: 'var(--color-primary)' }} />
            <span className="text-xs font-medium" style={{ color: 'var(--color-primary)' }}>企业工作台</span>
          </div>
          <h1 className="text-2xl font-extrabold" style={{ color: 'var(--color-on-surface)' }}>欢迎回来，<span className="gradient-text">HR</span></h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>基于多源异构数据与知识图谱，精准定位你的招聘方向</p>
        </div>
      </motion.div>

      {/* 核心指标卡片 */}
      <div className="grid grid-cols-4 gap-4">
        {metrics.map((m, i) => {
          const Icon = m.icon
          const color = METRIC_COLORS[i]
          return (
            <motion.div key={m.label}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              whileHover={{ scale: 1.02, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
              onClick={m.action}
              className="rounded-2xl border p-5 cursor-pointer transition-all shadow-sm"
              style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium" style={{ color: 'var(--color-on-surface-variant)' }}>{m.label}</span>
                <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ background: `${color}15` }}>
                  <Icon className="h-4 w-4" style={{ color }} />
                </div>
              </div>
              <p className="text-3xl font-bold tabular-nums" style={{ color }}>{m.value}</p>
              <div className="mt-3 h-1 rounded-full overflow-hidden" style={{ background: 'var(--color-surface-container-high)' }}>
                <motion.div className="h-full rounded-full" style={{ background: `linear-gradient(90deg, ${color}, ${color}aa)` }}
                  initial={{ width: 0 }} animate={{ width: '60%' }} transition={{ duration: 0.8, delay: i * 0.1 }} />
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* 快捷功能卡片 */}
      <div>
        <h2 className="text-sm font-bold mb-3" style={{ color: 'var(--color-on-surface)' }}>快捷功能</h2>
        <div className="grid grid-cols-4 gap-4">
          {shortcuts.map((item, i) => {
            const Icon = item.icon
            return (
              <motion.button key={item.label}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.06 }}
                whileHover={{ scale: 1.02, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setPage(item.page)}
                className="rounded-2xl border p-5 text-left transition-all shadow-sm"
                style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
                <div className="h-10 w-10 rounded-xl flex items-center justify-center mb-3" style={{ background: `${item.color}15` }}>
                  <Icon className="h-5 w-5" style={{ color: item.color }} />
                </div>
                <p className="text-sm font-bold" style={{ color: 'var(--color-on-surface)' }}>{item.label}</p>
                <p className="text-xs mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>{item.desc}</p>
              </motion.button>
            )
          })}
        </div>
      </div>

      {/* 双栏：近期岗位 + 匹配分布 */}
      <div className="grid grid-cols-5 gap-5">
        {/* 近期岗位 */}
        <div className="col-span-3 rounded-2xl border p-5 shadow-sm" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold" style={{ color: 'var(--color-on-surface)' }}>近期岗位</h2>
            <button onClick={() => setPage('jobs')}
              className="flex items-center gap-1 text-xs font-medium transition-colors hover:opacity-80"
              style={{ color: 'var(--color-primary)' }}>
              全部岗位 <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
          {data.recent_jobs.length > 0 ? (
            <div className="space-y-2">
              {data.recent_jobs.map((job, i) => {
                const st = STATUS_MAP[job.status] || STATUS_MAP['active']
                return (
                  <motion.div key={job.id}
                    initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 + i * 0.05 }}
                    whileHover={{ scale: 1.01, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
                    onClick={() => setPage('jobs', { selectedJobId: job.id })}
                    className="flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all"
                    style={{ background: 'var(--color-surface)' }}>
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs tabular-nums w-8 text-center" style={{ color: 'var(--color-on-surface-variant)' }}>{String(i + 1).padStart(2, '0')}</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate" style={{ color: 'var(--color-on-surface)' }}>{job.title}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-lg font-medium" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                        </div>
                        <p className="text-[10px] mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>{job.created_at}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-lg font-bold tabular-nums" style={{ color: 'var(--color-primary)' }}>{job.candidates}</p>
                      <p className="text-[10px]" style={{ color: 'var(--color-on-surface-variant)' }}>候选人</p>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm py-8 text-center" style={{ color: 'var(--color-on-surface-variant)' }}>暂无岗位</p>
          )}
        </div>

        {/* 匹配度分布 */}
        <div className="col-span-2 rounded-2xl border p-5 shadow-sm" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
          <h2 className="text-sm font-bold mb-4" style={{ color: 'var(--color-on-surface)' }}>匹配度分布</h2>
          <div className="space-y-5">
            {distributions.map((item, i) => (
              <div key={item.label}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>{item.label}</span>
                  <span className="text-xs font-bold tabular-nums" style={{ color: item.color }}>
                    {item.val}
                    <span className="font-normal ml-1" style={{ color: 'var(--color-on-surface-variant)' }}>
                      ({Math.round(item.val / totalDist * 100)}%)
                    </span>
                  </span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--color-surface-container-high)' }}>
                  <motion.div className="h-full rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${item.val / totalDist * 100}%` }}
                    transition={{ duration: 0.6, delay: 0.5 + i * 0.1 }}
                    style={{ background: item.color }} />
                </div>
              </div>
            ))}
            <div className="pt-4 border-t" style={{ borderColor: 'var(--color-outline-variant)' }}>
              <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                总计 <span className="font-bold" style={{ color: 'var(--color-on-surface)' }}>{totalDist}</span> 位候选人
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
