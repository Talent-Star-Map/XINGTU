type Point = { x: number; y: number }
type Projection = Point & { s: number; depth: number; gr: number; gid: string }
const clamp = (n: number) => Math.max(0, Math.min(1, n))
const smooth = (n: number) => { const v = clamp(n); return v * v * (3 - 2 * v) }
const mix = (a: number, b: number, t: number) => a + (b - a) * t

// The route changes inside one canvas lifetime; only the central constellation morphs.
export function createAuthStarWeave(viewport: HTMLDivElement, ctx: CanvasRenderingContext2D) {
  let amount = viewport.dataset.authRoute === 'login' ? 1 : 0
  let from = amount, target = amount, started = 0
  let points: Point[] = []
  let center: Point = { x: 0, y: 0 }
  let outer: DOMRect | null = null
  let emblem: DOMRect | null = null
  let fields: DOMRect[] = []
  const bounds = () => viewport.getBoundingClientRect()
  function relative(rect: DOMRect, b: DOMRect) {
    return new DOMRect(rect.x - b.x, rect.y - b.y, rect.width, rect.height)
  }
  function perimeter(rect: DOMRect, count: number, inset = 0): Point[] {
    const x = rect.x - inset, y = rect.y - inset
    const w = rect.width + inset * 2, h = rect.height + inset * 2
    const r = Math.min(26, h * .25, w * .15)
    const horizontal = w - r * 2, vertical = h - r * 2, arc = Math.PI * r / 2
    const lengths = [horizontal, arc, vertical, arc, horizontal, arc, vertical, arc]
    const length = lengths.reduce((a, b) => a + b, 0)
    return Array.from({ length: count }, (_, i) => {
      let d = (i + .35) / count * length, segment = 0
      while (segment < 7 && d > lengths[segment]) d -= lengths[segment++]
      if (segment === 0) return { x: x + r + d, y }
      if (segment === 2) return { x: x + w, y: y + r + d }
      if (segment === 4) return { x: x + w - r - d, y: y + h }
      if (segment === 6) return { x, y: y + h - r - d }
      const corner = (segment - 1) / 2
      const angle = -Math.PI / 2 + corner * Math.PI / 2 + d / r
      const cx = corner < 2 ? x + w - r : x + r
      const cy = corner === 0 || corner === 3 ? y + r : y + h - r
      return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r }
    })
  }
  function geometry() {
    const panel = viewport.querySelector<HTMLElement>('[data-auth-panel]')
    if (!panel) return
    const b = bounds()
    const rect = relative(panel.getBoundingClientRect(), b)
    outer = rect
    const mark = panel.querySelector<HTMLElement>('[data-auth-emblem]')
    emblem = mark ? relative(mark.getBoundingClientRect(), b) : null
    fields = Array.from(panel.querySelectorAll<HTMLElement>('[data-auth-field]')).map(e => relative(e.getBoundingClientRect(), b))
    center = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
    points = perimeter(rect, 16, 6)
    fields.forEach(r => points.push({ x: r.x - 3, y: r.y + r.height / 2 }, { x: r.right + 3, y: r.y + r.height / 2 }))
  }
  function update(time: number, reduced: boolean) {
    const next = viewport.dataset.authRoute === 'login' ? 1 : 0
    if (next !== target) { from = amount; target = next; started = time }
    amount = reduced ? target : mix(from, target, smooth((time - started) / 1400))
    if (amount > 0 || target) geometry()
    const reveal = smooth((amount - .63) / .30)
    viewport.style.setProperty('--auth-reveal', String(reveal))
    viewport.dataset.authReady = String(target === 1 && reveal > .995)
    const overlay = viewport.querySelector<HTMLElement>('.auth-overlay')
    if (overlay) overlay.inert = target !== 1 || reveal < .995
    if (target === 0 && amount < .001) {
      outer = null; points = []
    }
    return amount
  }
  function morph<T extends Projection>(p: T, index: number, core: boolean): T {
    if (!amount || !points.length) return p
    const contract = smooth(amount / .34)
    const expand = smooth((amount - .34) / .66)
    const destination = core && emblem
      ? { x: emblem.x + emblem.width / 2, y: emblem.y + emblem.height / 2 }
      : points[index % points.length]
    return { ...p,
      x: mix(mix(p.x, center.x, contract), destination.x, expand),
      y: mix(mix(p.y, center.y, contract), destination.y, expand),
    }
  }
  function draw(time: number, light: boolean, reduced: boolean) {
    if (!outer || amount <= .36) return
    const visibility = smooth((amount - .36) / .35) * (1 - smooth((amount - .84) / .16))
    if (visibility <= .001) return
    const color = light ? '87,94,147' : '191,204,238'
    const accent = viewport.querySelector('[data-role="enterprise"]') ? (light ? '53,112,124' : '166,221,221') : (light ? '113,93,168' : '204,188,238')
    ctx.save()
    ctx.globalAlpha = 1
    ctx.lineWidth = .65
    function chain(rect: DOMRect, count: number, inset: number, alpha: number) {
      const ring = perimeter(rect, count, inset)
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i], b = ring[(i + 1) % ring.length]
        const pulse = reduced ? .6 : .58 + Math.sin(time * .00065 - i * .7) * .18
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
        const dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy) || 1
        const offset = (i % 2 ? 1 : -1) * 3.5
        ctx.strokeStyle = `rgba(${color},${visibility * alpha * pulse})`
        ctx.beginPath(); ctx.moveTo(a.x, a.y)
        ctx.quadraticCurveTo(mid.x - dy / length * offset, mid.y + dx / length * offset, b.x, b.y); ctx.stroke()
        ctx.strokeStyle = `rgba(${accent},${visibility * alpha * .35})`
        ctx.beginPath();ctx.moveTo(a.x, a.y)
        ctx.quadraticCurveTo(mid.x + dy / length * offset, mid.y - dx / length * offset, b.x, b.y);ctx.stroke()
        ctx.fillStyle = `rgba(${accent},${visibility * (i % 3 === 0 ? .8 : .35)})`
        ctx.beginPath();ctx.arc(a.x, a.y, i % 3 === 0 ? 1.5 : .8, 0, Math.PI * 2);ctx.fill()
      }
    }
    chain(outer, 58, 7, light ? .8 : .9)
    fields.forEach(r => chain(r, 24, 2, .54))
    if (emblem) {
      const x = emblem.x + emblem.width / 2, y = emblem.y + emblem.height / 2
      const glow = ctx.createRadialGradient(x,y,0,x,y,58)
      glow.addColorStop(0, `rgba(${accent},${visibility * .13})`);glow.addColorStop(1, `rgba(${accent},0)`)
      ctx.fillStyle=glow;ctx.fillRect(x-58,y-58,116,116)
    }
    ctx.restore()
  }
  function backgroundOpacity(p: Point) {
    return outer && p.x > outer.left - 8 && p.x < outer.right + 8 && p.y > outer.top - 8 && p.y < outer.bottom + 8
      ? 1 - amount * .87 : 1
  }
  function nodeOpacity(core: boolean) {
    return core ? 1 - smooth((amount - .70) / .30) : 1 - smooth((amount - .84) / .16)
  }
  return { update, morph, draw, backgroundOpacity, nodeOpacity }
}
