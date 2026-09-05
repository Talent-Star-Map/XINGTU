import { useState, useEffect, useCallback, lazy, Suspense, type ComponentType } from 'react'
import { motion } from 'framer-motion'
import { LayoutDashboard, Share2, Upload, LineChart, BookOpen, TrendingUp, LogOut, Star, Menu, X, Sun, Moon, User, FileText, Activity, MessageSquare } from 'lucide-react'
import { useTheme } from './ThemeProvider'
import { JSNav, type JSPage } from '../lib/NavContext'
import { LearningProvider } from '../lib/LearningContext'

const PAGE_KEYS: JSPage[] = [
  'dashboard', 'skill-graph', 'resume', 'resume-center', 'match', 'job-detail',
  'diagnosis', 'learning', 'trend', 'profile-home', 'my-skill-graph', 'quality', 'messages',
]

const isPage = (v: string): v is JSPage => (PAGE_KEYS as string[]).includes(v)

const readHash = (): JSPage => {
  const h = window.location.hash.replace(/^#\/?/, '')
  return isPage(h) ? h : 'dashboard'
}

const navItems: { key: JSPage; icon: any; label: string }[] = [
  { key: 'dashboard', icon: LayoutDashboard, label: '工作台' },
  { key: 'skill-graph', icon: Share2, label: '岗位图谱' },
  { key: 'match', icon: LineChart, label: '岗位' },
  { key: 'messages', icon: MessageSquare, label: '消息' },
  { key: 'learning', icon: BookOpen, label: '学习' },
  { key: 'trend', icon: TrendingUp, label: '趋势' },
  { key: 'resume-center', icon: FileText, label: '简历中心' },
  // 质检已移至管理员端，求职端不再展示
]

// 页面按需加载：进入哪个页面才下载哪个页面的代码，
// 避免首屏一次性加载图谱(Three.js)/简历编辑器等重库
const JSDashboard = lazy(() => import('../pages/jobseeker/Dashboard'))
const JSJobGraphPage = lazy(() => import('../pages/jobseeker/JobGraphPage'))
const JSResume = lazy(() => import('../pages/jobseeker/Resume'))
const JSResumeCenter = lazy(() => import('../pages/jobseeker/ResumeCenter'))
const JSMatch = lazy(() => import('../pages/jobseeker/JobMatch'))
const JSDiagnosis = lazy(() => import('../pages/jobseeker/Diagnosis'))
const JSJobDetail = lazy(() => import('../pages/jobseeker/JobDetail'))
const JSLearning = lazy(() => import('../pages/jobseeker/LearningPath'))
const JSTrend = lazy(() => import('../pages/jobseeker/Trend'))
const JSProfileHome = lazy(() => import('../pages/jobseeker/ProfileHome'))
const JSMySkillGraph = lazy(() => import('../pages/jobseeker/MySkillGraph'))
const JSMessages = lazy(() => import('../pages/jobseeker/Messages'))
const QualityDashboard = lazy(() => import('../pages/enterprise/QualityDashboard'))
const TutuChat = lazy(() => import('./TutuChat'))

const pages: Record<JSPage, ComponentType> = {
  dashboard: JSDashboard,
  'skill-graph': JSJobGraphPage,
  resume: JSResume,
  'resume-center': JSResumeCenter,
  match: JSMatch,
  'job-detail': JSJobDetail,
  diagnosis: JSDiagnosis,
  learning: JSLearning,
  trend: JSTrend,
  'profile-home': JSProfileHome,
  'my-skill-graph': JSMySkillGraph,
  quality: QualityDashboard,
  messages: JSMessages,
}

interface Props { onLogout: () => void }

const profileItems: { key: JSPage; icon: any; label: string }[] = [
  { key: 'profile-home', icon: User, label: '个人主页' },
  { key: 'resume', icon: Upload, label: '简历管理' },
  { key: 'my-skill-graph', icon: Activity, label: '我的能力图谱' },
]

const menuItemStyle = { color: 'var(--color-on-surface-variant)' }

export default function JobseekerShell({ onLogout }: Props) {
  // 页面状态与 URL hash 同步：刷新不回到首页，浏览器前进/后退可用
  const [page, setPageState] = useState<JSPage>(readHash)
  const [mobileMenu, setMobileMenu] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const { theme, toggle } = useTheme()

  // 消息未读徽标 — 切页刷新 + 20 秒轮询 + 读到消息时立即刷新
  // （只靠切页刷新不够：关掉聊天弹窗并没有切页，红点会一直挂着）
  const [msgUnread, setMsgUnread] = useState(0)
  useEffect(() => {
    let cancelled = false
    let u: any = null
    try { u = JSON.parse(localStorage.getItem('xingtu_user') || 'null') } catch { /* ignore */ }
    if (!u?.id) return

    const refresh = () => {
      fetch(`/api/jobseeker/unread-total?jobseeker_id=${u.id}`)
        .then(r => r.json())
        .then(d => { if (!cancelled && d.success) setMsgUnread(d.data.unread_total || 0) })
        .catch(() => {})
    }
    refresh()
    window.addEventListener('xingtu:msg-read', refresh)
    const timer = setInterval(refresh, 20000)
    return () => { cancelled = true; clearInterval(timer); window.removeEventListener('xingtu:msg-read', refresh) }
  }, [])

  const setPage = useCallback((p: JSPage) => {
    setPageState(p)
    setMobileMenu(false)
    if (readHash() !== p) window.location.hash = `#/${p}`
  }, [])

  useEffect(() => {
    const onHashChange = () => setPageState(readHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  // 兜底：未知 key 不再白屏，退回工作台
  const PageComp = pages[page] || JSDashboard
  const userStr = localStorage.getItem('xingtu_user')
  const userData = userStr ? JSON.parse(userStr) : null
  const avatarText = (() => {
    const account = userData?.email || userData?.phone || ''
    const name = userData?.username || userData?.real_name || ''
    return (name[0] || account[0] || '?').toUpperCase()
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
            <button onClick={toggle} className="p-2.5 rounded-lg" style={{ color: 'var(--color-on-surface-variant)' }} aria-label="切换主题">
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
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
                      style={menuItemStyle}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-surface-container-low)'; e.currentTarget.style.color = 'var(--color-on-surface)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-on-surface-variant)' }}
                    >
                      <item.icon className="h-4 w-4" /> {item.label}
                    </button>
                  ))}
                  <div className="my-1 border-t" style={{ borderColor: 'var(--color-outline-variant)' }} />
                  <button onClick={onLogout}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors"
                    style={menuItemStyle}
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent-red)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-on-surface-variant)' }}
                  >
                    <LogOut className="h-4 w-4" /> 退出登录
                  </button>
                </motion.div>
              )}
            </div>
            <button className="md:hidden p-2" onClick={() => setMobileMenu(!mobileMenu)}
              style={{ color: 'var(--color-on-surface-variant)' }} aria-label="菜单" aria-expanded={mobileMenu}>
              {mobileMenu ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* 移动端导航 — 之前 mobileMenu 开关存在却没有对应的面板 */}
        {mobileMenu && (
          <nav className="md:hidden border-t px-4 py-2 flex flex-col"
            style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface)' }}>
            {navItems.map(item => {
              const active = page === item.key
              return (
                <button key={item.key} onClick={() => setPage(item.key)}
                  className="flex items-center gap-3 px-2 py-2.5 text-sm font-medium rounded-lg"
                  style={{ color: active ? 'var(--color-primary)' : 'var(--color-on-surface-variant)', background: active ? 'var(--color-primary-fixed)' : 'transparent' }}>
                  <item.icon className="h-4 w-4" /> {item.label}
                </button>
              )
            })}
          </nav>
        )}
      </header>
      <main className="flex-1 overflow-y-auto min-h-0">
        <div className="max-w-[1440px] mx-auto h-full">
          <LearningProvider>
            <JSNav.Provider value={{ setPage, page }}>
              <Suspense fallback={<div className="flex h-full items-center justify-center text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>页面加载中...</div>}>
                <PageComp />
              </Suspense>
            </JSNav.Provider>
          </LearningProvider>
        </div>
      </main>
      <TutuChat />
    </div>
  )
}
