/**
 * MarketInsight — 企业端岗位图谱(画布优先)
 *
 * 图谱是页面的中心:整页只有一个头部条 + 全幅画布。
 * 其余 UI 全部悬浮在画布之上、按需出现:
 *   - 顶部居中:图例 + 适配视图/清除聚焦
 *   - 左侧:在招岗位导航(可收起)
 *   - 右侧:选中节点后才出现的诊断面板
 *   - 底部:一行可点击的市场结论(无选中时)/ 聚焦提示(有选中时)
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Briefcase, Maximize2, PanelLeft, X } from 'lucide-react'
import MarketGraph2D, { MarketGraphHandle, MarketNode } from '../../components/enterprise/MarketGraph2D'
import { EPNav } from '../../lib/NavContext'

interface TrendItem { name: string; net: number; added: number; removed: number }

interface GraphResp {
  nodes: MarketNode[]
  links: { source: string; target: string; type: string }[]
  stats: { jobs: number; skills: number; links: number; candidates: number }
  trends: { rising: TrendItem[]; declining: TrendItem[] }
}

const token = () => localStorage.getItem('xingtu_token') || ''

/** 薪资区间条:同技能市场 P25-P75 + 中位线,叠加本岗位区间 */
function SalaryBand({ job }: { job: MarketNode }) {
  const p25 = job.market_p25_k
  const p50 = job.market_p50_k
  const p75 = job.market_p75_k
  const lo = job.salary_min_k
  const hi = job.salary_max_k
  const bench = job.bench_count ?? 0
  if (bench < 5 || p25 == null || p50 == null || p75 == null || !lo || !hi) {
    return (
      <div className="space-y-1">
        <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
          对标样本不足({bench} 个),暂不计算分位
        </p>
        <p className="text-xs" style={{ color: 'var(--color-on-surface)' }}>
          本岗位 {lo && hi ? `${lo}K – ${hi}K` : '面议'}
        </p>
      </div>
    )
  }
  const max = Math.max(p75, hi) * 1.1
  const pos = (v: number) => `${Math.min(100, Math.max(0, (v / max) * 100))}%`
  return (
    <div className="space-y-1.5">
      <div className="relative h-1.5 rounded-full" style={{ background: 'var(--color-surface-container)' }}>
        <div className="absolute inset-y-0 rounded-full" style={{ left: pos(p25), width: `${((p75 - p25) / max) * 100}%`, background: 'var(--color-outline-variant)' }} />
        <div className="absolute -inset-y-1 w-px" style={{ left: pos(p50), background: 'var(--color-on-surface-variant)' }} />
      </div>
      <div className="relative h-1.5 rounded-full" style={{ background: 'var(--color-surface-container)' }}>
        <div className="absolute inset-y-0 rounded-full" style={{ left: pos(lo), width: `${((hi - lo) / max) * 100}%`, background: 'var(--color-primary)' }} />
      </div>
      <div className="flex justify-between text-[11px] tabular-nums" style={{ color: 'var(--color-on-surface-variant)' }}>
        <span>本岗位 {lo}–{hi}K</span>
        <span>市场 P25/P50/P75:{p25}/{p50}/{p75}K</span>
      </div>
    </div>
  )
}

