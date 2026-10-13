<template>
  <view class="insight3d-container">
    <!-- #ifdef H5 -->
    <canvas
      id="insight3dCanvas"
      class="insight3d-canvas"
      @touchstart="onTouchStart"
      @touchmove="onTouchMove"
      @touchend="onTouchEnd"
      @tap="onTap"
    ></canvas>
    <!-- #endif -->
    <!-- #ifndef H5 -->
    <canvas
      canvas-id="insight3dCanvas"
      id="insight3dCanvas"
      class="insight3d-canvas"
      @touchstart="onTouchStart"
      @touchmove="onTouchMove"
      @touchend="onTouchEnd"
      @tap="onTap"
    ></canvas>
    <!-- #endif -->
  </view>
</template>

<script setup>
import { onMounted, onBeforeUnmount } from 'vue'
import * as THREE from 'three'

const emit = defineEmits(['node-select'])

/* ================================================================
   场景数据 — 与 Web Graph3D.tsx 1:1 对应
   ================================================================ */
const NODES = [
  { id: 'j1', name: 'AI应用开发', type: 'job', val: 9, color: '#00C8FF', group: 'ai' },
  { id: 'j2', name: 'Java后端', type: 'job', val: 8, color: '#7C3AED', group: 'backend' },
  { id: 'j3', name: '大数据工程', type: 'job', val: 7, color: '#00E599', group: 'data' },
  { id: 'j4', name: '云原生', type: 'job', val: 6, color: '#FF8C42', group: 'ops' },
  { id: 'j5', name: 'AI Agent', type: 'job', val: 7, color: '#00C8FF', group: 'ai' },
  { id: 'j6', name: '前端开发', type: 'job', val: 6, color: '#FF4D6A', group: 'frontend' },
  { id: 's1', name: 'Python', type: 'skill', val: 5, color: '#38BDF8' },
  { id: 's2', name: 'Java', type: 'skill', val: 5, color: '#A78BFA' },
  { id: 's3', name: 'SpringBoot', type: 'skill', val: 4, color: '#C084FC' },
  { id: 's4', name: 'LangChain', type: 'skill', val: 4, color: '#2DD4BF' },
  { id: 's5', name: 'K8s', type: 'skill', val: 4, color: '#FBBF24' },
  { id: 's6', name: 'Docker', type: 'skill', val: 3, color: '#FCD34D' },
  { id: 's7', name: 'RAG', type: 'skill', val: 5, color: '#34D399' },
  { id: 's8', name: 'Spark', type: 'skill', val: 3, color: '#FB923C' },
  { id: 's9', name: 'MCP协议', type: 'skill', val: 4, color: '#38BDF8' },
  { id: 's10', name: 'React', type: 'skill', val: 4, color: '#F472B6' },
  { id: 's11', name: 'MySQL', type: 'skill', val: 3, color: '#A3E635' },
  { id: 's12', name: 'Flink', type: 'skill', val: 3, color: '#FB923C' },
  { id: 's13', name: 'TypeScript', type: 'skill', val: 3, color: '#60A5FA' },
  { id: 's14', name: 'Agent框架', type: 'skill', val: 4, color: '#2DD4BF' },
]

const LINKS = [
  ['j1', 's1'], ['j1', 's4'], ['j1', 's7'],
  ['j5', 's1'], ['j5', 's4'], ['j5', 's9'], ['j5', 's14'],
  ['j2', 's2'], ['j2', 's3'], ['j2', 's5'], ['j2', 's6'], ['j2', 's11'],
  ['j3', 's1'], ['j3', 's8'], ['j3', 's12'],
  ['j4', 's5'], ['j4', 's6'],
  ['j6', 's10'], ['j6', 's13'],
  ['s1', 's4'], ['s1', 's7'], ['s5', 's6'], ['s2', 's3'], ['s4', 's14'], ['s4', 's9'],
]

/* ================================================================
   Three.js 状态
   ================================================================ */
