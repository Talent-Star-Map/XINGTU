/**
 * UserSkillSphere — 用户能力 3D 图谱(中心立方体 + 发散连接版)
 *
 * 视觉:
 *  - 自适应主题背景(透明 canvas,沿用页面背景 — 浅色 / 深色自动跟随系统)
 *  - 中心立方体(用户名写在6个面上,自转)
 *  - 从立方体中心向四周发散的线(顶点色:中心灰 → 端点=技能类别色)
 *  - 每颗技能 = 一个彩色球体(Fibonacci 球面分布,类别着色)
 *  - 鼠标拖动旋转 / 滚轮缩放 / hover 高亮 + 显示名称
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

// ── 类别配置 — 鲜艳饱和的"霓虹"调色板 ──
type Category = 'frontend' | 'backend' | 'database' | 'ai' | 'devops' | 'mobile' | 'product' | 'other'

const CATEGORY_META: Record<Category, { label: string; color: number; emissive: number }> = {
  frontend: { label: '前端',     color: 0xc084fc, emissive: 0xa855f7 },  // 亮紫
  backend:  { label: '后端',     color: 0x4ade80, emissive: 0x22c55e },  // 鲜绿
  database: { label: '数据库',   color: 0xfb923c, emissive: 0xf97316 },  // 鲜橙
  ai:       { label: 'AI/数据',  color: 0xf472b6, emissive: 0xec4899 },  // 桃粉
  devops:   { label: 'DevOps',   color: 0xfacc15, emissive: 0xeab308 },  // 亮黄
  mobile:   { label: '移动端',   color: 0x38bdf8, emissive: 0x0ea5e9 },  // 鲜青
  product:  { label: '产品/设计',color: 0xfb7185, emissive: 0xf43f5e },  // 鲜玫红
  other:    { label: '其他',     color: 0xe2e8f0, emissive: 0x94a3b8 },  // 亮银灰
}

const CATEGORY_KEYWORDS: Record<Category, RegExp[]> = {
  frontend: [/^react$|^vue$|^angular$|^svelte$/i, /前端|frontend/i, /javascript|typescript|html|css|tailwind|sass|webpack|vite/i, /next\.?js|nuxt|redux|mobx/i],
  backend: [/java(?!script)|spring|kotlin|scala/i, /\bgo(lang)?\b|^go$|rust|^c\+\+|^c#$|\.net$/i, /python|django|flask|fastapi|tornado|node\.?js|express|nestjs|koa/i, /php|laravel|ruby|rails|elixir|erlang/i, /后端|backend/i],
  database: [/\bsql\b|mysql|postgres|sqlite|oracle|sql\s*server/i, /\bmongo\b|redis|memcached|elasticsearch|clickhouse/i, /数据库|database/i],
  ai: [/tensorflow|pytorch|keras|sklearn|scikit|hugging|paddle|jax/i, /\bllm\b|\brag\b|langchain|openai|claude|gpt|embedding/i, /\bnlp\b|cv|computer\s*vision|recommend|推荐/i, /\bpandas\b|numpy|matplotlib|seaborn|spark|hadoop|flink/i, /数据|机器学习|深度学习|ai|人工智能|算法/i],
  devops: [/docker|kubernetes|k8s|helm/i, /\baws\b|\bgcp\b|\bazure\b|阿里云|腾讯云|华为云/i, /terraform|ansible|prometheus|grafana|elk/i, /jenkins|gitlab\s*ci|github\s*actions|circleci/i, /nginx|envoy|istio|service\s*mesh/i, /devops|sre|运维|ci\/?cd/i],
  mobile: [/\bios\b|swift|objective-c/i, /\bandroid\b|kotlin|jetpack/i, /flutter|react\s*native|ionic|cordova/i, /uni-?app|uniapp|小程序|taro/i, /移动端|mobile/i],
  product: [/figma|sketch|axure|xd|photoshop|illustrator/i, /产品经理|pm|产品|设计|designer|ux|ui|交互/i, /用户研究|user\s*research|a\/b\s*test|增长/i],
  other: [/.*/],
}

