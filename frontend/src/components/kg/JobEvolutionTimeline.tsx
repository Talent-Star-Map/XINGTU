/**
 * JobEvolutionTimeline — 岗位动态演化(三大维度,数据来自真实后端)
 *
 * 主视图(可切换 Tab):
 *   1. **技能变化**(主) — 候选新增/缺失/修改次数随时间变化(堆叠柱)
 *   2. **变更事件**(主) — 真实 job_changes 流:education/salary/description_change + 原因
 *   3. **薪资**(次)     — 同一岗位多次快照的薪资时序
 *
 * 数据源:
 *   - /api/kg/jobs/{id}/evolution?metric=salary_avg  → 薪资 tab
 *   - /api/kg/jobs/{id}/changes                     → 技能 + 事件 tab
 *   - /api/kg/jobs/{id}                             → 当前技能快照
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import { TrendingUp, GitBranch, Wallet, Loader2, AlertCircle, Calendar, ArrowRight } from 'lucide-react'
import { kgApi } from './api'

type Tab = 'skill' | 'event' | 'salary'

interface JobChange {
  change_id: string
  date: string
  type: string                    // education_change / salary_change / description_change / ...
  magnitude: number
  before: Record<string, unknown>
  after: Record<string, unknown>
  reason: string
  reason_source?: string
}

interface SalaryPoint { date: string; value: number; title?: string; source?: string }

interface Props {
  jobId?: number
  jobTitle?: string
  height?: number
}

// ── 类型中文映射(只展示 backend 真实返回的 type) ──
const TYPE_LABEL: Record<string, string> = {
  education_change: '学历要求',
  salary_change:    '薪资区间',
  description_change: '描述变更',
  skill_change:     '技能要求',
  title_change:     '岗位名称',
}

// ── 配色 ──
const LINE_COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6']
const EVENT_COLOR: Record<string, string> = {
  education_change: '#3b82f6',
  salary_change:    '#10b981',
  description_change: '#8b5cf6',
  skill_change:     '#f59e0b',
  title_change:     '#ef4444',
}

// ── 工具:把 ISO 时间聚合成按日 bucket(同日多条合并) ──
function bucketByDay<T extends { date: string }>(items: T[]): T[] {
  const map = new Map<string, T>()
  items.forEach(it => {
    const k = it.date.slice(0, 10)
    if (!map.has(k)) map.set(k, it)
  })
  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date))
}

export default function JobEvolutionTimeline({ jobId, jobTitle, height = 220 }: Props) {
  const [tab, setTab] = useState<Tab>('skill')

  const [salaryData, setSalaryData] = useState<SalaryPoint[]>([])
  const [changes, setChanges]       = useState<JobChange[]>([])
  const [skillsNow, setSkillsNow]   = useState<string[]>([])
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState<string | null>(null)

  useEffect(() => {
    if (!jobId) { setSalaryData([]); setChanges([]); setSkillsNow([]); return }
    setLoading(true); setError(null)
    Promise.all([
      kgApi.jobEvolution(jobId, 'salary_avg').catch(() => []),
      kgApi.jobChanges(jobId).catch(() => []),
      kgApi.jobDetail(jobId).catch(() => null),
    ]).then(([evo, ch, detail]) => {
      // 薪资:按日 bucket
      const seen = new Set<string>()
      const evoDedup: SalaryPoint[] = []
      ;((evo as SalaryPoint[]) || []).forEach(p => {
        const k = p.date.slice(0, 10) + '|' + p.value
        if (!seen.has(k)) { seen.add(k); evoDedup.push(p) }
      })
      evoDedup.sort((a, b) => a.date.localeCompare(b.date))
      setSalaryData(evoDedup)
      setChanges((ch as JobChange[]) || [])
      const tags: string[] = (detail as any)?.skill_tags || (detail as any)?.skills || []
      setSkillsNow(tags)
    }).catch(e => setError(e?.message || '加载失败'))
      .finally(() => setLoading(false))
  }, [jobId])

  if (!jobId) {
    return (
      <div className="flex items-center justify-center h-full text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
        <span>选择一个岗位后展示演化轨迹</span>
      </div>
    )
  }

  const tabs: { key: Tab; label: string; icon: any; primary: boolean }[] = [
    { key: 'skill',  label: '技能变化',     icon: TrendingUp, primary: true  },
    { key: 'event',  label: '变更事件',     icon: GitBranch,  primary: true  },
    { key: 'salary', label: '薪资',         icon: Wallet,     primary: false },
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Header: 标题 + Tabs */}
      <div className="flex items-center justify-between gap-2 px-3 py-1.5 border-b"
           style={{ borderColor: 'var(--color-outline-variant)' }}>
        <div className="min-w-0">
          <div className="text-xs font-semibold truncate" style={{ color: 'var(--color-on-surface)' }}>
            {jobTitle || `岗位 #${jobId}`}
          </div>
          <div className="text-[10px]" style={{ color: 'var(--color-on-surface-variant)' }}>
            已记录 {changes.length} 次需求变化
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {tabs.map(t => {
            const Icon = t.icon
            const active = tab === t.key
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors"
                style={{
                  background: active ? 'var(--color-primary)' : 'transparent',
                  color: active ? 'var(--color-on-primary)' : 'var(--color-on-surface-variant)',
                }}>
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
                {!t.primary && <span className="text-[9px] opacity-70 ml-0.5">·次</span>}
              </button>
            )
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-2 min-h-0 overflow-hidden">
        {loading && (
          <div className="flex items-center justify-center h-full text-xs"
               style={{ color: 'var(--color-on-surface-variant)' }}>
            <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> 正在加载岗位动态…
          </div>
        )}
        {error && !loading && (
          <div className="flex items-center justify-center h-full text-xs"
               style={{ color: 'var(--accent-red)' }}>
            <AlertCircle className="w-4 h-4 mr-1.5" /> {error}
          </div>
        )}
        {!loading && !error && tab === 'skill' && (
          <SkillChangeView changes={changes} skillsNow={skillsNow} height={height} />
        )}
        {!loading && !error && tab === 'event' && (
          <EventListView changes={changes} height={height} />
        )}
        {!loading && !error && tab === 'salary' && (
          <SalaryView data={salaryData} height={height} />
        )}
      </div>
    </div>
  )
}

