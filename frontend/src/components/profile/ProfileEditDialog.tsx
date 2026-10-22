import { useEffect, useState } from 'react'
import {
  User, Mail, Phone, MapPin, GraduationCap, Briefcase, Target, Star, Building,
  Save, CheckCircle, AlertCircle, X, Loader2, Plus, Trash2, Link2, Users, CalendarDays,
} from 'lucide-react'

/**
 * 个人资料编辑弹窗
 *
 * 从 ProfileHome 里抽出来：那边原来一个文件 500+ 行，展示与表单混在一起。
 * 弹窗自己管表单状态与保存请求，保存成功回调 onSaved 让上层刷新资料。
 */

export interface ProfileProject { name: string; desc: string; role: string; url: string }

interface Props {
  profile: any
  projects: ProfileProject[]
  /** 上传简历解析出来的字段，用来预填表单（用户确认后再保存） */
  draft?: Record<string, string> | null
  onClose: () => void
  onSaved: () => void
}

const REQUIRED = ['real_name', 'phone', 'education', 'target_position']

const editFields: { icon: any; label: string; key: string; placeholder?: string; type?: string; opts?: { v: string; l: string }[] }[] = [
  { icon: User, label: '姓名', key: 'real_name', placeholder: '请输入真实姓名' },
  { icon: Users, label: '性别', key: 'gender', type: 'select', opts: [{ v: '女', l: '女' }, { v: '男', l: '男' }] },
  { icon: CalendarDays, label: '年龄', key: 'age', placeholder: '请输入年龄' },
  { icon: Building, label: '学历', key: 'education', type: 'select', opts: [{ v: '本科', l: '本科' }, { v: '大专', l: '大专' }, { v: '硕士', l: '硕士' }, { v: '博士', l: '博士' }] },
  { icon: GraduationCap, label: '毕业院校', key: 'school', placeholder: '请输入毕业院校' },
  { icon: MapPin, label: '所在城市', key: 'city', placeholder: '如：北京' },
  { icon: Target, label: '目标城市', key: 'target_city', placeholder: '期望工作城市' },
  { icon: Briefcase, label: '工作经验', key: 'experience', placeholder: '如：3年 / 应届' },
  { icon: Star, label: '期望薪资', key: 'expected_salary', placeholder: '如：15K-25K' },
  { icon: Target, label: '目标岗位', key: 'target_position', placeholder: '如：Java后端开发' },
]

const labelOf: Record<string, string> = Object.fromEntries(editFields.map(f => [f.key, f.label]))

