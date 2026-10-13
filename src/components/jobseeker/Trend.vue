<template>
  <view class="trend">
    <view class="trend-header">
      <text class="trend-title">趋势洞察</text>
      <view class="tab-group">
        <view
          v-for="t in tabList"
          :key="t.key"
          class="tab-btn"
          :class="{ active: tab === t.key }"
          @tap="tab = t.key"
        >
          <text>{{ t.label }}</text>
        </view>
      </view>
    </view>

    <!-- Tab: 趋势 -->
    <view v-if="tab === 'trend'" class="trend-content">
      <view class="card">
        <view class="card-head">
          <AppIcon name="line-chart" />
          <text>技能需求趋势（近6月）</text>
        </view>
        <view class="chart-wrapper">
          <svg viewBox="0 0 700 300" class="chart-svg">
            <line
              v-for="(_, i) in 5"
              :key="'g' + i"
              :x1="chartL"
              :y1="20 + i * 50"
              :x2="chartR"
              :y2="20 + i * 50"
              stroke="var(--color-outline-variant)"
              stroke-opacity="0.4"
              stroke-dasharray="3,3"
            />
            <text
              v-for="(_, i) in 5"
              :key="'yl' + i"
              :x="chartL - 5"
              :y="24 + i * 50"
              text-anchor="end"
              font-size="11"
              fill="var(--color-on-surface-variant)"
            >{{ 80 - i * 20 }}</text>
            <text
              v-for="(d, i) in skillData"
              :key="'xl' + i"
              :x="chartL + i * xStep"
              :y="290"
              text-anchor="middle"
              font-size="12"
              fill="var(--color-on-surface-variant)"
            >{{ d.m }}</text>
            <polyline
              v-for="(line, li) in linePaths"
              :key="'p' + li"
              :points="line.points"
              :stroke="line.color"
              stroke-width="2"
              fill="none"
              stroke-linejoin="round"
              stroke-linecap="round"
            />
          </svg>
        </view>
        <view class="legend">
          <view
            v-for="l in legendItems"
            :key="l.label"
            class="legend-item"
          >
            <view class="legend-line" :style="{ background: l.color }" />
            <text>{{ l.label }}</text>
          </view>
        </view>
      </view>

      <view class="grid-2">
        <!-- 薪资分布 -->
        <view class="card">
          <view class="card-head">
            <AppIcon name="bar-chart" />
            <text>薪资分布(K)</text>
          </view>
          <view class="chart-wrapper">
            <svg viewBox="0 0 440 300" class="chart-svg">
              <line
                v-for="g in salaryGridLines"
                :key="'sg' + g.label"
                :x1="salaryPlot.left"
                :y1="g.y"
                :x2="salaryPlot.right"
                :y2="g.y"
                stroke="var(--color-outline-variant)"
                stroke-opacity="0.4"
                stroke-dasharray="3,3"
              />
              <text
                v-for="g in salaryGridLines"
                :key="'sy' + g.label"
                :x="salaryPlot.left - 8"
                :y="g.y + 4"
                text-anchor="end"
                font-size="11"
                fill="var(--color-on-surface-variant)"
              >{{ g.label }}</text>
              <rect
                v-for="(b, i) in salaryBars"
                :key="'br' + i"
                :x="b.x"
                :y="b.y"
                :width="b.width"
                :height="b.height"
                fill="#7C3AED"
                class="chart-bar"
                @tap="showTooltip(b.label + '：' + b.value + 'K')"
              />
              <text
                v-for="(b, i) in salaryBars"
                :key="'bx' + i"
                :x="b.cx"
                :y="salaryPlot.bottom + 18"
                text-anchor="middle"
                font-size="11"
                fill="var(--color-on-surface-variant)"
              >{{ b.label }}</text>
              <text
                v-for="(b, i) in salaryBars"
                :key="'bv' + i"
                :x="b.cx"
                :y="b.y - 5"
                text-anchor="middle"
                font-size="11"
                font-weight="700"
                fill="#7C3AED"
              >{{ b.value }}</text>
            </svg>
          </view>
        </view>

        <!-- 新兴岗位增长 -->
        <view class="card">
          <view class="card-head">
            <AppIcon name="activity" />
            <text>新兴岗位增长(%)</text>
          </view>
          <view class="chart-wrapper">
            <svg viewBox="0 0 440 300" class="chart-svg">
              <line
                v-for="g in growthGridLines"
                :key="'gg' + g.label"
                :x1="g.x"
                :y1="growthPlot.top"
                :x2="g.x"
                :y2="growthPlot.bottom"
                stroke="var(--color-outline-variant)"
                stroke-opacity="0.4"
                stroke-dasharray="3,3"
              />
              <text
                v-for="g in growthGridLines"
                :key="'gx' + g.label"
                :x="g.x"
                :y="growthPlot.bottom + 16"
                text-anchor="middle"
                font-size="11"
                fill="var(--color-on-surface-variant)"
              >{{ g.label }}</text>
              <text
                v-for="(b, i) in growthBars"
                :key="'gyl' + i"
                :x="growthPlot.left - 8"
                :y="b.cy + 4"
                text-anchor="end"
                font-size="11"
                fill="var(--color-on-surface-variant)"
              >{{ b.label }}</text>
              <path
                v-for="(b, i) in growthBars"
                :key="'gb' + i"
                :d="barPath(b.value, b.y, b.height)"
                fill="#00C8FF"
                class="chart-bar"
                @tap="showTooltip(b.label + '：' + b.value + '%')"
              />
              <text
                v-for="(b, i) in growthBars"
                :key="'gvl' + i"
                :x="Math.min(growthPlot.left + b.barW + 5, growthPlot.right - 25)"
                :y="b.cy + 4"
                text-anchor="start"
                font-size="11"
                font-weight="700"
                fill="#00C8FF"
              >{{ b.value }}%</text>
            </svg>
          </view>
        </view>
      </view>
    </view>

    <!-- Tab: 新岗位 -->
    <view v-if="tab === 'discovery'" class="card">
      <view class="discovery-layout">
        <view class="discovery-icon-wrap">
          <AppIcon name="zap" />
        </view>
        <view class="discovery-body">
          <view class="discovery-head">
            <text class="discovery-title">MCP 协议开发工程师</text>
            <view class="discovery-badge">新发现</view>
          </view>
          <text class="discovery-desc">随着 AI Agent 普及，MCP 协议催生了这一新兴岗位。</text>
        </view>
      </view>
      <view class="discovery-grid">
        <view class="discovery-block green">
          <text class="block-label">必备技能</text>
          <view class="skill-tags">
            <text
              v-for="s in requiredSkills"
              :key="s"
              class="skill-tag green"
            >{{ s }}</text>
          </view>
        </view>
        <view class="discovery-block cyan">
          <text class="block-label">加分技能</text>
          <view class="skill-tags">
            <text
              v-for="s in bonusSkills"
              :key="s"
              class="skill-tag cyan"
            >{{ s }}</text>
          </view>
        </view>
      </view>
      <view class="discovery-meta">
        <text>📅 2026年3月</text>
        <text>✅ 多源交叉验证</text>
      </view>
    </view>

    <!-- Tab: 更新 -->
    <view v-if="tab === 'update'" class="card">
      <view class="update-layout">
        <view class="update-icon-wrap">
          <AppIcon name="edit-3" />
        </view>
        <view class="update-body">
          <text class="update-title">Java 后端开发工程师</text>
          <text class="update-sub">2026 Q1-Q2 · 234 条 JD</text>
        </view>
      </view>
      <view class="update-list">
        <view class="update-item add">
          <view class="update-icon-box add">
            <AppIcon name="plus" />
          </view>
          <view class="update-item-body">
            <text class="update-item-label">新增</text>
            <view class="skill-tags">
              <text
                v-for="s in addedSkills"
                :key="s"
                class="skill-tag green"
              >{{ s }}</text>
            </view>
            <text class="update-note">63% 的 Java 岗位已要求 K8s</text>
          </view>
        </view>
        <view class="update-item remove">
          <view class="update-icon-box remove">
            <AppIcon name="minus" />
          </view>
          <view class="update-item-body">
            <text class="update-item-label">移除</text>
            <view class="skill-tags">
              <text
                v-for="s in removedSkills"
                :key="s"
                class="skill-tag red"
              >{{ s }}</text>
            </view>
          </view>
        </view>
        <view class="update-item modify">
          <view class="update-icon-box modify">
            <AppIcon name="edit-3" />
          </view>
          <view class="update-item-body">
            <text class="update-item-label">修改</text>
            <text class="update-change">Spring Boot 2.x → 3.x</text>
          </view>
        </view>
      </view>
    </view>

    <!-- Tooltip -->
    <view
      v-if="tooltip"
      class="chart-tooltip"
      @tap="tooltip = ''"
    >
      <text>{{ tooltip }}</text>
    </view>
  </view>
