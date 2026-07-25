import { useState, useEffect } from 'react'
import { Search, MapPin, SlidersHorizontal, X, Loader2, AlertCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

// 岗位数据结构（对接同事部署的新版 /api/jobs 接口字段）
interface JobItem {
  id: number
  title: string
  company: string
  location: string         // 工作城市
  area?: string            // 工作区域，如"黄浦"
  salary_min: number       // 薪资下限，单位：元
  salary_max: number       // 薪资上限，单位：元
  education?: string       // 学历要求
  experience?: string      // 经验要求
  job_type?: string        // 工作类型（全职/实习等，爬虫数据可能脏）
  category?: string        // 岗位分类，如"后端开发"
  company_type?: string    // 企业性质，如"科技互联网"
  skills: string[]         // 技能标签（爬虫提取，可能为空数组）
  description?: string     // 岗位描述
  publish_time?: string    // 发布时间
  crawl_time?: string      // 采集时间
}

// 同事部署的后端服务器地址（新版 /api/jobs，300 条真实爬虫数据）
const API_URL = 'http://180.76.227.159:8081/api/jobs'

export default function Jobs() {
  const [jobs, setJobs] = useState<JobItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null)
  const [selectedCity, setSelectedCity] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  // 初次挂载拉取岗位列表（一次拉 300 条，前端做搜索/筛选）
  useEffect(() => {
    fetch(`${API_URL}?page=1&size=300`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then(json => {
        if (json.success) {
          setJobs(json.data || [])
        } else {
          setError(json.message || '接口返回失败')
        }
      })
      .catch(err => setError(err.message || '网络请求失败'))
      .finally(() => setLoading(false))
  }, [])

  // 从全部岗位中聚合可选技能和城市（过滤空字符串和脏数据）
  const allSkills = [...new Set(jobs.flatMap(j => j.skills || []))]
    .filter(s => s && s.trim().length <= 20)  // 过滤掉过长的描述性字符串
    .sort()
  const cities = [...new Set(jobs.map(j => j.location))].filter(Boolean).sort()

  // 前端过滤：关键字搜索 + 技能筛选 + 城市筛选
  const filtered = jobs.filter(j => {
    const m1 = !search || j.title.includes(search) || j.company.includes(search)
    const m2 = !selectedSkill || (j.skills || []).includes(selectedSkill)
    const m3 = !selectedCity || j.location.includes(selectedCity)
    return m1 && m2 && m3
  })

  // 薪资元转 K 显示（接口单位是元，前端展示用 K）
  const formatSalary = (min: number, max: number) => `${Math.round(min / 1000)}K-${Math.round(max / 1000)}K`

  // 发布时间只取日期部分（接口返回 "2026-07-09 00:00:00"）
  const formatDate = (t?: string) => t ? t.split(' ')[0] : ''

  // 加载中
  if (loading) {
    return (
      <div className="max-w-[1400px] mx-auto px-6 py-8">
        <div className="flex items-center justify-center py-20 gap-3" style={{ color: 'var(--color-on-surface-variant)' }}>
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">正在加载岗位列表...</span>
        </div>
      </div>
    )
  }

  // 加载失败
  if (error) {
    return (
      <div className="max-w-[1400px] mx-auto px-6 py-8">
        <div className="flex flex-col items-center justify-center py-20 gap-3" style={{ color: 'var(--color-on-surface-variant)' }}>
          <AlertCircle className="h-8 w-8" style={{ color: 'var(--accent-red)' }} />
          <p className="text-sm">岗位加载失败：{error}</p>
          <p className="text-xs" style={{ color: 'var(--color-outline-variant)' }}>请检查网络或后端服务 {API_URL}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8">
      <div className="flex gap-3 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4.5 w-4.5" style={{ color: 'var(--color-on-surface-variant)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索职位、技能或公司..."
            className="w-full h-12 rounded-xl border pl-11 pr-4 text-sm outline-none transition-all focus:border-[var(--color-primary)]"
            style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)', color: 'var(--color-on-surface)' }} />
        </div>
        <button onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 h-12 px-5 rounded-xl border text-sm font-medium transition-all"
          style={{ borderColor: showFilters ? 'var(--color-primary)' : 'var(--color-outline-variant)', background: showFilters ? 'var(--color-primary-fixed)' : 'var(--color-surface-container-lowest)', color: showFilters ? 'var(--color-primary)' : 'var(--color-on-surface-variant)' }}>
          <SlidersHorizontal className="h-4.5 w-4.5" /> 筛选
        </button>
      </div>

      <AnimatePresence>
        {showFilters && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mb-6">
            <div className="rounded-xl border p-5" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
              <div className="flex items-center gap-2 mb-3"><span className="text-sm font-semibold" style={{ color: 'var(--color-on-surface)' }}>技能</span>{selectedSkill && <button onClick={() => setSelectedSkill(null)} className="text-xs ml-auto" style={{ color: 'var(--color-primary)' }}>清除</button>}</div>
              <div className="flex flex-wrap gap-2">
                {allSkills.slice(0, 50).map(s => {
                  const a = selectedSkill === s
                  return <button key={s} onClick={() => setSelectedSkill(a ? null : s)} className="px-3 py-1.5 rounded-lg text-sm font-medium" style={{ background: a ? 'var(--color-primary)' : 'var(--color-surface)', color: a ? 'var(--color-on-primary)' : 'var(--color-on-surface-variant)', border: a ? 'none' : '1px solid var(--color-outline-variant)' }}>{s}</button>
                })}
                {allSkills.length > 50 && <span className="text-xs px-3 py-1.5" style={{ color: 'var(--color-on-surface-variant)' }}>+{allSkills.length - 50} 项</span>}
              </div>
              <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--color-outline-variant)' }}>
                <div className="flex items-center gap-2 mb-3"><span className="text-sm font-semibold" style={{ color: 'var(--color-on-surface)' }}>城市</span></div>
                <div className="flex flex-wrap gap-2">
                  {cities.map(c => {
                    const a = selectedCity === c
                    return <button key={c} onClick={() => setSelectedCity(a ? null : c)} className="px-3 py-1.5 rounded-lg text-sm font-medium" style={{ background: a ? 'var(--color-primary)' : 'var(--color-surface)', color: a ? 'var(--color-on-primary)' : 'var(--color-on-surface-variant)', border: a ? 'none' : '1px solid var(--color-outline-variant)' }}>{c}</button>
                  })}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>共 <span className="font-bold" style={{ color: 'var(--color-on-surface)' }}>{filtered.length}</span> 个岗位</p>
        <div className="flex gap-2">
          {selectedSkill && <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs" style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-primary)' }}>{selectedSkill}<X className="h-3 w-3 ml-0.5 cursor-pointer" onClick={() => setSelectedSkill(null)} /></span>}
          {selectedCity && <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs" style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-primary)' }}>{selectedCity}<X className="h-3 w-3 ml-0.5 cursor-pointer" onClick={() => setSelectedCity(null)} /></span>}
        </div>
      </div>

      <div className="space-y-4">
        {filtered.map((job, i) => (
          <motion.div key={job.id} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.04 }}
            className="rounded-xl p-6 transition-all duration-300 group cursor-pointer border relative overflow-hidden"
            style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
            <div className="absolute top-0 right-0 w-32 h-32 rounded-bl-full -z-10 transition-transform group-hover:scale-110" style={{ background: 'var(--color-primary-fixed)' }} />
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-headline text-lg font-bold group-hover:text-[var(--color-primary)] transition-colors" style={{ color: 'var(--color-on-surface)' }}>{job.title}</h3>
                  <p className="text-sm mt-1 flex items-center gap-2 flex-wrap" style={{ color: 'var(--color-on-surface-variant)' }}>
                    <span>{job.company}</span>
                    <span className="w-1 h-1 rounded-full" style={{ background: 'var(--color-outline-variant)' }} />
                    <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{job.location}{job.area ? `·${job.area}` : ''}</span>
                    {job.experience && (
                      <>
                        <span className="w-1 h-1 rounded-full" style={{ background: 'var(--color-outline-variant)' }} />
                        <span>{job.experience}</span>
                      </>
                    )}
                    {job.education && (
                      <>
                        <span className="w-1 h-1 rounded-full" style={{ background: 'var(--color-outline-variant)' }} />
                        <span>{job.education}</span>
                      </>
                    )}
                  </p>
                </div>
                <p className="text-lg font-bold shrink-0" style={{ color: 'var(--color-primary)' }}>{formatSalary(job.salary_min, job.salary_max)}</p>
              </div>
              {/* 技能标签 + 岗位分类 */}
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                {job.category && <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-primary)' }}>{job.category}</span>}
                {(job.skills || []).slice(0, 5).map(s => (
                  <span key={s} className="rounded-full px-3 py-1 text-xs font-medium" style={{ background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface-variant)' }}>{s}</span>
                ))}
                {job.skills && job.skills.length > 5 && <span className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>+{job.skills.length - 5}</span>}
                {(!job.skills || job.skills.length === 0) && <span className="text-xs italic" style={{ color: 'var(--color-outline-variant)' }}>暂无技能标签</span>}
              </div>
              {/* 底部信息：企业性质 + 发布时间 */}
              <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: 'var(--color-outline-variant)' }}>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface-variant)' }}>HR</div>
                  <span className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                    {job.company_type || '企业招聘'}
                    {job.job_type ? ` · ${job.job_type}` : ''}
                  </span>
                </div>
                {job.publish_time && <span className="text-xs" style={{ color: 'var(--color-outline-variant)' }}>发布于 {formatDate(job.publish_time)}</span>}
              </div>
            </div>
          </motion.div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-20" style={{ color: 'var(--color-on-surface-variant)' }}>
            <p className="text-sm">没有符合条件的岗位</p>
          </div>
        )}
      </div>
    </div>
  )
}
