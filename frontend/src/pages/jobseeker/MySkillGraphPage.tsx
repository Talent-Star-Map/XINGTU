import { motion } from 'framer-motion'
import { Code, Database, Cloud, Terminal, BookOpen } from 'lucide-react'
import Graph3D from '../../components/Graph3D'

export default function MySkillGraphPage() {
  return (
    <div className="max-w-6xl mx-auto space-y-6 px-6 py-8">
      <div className="flex items-center gap-3 mb-2">
        <BookOpen className="h-5 w-5" style={{ color: 'var(--color-primary)' }} />
        <h1 className="text-xl font-bold" style={{ color: 'var(--color-on-surface)' }}>我的能力图谱</h1>
      </div>
      <p className="text-sm -mt-3 mb-4" style={{ color: 'var(--color-on-surface-variant)' }}>基于您的简历和技能数据生成的能力画像</p>
      <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)', height: 460 }}>
        <Graph3D />
      </div>
      <div className="grid grid-cols-2 gap-4">
        {[
          { name: '编程语言', icon: Code, skills: ['Java', 'TypeScript', 'SQL'], color: '#0052D9', level: 85 },
          { name: '框架与工具', icon: Terminal, skills: ['Spring Boot', 'MyBatis'], color: '#5B21B6', level: 78 },
          { name: '数据库', icon: Database, skills: ['MySQL', 'Redis'], color: '#059669', level: 72 },
          { name: '云原生', icon: Cloud, skills: ['Docker', 'K8s'], color: '#D97706', level: 55 },
        ].map(cat => (
          <div key={cat.name} className="rounded-2xl border p-5" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: `${cat.color}15` }}>
                <cat.icon className="h-5 w-5" style={{ color: cat.color }} />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold" style={{ color: 'var(--color-on-surface)' }}>{cat.name}</h3>
                <div className="mt-2 h-2 rounded-full" style={{ background: 'var(--color-surface-container)' }}>
                  <motion.div className="h-full rounded-full" initial={{ width: 0 }} whileInView={{ width: `${cat.level}%` }} viewport={{ once: true }} transition={{ duration: 1, ease: 'easeOut' }} style={{ background: `linear-gradient(90deg, ${cat.color}66, ${cat.color})` }} />
                </div>
                <span className="text-xs mt-1 block text-right font-semibold" style={{ color: cat.color }}>{cat.level}%</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">{cat.skills.map(s => <span key={s} className="px-2.5 py-1 rounded-md text-xs font-medium" style={{ background: `${cat.color}10`, color: cat.color }}>{s}</span>)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
