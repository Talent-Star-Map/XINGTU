import { useEffect, useRef, useState } from 'react'
import {
  User, Loader2, Edit3, Mail, Phone, MapPin, GraduationCap, Briefcase, Target,
  Star, Building, Link2, FileText, Upload, Plus, ExternalLink, Camera, ArrowRight, CalendarDays,
} from 'lucide-react'
import { JSNav } from '../../lib/NavContext'
import ProfileSidebar from '../../components/ProfileSidebar'
import PageHeader from '../../components/PageHeader'
import ProfileEditDialog, { type ProfileProject } from '../../components/profile/ProfileEditDialog'

/**
 * 个人主页
 *
 * 2026-10-22 重做：顶部信息栏换成与「简历工作台」同一个 PageHeader 组件，
 * 资料卡压缩、求职意向与教育背景两栏并排，并把简历份数/最近更新汇到本页，
 * 不再是一屏全是留白的六个大卡片。
 */

const COMPLETENESS: { key: string; label: string }[] = [
  { key: 'real_name', label: '姓名' }, { key: 'phone', label: '手机号' },
  { key: 'education', label: '学历' }, { key: 'school', label: '毕业院校' },
  { key: 'city', label: '所在城市' }, { key: 'target_city', label: '目标城市' },
  { key: 'target_position', label: '目标岗位' }, { key: 'experience', label: '工作经验' },
  { key: 'bio', label: '个人简介' },
]

const hasVal = (v: any) => v != null && v.toString().trim() !== ''

