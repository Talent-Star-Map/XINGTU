import { useState, useEffect } from 'react'
import { Plus, Edit3, Eye, Loader2, X, Trash2, Power, ChevronDown } from 'lucide-react'
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
// 使用主题变量，在亮/暗两种主题下自动适配
const STATUS_MAP: Record<string, { label: string, bg: string, color: string }> = {
  'active':  { label: '招聘中', bg: 'var(--accent-green-dim)', color: 'var(--accent-green)' },
  'draft':   { label: '草稿',   bg: 'var(--accent-orange-dim)', color: 'var(--accent-orange)' },
  'closed':  { label: '已关闭', bg: 'var(--color-neutral-dim)', color: 'var(--color-on-surface-variant)' },
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

  // 统计各状态岗位数 — 用于顶部过滤 tab 上的 badge
  const counts = {
    all: jobs.length,
    active: jobs.filter(j => j.status === 'active').length,
    draft: jobs.filter(j => j.status === 'draft').length,
    closed: jobs.filter(j => j.status === 'closed').length,
  }

  return (
    <div className="h-full flex flex-col">
      {/* ── 顶部工具栏 ── */}
      <header className="shrink-0 border-b" style={{ borderColor: 'var(--color-outline-variant)' }}>
        <div className="px-14 py-7 flex items-center justify-between">
          <div className="flex items-baseline gap-3">
            <h1 className="text-3xl font-semibold tracking-tight" style={{ color: 'var(--color-on-surface)' }}>岗位</h1>
            <span className="text-base tabular-nums" style={{ color: 'var(--color-on-surface-variant)' }}>{counts.all}</span>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 h-12 px-5 rounded-lg text-base font-medium transition-colors"
            style={{
              background: 'var(--color-primary)',
              color: 'var(--color-on-primary)'
            }}
          >
            <Plus className="h-5 w-5" /> 发布新岗位
          </button>
        </div>
      </header>

      {/* ── 状态过滤 tab ── */}
      <div className="shrink-0 border-b" style={{ borderColor: 'var(--color-outline-variant)' }}>
        <div className="px-14 py-5 flex items-center gap-1.5">
          {FILTERS.map(f => {
            const cnt = f.key === '' ? counts.all : (counts as any)[f.key]
            const active = filter === f.key
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className="flex items-center gap-2 h-11 px-5 rounded-lg text-base font-medium transition-colors"
                style={{
                  background: active ? 'var(--color-surface-container-high)' : 'transparent',
                  color: active ? 'var(--color-on-surface)' : 'var(--color-on-surface-variant)'
                }}
              >
                {f.label}
                <span className="tabular-nums" style={{ opacity: 0.6 }}>{cnt}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── 错误提示 ── */}
      {error && (
        <div className="px-14 pt-6">
          <div className="rounded-lg border px-5 py-4 text-base" style={{ borderColor: 'var(--accent-red)', background: 'var(--accent-red-dim)', color: 'var(--accent-red-strong)' }}>
            {error}
          </div>
        </div>
      )}

      {/* ── 岗位列表 — 行布局 ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-14 py-6">
          {loading ? (
            <div className="flex items-center justify-center py-28 gap-2.5" style={{ color: 'var(--color-on-surface-variant)' }}>
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="text-lg">加载中</span>
            </div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-28">
              <p className="text-lg" style={{ color: 'var(--color-on-surface-variant)' }}>暂无岗位</p>
              <p className="text-base mt-2" style={{ color: 'var(--color-on-surface-variant)', opacity: 0.6 }}>
                点击右上角"发布新岗位"创建
              </p>
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--color-outline-variant)' }}>
              {/* 列表头 */}
              <div className="grid grid-cols-[2fr_1fr_1fr_1fr_140px_220px] gap-8 px-8 py-4 text-sm uppercase tracking-wider border-b"
                style={{ color: 'var(--color-on-surface-variant)', borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-low)' }}>
                <span>岗位</span>
                <span>城市</span>
                <span>薪资</span>
                <span>经验</span>
                <span className="text-right">候选人</span>
                <span className="text-right">操作</span>
              </div>

              {/* 行 */}
              {jobs.map((job, i) => {
                const st = STATUS_MAP[job.status] || STATUS_MAP['active']
                const skills = job.skills_required.split(',').map(s => s.trim()).filter(Boolean).slice(0, 4)
                const hiddenSkillCount = job.skills_required.split(',').map(s => s.trim()).filter(Boolean).length - skills.length
                return (
                  <motion.div
                    key={job.id}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(i * 0.02, 0.2) }}
                    className="grid grid-cols-[2fr_1fr_1fr_1fr_140px_220px] gap-8 px-8 py-5 items-center border-b last:border-b-0 transition-colors hover:bg-[var(--color-surface-container-low)]"
                    style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface)' }}
                  >
                    {/* 岗位名 + 状态标签 + 技能 */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2.5 mb-2">
                        <span className="text-lg font-medium truncate" style={{ color: 'var(--color-on-surface)' }}>{job.title}</span>
                        <span className="text-sm px-2 py-0.5 rounded shrink-0" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                      </div>
                      {skills.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 items-center">
                          {skills.map(s => (
                            <span key={s} className="text-sm px-2.5 py-1 rounded"
                              style={{ background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface-variant)' }}>
                              {s}
                            </span>
                          ))}
                          {hiddenSkillCount > 0 && (
                            <span className="text-sm tabular-nums" style={{ color: 'var(--color-on-surface-variant)' }}>+{hiddenSkillCount}</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* 城市 */}
                    <span className="text-base" style={{ color: 'var(--color-on-surface-variant)' }}>{job.location || '—'}</span>

                    {/* 薪资 */}
                    <span className="text-base tabular-nums" style={{ color: 'var(--color-on-surface-variant)' }}>{job.salary_range || '—'}</span>

                    {/* 经验 */}
                    <span className="text-base" style={{ color: 'var(--color-on-surface-variant)' }}>{job.experience || '—'}</span>

                    {/* 候选人数 — 右对齐，数字 */}
                    <div className="text-right">
                      <span className="text-xl font-semibold tabular-nums" style={{ color: 'var(--color-on-surface)' }}>{job.candidates}</span>
                    </div>

                    {/* 操作 — 行内图标按钮，悬停高亮 */}
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openView(job)}
                        title="查看详情"
                        className="p-2.5 rounded transition-colors hover:bg-[var(--color-surface-container-high)]"
                      >
                        <Eye className="h-5 w-5" style={{ color: 'var(--color-on-surface-variant)' }} />
                      </button>
                      <button
                        onClick={() => openEdit(job)}
                        title="编辑"
                        className="p-2.5 rounded transition-colors hover:bg-[var(--color-surface-container-high)]"
                      >
                        <Edit3 className="h-5 w-5" style={{ color: 'var(--color-on-surface-variant)' }} />
                      </button>
                      <button
                        onClick={() => toggleStatus(job)}
                        title={job.status === 'active' ? '关闭岗位' : '重新开放'}
                        className="p-2.5 rounded transition-colors hover:bg-[var(--color-surface-container-high)]"
                      >
                        <Power className="h-5 w-5" style={{ color: 'var(--color-on-surface-variant)' }} />
                      </button>
                      <button
                        onClick={() => setConfirmDelete(job)}
                        title="删除"
                        className="p-2.5 rounded transition-colors hover:bg-[var(--color-surface-container-high)]"
                      >
                        <Trash2 className="h-5 w-5" style={{ color: 'var(--color-on-surface-variant)' }} />
                      </button>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Toast 消息提示 ── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 px-5 py-3 rounded-lg text-base shadow-lg z-50"
            style={{ background: 'var(--color-on-surface)', color: 'var(--color-surface)' }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 详情弹窗（只读）── */}
      <AnimatePresence>
        {viewing && (
          <Modal onClose={() => setViewing(null)} title="岗位详情">
            <div className="space-y-5">
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
                <p className="text-sm mb-2" style={{ color: 'var(--color-on-surface-variant)' }}>技能要求</p>
                <div className="flex flex-wrap gap-2">
                  {viewing.skills_required.split(',').map(s => s.trim()).filter(Boolean).map(s => (
                    <span key={s} className="text-sm px-2.5 py-1 rounded" style={{ background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface-variant)' }}>{s}</span>
                  ))}
                </div>
              </div>
              {viewing.description && (
                <div>
                  <p className="text-sm mb-2" style={{ color: 'var(--color-on-surface-variant)' }}>岗位描述</p>
                  <p className="text-base leading-relaxed" style={{ color: 'var(--color-on-surface)' }}>{viewing.description}</p>
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
            <div className="space-y-4">
              <FormField label="岗位名称" required>
                <input
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  placeholder="如：AI应用开发工程师"
                  className="form-input"
                />
              </FormField>
              <div className="grid grid-cols-2 gap-4">
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
              <div className="grid grid-cols-3 gap-4">
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
              <div className="grid grid-cols-2 gap-4">
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
              <div className="flex justify-end gap-3 pt-3">
                <button
                  onClick={() => setEditorOpen(false)}
                  className="px-5 py-2.5 rounded-lg text-base font-medium border"
                  style={{ borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface-variant)' }}
                >
                  取消
                </button>
                <button
                  onClick={submitForm}
                  disabled={saving}
                  className="px-5 py-2.5 rounded-lg text-base font-semibold disabled:opacity-60 flex items-center gap-2"
                  style={{ background: 'var(--color-primary)', color: 'var(--color-on-primary)' }}
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
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
            <p className="text-base" style={{ color: 'var(--color-on-surface)' }}>
              确定要删除岗位「<span style={{ color: 'var(--accent-red)' }}>{confirmDelete.title}</span>」吗？
            </p>
            <p className="text-sm mt-2.5" style={{ color: 'var(--color-on-surface-variant)' }}>
              删除后将同时清理该岗位的 {confirmDelete.candidates} 条匹配记录，操作不可撤销。
            </p>
            <div className="flex justify-end gap-3 pt-5">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-5 py-2.5 rounded-lg text-base font-medium border"
                style={{ borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface-variant)' }}
              >
                取消
              </button>
              <button
                onClick={confirmDeleteJob}
                className="px-5 py-2.5 rounded-lg text-base font-semibold"
                style={{ background: 'var(--accent-red-strong)', color: 'var(--color-on-primary)' }}
              >
                确认删除
              </button>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* ── 表单输入框统一样式 ── */}
      <style>{`
        .form-input {
          width: 100%;
          padding: 10px 14px;
          border-radius: 8px;
          border: 1px solid var(--color-outline-variant);
          background: var(--color-surface);
          color: var(--color-on-surface);
          font-size: 14px;
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
      style={{ background: 'var(--color-scrim)' }}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className="rounded-2xl border w-full max-w-xl max-h-[85vh] overflow-y-auto"
        style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}
      >
        {/* 弹窗头部 */}
        <div className="flex items-center justify-between px-6 py-5 border-b sticky top-0 z-10" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
          <h2 className="text-lg font-bold" style={{ color: 'var(--color-on-surface)' }}>{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--color-surface-container)]">
            <X className="h-5 w-5" style={{ color: 'var(--color-on-surface-variant)' }} />
          </button>
        </div>
        {/* 弹窗内容 */}
        <div className="p-6">{children}</div>
      </motion.div>
    </motion.div>
  )
}

// ─── 详情字段展示组件（只读）─────────────────────────────────────────
function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>{label}</span>
      <span className="text-base font-medium" style={{ color: 'var(--color-on-surface)' }}>{value}</span>
    </div>
  )
}

// ─── 表单字段组件（标签 + 输入框）─────────────────────────────────────
function FormField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm mb-2" style={{ color: 'var(--color-on-surface-variant)' }}>
        {label}{required && <span style={{ color: 'var(--accent-red-strong)' }}> *</span>}
      </label>
      {children}
    </div>
  )
}
