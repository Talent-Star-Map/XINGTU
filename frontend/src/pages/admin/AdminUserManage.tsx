import { useState, useEffect } from 'react'
import { Plus, Trash2, KeyRound, Loader2, X, Search, ChevronLeft, ChevronRight, Users, Building2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

// ─── 管理员 token 注入（与 QualityDashboard 一致，admin 接口必须携带 token）───
const getToken = () => localStorage.getItem('xingtu_token') || ''
const withToken = (url: string) => `${url}${url.includes('?') ? '&' : '?'}token=${getToken()}`

// 求职者记录类型
interface JobseekerItem {
  id: number
  email: string
  phone: string
  username: string
  real_name: string
  target_position: string
  city: string
  experience: string
  education: string
  skills: string
  created_at: string
}

// 企业记录类型
interface EnterpriseItem {
  id: number
  email: string
  phone: string
  username: string
  company_name: string
  industry: string
  city: string
  verified: number
  created_at: string
}

// 创建表单
interface CreateForm {
  email: string
  username: string
  password: string
  company_name: string
}

const EMPTY_FORM: CreateForm = { email: '', username: '', password: '', company_name: '' }

interface Props {
  role: 'jobseeker' | 'enterprise'
}

// 密码强度提示文本（与后端 _validate_password 一致）
const PWD_HINT = '至少 8 位，需含大小写字母 + 数字'

export default function AdminUserManage({ role }: Props) {
  const isJobseeker = role === 'jobseeker'
  // 列表数据（两种角色共用一套 state，切换 role 时通过 useEffect 重新拉取）
  const [jobseekers, setJobseekers] = useState<JobseekerItem[]>([])
  const [enterprises, setEnterprises] = useState<EnterpriseItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  // 分页 + 搜索
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [total, setTotal] = useState(0)
  const [keyword, setKeyword] = useState('')
  // 搜索输入框受控值（回车提交时同步到 keyword）
  const [searchInput, setSearchInput] = useState('')

  // 弹窗
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [resetTarget, setResetTarget] = useState<{ id: number; name: string } | null>(null)
  const [newPwd, setNewPwd] = useState('')
  const [resetting, setResetting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null)

  // 根据角色取 API 路径前缀
  const apiBase = isJobseeker ? '/api/admin/jobseekers' : '/api/admin/enterprises'

  // ── 拉取列表 ──
  const load = async (p = page, kw = keyword) => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      params.set('page', String(p))
      params.set('size', String(pageSize))
      if (kw) params.set('keyword', kw)
      const r = await fetch(withToken(`${apiBase}?${params.toString()}`))
      const d = await r.json()
      if (d.success) {
        if (isJobseeker) setJobseekers(d.data.list as JobseekerItem[])
        else setEnterprises(d.data.list as EnterpriseItem[])
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

  // 切换 role 或页码变化时重新拉取
  useEffect(() => {
    setPage(1)
    setKeyword('')
    setSearchInput('')
    load(1, '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role])

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
      load(1, searchInput)
    }
  }

  // ── 翻页 ──
  const goPage = (p: number) => {
    if (p < 1 || p > Math.ceil(total / pageSize)) return
    setPage(p)
    load(p, keyword)
  }

  // ── 提交创建 ──
  const submitCreate = async () => {
    if (!form.email.trim() || !form.password) {
      showToast('邮箱和密码不能为空')
      return
    }
    setSaving(true)
    try {
      const body: any = {
        email: form.email.trim(),
        username: form.username.trim(),
        password: form.password,
      }
      if (!isJobseeker) body.company_name = form.company_name.trim()
      const r = await fetch(withToken(apiBase), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const d = await r.json()
      if (d.success) {
        setCreateOpen(false)
        setForm(EMPTY_FORM)
        showToast(d.message || '创建成功')
        await load(1, keyword)
      } else {
        showToast(d.error?.message || '创建失败')
      }
    } catch {
      showToast('网络错误')
    } finally {
      setSaving(false)
    }
  }

  // ── 重置密码 ──
  const submitReset = async () => {
    if (!resetTarget) return
    setResetting(true)
    try {
      const r = await fetch(withToken(`${apiBase}/${resetTarget.id}/reset-password`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPwd }),
      })
      const d = await r.json()
      if (d.success) {
        showToast(d.message || '密码已重置')
        setResetTarget(null)
        setNewPwd('')
      } else {
        showToast(d.error?.message || '重置失败')
      }
    } catch {
      showToast('网络错误')
    } finally {
      setResetting(false)
    }
  }

  // ── 删除账号 ──
  const submitDelete = async () => {
    if (!deleteTarget) return
    try {
      const r = await fetch(withToken(`${apiBase}/${deleteTarget.id}`), { method: 'DELETE' })
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
          load(targetPage, keyword)
        } else {
          await load(page, keyword)
        }
      } else {
        showToast(d.error?.message || '删除失败')
      }
    } catch {
      showToast('网络错误')
    }
  }

  // 取当前角色的展示名称
  const roleLabel = isJobseeker ? '求职者' : '企业'
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="h-full flex flex-col">
      {/* ── 顶部工具栏 ── */}
      <header className="shrink-0 border-b" style={{ borderColor: 'var(--color-outline-variant)' }}>
        <div className="max-w-[1400px] mx-auto px-8 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isJobseeker
              ? <Users className="h-5 w-5" style={{ color: 'var(--accent-green)' }} />
              : <Building2 className="h-5 w-5" style={{ color: 'var(--accent-green)' }} />}
            <h1 className="text-lg font-semibold tracking-tight" style={{ color: 'var(--color-on-surface)' }}>
              {roleLabel}管理
            </h1>
            <span className="text-xs tabular-nums px-2 py-0.5 rounded-full"
              style={{ background: 'var(--accent-green-dim)', color: 'var(--accent-green)' }}>
              共 {total} 条
            </span>
          </div>
          <button
            onClick={() => { setForm(EMPTY_FORM); setCreateOpen(true) }}
            className="flex items-center gap-2 h-8 px-3 rounded-lg text-xs font-medium transition-colors"
            style={{ background: 'var(--accent-green)', color: '#fff' }}
          >
            <Plus className="h-3.5 w-3.5" /> 创建{roleLabel}
          </button>
        </div>
      </header>

      {/* ── 搜索栏 ── */}
      <div className="shrink-0 border-b" style={{ borderColor: 'var(--color-outline-variant)' }}>
        <div className="max-w-[1400px] mx-auto px-8 py-3 flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
              style={{ color: 'var(--color-on-surface-variant)' }} />
            <input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={onSearchKeyDown}
              placeholder={isJobseeker ? '搜索邮箱/用户名/姓名/手机号，回车搜索' : '搜索邮箱/用户名/公司名/手机号，回车搜索'}
              className="w-full h-9 pl-9 pr-3 rounded-lg text-sm border outline-none"
              style={{
                borderColor: 'var(--color-outline-variant)',
                background: 'var(--color-surface)',
                color: 'var(--color-on-surface)',
              }}
            />
          </div>
          {keyword && (
            <button
              onClick={() => { setSearchInput(''); setKeyword(''); setPage(1); load(1, '') }}
              className="text-xs px-2 py-1 rounded"
              style={{ color: 'var(--color-on-surface-variant)' }}
            >
              清除搜索
            </button>
          )}
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
          ) : (isJobseeker ? jobseekers : enterprises).length === 0 ? (
            <div className="text-center py-10 text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
              暂无{roleLabel}数据
            </div>
          ) : (
            <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-outline-variant)' }}>
              <table className="w-full text-sm">
                <thead style={{ background: 'var(--color-surface-container)' }}>
                  <tr className="text-left">
                    <Th>ID</Th>
                    <Th>邮箱</Th>
                    <Th>{isJobseeker ? '用户名' : '公司名'}</Th>
                    {isJobseeker
                      ? <>
                        <Th>求职意向</Th>
                        <Th>城市</Th>
                        <Th>经验</Th>
                      </>
                      : <>
                        <Th>行业</Th>
                        <Th>城市</Th>
                        <Th>认证</Th>
                      </>
                    }
                    <Th>注册时间</Th>
                    <Th className="text-right">操作</Th>
                  </tr>
                </thead>
                <tbody>
                  {isJobseeker
                    ? jobseekers.map(j => (
                      <tr key={j.id} className="border-t" style={{ borderColor: 'var(--color-outline-variant)' }}>
                        <Td>{j.id}</Td>
                        <Td>{j.email || '-'}</Td>
                        <Td>{j.real_name || j.username || '-'}</Td>
                        <Td>{j.target_position || '-'}</Td>
                        <Td>{j.city || '-'}</Td>
                        <Td>{j.experience || '-'}</Td>
                        <Td>{j.created_at}</Td>
                        <Td className="text-right">
                          <RowActions
                            onReset={() => setResetTarget({ id: j.id, name: j.real_name || j.username || j.email })}
                            onDelete={() => setDeleteTarget({ id: j.id, name: j.real_name || j.username || j.email })}
                          />
                        </Td>
                      </tr>
                    ))
                    : enterprises.map(e => (
                      <tr key={e.id} className="border-t" style={{ borderColor: 'var(--color-outline-variant)' }}>
                        <Td>{e.id}</Td>
                        <Td>{e.email || '-'}</Td>
                        <Td>{e.company_name || e.username || '-'}</Td>
                        <Td>{e.industry || '-'}</Td>
                        <Td>{e.city || '-'}</Td>
                        <Td>
                          {e.verified
                            ? <span style={{ color: 'var(--accent-green)' }}>已认证</span>
                            : <span style={{ color: 'var(--color-on-surface-variant)' }}>未认证</span>}
                        </Td>
                        <Td>{e.created_at}</Td>
                        <Td className="text-right">
                          <RowActions
                            onReset={() => setResetTarget({ id: e.id, name: e.company_name || e.username || e.email })}
                            onDelete={() => setDeleteTarget({ id: e.id, name: e.company_name || e.username || e.email })}
                          />
                        </Td>
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
                <PageBtn disabled={page <= 1} onClick={() => goPage(page - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </PageBtn>
                <PageBtn disabled={page >= totalPages} onClick={() => goPage(page + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </PageBtn>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── 创建账号弹窗 ── */}
      <AnimatePresence>
        {createOpen && (
          <Modal title={`创建${roleLabel}账号`} onClose={() => setCreateOpen(false)}>
            <div className="space-y-3">
              <Field label="邮箱 *">
                <input
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  placeholder="user@example.com"
                  className="modal-input"
                />
              </Field>
              <Field label="用户名（可选）">
                <input
                  value={form.username}
                  onChange={e => setForm({ ...form, username: e.target.value })}
                  placeholder="留空则取邮箱前缀"
                  className="modal-input"
                />
              </Field>
              {!isJobseeker && (
                <Field label="公司名称（可选）">
                  <input
                    value={form.company_name}
                    onChange={e => setForm({ ...form, company_name: e.target.value })}
                    placeholder="如：星图科技有限公司"
                    className="modal-input"
                  />
                </Field>
              )}
              <Field label={`初始密码 *（${PWD_HINT}）`}>
                <input
                  type="password"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  placeholder="如：Xing1234"
                  className="modal-input"
                />
              </Field>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setCreateOpen(false)} className="modal-btn-secondary">取消</button>
              <button
                onClick={submitCreate}
                disabled={saving}
                className="modal-btn-primary"
                style={{ background: 'var(--accent-green)', color: '#fff' }}
              >
                {saving ? '创建中...' : '创建'}
              </button>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* ── 重置密码弹窗 ── */}
      <AnimatePresence>
        {resetTarget && (
          <Modal title={`重置密码 · ${resetTarget.name}`} onClose={() => { setResetTarget(null); setNewPwd('') }}>
            <Field label={`新密码 *（${PWD_HINT}）`}>
              <input
                type="password"
                value={newPwd}
                onChange={e => setNewPwd(e.target.value)}
                placeholder="如：Xing1234"
                className="modal-input"
              />
            </Field>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => { setResetTarget(null); setNewPwd('') }} className="modal-btn-secondary">取消</button>
              <button
                onClick={submitReset}
                disabled={resetting || !newPwd}
                className="modal-btn-primary"
                style={{ background: 'var(--accent-green)', color: '#fff' }}
              >
                {resetting ? '重置中...' : '确认重置'}
              </button>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* ── 删除确认弹窗 ── */}
      <AnimatePresence>
        {deleteTarget && (
          <Modal title="确认删除" onClose={() => setDeleteTarget(null)}>
            <p className="text-sm" style={{ color: 'var(--color-on-surface)' }}>
              确定要删除{roleLabel}「<span style={{ color: 'var(--accent-red)' }}>{deleteTarget.name}</span>」吗？
            </p>
            <p className="text-xs mt-2" style={{ color: 'var(--color-on-surface-variant)' }}>
              {isJobseeker
                ? '该求职者的所有匹配记录将一并清理。此操作不可撤销。'
                : '该企业发布的所有岗位及匹配记录将一并清理。此操作不可撤销。'}
            </p>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setDeleteTarget(null)} className="modal-btn-secondary">取消</button>
              <button
                onClick={submitDelete}
                className="modal-btn-primary"
                style={{ background: 'var(--accent-red)', color: '#fff' }}
              >
                确认删除
              </button>
            </div>
          </Modal>
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

      {/* ── 弹窗样式（内联 className 复用）── */}
      <style>{`
        .modal-input {
          width: 100%; height: 38px; padding: 0 12px; border-radius: 8px;
          border: 1px solid var(--color-outline-variant);
          background: var(--color-surface);
          color: var(--color-on-surface);
          font-size: 14px; outline: none;
        }
        .modal-input:focus { border-color: var(--accent-green); }
        .modal-btn-secondary {
          height: 36px; padding: 0 16px; border-radius: 8px; font-size: 13px;
          border: 1px solid var(--color-outline-variant);
          color: var(--color-on-surface-variant);
        }
        .modal-btn-primary {
          height: 36px; padding: 0 16px; border-radius: 8px; font-size: 13px; font-weight: 500;
        }
      `}</style>
    </div>
  )
}

// ─── 表格子组件 ─────────────────────────────────────────────────────────
function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`px-4 py-3 text-xs font-semibold whitespace-nowrap ${className}`}
      style={{ color: 'var(--color-on-surface-variant)' }}>
      {children}
    </th>
  )
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <td className={`px-4 py-3 text-sm whitespace-nowrap ${className}`}
      style={{ color: 'var(--color-on-surface)' }}>
      {children}
    </td>
  )
}
function RowActions({ onReset, onDelete }: { onReset: () => void; onDelete: () => void }) {
  return (
    <div className="flex items-center justify-end gap-1">
      <button
        onClick={onReset}
        title="重置密码"
        className="p-1.5 rounded transition-colors"
        style={{ color: 'var(--color-on-surface-variant)' }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-green)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--color-on-surface-variant)'}
      >
        <KeyRound className="h-4 w-4" />
      </button>
      <button
        onClick={onDelete}
        title="删除"
        className="p-1.5 rounded transition-colors"
        style={{ color: 'var(--color-on-surface-variant)' }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-red)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--color-on-surface-variant)'}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  )
}
function PageBtn({ children, disabled, onClick }: { children: React.ReactNode; disabled: boolean; onClick: () => void }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className="h-8 w-8 flex items-center justify-center rounded-lg border transition-colors disabled:opacity-40"
      style={{
        borderColor: 'var(--color-outline-variant)',
        color: 'var(--color-on-surface-variant)',
        background: 'var(--color-surface)',
      }}
    >
      {children}
    </button>
  )
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-on-surface-variant)' }}>
        {label}
      </label>
      {children}
    </div>
  )
}
function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
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
          <h3 className="text-base font-semibold" style={{ color: 'var(--color-on-surface)' }}>{title}</h3>
          <button onClick={onClose} style={{ color: 'var(--color-on-surface-variant)' }}>
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  )
}
