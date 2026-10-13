<template>
  <view class="ep-market">
    <!-- 顶部 -->
    <view class="ep-market-header">
      <text class="ep-market-title">市场洞察</text>
      <text class="ep-market-subtitle">数据来源：jobs 表（爬虫聚合）· 实时</text>
    </view>

    <!-- 岗位图谱 — Three.js 3D -->
    <view class="ep-market-section">
      <view class="ep-market-section-top">
        <text class="ep-market-section-label">岗位图谱</text>
        <text class="ep-market-section-stat">6 岗位 · 8 技能 · 24 关联</text>
      </view>
      <view class="ep-graph-3d-container">
        <EnterpriseMarketInsight3D
          @node-select="onNodeSelect"
        />
      </view>
      <!-- 节点详情 -->
      <view v-if="selectedNode" class="ep-graph-detail">
        <view class="ep-graph-detail-header">
          <view class="ep-graph-detail-dot" :style="{ background: selectedNodeColor }"></view>
          <text class="ep-graph-detail-name">{{ selectedNode.name }}</text>
          <text class="ep-graph-detail-type">{{ selectedNode.type === 'job' ? '岗位' : '技能' }}</text>
        </view>
        <text class="ep-graph-detail-desc">
          {{ selectedNode.type === 'job' ? '该岗位关联技能：' : '该技能关联岗位：' }}{{ nodeRelated.join('、') }}
        </text>
      </view>
    </view>

    <!-- 三栏：技能变化 -->
    <view class="ep-market-changes">
      <!-- 快速增长 -->
      <view class="ep-change-col">
        <view class="ep-change-header">
          <text class="ep-change-icon rise">↑</text>
          <text class="ep-change-title">快速增长</text>
        </view>
        <view class="ep-change-list">
          <view v-for="item in rising" :key="item.n" class="ep-change-item">
            <text class="ep-change-name">{{ item.n }}</text>
            <text class="ep-change-rate rise">{{ item.r }}</text>
          </view>
        </view>
      </view>

      <!-- 需求下降 -->
      <view class="ep-change-col">
        <view class="ep-change-header">
          <text class="ep-change-icon fall">↓</text>
          <text class="ep-change-title">需求下降</text>
        </view>
        <view class="ep-change-list">
          <view v-for="item in declining" :key="item.n" class="ep-change-item">
            <text class="ep-change-name">{{ item.n }}</text>
            <text class="ep-change-rate fall">{{ item.r }}</text>
          </view>
        </view>
      </view>

      <!-- 新兴岗位 -->
      <view class="ep-change-col">
        <view class="ep-change-header">
          <text class="ep-change-icon emerge">⚡</text>
          <text class="ep-change-title">新兴岗位</text>
        </view>
        <view class="ep-change-list">
          <view v-for="item in emerging" :key="item.n" class="ep-change-item">
            <text class="ep-change-name">{{ item.n }}</text>
            <text class="ep-change-rate emerge">{{ item.g }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 数据说明 -->
    <view class="ep-market-footer">
      <text class="ep-market-footer-text">→ 基于近 6 个月多源招聘数据聚合</text>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import EnterpriseMarketInsight3D from './EnterpriseMarketInsight3D.vue'

/* ================================================================
   硬编码数据 — 与 Web MarketInsight.tsx 1:1 对应
   ================================================================ */
const rising = [
  { n: 'LangChain', r: '+320%' },
  { n: 'MCP协议', r: '+280%' },
  { n: 'RAG', r: '+210%' },
  { n: 'Agent框架', r: '+180%' },
  { n: 'Prompt工程', r: '+95%' },
]

const declining = [
  { n: 'Struts', r: '-95%' },
  { n: 'Hibernate', r: '-80%' },
  { n: 'jQuery', r: '-70%' },
]

const emerging = [
  { n: 'MCP协议工程师', g: '+230%' },
  { n: 'AI Agent工程师', g: '+180%' },
  { n: '提示词工程师', g: '+95%' },
]

/* ================================================================
   节点关联数据 — 用于详情面板
   ================================================================ */
const nodeRelations = {
  j1: ['Python', 'LangChain', 'RAG'],
  j2: ['Java', 'SpringBoot', 'K8s', 'Docker', 'MySQL'],
  j3: ['Python', 'Spark', 'Flink'],
  j4: ['K8s', 'Docker'],
  j5: ['Python', 'LangChain', 'MCP协议', 'Agent框架'],
  j6: ['React', 'TypeScript'],
  s1: ['AI应用开发', '大数据工程', 'AI Agent'],
  s2: ['Java后端'],
  s3: ['Java后端'],
  s4: ['AI应用开发', 'AI Agent'],
  s5: ['Java后端', '云原生'],
  s6: ['Java后端', '云原生'],
  s7: ['AI应用开发'],
  s8: ['大数据工程'],
  s9: ['AI Agent'],
  s10: ['前端开发'],
  s11: ['Java后端'],
  s12: ['大数据工程'],
  s13: ['前端开发'],
  s14: ['AI Agent'],
}

const nodeColors = {
  j1: '#00C8FF', j2: '#7C3AED', j3: '#00E599', j4: '#FF8C42',
  j5: '#00C8FF', j6: '#FF4D6A',
  s1: '#38BDF8', s2: '#A78BFA', s3: '#C084FC', s4: '#2DD4BF',
  s5: '#FBBF24', s6: '#FCD34D', s7: '#34D399', s8: '#FB923C',
  s9: '#38BDF8', s10: '#F472B6', s11: '#A3E635', s12: '#FB923C',
  s13: '#60A5FA', s14: '#2DD4BF',
}

const selectedNode = ref(null)

const selectedNodeColor = computed(() => {
  if (!selectedNode.value) return '#fff'
  return nodeColors[selectedNode.value.id] || '#fff'
})

const nodeRelated = computed(() => {
  if (!selectedNode.value) return []
  return nodeRelations[selectedNode.value.id] || []
})

function onNodeSelect(node) {
  selectedNode.value = node
}
</script>

<style>
.ep-market {
  min-height: 100%;
  box-sizing: border-box;
  padding: 28rpx 32rpx 60rpx;
  display: flex;
  flex-direction: column;
  gap: 40rpx;
}

/* 头部 */
.ep-market-header {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.ep-market-title {
  font-size: 38rpx;
  font-weight: 700;
  color: var(--color-on-surface);
  letter-spacing: 1rpx;
}

.ep-market-subtitle {
  font-size: 24rpx;
  color: var(--color-on-surface-variant);
}

/* 区块通用 */
.ep-market-section {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.ep-market-section-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.ep-market-section-label {
  font-size: 26rpx;
  font-weight: 600;
  color: var(--color-on-surface-variant);
  letter-spacing: 2rpx;
  text-transform: uppercase;
}

.ep-market-section-stat {
  font-size: 22rpx;
  color: var(--color-on-surface-variant);
  font-variant-numeric: tabular-nums;
}

/* 3D 图谱容器 */
.ep-graph-3d-container {
  width: 100%;
  height: 520rpx;
  border: 1rpx solid var(--color-outline-variant);
  border-radius: 16rpx;
  overflow: hidden;
  background: #ffffff;
}

/* 节点详情 */
.ep-graph-detail {
  padding: 20rpx 24rpx;
  border: 1rpx solid var(--color-outline-variant);
  border-radius: 12rpx;
  background: var(--color-surface-container-low);
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.ep-graph-detail-header {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.ep-graph-detail-dot {
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
  flex-shrink: 0;
}

.ep-graph-detail-name {
  font-size: 28rpx;
  font-weight: 600;
  color: var(--color-on-surface);
}

.ep-graph-detail-type {
  font-size: 22rpx;
  color: var(--color-on-surface-variant);
  padding: 2rpx 12rpx;
  border-radius: 8rpx;
  background: var(--color-surface-container-high);
}

.ep-graph-detail-desc {
  font-size: 24rpx;
  color: var(--color-on-surface-variant);
  line-height: 1.5;
}

/* 技能变化三栏 */
.ep-market-changes {
  display: flex;
  flex-direction: column;
  gap: 0;
  border-top: 1rpx solid var(--color-outline-variant);
  border-bottom: 1rpx solid var(--color-outline-variant);
}

.ep-change-col {
  padding: 28rpx 0;
  border-bottom: 1rpx solid var(--color-outline-variant);
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.ep-change-col:last-child {
  border-bottom: none;
}

.ep-change-header {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.ep-change-icon {
  font-size: 28rpx;
  font-weight: 700;
}

.ep-change-icon.rise {
  color: var(--accent-green);
}

.ep-change-icon.fall {
  color: var(--color-on-surface-variant);
}

.ep-change-icon.emerge {
  color: var(--color-primary);
}

.ep-change-title {
  font-size: 26rpx;
  font-weight: 600;
  color: var(--color-on-surface-variant);
  letter-spacing: 2rpx;
  text-transform: uppercase;
}

.ep-change-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.ep-change-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.ep-change-name {
  font-size: 30rpx;
  color: var(--color-on-surface);
}

.ep-change-rate {
  font-size: 26rpx;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.ep-change-rate.rise {
  color: var(--accent-green);
}

.ep-change-rate.fall {
  color: var(--color-on-surface-variant);
}

.ep-change-rate.emerge {
  color: var(--color-primary);
}

/* 底部说明 */
.ep-market-footer {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.ep-market-footer-text {
  font-size: 24rpx;
  color: var(--color-on-surface-variant);
}
</style>
