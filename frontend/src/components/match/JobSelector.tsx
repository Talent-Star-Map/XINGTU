import { useEffect, useState } from 'react'
import { Search, SlidersHorizontal, X, MapPin, Target, ArrowUpDown } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { REGION_DATA } from './regionData'

export interface JobSummary {
  id: number
  title: string
  company: string
  salary: string
  location: string
  skills: string[]
  collected_at?: string
  source?: string
}

export interface JobFilters {
  keyword: string
  city: string
}

export type SortKey = 'match' | 'salary-desc' | 'salary-asc'

export const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'match', label: '推荐排序' },
  { key: 'salary-desc', label: '薪资从高到低' },
  { key: 'salary-asc', label: '薪资从低到高' },
]

interface Props {
  jobs: JobSummary[]           // 当前页要渲染的岗位（父组件已分页/排序）
  recommendations: any[]
  mode: 'recommend' | 'diagnose'
  selectedJobId: number | null
  loading: boolean
  filters: JobFilters
  onFiltersChange: (f: JobFilters) => void
  sort: SortKey
  onSortChange: (s: SortKey) => void
  onSelectJob: (job: JobSummary) => void
  onDiagnose: (job: JobSummary) => void
}

/** 从 "20K-30K" / "面议" 解析出用于排序的下限薪资（元） */
function parseSalaryMin(salary: string): number {
  const m = /(\d+)\s*K/i.exec(salary || '')
  return m ? parseInt(m[1], 10) * 1000 : -1
}

export function sortJobs(jobs: JobSummary[], sort: SortKey, recs: any[]): JobSummary[] {
  if (sort === 'match') {
    if (!recs.length) return jobs
    const rank = new Map<number, number>()
    recs.forEach((r: any, i: number) => rank.set(r.job_id, i))
    return [...jobs].sort((a, b) => (rank.get(a.id) ?? 999) - (rank.get(b.id) ?? 999))
  }
  const dir = sort === 'salary-desc' ? -1 : 1
  return [...jobs].sort((a, b) => dir * (parseSalaryMin(a.salary) - parseSalaryMin(b.salary)))
}

