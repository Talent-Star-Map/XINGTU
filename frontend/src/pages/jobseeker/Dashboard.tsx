import { motion } from 'framer-motion'
import { Briefcase, Upload, LineChart, TrendingUp, Sparkles, Users, Database, Zap, ArrowRight, ChevronRight } from 'lucide-react'
import StatsCounter from '../../components/ui/StatsCounter'
// import GlareHover from '../../components/ui/GlareHover'

const quickActions = [
  { icon: Upload, label: '上传简历', desc: 'AI 自动解析，1 分钟建立能力档案', color: 'var(--color-primary)' },
  { icon: Briefcase, label: '浏览岗位', desc: '基于能力图谱精准推荐', color: 'var(--accent-purple)' },
  { icon: LineChart, label: '人岗匹配', desc: '多维度匹配诊断与差距分析', color: 'var(--accent-green)' },
  { icon: TrendingUp, label: '趋势洞察', desc: '实时追踪技能需求变化', color: 'var(--accent-orange)' },
]

const statsData = [
  { label: '收录岗位', value: 2817, color: 'var(--color-primary)' },
  { label: '技能标签', value: 1024, color: 'var(--accent-purple)' },
  { label: '新岗位发现', value: 12, color: 'var(--accent-green)' },
  { label: '平台用户', value: 8642, color: 'var(--accent-orange)' },
]

const hotJobs = [
  { title: 'AI 应用开发工程师', growth: '+320%', tag: '火热', color: 'var(--accent-orange)' },
  { title: 'MCP 协议开发工程师', growth: '新发', tag: '新兴', color: 'var(--color-primary)' },
  { title: '大模型算法工程师', growth: '+180%', tag: '火热', color: 'var(--accent-orange)' },
  { title: 'AI Agent 开发工程师', growth: '+250%', tag: '新兴', color: 'var(--color-primary)' },
]

const updates = [
  { color: 'var(--accent-green)', title: '新增岗位', highlight: 'MCP 协议开发工程师', sub: '多源数据交叉验证发现，置信度 94%' },
  { color: 'var(--accent-orange)', title: '技能更新', highlight: 'Java 后端开发工程师', sub: '新增 K8s/Docker，移除 Struts' },
  { color: 'var(--color-primary)', title: '图谱更新', highlight: '156 个节点', sub: '基于本周采集的 234 条 JD' },
]

export default function Dashboard() {
  return (
    <div className="space-y-6 px-6 py-8 max-w-[1400px] mx-auto">
      <div className="relative overflow-hidden rounded-2xl border p-8" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
        <div className="absolute -top-24 right-[-10%] h-[400px] w-[400px] rounded-full opacity-20 blur-3xl" style={{ background: 'var(--color-primary)' }} />
        <div className="absolute -bottom-32 left-[-60px] h-[300px] w-[300px] rounded-full opacity-10 blur-3xl" style={{ background: 'var(--accent-purple)' }} />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-5 w-5" style={{ color: 'var(--color-primary)' }} />
            <span className="text-sm font-semibold" style={{ color: 'var(--color-primary)' }}>数据更新于 10 分钟前</span>
          </div>
          <h1 className="text-3xl font-extrabold" style={{ color: 'var(--color-on-surface)' }}>欢迎回来，<span className="gradient-text">探索者</span></h1>
          <p className="text-base mt-2" style={{ color: 'var(--color-on-surface-variant)' }}>基于多源异构数据与知识图谱，精准定位你的职业方向</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-5">
        {statsData.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }}
            className="rounded-2xl border p-5 shadow-sm" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-on-surface-variant)' }}>{s.label}</p>
            <p className="text-3xl font-extrabold mt-1" style={{ color: s.color }}><StatsCounter value={s.value} /></p>
            <div className="mt-3 h-1.5 rounded-full" style={{ background: 'var(--color-surface-container)' }}>
              <motion.div className="h-full rounded-full" initial={{ width: 0 }} whileInView={{ width: '80%' }} viewport={{ once: true }} transition={{ duration: 1.2, delay: i * 0.1 }} style={{ background: `linear-gradient(90deg, ${s.color}66, ${s.color})` }} />
            </div>
          </motion.div>
        ))}
      </div>

      <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--color-on-surface-variant)' }}>快捷功能</h2>
      <div className="grid grid-cols-4 gap-4">
        {quickActions.map((action, i) => (
          <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }}
            className="rounded-2xl border p-5 cursor-pointer" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl mb-4" style={{ background: `${action.color}15` }}>
              <action.icon className="h-6 w-6" style={{ color: action.color }} />
            </div>
            <h3 className="text-base font-bold" style={{ color: 'var(--color-on-surface)' }}>{action.label}</h3>
            <p className="text-sm mt-1.5 leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>{action.desc}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-5">
        <div className="rounded-2xl border shadow-sm" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
          <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--color-outline-variant)' }}>
            <h3 className="text-base font-bold" style={{ color: 'var(--color-on-surface)' }}>热门岗位趋势</h3>
            <ChevronRight className="h-5 w-5" style={{ color: 'var(--color-on-surface-variant)' }} />
          </div>
          <div className="p-5 space-y-1">
            {hotJobs.map((job, i) => (
              <motion.div key={job.title} initial={{ opacity: 0, x: -8 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }}
                className="flex items-center justify-between px-4 py-3 rounded-xl transition-colors cursor-pointer"
                style={{ background: i === 0 ? 'var(--color-primary-fixed)' : 'transparent' }}>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold" style={{ color: 'var(--color-on-surface)' }}>{job.title}</span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold" style={{ background: job.tag === '新兴' ? 'var(--color-primary-fixed)' : 'var(--accent-orange-dim)', color: job.tag === '新兴' ? 'var(--color-primary)' : 'var(--accent-orange)' }}>{job.tag}</span>
                </div>
                <span className="text-sm font-bold" style={{ color: job.tag === '新兴' ? 'var(--color-primary)' : 'var(--accent-green)' }}>{job.growth}</span>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border shadow-sm" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
          <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--color-outline-variant)' }}>
            <h3 className="text-base font-bold" style={{ color: 'var(--color-on-surface)' }}>图谱更新动态</h3>
            <ChevronRight className="h-5 w-5" style={{ color: 'var(--color-on-surface-variant)' }} />
          </div>
          <div className="p-5 space-y-5">
            {updates.map((item, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -8 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }} className="flex items-start gap-3">
                <motion.div className="h-3 w-3 rounded-full mt-1 shrink-0" style={{ background: item.color }} animate={{ scale: [1, 1.4, 1] }} transition={{ duration: 2, repeat: Infinity, delay: i * 0.5 }} />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>{item.title}</span>
                    <span className="text-sm font-bold" style={{ color: item.color }}>{item.highlight}</span>
                  </div>
                  <p className="text-xs mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>{item.sub}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
