import { motion } from 'framer-motion'

const shapes = [
  { size: 300, color: 'rgba(0, 200, 255, 0.03)', x: '10%', y: '20%', duration: 8, delay: 0 },
  { size: 200, color: 'rgba(124, 58, 237, 0.03)', x: '70%', y: '10%', duration: 10, delay: 1 },
  { size: 250, color: 'rgba(0, 229, 153, 0.03)', x: '80%', y: '60%', duration: 7, delay: 2 },
  { size: 180, color: 'rgba(255, 140, 66, 0.03)', x: '20%', y: '70%', duration: 9, delay: 0.5 },
  { size: 350, color: 'rgba(0, 200, 255, 0.02)', x: '50%', y: '40%', duration: 12, delay: 1.5 },
]

export default function FloatingShapes() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {shapes.map((shape, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: shape.size, height: shape.size,
            background: `radial-gradient(circle, ${shape.color}, transparent 70%)`,
            left: shape.x, top: shape.y,
          }}
          animate={{ x: [0, 30, -20, 15, 0], y: [0, -25, 15, -10, 0], scale: [1, 1.05, 0.95, 1.02, 1] }}
          transition={{ duration: shape.duration, repeat: Infinity, ease: 'easeInOut', delay: shape.delay }}
        />
      ))}
    </div>
  )
}
