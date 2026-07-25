import { motion } from 'framer-motion'
import { FileText, Download, ArrowRight } from 'lucide-react'

// 报告数据 — 静态占位，后续可接入后端接口
const REPORTS = [
  { title: '2026 Q2 人工智能领域人才需求报告', date: '2026-07-01', type: '季度报告', pages: 12 },
  { title: '大模型应用开发技能图谱白皮书', date: '2026-06-15', type: '白皮书', pages: 24 },
  { title: '新一代信息技术岗位薪酬调研', date: '2026-06-01', type: '调研报告', pages: 18 },
  { title: 'AI Agent 工程师岗位定义与技能标准', date: '2026-05-20', type: '岗位分析', pages: 8 },
]

export default function IndustryReport() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="px-14 py-12 space-y-10">
        {/* ── 顶部 — utility copy ── */}
        <header className="flex items-baseline justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight" style={{ color: 'var(--color-on-surface)' }}>行业报告</h1>
            <p className="text-base mt-2" style={{ color: 'var(--color-on-surface-variant)' }}>共 {REPORTS.length} 份报告</p>
          </div>
        </header>

        {/* ── 报告列表 — 行布局，无卡片，无 hover scale ── */}
        <div className="border-t" style={{ borderColor: 'var(--color-outline-variant)' }}>
          {REPORTS.map((report, i) => (
            <motion.div
              key={report.title}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ delay: i * 0.04 }}
              className="flex items-center justify-between py-6 border-b transition-colors hover:bg-[var(--color-surface-container-low)] -mx-3 px-3 rounded cursor-pointer group"
              style={{ borderColor: 'var(--color-outline-variant)' }}
            >
              <div className="flex items-center gap-6 min-w-0 flex-1">
                <FileText className="h-6 w-6 shrink-0" style={{ color: 'var(--color-on-surface-variant)' }} />
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-medium truncate" style={{ color: 'var(--color-on-surface)' }}>{report.title}</p>
                  <div className="flex items-center gap-2.5 mt-2 text-base tabular-nums" style={{ color: 'var(--color-on-surface-variant)' }}>
                    <span>{report.type}</span>
                    <span>·</span>
                    <span>{report.pages} 页</span>
                    <span>·</span>
                    <span>{report.date}</span>
                  </div>
                </div>
              </div>
              <button
                className="flex items-center gap-2 px-5 py-2.5 rounded-md text-base font-medium border opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface)' }}
              >
                <Download className="h-5 w-5" /> 下载
              </button>
            </motion.div>
          ))}
        </div>

        {/* ── 底部说明 ── */}
        <p className="text-base flex items-center gap-2" style={{ color: 'var(--color-on-surface-variant)' }}>
          <ArrowRight className="h-5 w-5" />
          报告由星图研究院发布，仅供企业端用户参考
        </p>
      </div>
    </div>
  )
}
