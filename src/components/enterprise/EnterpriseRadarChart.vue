<template>
  <view class="ets-radar-wrap">
    <view class="ets-radar-svg-box" :style="{ width: size + 'px', height: size + 'px' }">
      <svg :width="size" :height="size" :viewBox="'0 0 ' + size + ' ' + size">
        <!-- 网格多边形 -->
        <polygon
          v-for="(ring, ri) in gridRings"
          :key="'ring-' + ri"
          :points="ringPoints(ring)"
          fill="none"
          stroke="var(--color-outline-variant)"
          :stroke-width="1"
          opacity="0.5"
        />
        <!-- 轴线 -->
        <line
          v-for="(_, ai) in axes"
          :key="'axis-' + ai"
          :x1="center"
          :y1="center"
          :x2="axisPoint(ai, maxRadius).x"
          :y2="axisPoint(ai, maxRadius).y"
          stroke="var(--color-outline-variant)"
          :stroke-width="1"
          opacity="0.5"
        />
        <!-- 候选人多边形 -->
        <polygon
          v-for="(c, ci) in candidates"
          :key="'poly-' + ci"
          :points="polygonPoints(c)"
          :fill="getColor(ci)"
          fill-opacity="0.12"
          :stroke="getColor(ci)"
          :stroke-width="2"
        />
        <!-- 轴标签 -->
        <text
          v-for="(axis, ai) in axes"
          :key="'label-' + axis.key"
          :x="axisPoint(ai, maxRadius + 22).x"
          :y="axisPoint(ai, maxRadius + 22).y"
          text-anchor="middle"
          dominant-baseline="middle"
          :font-size="12"
          font-weight="500"
          fill="var(--color-on-surface)"
        >{{ axis.label }}</text>
        <!-- 顶点分数 -->
        <template v-for="(c, ci) in candidates" :key="'scores-' + ci">
          <text
            v-for="(axis, ai) in axes"
            :key="'score-' + ci + '-' + axis.key"
            :x="getScorePoint(c, ai).x"
            :y="getScorePoint(c, ai).y"
            text-anchor="middle"
            dominant-baseline="middle"
            :font-size="10"
            font-weight="600"
            :fill="getColor(ci)"
          >{{ getScore(c, axis.key) }}</text>
        </template>
      </svg>
    </view>
  </view>
</template>

<script setup>
import { computed } from 'vue'

const COMPARE_COLOR_POOL = [
  'var(--color-primary)',
  'var(--accent-green)',
  'var(--accent-purple)',
  'var(--accent-orange)',
  '#E91E63',
  '#00BCD4',
  '#795548',
  '#607D8B',
  '#FF5722',
  '#3F51B5',
]

const DIMENSIONS = [
  { key: 'skill', label: '技能' },
  { key: 'exp', label: '经验' },
  { key: 'edu', label: '学历' },
  { key: 'location', label: '地域' },
  { key: 'salary', label: '薪资' },
]

const props = defineProps({
  candidates: { type: Array, default: () => [] },
  size: { type: Number, default: 280 },
})

const center = computed(() => props.size / 2)
const maxRadius = computed(() => (props.size - 60) / 2)
const axes = DIMENSIONS
const n = axes.length
const gridRings = [0.2, 0.4, 0.6, 0.8, 1.0]

function getColor(idx) {
  if (idx < COMPARE_COLOR_POOL.length) return COMPARE_COLOR_POOL[idx]
  const hue = (idx * 137.5) % 360
  return 'hsl(' + hue + ', 65%, 50%)'
}

function axisPoint(index, radius) {
  const angle = (Math.PI * 2 * index) / n - Math.PI / 2
  return {
    x: center.value + radius * Math.cos(angle),
    y: center.value + radius * Math.sin(angle),
  }
}

function ringPoints(ring) {
  return axes.map((_, i) => {
    const pt = axisPoint(i, maxRadius.value * ring)
    return pt.x + ',' + pt.y
  }).join(' ')
}

function polygonPoints(c) {
  return axes.map((axis, i) => {
    const score = getScore(c, axis.key)
    const radius = (score / 100) * maxRadius.value
    const pt = axisPoint(i, radius)
    return pt.x + ',' + pt.y
  }).join(' ')
}

function getScore(c, key) {
  if (!c || !c.match_breakdown) return 0
  const v = c.match_breakdown[key]
  return (v != null) ? v : 0
}

function getScorePoint(c, axisIndex) {
  const axis = axes[axisIndex]
  const score = getScore(c, axis.key)
  const radius = (score / 100) * maxRadius.value
  return axisPoint(axisIndex, radius)
}
</script>

<style>
.ets-radar-wrap {
  display: flex;
  justify-content: center;
  align-items: center;
}

.ets-radar-svg-box {
  display: flex;
  justify-content: center;
  align-items: center;
}
</style>
