/**
 * MarketGraph2D — 企业端岗位图谱二维力导向图
 *
 * 读法(与页面顶部常驻图例一致):
 *   紫圆 = 本公司在招岗位;青圆 = 岗位要求技能,圆越大市场越热
 *   技能外环:绿 = 近半年需求上升,红 = 下降
 *
 * 交互:
 *   hover  — 显示市场数据 tooltip
 *   点击   — 进入 focus+context:聚焦节点及其邻居高亮,其余淡化但保留位置(不做布局跳动)
 *   空白   — 退出聚焦
 *   工具栏 — 通过 ref 暴露 fit() / focusNode()
 */
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import { forceCollide } from 'd3-force'

export interface MarketNode {
  id: string
  type: 'OwnJob' | 'Skill'
  label: string
  salary_min_k?: number | null
  salary_max_k?: number | null
  market_p25_k?: number | null
  market_p50_k?: number | null
  market_p75_k?: number | null
  bench_count?: number
  candidate_count?: number
  market_percentile?: number | null
  shortage_skills?: number
  skills?: string[]
  demand?: number
  supply?: number
  hot_score?: number | null
  market_avg_salary_k?: number | null
  added?: number
  removed?: number
  net?: number
  x?: number
  y?: number
}

export interface MarketLink {
  source: string | MarketNode
  target: string | MarketNode
  type: string
}

export interface MarketGraphData {
  nodes: MarketNode[]
  links: MarketLink[]
}

export interface MarketGraphHandle {
  fit: () => void
  focusNode: (id: string) => void
}

interface Props {
  data: MarketGraphData
  selectedId?: string
  onSelect: (id?: string) => void
}

