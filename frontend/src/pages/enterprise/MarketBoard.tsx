import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowDownRight, ArrowUpRight, BarChart3, Briefcase, Building2, ChevronRight,
  Database, Info, Layers, MapPin, Maximize2, Minimize2, Network, Sparkles,
  Target, TrendingUp, Users, X, Zap,
} from 'lucide-react'
import {
  Bar, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart, PolarAngleAxis,
  PolarGrid, PolarRadiusAxis, Radar as ReRadar, RadarChart, ReferenceLine,
  ResponsiveContainer, Scatter, ScatterChart, Tooltip, Treemap, XAxis, YAxis, ZAxis,
} from 'recharts'
import { useTheme } from '../../components/ThemeProvider'
import { EPNav } from '../../lib/NavContext'
import SkillNetwork, { fieldColor, FIELD_COLORS, type SkillLink, type SkillNode } from '../../components/enterprise/board/SkillNetwork'
import JobDrawer, { type DrawerQuery } from '../../components/enterprise/board/JobDrawer'
import {
  BoardCard, DATA_COLORS, EmptyBlock, Heatmap, KpiCard, LoadingBlock, MiniBars,
  PercentBar, QUADRANT_COLORS, SalaryBands, TipRow, TipShell,
} from '../../components/enterprise/board/BoardPrimitives'

// ── API 类型 ────────────────────────────────────────────────

interface SalaryStats {
  sample: number
  p25: number | null
  p50: number | null
  p75: number | null
  avg: number | null
}

interface CityItem {
  city: string
  jobs: number
  share: number
  companies: number
  skills: number
  top_field: string
  salary: SalaryStats
}

interface FieldItem {
  field: string
  jobs: number
  share: number
  top_city: string
  salary: SalaryStats
}

interface OverviewData {
  kpis: {
    jobs: number
    companies: number
    cities: number
    salary_samples: number
    salary_coverage: number
    p25_salary_k: number | null
    median_salary_k: number | null
    p75_salary_k: number | null
    high_salary_ratio: number
    skills: number
  }
  cities: CityItem[]
  fields: FieldItem[]
  salary_hist: Array<{ label: string; count: number; share: number }>
  salary_by_experience: Array<{ label: string; jobs: number } & SalaryStats>
  salary_by_education: Array<{ label: string; jobs: number } & SalaryStats>
  field_city_heat: { cities: string[]; fields: string[]; values: number[][] }
  source_mix: Array<{ source: string; jobs: number; share: number; salary: SalaryStats }>
  completeness: Array<{ key: string; label: string; covered: number; total: number; pct: number }>
  salary_months: Array<{ label: string; count: number }>
  time_coverage: {
    publish_months: Array<{ month: string; count: number }>
    crawl_months: Array<{ month: string; count: number }>
    publish_samples: number
  }
  insights: string[]
  filters: {
    cities: string[]
    fields: string[]
    experiences: string[]
    educations: string[]
    salary_bands: Array<{ value: string; label: string }>
  }
  meta: {
    filtered_jobs: number
    all_jobs: number
    raw_jobs: number
    dedup_removed: number
    loaded_at: string
    is_filtered: boolean
  }
}

interface SkillItem {
  name: string
  demand: number
  share: number
  salary_sample: number
  median_salary_k: number | null
  premium_pct: number | null
  quadrant: string
  field: string
}

interface ClusterItem {
  id: number
  name: string
  tech_stack: string
  member_count: number
  global_member_count: number
  share: number
  top_city: string
  salary: SalaryStats
  top_skills: Array<{ name: string; count: number }>
}

interface SkillsData {
  top_skills: SkillItem[]
  network: { nodes: SkillNode[]; links: SkillLink[] }
  clusters: ClusterItem[]
  change_monitor: {
    records: number
    window: { start: string | null; end: string | null }
    added: Array<{ name: string; count: number }>
    removed: Array<{ name: string; count: number }>
    note: string
  }
  meta: {
    jobs: number
    salary_samples: number
    skills: number
    overall_median_salary_k: number | null
  }
}

interface BenchmarkJob {
  id: number
  title: string
  location: string
  salary_min_k: number | null
  salary_max_k: number | null
  own_mid_k: number | null
  salary_percentile: number | null
  market_salary: SalaryStats
  peer_count: number
  peer_basis: string
  salary_basis: string
  salary_sample: number
  skills: string[]
  field: string
  skill_coverage: number | null
  skill_heat: number | null
  experience_friendly: number | null
  radar: Array<{ axis: string; value: number | null }>
  competitiveness: number | null
  missing_skills: Array<{ name: string; demand: number; share: number; median_salary_k: number | null }>
  peer_top_skills: Array<{ name: string; count: number }>
}

interface BenchmarkData {
  has_jobs: boolean
  summary: {
    company_name: string
    own_jobs: number
    own_median_salary_k: number | null
    market_median_salary_k: number | null
    salary_gap_pct: number | null
    avg_competitiveness: number | null
    missing_skills: Array<{ name: string; jobs: number; median_salary_k: number | null }>
  }
  jobs: BenchmarkJob[]
  market: {
    median_salary_k: number | null
    salary_sample: number
    top_skills: Array<{ name: string; demand: number; share: number; median_salary_k: number | null }>
  }
  meta: { loaded_at: string; market_jobs: number }
}

// ── 常量与工具 ──────────────────────────────────────────────

const TABS = [
  { key: 'overview', label: '市场全景', icon: BarChart3 },
  { key: 'skills', label: '技能深潜', icon: Network },
  { key: 'benchmark', label: '招聘对标', icon: Target },
] as const
type TabKey = typeof TABS[number]['key']

const EMPTY_FILTERS = { city: '', field: '', experience: '', education: '', salary: '' }
type Filters = typeof EMPTY_FILTERS

const fmtK = (v: number | null | undefined) => (v == null ? '—' : `${v}K`)
const fmtPct = (v: number | null | undefined) => (v == null ? '—' : `${v}%`)
const signed = (v: number | null | undefined) => (v == null ? '—' : `${v >= 0 ? '+' : ''}${v}%`)
const PEER_LABEL: Record<string, string> = { same_skill: '同技能', same_field: '同领域', market: '全市场' }
const peerLabel = (basis: string) => PEER_LABEL[basis] || '同技能'

const CLUSTER_COLORS = ['#6d5efc', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6', '#f97316', '#ec4899', '#64748b']

function useAxisColors() {
  const { theme } = useTheme()
  const dark = theme === 'dark'
  return {
    dark,
    grid: dark ? 'rgba(148,163,184,0.16)' : 'rgba(100,116,139,0.16)',
    axis: dark ? '#94a3b8' : '#64748b',
    axisLine: dark ? 'rgba(148,163,184,0.28)' : 'rgba(100,116,139,0.28)',
    cardBg: dark ? '#171a26' : '#ffffff',
    primary: '#6d5efc',
    green: '#10b981',
    orange: '#f59e0b',
    red: '#ef4444',
    cyan: '#0ea5e9',
  }
}

// ── 小图表组件 ──────────────────────────────────────────────

function CityTip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <TipShell>
      <div className="mb-1 flex items-center gap-2 font-bold">
        <span className="h-2 w-2 rounded-full" style={{ background: fieldColor(p.top_field) }} />
        {p.city}
      </div>
      <TipRow label="岗位量" value={`${p.jobs}（${p.share}%）`} />
      <TipRow label="薪资中位" value={fmtK(p.p50)} />
      <TipRow label="P25 / P75" value={`${fmtK(p.p25)} / ${fmtK(p.p75)}`} />
      <TipRow label="薪资样本" value={`${p.sample} 条`} />
      <TipRow label="企业数" value={p.companies} />
      <TipRow label="主领域" value={p.top_field} color={fieldColor(p.top_field)} />
    </TipShell>
  )
}

function FieldTip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <TipShell>
      <div className="mb-1 font-bold">{p.field}</div>
      <TipRow label="岗位量" value={`${p.jobs}（${p.share}%）`} />
      <TipRow label="薪资中位" value={p.salary?.p50 != null ? fmtK(p.salary.p50) : '样本不足'} />
      <TipRow label="薪资样本" value={`${p.salary?.sample ?? 0} 条`} />
      <TipRow label="主城市" value={p.top_city} />
    </TipShell>
  )
}

function SalaryTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const bar = payload.find((x: any) => x.dataKey === 'count')
  const line = payload.find((x: any) => x.dataKey === 'cum')
  return (
    <TipShell>
      <div className="mb-1 font-bold">{label}</div>
      <TipRow label="岗位数" value={bar?.value ?? '—'} />
      <TipRow label="累计占比" value={line?.value != null ? `${line.value}%` : '—'} />
    </TipShell>
  )
}

