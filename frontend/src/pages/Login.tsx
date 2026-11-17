import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import './Login.css'
import BrandLogo from '../components/BrandLogo'
import { ArrowLeft, Loader2, Eye, EyeOff } from 'lucide-react'

interface Props { onLogin: (role: 'jobseeker' | 'enterprise' | 'admin') => void }

// 记住登录凭据的 localStorage key（按角色分别存储，互不干扰）
const STORAGE_KEY = 'xingtu_saved_login'

export default function Login({ onLogin }: Props) {
  const { role } = useParams()
  const userRole = (role || 'jobseeker') as 'jobseeker' | 'enterprise' | 'admin'
  // 管理员：只支持登录，不支持注册（管理员账号由 seed_admin 脚本预设）
  const [mode, setMode] = useState<'login' | 'register'>(userRole === 'admin' ? 'login' : 'login')
  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [cd, setCd] = useState(0)
  const [showPwd, setShowPwd] = useState(false)
  // 默认勾选"记住我"：登录成功后把账号密码存 localStorage，下次访问自动填充
  const [remember, setRemember] = useState(true)

  // 初始化：从 localStorage 读取该角色上次保存的账号密码
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const saved = JSON.parse(raw)
        if (saved.role === userRole && saved.account) {
          setAccount(saved.account)
          if (saved.password) setPassword(saved.password)
        }
      }
    } catch {}
  }, [userRole])

  const sendCode = async () => {
    if (!account) return setError('请输入邮箱或手机号')
    setLoading(true); setError('')
    try {
      const r = await fetch(`/api/auth/send-code`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({account}) })
      const d = await r.json()
      if (!d.success) { setError(d.message||'发送失败'); return }
      setCd(60); const t = setInterval(() => { setCd(p => { if(p<=1){clearInterval(t);return 0};return p-1 }) }, 1000)
    } catch { setError('网络错误') }
    finally { setLoading(false) }
  }

  const submit = async () => {
    if (!account||!password) return setError('请填写完整')
    if (mode==='register'&&!code) return setError('请输入验证码')
    setLoading(true); setError('')
    try {
      // 管理员走独立登录接口（无验证码、无注册流程，且只校验 admins 表）
      const url = userRole === 'admin'
        ? `/api/auth/admin/login`
        : (mode==='login' ? `/api/auth/login` : `/api/auth/register`)
      const body = userRole === 'admin'
        ? {account, password}
        : (mode==='login' ? {account,password,role:userRole} : {account,password,code,role:userRole})
      const r = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) })
      const d = await r.json()
      if (!d.success) { setError(d.detail||d.message||'操作失败'); return }
      if (mode==='register') {
        setError(''); setMode('login')
        return
      }
      // 登录成功：根据"记住我"决定是否保存账号密码到 localStorage
      // 保存后下次访问登录页会自动填充，不用重复输入
      if (remember) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          role: userRole, account, password, savedAt: Date.now()
        }))
      } else {
        localStorage.removeItem(STORAGE_KEY)
      }
      localStorage.setItem('xingtu_token', d.data.token)
      localStorage.setItem('xingtu_role', d.data.role)
      localStorage.setItem('xingtu_user', JSON.stringify(d.data))
      onLogin(d.data.role)
    } catch { setError('网络错误') }
    finally { setLoading(false) }
  }

  // 回车键提交：在任意输入框按 Enter 都触发 submit
  // 注册模式下需额外校验验证码已填，登录模式直接提交
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      submit()
    }
  }

  const roleLabel = userRole === 'admin' ? '管理员' : userRole === 'enterprise' ? '企业' : '求职者'

  return (
    <div className="auth-stage">
      <div className="auth-wrap">
        <section className="auth-panel" data-auth-panel data-role={userRole} aria-labelledby="auth-title">
          <Link to="/" className="auth-back"><ArrowLeft aria-hidden="true" />返回星图</Link>
          <div className="auth-heading">
            <div className="auth-emblem" data-auth-emblem aria-hidden="true"><BrandLogo variant="mark" /></div>
            <h2 id="auth-title">{mode === 'login' ? '登录' : '注册'}星图</h2>
            <p>{roleLabel}入口</p>
          </div>
          {userRole !== 'admin' && (
            <div className="auth-tabs" aria-label="账户操作">
              <button type="button" onClick={() => setMode('login')} aria-pressed={mode === 'login'}>登录</button>
              <button type="button" onClick={() => setMode('register')} aria-pressed={mode === 'register'}>注册</button>
            </div>
          )}
          {error && <div className="auth-error" role="alert">{error}</div>}
          <div className="auth-fields">
            <div>
              <label htmlFor="auth-account" className="auth-label">邮箱{userRole !== 'admin' && ' / 手机号'}</label>
              <div className="auth-input-wrap" data-auth-field="account">
                <input id="auth-account" value={account} onChange={e => setAccount(e.target.value)} onKeyDown={handleKeyDown}
                  autoComplete="username" placeholder={userRole === 'admin' ? '请输入管理员邮箱' : '请输入邮箱或手机号'} className="auth-input" />
              </div>
            </div>
            {mode === 'register' && userRole !== 'admin' && <div>
              <label htmlFor="auth-code" className="auth-label">验证码</label>
              <div className="auth-code-row">
                <div className="auth-input-wrap" data-auth-field="code">
                  <input id="auth-code" value={code} onChange={e => setCode(e.target.value)} onKeyDown={handleKeyDown}
                    autoComplete="one-time-code" placeholder="输入验证码" className="auth-input" />
                </div>
                <button type="button" onClick={sendCode} disabled={loading || cd > 0} className="auth-code-send">{cd > 0 ? `${cd}s` : '获取'}</button>
              </div>
            </div>}
            <div>
              <label htmlFor="auth-password" className="auth-label">密码</label>
              <div className="auth-input-wrap" data-auth-field="password">
                <input id="auth-password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={handleKeyDown}
                  type={showPwd ? 'text' : 'password'} autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                  placeholder="请输入密码" className="auth-input auth-password" />
                <button type="button" onClick={() => setShowPwd(!showPwd)} className="auth-eye"
                  aria-label={showPwd ? '隐藏密码' : '显示密码'} aria-pressed={showPwd}>
                  {showPwd ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}
                </button>
              </div>
            </div>
            {mode === 'login' && <label className="auth-remember">
              <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} />记住账号密码（下次自动填充）
            </label>}
            <button type="button" onClick={submit} disabled={loading} className="auth-submit" data-auth-submit>
              {loading ? <Loader2 className="animate-spin" aria-label="正在处理" /> : mode === 'login' ? '登录' : '注册'}
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}
