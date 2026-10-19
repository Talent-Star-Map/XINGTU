import { Fragment, type ReactNode } from 'react'
import { Loader2, Inbox } from 'lucide-react'

export const DATA_COLORS = [
  '#6d5efc', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#14b8a6', '#f97316', '#ec4899', '#64748b',
]

export const QUADRANT_COLORS: Record<string, string> = {
  高需求高溢价: '#10b981',
  市场标配: '#0ea5e9',
  小众溢价: '#f59e0b',
  长尾技能: '#94a3b8',
}

export function BoardCard({
  index, title, subtitle, right, children, className = '',
}: {
  index?: string
  title: string
  subtitle?: string
  right?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={`rounded-2xl border p-5 shadow-sm ${className}`}
      style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}
    >
      <header className="mb-4 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          {index && (
            <span className="mt-0.5 text-[10px] font-black tabular-nums tracking-widest" style={{ color: 'var(--color-primary)' }}>
              {index}
            </span>
          )}
          <div className="min-w-0">
            <h2 className="text-sm font-bold" style={{ color: 'var(--color-on-surface)' }}>{title}</h2>
            {subtitle && (
              <p className="mt-1 text-[11px] leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>{subtitle}</p>
            )}
          </div>
        </div>
        {right && <div className="shrink-0">{right}</div>}
      </header>
      {children}
    </section>
  )
}

export function KpiCard({
  label, value, suffix, hint, accent, icon,
}: {
  label: string
  value: string | number
  suffix?: string
  hint?: string
  accent: string
  icon?: ReactNode
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border p-4 shadow-sm"
      style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
      <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full opacity-[0.08]" style={{ background: accent }} />
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium" style={{ color: 'var(--color-on-surface-variant)' }}>{label}</span>
        {icon && <span style={{ color: accent }}>{icon}</span>}
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-2xl font-extrabold tabular-nums tracking-tight" style={{ color: 'var(--color-on-surface)' }}>{value}</span>
        {suffix && <span className="text-xs font-medium" style={{ color: 'var(--color-on-surface-variant)' }}>{suffix}</span>}
      </div>
      {hint && <p className="mt-1 text-[10px] leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>{hint}</p>}
    </div>
  )
}

export function TipShell({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border px-3 py-2 text-[11px] shadow-xl"
      style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)', color: 'var(--color-on-surface)' }}>
      {children}
    </div>
  )
}

export function TipRow({ label, value, color }: { label: string; value: ReactNode; color?: string }) {
  return (
    <div className="flex items-center justify-between gap-6 py-0.5">
      <span style={{ color: 'var(--color-on-surface-variant)' }}>{label}</span>
      <span className="font-semibold tabular-nums" style={{ color: color || 'var(--color-on-surface)' }}>{value}</span>
    </div>
  )
}

export interface BandItem {
  label: string
  jobs: number
  sample: number
  p25: number | null
  p50: number | null
  p75: number | null
}

export function SalaryBands({ items, accent = '#6d5efc' }: { items: BandItem[]; accent?: string }) {
  const max = Math.max(1, ...items.map(i => i.p75 || 0))
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-[10px]" style={{ color: 'var(--color-on-surface-variant)' }}>
        <span>条形 = P25–P75，竖线 = 中位数</span>
        <span>上限 {max}K</span>
      </div>
      {items.map(item => {
        const has = item.p25 != null && item.p50 != null && item.p75 != null
        return (
          <div key={item.label} className="grid items-center gap-3" style={{ gridTemplateColumns: '58px 1fr 92px' }}>
            <span className="truncate text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>{item.label}</span>
            <div className="relative h-3.5 rounded-full" style={{ background: 'var(--color-surface-container)' }}>
              {has && (
                <div className="absolute inset-y-1 rounded-full"
                  style={{
                    left: `${(item.p25! / max) * 100}%`,
                    width: `${Math.max(0.8, ((item.p75! - item.p25!) / max) * 100)}%`,
                    background: `${accent}66`,
                  }} />
              )}
              {has && (
                <div className="absolute -inset-y-0.5 w-[2px] rounded-full"
                  style={{ left: `${(item.p50! / max) * 100}%`, background: accent }} />
              )}
            </div>
            <span className="text-right text-[11px] tabular-nums" style={{ color: 'var(--color-on-surface)' }}>
              {has ? `${item.p50}K` : '样本不足'}
              <span className="ml-1 text-[9px]" style={{ color: 'var(--color-on-surface-variant)' }}>n={item.sample}</span>
            </span>
          </div>
        )
      })}
    </div>
  )
}