function SkillTip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <TipShell>
      <div className="mb-1 flex items-center gap-2 font-bold">
        <span className="h-2 w-2 rounded-full" style={{ background: QUADRANT_COLORS[p.quadrant] || '#94a3b8' }} />
        {p.name}
      </div>
      <TipRow label="需求岗位" value={`${p.demand}（${p.share}%）`} />
      <TipRow label="薪资中位" value={fmtK(p.median_salary_k)} />
      <TipRow label="薪资溢价" value={signed(p.premium_pct)} color={(p.premium_pct ?? 0) >= 0 ? '#10b981' : '#ef4444'} />
      <TipRow label="薪资样本" value={`${p.salary_sample} 条`} />
      <TipRow label="象限" value={p.quadrant} color={QUADRANT_COLORS[p.quadrant]} />
    </TipShell>
  )
}

function ClusterTip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <TipShell>
      <div className="mb-1 font-bold">{p.name}</div>
      <TipRow label="成员岗位" value={`${p.member_count}（${p.share}%）`} />
      <TipRow label="薪资中位" value={p.salary?.p50 != null ? fmtK(p.salary.p50) : '样本不足'} />
      <TipRow label="薪资样本" value={`${p.salary?.sample ?? 0} 条`} />
      <TipRow label="主城市" value={p.top_city} />
      <TipRow label="技术栈" value={p.tech_stack} />
    </TipShell>
  )
}

function FieldTreemapContent(props: any) {
  const { x, y, width, height, field, jobs, salary, color } = props
  if (!field || width < 6 || height < 6) return null
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} rx={7} fill={color} fillOpacity={0.86}
        stroke="var(--color-surface-container-lowest)" strokeWidth={2} />
      {width > 78 && height > 44 && (
        <>
          <text x={x + 9} y={y + 19} fill="#fff" fontSize={11} fontWeight={700}>{field}</text>
          <text x={x + 9} y={y + 34} fill="rgba(255,255,255,0.82)" fontSize={9}>{jobs} 个岗位</text>
          {salary?.p50 != null && salary.sample >= 10 && (
            <text x={x + 9} y={y + 48} fill="rgba(255,255,255,0.68)" fontSize={9}>
              中位 {salary.p50}K · n={salary.sample}
            </text>
          )}
        </>
      )}
    </g>
  )
}

function ClusterTreemapContent(props: any) {
  const { x, y, width, height, name, member_count, salary, fill } = props
  if (!name || width < 6 || height < 6) return null
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} rx={7} fill={fill} fillOpacity={0.82}
        stroke="var(--color-surface-container-lowest)" strokeWidth={2} />
      {width > 76 && height > 40 && (
        <>
          <text x={x + 8} y={y + 17} fill="#fff" fontSize={10} fontWeight={700}>
            {name.length > 10 ? `${name.slice(0, 10)}…` : name}
          </text>
          <text x={x + 8} y={y + 31} fill="rgba(255,255,255,0.8)" fontSize={9}>{member_count} 个岗位</text>
          {salary?.p50 != null && salary.sample >= 5 && (
            <text x={x + 8} y={y + 45} fill="rgba(255,255,255,0.65)" fontSize={9}>中位 {salary.p50}K</text>
          )}
        </>
      )}
    </g>
  )
}

function SalaryCompare({ job }: { job: BenchmarkJob }) {
  const stats = job.market_salary
  const ownMin = job.salary_min_k
  const ownMax = job.salary_max_k
  const max = Math.max(stats.p75 || 0, ownMax || 0, 10) * 1.15
  const pos = (v: number) => `${Math.min(100, Math.max(0, (v / max) * 100))}%`
  const basisLabel = job.salary_basis === 'same_skill'
    ? '市场同技能基准'
    : job.salary_basis === 'same_field'
      ? '同领域市场基准（同技能样本不足）'
      : '全市场基准（对标样本不足）'
  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1.5 flex items-center justify-between text-[10px]" style={{ color: 'var(--color-on-surface-variant)' }}>
          <span>{basisLabel} P25–P75</span>
          <span className="tabular-nums">
            {stats.p25 != null && stats.p75 != null ? `${stats.p25}K – ${stats.p75}K` : '样本不足'}
          </span>
        </div>
        <div className="relative h-3 rounded-full" style={{ background: 'var(--color-surface-container)' }}>
          {stats.p25 != null && stats.p75 != null && (
            <div className="absolute inset-y-1 rounded-full"
              style={{ left: pos(stats.p25), width: `${Math.max(1, ((stats.p75 - stats.p25) / max) * 100)}%`, background: 'rgba(109,94,252,0.32)' }} />
          )}
          {stats.p50 != null && (
            <div className="absolute -inset-y-0.5 w-[2px] rounded-full" style={{ left: pos(stats.p50), background: '#6d5efc' }} />
          )}
        </div>
        <div className="mt-1 flex justify-between text-[10px]" style={{ color: 'var(--color-on-surface-variant)' }}>
          <span>中位 {fmtK(stats.p50)}</span>
          <span>样本 n={stats.sample}</span>
        </div>
      </div>
      <div>
        <div className="mb-1.5 flex items-center justify-between text-[10px]" style={{ color: 'var(--color-on-surface-variant)' }}>
          <span>本岗位薪资区间</span>
          <span className="tabular-nums">{ownMin != null && ownMax != null ? `${ownMin}K – ${ownMax}K` : '未填写'}</span>
        </div>
        <div className="relative h-3 rounded-full" style={{ background: 'var(--color-surface-container)' }}>
          {ownMin != null && ownMax != null && (
            <div className="absolute inset-y-1 rounded-full"
              style={{ left: pos(ownMin), width: `${Math.max(2, ((ownMax - ownMin) / max) * 100)}%`, background: '#10b981' }} />
          )}
        </div>
        <div className="mt-1 flex justify-between text-[10px]" style={{ color: 'var(--color-on-surface-variant)' }}>
          <span>薪资分位 {fmtPct(job.salary_percentile)}</span>
          <span>{job.salary_percentile != null && job.salary_percentile >= 50 ? '高于市场一半样本' : '低于市场一半样本'}</span>
        </div>
      </div>
      {stats.sample < 10 && (
        <p className="rounded-md px-2 py-1 text-[10px]" style={{ background: 'rgba(245,158,11,0.12)', color: '#b45309' }}>
          对标薪资样本不足 10 条，分位仅作参考
        </p>
      )}
    </div>
  )
}

// ── 页面 ────────────────────────────────────────────────────

