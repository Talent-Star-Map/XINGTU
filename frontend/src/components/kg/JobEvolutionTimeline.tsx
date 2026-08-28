/**
 * JobEvolutionTimeline — recharts 折线 + 时间轴锚点
 * 给定 Job id,显示其 salary_avg / salary_max 等指标在 JobSnapshot 上的轨迹。
 *
 * 演示模式(jobId 1-100):为前 100 个岗位预生成稳定的 mock 演化数据,
 * 强制覆盖真实数据,保证给老师演示一致性。Header 有下拉框便于切换。
 */
import { useEffect, useMemo, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceDot,
} from 'recharts'
import { kgApi } from './api'

interface Props {
  jobId?: number
  height?: number
  onChangePointClick?: (date: string) => void
}

// ── 演示数据配置 ──
const DEMO_TOP_N = 100                                          // 前 100 个岗位
const MOCK_RANGE_START = '2024-04-01'
const MOCK_RANGE_END   = '2026-07-01'

// 100 个岗位的"展示名" — 演示用的中文岗位名,不用真实 DB 数据
const DEMO_JOB_TITLES = [
  'Java 后端工程师', 'Python 数据分析师', '前端开发工程师', '产品经理', '测试工程师',
  '运维工程师', 'iOS 开发工程师', 'Android 开发工程师', '算法工程师', 'AI 工程师',
  '机器学习工程师', '深度学习研究员', '数据科学家', '大数据开发工程师', '数据仓库工程师',
  'ETL 工程师', '数据库管理员', 'DBA', 'DevOps 工程师', 'SRE 工程师',
  '云计算工程师', '云原生工程师', 'Kubernetes 运维', '安全工程师', '渗透测试工程师',
  '网络安全工程师', '信息安全工程师', '区块链工程师', '智能合约开发', 'Web3 前端',
  '全栈工程师', 'Node.js 后端', 'Go 后端工程师', 'Rust 工程师', 'C++ 工程师',
  '嵌入式工程师', '单片机工程师', '驱动开发工程师', '游戏开发工程师', 'Unity 工程师',
  'UE 工程师', '图形学工程师', '音视频工程师', '音视频算法', '图像算法工程师',
  'NLP 算法工程师', '推荐算法工程师', '搜索算法工程师', '广告算法工程师', '风控算法工程师',
  '量化研究员', '量化开发工程师', '高频交易开发', '金融工程师', '财务分析师',
  '审计专员', '税务专员', '法务专员', '合规专员', '行政专员',
  '人力资源专员', '招聘专员', 'HRBP', '培训专员', '薪酬绩效专员',
  '市场专员', '品牌专员', '新媒体运营', '内容运营', '用户运营',
  '产品运营', '数据运营', '社群运营', '活动运营', '商务运营',
  '销售经理', '大客户销售', '渠道销售', '海外销售', '电话销售',
  '售前工程师', '售后工程师', '技术支持工程师', '实施工程师', 'FAE 现场应用',
  '解决方案工程师', '架构师', '技术总监', 'CTO', 'CIO',
  '项目经理', '产品总监', '运营总监', '市场总监', '设计总监',
  'UI 设计师', 'UX 设计师', '交互设计师', '视觉设计师', '插画师',
]

function seedHash(s: string): number {
  let v = 0
  for (let i = 0; i < s.length; i++) v = (v * 31 + s.charCodeAt(i)) >>> 0
  return v
}

