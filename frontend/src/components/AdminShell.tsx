import { useState, useEffect, useCallback, lazy, Suspense, type ComponentType } from 'react'
import { motion } from 'framer-motion'
import { Star, LogOut, Sun, Moon, Menu, X, ChevronRight } from 'lucide-react'
import { useTheme } from './ThemeProvider'
import { adminPages, adminGroups, groupForPage, readAdminPage, type AdminPage as Page, type AdminGroup } from '../lib/adminNavigation'

// 页面按需加载，避免首屏一次性加载全部管理端代码
const AdminDashboard = lazy(() => import('../pages/admin/AdminDashboard'))
const QualityDashboard = lazy(() => import('../pages/enterprise/QualityDashboard'))
const AdminUserManage = lazy(() => import('../pages/admin/AdminUserManage'))
const AdminJobManage = lazy(() => import('../pages/admin/AdminJobManage'))
const AdminResourceManage = lazy(() => import('../pages/admin/AdminResourceManage'))
const AdminModelConfig = lazy(() => import('../pages/admin/AdminModelConfig'))
const AdminClassificationReview = lazy(() => import('../pages/admin/AdminClassificationReview'))
const AdminRoleDefinitions = lazy(() => import('../pages/admin/AdminRoleDefinitions'))
const AdminDataBoard = lazy(() => import('../pages/admin/AdminDataBoard'))

// 用包装组件给 AdminUserManage 传 role prop（懒组件放在 Suspense 内）
const JobseekerManagePage = () => <Suspense fallback={null}><AdminUserManage role="jobseeker" /></Suspense>
const EnterpriseManagePage = () => <Suspense fallback={null}><AdminUserManage role="enterprise" /></Suspense>
// 工作台接 onNav 回调,卡片点击跳到对应管理页(不引入 NavContext,跟 AdminUserManage 的 role prop 模式一致)
const AdminDashboardPage = ({ onNav }: { onNav: (p: Page) => void }) => (
  <Suspense fallback={null}><AdminDashboard onNav={onNav} /></Suspense>
)
const AdminDataBoardPage = ({ onNav }: { onNav?: (p: Page) => void }) => (
  <Suspense fallback={null}><AdminDataBoard onNav={onNav} /></Suspense>
)

const pages: Record<Page, ComponentType<{ onNav?: (p: Page) => void }>> = {
  dashboard: AdminDashboardPage as ComponentType<{ onNav?: (p: Page) => void }>,
  databoard: AdminDataBoardPage as ComponentType<{ onNav?: (p: Page) => void }>,
  jobseekers: JobseekerManagePage,
  enterprises: EnterpriseManagePage,
  jobs: AdminJobManage,
  resources: AdminResourceManage,
  models: AdminModelConfig,
  quality: QualityDashboard,
  'role-definitions': AdminRoleDefinitions,
  'classification-review': AdminClassificationReview,
}

interface Props { onLogout: () => void }

