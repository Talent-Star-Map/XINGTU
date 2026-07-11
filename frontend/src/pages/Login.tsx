import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Star, ArrowLeft, Loader2, Eye, EyeOff } from 'lucide-react'

interface Props { onLogin: (role: 'jobseeker' | 'enterprise') => void }

export default function Login({ onLogin }: Props) {
  const { role } = useParams()
  const userRole = (role || 'jobseeker') as 'jobseeker' | 'enterprise'
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [cd, setCd] = useState(0)
  const [showPwd, setShowPwd] = useState(false)

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
      const url = mode==='login' ? `/api/auth/login` : `/api/auth/register`
      const body = mode==='login' ? {account,password,role:userRole} : {account,password,code,role:userRole}
      const r = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) })
      const d = await r.json()
      if (!d.success) { setError(d.detail||d.message||'操作失败'); return }
      if (mode==='register') {
        setError(''); setMode('login')
        return
      }
      localStorage.setItem('xingtu_token', d.data.token)
      localStorage.setItem('xingtu_role', d.data.role)
      localStorage.setItem('xingtu_user', JSON.stringify(d.data))
      onLogin(d.data.role)
    } catch { setError('网络错误') }
    finally { setLoading(false) }
  }

  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="star-field" />
      <div className="relative z-10 w-full max-w-sm px-4">
        <a href="/" className="inline-flex items-center gap-1 text-xs mb-6" style={{color:'var(--color-outline)'}}>
          <ArrowLeft className="h-3.5 w-3.5" /> 返回
        </a>
        <div className="rounded-xl border p-6" style={{borderColor:'var(--color-outline-variant)',background:'var(--color-surface-container-lowest)'}}>
          <div className="text-center mb-6">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl mb-3" style={{background:userRole==='jobseeker'?'var(--color-primary-fixed)':'var(--accent-purple-dim)'}}>
              <Star className="h-6 w-6" style={{color:userRole==='jobseeker'?'var(--color-primary)':'var(--accent-purple)'}} />
            </div>
            <h2 className="text-base font-semibold" style={{color:'var(--color-on-surface)'}}>{mode==='login'?'登录':'注册'}星图</h2>
          </div>
          <div className="flex mb-4 rounded-lg border p-0.5" style={{borderColor:'var(--color-outline-variant)'}}>
            <button onClick={()=>setMode('login')} className="flex-1 py-2 text-sm font-semibold rounded-md" style={{background:mode==='login'?'var(--color-primary)':'transparent',color:mode==='login'?'#fff':'var(--color-on-surface-variant)'}}>登录</button>
            <button onClick={()=>setMode('register')} className="flex-1 py-2 text-sm font-semibold rounded-md" style={{background:mode==='register'?'var(--color-primary)':'transparent',color:mode==='register'?'#fff':'var(--color-on-surface-variant)'}}>注册</button>
          </div>
          {error&&<div className="text-xs text-center mb-3 py-2 rounded-lg" style={{background:'rgba(220,38,38,0.08)',color:'var(--accent-red)'}}>{error}</div>}
          <div className="space-y-3.5">
            <div>
              <label className="text-xs font-medium block mb-1.5" style={{color:'var(--color-on-surface-variant)'}}>邮箱 / 手机号</label>
              <input value={account} onChange={e=>setAccount(e.target.value)} placeholder="请输入邮箱或手机号"
                className="w-full rounded-lg border px-3.5 py-2.5 text-sm outline-none" style={{borderColor:'var(--color-outline-variant)',background:'var(--color-surface)',color:'var(--color-on-surface)'}} />
            </div>
            {mode==='register'&&<div>
              <label className="text-xs font-medium block mb-1.5" style={{color:'var(--color-on-surface-variant)'}}>验证码</label>
              <div className="flex gap-2">
                <input value={code} onChange={e=>setCode(e.target.value)} placeholder="输入验证码"
                  className="flex-1 rounded-lg border px-3.5 py-2.5 text-sm outline-none" style={{borderColor:'var(--color-outline-variant)',background:'var(--color-surface)',color:'var(--color-on-surface)'}} />
                <button onClick={sendCode} disabled={loading||cd>0} className="shrink-0 px-4 rounded-lg text-xs font-semibold text-white disabled:opacity-50" style={{background:'var(--color-primary)'}}>
                  {cd>0?`${cd}s`:'获取'}
                </button>
              </div>
            </div>}
            <div>
              <label className="text-xs font-medium block mb-1.5" style={{color:'var(--color-on-surface-variant)'}}>密码</label>
              <div className="relative">
                <input value={password} onChange={e=>setPassword(e.target.value)} type={showPwd?'text':'password'} placeholder="请输入密码"
                  className="w-full rounded-lg border px-3.5 py-2.5 pr-10 text-sm outline-none" style={{borderColor:'var(--color-outline-variant)',background:'var(--color-surface)',color:'var(--color-on-surface)'}} />
                <button type="button" onClick={()=>setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{color:'var(--color-on-surface-variant)'}}>
                  {showPwd ? <Eye className="h-4.5 w-4.5" /> : <EyeOff className="h-4.5 w-4.5" />}
                </button>
              </div>
            </div>
            <button onClick={submit} disabled={loading}
              className="w-full rounded-lg py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              style={{background:'linear-gradient(135deg, var(--color-primary), var(--accent-purple))'}}>
              {loading?<Loader2 className="h-4 w-4 mx-auto animate-spin" />:(mode==='login'?'登 录':'注 册')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
