import { useState } from 'react'
import { motion } from 'framer-motion'
import { LayoutDashboard, Briefcase, Users, TrendingUp, FileText, LogOut, Star, Bell, Menu, X, Sun, Moon, User } from 'lucide-react'
import { useTheme } from './ThemeProvider'
import { EPNav } from '../lib/NavContext'

type Page = 'dashboard' | 'jobs' | 'talent' | 'market' | 'industry' | 'company' | 'quality'

const navItems: { key: Page; icon: any; label: string }[] = [
  { key: 'dashboard', icon: LayoutDashboard, label: '工作台' },
  { key: 'jobs', icon: Briefcase, label: '岗位管理' },
  { key: 'talent', icon: Users, label: '人才星' },
  { key: 'market', icon: TrendingUp, label: '市场洞察' },
  { key: 'industry', icon: FileText, label: '行业报告' },
  { key: 'quality', icon: Star, label: '质检' },
]

import EPDashboard from '../pages/enterprise/Dashboard'
import EPJobs from '../pages/enterprise/JobManage'
import EPTalent from '../pages/enterprise/TalentSearch'
import EPMarket from '../pages/enterprise/MarketInsight'
import EPIndustry from '../pages/enterprise/IndustryReport'
import EPCompany from '../pages/enterprise/CompanyProfile'
import EPQuality from '../pages/enterprise/QualityDashboard'

const pages: Record<Page, () => JSX.Element> = {
  dashboard: EPDashboard, jobs: EPJobs, talent: EPTalent, market: EPMarket, industry: EPIndustry, company: EPCompany, quality: EPQuality,
}

interface Props { onLogout: () => void }

export default function EnterpriseShell({ onLogout }: Props) {
  const [page, setPage] = useState<Page>('dashboard')
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
              <motion.div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'var(--accent-purple-dim)' }}
                animate={{ rotate: [0, 5, -5, 0] }} transition={{ duration: 4, repeat: Infinity }}>
                <Star className="h-5.5 w-5.5" style={{ color: 'var(--accent-purple)' }} />
              </motion.div>
              <span className="text-xl font-extrabold gradient-text">星图</span>
              <span className="text-xs px-3 py-0.5 rounded ml-1.5 font-semibold" style={{ background: 'var(--accent-purple-dim)', color: 'var(--accent-purple)' }}>企业版</span>
            </div>
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map(item => {
                const active = page === item.key
                return (
                  <button key={item.key} onClick={() => setPage(item.key)}
                    className="relative px-4 py-2 rounded-lg transition-all flex items-center gap-2"
                    style={{ color: active ? 'var(--accent-purple)' : 'var(--color-on-surface-variant)' }}>
                    {active && <motion.div layoutId="ep-nav" className="absolute inset-0 rounded-lg" style={{ background: 'var(--accent-purple-dim)' }} transition={{ type: 'spring', stiffness: 400, damping: 30 }} />}
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
              <span className="absolute top-2 right-2 h-2.5 w-2.5 rounded-full" style={{ background: 'var(--accent-purple)' }} />
            </button>
            <div className="relative">
              <button onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-2.5 px-3.5 py-2 rounded-lg transition-all"
                style={{ background: profileOpen ? 'var(--color-surface-container)' : 'transparent' }}>
                <div className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold" style={{ background: 'var(--accent-purple-dim)', color: 'var(--accent-purple)' }}>企</div>
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
                  <button onClick={() => { setPage('company'); setProfileOpen(false) }}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors"
                    style={{ color: 'var(--color-on-surface-variant)' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-surface-container-low)'; e.currentTarget.style.color = 'var(--color-on-surface)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-on-surface-variant)' }}>
                    <User className="h-4 w-4" /> 企业信息
                  </button>
                  <div className="my-1 border-t" style={{ borderColor: 'var(--color-outline-variant)' }} />
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
                    style={{ background: active ? 'var(--accent-purple-dim)' : 'transparent', color: active ? 'var(--accent-purple)' : 'var(--color-on-surface-variant)' }}>
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
          <EPNav.Provider value={{ setPage, page }}>
            <PageComp />
          </EPNav.Provider>
        </div>
      </main>
    </div>
  )
}