function classifySkill(skill: string): Category {
  for (const cat of ['frontend', 'backend', 'ai', 'database', 'devops', 'mobile', 'product'] as Category[]) {
    for (const pat of CATEGORY_KEYWORDS[cat]) {
      if (pat.test(skill)) return cat
    }
  }
  return 'other'
}

// ── 鲜艳高饱和的"每球一色"调色板(色相散布 360°,无灰色) ──
// 不用类别配色 — 每颗技能按名字 hash 在此板里挑一个色
const SPHERE_PALETTE: number[] = [
  0xff3b6f,  // 玫红
  0xff8a3d,  // 橙
  0xffd23d,  // 鹅黄
  0xc6ff3d,  // 黄绿
  0x3dff8a,  // 鲜绿
  0x3dffd2,  // 青绿
  0x3db6ff,  // 天青
  0x3d6bff,  // 宝蓝
  0x6b3dff,  // 紫罗兰
  0xb83dff,  // 紫红
  0xff3dd2,  // 品红
  0xff5d8a,  // 粉珊瑚
  0xff3838,  // 鲜红
  0xffb53d,  // 杏黄
  0x9eff3d,  // 嫩绿
  0x3dff44,  // 草绿
  0x3dffe1,  // 薄荷青
  0x3d96ff,  // 浅蓝
  0x8b3dff,  // 深紫
  0xff3d96,  // 桃红
  0xff8a8a,  // 浅粉
  0xffb89e,  // 肉色
  0x6bffaa,  // 浅绿
  0xaaffff,  // 浅青
]

// 把颜色按"已被前面球用过多少次"统计,挑出当前未用或用得最少的颜色
function pickUniqueColor(skill: string, usedCount: Map<number, number>): number {
  let h = 0
  for (let i = 0; i < skill.length; i++) h = (h * 31 + skill.charCodeAt(i)) | 0
  const startIdx = Math.abs(h) % SPHERE_PALETTE.length
  // 顺时针扫描,挑第一个使用次数最少的色(若平局取先到)
  let bestIdx = startIdx
  let bestCount = usedCount.get(SPHERE_PALETTE[startIdx]) ?? 0
  for (let k = 1; k < SPHERE_PALETTE.length; k++) {
    const idx = (startIdx + k) % SPHERE_PALETTE.length
    const c = usedCount.get(SPHERE_PALETTE[idx]) ?? 0
    if (c < bestCount) {
      bestIdx = idx
      bestCount = c
      if (c === 0) break  // 找到完全没用过的色,直接用
    }
  }
  return SPHERE_PALETTE[bestIdx]
}

// ── 圆形分布:在 XZ 水平面上等角度环绕(相机绕 Y 公转时圆环始终可见) ──
function circleRing(i: number, n: number, R: number): THREE.Vector3 {
  const angle = (i / n) * Math.PI * 2
  // 轻微 y 起伏让圆环有"圆盘"质感而非完全贴地
  const y = Math.sin(angle * 2) * 2
  return new THREE.Vector3(R * Math.cos(angle), y, R * Math.sin(angle))
}

// ── 用户名获取 ──
function getUsername(): string {
  if (typeof window === 'undefined') return '我'
  return (
    localStorage.getItem('xingtu_username') ||
    localStorage.getItem('xingtu_user') ||
    localStorage.getItem('username') ||
    localStorage.getItem('user_name') ||
    localStorage.getItem('xingtu-name') ||
    '我'
  )
}

// ── 主题检测:跟随系统 / html.dark / data-theme=dark ──
function detectTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light'
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  const root = document.documentElement
  const body = document.body
  if (mq.matches) return 'dark'
  if (root.classList.contains('dark')) return 'dark'
  if (root.dataset.theme === 'dark') return 'dark'
  if (body.classList.contains('dark')) return 'dark'
  return 'light'
}

