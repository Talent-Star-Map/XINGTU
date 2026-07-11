import { useState } from 'react'
import { Search, MapPin, SlidersHorizontal, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

const allJobs = [
  { id: 1, title: 'AI 应用开发工程师', company: '字节跳动', location: '北京', salary_min: 25, salary_max: 50, skills: ['Python', 'LangChain', 'RAG', 'Prompt Engineering', 'FastAPI'], experience: '3-5年', tag: '火热', match: 92 },
  { id: 2, title: '大模型算法工程师', company: '阿里巴巴', location: '杭州', salary_min: 30, salary_max: 60, skills: ['Python', 'PyTorch', 'LLM', 'NLP', 'DeepSpeed'], experience: '3-5年', tag: '火热', match: 78 },
  { id: 3, title: 'Java 后端开发工程师', company: '腾讯科技', location: '深圳', salary_min: 20, salary_max: 40, skills: ['Java', 'Spring Boot', 'Spring Cloud', 'MySQL', 'Redis', 'K8s'], experience: '3-5年', match: 88 },
  { id: 4, title: 'AI Agent 开发工程师', company: '科大讯飞', location: '合肥', salary_min: 20, salary_max: 45, skills: ['Python', 'LangChain', 'Agent框架', 'MCP协议', '向量数据库'], experience: '3-5年', tag: '新兴', match: 65 },
  { id: 5, title: '数据工程师', company: '快手', location: '北京', salary_min: 20, salary_max: 35, skills: ['Spark', 'Flink', 'Kafka', 'Hive', 'SQL', 'Python'], experience: '3-5年', match: 72 },
  { id: 6, title: '云原生开发工程师', company: '华为', location: '东莞', salary_min: 20, salary_max: 40, skills: ['Go', 'K8s', 'Docker', 'Istio', 'Prometheus', 'gRPC'], experience: '3-5年', match: 55 },
  { id: 7, title: '提示词工程师', company: '百度', location: '北京', salary_min: 18, salary_max: 35, skills: ['Prompt Engineering', 'Python', 'RAG', 'AI Evaluation'], experience: '1-3年', tag: '新兴', match: 60 },
  { id: 8, title: 'MCP 协议开发工程师', company: '智谱AI', location: '北京', salary_min: 25, salary_max: 50, skills: ['MCP协议', 'Python', 'Go', 'API设计', 'Agent框架'], experience: '3-5年', tag: '新发', match: 45 },
]

const allSkills = [...new Set(allJobs.flatMap(j => j.skills))].sort()
const cities = [...new Set(allJobs.map(j => j.location))]

export default function Jobs() {
  const [search, setSearch] = useState('')
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null)
  const [selectedCity, setSelectedCity] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  const filtered = allJobs.filter(j => {
    const m1 = !search || j.title.includes(search) || j.company.includes(search)
    const m2 = !selectedSkill || j.skills.includes(selectedSkill)
    const m3 = !selectedCity || j.location.includes(selectedCity)
    return m1 && m2 && m3
  })

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
                {allSkills.map(s => {
                  const a = selectedSkill === s
                  return <button key={s} onClick={() => setSelectedSkill(a ? null : s)} className="px-3 py-1.5 rounded-lg text-sm font-medium" style={{ background: a ? 'var(--color-primary)' : 'var(--color-surface)', color: a ? '#fff' : 'var(--color-on-surface-variant)', border: a ? 'none' : '1px solid var(--color-outline-variant)' }}>{s}</button>
                })}
              </div>
              <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--color-outline-variant)' }}>
                <div className="flex items-center gap-2 mb-3"><span className="text-sm font-semibold" style={{ color: 'var(--color-on-surface)' }}>城市</span></div>
                <div className="flex flex-wrap gap-2">
                  {cities.map(c => {
                    const a = selectedCity === c
                    return <button key={c} onClick={() => setSelectedCity(a ? null : c)} className="px-3 py-1.5 rounded-lg text-sm font-medium" style={{ background: a ? 'var(--color-primary)' : 'var(--color-surface)', color: a ? '#fff' : 'var(--color-on-surface-variant)', border: a ? 'none' : '1px solid var(--color-outline-variant)' }}>{c}</button>
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
                  <p className="text-sm mt-1 flex items-center gap-2" style={{ color: '#394851' }}>
                    <span>{job.company}</span>
                    <span className="w-1 h-1 rounded-full" style={{ background: 'var(--color-outline-variant)' }} />
                    <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{job.location}</span>
                    <span className="w-1 h-1 rounded-full" style={{ background: 'var(--color-outline-variant)' }} />
                    <span>{job.experience}</span>
                  </p>
                </div>
                <p className="text-lg font-bold shrink-0" style={{ color: 'var(--color-primary)' }}>{job.salary_min}K-{job.salary_max}K</p>
              </div>
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                {job.skills.slice(0, 5).map(s => (
                  <span key={s} className="rounded-full px-3 py-1 text-xs font-medium" style={{ background: '#D5E4FA', color: '#434654' }}>{s}</span>
                ))}
                {job.skills.length > 5 && <span className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>+{job.skills.length - 5}</span>}
                {job.tag && <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ background: job.tag === '新发' ? 'var(--color-primary-fixed)' : 'rgba(255,140,66,0.15)', color: job.tag === '新发' ? 'var(--color-primary)' : '#D97706' }}>{job.tag}</span>}
              </div>
              <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: 'var(--color-outline-variant)' }}>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: '#D4E5F0', color: '#0D1D25' }}>HR</div>
                  <span className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>招聘方 · 今日活跃</span>
                </div>
                <div className="flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold" style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-primary)' }}>AI 匹配 {job.match}%</div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