function genMockSeries(seedKey: string, metric: 'salary_avg' | 'salary_max' | 'salary_min') {
  const h = seedHash(seedKey)
  const base = 15 + (h % 26)             // 15~40K base
  const amp  = 3 + ((h >> 8) % 7)        // 振幅 3~9
  const phase = ((h >> 16) % 100) / 100 * Math.PI * 2
  const growth = 0.3 + ((h >> 24) % 10) / 10   // 长期斜率

  const start = new Date(MOCK_RANGE_START)
  const end   = new Date(MOCK_RANGE_END)
  const points: { date: string; value: number }[] = []
  let i = 0
  const cursor = new Date(start)
  while (cursor <= end) {
    const t = i / 12
    const trend = base + amp * growth * t
    const season = Math.sin(2 * Math.PI * t + phase) * (amp * 0.3)
    const noise  = Math.sin(i * 1.7 + phase) * (amp * 0.15)
    let v = trend + season + noise
    if (metric === 'salary_max') v = v * 1.4 + 10
    if (metric === 'salary_min') v = Math.max(8, v * 0.72)
    points.push({ date: cursor.toISOString().slice(0, 10), value: Math.round(v * 10) / 10 })
    cursor.setMonth(cursor.getMonth() + 1)
    i++
  }
  return points
}

function genMockChanges(seedKey: string) {
  const h = seedHash(seedKey)
  const start = new Date(MOCK_RANGE_START)
  const end   = new Date(MOCK_RANGE_END)
  const span  = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30)
  const n = 2 + (h % 3)
  const changes: any[] = []
  for (let k = 0; k < n; k++) {
    const m = Math.floor((h >> (k * 4)) % span) + 2
    const d = new Date(start)
    d.setMonth(d.getMonth() + m)
    changes.push({ date: d.toISOString().slice(0, 10), type: 'salary_increase', change_id: `mock-${k}` })
  }
  return changes
}

// ── 预生成前 N 个岗位的 mock 数据(单例,模块级缓存) ──
const DEMO_DATA_CACHE: Map<number, { series: any[]; changes: any[] }> = (() => {
  const m = new Map()
  for (let id = 1; id <= DEMO_TOP_N; id++) {
    const key = `job:${id}`
    m.set(id, { series: genMockSeries(key, 'salary_avg'), changes: genMockChanges(key) })
  }
  return m
})()

function getDemoData(jobId: number) {
  return DEMO_DATA_CACHE.get(jobId) || { series: [], changes: [] }
}

function getJobTitle(jobId: number): string {
  return DEMO_JOB_TITLES[(jobId - 1) % DEMO_JOB_TITLES.length] || `岗位 #${jobId}`
}

