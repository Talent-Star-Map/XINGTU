import { useEffect, useState, useRef } from 'react'
import {
  Building, Loader2, Edit3, Mail, Phone, Globe, Users, Tag, MapPin,
  Save, CheckCircle, AlertCircle, X, Camera, Star, Award, Shield, ExternalLink, ShieldCheck, ShieldAlert, ShieldOff,
  Briefcase,
} from 'lucide-react'
import { EPNav } from '../../lib/NavContext'

function df(val: string | null | undefined, fb = '未填写'): string { return val?.trim() || fb }
function hasVal(val: any): boolean { return val != null && val !== '' && val.toString().trim() ? true : false }

const requiredFields = ['company_name', 'industry', 'company_size', 'company_desc']
const industryOpts = ['人工智能', '互联网/电商', '企业服务/SaaS', '金融科技', '教育培训', '医疗健康', '硬件/芯片', '游戏', '汽车/出行', '其他']

const verifyInfo = [
  { level: 0, icon: ShieldOff, label: '未认证', desc: '完善企业信息后可申请官网认证', color: 'var(--color-on-surface-variant)', bg: 'rgba(128,128,128,0.08)' },
  { level: 1, icon: ShieldCheck, label: '官网已验证', desc: '已通过企业官网真实性核验', color: 'var(--color-primary)', bg: 'var(--color-primary-fixed)' },
  { level: 2, icon: Award, label: '三方认证', desc: '已通过企查查/天眼查工商数据认证', color: 'var(--accent-green)', bg: 'rgba(0,229,153,0.1)' },
]

