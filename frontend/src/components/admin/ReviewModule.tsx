import { useEffect, useMemo, useState } from 'react'
import {
  ShieldCheck,
  ClipboardList,
  CheckCircle2,
  XCircle,
  PencilLine,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Briefcase,
  GitBranch,
  RefreshCw,
} from 'lucide-react'

/**
 * ReviewModule — 管理员人工审核面板 (2026-09-05)
 * 挂载在 QualityDashboard 末尾;不感知路由。
 * 通过 token(同 QualityDashboard)注入 admin 鉴权。
 */

// ────────────────────────────────────────────────────────────
// token 注入(与 QualityDashboard 保持一致)
// ────────────────────────────────────────────────────────────
const getToken = () => localStorage.getItem('xingtu_token') || ''
const withToken = (url: string) =>
  `${url}${url.includes('?') ? '&' : '?'}token=${getToken()}`

const apiGet = async (path: string) => {
  const r = await fetch(withToken(path))
  const d = await r.json()
  if (!d.success) throw new Error(d.message || '请求失败')
  return d.data
}
const apiPost = async (path: string, body: any) => {
  const r = await fetch(withToken(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  })
  const d = await r.json()
  if (!d.success) throw new Error(d.message || '操作失败')
  return d.data
}
const apiPut = async (path: string, body: any) => {
  const r = await fetch(withToken(path), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  })
  const d = await r.json()
  if (!d.success) throw new Error(d.message || '操作失败')
  return d.data
}

// ────────────────────────────────────────────────────────────
// 类型定义
// ────────────────────────────────────────────────────────────
type TaskType = 'new_job' | 'skill_change'
type Status = 'pending' | 'approved' | 'rejected' | 'modified'

interface ReviewTask {
  id: number
  task_type: TaskType
  target_id: string
  target_kind: 'Job' | 'ChangeEvent'
  content_snapshot: Record<string, any>
  modified_content: Record<string, any> | null
  status: Status
  reviewer_id: number | null
  review_comment: string
  created_at: string
  reviewed_at: string | null
}

interface Stats {
  pending_new_jobs: number
  pending_skill_changes: number
  pending_total: number
  approved_total: number
  rejected_total: number
}