</template>

<script setup>
import { computed, ref } from 'vue'
import AppIcon from '../common/AppIcon.vue'

const tab = ref('trend')
const tooltip = ref('')

const tabList = [
  { key: 'trend', label: '趋势' },
  { key: 'discovery', label: '新岗位' },
  { key: 'update', label: '更新' }
]

const skillData = [
  { m: '1月', Python: 45, LangChain: 12, K8s: 30, RAG: 8, Agent: 5 },
  { m: '2月', Python: 48, LangChain: 20, K8s: 32, RAG: 15, Agent: 10 },
  { m: '3月', Python: 50, LangChain: 35, K8s: 35, RAG: 28, Agent: 18 },
  { m: '4月', Python: 52, LangChain: 48, K8s: 38, RAG: 40, Agent: 30 },
  { m: '5月', Python: 55, LangChain: 60, K8s: 42, RAG: 55, Agent: 45 },
  { m: '6月', Python: 58, LangChain: 72, K8s: 45, RAG: 68, Agent: 60 }
]

const salaryData = [
  { n: 'AI应用开发', v: 35 },
  { n: 'Java后端', v: 28 },
  { n: '大数据工程', v: 30 },
  { n: '云原生', v: 32 },
  { n: 'AI Agent', v: 38 },
  { n: '前端开发', v: 22 }
]

