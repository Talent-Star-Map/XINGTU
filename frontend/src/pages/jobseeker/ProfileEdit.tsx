import { useState, useEffect } from 'react'
import { Save, User, MapPin, GraduationCap, Briefcase, Target, Star, Building, Loader2, CheckCircle } from 'lucide-react'

export default function ProfileEdit() {
  const [form, setForm] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('xingtu_token')
    if (!token) return
    fetch(`/api/auth/profile?token=${token}`).then(r=>r.json()).then(d => {
      if (d.success) {
        const p = d.data; setForm({
          real_name: p.real_name||'', gender: p.gender||'女', age: p.age?.toString()||'',
          phone: p.phone||'', email: p.email||'', education: p.education||'本科',
          school: p.school||'', city: p.city||'', target_city: p.target_city||'',
          experience: p.experience||'', expected_salary: p.expected_salary||'',
          target_position: p.target_position||'', skills: p.skills||'', bio: p.bio||'',
        })
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const save = async () => {
    const token = localStorage.getItem('xingtu_token')
    if (!token) return
    setSaving(true); setSaved(false)
    const r = await fetch(`/api/auth/profile?token=${token}`, {method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)})
    const d = await r.json()
    if (d.success) setSaved(true)
    setSaving(false); setTimeout(()=>setSaved(false),3000)
  }

  const h = (k:string,v:string) => setForm((prev:any)=>({...prev,[k]:v}))
  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-6 w-6 animate-spin" style={{color:'var(--color-primary)'}} /></div>

  const fields = [
    {icon:User,label:'姓名',key:'real_name'},
    {icon:User,label:'性别',key:'gender',type:'select',opts:[{v:'女',l:'女'},{v:'男',l:'男'}]},
    {icon:User,label:'年龄',key:'age'},
    {icon:Building,label:'学历',key:'education',type:'select',opts:[{v:'本科',l:'本科'},{v:'大专',l:'大专'},{v:'硕士',l:'硕士'},{v:'博士',l:'博士'}]},
    {icon:GraduationCap,label:'学校',key:'school'},{icon:MapPin,label:'所在城市',key:'city'},
    {icon:Target,label:'目标城市',key:'target_city'},{icon:Briefcase,label:'工作经验',key:'experience'},
    {icon:Star,label:'期望薪资',key:'expected_salary'},{icon:Target,label:'目标岗位',key:'target_position'},
  ]

  return (
    <div className="max-w-4xl mx-auto space-y-6 px-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold" style={{color:'var(--color-on-surface)'}}>个人资料</h1>
        <button onClick={save} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white" style={{background:saved?'var(--accent-green)':'var(--color-primary)'}}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <CheckCircle className="h-4 w-4" /> : <Save className="h-4 w-4" />}{saved ? '已保存' : '保存'}
        </button>
      </div>
      <div className="rounded-2xl border p-6" style={{borderColor:'var(--color-outline-variant)',background:'var(--color-surface-container-lowest)'}}>
        <h2 className="text-base font-bold mb-4" style={{color:'var(--color-on-surface)'}}>基本信息</h2>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          {fields.map(f => (
            <div key={f.key}>
              <label className="flex items-center gap-1.5 text-xs font-medium mb-1.5" style={{color:'var(--color-on-surface-variant)'}}><f.icon className="h-3.5 w-3.5" />{f.label}</label>
              {f.type==='select' ? (
                <select value={form[f.key]||''} onChange={e=>h(f.key,e.target.value)} className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none" style={{borderColor:'var(--color-outline-variant)',background:'var(--color-surface)',color:'var(--color-on-surface)'}}>
                  {f.opts?.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
                </select>
              ) : (
                <input value={form[f.key]||''} onChange={e=>h(f.key,e.target.value)} className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none" style={{borderColor:'var(--color-outline-variant)',background:'var(--color-surface)',color:'var(--color-on-surface)'}} />
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-2xl border p-6" style={{borderColor:'var(--color-outline-variant)',background:'var(--color-surface-container-lowest)'}}>
        <h2 className="text-base font-bold mb-4" style={{color:'var(--color-on-surface)'}}>技能标签（逗号分隔）</h2>
        <textarea value={form.skills||''} onChange={e=>h('skills',e.target.value)} rows={3} placeholder="Java, Python, Spring Boot" className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none" style={{borderColor:'var(--color-outline-variant)',background:'var(--color-surface)',color:'var(--color-on-surface)'}} />
      </div>
    </div>
  )
}