let scene = null
let camera = null
let renderer = null
let clock = null
let animId = null
let nodeGroups = []
let posMap = new Map()
let autoRotate = true
let isDragging = false
let canvasW = 0
let canvasH = 0
let initialized = false

/* ================================================================
   相机轨道控制 — 球坐标系
   ================================================================ */
let camTheta = Math.atan2(70, 80)
let camPhi = Math.asin(40 / Math.sqrt(70 * 70 + 40 * 40 + 80 * 80))
let camDist = Math.sqrt(70 * 70 + 40 * 40 + 80 * 80)

let touchStartX = 0
let touchStartY = 0
let touchStartTheta = 0
let touchStartPhi = 0
let lastPinchDist = 0

function updateCamera() {
  if (!camera) return
  camera.position.x = camDist * Math.cos(camPhi) * Math.sin(camTheta)
  camera.position.y = camDist * Math.sin(camPhi)
  camera.position.z = camDist * Math.cos(camPhi) * Math.cos(camTheta)
  camera.lookAt(0, 0, 0)
}

/* ================================================================
   获取 Canvas — H5 用 document.getElementById，小程序用 selectorQuery
   ================================================================ */
function getCanvasNode() {
  return new Promise((resolve) => {
    // #ifdef H5
    const findRealCanvas = () => {
      const wrapper = document.getElementById('insight3dCanvas')
      if (!wrapper) {
        console.warn('[MarketInsight3D] H5 wrapper not found')
        return null
      }
      // If the element itself is already a real canvas
      if (wrapper instanceof HTMLCanvasElement && typeof wrapper.getContext === 'function') {
        return wrapper
      }
      // UniApp wraps <canvas> inside <uni-canvas>, dig inside
      const canvas = wrapper.querySelector('canvas')
      if (!canvas) {
        console.warn('[MarketInsight3D] H5 real canvas not found inside wrapper')
        return null
      }
      if (canvas.tagName !== 'CANVAS' || typeof canvas.getContext !== 'function') {
        console.warn('[MarketInsight3D] H5 element is not a valid HTMLCanvasElement')
        return null
      }
      if (canvas.clientWidth <= 0 || canvas.clientHeight <= 0) {
        console.warn('[MarketInsight3D] H5 real canvas has invalid size:', canvas.clientWidth, canvas.clientHeight)
        return null
      }
      return canvas
    }

    const canvas = findRealCanvas()
    if (canvas) {
      console.log('[MarketInsight3D] H5 REAL canvas found:', canvas.tagName, 'buffer:', canvas.width, 'x', canvas.height, 'client:', canvas.clientWidth, 'x', canvas.clientHeight)
      resolve(canvas)
      return
    }

    console.warn('[MarketInsight3D] H5 real canvas not ready, retrying in 300ms...')
    setTimeout(() => {
      const retryCanvas = findRealCanvas()
      if (retryCanvas) {
        console.log('[MarketInsight3D] H5 REAL canvas found on retry:', retryCanvas.tagName, 'buffer:', retryCanvas.width, 'x', retryCanvas.height)
        resolve(retryCanvas)
      } else {
        console.error('[MarketInsight3D] H5 real canvas acquisition failed')
        resolve(null)
      }
    }, 300)
    // #endif

    // #ifndef H5
    const query = uni.createSelectorQuery()
    query.select('#insight3dCanvas').fields({ node: true, size: true }).exec((res) => {
      if (res[0] && res[0].node) {
        console.log('[MarketInsight3D] mp canvas found:', res[0].width, 'x', res[0].height)
        resolve({ node: res[0].node, width: res[0].width, height: res[0].height })
      } else {
        console.warn('[MarketInsight3D] mp canvas not found, retrying...')
        setTimeout(() => {
          const q2 = uni.createSelectorQuery()
          q2.select('#insight3dCanvas').fields({ node: true, size: true }).exec((res2) => {
            if (res2[0] && res2[0].node) {
              resolve({ node: res2[0].node, width: res2[0].width, height: res2[0].height })
            } else {
              console.error('[MarketInsight3D] mp canvas still not found')
              resolve(null)
            }
          })
        }, 300)
      }
    })
    // #endif
  })
}

