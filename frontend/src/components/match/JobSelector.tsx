import { useState, useEffect } from 'react'
import { Search, SlidersHorizontal, X, MapPin, Target } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { REGION_DATA } from './regionData'

interface JobSummary {
  id: number; title: string; company: string; salary: string; location: string; skills: string[]
}

interface Props {
  jobs: JobSummary[]           // 全部数据
  displayJobs: JobSummary[]    // 当前页数据（父组件分页后的）
  recommendations: any[]
  mode: 'recommend' | 'diagnose'
  selectedJobId: number | null
  onSelectJob: (job: JobSummary) => void
  onDiagnose: (job: JobSummary) => void
  onFilterChange: (filtered: JobSummary[]) => void
}

export default function JobSelector({
  jobs, displayJobs, recommendations, mode, selectedJobId,
  onSelectJob, onDiagnose, onFilterChange,
}: Props) {
  const [search, setSearch] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [province, setProvince] = useState('')
  const [regionCity, setRegionCity] = useState('')
  const [district, setDistrict] = useState('')

  const regionCities = province ? Object.keys(REGION_DATA[province] || {}) : []
  const districts = province && regionCity ? (REGION_DATA[province]?.[regionCity] || []) : []

  // 搜索/筛选变化时通知父组件
  useEffect(() => {
    const regionKw = district || (regionCity ? regionCity.replace(/市$/, '') : '') || province || ''
    const list = jobs.filter(j => {
      const matchSearch = !search
        || j.title.toLowerCase().includes(search.toLowerCase())
        || j.company.toLowerCase().includes(search.toLowerCase())
        || j.skills.some(s => s.toLowerCase().includes(search.toLowerCase()))
      const matchRegion = !regionKw || j.location.includes(regionKw)
      return matchSearch && matchRegion
    })
    onFilterChange(list)
  }, [jobs, search, province, regionCity, district, onFilterChange])

  const clearRegion = () => { setProvince(''); setRegionCity(''); setDistrict('') }

  const showRecBanner = mode === 'recommend' && recommendations.length > 0

  return (
    <div className="space-y-4">
      {/* 搜索栏 */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4.5 w-4.5" style={{ color: 'var(--color-on-surface-variant)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="搜索职位、技能或公司..."
            className="w-full h-11 rounded-xl border pl-11 pr-4 text-sm outline-none transition-all focus:border-[var(--color-primary)]"
            style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)', color: 'var(--color-on-surface)' }} />
        </div>
        <button onClick={() => setShowFilters(v => !v)}
          className="flex items-center gap-2 h-11 px-5 rounded-xl border text-sm font-medium transition-all"
          style={{
            borderColor: showFilters ? 'var(--color-primary)' : 'var(--color-outline-variant)',
            background: showFilters ? 'var(--color-primary-fixed)' : 'var(--color-surface-container-lowest)',
            color: showFilters ? 'var(--color-primary)' : 'var(--color-on-surface-variant)',
          }}>
          <SlidersHorizontal className="h-4.5 w-4.5" /> 筛选
        </button>
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
                  <select value={province} onChange={e => { setProvince(e.target.value); setRegionCity(''); setDistrict('') }}
                    className="h-8 rounded-lg border px-2 text-xs outline-none"
                    style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface)', color: 'var(--color-on-surface)' }}>
                    <option value="">不限</option>
                    {Object.keys(REGION_DATA).map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <select value={regionCity} onChange={e => { setRegionCity(e.target.value); setDistrict('') }} disabled={!province}
                    className="h-8 rounded-lg border px-2 text-xs outline-none disabled:opacity-40"
                    style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface)', color: 'var(--color-on-surface)' }}>
                    <option value="">不限</option>
                    {regionCities.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <select value={district} onChange={e => setDistrict(e.target.value)} disabled={!regionCity}
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

      {/* 推荐提示 */}
      {showRecBanner && (
        <div className="rounded-xl border p-4 flex items-center justify-between"
          style={{ borderColor: 'var(--color-primary-fixed)', background: 'var(--color-primary-fixed)' }}>
          <p className="text-sm font-semibold" style={{ color: 'var(--color-primary)' }}>
            为您推荐 {recommendations.length} 个匹配岗位
          </p>
        </div>
      )}

      {/* 岗位卡片 - 渲染父组件分页后的数据 */}
      <div className="space-y-4">
        {displayJobs.map((job, i) => {
          const rec = showRecBanner ? recommendations.find((r: any) => r.job_id === job.id) : null
          return (
            <motion.div key={job.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              onClick={() => onSelectJob(job)}
              className="rounded-xl p-5 transition-all duration-200 group cursor-pointer border relative overflow-hidden"
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
                  <span className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>招聘方 · 今日活跃</span>
                  <div className="flex items-center gap-2">
                    {rec && (
                      <span className="text-xs font-bold px-2 py-1 rounded-full"
                        style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-primary)' }}>
                        AI {Math.round(rec.overall)}%
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
        {displayJobs.length === 0 && (
          <div className="text-center py-12" style={{ color: 'var(--color-on-surface-variant)' }}>
            <p className="text-sm">没有符合条件的岗位</p>
          </div>
        )}
      </div>
    </div>
  )
}
