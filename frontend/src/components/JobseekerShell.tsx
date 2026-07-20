import { useState } from 'react'
import { motion } from 'framer-motion'
import { LayoutDashboard, Briefcase, Share2, Upload, LineChart, BookOpen, TrendingUp, LogOut, Star, Bell, Menu, X, Sun, Moon, User, Activity } from 'lucide-react'
import { useTheme } from './ThemeProvider'
import { JSNav } from '../lib/NavContext'

type Page = 'dashboard' | 'jobs' | 'skill-graph' | 'resume' | 'match' | 'learning-path' | 'trend' | 'profile-home' | 'my-skill-graph'

const navItems: { key: Page; icon: any; label: string }[] = [
  { key: 'dashboard', icon: LayoutDashboard, label: '工作台' },
  { key: 'jobs', icon: Briefcase, label: '岗位' },
  { key: 'skill-graph', icon: Share2, label: '岗位图谱' },
  { key: 'match', icon: LineChart, label: '匹配' },
  { key: 'learning-path', icon: BookOpen, label: '学习' },
  { key: 'trend', icon: TrendingUp, label: '趋势' },
  // 质检已移至管理员端，求职端不再展示
]

import JSDashboard from '../pages/jobseeker/Dashboard'
import JSJobs from '../pages/jobseeker/Jobs'
import JSSkillGraph from '../pages/jobseeker/SkillGraph'
import JSResume from '../pages/jobseeker/Resume'
import JSMatch from '../pages/jobseeker/Match'
import JSLearning from '../pages/jobseeker/LearningPath'
import JSTrend from '../pages/jobseeker/Trend'
import JSProfileHome from '../pages/jobseeker/ProfileHome'
import JSMySkillGraph from '../pages/jobseeker/MySkillGraphPage'

const pages: Record<Page, () => JSX.Element> = {
  dashboard: JSDashboard, jobs: JSJobs, 'skill-graph': JSSkillGraph,
  resume: JSResume, match: JSMatch, 'learning-path': JSLearning, trend: JSTrend,
  'profile-home': JSProfileHome, 'my-skill-graph': JSMySkillGraph,
}

interface Props { onLogout: () => void }

const profileItems: { key: Page; icon: any; label: string }[] = [
  { key: 'profile-home', icon: User, label: '个人主页' },
  { key: 'resume', icon: Upload, label: '简历管理' },
  { key: 'my-skill-graph', icon: Activity, label: '我的能力图谱' },
]

export default function JobseekerShell({ onLogout }: Props) {
  const [page, setPage] = useState<Page>('skill-graph')
  const [mobileMenu, setMobileMenu] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const { theme, toggle } = useTheme()
  const PageComp = pages[page]
  const userStr = localStorage.getItem('xingtu_user')
  const userData = userStr ? JSON.parse(userStr) : null
  const avatarText = (() => {
    const account = userData?.email || userData?.phone || ''
    const digits = account.replace(/\D/g, '')
    return digits ? digits.slice(-3) : account.slice(-3) || '?'
  })()

  return (
    <div className="flex flex-col h-full w-full">
      <header className="shrink-0 border-b z-50" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface)' }}>
        <div className="flex items-center justify-between pl-5 pr-6 h-16 max-w-[1440px] mx-auto">
          <div className="flex items-center gap-10">
            <div className="flex items-center gap-2.5 pl-1">
              <motion.div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'var(--color-primary-fixed)' }}
                animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 3, repeat: Infinity }}>
                <Star className="h-5.5 w-5.5" style={{ color: 'var(--color-primary)' }} />
              </motion.div>
              <span className="text-xl font-extrabold gradient-text">星图</span>
              <span className="text-xs px-3 py-0.5 rounded ml-1.5 font-semibold" style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-primary)' }}>求职者</span>
            </div>
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map(item => {
                const active = page === item.key
                return (
                  <button key={item.key} onClick={() => setPage(item.key)}
                    className="relative px-4 py-2 rounded-lg transition-all flex items-center gap-2"
                    style={{ color: active ? 'var(--color-primary)' : 'var(--color-on-surface-variant)' }}>
                    {active && <motion.div layoutId="js-nav" className="absolute inset-0 rounded-lg" style={{ background: 'var(--color-primary-fixed)' }} transition={{ type: 'spring', stiffness: 400, damping: 30 }} />}
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
            <button className="relative p-2.5 rounded-lg" style={{ color: 'var(--color-on-surface-variant)' }}>
              <Bell className="h-5 w-5" />
              <span className="absolute top-2 right-2 h-2.5 w-2.5 rounded-full" style={{ background: 'var(--color-primary)' }} />
            </button>
            <div className="relative">
              <button onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-2.5 px-3.5 py-2 rounded-lg transition-all"
                style={{ background: profileOpen ? 'var(--color-surface-container)' : 'transparent' }}>
                <div className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold" style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-primary)' }}>{avatarText}</div>
                <span className="text-sm font-semibold hidden md:block" style={{ color: 'var(--color-on-surface)' }}>我的</span>
              </button>
              {profileOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute right-0 top-full mt-2 w-48 rounded-xl border py-1.5 shadow-lg z-50"
                  style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}
                  onMouseLeave={() => setProfileOpen(false)}
                >
                  {profileItems.map(item => (
                    <button key={item.key} onClick={() => { setPage(item.key); setProfileOpen(false) }}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors"
                      style={{ color: 'var(--color-on-surface-variant)' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-surface-container-low)'; e.currentTarget.style.color = 'var(--color-on-surface)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-on-surface-variant)' }}
                    >
                      <item.icon className="h-4 w-4" /> {item.label}
                    </button>
                  ))}
                  <div className="my-1 border-t" style={{ borderColor: 'var(--color-outline-variant)' }} />
                  <button onClick={onLogout}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors"
                    style={{ color: 'var(--color-on-surface-variant)' }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent-red)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-on-surface-variant)' }}
                  >
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
      </header>
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-[1440px] mx-auto">
          <JSNav.Provider value={{ setPage, page }}>
            <PageComp />
          </JSNav.Provider>
        </div>
      </main>
    </div>
  )
}
