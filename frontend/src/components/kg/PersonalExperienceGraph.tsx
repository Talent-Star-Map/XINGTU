import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { Expand, Pause, Play, RotateCcw, RefreshCw, ArrowUpRight, Plus, Minus } from 'lucide-react'
import { useTheme } from '../ThemeProvider'
import { kgApi } from './api'
import './PersonalExperienceGraph.css'

type Kind = 'person' | 'project' | 'work' | 'skill'
interface GraphNode {
  id: string; kind: Kind; name: string; description?: string; role?: string
  startDate?: string; endDate?: string; current?: boolean; highlights?: string[]
  evidenceIds?: string[]; experienceIds?: string[]; source?: string; selfDeclared?: boolean
}
interface GraphEdge { id: string; source: string; target: string; kind: string; label: string; evidenceId?: string }
interface Evidence { id: string; experienceId: string; skillId: string; quote: string; basis: string; source: string }
export interface PersonalGraphData {
  nodes: GraphNode[]; edges: GraphEdge[]; evidence: Evidence[]
  sourceResume: { id: number | null; title: string; ai_generated?: boolean; updatedAt?: string }
  summary: { experiences: number; skills: number; supportedSkills: number; unlinkedSkills: number }
  notice: string
}
const KIND_NAME: Record<Kind, string> = { person: '个人', project: '项目经历', work: '工作经历', skill: '技术' }
const COLORS = { person: 0xd7a94f, project: 0x6eabb6, work: 0x8a9fc8, skill: 0xad98c2 }

