import { useEffect } from 'react'
import { Target, BookOpen, AlertCircle, ArrowRight } from 'lucide-react'
import { JSNav } from '../../lib/NavContext'
import { useLearning } from '../../lib/LearningContext'
import PersonalExperienceGraph from '../../components/kg/PersonalExperienceGraph'
import { SkillCardGrid } from '../../components/kg/SkillCard'
import ProfileSidebar from '../../components/ProfileSidebar'

const GRADE_COLOR: Record<string, string> = {
  S: 'var(--accent-green)',
  A: 'var(--accent-green)',
  B: 'var(--color-primary)',
  C: 'var(--accent-orange)',
  D: 'var(--accent-red)',
}

const PRIORITY_LABEL: Record<string, { text: string; color: string }> = {
  high: { text: '高', color: 'var(--accent-red)' },
  medium: { text: '中', color: 'var(--accent-orange)' },
  low: { text: '低', color: 'var(--color-on-surface-variant)' },
}

function formatDate(iso: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function MySkillGraph() {
  const { setPage } = JSNav.use()
  const { masteredSkills, diagnosisHistory, skillsLoading: loading, skillsError, refreshSkills, refreshHistory } = useLearning()
  useEffect(() => { void refreshHistory() }, [refreshHistory])
  const allSkills = Array.from(masteredSkills).sort()
  const skillCount = loading || skillsError ? '—' : allSkills.length
  const latest = diagnosisHistory[0]
  const missing = latest?.skills?.miss ?? []
  const missingSorted = [...missing].sort((a: any, b: any) => {
    const order = { high: 0, medium: 1, low: 2 }
    return (order[a?.priority as keyof typeof order] ?? 3) - (order[b?.priority as keyof typeof order] ?? 3)
  })

  // 统一的 section 样式(对齐 ProfileHome)
  const sectionStyle = {
    borderColor: 'var(--color-outline-variant)',
    background: 'var(--color-surface-container-lowest)',
  } as const

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex gap-8">
        <ProfileSidebar />

        <div className="flex-1 min-w-0 space-y-6">
          {/* ── 3D 能力星系 ── */}
          <PersonalExperienceGraph onOpenResume={() => setPage('resume-center')} />
          {/* ── 已掌握技能 ── */}
          <section className="rounded-2xl border p-8" style={sectionStyle}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-black" style={{ color: 'var(--color-on-surface)' }}>
                已掌握技能 · {skillCount}
              </h3>
              <button onClick={() => setPage('profile-home')} className="text-xs font-medium flex items-center gap-1"
                style={{ color: 'var(--color-primary)' }}>
                去个人主页补全 <ArrowRight className="h-3 w-3" />
              </button>
            </div>
            {loading ? (
              <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>加载中...</p>
            ) : skillsError ? (
              <p role="status" className="text-sm">{skillsError}<button onClick={() => void refreshSkills()} className="ml-3 underline">重试</button></p>
            ) : allSkills.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
                还没有技能记录。去「岗位」页先做一次诊断,或到个人主页补全技能。
              </p>
            ) : (
              <SkillCardGrid skills={allSkills} />
            )}
          </section>

          {/* ── 最近诊断 ── */}
          <section className="rounded-2xl border p-8" style={sectionStyle}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-black" style={{ color: 'var(--color-on-surface)' }}>
                最近诊断 · {diagnosisHistory.length}
              </h3>
              <button onClick={() => setPage('match')} className="text-xs font-medium flex items-center gap-1"
                style={{ color: 'var(--color-primary)' }}>去诊断 <ArrowRight className="h-3 w-3" /></button>
            </div>
            {diagnosisHistory.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>还没有诊断记录。</p>
            ) : (
              <ul className="space-y-3">
                {diagnosisHistory.slice(0, 5).map(r => (
                  <li key={r.id} className="flex items-center gap-3 p-4 rounded-xl border"
                    style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface)' }}>
                    <span className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                      style={{ background: 'var(--color-primary-fixed)', color: GRADE_COLOR[r.grade] || 'var(--color-primary)' }}>{r.grade}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-on-surface)' }}>
                        {r.job_title}{r.job_company ? ` · ${r.job_company}` : ''}
                      </p>
                      <p className="text-xs mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>
                        匹配 {r.overall} 分 · 已有 {r.have_count} / 待补 {r.miss_count} · {formatDate(r.created_at)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ── 待补齐技能 ── */}
          <section className="rounded-2xl border p-8" style={sectionStyle}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-black" style={{ color: 'var(--color-on-surface)' }}>
                待补齐技能{missingSorted.length > 0 ? ` · ${missingSorted.length}` : ''}
              </h3>
              {missingSorted.length > 0 && (
                <button onClick={() => setPage('learning')} className="text-xs font-medium flex items-center gap-1"
                  style={{ color: 'var(--color-primary)' }}><BookOpen className="h-3 w-3" /> 去学习</button>
              )}
            </div>
            {missingSorted.length === 0 ? (
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" style={{ color: 'var(--color-outline)' }} />
                <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
                  {latest ? '最近一次诊断没有发现技能缺口。' : '还没有诊断数据,先去「岗位」页做一次诊断。'}
                </p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {missingSorted.map((m: any, i: number) => {
                  const p = PRIORITY_LABEL[m?.priority] || PRIORITY_LABEL.low
                  return (
                    <span key={`${m?.skill || i}`} className="rounded-full px-3 py-1.5 text-xs font-medium flex items-center gap-1.5"
                      style={{ background: 'var(--color-surface-container)', color: 'var(--color-on-surface)' }}>
                      {m?.skill}
                      <em className="not-italic text-[10px] font-bold px-1 rounded" style={{ color: p.color }}>{p.text}</em>
                    </span>
                  )
                })}
              </div>
            )}
          </section>

          {/* ── 快捷入口 ── */}
          <div className="flex gap-3">
            <button onClick={() => setPage('match')}
              className="flex-1 h-11 rounded-xl text-sm font-semibold border flex items-center justify-center gap-2"
              style={{ borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface-variant)' }}>
              <Target className="h-4 w-4" /> 匹配其他岗位
            </button>
            <button onClick={() => setPage('learning')}
              className="flex-1 h-11 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2"
              style={{ background: 'var(--color-primary)' }}>
              <BookOpen className="h-4 w-4" /> 进入学习中心
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
