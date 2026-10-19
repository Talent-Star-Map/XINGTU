/** 管理端「数据大屏」
 *
 * 答辩演示用：一屏看完平台规模、岗位画像、简历中心与用户行为。
 * 数据全部取自真实库（/api/admin/analytics/*），没有数据时显示空态，不造假。
 */
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeft, RefreshCw, Loader2, Users, Building2, Briefcase, Database,
  FileText, Target, Eye, Activity,
} from 'lucide-react'
import {
  ChartCard, TrendChart, RankBars, ColumnChart, DonutChart, FunnelBars,
} from '../../components/admin/AdminCharts'
import { templateName } from '../../lib/resumeTemplateNames'

const getToken = () => localStorage.getItem('xingtu_token') || ''
const withToken = (url: string) => `${url}${url.includes('?') ? '&' : '?'}token=${getToken()}`

const SERIES = [
  { key: 'jobseeker', name: '求职者', color: '#3b82f6' },
  { key: 'enterprise', name: '企业', color: '#8b5cf6' },
  { key: 'job', name: '企业岗位', color: '#10b981' },
  { key: 'resume', name: '简历', color: '#f59e0b' },
]

const STATUS_TEXT: Record<string, string> = {
  pending: '待处理',
  communicating: '沟通中',
  accepted: '已录用',
  rejected: '不合适',
}

interface Overview {
  jobseekers: { total: number; today: number; week: number; month: number }
  enterprises: { total: number; verified: number; today: number; month: number }
  jobs: { enterprise_total: number; enterprise_active: number; crawled: number; articles: number; today: number; month: number }
  resumes: { total: number; today: number; month: number; shares: number; share_visits: number }
  matches: { total: number; by_status: Record<string, number>; today: number }
  diagnosis: { total: number; week: number }
  resources: { total: number }
}

interface JobsProfile {
  total: number
  city: { name: string; value: number }[]
  field: { name: string; value: number }[]
  education: { name: string; value: number }[]
  experience: { name: string; value: number }[]
  source: { name: string; value: number }[]
  salary: { name: string; value: number }[]
  skills: { name: string; value: number }[]
}

interface ResumesData {
  total: number
  month_new: number
  ai_generated: number
  ai_ratio: number
  templates: { key: string; name: string; value: number; ratio: number }[]
  sections: { key: string; label: string; value: number; rate: number }[]
  shares: { links: number; visits: number; top: { title: string; value: number }[] }
}

interface FunnelData {
  base: number
  steps: { key: string; label: string; value: number; ratio: number; hint?: string }[]
  status: { name: string; value: number }[]
}

interface Props { onNav?: (p: 'dashboard') => void }