/** Production uses only the authenticated API; no demo or random fallback data. */
export default function PersonalExperienceGraph({ onOpenResume }: { onOpenResume: () => void }) {
  const [data, setData] = useState<PersonalGraphData | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [version, setVersion] = useState(0)
  const [selected, setSelected] = useState('person')
  const [filter, setFilter] = useState('all')
  const [expanded, setExpanded] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [fallback, setFallback] = useState(false)
  const [compact, setCompact] = useState(() => window.innerWidth < 760)
  useEffect(() => {
    const media = matchMedia('(max-width: 759px)')
    const update = () => setCompact(media.matches)
    media.addEventListener('change', update);return () => media.removeEventListener('change', update)
  }, [])
  const { theme } = useTheme()
  const shell = useRef<HTMLElement>(null)
  const viewport = useRef<HTMLDivElement>(null)
  const sceneActions = useRef<{ reset: () => void; zoom: (factor: number) => void; draw: () => void } | null>(null)
  const active = useRef(selected)
  const animate = useRef(playing)
  const select = useCallback((id: string) => setSelected(id), [])

  useEffect(() => {
    let alive = true
    setLoading(true); setError('')
    kgApi.personalGraph().then((value: PersonalGraphData) => {
      if (alive) { setData(value); setSelected('person') }
    }).catch(() => { if (alive) { setData(null); setError('暂时无法读取经历图谱，请重试。') } })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [version])
  useEffect(() => { active.current = selected; sceneActions.current?.draw() }, [selected])
  useEffect(() => { animate.current = playing; sceneActions.current?.draw() }, [playing])
  useEffect(() => {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)')
    const change = () => { if (reduced.matches) setPlaying(false) }
    reduced.addEventListener('change', change); return () => reduced.removeEventListener('change', change)
  }, [])

  const visible = useMemo(() => {
    if (!data) return { nodes: [], edges: [] }
    let experiences = data.nodes.filter(n => n.kind === 'project' || n.kind === 'work')
    if (filter !== 'all') experiences = experiences.filter(n => n.kind === filter)
    experiences = experiences.slice(0, expanded ? 8 : compact ? 3 : 4)
    const ids = new Set(experiences.map(n => n.id))
    const connectedSkills = new Set(data.edges.filter(e => ids.has(e.source)).map(e => e.target))
    let skills = data.nodes.filter(n => n.kind === 'skill' && (connectedSkills.has(n.id) || (filter === 'all' && !n.experienceIds?.length)))
    skills = skills.slice(0, expanded ? (compact ? 16 : 24) : compact ? 8 : 12)
    const nodes = [...data.nodes.filter(n => n.kind === 'person'), ...experiences, ...skills]
    if (selected !== 'person' && !nodes.some(n => n.id === selected)) {
      const chosen = data.nodes.find(n => n.id === selected)
      if (chosen) {
        nodes.push(chosen)
        for (const id of chosen.experienceIds || []) {
          const related = data.nodes.find(n => n.id === id)
          if (related && !nodes.some(n => n.id === id)) nodes.push(related)
        }
      }
    }
    const included = new Set(nodes.map(n => n.id))
    return { nodes, edges: data.edges.filter(e => included.has(e.source) && included.has(e.target)) }
  }, [data, expanded, filter, selected, compact])

  // Keep a stable scene while selecting its existing nodes.
  const sceneKey = visible.nodes.map(n => n.id).join('|') + ':' + theme
  useEffect(() => {
    const host = viewport.current
    if (!host || !data || loading) return
    let renderer: THREE.WebGLRenderer
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' }) }
    catch { setFallback(true); return }
    setFallback(false)
    const dark = theme === 'dark'
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(44, 1, 0.1, 600)
    const cameraDistance = 145
    camera.position.set(0, 6, cameraDistance)
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6)); renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.domElement.setAttribute('aria-label', '个人、经历与技术三维图谱，可拖动旋转；下方列表可键盘选择所有节点')
    host.prepend(renderer.domElement)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enablePan = false; controls.enableDamping = false; controls.minDistance = 65; controls.maxDistance = Math.max(220, cameraDistance * 1.5)
    controls.autoRotateSpeed = 0.28
    scene.add(new THREE.AmbientLight(0xffffff, 2.2))
    const light = new THREE.DirectionalLight(0xfff2dc, 2.4); light.position.set(0, 30, 70); scene.add(light)
    const entries = new Map<string, { group: THREE.Group; label: HTMLButtonElement; dot: SVGLineElement }>()
    const links: { line: THREE.Line; edge: GraphEdge }[] = []
    const positions = new Map<string, THREE.Vector3>()
    const experiences = visible.nodes.filter(n => n.kind === 'project' || n.kind === 'work')
    const skills = visible.nodes.filter(n => n.kind === 'skill')
    // A deterministic spatial constellation: central person, inner experiences,
    // and a spherical outer shell. Geometry conveys relation, never proficiency.
    positions.set('person', new THREE.Vector3(0, 0, 0))
    experiences.forEach((n, i) => {
      const angle = -Math.PI / 4 + i * Math.PI * 2 / Math.max(1, experiences.length)
      positions.set(n.id, new THREE.Vector3(Math.cos(angle) * 20, Math.sin(angle) * 19, i % 2 ? -9 : 11))
    })
    skills.forEach((n, i) => {
      const angle = i * 2.399963229728653 + .4
      const z = (1 - 2 * (i + .5) / Math.max(1, skills.length)) * 25
      const radius = Math.sqrt(1 - (z / 44) ** 2) * 43
      positions.set(n.id, new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius * .82, z))
    })
    const labelLayer = document.createElement('div'); labelLayer.className = 'peg-labels'
    const leaderLayer = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); leaderLayer.classList.add('peg-leaders')
    host.append(leaderLayer, labelLayer)
    for (const n of visible.nodes) {
      const group = new THREE.Group(); group.position.copy(positions.get(n.id)!)
      const geometry = n.kind === 'person' ? new THREE.BoxGeometry(5, 5, 5) : n.kind === 'skill' ? new THREE.SphereGeometry(1.3, 20, 16) : new THREE.OctahedronGeometry(2.6)
      const material = new THREE.MeshStandardMaterial({ color: COLORS[n.kind], roughness: 0.4, metalness: 0.15, transparent: true })
      const mesh = new THREE.Mesh(geometry, material); mesh.userData.id = n.id; group.add(mesh)
      if (n.kind !== 'skill') {
        const outline = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({ color: dark ? 0xe5d2ac : 0x766447, transparent: true, opacity: 0.7 }))
        outline.scale.setScalar(1.06);group.add(outline)
      }
      const label = document.createElement('button'); label.type = 'button'; label.className = 'peg-label'; label.textContent = n.name
      label.dataset.nodeId = n.id;label.dataset.kind = n.kind;label.title = n.name;label.onclick = () => select(n.id)
      labelLayer.appendChild(label)
      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'line'); dot.setAttribute('stroke', dark ? '#627481' : '#9caab5');dot.setAttribute('stroke-width', '0.7');leaderLayer.appendChild(dot)
      entries.set(n.id, { group, label, dot });scene.add(group)
    }
    for (const edge of visible.edges) {
      const a = positions.get(edge.source)!, b = positions.get(edge.target)!
      const middle = a.clone().lerp(b, 0.5);middle.z -= 7
      const curve = new THREE.QuadraticBezierCurve3(a, middle, b)
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(24)), new THREE.LineBasicMaterial({ color: dark ? 0x7a9ca8 : 0x69838d, transparent: true, opacity: 0.4 }))
      scene.add(line);links.push({ line, edge })
    }
    let frame = 0, last = 0, inView = true, interacting = false
    const labels = () => {
      const w = host.clientWidth, h = host.clientHeight
      const used: { x: number; y: number; w: number; h: number }[] = []
      const ordered = [...visible.nodes].sort((a, b) => Number(b.id === active.current) - Number(a.id === active.current) || Number(a.kind === 'skill') - Number(b.kind === 'skill'))
      for (const n of ordered) {
        const { group, label, dot } = entries.get(n.id)!
        const p = group.position.clone().project(camera), px = (p.x * .5 + .5) * w, py = (-p.y * .5 + .5) * h
        const bw = label.offsetWidth, bh = label.offsetHeight
        let best = { x: 0, y: 0, score: Infinity }
        for (const dy of [15, -36, 39, -60, 63, -84, 87, -108]) for (const dx of [0, -38, 38, -76, 76]) {
          const x = Math.max(8, Math.min(w - bw - 8, px - bw / 2 + dx)), y = Math.max(8, Math.min(h - bh - 8, py + dy))
          const overlaps = used.reduce((sum, r) => sum + Math.max(0, Math.min(x + bw + 3, r.x + r.w) - Math.max(x - 3, r.x)) * Math.max(0, Math.min(y + bh + 3, r.y + r.h) - Math.max(y - 3, r.y)), 0)
          const score = overlaps * 1000 + Math.abs(dy - 15) + Math.abs(dx) * .3
          if (score < best.score) best = { x, y, score }
        }
        label.style.transform = `translate(${best.x}px,${best.y}px)`;label.setAttribute('aria-pressed', String(active.current === n.id))
        used.push({ x: best.x, y: best.y, w: bw, h: bh })
        dot.setAttribute('x1', String(px));dot.setAttribute('y1', String(py));dot.setAttribute('x2', String(best.x + bw / 2));dot.setAttribute('y2', String(best.y + bh / 2))
      }
    }
    const draw = () => {
      controls.autoRotate = animate.current
      const neighbors = new Set([active.current])
      visible.edges.forEach(e => { if (e.source === active.current) neighbors.add(e.target); if (e.target === active.current) neighbors.add(e.source) })
      entries.forEach(({ group }, id) => group.children.forEach(child => { if (child instanceof THREE.Mesh) child.material.opacity = active.current === 'person' || neighbors.has(id) ? 1 : .55 }))
      links.forEach(({ line, edge }) => { (line.material as THREE.LineBasicMaterial).opacity = active.current === 'person' ? .36 : (edge.source === active.current || edge.target === active.current) ? .9 : .09 })
      renderer.render(scene, camera);labels()
      if (animate.current && inView && !document.hidden && !interacting) {
        if (!frame) frame = requestAnimationFrame(tick)
      } else { cancelAnimationFrame(frame);frame = 0;last = 0 }
    }
    const resize = () => {
      const w = host.clientWidth, h = host.clientHeight
      renderer.setSize(w, h);camera.aspect = w / h;camera.fov = w < 420 ? 68 : 44;camera.updateProjectionMatrix();draw()
    }
    const tick = (t: number) => {
      frame = 0
      if (!inView || document.hidden || !animate.current || interacting) { last = 0;return }
      if (t - last < 40) { frame = requestAnimationFrame(tick);return }
      const delta = last ? Math.min((t - last) / 1000, .1) : 0;last = t
      controls.autoRotate = true;controls.update(delta);draw()
    }
    controls.addEventListener('change', draw)
    controls.addEventListener('start', () => { interacting = true; setPlaying(false) })
    controls.addEventListener('end', () => { interacting = false })
    controls.autoRotate = false
    const resizeObserver = new ResizeObserver(resize);resizeObserver.observe(host)
    const observer = new IntersectionObserver(([e]) => { inView = e.isIntersecting;draw() });observer.observe(host)
    const visibility = () => draw()
    document.addEventListener('visibilitychange', visibility)
    let start: [number, number] | null = null
    const down = (e: PointerEvent) => { start = [e.clientX, e.clientY] }
    const up = (e: PointerEvent) => {
      if (!start || Math.hypot(e.clientX - start[0], e.clientY - start[1]) > 6) return
      const rect = renderer.domElement.getBoundingClientRect(), ray = new THREE.Raycaster()
      ray.setFromCamera(new THREE.Vector2((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1), camera)
      const hit = ray.intersectObjects([...entries.values()].flatMap(x => x.group.children)).find(x => x.object instanceof THREE.Mesh)
      if (hit) select(hit.object.userData.id)
    }
    renderer.domElement.addEventListener('pointerdown', down);renderer.domElement.addEventListener('pointerup', up)
    sceneActions.current = { draw, reset: () => { camera.position.set(0, 6, cameraDistance);controls.target.set(0, 0, 0);controls.update();setSelected('person');draw() }, zoom: factor => { camera.position.multiplyScalar(factor).clampLength(controls.minDistance, controls.maxDistance);controls.update();draw() } }
    resize();host.dataset.ready = 'true'
    return () => {
      cancelAnimationFrame(frame);resizeObserver.disconnect();observer.disconnect();controls.dispose();sceneActions.current = null
      document.removeEventListener('visibilitychange', visibility)
      scene.traverse(o => { const mesh = o as THREE.Mesh;mesh.geometry?.dispose();const mats = mesh.material ? (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) : [];mats.forEach(m => m.dispose()) })
      renderer.dispose();renderer.domElement.remove();labelLayer.remove();leaderLayer.remove();delete host.dataset.ready
    }
    // Membership, theme and loading define the scene. Selection is applied through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneKey, loading, select])

  const chosen = data?.nodes.find(n => n.id === selected) || data?.nodes[0]
  const proofs = data?.evidence.filter(e => e.experienceId === selected || e.skillId === selected) || []
  const related = data?.nodes.filter(n => n.id !== selected && data.edges.some(e => (e.source === selected && e.target === n.id) || (e.target === selected && e.source === n.id))) || []
  const fullScreen = () => { if (document.fullscreenElement) void document.exitFullscreen();else void shell.current?.requestFullscreen().catch(() => {}) }
  return <section ref={shell} className="peg-shell" data-theme={theme} aria-label="项目与技术图谱">
    <header className="peg-header"><div><p className="peg-kicker">让经历成为技术的依据</p><h2>项目与技术图谱</h2><p className="peg-subtitle">看见你做过的事，以及其中的技术联系。</p></div>
      <div className="peg-tools"><button onClick={() => setVersion(v => v + 1)} aria-label="刷新图谱"><RefreshCw size={15} /></button><button onClick={() => setPlaying(v => !v)} disabled={fallback || !data} aria-label={playing ? '暂停旋转' : '播放旋转'}>{playing ? <Pause size={15} /> : <Play size={15} />}</button><button onClick={() => sceneActions.current?.reset()} aria-label="复位图谱"><RotateCcw size={15} /></button><button onClick={fullScreen} aria-label="全屏图谱"><Expand size={15} /></button></div>
    </header>
    {loading ? <div className="peg-state" role="status">正在读取你的经历与技术关系…</div> : error ? <div className="peg-state" role="alert">{error}<button onClick={() => setVersion(v => v + 1)}>重新读取</button></div> : data && <>
      <div className="peg-summary"><span>{data.summary.experiences} 段经历</span><span>{data.summary.skills} 项技术</span><span>{data.summary.supportedSkills} 项有经历关联</span><span className="peg-source">{data.sourceResume.id ? `来自：${data.sourceResume.title || '当前简历'}` : '来自个人资料与技能记录'}</span></div>
      {data.sourceResume.ai_generated && <p className="peg-source-warning">此简历含AI生成或润色内容，请核对原文；图谱不作为独立能力认证。</p>}
      {data.nodes.length === 1 ? <div className="peg-state">还没有可展示的经历或技术。<button onClick={onOpenResume}>去简历中心补充资料</button></div> : <>
        <div className="peg-body"><div className="peg-stage"><div ref={viewport} className="peg-viewport" aria-label="三维关系画布" />{fallback && <div className="peg-fallback">当前设备无法显示三维图谱，可通过下方列表查看所有经历与原文。</div>}<div className="peg-stage-caption">拖动旋转 · 点选查看关联</div><div className="peg-zoom"><button onClick={() => sceneActions.current?.zoom(.85)} aria-label="放大图谱"><Plus size={15} /></button><button onClick={() => sceneActions.current?.zoom(1.18)} aria-label="缩小图谱"><Minus size={15} /></button></div></div>
          <aside className="peg-detail" aria-live="polite"><p className="peg-kind">{chosen && KIND_NAME[chosen.kind]}</p><h3>{chosen?.name}</h3>{chosen?.role && <p className="peg-role">{chosen.role}</p>}
            {chosen?.startDate && <p className="peg-date">{chosen.startDate} — {chosen.current ? '至今' : chosen.endDate || '结束时间未提供'}</p>}
            <p className="peg-description">{chosen?.description || (chosen?.kind === 'skill' ? (proofs.length ? '以下经历的资料中包含这项技术。' : '这项技术存在于技能记录中，尚无明确的经历关联。') : '选择一段经历，查看它与技术之间的联系。')}</p>
            {chosen?.highlights?.map((h, i) => <p className="peg-highlight" key={i}>{h}</p>)}
            {related.length > 0 && <div className="peg-related"><h4>相关{chosen?.kind === 'skill' ? '经历' : chosen?.kind === 'person' ? '经历与技能' : '技术'}</h4><div>{related.filter(n => n.kind !== 'person').map(n => <button key={n.id} onClick={() => select(n.id)}>{n.name}</button>)}</div></div>}
            {proofs.length > 0 && <div className="peg-proofs"><h4>原文依据 <span>{proofs.length}</span></h4>{proofs.map(p => <article key={p.id}><p className="peg-proof-label">{data.nodes.find(n => n.id === p.experienceId)?.name} · {p.basis}</p><blockquote>{p.quote}</blockquote><small>{p.source === 'profile' ? '个人资料' : '当前简历'}中的陈述，未经独立核实</small></article>)}</div>}
            <button className="peg-resume-link" onClick={onOpenResume}>打开简历中心 <ArrowUpRight size={14} /></button>
          </aside></div>
        <footer className="peg-footer"><div className="peg-filters">{[['all', '全部'], ['project', '项目'], ['work', '工作 / 实习']].map(([id, name]) => <button key={id} aria-pressed={filter === id} onClick={() => { setFilter(id);setSelected('person') }}>{name}</button>)}</div><div className="peg-legend"><span><i data-kind="person" />个人</span><span><i data-kind="project" />经历</span><span><i data-kind="skill" />技术</span></div></footer>
        <div className="peg-bottom"><p>{data.notice}{visible.nodes.length < data.nodes.length ? ' 更多内容可在完整列表中选择。' : ''}</p>{!expanded && visible.nodes.length < data.nodes.length && <button onClick={() => setExpanded(true)}>展开更多节点（{visible.nodes.length}/{data.nodes.length}）</button>}{expanded && <button onClick={() => { setExpanded(false);setSelected('person') }}>收起图面</button>}</div>
        <details className="peg-directory"><summary>查看全部经历与技术列表</summary><div>{data.nodes.filter(n => n.kind !== 'person').map(n => <button key={n.id} aria-pressed={selected === n.id} onClick={() => select(n.id)}><span>{KIND_NAME[n.kind]}</span>{n.name}</button>)}</div></details>
      </>}
    </>}
  </section>
}