const cssVar = (name: string, fallback: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback

const withAlpha = (hex: string, alpha: number) => {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return hex
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

const linkEndId = (end: string | MarketNode) => (typeof end === 'object' ? end.id : end)

// 每个节点固定的漂浮相位,避免同步摆动
const phaseOf = (id: string) => {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 997
  return (h / 997) * Math.PI * 2
}

const MarketGraph2D = forwardRef<MarketGraphHandle, Props>(function MarketGraph2D(
  { data, selectedId, onSelect },
  ref,
) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const fgRef = useRef<any>(null)
  const fittedRef = useRef(false)
  const ambientRef = useRef(false)
  const [size, setSize] = useState({ w: 800, h: 480 })
  const [hoverNode, setHoverNode] = useState<MarketNode | null>(null)
  const [mouse, setMouse] = useState({ x: 0, y: 0 })

  const fit = (): boolean => {
    const fg = fgRef.current
    if (!fg) return false
    const ready = data.nodes.some((n) => Number.isFinite(n.x) && Number.isFinite(n.y))
    if (!ready) return false
    fg.zoomToFit?.(500, 36)
    return true
  }

  useImperativeHandle(ref, () => ({
    fit: () => { fit() },
    focusNode: (id: string) => {
      const n = data.nodes.find((x) => x.id === id)
      // 位置未就绪时 centerAt(NaN) 会把相机矩阵弄坏,导致整张图消失
      if (n && Number.isFinite(n.x) && Number.isFinite(n.y)) {
        fgRef.current?.centerAt?.(n.x as number, n.y as number, 600)
        fgRef.current?.zoom?.(1.8, 600)
      }
    },
  }), [data])

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const colors = useMemo(() => ({
    job: cssVar('--ent-job', '#5b4bd6'),
    skill: cssVar('--ent-skill', '#0e7490'),
    up: cssVar('--accent-green', '#047857'),
    down: cssVar('--accent-red', '#be123c'),
    label: cssVar('--color-on-surface', '#171a26'),
    link: cssVar('--color-outline', '#7b8194'),
    halo: cssVar('--color-background', '#f6f7fb'),
  }), [])

  const maxHeat = useMemo(() => {
    const vals = data.nodes.filter((n) => n.type === 'Skill')
      .map((n) => (n.hot_score != null ? n.hot_score : (n.demand || 0)))
    return Math.max(1, ...vals)
  }, [data])

  // focus+context:保留全部节点与布局,只做视觉高亮/淡化
  const focusSet = useMemo(() => {
    if (!selectedId) return null
    const set = new Set<string>([selectedId])
    data.links.forEach((l) => {
      const s = linkEndId(l.source)
      const t = linkEndId(l.target)
      if (s === selectedId) set.add(t)
      if (t === selectedId) set.add(s)
    })
    return set
  }, [data, selectedId])

  useEffect(() => {
    const fg = fgRef.current
    if (!fg) return
    // 更紧的簇:弱斥力 + 短链 + 碰撞半径,避免散成一大片
    fg.d3Force('charge')?.strength(-85)
    fg.d3Force('link')?.distance(40)
    fg.d3Force('collide', forceCollide((n: any) => nodeRadius(n as MarketNode) + 7).iterations(2) as any)
    // 保持引擎恒温,让漂浮有连续帧可画(reduced-motion 时保持静态)
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ambientRef.current = !reduce
    if (!reduce) {
      fg.d3AlphaMin?.(0)
      fg.cooldownTicks?.(Infinity)
    }
    fg.d3ReheatSimulation?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  // 布局稳定后自适应视野;位置未就绪时重试,避免相机停在坏状态
  useEffect(() => {
    fittedRef.current = false
    const tryFit = () => {
      if (!fittedRef.current && fit()) fittedRef.current = true
    }
    const t1 = setTimeout(tryFit, 900)
    const t2 = setTimeout(tryFit, 2200)
    return () => { clearTimeout(t1); clearTimeout(t2) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  const nodeRadius = (n: MarketNode) => {
    if (n.type === 'OwnJob') return 11
    const heat = Math.min(1, Math.sqrt(Math.max(0, (n.hot_score != null ? n.hot_score : (n.demand || 0)) / maxHeat)))
    return 4 + 8.5 * heat
  }

  // 漂浮只在绘制层生效(不改布局与命中区),幅度 2px 左右
  const floatOffset = (id: string) => {
    if (!ambientRef.current) return { x: 0, y: 0 }
    const now = performance.now()
    const ph = phaseOf(id)
    return {
      x: Math.sin(now / 1600 + ph) * 2.2,
      y: Math.cos(now / 2100 + ph * 1.3) * 1.8,
    }
  }

  const paintNode = (node: any, ctx: CanvasRenderingContext2D, scale: number) => {
    const n = node as MarketNode
    const r = nodeRadius(n)
    const off = floatOffset(n.id)
    const nx = node.x + off.x
    const ny = node.y + off.y
    const isJob = n.type === 'OwnJob'
    const isSelected = selectedId === n.id
    const dimmed = focusSet ? !focusSet.has(n.id) : false
    ctx.globalAlpha = dimmed ? 0.16 : 1
    ctx.beginPath()
    ctx.arc(nx, ny, r, 0, 2 * Math.PI)
    if (isJob) {
      ctx.fillStyle = colors.job
      ctx.fill()
      ctx.lineWidth = 1.5 / scale
      ctx.strokeStyle = colors.halo
      ctx.stroke()
    } else {
      ctx.fillStyle = withAlpha(colors.skill, 0.9)
      ctx.fill()
      ctx.lineWidth = 1 / scale
      ctx.strokeStyle = colors.skill
      ctx.stroke()
      const net = n.net || 0
      if (net !== 0) {
        ctx.beginPath()
        ctx.arc(nx, ny, r + 2.5 / scale, 0, 2 * Math.PI)
        ctx.lineWidth = 1.6 / scale
        ctx.strokeStyle = net > 0 ? colors.up : colors.down
        ctx.stroke()
      }
    }
    if (isSelected) {
      ctx.beginPath()
      ctx.arc(nx, ny, r + 4.5 / scale, 0, 2 * Math.PI)
      ctx.lineWidth = 1.2 / scale
      ctx.setLineDash([3 / scale, 2 / scale])
      ctx.strokeStyle = colors.label
      ctx.stroke()
      ctx.setLineDash([])
    }
    // 标签分级:岗位恒显;聚焦时只标聚焦集合;其余技能仅在 hover/放大时标注
    const showLabel = !dimmed && (
      isJob || focusSet !== null || hoverNode?.id === n.id || scale > 1.5
    )
    if (showLabel) {
      let label = n.label
      if (isJob && label.length > 14) label = `${label.slice(0, 13)}…`
      const fs = Math.max((isJob ? 12.5 : 11) / scale, 3)
      ctx.font = `${isJob ? '600 ' : ''}${fs}px system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.lineWidth = 3 / scale
      ctx.strokeStyle = colors.halo
      ctx.strokeText(label, nx, ny + r + 3 / scale)
      ctx.fillStyle = colors.label
      ctx.fillText(label, nx, ny + r + 3 / scale)
    }
    ctx.globalAlpha = 1
  }

  const tooltip = hoverNode && (
    <div
      className="absolute z-10 pointer-events-none rounded-lg px-3 py-2 text-xs max-w-[240px] ent-panel"
      style={{
        left: Math.min(mouse.x + 14, size.w - 250),
        top: Math.min(mouse.y + 14, size.h - 130),
        color: 'var(--color-on-surface)',
      }}
    >
      <div className="font-semibold mb-1">{hoverNode.label}</div>
      {hoverNode.type === 'OwnJob' ? (
        <div className="space-y-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>
          <div>薪资:{hoverNode.salary_min_k && hoverNode.salary_max_k ? `${hoverNode.salary_min_k}K-${hoverNode.salary_max_k}K` : '面议'}</div>
          <div>对标中位:{hoverNode.market_p50_k != null ? `${hoverNode.market_p50_k}K` : '无样本'}</div>
          <div>对标市场分位:{hoverNode.market_percentile != null ? `${hoverNode.market_percentile}%` : '无市场样本'}</div>
          <div>候选命中:{hoverNode.candidate_count ?? 0} 人</div>
        </div>
      ) : (
        <div className="space-y-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>
          <div>市场需求:{hoverNode.demand ?? 0} 个在招岗位</div>
          <div>人才池供给:{hoverNode.supply ?? 0} 人</div>
          <div>市场均价:{hoverNode.market_avg_salary_k != null ? `${hoverNode.market_avg_salary_k}K` : '无样本'}</div>
          {(hoverNode.net || 0) !== 0 && (
            <div style={{ color: (hoverNode.net || 0) > 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
              近半年:{(hoverNode.net || 0) > 0 ? '+' : ''}{hoverNode.net} 次需求变化
            </div>
          )}
        </div>
      )}
    </div>
  )

  return (
    <div
      ref={wrapRef}
      className="relative w-full h-full overflow-hidden"
      onMouseMove={(e) => {
        const rect = wrapRef.current?.getBoundingClientRect()
        if (rect) setMouse({ x: e.clientX - rect.left, y: e.clientY - rect.top })
      }}
    >
      <ForceGraph2D
        ref={fgRef}
        width={size.w}
        height={size.h}
        graphData={data as any}
        nodeId="id"
        nodeCanvasObject={paintNode}
        nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
          ctx.fillStyle = color
          ctx.beginPath()
          ctx.arc(node.x, node.y, nodeRadius(node as MarketNode) + 3, 0, 2 * Math.PI)
          ctx.fill()
        }}
        onNodeHover={(n: any) => setHoverNode((n as MarketNode) || null)}
        onNodeClick={(n: any) => onSelect((n as MarketNode).id)}
        onBackgroundClick={() => onSelect(undefined)}
        onEngineStop={() => {
          if (!fittedRef.current && fit()) fittedRef.current = true
        }}
        linkCanvasObject={(link: any, ctx: CanvasRenderingContext2D) => {
          const s = link.source
          const t = link.target
          if (!s || !t || s.x == null || t.x == null) return
          const so = floatOffset(s.id)
          const to = floatOffset(t.id)
          const inFocus = !focusSet || (focusSet.has(s.id) && focusSet.has(t.id))
          ctx.strokeStyle = withAlpha(colors.link, inFocus ? 0.45 : 0.08)
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.moveTo(s.x + so.x, s.y + so.y)
          ctx.lineTo(t.x + to.x, t.y + to.y)
          ctx.stroke()
        }}
        cooldownTime={1800}
        d3AlphaDecay={0.02}
      />
      {tooltip}
    </div>
  )
})

export default MarketGraph2D
