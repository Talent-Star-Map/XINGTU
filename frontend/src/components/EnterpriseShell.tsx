import { useState, useEffect, lazy, Suspense, type ComponentType } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { LayoutDashboard, Briefcase, Users, TrendingUp, FileText, LogOut, Sun, Moon, User, Menu, X, MessageSquare, Star } from 'lucide-react'
import { useTheme } from './ThemeProvider'
import { EPNav, type EPPage, type EPNavParams } from '../lib/NavContext'

// 企业端导航项
type Page = EPPage

const navItems: { key: Page; icon: any; label: string }[] = [
  { key: 'dashboard', icon: LayoutDashboard, label: '工作台' },
  { key: 'jobs', icon: Briefcase, label: '岗位管理' },
  { key: 'talent', icon: Users, label: '人才星' },
  { key: 'messages', icon: MessageSquare, label: '消息' },
  { key: 'market', icon: TrendingUp, label: '市场洞察' },
  { key: 'industry', icon: FileText, label: '行业报告' },
]

// 页面按需加载，避免首屏一次性加载全部业务代码
const EPDashboard = lazy(() => import('../pages/enterprise/Dashboard'))
const EPJobs = lazy(() => import('../pages/enterprise/JobManage'))
const EPTalent = lazy(() => import('../pages/enterprise/TalentSearch'))
const EPMessages = lazy(() => import('../pages/enterprise/Conversations'))
const EPMarket = lazy(() => import('../pages/enterprise/MarketInsight'))
const EPIndustry = lazy(() => import('../pages/enterprise/IndustryReport'))
const EPCompany = lazy(() => import('../pages/enterprise/CompanyProfile'))

const pages: Record<Page, ComponentType> = {
  dashboard: EPDashboard, jobs: EPJobs, talent: EPTalent, messages: EPMessages,
  market: EPMarket, industry: EPIndustry, company: EPCompany,
}

interface Props { onLogout: () => void }

export default function EnterpriseShell({ onLogout }: Props) {
  const [page, setPageState] = useState<Page>('dashboard')
  const [navParams, setNavParams] = useState<EPNavParams>({})
  const [mobileMenu, setMobileMenu] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  // 未读消息数
  const [unreadCount, setUnreadCount] = useState(0)
  const { theme, toggle } = useTheme()

  // 带参导航
  const setPage = (p: Page, params?: EPNavParams) => {
    setPageState(p)
    setNavParams(params || {})
  }

  const PageComp = pages[page]

  // 定时轮询未读消息数
  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const r = await fetch('/api/enterprise/conversations?size=1')
        const d = await r.json()
        if (d.success && d.data) {
          setUnreadCount(d.data.unread_total || 0)
        }
      } catch { /* 忽略 */ }
    }
    fetchUnread()
    // 读到消息时立即刷新（ChatDialog 广播 xingtu:msg-read），否则红点要等下一轮轮询才消失
    window.addEventListener('xingtu:msg-read', fetchUnread)
    const interval = setInterval(fetchUnread, 15000) // 15秒轮询
    return () => { clearInterval(interval); window.removeEventListener('xingtu:msg-read', fetchUnread) }
  }, [])

  return (
    <div className="flex flex-col h-full w-full">
      {/* ── 顶部导航 ── */}
      <header className="shrink-0 border-b z-50" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface)' }}>
        <div className="flex items-center justify-between h-20 px-14 mx-auto">
          <div className="flex items-center gap-12">
            <div className="flex items-center gap-2.5 pl-1">
              <motion.div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'var(--color-primary-fixed)' }}
                animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 3, repeat: Infinity }}>
                <Star className="h-5.5 w-5.5" style={{ color: 'var(--color-primary)' }} />
              </motion.div>
              <span className="text-xl font-extrabold gradient-text">星图</span>
              <span className="text-xs px-3 py-0.5 rounded ml-1.5 font-semibold" style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-primary)' }}>企业版</span>
            </div>
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
                    {/* 消息未读徽标 */}
                    {item.key === 'messages' && unreadCount > 0 && (
                      <span className="relative z-10 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-bold"
                        style={{ background: 'var(--accent-red-strong)', color: 'white' }}>
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </button>
                )
              })}
            </nav>
          </div>

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
                      {item.key === 'messages' && unreadCount > 0 && (
                        <span className="inline-flex items-center justify-center min-w-[18px] h-4.5 px-1 rounded-full text-xs font-bold"
                          style={{ background: 'var(--accent-red-strong)', color: 'white' }}>
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      )}
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
        <EPNav.Provider value={{ setPage, page, params: navParams }}>
          <Suspense fallback={<div className="flex h-full items-center justify-center text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>页面加载中...</div>}>
            <PageComp />
          </Suspense>
        </EPNav.Provider>
      </main>
    </div>
  )
}
