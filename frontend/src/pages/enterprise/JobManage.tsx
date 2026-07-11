import { Plus, Edit3, Eye } from 'lucide-react'

const jobs = [
  { id: 1, title: 'AI 应用开发工程师', department: 'AI产品部', status: '已发布', applications: 23, days: 3 },
  { id: 2, title: 'Java 后端开发', department: '技术部', status: '已发布', applications: 45, days: 7 },
  { id: 3, title: '大模型算法工程师', department: '算法部', status: '草稿', applications: 0, days: 0 },
  { id: 4, title: '前端开发工程师', department: '技术部', status: '已关闭', applications: 12, days: 30 },
]

export default function JobManage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">岗位管理</h1>
        <button className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--accent-purple))' }}>
          <Plus className="h-4 w-4" /> 发布新岗位
        </button>
      </div>

      <div className="space-y-3">
        {jobs.map(job => (
          <div key={job.id} className="rounded-xl border p-4" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div>
                  <h3 className="text-sm font-semibold">{job.title}</h3>
                  <p className="text-xs" style={{ color: 'var(--color-outline)' }}>{job.department}</p>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded" style={{
                  background: job.status === '已发布' ? 'rgba(0,229,153,0.1)' : job.status === '草稿' ? 'rgba(255,140,66,0.1)' : 'rgba(100,100,100,0.1)',
                  color: job.status === '已发布' ? 'var(--accent-green)' : job.status === '草稿' ? 'var(--accent-orange)' : 'var(--color-outline)',
                }}>{job.status}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs" style={{ color: 'var(--color-outline)' }}>{job.applications} 份申请</span>
                <div className="flex items-center gap-2">
                  <button className="rounded-lg border p-1.5" style={{ borderColor: 'var(--color-outline-variant)' }}><Eye className="h-3.5 w-3.5" /></button>
                  <button className="rounded-lg border p-1.5" style={{ borderColor: 'var(--color-outline-variant)' }}><Edit3 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
