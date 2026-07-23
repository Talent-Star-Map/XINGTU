import { useState } from 'react'
import { Search, SlidersHorizontal, X, MapPin, Sparkles, Target } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { REGION_DATA } from './regionData'

interface JobSummary {
  id: number
  title: string
  company: string
  salary: string
  location: string
  skills: string[]
}

interface Props {
  jobs: JobSummary[]
  recommendations: any[]
  mode: 'recommend' | 'diagnose'
  search: string
  selectedCity: string | null
  showFilters: boolean
  selectedJobId: number | null
  onSearchChange: (v: string) => void
  onToggleFilters: () => void
  onSelectCity: (c: string | null) => void
  onSelectJob: (job: JobSummary) => void
  onDiagnose: (job: JobSummary) => void
  onClearRecommendations: () => void
}

export default function JobSelector({
  jobs, recommendations, mode, search, selectedCity,
  showFilters, selectedJobId, onSearchChange, onToggleFilters,
  onSelectCity, onSelectJob, onDiagnose, onClearRecommendations,
}: Props) {
  const [province, setProvince] = useState('')
  const [regionCity, setRegionCity] = useState('')
  const [district, setDistrict] = useState('')

  const cities = [...new Set(jobs.map(j => j.location))].sort()
  const regionCities = province ? Object.keys(REGION_DATA[province] || {}) : []
  const districts = province && regionCity ? (REGION_DATA[province]?.[regionCity] || []) : []

  const handleProvinceChange = (p: string) => { setProvince(p); setRegionCity(''); setDistrict('') }
  const handleRegionCityChange = (c: string) => { setRegionCity(c); setDistrict('') }

  // 地区过滤：省/市/区任一匹配即命中
  const getRegionKeyword = () => {
    if (district) return district
    if (regionCity) return regionCity.replace(/市$/, '')
    if (province) return province
    return ''
  }

  // 地区关键词：区 > 市 > 省
  const regionKw = getRegionKeyword()

  // 统一过滤逻辑：搜索 + 城市标签 + 地区三级
  const applyFilters = (list: JobSummary[]) => list.filter(j => {
    const matchSearch = !search
      || j.title.toLowerCase().includes(search.toLowerCase())
      || j.company.toLowerCase().includes(search.toLowerCase())
      || j.skills.some(s => s.toLowerCase().includes(search.toLowerCase()))
    const matchCity = !selectedCity || j.location.includes(selectedCity)
    const matchRegion = !regionKw || j.location.includes(regionKw)
    return matchSearch && matchCity && matchRegion
  })

  const showRecBanner = mode === 'recommend' && recommendations.length > 0
  const listJobs = applyFilters(
    showRecBanner
      ? recommendations.map(j => jobs.find(f => f.id === j.job_id)).filter(Boolean) as JobSummary[]
      : jobs
  )

  return (
    <div className="space-y-4">
      {/* 搜索栏 */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 h-4.5 w-4.5"
            style={{ color: 'var(--color-on-surface-variant)' }}
          />
          <input
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="搜索职位、技能或公司..."
            className="w-full h-11 rounded-xl border pl-11 pr-4 text-sm outline-none transition-all focus:border-[var(--color-primary)]"
            style={{
              borderColor: 'var(--color-outline-variant)',
              background: 'var(--color-surface-container-lowest)',
              color: 'var(--color-on-surface)',
            }}
          />
        </div>
        <button
          onClick={onToggleFilters}
          className="flex items-center gap-2 h-11 px-5 rounded-xl border text-sm font-medium transition-all"
          style={{
            borderColor: showFilters ? 'var(--color-primary)' : 'var(--color-outline-variant)',
            background: showFilters ? 'var(--color-primary-fixed)' : 'var(--color-surface-container-lowest)',
            color: showFilters ? 'var(--color-primary)' : 'var(--color-on-surface-variant)',
          }}
        >
          <SlidersHorizontal className="h-4.5 w-4.5" /> 筛选
        </button>
      </div>

      {/* 筛选面板 — 地区三级 + 城市标签 */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div
              className="rounded-xl border p-5 space-y-4"
              style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}
            >
              {/* 地区三级联动 */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-semibold" style={{ color: 'var(--color-on-surface)' }}>地区</span>
                  {(province || regionCity || district) && (
                    <button onClick={() => { setProvince(''); setRegionCity(''); setDistrict('') }} className="text-xs ml-auto" style={{ color: 'var(--color-primary)' }}>清除</button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <select value={province} onChange={e => handleProvinceChange(e.target.value)}
                    className="h-8 rounded-lg border px-2 text-xs outline-none"
                    style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface)', color: 'var(--color-on-surface)' }}>
                    <option value="">不限</option>
                    {Object.keys(REGION_DATA).map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <select value={regionCity} onChange={e => handleRegionCityChange(e.target.value)} disabled={!province}
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

      {/* 结果统计 + 已选筛选标签 */}
      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
          共 <span className="font-bold" style={{ color: 'var(--color-on-surface)' }}>{listJobs.length}</span> 个岗位
        </p>
        <div className="flex gap-2">
          {selectedCity && (
            <span
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs cursor-pointer"
              style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-primary)' }}
              onClick={() => onSelectCity(null)}
            >{selectedCity}<X className="h-3 w-3 ml-0.5" /></span>
          )}
        </div>
      </div>

      {/* 推荐结果提示 */}
      {showRecBanner && (
        <div
          className="rounded-xl border p-4 mb-2 flex items-center justify-between"
          style={{ borderColor: 'var(--color-primary-fixed)', background: 'var(--color-primary-fixed)' }}
        >
          <p className="text-sm font-semibold" style={{ color: 'var(--color-primary)' }}>
            为您推荐 {recommendations.length} 个匹配岗位（点击卡片查看详情）
          </p>
          <button
            onClick={onClearRecommendations}
            className="text-xs font-medium px-3 py-1.5 rounded-lg border flex items-center gap-1 shrink-0"
            style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}
          ><X className="h-3 w-3" /> 取消匹配</button>
        </div>
      )}

      {/* 岗位卡片列表 */}
      <div className="space-y-4">
        {listJobs.map((job: JobSummary, i: number) => {
          const rec = showRecBanner ? recommendations.find((r: any) => r.job_id === job.id) : null
          return (
            <motion.div
              key={job.id}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.04 }}
              onClick={() => onSelectJob(job)}
              className="rounded-xl p-6 transition-all duration-300 group cursor-pointer border relative overflow-hidden"
              style={{
                borderColor: selectedJobId === job.id ? 'var(--color-primary)' : 'var(--color-outline-variant)',
                background: 'var(--color-surface-container-lowest)',
              }}
            >
              <div
                className="absolute top-0 right-0 w-32 h-32 rounded-bl-full -z-10 transition-transform group-hover:scale-110"
                style={{ background: 'var(--color-primary-fixed)' }}
              />
              <div className="relative z-10">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3
                      className="text-lg font-bold group-hover:text-[var(--color-primary)] transition-colors"
                      style={{ color: 'var(--color-on-surface)' }}
                    >{job.title}</h3>
                    <p className="text-sm mt-1 flex items-center gap-2" style={{ color: 'var(--color-on-surface-variant)' }}>
                      <span>{job.company}</span>
                      <span className="w-1 h-1 rounded-full" style={{ background: 'var(--color-outline-variant)' }} />
                      <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{job.location}</span>
                      <span className="w-1 h-1 rounded-full" style={{ background: 'var(--color-outline-variant)' }} />
                      <span>{job.experience || '3-5年'}</span>
                    </p>
                  </div>
                  <p className="text-lg font-bold shrink-0" style={{ color: 'var(--color-primary)' }}>{job.salary}</p>
                </div>
                <div className="flex items-center gap-2 mb-4 flex-wrap">
                  {job.skills.slice(0, 5).map((s: string) => (
                    <span key={s} className="rounded-full px-3 py-1 text-xs font-medium" style={{ background: '#D5E4FA', color: '#434654' }}>{s}</span>
                  ))}
                  {job.skills.length > 5 && (
                    <span className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>+{job.skills.length - 5}</span>
                  )}
                </div>
                <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: 'var(--color-outline-variant)' }}>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: '#D4E5F0', color: '#0D1D25' }}>HR</div>
                    <span className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>招聘方 · 今日活跃</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {rec && (
                      <div
                        className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold"
                        style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-primary)' }}
                      >AI 匹配 {Math.round(rec.overall)}%</div>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); onDiagnose(job) }}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                      style={{ background: 'var(--color-primary)' }}
                    ><Target className="h-3 w-3" /> 差距诊断</button>
                  </div>
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