/* ================================================================
   创建标签纹理 — 使用 document.createElement('canvas')
   ================================================================ */
function createLabelTexture(name) {
  // #ifdef H5
  try {
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 80
    const ctx = c.getContext('2d')
    ctx.clearRect(0, 0, 256, 80)
    ctx.fillStyle = '#1F2937'
    ctx.font = 'bold 22px "Noto Sans SC", "Microsoft YaHei", sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(name, 128, 40)
    const tex = new THREE.CanvasTexture(c)
    tex.needsUpdate = true
    return tex
  } catch (e) {
    console.warn('[MarketInsight3D] createLabelTexture failed:', e)
    return null
  }
  // #endif
  // #ifndef H5
  return null
  // #endif
}

/* ================================================================
   构建完整 3D 场景
   ================================================================ */
function buildScene(canvas, w, h) {
  console.log('[MarketInsight3D] Building scene on canvas:', w, 'x', h)

  // ── Scene ──
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0xffffff)
  console.log('[MarketInsight3D] Scene created')

  // ── Camera ──
  camera = new THREE.PerspectiveCamera(50, w / h, 1, 600)
  updateCamera()
  console.log('[MarketInsight3D] Camera created, aspect:', (w / h).toFixed(2))

  // ── Renderer ──
  const dpr = uni.getSystemInfoSync().pixelRatio || 2
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false })
  renderer.setSize(w, h)
  renderer.setPixelRatio(Math.min(dpr, 2))

  const gl = renderer.getContext()
  if (!gl) {
    throw new Error('[MarketInsight3D] WebGL context creation failed')
  }
  console.log('[MarketInsight3D] WebGL context created:', gl.getParameter(gl.VERSION))
  console.log('[MarketInsight3D] Renderer canvas tag:', renderer.domElement?.tagName)
  if (renderer.domElement?.tagName !== 'CANVAS') {
    throw new Error('[MarketInsight3D] Renderer domElement is not CANVAS')
  }

  // ── Lights ──
  const ambient = new THREE.AmbientLight(0xffffff, 1.5)
  scene.add(ambient)
  const dir1 = new THREE.DirectionalLight(0xffffff, 2.0)
  dir1.position.set(40, 80, 60)
  scene.add(dir1)
  const dir2 = new THREE.DirectionalLight(0xffffff, 1.0)
  dir2.position.set(-50, 30, -60)
  scene.add(dir2)
  const dir3 = new THREE.DirectionalLight(0xffffff, 0.6)
  dir3.position.set(-30, 20, 50)
  scene.add(dir3)
  console.log('[MarketInsight3D] Lights added')

  // ── Nodes ──
  NODES.forEach((n, i) => {
    const angle = (i / NODES.length) * Math.PI * 2
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
    const mat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.15,
      metalness: 0.1,
      roughness: 0.4,
      transparent: true,
      opacity: 0.95,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.copy(pos)
    mesh.castShadow = true

    // Glow ring
    const ringGeo = isJob
      ? new THREE.BoxGeometry(size + 1.2, size + 1.2, size + 1.2)
      : new THREE.SphereGeometry(size + 0.8, 16, 16)
    const ringMat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.18, wireframe: true,
    })
    const ring = new THREE.Mesh(ringGeo, ringMat)
    ring.position.copy(pos)

    const group = new THREE.Group()
    group.add(mesh)
    group.add(ring)

    // Label sprite
    const tex = createLabelTexture(n.name)
    if (tex) {
      const spriteMat = new THREE.SpriteMaterial({
        map: tex, transparent: true, depthTest: false, sizeAttenuation: true,
      })
      const sprite = new THREE.Sprite(spriteMat)
      sprite.scale.set(16, 6, 1)
      sprite.position.set(x, y + (isJob ? -7.5 : -6.5), z)
      group.add(sprite)
    }

    group.userData = { id: n.id, name: n.name, type: n.type, isJob }
    scene.add(group)
    nodeGroups.push(group)
  })
  console.log('[MarketInsight3D] Nodes created:', nodeGroups.length)

  // ── Links ──
  let linkCount = 0
  LINKS.forEach(([s, t]) => {
    const a = posMap.get(s)
    const b = posMap.get(t)
    if (!a || !b) return

    const points = []
    const steps = 12
    for (let i = 0; i <= steps; i++) {
      const tt = i / steps
      const midY = (a.y + b.y) / 2 - 5 * Math.sin(tt * Math.PI)
      points.push(new THREE.Vector3(
        a.x + (b.x - a.x) * tt,
        a.y + (b.y - a.y) * tt + (midY - (a.y + b.y) / 2),
        a.z + (b.z - a.z) * tt,
      ))
    }

    const curveGeo = new THREE.BufferGeometry().setFromPoints(points)
    const curveMat = new THREE.LineBasicMaterial({
      color: 0x6b8fc7, transparent: true, opacity: 0.35,
    })
    scene.add(new THREE.Line(curveGeo, curveMat))
    linkCount++
  })
  console.log('[MarketInsight3D] Links created:', linkCount)

  // ── Clock ──
  clock = new THREE.Clock()

  // ── Initial render ──
  renderer.render(scene, camera)
  console.log('[MarketInsight3D] Initial render done')

  // ── Start animation ──
  animate()
}