export function Heatmap({
  cities, fields, values, onCell,
}: {
  cities: string[]
  fields: string[]
  values: number[][]
  onCell?: (city: string, field: string, value: number) => void
}) {
  const max = Math.max(1, ...values.flat())
  return (
    <div className="overflow-x-auto pb-1">
      <div className="min-w-[620px]">
        <div className="grid gap-1" style={{ gridTemplateColumns: `76px repeat(${fields.length}, minmax(0, 1fr))` }}>
          <div />
          {fields.map(field => (
            <div key={field} className="truncate pb-1 text-center text-[10px]" title={field}
              style={{ color: 'var(--color-on-surface-variant)' }}>
              {field}
            </div>
          ))}
          {cities.map((city, ri) => (
            <Fragment key={city}>
              <div className="truncate pr-2 text-right text-[10px]" title={city}
                style={{ color: 'var(--color-on-surface-variant)' }}>{city}</div>
              {fields.map((field, ci) => {
                const value = values[ri]?.[ci] ?? 0
                const ratio = value / max
                return (
                  <button key={`${city}-${field}`}
                    onClick={() => onCell?.(city, field, value)}
                    title={`${city} · ${field}：${value} 个岗位（点击下钻）`}
                    className="h-8 rounded-md text-[10px] font-medium tabular-nums transition-transform hover:scale-[1.06]"
                    style={{
                      background: `rgba(109, 94, 252, ${0.05 + ratio * 0.82})`,
                      color: ratio > 0.55 ? '#fff' : 'var(--color-on-surface)',
                      border: value === 0 ? '1px solid var(--color-outline-variant)' : '1px solid transparent',
                    }}>
                    {value || ''}
                  </button>
                )
              })}
            </Fragment>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-end gap-2 text-[10px]" style={{ color: 'var(--color-on-surface-variant)' }}>
          <span>少</span>
          <div className="h-2 w-24 rounded-full" style={{ background: 'linear-gradient(90deg, rgba(109,94,252,0.06), rgba(109,94,252,0.85))' }} />
          <span>多</span>
        </div>
      </div>
    </div>
  )
}

export function PercentBar({ pct, color = '#6d5efc' }: { pct: number; color?: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: 'var(--color-surface-container)' }}>
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: color }} />
      </div>
      <span className="w-10 text-right text-[10px] tabular-nums" style={{ color: 'var(--color-on-surface-variant)' }}>{pct}%</span>
    </div>
  )
}

export function MiniBars({ items, color }: { items: Array<{ label: string; value: number }>; color: string }) {
  const max = Math.max(1, ...items.map(i => i.value))
  return (
    <div className="flex h-24 items-end gap-1">
      {items.map(item => (
        <div key={item.label} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"
          title={`${item.label}：${item.value}`}>
          <div className="flex w-full flex-1 items-end">
            <div className="w-full rounded-t-sm" style={{ height: `${Math.max(2, (item.value / max) * 100)}%`, background: color, opacity: 0.85 }} />
          </div>
          <span className="text-[8px] tabular-nums" style={{ color: 'var(--color-on-surface-variant)' }}>{item.label.slice(5)}</span>
        </div>
      ))}
    </div>
  )
}

export function LoadingBlock({ label = '加载中' }: { label?: string }) {
  return (
    <div className="flex h-48 items-center justify-center gap-2 text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
      <Loader2 className="h-4 w-4 animate-spin" /> {label}
    </div>
  )
}

export function EmptyBlock({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex h-40 flex-col items-center justify-center gap-2 text-center">
      <Inbox className="h-6 w-6" style={{ color: 'var(--color-on-surface-variant)' }} />
      <p className="text-xs font-medium" style={{ color: 'var(--color-on-surface)' }}>{title}</p>
      {hint && <p className="max-w-xs text-[10px]" style={{ color: 'var(--color-on-surface-variant)' }}>{hint}</p>}
    </div>
  )
}