export default function JobEvolutionTimeline({ jobId, height = 220, onChangePointClick }: Props) {
  const [series, setSeries] = useState<any[]>([])
  const [changes, setChanges] = useState<any[]>([])
  const [metric, setMetric] = useState('salary_avg')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'mock-demo' | 'real' | 'mock-fallback'>('mock-demo')
  // 本地下拉选择器覆盖(用于演示时自由切换 TOP 100)
  const [pickOverride, setPickOverride] = useState<number | null>(null)
  const effectiveJobId = pickOverride ?? jobId

  useEffect(() => {
    const id = effectiveJobId
    // 演示模式:jobId 1-100 永远走预生成数据,跳过 API
    if (id && id >= 1 && id <= DEMO_TOP_N) {
      const data = getDemoData(id)
      const seriesForMetric = metric === 'salary_avg'
        ? data.series
        : genMockSeries(`job:${id}`, metric as any)
      setSeries(seriesForMetric)
      setChanges(data.changes)
      setMode('mock-demo')
      return
    }

    if (!id) {
      setSeries([])
      setChanges([])
      setMode('mock-demo')
      return
    }

    // jobId > 100,正常走 API,失败再兜底
    setLoading(true)
    Promise.all([kgApi.jobEvolution(id, metric), kgApi.jobChanges(id)])
      .then(([s, c]) => {
        const realSeries = s || []
        const realChanges = c || []
        if (realSeries.length > 0) {
          setSeries(realSeries); setChanges(realChanges); setMode('real')
        } else {
          setSeries(genMockSeries(`job:${id}`, metric as any))
          setChanges(genMockChanges(`job:${id}`))
          setMode('mock-fallback')
        }
      })
      .catch(() => {
        setSeries(genMockSeries(`job:${id}`, metric as any))
        setChanges(genMockChanges(`job:${id}`))
        setMode('mock-fallback')
      })
      .finally(() => setLoading(false))
  }, [effectiveJobId, metric])

  // 当外部传入的 jobId 变化时,清掉本地下拉覆盖
  useEffect(() => { setPickOverride(null) }, [jobId])

  // 无 jobId 时默认展示"市场平均"demo
  const demoData = useMemo(() => {
    if (jobId) return null
    return {
      series: genMockSeries('market:overall', metric as any),
      changes: genMockChanges('market:overall'),
    }
  }, [jobId, metric])

  const showSeries  = effectiveJobId ? series  : (demoData?.series  || [])
  const showChanges = effectiveJobId ? changes : (demoData?.changes || [])
  const isMock = mode !== 'real'

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b gap-2" style={{ borderColor: 'var(--color-outline-variant)' }}>
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="text-sm font-semibold truncate">
            {effectiveJobId
              ? `${getJobTitle(effectiveJobId)} · #${effectiveJobId}`
              : '市场平均薪资演化'}
          </div>
          {isMock && (
            <span
              className="shrink-0 text-[10px] px-1.5 py-0.5 rounded font-medium"
              style={{
                background: effectiveJobId && effectiveJobId <= DEMO_TOP_N ? 'rgba(99, 102, 241, 0.12)' : 'rgba(251, 191, 36, 0.15)',
                color:      effectiveJobId && effectiveJobId <= DEMO_TOP_N ? '#4338ca' : '#b45309',
                border:     `1px solid ${effectiveJobId && effectiveJobId <= DEMO_TOP_N ? 'rgba(99,102,241,0.4)' : 'rgba(251,191,36,0.4)'}`,
              }}
              title={effectiveJobId && effectiveJobId <= DEMO_TOP_N
                ? '前 100 个岗位强制走预生成演示数据,保证演示一致性'
                : '该岗位无真实时序数据,展示演示曲线'}
            >
              {effectiveJobId && effectiveJobId <= DEMO_TOP_N ? 'TOP 100 演示' : '演示数据'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {/* 演示用:TOP 100 岗位快速切换下拉 */}
          <select
            value={pickOverride ?? ''}
            onChange={(e) => {
              const v = e.target.value
              setPickOverride(v === '' ? null : Number(v))
            }}
            className="text-xs px-2 py-1 rounded border"
            style={{
              borderColor: 'var(--color-outline-variant)',
              background: 'var(--color-surface-container)',
              color: 'var(--color-on-surface)',
              maxWidth: 160,
            }}
            title="演示:从前 100 个岗位中切换预览"
          >
            <option value="">📋 TOP 100…</option>
            {Array.from({ length: DEMO_TOP_N }, (_, i) => i + 1).map((id) => (
              <option key={id} value={id}>
                #{id} {getJobTitle(id)}
              </option>
            ))}
          </select>
          {pickOverride !== null && (
            <button
              onClick={() => setPickOverride(null)}
              className="text-[10px] px-1.5 py-1 rounded"
              style={{ background: 'var(--color-surface-container)', color: 'var(--color-on-surface-variant)' }}
              title="恢复跟随图谱选中"
            >
              ✕
            </button>
          )}
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
        ) : (
          <ResponsiveContainer width="100%" height={height}>
            <LineChart data={showSeries} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
              <XAxis dataKey="date" tickFormatter={(d) => d?.slice(0, 7)} tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} unit="K" />
              <Tooltip
                contentStyle={{ fontSize: 12, background: 'var(--color-surface)', border: '1px solid var(--color-outline)' }}
                labelFormatter={(d) => d?.slice(0, 10)}
              />
              <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
              {showChanges
                .filter((c) => c.date && c.type?.startsWith('salary'))
                .map((c, i) => {
                  const point = showSeries.find((s) => s.date && c.date && s.date.startsWith(c.date.slice(0, 7)))
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