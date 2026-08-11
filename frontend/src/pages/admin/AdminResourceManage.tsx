import { useState, useEffect } from 'react'
import { Trash2, Loader2, X, Search, ChevronLeft, ChevronRight, BookOpen, Plus, Edit2, Check } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

// ─── 管理员 token 注入 ───
const getToken = () => localStorage.getItem('xingtu_token') || ''
const withToken = (url: string) => `${url}${url.includes('?') ? '&' : '?'}token=${getToken()}`

interface ResourceItem {
  id: number
  skill_name: string
  resource_type: string
  title: string
  url: string
  sort_order: number
  created_at: string
}

const TYPE_OPTIONS = ['文档', '教程', '视频', '课程', '搜索']

const EMPTY_FORM = { skill_name: '', resource_type: '文档', title: '', url: '', sort_order: 0 }

export default function AdminResourceManage() {
  const [resources, setResources] = useState<ResourceItem[]>([])
  const [skillList, setSkillList] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  // 分页 + 搜索 + 技能筛选
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [total, setTotal] = useState(0)
  const [keyword, setKeyword] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [skillFilter, setSkillFilter] = useState('')

  // 删除确认
  const [deleteTarget, setDeleteTarget] = useState<ResourceItem | null>(null)

  // 新增/编辑弹窗
  const [formOpen, setFormOpen] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  // ── 拉取列表 ──
  const load = async (p = page, kw = keyword, skill = skillFilter) => {
    setLoading(true); setError('')
    try {
      const params = new URLSearchParams()
      params.set('page', String(p)); params.set('size', String(pageSize))
      if (kw) params.set('keyword', kw)
      if (skill) params.set('skill', skill)
      const r = await fetch(withToken(`/api/admin/resources?${params}`))
      const d = await r.json()
      if (d.success) { setResources(d.data.list); setTotal(d.data.total) }
      else setError(d.error?.message || '加载失败')
    } catch { setError('网络错误') }
    finally { setLoading(false) }
  }

  const loadSkills = async () => {
    try {
      const r = await fetch(withToken('/api/admin/resources/skills'))
      const d = await r.json()
      if (d.success) setSkillList(d.data)
    } catch { /* ignore */ }
  }

  useEffect(() => { load(1, '', ''); loadSkills() }, [])

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  // ── 搜索 ──
  const onSearch = () => { setKeyword(searchInput); setPage(1); load(1, searchInput, skillFilter) }

  // ── 技能筛选 ──
  const onSkillChange = (s: string) => { setSkillFilter(s); setPage(1); load(1, keyword, s) }

  // ── 翻页 ──
  const goPage = (p: number) => { if (p < 1 || p > Math.ceil(total / pageSize)) return; setPage(p); load(p, keyword, skillFilter) }

  // ── 打开新增 ──
  const openCreate = () => { setEditId(null); setForm(EMPTY_FORM); setFormOpen(true) }

  // ── 打开编辑 ──
  const openEdit = (r: ResourceItem) => {
    setEditId(r.id)
    setForm({ skill_name: r.skill_name, resource_type: r.resource_type, title: r.title, url: r.url, sort_order: r.sort_order })
    setFormOpen(true)
  }

  // ── 提交新增/编辑 ──
  const submitForm = async () => {
    if (!form.skill_name.trim() || !form.title.trim() || !form.url.trim()) { showToast('请填写完整'); return }
    setSaving(true)
    try {
      const url = editId ? `/api/admin/resources/${editId}` : '/api/admin/resources'
      const method = editId ? 'PUT' : 'POST'
      const r = await fetch(withToken(url), { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const d = await r.json()
      if (d.success) { showToast(d.message); setFormOpen(false); load(); loadSkills() }
      else showToast(d.error?.message || '操作失败')
    } catch { showToast('网络错误') }
    finally { setSaving(false) }
  }

  // ── 删除 ──
  const submitDelete = async () => {
    if (!deleteTarget) return
    try {
      const r = await fetch(withToken(`/api/admin/resources/${deleteTarget.id}`), { method: 'DELETE' })
      const d = await r.json()
      if (d.success) {
        showToast(d.message || '已删除'); setDeleteTarget(null)
        const remaining = total - 1; const maxP = Math.max(1, Math.ceil(remaining / pageSize))
        const target = Math.min(page, maxP)
        if (target !== page) { setPage(target); load(target, keyword, skillFilter) } else load()
        loadSkills()
      } else showToast(d.error?.message || '删除失败')
    } catch { showToast('网络错误') }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="h-full flex flex-col">
      {/* ── 顶部 ── */}
      <header className="shrink-0 border-b" style={{ borderColor: 'var(--color-outline-variant)' }}>
        <div className="max-w-[1400px] mx-auto px-8 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BookOpen className="h-5 w-5" style={{ color: 'var(--accent-blue)' }} />
            <h1 className="text-lg font-semibold" style={{ color: 'var(--color-on-surface)' }}>学习资源管理</h1>
            <span className="text-xs tabular-nums px-2 py-0.5 rounded-full"
              style={{ background: 'var(--accent-blue-dim, #dbeafe)', color: 'var(--accent-blue, #3b82f6)' }}>
              共 {total} 条
            </span>
          </div>
          <button onClick={openCreate}
            className="h-9 px-4 rounded-lg text-sm font-medium flex items-center gap-1.5"
            style={{ background: 'var(--accent-green)', color: '#fff' }}>
            <Plus className="h-4 w-4" /> 新增资源
          </button>
        </div>
      </header>

      {/* ── 筛选栏 ── */}
      <div className="shrink-0 border-b" style={{ borderColor: 'var(--color-outline-variant)' }}>
        <div className="max-w-[1400px] mx-auto px-8 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => onSkillChange('')}
              className="h-8 px-3 rounded-lg text-xs font-medium"
              style={{ background: !skillFilter ? 'var(--accent-blue-dim, #dbeafe)' : 'transparent', color: !skillFilter ? 'var(--accent-blue, #3b82f6)' : 'var(--color-on-surface-variant)' }}>
              全部
            </button>
            {skillList.slice(0, 15).map(s => (
              <button key={s} onClick={() => onSkillChange(s)}
                className="h-8 px-3 rounded-lg text-xs font-medium"
                style={{ background: skillFilter === s ? 'var(--accent-blue-dim, #dbeafe)' : 'transparent', color: skillFilter === s ? 'var(--accent-blue, #3b82f6)' : 'var(--color-on-surface-variant)' }}>
                {s}
              </button>
            ))}
            {skillList.length > 15 && <span className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>+{skillList.length - 15}</span>}
          </div>
          <div className="relative w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--color-on-surface-variant)' }} />
            <input value={searchInput} onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && onSearch()}
              placeholder="搜索标题/链接" className="w-full h-9 pl-9 pr-3 rounded-lg text-sm border outline-none"
              style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface)', color: 'var(--color-on-surface)' }} />
          </div>
        </div>
      </div>

      {/* ── 表格 ── */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-[1400px] mx-auto px-8 py-4">
          {loading ? (
            <div className="flex items-center justify-center h-40"><Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--accent-green)' }} /></div>
          ) : error ? (
            <div className="text-center py-10 text-sm" style={{ color: 'var(--accent-red)' }}>{error}</div>
          ) : resources.length === 0 ? (
            <div className="text-center py-10 text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>暂无资源数据</div>
          ) : (
            <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-outline-variant)' }}>
              <table className="w-full text-sm">
                <thead style={{ background: 'var(--color-surface-container)' }}>
                  <tr className="text-left">
                    <th className="px-4 py-3 text-xs font-semibold" style={{ color: 'var(--color-on-surface-variant)' }}>ID</th>
                    <th className="px-4 py-3 text-xs font-semibold" style={{ color: 'var(--color-on-surface-variant)' }}>技能</th>
                    <th className="px-4 py-3 text-xs font-semibold" style={{ color: 'var(--color-on-surface-variant)' }}>类型</th>
                    <th className="px-4 py-3 text-xs font-semibold" style={{ color: 'var(--color-on-surface-variant)' }}>标题</th>
                    <th className="px-4 py-3 text-xs font-semibold" style={{ color: 'var(--color-on-surface-variant)' }}>链接</th>
                    <th className="px-4 py-3 text-xs font-semibold" style={{ color: 'var(--color-on-surface-variant)' }}>排序</th>
                    <th className="px-4 py-3 text-xs font-semibold text-right" style={{ color: 'var(--color-on-surface-variant)' }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {resources.map(r => (
                    <tr key={r.id} className="border-t" style={{ borderColor: 'var(--color-outline-variant)' }}>
                      <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-on-surface)' }}>{r.id}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ background: 'var(--accent-blue-dim, #dbeafe)', color: 'var(--accent-blue, #3b82f6)' }}>
                          {r.skill_name}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>{r.resource_type}</td>
                      <td className="px-4 py-3 text-sm font-medium max-w-[200px] truncate" style={{ color: 'var(--color-on-surface)' }}>{r.title}</td>
                      <td className="px-4 py-3 text-xs max-w-[250px] truncate">
                        <a href={r.url} target="_blank" rel="noopener noreferrer"
                          className="underline" style={{ color: 'var(--accent-blue, #3b82f6)' }}>
                          {r.url}
                        </a>
                      </td>
                      <td className="px-4 py-3 text-sm tabular-nums" style={{ color: 'var(--color-on-surface-variant)' }}>{r.sort_order}</td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => openEdit(r)} title="编辑" className="p-1.5 rounded transition-colors inline-flex"
                          style={{ color: 'var(--color-on-surface-variant)' }}
                          onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-blue, #3b82f6)'}
                          onMouseLeave={e => e.currentTarget.style.color = 'var(--color-on-surface-variant)'}>
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button onClick={() => setDeleteTarget(r)} title="删除" className="p-1.5 rounded transition-colors inline-flex ml-1"
                          style={{ color: 'var(--color-on-surface-variant)' }}
                          onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-red)'}
                          onMouseLeave={e => e.currentTarget.style.color = 'var(--color-on-surface-variant)'}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── 分页 ── */}
          {!loading && total > 0 && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                第 {page} / {totalPages} 页 · 共 {total} 条
              </span>
              <div className="flex items-center gap-1">
                <button disabled={page <= 1} onClick={() => goPage(page - 1)}
                  className="h-8 w-8 flex items-center justify-center rounded-lg border transition-colors disabled:opacity-40"
                  style={{ borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface-variant)', background: 'var(--color-surface)' }}>
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button disabled={page >= totalPages} onClick={() => goPage(page + 1)}
                  className="h-8 w-8 flex items-center justify-center rounded-lg border transition-colors disabled:opacity-40"
                  style={{ borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface-variant)', background: 'var(--color-surface)' }}>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── 新增/编辑弹窗 ── */}
      <AnimatePresence>
        {formOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}
            onClick={() => setFormOpen(false)}>
            <motion.div initial={{ scale: 0.96, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 10 }}
              className="w-full max-w-lg rounded-2xl p-6 shadow-2xl"
              style={{ background: 'var(--color-surface-container-lowest)' }}
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-base font-semibold" style={{ color: 'var(--color-on-surface)' }}>
                  {editId ? '编辑资源' : '新增资源'}
                </h3>
                <button onClick={() => setFormOpen(false)} style={{ color: 'var(--color-on-surface-variant)' }}>
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--color-on-surface-variant)' }}>技能名称 *</label>
                    <input value={form.skill_name} onChange={e => setForm({ ...form, skill_name: e.target.value })}
                      placeholder="如 Python" className="w-full h-9 px-3 rounded-lg text-sm border outline-none"
                      style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface)', color: 'var(--color-on-surface)' }} />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--color-on-surface-variant)' }}>资源类型</label>
                    <select value={form.resource_type} onChange={e => setForm({ ...form, resource_type: e.target.value })}
                      className="w-full h-9 px-3 rounded-lg text-sm border outline-none"
                      style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface)', color: 'var(--color-on-surface)' }}>
                      {TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--color-on-surface-variant)' }}>资源标题 *</label>
                  <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                    placeholder="如 菜鸟教程 Python3" className="w-full h-9 px-3 rounded-lg text-sm border outline-none"
                    style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface)', color: 'var(--color-on-surface)' }} />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--color-on-surface-variant)' }}>资源链接 *</label>
                  <input value={form.url} onChange={e => setForm({ ...form, url: e.target.value })}
                    placeholder="https://..." className="w-full h-9 px-3 rounded-lg text-sm border outline-none"
                    style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface)', color: 'var(--color-on-surface)' }} />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--color-on-surface-variant)' }}>排序权重</label>
                  <input type="number" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: Number(e.target.value) })}
                    className="w-32 h-9 px-3 rounded-lg text-sm border outline-none"
                    style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface)', color: 'var(--color-on-surface)' }} />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button onClick={() => setFormOpen(false)}
                  className="h-9 px-4 rounded-lg text-sm border"
                  style={{ borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface-variant)' }}>
                  取消
                </button>
                <button onClick={submitForm} disabled={saving}
                  className="h-9 px-4 rounded-lg text-sm font-medium flex items-center gap-1.5 disabled:opacity-60"
                  style={{ background: 'var(--accent-green)', color: '#fff' }}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  {editId ? '保存' : '创建'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 删除确认弹窗 ── */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}
            onClick={() => setDeleteTarget(null)}>
            <motion.div initial={{ scale: 0.96, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 10 }}
              className="w-full max-w-md rounded-2xl p-6 shadow-2xl"
              style={{ background: 'var(--color-surface-container-lowest)' }}
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold" style={{ color: 'var(--color-on-surface)' }}>确认删除</h3>
                <button onClick={() => setDeleteTarget(null)} style={{ color: 'var(--color-on-surface-variant)' }}>
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="text-sm" style={{ color: 'var(--color-on-surface)' }}>
                确定要删除资源「<span style={{ color: 'var(--accent-red)' }}>{deleteTarget.title}</span>」吗？
              </p>
              <p className="text-xs mt-2" style={{ color: 'var(--color-on-surface-variant)' }}>此操作不可撤销。</p>
              <div className="flex justify-end gap-2 mt-5">
                <button onClick={() => setDeleteTarget(null)} className="h-9 px-4 rounded-lg text-sm border"
                  style={{ borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface-variant)' }}>取消</button>
                <button onClick={submitDelete} className="h-9 px-4 rounded-lg text-sm font-medium"
                  style={{ background: 'var(--accent-red)', color: '#fff' }}>确认删除</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Toast ── */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg text-sm shadow-lg"
            style={{ background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface)' }}>
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
