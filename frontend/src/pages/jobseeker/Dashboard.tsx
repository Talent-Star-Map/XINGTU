import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Briefcase, Upload, LineChart, TrendingUp, Sparkles, ChevronRight, BookOpen, Target, Clock } from 'lucide-react'
import { JSNav } from '../../lib/NavContext'
import { useLearning } from '../../lib/LearningContext'
import StatsCounter from '../../components/ui/StatsCounter'

interface HistoryItem {
  id: number | string
  jobId: number
  jobTitle: string
  jobCompany: string
  jobLocation: string
  jobSalary: string
  overall: number
  grade: string
  haveCount: number
  missCount: number
  skills: any
  phases: any[]
  recommendations: string[]
  dims: any
  timestamp: number
}

const statsData = [
  { label: '收录岗位', value: 2817, color: 'var(--color-primary)' },
  { label: '技能标签', value: 1024, color: 'var(--accent-purple)' },
  { label: '新岗位发现', value: 12, color: 'var(--accent-green)' },
  { label: '平台用户', value: 8642, color: 'var(--accent-orange)' },
]

/** 安全地将各种日期格式转为时间戳 */
function toTimestamp(v: any): number {
  if (typeof v === 'number') return v
  if (typeof v === 'string' && v) {
    const t = new Date(v).getTime()
    if (!isNaN(t)) return t
  }
  return 0
}