// ────────────────────────────────────────────────────────────
// 主组件
// ────────────────────────────────────────────────────────────
export default function ReviewModule() {
  const [filterType, setFilterType] = useState<TaskType | 'all'>('all')
  const [filterStatus, setFilterStatus] = useState<Status | 'pending' | 'all'>(
    'pending',
  )
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)

  const [items, setItems] = useState<ReviewTask[]>([])
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')

  // 弹窗状态
  const [editingTask, setEditingTask] = useState<ReviewTask | null>(null)
  const [rejectingTask, setRejectingTask] = useState<ReviewTask | null>(null)
  const [actingId, setActingId] = useState<number | null>(null)
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(
    null,
  )

  const showToast = (kind: 'ok' | 'err', msg: string) => {
    setToast({ kind, msg })
    setTimeout(() => setToast(null), 2500)
  }

  const loadList = async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (filterType !== 'all') params.set('task_type', filterType)
      if (filterStatus !== 'all') params.set('status', filterStatus)
      params.set('page', String(page))
      params.set('page_size', String(pageSize))
      const data = await apiGet(`/api/admin/review/tasks?${params.toString()}`)
      setItems(data.items || [])
      setTotal(data.total || 0)
    } catch (e: any) {
      setError(e.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      setStats(await apiGet('/api/admin/review/stats'))
    } catch {
      // 静默失败
    }
  }

  useEffect(() => {
    loadList()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterType, filterStatus, page])

  useEffect(() => {
    loadStats()
  }, [])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  // ── 审核操作 ──────────────────────────────────────────────
  const approve = async (task: ReviewTask) => {
    if (!confirm(`确认通过此「${task.task_type === 'new_job' ? '新岗位' : '能力变更'}」审核?`)) return
    setActingId(task.id)
    try {
      await apiPost(`/api/admin/review/tasks/${task.id}/approve`, { comment: '' })
      showToast('ok', '已通过')
      await Promise.all([loadList(), loadStats()])
    } catch (e: any) {
      showToast('err', e.message)
    } finally {
      setActingId(null)
    }
  }

  const onRejected = async (task: ReviewTask, comment: string) => {
    setActingId(task.id)
    try {
      await apiPost(`/api/admin/review/tasks/${task.id}/reject`, { comment })
      showToast('ok', '已驳回')
      setRejectingTask(null)
      await Promise.all([loadList(), loadStats()])
    } catch (e: any) {
      showToast('err', e.message)
    } finally {
      setActingId(null)
    }
  }

  const onModified = async (
    task: ReviewTask,
    modifiedContent: Record<string, any>,
    comment: string,
  ) => {
    setActingId(task.id)
    try {
      await apiPut(`/api/admin/review/tasks/${task.id}/modify`, {
        modified_content: modifiedContent,
        comment,
      })
      showToast('ok', '已修改并通过')
      setEditingTask(null)
      await Promise.all([loadList(), loadStats()])
    } catch (e: any) {
      showToast('err', e.message)
    } finally {
      setActingId(null)
    }
  }

  return (
    <div
      className="rounded-2xl border shadow-sm p-6"
      style={{
        borderColor: 'var(--color-outline-variant)',
        background: 'var(--color-surface-container-lowest)',
      }}
    >
      {/* 标题 + 统计 */}
      <div className="flex items-center justify-between mb-4">
        <h3
          className="text-base font-bold flex items-center gap-2"
          style={{ color: 'var(--color-on-surface)' }}
        >
          <ShieldCheck className="h-4 w-4" style={{ color: 'var(--accent-green)' }} />
          人工审核（AI 生成内容 review gate）
        </h3>
        <button
          onClick={() => {
            loadList()
            loadStats()
          }}
          className="text-xs px-2 py-1 rounded-lg font-medium border flex items-center gap-1"
          style={{
            borderColor: 'var(--color-outline-variant)',
            color: 'var(--color-on-surface-variant)',
          }}
        >
          <RefreshCw className="h-3 w-3" /> 刷新
        </button>
      </div>

      {/* 统计 chip */}
      {stats && (
        <div className="grid grid-cols-5 gap-3 mb-4">
          <StatChip label="待审 总数" value={stats.pending_total} color="var(--color-primary)" />
          <StatChip
            label="待审 新岗位"
            value={stats.pending_new_jobs}
            color="var(--accent-purple)"
          />
          <StatChip
            label="待审 能力变更"
            value={stats.pending_skill_changes}
            color="var(--accent-orange)"
          />
          <StatChip
            label="已通过(累计)"
            value={stats.approved_total}
            color="var(--accent-green)"
          />
          <StatChip
            label="已驳回(累计)"
            value={stats.rejected_total}
            color="var(--accent-red)"
          />
        </div>
      )}

      {/* 筛选 */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <FilterBtn active={filterType === 'all'} onClick={() => { setFilterType('all'); setPage(1) }}>
          全部类型
        </FilterBtn>
        <FilterBtn
          active={filterType === 'new_job'}
          onClick={() => { setFilterType('new_job'); setPage(1) }}
          icon={Briefcase}
        >
          新岗位
        </FilterBtn>
        <FilterBtn
          active={filterType === 'skill_change'}
          onClick={() => { setFilterType('skill_change'); setPage(1) }}
          icon={GitBranch}
        >
          能力变更
        </FilterBtn>
        <span className="mx-2 text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
          |
        </span>
        <FilterBtn
          active={filterStatus === 'pending'}
          onClick={() => { setFilterStatus('pending'); setPage(1) }}
        >
          待审
        </FilterBtn>
        <FilterBtn
          active={filterStatus === 'all'}
          onClick={() => { setFilterStatus('all'); setPage(1) }}
        >
          全部状态
        </FilterBtn>
        <FilterBtn
          active={filterStatus === 'approved'}
          onClick={() => { setFilterStatus('approved'); setPage(1) }}
        >
          已通过
        </FilterBtn>
        <FilterBtn
          active={filterStatus === 'rejected'}
          onClick={() => { setFilterStatus('rejected'); setPage(1) }}
        >
          已驳回
        </FilterBtn>
        <FilterBtn
          active={filterStatus === 'modified'}
          onClick={() => { setFilterStatus('modified'); setPage(1) }}
        >
          已修改通过
        </FilterBtn>
      </div>

      {/* 列表 */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--color-primary)' }} />
        </div>
      ) : error ? (
        <p className="text-sm py-6 text-center" style={{ color: 'var(--accent-red)' }}>
          {error}
        </p>
      ) : items.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-3">
          {items.map(t => (
            <ReviewTaskCard
              key={t.id}
              task={t}
              acting={actingId === t.id}
              onApprove={() => approve(t)}
              onReject={() => setRejectingTask(t)}
              onEdit={() => setEditingTask(t)}
            />
          ))}
        </div>
      )}

      {/* 分页 */}
      {total > pageSize && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
            共 {total} 条 · 第 {page}/{totalPages} 页
          </p>
          <div className="flex items-center gap-1">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="p-1 rounded disabled:opacity-40"
              style={{ color: 'var(--color-on-surface)' }}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              className="p-1 rounded disabled:opacity-40"
              style={{ color: 'var(--color-on-surface)' }}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* 弹窗 */}
      {editingTask && (
        <EditModal
          task={editingTask}
          onCancel={() => setEditingTask(null)}
          onSubmit={(content, comment) => onModified(editingTask, content, comment)}
        />
      )}
      {rejectingTask && (
        <RejectModal
          task={rejectingTask}
          onCancel={() => setRejectingTask(null)}
          onSubmit={comment => onRejected(rejectingTask, comment)}
        />
      )}

      {/* toast */}
      {toast && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg shadow-lg text-sm font-medium z-50"
          style={{
            background: toast.kind === 'ok' ? 'var(--accent-green)' : 'var(--accent-red)',
            color: 'var(--color-on-primary)',
          }}
        >
          {toast.msg}
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// 子组件
// ────────────────────────────────────────────────────────────
function StatChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div
      className="text-center p-3 rounded-xl"
      style={{ background: 'var(--color-surface)' }}
    >
      <p className="text-xl font-extrabold" style={{ color }}>
        {value}
      </p>
      <p
        className="text-[10px] font-medium mt-0.5"
        style={{ color: 'var(--color-on-surface-variant)' }}
      >
        {label}
      </p>
    </div>
  )
}

