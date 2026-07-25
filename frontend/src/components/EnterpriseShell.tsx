import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { LayoutDashboard, Briefcase, Users, TrendingUp, FileText, LogOut, Sun, Moon, User, Menu, X } from 'lucide-react'
import { useTheme } from './ThemeProvider'
import { EPNav } from '../lib/NavContext'

// 企业端导航项 — 图标仅用于扫描，无装饰色
type Page = 'dashboard' | 'jobs' | 'talent' | 'market' | 'industry' | 'company'

const navItems: { key: Page; icon: any; label: string }[] = [
  { key: 'dashboard', icon: LayoutDashboard, label: '工作台' },
  { key: 'jobs', icon: Briefcase, label: '岗位管理' },
  { key: 'talent', icon: Users, label: '人才星' },
  { key: 'market', icon: TrendingUp, label: '市场洞察' },
  { key: 'industry', icon: FileText, label: '行业报告' },
  // 质检已移至管理员端，企业端不再展示
]

import EPDashboard from '../pages/enterprise/Dashboard'
import EPJobs from '../pages/enterprise/JobManage'
import EPTalent from '../pages/enterprise/TalentSearch'
import EPMarket from '../pages/enterprise/MarketInsight'
import EPIndustry from '../pages/enterprise/IndustryReport'
import EPCompany from '../pages/enterprise/CompanyProfile'

const pages: Record<Page, () => JSX.Element> = {
  dashboard: EPDashboard, jobs: EPJobs, talent: EPTalent, market: EPMarket, industry: EPIndustry, company: EPCompany,
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
      {/* ── 顶部导航 — 极简，单一 accent 色 ── */}
      <header className="shrink-0 border-b z-50" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface)' }}>
        <div className="flex items-center justify-between h-20 px-14 mx-auto">
          <div className="flex items-center gap-12">
            {/* 品牌区 — 文字为主，无渐变无旋转 */}
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold tracking-tight" style={{ color: 'var(--color-on-surface)' }}>星图</span>
              <span className="text-sm px-2.5 py-1 rounded font-medium" style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-primary)' }}>企业版</span>
            </div>
            {/* 桌面导航 — active 用 layoutId 平滑切换，无装饰图标背景 */}
            <nav className="hidden md:flex items-center gap-1.5">
              {navItems.map(item => {
                const active = page === item.key
                return (
                  <button key={item.key} onClick={() => setPage(item.key)}
                    className="relative px-5 py-2.5 rounded-md transition-colors flex items-center gap-2.5"
                    style={{ color: active ? 'var(--color-on-surface)' : 'var(--color-on-surface-variant)' }}
                  >
                    {active && (
                      <motion.div
                        layoutId="ep-nav"
                        className="absolute inset-0 rounded-md"
                        style={{ background: 'var(--color-surface-container-high)' }}
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      />
                    )}
                    <item.icon className="h-5 w-5 relative z-10" />
                    <span className="relative z-10 text-base font-medium">{item.label}</span>
                  </button>
                )
              })}
            </nav>
          </div>

          {/* 右侧操作区 — 仅主题切换 + 头像，去掉了通知 Bell（无实际功能） */}
          <div className="flex items-center gap-2">
            <button onClick={toggle} className="p-3 rounded-md transition-colors hover:bg-[var(--color-surface-container-high)]" style={{ color: 'var(--color-on-surface-variant)' }}>
              {theme === 'dark' ? <Sun className="h-6 w-6" /> : <Moon className="h-6 w-6" />}
            </button>
            <div className="relative">
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-2 px-2 py-1 rounded-md transition-colors"
                style={{ background: profileOpen ? 'var(--color-surface-container-high)' : 'transparent' }}
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-base font-semibold"
                  style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-primary)' }}>
                  企
                </div>
              </button>
              <AnimatePresence>
                {profileOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-1.5 w-56 rounded-lg border py-2 z-50"
                    style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}
                    onMouseLeave={() => setProfileOpen(false)}
                  >
                    <button
                      onClick={() => { setPage('company'); setProfileOpen(false) }}
                      className="flex w-full items-center gap-3 px-5 py-3 text-base transition-colors hover:bg-[var(--color-surface-container-high)]"
                      style={{ color: 'var(--color-on-surface)' }}
                    >
                      <User className="h-5 w-5" /> 企业信息
                    </button>
                    <div className="my-1 border-t" style={{ borderColor: 'var(--color-outline-variant)' }} />
                    <button
                      onClick={onLogout}
                      className="flex w-full items-center gap-3 px-5 py-3 text-base transition-colors hover:bg-[var(--color-surface-container-high)]"
                      style={{ color: 'var(--color-on-surface)' }}
                    >
                      <LogOut className="h-5 w-5" /> 退出登录
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <button className="md:hidden p-2" onClick={() => setMobileMenu(!mobileMenu)} style={{ color: 'var(--color-on-surface-variant)' }}>
              {mobileMenu ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* 移动端导航 */}
        <AnimatePresence>
          {mobileMenu && (
            <motion.div
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="md:hidden border-t overflow-hidden" style={{ borderColor: 'var(--color-outline-variant)' }}
            >
              <div className="px-8 py-4 flex flex-wrap gap-2">
                {navItems.map(item => {
                  const active = page === item.key
                  return (
                    <button key={item.key} onClick={() => { setPage(item.key); setMobileMenu(false) }}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-md text-base font-medium"
                      style={{
                        background: active ? 'var(--color-surface-container-high)' : 'transparent',
                        color: active ? 'var(--color-on-surface)' : 'var(--color-on-surface-variant)'
                      }}
                    >
                      <item.icon className="h-5 w-5" /> {item.label}
                    </button>
                  )
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ── 主内容区 ── */}
      <main className="flex-1 overflow-y-auto">
        <EPNav.Provider value={{ setPage, page }}>
          <PageComp />
        </EPNav.Provider>
      </main>
    </div>
  )
}
