import { FileText, Download, TrendingUp, Zap } from 'lucide-react'

export default function IndustryReport() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">行业报告</h1>
      <div className="grid grid-cols-2 gap-4">
        {[
          { title: '2026 Q2 人工智能领域人才需求报告', date: '2026-07-01', type: '季度报告', pages: 12 },
          { title: '大模型应用开发技能图谱白皮书', date: '2026-06-15', type: '白皮书', pages: 24 },
          { title: '新一代信息技术岗位薪酬调研', date: '2026-06-01', type: '调研报告', pages: 18 },
          { title: 'AI Agent 工程师岗位定义与技能标准', date: '2026-05-20', type: '岗位分析', pages: 8 },
        ].map(report => (
          <div key={report.title} className="rounded-xl border p-4 hover:scale-[1.01] transition-all cursor-pointer" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg shrink-0" style={{ background: 'var(--accent-purple-dim)' }}>
                <FileText className="h-6 w-6" style={{ color: 'var(--accent-purple)' }} />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold">{report.title}</h3>
                <div className="flex items-center gap-3 mt-2 text-[10px]" style={{ color: 'var(--color-outline)' }}>
                  <span>{report.type}</span>
                  <span>·</span>
                  <span>{report.pages} 页</span>
                  <span>·</span>
                  <span>{report.date}</span>
                </div>
              </div>
              <button className="rounded-lg border p-2 shrink-0" style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}>
                <Download className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
