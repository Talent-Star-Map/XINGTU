import { useState } from 'react'
import { motion } from 'framer-motion'
import { Shield, Star, LogOut, Sun, Moon, Menu, X } from 'lucide-react'
import { useTheme } from './ThemeProvider'
import QualityDashboard from '../pages/enterprise/QualityDashboard'

// 管理员端目前只有"质检"一个功能模块（质检已从求职端/企业端移除，统一归管理员监管）
type Page = 'quality'

const navItems: { key: Page; icon: any; label: string }[] = [
  { key: 'quality', icon: Shield, label: '质检' },
]

const pages: Record<Page, () => JSX.Element> = {
  quality: QualityDashboard,
}

interface Props { onLogout: () => void }

export default function AdminShell({ onLogout }: Props) {
  const [page, setPage] = useState<Page>('quality')
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
