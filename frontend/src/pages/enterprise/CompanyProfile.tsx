import { useEffect, useState, useRef } from 'react'
import {
  Building, Loader2, Edit3, Mail, Globe, Users, Tag, MapPin,
  Save, CheckCircle, AlertCircle, X, Camera, Award, ExternalLink, ShieldCheck, ShieldOff,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { EPNav } from '../../lib/NavContext'

// ── 工具函数 ──
function df(val: string | null | undefined, fb = '未填写'): string { return val?.trim() || fb }
function hasVal(val: any): boolean { return val != null && val !== '' && val.toString().trim() ? true : false }

// 必填字段校验
const requiredFields = ['company_name', 'industry', 'company_size', 'company_desc']
const industryOpts = ['人工智能', '互联网/电商', '企业服务/SaaS', '金融科技', '教育培训', '医疗健康', '硬件/芯片', '游戏', '汽车/出行', '其他']
const sizeOpts = ['少于15人', '15-50人', '50-150人', '150-500人', '500-2000人', '2000人以上']

// 认证等级 — 单一 accent 色表达状态
const verifyInfo = [
  { level: 0, icon: ShieldOff, label: '未认证', desc: '完善企业信息后可申请官网认证' },
  { level: 1, icon: ShieldCheck, label: '官网已验证', desc: '已通过企业官网真实性核验' },
  { level: 2, icon: Award, label: '三方认证', desc: '已通过企查查/天眼查工商数据认证' },
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
    }).catch(() => { })
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
      const site = p.company_website?.trim()
      if (!site) { alert('请先在编辑企业信息中填写公司官网'); return }
      await fetch(`/api/auth/profile?token=${localStorage.getItem('xingtu_token')}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verified: 1 })
      })
      fetchProfile()
    } else if (level === 2) {
      if (p.verified < 1) { alert('请先完成官网验证'); return }
      await fetch(`/api/auth/profile?token=${localStorage.getItem('xingtu_token')}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verified: 2 })
      })
      fetchProfile()
    }
  }

  const save = async () => {
    const missing = requiredFields.filter(k => !form[k]?.trim())
    if (missing.length > 0) { setErrors(missing); setTimeout(() => setErrors([]), 4000); return }
    const token = localStorage.getItem('xingtu_token')
    if (!token) return
    setSaving(true); setSaved(false); setErrors([])
    const r = await fetch(`/api/auth/profile?token=${token}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    })
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
      await fetch(`/api/auth/profile?token=${token}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_logo: d.data.url })
      })
      fetchProfile()
    }
    setLogoUploading(false)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full gap-2.5" style={{ color: 'var(--color-on-surface-variant)' }}>
      <Loader2 className="h-5 w-5 animate-spin" />
      <span className="text-base">加载中</span>
    </div>
  )
  if (!p) return <div className="text-center py-24 text-base" style={{ color: 'var(--color-on-surface-variant)' }}>请先登录</div>

  const currentVerify = verifyInfo.find(v => v.level === (p.verified || 0)) || verifyInfo[0]
  const VIcon = currentVerify.icon
  const filledCount = requiredFields.filter(k => hasVal(p[k])).length
  const pct = Math.round((filledCount / requiredFields.length) * 100)
  const qichachaUrl = p.company_name ? `https://www.qcc.com/web/search?key=${encodeURIComponent(p.company_name)}` : '#'
  const tianyanchaUrl = p.company_name ? `https://www.tianyancha.com/search?key=${encodeURIComponent(p.company_name)}` : '#'

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    borderRadius: '8px',
    border: '1px solid var(--color-outline-variant)',
    background: 'var(--color-surface)',
    color: 'var(--color-on-surface)',
    fontSize: '14px',
    outline: 'none',
  }

  // 岗位统计 — 行布局而非卡片
  const statsList = stats && stats.total > 0 ? [
    { label: '在招', val: stats.active, clickable: true },
    { label: '已关闭', val: stats.closed },
    { label: '草稿', val: stats.draft },
    { label: '总计', val: stats.total, clickable: true },
  ] : []

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-14 py-12 space-y-12">
        {/* ── 顶部工具栏 ── */}
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight" style={{ color: 'var(--color-on-surface)' }}>企业信息</h1>
            <p className="text-base mt-2" style={{ color: 'var(--color-on-surface-variant)' }}>
              资料完整度 {pct}% · {filledCount}/{requiredFields.length} 项必填
            </p>
          </div>
          <button
            onClick={openModal}
            className="flex items-center gap-2 h-12 px-5 rounded-lg text-base font-medium transition-colors"
            style={{ background: 'var(--color-primary)', color: 'var(--color-on-primary)' }}
          >
            <Edit3 className="h-5 w-5" /> 编辑信息
          </button>
        </header>

        {/* ── 完整度提示条（仅 < 50% 时显示）── */}
        {pct < 50 && (
          <div className="rounded-lg border px-6 py-5 flex items-center justify-between" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-low)' }}>
            <p className="text-base" style={{ color: 'var(--color-on-surface-variant)' }}>
              完善企业信息可提升可信度与曝光率
            </p>
            <button onClick={openModal} className="text-base font-medium" style={{ color: 'var(--color-primary)' }}>
              立即完善 →
            </button>
          </div>
        )}

        {/* ── 公司头部 — 列布局，无大卡片 ── */}
        <section className="flex items-start gap-10 pb-10 border-b" style={{ borderColor: 'var(--color-outline-variant)' }}>
          {/* Logo + 上传 */}
          <div className="relative shrink-0 group">
            <div className="w-28 h-28 rounded-lg overflow-hidden border flex items-center justify-center"
              style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface)' }}>
              {p.company_logo ? (
                <img src={p.company_logo.startsWith('http') ? p.company_logo : `http://localhost:8083${p.company_logo}`} alt="" className="w-full h-full object-cover" />
              ) : (
                <Building className="h-12 w-12" style={{ color: 'var(--color-on-surface-variant)' }} />
              )}
            </div>
            <button
              onClick={() => logoRef.current?.click()}
              disabled={logoUploading}
              className="absolute inset-0 flex items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ background: 'var(--color-scrim, rgba(0,0,0,0.4))' }}
            >
              {logoUploading ? <Loader2 className="h-6 w-6 text-white animate-spin" /> : <Camera className="h-6 w-6 text-white" />}
            </button>
            <input ref={logoRef} type="file" accept="image/*" onChange={uploadLogo} hidden />
          </div>

          {/* 公司名称 + 认证 + 标签 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap mb-4">
              <h2 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--color-on-surface)' }}>
                {df(p.company_name, '未命名企业')}
              </h2>
              <span className="flex items-center gap-1.5 text-sm px-2.5 py-1 rounded-lg font-medium"
                style={{
                  background: p.verified > 0 ? 'var(--color-primary-fixed)' : 'var(--color-surface-container-high)',
                  color: p.verified > 0 ? 'var(--color-primary)' : 'var(--color-on-surface-variant)'
                }}>
                <VIcon className="h-4 w-4" /> {currentVerify.label}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 mb-4">
              {p.industry && (
                <span className="text-sm px-2.5 py-1 rounded-lg font-medium" style={{ background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface-variant)' }}>
                  {p.industry}
                </span>
              )}
              {p.company_size && (
                <span className="text-sm px-2.5 py-1 rounded-lg font-medium" style={{ background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface-variant)' }}>
                  {p.company_size}
                </span>
              )}
            </div>
            {p.company_website && (
              <div className="flex items-center gap-2.5 text-base">
                <Globe className="h-5 w-5" style={{ color: 'var(--color-on-surface-variant)' }} />
                <a href={p.company_website} target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: 'var(--color-primary)' }}>
                  {p.company_website}
                </a>
              </div>
            )}
          </div>
        </section>

        {/* ── 岗位统计 — 行布局 ── */}
        {statsList.length > 0 && (
          <section>
            <h3 className="text-base font-medium uppercase tracking-wider mb-6" style={{ color: 'var(--color-on-surface-variant)' }}>岗位统计</h3>
            <div className="grid grid-cols-4 border-y" style={{ borderColor: 'var(--color-outline-variant)' }}>
              {statsList.map((s, i) => (
                <div
                  key={s.label}
                  onClick={() => s.clickable && setPage('jobs')}
                  className={`py-7 px-3 ${i < 3 ? 'border-r' : ''} ${s.clickable ? 'cursor-pointer hover:bg-[var(--color-surface-container-low)]' : ''} transition-colors`}
                  style={{ borderColor: 'var(--color-outline-variant)' }}
                >
                  <p className="text-4xl font-semibold tabular-nums" style={{ color: 'var(--color-on-surface)' }}>{s.val}</p>
                  <p className="text-base mt-2" style={{ color: 'var(--color-on-surface-variant)' }}>{s.label}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── 双栏：基本信息 + 认证/福利 ── */}
        <section className="grid grid-cols-3 gap-12">
          {/* 左栏：公司简介 + 基本信息 */}
          <div className="col-span-2 space-y-12">
            {/* 公司简介 */}
            <div>
              <h3 className="text-base font-medium uppercase tracking-wider mb-5" style={{ color: 'var(--color-on-surface-variant)' }}>公司简介</h3>
              {hasVal(p.company_desc) ? (
                <p className="text-lg leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--color-on-surface)' }}>{p.company_desc}</p>
              ) : (
                <p className="text-base italic" style={{ color: 'var(--color-on-surface-variant)' }}>
                  点击右上角"编辑信息"添加公司简介
                </p>
              )}
            </div>

            {/* 基本信息 — 列对齐 */}
            <div>
              <h3 className="text-base font-medium uppercase tracking-wider mb-5" style={{ color: 'var(--color-on-surface-variant)' }}>基本信息</h3>
              <div className="space-y-4">
                <InfoRow icon={Building} label="公司名称" value={p.company_name} />
                <InfoRow icon={Tag} label="所属行业" value={p.industry} />
                <InfoRow icon={Users} label="公司规模" value={p.company_size} />
                <InfoRow icon={Globe} label="公司官网" value={p.company_website} link />
                <InfoRow icon={Mail} label="联系邮箱" value={p.email} />
                <InfoRow icon={MapPin} label="所在城市" value={p.city || p.target_city} />
              </div>
            </div>
          </div>

          {/* 右栏：认证 + 福利 */}
          <div className="space-y-12">
            {/* 企业认证 */}
            <div>
              <h3 className="text-base font-medium uppercase tracking-wider mb-5" style={{ color: 'var(--color-on-surface-variant)' }}>企业认证</h3>
              {/* 当前状态 — 极简展示 */}
              <div className="flex items-center gap-3.5 mb-6 pb-5 border-b" style={{ borderColor: 'var(--color-outline-variant)' }}>
                <VIcon className="h-6 w-6" style={{ color: p.verified > 0 ? 'var(--color-primary)' : 'var(--color-on-surface-variant)' }} />
                <div>
                  <p className="text-lg font-medium" style={{ color: 'var(--color-on-surface)' }}>{currentVerify.label}</p>
                  <p className="text-sm mt-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>{currentVerify.desc}</p>
                </div>
              </div>
              {/* 认证操作 */}
              <div className="space-y-3">
                <button
                  onClick={() => handleVerify(1)}
                  disabled={p.verified >= 1}
                  className="flex items-center justify-between w-full px-5 py-3 rounded-md text-base font-medium border disabled:opacity-50 transition-colors hover:bg-[var(--color-surface-container-low)]"
                  style={{ borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface)' }}
                >
                  <span className="flex items-center gap-2.5"><Globe className="h-5 w-5" /> 官网认证</span>
                  {p.verified >= 1
                    ? <CheckCircle className="h-5 w-5" style={{ color: 'var(--accent-green)' }} />
                    : <span style={{ color: 'var(--color-primary)' }}>去认证</span>}
                </button>
                <button
                  onClick={() => handleVerify(2)}
                  disabled={p.verified >= 2}
                  className="flex items-center justify-between w-full px-5 py-3 rounded-md text-base font-medium border disabled:opacity-50 transition-colors hover:bg-[var(--color-surface-container-low)]"
                  style={{ borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface)' }}
                >
                  <span className="flex items-center gap-2.5"><Award className="h-5 w-5" /> 三方认证</span>
                  {p.verified >= 2
                    ? <CheckCircle className="h-5 w-5" style={{ color: 'var(--accent-green)' }} />
                    : <span style={{ color: 'var(--color-primary)' }}>去认证</span>}
                </button>
              </div>
              {/* 第三方查询入口 */}
              {p.company_name && (
                <div className="mt-5 pt-5 border-t space-y-2" style={{ borderColor: 'var(--color-outline-variant)' }}>
                  <a href={qichachaUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-between w-full px-4 py-2.5 rounded-md text-sm transition-colors hover:bg-[var(--color-surface-container-low)]"
                    style={{ color: 'var(--color-on-surface-variant)' }}>
                    <span className="flex items-center gap-2"><ExternalLink className="h-4 w-4" /> 企查查</span>
                    <span>{p.company_name}</span>
                  </a>
                  <a href={tianyanchaUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-between w-full px-4 py-2.5 rounded-md text-sm transition-colors hover:bg-[var(--color-surface-container-low)]"
                    style={{ color: 'var(--color-on-surface-variant)' }}>
                    <span className="flex items-center gap-2"><ExternalLink className="h-4 w-4" /> 天眼查</span>
                    <span>{p.company_name}</span>
                  </a>
                </div>
              )}
            </div>

            {/* 公司福利 */}
            <div>
              <h3 className="text-base font-medium uppercase tracking-wider mb-5" style={{ color: 'var(--color-on-surface-variant)' }}>公司福利</h3>
              {p.company_benefits?.trim() ? (
                <div className="flex flex-wrap gap-2.5">
                  {p.company_benefits.split(/[,，、]/).filter(Boolean).map((b: string) => (
                    <span key={b} className="px-3 py-1.5 rounded-lg text-base font-medium"
                      style={{ background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface-variant)' }}>
                      {b.trim()}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-base italic" style={{ color: 'var(--color-on-surface-variant)' }}>
                  点击"编辑信息"添加福利标签
                </p>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* ═══ 编辑弹窗 ═══ */}
      <AnimatePresence>
        {modal && (
          <Modal onClose={() => setModal(false)} title="编辑企业信息">
            <div className="space-y-5">
              {errors.length > 0 && (
                <div className="flex items-center gap-2.5 rounded-lg border px-4 py-3" style={{ borderColor: 'var(--accent-red)', background: 'var(--accent-red-dim)' }}>
                  <AlertCircle className="h-5 w-5 shrink-0" style={{ color: 'var(--accent-red)' }} />
                  <p className="text-sm" style={{ color: 'var(--accent-red)' }}>
                    请填写必填项：{errors.map(k => ({ company_name: '公司名称', industry: '所属行业', company_size: '公司规模', company_desc: '公司简介' })[k] || k).join('、')}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <FormField label="公司名称" required>
                  <input value={form.company_name || ''} onChange={e => h('company_name', e.target.value)} placeholder="如：字节跳动" className="form-input" />
                </FormField>
                <FormField label="所属行业" required>
                  <select value={form.industry || ''} onChange={e => h('industry', e.target.value)} className="form-input">
                    <option value="" disabled>请选择行业</option>
                    {industryOpts.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </FormField>
                <FormField label="公司规模" required>
                  <select value={form.company_size || ''} onChange={e => h('company_size', e.target.value)} className="form-input">
                    <option value="" disabled>请选择规模</option>
                    {sizeOpts.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </FormField>
                <FormField label="公司官网">
                  <input value={form.company_website || ''} onChange={e => h('company_website', e.target.value)} placeholder="https://www.example.com" className="form-input" />
                </FormField>
              </div>

              <FormField label="公司简介" required>
                <textarea value={form.company_desc || ''} onChange={e => h('company_desc', e.target.value)} rows={4} placeholder="介绍公司业务方向、技术栈、团队氛围..." className="form-input" />
              </FormField>

              <FormField label="公司福利（逗号分隔）">
                <input value={form.company_benefits || ''} onChange={e => h('company_benefits', e.target.value)} placeholder="五险一金, 双休, 弹性工作, 年终奖" className="form-input" />
                {form.company_benefits?.trim() && (
                  <div className="flex flex-wrap gap-2 mt-2.5">
                    {form.company_benefits.split(/[,，、]/).filter(Boolean).map((b: string) => (
                      <span key={b} className="px-2.5 py-1 rounded-lg text-sm font-medium" style={{ background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface-variant)' }}>{b.trim()}</span>
                    ))}
                  </div>
                )}
              </FormField>

              <div className="flex justify-end gap-3 pt-3">
                <button onClick={() => setModal(false)} className="px-5 py-2.5 rounded-lg text-base font-medium border" style={{ borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface-variant)' }}>取消</button>
                <button
                  onClick={save}
                  disabled={saving}
                  className="px-5 py-2.5 rounded-lg text-base font-semibold disabled:opacity-60 flex items-center gap-2"
                  style={{ background: saved ? 'var(--accent-green)' : 'var(--color-primary)', color: 'var(--color-on-primary)' }}
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <CheckCircle className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                  {saved ? '已保存' : '保存'}
                </button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      <style>{`
        .form-input {
          width: 100%;
          padding: 10px 14px;
          border-radius: 8px;
          border: 1px solid var(--color-outline-variant);
          background: var(--color-surface);
          color: var(--color-on-surface);
          font-size: 14px;
          outline: none;
          transition: border-color 0.2s;
        }
        .form-input:focus {
          border-color: var(--color-primary);
        }
      `}</style>
    </div>
  )
}

// ─── 通用弹窗 ───
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'var(--color-scrim)' }}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className="rounded-2xl border w-full max-w-2xl max-h-[85vh] overflow-y-auto"
        style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b sticky top-0 z-10" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
          <div>
            <h2 className="text-lg font-bold" style={{ color: 'var(--color-on-surface)' }}>{title}</h2>
            <p className="text-sm mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>
              <span style={{ color: 'var(--accent-red)' }}>*</span> 为必填项
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--color-surface-container-high)]">
            <X className="h-5 w-5" style={{ color: 'var(--color-on-surface-variant)' }} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </motion.div>
    </motion.div>
  )
}

// ─── 信息行（只读）───
function InfoRow({ icon: Icon, label, value, link }: { icon: any; label: string; value?: string; link?: boolean }) {
  return (
    <div className="flex items-center gap-3.5">
      <Icon className="h-4 w-4 shrink-0" style={{ color: 'var(--color-on-surface-variant)' }} />
      <span className="text-sm w-24 shrink-0" style={{ color: 'var(--color-on-surface-variant)' }}>{label}</span>
      <span className="text-base" style={{ color: value ? 'var(--color-on-surface)' : 'var(--color-on-surface-variant)', fontStyle: value ? 'normal' : 'italic' }}>
        {value ? (link ? <a href={value} target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: 'var(--color-primary)' }}>{value}</a> : value) : '未填写'}
      </span>
    </div>
  )
}

// ─── 表单字段 ───
function FormField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm mb-2" style={{ color: 'var(--color-on-surface-variant)' }}>
        {label}{required && <span style={{ color: 'var(--accent-red-strong)' }}> *</span>}
      </label>
      {children}
    </div>
  )
}
