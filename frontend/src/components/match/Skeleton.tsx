export function Skeleton({ className = '', style = {} }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`animate-pulse rounded-lg ${className}`}
      style={{ background: 'var(--color-surface-container)', ...style }}
    />
  )
}

export function SkeletonCircle({ size = 48 }: { size?: number }) {
  return <Skeleton className="rounded-full" style={{ width: size, height: size }} />
}

export function SkeletonText({ width = '100%', height = 14 }: { width?: string | number; height?: number }) {
  return <Skeleton style={{ width, height, marginBottom: 4 }} />
}

export function SkeletonCard() {
  return (
    <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
      <div className="flex items-center gap-2"><SkeletonCircle size={32} /><SkeletonText width="60%" /></div>
      <SkeletonText width="40%" height={10} />
      <SkeletonText width="80%" height={10} />
      <div className="flex gap-1"><Skeleton className="h-5 w-12 rounded" /><Skeleton className="h-5 w-12 rounded" /><Skeleton className="h-5 w-12 rounded" /></div>
    </div>
  )
}

export function SkeletonGauge() {
  return (
    <div className="rounded-2xl border p-6 space-y-4" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
      <div className="flex justify-center"><SkeletonCircle size={100} /></div>
      <div className="flex justify-center"><SkeletonText width="40%" height={20} /></div>
    </div>
  )
}