/* ================================================================
   Three.js 初始化入口
   ================================================================ */
async function initThree() {
  if (initialized) {
    console.log('[MarketInsight3D] Already initialized, skip')
    return
  }
  initialized = true

  console.log('[MarketInsight3D] Starting initialization...')

  const result = await getCanvasNode()
  if (!result) {
    console.error('[MarketInsight3D] Canvas acquisition failed, abort')
    initialized = false
    return
  }

  let canvas, w, h

  // #ifdef H5
  canvas = result
  if (!(canvas instanceof HTMLCanvasElement)) {
    console.error('[MarketInsight3D] Expected HTMLCanvasElement but received:', canvas?.tagName)
    initialized = false
    return
  }
  console.log('[MarketInsight3D] Using native canvas:', canvas.tagName, 'buffer:', canvas.width, 'x', canvas.height)
  const rect = canvas.getBoundingClientRect()
  w = rect.width > 0 ? rect.width : canvas.clientWidth
  h = rect.height > 0 ? rect.height : canvas.clientHeight
  if (w < 10 || h < 10) {
    const style = window.getComputedStyle(canvas)
    w = parseFloat(style.width) || 300
    h = parseFloat(style.height) || 200
  }
  console.log('[MarketInsight3D] CSS display size:', w.toFixed(1), 'x', h.toFixed(1))
  // #endif

  // #ifndef H5
  canvas = result.node
  w = result.width
  h = result.height
  // #endif

  canvasW = w
  canvasH = h

  console.log('[MarketInsight3D] Canvas ready:', canvasW, 'x', canvasH)

  if (canvasW < 10 || canvasH < 10) {
    console.error('[MarketInsight3D] Canvas too small:', canvasW, canvasH)
    initialized = false
    setTimeout(initThree, 500)
    return
  }

  try {
    buildScene(canvas, canvasW, canvasH)
    console.log('[MarketInsight3D] Initialization complete, nodes:', nodeGroups.length)
  } catch (err) {
    console.error('[MarketInsight3D] Build scene failed:', err)
    initialized = false
  }
}

/* ================================================================
   动画循环 — 自动旋转 + 节点脉冲
   ================================================================ */
