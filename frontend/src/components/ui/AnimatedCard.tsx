import { motion } from 'framer-motion'
import { useRef } from 'react'

interface Props {
  children: React.ReactNode
  className?: string
  glowColor?: string
  style?: React.CSSProperties
  hoverScale?: boolean
}

export default function AnimatedCard({ children, className = '', glowColor = 'rgba(0, 200, 255, 0.15)', style, hoverScale = true }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    ref.current.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`)
    ref.current.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`)
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      whileHover={hoverScale ? { scale: 1.01, transition: { duration: 0.2 } } : undefined}
      className={`relative overflow-hidden rounded-xl border transition-colors ${className}`}
      style={{
        borderColor: 'var(--color-outline-variant)',
        background: 'var(--color-surface-container-lowest)',
        ...style,
      }}
    >
      <div
        className="pointer-events-none absolute -inset-px opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `radial-gradient(250px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), ${glowColor}, transparent 60%)`,
        }}
      />
      {children}
    </motion.div>
  )
}
