import { useCallback, useEffect, useState } from 'react'

// One clock for the whole page, including independently loaded cards.
export function useTrendRefresh() {
  const [revision, setRevision] = useState(0)
  const refresh = useCallback(() => setRevision(value => value + 1), [])
  useEffect(() => {
    const tick = () => { if (document.visibilityState === 'visible') refresh() }
    const interval = window.setInterval(tick, 60000)
    document.addEventListener('visibilitychange', tick)
    return () => { window.clearInterval(interval); document.removeEventListener('visibilitychange', tick) }
  }, [refresh])
  return { revision, refresh }
}

export function sourceTime(value?: string | null) {
  if (!value) return '暂无记录'
  const normalized = value.replace(' ', 'T')
  const date = new Date(/(?:Z|[+-]\d\d:\d\d)$/.test(normalized) ? normalized : `${normalized}Z`)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })
}
