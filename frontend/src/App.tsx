import { useState, useCallback, useEffect, lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import RoleSelect from './pages/RoleSelect'
import Login from './pages/Login'

// 三个 Shell + 简历打印按需加载：登录/角色选择页不再下载图谱(Three.js)、
// 简历编辑器等重库，首屏体积大幅下降（2.3MB → 数百 KB）
const JobseekerShell = lazy(() => import('./components/JobseekerShell'))
const EnterpriseShell = lazy(() => import('./components/EnterpriseShell'))
const AdminShell = lazy(() => import('./components/AdminShell'))
const ResumePrint = lazy(() => import('./pages/ResumePrint'))
const SharedResume = lazy(() => import('./pages/SharedResume'))

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
    // 掉线后不要把上一个人的资料留在浏览器里：共享电脑上登录态已失效，
    // 但 xingtu_user 里的姓名/邮箱仍可读
    localStorage.removeItem('xingtu_user')
    setUser(null)
  }, [])

  // 任一受保护接口回 401（token 过期/失效）→ authFetch 广播事件，这里统一退回登录页
  useEffect(() => {
    window.addEventListener('xingtu:unauthorized', handleLogout)
    return () => window.removeEventListener('xingtu:unauthorized', handleLogout)
  }, [handleLogout])

  return (
    <div className="relative h-full w-full" style={{ background: 'var(--color-background)', color: 'var(--color-on-surface)' }}>
      <div className="star-field" />
      <div className="relative z-10 h-full w-full">
        <Suspense fallback={<div className="flex h-full items-center justify-center text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>加载中...</div>}>
          {/* /print/:token — 公开路由,供 Playwright 渲染 PDF/HTML
              鉴权在服务端通过 print_token(单次消费、5 分钟过期)完成,详见
              backend/services/print_token.py + backend/routers/resume_center.py */}
          <Routes>
            <Route path="/print/:token" element={<ResumePrint />} />
            {/* /share/:token — 简历中心生成的公开分享链接，免登录查看 */}
            <Route path="/share/:token" element={<SharedResume />} />
            {!user ? (
              <>
                <Route path="/" element={<RoleSelect />} />
                <Route path="/login/:role" element={<Login onLogin={handleLogin} />} />
                <Route path="*" element={<Navigate to="/" />} />
              </>
            ) : user.role === 'jobseeker' ? (
              <Route path="*" element={<JobseekerShell onLogout={handleLogout} />} />
            ) : user.role === 'admin' ? (
              <Route path="*" element={<AdminShell onLogout={handleLogout} />} />
            ) : (
              <Route path="*" element={<EnterpriseShell onLogout={handleLogout} />} />
            )}
          </Routes>
        </Suspense>
      </div>
    </div>
  )
}
