import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'

const getToken = () => localStorage.getItem('xingtu_token') || ''

interface DiagnosisRecord {
  id: number; job_id: number; job_title: string; job_company: string
  job_location: string; job_salary: string; overall: number; grade: string
  have_count: number; miss_count: number; skills: any; phases: any[]; recommendations: string[]
  created_at: string
}

interface LearningProgress {
  id: number; job_id: number; skill_name: string; status: string
  started_at: string | null; mastered_at: string | null; study_minutes: number
}

interface LearningCtx {
  masteredSkills: Set<string>
  toggleMastered: (skill: string, jobId?: number) => Promise<void>
  diagnosisHistory: DiagnosisRecord[]
  addDiagnosis: (record: Omit<DiagnosisRecord, 'id' | 'created_at'>) => Promise<void>
  refreshHistory: () => Promise<void>
  learningProgress: LearningProgress[]
  updateProgress: (skill: string, jobId: number, status: string, mins?: number) => Promise<void>
  refreshProgress: (jobId?: number) => Promise<void>
}

const Ctx = createContext<LearningCtx>({
  masteredSkills: new Set(),
  toggleMastered: async () => {},
  diagnosisHistory: [],
  addDiagnosis: async () => {},
  refreshHistory: async () => {},
  learningProgress: [],
  updateProgress: async () => {},
  refreshProgress: async () => {},
})

export const useLearning = () => useContext(Ctx)

export function LearningProvider({ children }: { children: ReactNode }) {
  const [masteredSkills, setMasteredSkills] = useState<Set<string>>(new Set())
  const [diagnosisHistory, setDiagnosisHistory] = useState<DiagnosisRecord[]>([])
  const [learningProgress, setLearningProgress] = useState<LearningProgress[]>([])

  // ─── 技能掌握 ───────────────────────────
  const fetchSkills = useCallback(async () => {
    const t = getToken()
    if (!t) return
    try {
      const r = await fetch(`/api/learning/skills?token=${t}`)
      const d = await r.json()
      if (d.success) {
        const mastered = new Set<string>()
        d.data.filter((s: any) => s.mastered).forEach((s: any) => mastered.add(s.skill_name))
        setMasteredSkills(mastered)
      }
    } catch { /* ignore */ }
  }, [])

  const toggleMastered = useCallback(async (skill: string, jobId?: number) => {
    const t = getToken()
    if (!t) return
    const willMaster = !masteredSkills.has(skill)
    // 乐观更新
    setMasteredSkills(prev => {
      const next = new Set(prev)
      willMaster ? next.add(skill) : next.delete(skill)
      return next
    })
    try {
      await fetch(`/api/learning/skills?token=${t}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skill_name: skill, job_id: jobId || null, mastered: willMaster }),
      })
    } catch { /* ignore */ }
  }, [masteredSkills])

  // ─── 诊断历史 ───────────────────────────
  const refreshHistory = useCallback(async () => {
    const t = getToken()
    if (!t) return
    try {
      const r = await fetch(`/api/learning/history?token=${t}&limit=20`)
      const d = await r.json()
      if (d.success) setDiagnosisHistory(d.data)
    } catch { /* ignore */ }
  }, [])

  const addDiagnosis = useCallback(async (record) => {
    const t = getToken()
    if (!t) return
    try {
      await fetch(`/api/learning/history?token=${t}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record),
      })
      await refreshHistory()
    } catch { /* ignore */ }
  }, [refreshHistory])

  // ─── 学习进度 ───────────────────────────
  const refreshProgress = useCallback(async (jobId?: number) => {
    const t = getToken()
    if (!t) return
    try {
      const q = jobId ? `?token=${t}&job_id=${jobId}` : `?token=${t}`
      const r = await fetch(`/api/learning/progress${q}`)
      const d = await r.json()
      if (d.success) setLearningProgress(d.data)
    } catch { /* ignore */ }
  }, [])

  const updateProgress = useCallback(async (skill: string, jobId: number, status: string, mins = 0) => {
    const t = getToken()
    if (!t) return
    try {
      await fetch(`/api/learning/progress?token=${t}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skill_name: skill, job_id: jobId, status, study_minutes: mins }),
      })
      await refreshProgress(jobId)
    } catch { /* ignore */ }
  }, [refreshProgress])

  // 初始化加载
  useEffect(() => {
    fetchSkills()
    refreshHistory()
  }, [fetchSkills, refreshHistory])

  return (
    <Ctx.Provider value={{
      masteredSkills, toggleMastered,
      diagnosisHistory, addDiagnosis, refreshHistory,
      learningProgress, updateProgress, refreshProgress,
    }}>
      {children}
    </Ctx.Provider>
  )
}
