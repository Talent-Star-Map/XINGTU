import { useState, useEffect } from 'react'
import { Trash2, Loader2, X, Search, ChevronLeft, ChevronRight, Briefcase } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

// ─── 管理员 token 注入（与 QualityDashboard 一致）───
const getToken = () => localStorage.getItem('xingtu_token') || ''
const withToken = (url: string) => `${url}${url.includes('?') ? '&' : '?'}token=${getToken()}`

// 职位记录类型（字段来自后端 /api/admin/jobs）
interface JobItem {
  id: number
  enterprise_id: number
  enterprise_name: string
  title: string
  location: string
  salary_range: string
  experience: string
  education: string
  skills_required: string
  status: string            // active / closed / draft
  candidates: number
  created_at: string
}

// 状态映射：后端 status → 前端中文 + 颜色（与 JobManage.tsx 保持一致）
const STATUS_MAP: Record<string, { label: string; bg: string; color: string }> = {
  'active': { label: '招聘中', bg: 'var(--accent-green-dim)', color: 'var(--accent-green)' },
  'draft': { label: '草稿', bg: 'var(--accent-orange-dim)', color: 'var(--accent-orange)' },
  'closed': { label: '已关闭', bg: 'var(--color-neutral-dim)', color: 'var(--color-on-surface-variant)' },
}

// 状态过滤选项
const FILTERS = [
  { key: '', label: '全部' },
  { key: 'active', label: '招聘中' },
  { key: 'draft', label: '草稿' },
  { key: 'closed', label: '已关闭' },
]

