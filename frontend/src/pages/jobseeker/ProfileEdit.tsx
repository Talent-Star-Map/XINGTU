import { useState, useEffect } from 'react'
import { Save, User, MapPin, GraduationCap, Briefcase, Target, Star, Building, Loader2, CheckCircle, AlertCircle, Mail, Phone } from 'lucide-react'
import ProfileSidebar from '../../components/ProfileSidebar'

const requiredFields = ['real_name', 'phone', 'education', 'target_position']

interface Field {
  icon: any; label: string; key: string; required: boolean
  type?: string; opts?: { v: string; l: string }[]; placeholder?: string
}

const basicFields: Field[] = [
  { icon: User, label: '姓名', key: 'real_name', required: true, placeholder: '请输入真实姓名' },
  { icon: User, label: '性别', key: 'gender', type: 'select', opts: [{ v: '女', l: '女' }, { v: '男', l: '男' }], required: false },
  { icon: User, label: '年龄', key: 'age', placeholder: '请输入年龄', required: false },
  { icon: Building, label: '学历', key: 'education', type: 'select', opts: [{ v: '本科', l: '本科' }, { v: '大专', l: '大专' }, { v: '硕士', l: '硕士' }, { v: '博士', l: '博士' }], required: true },
  { icon: GraduationCap, label: '学校', key: 'school', placeholder: '请输入毕业院校', required: false },
  { icon: MapPin, label: '所在城市', key: 'city', placeholder: '如：北京', required: false },
  { icon: Target, label: '目标城市', key: 'target_city', placeholder: '期望工作城市', required: false },
  { icon: Briefcase, label: '工作经验', key: 'experience', placeholder: '如：3年 / 应届', required: false },
  { icon: Star, label: '期望薪资', key: 'expected_salary', placeholder: '如：15K-25K', required: false },
  { icon: Target, label: '目标岗位', key: 'target_position', placeholder: '如：Java后端开发', required: true },
]