const growthData = [
  { n: 'MCP协议工程师', v: 230 },
  { n: 'AI Agent工程师', v: 180 },
  { n: '提示词工程师', v: 95 },
  { n: 'LLM运维工程师', v: 72 },
  { n: 'AI数据标注师', v: 45 }
]

const requiredSkills = ['MCP协议', 'Python/Go', 'API设计', 'Agent框架']
const bonusSkills = ['LangChain', '协议缓冲', 'OAuth']
const addedSkills = ['Spring Cloud', 'Kubernetes', 'Docker', 'Redis']
const removedSkills = ['Struts', 'Hibernate']

const chartL = 45
const chartR = 680
const xStep = (chartR - chartL) / 5
const yMax = 80
const chartH = 250

const skillKeys = ['Python', 'LangChain', 'K8s', 'RAG', 'Agent']
const skillColors = ['#38BDF8', '#2DD4BF', '#FBBF24', '#34D399', '#A78BFA']

const linePaths = computed(() =>
  skillKeys.map((key, si) => {
    const points = skillData.map((d, i) => {
      const x = chartL + i * xStep
      const y = 270 - (d[key] / yMax) * chartH
      return `${x.toFixed(1)},${y.toFixed(1)}`
    }).join(' ')
    return { points, color: skillColors[si] }
  })
)

const legendItems = skillKeys.map((label, i) => ({
  label,
  color: skillColors[i]
}))

// Chart 2: 薪资分布 — 纵向柱状图坐标系
const salaryPlot = {
  left: 52,
  right: 410,
  top: 25,
  bottom: 230,
  max: 40
}
const salaryArea = computed(() => salaryPlot.bottom - salaryPlot.top)
const salaryGridLines = computed(() => {
  const lines = []
  for (let v = 0; v <= salaryPlot.max; v += 10) {
    const y = salaryPlot.bottom - (v / salaryPlot.max) * salaryArea.value
    lines.push({ y, label: String(v) })
  }
  return lines
})
const salaryBars = computed(() => {
  const count = salaryData.length
  const spacing = (salaryPlot.right - salaryPlot.left) / count
  return salaryData.map((d, i) => {
    const cx = salaryPlot.left + (i + 0.5) * spacing
    const barW = 40
    const barH = (d.v / salaryPlot.max) * salaryArea.value
    return {
      x: cx - barW / 2,
      y: salaryPlot.bottom - barH,
      width: barW,
      height: Math.max(barH, 1),
      cx,
      value: d.v,
      label: d.n
    }
  })
})

