import { useEffect, useState, useRef } from 'react'

interface Props {
  value: number
  suffix?: string
  duration?: number
  decimals?: number
}

export default function StatsCounter({ value, suffix = '', duration = 2, decimals = 0 }: Props) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); observer.disconnect() } },
      { threshold: 0.3 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!inView) return
    let start = 0
    const inc = value / (duration * 60)
    const timer = setInterval(() => {
      start += inc
      if (start >= value) { setCount(value); clearInterval(timer) }
      else setCount(start)
    }, 1000 / 60)
    return () => clearInterval(timer)
  }, [inView, value, duration])

  return <span ref={ref} className="tabular-nums">{count.toFixed(decimals)}{suffix}</span>
}
