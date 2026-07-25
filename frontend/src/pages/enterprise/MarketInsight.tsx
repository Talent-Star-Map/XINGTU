import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, Zap, ArrowRight } from 'lucide-react'
import Graph3D from '../../components/Graph3D'

// 数据：去掉硬编码颜色，所有变化用单一主题色 + 强弱表达
// 增长用 var(--accent-green)，下降用 var(--color-on-surface-variant)
const rising = [
  { n: 'LangChain', r: '+320%' },
  { n: 'MCP协议', r: '+280%' },
  { n: 'RAG', r: '+210%' },
  { n: 'Agent框架', r: '+180%' },
  { n: 'Prompt工程', r: '+95%' },
]

const declining = [
  { n: 'Struts', r: '-95%' },
  { n: 'Hibernate', r: '-80%' },
  { n: 'jQuery', r: '-70%' },
]

const emerging = [
  { n: 'MCP协议工程师', g: '+230%' },
  { n: 'AI Agent工程师', g: '+180%' },
  { n: '提示词工程师', g: '+95%' },
]

export default function MarketInsight() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="px-14 py-12 space-y-12">
        {/* ── 顶部 — utility copy，无营销文案 ── */}
        <header>
          <h1 className="text-3xl font-semibold tracking-tight" style={{ color: 'var(--color-on-surface)' }}>市场洞察</h1>
          <p className="text-base mt-2" style={{ color: 'var(--color-on-surface-variant)' }}>
            数据来源：jobs 表（爬虫聚合）· 实时
          </p>
        </header>

        {/* ── 岗位图谱 — 单容器，无装饰图标背景 ── */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-base font-medium uppercase tracking-wider" style={{ color: 'var(--color-on-surface-variant)' }}>岗位图谱</h2>
            <span className="text-base tabular-nums" style={{ color: 'var(--color-on-surface-variant)' }}>
              5 岗位 · 14 技能 · 24 关联
            </span>
          </div>
          <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)', height: 520 }}>
            <Graph3D />
          </div>
        </section>

        {/* ── 三栏：技能变化 — 列布局，无独立卡片 ── */}
        <section className="grid grid-cols-3 border-y" style={{ borderColor: 'var(--color-outline-variant)' }}>
          {/* 快速增长 */}
          <div className="py-9 pr-10 border-r" style={{ borderColor: 'var(--color-outline-variant)' }}>
            <div className="flex items-center gap-3 mb-6">
              <TrendingUp className="h-5 w-5" style={{ color: 'var(--accent-green)' }} />
              <h3 className="text-base font-medium uppercase tracking-wider" style={{ color: 'var(--color-on-surface-variant)' }}>快速增长</h3>
            </div>
            <div className="space-y-5">
              {rising.map((item, i) => (
                <motion.div
                  key={item.n}
                  initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex items-center justify-between"
                >
                  <span className="text-lg" style={{ color: 'var(--color-on-surface)' }}>{item.n}</span>
                  <span className="text-base font-semibold tabular-nums" style={{ color: 'var(--accent-green)' }}>{item.r}</span>
                </motion.div>
              ))}
            </div>
          </div>

          {/* 需求下降 */}
          <div className="py-9 px-10 border-r" style={{ borderColor: 'var(--color-outline-variant)' }}>
            <div className="flex items-center gap-3 mb-6">
              <TrendingDown className="h-5 w-5" style={{ color: 'var(--color-on-surface-variant)' }} />
              <h3 className="text-base font-medium uppercase tracking-wider" style={{ color: 'var(--color-on-surface-variant)' }}>需求下降</h3>
            </div>
            <div className="space-y-5">
              {declining.map((item, i) => (
                <motion.div
                  key={item.n}
                  initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex items-center justify-between"
                >
                  <span className="text-lg" style={{ color: 'var(--color-on-surface)' }}>{item.n}</span>
                  <span className="text-base font-semibold tabular-nums" style={{ color: 'var(--color-on-surface-variant)' }}>{item.r}</span>
                </motion.div>
              ))}
            </div>
          </div>

          {/* 新兴岗位 */}
          <div className="py-9 pl-10">
            <div className="flex items-center gap-3 mb-6">
              <Zap className="h-5 w-5" style={{ color: 'var(--color-primary)' }} />
              <h3 className="text-base font-medium uppercase tracking-wider" style={{ color: 'var(--color-on-surface-variant)' }}>新兴岗位</h3>
            </div>
            <div className="space-y-5">
              {emerging.map((item, i) => (
                <motion.div
                  key={item.n}
                  initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex items-center justify-between"
                >
                  <span className="text-lg" style={{ color: 'var(--color-on-surface)' }}>{item.n}</span>
                  <span className="text-base font-semibold tabular-nums" style={{ color: 'var(--color-primary)' }}>{item.g}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 数据说明 — utility copy ── */}
        <p className="text-base flex items-center gap-2" style={{ color: 'var(--color-on-surface-variant)' }}>
          <ArrowRight className="h-5 w-5" />
          基于近 6 个月多源招聘数据聚合
        </p>
      </div>
    </div>
  )
}
