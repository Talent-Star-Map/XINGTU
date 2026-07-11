import { motion } from 'framer-motion'

const cols = 40, rows = 20

export default function AnimatedGrid() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 opacity-[0.015]">
      <div className="grid h-full w-full" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {Array.from({ length: cols * rows }).map((_, i) => (
          <motion.div
            key={i}
            className="border-r border-b" style={{ borderColor: 'rgba(0,200,255,0.3)' }}
            animate={{ opacity: [0.3, 1, 0.3], backgroundColor: ['rgba(0,200,255,0)', 'rgba(0,200,255,0.03)', 'rgba(0,200,255,0)'] }}
            transition={{ duration: 3 + Math.random() * 4, repeat: Infinity, delay: Math.random() * 5, ease: 'easeInOut' }}
          />
        ))}
      </div>
    </div>
  )
}