export default function ProfileHome() {
  const { setPage } = JSNav.use()
  const [p, setP] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [draft, setDraft] = useState<Record<string, string> | null>(null)
  const [projects, setProjects] = useState<ProfileProject[]>([])
  const [avatarError, setAvatarError] = useState(false)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [toast, setToast] = useState('')
  const [resumeStat, setResumeStat] = useState<{ count: number; latest: string } | null>(null)
  const avatarRef = useRef<HTMLInputElement>(null)
  const resumeRef = useRef<HTMLInputElement>(null)

  useEffect(() => { fetchProfile(); fetchResumeStat() }, [])

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

  /** 简历份数与最近更新时间：本页要能看出「我有几份简历、上次改到什么时候」 */
  const fetchResumeStat = () => {
    const token = localStorage.getItem('xingtu_token')
    if (!token) return
    fetch(`/api/resume-center/list?token=${token}`).then(r => r.json()).then(d => {
      if (!d.success) return
      const list: any[] = d.data || []
      const latest = list
        .map(r => r.updated_at || r.created_at || '')
        .sort()
        .pop() || ''
      setResumeStat({ count: list.length, latest })
    }).catch(() => {})
  }

  const uploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    const token = localStorage.getItem('xingtu_token')
    setAvatarUploading(true)
    const fd = new FormData(); fd.append('file', file)
    try {
      const r = await fetch(`/api/auth/avatar?token=${token}`, { method: 'POST', body: fd })
      const d = await r.json()
      if (d.success) { setAvatarError(false); fetchProfile() }
      else setToast(d.error?.message || '头像上传失败')
    } catch { setToast('网络错误') }
    setAvatarUploading(false)
    setTimeout(() => setToast(''), 3000)
  }

  const uploadResume = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    const token = localStorage.getItem('xingtu_token')
    const fd = new FormData(); fd.append('file', file)
    try {
      const r = await fetch(`/api/auth/resume-parse?token=${token}`, { method: 'POST', body: fd })
      const d = await r.json()
      if (d.success && d.data) {
        const found: Record<string, string> = {}
        for (const k of ['real_name', 'phone', 'school', 'city', 'target_position', 'bio']) {
          if (hasVal(d.data[k === 'real_name' ? 'name' : k])) found[k] = d.data[k === 'real_name' ? 'name' : k]
        }
        if (Array.isArray(d.data.skills) && d.data.skills.length) found.skills = d.data.skills.join(', ')
        if (d.data.education) found.education = d.data.education
        if (!Object.keys(found).length) { setToast('没解析到可填写的字段，请试试文字版简历'); setTimeout(() => setToast(''), 3500) }
        else { setDraft(found); setModal(true) }
      } else {
        setToast(d.message || '简历解析失败')
        setTimeout(() => setToast(''), 3500)
      }
    } catch { setToast('网络错误'); setTimeout(() => setToast(''), 3000) }
    if (resumeRef.current) resumeRef.current.value = ''
  }

  const openModal = (withDraft = false) => {
    if (!withDraft) setDraft(null)
    setModal(true)
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--color-primary)' }} /></div>
  if (!p) return <div className="text-center py-12" style={{ color: 'var(--color-on-surface-variant)' }}>请先登录</div>

  const name = p.real_name?.trim() || p.username || '未登录用户'
  const missing = COMPLETENESS.filter(k => !hasVal(p[k.key]))
  const pct = Math.round(((COMPLETENESS.length - missing.length) / COMPLETENESS.length) * 100)
  const skillsArr: string[] = p.skills ? p.skills.split(/[,，]/).map((s: string) => s.trim()).filter(Boolean) : []
  const showAvatar = p.avatar && !/^https?:\/\/(localhost|127\.0\.0\.1)/i.test(p.avatar) && !avatarError

  return (
    <div className="max-w-6xl mx-auto px-6 py-6">
      <div className="flex gap-6">
        <ProfileSidebar />

        <div className="flex-1 min-w-0">
          {/* ── 顶部信息栏：与简历工作台同一个组件，样式完全一致 ── */}
          <PageHeader
            icon={User}
            title="个人主页"
            badge={{ text: `资料完整度 ${pct}%`, tone: pct >= 70 ? 'success' : 'warning' }}
            hint={missing.length ? `待补充：${missing.map(m => m.label).join('、')}` : '资料已填写完整，投递时会被自动带出'}
            sticky={false}
            innerClassName="px-0 pb-3"
            actions={<>
              <label className="h-9 px-4 rounded-lg text-sm font-medium flex items-center gap-1.5 border cursor-pointer"
                style={{ borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface-variant)' }}
                title="上传 PDF / Word / 图片简历，自动填进资料">
                <Upload className="h-4 w-4" /> 导入简历
                <input ref={resumeRef} type="file" accept=".pdf,.docx,.doc,.txt,.png,.jpg,.jpeg,.webp,.bmp,.tif,.tiff" onChange={uploadResume} hidden />
              </label>
              <button onClick={() => openModal()}
                className="h-9 px-4 rounded-lg text-sm font-medium flex items-center gap-1.5"
                style={{ background: 'var(--color-primary)', color: 'var(--color-on-primary)' }}>
                <Edit3 className="h-4 w-4" /> 编辑资料
              </button>
            </>}
          />

          {/* ── 资料卡 ── */}
          <section className="rounded-2xl border p-6 mb-5" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
            <div className="flex items-start gap-5 flex-wrap">
              <div className="relative shrink-0 group">
                <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 shadow-sm" style={{ borderColor: 'var(--color-surface)' }}>
                  {showAvatar ? (
                    <img src={p.avatar} onError={() => setAvatarError(true)} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center" style={{ background: 'var(--color-primary-fixed)' }}>
                      <span className="text-2xl font-black" style={{ color: 'var(--color-primary)' }}>{(name || '?').slice(0, 1)}</span>
                    </div>
                  )}
                </div>
                <button onClick={() => avatarRef.current?.click()} disabled={avatarUploading}
                  className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="更换头像">
                  {avatarUploading ? <Loader2 className="h-5 w-5 text-white animate-spin" /> : <Camera className="h-5 w-5 text-white" />}
                </button>
                <input ref={avatarRef} type="file" accept="image/*" onChange={uploadAvatar} hidden />
              </div>

              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-black" style={{ color: 'var(--color-on-surface)' }}>{name}</h2>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2 text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
                  {p.email && <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />{p.email}</span>}
                  {p.phone && <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{p.phone}</span>}
                  {p.city && <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{p.city}</span>}
                  {p.gender && <span>{p.gender}</span>}
                  {p.age ? <span>{p.age} 岁</span> : null}
                </div>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {[
                    { icon: Target, text: p.target_position },
                    { icon: Briefcase, text: p.experience },
                    { icon: GraduationCap, text: [p.school, p.education].filter(Boolean).join(' · ') },
                  ].filter(x => x.text).map(({ icon: Icon, text }, i) => (
                    <span key={i} title={text}
                      className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg max-w-[300px]"
                      style={{ background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface-variant)' }}>
                      <Icon className="h-3 w-3 shrink-0" /><span className="truncate">{text}</span>
                    </span>
                  ))}
                  {!p.target_position && !p.school && !p.experience && (
                    <span className="text-[11px] italic" style={{ color: 'var(--color-on-surface-variant)' }}>还没填岗位意向与教育背景</span>
                  )}
                </div>
              </div>

              {/* 完整度环形：原来是一条通栏进度条，右侧大片留白，改成靠右的环形把空间用起来 */}
              <div className="shrink-0 flex flex-col items-center gap-1 pl-5 md:border-l"
                style={{ borderColor: 'var(--color-outline-variant)' }}>
                <Ring percent={pct} />
                <span className="text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>资料完整度</span>
              </div>
            </div>
          </section>

          {/* ── 求职意向 / 教育背景 并排，减少纵向留白 ── */}
          <div className="grid gap-5 md:grid-cols-2 mb-5">
            <Section title="求职意向" icon={Target} onEdit={() => openModal()}>
              <div className="grid grid-cols-2 gap-2.5">
                <Field icon={Target} label="目标岗位" value={p.target_position} />
                <Field icon={MapPin} label="目标城市" value={p.target_city} />
                <Field icon={Star} label="期望薪资" value={p.expected_salary} />
                <Field icon={Briefcase} label="工作经验" value={p.experience} />
              </div>
            </Section>

            <Section title="教育背景" icon={GraduationCap} onEdit={() => openModal()}>
              <div className="grid grid-cols-2 gap-2.5">
                <Field icon={GraduationCap} label="学历" value={p.education} />
                <Field icon={Building} label="毕业院校" value={p.school} />
                <Field icon={MapPin} label="所在城市" value={p.city} />
                <Field icon={CalendarDays} label="年龄" value={p.age ? `${p.age} 岁` : ''} />
              </div>
            </Section>
          </div>

          {/* ── 简历概览：把简历中心的关键信息汇到本页 ── */}
          <section className="rounded-2xl border p-5 mb-5 flex items-center justify-between gap-4 flex-wrap"
            style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--color-primary-fixed)' }}>
                <FileText className="h-4 w-4" style={{ color: 'var(--color-primary)' }} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold" style={{ color: 'var(--color-on-surface)' }}>
                  {resumeStat ? `我的简历 · ${resumeStat.count} 份` : '我的简历'}
                </p>
                <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--color-on-surface-variant)' }}>
                  {resumeStat
                    ? (resumeStat.count ? `最近更新 ${resumeStat.latest.slice(0, 16)}` : '还没有简历，去简历中心建一份')
                    : '正在读取…'}
                </p>
              </div>
            </div>
            <button onClick={() => setPage('resume-center')}
              className="h-8 px-3 rounded-lg text-xs font-semibold flex items-center gap-1 border"
              style={{ borderColor: 'var(--color-outline-variant)', color: 'var(--color-primary)' }}>
              去简历中心 <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </section>

          <Section title="个人简介" icon={FileText} onEdit={() => openModal()} className="mb-5">
            {hasVal(p.bio) ? (
              <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--color-on-surface)' }}>{p.bio}</p>
            ) : (
              <Empty hint="写清专业技能、项目经验和职业目标，用一句话概括优势" onEdit={() => openModal()} />
            )}
          </Section>

          <Section title="技能标签" icon={Star} count={skillsArr.length} onEdit={() => openModal()} className="mb-5">
            {skillsArr.length ? (
              <div className="flex flex-wrap gap-1.5">
                {skillsArr.map(s => (
                  <span key={s} className="px-2.5 py-1 rounded-lg text-xs font-semibold"
                    style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-primary)' }}>{s}</span>
                ))}
              </div>
            ) : (
              <Empty hint="用逗号分隔，如 Java, Python, MySQL；也可以在上方「导入简历」自动填充" onEdit={() => openModal()} />
            )}
          </Section>

          <Section title="项目经历" icon={Link2} count={projects.length} onEdit={() => openModal()}
            action={
              <button onClick={() => openModal()}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold"
                style={{ color: 'var(--color-primary)', background: 'var(--color-primary-fixed)' }}>
                <Plus className="h-3 w-3" /> 添加
              </button>
            }>
            {projects.length ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {projects.map((proj, i) => (
                  <div key={i} className="rounded-xl border p-4" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface)' }}>
                    <h4 className="text-sm font-bold flex items-center gap-1.5" style={{ color: 'var(--color-on-surface)' }}>
                      {proj.url ? (
                        <a href={proj.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:underline" style={{ color: 'var(--color-primary)' }}>
                          {proj.name || '未命名项目'} <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (proj.name || '未命名项目')}
                    </h4>
                    {proj.role && <p className="text-[11px] mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>职责：{proj.role}</p>}
                    {proj.desc && <p className="text-xs mt-1.5 leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>{proj.desc}</p>}
                  </div>
                ))}
              </div>
            ) : (
              <Empty hint="添加你参与过的项目，附上 GitHub 链接更容易被看到" onEdit={() => openModal()} />
            )}
          </Section>
        </div>
      </div>

      {modal && (
        <ProfileEditDialog
          key={draft ? JSON.stringify(draft) : 'plain'}
          profile={p}
          projects={projects}
          draft={draft}
          onClose={() => { setModal(false); setDraft(null) }}
          onSaved={() => { fetchProfile(); fetchResumeStat() }}
        />
      )}

      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[110] px-4 py-2 rounded-lg text-sm shadow-lg"
          style={{ background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface)' }}>
          {toast}
        </div>
      )}
    </div>
  )
}

