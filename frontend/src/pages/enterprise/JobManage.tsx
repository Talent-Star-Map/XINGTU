import { useState, useEffect } from 'react'
import { Plus, Edit3, Eye, Loader2, X, Trash2, Power } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

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

// 详情/编辑表单使用的完整字段
interface JobDetail extends JobItem {
  description: string
  salary_min: number | null
  salary_max: number | null
  education: string
  updated_at: string
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

// 表单空初始值
const EMPTY_FORM = {
  title: '', description: '', location: '',
  salary_min: '' as string | number, salary_max: '' as string | number,
  salary_range: '', education: '', experience: '', skills_required: '',
  status: 'active',
}

export default function JobManage() {
  const [jobs, setJobs] = useState<JobItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('')
  const [toast, setToast] = useState('')

  // 弹窗状态
  const [viewing, setViewing] = useState<JobDetail | null>(null)        // 详情弹窗
  const [editorOpen, setEditorOpen] = useState(false)                   // 编辑/创建弹窗
  const [editingId, setEditingId] = useState<number | null>(null)       // null=创建模式
  const [form, setForm] = useState<typeof EMPTY_FORM>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<JobItem | null>(null) // 删除确认弹窗

  // ── 拉取岗位列表 ──
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

  useEffect(() => { load() }, [filter])

  // 顶部消息提示（3 秒自动消失）
  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  // ── 打开"发布新岗位"弹窗 ──
  const openCreate = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setEditorOpen(true)
  }

  // ── 打开"编辑"弹窗 — 先拉详情 ──
  const openEdit = async (job: JobItem) => {
    try {
      const r = await fetch(`/api/enterprise/jobs/${job.id}`)
      const d = await r.json()
      if (d.success) {
        const j = d.data as JobDetail
        setEditingId(job.id)
        setForm({
          title: j.title, description: j.description, location: j.location,
          salary_min: j.salary_min ?? '', salary_max: j.salary_max ?? '',
          salary_range: j.salary_range, education: j.education,
          experience: j.experience, skills_required: j.skills_required,
          status: j.status,
        })
        setEditorOpen(true)
      } else {
        showToast(d.error?.message || '加载详情失败')
      }
    } catch {
      showToast('网络错误')
    }
  }

  // ── 打开"查看"弹窗 — 只读 ──
  const openView = async (job: JobItem) => {
    try {
      const r = await fetch(`/api/enterprise/jobs/${job.id}`)
      const d = await r.json()
      if (d.success) setViewing(d.data as JobDetail)
      else showToast(d.error?.message || '加载详情失败')
    } catch {
      showToast('网络错误')
    }
  }

  // ── 提交表单（创建/更新）──
  const submitForm = async () => {
    if (!form.title.trim()) {
      showToast('岗位名称不能为空')
      return
    }
    setSaving(true)
    try {
      // 组装请求体，空字符串的数字字段转 null
      const body = {
        title: form.title.trim(),
        description: form.description,
        location: form.location,
        salary_min: form.salary_min === '' ? null : Number(form.salary_min),
        salary_max: form.salary_max === '' ? null : Number(form.salary_max),
        salary_range: form.salary_range,
        education: form.education,
        experience: form.experience,
        skills_required: form.skills_required,
        status: form.status,
      }

      const url = editingId ? `/api/enterprise/jobs/${editingId}` : '/api/enterprise/jobs'
      const method = editingId ? 'PUT' : 'POST'
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const d = await r.json()
      if (d.success) {
        setEditorOpen(false)
        showToast(d.message || (editingId ? '更新成功' : '发布成功'))
        await load()
      } else {
        showToast(d.error?.message || '保存失败')
      }
    } catch {
      showToast('网络错误')
    } finally {
      setSaving(false)
    }
  }