function FilterBtn({
  active,
  onClick,
  children,
  icon: Icon,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  icon?: any
}) {
  return (
    <button
      onClick={onClick}
      className="text-xs px-3 py-1.5 rounded-full font-medium flex items-center gap-1 transition-colors"
      style={{
        background: active ? 'var(--color-primary)' : 'var(--color-surface)',
        color: active ? 'var(--color-on-primary)' : 'var(--color-on-surface-variant)',
        border: '1px solid',
        borderColor: active ? 'var(--color-primary)' : 'var(--color-outline-variant)',
      }}
    >
      {Icon ? <Icon className="h-3 w-3" /> : null}
      {children}
    </button>
  )
}

function EmptyState() {
  return (
    <div
      className="py-10 text-center rounded-xl"
      style={{ background: 'var(--color-surface)' }}
    >
      <ClipboardList
        className="h-8 w-8 mx-auto mb-2"
        style={{ color: 'var(--color-on-surface-variant)' }}
      />
      <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
        暂无待审任务
      </p>
      <p
        className="text-[10px] mt-1"
        style={{ color: 'var(--color-on-surface-variant)' }}
      >
        AI 抽取新岗位 / 能力变更后会出现在这里
      </p>
    </div>
  )
}

function StatusBadge({ status }: { status: Status }) {
  const map: Record<Status, { label: string; bg: string; fg: string }> = {
    pending: { label: '待审', bg: 'var(--color-primary-fixed)', fg: 'var(--color-primary)' },
    approved: { label: '已通过', bg: 'var(--accent-green-dim)', fg: 'var(--accent-green)' },
    rejected: { label: '已驳回', bg: 'var(--accent-red-dim)', fg: 'var(--accent-red)' },
    modified: { label: '已修改通过', bg: 'var(--accent-purple-dim)', fg: 'var(--accent-purple)' },
  }
  const m = map[status] || map.pending
  return (
    <span
      className="text-[10px] px-2 py-0.5 rounded-full font-medium"
      style={{ background: m.bg, color: m.fg }}
    >
      {m.label}
    </span>
  )
}

