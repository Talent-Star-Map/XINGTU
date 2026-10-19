/** 管理端通用图表组件
 *
 * 全部基于 recharts（项目已有依赖，不额外引入 echarts）。
 * 颜色统一走 CSS 变量，亮色/暗色主题自动跟随，不在图表里写死黑白。
 */
import type { ReactNode } from 'react'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, Cell, PieChart, Pie,
} from 'recharts'
import { Inbox } from 'lucide-react'

export interface NameValue {
  name: string
  value: number
}

const AXIS = { fontSize: 10, fill: 'var(--color-on-surface-variant)' }
const GRID = 'var(--color-outline-variant)'

export function ChartCard({ title, subtitle, action, children, height = 200 }: {
  title: string
  subtitle?: string
  action?: ReactNode
  children: ReactNode
  height?: number
}) {
  return (
    <div className="rounded-2xl border p-4 shadow-sm flex flex-col"
      style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <p className="text-sm font-bold" style={{ color: 'var(--color-on-surface)' }}>{title}</p>
          {subtitle && <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>{subtitle}</p>}
        </div>
        {action}
      </div>
      <div style={{ height }}>{children}</div>
    </div>
  )
}

export function ChartEmpty({ text = '暂无数据' }: { text?: string }) {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-1.5">
      <Inbox className="h-6 w-6 opacity-30" style={{ color: 'var(--color-on-surface-variant)' }} />
      <p className="text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>{text}</p>
    </div>
  )
}

/* ── 折线/面积：新增趋势 ───────────────────────────────── */
export interface TrendSeries { key: string; name: string; color: string }

export function TrendChart({ data, series }: {
  data: Record<string, any>[]
  series: TrendSeries[]
}) {
  const empty = !data.length || series.every(s => data.every(d => !d[s.key]))
  if (empty) return <ChartEmpty text="这段时间没有新增数据" />
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
        <defs>
          {series.map(s => (
            <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity={0.32} />
              <stop offset="100%" stopColor={s.color} stopOpacity={0.02} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="date" tick={AXIS} tickLine={false} axisLine={false}
          tickFormatter={(v: string) => String(v).slice(5)} minTickGap={16} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} width={34} />
        <Tooltip
          contentStyle={{
            fontSize: 11, borderRadius: 10,
            background: 'var(--color-surface-container-lowest)',
            border: '1px solid var(--color-outline-variant)',
            color: 'var(--color-on-surface)',
          }}
          labelStyle={{ color: 'var(--color-on-surface-variant)', fontSize: 10 }}
        />
        {series.map(s => (
          <Area key={s.key} type="monotone" dataKey={s.key} name={s.name}
            stroke={s.color} strokeWidth={1.8} fill={`url(#grad-${s.key})`} dot={false} />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  )
}

/* ── 横向条形：城市/技能/来源排行 ─────────────────────── */
export function RankBars({ data, color = 'var(--accent-blue, #3b82f6)', unit = '' }: {
  data: NameValue[]
  color?: string
  unit?: string
}) {
  if (!data.length) return <ChartEmpty />
  const max = Math.max(...data.map(d => d.value), 1)
  return (
    <div className="h-full overflow-auto space-y-2 pr-1">
      {data.map((d, i) => (
        <div key={d.name} className="flex items-center gap-2">
          <span className="w-4 shrink-0 text-[10px] tabular-nums" style={{ color: 'var(--color-on-surface-variant)' }}>{i + 1}</span>
          <span className="w-20 shrink-0 truncate text-[11px]" style={{ color: 'var(--color-on-surface)' }} title={d.name}>{d.name}</span>
          <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--color-surface-container-high)' }}>
            <div className="h-full rounded-full" style={{ width: `${(d.value / max) * 100}%`, background: color }} />
          </div>
          <span className="w-12 shrink-0 text-right text-[10px] tabular-nums whitespace-nowrap"
            style={{ color: 'var(--color-on-surface-variant)' }}>
            {d.value}{unit}
          </span>
        </div>
      ))}
    </div>
  )
}

/* ── 柱状：薪资区间 ───────────────────────────────────── */
export function ColumnChart({ data, color = '#8b5cf6' }: { data: NameValue[]; color?: string }) {
  if (!data.length || data.every(d => !d.value)) return <ChartEmpty />
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 6, right: 6, left: -24, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="name" tick={{ ...AXIS, fontSize: 9 }} tickLine={false} axisLine={false} interval={0} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} width={34} />
        <Tooltip
          cursor={{ fill: 'var(--color-surface-container)' }}
          contentStyle={{
            fontSize: 11, borderRadius: 10,
            background: 'var(--color-surface-container-lowest)',
            border: '1px solid var(--color-outline-variant)',
            color: 'var(--color-on-surface)',
          }}
        />
        <Bar dataKey="value" name="岗位数" fill={color} radius={[4, 4, 0, 0]} maxBarSize={38} />
      </BarChart>
    </ResponsiveContainer>
  )
}

/* ── 环形：学历/状态占比 ───────────────────────────────── */
export const DONUT_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#94a3b8']

export function DonutChart({ data, unit = '' }: { data: NameValue[]; unit?: string }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  if (!total) return <ChartEmpty />
  return (
    <div className="h-full flex items-center gap-2">
      <div className="h-full" style={{ width: '55%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="85%"
              paddingAngle={2} stroke="none">
              {data.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
            </Pie>
            <Tooltip
              contentStyle={{
                fontSize: 11, borderRadius: 10,
                background: 'var(--color-surface-container-lowest)',
                border: '1px solid var(--color-outline-variant)',
                color: 'var(--color-on-surface)',
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="flex-1 space-y-1 min-w-0">
        {data.slice(0, 6).map((d, i) => (
          <li key={d.name} className="flex items-center gap-1.5 text-[10px]">
            <span className="h-2 w-2 rounded-sm shrink-0" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
            <span className="truncate flex-1" style={{ color: 'var(--color-on-surface)' }}>{d.name}</span>
            <span className="tabular-nums shrink-0" style={{ color: 'var(--color-on-surface-variant)' }}>
              {Math.round((d.value / total) * 100)}%{unit}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ── 漏斗：各环节规模 ─────────────────────────────────── */
export function FunnelBars({ steps }: {
  steps: { label: string; value: number; ratio?: number; hint?: string }[]
}) {
  if (!steps.length || steps.every(s => !s.value)) return <ChartEmpty text="还没有用户行为数据" />
  const max = Math.max(...steps.map(s => s.value), 1)
  return (
    <div className="h-full flex flex-col justify-center gap-2.5">
      {steps.map((s, i) => (
        <div key={s.label}>
          <div className="flex items-center justify-between text-[11px] mb-1">
            <span style={{ color: 'var(--color-on-surface)' }}>{i + 1}. {s.label}</span>
            <span className="tabular-nums" style={{ color: 'var(--color-on-surface-variant)' }}>
              {s.value}{s.ratio !== undefined ? ` · ${s.ratio}%` : ''}
            </span>
          </div>
          <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--color-surface-container-high)' }}>
            <div className="h-full rounded-full transition-all"
              style={{
                width: `${Math.max((s.value / max) * 100, s.value ? 3 : 0)}%`,
                background: DONUT_COLORS[i % DONUT_COLORS.length],
              }} />
          </div>
        </div>
      ))}
    </div>
  )
}
