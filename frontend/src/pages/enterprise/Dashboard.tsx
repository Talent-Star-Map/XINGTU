import { motion } from 'framer-motion'
import { Briefcase, Users, TrendingUp, MessageCircle, Search, ArrowRight, Sparkles, Target, Zap } from 'lucide-react'

const metrics = [
  { label: '待处理沟通', value: 8, icon: MessageCircle, color: '#0052D9', bg: 'var(--color-primary-fixed)', colSpan: 2 },
  { label: '新匹配候选人', value: 24, icon: Users, color: '#7C3AED', bg: 'var(--color-surface-container-lowest)' },
  { label: '在招职位', value: 12, icon: Briefcase, color: '#059669', bg: 'var(--color-surface-container-lowest)' },
]

const recentJobs = [
  { title: 'AI 应用开发工程师', department: 'AI产品部', status: '招聘中', candidates: 23, views: 156 },
  { title: 'Java 后端开发', department: '技术部', status: '招聘中', candidates: 45, views: 289 },
  { title: '大模型算法工程师', department: '算法部', status: '草稿', candidates: 0, views: 0 },
  { title: '前端开发工程师（Vue）', department: '技术部', status: '已关闭', candidates: 12, views: 98 },
]

const hotSkills = [
  { name: 'LangChain', growth: '+320%', hot: true },
  { name: 'MCP协议', growth: '新发', hot: true },
  { name: 'Agent框架', growth: '+180%', hot: true },
  { name: 'RAG', growth: '+210%', hot: true },
  { name: 'Kubernetes', growth: '+89%', hot: false },
  { name: 'Python', growth: '+45%', hot: false },
]

const statusColors: Record<string, string> = {
  '招聘中': 'rgba(0,229,153,0.1)',
  '草稿': 'rgba(255,140,66,0.1)',
  '已关闭': 'rgba(100,100,100,0.1)',
}
const statusTextColors: Record<string, string> = {
  '招聘中': 'var(--accent-green)',
  '草稿': 'var(--accent-orange)',
  '已关闭': 'var(--color-on-surface-variant)',
}

export default function Dashboard() {
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
              <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: `${m.color}15` }}>
                <m.icon className="h-6 w-6" style={{ color: m.color }} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* 近期岗位 */}
        <div className="col-span-2 rounded-xl border" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
          <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--color-outline-variant)' }}>
            <h2 className="text-base font-bold" style={{ color: 'var(--color-on-surface)' }}>近期岗位</h2>
            <span className="text-xs font-medium" style={{ color: 'var(--color-primary)' }}>查看全部 →</span>
          </div>
          <div className="divide-y" style={{ borderColor: 'var(--color-outline-variant)' }}>
            {recentJobs.map((job, i) => (
              <div key={job.title} className="flex items-center justify-between px-6 py-4 hover:bg-[var(--color-surface)] transition-colors">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg text-xs font-bold" style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-primary)' }}>{i + 1}</div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--color-on-surface)' }}>{job.title}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>{job.department}</p>
                  </div>
                </div>
                <div className="flex items-center gap-5">
                  <div className="text-right">
                    <p className="text-xs font-semibold" style={{ color: 'var(--color-on-surface)' }}>{job.candidates} 人</p>
                    <p className="text-[10px]" style={{ color: 'var(--color-on-surface-variant)' }}>候选人</p>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: statusColors[job.status] || 'transparent', color: statusTextColors[job.status] || 'var(--color-on-surface-variant)' }}>{job.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 热点技能 */}
        <div className="rounded-xl border" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
          <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--color-outline-variant)' }}>
            <h2 className="text-base font-bold" style={{ color: 'var(--color-on-surface)' }}>市场热点技能</h2>
            <span className="text-xs font-medium" style={{ color: 'var(--color-primary)' }}>详情 →</span>
          </div>
          <div className="p-5 space-y-1">
            {hotSkills.map((s, i) => (
              <motion.div key={s.name} initial={{ opacity: 0, x: -8 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}
                className="flex items-center justify-between px-3 py-3 rounded-lg hover:bg-[var(--color-surface)] transition-colors">
                <div className="flex items-center gap-3">
                  {s.hot && <Zap className="h-3.5 w-3.5" style={{ color: 'var(--accent-orange)' }} />}
                  <span className="text-sm font-medium" style={{ color: 'var(--color-on-surface)' }}>{s.name}</span>
                </div>
                <span className="text-sm font-bold" style={{ color: s.growth === '新发' ? 'var(--color-primary)' : 'var(--accent-green)' }}>{s.growth}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* 快捷操作 */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: Search, label: '人才搜索', desc: '基于能力图谱精准匹配候选人', color: '#7C3AED' },
          { icon: TrendingUp, label: '市场洞察', desc: '实时追踪技能需求变化趋势', color: '#059669' },
          { icon: Target, label: '行业报告', desc: '新一代信息技术领域薪酬调研', color: '#D97706' },
        ].map((item, i) => (
          <motion.div key={item.label} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }}
            className="rounded-xl border p-5 cursor-pointer transition-all hover:shadow-md" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg mb-3" style={{ background: `${item.color}15` }}>
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