// ── 展示用小件 ────────────────────────────────────────────────

function Section({ title, icon: Icon, count, onEdit, action, className = '', children }: {
  title: string; icon: any; count?: number; onEdit?: () => void; action?: React.ReactNode
  className?: string; children: React.ReactNode
}) {
  return (
    <section className={`rounded-2xl border p-5 ${className}`}
      style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
      <div className="flex items-center justify-between mb-3.5">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4" style={{ color: 'var(--color-on-surface-variant)' }} />
          <h3 className="text-sm font-bold" style={{ color: 'var(--color-on-surface)' }}>{title}</h3>
          {typeof count === 'number' && count > 0 && (
            <span className="text-[10px] tabular-nums px-1.5 py-0.5 rounded-full"
              style={{ background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface-variant)' }}>{count}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {action}
          {onEdit && (
            <button onClick={onEdit} className="p-1.5 rounded-lg transition-colors" title={`编辑${title}`}
              style={{ color: 'var(--color-on-surface-variant)' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-surface-container)'; e.currentTarget.style.color = 'var(--color-primary)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-on-surface-variant)' }}>
              <Edit3 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
      {children}
    </section>
  )
}

function Ring({ percent }: { percent: number }) {
  const r = 26
  const c = 2 * Math.PI * r
  const color = percent >= 70 ? 'var(--accent-green)' : 'var(--accent-orange)'
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" aria-label={`资料完整度 ${percent}%`}>
      <circle cx="32" cy="32" r={r} fill="none" strokeWidth="6" stroke="var(--color-surface-container)" />
      <circle cx="32" cy="32" r={r} fill="none" strokeWidth="6" stroke={color} strokeLinecap="round"
        strokeDasharray={`${(percent / 100) * c} ${c}`} transform="rotate(-90 32 32)"
        style={{ transition: 'stroke-dasharray .6s' }} />
      <text x="32" y="37" textAnchor="middle" fontSize="14" fontWeight="700" fill="var(--color-on-surface)">{percent}%</text>
    </svg>
  )
}

function Field({ icon: Icon, label, value }: { icon: any; label: string; value?: string }) {
  const filled = hasVal(value)
  return (
    <div className="rounded-xl border px-3 py-2.5 transition-colors"
      style={{ borderColor: 'var(--color-outline-variant)', background: filled ? 'var(--color-surface)' : 'transparent' }}>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="h-3 w-3" style={{ color: 'var(--color-on-surface-variant)' }} />
        <span className="text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>{label}</span>
      </div>
      <p className="text-sm font-semibold truncate" title={filled ? value : undefined}
        style={{ color: filled ? 'var(--color-on-surface)' : 'var(--color-on-surface-variant)', fontStyle: filled ? 'normal' : 'italic' }}>
        {filled ? value : '未填写'}
      </p>
    </div>
  )
}

function Empty({ hint, onEdit }: { hint: string; onEdit: () => void }) {
  return (
    <p className="text-xs leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>
      {hint}，点击 <button onClick={onEdit} className="underline cursor-pointer" style={{ color: 'var(--color-primary)' }}>编辑资料</button> 补充
    </p>
  )
}
