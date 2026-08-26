/**
 * @deprecated 已被 JobGraphPage + components/kg/JobGraphCanvas 取代。
 * 保留此文件以便回滚,新版稳定后清理。
 */
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

interface GraphNode {
  id: string; name: string; type: 'job' | 'skill'
  val: number; color: string; group?: string
}

const NODES: GraphNode[] = [
  { id:'j1', name:'AI应用开发', type:'job', val:9, color:'#00C8FF', group:'ai' },
  { id:'j2', name:'Java后端', type:'job', val:8, color:'#7C3AED', group:'backend' },
  { id:'j3', name:'大数据工程', type:'job', val:7, color:'#00E599', group:'data' },
  { id:'j4', name:'云原生', type:'job', val:6, color:'#FF8C42', group:'ops' },
  { id:'j5', name:'AI Agent', type:'job', val:7, color:'#00C8FF', group:'ai' },
  { id:'j6', name:'前端开发', type:'job', val:6, color:'#FF4D6A', group:'frontend' },
  { id:'s1', name:'Python', type:'skill', val:5, color:'#38BDF8' },
  { id:'s2', name:'Java', type:'skill', val:5, color:'#A78BFA' },
  { id:'s3', name:'SpringBoot', type:'skill', val:4, color:'#C084FC' },
  { id:'s4', name:'LangChain', type:'skill', val:4, color:'#2DD4BF' },
  { id:'s5', name:'K8s', type:'skill', val:4, color:'#FBBF24' },
  { id:'s6', name:'Docker', type:'skill', val:3, color:'#FCD34D' },
  { id:'s7', name:'RAG', type:'skill', val:5, color:'#34D399' },
  { id:'s8', name:'Spark', type:'skill', val:3, color:'#FB923C' },
  { id:'s9', name:'MCP协议', type:'skill', val:4, color:'#38BDF8' },
  { id:'s10', name:'React', type:'skill', val:4, color:'#F472B6' },
  { id:'s11', name:'MySQL', type:'skill', val:3, color:'#A3E635' },
  { id:'s12', name:'Flink', type:'skill', val:3, color:'#FB923C' },
  { id:'s13', name:'TypeScript', type:'skill', val:3, color:'#60A5FA' },
  { id:'s14', name:'Agent框架', type:'skill', val:4, color:'#2DD4BF' },
]

const LINKS: [string,string][] = [
  ['j1','s1'],['j1','s4'],['j1','s7'],['j5','s1'],['j5','s4'],['j5','s9'],['j5','s14'],
  ['j2','s2'],['j2','s3'],['j2','s5'],['j2','s6'],['j2','s11'],
  ['j3','s1'],['j3','s8'],['j3','s12'],['j4','s5'],['j4','s6'],
  ['j6','s10'],['j6','s13'],
  ['s1','s4'],['s1','s7'],['s5','s6'],['s2','s3'],['s4','s14'],['s4','s9'],
]

interface Props { className?: string; skills?: string[] }

const palette = ['#00C8FF','#7C3AED','#00E599','#FF8C42','#FF4D6A','#38BDF8','#A78BFA','#C084FC','#2DD4BF','#FBBF24','#FCD34D','#34D399','#FB923C','#F472B6','#60A5FA','#A3E635','#FF6B6B','#4ECDC4']

function buildDynamicGraph(skills: string[]) {
  const nodes: GraphNode[] = skills.map((s, i) => ({
    id: `s${i}`, name: s, type: 'skill' as const,
    val: 3 + Math.random() * 4,
    color: palette[i % palette.length],
    group: s[0]?.toLowerCase(),
  }))
  const links: [string, string][] = []
  for (let i = 0; i < nodes.length; i++) {
    const topLinks = Math.min(2, nodes.length - 1)
    for (let j = 0; j < topLinks; j++) {
      const t = (i + j + 1) % nodes.length
      if (t !== i) links.push([`s${i}`, `s${t}`])
    }
  }
  return { nodes, links: links.slice(0, Math.max(nodes.length, nodes.length * 1.5)) }
}

