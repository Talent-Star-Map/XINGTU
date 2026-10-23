import { useEffect, useState } from 'react'
import { TrendingUp, Plus, Minus, Edit3, Zap, BarChart3, LineChart, Activity, Database, Clock, AlertCircle, History } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import JobEvolutionTimeline from '../../components/kg/JobEvolutionTimeline'
import JobseekerInsights from '../../components/visuals/JobseekerInsights'
import SkillChangeRiver from '../../components/visuals/SkillChangeRiver'

type TrendSkill = { name: string; type: string; hot_score: number; mention_count: number; aliases: string[] }
type TrendConcept = { name: string; hot_score: number; mention_count: number }
type SalaryRow = { title: string; avg_salary_k: number; count: number }
type NewJob = {
  id: number
  title: string
  skills: string[]
  summary: string
  salary_min_k: number
  salary_max_k: number
  crawl_time: string
}
type SkillChangeSource = { source: string; company: string; job_id: number }
type SkillChange = {
  id: number
  job_id: number
  added: string[]
  removed: string[]
  modified: Array<{ skill?: string; from?: string; to?: string }>
  data_sources: SkillChangeSource[]
  run_id: string
  created_at: string
  job_title: string
  company: string
  source: string
  current_skills: string[]
  source_count: number
  current_size: number
}
type GrowthRow = { month: string; count: number; cum_count: number; has_observations?: boolean }

async function loadTrendData<T>(path: string): Promise<T> {
  const token = localStorage.getItem('xingtu_token') || ''
  const response = await fetch(path, { headers: { Authorization: `Bearer ${token}` } })
  if (!response.ok) throw new Error('趋势数据暂不可用，请稍后重试')
  const result = await response.json()
  if (!result.success) throw new Error('趋势数据暂不可用，请稍后重试')
  return result.data
}

function formatSalary(min: number, max: number) {
  if (!min && !max) return '面议'
  return `${min}K-${max}K`
}

