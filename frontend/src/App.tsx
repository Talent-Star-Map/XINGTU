import { useState, useCallback } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import RoleSelect from './pages/RoleSelect'
import Login from './pages/Login'
import JobseekerShell from './components/JobseekerShell'
import EnterpriseShell from './components/EnterpriseShell'
import AdminShell from './components/AdminShell'

export default function App() {
  // 角色类型扩展为三态：求职者 / 企业 / 管理员
  const [user, setUser] = useState<{ token: string; role: 'jobseeker' | 'enterprise' | 'admin' } | null>(
    () => {
      const t = localStorage.getItem('xingtu_token')
      const r = localStorage.getItem('xingtu_role') as 'jobseeker' | 'enterprise' | 'admin' | null
      return t && r ? { token: t, role: r } : null
    }
  )

  const handleLogin = useCallback((role: 'jobseeker' | 'enterprise' | 'admin') => {
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
        ) : user.role === 'admin' ? (
          <AdminShell onLogout={handleLogout} />
        ) : (
          <EnterpriseShell onLogout={handleLogout} />
        )}
      </div>
    </div>
  )
}
