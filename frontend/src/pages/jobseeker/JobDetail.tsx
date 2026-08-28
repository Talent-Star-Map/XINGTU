import { useState, useEffect } from 'react'
import { ArrowLeft, MapPin, Building, Clock, Target, BookOpen, AlertCircle, Loader2, Database } from 'lucide-react'
import { JSNav } from '../../lib/NavContext'

interface JobDetailData {
  id: number
  title: string
  company: string
  salary: string
  location: string
  experience?: string
  education?: string
  skills: string[]
  description?: string
  requirements?: string[]
  responsibilities?: string[]
  benefits?: string[]
  collected_at?: string
  source?: string
}

const NOT_PROVIDED = '未标注'

export default function JobDetail() {
  const { setPage } = JSNav.use()
  const [job, setJob] = useState<JobDetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [skills, setSkills] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false

    try {
      const raw = localStorage.getItem('jt_job_detail')
      if (raw) setJob(JSON.parse(raw))
      const skillsRaw = localStorage.getItem('jt_diagnosis_skills')
      setSkills(skillsRaw ? JSON.parse(skillsRaw) : [])
    } catch { /* ignore */ }

    // 用列表里的摘要作为首屏，再用详情接口补全描述/要求等重字段
    const load = async () => {
      try {
        const raw = localStorage.getItem('jt_job_detail')
        const id = raw ? JSON.parse(raw)?.id : null
        if (!id) { if (!cancelled) setLoading(false); return }
        const r = await fetch(`/api/jobs/${id}`)
        const d = await r.json()
        if (cancelled) return
        if (d.success && d.data) setJob(prev => prev ? { ...prev, ...d.data } : d.data)
      } catch { /* 详情页降级使用列表摘要 */ }
      finally { if (!cancelled) setLoading(false) }
    }
    load()

    return () => { cancelled = true }
  }, [])

  const handleDiagnose = () => {
    if (!job || skills.length === 0) return
    localStorage.removeItem('jt_diagnosis_result') // 清除旧诊断结果，确保重新分析
    localStorage.setItem('jt_diagnosis_job', JSON.stringify(job))
    localStorage.setItem('jt_diagnosis_skills', JSON.stringify(skills))
    setPage('diagnosis')
  }

  if (!job) return (
    <div className="max-w-[1400px] mx-auto px-6 py-12">
      <div className="rounded-2xl border p-8 text-center max-w-md mx-auto" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
        <AlertCircle className="h-10 w-10 mx-auto mb-3" style={{ color: 'var(--color-outline)' }} />
        <p className="text-sm font-medium mb-4" style={{ color: 'var(--color-on-surface-variant)' }}>未选择岗位</p>
        <button onClick={() => setPage('match')} className="px-4 py-2 rounded-lg text-xs font-semibold text-white" style={{ background: 'var(--color-primary)' }}>返回岗位列表</button>
      </div>
    </div>
  )

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8">
      <button onClick={() => setPage('match')} className="flex items-center gap-1 text-sm font-medium mb-6" style={{ color: 'var(--color-on-surface-variant)' }}>
        <ArrowLeft className="h-4 w-4" /> 返回岗位列表
      </button>

      {loading && (
        <div className="flex items-center gap-2 text-sm mb-4" style={{ color: 'var(--color-on-surface-variant)' }}>
          <Loader2 className="h-4 w-4 animate-spin" /> 正在加载岗位详情...
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* 主内容 */}
        <div className="space-y-6">
          {/* 头部 */}
          <div className="rounded-2xl border p-6" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
            <h1 className="text-xl font-bold" style={{ color: 'var(--color-on-surface)' }}>{job.title}</h1>
            <div className="flex flex-wrap items-center gap-4 mt-3 text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
              <span className="flex items-center gap-1"><Building className="h-4 w-4" /> {job.company || NOT_PROVIDED}</span>
              <span className="flex items-center gap-1"><MapPin className="h-4 w-4" /> {job.location || NOT_PROVIDED}</span>
              {/* 数据缺失时显示「未标注」，不编造「3-5年」「本科及以上」这类看起来像真的值 */}
              <span className="flex items-center gap-1"><Clock className="h-4 w-4" /> {job.experience || NOT_PROVIDED}</span>
              <span className="flex items-center gap-1"><BookOpen className="h-4 w-4" /> {job.education || NOT_PROVIDED}</span>
            </div>
            <p className="text-lg font-bold mt-3" style={{ color: 'var(--color-primary)' }}>{job.salary}</p>
          </div>

          {/* 技能要求 */}
          <div className="rounded-2xl border p-6" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
            <h2 className="text-sm font-bold mb-3" style={{ color: 'var(--color-on-surface)' }}>技能要求</h2>
            {job.skills?.length ? (
              <div className="flex flex-wrap gap-2">
                {job.skills.map(s => (
                  <span key={s} className="rounded-full px-3 py-1.5 text-xs font-medium" style={{ background: '#D5E4FA', color: '#434654' }}>{s}</span>
                ))}
              </div>
            ) : (
              <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>该岗位未标注技能要求</p>
            )}
          </div>

          {/* 职位描述 */}
          <div className="rounded-2xl border p-6" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
            <h2 className="text-sm font-bold mb-3" style={{ color: 'var(--color-on-surface)' }}>职位描述</h2>
            <div className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--color-on-surface)' }}>
              {job.description || NOT_PROVIDED}
            </div>
          </div>

          {/* 岗位要求 */}
          {job.requirements && job.requirements.length > 0 && (
            <div className="rounded-2xl border p-6" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
              <h2 className="text-sm font-bold mb-3" style={{ color: 'var(--color-on-surface)' }}>岗位要求</h2>
              <ul className="space-y-2">
                {job.requirements.map((r, i) => (
                  <li key={i} className="text-sm flex items-start gap-2" style={{ color: 'var(--color-on-surface)' }}>
                    <span className="shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full" style={{ background: 'var(--color-primary)' }} />{r}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* 侧边栏 */}
        <div className="space-y-4">
          {/* 匹配诊断卡片 */}
          <div className="rounded-2xl border p-5 lg:sticky lg:top-24" style={{ borderColor: 'var(--color-primary-fixed)', background: 'var(--color-primary-fixed)' }}>
            <div className="flex items-center gap-2 mb-3">
              <Target className="h-5 w-5" style={{ color: 'var(--color-primary)' }} />
              <h3 className="text-sm font-bold" style={{ color: 'var(--color-primary)' }}>岗位诊断</h3>
            </div>
            <p className="text-xs mb-4" style={{ color: 'var(--color-on-surface-variant)' }}>
              基于你的技能画像，分析你与这个岗位的能力差距，生成个性化学习路径。
            </p>

            {skills.length === 0 ? (
              <div className="space-y-3">
                <p className="text-xs" style={{ color: 'var(--accent-orange)' }}>
                  还没选择技能，直接诊断会得到接近 0 分的结果。
                </p>
                <button onClick={() => setPage('match')}
                  className="w-full h-10 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2"
                  style={{ background: 'var(--color-primary)' }}>
                  去选择技能
                </button>
              </div>
            ) : (
              <>
                <p className="text-xs mb-3" style={{ color: 'var(--color-on-surface-variant)' }}>
                  当前技能 {skills.length} 项：{skills.slice(0, 4).join('、')}{skills.length > 4 ? '…' : ''}
                </p>
                <button onClick={handleDiagnose}
                  className="w-full h-10 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2"
                  style={{ background: 'var(--color-primary)' }}>
                  <Target className="h-4 w-4" /> 开始诊断
                </button>
              </>
            )}
          </div>

          {/* 数据来源 — 取代原来与头部重复的「岗位概要」 */}
          <div className="rounded-2xl border p-5" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
            <h3 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--color-on-surface)' }}>
              <Database className="h-3.5 w-3.5" /> 数据来源
            </h3>
            <div className="space-y-2 text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
              <p>采集渠道：{job.source || NOT_PROVIDED}</p>
              <p>采集时间：{job.collected_at || NOT_PROVIDED}</p>
              <p>岗位 ID：{job.id}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