export default function MarketInsight() {
  const { setPage } = EPNav.use()
  const graphRef = useRef<MarketGraphHandle>(null)
  const [data, setData] = useState<GraphResp | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [selectedId, setSelectedId] = useState<string | undefined>()
  const [navOpen, setNavOpen] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/enterprise/market-graph?token=${encodeURIComponent(token())}`)
      .then((r) => r.json())
      .then((j) => {
        if (!j.success) throw new Error(j.error?.message || j.message || '加载失败')
        setData(j.data)
      })
      .catch((e) => setErr(String(e?.message || e)))
      .finally(() => setLoading(false))
  }, [])

  const select = (id?: string) => {
    setSelectedId(id)
    if (id) setTimeout(() => graphRef.current?.focusNode(id), 80)
  }

  const jobs = useMemo(() => (data?.nodes || []).filter((n) => n.type === 'OwnJob'), [data])
  const skills = useMemo(() => (data?.nodes || []).filter((n) => n.type === 'Skill'), [data])
  const skillsByDemand = useMemo(
    () => [...skills].sort((a, b) => (b.demand || 0) - (a.demand || 0)),
    [skills],
  )
  const skillByKey = useMemo(() => {
    const m = new Map<string, MarketNode>()
    skills.forEach((s) => m.set(s.id.replace('skill:', ''), s))
    return m
  }, [skills])
  const graphData = useMemo(
    () => ({ nodes: data?.nodes || [], links: data?.links || [] }),
    [data],
  )

  const selected = useMemo(
    () => (data?.nodes || []).find((n) => n.id === selectedId),
    [data, selectedId],
  )
  const selectedJobId = selected?.type === 'OwnJob' ? Number(selected.id.split(':')[1]) : undefined

  const eligibleJobs = useMemo(() => jobs.filter((j) => j.market_percentile != null), [jobs])
  const aboveMedian = useMemo(
    () => eligibleJobs.filter((j) => (j.market_percentile ?? 0) >= 50).length,
    [eligibleJobs],
  )
  const worstJob = useMemo(
    () => [...jobs].filter((j) => j.market_percentile != null)
      .sort((a, b) => (a.market_percentile || 0) - (b.market_percentile || 0))[0],
    [jobs],
  )
  // 紧俏度 = 需求 / (供给 + 1)
  const tightest = useMemo(
    () => [...skills].filter((s) => (s.demand || 0) >= 10)
      .sort((a, b) => (b.demand || 0) / ((b.supply || 0) + 1) - (a.demand || 0) / ((a.supply || 0) + 1)),
    [skills],
  )
  const topRise = data?.trends.rising?.[0]
  const topRiseSkill = useMemo(
    () => (topRise ? skills.find((s) => s.label.toLowerCase() === topRise.name.toLowerCase()) : undefined),
    [topRise, skills],
  )

  const jobSkillRows = useMemo(() => {
    if (selected?.type !== 'OwnJob') return []
    return (selected.skills || [])
      .map((s) => skillByKey.get(s.toLowerCase()))
      .filter((s): s is MarketNode => Boolean(s))
      .sort((a, b) => (b.demand || 0) - (a.demand || 0))
  }, [selected, skillByKey])

  return (
    <div className="h-full flex flex-col" style={{ background: 'transparent' }}>
      {/* ── 单行头部 ── */}
      <header className="flex items-center justify-between px-5 h-12 shrink-0">
        <div className="flex items-center gap-2.5">
          <span className="ent-pulse" />
          <h1 className="text-sm font-semibold tracking-tight" style={{ color: 'var(--color-on-surface)' }}>岗位图谱</h1>
          <span className="text-xs tabular-nums" style={{ color: 'var(--color-on-surface-variant)' }}>
            在招 {data?.stats.jobs ?? 0} · 技能 {data?.stats.skills ?? 0} · 候选命中 {data?.stats.candidates ?? 0}
          </span>
        </div>
        <span className="text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>数据实时</span>
      </header>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>加载图谱...</div>
      ) : err ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-sm" style={{ color: 'var(--accent-red)' }}>
          <AlertTriangle className="w-6 h-6" />
          <span>图谱加载失败:{err}</span>
        </div>
      ) : jobs.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
          <Briefcase className="w-8 h-8" />
          <span>发布岗位后,图谱会从你的招聘需求生成</span>
          <button onClick={() => setPage('jobs')} className="px-3 py-1.5 rounded-lg text-xs border"
                  style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}>
            去岗位管理
          </button>
        </div>
      ) : (
        <div className="flex-1 min-h-0 relative">
          <div className="absolute inset-0">
            <MarketGraph2D ref={graphRef} data={graphData} selectedId={selectedId} onSelect={setSelectedId} />
          </div>

          {/* 顶部:图例 + 工具 */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-3 rounded-full ent-panel px-3 py-1.5 text-[11px]"
               style={{ color: 'var(--color-on-surface-variant)' }}>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--ent-job)' }} /> 岗位
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: 'var(--ent-skill)' }} /> 技能(大小=热度)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full border" style={{ borderColor: 'var(--accent-green)' }} /> 涨
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full border" style={{ borderColor: 'var(--accent-red)' }} /> 跌
            </span>
            <span style={{ color: 'var(--color-outline)' }}>|</span>
            <button onClick={() => graphRef.current?.fit()} title="适配视图"
                    className="p-1 rounded hover:bg-[var(--color-surface-container)]">
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
            {selectedId && (
              <button onClick={() => setSelectedId(undefined)} title="清除聚焦"
                      className="p-1 rounded hover:bg-[var(--color-surface-container)]">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* 左:岗位导航(可收起) */}
          {navOpen ? (
            <aside className="absolute left-3 top-3 bottom-3 w-[232px] rounded-xl ent-panel flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 border-b shrink-0"
                   style={{ borderColor: 'var(--color-outline-variant)' }}>
                <span className="text-xs font-medium" style={{ color: 'var(--color-on-surface-variant)' }}>在招岗位</span>
                <button onClick={() => setNavOpen(false)} title="收起导航"
                        className="p-1 rounded hover:bg-[var(--color-surface-container)]" style={{ color: 'var(--color-on-surface-variant)' }}>
                  <PanelLeft className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {jobs.map((j) => (
                  <button key={j.id}
                          onClick={() => select(selectedId === j.id ? undefined : j.id)}
                          className="text-left px-3 py-2 text-sm w-full border-l-2 transition-colors"
                          style={{
                            borderLeftColor: selectedId === j.id ? 'var(--color-primary)' : 'transparent',
                            background: selectedId === j.id ? 'var(--color-surface-container)' : 'transparent',
                            color: 'var(--color-on-surface)',
                          }}>
                    <div className="truncate font-medium">{j.label}</div>
                    <div className="text-[11px] mt-0.5 flex flex-wrap gap-x-2 tabular-nums" style={{ color: 'var(--color-on-surface-variant)' }}>
                      <span>{j.salary_min_k && j.salary_max_k ? `${j.salary_min_k}-${j.salary_max_k}K` : '面议'}</span>
                      <span>候选 {j.candidate_count ?? 0}</span>
                      <span>{j.market_percentile != null ? `分位 ${j.market_percentile}%` : '样本不足'}</span>
                      {(j.shortage_skills ?? 0) > 0 && (
                        <span style={{ color: 'var(--accent-orange)' }}>缺 {j.shortage_skills} 项</span>
                      )}
                    </div>
                  </button>
                ))}
                <div className="px-3 pt-3 pb-1.5 text-xs font-medium" style={{ color: 'var(--color-on-surface-variant)' }}>要求技能</div>
                <div className="px-3 pb-3 flex flex-wrap gap-1.5">
                  {skillsByDemand.map((s) => (
                    <button key={s.id}
                            onClick={() => select(selectedId === s.id ? undefined : s.id)}
                            title={`市场需求 ${s.demand ?? 0} · 人才池供给 ${s.supply ?? 0}`}
                            className="px-2 py-0.5 rounded-full border text-xs"
                            style={{
                              borderColor: selectedId === s.id ? 'var(--color-primary)' : 'var(--color-outline-variant)',
                              color: selectedId === s.id ? 'var(--color-primary)' : 'var(--color-on-surface-variant)',
                            }}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </aside>
          ) : (
            <button onClick={() => setNavOpen(true)} title="展开导航"
                    className="absolute left-3 top-3 p-2 rounded-xl ent-panel"
                    style={{ color: 'var(--color-on-surface-variant)' }}>
              <PanelLeft className="w-4 h-4" />
            </button>
          )}

          {/* 右:诊断(仅选中时出现) */}
          {selected && (
            <aside className="absolute right-3 top-3 bottom-3 w-[300px] rounded-xl ent-panel overflow-y-auto px-4 py-4">
              {selected.type === 'OwnJob' ? (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold" style={{ color: 'var(--color-on-surface)' }}>{selected.label}</h3>
                    <p className="text-xs mt-0.5 tabular-nums" style={{ color: 'var(--color-on-surface-variant)' }}>
                      候选 {selected.candidate_count ?? 0}
                      {(selected.shortage_skills ?? 0) > 0 && (
                        <span style={{ color: 'var(--accent-orange)' }}> · 缺 {selected.shortage_skills} 项紧俏技能</span>
                      )}
                    </p>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span style={{ color: 'var(--color-on-surface-variant)' }}>薪资对标</span>
                      <span className="tabular-nums font-semibold" style={{ color: 'var(--color-on-surface)' }}>
                        {selected.market_percentile != null ? `分位 ${selected.market_percentile}%` : '样本不足'}
                      </span>
                    </div>
                    <SalaryBand job={selected} />
                  </div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ color: 'var(--color-on-surface-variant)' }}>
                        <th className="text-left font-normal pb-1">技能</th>
                        <th className="text-right font-normal pb-1">需求</th>
                        <th className="text-right font-normal pb-1">供给</th>
                        <th className="text-right font-normal pb-1">均价</th>
                        <th className="text-right font-normal pb-1">涨跌</th>
                      </tr>
                    </thead>
                    <tbody>
                      {jobSkillRows.map((s) => (
                        <tr key={s.id} className="border-t" style={{ borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface)' }}>
                          <td className="py-1.5">{s.label}</td>
                          <td className="py-1.5 text-right tabular-nums">{s.demand ?? 0}</td>
                          <td className="py-1.5 text-right tabular-nums" style={{ color: (s.supply || 0) === 0 ? 'var(--accent-red)' : undefined }}>{s.supply ?? 0}</td>
                          <td className="py-1.5 text-right tabular-nums">{s.market_avg_salary_k != null ? `${s.market_avg_salary_k}K` : '—'}</td>
                          <td className="py-1.5 text-right tabular-nums"
                              style={{ color: (s.net || 0) > 0 ? 'var(--accent-green)' : (s.net || 0) < 0 ? 'var(--accent-red)' : undefined }}>
                            {(s.net || 0) > 0 ? '+' : ''}{s.net || 0}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="flex gap-2">
                    <button onClick={() => selectedJobId && setPage('talent', { filterJobId: selectedJobId })}
                            className="flex-1 px-3 py-2 rounded-lg text-xs font-medium"
                            style={{ background: 'var(--color-primary)', color: 'var(--color-on-primary)' }}>
                      找候选人
                    </button>
                    <button onClick={() => selectedJobId && setPage('jobs', { selectedJobId })}
                            className="px-3 py-2 rounded-lg text-xs border"
                            style={{ borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface)' }}>
                      调整岗位
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--color-on-surface)' }}>{selected.label}</h3>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg px-2.5 py-2" style={{ background: 'var(--color-surface-container-low)' }}>
                      <div style={{ color: 'var(--color-on-surface-variant)' }}>市场需求</div>
                      <div className="text-base font-semibold tabular-nums mt-0.5" style={{ color: 'var(--color-on-surface)' }}>{selected.demand ?? 0}</div>
                    </div>
                    <div className="rounded-lg px-2.5 py-2" style={{ background: 'var(--color-surface-container-low)' }}>
                      <div style={{ color: 'var(--color-on-surface-variant)' }}>人才池供给</div>
                      <div className="text-base font-semibold tabular-nums mt-0.5"
                           style={{ color: (selected.supply ?? 0) === 0 ? 'var(--accent-red)' : 'var(--color-on-surface)' }}>
                        {selected.supply ?? 0}
                      </div>
                    </div>
                    <div className="rounded-lg px-2.5 py-2" style={{ background: 'var(--color-surface-container-low)' }}>
                      <div style={{ color: 'var(--color-on-surface-variant)' }}>市场均价</div>
                      <div className="text-base font-semibold tabular-nums mt-0.5" style={{ color: 'var(--color-on-surface)' }}>
                        {selected.market_avg_salary_k != null ? `${selected.market_avg_salary_k}K` : '—'}
                      </div>
                    </div>
                    <div className="rounded-lg px-2.5 py-2" style={{ background: 'var(--color-surface-container-low)' }}>
                      <div style={{ color: 'var(--color-on-surface-variant)' }}>近半年变化</div>
                      <div className="text-base font-semibold tabular-nums mt-0.5"
                           style={{ color: (selected.net || 0) > 0 ? 'var(--accent-green)' : (selected.net || 0) < 0 ? 'var(--accent-red)' : 'var(--color-on-surface)' }}>
                        {(selected.net || 0) > 0 ? '+' : ''}{selected.net || 0}
                      </div>
                    </div>
                  </div>
                  {(selected.supply || 0) === 0 && (selected.demand || 0) >= 10 && (
                    <p className="text-xs flex items-start gap-1.5" style={{ color: 'var(--accent-red)' }}>
                      <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      零供给:放宽要求、加价,或换成可培养技能
                    </p>
                  )}
                </div>
              )}
            </aside>
          )}

          {/* 底:一行结论(无选中)/ 聚焦提示(有选中) */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10">
            {selected ? (
              <div className="px-3 py-1 rounded-full ent-panel text-xs flex items-center gap-2"
                   style={{ color: 'var(--color-on-surface-variant)' }}>
                已聚焦:{selected.label}
                <button onClick={() => setSelectedId(undefined)} className="p-0.5 rounded hover:bg-[var(--color-surface-container)]" title="退出聚焦">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div className="px-3 py-1 rounded-full ent-panel text-[11px] flex items-center gap-2 tabular-nums"
                   style={{ color: 'var(--color-on-surface-variant)' }}>
                <button onClick={() => worstJob && select(worstJob.id)} className="hover:underline">
                  {aboveMedian}/{eligibleJobs.length} 岗位薪资高于对标中位
                </button>
                <span style={{ color: 'var(--color-outline)' }}>·</span>
                <button onClick={() => tightest[0] && select(tightest[0].id)} className="hover:underline">
                  最紧技能:{tightest[0]?.label ?? '—'} {tightest[0]?.demand ?? 0}/{tightest[0]?.supply ?? 0}
                </button>
                <span style={{ color: 'var(--color-outline)' }}>·</span>
                <button onClick={() => topRiseSkill && select(topRiseSkill.id)} className="hover:underline">
                  增长:{topRise?.name ?? '—'} {topRise ? `+${topRise.net}` : ''}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