export default function AdminJobManage() {
  const [jobs, setJobs] = useState<JobItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  // 分页 + 搜索 + 状态过滤
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [total, setTotal] = useState(0)
  const [keyword, setKeyword] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  // 删除确认弹窗
  const [deleteTarget, setDeleteTarget] = useState<JobItem | null>(null)

  // ── 拉取列表 ──
  const load = async (p = page, kw = keyword, status = statusFilter) => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      params.set('page', String(p))
      params.set('size', String(pageSize))
      if (kw) params.set('keyword', kw)
      if (status) params.set('status', status)
      const r = await fetch(withToken(`/api/admin/jobs?${params.toString()}`))
      const d = await r.json()
      if (d.success) {
        setJobs(d.data.list as JobItem[])
        setTotal(d.data.total)
      } else {
        setError(d.error?.message || '加载失败')
      }
    } catch {
      setError('网络错误')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(1, '', '') }, [])

  // 顶部消息提示（3 秒自动消失）
  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  // ── 搜索：回车提交 ──
  const onSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setKeyword(searchInput)
      setPage(1)
      load(1, searchInput, statusFilter)
    }
  }

  // ── 切换状态过滤 ──
  const onStatusChange = (s: string) => {
    setStatusFilter(s)
    setPage(1)
    load(1, keyword, s)
  }

  // ── 翻页 ──
  const goPage = (p: number) => {
    if (p < 1 || p > Math.ceil(total / pageSize)) return
    setPage(p)
    load(p, keyword, statusFilter)
  }

  // ── 删除职位 ──
  const submitDelete = async () => {
    if (!deleteTarget) return
    try {
      const r = await fetch(withToken(`/api/admin/jobs/${deleteTarget.id}`), { method: 'DELETE' })
      const d = await r.json()
      if (d.success) {
        showToast(d.message || '已删除')
        setDeleteTarget(null)
        // 删除后若当前页空了，回退一页
        const remaining = total - 1
        const maxPage = Math.max(1, Math.ceil(remaining / pageSize))
        const targetPage = Math.min(page, maxPage)
        if (targetPage !== page) {
          setPage(targetPage)
          load(targetPage, keyword, statusFilter)
        } else {
          await load(page, keyword, statusFilter)
        }
      } else {
        showToast(d.error?.message || '删除失败')
      }
    } catch {
      showToast('网络错误')
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="h-full flex flex-col">
      {/* ── 顶部工具栏 ── */}
      <header className="shrink-0 border-b" style={{ borderColor: 'var(--color-outline-variant)' }}>
        <div className="max-w-[1400px] mx-auto px-8 py-5 flex items-center gap-3">
          <Briefcase className="h-5 w-5" style={{ color: 'var(--accent-green)' }} />
          <h1 className="text-lg font-semibold tracking-tight" style={{ color: 'var(--color-on-surface)' }}>
            职位管理
          </h1>
          <span className="text-xs tabular-nums px-2 py-0.5 rounded-full"
            style={{ background: 'var(--accent-green-dim)', color: 'var(--accent-green)' }}>
            共 {total} 条
          </span>
        </div>
      </header>

      {/* ── 状态过滤 + 搜索 ── */}
      <div className="shrink-0 border-b" style={{ borderColor: 'var(--color-outline-variant)' }}>
        <div className="max-w-[1400px] mx-auto px-8 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            {FILTERS.map(f => {
              const active = statusFilter === f.key
              return (
                <button
                  key={f.key}
                  onClick={() => onStatusChange(f.key)}
                  className="h-8 px-3 rounded-lg text-xs font-medium transition-colors"
                  style={{
                    background: active ? 'var(--accent-green-dim)' : 'transparent',
                    color: active ? 'var(--accent-green)' : 'var(--color-on-surface-variant)',
                  }}
                >
                  {f.label}
                </button>
              )
            })}
          </div>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
              style={{ color: 'var(--color-on-surface-variant)' }} />
            <input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={onSearchKeyDown}
              placeholder="搜索岗位/技能/企业名，回车"
              className="w-full h-9 pl-9 pr-3 rounded-lg text-sm border outline-none"
              style={{
                borderColor: 'var(--color-outline-variant)',
                background: 'var(--color-surface)',
                color: 'var(--color-on-surface)',
              }}
            />
          </div>
        </div>
      </div>

      {/* ── 表格主体 ── */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-[1400px] mx-auto px-8 py-4">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--accent-green)' }} />
            </div>
          ) : error ? (
            <div className="text-center py-10 text-sm" style={{ color: 'var(--accent-red)' }}>{error}</div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-10 text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
              暂无职位数据
            </div>
          ) : (
            <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-outline-variant)' }}>
              <table className="w-full text-sm">
                <thead style={{ background: 'var(--color-surface-container)' }}>
                  <tr className="text-left">
                    <th className="px-4 py-3 text-xs font-semibold" style={{ color: 'var(--color-on-surface-variant)' }}>ID</th>
                    <th className="px-4 py-3 text-xs font-semibold" style={{ color: 'var(--color-on-surface-variant)' }}>岗位名称</th>
                    <th className="px-4 py-3 text-xs font-semibold" style={{ color: 'var(--color-on-surface-variant)' }}>发布企业</th>
                    <th className="px-4 py-3 text-xs font-semibold" style={{ color: 'var(--color-on-surface-variant)' }}>城市</th>
                    <th className="px-4 py-3 text-xs font-semibold" style={{ color: 'var(--color-on-surface-variant)' }}>薪资</th>
                    <th className="px-4 py-3 text-xs font-semibold" style={{ color: 'var(--color-on-surface-variant)' }}>经验</th>
                    <th className="px-4 py-3 text-xs font-semibold" style={{ color: 'var(--color-on-surface-variant)' }}>候选人</th>
                    <th className="px-4 py-3 text-xs font-semibold" style={{ color: 'var(--color-on-surface-variant)' }}>状态</th>
                    <th className="px-4 py-3 text-xs font-semibold" style={{ color: 'var(--color-on-surface-variant)' }}>发布时间</th>
                    <th className="px-4 py-3 text-xs font-semibold text-right" style={{ color: 'var(--color-on-surface-variant)' }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map(j => {
                    const st = STATUS_MAP[j.status] || STATUS_MAP['active']
                    return (
                      <tr key={j.id} className="border-t" style={{ borderColor: 'var(--color-outline-variant)' }}>
                        <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-on-surface)' }}>{j.id}</td>
                        <td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--color-on-surface)' }}>
                          {j.title}
                        </td>
                        <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
                          {j.enterprise_name || `企业#${j.enterprise_id}`}
                        </td>
                        <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-on-surface)' }}>{j.location || '-'}</td>
                        <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-on-surface)' }}>{j.salary_range || '-'}</td>
                        <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-on-surface)' }}>{j.experience || '-'}</td>
                        <td className="px-4 py-3 text-sm tabular-nums" style={{ color: 'var(--color-on-surface-variant)' }}>{j.candidates}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: st.bg, color: st.color }}>
                            {st.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>{j.created_at}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => setDeleteTarget(j)}
                            title="删除"
                            className="p-1.5 rounded transition-colors inline-flex"
                            style={{ color: 'var(--color-on-surface-variant)' }}
                            onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-red)'}
                            onMouseLeave={e => e.currentTarget.style.color = 'var(--color-on-surface-variant)'}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
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
                <button
                  disabled={page <= 1}
                  onClick={() => goPage(page - 1)}
                  className="h-8 w-8 flex items-center justify-center rounded-lg border transition-colors disabled:opacity-40"
                  style={{ borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface-variant)', background: 'var(--color-surface)' }}
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => goPage(page + 1)}
                  className="h-8 w-8 flex items-center justify-center rounded-lg border transition-colors disabled:opacity-40"
                  style={{ borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface-variant)', background: 'var(--color-surface)' }}
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── 删除确认弹窗 ── */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.4)' }}
            onClick={() => setDeleteTarget(null)}
          >
            <motion.div
              initial={{ scale: 0.96, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 10 }}
              className="w-full max-w-md rounded-2xl p-6 shadow-2xl"
              style={{ background: 'var(--color-surface-container-lowest)' }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold" style={{ color: 'var(--color-on-surface)' }}>确认删除</h3>
                <button onClick={() => setDeleteTarget(null)} style={{ color: 'var(--color-on-surface-variant)' }}>
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="text-sm" style={{ color: 'var(--color-on-surface)' }}>
                确定要删除职位「<span style={{ color: 'var(--accent-red)' }}>{deleteTarget.title}</span>」吗？
              </p>
              <p className="text-xs mt-2" style={{ color: 'var(--color-on-surface-variant)' }}>
                该职位的所有匹配记录将一并清理。此操作不可撤销。
              </p>
              <div className="flex justify-end gap-2 mt-5">
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="h-9 px-4 rounded-lg text-sm border"
                  style={{ borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface-variant)' }}
                >
                  取消
                </button>
                <button
                  onClick={submitDelete}
                  className="h-9 px-4 rounded-lg text-sm font-medium"
                  style={{ background: 'var(--accent-red)', color: '#fff' }}
                >
                  确认删除
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 顶部 toast ── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg text-sm shadow-lg"
            style={{ background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface)' }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
