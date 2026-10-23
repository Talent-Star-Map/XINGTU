import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react'
import { latestResume, resolveUserSkills, type UserSkillCategory } from './userSkills'

const getToken = () => localStorage.getItem('xingtu_token') || ''
const DIAGNOSIS_HISTORY_KEY = 'jt_diagnosis_history'

function readLocalDiagnoses(): any[] {
  try {
    const list = JSON.parse(localStorage.getItem(DIAGNOSIS_HISTORY_KEY) || '[]')
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function diagnosisPayload(item: any) {
  const jobId = Number(item?.jobId ?? item?.job_id)
  if (!Number.isInteger(jobId) || jobId <= 0) return null
  const skills = item?.skills && typeof item.skills === 'object' ? item.skills : { have: [], miss: [], extra: [] }
  return {
    job_id: jobId,
    job_title: String(item.jobTitle || item.job_title || ''),
    job_company: String(item.jobCompany || item.job_company || ''),
    job_location: String(item.jobLocation || item.job_location || ''),
    job_salary: String(item.jobSalary || item.job_salary || ''),
    overall: Number(item.overall) || 0,
    grade: String(item.grade || ''),
    have_count: Number(item.haveCount ?? item.have_count ?? skills.have?.length ?? 0) || 0,
    miss_count: Number(item.missCount ?? item.miss_count ?? skills.miss?.length ?? 0) || 0,
    skills,
    phases: Array.isArray(item.phases) ? item.phases : [],
    recommendations: Array.isArray(item.recommendations) ? item.recommendations : [],
  }
}

// 放在组件外，避免开发模式重复挂载时两条请求同时补传同一条本地诊断。
let historyChain: Promise<void> = Promise.resolve()

/** 把还没进服务端的本地诊断补传上去。能力图谱只读 diagnosis_history。 */
async function uploadLocalDiagnoses(token: string) {
  const list = readLocalDiagnoses()
  let changed = false
  for (const item of list) {
    if (item?.synced) continue
    const payload = diagnosisPayload(item)
    if (!payload) {
      item.synced = true
      changed = true
      continue
    }
    try {
      const response = await fetch(`/api/learning/history?token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const result = await response.json()
      if (response.ok && result.success) {
        item.synced = true
        changed = true
      }
    } catch { /* 下次进入页面再补传 */ }
  }
  if (changed) localStorage.setItem(DIAGNOSIS_HISTORY_KEY, JSON.stringify(list))
}

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
  skillCategories: UserSkillCategory[]
  skillsLoading: boolean
  skillsError: string
  profileName: string
  refreshSkills: () => Promise<void>
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
  skillCategories: [], skillsLoading: true, skillsError: '', profileName: '', refreshSkills: async () => {},
  toggleMastered: async () => {},
  diagnosisHistory: [],
  addDiagnosis: async () => {},
  refreshHistory: async () => {},
  learningProgress: [],
  updateProgress: async () => {},
  refreshProgress: async () => {},
})

export const useLearning = () => useContext(Ctx)

export function LearningProvider({ children, refreshKey }: { children: ReactNode; refreshKey?: string }) {
  const [masteredSkills, setMasteredSkills] = useState<Set<string>>(new Set())
  const [skillCategories, setSkillCategories] = useState<UserSkillCategory[]>([])
  const [skillsLoading, setSkillsLoading] = useState(true)
  const [skillsError, setSkillsError] = useState('')
  const [profileName, setProfileName] = useState('')
  const skillsRequest = useRef(0)
  const [diagnosisHistory, setDiagnosisHistory] = useState<DiagnosisRecord[]>([])
  const [learningProgress, setLearningProgress] = useState<LearningProgress[]>([])

  // ─── 技能掌握 ───────────────────────────
  const fetchSkills = useCallback(async () => {
    const t = getToken()
    const request = ++skillsRequest.current
    if (!t) {
      setMasteredSkills(new Set()); setSkillCategories([]); setProfileName(''); setSkillsLoading(false)
      return
    }
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 15000)
    setSkillsLoading(true)
    setSkillsError('')
    try {
      const read = async (path: string) => {
        const response = await fetch(path, { headers: { Authorization: `Bearer ${t}` }, signal: controller.signal })
        const result = await response.json()
        if (!response.ok || !result.success) throw new Error('技能读取失败')
        return result.data
      }
      const [marks, profile, resumes] = await Promise.all([
        read(`/api/learning/skills?token=${t}`), read(`/api/auth/profile?token=${t}`),
        read(`/api/resume-center/list?brief=1&token=${t}`),
      ])
      const latest = latestResume(resumes as { id: number; updated_at?: string; created_at?: string }[])
      const resume = latest ? await read(`/api/resume-center/${latest.id}?token=${t}`) : null
      if (request !== skillsRequest.current || t !== getToken()) return
      const groups = resolveUserSkills(profile.skills, resume?.sections || [], marks)
      setSkillCategories(groups)
      setMasteredSkills(new Set(groups.flatMap(c => c.skills)))
      setProfileName(profile.real_name?.trim() || profile.username || '我的技能')
    } catch {
      if (request === skillsRequest.current) setSkillsError('技能数据加载失败，请稍后重试')
    } finally {
      window.clearTimeout(timeout)
      if (request === skillsRequest.current) setSkillsLoading(false)
    }
  }, [])

  const toggleMastered = useCallback(async (skill: string, jobId?: number) => {
    const t = getToken()
    if (!t) return
    const willMaster = !Array.from(masteredSkills).some(s => s.toLocaleLowerCase() === skill.trim().toLocaleLowerCase())
    try {
      const response = await fetch(`/api/learning/skills?token=${t}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skill_name: skill, job_id: null, mastered: willMaster }),
      })
      const result = await response.json()
      if (!response.ok || !result.success) throw new Error('技能保存失败')
      await fetchSkills()
    } catch { setSkillsError('技能状态保存失败，请重试') }
  }, [masteredSkills, fetchSkills])

  // ─── 诊断历史 ───────────────────────────
  const refreshHistory = useCallback(async () => {
    const run = historyChain.then(async () => {
      const t = getToken()
      if (!t) {
        setDiagnosisHistory([])
        return
      }
      await uploadLocalDiagnoses(t)
      const r = await fetch(`/api/learning/history?token=${t}&limit=20`)
      const d = await r.json()
      if (r.ok && d.success && Array.isArray(d.data)) setDiagnosisHistory(d.data)
    }).catch(() => { /* 保留上一次成功读到的记录 */ })
    historyChain = run
    await run
  }, [])

  const addDiagnosis = useCallback(async (record: Omit<DiagnosisRecord, 'id' | 'created_at'>) => {
    const t = getToken()
    if (!t) return
    const response = await fetch(`/api/learning/history?token=${t}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
    })
    const result = await response.json()
    if (!response.ok || !result.success) throw new Error('诊断记录保存失败')
    await refreshHistory()
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

  // 切页时重新拉取。诊断当时只写在本地，进入能力图谱前先补传到服务端。
  useEffect(() => {
    void refreshHistory()
  }, [refreshHistory, refreshKey])

  useEffect(() => { void fetchSkills() }, [fetchSkills, refreshKey])
  useEffect(() => {
    const refresh = () => { if (!document.hidden) void fetchSkills() }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [fetchSkills])

  return (
    <Ctx.Provider value={{
      masteredSkills, toggleMastered,
      skillCategories, skillsLoading, skillsError, profileName, refreshSkills: fetchSkills,
      diagnosisHistory, addDiagnosis, refreshHistory,
      learningProgress, updateProgress, refreshProgress,
    }}>
      {children}
    </Ctx.Provider>
  )
}