export default function Graph3D({ className = '', skills }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let useNodes: GraphNode[] = NODES
    let useLinks: [string, string][] = LINKS
    if (skills && skills.length > 0) {
      const dyn = buildDynamicGraph(skills)
      useNodes = dyn.nodes; useLinks = dyn.links
    }

    const w = container.clientWidth
    const h = container.clientHeight
    if (w < 10 || h < 10) return

    // Scene
    const scene = new THREE.Scene()
    scene.background = null

    // Camera
    const camera = new THREE.PerspectiveCamera(50, w / h, 1, 600)
    camera.position.set(70, 40, 80)

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(w, h)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.2
    container.appendChild(renderer.domElement)

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.06
    controls.autoRotate = true
    controls.autoRotateSpeed = 0.6
    controls.minDistance = 25
    controls.maxDistance = 200
    controls.target.set(0, 0, 0)

    // Lights
    const ambient = new THREE.AmbientLight(0x335588, 0.4)
    scene.add(ambient)
    const key = new THREE.DirectionalLight(0xffffff, 1.5)
    key.position.set(40, 80, 60)
    scene.add(key)
    const back = new THREE.DirectionalLight(0x4488ff, 0.6)
    back.position.set(-50, -30, -60)
    scene.add(back)
    const fill = new THREE.DirectionalLight(0xff8844, 0.3)
    fill.position.set(-30, 20, 50)
    scene.add(fill)

    // Fog for depth
    scene.fog = new THREE.FogExp2(0x0a0e1a, 0.003)

    // Node positions
    const posMap = new Map<string, THREE.Vector3>()
    const nodeGroups: THREE.Group[] = []

    useNodes.forEach((n, i) => {
      const angle = (i / useNodes.length) * Math.PI * 2
      const r = n.type === 'job' ? 30 : 55
      const x = Math.cos(angle) * r + (Math.random() - 0.5) * 6
      const z = Math.sin(angle) * r + (Math.random() - 0.5) * 6
      const y = (Math.random() - 0.5) * 12
      const pos = new THREE.Vector3(x, y, z)
      posMap.set(n.id, pos)

      const isJob = n.type === 'job'
      const size = isJob ? 5.5 : 3.8
      const geo = isJob
        ? new THREE.BoxGeometry(size, size, size)
        : new THREE.SphereGeometry(size, 24, 24)
      const color = new THREE.Color(n.color)

      // Main mesh
      const mat = new THREE.MeshPhysicalMaterial({
        color, emissive: color, emissiveIntensity: 0.2,
        metalness: 0.3, roughness: 0.2, clearcoat: 0.4,
        transparent: true, opacity: 0.95,
      })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.copy(pos)
      mesh.castShadow = true

      // Glow ring
      const ringGeo = isJob
        ? new THREE.BoxGeometry(size + 1.2, size + 1.2, size + 1.2)
        : new THREE.SphereGeometry(size + 0.8, 16, 16)
      const ringMat = new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.12, wireframe: true,
      })
      const ring = new THREE.Mesh(ringGeo, ringMat)
      ring.position.copy(pos)

      // Label sprite
      const canvas = document.createElement('canvas')
      canvas.width = 256; canvas.height = 80
      const ctx = canvas.getContext('2d')!
      ctx.clearRect(0, 0, 256, 80)

      // Glow behind text
      ctx.shadowColor = n.color
      ctx.shadowBlur = 12
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 22px "Noto Sans SC", "Microsoft YaHei", sans-serif'
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.shadowBlur = 0
      ctx.fillStyle = '#f0f4ff'
      ctx.fillText(n.name, 128, 40)

      const tex = new THREE.CanvasTexture(canvas)
      tex.needsUpdate = true
      const spriteMat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, sizeAttenuation: true })
      const sprite = new THREE.Sprite(spriteMat)
      sprite.scale.set(16, 6, 1)
      sprite.position.set(x, y + (isJob ? -7.5 : -6.5), z)

      const group = new THREE.Group()
      group.add(mesh); group.add(ring); group.add(sprite)
      group.userData = { id: n.id, name: n.name, type: n.type, isJob }
      scene.add(group)
      nodeGroups.push(group)
    })

    // Links with gradient color
    useLinks.forEach(([s, t]) => {
      const a = posMap.get(s); const b = posMap.get(t)
      if (!a || !b) return
      const points: THREE.Vector3[] = []
      const steps = 12
      for (let i = 0; i <= steps; i++) {
        const t = i / steps
        const midX = (a.x + b.x) / 2
        const midZ = (a.z + b.z) / 2
        const midY = (a.y + b.y) / 2 - 5 * Math.sin(t * Math.PI)
        points.push(new THREE.Vector3(
          a.x + (b.x - a.x) * t + (midX - (a.x + b.x) / 2) * 0,
          a.y + (b.y - a.y) * t + (midY - (a.y + b.y) / 2) * 1,
          a.z + (b.z - a.z) * t + (midZ - (a.z + b.z) / 2) * 0,
        ))
      }
      const curveGeo = new THREE.BufferGeometry().setFromPoints(points)
      const curveMat = new THREE.LineBasicMaterial({
        color: 0x4488cc, transparent: true, opacity: 0.08,
      })
      scene.add(new THREE.Line(curveGeo, curveMat))
    })

    // Click to focus
    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    let mouseDown = { x: 0, y: 0 }
    let isDrag = false

    const onDown = (e: MouseEvent) => { mouseDown = { x: e.clientX, y: e.clientY }; isDrag = false }
    const onMove = (e: MouseEvent) => { if (Math.abs(e.clientX - mouseDown.x) > 4 || Math.abs(e.clientY - mouseDown.y) > 4) isDrag = true }

    const onClick = (e: MouseEvent) => {
      if (isDrag) return
      const rect = renderer.domElement.getBoundingClientRect()
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(pointer, camera)
      const meshes: THREE.Mesh[] = []
      scene.children.forEach(c => {
        if (c.type === 'Group') c.children.forEach((ch: any) => { if (ch.isMesh && !ch.isSprite) meshes.push(ch) })
      })
      const hits = raycaster.intersectObjects(meshes)
      if (hits.length > 0) {
        const hit = hits[0].object.parent
        if (hit?.userData?.id) {
          const p = posMap.get(hit.userData.id)
          if (p) {
            controls.autoRotate = false
            controls.target.copy(p)
            camera.position.set(p.x + 30, p.y + 20, p.z + 35)
            controls.update()
            setTimeout(() => { controls.autoRotate = true }, 5000)
          }
        }
      }
    }

    renderer.domElement.addEventListener('pointerdown', onDown)
    renderer.domElement.addEventListener('pointermove', onMove)
    renderer.domElement.addEventListener('pointerup', onClick)

    // Animation loop with pulsing
    let animId: number
    const clock = new THREE.Clock()
    const animate = () => {
      animId = requestAnimationFrame(animate)
      const t = clock.getElapsedTime()
      nodeGroups.forEach((g, i) => {
        g.children.forEach((ch: any) => {
          if (ch.isMesh && !ch.isSprite) {
            ch.material.emissiveIntensity = 0.15 + 0.1 * Math.sin(t * 0.8 + i * 0.5)
          }
        })
      })
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    // Resize
    const resize = () => {
      const cw = container.clientWidth; const ch = container.clientHeight
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
      renderer.domElement.removeEventListener('pointerdown', onDown)
      renderer.domElement.removeEventListener('pointermove', onMove)
      renderer.domElement.removeEventListener('pointerup', onClick)
      controls.dispose()
      renderer.dispose()
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement)
    }
  }, [])

  return <div ref={containerRef} className={`w-full h-full ${className}`} />
}