// Chart 3: 新兴岗位增长 — 横向柱状图坐标系
const growthPlot = {
  left: 140,
  right: 410,
  top: 25,
  bottom: 235,
  max: 250
}
const growthArea = computed(() => growthPlot.right - growthPlot.left)
const growthGridLines = computed(() => {
  const lines = []
  for (let v = 0; v <= growthPlot.max; v += 50) {
    const x = growthPlot.left + (v / growthPlot.max) * growthArea.value
    lines.push({ x, label: String(v) })
  }
  return lines
})
const growthBars = computed(() => {
  const count = growthData.length
  const spacing = (growthPlot.bottom - growthPlot.top) / count
  const barH = 26
  return growthData.map((d, i) => {
    const cy = growthPlot.top + (i + 0.5) * spacing
    const barW = (d.v / growthPlot.max) * growthArea.value
    return {
      x: growthPlot.left,
      y: cy - barH / 2,
      width: Math.max(barW, 1),
      height: barH,
      barW,
      cy,
      value: d.v,
      label: d.n
    }
  })
})

function barPath(value, y, barHeight) {
  const x = growthPlot.left
  const maxW = growthArea.value
  const maxV = growthPlot.max
  const w = Math.min(value / maxV * maxW, maxW)
  const r = 6
  if (w < r * 2) {
    return `M ${x} ${y} h ${w} v ${barHeight} h ${-w} Z`
  }
  return `M ${x} ${y} h ${w - r} a ${r} ${r} 0 0 1 ${r} ${r} v ${barHeight - 2 * r} a ${r} ${r} 0 0 1 -${r} ${r} h ${-w + r} Z`
}

function showTooltip(text) {
  tooltip.value = text
  setTimeout(() => {
    if (tooltip.value === text) {
      tooltip.value = ''
    }
  }, 3000)
}
</script>

<style>
.trend {
  width: 100%;
  box-sizing: border-box;
  padding: 28rpx 24rpx 36rpx;
}
.trend-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 28rpx;
}
.trend-title {
  font-size: 32rpx;
  font-weight: 800;
  color: var(--color-on-surface);
}
.tab-group {
  display: flex;
  gap: 10rpx;
}
.tab-btn {
  padding: 12rpx 22rpx;
  border-radius: 14rpx;
  font-size: 22rpx;
  font-weight: 700;
  background: var(--color-surface);
  color: var(--color-on-surface-variant);
  border: 1rpx solid var(--color-outline-variant);
}
.tab-btn.active {
  background: var(--color-primary);
  color: var(--color-on-primary);
  border: none;
}
.trend-content {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}
.card {
  border: 1rpx solid var(--color-outline-variant);
  border-radius: 24rpx;
  background: var(--color-surface-container-lowest);
  padding: 28rpx;
}
.card-head {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 24rpx;
  font-size: 26rpx;
  font-weight: 700;
  color: var(--color-on-surface);
}
.card-head .app-icon {
  font-size: 34rpx;
  color: var(--color-primary);
}
.chart-wrapper {
  width: 100%;
  overflow: hidden;
}
.chart-svg {
  display: block;
  width: 100%;
  height: auto;
}
.chart-bar {
  cursor: pointer;
  opacity: 0.85;
  transition: opacity 0.2s;
}
.chart-bar:active {
  opacity: 1;
}
.legend {
  display: flex;
  justify-content: center;
  gap: 20rpx;
  margin-top: 16rpx;
  font-size: 20rpx;
  color: var(--color-on-surface-variant);
}
.legend-item {
  display: flex;
  align-items: center;
  gap: 8rpx;
}
.legend-line {
  width: 20rpx;
  height: 4rpx;
  border-radius: 2rpx;
}
.grid-2 {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20rpx;
}

/* Tooltip */
.chart-tooltip {
  position: fixed;
  z-index: 100;
  right: 24rpx;
  bottom: 160rpx;
  left: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20rpx 28rpx;
  border-radius: 16rpx;
  background: var(--color-surface-container-lowest);
  border: 1rpx solid var(--color-outline-variant);
  box-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.12);
  color: var(--color-on-surface);
  font-size: 24rpx;
  font-weight: 700;
  text-align: center;
  pointer-events: auto;
}