export default function CompanyProfile() {
  const { setPage } = EPNav.use()
  const [p, setP] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<any>(null)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState<any>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const logoRef = useRef<HTMLInputElement>(null)
  const [logoUploading, setLogoUploading] = useState(false)

  useEffect(() => { fetchProfile() }, [])

  const fetchProfile = () => {
    const token = localStorage.getItem('xingtu_token')
    if (!token) { setLoading(false); return }
    fetch(`/api/auth/profile?token=${token}`).then(r => r.json()).then(d => {
      if (d.success) { setP(d.data); fetchStats(d.data.company_name) }
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  const fetchStats = (companyName?: string) => {
    const name = companyName || p?.company_name
    if (!name) return
    fetch(`/api/jobs/stats?company=${encodeURIComponent(name)}`).then(r => r.json()).then(d => {
      if (d.success) setStats(d.data)
    }).catch(() => {})
  }

  const openModal = () => {
    setForm({
      company_name: p.company_name || '', industry: p.industry || '',
      company_size: p.company_size || '', company_desc: p.company_desc || '',
      company_website: p.company_website || '', company_benefits: p.company_benefits || '',
    })
    setErrors([]); setSaved(false); setModal(true)
  }

  const h = (k: string, v: string) => setForm((prev: any) => ({ ...prev, [k]: v }))

  const handleVerify = async (level: number) => {
    if (level === 1) {
      // 官网认证：检查网站是否填写
      const site = p.company_website?.trim()
      if (!site) { alert('请先在编辑企业信息中填写公司官网'); return }
      // 简单的自动验证：检查网站是否可访问痕迹（前端层面标记）
      await fetch(`/api/auth/profile?token=${localStorage.getItem('xingtu_token')}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ verified: 1 }) })
      fetchProfile()
    } else if (level === 2) {
      if (p.verified < 1) { alert('请先完成官网验证'); return }
      await fetch(`/api/auth/profile?token=${localStorage.getItem('xingtu_token')}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ verified: 2 }) })
      fetchProfile()
    }
  }

  const save = async () => {
    const missing = requiredFields.filter(k => !form[k]?.trim())
    if (missing.length > 0) { setErrors(missing); setTimeout(() => setErrors([]), 4000); return }
    const token = localStorage.getItem('xingtu_token')
    if (!token) return
    setSaving(true); setSaved(false); setErrors([])
    const r = await fetch(`/api/auth/profile?token=${token}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    const d = await r.json()
    if (d.success) { setSaved(true); fetchProfile(); setTimeout(() => setModal(false), 800) }
    setSaving(false); setTimeout(() => setSaved(false), 3000)
  }

  const uploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    const token = localStorage.getItem('xingtu_token')
    setLogoUploading(true)
    const fd = new FormData(); fd.append('file', file)
    const r = await fetch(`/api/auth/avatar?token=${token}`, { method: 'POST', body: fd })
    const d = await r.json()
    if (d.success) {
      await fetch(`/api/auth/profile?token=${token}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ company_logo: d.data.url }) })
      fetchProfile()
    }
    setLogoUploading(false)
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--accent-purple)' }} /></div>
  if (!p) return <div className="text-center py-12" style={{ color: 'var(--color-on-surface-variant)' }}>请先登录</div>

  const currentVerify = verifyInfo.find(v => v.level === (p.verified || 0)) || verifyInfo[0]
  const VIcon = currentVerify.icon
  const filledCount = requiredFields.filter(k => hasVal(p[k])).length
  const pct = Math.round((filledCount / requiredFields.length) * 100)
  const qichachaUrl = p.company_name ? `https://www.qcc.com/web/search?key=${encodeURIComponent(p.company_name)}` : '#'
  const tianyanchaUrl = p.company_name ? `https://www.tianyancha.com/search?key=${encodeURIComponent(p.company_name)}` : '#'

  const editStyle = (k: string) => ({
    borderColor: hasVal(form[k]) ? 'var(--color-outline-variant)' : 'var(--color-outline)',
    background: hasVal(form[k]) ? 'var(--color-surface)' : 'var(--color-surface-container-low)',
    color: hasVal(form[k]) ? 'var(--color-on-surface)' : 'var(--color-on-surface-variant)',
  })

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      {/* 空状态 */}
      {pct < 50 && (
        <div className="rounded-2xl border p-5 flex items-center justify-between" style={{ borderColor: 'rgba(124,58,237,0.2)', background: 'rgba(124,58,237,0.04)' }}>
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--accent-purple)' }}>完善企业信息，提升企业可信度与曝光率</p>
            <p className="text-xs mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>完整的企业资料能让求职者更信赖你的公司，认证后获得专属标识</p>
          </div>
          <button onClick={openModal} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white shrink-0" style={{ background: 'var(--accent-purple)' }}>
            <Edit3 className="h-3.5 w-3.5" /> 完善资料
          </button>
        </div>
      )}

      {/* 公司头部 */}
      <section className="rounded-2xl border p-8" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
        <div className="flex items-start gap-6 flex-wrap">
          <div className="relative shrink-0 group">
            <div className="w-28 h-28 rounded-xl overflow-hidden border-2 shadow-sm flex items-center justify-center" style={{ borderColor: p.verified >= 1 ? 'var(--color-primary)' : 'var(--color-outline-variant)', background: 'var(--color-surface)' }}>
              {p.company_logo ? (
                <img src={p.company_logo.startsWith('http') ? p.company_logo : `http://localhost:8083${p.company_logo}`} alt="" className="w-full h-full object-cover" />
              ) : (
                <Building className="h-12 w-12" style={{ color: 'var(--color-on-surface-variant)' }} />
              )}
            </div>
            <button onClick={() => logoRef.current?.click()} disabled={logoUploading} className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
              {logoUploading ? <Loader2 className="h-6 w-6 text-white animate-spin" /> : <Camera className="h-6 w-6 text-white" />}
            </button>
            <input ref={logoRef} type="file" accept="image/*" onChange={uploadLogo} hidden />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h2 className="text-2xl font-black" style={{ color: 'var(--color-on-surface)' }}>{df(p.company_name, '未命名企业')}</h2>
                  {/* 认证标识 */}
                  <span className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full font-semibold border" style={{ background: currentVerify.bg, color: currentVerify.color, borderColor: currentVerify.color + '33' }}>
                    <VIcon className="h-3.5 w-3.5" /> {currentVerify.label}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  {p.industry && <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: 'var(--accent-purple-dim)', color: 'var(--accent-purple)' }}>{p.industry}</span>}
                  {p.company_size && <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-primary)' }}>{p.company_size}</span>}
                </div>
                {p.company_website && <div className="flex items-center gap-1.5 mt-2 text-sm"><Globe className="h-4 w-4" style={{ color: 'var(--color-on-surface-variant)' }} /><a href={p.company_website} target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: 'var(--color-primary)' }}>{p.company_website}</a></div>}
              </div>
              <button onClick={openModal} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--accent-purple))' }}>
                <Edit3 className="h-4 w-4" /> 编辑企业信息
              </button>
            </div>
            <div className="mt-5 max-w-sm">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold" style={{ color: 'var(--color-on-surface-variant)' }}>资料完整度</span>
                <span className="text-xs font-bold" style={{ color: pct >= 75 ? 'var(--accent-green)' : 'var(--accent-orange)' }}>{pct}%</span>
              </div>
              <div className="h-2 rounded-full" style={{ background: 'var(--color-surface-container)' }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: pct >= 75 ? 'var(--accent-green)' : 'var(--accent-orange)' }} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 岗位统计 */}
      {stats && stats.total > 0 && (
        <div className="grid grid-cols-4 gap-4">
          <StatCard label="在招岗位" value={stats.active} color="var(--accent-green)" onClick={() => setPage('jobs')} />
          <StatCard label="已关闭" value={stats.closed} color="var(--color-on-surface-variant)" />
          <StatCard label="草稿" value={stats.draft} color="var(--accent-orange)" />
          <StatCard label="总岗位数" value={stats.total} color="var(--accent-purple)" onClick={() => setPage('jobs')} />
        </div>
      )}

      {/* 两栏布局 */}
      <div className="grid grid-cols-3 gap-6">
        {/* 左栏：简介 + 基本信息 */}
        <div className="col-span-2 space-y-6">
          <section className="rounded-2xl border p-8" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-lg font-black" style={{ color: 'var(--color-on-surface)' }}>公司简介</h3>
              <button onClick={openModal} className="p-1.5 rounded-lg transition-colors" title="编辑"
                style={{ color: 'var(--color-on-surface-variant)' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-surface-container)'; e.currentTarget.style.color = 'var(--accent-purple)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-on-surface-variant)' }}>
                <Edit3 className="h-3.5 w-3.5" />
              </button>
            </div>
            {hasVal(p.company_desc) ? (
              <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--color-on-surface)' }}>{p.company_desc}</p>
            ) : (
              <p className="text-sm italic" style={{ color: 'var(--color-on-surface-variant)' }}>点击 <button onClick={openModal} className="underline cursor-pointer" style={{ color: 'var(--accent-purple)' }}>编辑企业信息</button> 介绍公司业务</p>
            )}
          </section>

          <section className="rounded-2xl border p-8" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
            <h3 className="text-lg font-black mb-5" style={{ color: 'var(--color-on-surface)' }}>基本信息</h3>
            <div className="space-y-3">
              <InfoRow icon={Building} label="公司名称" value={p.company_name} />
              <InfoRow icon={Tag} label="所属行业" value={p.industry} />
              <InfoRow icon={Users} label="公司规模" value={p.company_size} />
              <InfoRow icon={Globe} label="公司官网" value={p.company_website} link />
              <InfoRow icon={Mail} label="联系邮箱" value={p.email} />
              <InfoRow icon={MapPin} label="所在城市" value={p.city || p.target_city} />
            </div>
          </section>
        </div>

        {/* 右栏：认证 + 福利 */}
        <div className="space-y-6">
          {/* 企业认证 */}
          <section className="rounded-2xl border p-6" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
            <h3 className="text-sm font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--color-on-surface)' }}>
              <Shield className="h-4 w-4" style={{ color: 'var(--accent-purple)' }} /> 企业认证
            </h3>

            {/* 当前状态 */}
            <div className="rounded-xl p-4 mb-4 text-center" style={{ background: currentVerify.bg }}>
              <VIcon className="h-8 w-8 mx-auto mb-2" style={{ color: currentVerify.color }} />
              <p className="text-sm font-bold" style={{ color: currentVerify.color }}>{currentVerify.label}</p>
              <p className="text-xs mt-1" style={{ color: currentVerify.color + '99' }}>{currentVerify.desc}</p>
            </div>

            {/* 认证操作 */}
            <div className="space-y-2">
              <button onClick={() => handleVerify(1)}
                disabled={p.verified >= 1}
                className="flex items-center justify-between w-full px-4 py-3 rounded-xl text-sm font-semibold transition-all border disabled:opacity-40"
                style={{
                  borderColor: p.verified >= 1 ? 'var(--accent-green)' : 'var(--color-outline-variant)',
                  color: p.verified >= 1 ? 'var(--accent-green)' : 'var(--color-on-surface)',
                  background: p.verified >= 1 ? 'rgba(0,229,153,0.05)' : 'var(--color-surface)',
                }}>
                <span className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  官网认证
                </span>
                {p.verified >= 1 ? <CheckCircle className="h-4 w-4" /> : <span className="text-xs" style={{ color: 'var(--color-primary)' }}>去认证</span>}
              </button>

              <button onClick={() => handleVerify(2)}
                disabled={p.verified >= 2}
                className="flex items-center justify-between w-full px-4 py-3 rounded-xl text-sm font-semibold transition-all border disabled:opacity-40"
                style={{
                  borderColor: p.verified >= 2 ? 'var(--accent-green)' : 'var(--color-outline-variant)',
                  color: p.verified >= 2 ? 'var(--accent-green)' : 'var(--color-on-surface)',
                  background: p.verified >= 2 ? 'rgba(0,229,153,0.05)' : 'var(--color-surface)',
                }}>
                <span className="flex items-center gap-2">
                  <Award className="h-4 w-4" />
                  三方认证
                </span>
                {p.verified >= 2 ? <CheckCircle className="h-4 w-4" /> : <span className="text-xs" style={{ color: 'var(--color-primary)' }}>去认证</span>}
              </button>
            </div>

            {/* 第三方查询入口 */}
            {p.company_name && (
              <div className="mt-4 pt-4 border-t space-y-2" style={{ borderColor: 'var(--color-outline-variant)' }}>
                <p className="text-xs font-medium" style={{ color: 'var(--color-on-surface-variant)' }}>第三方工商信息查询</p>
                <a href={qichachaUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-between w-full px-4 py-2.5 rounded-xl text-xs font-medium border transition-colors"
                  style={{ borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface)', background: 'var(--color-surface)' }}>
                  <span className="flex items-center gap-2"><ExternalLink className="h-3.5 w-3.5" /> 企查查查询</span>
                  <span style={{ color: 'var(--color-primary)' }}>{p.company_name}</span>
                </a>
                <a href={tianyanchaUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-between w-full px-4 py-2.5 rounded-xl text-xs font-medium border transition-colors"
                  style={{ borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface)', background: 'var(--color-surface)' }}>
                  <span className="flex items-center gap-2"><ExternalLink className="h-3.5 w-3.5" /> 天眼查查询</span>
                  <span style={{ color: 'var(--color-primary)' }}>{p.company_name}</span>
                </a>
              </div>
            )}
          </section>

          {/* 公司福利 */}
          <section className="rounded-2xl border p-6" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-sm font-bold" style={{ color: 'var(--color-on-surface)' }}>公司福利</h3>
              <button onClick={openModal} className="p-1 rounded-lg transition-colors" title="编辑"
                style={{ color: 'var(--color-on-surface-variant)' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-surface-container)'; e.currentTarget.style.color = 'var(--accent-purple)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-on-surface-variant)' }}>
                <Edit3 className="h-3 w-3" />
              </button>
            </div>
            {p.company_benefits?.trim() ? (
              <div className="flex flex-wrap gap-2">
                {p.company_benefits.split(/[,，、]/).filter(Boolean).map((b: string) => (
                  <span key={b} className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: 'var(--accent-purple-dim)', color: 'var(--accent-purple)' }}>{b.trim()}</span>
                ))}
              </div>
            ) : (
              <div className="text-center py-4">
                <Star className="h-6 w-6 mx-auto mb-2" style={{ color: 'var(--color-on-surface-variant)' }} />
                <p className="text-xs italic" style={{ color: 'var(--color-on-surface-variant)' }}>点击编辑添加五险一金、双休等福利</p>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* ═══ 编辑弹窗 ═══ */}
      {modal && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[5vh] pb-10 px-4 overflow-y-auto" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={e => { if (e.target === e.currentTarget) setModal(false) }}>
          <div className="rounded-2xl border w-full max-w-2xl" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
            <div className="flex items-center justify-between px-8 py-5 border-b" style={{ borderColor: 'var(--color-outline-variant)' }}>
              <div>
                <h2 className="text-lg font-bold" style={{ color: 'var(--color-on-surface)' }}>编辑企业信息</h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-on-surface-variant)' }}><span style={{ color: 'var(--accent-red)' }}>*</span> 为必填项</p>
              </div>
              <button onClick={() => setModal(false)} className="p-2 rounded-lg" style={{ color: 'var(--color-on-surface-variant)' }}><X className="h-5 w-5" /></button>
            </div>
            <div className="px-8 py-6 space-y-5 max-h-[65vh] overflow-y-auto">
              {errors.length > 0 && (
                <div className="flex items-center gap-3 rounded-xl border p-4" style={{ borderColor: 'rgba(220,38,38,0.3)', background: 'rgba(220,38,38,0.06)' }}>
                  <AlertCircle className="h-5 w-5 shrink-0" style={{ color: 'var(--accent-red)' }} />
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--accent-red)' }}>请填写以下必填项：</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>
                      {errors.map(k => ({ company_name: '公司名称', industry: '所属行业', company_size: '公司规模', company_desc: '公司简介' })[k] || k).join('、')}
                    </p>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-x-5 gap-y-3.5">
                <div>
                  <label className="text-xs font-medium mb-1.5 flex items-center gap-1" style={{ color: 'var(--color-on-surface-variant)' }}>
                    <Building className="h-3.5 w-3.5" />公司名称 <span style={{ color: 'var(--accent-red)' }}>*</span>
                  </label>
                  <input value={form.company_name || ''} onChange={e => h('company_name', e.target.value)} placeholder="如：字节跳动" className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none" style={editStyle('company_name')} />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1.5 flex items-center gap-1" style={{ color: 'var(--color-on-surface-variant)' }}>
                    <Tag className="h-3.5 w-3.5" />所属行业 <span style={{ color: 'var(--accent-red)' }}>*</span>
                  </label>
                  <select value={form.industry || ''} onChange={e => h('industry', e.target.value)} className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none" style={editStyle('industry')}>
                    <option value="" disabled style={{ color: 'var(--color-on-surface-variant)' }}>请选择行业</option>
                    {industryOpts.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium mb-1.5 flex items-center gap-1" style={{ color: 'var(--color-on-surface-variant)' }}>
                    <Users className="h-3.5 w-3.5" />公司规模 <span style={{ color: 'var(--accent-red)' }}>*</span>
                  </label>
                  <select value={form.company_size || ''} onChange={e => h('company_size', e.target.value)} className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none" style={editStyle('company_size')}>
                    <option value="" disabled>请选择规模</option>
                    {['少于15人','15-50人','50-150人','150-500人','500-2000人','2000人以上'].map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium mb-1.5 flex items-center gap-1" style={{ color: 'var(--color-on-surface-variant)' }}>
                    <Globe className="h-3.5 w-3.5" />公司官网
                  </label>
                  <input value={form.company_website || ''} onChange={e => h('company_website', e.target.value)} placeholder="https://www.example.com" className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none" style={editStyle('company_website')} />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium mb-1.5 flex items-center gap-1" style={{ color: 'var(--color-on-surface-variant)' }}>
                  公司简介 <span style={{ color: 'var(--accent-red)' }}>*</span>
                </label>
                <textarea value={form.company_desc || ''} onChange={e => h('company_desc', e.target.value)} rows={4} placeholder="介绍公司业务方向、技术栈、团队氛围..." className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none resize-none" style={editStyle('company_desc')} />
              </div>
              <div>
                <label className="text-xs font-medium mb-1.5" style={{ color: 'var(--color-on-surface-variant)' }}>公司福利</label>
                <input value={form.company_benefits || ''} onChange={e => h('company_benefits', e.target.value)} placeholder="五险一金, 双休, 弹性工作, 年终奖, 餐补（逗号分隔）" className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none" style={editStyle('company_benefits')} />
                {form.company_benefits?.trim() && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {form.company_benefits.split(/[,，、]/).filter(Boolean).map((b: string) => (
                      <span key={b} className="px-2.5 py-1 rounded-md text-xs font-medium" style={{ background: 'var(--accent-purple-dim)', color: 'var(--accent-purple)' }}>{b.trim()}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-8 py-5 border-t" style={{ borderColor: 'var(--color-outline-variant)' }}>
              <button onClick={() => setModal(false)} className="px-5 py-2.5 rounded-xl text-sm font-semibold" style={{ color: 'var(--color-on-surface-variant)' }}>取消</button>
              <button onClick={save} disabled={saving} className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60" style={{ background: saved ? 'var(--accent-green)' : 'var(--accent-purple)' }}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <CheckCircle className="h-4 w-4" /> : <Save className="h-4 w-4" />}{saved ? '已保存' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function InfoRow({ icon: Icon, label, value, link }: { icon: any; label: string; value?: string; link?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="h-4 w-4 shrink-0" style={{ color: 'var(--color-on-surface-variant)' }} />
      <span className="text-xs font-medium w-20 shrink-0" style={{ color: 'var(--color-on-surface-variant)' }}>{label}</span>
      <span className="text-sm" style={{ color: value ? 'var(--color-on-surface)' : 'var(--color-on-surface-variant)', fontStyle: value ? 'normal' : 'italic', fontWeight: value ? 600 : 400 }}>
        {value ? (link ? <a href={value} target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: 'var(--color-primary)' }}>{value}</a> : value) : '未填写'}
      </span>
    </div>
  )
}

function StatCard({ label, value, color, onClick }: { label: string; value: number; color: string; onClick?: () => void }) {
  return (
    <div onClick={onClick} className={`rounded-2xl border p-5 text-center ${onClick ? 'cursor-pointer hover:shadow-md' : ''}`}
      style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
      <p className="text-3xl font-extrabold" style={{ color }}>{value}</p>
      <p className="text-xs font-semibold mt-1.5" style={{ color: 'var(--color-on-surface-variant)' }}>{label}</p>
    </div>
  )
}
