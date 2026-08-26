/**
 * JobEvolutionTimeline — recharts 折线 + 时间轴锚点
 * 给定 Job id,显示其 salary_avg / salary_max 等指标在 JobSnapshot 上的轨迹。
 */
import { useEffect, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceDot,
} from 'recharts'
import { kgApi } from './api'

interface Props {
  jobId?: number
  height?: number
  onChangePointClick?: (date: string) => void
}

export default function JobEvolutionTimeline({ jobId, height = 220, onChangePointClick }: Props) {
  const [series, setSeries] = useState<any[]>([])
  const [changes, setChanges] = useState<any[]>([])
  const [metric, setMetric] = useState('salary_avg')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!jobId) {
      setSeries([])
      setChanges([])
      return
    }
    setLoading(true)
    Promise.all([kgApi.jobEvolution(jobId, metric), kgApi.jobChanges(jobId)])
      .then(([s, c]) => {
        setSeries(s || [])
        setChanges(c || [])
      })
      .finally(() => setLoading(false))
  }, [jobId, metric])

  if (!jobId) {
    return (
      <div className="flex items-center justify-center text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
        <span>选择岗位后展示演化曲线</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: 'var(--color-outline-variant)' }}>
        <div className="text-sm font-semibold">演化曲线</div>
        <div className="flex gap-1">
          {['salary_avg', 'salary_max', 'salary_min'].map((m) => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className="text-xs px-2 py-1 rounded"
              style={{
                background: metric === m ? 'var(--color-primary)' : 'var(--color-surface-container)',
                color: metric === m ? 'var(--color-on-primary)' : 'var(--color-on-surface)',
              }}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 p-2">
        {loading ? (
          <div className="flex h-full items-center justify-center text-xs">加载中...</div>
        ) : series.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
            该岗位暂无时序数据
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={height}>
            <LineChart data={series} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
              <XAxis dataKey="date" tickFormatter={(d) => d?.slice(0, 7)} tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip
                contentStyle={{ fontSize: 12, background: 'var(--color-surface)', border: '1px solid var(--color-outline)' }}
                labelFormatter={(d) => d?.slice(0, 10)}
              />
              <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
              {/* 变化点标红 */}
              {changes
                .filter((c) => c.date && c.type?.startsWith('salary'))
                .map((c, i) => {
                  const point = series.find((s) => s.date && c.date && s.date.startsWith(c.date.slice(0, 7)))
                  if (!point) return null
                  return (
                    <ReferenceDot
                      key={i}
                      x={point.date}
                      y={point.value}
                      r={6}
                      fill="#ef4444"
                      stroke="#fff"
                      strokeWidth={2}
                      onClick={() => onChangePointClick?.(c.change_id)}
                    />
                  )
                })}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}