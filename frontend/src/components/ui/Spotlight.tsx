import { motion } from 'framer-motion'

interface Props {
  children: React.ReactNode
  className?: string
  color?: string
}

export default function Spotlight({ children, className = '', color = 'rgba(0,200,255,0.08)' }: Props) {
  return (
    <div className={`relative group ${className}`}>
      <motion.div
        className="pointer-events-none absolute -inset-[1px] rounded-xl opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{
          background: `radial-gradient(400px circle at center, ${color}, transparent 60%)`,
        }}
        animate={{ scale: [1, 1.02, 1] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      />
      {children}
    </div>
  )
}
