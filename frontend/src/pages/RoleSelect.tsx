import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Star, Briefcase, Building2, ArrowRight, Sun, Moon, Shield } from 'lucide-react'
import StarBorder from '../components/ui/StarBorder'
import Aurora from '../components/ui/Aurora'
import Magnet from '../components/ui/Magnet'
import { useTheme } from '../components/ThemeProvider'

export default function RoleSelect() {
  const navigate = useNavigate()
  const { theme, toggle } = useTheme()

  return (
    <div className="flex h-full w-full items-center justify-center overflow-hidden relative">
      <Aurora />
      <button onClick={toggle} className="absolute top-5 right-5 z-20 p-2.5 rounded-xl backdrop-blur-md border transition-all"
        style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container)', color: 'var(--color-on-surface-variant)' }}>
        {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </button>
      <div className="relative z-10 w-full max-w-lg px-4">
        <motion.div className="text-center mb-10" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <motion.div className="inline-flex h-20 w-20 items-center justify-center rounded-2xl mb-4 mx-auto" style={{ background: 'linear-gradient(135deg, var(--accent-cyan-dim), var(--accent-purple-dim))', border: '1px solid var(--color-primary)' }}
            animate={{ scale: [1, 1.05, 1], rotate: [0, 5, -5, 0] }} transition={{ duration: 6, repeat: Infinity }}>
            <Star className="h-10 w-10" style={{ color: 'var(--color-primary)' }} />
          </motion.div>
          <h1 className="text-3xl font-bold gradient-text">星图</h1>
          <motion.p className="text-sm mt-2" style={{ color: 'var(--color-on-surface-variant)' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
            岗位能力图谱动态演化与分析系统
          </motion.p>
        </motion.div>

        <div className="space-y-5">
          <StarBorder as="div" color="rgba(0,200,255,0.4)" speed="6s">
            <Magnet padding={8}>
              <div onClick={() => navigate('/login/jobseeker')} className="relative overflow-hidden rounded-xl p-6 cursor-pointer group" style={{ background: 'var(--color-surface-container-lowest)' }}>
                <motion.div className="absolute -top-10 -right-10 w-32 h-32 rounded-full opacity-[0.04]" style={{ background: 'radial-gradient(circle, #00C8FF, transparent 70%)' }} animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 4, repeat: Infinity }} />
                <div className="flex items-center gap-5 relative z-10">
                  <motion.div className="flex h-14 w-14 items-center justify-center rounded-xl shrink-0" style={{ background: 'var(--accent-cyan-dim)' }} whileHover={{ rotate: 10 }}>
                    <Briefcase className="h-7 w-7" style={{ color: 'var(--color-primary)' }} />
                  </motion.div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold" style={{ color: 'var(--color-on-surface)' }}>求职者入口</h3>
                    <p className="text-sm mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>浏览岗位、上传简历、人岗匹配、技能图谱、趋势洞察</p>
                  </div>
                  <motion.div className="shrink-0" whileHover={{ x: 5 }}>
                    <ArrowRight className="h-5 w-5" style={{ color: 'var(--color-primary)' }} />
                  </motion.div>
                </div>
              </div>
            </Magnet>
          </StarBorder>

          <StarBorder as="div" color="rgba(124,58,237,0.4)" speed="6s">
            <Magnet padding={8}>
              <div onClick={() => navigate('/login/enterprise')} className="relative overflow-hidden rounded-xl p-6 cursor-pointer group" style={{ background: 'var(--color-surface-container-lowest)' }}>
                <motion.div className="absolute -bottom-10 -left-10 w-32 h-32 rounded-full opacity-[0.04]" style={{ background: 'radial-gradient(circle, #7C3AED, transparent 70%)' }} animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 5, repeat: Infinity }} />
                <div className="flex items-center gap-5 relative z-10">
                  <motion.div className="flex h-14 w-14 items-center justify-center rounded-xl shrink-0" style={{ background: 'var(--accent-purple-dim)' }} whileHover={{ rotate: -10 }}>
                    <Building2 className="h-7 w-7" style={{ color: 'var(--accent-purple)' }} />
                  </motion.div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold" style={{ color: 'var(--color-on-surface)' }}>企业入口</h3>
                    <p className="text-sm mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>岗位管理、人才搜索、市场洞察、行业报告</p>
                  </div>
                  <motion.div className="shrink-0" whileHover={{ x: 5 }}>
                    <ArrowRight className="h-5 w-5" style={{ color: 'var(--accent-purple)' }} />
                  </motion.div>
                </div>
              </div>
            </Magnet>
          </StarBorder>
        </div>
        {/* 管理员入口 — 低调放在底部，质检功能归管理员监管 */}
        <motion.div className="text-center mt-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
          <button onClick={() => navigate('/login/admin')}
            className="inline-flex items-center gap-2 text-xs px-4 py-2 rounded-lg transition-all"
            style={{ color: 'var(--color-on-surface-variant)', border: '1px solid var(--color-outline-variant)' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent-green)'; e.currentTarget.style.borderColor = 'var(--accent-green)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--color-on-surface-variant)'; e.currentTarget.style.borderColor = 'var(--color-outline-variant)' }}>
            <Shield className="h-3.5 w-3.5" /> 管理员入口
          </button>
        </motion.div>
        <div className="h-8" />
      </div>
    </div>
  )
}
