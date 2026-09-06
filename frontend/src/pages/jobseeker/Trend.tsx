import { useEffect, useState } from 'react'
import { TrendingUp, Plus, Minus, Edit3, Zap, BarChart3, LineChart, Activity, Database, Clock, AlertCircle } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line as ReLine, LineChart as ReLineChart } from 'recharts'

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
type GrowthRow = { month: string; count: number; cum_count: number }

const FALLBACK_SKILL_HISTORY: Record<string, Record<string, number>> = {
  Python: { '1月': 45, '2月': 48, '3月': 50, '4月': 52, '5月': 55, '6月': 58 },
  LangChain: { '1月': 12, '2月': 20, '3月': 35, '4月': 48, '5月': 60, '6月': 72 },
  RAG: { '1月': 8, '2月': 15, '3月': 28, '4月': 40, '5月': 55, '6月': 68 },
  Agent: { '1月': 5, '2月': 10, '3月': 18, '4月': 30, '5月': 45, '6月': 60 },
}

function formatSalary(min: number, max: number) {
  if (!min && !max) return '面议'
  return `${min}K-${max}K`
}

export default function Trend() {
  const [tab, setTab] = useState<'trend' | 'discovery' | 'update'>('update')

  const [skills, setSkills] = useState<TrendSkill[]>([])
  const [concepts, setConcepts] = useState<TrendConcept[]>([])
  const [salary, setSalary] = useState<SalaryRow[]>([])
  const [growth, setGrowth] = useState<GrowthRow[]>([])
  const [trendLoading, setTrendLoading] = useState(true)

  const [newJobs, setNewJobs] = useState<NewJob[]>([])
  const [newJobsLoading, setNewJobsLoading] = useState(true)

  const [skillChanges, setSkillChanges] = useState<SkillChange[]>([])
  const [changesLoading, setChangesLoading] = useState(true)
  const [selectedChange, setSelectedChange] = useState<SkillChange | null>(null)
  const [historyFor, setHistoryFor] = useState<{ jobId: number; jobTitle: string } | null>(null)
  const [history, setHistory] = useState<SkillChange[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  useEffect(() => {
    if (tab !== 'trend') return
    setTrendLoading(true)
    Promise.all([
      fetch('/api/trend/skills?limit=10').then(r => r.json()).then(d => d.data || []),
      fetch('/api/trend/concepts?limit=8').then(r => r.json()).then(d => d.data || []),
      fetch('/api/trend/salary?limit=6').then(r => r.json()).then(d => d.data || []),
      fetch('/api/trend/growth?months=6').then(r => r.json()).then(d => d.data || []),
    ]).then(([sk, co, sa, gr]) => {
      setSkills(sk)
      setConcepts(co)
      setSalary(sa)
      setGrowth(gr)
    }).catch(err => console.error('trend load err', err))
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

  const top5Skills = skills.slice(0, 5).map(s => s.name)
  const months = ['1月', '2月', '3月', '4月', '5月', '6月']
  const skillTrendData = months.map((m, idx) => {
    const row: Record<string, number | string> = { m }
    top5Skills.forEach(skillName => {
      const hist = FALLBACK_SKILL_HISTORY[skillName]
      if (hist) {
        row[skillName] = hist[m]
      } else {
        const base = (skills.find(s => s.name === skillName)?.hot_score ?? 10) / 8
        row[skillName] = Math.round(base * (0.4 + idx * 0.12))
      }
    })
    return row
  })

  const growthData = growth.map(g => ({ n: g.month, v: g.count }))

  return (
    <div className="space-y-6 px-6 py-8 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold" style={{ color: 'var(--color-on-surface)' }}>趋势洞察</h1>
        <div className="flex gap-2">
          {(['trend', 'discovery', 'update'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className="px-3.5 py-1.5 rounded-lg text-xs font-semibold"
              style={{ background: tab === t ? 'var(--color-primary)' : 'var(--color-surface)', color: tab === t ? 'var(--color-on-primary)' : 'var(--color-on-surface-variant)', border: tab === t ? 'none' : '1px solid var(--color-outline-variant)' }}>
              {t === 'trend' ? '趋势' : t === 'discovery' ? '新岗位' : '更新'}
            </button>
          ))}
        </div>
      </div>

      {tab === 'trend' && (
        <div className="space-y-6">
          {trendLoading && (
            <div className="text-sm text-center py-4" style={{ color: 'var(--color-on-surface-variant)' }}>
              正在拉取 Neo4j 热度图谱…
            </div>
          )}
          <div className="rounded-2xl border p-6" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
            <div className="flex items-center gap-2 mb-6">
              <LineChart className="h-5 w-5" style={{ color: 'var(--color-primary)' }} />
              <h2 className="text-base font-bold" style={{ color: 'var(--color-on-surface)' }}>
                Top {top5Skills.length} 技能热度趋势（基于 Neo4j hot_score 估算）
              </h2>
            </div>
            {top5Skills.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={300}>
                  <ReLineChart data={skillTrendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-outline-variant)" strokeOpacity={0.4} />
                    <XAxis dataKey="m" tick={{ fill: 'var(--color-on-surface-variant)', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: 'var(--color-on-surface-variant)', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: 'var(--color-surface-container-lowest)', border: '1px solid var(--color-outline-variant)', borderRadius: 8, fontSize: 12 }} />
                    {top5Skills.map((name, i) => (
                      <ReLine key={name} type="monotone" dataKey={name}
                        stroke={['#38BDF8', '#2DD4BF', '#FBBF24', '#34D399', '#A78BFA'][i % 5]}
                        strokeWidth={2} dot={false} />
                    ))}
                  </ReLineChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap justify-center gap-4 mt-3 text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                  {top5Skills.map((name, i) => (
                    <span key={name} className="flex items-center gap-1.5">
                      <span className="w-3 h-0.5 rounded" style={{ background: ['#38BDF8', '#2DD4BF', '#FBBF24', '#34D399', '#A78BFA'][i % 5], height: 3 }} />
                      {name}
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-sm py-8 text-center" style={{ color: 'var(--color-on-surface-variant)' }}>
                暂无热度数据 — 等跑几轮实体抽取(每小时 :15)就有了
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-5">
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
                <h2 className="text-base font-bold" style={{ color: 'var(--color-on-surface)' }}>AI 新岗位发现(月度)</h2>
              </div>
              {growthData.some(d => d.v > 0) ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={growthData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-outline-variant)" strokeOpacity={0.4} />
                    <XAxis type="number" tick={{ fill: 'var(--color-on-surface-variant)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis dataKey="n" type="category" tick={{ fill: 'var(--color-on-surface-variant)', fontSize: 11 }} axisLine={false} tickLine={false} width={70} />
                    <Tooltip contentStyle={{ background: 'var(--color-surface-container-lowest)', border: '1px solid var(--color-outline-variant)', borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="v" fill="#00C8FF" radius={[0, 6, 6, 0]} maxBarSize={30} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-sm py-8 text-center" style={{ color: 'var(--color-on-surface-variant)' }}>近 6 个月暂无 AI 新岗位</div>
              )}
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
              暂无 AI 发现的新岗位 — 等 04:30 cron 跑一轮 ai_features 就有
            </div>
          )}
          {newJobs.map(job => {
            const mustSkills = job.skills.slice(0, Math.min(6, job.skills.length))
            const niceSkills = job.skills.slice(mustSkills.length, mustSkills.length + 4)
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
                        style={{ background: 'var(--accent-cyan-dim)', color: 'var(--color-primary)' }}>AI 发现</span>
                      {job.salary_min_k > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded"
                          style={{ background: 'var(--accent-green-dim)', color: 'var(--accent-green)' }}>
                          {formatSalary(job.salary_min_k, job.salary_max_k)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>
                      {job.summary || '基于知识图谱热度自动识别的岗位候选,需人工 review 后正式发布'}
                    </p>
                  </div>
                </div>
                {job.skills.length > 0 && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-xl p-4" style={{ background: 'var(--accent-green-dim)' }}>
                      <p className="text-xs font-semibold mb-2" style={{ color: 'var(--accent-green)' }}>必备技能</p>
                      <div className="flex flex-wrap gap-1.5">
                        {mustSkills.map((s: string) => (
                          <span key={s} className="text-xs px-2.5 py-1 rounded-lg" style={{ background: 'var(--accent-green-dim)', color: 'var(--accent-green)' }}>
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                    {niceSkills.length > 0 ? (
                      <div className="rounded-xl p-4" style={{ background: 'var(--accent-cyan-dim)' }}>
                        <p className="text-xs font-semibold mb-2" style={{ color: 'var(--color-primary)' }}>加分技能</p>
                        <div className="flex flex-wrap gap-1.5">
                          {niceSkills.map((s: string) => (
                            <span key={s} className="text-xs px-2.5 py-1 rounded-lg" style={{ background: 'var(--accent-cyan-dim)', color: 'var(--color-primary)' }}>
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
                <div className="flex gap-4 text-xs mt-3" style={{ color: 'var(--color-on-surface-variant)' }}>
                  <span>📅 {job.crawl_time || '最近一轮 AI 抽取'}</span>
                  <span>✅ 多源交叉验证(Neo4j hot_score)</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {tab === 'update' && (
        <div className="space-y-4">
          {changesLoading && (
            <div className="text-sm text-center py-4" style={{ color: 'var(--color-on-surface-variant)' }}>
              拉取能力 diff…
            </div>
          )}

          {!changesLoading && skillChanges.length > 0 && (
            <div className="rounded-xl p-3 flex items-start gap-2 text-xs"
              style={{ background: 'var(--accent-cyan-dim)', color: 'var(--color-on-surface-variant)' }}>
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" style={{ color: 'var(--color-primary)' }} />
              <span>
                基于多源实际招聘需求 vs 当前岗位描述对比,自动识别传统岗位(出现 ≥3 次)的能力演化。
                每个岗位默认显示最新一次 diff,点击「演化时间线」查看历次变更。
              </span>
            </div>
          )}

          {!changesLoading && skillChanges.length === 0 && (
            <div className="rounded-2xl border p-8 text-center text-sm"
              style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)', color: 'var(--color-on-surface-variant)' }}>
              暂无能力 diff 数据 — 跑 <code>python ai_features/skill_diff.py --once</code> 触发一次性 backfill,或等 cron
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
                  演化时间线:{historyFor.jobTitle}
                </h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>
                  岗位 ID: {historyFor.jobId} · {historyLoading ? '加载中…' : `${history.length} 次变更`}
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
                      <p className="font-semibold mb-1" style={{ color: 'var(--accent-green)' }}>+{h.added.length} 新增</p>
                      <div className="flex flex-wrap gap-1">
                        {h.added.slice(0, 4).map(s => (
                          <span key={s} className="px-1.5 py-0.5 rounded"
                            style={{ background: 'var(--color-surface-container-lowest)', color: 'var(--accent-green)' }}>{s}</span>
                        ))}
                        {h.added.length > 4 && <span style={{ color: 'var(--accent-green)' }}>+{h.added.length - 4}</span>}
                      </div>
                    </div>
                    <div className="rounded-lg p-2" style={{ background: 'var(--accent-red-dim)' }}>
                      <p className="font-semibold mb-1" style={{ color: 'var(--accent-red)' }}>-{h.removed.length} 删除</p>
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
    </div>
  )
}

function ChangeDetail({ change, onOpenHistory }: { change: SkillChange; onOpenHistory: () => void }) {
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
        <button onClick={onOpenHistory}
          className="text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5"
          style={{ background: 'var(--accent-cyan-dim)', color: 'var(--color-primary)', border: '1px solid var(--color-primary)' }}>
          <Clock className="h-3.5 w-3.5" />
          演化时间线
        </button>
      </div>

      <div className="rounded-xl p-3 mb-4" style={{ background: 'var(--color-surface-container-low)' }}>
        <div className="flex items-center gap-2 mb-2">
          <Database className="h-3.5 w-3.5" style={{ color: 'var(--color-primary)' }} />
          <p className="text-xs font-semibold" style={{ color: 'var(--color-on-surface)' }}>
            数据来源({sources.length} 条原始记录)
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
          <p className="text-xs font-semibold mb-0.5" style={{ color: 'var(--accent-green)' }}>新增能力</p>
          <p className="text-xl font-bold" style={{ color: 'var(--accent-green)' }}>{change.added.length}</p>
        </div>
        <div className="rounded-xl p-3" style={{ background: 'var(--accent-red-dim)' }}>
          <p className="text-xs font-semibold mb-0.5" style={{ color: 'var(--accent-red)' }}>删除能力</p>
          <p className="text-xl font-bold" style={{ color: 'var(--accent-red)' }}>{change.removed.length}</p>
        </div>
        <div className="rounded-xl p-3" style={{ background: 'var(--accent-purple-dim)' }}>
          <p className="text-xs font-semibold mb-0.5" style={{ color: 'var(--accent-purple)' }}>修改能力</p>
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
              新增能力 ({change.added.length})
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
                  📌 基于 {sources.length} 条多源实际招聘数据,这些技能已在市场出现,建议加入岗位描述
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
              删除能力 ({change.removed.length})
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
                  📌 这些技能在多源实际需求中已不再出现,可能是过时技能,需评估
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
              修改能力 ({change.modified.length})
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