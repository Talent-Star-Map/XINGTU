import { Briefcase, Building, MapPin, CheckCircle } from 'lucide-react'
import { motion } from 'framer-motion'

interface RecommendedJob {
  job_id: number
  title: string
  company: string
  salary: string
  location: string
  overall: number
  grade: string
  matched_count?: number
  matched_skills?: string[]
  job_skill_count?: number
  top_missing: string[]
  recommend_reason?: string
}

interface Props {
  jobs: RecommendedJob[]
  onSelect: (job: RecommendedJob) => void
}

const GRADE_COLORS: Record<string, string> = {
  S: '#00E599', A: '#00C8FF', B: '#FFB547', C: '#FF8C42', D: '#FF4D6A',
}

export default function RecommendationCarousel({ jobs, onSelect }: Props) {
  if (jobs.length === 0) return null

  return (
    <div className="rounded-2xl border p-6" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
      <h3 className="text-sm font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--color-on-surface)' }}>
        <Briefcase className="h-4 w-4" style={{ color: 'var(--color-primary)' }} />
        推荐岗位 Top {jobs.length}
      </h3>
      <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1">
        {jobs.map((j, i) => {
          const color = GRADE_COLORS[j.grade] || 'var(--color-primary)'
          const matchRate = j.job_skill_count ? Math.round((j.matched_count || 0) / j.job_skill_count * 100) : 0
          return (
            <motion.div key={j.job_id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              onClick={() => onSelect(j)} whileHover={{ scale: 1.02 }}
              className="shrink-0 w-60 rounded-xl border-2 p-4 cursor-pointer transition-all hover:shadow-lg"
              style={{ borderColor: i === 0 ? 'var(--color-primary)' : 'var(--color-outline-variant)', background: 'var(--color-surface)', boxShadow: i === 0 ? '0 0 0 3px rgba(0,82,217,0.12)' : 'none' }}>
              {i === 0 && <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded mb-2" style={{ background: 'var(--color-primary)', color: '#fff' }}>🎯 最佳匹配</span>}
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold truncate" style={{ color: 'var(--color-on-surface)' }}>{j.title}</h4>
                  <p className="text-[10px] mt-0.5 flex items-center gap-1" style={{ color: 'var(--color-on-surface-variant)' }}><Building className="h-3 w-3" /> {j.company}</p>
                </div>
                <div className="text-right"><p className="text-lg font-extrabold" style={{ color }}>{Math.round(j.overall)}</p><p className="text-[9px]" style={{ color: 'var(--color-on-surface-variant)' }}>分</p></div>
              </div>
              <div className="flex items-center gap-2 text-[10px] mb-1.5" style={{ color: 'var(--color-on-surface-variant)' }}>
                <span className="flex items-center gap-0.5"><MapPin className="h-3 w-3" />{j.location}</span><span>{j.salary}</span>
              </div>

              {/* 推荐原因 */}
              <div className="rounded-lg p-2 mb-2" style={{ background: 'rgba(0,229,153,0.06)' }}>
                <p className="text-[10px] font-medium flex items-center gap-1" style={{ color: 'var(--accent-green)' }}>
                  <CheckCircle className="h-3 w-3" />
                  匹配 {j.matched_count || 0}/{j.job_skill_count || 0} 项技能 ({matchRate}%)
                </p>
                {(j.matched_skills?.length) && (
                  <p className="text-[10px] mt-1 truncate" style={{ color: 'var(--color-on-surface-variant)' }}>
                    已匹配: {j.matched_skills.slice(0, 3).join('、')}{j.matched_skills.length > 3 ? '...' : ''}
                  </p>
                )}
                {j.recommend_reason && (
                  <p className="text-[10px] mt-1 truncate" style={{ color: 'var(--color-on-surface-variant)' }} title={j.recommend_reason}>
                    {j.recommend_reason}
                  </p>
                )}
              </div>

              {j.top_missing.length > 0 && (
                <div className="flex flex-wrap gap-1"><span className="text-[10px]" style={{ color: 'var(--color-on-surface-variant)' }}>需补：</span>
                  {j.top_missing.slice(0, 2).map(s => <span key={s} className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,77,106,0.08)', color: 'var(--accent-red)' }}>{s}</span>)}
                </div>
              )}
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
