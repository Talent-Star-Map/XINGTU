import { useEffect, useState, useRef } from 'react'
import {
  User, Loader2, Edit3, Mail, Phone, MapPin, GraduationCap, Briefcase, Target,
  Save, CheckCircle, AlertCircle, X, Camera, Upload, Plus, Trash2, ExternalLink,
  Link2, Star, Building, FileText, Activity,
} from 'lucide-react'
import { JSNav } from '../../lib/NavContext'
import ProfileSidebar from '../../components/ProfileSidebar'

// ── helpers ──
function df(val: string | null | undefined, fb = '未填写'): string { return val?.trim() || fb }
function hasVal(val: any): boolean { return val != null && val !== '' && val.toString().trim() ? true : false }

interface Project {
  name: string; desc: string; role: string; url: string
}

const requiredEdits = ['real_name', 'phone', 'education', 'target_position']

export default function ProfileHome() {
  const { setPage } = JSNav.use()
  const [p, setP] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState<any>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [avatarUploading, setAvatarUploading] = useState(false)
  const avatarRef = useRef<HTMLInputElement>(null)
  const resumeRef = useRef<HTMLInputElement>(null)

  useEffect(() => { fetchProfile() }, [])

  const fetchProfile = () => {
    const token = localStorage.getItem('xingtu_token')
    if (!token) { setLoading(false); return }
    fetch(`/api/auth/profile?token=${token}`).then(r => r.json()).then(d => {
      if (d.success) {
        setP(d.data)
        try { setProjects(JSON.parse(d.data.projects || '[]')) } catch { setProjects([]) }
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  const openModal = () => {
    setForm({
      real_name: p.real_name || '', phone: p.phone || '', gender: p.gender || '女',
      age: p.age?.toString() || '', education: p.education || '本科',
      school: p.school || '', city: p.city || '', target_city: p.target_city || '',
      experience: p.experience || '', expected_salary: p.expected_salary || '',
      target_position: p.target_position || '', skills: p.skills || '', bio: p.bio || '',
    })
    setErrors([]); setSaved(false); setModal(true)
  }

  const h = (k: string, v: string) => setForm((prev: any) => ({ ...prev, [k]: v }))

  const saveProfile = async () => {
    const missing = requiredEdits.filter(k => !form[k]?.trim())
    if (missing.length > 0) {
      setErrors(missing); setTimeout(() => setErrors([]), 4000); return
    }
    const body = {
      ...form,
      age: form.age?.toString().trim() ? parseInt(form.age) : null,
      projects: JSON.stringify(projects),
    }
    const token = localStorage.getItem('xingtu_token')
    if (!token) return
    setSaving(true); setSaved(false); setErrors([])
    const r = await fetch(`/api/auth/profile?token=${token}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const d = await r.json()
    if (d.success) { setSaved(true); fetchProfile(); setTimeout(() => setModal(false), 800) }
    setSaving(false); setTimeout(() => setSaved(false), 3000)
  }

  const uploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    const token = localStorage.getItem('xingtu_token')
    setAvatarUploading(true)
    const fd = new FormData(); fd.append('file', file)
    const r = await fetch(`/api/auth/avatar?token=${token}`, { method: 'POST', body: fd })
    const d = await r.json()
    if (d.success) fetchProfile()
    setAvatarUploading(false)
  }

  const uploadResume = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    const token = localStorage.getItem('xingtu_token')
    const fd = new FormData(); fd.append('file', file)
    const r = await fetch(`/api/auth/resume-parse?token=${token}`, { method: 'POST', body: fd })
    const d = await r.json()
    if (d.success && d.data.text) {
      // 简单提取 — 后续接 DeepSeek 做精确解析
      const text: string = d.data.text
      const phoneM = text.match(/1[3-9]\d{9}/)
      const emailM = text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)
      const nameM = text.match(/姓名[：:\s]*(\S+)/)
      const skillsM = text.match(/技能[：:\s]*([\s\S]+?)(?:\n\n|\n(?=[^\n]{2,10}[：:])|$)/)
      if (phoneM) h('phone', phoneM[0])
      if (nameM) h('real_name', nameM[1])
      if (skillsM) h('skills', skillsM[1].replace(/\n/g, ', ').replace(/[,，、]\s*/g, ', '))
      if (!modal) openModal()
    }
    // reset input
    if (resumeRef.current) resumeRef.current.value = ''
  }

  // ── computed ──
  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--color-primary)' }} /></div>
  if (!p) return <div className="text-center py-12" style={{ color: 'var(--color-on-surface-variant)' }}>请先登录</div>

  const name = p.real_name?.trim() || p.username || '未登录用户'
  const filledCount = ['real_name','phone','education','school','city','target_city','target_position','experience','bio'].filter(k => hasVal(p[k])).length
  const pct = Math.round((filledCount / 9) * 100)
  const skillsArr: string[] = p.skills ? p.skills.split(',').map((s: string) => s.trim()).filter(Boolean) : []
  const userStr = localStorage.getItem('xingtu_user')
  const userData = userStr ? JSON.parse(userStr) : null
  const contact = p.email?.trim() || p.phone?.trim() || '暂无联系方式'

  const editFieldStyle = (k: string) => ({
    borderColor: hasVal(form[k]) ? 'var(--color-outline-variant)' : 'var(--color-outline)',
    background: hasVal(form[k]) ? 'var(--color-surface)' : 'var(--color-surface-container-low)',
    color: hasVal(form[k]) ? 'var(--color-on-surface)' : 'var(--color-on-surface-variant)',
  })

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex gap-8">
        <ProfileSidebar />

        <div className="flex-1 space-y-6">
          {/* ── 头部资料卡片（GitHub 风格） ── */}
          <section className="rounded-2xl border p-8" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
            <div className="flex items-start gap-6 flex-wrap">
              {/* 头像 */}
              <div className="relative shrink-0 group">
                <div className="w-28 h-28 rounded-full overflow-hidden border-4 shadow-sm" style={{ borderColor: 'var(--color-surface)' }}>
                  {p.avatar ? (
                    <img src={p.avatar.startsWith('http') ? p.avatar : `http://localhost:8083${p.avatar}`} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center" style={{ background: 'var(--color-surface-variant)' }}>
                      <User className="h-12 w-12" style={{ color: 'var(--color-on-surface-variant)' }} />
                    </div>
                  )}
                </div>
                <button onClick={() => avatarRef.current?.click()} disabled={avatarUploading}
                  className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera className="h-6 w-6 text-white" />
                </button>
                <input ref={avatarRef} type="file" accept="image/*" onChange={uploadAvatar} hidden />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div>
                    <h2 className="text-2xl font-black" style={{ color: 'var(--color-on-surface)' }}>{name}</h2>
                    <div className="flex items-center flex-wrap gap-3 mt-2 text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
                      {p.email && <span className="flex items-center gap-1.5"><Mail className="h-4 w-4" />{p.email}</span>}
                      {p.phone && <span className="flex items-center gap-1.5"><Phone className="h-4 w-4" />{p.phone}</span>}
                      {p.city && <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" />{p.city}</span>}
                    </div>
                    <p className="text-sm mt-2" style={{ color: 'var(--color-on-surface-variant)' }}>
                      {p.target_position || p.education ? [p.target_position, p.education].filter(Boolean).join(' · ') : '未设置岗位和学历'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer border" style={{ borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface-variant)' }}>
                      <Upload className="h-3.5 w-3.5" /> 导入简历
                      <input ref={resumeRef} type="file" accept=".pdf,.docx,.doc,.txt" onChange={uploadResume} hidden />
                    </label>
                    <button onClick={openModal}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
                      style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--accent-purple))' }}>
                      <Edit3 className="h-4 w-4" /> 编辑资料
                    </button>
                  </div>
                </div>

                {/* 资料完整度 */}
                <div className="mt-5 max-w-sm">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold" style={{ color: 'var(--color-on-surface-variant)' }}>资料完整度</span>
                    <span className="text-xs font-bold" style={{ color: pct >= 70 ? 'var(--accent-green)' : 'var(--accent-orange)' }}>{pct}%</span>
                  </div>
                  <div className="h-2 rounded-full" style={{ background: 'var(--color-surface-container)' }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: pct >= 70 ? 'var(--accent-green)' : 'var(--accent-orange)' }} />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ── 求职意向 ── */}
          <section className="rounded-2xl border p-8" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black" style={{ color: 'var(--color-on-surface)' }}>求职意向</h3>
                <button onClick={openModal} className="p-1.5 rounded-lg transition-colors" title="编辑"
                  style={{ color: 'var(--color-on-surface-variant)' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-surface-container)'; e.currentTarget.style.color = 'var(--color-primary)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-on-surface-variant)' }}>
                  <Edit3 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <FormField icon={Target} label="目标岗位" value={p.target_position} />
              <FormField icon={MapPin} label="目标城市" value={p.target_city} />
              <FormField icon={Star} label="期望薪资" value={p.expected_salary} />
            </div>
          </section>

          {/* ── 教育背景 ── */}
          <section className="rounded-2xl border p-8" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black" style={{ color: 'var(--color-on-surface)' }}>教育背景</h3>
                <button onClick={openModal} className="p-1.5 rounded-lg transition-colors" title="编辑"
                  style={{ color: 'var(--color-on-surface-variant)' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-surface-container)'; e.currentTarget.style.color = 'var(--color-primary)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-on-surface-variant)' }}>
                  <Edit3 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <FormField icon={GraduationCap} label="学历" value={p.education} />
              <FormField icon={Building} label="毕业院校" value={p.school} />
              <FormField icon={User} label="年龄" value={p.age ? `${p.age}岁` : ''} />
            </div>
          </section>

          {/* ── 个人简介 ── */}
          <section className="rounded-2xl border p-8" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black" style={{ color: 'var(--color-on-surface)' }}>个人简介</h3>
                <button onClick={openModal} className="p-1.5 rounded-lg transition-colors" title="编辑"
                  style={{ color: 'var(--color-on-surface-variant)' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-surface-container)'; e.currentTarget.style.color = 'var(--color-primary)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-on-surface-variant)' }}>
                  <Edit3 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            {hasVal(p.bio) ? (
              <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--color-on-surface)' }}>{p.bio}</p>
            ) : (
              <p className="text-sm italic" style={{ color: 'var(--color-on-surface-variant)' }}>
                点击 <button onClick={openModal} className="underline cursor-pointer" style={{ color: 'var(--color-primary)' }}>编辑资料</button> 添加个人简介
              </p>
            )}
          </section>

          {/* ── 技能标签 ── */}
          <section className="rounded-2xl border p-8" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-lg font-black" style={{ color: 'var(--color-on-surface)' }}>技能标签</h3>
              <button onClick={openModal} className="p-1.5 rounded-lg transition-colors" title="编辑"
                style={{ color: 'var(--color-on-surface-variant)' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-surface-container)'; e.currentTarget.style.color = 'var(--color-primary)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-on-surface-variant)' }}>
                <Edit3 className="h-3.5 w-3.5" />
              </button>
            </div>
            {skillsArr.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {skillsArr.map(s => (
                  <span key={s} className="px-3 py-1.5 rounded-lg text-sm font-semibold" style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-primary)' }}>{s}</span>
                ))}
              </div>
            ) : (
              <p className="text-sm italic" style={{ color: 'var(--color-on-surface-variant)' }}>点击 <button onClick={openModal} className="underline cursor-pointer" style={{ color: 'var(--color-primary)' }}>编辑资料</button> 添加技能标签，或上传简历自动填充</p>
            )}
          </section>

          {/* ── 项目贡献（GitHub 风格） ── */}
          <section className="rounded-2xl border p-8" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-black flex items-center gap-2" style={{ color: 'var(--color-on-surface)' }}>
                <Link2 className="h-5 w-5" /> 项目贡献
              </h3>
              <button onClick={openModal}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                style={{ color: 'var(--color-primary)', background: 'var(--color-primary-fixed)' }}>
                <Plus className="h-3.5 w-3.5" /> 添加项目
              </button>
            </div>

            {projects.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {projects.map((proj, i) => (
                  <div key={i} className="rounded-xl border p-5 transition-colors" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface)' }}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--color-on-surface)' }}>
                          {proj.url ? (
                            <a href={proj.url} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1.5 hover:underline"
                              style={{ color: 'var(--color-primary)' }}>
                              {proj.name || '未命名项目'} <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            proj.name || '未命名项目'
                          )}
                        </h4>
                        {proj.role && <p className="text-xs mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>职责：{proj.role}</p>}
                        {proj.desc && <p className="text-xs mt-2 leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>{proj.desc}</p>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm italic" style={{ color: 'var(--color-on-surface-variant)' }}>
                还没有添加项目，点击 <button onClick={openModal} className="underline cursor-pointer" style={{ color: 'var(--color-primary)' }}>编辑资料</button> 添加你的项目经历和 GitHub 仓库链接
              </p>
            )}
          </section>
        </div>
      </div>

      {/* ═══════ 编辑弹窗 ═══════ */}
      {modal && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[5vh] pb-10 px-4 overflow-y-auto"
          style={{ background: 'rgba(0,0,0,0.5)' }} onClick={e => { if (e.target === e.currentTarget) setModal(false) }}>
          <div className="rounded-2xl border w-full max-w-3xl" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
            {/* header */}
            <div className="flex items-center justify-between px-8 py-5 border-b" style={{ borderColor: 'var(--color-outline-variant)' }}>
              <div>
                <h2 className="text-lg font-bold" style={{ color: 'var(--color-on-surface)' }}>编辑个人资料</h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-on-surface-variant)' }}><span style={{ color: 'var(--accent-red)' }}>*</span> 为必填项</p>
              </div>
              <button onClick={() => setModal(false)} className="p-2 rounded-lg" style={{ color: 'var(--color-on-surface-variant)' }}><X className="h-5 w-5" /></button>
            </div>

            {/* body */}
            <div className="px-8 py-6 space-y-6 max-h-[65vh] overflow-y-auto">
              {errors.length > 0 && (
                <div className="flex items-center gap-3 rounded-xl border p-4" style={{ borderColor: 'rgba(220,38,38,0.3)', background: 'rgba(220,38,38,0.06)' }}>
                  <AlertCircle className="h-5 w-5 shrink-0" style={{ color: 'var(--accent-red)' }} />
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--accent-red)' }}>请填写以下必填项：</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>
                      {errors.map(k => editLabelMap[k] || k).join('、')}
                    </p>
                  </div>
                </div>
              )}

              {/* 基本信息 */}
              <div>
                <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--color-on-surface)' }}>基本信息</h3>
                <div className="grid grid-cols-2 gap-x-5 gap-y-3.5">
                  {editFields.map(f => {
                    const required = requiredEdits.includes(f.key)
                    const val = form[f.key] || ''
                    return (
                      <div key={f.key}>
                        <label className="flex items-center gap-1 text-xs font-medium mb-1.5" style={{ color: 'var(--color-on-surface-variant)' }}>
                          <f.icon className="h-3.5 w-3.5" />{f.label}
                          {required && <span style={{ color: 'var(--accent-red)' }}>*</span>}
                        </label>
                        {f.type === 'select' ? (
                          <select value={val} onChange={e => h(f.key, e.target.value)}
                            className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none"
                            style={editFieldStyle(f.key)}>
                            <option value="" disabled style={{ color: 'var(--color-on-surface-variant)' }}>请选择{f.label}</option>
                            {f.opts?.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                          </select>
                        ) : (
                          <input value={val} onChange={e => h(f.key, e.target.value)} placeholder={f.placeholder || `请输入${f.label}`}
                            className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none"
                            style={editFieldStyle(f.key)} />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* 联系方式 */}
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
                    <input value={form.phone || ''} onChange={e => h('phone', e.target.value)} placeholder="请输入手机号"
                      className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none"
                      style={editFieldStyle('phone')} />
                  </div>
                </div>
              </div>

              {/* 个人简介 */}
              <div>
                <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--color-on-surface)' }}>个人简介</h3>
                <textarea value={form.bio || ''} onChange={e => h('bio', e.target.value)} rows={4}
                  placeholder="简单介绍一下自己，如专业技能、项目经验、职业目标..."
                  className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none resize-none"
                  style={editFieldStyle('bio')} />
              </div>

              {/* 技能 */}
              <div>
                <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--color-on-surface)' }}>技能标签</h3>
                <textarea value={form.skills || ''} onChange={e => h('skills', e.target.value)} rows={2}
                  placeholder="Java, Python, Spring Boot, React, MySQL（逗号分隔）"
                  className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none resize-none"
                  style={editFieldStyle('skills')} />
                {form.skills && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {form.skills.split(',').filter(Boolean).map((s: string) => (
                      <span key={s} className="px-2.5 py-1 rounded-md text-xs font-medium" style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-primary)' }}>{s.trim()}</span>
                    ))}
                  </div>
                )}
              </div>

              {/* 项目经历 */}
              <div>
                <h3 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--color-on-surface)' }}>
                  <Link2 className="h-4 w-4" /> 项目贡献
                </h3>
                {projects.map((proj, i) => (
                  <div key={i} className="grid grid-cols-12 gap-3 mb-3 p-4 rounded-xl border" style={{ borderColor: 'var(--color-outline-variant)' }}>
                    <div className="col-span-5">
                      <label className="text-[10px] font-semibold mb-1 block" style={{ color: 'var(--color-on-surface-variant)' }}>项目名称</label>
                      <input value={proj.name} onChange={e => {
                        const n = [...projects]; n[i] = { ...n[i], name: e.target.value }; setProjects(n)
                      }} placeholder="如：电商后台管理系统" className="w-full rounded-lg border px-3 py-2 text-xs outline-none" style={editFieldStyle('name')} />
                    </div>
                    <div className="col-span-3">
                      <label className="text-[10px] font-semibold mb-1 block" style={{ color: 'var(--color-on-surface-variant)' }}>担任角色</label>
                      <input value={proj.role} onChange={e => {
                        const n = [...projects]; n[i] = { ...n[i], role: e.target.value }; setProjects(n)
                      }} placeholder="如：后端开发" className="w-full rounded-lg border px-3 py-2 text-xs outline-none" style={editFieldStyle('role')} />
                    </div>
                    <div className="col-span-3">
                      <label className="text-[10px] font-semibold mb-1 block" style={{ color: 'var(--color-on-surface-variant)' }}>GitHub 链接</label>
                      <input value={proj.url} onChange={e => {
                        const n = [...projects]; n[i] = { ...n[i], url: e.target.value }; setProjects(n)
                      }} placeholder="https://github.com/..." className="w-full rounded-lg border px-3 py-2 text-xs outline-none" style={editFieldStyle('url')} />
                    </div>
                    <div className="col-span-1 flex items-end">
                      <button onClick={() => setProjects(projects.filter((_, j) => j !== i))} className="p-2 rounded-lg" style={{ color: 'var(--accent-red)' }}><Trash2 className="h-4 w-4" /></button>
                    </div>
                    <div className="col-span-12">
                      <label className="text-[10px] font-semibold mb-1 block" style={{ color: 'var(--color-on-surface-variant)' }}>项目简介</label>
                      <input value={proj.desc} onChange={e => {
                        const n = [...projects]; n[i] = { ...n[i], desc: e.target.value }; setProjects(n)
                      }} placeholder="简要描述项目内容和你的贡献" className="w-full rounded-lg border px-3 py-2 text-xs outline-none" style={editFieldStyle('desc')} />
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

            {/* footer */}
            <div className="flex items-center justify-end gap-3 px-8 py-5 border-t" style={{ borderColor: 'var(--color-outline-variant)' }}>
              <button onClick={() => setModal(false)} className="px-5 py-2.5 rounded-xl text-sm font-semibold" style={{ color: 'var(--color-on-surface-variant)' }}>取消</button>
              <button onClick={saveProfile} disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
                style={{ background: saved ? 'var(--accent-green)' : 'var(--color-primary)' }}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <CheckCircle className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                {saved ? '已保存' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── 编辑弹窗字段定义 ──
const editFields = [
  { icon: User, label: '姓名', key: 'real_name', placeholder: '请输入真实姓名' },
  { icon: User, label: '性别', key: 'gender', type: 'select', opts: [{ v: '女', l: '女' }, { v: '男', l: '男' }] },
  { icon: User, label: '年龄', key: 'age', placeholder: '请输入年龄' },
  { icon: Building, label: '学历', key: 'education', type: 'select', opts: [{ v: '本科', l: '本科' }, { v: '大专', l: '大专' }, { v: '硕士', l: '硕士' }, { v: '博士', l: '博士' }] },
  { icon: GraduationCap, label: '毕业院校', key: 'school', placeholder: '请输入毕业院校' },
  { icon: MapPin, label: '所在城市', key: 'city', placeholder: '如：北京' },
  { icon: Target, label: '目标城市', key: 'target_city', placeholder: '期望工作城市' },
  { icon: Briefcase, label: '工作经验', key: 'experience', placeholder: '如：3年 / 应届' },
  { icon: Star, label: '期望薪资', key: 'expected_salary', placeholder: '如：15K-25K' },
  { icon: Target, label: '目标岗位', key: 'target_position', placeholder: '如：Java后端开发' },
]

const editLabelMap: Record<string, string> = Object.fromEntries(editFields.map(f => [f.key, f.label]))

function FormField({ icon: Icon, label, value }: { icon: any; label: string; value?: string }) {
  return (
    <div className="rounded-xl border p-4" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface)' }}>
      <div className="flex items-center gap-2 mb-1.5">
        <Icon className="h-4 w-4" style={{ color: 'var(--color-on-surface-variant)' }} />
        <span className="text-xs font-medium" style={{ color: 'var(--color-on-surface-variant)' }}>{label}</span>
      </div>
      <p className="text-sm font-semibold" style={{ color: value ? 'var(--color-on-surface)' : 'var(--color-on-surface-variant)', fontStyle: value ? 'normal' : 'italic' }}>
        {value || '未填写'}
      </p>
    </div>
  )
}