/* Discovery tab */
.discovery-layout {
  display: flex;
  gap: 20rpx;
  margin-bottom: 20rpx;
}
.discovery-icon-wrap {
  display: flex;
  width: 80rpx;
  height: 80rpx;
  flex: none;
  align-items: center;
  justify-content: center;
  border-radius: 22rpx;
  background: var(--color-primary-fixed);
  font-size: 44rpx;
  color: var(--color-primary);
}
.discovery-body {
  flex: 1;
}
.discovery-head {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 6rpx;
}
.discovery-title {
  font-size: 26rpx;
  font-weight: 700;
  color: var(--color-primary);
}
.discovery-badge {
  padding: 6rpx 16rpx;
  border-radius: 8rpx;
  font-size: 18rpx;
  font-weight: 700;
  background: var(--color-primary-fixed);
  color: var(--color-primary);
}
.discovery-desc {
  font-size: 22rpx;
  color: var(--color-on-surface-variant);
  line-height: 1.5;
}
.discovery-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
  margin-bottom: 20rpx;
}
.discovery-block {
  padding: 20rpx;
  border-radius: 16rpx;
}
.discovery-block.green {
  background: rgba(5, 150, 105, 0.08);
}
.discovery-block.cyan {
  background: var(--color-primary-fixed);
}
.block-label {
  display: block;
  margin-bottom: 12rpx;
  font-size: 20rpx;
  font-weight: 700;
}
.discovery-block.green .block-label {
  color: var(--accent-green);
}
.discovery-block.cyan .block-label {
  color: var(--color-primary);
}
.skill-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
}
.skill-tag {
  padding: 8rpx 16rpx;
  border-radius: 12rpx;
  font-size: 20rpx;
  font-weight: 600;
}
.skill-tag.green {
  background: rgba(5, 150, 105, 0.08);
  color: var(--accent-green);
}
.skill-tag.cyan {
  background: var(--color-primary-fixed);
  color: var(--color-primary);
}
.skill-tag.red {
  background: rgba(220, 38, 38, 0.08);
  color: var(--accent-red);
}
.discovery-meta {
  display: flex;
  gap: 24rpx;
  font-size: 20rpx;
  color: var(--color-on-surface-variant);
}

/* Update tab */
.update-layout {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 28rpx;
}
.update-icon-wrap {
  display: flex;
  width: 64rpx;
  height: 64rpx;
  flex: none;
  align-items: center;
  justify-content: center;
  border-radius: 16rpx;
  background: var(--accent-purple-dim);
  font-size: 36rpx;
  color: var(--accent-purple);
}
.update-body {
  flex: 1;
}
.update-title {
  display: block;
  font-size: 26rpx;
  font-weight: 700;
  color: var(--color-on-surface);
}
.update-sub {
  display: block;
  margin-top: 4rpx;
  font-size: 20rpx;
  color: var(--color-on-surface-variant);
}
.update-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}
.update-item {
  display: flex;
  gap: 16rpx;
  padding: 20rpx;
  border-radius: 16rpx;
}
.update-item.add {
  background: rgba(5, 150, 105, 0.08);
}
.update-item.remove {
  background: rgba(220, 38, 38, 0.08);
}
.update-item.modify {
  background: var(--accent-purple-dim);
}
.update-icon-box {
  display: flex;
  width: 52rpx;
  height: 52rpx;
  flex: none;
  align-items: center;
  justify-content: center;
  border-radius: 12rpx;
  font-size: 28rpx;
}
.update-icon-box.add {
  background: rgba(5, 150, 105, 0.08);
  color: var(--accent-green);
}
.update-icon-box.remove {
  background: rgba(220, 38, 38, 0.08);
  color: var(--accent-red);
}
.update-icon-box.modify {
  background: var(--accent-purple-dim);
  color: var(--accent-purple);
}
.update-item-body {
  flex: 1;
}
.update-item-label {
  display: block;
  margin-bottom: 10rpx;
  font-size: 22rpx;
  font-weight: 700;
}
.update-item.add .update-item-label {
  color: var(--accent-green);
}
.update-item.remove .update-item-label {
  color: var(--accent-red);
}
.update-item.modify .update-item-label {
  color: var(--accent-purple);
}
.update-note {
  display: block;
  margin-top: 10rpx;
  font-size: 20rpx;
  color: var(--color-on-surface-variant);
}
.update-change {
  font-size: 22rpx;
  color: var(--color-on-surface);
}
</style>