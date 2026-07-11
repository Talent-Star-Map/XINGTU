import { useState, useEffect } from 'react'
import { User, MapPin, GraduationCap, Briefcase, Target, Star, Loader2, ChevronRight, FileText, Network } from 'lucide-react'

function df(val: string | null | undefined, fb = '未完善'): string { return val?.trim() || fb }
function fmtGender(g?: string): string { return g || '未完善' }
function fmtAge(a?: string): string { return a ? `${a} 岁` : '未完善' }
function fmtSalary(s?: string): string { return s || '未完善' }

export default function ProfileHome() {
  const [p, setP] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const userStr = localStorage.getItem('xingtu_user')
  const userData = userStr ? JSON.parse(userStr) : null

  useEffect(() => {
    const token = localStorage.getItem('xingtu_token')
    if (!token) return
    fetch(`/api/auth/profile?token=${token}`).then(r=>r.json()).then(d => {
      if (d.success) setP(d.data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-6 w-6 animate-spin" style={{color:'var(--color-primary)'}} /></div>
  if (!p) return <div className="text-center py-12" style={{color:'var(--color-on-surface-variant)'}}>请先登录</div>

  const name = p.real_name?.trim() || userData?.username || p.username || '未登录用户'
  const contact = p.email?.trim() || p.phone?.trim() || '暂无联系方式'

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex gap-8">
        <div className="w-56 shrink-0 hidden md:block">
          <div className="rounded-2xl border p-3 space-y-1 sticky top-24" style={{borderColor:'var(--color-outline-variant)',background:'var(--color-surface-container-lowest)'}}>
            {[
              { icon: User, label: '个人主页', active: true },
              { icon: FileText, label: '个人资料', active: false },
              { icon: Briefcase, label: '简历管理', active: false },
              { icon: Network, label: '我的图谱', active: false },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-3 px-4 py-3 rounded-xl transition-colors cursor-pointer"
                style={{background:item.active?'var(--color-primary-fixed)':'transparent',color:item.active?'var(--color-primary)':'var(--color-on-surface-variant)'}}>
                <item.icon className="h-5 w-5" /><span className="text-sm font-semibold">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex-1 space-y-6">
          <section className="rounded-2xl border p-8" style={{borderColor:'var(--color-outline-variant)',background:'var(--color-surface-container-lowest)'}}>
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-24 h-24 rounded-full overflow-hidden border-4 shadow-sm mx-auto flex items-center justify-center" style={{borderColor:'var(--color-surface)',background:'var(--color-surface-variant)'}}>
                <User className="h-10 w-10" style={{color:'var(--color-on-surface-variant)'}} />
              </div>
              <div><h2 className="text-2xl font-black" style={{color:'var(--color-on-surface)'}}>{name}</h2><p className="text-sm mt-1" style={{color:'var(--color-on-surface-variant)'}}>{contact}</p></div>
            </div>
            <div className="mt-8 flex items-center justify-center gap-12 border-t pt-6" style={{borderColor:'var(--color-outline-variant)'}}>
              <div className="text-center"><p className="text-xl font-bold" style={{color:'var(--color-on-surface)'}}>{p.skills?p.skills.split(',').length:0}</p><p className="text-[10px] font-bold uppercase tracking-wider" style={{color:'var(--color-on-surface-variant)'}}>技能数</p></div>
              <div className="text-center"><p className="text-xl font-bold" style={{color:'var(--color-on-surface)'}}>{df(p.target_position)}</p><p className="text-[10px] font-bold uppercase tracking-wider" style={{color:'var(--color-on-surface-variant)'}}>目标岗位</p></div>
            </div>
          </section>
          <section className="rounded-2xl border p-8" style={{borderColor:'var(--color-outline-variant)',background:'var(--color-surface-container-lowest)'}}>
            <h3 className="text-lg font-black" style={{color:'var(--color-on-surface)'}}>个人档案</h3>
            <div className="mt-5 overflow-hidden rounded-xl border" style={{borderColor:'var(--color-outline-variant)'}}>
              <ProfileRow label="性别 / 年龄 / 电话" values={[fmtGender(p.gender), fmtAge(p.age), df(p.phone)]} />
              <ProfileRow label="学历 / 学校 / 所在城市" values={[df(p.education), df(p.school), df(p.city)]} />
              <ProfileRow label="目标城市 / 期望薪资" values={[df(p.target_city), fmtSalary(p.expected_salary)]} />
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function ProfileRow({ label, values }: { label: string; values: string[] }) {
  return (
    <div className="flex items-center justify-between px-6 py-4 border-b last:border-0" style={{borderColor:'var(--color-outline-variant)'}}>
      <span className="text-sm font-medium" style={{color:'var(--color-on-surface-variant)'}}>{label}</span>
      <div className="flex items-center gap-2">
        {values.map((v, i) => (
          <span key={i} className="flex items-center gap-1">
            <span className="text-sm font-semibold" style={{color:'var(--color-on-surface)'}}>{v}</span>
            {i < values.length - 1 && <span className="w-1 h-1 rounded-full" style={{background:'var(--color-outline-variant)'}} />}
          </span>
        ))}
      </div>
    </div>
  )
}
