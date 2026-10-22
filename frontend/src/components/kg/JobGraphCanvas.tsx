/**
 * JobGraphCanvas — 3D 动态交互式岗位图谱(v2)
 *
 * 三大支柱:
 *  1. **平铺布局** — Fibonacci 球面分布,节点不再重叠,任意角度都可读
 *  2. **focus 模式** — 选中 Job → 只显示该 Job + 邻居(REQUIRES Skill / SIMILAR_TO Job),其他隐藏
 *  3. **动态** — 自动旋转、节点呼吸光、星空背景、曲线边、hover tooltip、点击飞过去
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { LockKeyhole } from 'lucide-react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

export interface RecruitmentSample {
  posting_id: string
  title: string
  company?: string
  city?: string
  source: string
  source_url: string
  salary_text?: string
  experience?: string
  education?: string
  reference_time?: string
  time_basis: string
  quote?: string
}
export interface GraphNode {
  id: string
  type: string   // 'Job' | 'Skill' | 'Industry' | 'Company' | 'Cluster'
  label?: string // 显示名(API 返回的 label 字段是岗位/技能名)
  name?: string
  source?: string
  salary_max?: number
  hot_score?: number
  city?: string
  company?: string
  // Cluster 节点专用
  member_count?: number
  tech_stack?: string
  avg_salary?: number
  sample_members?: string[]
  recruitment_count?: number
  recruitment_samples?: RecruitmentSample[]
  recruitment?: RecruitmentSample & { description?: string; skills?: { id: string; name: string; status: string; quote?: string }[] }
}
export interface GraphLink {
  source: string
  target: string
  type: string  // 'REQUIRES' | 'SIMILAR_TO' | 'CO_OCCURS_WITH' | 'PUBLISHED_BY' | 'BELONGS_TO'
}
export interface GraphData {
  nodes: GraphNode[]
  links: GraphLink[]
}

interface Props {
  data: GraphData
  selectedId?: string
  onSelect?: (id: string | undefined) => void
  onJobDetail?: (jobId: number) => void
  lockPopoverOnClick?: boolean
  renderNodePopover?: (node: GraphNode) => ReactNode
}

// ── 星图配色 ──
// 节点自然色(默认就是这些,不等点击) + 点击后高亮/邻居覆盖
// 用淡色调,像水彩星图,清晰可辨不刺眼
// Job   = 暖白恒星 (太阳 G 型,淡金)
// Skill   = 蓝白主序星 (天狼星色调,淡蓝)
// Industry = 青蓝星云 (猎户座大星云,淡青)
// Company  = 粉红巨星 (参宿四,淡粉)
// Cluster  = 橙红超巨星(参宿七,体量最大 — 表示一组聚合岗位)
const STYLE: Record<string, { color: number; emissive: number; size: number; shape: 'box' | 'sphere' | 'octa' }> = {
  Job:      { color: 0xfde68a, emissive: 0xfcd34d, size: 4.5, shape: 'box' },     // 淡金恒星
  Skill:    { color: 0x38bdf8, emissive: 0x0284c7, size: 3.0, shape: 'sphere' },
  Industry: { color: 0x99f6e4, emissive: 0x5eead4, size: 4.0, shape: 'octa' },    // 淡青星云
  Company:  { color: 0xfbcfe8, emissive: 0xf9a8d4, size: 3.8, shape: 'box' },     // 淡粉巨星
  Cluster:  { color: 0xff9f1c, emissive: 0xc96b05, size: 6.0, shape: 'octa' },
  Category: { color: 0xc4b5fd, emissive: 0xa78bfa, size: 3.5, shape: 'octa' },
  Nature: { color: 0x2dd4bf, emissive: 0x0d9488, size: 7, shape: 'sphere' },
  Recruitment: { color: 0xf472b6, emissive: 0xdb2777, size: 4.5, shape: 'box' },
  default:  { color: 0xe0e7ff, emissive: 0xc7d2fe, size: 3.0, shape: 'sphere' },
}

// 点击/邻居后的高亮色 — 经典配色:金色选中,绿色邻居
const HIGHLIGHT_COLOR = 0xfbbf24  // 金黄高亮
const NEIGHBOR_COLOR  = 0x34d399  // 薄荷绿邻居

// Share the actual canvas palette with the page legend.
export const JOB_GRAPH_LEGEND = [
  { type: 'Nature', label: '工作性质', hint: '按实际工作内容划分，如工程开发、算法与研究' },
  { type: 'Cluster', label: '岗位方向', hint: '领域下的具体工作方向，如大模型应用开发' },
  { type: 'Skill', label: '技能点', hint: '具体技术，如 Python、MySQL' },
  { type: 'Recruitment', label: '企业招聘', hint: '一家企业的某一条具体招聘，同一企业可有多个职位' },
].map(item => ({ ...item, color: `#${STYLE[item.type].color.toString(16).padStart(6, '0')}` }))

export const JOB_GRAPH_HIGHLIGHTS = [
  { label: '选中', color: `#${HIGHLIGHT_COLOR.toString(16)}` },
  { label: '关联', color: `#${NEIGHBOR_COLOR.toString(16)}` },
]

function styleFor(type: string) {
  return STYLE[type] || STYLE.default
}

// 边的颜色 — 也按"星图连线"风格:主链路 = 暖白(连接恒星主体),次级 = 冷蓝(连线)
const LINK_COLOR_PRIMARY   = 0xfff4d6  // 暖白 — SIMILAR_TO / 中心关联
const LINK_COLOR_REQUIRES  = 0xbfdbfe  // 蓝白 — REQUIRES
const LINK_COLOR_DEFAULT   = 0x6366f1  // 暗靛蓝 — CO_OCCURS_WITH 等

/**
 * Fibonacci 球面分布:把 n 个点均匀铺在球面上,无重叠无聚集。
 * 返回的坐标已经在单位球面上,外部按 R 缩放。
 */
