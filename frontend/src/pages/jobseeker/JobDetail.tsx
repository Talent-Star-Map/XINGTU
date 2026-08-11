import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, MapPin, Building, Clock, Target, BookOpen, Users, Banknote, AlertCircle } from 'lucide-react'

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
}

export default function JobDetail() {
  const { setPage } = JSNav.use()
  const [job, setJob] = useState<JobDetailData | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    try {
      const raw = localStorage.getItem('jt_job_detail')
      if (raw) {
        const j = JSON.parse(raw)
        setJob(j)
      }
    } catch { /* ignore */ }
  }, [])

  const handleDiagnose = () => {
    if (!job) return
    localStorage.setItem('jt_diagnosis_job', JSON.stringify(job))
    // 从 localStorage 读取用户已选技能，如果没有则用空数组
    const existing = localStorage.getItem('jt_diagnosis_skills')
    if (!existing) {
      localStorage.setItem('jt_diagnosis_skills', JSON.stringify([]))
    }
    setPage('diagnosis')
  }

  if (!job) return (
    <div className="max-w-[1400px] mx-auto px-6 py-12">
      <div className="rounded-2xl border p-8 text-center max-w-md mx-auto" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
        <AlertCircle className="h-10 w-10 mx-auto mb-3" style={{ color: 'var(--color-outline)' }} />
        <p className="text-sm font-medium mb-4" style={{ color: 'var(--color-on-surface-variant)' }}>未选择岗位</p>
        <button onClick={() => setPage('match')} className="px-4 py-2 rounded-lg text-xs font-semibold text-white" style={{ background: 'var(--color-primary)' }}>返回匹配</button>
      </div>
    </div>
  )

  if (error) return (
    <div className="max-w-[1400px] mx-auto px-6 py-12">
      <div className="rounded-2xl border p-8 text-center max-w-md mx-auto" style={{ borderColor: 'rgba(220,38,38,0.2)', background: 'rgba(220,38,38,0.04)' }}>
        <AlertCircle className="h-10 w-10 mx-auto mb-3" style={{ color: 'var(--accent-red)' }} />
        <p className="text-sm font-medium mb-1" style={{ color: 'var(--accent-red)' }}>加载失败</p>
        <p className="text-xs mb-4" style={{ color: 'var(--color-on-surface-variant)' }}>{error}</p>
        <button onClick={() => setPage('match')} className="px-4 py-2 rounded-lg text-xs font-semibold text-white" style={{ background: 'var(--color-primary)' }}>返回</button>
      </div>
    </div>
  )

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8">
      <button onClick={() => setPage('match')} className="flex items-center gap-1 text-sm font-medium mb-6" style={{ color: 'var(--color-on-surface-variant)' }}>
        <ArrowLeft className="h-4 w-4" /> 返回岗位列表
      </button>

      <div className="grid grid-cols-[1fr_320px] gap-6">
        {/* 主内容 */}
        <div className="space-y-6">
          {/* 头部 */}
          <div className="rounded-2xl border p-6" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
            <h1 className="text-xl font-bold" style={{ color: 'var(--color-on-surface)' }}>{job.title}</h1>
            <div className="flex flex-wrap items-center gap-4 mt-3 text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
              <span className="flex items-center gap-1"><Building className="h-4 w-4" /> {job.company}</span>
              <span className="flex items-center gap-1"><MapPin className="h-4 w-4" /> {job.location}</span>
              <span className="flex items-center gap-1"><Clock className="h-4 w-4" /> {job.experience || '3-5年'}</span>
              <span className="flex items-center gap-1"><BookOpen className="h-4 w-4" /> {job.education || '本科及以上'}</span>
            </div>
            <p className="text-lg font-bold mt-3" style={{ color: 'var(--color-primary)' }}>{job.salary}</p>
          </div>

          {/* 技能要求 */}
          <div className="rounded-2xl border p-6" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
            <h2 className="text-sm font-bold mb-3" style={{ color: 'var(--color-on-surface)' }}>技能要求</h2>
            <div className="flex flex-wrap gap-2">
              {job.skills.map(s => (
                <span key={s} className="rounded-full px-3 py-1.5 text-xs font-medium" style={{ background: '#D5E4FA', color: '#434654' }}>{s}</span>
              ))}
            </div>
          </div>

          {/* 职位描述 */}
          {job.description && (
            <div className="rounded-2xl border p-6" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
              <h2 className="text-sm font-bold mb-3" style={{ color: 'var(--color-on-surface)' }}>职位描述</h2>
              <div className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--color-on-surface)' }}>{job.description}</div>
            </div>
          )}

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
          <div className="rounded-2xl border p-5 sticky top-24" style={{ borderColor: 'var(--color-primary-fixed)', background: 'var(--color-primary-fixed)' }}>
            <div className="flex items-center gap-2 mb-3">
              <Target className="h-5 w-5" style={{ color: 'var(--color-primary)' }} />
              <h3 className="text-sm font-bold" style={{ color: 'var(--color-primary)' }}>岗位诊断</h3>
            </div>
            <p className="text-xs mb-4" style={{ color: 'var(--color-on-surface-variant)' }}>
              基于你的技能画像，分析你与这个岗位的能力差距，生成个性化学习路径。
            </p>
            <button
              onClick={handleDiagnose}
              className="w-full h-10 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2"
              style={{ background: 'var(--color-primary)' }}
            >
              <Target className="h-4 w-4" /> 开始诊断
            </button>
          </div>

          {/* 岗位概要 */}
          <div className="rounded-2xl border p-5" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
            <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--color-on-surface)' }}>岗位概要</h3>
            <div className="space-y-3 text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
              <div className="flex items-center gap-2"><Banknote className="h-3.5 w-3.5" /> {job.salary}</div>
              <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5" /> {job.location}</div>
              <div className="flex items-center gap-2"><Clock className="h-3.5 w-3.5" /> {job.experience || '3-5年'}</div>
              <div className="flex items-center gap-2"><BookOpen className="h-3.5 w-3.5" /> {job.education || '本科及以上'}</div>
              <div className="flex items-center gap-2"><Users className="h-3.5 w-3.5" /> {job.company}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
