<template>
  <view class="skillgraph-page">
    <view class="sg-main">
      <view class="sg-canvas-wrap">
        <canvas
          id="graphCanvas"
          canvas-id="graphCanvas"
          class="sg-canvas"
          @touchstart="onTouchStart"
          @touchmove="onTouchMove"
          @touchend="onTouchEnd"
          @tap="onCanvasTap"
        ></canvas>

        <view class="sg-filter-bar">
          <view
            v-for="c in catList"
            :key="c"
            class="sg-filter-btn"
            :class="{ active: activeCat === c }"
            @tap="activeCat = c"
          >
            <text>{{ c }}</text>
          </view>
        </view>

        <view class="sg-hint">
          <text>拖动旋转 · 双指缩放 · 点击聚焦</text>
        </view>
      </view>

      <view class="sg-sidebar">
        <view class="sg-legend">
          <text class="sg-legend-title">图例</text>
          <view v-for="i in legendItems" :key="i.l" class="sg-legend-row">
            <view class="sg-legend-dot" :style="{ background: i.c }"></view>
            <text class="sg-legend-label">{{ i.l }}</text>
          </view>
          <view class="sg-legend-row">
            <view class="sg-legend-circle"></view>
            <text class="sg-legend-label">技能节点</text>
          </view>
        </view>

        <view class="sg-stats">
          <text class="sg-stats-title">统计</text>
          <text class="sg-stats-item">岗位节点: {{ stats.jobCount }}</text>
          <text class="sg-stats-item">技能节点: {{ stats.skillCount }}</text>
          <text class="sg-stats-item">关联关系: {{ stats.linkCount }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, inject } from 'vue'

const nav = inject('jobseekerNav')

const catList = ['全部', 'AI', '后端', '数据', '运维']
const activeCat = ref('全部')