export default function Trend() {
  const [tab, setTab] = useState<'visuals' | 'trend' | 'discovery' | 'update'>('visuals')

  const [skills, setSkills] = useState<TrendSkill[]>([])
  const [concepts, setConcepts] = useState<TrendConcept[]>([])
  const [salary, setSalary] = useState<SalaryRow[]>([])
  const [growth, setGrowth] = useState<GrowthRow[]>([])
  const [trendLoading, setTrendLoading] = useState(true)
  const [trendError, setTrendError] = useState('')

  const [newJobs, setNewJobs] = useState<NewJob[]>([])
  const [newJobsLoading, setNewJobsLoading] = useState(true)

  const [skillChanges, setSkillChanges] = useState<SkillChange[]>([])
  const [changesLoading, setChangesLoading] = useState(true)
  const [selectedChange, setSelectedChange] = useState<SkillChange | null>(null)
  const [historyFor, setHistoryFor] = useState<{ jobId: number; jobTitle: string } | null>(null)
  const [history, setHistory] = useState<SkillChange[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  // 演化轨迹模态框(真实数据,接 JobEvolutionTimeline 组件)
  const [evolutionFor, setEvolutionFor] = useState<{ jobId: number; jobTitle: string } | null>(null)

  useEffect(() => {
    if (tab !== 'trend') return
    setTrendLoading(true)
    setTrendError('')
    Promise.all([
      loadTrendData<TrendSkill[]>('/api/trend/skills?limit=10'),
      loadTrendData<TrendConcept[]>('/api/trend/concepts?limit=8'),
      loadTrendData<SalaryRow[]>('/api/trend/salary?limit=6'),
      loadTrendData<GrowthRow[]>('/api/trend/growth?months=6'),
    ]).then(([sk, co, sa, gr]) => {
      setSkills(sk)
      setConcepts(co)
      setSalary(sa)
      setGrowth(gr)
    }).catch(() => {
      setSkills([]); setConcepts([]); setSalary([]); setGrowth([])
      setTrendError('趋势数据暂不可用，请稍后重试')
    })
      .finally(() => setTrendLoading(false))
  }, [tab])

  useEffect(() => {
    if (tab !== 'discovery') return
    setNewJobsLoading(true)
    fetch('/api/trend/new-jobs?limit=20')
      .then(r => r.json())
      .then(d => setNewJobs(d.data || []))
      .catch(err => console.error('new-jobs err', err))
      .finally(() => setNewJobsLoading(false))
  }, [tab])

  useEffect(() => {
    if (tab !== 'update') return
    setChangesLoading(true)
    fetch('/api/trend/skill-changes?limit=30')
      .then(r => r.json())
      .then(d => {
        const list: SkillChange[] = d.data || []
        setSkillChanges(list)
        if (list.length > 0) setSelectedChange(list[0])
      })
      .catch(err => console.error('changes err', err))
      .finally(() => setChangesLoading(false))
  }, [tab])

  const openHistory = (jobId: number, jobTitle: string) => {
    setHistoryFor({ jobId, jobTitle })
    setHistoryLoading(true)
    fetch(`/api/trend/skill-changes?job_id=${jobId}`)
      .then(r => r.json())
      .then(d => setHistory(d.data || []))
      .catch(err => console.error('history err', err))
      .finally(() => setHistoryLoading(false))
  }

  // 打开演化轨迹模态框(真实数据,JobEvolutionTimeline 走 /api/kg/*)
  const openEvolution = (jobId: number, jobTitle: string) => {
    setEvolutionFor({ jobId, jobTitle })
  }

  const top5Skills = skills.slice(0, 5)
  const growthData = growth.map(g => ({ n: g.month, v: g.count }))

  return (
    <div className="space-y-6 px-6 py-8 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold" style={{ color: 'var(--color-on-surface)' }}>趋势洞察</h1>
        <div className="flex gap-2">
          {(['visuals', 'trend', 'discovery', 'update'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className="px-3.5 py-1.5 rounded-lg text-xs font-semibold"
              style={{ background: tab === t ? 'var(--color-primary)' : 'var(--color-surface)', color: tab === t ? 'var(--color-on-primary)' : 'var(--color-on-surface-variant)', border: tab === t ? 'none' : '1px solid var(--color-outline-variant)' }}>
              {t === 'visuals' ? '求职数据观察' : t === 'trend' ? '已有指标' : t === 'discovery' ? '新岗位候选' : '技能演化'}
            </button>
          ))}
        </div>
      </div>

      {tab === 'visuals' && <JobseekerInsights />}

      {tab === 'trend' && (
        <div className="space-y-6">
          {trendError && <div role="alert" className="text-sm" style={{ color: 'var(--accent-red)' }}>{trendError}</div>}
          {trendLoading && (
            <div className="text-sm text-center py-4" style={{ color: 'var(--color-on-surface-variant)' }}>
              正在拉取 Neo4j 热度图谱…
            </div>
          )}
          <div className="rounded-2xl border p-6" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
            <div className="flex items-center gap-2 mb-6">
              <LineChart className="h-5 w-5" style={{ color: 'var(--color-primary)' }} />
              <h2 className="text-base font-bold" style={{ color: 'var(--color-on-surface)' }}>
                Top {top5Skills.length} 技能当前热度（Neo4j hot_score）
              </h2>
            </div>
            {top5Skills.length > 0 ? (
              <>
                <div className="space-y-3">
                  {top5Skills.map((skill, i) => (
                    <div key={skill.name} className="flex items-center gap-3 text-sm">
                      <span className="w-5 text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>{i + 1}</span>
                      <span className="w-32 truncate">{skill.name}</span>
                      <div className="flex-1 h-2 rounded" style={{ background: 'var(--color-surface-container)' }}>
                        <div className="h-2 rounded" style={{ width: `${Math.max(2, Math.min(100, skill.hot_score / Math.max(top5Skills[0]?.hot_score || 1, 1) * 100))}%`, background: 'var(--color-primary)' }} />
                      </div>
                      <span className="w-16 text-right tabular-nums">{skill.hot_score.toFixed(0)}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs mt-4" style={{ color: 'var(--color-on-surface-variant)' }}>这是当前图谱的热度排序，缺少按月观测时不绘制历史趋势。</p>
              </>
            ) : (
              <div className="text-sm py-8 text-center" style={{ color: 'var(--color-on-surface-variant)' }}>
                暂无热度数据 — 等跑几轮实体抽取(每小时 :15)就有了
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <div className="rounded-2xl border p-6" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
              <div className="flex items-center gap-2 mb-5">
                <BarChart3 className="h-5 w-5" style={{ color: 'var(--accent-purple)' }} />
                <h2 className="text-base font-bold" style={{ color: 'var(--color-on-surface)' }}>热门岗位薪资(K)</h2>
              </div>
              {salary.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={salary.map(s => ({ n: s.title.length > 8 ? s.title.slice(0, 8) + '…' : s.title, v: s.avg_salary_k }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-outline-variant)" strokeOpacity={0.4} />
                    <XAxis dataKey="n" tick={{ fill: 'var(--color-on-surface-variant)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: 'var(--color-on-surface-variant)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: 'var(--color-surface-container-lowest)', border: '1px solid var(--color-outline-variant)', borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="v" fill="#7C3AED" radius={[6, 6, 0, 0]} maxBarSize={50} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-sm py-8 text-center" style={{ color: 'var(--color-on-surface-variant)' }}>暂无数据</div>
              )}
            </div>

            <div className="rounded-2xl border p-6" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
              <div className="flex items-center gap-2 mb-5">
                <Activity className="h-5 w-5" style={{ color: 'var(--accent-green)' }} />
                <h2 className="text-base font-bold" style={{ color: 'var(--color-on-surface)' }}>新兴岗位候选记录（月度）</h2>
              </div>
              {growthData.some(d => d.v > 0) ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={growthData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-outline-variant)" strokeOpacity={0.4} />
                    <XAxis type="number" tick={{ fill: 'var(--color-on-surface-variant)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis dataKey="n" type="category" tick={{ fill: 'var(--color-on-surface-variant)', fontSize: 11 }} axisLine={false} tickLine={false} width={70} />
                    <Tooltip
                      contentStyle={{ background: 'var(--color-surface-container-lowest)', border: '1px solid var(--color-outline-variant)', borderRadius: 8, fontSize: 12 }}
                      formatter={(v: any) => [v, '已记录候选数']}
                    />
                    <Bar dataKey="v" fill="#00C8FF" radius={[0, 6, 6, 0]} maxBarSize={30} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-sm py-8 text-center" style={{ color: 'var(--color-on-surface-variant)' }}>近 6 个月暂无带采集时间的候选记录</div>
              )}
              <p className="text-xs mt-2" style={{ color: 'var(--color-on-surface-variant)' }}>按已记录的采集月份统计；零值表示库内无记录，不能说明市场没有新岗位。缺少采集时间的记录不计入。</p>
            </div>
          </div>

          {concepts.length > 0 && (
            <div className="rounded-2xl border p-6" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="h-5 w-5" style={{ color: 'var(--color-primary)' }} />
                <h2 className="text-base font-bold" style={{ color: 'var(--color-on-surface)' }}>热门趋势概念</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {concepts.map(c => (
                  <span key={c.name} className="text-xs px-3 py-1.5 rounded-lg font-medium"
                    style={{ background: 'var(--accent-cyan-dim)', color: 'var(--color-primary)' }}>
                    {c.name} <span style={{ opacity: 0.6 }}>· {c.hot_score.toFixed(0)}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'discovery' && (
        <div className="space-y-4">
          {newJobsLoading && (
            <div className="text-sm text-center py-4" style={{ color: 'var(--color-on-surface-variant)' }}>
              拉取 AI 发现的新岗位…
            </div>
          )}
          {!newJobsLoading && newJobs.length === 0 && (
            <div className="rounded-2xl border p-8 text-center text-sm"
              style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)', color: 'var(--color-on-surface-variant)' }}>
              暂无新兴岗位候选记录，请在数据更新后查看
            </div>
          )}
          {newJobs.map(job => {
            return (
              <div key={job.id} className="rounded-2xl border p-6" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
                <div className="flex items-start gap-4 mb-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl shrink-0" style={{ background: 'var(--accent-cyan-dim)' }}>
                    <Zap className="h-7 w-7" style={{ color: 'var(--color-primary)' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h2 className="text-lg font-bold" style={{ color: 'var(--color-primary)' }}>{job.title}</h2>
                      <span className="text-xs px-2 py-0.5 rounded font-semibold"
                        style={{ background: 'var(--accent-cyan-dim)', color: 'var(--color-primary)' }}>AI 生成候选 · 未核验</span>
                      {job.salary_min_k > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded"
                          style={{ background: 'var(--accent-green-dim)', color: 'var(--accent-green)' }}>
                          {formatSalary(job.salary_min_k, job.salary_max_k)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>
                      {job.summary || '基于图谱热度生成的岗位候选，仍需原文证据与人工审核'}
                    </p>
                  </div>
                </div>
                {job.skills.length > 0 && (
                  <div>
                    <div className="rounded-xl p-4" style={{ background: 'var(--accent-green-dim)' }}>
                      <p className="text-xs font-semibold mb-2" style={{ color: 'var(--accent-green)' }}>关联技能候选（未判定必备或加分）</p>
                      <div className="flex flex-wrap gap-1.5">
                        {job.skills.map((s: string) => (
                          <span key={s} className="text-xs px-2.5 py-1 rounded-lg" style={{ background: 'var(--accent-green-dim)', color: 'var(--accent-green)' }}>
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                <div className="flex gap-4 text-xs mt-3 items-center" style={{ color: 'var(--color-on-surface-variant)' }}>
                  <span>📅 {job.crawl_time || '最近一轮 AI 抽取'}</span>
                  <button onClick={() => openEvolution(job.id, job.title)}
                    className="ml-auto text-xs px-3 py-1 rounded-lg flex items-center gap-1 font-semibold"
                    style={{ background: 'var(--accent-green-dim)', color: 'var(--accent-green)', border: '1px solid var(--accent-green)' }}
                    title="查看该岗位真实数据演化轨迹">
                    <TrendingUp className="h-3.5 w-3.5" />
                    查看演化轨迹
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {tab === 'update' && (
        <div className="space-y-4">
          <SkillChangeRiver />
          {changesLoading && (
            <div className="text-sm text-center py-4" style={{ color: 'var(--color-on-surface-variant)' }}>
              拉取能力 diff…
            </div>
          )}

          {!changesLoading && skillChanges.length === 0 && (
            <div className="rounded-2xl border p-8 text-center text-sm"
              style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)', color: 'var(--color-on-surface-variant)' }}>
              暂无技能差异候选记录
            </div>
          )}

          {skillChanges.length > 0 && (
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-4 space-y-2 max-h-[700px] overflow-y-auto pr-1">
                {skillChanges.map(c => {
                  const isSelected = selectedChange?.id === c.id
                  return (
                    <button key={c.id} onClick={() => setSelectedChange(c)}
                      className="w-full text-left rounded-xl border p-3 transition-all"
                      style={{
                        borderColor: isSelected ? 'var(--color-primary)' : 'var(--color-outline-variant)',
                        background: isSelected ? 'var(--accent-cyan-dim)' : 'var(--color-surface-container-lowest)',
                      }}>
                      <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-on-surface)' }}>
                        {c.job_title || `岗位 #${c.job_id}`}
                      </p>
                      <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--color-on-surface-variant)' }}>
                        {c.company || '—'}
                      </p>
                      <div className="flex gap-2 text-xs mt-1.5 flex-wrap items-center">
                        {c.added.length > 0 && (
                          <span className="px-1.5 py-0.5 rounded font-semibold"
                            style={{ background: 'var(--accent-green-dim)', color: 'var(--accent-green)' }}>
                            +{c.added.length} 新增
                          </span>
                        )}
                        {c.removed.length > 0 && (
                          <span className="px-1.5 py-0.5 rounded font-semibold"
                            style={{ background: 'var(--accent-red-dim)', color: 'var(--accent-red)' }}>
                            -{c.removed.length} 删除
                          </span>
                        )}
                        {c.modified.length > 0 && (
                          <span className="px-1.5 py-0.5 rounded font-semibold"
                            style={{ background: 'var(--accent-purple-dim)', color: 'var(--accent-purple)' }}>
                            ~{c.modified.length} 修改
                          </span>
                        )}
                        <span className="ml-auto flex items-center gap-1" style={{ color: 'var(--color-on-surface-variant)' }}>
                          <Database className="h-3 w-3" /> {c.source_count}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>

              <div className="col-span-8">
                {selectedChange && (
                  <ChangeDetail
                    change={selectedChange}
                    onOpenEvolution={() => openEvolution(selectedChange.job_id, selectedChange.job_title)}
                    onOpenHistory={() => openHistory(selectedChange.job_id, selectedChange.job_title)}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {historyFor && (
        <div className="fixed inset-0 z-50 flex items-end justify-end" onClick={() => setHistoryFor(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative w-[640px] max-w-[90vw] h-[80vh] rounded-tl-2xl shadow-2xl overflow-y-auto"
            style={{ background: 'var(--color-surface-container-lowest)' }}
            onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 px-6 py-4 border-b flex items-center justify-between"
              style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
              <div>
                <h2 className="text-base font-bold flex items-center gap-2" style={{ color: 'var(--color-on-surface)' }}>
                  <Clock className="h-4 w-4" style={{ color: 'var(--color-primary)' }} />
                  历史差异候选:{historyFor.jobTitle}
                </h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>
                  岗位 ID: {historyFor.jobId} · {historyLoading ? '加载中…' : `${history.length} 条候选`}
                </p>
              </div>
              <button onClick={() => setHistoryFor(null)} className="text-xs px-3 py-1.5 rounded-lg"
                style={{ background: 'var(--color-surface)', border: '1px solid var(--color-outline-variant)' }}>
                关闭
              </button>
            </div>
            <div className="p-6 space-y-4">
              {historyLoading && <div className="text-sm text-center py-4">加载中…</div>}
              {!historyLoading && history.length === 0 && (
                <div className="text-sm text-center py-8" style={{ color: 'var(--color-on-surface-variant)' }}>
                  该岗位暂无历史 diff 记录
                </div>
              )}
              {history.map((h, idx) => (
                <div key={h.id} className="rounded-xl border p-4 relative"
                  style={{ borderColor: 'var(--color-outline-variant)' }}>
                  {idx < history.length - 1 && (
                    <div className="absolute left-[26px] top-[52px] bottom-[-16px] w-px"
                      style={{ background: 'var(--color-outline-variant)' }} />
                  )}
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold"
                      style={{ background: 'var(--color-primary)', color: 'var(--color-on-primary)' }}>
                      {history.length - idx}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold" style={{ color: 'var(--color-on-surface)' }}>
                        {h.created_at}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                        run: {h.run_id}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="rounded-lg p-2" style={{ background: 'var(--accent-green-dim)' }}>
                      <p className="font-semibold mb-1" style={{ color: 'var(--accent-green)' }}>+{h.added.length} 候选新增</p>
                      <div className="flex flex-wrap gap-1">
                        {h.added.slice(0, 4).map(s => (
                          <span key={s} className="px-1.5 py-0.5 rounded"
                            style={{ background: 'var(--color-surface-container-lowest)', color: 'var(--accent-green)' }}>{s}</span>
                        ))}
                        {h.added.length > 4 && <span style={{ color: 'var(--accent-green)' }}>+{h.added.length - 4}</span>}
                      </div>
                    </div>
                    <div className="rounded-lg p-2" style={{ background: 'var(--accent-red-dim)' }}>
                      <p className="font-semibold mb-1" style={{ color: 'var(--accent-red)' }}>-{h.removed.length} 候选缺失</p>
                      <div className="flex flex-wrap gap-1">
                        {h.removed.slice(0, 4).map(s => (
                          <span key={s} className="px-1.5 py-0.5 rounded"
                            style={{ background: 'var(--color-surface-container-lowest)', color: 'var(--accent-red)' }}>{s}</span>
                        ))}
                        {h.removed.length > 4 && <span style={{ color: 'var(--accent-red)' }}>+{h.removed.length - 4}</span>}
                      </div>
                    </div>
                    <div className="rounded-lg p-2" style={{ background: 'var(--accent-purple-dim)' }}>
                      <p className="font-semibold mb-1" style={{ color: 'var(--accent-purple)' }}>~{h.modified.length} 修改</p>
                      <div className="flex flex-wrap gap-1">
                        {h.modified.slice(0, 4).map((m, i) => (
                          <span key={i} className="px-1.5 py-0.5 rounded"
                            style={{ background: 'var(--color-surface-container-lowest)', color: 'var(--accent-purple)' }}>
                            {m.skill || '·'}
                          </span>
                        ))}
                        {h.modified.length > 4 && <span style={{ color: 'var(--accent-purple)' }}>+{h.modified.length - 4}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── 演化轨迹模态框(真实数据,JobEvolutionTimeline) ─── */}
      {evolutionFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6" onClick={() => setEvolutionFor(null)}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative w-[760px] max-w-[95vw] h-[640px] max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
               style={{ background: 'var(--color-surface-container-lowest)' }}
               onClick={e => e.stopPropagation()}>
            <div className="px-5 py-3 border-b flex items-center justify-between shrink-0"
                 style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
              <div>
                <h2 className="text-base font-bold flex items-center gap-2" style={{ color: 'var(--color-on-surface)' }}>
                  <TrendingUp className="h-4 w-4" style={{ color: 'var(--accent-green)' }} />
                  演化轨迹 · {evolutionFor.jobTitle}
                </h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>
                  job_id={evolutionFor.jobId} · 数据来源 Neo4j /api/kg/*(真实)
                </p>
              </div>
              <button onClick={() => setEvolutionFor(null)} className="text-xs px-3 py-1.5 rounded-lg"
                style={{ background: 'var(--color-surface)', border: '1px solid var(--color-outline-variant)' }}>
                关闭
              </button>
            </div>
            <div className="flex-1 min-h-0 p-3">
              <JobEvolutionTimeline jobId={evolutionFor.jobId} jobTitle={evolutionFor.jobTitle} height={420} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ChangeDetail({ change, onOpenEvolution, onOpenHistory }: { change: SkillChange; onOpenEvolution: () => void; onOpenHistory: () => void }) {
  const sources = change.data_sources || []
  const uniqueSources = Array.from(new Set(sources.map(s => s.source))).filter(Boolean)
  const uniqueCompanies = Array.from(new Set(sources.map(s => s.company))).filter(Boolean)

  return (
    <div className="rounded-2xl border p-6" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
      <div className="flex items-center gap-3 mb-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'var(--accent-purple-dim)' }}>
          <Edit3 className="h-5 w-5" style={{ color: 'var(--accent-purple)' }} />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-bold" style={{ color: 'var(--color-on-surface)' }}>
            {change.job_title || `岗位 #${change.job_id}`}
          </h2>
          <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--color-on-surface-variant)' }}>
            {change.company || '—'} · {change.created_at} · run: {change.run_id}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={onOpenEvolution}
            className="text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-semibold"
            style={{ background: 'var(--accent-green-dim)', color: 'var(--accent-green)', border: '1px solid var(--accent-green)' }}
            title="查看该岗位的真实演化轨迹(技能/事件/薪资)">
            <TrendingUp className="h-3.5 w-3.5" />
            演化轨迹
          </button>
          <button onClick={onOpenHistory}
            className="text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5"
            style={{ background: 'var(--accent-cyan-dim)', color: 'var(--color-primary)', border: '1px solid var(--color-primary)' }}
            title="查看该岗位的旧 diff 历史记录">
            <History className="h-3.5 w-3.5" />
            diff 历史
          </button>
        </div>
      </div>

      <div className="rounded-xl p-3 mb-4" style={{ background: 'var(--color-surface-container-low)' }}>
        <div className="flex items-center gap-2 mb-2">
          <Database className="h-3.5 w-3.5" style={{ color: 'var(--color-primary)' }} />
          <p className="text-xs font-semibold" style={{ color: 'var(--color-on-surface)' }}>
            关联来源 ({sources.length})
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 text-xs">
          {uniqueSources.length > 0 && uniqueSources.map(s => (
            <span key={s} className="px-2 py-0.5 rounded font-medium"
              style={{ background: 'var(--accent-cyan-dim)', color: 'var(--color-primary)' }}>
              {s}
            </span>
          ))}
          {uniqueCompanies.slice(0, 5).map(c => (
            <span key={c} className="px-2 py-0.5 rounded"
              style={{ background: 'var(--color-surface)', color: 'var(--color-on-surface-variant)', border: '1px solid var(--color-outline-variant)' }}>
              {c}
            </span>
          ))}
          {uniqueCompanies.length > 5 && (
            <span className="px-2 py-0.5 rounded" style={{ color: 'var(--color-on-surface-variant)' }}>
              +{uniqueCompanies.length - 5} 家
            </span>
          )}
        </div>
        {sources.length > 0 && (
          <details className="mt-2">
            <summary className="text-xs cursor-pointer" style={{ color: 'var(--color-on-surface-variant)' }}>
              查看全部 {sources.length} 条来源明细
            </summary>
            <ul className="mt-1.5 space-y-0.5 text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
              {sources.map((s, i) => (
                <li key={i}>· {s.source} · {s.company} · job#{s.job_id}</li>
              ))}
            </ul>
          </details>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="rounded-xl p-3" style={{ background: 'var(--accent-green-dim)' }}>
          <p className="text-xs font-semibold mb-0.5" style={{ color: 'var(--accent-green)' }}>候选新增</p>
          <p className="text-xl font-bold" style={{ color: 'var(--accent-green)' }}>{change.added.length}</p>
        </div>
        <div className="rounded-xl p-3" style={{ background: 'var(--accent-red-dim)' }}>
          <p className="text-xs font-semibold mb-0.5" style={{ color: 'var(--accent-red)' }}>候选缺失</p>
          <p className="text-xl font-bold" style={{ color: 'var(--accent-red)' }}>{change.removed.length}</p>
        </div>
        <div className="rounded-xl p-3" style={{ background: 'var(--accent-purple-dim)' }}>
          <p className="text-xs font-semibold mb-0.5" style={{ color: 'var(--accent-purple)' }}>候选修改</p>
          <p className="text-xl font-bold" style={{ color: 'var(--accent-purple)' }}>{change.modified.length}</p>
        </div>
      </div>

      {change.current_skills.length > 0 && (
        <div className="mb-4 rounded-xl p-3" style={{ background: 'var(--color-surface-container-low)' }}>
          <p className="text-xs font-semibold mb-2" style={{ color: 'var(--color-on-surface-variant)' }}>
            当前 skill_tags({change.current_skills.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {change.current_skills.map(s => (
              <span key={s} className="text-xs px-2.5 py-1 rounded-lg"
                style={{ background: 'var(--color-surface)', color: 'var(--color-on-surface-variant)', border: '1px solid var(--color-outline-variant)' }}>
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-start gap-3 rounded-xl p-3" style={{ background: 'var(--accent-green-dim)' }}>
          <div className="flex h-7 w-7 items-center justify-center rounded-lg shrink-0" style={{ background: 'var(--color-surface-container-lowest)' }}>
            <Plus className="h-4 w-4" style={{ color: 'var(--accent-green)' }} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold mb-1.5" style={{ color: 'var(--accent-green)' }}>
              候选新增提及 ({change.added.length})
            </p>
            {change.added.length > 0 ? (
              <>
                <div className="flex flex-wrap gap-1.5 mb-1.5">
                  {change.added.map(s => (
                    <span key={s} className="text-xs px-2.5 py-1 rounded-lg font-medium"
                      style={{ background: 'var(--color-surface-container-lowest)', color: 'var(--accent-green)', border: '1px solid var(--accent-green)' }}>
                      {s}
                    </span>
                  ))}
                </div>
                <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                  关联来源 {sources.length} 条
                </p>
              </>
            ) : (
              <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>本轮无新增</p>
            )}
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-xl p-3" style={{ background: 'var(--accent-red-dim)' }}>
          <div className="flex h-7 w-7 items-center justify-center rounded-lg shrink-0" style={{ background: 'var(--color-surface-container-lowest)' }}>
            <Minus className="h-4 w-4" style={{ color: 'var(--accent-red)' }} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold mb-1.5" style={{ color: 'var(--accent-red)' }}>
              候选未提及 ({change.removed.length})
            </p>
            {change.removed.length > 0 ? (
              <>
                <div className="flex flex-wrap gap-1.5 mb-1.5">
                  {change.removed.map(s => (
                    <span key={s} className="text-xs px-2.5 py-1 rounded-lg font-medium line-through"
                      style={{ background: 'var(--color-surface-container-lowest)', color: 'var(--accent-red)', border: '1px solid var(--accent-red)' }}>
                      {s}
                    </span>
                  ))}
                </div>
                <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                  未提及不能证明企业取消要求或技能过时；需要同一招聘版本的原文证据。
                </p>
              </>
            ) : (
              <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>本轮无删除</p>
            )}
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-xl p-3" style={{ background: 'var(--accent-purple-dim)' }}>
          <div className="flex h-7 w-7 items-center justify-center rounded-lg shrink-0" style={{ background: 'var(--color-surface-container-lowest)' }}>
            <Edit3 className="h-4 w-4" style={{ color: 'var(--accent-purple)' }} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold mb-1.5" style={{ color: 'var(--accent-purple)' }}>
              候选表述变化 ({change.modified.length})
            </p>
            {change.modified.length > 0 ? (
              <ul className="space-y-1">
                {change.modified.map((m, i) => (
                  <li key={i} className="text-xs">
                    <span className="font-semibold" style={{ color: 'var(--accent-purple)' }}>{m.skill || JSON.stringify(m)}</span>
                    {m.from && m.to && (
                      <span style={{ color: 'var(--color-on-surface-variant)' }}> · {m.from} → {m.to}</span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>本轮无修改</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