function animate() {
  animId = requestAnimationFrame(animate)

  if (autoRotate) {
    camTheta += 0.003
  }

  updateCamera()

  if (clock && nodeGroups.length > 0) {
    const t = clock.getElapsedTime()
    nodeGroups.forEach((g, i) => {
      g.children.forEach((ch) => {
        if (ch.isMesh && !ch.isSprite) {
          ch.material.emissiveIntensity = 0.1 + 0.05 * Math.sin(t * 0.8 + i * 0.5)
        }
      })
    })
  }

  if (renderer && scene && camera) {
    renderer.render(scene, camera)
  }
}

/* ================================================================
   触摸交互 — 旋转 / 缩放 / 点击
   ================================================================ */
function onTouchStart(e) {
  if (e.touches.length === 2) {
    const dx = e.touches[0].clientX - e.touches[1].clientX
    const dy = e.touches[0].clientY - e.touches[1].clientY
    lastPinchDist = Math.sqrt(dx * dx + dy * dy)
    return
  }

  const t = e.touches[0]
  touchStartX = t.clientX
  touchStartY = t.clientY
  touchStartTheta = camTheta
  touchStartPhi = camPhi
  isDragging = false
}

function onTouchMove(e) {
  if (e.touches.length === 2) {
    const dx = e.touches[0].clientX - e.touches[1].clientX
    const dy = e.touches[0].clientY - e.touches[1].clientY
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (lastPinchDist > 0) {
      const scale = lastPinchDist / dist
      camDist = Math.max(25, Math.min(200, camDist * scale))
    }
    lastPinchDist = dist
    autoRotate = false
    return
  }

  const t = e.touches[0]
  const dx = t.clientX - touchStartX
  const dy = t.clientY - touchStartY

  if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
    isDragging = true
    autoRotate = false
    camTheta = touchStartTheta - dx * 0.008
    camPhi = Math.max(-1.2, Math.min(1.2, touchStartPhi + dy * 0.008))
  }
}

function onTouchEnd() {
  lastPinchDist = 0
  if (isDragging) {
    setTimeout(() => { autoRotate = true }, 5000)
  }
}

function onTap(e) {
  if (isDragging) return

  const tapX = e.detail.x || 0
  const tapY = e.detail.y || 0

  if (!renderer || !camera || !scene) return

  const pointer = new THREE.Vector2(
    (tapX / canvasW) * 2 - 1,
    -(tapY / canvasH) * 2 + 1
  )

  const raycaster = new THREE.Raycaster()
  raycaster.setFromCamera(pointer, camera)

  const meshes = []
  nodeGroups.forEach(g => {
    g.children.forEach(ch => {
      if (ch.isMesh && !ch.isSprite) meshes.push(ch)
    })
  })

  const hits = raycaster.intersectObjects(meshes)
  if (hits.length > 0) {
    const hit = hits[0].object.parent
    if (hit && hit.userData && hit.userData.id) {
      emit('node-select', hit.userData)
      return
    }
  }
  emit('node-select', null)
}

/* ================================================================
   生命周期
   ================================================================ */
onMounted(() => {
  console.log('[MarketInsight3D] Mounted, starting init in 300ms')
  setTimeout(initThree, 300)
})

onBeforeUnmount(() => {
  console.log('[MarketInsight3D] Unmounting, cleaning up')
  if (animId) {
    cancelAnimationFrame(animId)
    animId = null
  }
  autoRotate = false

  if (renderer) {
    renderer.dispose()
    renderer = null
  }

  nodeGroups.forEach(g => {
    g.children.forEach(ch => {
      if (ch.geometry) ch.geometry.dispose()
      if (ch.material) {
        if (ch.material.map) ch.material.map.dispose()
        ch.material.dispose()
      }
    })
  })

  scene = null
  camera = null
  clock = null
  nodeGroups = []
  posMap.clear()
  initialized = false
})
</script>

<style>
.insight3d-container {
  width: 100%;
  height: 100%;
  position: relative;
  border-radius: 16rpx;
  overflow: hidden;
  background: #ffffff;
}

.insight3d-canvas {
  width: 100%;
  height: 100%;
  display: block;
}
</style>
