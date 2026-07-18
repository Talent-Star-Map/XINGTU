import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Briefcase, Users, TrendingUp, MessageCircle, Search, Target, Zap, Loader2 } from 'lucide-react'
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
// 使用主题变量，在亮/暗两种主题下自动适配
const STATUS_MAP: Record<string, { label: string, bg: string, color: string }> = {
  'active':  { label: '招聘中', bg: 'var(--accent-green-dim)', color: 'var(--accent-green)' },
  'draft':   { label: '草稿',   bg: 'var(--accent-orange-dim)', color: 'var(--accent-orange)' },
  'closed':  { label: '已关闭', bg: 'var(--color-neutral-dim)', color: 'var(--color-on-surface-variant)' },
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

  // 热点技能（暂保留静态 — 后续可由匹配引擎统计技能出现频次得出）
  const hotSkills = [
    { name: 'LangChain', growth: '+320%', hot: true },
    { name: 'MCP协议', growth: '新发', hot: true },
    { name: 'Agent框架', growth: '+180%', hot: true },
    { name: 'RAG', growth: '+210%', hot: true },
    { name: 'Kubernetes', growth: '+89%', hot: false },
    { name: 'Python', growth: '+45%', hot: false },
  ]

  // 指标卡配置（数据来自后端 metrics）
  // 使用主题变量，color 用于文字/图标，bg 用于卡片底色，iconBg 用于图标圆形背景
  const metrics = data ? [
    { label: '在招职位', value: data.metrics.active_jobs, icon: Briefcase, color: 'var(--accent-green)', bg: 'var(--color-surface-container-lowest)', iconBg: 'var(--accent-green-dim)', colSpan: 1 },
    { label: '匹配候选人', value: data.metrics.total_candidates, icon: Users, color: 'var(--accent-purple)', bg: 'var(--color-surface-container-lowest)', iconBg: 'var(--accent-purple-dim)', colSpan: 1 },
    { label: '高匹配人才', value: data.metrics.high_match, icon: Target, color: 'var(--color-primary)', bg: 'var(--color-primary-fixed)', iconBg: 'var(--accent-cyan-dim)', colSpan: 1 },
    { label: '待处理沟通', value: data.metrics.pending_count, icon: MessageCircle, color: 'var(--accent-orange)', bg: 'var(--color-surface-container-lowest)', iconBg: 'var(--accent-orange-dim)', colSpan: 1 },
  ] : []

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32 gap-2" style={{ color: 'var(--color-on-surface-variant)' }}>
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">加载中...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="px-6 py-8">
        <div className="rounded-xl border p-4 text-sm" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--accent-red-dim)', color: 'var(--accent-red-strong)' }}>
          {error}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 px-6 py-8 max-w-[1400px] mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-extrabold" style={{ color: 'var(--color-on-surface)' }}>欢迎回来，<span className="gradient-text">HR</span></h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>这是您今天的招聘数据概览。</p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-4 gap-5">
        {metrics.map((m, i) => (
          <motion.div key={m.label} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }}
            className="rounded-xl border p-5 transition-all hover:shadow-md" style={{ gridColumn: m.colSpan === 2 ? 'span 2' : 'span 1', borderColor: 'var(--color-outline-variant)', background: m.bg }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-on-surface-variant)' }}>{m.label}</p>
                <p className="text-3xl font-extrabold mt-1" style={{ color: m.color }}>{m.value}</p>
              </div>
              <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: m.iconBg }}>
                <m.icon className="h-6 w-6" style={{ color: m.color }} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* 近期岗位 — 数据来自后端 recent_jobs */}
        <div className="col-span-2 rounded-xl border" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
          <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--color-outline-variant)' }}>
            <h2 className="text-base font-bold" style={{ color: 'var(--color-on-surface)' }}>近期岗位</h2>
            <button
              onClick={() => setPage('jobs')}
              className="text-xs font-medium hover:underline transition-all"
              style={{ color: 'var(--color-primary)' }}
            >
              查看全部 →
            </button>
          </div>
          <div className="divide-y" style={{ borderColor: 'var(--color-outline-variant)' }}>
            {data && data.recent_jobs.length > 0 ? data.recent_jobs.map((job, i) => {
              const st = STATUS_MAP[job.status] || STATUS_MAP['active']
              return (
                <div
                  key={job.id}
                  onClick={() => setPage('jobs')}
                  className="flex items-center justify-between px-6 py-4 hover:bg-[var(--color-surface)] transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg text-xs font-bold" style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-primary)' }}>{i + 1}</div>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: 'var(--color-on-surface)' }}>{job.title}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>发布于 {job.created_at}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-5">
                    <div className="text-right">
                      <p className="text-xs font-semibold" style={{ color: 'var(--color-on-surface)' }}>{job.candidates} 人</p>
                      <p className="text-[10px]" style={{ color: 'var(--color-on-surface-variant)' }}>候选人</p>
                    </div>
                    <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                  </div>
                </div>
              )
            }) : (
              <div className="px-6 py-10 text-center text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>暂无岗位</div>
            )}
          </div>
        </div>

        {/* 匹配度分布 — 数据来自后端 match_distribution */}
        <div className="rounded-xl border" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
          <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--color-outline-variant)' }}>
            <h2 className="text-base font-bold" style={{ color: 'var(--color-on-surface)' }}>匹配度分布</h2>
          </div>
          <div className="p-5 space-y-4">
            {[
              { label: '高匹配 (≥85)', val: data?.match_distribution.high || 0, color: 'var(--accent-green)' },
              { label: '中匹配 (60-84)', val: data?.match_distribution.mid || 0, color: 'var(--color-primary)' },
              { label: '低匹配 (<60)', val: data?.match_distribution.low || 0, color: 'var(--accent-orange)' },
            ].map(item => {
              const total = (data?.match_distribution.high || 0) + (data?.match_distribution.mid || 0) + (data?.match_distribution.low || 0) || 1
              return (
                <div key={item.label}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>{item.label}</span>
                    <span className="text-xs font-bold" style={{ color: item.color }}>{item.val} 人</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--color-surface-container-high)' }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${(item.val / total) * 100}%`, background: item.color }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* 快捷操作 — 点击跳转到对应页面 */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: Search, label: '人才搜索', desc: '基于能力图谱精准匹配候选人', color: 'var(--accent-purple)', iconBg: 'var(--accent-purple-dim)', page: 'talent' as const },
          { icon: TrendingUp, label: '市场洞察', desc: '实时追踪技能需求变化趋势', color: 'var(--accent-green)', iconBg: 'var(--accent-green-dim)', page: 'market' as const },
          { icon: Target, label: '行业报告', desc: '新一代信息技术领域薪酬调研', color: 'var(--accent-orange)', iconBg: 'var(--accent-orange-dim)', page: 'industry' as const },
        ].map((item, i) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.06 }}
            onClick={() => setPage(item.page)}
            className="rounded-xl border p-5 cursor-pointer transition-all hover:shadow-md"
            style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg mb-3" style={{ background: item.iconBg }}>
              <item.icon className="h-5 w-5" style={{ color: item.color }} />
            </div>
            <h3 className="text-sm font-bold" style={{ color: 'var(--color-on-surface)' }}>{item.label}</h3>
            <p className="text-xs mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>{item.desc}</p>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