export default function AdminDataBoard({ onNav }: Props) {
  const [days, setDays] = useState(30)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updatedAt, setUpdatedAt] = useState(new Date())
  const [overview, setOverview] = useState<Overview | null>(null)
  const [trend, setTrend] = useState<any[]>([])
  const [jobs, setJobs] = useState<JobsProfile | null>(null)
  const [resumes, setResumes] = useState<ResumesData | null>(null)
  const [funnel, setFunnel] = useState<FunnelData | null>(null)

  const load = async () => {
    setLoading(true); setError('')
    try {
      const [o, t, j, r, f] = await Promise.all([
        fetch(withToken('/api/admin/analytics/overview')).then(x => x.json()),
        fetch(withToken(`/api/admin/analytics/trend?days=${days}`)).then(x => x.json()),
        fetch(withToken('/api/admin/analytics/jobs?top=10')).then(x => x.json()),
        fetch(withToken('/api/admin/analytics/resumes')).then(x => x.json()),
        fetch(withToken('/api/admin/analytics/funnel')).then(x => x.json()),
      ])
      if (!o.success) throw new Error(o.error?.message || '概览数据加载失败')
      setOverview(o.data)
      if (t.success) setTrend(t.data.items || [])
      if (j.success) setJobs(j.data)
      if (r.success) setResumes(r.data)
      if (f.success) setFunnel(f.data)
      setUpdatedAt(new Date())
    } catch (e: any) {
      setError(e?.message || '网络错误')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [days])

  const kpis = overview ? [
    { label: '求职者', value: overview.jobseekers.total, sub: `近 30 天 +${overview.jobseekers.month}`, icon: Users, color: '#3b82f6' },
    { label: '入驻企业', value: overview.enterprises.total, sub: `已认证 ${overview.enterprises.verified}`, icon: Building2, color: '#8b5cf6' },
    { label: '企业岗位', value: overview.jobs.enterprise_total, sub: `在招 ${overview.jobs.enterprise_active}`, icon: Briefcase, color: '#10b981' },
    { label: '采集岗位', value: overview.jobs.crawled, sub: `${overview.jobs.articles} 篇资讯`, icon: Database, color: '#0ea5e9' },
    { label: '在线简历', value: overview.resumes.total, sub: `分享 ${overview.resumes.shares} 次`, icon: FileText, color: '#f59e0b' },
    { label: '岗位诊断', value: overview.diagnosis.total, sub: `近 7 天 ${overview.diagnosis.week} 次`, icon: Activity, color: '#06b6d4' },
    { label: '匹配记录', value: overview.matches.total, sub: `今日 +${overview.matches.today}`, icon: Target, color: '#ef4444' },
    { label: '分享访问', value: overview.resumes.share_visits, sub: `${overview.resources.total} 条学习资源`, icon: Eye, color: '#64748b' },
  ] : []

  const statusData = (funnel?.status || []).map(s => ({
    name: STATUS_TEXT[s.name] || s.name,
    value: s.value,
  }))

  return (
    <div className="h-full overflow-auto"
      style={{
        background: 'radial-gradient(1100px 420px at 12% -12%, rgba(16,185,129,0.10), transparent), var(--color-background)',
      }}>
      <div className="max-w-[1500px] mx-auto px-6 py-6 space-y-4">
        {/* 头部 */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {onNav && (
              <button onClick={() => onNav('dashboard')}
                className="h-9 w-9 inline-flex items-center justify-center rounded-xl border"
                style={{ borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface-variant)' }}
                title="返回工作台">
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <div>
              <h1 className="text-xl font-extrabold tracking-tight" style={{ color: 'var(--color-on-surface)' }}>
                平台数据大屏
              </h1>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>
                数据更新于 {updatedAt.toLocaleTimeString('zh-CN')} · 时间口径为北京时间
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg border overflow-hidden"
              style={{ borderColor: 'var(--color-outline-variant)' }}>
              {[30, 90].map(d => (
                <button key={d} onClick={() => setDays(d)}
                  className="h-9 px-3 text-xs"
                  style={{
                    background: days === d ? 'var(--accent-green-dim)' : 'transparent',
                    color: days === d ? 'var(--accent-green)' : 'var(--color-on-surface-variant)',
                  }}>
                  近 {d} 天
                </button>
              ))}
            </div>
            <button onClick={load} disabled={loading}
              className="h-9 px-3 rounded-lg text-xs inline-flex items-center gap-1.5 border disabled:opacity-50"
              style={{ borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface)' }}>
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              刷新
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border px-3 py-2 text-xs"
            style={{ borderColor: 'var(--accent-red)', background: 'var(--accent-red-dim)', color: 'var(--accent-red)' }}>
            {error}　<button onClick={load} className="underline">重试</button>
          </div>
        )}

        {/* KPI 条 */}
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2.5">
          {kpis.map((k, i) => {
            const Icon = k.icon
            return (
              <motion.div key={k.label}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                className="rounded-xl border px-3 py-3"
                style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px]" style={{ color: 'var(--color-on-surface-variant)' }}>{k.label}</span>
                  <Icon className="h-3.5 w-3.5" style={{ color: k.color }} />
                </div>
                <p className="text-xl font-bold tabular-nums mt-1" style={{ color: k.color }}>
                  {k.value.toLocaleString()}
                </p>
                <p className="text-[10px] truncate" style={{ color: 'var(--color-on-surface-variant)' }}>{k.sub}</p>
              </motion.div>
            )
          })}
        </div>

        {/* 主图区 */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
          <div className="xl:col-span-2">
            <ChartCard title={`近 ${days} 天新增`} subtitle="求职者 / 企业 / 企业岗位 / 简历" height={230}>
              <TrendChart data={trend} series={SERIES} />
            </ChartCard>
          </div>
          <ChartCard title="匹配记录状态" subtitle="企业端处理的进展" height={230}>
            {statusData.length ? <DonutChart data={statusData} /> : <FunnelBars steps={[]} />}
          </ChartCard>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          <ChartCard title="城市分布 Top 10" subtitle={`采集岗位共 ${jobs?.total ?? 0} 条`} height={230}>
            <RankBars data={(jobs?.city || []).slice(0, 10)} unit=" 个" />
          </ChartCard>
          <ChartCard title="薪资区间" subtitle="按岗位月薪中位数分桶" height={230}>
            <ColumnChart data={jobs?.salary || []} />
          </ChartCard>
          <ChartCard title="技能热度 Top 12" subtitle="岗位技能标签出现次数" height={230}>
            <RankBars data={(jobs?.skills || []).slice(0, 12)} color="#8b5cf6" unit=" 次" />
          </ChartCard>

          <ChartCard title="学历要求" subtitle="采集岗位口径" height={200}>
            <DonutChart data={jobs?.education || []} />
          </ChartCard>
          <ChartCard title="数据来源" subtitle="爬虫采集渠道" height={200}>
            <DonutChart data={jobs?.source || []} />
          </ChartCard>
          <ChartCard title="经验要求" subtitle="采集岗位口径" height={200}>
            <DonutChart data={jobs?.experience || []} />
          </ChartCard>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
          <ChartCard title="用户行为漏斗" subtitle="各环节规模，基准为在线简历数" height={230}>
            <FunnelBars steps={funnel?.steps || []} />
          </ChartCard>
          <ChartCard title="模板使用排行" subtitle={`共 ${resumes?.total ?? 0} 份简历`} height={230}>
            <RankBars
              data={(resumes?.templates || []).map(t => ({ name: templateName(t.key || t.name), value: t.value }))}
              color="#10b981" unit=" 份" />
          </ChartCard>
          <ChartCard title="区块填写率" subtitle="简历各模块的填充比例" height={230}>
            <div className="h-full flex flex-col justify-center gap-2">
              {(resumes?.sections || []).map(s => (
                <div key={s.key} className="flex items-center gap-2">
                  <span className="w-16 shrink-0 text-[11px]" style={{ color: 'var(--color-on-surface)' }}>{s.label}</span>
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--color-surface-container-high)' }}>
                    <div className="h-full rounded-full" style={{ width: `${s.rate}%`, background: '#0ea5e9' }} />
                  </div>
                  <span className="w-9 text-right text-[10px] tabular-nums" style={{ color: 'var(--color-on-surface-variant)' }}>{s.rate}%</span>
                </div>
              ))}
            </div>
          </ChartCard>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <ChartCard title="领域分布" subtitle="技术领域 Top 10" height={230}>
            <RankBars data={(jobs?.field || []).slice(0, 10)} color="#f59e0b" unit=" 个" />
          </ChartCard>
          <ChartCard title="分享访问 Top 5" subtitle={`累计 ${resumes?.shares.visits ?? 0} 次访问`} height={230}>
            {(resumes?.shares.top.length ?? 0) ? (
              <div className="h-full overflow-auto space-y-2">
                {resumes!.shares.top.map((s, i) => (
                  <div key={`${s.title}-${i}`} className="flex items-center gap-2">
                    <span className="w-4 text-[10px] tabular-nums" style={{ color: 'var(--color-on-surface-variant)' }}>{i + 1}</span>
                    <span className="flex-1 truncate text-[11px]" style={{ color: 'var(--color-on-surface)' }}>{s.title}</span>
                    <span className="text-[10px] tabular-nums" style={{ color: 'var(--color-on-surface-variant)' }}>{s.value} 次</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="h-full flex items-center justify-center text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>
                还没有人访问分享链接
              </p>
            )}
          </ChartCard>
        </div>

        <p className="text-[10px] leading-relaxed pt-1" style={{ color: 'var(--color-on-surface-variant)' }}>
          口径说明：采集岗位来自 jobs 表（爬虫写入，求职者端浏览），企业岗位来自 enterprise_jobs 表（企业发布），两者不合并统计；
          所有按天聚合均已从 UTC 转为北京时间。
        </p>
      </div>
    </div>
  )
}
