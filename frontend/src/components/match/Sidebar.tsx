import { Sparkles, Target } from 'lucide-react'

interface Props {
  mode: 'recommend' | 'diagnose'
  onModeChange: (mode: 'recommend' | 'diagnose') => void
}

const items: { key: 'recommend' | 'diagnose'; icon: any; label: string; desc: string }[] = [
  { key: 'recommend', icon: Sparkles, label: '智能推荐', desc: '匹配最佳岗位' },
  { key: 'diagnose', icon: Target, label: '岗位诊断', desc: '分析能力差距' },
]

export default function Sidebar({ mode, onModeChange }: Props) {
  return (
    <div className="w-36 shrink-0 hidden md:block">
      <div className="rounded-2xl border p-2 space-y-1 sticky top-24" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
        {items.map(item => {
          const active = mode === item.key
          const Icon = item.icon
          return (
            <button key={item.key} onClick={() => onModeChange(item.key)}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all"
              style={{
                background: active ? 'var(--color-primary-fixed)' : 'transparent',
                color: active ? 'var(--color-primary)' : 'var(--color-on-surface-variant)',
                borderLeft: active ? '3px solid var(--color-primary)' : '3px solid transparent',
              }}>
              <Icon className="h-5 w-5 shrink-0" />
              <div>
                <p className="text-sm font-semibold">{item.label}</p>
                <p className="text-[10px] mt-0.5" style={{ color: active ? 'var(--color-primary)' : 'var(--color-outline)' }}>{item.desc}</p>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