export default function JobSelector({
  jobs, recommendations, mode, selectedJobId, loading,
  filters, onFiltersChange, sort, onSortChange,
  onSelectJob, onDiagnose,
}: Props) {
  const [keyword, setKeyword] = useState(filters.keyword)
  const [showFilters, setShowFilters] = useState(false)
  const [province, setProvince] = useState('')
  const [regionCity, setRegionCity] = useState('')
  const [district, setDistrict] = useState('')

  const regionCities = province ? Object.keys(REGION_DATA[province] || {}) : []
  const districts = province && regionCity ? (REGION_DATA[province]?.[regionCity] || []) : []

  // 关键词输入防抖，避免每敲一个字就打一次接口
  useEffect(() => {
    if (keyword === filters.keyword) return
    const timer = setTimeout(() => onFiltersChange({ ...filters, keyword }), 300)
    return () => clearTimeout(timer)
  }, [keyword, filters, onFiltersChange])

  // 地区变化立即生效
  useEffect(() => {
    const city = district || (regionCity ? regionCity.replace(/市$/, '') : '') || province || ''
    if (city !== filters.city) onFiltersChange({ ...filters, city })
  }, [province, regionCity, district, filters, onFiltersChange])

  const clearRegion = () => { setProvince(''); setRegionCity(''); setDistrict('') }
  const hasFilter = !!(filters.keyword || filters.city)

  const showRecBanner = mode === 'recommend' && recommendations.length > 0

  return (
    <div className="space-y-4">
      {/* 搜索栏 */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex-1 min-w-[220px] relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4.5 w-4.5" style={{ color: 'var(--color-on-surface-variant)' }} />
          <input value={keyword} onChange={e => setKeyword(e.target.value)}
            placeholder="搜索职位、技能或公司..."
            aria-label="搜索职位、技能或公司"
            className="w-full h-11 rounded-xl border pl-11 pr-10 text-sm outline-none transition-all focus:border-[var(--color-primary)]"
            style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)', color: 'var(--color-on-surface)' }} />
          {keyword && (
            <button onClick={() => setKeyword('')} aria-label="清空搜索"
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-black/5">
              <X className="h-3.5 w-3.5" style={{ color: 'var(--color-on-surface-variant)' }} />
            </button>
          )}
        </div>
        <button onClick={() => setShowFilters(v => !v)}
          className="flex items-center gap-2 h-11 px-5 rounded-xl border text-sm font-medium transition-all"
          aria-expanded={showFilters}
          style={{
            borderColor: showFilters ? 'var(--color-primary)' : 'var(--color-outline-variant)',
            background: showFilters ? 'var(--color-primary-fixed)' : 'var(--color-surface-container-lowest)',
            color: showFilters ? 'var(--color-primary)' : 'var(--color-on-surface-variant)',
          }}>
          <SlidersHorizontal className="h-4.5 w-4.5" /> 筛选
        </button>
        <div className="relative">
          <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none"
            style={{ color: 'var(--color-on-surface-variant)' }} />
          <select value={sort} onChange={e => onSortChange(e.target.value as SortKey)}
            aria-label="排序方式"
            className="h-11 pl-9 pr-3 rounded-xl border text-sm outline-none appearance-none"
            style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)', color: 'var(--color-on-surface)' }}>
            {SORT_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {/* 筛选面板 */}
      <AnimatePresence>
        {showFilters && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden">
            <div className="rounded-xl border p-5 space-y-4"
              style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-semibold" style={{ color: 'var(--color-on-surface)' }}>地区</span>
                  {(province || regionCity || district) && (
                    <button onClick={clearRegion} className="text-xs ml-auto" style={{ color: 'var(--color-primary)' }}>清除</button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <select value={province} onChange={e => { setProvince(e.target.value); setRegionCity(''); setDistrict('') }} aria-label="省份"
                    className="h-8 rounded-lg border px-2 text-xs outline-none"
                    style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface)', color: 'var(--color-on-surface)' }}>
                    <option value="">不限</option>
                    {Object.keys(REGION_DATA).map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <select value={regionCity} onChange={e => { setRegionCity(e.target.value); setDistrict('') }} disabled={!province} aria-label="城市"
                    className="h-8 rounded-lg border px-2 text-xs outline-none disabled:opacity-40"
                    style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface)', color: 'var(--color-on-surface)' }}>
                    <option value="">不限</option>
                    {regionCities.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <select value={district} onChange={e => setDistrict(e.target.value)} disabled={!regionCity} aria-label="区县"
                    className="h-8 rounded-lg border px-2 text-xs outline-none disabled:opacity-40"
                    style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface)', color: 'var(--color-on-surface)' }}>
                    <option value="">不限</option>
                    {districts.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 推荐提示 — 给一个明确的返回入口，避免用户困在推荐结果里 */}
      {showRecBanner && (
        <div className="rounded-xl border p-4 flex items-center justify-between gap-3 flex-wrap"
          style={{ borderColor: 'var(--color-primary-fixed)', background: 'var(--color-primary-fixed)' }}>
          <p className="text-sm font-semibold" style={{ color: 'var(--color-primary)' }}>
            为您推荐 {recommendations.length} 个匹配岗位
          </p>
          <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
            分数 = 技能 50% + 经验 20% + 学历 15% + 薪资 15%
          </p>
        </div>
      )}

      {/* 岗位卡片 */}
      <div className="space-y-4">
        {loading && jobs.length === 0 && [0, 1, 2].map(i => (
          <div key={i} className="rounded-xl border p-5 animate-pulse" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
            <div className="h-4 w-1/3 rounded" style={{ background: 'var(--color-surface-container)' }} />
            <div className="h-3 w-1/4 rounded mt-3" style={{ background: 'var(--color-surface-container)' }} />
          </div>
        ))}

        {jobs.map((job, i) => {
          const rec = showRecBanner ? recommendations.find((r: any) => r.job_id === job.id) : null
          const open = () => onSelectJob(job)
          return (
            <motion.div key={job.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.012, 0.3) }}
              role="button" tabIndex={0} aria-label={`${job.title} ${job.company}`}
              onClick={open}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open() } }}
              className="rounded-xl p-5 transition-all duration-200 group cursor-pointer border relative overflow-hidden focus:outline-none focus:ring-2"
              style={{
                borderColor: selectedJobId === job.id ? 'var(--color-primary)' : 'var(--color-outline-variant)',
                background: 'var(--color-surface-container-lowest)',
              }}>
              <div className="absolute top-0 right-0 w-24 h-24 rounded-bl-full -z-10 transition-transform group-hover:scale-110"
                style={{ background: 'var(--color-primary-fixed)' }} />
              <div className="relative z-10">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="text-base font-bold group-hover:text-[var(--color-primary)] transition-colors"
                      style={{ color: 'var(--color-on-surface)' }}>{job.title}</h3>
                    <p className="text-sm mt-1 flex items-center gap-2" style={{ color: 'var(--color-on-surface-variant)' }}>
                      <span>{job.company}</span>
                      <span className="w-1 h-1 rounded-full" style={{ background: 'var(--color-outline-variant)' }} />
                      <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{job.location}</span>
                    </p>
                  </div>
                  <p className="text-base font-bold shrink-0" style={{ color: 'var(--color-primary)' }}>{job.salary}</p>
                </div>
                <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                  {job.skills.slice(0, 6).map(s => (
                    <span key={s} className="rounded-full px-2.5 py-0.5 text-xs" style={{ background: '#D5E4FA', color: '#434654' }}>{s}</span>
                  ))}
                  {job.skills.length > 6 && <span className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>+{job.skills.length - 6}</span>}
                </div>
                <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: 'var(--color-outline-variant)' }}>
                  {/* 展示真实采集时间，不再写死「今日活跃」 */}
                  <span className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                    {job.collected_at ? `采集于 ${job.collected_at}` : (job.source ? `来源 ${job.source}` : '采集时间未标注')}
                  </span>
                  <div className="flex items-center gap-2">
                    {rec && (
                      <span className="text-xs font-bold px-2 py-1 rounded-full"
                        title="综合匹配度：技能 50% + 经验 20% + 学历 15% + 薪资 15%"
                        style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-primary)' }}>
                        匹配 {Math.round(rec.overall)}%
                        {typeof rec.matched_count === 'number' && typeof rec.job_skill_count === 'number' && rec.job_skill_count > 0 && (
                          <span className="ml-1 opacity-70 font-medium">
                            · {rec.matched_count}/{rec.job_skill_count} 技能
                          </span>
                        )}
                      </span>
                    )}
                    <button onClick={e => { e.stopPropagation(); onDiagnose(job) }}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                      style={{ background: 'var(--color-primary)' }}>
                      <Target className="h-3 w-3" /> 诊断
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )
        })}

        {!loading && jobs.length === 0 && (
          <div className="text-center py-12" style={{ color: 'var(--color-on-surface-variant)' }}>
            <p className="text-sm">{hasFilter ? '没有符合条件的岗位，试试放宽搜索条件' : '暂无岗位数据'}</p>
          </div>
        )}
      </div>
    </div>
  )
}
