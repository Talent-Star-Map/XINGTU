import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowRight, Loader2, Users, Building2, Briefcase, Target,
  ShieldCheck, BookOpen, Cpu, Shield, Database, Activity,
  Wrench, type LucideIcon,
} from 'lucide-react'

// ─── token 注入(与其他 admin 页面一致) ────────────────────────────
const getToken = () => localStorage.getItem('xingtu_token') || ''
const withToken = (url: string) =>
  `${url}${url.includes('?') ? '&' : '?'}token=${getToken()}`

// ─── 类型 ──────────────────────────────────────────────────────────
interface AdminStats {
  jobseeker_count: number
  enterprise_count: number
  job_count: number
  match_count: number
  admin_count: number
}

interface JobseekerItem {
  id: number; username: string; real_name: string
  target_position: string; created_at: string
}
interface EnterpriseItem {
  id: number; company_name: string; industry: string
  verified: number; created_at: string
}
interface JobItem {
  id: number; title: string; enterprise_name: string
  status: string; created_at: string
}

type RecentItem =
  | { type: 'jobseeker'; ts: number; data: JobseekerItem }
  | { type: 'enterprise'; ts: number; data: EnterpriseItem }
  | { type: 'job';      ts: number; data: JobItem }

interface LLMConfigSummary {
  mock_mode: boolean
  global_enabled: boolean
  resolved: {
    strong: { provider: string; model: string }
    fast:   { provider: string; model: string }
    vision: { provider: string; model: string }
  }
}

interface Page { key: 'dashboard'|'jobseekers'|'enterprises'|'jobs'|'resources'|'models'|'quality' }

interface Props {
  onNav: (p: Page['key']) => void
}

// ─── 常量 ──────────────────────────────────────────────────────────
const METRIC_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b']

// 类型标签样式 + 图标(最近动态列表里用)
const TYPE_META: Record<RecentItem['type'], { label: string; icon: LucideIcon; bg: string; fg: string }> = {
  jobseeker: { label: '求职者', icon: Users,     bg: 'rgba(59,130,246,0.12)',  fg: '#3b82f6' },
  enterprise: { label: '企业',   icon: Building2, bg: 'rgba(139,92,246,0.12)', fg: '#8b5cf6' },
  job:        { label: '岗位',   icon: Briefcase, bg: 'rgba(16,185,129,0.12)', fg: '#10b981' },
}

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  active:  { label: '招聘中', color: 'var(--accent-green)',      bg: 'var(--accent-green-dim)' },
  draft:   { label: '草稿',   color: 'var(--accent-orange)',     bg: 'var(--accent-orange-dim)' },
  closed:  { label: '已关闭', color: 'var(--color-on-surface-variant)', bg: 'var(--color-surface-container-high)' },
}

// 6 个已有功能 + 1 个占位
const QUICK_ACTIONS: Array<{
  label: string; desc: string; icon: LucideIcon; color: string
  page?: Page['key']; placeholder?: string
}> = [
  { label: '求职者管理', desc: '查看/重置/删除账号',     icon: Users,        color: '#3b82f6', page: 'jobseekers' },
  { label: '入驻企业管理', desc: '审核企业资质',           icon: Building2,    color: '#8b5cf6', page: 'enterprises' },
  { label: '职位管理',     desc: '维护平台岗位',           icon: Briefcase,    color: '#10b981', page: 'jobs' },
  { label: '学习资源管理', desc: '技能学习资料维护',       icon: BookOpen,     color: '#f59e0b', page: 'resources' },
  { label: '模型配置',     desc: 'LLM 路由层 + Mock 开关', icon: Cpu,          color: '#06b6d4', page: 'models' },
  { label: '质检管理',     desc: '求职/企业端已下线,仅管理员可见', icon: Shield, color: '#ef4444', page: 'quality' },
  { label: '数据治理大屏', desc: '后续 PR 接入',           icon: Database,     color: '#94a3b8', placeholder: '数据治理大屏开发中,后续 PR 接入' },
]

