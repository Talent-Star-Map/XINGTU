import { useState, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Shield, Star, LogOut, Sun, Moon, Menu, X, Users, Building2, Briefcase, BookOpen, Cpu } from 'lucide-react'
import { useTheme } from './ThemeProvider'
import QualityDashboard from '../pages/enterprise/QualityDashboard'
import AdminUserManage from '../pages/admin/AdminUserManage'
import AdminJobManage from '../pages/admin/AdminJobManage'
import AdminResourceManage from '../pages/admin/AdminResourceManage'
import AdminModelConfig from '../pages/admin/AdminModelConfig'

// 管理员端功能模块：
//   quality    — 质检（已有，质检已从求职端/企业端移除，统一归管理员监管）
//   jobseekers — 求职者管理（列表/创建/删除/重置密码）
//   enterprises— 企业管理（列表/创建/删除/重置密码）
//   jobs       — 职位管理（列表/删除）
//   resources  — 学习资源管理
//   models     — 模型配置（LLM 路由层配置：大/小/多模态模型 + Mock 开关）
type Page = 'quality' | 'jobseekers' | 'enterprises' | 'jobs' | 'resources' | 'models'

const navItems: { key: Page; icon: any; label: string }[] = [
  { key: 'jobseekers', icon: Users, label: '求职者' },
  { key: 'enterprises', icon: Building2, label: '企业' },
  { key: 'jobs', icon: Briefcase, label: '职位' },
  { key: 'resources', icon: BookOpen, label: '学习资源' },
  { key: 'models', icon: Cpu, label: '模型配置' },
  { key: 'quality', icon: Shield, label: '质检' },
]

// 用包装组件给 AdminUserManage 传 role prop（pages 表要求无参组件）
const JobseekerManagePage = () => <AdminUserManage role="jobseeker" />
const EnterpriseManagePage = () => <AdminUserManage role="enterprise" />

const pages: Record<Page, () => ReactNode> = {
  jobseekers: JobseekerManagePage,
  enterprises: EnterpriseManagePage,
  jobs: AdminJobManage,
  resources: AdminResourceManage,
  models: AdminModelConfig,
  quality: QualityDashboard,
}

interface Props { onLogout: () => void }

export default function AdminShell({ onLogout }: Props) {
  // 默认进入"求职者管理"，让管理员第一时间看到后台主功能
  const [page, setPage] = useState<Page>('jobseekers')
  const [mobileMenu, setMobileMenu] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const { theme, toggle } = useTheme()
  const PageComp = pages[page]

  return (
    <div className="flex flex-col h-full w-full">
      <header className="shrink-0 border-b z-50" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface)' }}>
        <div className="flex items-center justify-between pl-5 pr-6 h-16 max-w-[1440px] mx-auto">
          <div className="flex items-center gap-10">
            <div className="flex items-center gap-2.5 pl-1">
              <motion.div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'var(--accent-green-dim)' }}
                animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 4, repeat: Infinity }}>
                <Star className="h-5.5 w-5.5" style={{ color: 'var(--accent-green)' }} />
              </motion.div>
              <span className="text-xl font-extrabold gradient-text">星图</span>
              <span className="text-xs px-3 py-0.5 rounded ml-1.5 font-semibold" style={{ background: 'var(--accent-green-dim)', color: 'var(--accent-green)' }}>管理员</span>
            </div>
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map(item => {
                const active = page === item.key
                return (
                  <button key={item.key} onClick={() => setPage(item.key)}
                    className="relative px-4 py-2 rounded-lg transition-all flex items-center gap-2"
                    style={{ color: active ? 'var(--accent-green)' : 'var(--color-on-surface-variant)' }}>
                    {active && <motion.div layoutId="admin-nav" className="absolute inset-0 rounded-lg" style={{ background: 'var(--accent-green-dim)' }} transition={{ type: 'spring', stiffness: 400, damping: 30 }} />}
                    <item.icon className="h-5 w-5 relative z-10" />
                    <span className="relative z-10 text-sm font-semibold">{item.label}</span>
                  </button>
                )
              })}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={toggle} className="p-2.5 rounded-lg" style={{ color: 'var(--color-on-surface-variant)' }}>
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            <div className="relative">
              <button onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-2.5 px-3.5 py-2 rounded-lg transition-all"
                style={{ background: profileOpen ? 'var(--color-surface-container)' : 'transparent' }}>
                <div className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold" style={{ background: 'var(--accent-green-dim)', color: 'var(--accent-green)' }}>管</div>
                <span className="text-sm font-semibold hidden md:block" style={{ color: 'var(--color-on-surface)' }}>管理员</span>
              </button>
              {profileOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute right-0 top-full mt-2 w-48 rounded-xl border py-1.5 shadow-lg z-50"
                  style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}
                  onMouseLeave={() => setProfileOpen(false)}
                >
                  <button onClick={onLogout}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors"
                    style={{ color: 'var(--color-on-surface-variant)' }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent-red)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-on-surface-variant)' }}>
                    <LogOut className="h-4 w-4" /> 退出登录
                  </button>
                </motion.div>
              )}
            </div>
            <button className="md:hidden p-2" onClick={() => setMobileMenu(!mobileMenu)} style={{ color: 'var(--color-on-surface-variant)' }}>
              {mobileMenu ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {mobileMenu && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="md:hidden border-t px-4 py-3" style={{ borderColor: 'var(--color-outline-variant)' }}>
            <div className="flex flex-wrap gap-2">
              {navItems.map(item => {
                const active = page === item.key
                return (
                  <button key={item.key} onClick={() => { setPage(item.key); setMobileMenu(false) }}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
                    style={{ background: active ? 'var(--accent-green-dim)' : 'transparent', color: active ? 'var(--accent-green)' : 'var(--color-on-surface-variant)' }}>
                    <item.icon className="h-4 w-4" /> {item.label}
                  </button>
                )
              })}
            </div>
          </motion.div>
        )}
      </header>
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-[1440px] mx-auto">
          <PageComp />
        </div>
      </main>
    </div>
  )
}