export default function ProfileEditDialog({ profile: p, projects: initialProjects, draft, onClose, onSaved }: Props) {
  const [form, setForm] = useState<any>(() => ({
    real_name: p.real_name || '', phone: p.phone || '', gender: p.gender || '女',
    age: p.age?.toString() || '', education: p.education || '本科',
    school: p.school || '', city: p.city || '', target_city: p.target_city || '',
    experience: p.experience || '', expected_salary: p.expected_salary || '',
    target_position: p.target_position || '', skills: p.skills || '', bio: p.bio || '',
    ...(draft || {}),
  }))
  const [projects, setProjects] = useState<ProfileProject[]>(initialProjects)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [errors, setErrors] = useState<string[]>([])

  useEffect(() => {
    if (!errors.length) return
    const t = setTimeout(() => setErrors([]), 4000)
    return () => clearTimeout(t)
  }, [errors])

  const set = (k: string, v: string) => setForm((prev: any) => ({ ...prev, [k]: v }))

  const hasVal = (v: any) => v != null && v.toString().trim() !== ''
  const fieldStyle = (k: string) => ({
    borderColor: hasVal(form[k]) ? 'var(--color-outline-variant)' : 'var(--color-outline)',
    background: hasVal(form[k]) ? 'var(--color-surface)' : 'var(--color-surface-container-low)',
    color: hasVal(form[k]) ? 'var(--color-on-surface)' : 'var(--color-on-surface-variant)',
  })

  const save = async () => {
    const missing = REQUIRED.filter(k => !(form[k] || '').trim())
    if (missing.length) { setErrors(missing); return }
    const token = localStorage.getItem('xingtu_token')
    if (!token) return
    setSaving(true); setSaved(false); setErrors([])
    try {
      const r = await fetch(`/api/auth/profile?token=${token}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          age: form.age?.toString().trim() ? parseInt(form.age) : null,
          projects: JSON.stringify(projects),
        }),
      })
      const d = await r.json()
      if (d.success) {
        setSaved(true)
        onSaved()
        setTimeout(onClose, 700)
      } else {
        setErrors(['保存失败，请稍后重试'])
      }
    } catch {
      setErrors(['网络错误，请稍后重试'])
    } finally {
      setSaving(false)
      setTimeout(() => setSaved(false), 3000)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[5vh] pb-10 px-4 overflow-y-auto"
      style={{ background: 'var(--color-scrim)' }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="rounded-2xl border w-full max-w-3xl" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
        <div className="flex items-center justify-between px-8 py-5 border-b" style={{ borderColor: 'var(--color-outline-variant)' }}>
          <div>
            <h2 className="text-lg font-bold" style={{ color: 'var(--color-on-surface)' }}>编辑个人资料</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>
              <span style={{ color: 'var(--accent-red)' }}>*</span> 为必填项{draft ? ' · 已用简历解析结果预填，请核对后保存' : ''}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg" style={{ color: 'var(--color-on-surface-variant)' }}><X className="h-5 w-5" /></button>
        </div>

        <div className="px-8 py-6 space-y-6 max-h-[65vh] overflow-y-auto">
          {errors.length > 0 && (
            <div className="flex items-center gap-3 rounded-xl border p-4" style={{ borderColor: 'var(--accent-red)', background: 'var(--accent-red-dim)' }}>
              <AlertCircle className="h-5 w-5 shrink-0" style={{ color: 'var(--accent-red)' }} />
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--accent-red)' }}>请检查以下内容</p>
                <p className="text-xs mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>
                  {errors.map(k => labelOf[k] || k).join('、')}
                </p>
              </div>
            </div>
          )}

          <div>
            <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--color-on-surface)' }}>基本信息</h3>
            <div className="grid grid-cols-2 gap-x-5 gap-y-3.5">
              {editFields.map(f => (
                <div key={f.key}>
                  <label className="flex items-center gap-1 text-xs font-medium mb-1.5" style={{ color: 'var(--color-on-surface-variant)' }}>
                    <f.icon className="h-3.5 w-3.5" />{f.label}
                    {REQUIRED.includes(f.key) && <span style={{ color: 'var(--accent-red)' }}>*</span>}
                  </label>
                  {f.type === 'select' ? (
                    <select value={form[f.key] || ''} onChange={e => set(f.key, e.target.value)}
                      className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none" style={fieldStyle(f.key)}>
                      <option value="" disabled>请选择{f.label}</option>
                      {f.opts?.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                    </select>
                  ) : (
                    <input value={form[f.key] || ''} onChange={e => set(f.key, e.target.value)}
                      placeholder={f.placeholder || `请输入${f.label}`}
                      className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none" style={fieldStyle(f.key)} />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--color-on-surface)' }}>联系方式</h3>
            <div className="grid grid-cols-2 gap-x-5 gap-y-3.5">
              <div>
                <label className="flex items-center gap-1 text-xs font-medium mb-1.5" style={{ color: 'var(--color-on-surface-variant)' }}>
                  <Mail className="h-3.5 w-3.5" />邮箱（登录账号）
                </label>
                <input value={p.email || ''} disabled
                  className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none opacity-60"
                  style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-low)', color: 'var(--color-on-surface-variant)' }} />
              </div>
              <div>
                <label className="flex items-center gap-1 text-xs font-medium mb-1.5" style={{ color: 'var(--color-on-surface-variant)' }}>
                  <Phone className="h-3.5 w-3.5" />手机号 <span style={{ color: 'var(--accent-red)' }}>*</span>
                </label>
                <input value={form.phone || ''} onChange={e => set('phone', e.target.value)} placeholder="请输入手机号"
                  className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none" style={fieldStyle('phone')} />
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--color-on-surface)' }}>个人简介</h3>
            <textarea value={form.bio || ''} onChange={e => set('bio', e.target.value)} rows={4}
              placeholder="简单介绍一下自己，如专业技能、项目经验、职业目标..."
              className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none resize-none" style={fieldStyle('bio')} />
          </div>

          <div>
            <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--color-on-surface)' }}>技能标签</h3>
            <textarea value={form.skills || ''} onChange={e => set('skills', e.target.value)} rows={2}
              placeholder="Java, Python, Spring Boot, React, MySQL（逗号分隔）"
              className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none resize-none" style={fieldStyle('skills')} />
            {form.skills && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {form.skills.split(/[,，]/).filter(Boolean).map((s: string) => (
                  <span key={s} className="px-2.5 py-1 rounded-md text-xs font-medium"
                    style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-primary)' }}>{s.trim()}</span>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--color-on-surface)' }}>
              <Link2 className="h-4 w-4" /> 项目经历
            </h3>
            {projects.map((proj, i) => (
              <div key={i} className="mb-3 p-4 rounded-xl border space-y-3" style={{ borderColor: 'var(--color-outline-variant)' }}>
                <div className="grid grid-cols-12 gap-3">
                  <div className="col-span-5">
                    <label className="text-[10px] font-semibold mb-1 block" style={{ color: 'var(--color-on-surface-variant)' }}>项目名称</label>
                    <input value={proj.name} onChange={e => { const n = [...projects]; n[i] = { ...n[i], name: e.target.value }; setProjects(n) }}
                      placeholder="如：电商后台管理系统" className="w-full rounded-lg border px-3 py-2 text-xs outline-none" style={fieldStyle('name')} />
                  </div>
                  <div className="col-span-3">
                    <label className="text-[10px] font-semibold mb-1 block" style={{ color: 'var(--color-on-surface-variant)' }}>担任角色</label>
                    <input value={proj.role} onChange={e => { const n = [...projects]; n[i] = { ...n[i], role: e.target.value }; setProjects(n) }}
                      placeholder="如：后端开发" className="w-full rounded-lg border px-3 py-2 text-xs outline-none" style={fieldStyle('role')} />
                  </div>
                  <div className="col-span-3">
                    <label className="text-[10px] font-semibold mb-1 block" style={{ color: 'var(--color-on-surface-variant)' }}>GitHub 链接</label>
                    <input value={proj.url} onChange={e => { const n = [...projects]; n[i] = { ...n[i], url: e.target.value }; setProjects(n) }}
                      placeholder="https://github.com/..." className="w-full rounded-lg border px-3 py-2 text-xs outline-none" style={fieldStyle('url')} />
                  </div>
                  <div className="col-span-1 flex items-end">
                    <button onClick={() => setProjects(projects.filter((_, j) => j !== i))} className="p-2 rounded-lg" style={{ color: 'var(--accent-red)' }}><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-semibold mb-1 block" style={{ color: 'var(--color-on-surface-variant)' }}>项目简介</label>
                  <input value={proj.desc} onChange={e => { const n = [...projects]; n[i] = { ...n[i], desc: e.target.value }; setProjects(n) }}
                    placeholder="简要描述项目内容和你的贡献" className="w-full rounded-lg border px-3 py-2 text-xs outline-none" style={fieldStyle('desc')} />
                </div>
              </div>
            ))}
            <button onClick={() => setProjects([...projects, { name: '', desc: '', role: '', url: '' }])}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border border-dashed w-full justify-center"
              style={{ borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface-variant)' }}>
              <Plus className="h-3.5 w-3.5" /> 添加项目
            </button>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-8 py-5 border-t" style={{ borderColor: 'var(--color-outline-variant)' }}>
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm font-semibold" style={{ color: 'var(--color-on-surface-variant)' }}>取消</button>
          <button onClick={save} disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-60"
            style={{ background: saved ? 'var(--accent-green)' : 'var(--color-primary)', color: 'var(--color-on-primary)' }}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <CheckCircle className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {saved ? '已保存' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
