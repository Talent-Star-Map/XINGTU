import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ArrowRight, Moon, Shield, Sun } from 'lucide-react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useTheme } from '../components/ThemeProvider'
import { mountRoleSelectGalaxy } from './roleSelectGalaxy'
import './RoleSelect.css'
import BrandLogo from '../components/BrandLogo'

const entrances = [
  { path: '/login/jobseeker', label: '求职者', description: '浏览岗位 · 简历解析 · 人岗匹配' },
  { path: '/login/enterprise', label: '企业', description: '岗位管理 · 人才搜索 · 市场洞察' },
]

export default function RoleSelect() {
  const { theme, toggle } = useTheme()
  const { pathname } = useLocation()
  const isLogin = pathname.startsWith('/login/')
  const viewport = useRef<HTMLDivElement>(null)
  const scrollArea = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const statement = useRef<HTMLDivElement>(null)
  const entranceGroup = useRef<HTMLDivElement>(null)
  const [scrolled, setScrolled] = useState(false)

  useLayoutEffect(() => {
    const html = document.documentElement
    html.dataset.authLayout = 'true'
    return () => { delete html.dataset.authLayout }
  }, [])

  useEffect(() => {
    if (!canvas.current || !viewport.current || !scrollArea.current || !statement.current) return
    return mountRoleSelectGalaxy(canvas.current, viewport.current, scrollArea.current, statement.current)
  }, [])

  useEffect(() => {
    const area = scrollArea.current
    const entries = entranceGroup.current
    if (!area || !entries) return
    const admin = area.querySelector<HTMLAnchorElement>('.admin')
    const links = admin ? [entries, admin] : [entries]

    function updateEntrances() {
      if (!area || !entries) return
      const height = area.clientHeight
      const bottom = Math.max(...links.map(link => link.getBoundingClientRect().bottom)) - area.getBoundingClientRect().top + area.scrollTop
      // 矮屏先让入口完整进入视野，再开始退场。
      const start = Math.max(height * .06, bottom - height + 64)
      const progress = Math.max(0, Math.min(1, (area.scrollTop - start) / Math.max(1, height * .28)))
      const eased = progress * progress * (3 - 2 * progress)
      links.forEach(link => {
        link.style.setProperty('--entry-opacity', String(1 - eased))
        link.style.setProperty('--entry-blur', `${eased * 7}px`)
        link.inert = progress === 1
        link.dataset.hidden = String(progress === 1)
      })
    }

    const observer = new ResizeObserver(updateEntrances)
    observer.observe(area)
    observer.observe(entries)
    area.addEventListener('scroll', updateEntrances, { passive: true })
    updateEntrances()
    return () => {
      observer.disconnect()
      area.removeEventListener('scroll', updateEntrances)
    }
  }, [])

  function backToTop(event: React.MouseEvent<HTMLAnchorElement>) {
    if (isLogin) return
    event.preventDefault()
    scrollArea.current?.scrollTo({ top: 0 })
  }

  return (
    <div className="role-select" data-role-theme={theme} data-auth-route={isLogin ? 'login' : 'home'} ref={viewport}>
      <canvas className="scene" ref={canvas} aria-hidden="true" />
      <header className={scrolled && !isLogin ? 'nav scrolled' : 'nav'}>
        <Link className="brand" to="/" onClick={backToTop}><BrandLogo /></Link>
        <button className="icon-btn" type="button" onClick={toggle}
          aria-label={theme === 'dark' ? '切换到浅色主题' : '切换到深色主题'}>
          {theme === 'dark' ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
        </button>
      </header>

      <div className="scroll-area" ref={scrollArea} inert={isLogin} aria-hidden={isLogin || undefined}
        onScroll={event => setScrolled(event.currentTarget.scrollTop > 8)}>
        <main>
          <section className="hero" aria-labelledby="role-select-title">
            <h1 className="rise d1" id="role-select-title"><span className="hero-slogan-line">星图照见所长，AI助你轻装</span><span className="hero-slogan-line">让每一份才华奔赴梦想</span></h1>
            <p className="lede rise d2">岗位能力图谱动态演化与分析系统</p>
            <div className="gap" aria-hidden="true" />
            <div className="cards" ref={entranceGroup}>
              {entrances.map(({ path, label, description }, i) => (
                <Link className={`card rise d${i + 3}`} to={path} key={path}>
                  <svg className="entry-orbit" viewBox="0 0 400 124" preserveAspectRatio="none" aria-hidden="true">
                    <defs>
                      <linearGradient id={`entry-track-${i}`} x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0" stopColor="currentColor" stopOpacity="0" />
                        <stop offset=".24" stopColor="currentColor" stopOpacity=".3" />
                        <stop offset=".64" stopColor="currentColor" stopOpacity=".65" />
                        <stop offset="1" stopColor="currentColor" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path d={i === 0 ? 'M24 39 C4 92 102 120 242 103 S354 76 379 32' : 'M21 48 C48 110 146 119 269 97 S365 64 379 31'}
                      fill="none" stroke={`url(#entry-track-${i})`} strokeWidth=".8" vectorEffect="non-scaling-stroke" />
                    <circle cx={i === 0 ? 277 : 309} cy={i === 0 ? 97 : 88} r="1.5" fill="currentColor" />
                    <circle cx={i === 0 ? 330 : 253} cy={i === 0 ? 81 : 100} r=".8" fill="currentColor" opacity=".5" />
                  </svg>
                  <span className="card-top">
                    <span className="card-title">
                      <span className="entry-star" aria-hidden="true">
                        <svg viewBox="0 0 24 24"><path d="M12 1.5C13.2 8.5 14.8 10.5 22 12C14.6 13.3 13 15.4 11.5 22.5C10.6 15.4 8.7 13.3 2 11.8C8.9 10.8 10.8 8.7 12 1.5Z" /></svg>
                      </span>
                      {label}
                    </span>
                    <ArrowRight className="card-arrow" aria-hidden="true" />
                  </span>
                  <span className="card-desc">{description}</span>
                </Link>
              ))}
            </div>
            <Link className="admin rise d5" to="/login/admin"><Shield aria-hidden="true" />管理员入口</Link>
          </section>

          <section className="statement" aria-labelledby="role-select-statement">
            <div className="block" ref={statement}>
              <h2 id="role-select-statement">一张会生长的图<span>岗位、技能与能力如何关联</span></h2>
              <p>岗位要求会随时间改变。星图从招聘信息中提取技能，帮助你比较岗位要求、梳理已有能力，并找到接下来可以补齐的技能。</p>
              <p className="note">当前星图为关系示意</p>
            </div>
          </section>

          <section className="feats" aria-label="星图功能">
            <div className="feat"><h3>岗位图谱</h3><p>从多源招聘信息中提取技能，整理岗位能力要求。</p></div>
            <div className="feat"><h3>人岗匹配</h3><p>对照简历与岗位要求，解释已覆盖和有待补齐的技能。</p></div>
            <div className="feat"><h3>学习路径</h3><p>围绕目标岗位的技能差距，推荐学习资源与练习方向。</p></div>
          </section>
        </main>
        <footer className="foot">
          <Link className="brand" to="/" onClick={backToTop}><BrandLogo /></Link>
          <span>多源异构数据驱动的岗位与能力图谱</span>
        </footer>
      </div>
      <div className="auth-overlay" inert={!isLogin} aria-hidden={!isLogin || undefined}><Outlet /></div>
    </div>
  )
}