export default function AdminShell({ onLogout }: Props) {
  // 默认进入"工作台",管理员登录后第一眼看到平台总览
  const [page, setPage] = useState<Page>(() => readAdminPage(window.location.hash))
  const [lastPages, setLastPages] = useState<Partial<Record<AdminGroup, Page>>>({})
  const [mobileMenu, setMobileMenu] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const { theme, toggle } = useTheme()
  const navigate = useCallback((next: Page) => {
    setPage(next); setMobileMenu(false); setProfileOpen(false)
    setLastPages(current => ({ ...current, [groupForPage(next).key]: next }))
    const hash = `#/admin/${next}`
    if (window.location.hash !== hash) window.location.hash = hash
  }, [])
  useEffect(() => {
    const handle = () => {
      const next = readAdminPage(window.location.hash)
      setPage(next); setMobileMenu(false)
      setLastPages(current => ({ ...current, [groupForPage(next).key]: next }))
    }
    window.addEventListener('hashchange', handle)
    return () => window.removeEventListener('hashchange', handle)
  }, [])
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') { setMobileMenu(false); setProfileOpen(false) } }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [])
  const group = groupForPage(page)
  const current = adminPages[page]
  const PageComp = pages[page]

  return (
    <div className="flex flex-col h-full w-full">
      <header className="shrink-0 border-b z-50" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface)' }}>
        <div className="flex items-center justify-between px-4 md:px-6 h-16 max-w-[1440px] mx-auto">
          <div className="flex min-w-0 items-center gap-5">
            <div className="flex items-center gap-2.5 pl-1">
              <motion.div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'var(--accent-green-dim)' }}
                animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 4, repeat: Infinity }}>
                <Star className="h-5.5 w-5.5" style={{ color: 'var(--accent-green)' }} />
              </motion.div>
              <span className="text-xl font-extrabold gradient-text">星图</span>
              <span className="text-xs px-3 py-0.5 rounded ml-1.5 font-semibold" style={{ background: 'var(--accent-green-dim)', color: 'var(--accent-green)' }}>管理员</span>
            </div>
            <nav aria-label="管理员主导航" className="hidden lg:flex items-center gap-1">
              {adminGroups.map(item => {
                const active = group.key === item.key
                return <button key={item.key} aria-current={active ? 'true' : undefined}
                  onClick={() => navigate(lastPages[item.key] || (active ? page : item.pages[0]))}
                  className="relative flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors hover:bg-black/5"
                  style={{ color: active ? 'var(--accent-green)' : 'var(--color-on-surface-variant)' }}>
                  {active && <motion.div layoutId="admin-nav" className="absolute inset-0 rounded-lg" style={{ background: 'var(--accent-green-dim)' }} />}
                  <item.icon className="relative z-10 h-4 w-4" /><span className="relative z-10 whitespace-nowrap">{item.label}</span>
                </button>
              })}
            </nav>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button onClick={toggle} aria-label="切换主题" className="p-2.5 rounded-lg" style={{ color: 'var(--color-on-surface-variant)' }}>
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            <div className="relative">
              <button onClick={() => setProfileOpen(!profileOpen)} aria-expanded={profileOpen} aria-label="管理员账号菜单"
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
            <button className="lg:hidden p-2" aria-label="展开管理导航" aria-expanded={mobileMenu} aria-controls="admin-mobile-navigation" onClick={() => setMobileMenu(!mobileMenu)} style={{ color: 'var(--color-on-surface-variant)' }}>
              {mobileMenu ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {mobileMenu && <nav id="admin-mobile-navigation" aria-label="管理员移动导航" className="max-h-[65vh] overflow-y-auto border-t p-4 lg:hidden" style={{ borderColor: 'var(--color-outline-variant)' }}>
          <div className="mx-auto grid max-w-[1440px] gap-4 sm:grid-cols-2">
            {adminGroups.map(item => <section key={item.key}>
              <p className="mb-2 flex items-center gap-2 text-[11px] font-semibold" style={{ color: 'var(--color-on-surface-variant)' }}><item.icon className="h-3.5 w-3.5" />{item.label}</p>
              <div className="flex flex-wrap gap-1">{item.pages.map(key => { const entry = adminPages[key]; return <button key={key} aria-current={page === key ? 'page' : undefined} onClick={() => navigate(key)} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs" style={{ background: page === key ? 'var(--accent-green-dim)' : 'var(--color-surface-container)', color: page === key ? 'var(--accent-green)' : 'var(--color-on-surface)' }}><entry.icon className="h-3.5 w-3.5" />{entry.label}</button> })}</div>
            </section>)}
          </div>
        </nav>}
        <div className="border-t" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface)' }}>
          <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-2 px-4 py-3 md:px-6">
            <div className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}><span>管理中心</span><ChevronRight className="h-3 w-3" /><span>{group.label}</span><ChevronRight className="h-3 w-3" /><span className="font-semibold" style={{ color: 'var(--color-on-surface)' }}>{current.label}</span></div>
            <nav aria-label={`${group.label}功能导航`} className="flex flex-wrap gap-1">
              {group.pages.map(key => { const entry = adminPages[key]; return <button key={key} onClick={() => navigate(key)} aria-current={page === key ? 'page' : undefined} title={entry.description} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors hover:bg-black/5" style={{ background: page === key ? 'var(--accent-green-dim)' : undefined, color: page === key ? 'var(--accent-green)' : 'var(--color-on-surface-variant)' }}><entry.icon className="h-3.5 w-3.5" />{entry.label}</button> })}
            </nav>
          </div>
          <p className="mx-auto max-w-[1440px] px-4 pb-3 text-[11px] leading-5 md:px-6" style={{ color: 'var(--color-on-surface-variant)' }}>{current.description}</p>
        </div>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="max-w-[1440px] mx-auto">
          <Suspense fallback={<div className="flex h-full items-center justify-center text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>页面加载中...</div>}>
            <PageComp onNav={navigate} />
          </Suspense>
        </div>
      </main>
    </div>
  )
}