export default function MarketBoard() {
  const { setPage } = EPNav.use()
  const { theme } = useTheme()
  const c = useAxisColors()
  const token = localStorage.getItem('xingtu_token') || ''
  const boardRef = useRef<HTMLDivElement>(null)

  const [tab, setTab] = useState<TabKey>('overview')
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [overview, setOverview] = useState<OverviewData | null>(null)
  const [skills, setSkills] = useState<SkillsData | null>(null)
  const [benchmark, setBenchmark] = useState<BenchmarkData | null>(null)
  const [loadingOverview, setLoadingOverview] = useState(true)
  const [loadingSkills, setLoadingSkills] = useState(false)
  const [loadingBenchmark, setLoadingBenchmark] = useState(true)
  const [error, setError] = useState('')
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null)
  const [selectedSkill, setSelectedSkill] = useState('')
  const [drawer, setDrawer] = useState<{ title: string; subtitle?: string; query: DrawerQuery } | null>(null)
  const [noteOpen, setNoteOpen] = useState(false)
  const [present, setPresent] = useState(false)
  const overviewReq = useRef(0)
  const skillsReq = useRef(0)
  const benchmarkReq = useRef(0)

  const queryString = useMemo(() => {
    const params = new URLSearchParams({ token })
    Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v) })
    return params.toString()
  }, [filters, token])

  const fetchOverview = useCallback(async () => {
    const id = ++overviewReq.current
    setLoadingOverview(true)
    setError('')
    try {
      const r = await fetch(`/api/enterprise/data-board/overview?${queryString}`)
      const json = await r.json()
      if (!json.success) throw new Error(json.error?.message || json.message || '加载失败')
      if (id === overviewReq.current) setOverview(json.data)
    } catch (e: any) {
      if (id === overviewReq.current) setError(String(e?.message || e))
    } finally {
      if (id === overviewReq.current) setLoadingOverview(false)
    }
  }, [queryString])

  const fetchSkills = useCallback(async () => {
    const id = ++skillsReq.current
    setLoadingSkills(true)
    setError('')
    try {
      const r = await fetch(`/api/enterprise/data-board/skills?${queryString}`)
      const json = await r.json()
      if (!json.success) throw new Error(json.error?.message || json.message || '加载失败')
      if (id === skillsReq.current) setSkills(json.data)
    } catch (e: any) {
      if (id === skillsReq.current) setError(String(e?.message || e))
    } finally {
      if (id === skillsReq.current) setLoadingSkills(false)
    }
  }, [queryString])

  const fetchBenchmark = useCallback(async () => {
    const id = ++benchmarkReq.current
    setLoadingBenchmark(true)
    try {
      const r = await fetch(`/api/enterprise/data-board/benchmark?token=${encodeURIComponent(token)}`)
      const json = await r.json()
      if (!json.success) throw new Error(json.error?.message || json.message || '加载失败')
      if (id === benchmarkReq.current) setBenchmark(json.data)
    } catch (e: any) {
      if (id === benchmarkReq.current) setError(String(e?.message || e))
    } finally {
      if (id === benchmarkReq.current) setLoadingBenchmark(false)
    }
  }, [token])

  useEffect(() => { fetchOverview() }, [fetchOverview])
  useEffect(() => { if (tab === 'skills') fetchSkills() }, [tab, fetchSkills])
  useEffect(() => { fetchBenchmark() }, [fetchBenchmark])
  useEffect(() => {
    if (benchmark?.jobs.length && !benchmark.jobs.some(j => j.id === selectedJobId)) {
      setSelectedJobId(benchmark.jobs[0].id)
    }
  }, [benchmark, selectedJobId])
  useEffect(() => {
    const onFs = () => setPresent(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  const setFilter = (key: keyof Filters, value: string) => setFilters(f => ({ ...f, [key]: value }))
  const resetFilters = () => setFilters(EMPTY_FILTERS)
  const openJobs = (title: string, query: DrawerQuery, subtitle?: string) => setDrawer({ title, query, subtitle })

  const togglePresent = async () => {
    try {
      if (!document.fullscreenElement) await boardRef.current?.requestFullscreen?.()
      else await document.exitFullscreen?.()
    } catch { /* 浏览器拒绝全屏时保持普通模式 */ }
  }

  const selectedJob = useMemo(
    () => benchmark?.jobs.find(j => j.id === selectedJobId) || benchmark?.jobs[0] || null,
    [benchmark, selectedJobId],
  )

  const cityPoints = useMemo(() => (overview?.cities || [])
    .filter(x => x.salary.p50 != null && x.salary.sample > 0)
    .map(x => ({
      city: x.city,
      jobs: x.jobs,
      share: x.share,
      companies: x.companies,
      top_field: x.top_field,
      p25: x.salary.p25,
      p50: x.salary.p50,
      p75: x.salary.p75,
      sample: x.salary.sample,
    })), [overview])

  const avgCityJobs = useMemo(
    () => (cityPoints.length ? Math.round(cityPoints.reduce((s, x) => s + x.jobs, 0) / cityPoints.length) : 0),
    [cityPoints],
  )

  const fieldTreemapData = useMemo(() => (overview?.fields || []).map((f, i) => ({
    ...f,
    name: f.field,
    color: DATA_COLORS[i % DATA_COLORS.length],
    size: f.jobs,
  })), [overview])

  const histWithCum = useMemo(() => {
    let run = 0
    return (overview?.salary_hist || []).map(item => {
      run += item.share
      return { ...item, cum: Math.min(100, Math.round(run)) }
    })
  }, [overview])

  const sourceDonut = useMemo(() => {
    const list = (overview?.source_mix || []).slice(0, 6).map((s, i) => ({
      name: s.source,
      value: s.jobs,
      share: s.share,
      color: DATA_COLORS[i % DATA_COLORS.length],
    }))
    const rest = (overview?.source_mix || []).slice(6)
    if (rest.length) {
      const value = rest.reduce((s, x) => s + x.jobs, 0)
      const share = rest.reduce((s, x) => s + x.share, 0)
      list.push({ name: '其他来源', value, share: Math.round(share * 10) / 10, color: '#94a3b8' })
    }
    return list
  }, [overview])

  const skillPoints = useMemo(() => (skills?.top_skills || [])
    .filter(s => s.premium_pct != null)
    .map(s => ({
      ...s,
      x: s.demand,
      y: s.premium_pct as number,
      z: Math.max(1, s.salary_sample),
      color: QUADRANT_COLORS[s.quadrant] || '#94a3b8',
    })), [skills])

  const medianSkillDemand = useMemo(() => {
    const vals = skillPoints.map(s => s.x).sort((a, b) => a - b)
    return vals.length ? vals[Math.floor(vals.length / 2)] : 0
  }, [skillPoints])

  const premiumDomain = useMemo(() => {
    const ys = skillPoints.map(s => s.y)
    return [Math.min(-20, ...ys), Math.max(80, ...ys)] as [number, number]
  }, [skillPoints])

  const clusterData = useMemo(() => (skills?.clusters || []).map((cl, i) => ({
    ...cl,
    name: cl.name,
    fill: CLUSTER_COLORS[i % CLUSTER_COLORS.length],
    color: CLUSTER_COLORS[i % CLUSTER_COLORS.length],
    size: cl.member_count,
  })), [skills])

  const selectedSkillInfo = useMemo(
    () => skills?.top_skills.find(s => s.name === selectedSkill) || null,
    [skills, selectedSkill],
  )

  const relatedSkills = useMemo(() => {
    if (!skills || !selectedSkill) return []
    return skills.network.links
      .filter(l => (typeof l.source === 'string' ? l.source : l.source.id) === selectedSkill || l.target === selectedSkill || (typeof l.target === 'object' && l.target.id === selectedSkill))
      .map(l => {
        const sourceId = typeof l.source === 'string' ? l.source : l.source.id
        const targetId = typeof l.target === 'string' ? l.target : l.target.id
        const other = sourceId === selectedSkill ? targetId : sourceId
        return { name: other, weight: l.weight, lift: l.lift }
      })
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 8)
  }, [skills, selectedSkill])

  const expBands = useMemo(
    () => (overview?.salary_by_experience || []).filter(x => x.label !== '未知' && x.label !== '其他'),
    [overview],
  )
  const eduBands = useMemo(
    () => (overview?.salary_by_education || []).filter(x => x.label !== '未知' && x.label !== '其他'),
    [overview],
  )

  const topFieldLegend = useMemo(() => {
    const seen = new Set<string>()
    return (overview?.fields || []).filter(f => {
      if (seen.has(f.field)) return false
      seen.add(f.field)
      return true
    }).slice(0, 6).map(f => f.field)
  }, [overview])

  return (
    <div ref={boardRef} className="min-h-full"
      style={{
        background: c.dark
          ? 'radial-gradient(1200px 420px at 18% -10%, rgba(109,94,252,0.16), transparent), radial-gradient(900px 380px at 92% 0%, rgba(14,165,233,0.10), transparent), var(--color-background)'
          : 'radial-gradient(1200px 420px at 18% -10%, rgba(109,94,252,0.10), transparent), radial-gradient(900px 380px at 92% 0%, rgba(14,165,233,0.08), transparent), var(--color-background)',
      }}>
      <div className={`mx-auto space-y-5 py-6 ${present ? 'max-w-none px-6' : 'max-w-[1500px] px-8'}`}>
        {/* 头部 */}
        <header className="relative overflow-hidden rounded-2xl border p-6"
          style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
          <div className="absolute -right-10 -top-16 h-56 w-56 rounded-full opacity-20 blur-3xl" style={{ background: '#6d5efc' }} />
          <div className="absolute -bottom-24 left-1/3 h-52 w-52 rounded-full opacity-10 blur-3xl" style={{ background: '#0ea5e9' }} />
          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold" style={{ color: 'var(--color-primary)' }}>
                <Sparkles className="h-3.5 w-3.5" /> 企业招聘决策 · 市场洞察
              </div>
              <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--color-on-surface)' }}>
                人才市场全景与技能洞察
              </h1>
              <p className="mt-1 max-w-2xl text-[12px] leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>
                把岗位、城市、薪资、技能与岗位簇放在同一套口径下，回答三个问题：市场在哪里、技能在往哪走、我们的岗位竞争力如何。
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px]" style={{ color: 'var(--color-on-surface-variant)' }}>
                <span className="rounded-full px-2 py-0.5" style={{ background: 'var(--color-surface-container)' }}>
                  样本 {overview?.meta.filtered_jobs ?? '—'} 岗位
                </span>
                <span className="rounded-full px-2 py-0.5" style={{ background: 'var(--color-surface-container)' }}>
                  数据更新 {overview?.meta.loaded_at?.slice(5) ?? '—'}
                </span>
                <span className="rounded-full px-2 py-0.5" style={{ background: 'var(--color-surface-container)' }}>
                  口径：data_type=1，去重后
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setNoteOpen(true)}
                className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[11px] font-medium transition-colors hover:bg-[var(--color-surface-container-low)]"
                style={{ borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface)' }}>
                <Info className="h-3.5 w-3.5" /> 数据说明
              </button>
              <button onClick={togglePresent}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-semibold text-white shadow-sm"
                style={{ background: 'linear-gradient(135deg, #6d5efc, #4f46e5)' }}>
                {present ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                {present ? '退出演示' : '演示模式'}
              </button>
            </div>
          </div>
        </header>

        {/* 结论条 */}
        {overview?.insights?.length ? (
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            {overview.insights.slice(0, 4).map((text, i) => (
              <motion.div key={text} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                className="flex items-start gap-2 rounded-xl border px-3 py-2.5"
                style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: DATA_COLORS[i % DATA_COLORS.length] }} />
                <p className="text-[11px] leading-relaxed" style={{ color: 'var(--color-on-surface)' }}>{text}</p>
              </motion.div>
            ))}
          </div>
        ) : null}

        {/* 筛选 */}
        {tab === 'benchmark' ? (
          <div className="flex items-center gap-2 rounded-xl border px-3 py-2.5 text-[11px]"
            style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)', color: 'var(--color-on-surface-variant)' }}>
            <Target className="h-3.5 w-3.5" />
            招聘对标使用全量市场样本与本企业在招岗位，不受上方城市/领域筛选影响
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2.5"
            style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
            <span className="mr-1 flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: 'var(--color-on-surface-variant)' }}>
              <Layers className="h-3.5 w-3.5" /> 筛选
            </span>
            <FilterSelect value={filters.city} onChange={v => setFilter('city', v)} placeholder="全部城市"
              options={overview?.filters.cities || []} />
            <FilterSelect value={filters.field} onChange={v => setFilter('field', v)} placeholder="全部领域"
              options={overview?.filters.fields || []} />
            <FilterSelect value={filters.experience} onChange={v => setFilter('experience', v)} placeholder="全部经验"
              options={overview?.filters.experiences || []} />
            <FilterSelect value={filters.education} onChange={v => setFilter('education', v)} placeholder="全部学历"
              options={overview?.filters.educations || []} />
            <select value={filters.salary} onChange={e => setFilter('salary', e.target.value)}
              className="rounded-md border px-2 py-1.5 text-[11px] outline-none"
              style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface)', color: 'var(--color-on-surface)' }}>
              <option value="">全部薪资</option>
              {(overview?.filters.salary_bands || []).map(x => <option key={x.value} value={x.value}>{x.label}</option>)}
            </select>
            <button onClick={resetFilters}
              className="rounded-md px-2 py-1.5 text-[11px] transition-colors hover:bg-[var(--color-surface-container)]"
              style={{ color: 'var(--color-on-surface-variant)' }}>
              重置
            </button>
            <span className="ml-auto text-[10px] tabular-nums" style={{ color: 'var(--color-on-surface-variant)' }}>
              当前 {overview?.meta.filtered_jobs ?? '—'} / {overview?.meta.all_jobs ?? '—'} 个岗位
              {overview?.meta.is_filtered ? '（已筛选）' : ''}
            </span>
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-2">
          {TABS.map(t => {
            const active = tab === t.key
            const Icon = t.icon
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                className="relative flex items-center gap-2 rounded-lg px-4 py-2 text-[12px] font-semibold transition-colors"
                style={{ color: active ? 'var(--color-primary)' : 'var(--color-on-surface-variant)', background: active ? 'var(--color-primary-fixed)' : 'transparent' }}>
                <Icon className="h-3.5 w-3.5" /> {t.label}
                {active && <motion.span layoutId="board-tab" className="absolute inset-x-2 -bottom-[1px] h-[2px] rounded-full" style={{ background: 'var(--color-primary)' }} />}
              </button>
            )
          })}
          {error && (
            <span className="ml-auto rounded-md px-2 py-1 text-[10px]"
              style={{ background: 'var(--accent-red-dim)', color: 'var(--accent-red-strong)' }}>{error}</span>
          )}
        </div>

        {/* 视图 */}
        {tab === 'overview' && (
          loadingOverview || !overview ? <LoadingBlock label="正在汇总市场数据…" /> : (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                <KpiCard label="岗位样本" value={overview.kpis.jobs.toLocaleString()} suffix="个" hint={`去重前 ${overview.meta.raw_jobs} 条`} accent="#6d5efc" icon={<Briefcase className="h-4 w-4" />} />
                <KpiCard label="覆盖企业" value={overview.kpis.companies.toLocaleString()} suffix="家" hint={`${overview.kpis.cities} 个城市`} accent="#0ea5e9" icon={<Building2 className="h-4 w-4" />} />
                <KpiCard label="薪资中位数" value={fmtK(overview.kpis.median_salary_k)} suffix="" hint={`P75 ${fmtK(overview.kpis.p75_salary_k)} · 样本 ${overview.kpis.salary_samples}`} accent="#10b981" icon={<TrendingUp className="h-4 w-4" />} />
                <KpiCard label="高薪岗位占比" value={`${overview.kpis.high_salary_ratio}%`} suffix="" hint="薪资区间中点 ≥ 20K 的岗位" accent="#f59e0b" icon={<Zap className="h-4 w-4" />} />
                <KpiCard label="技能标签" value={overview.kpis.skills.toLocaleString()} suffix="个" hint="标准化后去重" accent="#8b5cf6" icon={<Network className="h-4 w-4" />} />
                <KpiCard label="薪资覆盖率" value={`${overview.kpis.salary_coverage}%`} suffix="" hint="仅带有效薪资的岗位" accent="#ef4444" icon={<Database className="h-4 w-4" />} />
              </div>

              <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
                <BoardCard index="01" title="城市人才市场矩阵" subtitle="横轴岗位量，纵轴薪资中位数，气泡大小=薪资样本量；点击城市下钻"
                  className="xl:col-span-7">
                  <ResponsiveContainer width="100%" height={328}>
                    <ScatterChart margin={{ top: 12, right: 20, bottom: 16, left: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={c.grid} />
                      <XAxis type="number" dataKey="jobs" name="岗位量" scale="sqrt" domain={[0, 'dataMax']}
                        tick={{ fontSize: 10, fill: c.axis }} tickLine={false} axisLine={{ stroke: c.axisLine }}
                        tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)} />
                      <YAxis type="number" dataKey="p50" name="薪资中位数" unit="K" width={46}
                        tick={{ fontSize: 10, fill: c.axis }} tickLine={false} axisLine={{ stroke: c.axisLine }} />
                      <ZAxis type="number" dataKey="sample" range={[70, 540]} />
                      <Tooltip content={<CityTip />} cursor={{ strokeDasharray: '3 3' }} />
                      <ReferenceLine x={avgCityJobs} stroke={c.axisLine} strokeDasharray="4 4"
                        label={{ value: '平均岗位量', fontSize: 9, fill: c.axis, position: 'insideTopRight' }} />
                      {overview.kpis.median_salary_k != null && (
                        <ReferenceLine y={overview.kpis.median_salary_k} stroke={c.axisLine} strokeDasharray="4 4"
                          label={{ value: '整体中位', fontSize: 9, fill: c.axis, position: 'insideBottomRight' }} />
                      )}
                      <Scatter data={cityPoints} onClick={(_: any, index: number) => {
                        const point = cityPoints[index]
                        if (point) openJobs(`${point.city} 岗位`, { city: point.city }, `${point.jobs} 个岗位 · 中位 ${fmtK(point.p50)}`)
                      }}>
                        {cityPoints.map(point => (
                          <Cell key={point.city} fill={fieldColor(point.top_field)} fillOpacity={0.76}
                            stroke={fieldColor(point.top_field)} strokeWidth={1} />
                        ))}
                      </Scatter>
                    </ScatterChart>
                  </ResponsiveContainer>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px]"
                    style={{ color: 'var(--color-on-surface-variant)' }}>
                    {topFieldLegend.map(f => (
                      <span key={f} className="inline-flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full" style={{ background: fieldColor(f) }} />{f}
                      </span>
                    ))}
                    <span className="ml-auto">仅展示有薪资样本的城市；气泡越大样本越多</span>
                  </div>
                </BoardCard>

                <BoardCard index="02" title="技术领域结构" subtitle="面积=岗位量，颜色=领域；点击领域下钻"
                  className="xl:col-span-5">
                  <ResponsiveContainer width="100%" height={328}>
                    <Treemap data={fieldTreemapData} dataKey="jobs" nameKey="name" aspectRatio={4 / 3}
                      stroke="none" content={<FieldTreemapContent />}
                      onClick={(node: any) => {
                        if (node?.field) openJobs(`${node.field} 岗位`, { field: node.field }, `${node.jobs} 个岗位 · 中位 ${node.salary?.p50 != null ? `${node.salary.p50}K` : '样本不足'}`)
                      }}>
                      <Tooltip content={<FieldTip />} />
                    </Treemap>
                  </ResponsiveContainer>
                  <p className="mt-1 text-[10px]" style={{ color: 'var(--color-on-surface-variant)' }}>
                    领域由岗位标题 + 技能标签规则归一，避免原始大类过粗
                  </p>
                </BoardCard>
              </div>

              <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
                <BoardCard index="03" title="薪资分布与累计曲线" subtitle={`有效薪资样本 ${overview.kpis.salary_samples} 条，P25 ${fmtK(overview.kpis.p25_salary_k)} · P50 ${fmtK(overview.kpis.median_salary_k)} · 仅统计月薪`}
                  className="xl:col-span-6">
                  <ResponsiveContainer width="100%" height={252}>
                    <ComposedChart data={histWithCum} margin={{ top: 12, right: 14, bottom: 4, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={c.grid} vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 9, fill: c.axis }} tickLine={false} axisLine={{ stroke: c.axisLine }} interval={0} />
                      <YAxis yAxisId="left" width={36} tick={{ fontSize: 9, fill: c.axis }} tickLine={false} axisLine={false} />
                      <YAxis yAxisId="right" orientation="right" width={36} domain={[0, 100]} unit="%" tick={{ fontSize: 9, fill: c.axis }} tickLine={false} axisLine={false} />
                      <Tooltip content={<SalaryTip />} cursor={{ fill: 'rgba(109,94,252,0.06)' }} />
                      <Bar yAxisId="left" dataKey="count" radius={[4, 4, 0, 0]} fill={c.primary} fillOpacity={0.76} maxBarSize={34} />
                      <Line yAxisId="right" type="monotone" dataKey="cum" stroke={c.orange} strokeWidth={2} dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                  <div className="mt-1 flex items-center gap-4 text-[10px]" style={{ color: 'var(--color-on-surface-variant)' }}>
                    <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm" style={{ background: c.primary }} />岗位数</span>
                    <span className="inline-flex items-center gap-1"><span className="h-[2px] w-4" style={{ background: c.orange }} />累计占比</span>
                    <span className="ml-auto">薪资覆盖率 {overview.kpis.salary_coverage}%</span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {overview.salary_months.map(m => (
                      <span key={m.label} className="rounded-full px-2 py-0.5 text-[9px]"
                        style={{ background: 'var(--color-surface-container)', color: 'var(--color-on-surface-variant)' }}>
                        {m.label} · {m.count}
                      </span>
                    ))}
                    <span className="ml-auto text-[9px]" style={{ color: 'var(--color-on-surface-variant)' }}>月数按来源标注统计</span>
                  </div>
                </BoardCard>

                <BoardCard index="04" title="经验与学历薪资带" subtitle="P25–P75 区间与中位数，n 为有效薪资样本；样本少的组只看趋势"
                  className="xl:col-span-6">
                  <div className="grid gap-6 md:grid-cols-2">
                    <div>
                      <h3 className="mb-2 text-[11px] font-bold" style={{ color: 'var(--color-on-surface)' }}>按经验</h3>
                      <SalaryBands items={expBands} accent={c.primary} />
                    </div>
                    <div>
                      <h3 className="mb-2 text-[11px] font-bold" style={{ color: 'var(--color-on-surface)' }}>按学历</h3>
                      <SalaryBands items={eduBands} accent={c.cyan} />
                    </div>
                  </div>
                </BoardCard>
              </div>

              <BoardCard index="05" title="城市 × 领域岗位热力" subtitle="颜色越深岗位越多；点击单元格同时锁定城市与领域，查看具体岗位"
                right={<span className="text-[10px]" style={{ color: 'var(--color-on-surface-variant)' }}>Top {overview.field_city_heat.cities.length} 城市 × Top {overview.field_city_heat.fields.length} 领域</span>}>
                <Heatmap cities={overview.field_city_heat.cities} fields={overview.field_city_heat.fields}
                  values={overview.field_city_heat.values}
                  onCell={(city, field, value) => {
                    if (!value) return
                    setFilters(f => ({ ...f, city, field }))
                    openJobs(`${city} · ${field}`, { city, field }, `${value} 个岗位`)
                  }} />
              </BoardCard>

              <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
                <BoardCard index="06" title="数据来源结构" subtitle="样本来自公开招聘页面；单一来源占比过高会影响外推" className="xl:col-span-4">
                  <div className="relative">
                    <ResponsiveContainer width="100%" height={190}>
                      <PieChart>
                        <Pie data={sourceDonut} dataKey="value" nameKey="name" innerRadius="56%" outerRadius="82%"
                          paddingAngle={2} stroke="none">
                          {sourceDonut.map(s => <Cell key={s.name} fill={s.color} />)}
                        </Pie>
                        <Tooltip formatter={(value: any, name: any) => [`${value} 个岗位`, name]} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-lg font-extrabold tabular-nums" style={{ color: 'var(--color-on-surface)' }}>
                        {overview.kpis.jobs.toLocaleString()}
                      </span>
                      <span className="text-[9px]" style={{ color: 'var(--color-on-surface-variant)' }}>去重样本</span>
                    </div>
                  </div>
                  <div className="mt-2 space-y-1.5">
                    {sourceDonut.map(s => (
                      <div key={s.name} className="flex items-center gap-2 text-[10px]">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} />
                        <span className="min-w-0 flex-1 truncate" style={{ color: 'var(--color-on-surface-variant)' }}>{s.name}</span>
                        <span className="tabular-nums" style={{ color: 'var(--color-on-surface)' }}>{s.value}</span>
                        <span className="w-10 text-right tabular-nums" style={{ color: 'var(--color-on-surface-variant)' }}>{s.share}%</span>
                      </div>
                    ))}
                  </div>
                </BoardCard>

                <BoardCard index="07" title="字段完整率" subtitle="直接决定哪些维度可以下结论；薪资与发布时间是主要短板" className="xl:col-span-4">
                  <div className="space-y-3">
                    {overview.completeness.map(item => (
                      <div key={item.key}>
                        <div className="mb-1 flex items-center justify-between text-[10px]">
                          <span style={{ color: 'var(--color-on-surface-variant)' }}>{item.label}</span>
                          <span className="tabular-nums" style={{ color: 'var(--color-on-surface)' }}>{item.covered} / {item.total}</span>
                        </div>
                        <PercentBar pct={item.pct} color={item.pct >= 80 ? c.green : item.pct >= 50 ? c.orange : c.red} />
                      </div>
                    ))}
                  </div>
                </BoardCard>

                <BoardCard index="08" title="清洗漏斗与时间覆盖" subtitle="从原始采集到可分析样本；发布时间只覆盖部分样本，不做全市场趋势外推" className="xl:col-span-4">
                  <div className="mb-4 space-y-2">
                    {[
                      { label: '原始岗位', value: overview.meta.raw_jobs, color: '#94a3b8' },
                      { label: '去重后样本', value: overview.meta.all_jobs, color: c.primary },
                      { label: '有效薪资样本', value: overview.kpis.salary_samples, color: c.green },
                    ].map(item => (
                      <div key={item.label}>
                        <div className="mb-1 flex justify-between text-[10px]">
                          <span style={{ color: 'var(--color-on-surface-variant)' }}>{item.label}</span>
                          <span className="tabular-nums" style={{ color: 'var(--color-on-surface)' }}>{item.value}</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--color-surface-container)' }}>
                          <div className="h-full rounded-full" style={{ width: `${(item.value / Math.max(1, overview.meta.raw_jobs)) * 100}%`, background: item.color }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="mb-1 text-[10px]" style={{ color: 'var(--color-on-surface-variant)' }}>采集批次（月）</p>
                      <MiniBars items={overview.time_coverage.crawl_months.map(x => ({ label: x.month, value: x.count }))} color={c.cyan} />
                    </div>
                    <div>
                      <p className="mb-1 text-[10px]" style={{ color: 'var(--color-on-surface-variant)' }}>发布时间覆盖（月）</p>
                      <MiniBars items={overview.time_coverage.publish_months.slice(-9).map(x => ({ label: x.month, value: x.count }))} color={c.orange} />
                    </div>
                  </div>
                  <p className="mt-2 text-[9px]" style={{ color: 'var(--color-on-surface-variant)' }}>
                    去重移除 {overview.meta.dedup_removed} 条；有发布时间 {overview.time_coverage.publish_samples} 条
                  </p>
                </BoardCard>
              </div>
            </div>
          )
        )}

        {tab === 'skills' && (
          loadingSkills || !skills ? <LoadingBlock label="正在计算技能共现与岗位簇…" /> : (
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
                <BoardCard index="01" title="技能需求 × 薪资溢价象限" subtitle="横轴需求岗位数，纵轴相对市场薪资中位的溢价；气泡大小=薪资样本量；点击查看岗位"
                  className="xl:col-span-7">
                  <ResponsiveContainer width="100%" height={340}>
                    <ScatterChart margin={{ top: 12, right: 18, bottom: 16, left: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={c.grid} />
                      <XAxis type="number" dataKey="x" name="需求岗位" scale="sqrt" domain={[0, 'dataMax']}
                        tick={{ fontSize: 10, fill: c.axis }} tickLine={false} axisLine={{ stroke: c.axisLine }} />
                      <YAxis type="number" dataKey="y" name="薪资溢价" unit="%" width={48} domain={premiumDomain}
                        tick={{ fontSize: 10, fill: c.axis }} tickLine={false} axisLine={{ stroke: c.axisLine }} />
                      <ZAxis type="number" dataKey="z" range={[50, 460]} />
                      <Tooltip content={<SkillTip />} cursor={{ strokeDasharray: '3 3' }} />
                      <ReferenceLine y={0} stroke={c.axisLine} strokeDasharray="4 4"
                        label={{ value: '市场平均', fontSize: 9, fill: c.axis, position: 'insideTopRight' }} />
                      <ReferenceLine x={medianSkillDemand} stroke={c.axisLine} strokeDasharray="4 4"
                        label={{ value: '需求中位', fontSize: 9, fill: c.axis, position: 'insideBottomRight' }} />
                      <Scatter data={skillPoints} onClick={(_: any, index: number) => {
                        const point = skillPoints[index]
                        if (point) openJobs(`${point.name} 相关岗位`, { skill: point.name }, `${point.demand} 个岗位要求该技能`)
                      }}>
                        {skillPoints.map(point => <Cell key={point.name} fill={point.color} fillOpacity={0.8} stroke={point.color} />)}
                      </Scatter>
                    </ScatterChart>
                  </ResponsiveContainer>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px]" style={{ color: 'var(--color-on-surface-variant)' }}>
                    {Object.entries(QUADRANT_COLORS).map(([label, color]) => (
                      <span key={label} className="inline-flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full" style={{ background: color }} />{label}
                      </span>
                    ))}
                    <span className="ml-auto">样本 {skills.meta.salary_samples} 条 · 中位 {fmtK(skills.meta.overall_median_salary_k)}</span>
                  </div>
                </BoardCard>

                <BoardCard index="02" title="技能需求榜" subtitle="按需求岗位数排序；点击行查看相关岗位"
                  className="xl:col-span-5">
                  <div className="max-h-[378px] space-y-1 overflow-y-auto pr-1">
                    {skills.top_skills.slice(0, 18).map((skill, i) => (
                      <button key={skill.name} onClick={() => openJobs(`${skill.name} 相关岗位`, { skill: skill.name }, `${skill.demand} 个岗位要求该技能`)}
                        className="grid w-full grid-cols-[18px_1fr_64px_54px] items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-[var(--color-surface-container-low)]">
                        <span className="text-[9px] tabular-nums" style={{ color: 'var(--color-on-surface-variant)' }}>{String(i + 1).padStart(2, '0')}</span>
                        <span className="min-w-0">
                          <span className="flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: fieldColor(skill.field) }} />
                            <span className="truncate text-[11px] font-medium" style={{ color: 'var(--color-on-surface)' }}>{skill.name}</span>
                          </span>
                          <span className="mt-0.5 block h-1 overflow-hidden rounded-full" style={{ background: 'var(--color-surface-container)' }}>
                            <span className="block h-full rounded-full" style={{ width: `${Math.min(100, (skill.demand / (skills.top_skills[0]?.demand || 1)) * 100)}%`, background: fieldColor(skill.field) }} />
                          </span>
                        </span>
                        <span className="text-right text-[10px] tabular-nums" style={{ color: 'var(--color-on-surface-variant)' }}>{skill.demand}</span>
                        <span className="text-right text-[10px] font-semibold tabular-nums"
                          style={{ color: (skill.premium_pct ?? 0) >= 0 ? c.green : c.red }}>
                          {signed(skill.premium_pct)}
                        </span>
                      </button>
                    ))}
                  </div>
                </BoardCard>
              </div>

              <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
                <BoardCard index="03" title="技能共现网络" subtitle="节点大小=需求岗位数，颜色=主领域；连线表示同一岗位同时要求，按共现次数与 lift 过滤"
                  className="xl:col-span-8">
                  <SkillNetwork nodes={skills.network.nodes} links={skills.network.links}
                    selected={selectedSkill} onSelect={name => setSelectedSkill(name)}
                    theme={theme} height={present ? 560 : 450} />
                </BoardCard>

                <BoardCard index="04" title={selectedSkill ? `技能详情 · ${selectedSkill}` : '技能详情'}
                  subtitle={selectedSkill ? '点击左侧网络中的其他节点可切换' : '点击网络节点，查看需求、薪资与关联技能'}
                  className="xl:col-span-4">
                  {selectedSkillInfo ? (
                    <div className="space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-extrabold" style={{ color: 'var(--color-on-surface)' }}>{selectedSkillInfo.name}</h3>
                          <p className="mt-0.5 flex items-center gap-1.5 text-[10px]" style={{ color: 'var(--color-on-surface-variant)' }}>
                            <span className="h-2 w-2 rounded-full" style={{ background: fieldColor(selectedSkillInfo.field) }} />
                            {selectedSkillInfo.field} · {selectedSkillInfo.quadrant}
                          </p>
                        </div>
                        <span className="rounded-full px-2 py-1 text-[10px] font-semibold"
                          style={{ background: `${QUADRANT_COLORS[selectedSkillInfo.quadrant] || '#94a3b8'}1f`, color: QUADRANT_COLORS[selectedSkillInfo.quadrant] || '#94a3b8' }}>
                          {signed(selectedSkillInfo.premium_pct)}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <MetricBox label="需求岗位" value={`${selectedSkillInfo.demand}`} hint={`覆盖 ${selectedSkillInfo.share}%`} />
                        <MetricBox label="薪资中位" value={fmtK(selectedSkillInfo.median_salary_k)} hint={`样本 ${selectedSkillInfo.salary_sample}`} />
                      </div>
                      <div>
                        <p className="mb-1.5 text-[10px] font-semibold" style={{ color: 'var(--color-on-surface-variant)' }}>关联技能</p>
                        <div className="flex flex-wrap gap-1.5">
                          {relatedSkills.length ? relatedSkills.map(r => (
                            <button key={r.name} onClick={() => setSelectedSkill(r.name)}
                              className="rounded-full px-2 py-1 text-[10px] transition-transform hover:scale-105"
                              style={{ background: 'var(--color-surface-container)', color: 'var(--color-on-surface)' }}>
                              {r.name} <span className="opacity-50">×{r.weight}</span>
                            </button>
                          )) : <span className="text-[10px]" style={{ color: 'var(--color-on-surface-variant)' }}>暂无强关联</span>}
                        </div>
                      </div>
                      <button onClick={() => openJobs(`${selectedSkillInfo.name} 相关岗位`, { skill: selectedSkillInfo.name }, `${selectedSkillInfo.demand} 个岗位要求该技能`)}
                        className="flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-[11px] font-semibold text-white"
                        style={{ background: 'linear-gradient(135deg, #6d5efc, #4f46e5)' }}>
                        查看相关岗位 <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <EmptyBlock title="选择一个技能节点" hint="网络中的圆点代表技能，节点越大市场越需要；点击后这里会显示薪资溢价与关联技能。" />
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(FIELD_COLORS).map(([field, color]) => (
                          <span key={field} className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[9px]"
                            style={{ background: 'var(--color-surface-container)', color: 'var(--color-on-surface-variant)' }}>
                            <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />{field}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </BoardCard>
              </div>

              <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
                <BoardCard index="05" title="岗位簇景观" subtitle="面积=当前筛选下的成员岗位数；颜色=技术栈；点击查看簇内岗位"
                  className="xl:col-span-8">
                  {clusterData.length ? (
                    <ResponsiveContainer width="100%" height={330}>
                      <Treemap data={clusterData} dataKey="member_count" nameKey="name" aspectRatio={5 / 3}
                        stroke="none" content={<ClusterTreemapContent />}
                        onClick={(node: any) => {
                          if (node?.id != null) openJobs(`岗位簇 · ${node.name}`, { cluster_id: node.id }, `${node.member_count} 个成员岗位 · 主城市 ${node.top_city}`)
                        }}>
                        <Tooltip content={<ClusterTip />} />
                      </Treemap>
                    </ResponsiveContainer>
                  ) : <EmptyBlock title="当前筛选下没有岗位簇成员" hint="尝试放宽城市或领域筛选" />}
                </BoardCard>

                <BoardCard index="06" title="岗位能力变更监测" subtitle="来自 job_skill_changes 的原始 diff，窗口很短，只作为监测信号"
                  className="xl:col-span-4">
                  <div className="mb-3 flex items-center justify-between text-[10px]" style={{ color: 'var(--color-on-surface-variant)' }}>
                    <span>{skills.change_monitor.window.start || '—'} ~ {skills.change_monitor.window.end || '—'}</span>
                    <span className="tabular-nums">{skills.change_monitor.records} 条记录</span>
                  </div>
                  <ChangeList title="新增技能" items={skills.change_monitor.added} color={c.green} />
                  <div className="my-3 border-t" style={{ borderColor: 'var(--color-outline-variant)' }} />
                  <ChangeList title="移除技能" items={skills.change_monitor.removed} color={c.red} />
                  <p className="mt-3 rounded-md px-2 py-1.5 text-[9px] leading-relaxed"
                    style={{ background: 'rgba(245,158,11,0.1)', color: '#b45309' }}>
                    {skills.change_monitor.note}
                  </p>
                </BoardCard>
              </div>
            </div>
          )
        )}

        {tab === 'benchmark' && (
          loadingBenchmark || !benchmark ? <LoadingBlock label="正在计算岗位竞争力…" /> : (
            !benchmark.has_jobs ? (
              <BoardCard title="还没有在招岗位" subtitle="发布岗位后，系统会用同技能市场岗位做薪资与技能对标">
                <EmptyBlock title="暂无对标数据" hint="先到「岗位管理」发布或启用一个岗位，再回到这里查看竞争力诊断。" />
                <div className="flex justify-center">
                  <button onClick={() => setPage('jobs')}
                    className="rounded-lg px-4 py-2 text-[11px] font-semibold text-white"
                    style={{ background: 'linear-gradient(135deg, #6d5efc, #4f46e5)' }}>
                    去岗位管理
                  </button>
                </div>
              </BoardCard>
            ) : (
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <KpiCard label="在招岗位" value={benchmark.summary.own_jobs} suffix="个" hint={benchmark.summary.company_name || '本企业'} accent="#6d5efc" icon={<Briefcase className="h-4 w-4" />} />
                  <KpiCard label="本企业薪资中位" value={fmtK(benchmark.summary.own_median_salary_k)} suffix="" hint={`市场 ${fmtK(benchmark.summary.market_median_salary_k)}`} accent="#10b981" icon={<TrendingUp className="h-4 w-4" />} />
                  <KpiCard label="相对市场差距" value={signed(benchmark.summary.salary_gap_pct)} suffix="" hint="正数=高于市场中位" accent={((benchmark.summary.salary_gap_pct ?? 0) >= 0) ? '#10b981' : '#ef4444'} icon={(benchmark.summary.salary_gap_pct ?? 0) >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />} />
                  <KpiCard label="平均竞争力" value={benchmark.summary.avg_competitiveness ?? '—'} suffix="/100" hint="薪资·技能覆盖·热度·门槛的综合" accent="#f59e0b" icon={<Target className="h-4 w-4" />} />
                </div>

                <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
                  <BoardCard index="01" title="本企业在招岗位" subtitle="按综合竞争力排序；点击选择要诊断的岗位" className="xl:col-span-4">
                    <div className="max-h-[590px] space-y-2 overflow-y-auto pr-1">
                      {benchmark.jobs.map(job => {
                        const active = selectedJob?.id === job.id
                        return (
                          <button key={job.id} onClick={() => setSelectedJobId(job.id)}
                            className="w-full rounded-xl border px-3 py-2.5 text-left transition-all"
                            style={{
                              borderColor: active ? 'var(--color-primary)' : 'var(--color-outline-variant)',
                              background: active ? 'var(--color-primary-fixed)' : 'transparent',
                            }}>
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate text-[12px] font-semibold" style={{ color: 'var(--color-on-surface)' }}>{job.title}</p>
                                <p className="mt-1 flex items-center gap-2 text-[10px]" style={{ color: 'var(--color-on-surface-variant)' }}>
                                  <span>{job.field}</span><span>·</span><span>{job.location || '城市未填'}</span>
                                </p>
                              </div>
                              <span className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums"
                                style={{ background: 'var(--color-surface-container)', color: 'var(--color-primary)' }}>
                                {job.competitiveness ?? '—'}
                              </span>
                            </div>
                            <div className="mt-2 flex items-center justify-between text-[10px]">
                              <span className="tabular-nums" style={{ color: 'var(--color-on-surface-variant)' }}>
                                {job.salary_min_k != null && job.salary_max_k != null ? `${job.salary_min_k}-${job.salary_max_k}K` : '薪资未填'}
                              </span>
                              <span className="tabular-nums" style={{ color: 'var(--color-on-surface-variant)' }}>
                                {peerLabel(job.peer_basis)}对标 {job.peer_count} 个岗位
                              </span>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </BoardCard>

                  <div className="space-y-5 xl:col-span-8">
                    {selectedJob && (
                      <>
                        <BoardCard index="02" title={selectedJob.title}
                          subtitle={`${selectedJob.field} · ${selectedJob.location || '城市未填'} · ${peerLabel(selectedJob.peer_basis)}对标 ${selectedJob.peer_count} 个市场岗位`}
                          right={<span className="rounded-full px-2.5 py-1 text-[10px] font-bold"
                            style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-primary)' }}>
                            竞争力 {selectedJob.competitiveness ?? '—'} / 100
                          </span>}>
                          <div className="grid gap-6 md:grid-cols-2">
                            <div>
                              <h3 className="mb-3 text-[11px] font-bold" style={{ color: 'var(--color-on-surface)' }}>薪资对标</h3>
                              <SalaryCompare job={selectedJob} />
                              <div className="mt-4 grid grid-cols-3 gap-2">
                                <MetricBox label="技能覆盖" value={fmtPct(selectedJob.skill_coverage)} hint="对标高频技能" />
                                <MetricBox label="技能热度" value={fmtPct(selectedJob.skill_heat)} hint="需求归一化" />
                                <MetricBox label="门槛友好" value={fmtPct(selectedJob.experience_friendly)} hint="相对市场经验" />
                              </div>
                            </div>
                            <div>
                              <h3 className="mb-1 text-[11px] font-bold" style={{ color: 'var(--color-on-surface)' }}>竞争力雷达</h3>
                              <ResponsiveContainer width="100%" height={250}>
                                <RadarChart data={selectedJob.radar.map(r => ({ axis: r.axis, value: r.value ?? 0 }))} outerRadius="68%">
                                  <PolarGrid stroke={c.grid} />
                                  <PolarAngleAxis dataKey="axis" tick={{ fontSize: 10, fill: c.axis }} />
                                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} tickLine={false} axisLine={false} />
                                  <ReRadar dataKey="value" stroke={c.primary} fill={c.primary} fillOpacity={0.26} strokeWidth={2} />
                                  <Tooltip formatter={(value: any) => [`${value}`, '得分']} />
                                </RadarChart>
                              </ResponsiveContainer>
                              {selectedJob.radar.some(r => r.value == null) && (
                                <p className="text-[9px]" style={{ color: 'var(--color-on-surface-variant)' }}>缺失维度按 0 绘制（样本不足）</p>
                              )}
                            </div>
                          </div>
                        </BoardCard>

                        <div className="grid gap-5 md:grid-cols-2">
                          <BoardCard index="03" title="市场高频但本岗位未要求" subtitle="按对标岗位中的需求占比排序；点击查看岗位">
                            <div className="space-y-2">
                              {selectedJob.missing_skills.length ? selectedJob.missing_skills.map(skill => (
                                <button key={skill.name} onClick={() => openJobs(`${skill.name} 相关岗位`, { skill: skill.name }, `${skill.demand} 个市场岗位要求该技能`)}
                                  className="w-full rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-[var(--color-surface-container-low)]">
                                  <div className="flex items-center justify-between text-[10px]">
                                    <span className="font-medium" style={{ color: 'var(--color-on-surface)' }}>{skill.name}</span>
                                    <span className="tabular-nums" style={{ color: 'var(--color-on-surface-variant)' }}>
                                      {skill.median_salary_k != null ? `${skill.median_salary_k}K` : '样本不足'}
                                    </span>
                                  </div>
                                  <div className="mt-1 flex items-center gap-2">
                                    <PercentBar pct={skill.share} color={c.orange} />
                                    <span className="w-12 shrink-0 text-right text-[9px]" style={{ color: 'var(--color-on-surface-variant)' }}>
                                      {skill.demand} 个岗位
                                    </span>
                                  </div>
                                </button>
                              )) : <EmptyBlock title="没有明显技能缺口" hint="本岗位已经覆盖了对标岗位的高频技能" />}
                            </div>
                          </BoardCard>

                          <BoardCard index="04" title={`${peerLabel(selectedJob.peer_basis)}市场画像`} subtitle="绿色=本岗位已要求，橙色=市场更高频但未要求">
                            <div className="mb-3 flex flex-wrap gap-1.5">
                              {selectedJob.peer_top_skills.map(skill => {
                                const has = selectedJob.skills.some(s => s.toLowerCase() === skill.name.toLowerCase())
                                return (
                                  <span key={skill.name} className="rounded-full px-2 py-1 text-[10px]"
                                    style={{
                                      background: has ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
                                      color: has ? '#059669' : '#b45309',
                                    }}>
                                    {has ? '✓' : '+'} {skill.name} <span className="opacity-60">×{skill.count}</span>
                                  </span>
                                )
                              })}
                            </div>
                            <div className="rounded-lg border px-3 py-2" style={{ borderColor: 'var(--color-outline-variant)' }}>
                              <p className="text-[10px]" style={{ color: 'var(--color-on-surface-variant)' }}>市场薪资中位</p>
                              <p className="mt-1 text-lg font-extrabold tabular-nums" style={{ color: 'var(--color-primary)' }}>
                                {fmtK(benchmark.market.median_salary_k)}
                              </p>
                              <p className="text-[9px]" style={{ color: 'var(--color-on-surface-variant)' }}>
                                全市场有效薪资样本 {benchmark.market.salary_sample} 条
                              </p>
                            </div>
                            <button onClick={() => openJobs(`${selectedJob.skills[0] || selectedJob.field} 相关岗位`, selectedJob.skills[0] ? { skill: selectedJob.skills[0] } : { field: selectedJob.field }, '按本岗位核心技能匹配')}
                              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border py-2 text-[11px] font-semibold transition-colors hover:bg-[var(--color-surface-container-low)]"
                              style={{ borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface)' }}>
                              查看对标市场岗位 <ChevronRight className="h-3.5 w-3.5" />
                            </button>
                          </BoardCard>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )
          )
        )}
      </div>

      <JobDrawer open={!!drawer} onClose={() => setDrawer(null)}
        title={drawer?.title || ''} subtitle={drawer?.subtitle} query={drawer?.query || {}} token={token} />
      <DataNote open={noteOpen} onClose={() => setNoteOpen(false)} overview={overview} />
    </div>
  )
}

// ── 内部小组件 ──────────────────────────────────────────────

function FilterSelect({
  value, onChange, placeholder, options,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  options: string[]
}) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className="max-w-[140px] rounded-md border px-2 py-1.5 text-[11px] outline-none"
      style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface)', color: 'var(--color-on-surface)' }}>
      <option value="">{placeholder}</option>
      {options.map(option => <option key={option} value={option}>{option}</option>)}
    </select>
  )
}

function MetricBox({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg px-2.5 py-2" style={{ background: 'var(--color-surface-container-low)' }}>
      <p className="text-[9px]" style={{ color: 'var(--color-on-surface-variant)' }}>{label}</p>
      <p className="mt-0.5 text-sm font-extrabold tabular-nums" style={{ color: 'var(--color-on-surface)' }}>{value}</p>
      {hint && <p className="text-[8px]" style={{ color: 'var(--color-on-surface-variant)' }}>{hint}</p>}
    </div>
  )
}

function ChangeList({ title, items, color }: { title: string; items: Array<{ name: string; count: number }>; color: string }) {
  const max = Math.max(1, ...items.map(x => x.count))
  return (
    <div>
      <p className="mb-1.5 text-[10px] font-semibold" style={{ color: 'var(--color-on-surface-variant)' }}>{title}</p>
      <div className="space-y-1.5">
        {items.length ? items.map(item => (
          <div key={item.name} className="grid grid-cols-[92px_1fr_26px] items-center gap-2">
            <span className="truncate text-[10px]" style={{ color: 'var(--color-on-surface)' }}>{item.name}</span>
            <div className="h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--color-surface-container)' }}>
              <div className="h-full rounded-full" style={{ width: `${(item.count / max) * 100}%`, background: color }} />
            </div>
            <span className="text-right text-[9px] tabular-nums" style={{ color: 'var(--color-on-surface-variant)' }}>{item.count}</span>
          </div>
        )) : <p className="text-[10px]" style={{ color: 'var(--color-on-surface-variant)' }}>无记录</p>}
      </div>
    </div>
  )
}

function DataNote({
  open, onClose, overview,
}: {
  open: boolean
  onClose: () => void
  overview: OverviewData | null
}) {
  if (!open) return null
  const meta = overview?.meta
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center px-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={onClose} />
      <div className="relative max-h-[86vh] w-full max-w-3xl overflow-y-auto rounded-2xl border shadow-2xl"
        style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface)' }}>
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b px-6 py-4"
          style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface)' }}>
          <div>
            <h2 className="text-lg font-bold" style={{ color: 'var(--color-on-surface)' }}>数据口径与处理说明</h2>
            <p className="mt-1 text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>
              课程作业与作品说明文档共用口径；所有图表都基于同一份清洗后样本
            </p>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 hover:bg-[var(--color-surface-container-high)]"
            style={{ color: 'var(--color-on-surface-variant)' }} aria-label="关闭">
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="space-y-5 px-6 py-5 text-[12px] leading-relaxed" style={{ color: 'var(--color-on-surface)' }}>
          <section>
            <h3 className="mb-2 text-[12px] font-bold" style={{ color: 'var(--color-primary)' }}>01 · 数据来源</h3>
            <p style={{ color: 'var(--color-on-surface-variant)' }}>
              岗位样本来自公开招聘页面的岗位信息（腾讯招聘官网、智联招聘、Boss 直聘、猎聘、脉脉、拉勾等），
              数据由项目采集服务写入 MySQL `jobs` 表，仅使用岗位标题、企业、城市、薪资、经验、学历、技能标签等公开字段，
              不包含求职者个人信息。
            </p>
          </section>
          <section>
            <h3 className="mb-2 text-[12px] font-bold" style={{ color: 'var(--color-primary)' }}>02 · 清洗口径</h3>
            <ul className="list-disc space-y-1 pl-5" style={{ color: 'var(--color-on-surface-variant)' }}>
              <li>只保留 `data_type = 1` 的真实岗位，排除文章与政策文本。</li>
              <li>按「标题 + 企业 + 城市 + 薪资区间」去重，避免跨平台重复计数。</li>
              <li>有效薪资限定为 2,000–100,000 元/月，使用区间中点计算中位数与分位；13/14 薪单独统计，不混入月薪。</li>
              <li>经验与学历做分桶归一；技能标签做同义词合并（如 Python / python、大模型 / LLM、Agent / 智能体）。</li>
              <li>技术领域由「岗位标题 + 技能标签」规则推断，替代过粗的原始大类。</li>
            </ul>
          </section>
          <section>
            <h3 className="mb-2 text-[12px] font-bold" style={{ color: 'var(--color-primary)' }}>03 · 当前规模</h3>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <NoteMetric label="原始岗位" value={meta?.raw_jobs ?? '—'} />
              <NoteMetric label="去重样本" value={meta?.all_jobs ?? '—'} />
              <NoteMetric label="有效薪资" value={overview?.kpis.salary_samples ?? '—'} />
              <NoteMetric label="技能标签" value={overview?.kpis.skills ?? '—'} />
              <NoteMetric label="企业" value={overview?.kpis.companies ?? '—'} />
              <NoteMetric label="城市" value={overview?.kpis.cities ?? '—'} />
              <NoteMetric label="薪资覆盖率" value={`${overview?.kpis.salary_coverage ?? '—'}%`} />
            </div>
          </section>
          <section>
            <h3 className="mb-2 text-[12px] font-bold" style={{ color: 'var(--color-primary)' }}>04 · 使用限制</h3>
            <ul className="list-disc space-y-1 pl-5" style={{ color: 'var(--color-on-surface-variant)' }}>
              <li>薪资覆盖率为 {overview?.kpis.salary_coverage ?? '—'}%，薪资结论必须同时看样本量，不能外推为全市场。</li>
              <li>腾讯招聘官网样本占比高且不含薪资，来源结构会影响城市与领域结论。</li>
              <li>发布时间字段只覆盖部分样本，因此不绘制“全市场月度趋势”；能力变更卡片只展示短窗口原始 diff。</li>
              <li>岗位簇为离线聚类结果，当前成员数与筛选条件联动，用于结构观察而非严格分类。</li>
            </ul>
          </section>
          <section>
            <h3 className="mb-2 text-[12px] font-bold" style={{ color: 'var(--color-primary)' }}>05 · 技术路线</h3>
            <p style={{ color: 'var(--color-on-surface-variant)' }}>
              数据层：MySQL `jobs` / `job_clusters` / `job_skill_changes`；服务层：FastAPI 读取后在服务端完成去重、归一、分位与共现聚合，
              结果缓存 5 分钟；展示层：React + Recharts（散点、树图、雷达、直方图）+ react-force-graph（技能共现网络）。
              所有图表支持筛选联动与点击下钻。
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}

function NoteMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg px-2.5 py-2" style={{ background: 'var(--color-surface-container-low)' }}>
      <p className="text-[9px]" style={{ color: 'var(--color-on-surface-variant)' }}>{label}</p>
      <p className="mt-0.5 text-base font-extrabold tabular-nums" style={{ color: 'var(--color-on-surface)' }}>{value}</p>
    </div>
  )
}
