import { useState, useCallback } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import RoleSelect from './pages/RoleSelect'
import Login from './pages/Login'
import JobseekerShell from './components/JobseekerShell'
import EnterpriseShell from './components/EnterpriseShell'

import JSDashboard from './pages/jobseeker/Dashboard'
import JSJobs from './pages/jobseeker/Jobs'
import JSSkillGraph from './pages/jobseeker/SkillGraph'
import JSResume from './pages/jobseeker/Resume'
import JSMatch from './pages/jobseeker/Match'
import JSLearning from './pages/jobseeker/LearningPath'
import JSTrend from './pages/jobseeker/Trend'

import EPDashboard from './pages/enterprise/Dashboard'
import EPJobs from './pages/enterprise/JobManage'
import EPTalent from './pages/enterprise/TalentSearch'
import EPMarket from './pages/enterprise/MarketInsight'
import EPIndustry from './pages/enterprise/IndustryReport'

export default function App() {
  const [user, setUser] = useState<{ token: string; role: 'jobseeker' | 'enterprise' } | null>(
    () => {
      const t = localStorage.getItem('xingtu_token')
      const r = localStorage.getItem('xingtu_role') as 'jobseeker' | 'enterprise' | null
      return t && r ? { token: t, role: r } : null
    }
  )

  const handleLogin = useCallback((role: 'jobseeker' | 'enterprise') => {
    const token = localStorage.getItem('xingtu_token') || ''
    setUser({ token, role })
  }, [])

  const handleLogout = useCallback(() => {
    localStorage.removeItem('xingtu_token')
    localStorage.removeItem('xingtu_role')
    setUser(null)
  }, [])

  return (
    <div className="relative h-full w-full" style={{ background: 'var(--color-background)', color: 'var(--color-on-surface)' }}>
      <div className="star-field" />
      <div className="relative z-10 h-full w-full">
        {!user ? (
          <Routes>
            <Route path="/" element={<RoleSelect />} />
            <Route path="/login/:role" element={<Login onLogin={handleLogin} />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        ) : user.role === 'jobseeker' ? (
          <JobseekerShell onLogout={handleLogout} />
        ) : (
          <EnterpriseShell onLogout={handleLogout} />
        )}
      </div>
    </div>
  )
}