function useTheme(): 'light' | 'dark' {
  const [theme, setTheme] = useState<'light' | 'dark'>(detectTheme)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const refresh = () => setTheme(detectTheme())
    mq.addEventListener('change', refresh)
    const obs = new MutationObserver(refresh)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] })
    obs.observe(document.body, { attributes: true, attributeFilter: ['class', 'data-theme'] })
    return () => {
      mq.removeEventListener('change', refresh)
      obs.disconnect()
    }
  }, [])
  return theme
}

// (用户名改用 sprite 标签呈现,与技能标签同款 — 删掉立方体面纹理函数)

// ── 球体标签 — 2x 高清 + 加大字体 ──
function makeLabelSprite(text: string, color: number, isDark: boolean): THREE.Sprite {
  const canvas = document.createElement('canvas')
  canvas.width = 768
  canvas.height = 192
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, 768, 192)
  ctx.font = '700 78px "Noto Sans SC", "Microsoft YaHei", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.shadowColor = isDark ? 'rgba(0,0,20,0.95)' : 'rgba(255,255,255,0.95)'
  ctx.shadowBlur = 20
  ctx.fillStyle = isDark ? '#ffffff' : '#0a0e1a'
  ctx.strokeStyle = `rgba(${(color >> 16) & 0xff},${(color >> 8) & 0xff},${color & 0xff},${isDark ? 1 : 0.9})`
  ctx.lineWidth = 6
  const display = text.length > 10 ? text.slice(0, 9) + '…' : text
  ctx.strokeText(display, 384, 96)
  ctx.fillText(display, 384, 96)
  const tex = new THREE.CanvasTexture(canvas)
  tex.needsUpdate = true
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false })
  const sprite = new THREE.Sprite(mat)
  sprite.scale.set(20, 5, 1)
  return sprite
}

interface Props {
  skills: string[]
  username?: string
  height?: number
  autoRotate?: boolean
}

