/** 管理端工作台的「数据洞察」区块
 *
 * 四个图：新增趋势、岗位城市分布、薪资区间、行为漏斗。
 * 取数走 /api/admin/analytics/*（只读聚合），数据稀疏时显示空态而不是假数据。
 */
import { useEffect, useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { ChartCard, TrendChart, RankBars, ColumnChart, FunnelBars } from './AdminCharts'

const getToken = () => localStorage.getItem('xingtu_token') || ''
const withToken = (url: string) => `${url}${url.includes('?') ? '&' : '?'}token=${getToken()}`

interface TrendItem { date: string; jobseeker: number; enterprise: number; job: number; resume: number }
interface FunnelStep { key: string; label: string; value: number; ratio: number; hint?: string }

const SERIES = [
  { key: 'jobseeker', name: '求职者', color: '#3b82f6' },
  { key: 'enterprise', name: '企业', color: '#8b5cf6' },
  { key: 'job', name: '企业岗位', color: '#10b981' },
  { key: 'resume', name: '简历', color: '#f59e0b' },
]

export default function DashboardInsights() {
  const [trend, setTrend] = useState<TrendItem[]>([])
  const [city, setCity] = useState<{ name: string; value: number }[]>([])
  const [salary, setSalary] = useState<{ name: string; value: number }[]>([])
  const [steps, setSteps] = useState<FunnelStep[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  const load = async () => {
    setLoading(true); setFailed(false)
    try {
      const [t, j, f] = await Promise.all([
        fetch(withToken('/api/admin/analytics/trend?days=30')).then(r => r.json()),
        fetch(withToken('/api/admin/analytics/jobs?top=8')).then(r => r.json()),
        fetch(withToken('/api/admin/analytics/funnel')).then(r => r.json()),
      ])
      if (t.success) setTrend(t.data.items || [])
      if (j.success) {
        setCity(j.data.city || [])
        setSalary(j.data.salary || [])
      }
      if (f.success) setSteps(f.data.steps || [])
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 gap-2 text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
        <Loader2 className="h-4 w-4 animate-spin" /> 正在汇总图表数据…
      </div>
    )
  }

  if (failed) {
    return (
      <div className="rounded-xl border px-3 py-2 text-xs flex items-center justify-between"
        style={{ borderColor: 'var(--accent-orange)', background: 'var(--accent-orange-dim)', color: 'var(--accent-orange)' }}>
        <span>图表数据加载失败</span>
        <button onClick={load} className="underline">重试</button>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold" style={{ color: 'var(--color-on-surface)' }}>数据洞察</h2>
        <button onClick={load} className="text-xs inline-flex items-center gap-1 hover:opacity-80"
          style={{ color: 'var(--accent-green)' }}>
          <RefreshCw className="h-3 w-3" /> 刷新
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="近 30 天新增" subtitle="按北京时间分日统计" height={190}>
          <TrendChart data={trend} series={SERIES} />
        </ChartCard>

        <ChartCard title="岗位城市分布" subtitle="采集岗位数 Top 8" height={190}>
          <RankBars data={city} unit=" 个" />
        </ChartCard>

        <ChartCard title="薪资区间分布" subtitle="按岗位月薪中位数分桶" height={180}>
          <ColumnChart data={salary} />
        </ChartCard>

        <ChartCard title="用户行为漏斗" subtitle="各环节规模，基准为简历数" height={180}>
          <FunnelBars steps={steps} />
        </ChartCard>
      </div>
    </div>
  )
}