  // ── 切换状态（关闭/重新开放）──
  const toggleStatus = async (job: JobItem) => {
    const next = job.status === 'active' ? 'closed' : 'active'
    try {
      const r = await fetch(`/api/enterprise/jobs/${job.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      const d = await r.json()
      if (d.success) {
        showToast(d.message || '状态已更新')
        await load()
      } else {
        showToast(d.error?.message || '操作失败')
      }
    } catch {
      showToast('网络错误')
    }
  }

  // ── 删除岗位 ──
  const confirmDeleteJob = async () => {
    if (!confirmDelete) return
    try {
      const r = await fetch(`/api/enterprise/jobs/${confirmDelete.id}`, { method: 'DELETE' })
      const d = await r.json()
      if (d.success) {
        showToast(d.message || '已删除')
        setConfirmDelete(null)
        await load()
      } else {
        showToast(d.error?.message || '删除失败')
      }
    } catch {
      showToast('网络错误')
    }
  }

  return (
    <div className="space-y-6 px-6 py-8 max-w-[1400px] mx-auto">
      {/* 标题 + 发布按钮 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--color-on-surface)' }}>岗位管理</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>管理企业发布的岗位，查看候选人匹配情况</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white"
          style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--accent-purple))' }}
        >
          <Plus className="h-4 w-4" /> 发布新岗位
        </button>
      </div>

      {/* 状态过滤 */}
      <div className="flex gap-2">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
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
                    <div className="flex items-center gap-1">
                      {/* 查看详情 */}
                      <button
                        onClick={() => openView(job)}
                        title="查看详情"
                        className="rounded-lg border p-1.5 transition-colors hover:bg-[var(--color-surface)]"
                        style={{ borderColor: 'var(--color-outline-variant)' }}
                      >
                        <Eye className="h-3.5 w-3.5" style={{ color: 'var(--color-on-surface-variant)' }} />
                      </button>
                      {/* 编辑 */}
                      <button
                        onClick={() => openEdit(job)}
                        title="编辑"
                        className="rounded-lg border p-1.5 transition-colors hover:bg-[var(--color-surface)]"
                        style={{ borderColor: 'var(--color-outline-variant)' }}
                      >
                        <Edit3 className="h-3.5 w-3.5" style={{ color: 'var(--color-primary)' }} />
                      </button>
                      {/* 关闭/重新开放 */}
                      <button
                        onClick={() => toggleStatus(job)}
                        title={job.status === 'active' ? '关闭岗位' : '重新开放'}
                        className="rounded-lg border p-1.5 transition-colors hover:bg-[var(--color-surface)]"
                        style={{ borderColor: 'var(--color-outline-variant)' }}
                      >
                        <Power className="h-3.5 w-3.5" style={{ color: job.status === 'active' ? 'var(--accent-orange)' : 'var(--accent-green)' }} />
                      </button>
                      {/* 删除 */}
                      <button
                        onClick={() => setConfirmDelete(job)}
                        title="删除"
                        className="rounded-lg border p-1.5 transition-colors hover:bg-[var(--color-surface)]"
                        style={{ borderColor: 'var(--color-outline-variant)' }}
                      >
                        <Trash2 className="h-3.5 w-3.5" style={{ color: '#E5484D' }} />
                      </button>
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

      {/* ── Toast 消息提示 ── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg text-sm text-white shadow-lg z-50"
            style={{ background: 'var(--color-primary)' }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 详情弹窗（只读）── */}
      <AnimatePresence>
        {viewing && (
          <Modal onClose={() => setViewing(null)} title="岗位详情">
            <div className="space-y-4">
              <Field label="岗位名称" value={viewing.title} />
              <Field label="工作城市" value={viewing.location || '—'} />
              <Field label="薪资范围" value={viewing.salary_range || `${viewing.salary_min || '?'}K-${viewing.salary_max || '?'}K`} />
              <Field label="学历要求" value={viewing.education || '—'} />
              <Field label="经验要求" value={viewing.experience || '—'} />
              <Field label="状态" value={STATUS_MAP[viewing.status]?.label || viewing.status} />
              <Field label="候选人数量" value={`${viewing.candidates} 人`} />
              <Field label="创建时间" value={viewing.created_at} />
              <Field label="更新时间" value={viewing.updated_at} />
              <div>
                <p className="text-xs mb-1.5" style={{ color: 'var(--color-on-surface-variant)' }}>技能要求</p>
                <div className="flex flex-wrap gap-1.5">
                  {viewing.skills_required.split(',').map(s => s.trim()).filter(Boolean).map(s => (
                    <span key={s} className="text-xs px-2 py-1 rounded" style={{ background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface-variant)' }}>{s}</span>
                  ))}
                </div>
              </div>
              {viewing.description && (
                <div>
                  <p className="text-xs mb-1.5" style={{ color: 'var(--color-on-surface-variant)' }}>岗位描述</p>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--color-on-surface)' }}>{viewing.description}</p>
                </div>
              )}
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* ── 创建/编辑弹窗 ── */}
      <AnimatePresence>
        {editorOpen && (
          <Modal onClose={() => setEditorOpen(false)} title={editingId ? '编辑岗位' : '发布新岗位'}>
            <div className="space-y-3">
              <FormField label="岗位名称" required>
                <input
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  placeholder="如：AI应用开发工程师"
                  className="form-input"
                />
              </FormField>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="工作城市">
                  <input
                    value={form.location}
                    onChange={e => setForm({ ...form, location: e.target.value })}
                    placeholder="如：北京"
                    className="form-input"
                  />
                </FormField>
                <FormField label="学历要求">
                  <input
                    value={form.education}
                    onChange={e => setForm({ ...form, education: e.target.value })}
                    placeholder="如：本科"
                    className="form-input"
                  />
                </FormField>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <FormField label="薪资下限(K)">
                  <input
                    type="number"
                    value={form.salary_min}
                    onChange={e => setForm({ ...form, salary_min: e.target.value })}
                    placeholder="如：30"
                    className="form-input"
                  />
                </FormField>
                <FormField label="薪资上限(K)">
                  <input
                    type="number"
                    value={form.salary_max}
                    onChange={e => setForm({ ...form, salary_max: e.target.value })}
                    placeholder="如：50"
                    className="form-input"
                  />
                </FormField>
                <FormField label="展示薪资">
                  <input
                    value={form.salary_range}
                    onChange={e => setForm({ ...form, salary_range: e.target.value })}
                    placeholder="如：30K-50K"
                    className="form-input"
                  />
                </FormField>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="经验要求">
                  <input
                    value={form.experience}
                    onChange={e => setForm({ ...form, experience: e.target.value })}
                    placeholder="如：3-5年"
                    className="form-input"
                  />
                </FormField>
                <FormField label="状态">
                  <select
                    value={form.status}
                    onChange={e => setForm({ ...form, status: e.target.value })}
                    className="form-input"
                  >
                    <option value="active">招聘中</option>
                    <option value="draft">草稿</option>
                    <option value="closed">已关闭</option>
                  </select>
                </FormField>
              </div>
              <FormField label="技能要求（逗号分隔）">
                <input
                  value={form.skills_required}
                  onChange={e => setForm({ ...form, skills_required: e.target.value })}
                  placeholder="如：Python,LangChain,RAG,PyTorch"
                  className="form-input"
                />
              </FormField>
              <FormField label="岗位描述">
                <textarea
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="岗位详细描述..."
                  rows={4}
                  className="form-input"
                />
              </FormField>
              {/* 操作按钮 */}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setEditorOpen(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium border"
                  style={{ borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface-variant)' }}
                >
                  取消
                </button>
                <button
                  onClick={submitForm}
                  disabled={saving}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60 flex items-center gap-2"
                  style={{ background: 'var(--color-primary)' }}
                >
                  {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {editingId ? '保存修改' : '发布岗位'}
                </button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* ── 删除确认弹窗 ── */}
      <AnimatePresence>
        {confirmDelete && (
          <Modal onClose={() => setConfirmDelete(null)} title="确认删除">
            <p className="text-sm" style={{ color: 'var(--color-on-surface)' }}>
              确定要删除岗位「<span style={{ color: 'var(--accent-red)' }}>{confirmDelete.title}</span>」吗？
            </p>
            <p className="text-xs mt-2" style={{ color: 'var(--color-on-surface-variant)' }}>
              删除后将同时清理该岗位的 {confirmDelete.candidates} 条匹配记录，操作不可撤销。
            </p>
            <div className="flex justify-end gap-2 pt-4">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium border"
                style={{ borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface-variant)' }}
              >
                取消
              </button>
              <button
                onClick={confirmDeleteJob}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
                style={{ background: '#E5484D' }}
              >
                确认删除
              </button>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* ── 表单输入框统一样式（内联 style 不生效 textarea/select，靠 className） ── */}
      <style>{`
        .form-input {
          width: 100%;
          padding: 8px 12px;
          border-radius: 8px;
          border: 1px solid var(--color-outline-variant);
          background: var(--color-surface);
          color: var(--color-on-surface);
          font-size: 13px;
          outline: none;
          transition: border-color 0.2s;
        }
        .form-input:focus {
          border-color: var(--color-primary);
        }
      `}</style>
    </div>
  )
}

// ─── 通用弹窗组件 ────────────────────────────────────────────────────
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className="rounded-2xl border w-full max-w-lg max-h-[85vh] overflow-y-auto"
        style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}
      >
        {/* 弹窗头部 */}
        <div className="flex items-center justify-between px-5 py-4 border-b sticky top-0 z-10" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
          <h2 className="text-base font-bold" style={{ color: 'var(--color-on-surface)' }}>{title}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-[var(--color-surface-container)]">
            <X className="h-4 w-4" style={{ color: 'var(--color-on-surface-variant)' }} />
          </button>
        </div>
        {/* 弹窗内容 */}
        <div className="p-5">{children}</div>
      </motion.div>
    </motion.div>
  )
}

// ─── 详情字段展示组件（只读）─────────────────────────────────────────
function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>{label}</span>
      <span className="text-sm font-medium" style={{ color: 'var(--color-on-surface)' }}>{value}</span>
    </div>
  )
}

// ─── 表单字段组件（标签 + 输入框）─────────────────────────────────────
function FormField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs mb-1.5" style={{ color: 'var(--color-on-surface-variant)' }}>
        {label}{required && <span style={{ color: '#E5484D' }}> *</span>}
      </label>
      {children}
    </div>
  )
}