function ReviewTaskCard({
  task,
  acting,
  onApprove,
  onReject,
  onEdit,
}: {
  task: ReviewTask
  acting: boolean
  onApprove: () => void
  onReject: () => void
  onEdit: () => void
}) {
  const isNewJob = task.task_type === 'new_job'
  const snap = task.content_snapshot || {}

  // 任务摘要
  const summary = useMemo(() => {
    if (isNewJob) {
      return {
        title: snap.title || '(无标题)',
        sub: [snap.company_name, snap.city].filter(Boolean).join(' · ') || '—',
      }
    }
    return {
      title: `${snap.type || '变更'} · ${snap.job_id_ref || ''}`,
      sub: `幅度 ${snap.magnitude ?? '—'} · ${snap.source || ''}`,
    }
  }, [isNewJob, snap])

  const isPending = task.status === 'pending'

  return (
    <div
      className="rounded-xl p-4 border"
      style={{
        borderColor: 'var(--color-outline-variant)',
        background: 'var(--color-surface)',
      }}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          {isNewJob ? (
            <Briefcase className="h-3.5 w-3.5" style={{ color: 'var(--accent-purple)' }} />
          ) : (
            <GitBranch className="h-3.5 w-3.5" style={{ color: 'var(--accent-orange)' }} />
          )}
          <span
            className="text-[10px] px-1.5 py-0.5 rounded font-medium"
            style={{
              background: isNewJob ? 'var(--accent-purple-dim)' : 'var(--accent-orange-dim)',
              color: isNewJob ? 'var(--accent-purple)' : 'var(--accent-orange)',
            }}
          >
            {isNewJob ? '新岗位' : '能力变更'}
          </span>
          <StatusBadge status={task.status} />
          <span
            className="text-[10px] font-mono"
            style={{ color: 'var(--color-on-surface-variant)' }}
          >
            #{task.id} · {task.target_kind}/{task.target_id}
          </span>
        </div>
        <span
          className="text-[10px]"
          style={{ color: 'var(--color-on-surface-variant)' }}
        >
          {task.created_at}
        </span>
      </div>

      <div className="mb-2">
        <p className="text-sm font-semibold" style={{ color: 'var(--color-on-surface)' }}>
          {summary.title}
        </p>
        <p
          className="text-xs"
          style={{ color: 'var(--color-on-surface-variant)' }}
        >
          {summary.sub}
        </p>
      </div>

      {/* 内容快照 — new_job 显示 jd 摘要;skill_change 显示 diff */}
      {isNewJob && snap.job_description && (
        <p
          className="text-xs line-clamp-2 mb-2 px-2 py-1 rounded"
          style={{
            background: 'var(--color-surface-container)',
            color: 'var(--color-on-surface-variant)',
          }}
        >
          {String(snap.job_description).slice(0, 160)}
          {String(snap.job_description).length > 160 ? '…' : ''}
        </p>
      )}
      {!isNewJob && (snap.before || snap.after) && (
        <div
          className="text-xs mb-2 px-2 py-1 rounded grid grid-cols-2 gap-2"
          style={{
            background: 'var(--color-surface-container)',
            color: 'var(--color-on-surface-variant)',
          }}
        >
          <div>
            <span className="font-semibold">before:</span>
            <div className="line-clamp-1">{String(snap.before || '—').slice(0, 80)}</div>
          </div>
          <div>
            <span className="font-semibold">after:</span>
            <div className="line-clamp-1">{String(snap.after || '—').slice(0, 80)}</div>
          </div>
        </div>
      )}

      {/* 已审核信息 */}
      {!isPending && task.review_comment && (
        <p
          className="text-xs mb-2 px-2 py-1 rounded"
          style={{ background: 'var(--color-surface-container)', color: 'var(--color-on-surface-variant)' }}
        >
          💬 {task.review_comment}
        </p>
      )}

      {/* 操作 */}
      {isPending && (
        <div className="flex items-center gap-2 mt-2">
          <button
            disabled={acting}
            onClick={onApprove}
            className="text-xs px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1 disabled:opacity-50"
            style={{ background: 'var(--accent-green)', color: 'var(--color-on-primary)' }}
          >
            {acting ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
            通过
          </button>
          <button
            disabled={acting}
            onClick={onEdit}
            className="text-xs px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1 disabled:opacity-50"
            style={{
              background: 'var(--accent-purple)',
              color: 'var(--color-on-primary)',
            }}
          >
            <PencilLine className="h-3 w-3" /> 修改后通过
          </button>
          <button
            disabled={acting}
            onClick={onReject}
            className="text-xs px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1 disabled:opacity-50 border"
            style={{
              borderColor: 'var(--accent-red)',
              color: 'var(--accent-red)',
              background: 'var(--color-surface)',
            }}
          >
            <XCircle className="h-3 w-3" /> 驳回
          </button>
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// EditModal — 在线编辑后通过
// ────────────────────────────────────────────────────────────
function EditModal({
  task,
  onCancel,
  onSubmit,
}: {
  task: ReviewTask
  onCancel: () => void
  onSubmit: (modified: Record<string, any>, comment: string) => void
}) {
  const [json, setJsonText] = useState(() =>
    JSON.stringify(task.content_snapshot || {}, null, 2),
  )
  const [comment, setComment] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const reset = () => {
    setJsonText(JSON.stringify(task.content_snapshot || {}, null, 2))
    setErr('')
  }

  const submit = async () => {
    setErr('')
    let parsed: any
    try {
      parsed = JSON.parse(json)
    } catch (e: any) {
      setErr(`JSON 解析失败: ${e.message}`)
      return
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      setErr('内容必须是 JSON 对象')
      return
    }
    setBusy(true)
    try {
      await onSubmit(parsed, comment)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={`修改并通过 — #${task.id}`} onClose={onCancel}>
      <div className="space-y-3">
        <div>
          <label
            className="text-xs font-semibold block mb-1"
            style={{ color: 'var(--color-on-surface-variant)' }}
          >
            内容(JSON · 将覆盖 Neo4j 节点核心字段)
          </label>
          <textarea
            value={json}
            onChange={e => setJsonText(e.target.value)}
            rows={14}
            className="w-full font-mono text-xs px-3 py-2 rounded-lg outline-none"
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-outline-variant)',
              color: 'var(--color-on-surface)',
            }}
          />
          <div className="flex items-center justify-between mt-1">
            <button
              onClick={reset}
              className="text-[10px] underline"
              style={{ color: 'var(--color-primary)' }}
            >
              ↺ 还原 AI 原始内容
            </button>
            <span
              className="text-[10px]"
              style={{ color: 'var(--color-on-surface-variant)' }}
            >
              {json.length} chars
            </span>
          </div>
        </div>
        <div>
          <label
            className="text-xs font-semibold block mb-1"
            style={{ color: 'var(--color-on-surface-variant)' }}
          >
            审核备注
          </label>
          <input
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="可选 · 写明修改原因"
            className="w-full text-sm px-3 py-2 rounded-lg outline-none"
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-outline-variant)',
              color: 'var(--color-on-surface)',
            }}
          />
        </div>
        {err && (
          <p className="text-xs" style={{ color: 'var(--accent-red)' }}>
            {err}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onCancel}
            className="text-sm px-4 py-2 rounded-lg border font-medium"
            style={{
              borderColor: 'var(--color-outline-variant)',
              color: 'var(--color-on-surface-variant)',
            }}
          >
            取消
          </button>
          <button
            disabled={busy}
            onClick={submit}
            className="text-sm px-4 py-2 rounded-lg font-semibold flex items-center gap-1 disabled:opacity-50"
            style={{
              background: 'var(--accent-purple)',
              color: 'var(--color-on-primary)',
            }}
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            提交修改
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ────────────────────────────────────────────────────────────
// RejectModal — 驳回(必填理由)
// ────────────────────────────────────────────────────────────
function RejectModal({
  task,
  onCancel,
  onSubmit,
}: {
  task: ReviewTask
  onCancel: () => void
  onSubmit: (comment: string) => void
}) {
  const [comment, setComment] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = () => {
    if (!comment.trim()) {
      setErr('驳回必须填写理由')
      return
    }
    setBusy(true)
    try {
      onSubmit(comment.trim())
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={`驳回 — #${task.id}`} onClose={onCancel}>
      <div className="space-y-3">
        <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
          {task.task_type === 'new_job' ? '新岗位' : '能力变更'} ·{' '}
          {task.content_snapshot?.title || task.target_id}
        </p>
        <div>
          <label
            className="text-xs font-semibold block mb-1"
            style={{ color: 'var(--color-on-surface-variant)' }}
          >
            驳回理由(必填)
          </label>
          <textarea
            value={comment}
            onChange={e => {
              setComment(e.target.value)
              if (err) setErr('')
            }}
            rows={4}
            placeholder="例:薪资单位不清晰 / 技能标签与岗位描述不符…"
            className="w-full text-sm px-3 py-2 rounded-lg outline-none"
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-outline-variant)',
              color: 'var(--color-on-surface)',
            }}
          />
        </div>
        {err && (
          <p className="text-xs" style={{ color: 'var(--accent-red)' }}>
            {err}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onCancel}
            className="text-sm px-4 py-2 rounded-lg border font-medium"
            style={{
              borderColor: 'var(--color-outline-variant)',
              color: 'var(--color-on-surface-variant)',
            }}
          >
            取消
          </button>
          <button
            disabled={busy}
            onClick={submit}
            className="text-sm px-4 py-2 rounded-lg font-semibold flex items-center gap-1 disabled:opacity-50"
            style={{
              background: 'var(--accent-red)',
              color: 'var(--color-on-primary)',
            }}
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
            确认驳回
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ────────────────────────────────────────────────────────────
// 通用 Modal 容器
// ────────────────────────────────────────────────────────────
function Modal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto"
        style={{ background: 'var(--color-surface-container-lowest)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3
            className="text-base font-bold"
            style={{ color: 'var(--color-on-surface)' }}
          >
            {title}
          </h3>
          <button
            onClick={onClose}
            className="text-sm"
            style={{ color: 'var(--color-on-surface-variant)' }}
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}