// ─── Tab 1: 技能变化(按日期聚合 added/removed/modified 计数) ───
function SkillChangeView({ changes, skillsNow, height }: { changes: JobChange[]; skillsNow: string[]; height: number }) {
  // 按类型筛选 skill 类型 + 把 modified/added/removed 计数从其他 change 里提取
  // 简化:对所有 change,按日期聚合 magnitude(代表"变化强度")
  const skillChanges = changes.filter(c => c.type === 'skill_change' || c.type === 'description_change')
  const series = useMemo(() => {
    if (skillChanges.length === 0) {
      // 没有 skill_change 类:用所有 change 的 magnitude 当作"变化强度"
      return bucketByDay(changes).map(c => ({
        date: c.date.slice(0, 10),
        magnitude: c.magnitude,
      }))
    }
    return bucketByDay(skillChanges).map(c => ({ date: c.date.slice(0, 10), magnitude: c.magnitude }))
  }, [changes, skillChanges])

  return (
    <div className="flex flex-col h-full">
      <div className="text-[10px] mb-1 px-1" style={{ color: 'var(--color-on-surface-variant)' }}>
        当前 {skillsNow.length} 项技能 · {changes.length} 条历史变更
      </div>
      <div className="flex-1 grid grid-cols-2 gap-2 min-h-0">
        {/* 左:技能标签云 */}
        <div className="rounded-lg p-2 overflow-y-auto"
             style={{ background: 'var(--color-surface-container-low)' }}>
          <div className="text-[10px] font-semibold mb-1.5" style={{ color: 'var(--color-on-surface-variant)' }}>
            当前技能 ({skillsNow.length})
          </div>
          {skillsNow.length === 0 ? (
            <div className="text-[10px] italic" style={{ color: 'var(--color-on-surface-variant)' }}>
              该岗位暂无结构化技能
            </div>
          ) : (
            <div className="flex flex-wrap gap-1">
              {skillsNow.map(s => (
                <span key={s} className="text-[10px] px-2 py-0.5 rounded-md"
                      style={{ background: 'var(--accent-cyan-dim)', color: 'var(--color-primary)', border: '1px solid var(--color-primary)' }}>
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>
        {/* 右:变更强度时序 */}
        <div className="min-h-0">
          <ResponsiveContainer width="100%" height={height}>
            <BarChart data={series} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
              <XAxis dataKey="date" tickFormatter={d => d?.slice(5)} tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 9 }} />
              <Tooltip
                contentStyle={{ fontSize: 11, background: 'var(--color-surface)', border: '1px solid var(--color-outline)' }}
                labelFormatter={d => d} />
              <Bar dataKey="magnitude" fill="#3b82f6" radius={[3, 3, 0, 0]} name="变更强度" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

// ─── Tab 2: 变更事件列表(真实 job_changes,有 before/after + reason) ───
function EventListView({ changes, height }: { changes: JobChange[]; height: number }) {
  if (changes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-xs italic"
           style={{ color: 'var(--color-on-surface-variant)' }}>
        暂无变更记录
      </div>
    )
  }
  const sorted = [...changes].sort((a, b) => b.date.localeCompare(a.date))
  return (
    <div className="flex flex-col h-full">
      <div className="text-[10px] mb-1 px-1" style={{ color: 'var(--color-on-surface-variant)' }}>
        {changes.length} 条真实变更事件(按时间倒序)
      </div>
      <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
        {sorted.map(c => {
          const color = EVENT_COLOR[c.type] || '#64748b'
          const label = TYPE_LABEL[c.type] || c.type
          return (
            <div key={c.change_id} className="rounded-lg p-2 text-[11px]"
                 style={{ background: 'var(--color-surface-container-low)', borderLeft: `3px solid ${color}` }}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold" style={{ color }}>{label}</span>
                <span className="text-[10px] flex items-center gap-1"
                      style={{ color: 'var(--color-on-surface-variant)' }}>
                  <Calendar className="w-3 h-3" />
                  {c.date.slice(0, 10)}
                  <span className="ml-1 px-1 rounded" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-outline-variant)' }}>
                    |Δ|={c.magnitude}
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-2 text-[10px] mb-1" style={{ color: 'var(--color-on-surface-variant)' }}>
                <span className="px-1.5 py-0.5 rounded font-mono"
                      style={{ background: 'var(--accent-red-dim)', color: 'var(--accent-red)' }}>
                  {JSON.stringify(c.before)}
                </span>
                <ArrowRight className="w-3 h-3" />
                <span className="px-1.5 py-0.5 rounded font-mono"
                      style={{ background: 'var(--accent-green-dim)', color: 'var(--accent-green)' }}>
                  {JSON.stringify(c.after)}
                </span>
              </div>
              {c.reason && (
                <div className="text-[10px] leading-relaxed"
                     style={{ color: 'var(--color-on-surface-variant)' }}>
                  <span className="font-semibold mr-1">原因:</span>{c.reason}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Tab 3: 薪资时序(单线,真实 evolution 数据) ───
function SalaryView({ data, height }: { data: SalaryPoint[]; height: number }) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-xs italic"
           style={{ color: 'var(--color-on-surface-variant)' }}>
        该岗位暂无薪资快照数据
      </div>
    )
  }
  // 按日 bucket 求均值,避免同一密一天内多条同价线重叠
  const series = useMemo(() => {
    const m = new Map<string, { sum: number; cnt: number; title?: string; source?: string }>()
    data.forEach(p => {
      const k = p.date.slice(0, 10)
      const cur = m.get(k) || { sum: 0, cnt: 0, title: p.title, source: p.source }
      cur.sum += p.value; cur.cnt += 1
      m.set(k, cur)
    })
    return Array.from(m.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, v]) => ({ date, value: Math.round(v.sum / v.cnt), title: v.title, source: v.source }))
  }, [data])
  // 转为 K(千元)展示更易读
  const dataK = series.map(s => ({ ...s, valueK: +(s.value / 1000).toFixed(1) }))
  return (
    <div className="flex flex-col h-full">
      <div className="text-[10px] mb-1 px-1" style={{ color: 'var(--color-on-surface-variant)' }}>
        {data.length} 条原始快照 · 按日聚合后 {dataK.length} 个数据点 · 单位 K(千)
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={dataK} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
          <XAxis dataKey="date" tickFormatter={d => d?.slice(5)} tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} unit="K" />
          <Tooltip
            contentStyle={{ fontSize: 11, background: 'var(--color-surface)', border: '1px solid var(--color-outline)' }}
            labelFormatter={d => d}
            formatter={(v: any, _: any, p: any) => [`${v}K (¥${(p.payload.value).toLocaleString()})`, '平均薪资']} />
          <Line type="monotone" dataKey="valueK" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} name="薪资(K)" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}