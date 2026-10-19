import { useEffect, useMemo, useRef, useState } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import { Maximize2, MousePointer2 } from 'lucide-react'

export interface SkillNode {
  id: string
  name: string
  value: number
  median_salary_k: number | null
  premium_pct: number | null
  field: string
  x?: number
  y?: number
}

export interface SkillLink {
  source: string | SkillNode
  target: string | SkillNode
  weight: number
  lift: number
}

export const FIELD_COLORS: Record<string, string> = {
  人工智能: '#8b5cf6',
  后端开发: '#6d5efc',
  前端开发: '#0ea5e9',
  数据开发: '#10b981',
  测试: '#f59e0b',
  '运维/安全': '#ef4444',
  产品: '#ec4899',
  设计: '#14b8a6',
  '硬件/芯片': '#f97316',
  其他: '#94a3b8',
}

export const fieldColor = (field: string) => FIELD_COLORS[field] || '#64748b'

interface Props {
  nodes: SkillNode[]
  links: SkillLink[]
  selected?: string
  onSelect: (name: string) => void
  theme: 'light' | 'dark'
  height?: number
}

export default function SkillNetwork({ nodes, links, selected, onSelect, theme, height = 440 }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const fgRef = useRef<any>(null)
  const [size, setSize] = useState({ w: 800, h: height })
  const [hover, setHover] = useState<SkillNode | null>(null)
  const [ready, setReady] = useState(false)

  const data = useMemo(() => ({
    nodes: nodes.map(n => ({ ...n })),
    links: links.map(l => ({ ...l })),
  }), [nodes, links])

  const labelThreshold = useMemo(() => {
    const values = nodes.map(n => n.value).sort((a, b) => b - a)
    return values[Math.min(14, values.length - 1)] ?? 0
  }, [nodes])

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: height }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [height])

  useEffect(() => {
    setReady(false)
    const fg = fgRef.current
    if (fg) {
      fg.d3Force?.('charge')?.strength?.(-165)
      fg.d3Force?.('link')?.distance?.(74)
    }
    const timer = setTimeout(() => {
      fgRef.current?.zoomToFit?.(500, 46)
      setReady(true)
    }, 700)
    return () => clearTimeout(timer)
  }, [data])

  const linkEndId = (end: string | SkillNode) => (typeof end === 'object' ? end.id : end)

  const nodeRadius = (node: SkillNode) => 3.5 + Math.sqrt(node.value || 1) * 0.62

  const drawNode = (node: SkillNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
    if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) return
    const r = nodeRadius(node)
    const active = node.id === selected || node.id === hover?.id
    const dim = selected && node.id !== selected && !data.links.some(l =>
      (linkEndId(l.source) === selected && linkEndId(l.target) === node.id) ||
      (linkEndId(l.target) === selected && linkEndId(l.source) === node.id),
    )
    ctx.beginPath()
    ctx.arc(node.x!, node.y!, r, 0, Math.PI * 2)
    ctx.fillStyle = fieldColor(node.field)
    ctx.globalAlpha = dim ? 0.16 : 0.92
    ctx.fill()
    ctx.globalAlpha = 1
    if (active) {
      ctx.lineWidth = 2 / globalScale
      ctx.strokeStyle = theme === 'dark' ? '#f8fafc' : '#0f172a'
      ctx.stroke()
    }
    if (node.value >= labelThreshold || active) {
      const fontSize = Math.max(8.5, 11 / globalScale)
      ctx.font = `600 ${fontSize}px Inter, system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.lineWidth = 3 / globalScale
      ctx.strokeStyle = theme === 'dark' ? 'rgba(18,21,31,0.9)' : 'rgba(250,251,255,0.94)'
      ctx.strokeText(node.name, node.x!, node.y! + r + 2)
      ctx.fillStyle = theme === 'dark' ? 'rgba(226,232,240,0.94)' : 'rgba(30,41,59,0.92)'
      ctx.fillText(node.name, node.x!, node.y! + r + 2)
    }
  }

  const linkColor = (link: any) => {
    const base = theme === 'dark' ? 'rgba(148,163,184,0.15)' : 'rgba(100,116,139,0.15)'
    if (!selected) return base
    const sid = linkEndId(link.source)
    const tid = linkEndId(link.target)
    return sid === selected || tid === selected ? 'rgba(109,94,252,0.55)' : base
  }

  const hoverNode = hover ? (
    <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-lg border px-3 py-2 text-[11px] shadow-lg backdrop-blur"
      style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
      <p className="font-bold" style={{ color: 'var(--color-on-surface)' }}>{hover.name}</p>
      <p className="mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>
        需求 {hover.value} 个岗位 · {hover.field}
      </p>
      <p style={{ color: 'var(--color-on-surface-variant)' }}>
        薪资中位 {hover.median_salary_k != null ? `${hover.median_salary_k}K` : '样本不足'}
        {hover.premium_pct != null && (
          <span style={{ color: hover.premium_pct >= 0 ? '#10b981' : '#ef4444' }}>
            {' '}· {hover.premium_pct >= 0 ? '+' : ''}{hover.premium_pct}%
          </span>
        )}
      </p>
    </div>
  ) : null

  return (
    <div ref={wrapRef} className="relative w-full overflow-hidden rounded-xl border"
      style={{
        height,
        borderColor: 'var(--color-outline-variant)',
        background: theme === 'dark'
          ? 'radial-gradient(circle at 50% 40%, rgba(109,94,252,0.12), transparent 62%), #12151f'
          : 'radial-gradient(circle at 50% 40%, rgba(109,94,252,0.07), transparent 62%), #fafbff',
      }}>
      {hoverNode}
      <div className="absolute right-2 top-2 z-10 flex items-center gap-1.5">
        <button onClick={() => fgRef.current?.zoomToFit?.(500, 46)}
          className="flex items-center gap-1 rounded-md border px-2 py-1 text-[10px]"
          style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)', color: 'var(--color-on-surface-variant)' }}>
          <Maximize2 className="h-3 w-3" /> 适配
        </button>
      </div>
      {!ready && (
        <div className="absolute inset-0 z-10 flex items-center justify-center text-[11px]"
          style={{ color: 'var(--color-on-surface-variant)' }}>
          正在计算技能共现布局…
        </div>
      )}
      <ForceGraph2D
        ref={fgRef}
        graphData={data}
        width={size.w}
        height={size.h}
        backgroundColor="transparent"
        cooldownTicks={140}
        warmupTicks={30}
        nodeRelSize={4}
        nodeLabel={() => ''}
        linkColor={linkColor}
        linkWidth={(link: any) => 0.35 + Math.min(2.3, (link.weight || 0) / 11)}
        nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, scale: number) => drawNode(node, ctx, scale)}
        nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
          if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) return
          ctx.fillStyle = color
          ctx.beginPath()
          ctx.arc(node.x, node.y, nodeRadius(node) + 4, 0, Math.PI * 2)
          ctx.fill()
        }}
        onNodeHover={(node: any) => setHover(node || null)}
        onNodeClick={(node: any) => onSelect(node.name)}
        onBackgroundClick={() => onSelect('')}
      />
      <div className="pointer-events-none absolute bottom-2 left-3 flex items-center gap-2 text-[10px]"
        style={{ color: 'var(--color-on-surface-variant)' }}>
        <MousePointer2 className="h-3 w-3" />
        节点大小 = 需求岗位数，颜色 = 主领域；连线 = 技能共现，点击节点查看岗位
      </div>
    </div>
  )
}