function fibonacciSphere(i: number, n: number): THREE.Vector3 {
  const phi = Math.PI * (3 - Math.sqrt(5))  // 黄金角 ≈ 2.39996
  const y = n === 1 ? 0 : 1 - (i / (n - 1)) * 2  // y 从 1 到 -1
  const r = Math.sqrt(Math.max(0, 1 - y * y))
  const theta = phi * i
  return new THREE.Vector3(Math.cos(theta) * r, y, Math.sin(theta) * r)
}

function makeLabelSprite(text: string, color: number, isJob: boolean) {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 128
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, 512, 128)
  // 黑色描边 — 让白字在亮色星体上也清晰可读
  ctx.shadowColor = 'rgba(0, 0, 20, 0.85)'
  ctx.shadowBlur = 18
  ctx.fillStyle = '#ffffff'
  ctx.strokeStyle = 'rgba(0, 0, 30, 0.7)'
  ctx.lineWidth = 3
  ctx.font = `900 ${isJob ? 48 : 40}px "Noto Sans SC", "Microsoft YaHei", sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  // 先描边再填充,保证加粗白字在任何背景都清晰
  ctx.strokeText(text.slice(0, 14), 256, 64)
  ctx.fillText(text.slice(0, 14), 256, 64)
  const tex = new THREE.CanvasTexture(canvas)
  tex.needsUpdate = true
  const mat = new THREE.SpriteMaterial({
    map: tex, transparent: true, depthTest: false, sizeAttenuation: true,
  })
  const sprite = new THREE.Sprite(mat)
  sprite.scale.set(isJob ? 26 : 22, isJob ? 7.5 : 6.5, 1)
  return sprite
}

export default function JobGraphCanvas({ data, selectedId, onSelect, onJobDetail, renderNodePopover, lockPopoverOnClick = false }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const hoverWindowRef = useRef<HTMLDivElement>(null)
  const hoverCloseRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hoverPosRef = useRef({ x: 12, y: 12 })
  const cancelHoverClose = () => {
    if (hoverCloseRef.current) clearTimeout(hoverCloseRef.current)
    hoverCloseRef.current = null
  }
  const closeHoverSoon = () => {
    if (lockedNodeRef.current) return
    cancelHoverClose()
    hoverCloseRef.current = setTimeout(() => setHoveredNode(null), 260)
  }
  useEffect(() => {
    setHoveredNode(null); setLockedNode(null); lockedNodeRef.current = null
    return cancelHoverClose
  }, [data])
  // hover 浮窗 — React state 只管"鼠标在哪个节点上",位置走 ref 直接 DOM 更新(避免每帧重渲染)
  const [hoveredNode, setHoveredNode] = useState<{
    id: string; type: string; name: string
    company?: string; city?: string; salary?: number; source?: string
    member_count?: number; tech_stack?: string; avg_salary?: number; sample_members?: string[]
  } | null>(null)
  // 锁定弹窗 — 进入 focus 模式后,再点一下节点把弹窗钉住(鼠标移走也不会消失)
  // 再点同一节点 / 点空白 / 跳详情 = 解除锁定
  const [lockedNode, setLockedNode] = useState<{
    id: string; type: string; name: string
    company?: string; city?: string; salary?: number; source?: string
    member_count?: number; tech_stack?: string; avg_salary?: number; sample_members?: string[]
  } | null>(null)
  const lockedPosRef = useRef<{ x: number; y: number } | null>(null)
  // 用 ref 镜像 lockedNode — 避免闭包陷阱(handler 里读到的永远是最新值)
  const lockedNodeRef = useRef<typeof lockedNode>(null)
  useEffect(() => { lockedNodeRef.current = lockedNode }, [lockedNode])
  const [rotating, setRotating] = useState(true)
  const sceneRef = useRef<{
    scene: THREE.Scene
    camera: THREE.PerspectiveCamera
    renderer: THREE.WebGLRenderer
    controls: OrbitControls
    nodeGroups: THREE.Group[]
    groupMap: Map<string, THREE.Group>
    linkPairs: { a: string; b: string; line: THREE.Line }[]
    posMap: Map<string, THREE.Vector3>
    currentHoverId: string | undefined
    raycaster: THREE.Raycaster
    pointer: THREE.Vector2
  } | null>(null)

  // 计算 focus 模式下应该显示哪些节点(邻居子图)
  // 规则:
  //  - 选中的是 Job → 排除其他 Job 邻居(SIMILAR_TO 链路),只显示该岗位 + 它的技能 + 所属行业 + 所属公司
  //  - 选中的是 Skill/Industry/Company → 显示所有连接节点(原行为)
  const focusSet = useMemo(() => {
    if (!selectedId) return null  // null = 显示全部
    const sel = selectedId.toLowerCase()
    // 节点类型查表 — 用于过滤 Job → Job 邻居
    const nodeTypeMap = new Map<string, string>()
    for (const n of data.nodes) nodeTypeMap.set(n.id.toLowerCase(), n.type)
    const selectedType = nodeTypeMap.get(sel)

    const set = new Set<string>([selectedId])
    for (const l of data.links) {
      let neighborId: string | undefined
      if (l.source.toLowerCase() === sel) neighborId = l.target
      else if (l.target.toLowerCase() === sel) neighborId = l.source
      if (!neighborId) continue
      // 选中岗位时,排除其他岗位邻居
      if (selectedType === 'Job' && nodeTypeMap.get(neighborId.toLowerCase()) === 'Job') {
        continue
      }
      set.add(neighborId)
    }
    return set
  }, [selectedId, data.links, data.nodes])

  // ──── 主场景构建:只在 data 变化时重建 ────
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const w = container.clientWidth
    const h = container.clientHeight
    if (w < 10 || h < 10) return

    // 场景
    const scene = new THREE.Scene()
    scene.fog = new THREE.FogExp2(0x0a0e1a, 0.0028)

    const camera = new THREE.PerspectiveCamera(50, w / h, 1, 1000)
    camera.position.set(80, 60, 100)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(w, h)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 0.95
    container.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.07
    controls.autoRotate = true
    controls.autoRotateSpeed = 0.4
    controls.minDistance = 20
    controls.maxDistance = 300
    controls.target.set(0, 0, 0)

    // 灯光
    scene.add(new THREE.AmbientLight(0x335588, 0.5))
    const key = new THREE.DirectionalLight(0xffffff, 1.4)
    key.position.set(60, 100, 80)
    scene.add(key)
    const back = new THREE.DirectionalLight(0x4488ff, 0.5)
    back.position.set(-60, -50, -70)
    scene.add(back)
    const fill = new THREE.DirectionalLight(0xff8844, 0.3)
    fill.position.set(-40, 30, 60)
    scene.add(fill)

    // ── 节点:Fibonacci 球面 + 分层半径 ──
    const posMap = new Map<string, THREE.Vector3>()
    const groupMap = new Map<string, THREE.Group>()
    const nodeGroups: THREE.Group[] = []
    const linkPairs: { a: string; b: string; line: THREE.Line }[] = []

    const jobNodes = data.nodes.filter((n) => n.type === 'Job')
    const skillNodes = data.nodes.filter((n) => n.type === 'Skill')
    const otherNodes = data.nodes.filter((n) => n.type !== 'Job' && n.type !== 'Skill')

    const R_JOB = 35
    const R_SKILL = 70
    const R_OTHER = 50

    // ── 计算位置(Fibonacci 球面分布) ──
    const place = (n: GraphNode, i: number, total: number, R: number) => {
      const u = fibonacciSphere(i, total)
      return new THREE.Vector3(u.x * R, u.y * R, u.z * R)
    }

    const makeNode = (n: GraphNode, pos: THREE.Vector3) => {
      const style = styleFor(n.type)
      const isJob = n.type === 'Job'

      let geo: THREE.BufferGeometry
      if (style.shape === 'box') {
        geo = new THREE.BoxGeometry(style.size, style.size, style.size)
      } else if (style.shape === 'octa') {
        geo = new THREE.OctahedronGeometry(style.size, 0)
      } else {
        geo = new THREE.SphereGeometry(style.size, 16, 16)
      }

      const colorObj = new THREE.Color(style.color)
      const emissiveObj = new THREE.Color(style.emissive)
      const mat = new THREE.MeshPhysicalMaterial({
        color: colorObj,
        emissive: emissiveObj,
        emissiveIntensity: 0.35,
        metalness: 0.2,
        roughness: 0.35,
        clearcoat: 0.3,
        transparent: true,
        opacity: 0.95,
      })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.copy(pos)
      mesh.castShadow = true

      // 光晕外壳 — 用 emissive 色(更亮),让外圈本身就明显
      const ringGeo = style.shape === 'box'
        ? new THREE.BoxGeometry(style.size + 1.5, style.size + 1.5, style.size + 1.5)
        : style.shape === 'octa'
          ? new THREE.OctahedronGeometry(style.size + 1, 0)
          : new THREE.SphereGeometry(style.size + 0.9, 16, 16)
      const ringMat = new THREE.MeshBasicMaterial({
        color: emissiveObj, transparent: true, opacity: 0.28, wireframe: true,
      })
      const ring = new THREE.Mesh(ringGeo, ringMat)
      ring.position.copy(pos)

      // 标签 — 优先用 name(真实显示名),否则 label(图渲染类别),否则 id
      const labelText = n.name || n.label || n.id
      const sprite = makeLabelSprite(labelText, style.color, isJob)
      // 标签放在球正上方(更贴近球),不再往下错位
      sprite.position.set(pos.x, pos.y + (isJob ? 6 : 4.5), pos.z)

      const group = new THREE.Group()
      group.add(mesh); group.add(ring); group.add(sprite)
      group.userData = {
        id: n.id, type: n.type, name: labelText,
        source: n.source, salary: n.salary_max,
        city: n.city, company: n.company,
        // Cluster 节点专用
        member_count: n.member_count,
        tech_stack: n.tech_stack,
        avg_salary: n.avg_salary,
        sample_members: n.sample_members,
      }
      scene.add(group)
      posMap.set(n.id, pos)
      groupMap.set(n.id, group)
      nodeGroups.push(group)
    }

    jobNodes.forEach((n, i) => makeNode(n, place(n, i, jobNodes.length, R_JOB)))
    skillNodes.forEach((n, i) => makeNode(n, place(n, i, skillNodes.length, R_SKILL)))
    otherNodes.forEach((n, i) => makeNode(n, place(n, i, otherNodes.length, R_OTHER)))

    // 边
    data.links.forEach((l) => {
      const a = posMap.get(l.source); const b = posMap.get(l.target)
      if (!a || !b) return
      const steps = 12
      const points: THREE.Vector3[] = []
      for (let i = 0; i <= steps; i++) {
        const t = i / steps
        const midY = (a.y + b.y) / 2 - 4 * Math.sin(t * Math.PI)
        points.push(new THREE.Vector3(
          a.x + (b.x - a.x) * t,
          a.y + (b.y - a.y) * t + (midY - (a.y + b.y) / 2),
          a.z + (b.z - a.z) * t,
        ))
      }
      const linkColor = l.type === 'SIMILAR_TO' ? LINK_COLOR_PRIMARY
                      : l.type === 'REQUIRES' ? LINK_COLOR_REQUIRES
                      : LINK_COLOR_DEFAULT
      const geo = new THREE.BufferGeometry().setFromPoints(points)
      const mat = new THREE.LineBasicMaterial({
        color: linkColor,
        transparent: true,
        opacity: l.type === 'SIMILAR_TO' ? 0.30 : 0.20,
      })
      const line = new THREE.Line(geo, mat)
      line.userData = { source: l.source, target: l.target, type: l.type }
      scene.add(line)
      linkPairs.push({ a: l.source, b: l.target, line })
    })

    // 星空
    const starGeo = new THREE.BufferGeometry()
    const starCount = 600
    const starPositions = new Float32Array(starCount * 3)
    for (let i = 0; i < starCount; i++) {
      starPositions[i * 3] = (Math.random() - 0.5) * 500
      starPositions[i * 3 + 1] = (Math.random() - 0.5) * 500
      starPositions[i * 3 + 2] = (Math.random() - 0.5) * 500
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3))
    const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
      color: 0x88aaff, size: 0.7, transparent: true, opacity: 0.5, sizeAttenuation: true,
    }))
    scene.add(stars)

    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()

    sceneRef.current = {
      scene, camera, renderer, controls,
      nodeGroups, groupMap, linkPairs, posMap,
      currentHoverId: undefined, raycaster, pointer,
    }

    // ── 动画 ──
    let animId = 0
    // 记住每个 sprite 的原始尺寸(动画循环里按相机距离缩放)
    nodeGroups.forEach((g) => {
      const sprite = g.children[2] as THREE.Sprite
      sprite.userData.baseW = sprite.scale.x
      sprite.userData.baseH = sprite.scale.y
    })

    const clock = new THREE.Clock()
    const animate = () => {
      animId = requestAnimationFrame(animate)
      const t = clock.getElapsedTime()
      nodeGroups.forEach((g, i) => {
        if (!g.visible) return
        const mat = (g.children[0] as THREE.Mesh).material as THREE.MeshPhysicalMaterial
        const ringMat = (g.children[1] as THREE.Mesh).material as THREE.MeshBasicMaterial
        const sprite = g.children[2] as THREE.Sprite
        // 选中/邻居保持高亮强度(不呼吸),其他节点呼吸
        const baseEmissive = mat.emissive.getHex()
        if (baseEmissive !== HIGHLIGHT_COLOR && baseEmissive !== NEIGHBOR_COLOR) {
          mat.emissiveIntensity = 0.28 + 0.15 * Math.sin(t * 0.8 + i * 0.4)
        }
        ringMat.opacity = 0.20 + 0.10 * Math.sin(t * 0.6 + i * 0.3)
        const camDist = camera.position.length()
        const scale = camDist / 100
        sprite.scale.set(
          (sprite.userData.baseW || 14) * scale,
          (sprite.userData.baseH || 5) * scale,
          1
        )
      })
      stars.rotation.y = t * 0.02
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    // ── Resize ──
    const resize = () => {
      const cw = container.clientWidth
      const ch = container.clientHeight
      if (cw < 10 || ch < 10) return
      camera.aspect = cw / ch
      camera.updateProjectionMatrix()
      renderer.setSize(cw, ch)
    }
    const ro = new ResizeObserver(resize)
    ro.observe(container)

    return () => {
      cancelAnimationFrame(animId)
      ro.disconnect()
      controls.dispose()
      renderer.dispose()
      scene.traverse((obj: any) => {
        if (obj.geometry) obj.geometry.dispose()
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach((m: any) => m.dispose())
          else obj.material.dispose()
        }
        if (obj.material?.map) obj.material.map.dispose()
      })
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement)
      sceneRef.current = null
    }
  }, [data])

  // ──── focus 模式同步:不重建场景,只切 visible ────
  useEffect(() => {
    const ref = sceneRef.current
    if (!ref) return
    const { nodeGroups, groupMap, linkPairs, posMap, camera, controls } = ref

    const isFocusMode = focusSet !== null
    const neighbors = isFocusMode
      ? new Set(Array.from(focusSet!).filter(id => id !== selectedId))
      : new Set<string>()

    // 节点可见性 — 默认保持星图本色,选中后变金,邻居变绿
    for (const g of nodeGroups) {
      const id = g.userData.id
      const mat = (g.children[0] as THREE.Mesh).material as THREE.MeshPhysicalMaterial
      const ringMat = (g.children[1] as THREE.Mesh).material as THREE.MeshBasicMaterial
      const sprite = g.children[2] as THREE.Sprite
      const style = styleFor(g.userData.type)
      const emissiveObj = new THREE.Color(style.emissive)
      ringMat.color.set(style.color)

      if (!isFocusMode) {
        // 全图模式:全部可见,自然色
        g.visible = true
        g.scale.setScalar(1)
        mat.opacity = 0.95
        mat.emissive.copy(emissiveObj)
        mat.emissiveIntensity = 0.35
        ringMat.opacity = 0.28
        sprite.material.opacity = 1
      } else {
        // focus 模式
        const inFocus = focusSet!.has(id)
        g.visible = inFocus
        if (inFocus) {
          if (id.toLowerCase() === selectedId!.toLowerCase()) {
            // 选中:金色高亮 + 放大
            mat.emissive.copy(emissiveObj)
            mat.emissiveIntensity = 0.55
            ringMat.color.set(HIGHLIGHT_COLOR)
            g.scale.setScalar(1.4)
            mat.opacity = 1
            ringMat.opacity = 0.65
            sprite.material.opacity = 1
          } else if (neighbors.has(id)) {
            // 邻居:薄荷绿 + 稍放大
            mat.emissive.copy(emissiveObj)
            mat.emissiveIntensity = 0.4
            ringMat.color.set(NEIGHBOR_COLOR)
            g.scale.setScalar(1.15)
            mat.opacity = 0.95
            ringMat.opacity = 0.4
            sprite.material.opacity = 1
          } else {
            // 邻居的邻居:自然色但变暗
            mat.emissive.copy(emissiveObj)
            mat.emissiveIntensity = 0.35
            g.scale.setScalar(0.9)
            mat.opacity = 0.6
            ringMat.opacity = 0.18
            sprite.material.opacity = 0.7
          }
        }
      }
    }

    // 边可见性 + 透明度(选中的关联边变金色)
    for (const lp of linkPairs) {
      const inFocus = !isFocusMode || (focusSet!.has(lp.a) && focusSet!.has(lp.b))
      lp.line.visible = inFocus
      if (inFocus) {
        const mat = lp.line.material as THREE.LineBasicMaterial
        if (!isFocusMode) {
          mat.opacity = lp.line.userData.type === 'SIMILAR_TO' ? 0.30 : 0.20
        } else {
          const sel = selectedId!.toLowerCase()
          const isCenter = lp.a.toLowerCase() === sel || lp.b.toLowerCase() === sel
          mat.opacity = isCenter ? 0.80 : 0.40
          if (isCenter) {
            mat.color = new THREE.Color(HIGHLIGHT_COLOR)
          }
        }
      }
    }

    // focus 模式下相机自动飞向选中节点
    if (isFocusMode && selectedId) {
      // 兼容大小写:posMap 用 API 原 id (小写),selectedId 可能被构造成大写
      const lookupId = posMap.has(selectedId) ? selectedId
        : Array.from(posMap.keys()).find(k => k.toLowerCase() === selectedId.toLowerCase())
      const p = lookupId ? posMap.get(lookupId) : undefined
      if (p) {
        controls.autoRotate = true
        controls.autoRotateSpeed = 0.18  // 比全图慢 2-3 倍,但仍旋转
        const startCam = camera.position.clone()
        const startTarget = controls.target.clone()
        const endTarget = p.clone()
        const dist = p.length()
        const endCam = new THREE.Vector3(p.x * 0.3, p.y * 0.3 + 20, p.z * 0.3 + dist * 0.8)
        const dur = 700
        const t0 = performance.now()
        const anim = () => {
          const t = Math.min((performance.now() - t0) / dur, 1)
          const e = 1 - Math.pow(1 - t, 3)
          controls.target.lerpVectors(startTarget, endTarget, e)
          camera.position.lerpVectors(startCam, endCam, e)
          controls.update()
          if (t < 1) requestAnimationFrame(anim)
        }
        anim()
      }
    } else if (!isFocusMode) {
      // 全图模式:回到中心
      controls.autoRotate = true
      controls.autoRotateSpeed = 0.4
      const startCam = camera.position.clone()
      const startTarget = controls.target.clone()
      const endTarget = new THREE.Vector3(0, 0, 0)
      const endCam = new THREE.Vector3(80, 60, 100)
      const dur = 600
      const t0 = performance.now()
      const anim = () => {
        const t = Math.min((performance.now() - t0) / dur, 1)
        const e = 1 - Math.pow(1 - t, 3)
        controls.target.lerpVectors(startTarget, endTarget, e)
        camera.position.lerpVectors(startCam, endCam, e)
        controls.update()
        if (t < 1) requestAnimationFrame(anim)
      }
      anim()
    }
  }, [focusSet, selectedId])

  // ──── 交互事件:挂到 renderer.domElement ────
  // 注意:依赖里加 data — 数据变化时场景重建,handler 必须重新绑定到新 sceneRef
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const renderer = sceneRef.current?.renderer
    if (!renderer) return

    let mouseDown = { x: 0, y: 0, t: 0 }
    let isDrag = false

    const onPointerMove = (e: PointerEvent) => {
      // 总是用最新的 sceneRef(场景可能在 handler 闭包外被重建过)
      const ref = sceneRef.current
      if (!ref) return
      const rect = renderer.domElement.getBoundingClientRect()
      ref.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      ref.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      ref.raycaster.setFromCamera(ref.pointer, ref.camera)
      // 同时把内核 mesh + 外层 wireframe 光环都加入命中检测,扩大悬浮窗触发范围
      const meshes: THREE.Mesh[] = []
      ref.groupMap.forEach((g) => {
        if (!g.visible) return
        const m0 = g.children[0] as THREE.Mesh
        const m1 = g.children[1] as THREE.Mesh
        if (m0?.isMesh) meshes.push(m0)
        if (m1?.isMesh) meshes.push(m1)
      })
      const hits = ref.raycaster.intersectObjects(meshes)
      let hoverId: string | undefined
      let hoverData: any = null
      if (hits.length > 0) {
        const parent = hits[0].object.parent
        hoverId = parent?.userData?.id
        hoverData = parent?.userData
      }
      if (renderNodePopover && !lockedNodeRef.current) {
        if (hoverId) {
          cancelHoverClose()
          const width = Math.min(360, rect.width - 24)
          const height = Math.min(340, rect.height - 24)
          const x = e.clientX - rect.left
          const y = e.clientY - rect.top
          hoverPosRef.current = {
            x: Math.max(12, Math.min(x + 14, rect.width - width - 12)),
            y: Math.max(12, Math.min(y + 14, rect.height - height - 12)),
          }
        } else closeHoverSoon()
      }
      if (hoverId !== ref.currentHoverId) {
        ref.currentHoverId = hoverId
        renderer.domElement.style.cursor = hoverId ? 'pointer' : 'grab'
        if (hoverData) {
          setHoveredNode({
            id: hoverId!,
            type: hoverData.type,
            name: hoverData.name,
            company: hoverData.company,
            city: hoverData.city,
            salary: hoverData.salary,
            source: hoverData.source,
          })
        } else if (!renderNodePopover) {
          setHoveredNode(null)
        }
      }
      // 锁定中:不更新弹窗位置,只更新光标
      if (lockedNodeRef.current) {
        if (Math.abs(e.clientX - mouseDown.x) > 4 || Math.abs(e.clientY - mouseDown.y) > 4) {
          isDrag = true
        }
        return
      }
      if (renderNodePopover) {
        if (hoverId && hoverWindowRef.current) {
          hoverWindowRef.current.style.left = `${hoverPosRef.current.x}px`
          hoverWindowRef.current.style.top = `${hoverPosRef.current.y}px`
        }
        if (Math.abs(e.clientX - mouseDown.x) > 4 || Math.abs(e.clientY - mouseDown.y) > 4) isDrag = true
        return
      }
      // 位置 — 直接 DOM 更新,不走 React state(避免每帧重渲染)
      if (hoverWindowRef.current) {
        if (hoverId) {
          hoverWindowRef.current.style.left = `${e.clientX - rect.left + 18}px`
          hoverWindowRef.current.style.top = `${e.clientY - rect.top + 18}px`
          hoverWindowRef.current.style.display = 'block'
        } else {
          hoverWindowRef.current.style.display = 'none'
        }
      }
      if (Math.abs(e.clientX - mouseDown.x) > 4 || Math.abs(e.clientY - mouseDown.y) > 4) {
        isDrag = true
      }
    }

    const onPointerDown = (e: PointerEvent) => {
      mouseDown = { x: e.clientX, y: e.clientY, t: Date.now() }
      isDrag = false
      renderer.domElement.style.cursor = 'grabbing'
    }

    const onPointerUp = (e: PointerEvent) => {
      const ref = sceneRef.current
      if (!ref) return
      renderer.domElement.style.cursor = ref.currentHoverId ? 'pointer' : 'grab'
      if (isDrag) return
      if (Date.now() - mouseDown.t > 600) return
      const rect = renderer.domElement.getBoundingClientRect()
      ref.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      ref.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      ref.raycaster.setFromCamera(ref.pointer, ref.camera)
      const meshes: THREE.Mesh[] = []
      ref.groupMap.forEach((g) => {
        if (!g.visible) return
        const m0 = g.children[0] as THREE.Mesh
        const m1 = g.children[1] as THREE.Mesh
        if (m0?.isMesh) meshes.push(m0)
        if (m1?.isMesh) meshes.push(m1)
      })
      const hits = ref.raycaster.intersectObjects(meshes)
      if (renderNodePopover && lockPopoverOnClick && hits.length) {
        const info = hits[0].object.parent?.userData
        if (info?.id) {
          cancelHoverClose()
          if (info.type === 'Recruitment') {
            const node = { id: info.id, type: info.type, name: info.name }
            lockedNodeRef.current = node
            setLockedNode(node)
            setHoveredNode(node)
            const width = Math.min(360, rect.width - 24)
            hoverPosRef.current = {
              x: Math.max(12, Math.min(e.clientX - rect.left + 14, rect.width - width - 12)),
              y: Math.max(12, Math.min(e.clientY - rect.top + 14, rect.height - Math.min(340, rect.height - 24) - 12)),
            }
          } else {
            lockedNodeRef.current = null; setLockedNode(null); setHoveredNode(null)
          }
          onSelect?.(info.id)
        }
        return
      }
      if (renderNodePopover && lockPopoverOnClick && !hits.length) return
      // Touch users can tap a node to open the same evidence popover.
      if (renderNodePopover && e.pointerType === 'touch' && hits.length) {
        const info = hits[0].object.parent?.userData
        if (info?.id) {
          cancelHoverClose()
          hoverPosRef.current = { x: 12, y: 40 }
          setHoveredNode({ id: info.id, type: info.type, name: info.name })
        }
        return
      }
      if (hits.length > 0) {
        const parent = hits[0].object.parent
        const id = parent?.userData?.id
        const type = parent?.userData?.type
        if (id) {
          // 进入 focus 模式 + 切换锁定状态
          onSelect?.(id)
          if (type === 'Job') {
            if (lockedNodeRef.current && lockedNodeRef.current.id === id) {
              // 再点同一岗位 → 解除锁定
              setLockedNode(null)
              lockedPosRef.current = null
            } else {
              // 锁定到该岗位(点击位置固定,鼠标移走也不消失)
              setLockedNode({
                id,
                type,
                name: parent.userData.name,
                company: parent.userData.company,
                city: parent.userData.city,
                salary: parent.userData.salary,
                source: parent.userData.source,
              })
              lockedPosRef.current = {
                x: e.clientX - rect.left + 18,
                y: e.clientY - rect.top + 18,
              }
              if (hoverWindowRef.current) {
                hoverWindowRef.current.style.left = lockedPosRef.current.x + 'px'
                hoverWindowRef.current.style.top = lockedPosRef.current.y + 'px'
                hoverWindowRef.current.style.display = 'block'
              }
            }
          } else if (lockedNodeRef.current) {
            // 点击非 Job 节点 → 解除旧锁定(不在这里重新锁定)
            setLockedNode(null)
            lockedPosRef.current = null
          }
        }
      } else {
        // 点击空白 → 退出 focus + 解除锁定
        onSelect?.(undefined)
        setLockedNode(null)
        lockedPosRef.current = null
      }
    }

    const onPointerLeave = (event: PointerEvent) => {
      const ref = sceneRef.current
      if (ref) ref.currentHoverId = undefined
      renderer.domElement.style.cursor = 'grab'
      // 锁定中:不清弹窗
      if (lockedNodeRef.current) return
      if (renderNodePopover) {
        if (event.pointerType !== 'touch') closeHoverSoon()
        return
      }
      setHoveredNode(null)
      if (hoverWindowRef.current) hoverWindowRef.current.style.display = 'none'
    }

    renderer.domElement.addEventListener('pointerdown', onPointerDown)
    renderer.domElement.addEventListener('pointermove', onPointerMove)
    renderer.domElement.addEventListener('pointerup', onPointerUp)
    renderer.domElement.addEventListener('pointerleave', onPointerLeave)
    renderer.domElement.style.cursor = 'grab'

    return () => {
      renderer.domElement.removeEventListener('pointerdown', onPointerDown)
      renderer.domElement.removeEventListener('pointermove', onPointerMove)
      renderer.domElement.removeEventListener('pointerup', onPointerUp)
      renderer.domElement.removeEventListener('pointerleave', onPointerLeave)
    }
    // 关键:依赖里加 data,数据变化场景重建时,handler 必须重新绑定到新 renderer.domElement
  }, [onSelect, data, renderNodePopover, lockPopoverOnClick])

  return (
    <div ref={containerRef}
         className="w-full h-full relative"
         style={{ background: 'radial-gradient(circle at 30% 30%, #0f1733 0%, #06080f 60%, #02030a 100%)', minHeight: renderNodePopover ? 320 : 400 }}>

      {/* hover 悬浮窗 — 锁定时显示 lockedNode,未锁定时跟随鼠标显示 hoveredNode */}
      {(() => {
        const displayNode = lockedNode || hoveredNode
        if (!displayNode) return null
        if (renderNodePopover) {
          const node = data.nodes.find(item => item.id === displayNode.id)
          if (!node) return null
          return <div ref={hoverWindowRef} role="dialog" aria-label={`${node.name || node.label}的招聘信息`}
            onPointerEnter={cancelHoverClose} onPointerLeave={closeHoverSoon}
            onKeyDown={event => { if (event.key === 'Escape') { lockedNodeRef.current = null; setLockedNode(null); setHoveredNode(null) } }}
            className="absolute z-50 flex flex-col overflow-hidden rounded-2xl border border-slate-600/60 bg-slate-950/95 text-slate-100 shadow-2xl backdrop-blur-xl"
            style={{ left: hoverPosRef.current.x, top: hoverPosRef.current.y, width: 360, maxWidth: 'calc(100% - 24px)', maxHeight: 'min(340px, calc(100% - 24px))' }}>
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
              <strong className="min-w-0 text-sm leading-6">{node.recruitment?.title || node.name || node.label}</strong>
              <div className="flex items-center gap-2">
                {lockedNode && <button aria-label="解除固定" title="点击金锁解除固定" className="rounded-lg border border-amber-400/50 bg-amber-400/15 p-1.5 text-amber-300" onClick={() => { lockedNodeRef.current = null; setLockedNode(null); setHoveredNode(null); cancelHoverClose() }}><LockKeyhole className="h-4 w-4" /></button>}
                <button aria-label="关闭招聘浮窗" className="px-1 text-lg text-slate-400 hover:text-white" onClick={() => { cancelHoverClose(); lockedNodeRef.current = null; setLockedNode(null); setHoveredNode(null) }}>×</button>
              </div>
            </div>
            <div className="overflow-y-auto overscroll-contain p-4 text-xs">{renderNodePopover(node)}</div>
          </div>
        }
        const isLocked = !!lockedNode
        return (
          <div
            ref={hoverWindowRef}
            style={{
              position: 'absolute',
              display: isLocked ? 'block' : 'none',  // 锁定立即显示,非锁定由 pointermove 切到 block
              width: 280,
              padding: '12px 14px',
              borderRadius: 10,
              background: 'rgba(10, 15, 30, 0.96)',
              color: '#e0eaff',
              border: isLocked
                ? '1px solid rgba(251, 191, 36, 0.6)'
                : '1px solid rgba(120, 160, 255, 0.4)',
              boxShadow: isLocked
                ? '0 6px 24px rgba(251, 191, 36, 0.25), 0 0 0 1px rgba(251, 191, 36, 0.4)'
                : '0 6px 24px rgba(0, 0, 0, 0.7)',
              pointerEvents: 'none',
              zIndex: 100,
              backdropFilter: 'blur(10px)',
              left: isLocked && lockedPosRef.current ? lockedPosRef.current.x : 0,
              top: isLocked && lockedPosRef.current ? lockedPosRef.current.y : 0,
            }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 4,
            }}>
              <div style={{ fontWeight: 800, fontSize: 14, color: '#ffffff', lineHeight: 1.3 }}>
                {displayNode.name}
              </div>
              {isLocked && (
                <div style={{
                  fontSize: 9, fontWeight: 700, color: '#fbbf24',
                  padding: '2px 6px', borderRadius: 4,
                  background: 'rgba(251, 191, 36, 0.15)',
                  border: '1px solid rgba(251, 191, 36, 0.4)',
                  letterSpacing: 0.5,
                }}>
                  📌 已锁定
                </div>
              )}
            </div>
            <div style={{
              fontSize: 10, opacity: 0.7, marginBottom: 10,
              textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 600,
            }}>
              {displayNode.type}
            </div>
            {displayNode.company && (
              <div style={{ fontSize: 12, marginBottom: 4, color: '#cfd9f5' }}>
                🏢 {displayNode.company}
              </div>
            )}
            {displayNode.city && (
              <div style={{ fontSize: 12, marginBottom: 4, color: '#cfd9f5' }}>
                📍 {displayNode.city}
              </div>
            )}
            {displayNode.salary && (
              <div style={{ fontSize: 12, marginBottom: 4, color: '#fde68a' }}>
                💰 ¥{Math.round(displayNode.salary / 1000)}K
              </div>
            )}
            {displayNode.source && (
              <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>
                📡 {displayNode.source}
              </div>
            )}
            {displayNode.type === 'Cluster' && (
              <>
                <div style={{ fontSize: 12, marginBottom: 4, color: '#fdba74', fontWeight: 700 }}>
                  🔗 聚合 {displayNode.member_count ?? 0} 个岗位
                </div>
                {displayNode.tech_stack && (
                  <div style={{ fontSize: 11, opacity: 0.8, marginBottom: 4 }}>
                    🧱 技术栈: <span style={{ color: '#fdba74' }}>{displayNode.tech_stack}</span>
                  </div>
                )}
                {displayNode.avg_salary ? (
                  <div style={{ fontSize: 12, marginBottom: 4, color: '#fde68a' }}>
                    💰 均薪 ¥{Math.round(displayNode.avg_salary / 1000)}K
                  </div>
                ) : null}
                {displayNode.sample_members && displayNode.sample_members.length > 0 && (
                  <div style={{
                    fontSize: 10, marginTop: 6, opacity: 0.7,
                    borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 6,
                  }}>
                    样本:
                    <div style={{ marginTop: 2, lineHeight: 1.4 }}>
                      {displayNode.sample_members.map((m, i) => (
                        <div key={i}>• {m}</div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
            {displayNode.type === 'Job' && (
              <button
                onClick={() => {
                  const jid = parseInt(displayNode.id.split(':')[1])
                  if (!isNaN(jid)) {
                    setLockedNode(null)
                    lockedPosRef.current = null
                    onJobDetail?.(jid)
                  }
                }}
                style={{
                  marginTop: 12, width: '100%', padding: '8px 0',
                  background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
                  color: 'white', border: 'none', borderRadius: 6,
                  fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  pointerEvents: 'auto',
                  boxShadow: '0 2px 8px rgba(59, 130, 246, 0.4)',
                }}
              >
                查看详情
              </button>
            )}
            {isLocked && (
              <button
                onClick={() => {
                  setLockedNode(null)
                  lockedPosRef.current = null
                  if (hoverWindowRef.current) hoverWindowRef.current.style.display = 'none'
                }}
                style={{
                  marginTop: 6, width: '100%', padding: '6px 0',
                  background: 'transparent',
                  color: '#fbbf24', border: '1px solid rgba(251, 191, 36, 0.4)',
                  borderRadius: 6,
                  fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  pointerEvents: 'auto',
                }}
              >
                🔓 解除锁定
              </button>
            )}
          </div>
        )
      })()}

      <div className="absolute top-3 left-3 text-xs px-2 py-1 rounded pointer-events-none"
           style={{ background: 'rgba(10,15,30,0.6)', color: '#a0b8ff', backdropFilter: 'blur(8px)' }}>
        {data.nodes.length} 节点 / {data.links.length} 边
        {focusSet && focusSet.size > 0 && (
          <> · <span style={{ color: '#fbbf24' }}>focus 模式</span>({focusSet.size} 节点)</>
        )}
      </div>

      {/* 右上角:返回全景 + 旋转控制 */}
      <div className="absolute top-3 right-3 flex items-center gap-2 z-20">
        {focusSet && (
          <button
            onClick={() => onSelect?.(undefined)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:scale-105"
            style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #312e81 100%)',
                     color: '#e0eaff', border: '1px solid rgba(120,160,255,0.4)',
                     boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}
          >
            <span>↩</span>
            <span>返回全景</span>
          </button>
        )}
        <button
          onClick={() => {
            const ref = sceneRef.current
            if (!ref) return
            ref.controls.autoRotate = !ref.controls.autoRotate
            setRotating(ref.controls.autoRotate)
          }}
          className="flex items-center justify-center w-8 h-8 rounded-lg text-xs transition-all hover:scale-105"
          style={{ background: rotating ? 'rgba(251,191,36,0.2)' : 'rgba(10,15,30,0.6)',
                   color: rotating ? '#fbbf24' : '#a0b8ff',
                   border: '1px solid rgba(120,160,255,0.3)' }}
          title={rotating ? '暂停旋转' : '开始旋转'}
        >
          {rotating ? '⏸' : '▶'}
        </button>
      </div>

      {/* 左下角:快捷键提示 */}
      <div className="absolute bottom-3 left-3 text-[10px] px-2 py-1 rounded pointer-events-none"
           style={{ background: 'rgba(10,15,30,0.5)', color: 'rgba(160,184,255,0.7)' }}>
        拖动旋转 · 滚轮缩放 · 点击节点聚焦 · 再点岗位锁定弹窗 · 点击空白退出
      </div>
    </div>
  )
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  } as any)[c])
}