const graphNodes = [
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

const graphLinks = [
  ['j1', 's1'], ['j1', 's4'], ['j1', 's7'], ['j5', 's1'], ['j5', 's4'], ['j5', 's9'], ['j5', 's14'],
  ['j2', 's2'], ['j2', 's3'], ['j2', 's5'], ['j2', 's6'], ['j2', 's11'],
  ['j3', 's1'], ['j3', 's8'], ['j3', 's12'], ['j4', 's5'], ['j4', 's6'],
  ['j6', 's10'], ['j6', 's13'],
  ['s1', 's4'], ['s1', 's7'], ['s5', 's6'], ['s2', 's3'], ['s4', 's14'], ['s4', 's9'],
]

const legendItems = [
  { c: '#00C8FF', l: 'AI类' },
  { c: '#7C3AED', l: '后端类' },
  { c: '#00E599', l: '数据类' },
  { c: '#FF8C42', l: '运维类' },
]

const stats = computed(() => ({
  jobCount: graphNodes.filter(n => n.type === 'job').length,
  skillCount: graphNodes.filter(n => n.type === 'skill').length,
  linkCount: graphLinks.length,
}))

// ---- Canvas graph rendering ----
let canvas = null
let ctx = null
let animId = null
let rotationAngle = 0
let autoRotate = true
let focalLength = 120
let zoom = 1
let offsetX = 0
let offsetY = 0
let dragStartX = 0
let dragStartY = 0
let dragStartAngle = 0
let isDragging = false
let lastTouchDist = 0

const nodePositions = []
const nodeSizes = []

function initPositions() {
  nodePositions.length = 0
  nodeSizes.length = 0
  graphNodes.forEach((n, i) => {
    const angle = (i / graphNodes.length) * Math.PI * 2
    const r = n.type === 'job' ? 30 : 55
    const x = Math.cos(angle) * r + (Math.random() - 0.5) * 6
    const z = Math.sin(angle) * r + (Math.random() - 0.5) * 6
    const y = (Math.random() - 0.5) * 12
    nodePositions.push({ x, y, z, r })
    nodeSizes.push(n.type === 'job' ? 5.5 : 3.8)
  })
}

function project3D(pos, angle) {
  const cosA = Math.cos(angle)
  const sinA = Math.sin(angle)
  const rx = pos.x * cosA - pos.z * sinA
  const rz = pos.x * sinA + pos.z * cosA
  const ry = pos.y
  const scale = focalLength / (focalLength + rz * zoom)
  return { sx: rx * scale, sy: ry * scale, sz: rz, scale }
}

function getNodeColor(node) {
  const c = node.color
  return c
}

function drawGraph() {
  if (!ctx || !canvas) return
  const w = canvas.width / canvas._dpr
  const h = canvas.height / canvas._dpr
  ctx.clearRect(0, 0, w, h)

  const cx = w / 2 + offsetX
  const cy = h / 2 + offsetY

  const projected = graphNodes.map((n, i) => {
    const p = project3D(nodePositions[i], rotationAngle)
    return { ...p, node: n, idx: i }
  })

  projected.sort((a, b) => a.sz - b.sz)

  const time = Date.now() / 1000

  // Draw links
  graphLinks.forEach(([src, tgt]) => {
    const si = graphNodes.findIndex(n => n.id === src)
    const ti = graphNodes.findIndex(n => n.id === tgt)
    if (si === -1 || ti === -1) return
    const a = projected[si]
    const b = projected[ti]
    const avgZ = (a.sz + b.sz) / 2
    const opacity = Math.max(0.02, 0.12 - (avgZ + 60) / 200 * 0.1)
    ctx.beginPath()
    ctx.moveTo(a.sx + cx, a.sy + cy)
    const midX = (a.sx + b.sx) / 2 + cx
    const midY = (a.sy + b.sy) / 2 + cy - 10
    ctx.quadraticCurveTo(midX, midY, b.sx + cx, b.sy + cy)
    ctx.strokeStyle = `rgba(68, 136, 204, ${opacity})`
    ctx.lineWidth = 1.2
    ctx.stroke()
  })

  // Draw nodes
  projected.forEach((p) => {
    const n = p.node
    const sc = p.scale
    const baseSize = (n.type === 'job' ? 5.5 : 3.8) * sc
    const x = p.sx + cx
    const y = p.sy + cy
    const color = getNodeColor(n)

    // Glow
    ctx.beginPath()
    if (n.type === 'job') {
      const gs = baseSize + 8
      roundRect(ctx, x - gs / 2, y - gs / 2, gs, gs, 4)
    } else {
      ctx.arc(x, y, baseSize + 4, 0, Math.PI * 2)
    }
    ctx.fillStyle = color + '1A'
    ctx.fill()

    // Node body
    ctx.beginPath()
    if (n.type === 'job') {
      roundRect(ctx, x - baseSize / 2, y - baseSize / 2, baseSize, baseSize, 3)
    } else {
      ctx.arc(x, y, baseSize, 0, Math.PI * 2)
    }
    ctx.fillStyle = color
    ctx.globalAlpha = 0.95
    ctx.fill()
    ctx.globalAlpha = 1

    // Wireframe ring
    ctx.beginPath()
    if (n.type === 'job') {
      const rs = baseSize + 8
      roundRect(ctx, x - rs / 2, y - rs / 2, rs, rs, 4)
    } else {
      ctx.arc(x, y, baseSize + 4, 0, Math.PI * 2)
    }
    ctx.strokeStyle = color + '20'
    ctx.lineWidth = 1.5
    ctx.stroke()

    // Label
    const fontSize = Math.max(12, 14 * sc)
    ctx.font = `bold ${fontSize}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    const labelY = y + baseSize + 6
    ctx.shadowColor = 'rgba(0,0,0,0.6)'
    ctx.shadowBlur = 4
    ctx.fillStyle = '#f0f4ff'
    ctx.fillText(n.name, x, labelY)
    ctx.shadowBlur = 0
  })
}

function renderLoop() {
  if (autoRotate) {
    rotationAngle += 0.005
  }
  drawGraph()
  animId = requestAnimationFrame(renderLoop)
}

function roundRect(ctx, x, y, w, h, r) {
  if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return }
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
}

function initCanvas() {
  const query = uni.createSelectorQuery()
  query.select('#graphCanvas').fields({ node: true, size: true }).exec((res) => {
    if (!res[0]) {
      setTimeout(initCanvas, 100)
      return
    }
    const c = res[0].node
    const size = res[0]
    canvas = c
    const dpr = uni.getSystemInfoSync().pixelRatio || 2
    canvas.width = size.width * dpr
    canvas.height = size.height * dpr
    ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)
    canvas._dpr = dpr
    initPositions()
    renderLoop()
  })
}

onMounted(() => {
  setTimeout(initCanvas, 200)
})

onUnmounted(() => {
  if (animId) cancelAnimationFrame(animId)
})

function onTouchStart(e) {
  const t = e.touches[0]
  if (e.touches.length === 2) {
    lastTouchDist = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY
    )
    return
  }
  dragStartX = t.clientX
  dragStartY = t.clientY
  dragStartAngle = rotationAngle
  isDragging = false
}

function onTouchMove(e) {
  if (e.touches.length === 2) {
    const dist = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY
    )
    if (lastTouchDist) {
      const delta = dist - lastTouchDist
      zoom = Math.max(0.4, Math.min(3, zoom + delta * 0.005))
    }
    lastTouchDist = dist
    autoRotate = false
    return
  }
  const t = e.touches[0]
  const dx = t.clientX - dragStartX
  const dy = t.clientY - dragStartY
  if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
    isDragging = true
    autoRotate = false
    rotationAngle = dragStartAngle + dx * 0.01
    // Also allow vertical offset for pan effect
    offsetX = dx * 0.3
    offsetY = dy * 0.3
  }
}

function onTouchEnd(e) {
  if (!isDragging) {
    setTimeout(() => { autoRotate = true }, 5000)
  }
  lastTouchDist = 0
  // Re-enable auto-rotate after a delay
  setTimeout(() => { autoRotate = true }, 5000)
}

function onCanvasTap(e) {
  if (!canvas || !ctx) return
  const rect = e.detail
  if (!rect) return
  const tapX = rect.x || 0
  const tapY = rect.y || 0
  const w = canvas.width / canvas._dpr
  const h = canvas.height / canvas._dpr
  const cx = w / 2 + offsetX
  const cy = h / 2 + offsetY

  let minDist = 40
  let targetIdx = -1
  graphNodes.forEach((n, i) => {
    const p = project3D(nodePositions[i], rotationAngle)
    const sc = p.scale
    const baseSize = (n.type === 'job' ? 5.5 : 3.8) * sc
    const nx = p.sx + cx
    const ny = p.sy + cy
    const dist = Math.hypot(tapX - nx, tapY - ny)
    if (dist < minDist) {
      minDist = dist
      targetIdx = i
    }
  })
  if (targetIdx >= 0) {
    autoRotate = false
    // Focus on the node by moving the center
    offsetX = -nodePositions[targetIdx].x * 0.3
    offsetY = -nodePositions[targetIdx].y * 0.3
    setTimeout(() => { autoRotate = true }, 5000)
  }
}
</script>

<style scoped>
.skillgraph-page { height: 100%; padding: 24rpx; }
.sg-main { display: flex; gap: 24rpx; height: 100%; }
.sg-canvas-wrap { flex: 1; position: relative; border-radius: 24rpx; border: 1rpx solid var(--color-outline-variant); background: var(--color-surface-container-lowest); overflow: hidden; min-height: 500rpx; }
.sg-canvas { width: 100%; height: 100%; }
.sg-filter-bar { position: absolute; top: 24rpx; left: 24rpx; display: flex; gap: 12rpx; z-index: 10; }
.sg-filter-btn { padding: 12rpx 24rpx; border-radius: 12rpx; font-size: 22rpx; font-weight: 600; background: rgba(0,0,0,0.35); color: rgba(255,255,255,0.7); }
.sg-filter-btn.active { background: var(--color-primary); color: var(--color-on-primary); }
.sg-hint { position: absolute; bottom: 32rpx; left: 50%; transform: translateX(-50%); padding: 16rpx 40rpx; border-radius: 40rpx; font-size: 22rpx; background: rgba(0,0,0,0.45); color: rgba(255,255,255,0.6); white-space: nowrap; z-index: 10; }
.sg-sidebar { width: 280rpx; flex: none; display: flex; flex-direction: column; gap: 24rpx; }
.sg-legend { padding: 32rpx; border-radius: 24rpx; border: 1rpx solid var(--color-outline-variant); background: var(--color-surface-container-lowest); }
.sg-legend-title { font-size: 24rpx; font-weight: 700; color: var(--color-on-surface); margin-bottom: 24rpx; display: block; }
.sg-legend-row { display: flex; align-items: center; gap: 12rpx; margin-bottom: 16rpx; }
.sg-legend-dot { width: 20rpx; height: 20rpx; border-radius: 4rpx; flex: none; }
.sg-legend-circle { width: 20rpx; height: 20rpx; border-radius: 50%; background: #38BDF8; flex: none; }
.sg-legend-label { font-size: 22rpx; color: var(--color-on-surface-variant); }
.sg-stats { padding: 32rpx; border-radius: 24rpx; border: 1rpx solid var(--color-outline-variant); background: var(--color-surface-container-lowest); }
.sg-stats-title { font-size: 24rpx; font-weight: 700; color: var(--color-on-surface); margin-bottom: 16rpx; display: block; }
.sg-stats-item { font-size: 22rpx; color: var(--color-on-surface-variant); margin-bottom: 12rpx; display: block; }
</style>