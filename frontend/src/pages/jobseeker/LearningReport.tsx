import { useState, useEffect } from 'react'
import { BookOpen, Target, CheckCircle, Clock, ChevronRight, ArrowLeft, Trash2 } from 'lucide-react'
import { JSNav } from '../../lib/NavContext'

interface Report {
  id: number
  jobTitle: string
  jobCompany: string
  jobLocation: string
  jobSalary: string
  overall: number
  grade: string
  haveCount: number
  missCount: number
  phases: any[]
  recommendations: string[]
}

export default function LearningReport() {
  const { setPage } = JSNav.use()
  const [history, setHistory] = useState<Report[]>([])
  const [activeId, setActiveId] = useState<number | null>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem('jt_diagnosis_history')
      if (raw) setHistory(JSON.parse(raw))
    } catch { /* ignore */ }
  }, [])

  const activeReport = history.find(r => r.id === activeId)

  const deleteReport = (id: number) => {
    const next = history.filter(r => r.id !== id)
    setHistory(next)
    localStorage.setItem('jt_diagnosis_history', JSON.stringify(next))
    if (activeId === id) setActiveId(null)
  }

  const clearAll = () => {
    setHistory([])
    setActiveId(null)
    localStorage.removeItem('jt_diagnosis_history')
  }

  // 详情视图
  if (activeReport) {
    const phases = activeReport.phases || []
    const totalWeeks = phases.reduce((s: number, p: any) => s + (parseInt(p.duration) || 0), 0)
    return (
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        <button onClick={() => setActiveId(null)} className="flex items-center gap-1 text-sm font-medium" style={{ color: 'var(--color-on-surface-variant)' }}>
          <ArrowLeft className="h-4 w-4" /> 返回记录列表
        </button>

        {/* header */}
        <div className="rounded-2xl border p-6" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl" style={{ background: 'var(--color-primary-fixed)' }}>
              <Target className="h-6 w-6" style={{ color: 'var(--color-primary)' }} />
            </div>
            <div className="flex-1">
              <h2 className="text-base font-bold" style={{ color: 'var(--color-on-surface)' }}>{activeReport.jobTitle}</h2>
              <p className="text-xs mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>{activeReport.jobCompany} · {activeReport.jobLocation} · {activeReport.jobSalary}</p>
              <div className="flex items-center gap-4 mt-3">
                <span className="text-xs flex items-center gap-1" style={{ color: 'var(--accent-green)' }}>
                  <CheckCircle className="h-3.5 w-3.5" /> 已掌握 {activeReport.haveCount} 项
                </span>
                <span className="text-xs flex items-center gap-1" style={{ color: 'var(--accent-red)' }}>
                  <Target className="h-3.5 w-3.5" /> 待提升 {activeReport.missCount} 项
                </span>
                <span className="text-xs flex items-center gap-1" style={{ color: 'var(--color-primary)' }}>
                  <Clock className="h-3.5 w-3.5" /> 预计 {totalWeeks}-{totalWeeks + 2} 周
                </span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-extrabold" style={{ color: activeReport.overall >= 70 ? 'var(--accent-green)' : activeReport.overall >= 60 ? 'var(--color-primary)' : 'var(--accent-red)' }}>{activeReport.overall}</p>
              <p className="text-[10px]" style={{ color: 'var(--color-on-surface-variant)' }}>匹配度</p>
            </div>
          </div>
        </div>

        {/* phases */}
        {phases.length > 0 && (
          <div className="rounded-2xl border p-6" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
            <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--color-on-surface)' }}>学习路径规划</h3>
            <div className="relative">
              <div className="absolute left-5 top-2 bottom-2 w-0.5" style={{ background: 'var(--color-outline-variant)' }} />
              {phases.map((p: any, idx: number) => {
                const colors = ['#00C8FF', '#7C3AED', '#00E599']
                const color = colors[idx % colors.length]
                return (
                  <div key={p.phase} className="relative pl-12 pb-5 last:pb-0">
                    <div className="absolute left-3 top-2 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ background: color }}>{p.phase}</div>
                    <div className="rounded-xl border p-4" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface)' }}>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-semibold" style={{ color: 'var(--color-on-surface)' }}>第 {p.phase} 阶段：{p.title}</h4>
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: `${color}15`, color }}>{p.duration}</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {p.skills.map((s: string) => (
                          <span key={s} className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium" style={{ background: `${color}15`, color }}>
                            {s} {p.etaPerSkill && <span className="opacity-60">· {p.etaPerSkill}w</span>}
                          </span>
                        ))}
                      </div>
                      <div className="space-y-1">
                        {p.goals.map((g: string) => (
                          <p key={g} className="text-[10px] flex items-start gap-1.5" style={{ color: 'var(--color-on-surface-variant)' }}>
                            <CheckCircle className="h-3 w-3 mt-0.5 shrink-0" style={{ color }} /> {g}
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* recommendations */}
        {activeReport.recommendations?.length > 0 && (
          <div className="rounded-2xl border p-6" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
            <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--color-on-surface)' }}>改进建议</h3>
            <div className="space-y-2">
              {activeReport.recommendations.map((rec: string, i: number) => (
                <p key={i} className="text-xs flex items-start gap-2" style={{ color: 'var(--color-on-surface-variant)' }}>
                  <span className="shrink-0 mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold" style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-primary)' }}>{i + 1}</span>
                  {rec}
                </p>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  // 列表视图
  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold" style={{ color: 'var(--color-on-surface)' }}>诊断记录</h1>
        <div className="flex items-center gap-3">
          {history.length > 0 && (
            <button onClick={clearAll} className="text-xs font-medium flex items-center gap-1" style={{ color: 'var(--accent-red)' }}>
              <Trash2 className="h-3.5 w-3.5" /> 清空记录
            </button>
          )}
          <button onClick={() => setPage('match')} className="text-xs font-medium px-3 py-1.5 rounded-lg border" style={{ borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface-variant)' }}>
            返回岗位
          </button>
        </div>
      </div>

      {history.length === 0 ? (
        <div className="rounded-2xl border p-8 text-center" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
          <BookOpen className="h-12 w-12 mx-auto mb-4" style={{ color: 'var(--color-outline)' }} />
          <h2 className="text-lg font-bold mb-2" style={{ color: 'var(--color-on-surface)' }}>暂无诊断记录</h2>
          <p className="text-sm mb-4" style={{ color: 'var(--color-on-surface-variant)' }}>完成岗位诊断后，报告将自动保存在这里</p>
          <button onClick={() => setPage('match')} className="px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: 'var(--color-primary)' }}>
            前往岗位
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {history.map(r => (
            <div
              key={r.id}
              className="rounded-xl border p-4 flex items-center gap-4 cursor-pointer transition-all hover:shadow-md group"
              style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}
              onClick={() => setActiveId(r.id)}
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl shrink-0" style={{ background: 'var(--color-primary-fixed)' }}>
                <Target className="h-5 w-5" style={{ color: 'var(--color-primary)' }} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold truncate" style={{ color: 'var(--color-on-surface)' }}>{r.jobTitle}</h3>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>{r.jobCompany} · {r.jobLocation} · {r.jobSalary}</p>
                <div className="flex items-center gap-3 mt-1.5 text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>
                  <span style={{ color: 'var(--accent-green)' }}>已掌握 {r.haveCount}</span>
                  <span style={{ color: 'var(--accent-red)' }}>待提升 {r.missCount}</span>
                  <span>{new Date(r.id).toLocaleDateString()}</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xl font-extrabold" style={{ color: r.overall >= 70 ? 'var(--accent-green)' : r.overall >= 60 ? 'var(--color-primary)' : 'var(--accent-red)' }}>{r.overall}</p>
                <p className="text-[10px]" style={{ color: 'var(--color-on-surface-variant)' }}>匹配度</p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); deleteReport(r.id) }}
                className="p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ color: 'var(--accent-red)' }}
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <ChevronRight className="h-4 w-4 shrink-0" style={{ color: 'var(--color-outline)' }} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
