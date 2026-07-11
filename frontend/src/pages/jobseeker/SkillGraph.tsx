import { useState } from 'react'
import Graph3D from '../../components/Graph3D'

const cats = ['全部', 'AI', '后端', '数据', '运维']

export default function SkillGraph() {
  const [active, setActive] = useState('全部')

  return (
    <div className="flex gap-4 px-6 py-8 max-w-[1440px] mx-auto" style={{ height: 'calc(100vh - 64px)' }}>
      <div className="flex-1 rounded-2xl border relative overflow-hidden" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
        <Graph3D />
        <div className="absolute top-4 left-4 flex gap-2">
          {cats.map(c => (
            <button key={c} onClick={() => setActive(c)} className="px-3 py-1.5 rounded-lg text-xs font-semibold backdrop-blur-md"
              style={{ background: active === c ? 'var(--color-primary)' : 'rgba(0,0,0,0.35)', color: active === c ? '#fff' : 'rgba(255,255,255,0.7)' }}>{c}</button>
          ))}
        </div>
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 text-xs px-5 py-2 rounded-full backdrop-blur-md" style={{ background: 'rgba(0,0,0,0.45)', color: 'rgba(255,255,255,0.6)' }}>
          🖱 拖动旋转 · 滚轮缩放 · 右键平移 · 点击聚焦
        </div>
      </div>
      <div className="w-48 shrink-0 space-y-4">
        <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
          <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--color-on-surface)' }}>图例</h3>
          <div className="space-y-2.5 text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
            {[{c:'#00C8FF',l:'AI类'},{c:'#7C3AED',l:'后端类'},{c:'#00E599',l:'数据类'},{c:'#FF8C42',l:'运维类'}].map(i => (
              <div key={i.l} className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm" style={{background:i.c}} /><span>{i.l}</span></div>
            ))}
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{background:'#38BDF8'}} /><span>技能节点</span></div>
          </div>
        </div>
        <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
          <h3 className="text-sm font-bold mb-2" style={{ color: 'var(--color-on-surface)' }}>统计</h3>
          <div className="space-y-1.5 text-xs" style={{ color: 'var(--color-on-surface-variant)' }}><p>岗位节点: 6</p><p>技能节点: 14</p><p>关联关系: 24</p></div>
        </div>
      </div>
    </div>
  )
}
