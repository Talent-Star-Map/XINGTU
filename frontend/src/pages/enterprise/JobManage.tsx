import { useState, useEffect } from 'react'
import { Plus, Edit3, Eye, Loader2 } from 'lucide-react'

// 岗位类型 — 字段来自后端 /api/enterprise/jobs
interface JobItem {
  id: number
  title: string
  location: string
  salary_range: string
  experience: string
  skills_required: string
  status: string              // active / closed / draft
  candidates: number          // 候选人数（来自 match_records 表）
  created_at: string
}

// 状态映射：后端 status → 前端中文 + 颜色
const STATUS_MAP: Record<string, { label: string, bg: string, color: string }> = {
  'active':  { label: '招聘中', bg: 'rgba(0,229,153,0.1)', color: 'var(--accent-green)' },
  'draft':   { label: '草稿',   bg: 'rgba(255,140,66,0.1)', color: 'var(--accent-orange)' },
  'closed':  { label: '已关闭', bg: 'rgba(100,100,100,0.1)', color: 'var(--color-on-surface-variant)' },
}

// 状态过滤选项
const FILTERS = [
  { key: '', label: '全部' },
  { key: 'active', label: '招聘中' },
  { key: 'draft', label: '草稿' },
  { key: 'closed', label: '已关闭' },
]

export default function JobManage() {
  const [jobs, setJobs] = useState<JobItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('')  // 状态过滤

  // 拉取岗位列表
  const load = async (statusFilter = filter) => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      params.set('page', '1')
      params.set('size', '50')

      const r = await fetch(`/api/enterprise/jobs?${params.toString()}`)
      const d = await r.json()
      if (d.success) setJobs(d.data.jobs)
      else setError(d.error?.message || '加载失败')
    } catch {
      setError('网络错误')
    } finally {
      setLoading(false)
    }
  }

  // 初次加载 + 过滤变化时重新拉取
  useEffect(() => { load() }, [filter])

  // 切换状态过滤
  const pickFilter = (k: string) => setFilter(k)

  return (
    <div className="space-y-6 px-6 py-8 max-w-[1400px] mx-auto">
      {/* 标题 + 发布按钮 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--color-on-surface)' }}>岗位管理</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>管理企业发布的岗位，查看候选人匹配情况</p>
        </div>
        <button className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--accent-purple))' }}>
          <Plus className="h-4 w-4" /> 发布新岗位
        </button>
      </div>

      {/* 状态过滤 */}
      <div className="flex gap-2">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => pickFilter(f.key)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{
              background: filter === f.key ? 'var(--color-primary)' : 'var(--color-surface-container-lowest)',
              color: filter === f.key ? '#fff' : 'var(--color-on-surface-variant)',
              border: `1px solid ${filter === f.key ? 'var(--color-primary)' : 'var(--color-outline-variant)'}`,
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="rounded-xl border p-4 text-sm" style={{ borderColor: 'var(--color-outline-variant)', background: 'rgba(255,99,99,0.08)', color: '#E5484D' }}>
          {error}
        </div>
      )}

      {/* 岗位列表 */}
      <div className="space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2" style={{ color: 'var(--color-on-surface-variant)' }}>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">加载岗位中...</span>
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-16 text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
            暂无岗位，点击右上角"发布新岗位"创建
          </div>
        ) : (
          jobs.map(job => {
            const st = STATUS_MAP[job.status] || STATUS_MAP['active']
            // 技能列表（后端是逗号分隔字符串）
            const skills = job.skills_required.split(',').map(s => s.trim()).filter(Boolean).slice(0, 5)
            return (
              <div key={job.id} className="rounded-xl border p-4" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div>
                      <h3 className="text-sm font-semibold" style={{ color: 'var(--color-on-surface)' }}>{job.title}</h3>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>
                        {job.location} · {job.salary_range} · {job.experience}
                      </p>
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>{job.candidates} 位候选人</span>
                    <div className="flex items-center gap-2">
                      <button className="rounded-lg border p-1.5" style={{ borderColor: 'var(--color-outline-variant)' }}><Eye className="h-3.5 w-3.5" /></button>
                      <button className="rounded-lg border p-1.5" style={{ borderColor: 'var(--color-outline-variant)' }}><Edit3 className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                </div>
                {/* 技能要求标签 */}
                {skills.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {skills.map(s => (
                      <span key={s} className="text-[10px] px-2 py-0.5 rounded" style={{ background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface-variant)' }}>{s}</span>
                    ))}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