// ─── 工具 ──────────────────────────────────────────────────────────
function fmtDate(input?: string): string {
  if (!input) return ''
  // 后端给的是 "YYYY-MM-DD HH:MM" 格式;解析成本地时间再算相对差
  const norm = input.replace(/-/g, '/')
  const d = new Date(norm)
  if (isNaN(d.getTime())) return input
  const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 60)        return '刚刚'
  if (diff < 3600)      return `${Math.floor(diff / 60)} 分钟前`
  if (diff < 86400)     return `${Math.floor(diff / 3600)} 小时前`
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} 天前`
  return d.toLocaleDateString('zh-CN')
}

function parseTs(s: string): number {
  const d = new Date(s.replace(/-/g, '/'))
  return isNaN(d.getTime()) ? 0 : d.getTime()
}

// ─── 组件 ──────────────────────────────────────────────────────────
export default function AdminDashboard({ onNav }: Props) {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [recent, setRecent] = useState<RecentItem[]>([])
  const [resourcesCount, setResourcesCount] = useState<number | null>(null)
  const [llm, setLLM] = useState<LLMConfigSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshAt, setRefreshAt] = useState<Date>(new Date())

  const load = async () => {
    setLoading(true); setError('')
    try {
      // 并发 5 个请求:核心 stats + 3 个最近列表 + 系统状态
      const [rStats, rJs, rEnt, rJobs, rRes, rLLM] = await Promise.all([
        fetch(withToken('/api/admin/stats')).then(r => r.json()),
        fetch(withToken('/api/admin/jobseekers?size=5&page=1')).then(r => r.json()),
        fetch(withToken('/api/admin/enterprises?size=5&page=1')).then(r => r.json()),
        fetch(withToken('/api/admin/jobs?size=5&page=1')).then(r => r.json()),
        fetch(withToken('/api/admin/resources?size=1&page=1')).then(r => r.json()),
        fetch(withToken('/api/admin/llm-config')).then(r => r.json()),
      ])

      if (rStats.success) setStats(rStats.data)
      else throw new Error(rStats.error?.message || 'stats 加载失败')

      // 合并 3 类最近项,按时间倒序
      const items: RecentItem[] = []
      if (rJs.success) {
        for (const x of rJs.data.list as JobseekerItem[]) {
          items.push({ type: 'jobseeker', ts: parseTs(x.created_at), data: x })
        }
      }
      if (rEnt.success) {
        for (const x of rEnt.data.list as EnterpriseItem[]) {
          items.push({ type: 'enterprise', ts: parseTs(x.created_at), data: x })
        }
      }
      if (rJobs.success) {
        for (const x of rJobs.data.list as JobItem[]) {
          items.push({ type: 'job', ts: parseTs(x.created_at), data: x })
        }
      }
      items.sort((a, b) => b.ts - a.ts)
      setRecent(items.slice(0, 10))

      if (rRes.success) setResourcesCount(rRes.data.total ?? 0)
      if (rLLM.success) setLLM(rLLM.data)

      setRefreshAt(new Date())
    } catch (e: any) {
      setError(e?.message || '网络错误')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  // ── 加载/错误视图 ──────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full gap-2" style={{ color: 'var(--color-on-surface-variant)' }}>
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">加载中</span>
      </div>
    )
  }
  if (error) {
    return (
      <div className="p-8">
        <div className="rounded-lg border px-3 py-2 text-xs flex items-center justify-between"
          style={{ borderColor: 'var(--accent-red)', background: 'var(--accent-red-dim)', color: 'var(--accent-red-strong)' }}>
          <span>{error}</span>
          <button onClick={load} className="underline">重试</button>
        </div>
      </div>
    )
  }
  if (!stats) return null

  // ── 指标卡(4 张) ────────────────────────────────────────────────
  const metrics = [
    { label: '求职者总数', value: stats.jobseeker_count, icon: Users },
    { label: '企业总数',   value: stats.enterprise_count, icon: Building2 },
    { label: '岗位总数',   value: stats.job_count,        icon: Briefcase },
    { label: '匹配记录',   value: stats.match_count,      icon: Target },
  ]

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      {/* ── 顶部欢迎横幅(绿色主题,对齐 AdminShell) ─────────────── */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl p-6"
        style={{ background: 'linear-gradient(135deg, var(--accent-green-dim) 0%, var(--color-surface-container-lowest) 100%)' }}>
        <div className="absolute top-0 right-0 w-48 h-48 rounded-full blur-3xl opacity-30" style={{ background: 'var(--accent-green)' }} />
        <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full blur-3xl opacity-20" style={{ background: 'var(--accent-green)' }} />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <Wrench className="h-4 w-4" style={{ color: 'var(--accent-green)' }} />
            <span className="text-xs font-medium" style={{ color: 'var(--accent-green)' }}>管理员工作台</span>
          </div>
          <h1 className="text-2xl font-extrabold" style={{ color: 'var(--color-on-surface)' }}>
            欢迎回来,<span style={{ color: 'var(--accent-green)' }}>管理员</span>
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>
            平台总览 · 数据更新于 {refreshAt.toLocaleTimeString('zh-CN')}
          </p>
        </div>
      </motion.div>

      {/* ── 4 张核心指标卡 ────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-4">
        {metrics.map((m, i) => {
          const Icon = m.icon
          const color = METRIC_COLORS[i]
          return (
            <motion.div key={m.label}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              whileHover={{ scale: 1.02, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
              className="rounded-2xl border p-5 shadow-sm"
              style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium" style={{ color: 'var(--color-on-surface-variant)' }}>{m.label}</span>
                <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ background: `${color}15` }}>
                  <Icon className="h-4 w-4" style={{ color }} />
                </div>
              </div>
              <p className="text-3xl font-bold tabular-nums" style={{ color }}>{m.value.toLocaleString()}</p>
              <div className="mt-3 h-1 rounded-full overflow-hidden" style={{ background: 'var(--color-surface-container-high)' }}>
                <motion.div className="h-full rounded-full"
                  style={{ background: `linear-gradient(90deg, ${color}, ${color}aa)` }}
                  initial={{ width: 0 }} animate={{ width: '60%' }} transition={{ duration: 0.8, delay: i * 0.1 }} />
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* ── 快捷入口(7 张) ────────────────────────────────────────── */}
      <div>
        <h2 className="text-sm font-bold mb-3" style={{ color: 'var(--color-on-surface)' }}>快捷入口</h2>
        <div className="grid grid-cols-4 gap-4">
          {QUICK_ACTIONS.map((item, i) => {
            const Icon = item.icon
            const handle = () => {
              if (item.page) onNav(item.page)
              else if (item.placeholder) alert(item.placeholder) // 占位功能先 alert,后续接 toast 系统
            }
            return (
              <motion.button key={item.label}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.05 }}
                whileHover={{ scale: 1.02, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                whileTap={{ scale: 0.98 }}
                onClick={handle}
                className="rounded-2xl border p-5 text-left transition-all shadow-sm"
                style={{
                  borderColor: 'var(--color-outline-variant)',
                  background: 'var(--color-surface-container-lowest)',
                  opacity: item.page ? 1 : 0.65,
                }}>
                <div className="h-10 w-10 rounded-xl flex items-center justify-center mb-3" style={{ background: `${item.color}15` }}>
                  <Icon className="h-5 w-5" style={{ color: item.color }} />
                </div>
                <p className="text-sm font-bold" style={{ color: 'var(--color-on-surface)' }}>{item.label}</p>
                <p className="text-xs mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>{item.desc}</p>
              </motion.button>
            )
          })}
        </div>
      </div>

      {/* ── 底部双栏:最近动态 + 系统状态 ─────────────────────────── */}
      <div className="grid grid-cols-5 gap-5">
        {/* 左:最近动态(合并 3 类) */}
        <div className="col-span-3 rounded-2xl border p-5 shadow-sm"
          style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--color-on-surface)' }}>
              <Activity className="h-4 w-4" style={{ color: 'var(--accent-green)' }} />
              最近动态
            </h2>
            <button onClick={load}
              className="flex items-center gap-1 text-xs font-medium transition-colors hover:opacity-80"
              style={{ color: 'var(--accent-green)' }}>
              刷新 <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
          {recent.length > 0 ? (
            <div className="space-y-2">
              {recent.map((item, i) => {
                const meta = TYPE_META[item.type]
                const Icon = meta.icon
                let title = ''
                let subtitle = ''
                let onClick: (() => void) | undefined
                let extraTag: { label: string; color: string; bg: string } | null = null

                if (item.type === 'jobseeker') {
                  title = item.data.real_name || item.data.username || `#${item.data.id}`
                  subtitle = item.data.target_position || '未填写目标岗位'
                  onClick = () => onNav('jobseekers')
                } else if (item.type === 'enterprise') {
                  title = item.data.company_name || `#${item.data.id}`
                  subtitle = item.data.industry
                  onClick = () => onNav('enterprises')
                  if (item.data.verified) {
                    extraTag = { label: '已认证', color: 'var(--accent-green)', bg: 'var(--accent-green-dim)' }
                  }
                } else {
                  title = item.data.title
                  subtitle = item.data.enterprise_name
                  onClick = () => onNav('jobs')
                  const st = STATUS_MAP[item.data.status] || STATUS_MAP.active
                  extraTag = { label: st.label, color: st.color, bg: st.bg }
                }

                return (
                  <motion.div key={`${item.type}-${item.data.id}`}
                    initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 + i * 0.04 }}
                    whileHover={{ scale: 1.01, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
                    onClick={onClick}
                    className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all"
                    style={{ background: 'var(--color-surface)' }}>
                    {/* 类型图标方块 */}
                    <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: meta.bg }}>
                      <Icon className="h-4 w-4" style={{ color: meta.fg }} />
                    </div>
                    {/* 类型 tag + 标题 + 副标题 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: meta.bg, color: meta.fg }}>{meta.label}</span>
                        <span className="text-sm font-medium truncate" style={{ color: 'var(--color-on-surface)' }}>{title}</span>
                        {extraTag && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0" style={{ background: extraTag.bg, color: extraTag.color }}>{extraTag.label}</span>
                        )}
                      </div>
                      {subtitle && (
                        <p className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--color-on-surface-variant)' }}>{subtitle}</p>
                      )}
                    </div>
                    {/* 时间 */}
                    <span className="text-[11px] shrink-0 tabular-nums" style={{ color: 'var(--color-on-surface-variant)' }}>
                      {fmtDate(item.data.created_at)}
                    </span>
                  </motion.div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm py-8 text-center" style={{ color: 'var(--color-on-surface-variant)' }}>暂无动态</p>
          )}
        </div>

        {/* 右:系统状态 */}
        <div className="col-span-2 rounded-2xl border p-5 shadow-sm"
          style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
          <h2 className="text-sm font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--color-on-surface)' }}>
            <ShieldCheck className="h-4 w-4" style={{ color: 'var(--accent-green)' }} />
            系统状态
          </h2>
          <div className="space-y-4">
            <StatusRow
              label="学习资源"
              value={resourcesCount !== null ? `${resourcesCount} 项` : '加载中…'}
              color="#f59e0b"
            />
            <StatusRow
              label="管理员账号"
              value={`${stats.admin_count} 个`}
              color="#3b82f6"
            />
            <StatusRow
              label="LLM 配置"
              value={llm
                ? (llm.mock_mode ? 'Mock 模式' : (llm.global_enabled ? '已启用' : '未启用'))
                : '加载中…'}
              color={llm?.mock_mode ? '#94a3b8' : (llm?.global_enabled ? '#10b981' : '#ef4444')}
            />
            {llm && (
              <div className="text-[11px] pt-2 border-t space-y-1" style={{ borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface-variant)' }}>
                <p>· 强模型: <span style={{ color: 'var(--color-on-surface)' }}>{llm.resolved.strong.model || '未配置'}</span></p>
                <p>· 轻模型: <span style={{ color: 'var(--color-on-surface)' }}>{llm.resolved.fast.model || '未配置'}</span></p>
                <p>· 视觉模型: <span style={{ color: 'var(--color-on-surface)' }}>{llm.resolved.vision.model || '未配置'}</span></p>
              </div>
            )}
            <div className="pt-3 border-t" style={{ borderColor: 'var(--color-outline-variant)' }}>
              <p className="text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>
                上次刷新: <span className="tabular-nums" style={{ color: 'var(--color-on-surface)' }}>{refreshAt.toLocaleTimeString('zh-CN')}</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── 子组件 ────────────────────────────────────────────────────────
function StatusRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>{label}</span>
      <span className="text-sm font-bold tabular-nums" style={{ color }}>{value}</span>
    </div>
  )
}
