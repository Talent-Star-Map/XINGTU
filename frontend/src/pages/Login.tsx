import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Star, ArrowLeft, Loader2, Eye, EyeOff, Shield } from 'lucide-react'

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

  // 管理员端主题色：绿色（区别于求职者青色、企业紫色）
  const accentColor = userRole === 'admin' ? 'var(--accent-green)' : (userRole === 'jobseeker' ? 'var(--color-primary)' : 'var(--accent-purple)')
  const accentDim = userRole === 'admin' ? 'var(--accent-green-dim)' : (userRole === 'jobseeker' ? 'var(--color-primary-fixed)' : 'var(--accent-purple-dim)')

  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="star-field" />
      <div className="relative z-10 w-full max-w-sm px-4">
        <a href="/" className="inline-flex items-center gap-1 text-xs mb-6" style={{color:'var(--color-outline)'}}>
          <ArrowLeft className="h-3.5 w-3.5" /> 返回
        </a>
        <div className="rounded-xl border p-6" style={{borderColor:'var(--color-outline-variant)',background:'var(--color-surface-container-lowest)'}}>
          <div className="text-center mb-6">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl mb-3" style={{background:accentDim}}>
              {userRole === 'admin' ? <Shield className="h-6 w-6" style={{color:accentColor}} /> : <Star className="h-6 w-6" style={{color:accentColor}} />}
            </div>
            <h2 className="text-base font-semibold" style={{color:'var(--color-on-surface)'}}>{mode==='login'?'登录':'注册'}星图{userRole==='admin'?' · 管理员':''}</h2>
          </div>
          {/* 管理员端只显示登录 Tab，不显示注册 Tab */}
          {userRole !== 'admin' && (
            <div className="flex mb-4 rounded-lg border p-0.5" style={{borderColor:'var(--color-outline-variant)'}}>
              <button onClick={()=>setMode('login')} className="flex-1 py-2 text-sm font-semibold rounded-md" style={{background:mode==='login'?'var(--color-primary)':'transparent',color:mode==='login'?'var(--color-on-primary)':'var(--color-on-surface-variant)'}}>登录</button>
              <button onClick={()=>setMode('register')} className="flex-1 py-2 text-sm font-semibold rounded-md" style={{background:mode==='register'?'var(--color-primary)':'transparent',color:mode==='register'?'var(--color-on-primary)':'var(--color-on-surface-variant)'}}>注册</button>
            </div>
          )}
          {error&&<div className="text-xs text-center mb-3 py-2 rounded-lg" style={{background:'var(--accent-red-dim)',color:'var(--accent-red)'}}>{error}</div>}
          <div className="space-y-3.5">
            <div>
              <label className="text-xs font-medium block mb-1.5" style={{color:'var(--color-on-surface-variant)'}}>邮箱 {userRole !== 'admin' && '/ 手机号'}</label>
              <input value={account} onChange={e=>setAccount(e.target.value)} onKeyDown={handleKeyDown} placeholder={userRole==='admin'?'请输入管理员邮箱':'请输入邮箱或手机号'}
                className="w-full rounded-lg border px-3.5 py-2.5 text-sm outline-none" style={{borderColor:'var(--color-outline-variant)',background:'var(--color-surface)',color:'var(--color-on-surface)'}} />
            </div>
            {mode==='register'&&userRole!=='admin'&&<div>
              <label className="text-xs font-medium block mb-1.5" style={{color:'var(--color-on-surface-variant)'}}>验证码</label>
              <div className="flex gap-2">
                <input value={code} onChange={e=>setCode(e.target.value)} onKeyDown={handleKeyDown} placeholder="输入验证码"
                  className="flex-1 rounded-lg border px-3.5 py-2.5 text-sm outline-none" style={{borderColor:'var(--color-outline-variant)',background:'var(--color-surface)',color:'var(--color-on-surface)'}} />
                <button onClick={sendCode} disabled={loading||cd>0} className="shrink-0 px-4 rounded-lg text-xs font-semibold disabled:opacity-50" style={{background:'var(--color-primary)',color:'var(--color-on-primary)'}}>
                  {cd>0?`${cd}s`:'获取'}
                </button>
              </div>
            </div>}
            <div>
              <label className="text-xs font-medium block mb-1.5" style={{color:'var(--color-on-surface-variant)'}}>密码</label>
              <div className="relative">
                <input value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={handleKeyDown} type={showPwd?'text':'password'} placeholder="请输入密码"
                  className="w-full rounded-lg border px-3.5 py-2.5 pr-10 text-sm outline-none" style={{borderColor:'var(--color-outline-variant)',background:'var(--color-surface)',color:'var(--color-on-surface)'}} />
                <button type="button" onClick={()=>setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{color:'var(--color-on-surface-variant)'}}>
                  {showPwd ? <Eye className="h-4.5 w-4.5" /> : <EyeOff className="h-4.5 w-4.5" />}
                </button>
              </div>
            </div>
            {/* 记住我：勾选后登录成功会把账号密码存 localStorage，下次自动填充 */}
            {mode==='login' && (
              <label className="flex items-center gap-2 text-xs cursor-pointer select-none" style={{color:'var(--color-on-surface-variant)'}}>
                <input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)}
                  className="h-3.5 w-3.5 rounded" style={{accentColor:'var(--color-primary)'}} />
                记住账号密码（下次自动填充）
              </label>
            )}
            <button onClick={submit} disabled={loading}
              className="w-full rounded-lg py-2.5 text-sm font-semibold disabled:opacity-60"
              style={{background:`linear-gradient(135deg, ${accentColor}, var(--accent-purple))`,color:'var(--color-on-primary)'}}>
              {loading?<Loader2 className="h-4 w-4 mx-auto animate-spin" />:'登 录'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