/** 格式化时间戳为友好日期 */
function fmtDate(ts: number): string {
  if (!ts) return ''
  const d = new Date(ts)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60_000) return '刚刚'
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)} 小时前`
  if (diff < 604800_000) return `${Math.floor(diff / 86400_000)} 天前`
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

export default function Dashboard() {
  const { setPage } = JSNav.use()
  const { masteredSkills } = useLearning()
  const [history, setHistory] = useState<HistoryItem[]>([])

  // 从 localStorage 读诊断历史（Diagnosis.tsx 写入）
  useEffect(() => {
    try {
      const saved = localStorage.getItem('jt_diagnosis_history')
      if (saved) {
        const list = JSON.parse(saved)
        if (Array.isArray(list)) {
          // 去重（按 jobId + overall 去重）
          const seen = new Set<string>()
          const unique = list.filter((h: any) => {
            const key = `${h.jobId || h.job_id}-${h.overall}-${h.grade}`
            if (seen.has(key)) return false
            seen.add(key)
            return true
          })
          setHistory(unique.slice(0, 3).map((h: any) => ({
            id: h.id || 0,
            jobId: h.jobId || h.job_id || 0,
            jobTitle: h.jobTitle || h.job_title || h.title || '未知岗位',
            jobCompany: h.jobCompany || h.job_company || '',
            jobLocation: h.jobLocation || h.job_location || '',
            jobSalary: h.jobSalary || h.job_salary || '',
            overall: h.overall || h.score || 0,
            grade: h.grade || '-',
            haveCount: h.haveCount || h.have_count || 0,
            missCount: h.missCount || h.miss_count || 0,
            skills: h.skills || { have: [], miss: [], extra: [] },
            phases: h.phases || [],
            recommendations: h.recommendations || [],
            dims: h.dims || null,
            timestamp: toTimestamp(h.timestamp || h.created_at),
          })))
        }
      }
    } catch {}
  }, [])

  // 页面可见时重新读取 localStorage
  const reloadHistory = () => {
    try {
      const saved = localStorage.getItem('jt_diagnosis_history')
      if (saved) {
        const list = JSON.parse(saved)
        if (Array.isArray(list)) {
          const seen = new Set<string>()
          const unique = list.filter((h: any) => {
            const key = `${h.jobId || h.job_id}-${h.overall}-${h.grade}`
            if (seen.has(key)) return false
            seen.add(key)
            return true
          })
          setHistory(unique.slice(0, 3).map((h: any) => ({
            id: h.id || 0,
            jobId: h.jobId || h.job_id || 0,
            jobTitle: h.jobTitle || h.job_title || h.title || '未知岗位',
            jobCompany: h.jobCompany || h.job_company || '',
            jobLocation: h.jobLocation || h.job_location || '',
            jobSalary: h.jobSalary || h.job_salary || '',
            overall: h.overall || h.score || 0,
            grade: h.grade || '-',
            haveCount: h.haveCount || h.have_count || 0,
            missCount: h.missCount || h.miss_count || 0,
            skills: h.skills || { have: [], miss: [], extra: [] },
            phases: h.phases || [],
            recommendations: h.recommendations || [],
            dims: h.dims || null,
            timestamp: toTimestamp(h.timestamp || h.created_at),
          })))
        }
      }
    } catch {}
  }

  useEffect(() => {
    const handler = () => { if (!document.hidden) reloadHistory() }
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }, [])

  /** 点击诊断条目 → 进入学习 */
  const handleClickDiagnosis = (item: HistoryItem) => {
    // 数据不完整（旧记录），提示去重新诊断
    const skills = item.skills || { have: [], miss: [], extra: [] }
    if (!skills.have?.length && !skills.miss?.length && !item.phases?.length) {
      setPage('match')
      return
    }
    const resultData = {
      job: {
        id: item.jobId, title: item.jobTitle, company: item.jobCompany,
        salary: item.jobSalary, location: item.jobLocation, skills: [],
      },
      result: {
        overall: item.overall, grade: item.grade,
        skills,
        recommendations: item.recommendations || [],
        dims: item.dims || null,
      },
      phases: item.phases || [],
      timestamp: item.timestamp || Date.now(),
    }
    localStorage.setItem('jt_diagnosis_result', JSON.stringify(resultData))
    setPage('learning')
  }

  const quickActions = [
    { icon: Upload, label: '上传简历', desc: 'AI 自动解析，1 分钟建立能力档案', color: 'var(--color-primary)', page: 'resume' as const },
    { icon: Briefcase, label: '浏览岗位', desc: '基于能力图谱精准推荐', color: 'var(--accent-purple)', page: 'match' as const },
    { icon: LineChart, label: '人岗匹配', desc: '多维度匹配诊断与差距分析', color: 'var(--accent-green)', page: 'match' as const },
    { icon: TrendingUp, label: '趋势洞察', desc: '实时追踪技能需求变化', color: 'var(--accent-orange)', page: 'trend' as const },
  ]

  const getGradeColor = (grade: string) => {
    const colors: Record<string, string> = { S: '#10b981', A: '#22c55e', B: '#3b82f6', C: '#f59e0b', D: '#ef4444' }
    return colors[grade] || 'var(--color-primary)'
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      {/* 欢迎横幅 */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl p-6"
        style={{ background: 'linear-gradient(135deg, var(--color-primary-fixed) 0%, var(--color-surface-container-lowest) 100%)' }}>
        <div className="absolute top-0 right-0 w-48 h-48 rounded-full blur-3xl opacity-20" style={{ background: 'var(--color-primary)' }} />
        <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full blur-3xl opacity-10" style={{ background: 'var(--accent-purple)' }} />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-4 w-4" style={{ color: 'var(--color-primary)' }} />
            <span className="text-xs font-medium" style={{ color: 'var(--color-primary)' }}>个人工作台</span>
          </div>
          <h1 className="text-2xl font-extrabold" style={{ color: 'var(--color-on-surface)' }}>欢迎回来，<span className="gradient-text">探索者</span></h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>基于多源异构数据与知识图谱，精准定位你的职业方向</p>
        </div>
      </motion.div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-4 gap-4">
        {statsData.map((s, i) => (
          <motion.div key={s.label}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            whileHover={{ scale: 1.02, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
            className="rounded-2xl border p-5 shadow-sm"
            style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium" style={{ color: 'var(--color-on-surface-variant)' }}>{s.label}</span>
            </div>
            <p className="text-3xl font-bold tabular-nums" style={{ color: s.color }}><StatsCounter value={s.value} /></p>
            <div className="mt-3 h-1 rounded-full overflow-hidden" style={{ background: 'var(--color-surface-container-high)' }}>
              <motion.div className="h-full rounded-full"
                initial={{ width: 0 }} animate={{ width: '60%' }} transition={{ duration: 0.8, delay: i * 0.1 }}
                style={{ background: `linear-gradient(90deg, ${s.color}, ${s.color}aa)` }} />
            </div>
          </motion.div>
        ))}
      </div>

      {/* 快捷功能 */}
      <div>
        <h2 className="text-sm font-bold mb-3" style={{ color: 'var(--color-on-surface)' }}>快捷功能</h2>
        <div className="grid grid-cols-4 gap-4">
          {quickActions.map((action, i) => (
            <motion.button key={action.label}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.05 }}
              whileHover={{ scale: 1.02, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setPage(action.page)}
              className="rounded-2xl border p-5 text-left transition-all shadow-sm"
              style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
              <div className="h-10 w-10 rounded-xl flex items-center justify-center mb-3" style={{ background: `${action.color}15` }}>
                <action.icon className="h-5 w-5" style={{ color: action.color }} />
              </div>
              <p className="text-sm font-bold" style={{ color: 'var(--color-on-surface)' }}>{action.label}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>{action.desc}</p>
            </motion.button>
          ))}
        </div>
      </div>

      {/* 底部双栏:最近诊断 + 学习进度 */}
      <div className="grid grid-cols-5 gap-5">
        {/* 最近诊断 */}
        <div className="col-span-3 rounded-2xl border p-5 shadow-sm"
          style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold" style={{ color: 'var(--color-on-surface)' }}>最近诊断</h2>
            <button onClick={() => setPage('match')}
              className="flex items-center gap-1 text-xs font-medium transition-colors hover:opacity-80"
              style={{ color: 'var(--color-primary)' }}>
              去诊断 <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
          {history.length === 0 ? (
            <div className="text-center py-8">
              <Target className="h-12 w-12 mx-auto mb-3 opacity-30" style={{ color: 'var(--color-on-surface-variant)' }} />
              <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>暂无诊断记录</p>
              <button onClick={() => setPage('match')} className="mt-3 px-4 py-2 rounded-lg text-xs font-semibold text-white cursor-pointer" style={{ background: 'var(--color-primary)' }}>
                开始诊断
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {history.map((item) => {
                const hasDetail = (item.skills?.have?.length || item.skills?.miss?.length || item.phases?.length)
                return (
                <motion.div key={item.id}
                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + history.indexOf(item) * 0.05 }}
                  whileHover={{ scale: 1.01, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
                  onClick={() => handleClickDiagnosis(item)}
                  className="flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all"
                  style={{ background: 'var(--color-surface)', opacity: hasDetail ? 1 : 0.7 }}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0" style={{ background: getGradeColor(item.grade) }}>
                      {item.grade}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--color-on-surface)' }}>{item.jobTitle}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Clock className="h-3 w-3 shrink-0" style={{ color: 'var(--color-on-surface-variant)' }} />
                        <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                          {fmtDate(item.timestamp) || '未知时间'}
                        </p>
                        {hasDetail ? (
                          item.missCount > 0 && (
                            <>
                              <span className="text-xs" style={{ color: 'var(--color-outline-variant)' }}>·</span>
                              <span className="text-xs" style={{ color: 'var(--accent-red)' }}>
                                缺 {(() => {
                                  const missSkills = (item.skills?.miss || []).map((s: any) => s.skill || s.name || s).filter(Boolean)
                                  return missSkills.length > 0 ? missSkills.slice(0, 2).join('、') + (missSkills.length > 2 ? ` 等${missSkills.length}项` : '') : `${item.missCount} 项`
                                })()}
                              </span>
                            </>
                          )
                        ) : (
                          <span className="text-xs" style={{ color: 'var(--accent-orange)' }}>· 数据已过期</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="text-lg font-bold tabular-nums" style={{ color: getGradeColor(item.grade) }}>{item.overall}</p>
                    <p className="text-[10px]" style={{ color: 'var(--color-on-surface-variant)' }}>分</p>
                  </div>
                </motion.div>
                )
              })}
            </div>
          )}
        </div>

        {/* 学习进度 */}
        <div className="col-span-2 rounded-2xl border p-5 shadow-sm"
          style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold" style={{ color: 'var(--color-on-surface)' }}>学习进度</h2>
            <button onClick={() => setPage('learning')}
              className="flex items-center gap-1 text-xs font-medium transition-colors hover:opacity-80"
              style={{ color: 'var(--color-primary)' }}>
              进入学习 <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="text-center py-6">
            <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-30" style={{ color: 'var(--color-on-surface-variant)' }} />
            <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
              已掌握 <span className="font-bold" style={{ color: 'var(--color-primary)' }}>{masteredSkills.size}</span> 项技能
            </p>
            <div className="mt-4 h-2 rounded-full overflow-hidden" style={{ background: 'var(--color-surface-container-high)' }}>
              <motion.div className="h-full rounded-full" initial={{ width: 0 }} animate={{ width: `${Math.min(masteredSkills.size * 5, 100)}%` }}
                transition={{ duration: 1 }} style={{ background: 'var(--color-primary)' }} />
            </div>
            <p className="text-xs mt-2" style={{ color: 'var(--color-on-surface-variant)' }}>
              {masteredSkills.size < 10 ? '继续加油，多掌握几项核心技能！' : '技能储备不错，可以挑战更高匹配度！'}
            </p>
            <button onClick={() => setPage('my-skill-graph')} className="mt-4 px-4 py-2 rounded-lg text-xs font-semibold text-white cursor-pointer" style={{ background: 'var(--color-primary)' }}>
              查看能力图谱
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