export default function ProfileEdit() {
  const [form, setForm] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [errors, setErrors] = useState<string[]>([])

  useEffect(() => {
    const token = localStorage.getItem('xingtu_token')
    if (!token) return
    fetch(`/api/auth/profile?token=${token}`).then(r => r.json()).then(d => {
      if (d.success) {
        const p = d.data; setForm({
          real_name: p.real_name || '', gender: p.gender || '女', age: p.age?.toString() || '',
          phone: p.phone || '', email: p.email || '', education: p.education || '本科',
          school: p.school || '', city: p.city || '', target_city: p.target_city || '',
          experience: p.experience || '', expected_salary: p.expected_salary || '',
          target_position: p.target_position || '', skills: p.skills || '', bio: p.bio || '',
        })
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const save = async () => {
    const missing = requiredFields.filter(k => !form[k]?.trim())
    if (missing.length > 0) {
      const labels = missing.map(k => basicFields.find(f => f.key === k)?.label || k)
      setErrors(labels)
      setTimeout(() => setErrors([]), 4000)
      return
    }
    const token = localStorage.getItem('xingtu_token')
    if (!token) return
    setSaving(true); setSaved(false); setErrors([])
    const body = { ...form, age: form.age?.toString().trim() ? parseInt(form.age) : null }
    const r = await fetch(`/api/auth/profile?token=${token}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const d = await r.json()
    if (d.success) setSaved(true)
    setSaving(false); setTimeout(() => setSaved(false), 3000)
  }

  const h = (k: string, v: string) => setForm((prev: any) => ({ ...prev, [k]: v }))
  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--color-primary)' }} /></div>

  const hasVal = (k: string) => form[k]?.toString().trim()
  const inputStyle = (k: string) => ({
    borderColor: hasVal(k) ? 'var(--color-outline-variant)' : 'var(--color-outline)',
    background: hasVal(k) ? 'var(--color-surface)' : 'var(--color-surface-container-low)',
    color: hasVal(k) ? 'var(--color-on-surface)' : 'var(--color-on-surface-variant)',
  })

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex gap-8">
        <ProfileSidebar />
        <div className="flex-1 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold" style={{ color: 'var(--color-on-surface)' }}>个人资料</h1>
              <p className="text-xs mt-1 flex items-center gap-1" style={{ color: 'var(--color-on-surface-variant)' }}>
                <span style={{ color: 'var(--accent-red)' }}>*</span> 为必填项
              </p>
            </div>
            <button onClick={save} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-60" style={{ background: saved ? 'var(--accent-green)' : 'var(--color-primary)' }}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <CheckCircle className="h-4 w-4" /> : <Save className="h-4 w-4" />}{saved ? '已保存' : '保存'}
            </button>
          </div>

          {errors.length > 0 && (
            <div className="flex items-start gap-3 rounded-xl border p-4" style={{ borderColor: 'rgba(220,38,38,0.3)', background: 'rgba(220,38,38,0.06)' }}>
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" style={{ color: 'var(--accent-red)' }} />
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--accent-red)' }}>请填写以下必填项：</p>
                <p className="text-xs mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>{errors.join('、')}</p>
              </div>
            </div>
          )}

          {/* 联系方式区 */}
          <div className="rounded-2xl border p-6" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
            <h2 className="text-base font-bold mb-4" style={{ color: 'var(--color-on-surface)' }}>联系方式</h2>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <div>
                <label className="flex items-center gap-1 text-xs font-medium mb-1.5" style={{ color: 'var(--color-on-surface-variant)' }}>
                  <Mail className="h-3.5 w-3.5" />邮箱（登录账号）
                </label>
                <input value={form.email || ''} disabled
                  className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none opacity-60"
                  style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-low)', color: 'var(--color-on-surface-variant)' }} />
              </div>
              <div>
                <label className="flex items-center gap-1 text-xs font-medium mb-1.5" style={{ color: 'var(--color-on-surface-variant)' }}>
                  <Phone className="h-3.5 w-3.5" />手机号
                  <span style={{ color: 'var(--accent-red)' }}>*</span>
                </label>
                <input value={form.phone || ''} onChange={e => h('phone', e.target.value)} placeholder="请输入手机号"
                  className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors"
                  style={inputStyle('phone')} />
              </div>
            </div>
          </div>

          {/* 基本信息 */}
          <div className="rounded-2xl border p-6" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
            <h2 className="text-base font-bold mb-4" style={{ color: 'var(--color-on-surface)' }}>基本信息</h2>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              {basicFields.map(f => (
                <div key={f.key}>
                  <label className="flex items-center gap-1.5 text-xs font-medium mb-1.5" style={{ color: 'var(--color-on-surface-variant)' }}>
                    <f.icon className="h-3.5 w-3.5" />{f.label}
                    {f.required && <span style={{ color: 'var(--accent-red)' }}>*</span>}
                  </label>
                  {f.type === 'select' ? (
                    <select value={form[f.key] || ''} onChange={e => h(f.key, e.target.value)}
                      className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors"
                      style={inputStyle(f.key)}>
                      <option value="" disabled style={{ color: 'var(--color-on-surface-variant)' }}>请选择{f.label}</option>
                      {f.opts?.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                    </select>
                  ) : (
                    <input value={form[f.key] || ''} onChange={e => h(f.key, e.target.value)} placeholder={f.placeholder || `请输入${f.label}`}
                      className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors"
                      style={inputStyle(f.key)} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 个人简介 */}
          <div className="rounded-2xl border p-6" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
            <h2 className="text-base font-bold mb-4" style={{ color: 'var(--color-on-surface)' }}>个人简介</h2>
            <textarea value={form.bio || ''} onChange={e => h('bio', e.target.value)} rows={4}
              placeholder="简单介绍一下自己，如专业技能、项目经验、职业目标..."
              className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors resize-none"
              style={inputStyle('bio')} />
          </div>

          {/* 技能标签 */}
          <div className="rounded-2xl border p-6" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
            <h2 className="text-base font-bold mb-4" style={{ color: 'var(--color-on-surface)' }}>技能标签</h2>
            <p className="text-xs mb-3" style={{ color: 'var(--color-on-surface-variant)' }}>用逗号分隔，系统会根据您的简历自动更新</p>
            <textarea value={form.skills || ''} onChange={e => h('skills', e.target.value)} rows={3}
              placeholder="Java, Python, Spring Boot, React, MySQL"
              className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors resize-none"
              style={inputStyle('skills')} />
            {form.skills?.trim() && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {form.skills.split(',').filter(Boolean).map((s: string) => (
                  <span key={s} className="px-2.5 py-1 rounded-md text-xs font-medium" style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-primary)' }}>
                    {s.trim()}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
