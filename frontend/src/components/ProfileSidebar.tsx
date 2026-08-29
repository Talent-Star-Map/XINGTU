import { User, Upload, Activity } from 'lucide-react'
import { JSNav, type JSPage } from '../lib/NavContext'

const items: { icon: any; label: string; page: JSPage }[] = [
  { icon: User, label: '个人主页', page: 'profile-home' },
  { icon: Upload, label: '简历管理', page: 'resume' },
  { icon: Activity, label: '我的能力图谱', page: 'my-skill-graph' },
]

export default function ProfileSidebar() {
  const { page, setPage } = JSNav.use()
  return (
    <div className="w-56 shrink-0 hidden md:block">
      <div className="rounded-2xl border p-3 space-y-1 sticky top-24" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
        {items.map(item => {
          const active = page === item.page
          return (
            <button key={item.page} onClick={() => setPage(item.page)}
              className="flex items-center gap-3 px-4 py-3 rounded-xl transition-colors w-full text-left"
              style={{ background: active ? 'var(--color-primary-fixed)' : 'transparent', color: active ? 'var(--color-primary)' : 'var(--color-on-surface-variant)' }}>
              <item.icon className="h-5 w-5" />
              <span className="text-sm font-semibold">{item.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
