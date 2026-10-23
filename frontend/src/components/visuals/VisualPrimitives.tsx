import type { ReactNode } from 'react'
export const COLORS = ['#4f6ef7', '#13a89e', '#9471e8', '#f6a547', '#ec789b', '#51a5df', '#91b84b', '#c58a5e']
export const chartTooltip = { background: 'var(--color-surface-container-lowest)', border: '1px solid var(--color-outline-variant)', borderRadius: 12, fontSize: 12 }
export function VisualCard({ title, description, children, action }: { title: string; description?: string; children: ReactNode; action?: ReactNode }) {
  return <section className="rounded-2xl border p-5 sm:p-6 min-w-0" style={{ background: 'var(--color-surface-container-lowest)', borderColor: 'var(--color-outline-variant)' }}>
    <div className="flex items-start justify-between gap-3 mb-4"><div><h2 className="text-base font-bold">{title}</h2>{description && <p className="text-xs mt-1.5 leading-relaxed opacity-65">{description}</p>}</div>{action}</div>{children}
  </section>
}
export function EmptyVisual({ children }: { children: ReactNode }) { return <div className="min-h-36 flex items-center justify-center text-center text-sm opacity-65 px-6 py-8">{children}</div> }