export default function UserSkillSphere({
  skills,
  username: propUsername,
  height = 460,
  autoRotate = true,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [hoveredSkill, setHoveredSkill] = useState<string | null>(null)
  const theme = useTheme()
  const username = propUsername ?? getUsername()

  const grouped = useMemo(() => {
    const map = new Map<Category, string[]>()
    skills.forEach((s) => {
      const c = classifySkill(s)
      if (!map.has(c)) map.set(c, [])
      map.get(c)!.push(s)
    })
    return map
  }, [skills])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const w = container.clientWidth
    const h = container.clientHeight
    if (w < 10 || h < 10) return

    const isDark = theme === 'dark'

    // 场景 — 背景透明,沿用页面背景
    const scene = new THREE.Scene()
    scene.background = null

    // 相机 — 略高俯视,完整呈现圆环辐条
    const camera = new THREE.PerspectiveCamera(50, w / h, 1, 1000)
    camera.position.set(0, 28, 100)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(w, h)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.0
    container.appendChild(renderer.domElement)

    // 控制器 — 自动绕场景旋转
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    // 不自动绕场景公转 — 保持画面静止,需要看其他角度用户可手动拖动
    controls.autoRotate = false
    controls.enablePan = false
    controls.minDistance = 50
    controls.maxDistance = 180
    controls.target.set(0, 0, 0)

    // ── 中心立方体 — 纯色实体,用户名以 sprite 标签形式贴在下方 ──
    const cubeSize = 14
    const cubeGeo = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize)
    const cubeColor = isDark ? 0x818cf8 : 0x6366f1
    const cubeMat = new THREE.MeshPhysicalMaterial({
      color: cubeColor,
      metalness: 0.3,
      roughness: 0.35,
      clearcoat: 0.6,
      clearcoatRoughness: 0.2,
      emissive: cubeColor,
      emissiveIntensity: 0.15,
    })
    const cube = new THREE.Mesh(cubeGeo, cubeMat)
    scene.add(cube)

    // 立方体边线 — 让"立方体"的轮廓更清晰
    const cubeEdgesGeo = new THREE.EdgesGeometry(cubeGeo)
    const cubeEdgesMat = new THREE.LineBasicMaterial({
      color: isDark ? 0xa5b4fc : 0x4338ca,
      transparent: true,
      opacity: 0.6,
    })
    const cubeWireframe = new THREE.LineSegments(cubeEdgesGeo, cubeEdgesMat)
    cube.add(cubeWireframe)

    // 用户名 sprite — 与技能标签同款,贴在立方体下方
    const usernameSprite = makeLabelSprite(username, cubeColor, isDark)
    usernameSprite.position.set(0, -cubeSize / 2 - 4, 0)  // 立方体下方 4 单位
    usernameSprite.scale.set(36, 9, 1)                    // 比技能标签更大
    scene.add(usernameSprite)

    // 光照
    scene.add(new THREE.AmbientLight(0xffffff, isDark ? 0.65 : 0.85))
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.7)
    dirLight.position.set(50, 80, 100)
    scene.add(dirLight)
    const backLight = new THREE.DirectionalLight(isDark ? 0x818cf8 : 0x6366f1, 0.4)
    backLight.position.set(-60, -40, -50)
    scene.add(backLight)

    // ── 圆盘容器(只用来让技能球 + 连线整体绕 Y 轴公转;立方体在 scene 根下保持静止) ──
    const discGroup = new THREE.Group()
    scene.add(discGroup)

    // ── 连接线:中心立方体 → 技能球(辐条) ──
    const R = 45                                // 圆环半径
    const total = skills.length
    const linePositions = new Float32Array(total * 6)   // N 段 × 2 顶点 × 3 坐标
    const lineColors = new Float32Array(total * 6)

    // 球体颜色按出现顺序去重:每个新球挑"已用最少"的色
    const usedColorCount = new Map<number, number>()
    const sphereColorByIdx: number[] = []
    skills.forEach((skill) => {
      const c = pickUniqueColor(skill, usedColorCount)
      usedColorCount.set(c, (usedColorCount.get(c) ?? 0) + 1)
      sphereColorByIdx.push(c)
    })

    skills.forEach((skill, i) => {
      const pos = circleRing(i, Math.max(total, 1), R)
      // 起:立方体中心(局部 (0,0,0))
      linePositions[i * 6 + 0] = 0
      linePositions[i * 6 + 1] = 0
      linePositions[i * 6 + 2] = 0
      // 终:技能球位置
      linePositions[i * 6 + 3] = pos.x
      linePositions[i * 6 + 4] = pos.y
      linePositions[i * 6 + 5] = pos.z

      // 连线端点颜色 = 球的鲜艳色(独立调色板),起端淡化到 25%
      const c = new THREE.Color(sphereColorByIdx[i])
      lineColors[i * 6 + 0] = c.r * 0.25
      lineColors[i * 6 + 1] = c.g * 0.25
      lineColors[i * 6 + 2] = c.b * 0.25
      lineColors[i * 6 + 3] = c.r
      lineColors[i * 6 + 4] = c.g
      lineColors[i * 6 + 5] = c.b
    })
    const lineGeo = new THREE.BufferGeometry()
    lineGeo.setAttribute('position', new THREE.BufferAttribute(linePositions, 3))
    lineGeo.setAttribute('color', new THREE.BufferAttribute(lineColors, 3))
    const lineMat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: isDark ? 0.5 : 0.6,
    })
    const lines = new THREE.LineSegments(lineGeo, lineMat)
    discGroup.add(lines)

    // ── 技能球 ──
    const skillMeshes: THREE.Mesh[] = []
    const spriteMap = new Map<string, THREE.Sprite>()

    skills.forEach((skill, i) => {
      const cat = classifySkill(skill)
      const meta = CATEGORY_META[cat]
      const pos = circleRing(i, Math.max(total, 1), R)
      // 每球独立鲜艳色(去重后),无灰色
      const sphereColor = sphereColorByIdx[i]

      const sizeBase = 4.2
      const sizeBoost = cat === 'ai' ? 1.35 : cat === 'backend' ? 1.2 : 1
      const radius = sizeBase * sizeBoost

      const geo = new THREE.SphereGeometry(radius, 28, 28)
      const mat = new THREE.MeshPhysicalMaterial({
        color: sphereColor,
        emissive: sphereColor,
        emissiveIntensity: isDark ? 1.1 : 0.85,  // 提高辉光,更鲜艳
        metalness: 0.2,
        roughness: 0.3,
        clearcoat: 0.5,
        transparent: true,
        opacity: 0.95,
      })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.copy(pos)
      mesh.userData.skill = skill
      mesh.userData.category = cat

      // 光圈 — 更亮更宽,跟随球色
      const haloGeo = new THREE.RingGeometry(radius * 1.25, radius * 1.55, 32)
      const haloMat = new THREE.MeshBasicMaterial({
        color: sphereColor,
        transparent: true,
        opacity: isDark ? 0.55 : 0.4,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
      const halo = new THREE.Mesh(haloGeo, haloMat)
      halo.lookAt(camera.position)
      mesh.add(halo)
      mesh.userData.halo = halo

      // 标签 — 描边/填充都用球色,放大
      const sprite = makeLabelSprite(skill, sphereColor, isDark)
      sprite.position.set(0, -radius - 4, 0)   // 球体正下方
      sprite.scale.set(32, 8, 1)               // ← 放大
      mesh.add(sprite)
      spriteMap.set(skill, sprite)

      discGroup.add(mesh)
      skillMeshes.push(mesh)
    })

    // ── 交互 ──
    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    let hoveredMesh: THREE.Mesh | null = null

    const onPointerMove = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect()
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(pointer, camera)
      const hits = raycaster.intersectObjects(skillMeshes, false)
      const hit = hits[0]?.object as THREE.Mesh | undefined
      if (hit !== hoveredMesh) {
        if (hoveredMesh) {
          hoveredMesh.scale.setScalar(1)
          const h = hoveredMesh.userData.halo as THREE.Mesh | undefined
          if (h) (h.material as THREE.MeshBasicMaterial).opacity = isDark ? 0.25 : 0.18
        }
        hoveredMesh = hit ?? null
        if (hoveredMesh) {
          hoveredMesh.scale.setScalar(1.45)
          const h = hoveredMesh.userData.halo as THREE.Mesh | undefined
          if (h) (h.material as THREE.MeshBasicMaterial).opacity = 0.55
          setHoveredSkill(hoveredMesh.userData.skill)
          renderer.domElement.style.cursor = 'pointer'
        } else {
          setHoveredSkill(null)
          renderer.domElement.style.cursor = 'grab'
        }
      }
    }
    renderer.domElement.style.cursor = 'grab'
    renderer.domElement.addEventListener('pointermove', onPointerMove)

    // ── 动画 ──
    const clock = new THREE.Clock()
    let animId = 0
    const tick = () => {
      const t = clock.getElapsedTime()

      // 圆盘绕 Y 轴公转 — 技能球 + 连线随 discGroup 整体环绕立方体
      discGroup.rotation.y += 0.004

      // 立方体自转 — 视觉锚点持续呼吸感
      cube.rotation.x += 0.003
      cube.rotation.y += 0.005

      // 球体呼吸光
      skillMeshes.forEach((g, i) => {
        if (g === hoveredMesh) return
        const base = isDark ? 0.85 : 0.6
        const wave = Math.sin(t * 1.5 + i * 0.7) * 0.2
        const m = g.material as THREE.MeshPhysicalMaterial
        m.emissiveIntensity = base + wave
      })

      // 连接线脉动
      const lineOpacityBase = isDark ? 0.45 : 0.55
      ;(lines.material as THREE.LineBasicMaterial).opacity =
        lineOpacityBase + Math.sin(t * 1.2) * 0.12

      // halo 朝向相机
      skillMeshes.forEach((g) => {
        const halo = g.userData.halo as THREE.Mesh | undefined
        if (halo) halo.lookAt(camera.position)
      })

      controls.update()
      renderer.render(scene, camera)
      animId = requestAnimationFrame(tick)
    }
    tick()

    // resize
    const ro = new ResizeObserver(() => {
      const W = container.clientWidth
      const H = container.clientHeight
      if (W < 10 || H < 10) return
      camera.aspect = W / H
      camera.updateProjectionMatrix()
      renderer.setSize(W, H)
    })
    ro.observe(container)

    // cleanup
    return () => {
      cancelAnimationFrame(animId)
      ro.disconnect()
      controls.dispose()
      renderer.domElement.removeEventListener('pointermove', onPointerMove)
      renderer.dispose()
      cubeGeo.dispose()
      cubeMat.dispose()
      cubeEdgesGeo.dispose()
      cubeEdgesMat.dispose()
      // 用户名 sprite — 释放
      ;(usernameSprite.material as THREE.SpriteMaterial).dispose()
      if (usernameSprite.material.map) usernameSprite.material.map.dispose()
      lineGeo.dispose()
      lineMat.dispose()
      skillMeshes.forEach((g) => {
        g.geometry.dispose()
        const m = g.material as THREE.MeshPhysicalMaterial
        m.dispose()
        const halo = g.userData.halo as THREE.Mesh | undefined
        if (halo) {
          halo.geometry.dispose()
          ;(halo.material as THREE.Material).dispose()
        }
      })
      spriteMap.forEach((s) => {
        ;(s.material as THREE.SpriteMaterial).dispose()
        if (s.material.map) s.material.map.dispose()
      })
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement)
    }
  }, [skills, username, autoRotate, theme])

  // 空状态 — 主题适配
  if (skills.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-2xl border text-sm"
        style={{
          height,
          borderColor: 'var(--color-outline-variant)',
          background: 'var(--color-surface-container-lowest)',
          color: 'var(--color-on-surface-variant)',
        }}
      >
        <span>掌握技能后,这里会展示成 3D 能力星系 🌌</span>
      </div>
    )
  }

  // 浮层颜色 — 主题适配
  const overlayBg = theme === 'dark' ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.85)'
  const overlayText = theme === 'dark' ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.7)'
  const hoverBg = theme === 'dark' ? 'rgba(255,255,255,0.92)' : 'rgba(0,0,0,0.85)'
  const hoverText = theme === 'dark' ? '#0a0e1a' : '#ffffff'

  return (
    <div
      className="relative rounded-2xl border overflow-hidden"
      style={{
        height,
        borderColor: 'var(--color-outline-variant)',
        background: 'transparent',
      }}
    >
      <div ref={containerRef} className="absolute inset-0" />

      {/* 左下图例 */}
      <div
        className="absolute bottom-2 left-2 flex flex-wrap gap-1.5 px-2 py-1.5 rounded-lg"
        style={{ background: overlayBg, backdropFilter: 'blur(8px)' }}
      >
        {(['frontend', 'backend', 'database', 'ai', 'devops', 'mobile', 'product', 'other'] as Category[])
          .filter((c) => (grouped.get(c)?.length ?? 0) > 0)
          .map((c) => (
            <span key={c} className="flex items-center gap-1 text-[10px]" style={{ color: overlayText }}>
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ background: `#${CATEGORY_META[c].color.toString(16).padStart(6, '0')}` }}
              />
              {CATEGORY_META[c].label} · {grouped.get(c)!.length}
            </span>
          ))}
      </div>

      {/* 右上统计 */}
      <div
        className="absolute top-2 right-2 text-[10px] px-2 py-1 rounded-lg"
        style={{ background: overlayBg, backdropFilter: 'blur(8px)', color: overlayText }}
      >
        共 <b>{skills.length}</b> 颗技能星 · 拖动旋转 / 滚轮缩放
      </div>

      {/* hover 浮窗 */}
      {hoveredSkill && (
        <div
          className="absolute top-2 left-1/2 -translate-x-1/2 text-xs px-2.5 py-1 rounded-lg font-semibold pointer-events-none"
          style={{ background: hoverBg, color: hoverText, boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}
        >
          {hoveredSkill}
          <span className="ml-1.5 text-[10px] font-normal opacity-60">
            · {CATEGORY_META[classifySkill(hoveredSkill)].label}
          </span>
        </div>
      )}
    </div>
  )
}