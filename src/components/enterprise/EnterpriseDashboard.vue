<template>
  <view class="ep-dashboard">
    <!-- 加载状态 -->
    <view v-if="loading" class="ep-state">
      <view class="ep-loading">
        <text class="ep-loading-text">加载中...</text>
      </view>
    </view>

    <!-- 错误状态 -->
    <view v-else-if="error" class="ep-state">
      <view class="ep-error">
        <text class="ep-error-text">{{ error }}</text>
      </view>
    </view>

    <!-- 无数据状态 -->
    <view v-else-if="!data" class="ep-state">
      <view class="ep-empty">
        <text class="ep-empty-text">暂无数据</text>
      </view>
    </view>

    <!-- 主内容 -->
    <template v-else>
      <view class="ep-content">
        <!-- KPI 指标区 -->
        <view class="ep-section">
          <text class="ep-section-title">核心指标</text>
          <view class="kpi-grid">
            <view
              v-for="(m, i) in metrics"
              :key="i"
              class="kpi-item"
              @tap="m.action"
            >
              <text class="kpi-label">{{ m.label }}</text>
              <text class="kpi-value">{{ m.value }}</text>
            </view>
          </view>
        </view>

        <!-- 近期岗位 -->
        <view class="ep-section">
          <view class="ep-section-header">
            <text class="ep-section-title">近期岗位</text>
            <text class="ep-section-link" @tap="goToJobs">全部岗位</text>
          </view>
          <view v-if="data.recent_jobs && data.recent_jobs.length > 0" class="job-list">
            <view
              v-for="job in data.recent_jobs"
              :key="job.id"
              class="job-item"
              @tap="goToJobDetail(job.id)"
            >
              <view class="job-info">
                <view class="job-title-row">
                  <text class="job-title">{{ job.title }}</text>
                  <text class="job-status" :style="{ color: statusColor(job.status) }">{{ statusLabel(job.status) }}</text>
                </view>
                <text class="job-date">{{ job.created_at }}</text>
              </view>
              <view class="job-candidates">
                <text class="job-candidates-value">{{ job.candidates }}</text>
                <text class="job-candidates-label">候选人</text>
              </view>
            </view>
          </view>
          <view v-else class="ep-empty-small">
            <text class="ep-empty-text">暂无岗位</text>
          </view>
        </view>

        <!-- 匹配度分布 -->
        <view class="ep-section">
          <text class="ep-section-title">匹配度分布</text>
          <view class="match-dist">
            <view
              v-for="item in distributions"
              :key="item.label"
              class="match-row"
            >
              <view class="match-header">
                <text class="match-label">{{ item.label }}</text>
                <text class="match-value" :style="{ color: item.color }">
                  {{ item.val }}
                  <text class="match-pct">({{ pct(item.val) }}%)</text>
                </text>
              </view>
              <view class="match-bar-bg">
                <view
                  class="match-bar-fill"
                  :style="{ width: pct(item.val) + '%', background: item.color }"
                ></view>
              </view>
            </view>
            <view class="match-total">
              <text class="match-total-text">总计 {{ totalDist }} 位候选人</text>
            </view>
          </view>
        </view>

        <!-- 快捷入口 -->
        <view class="ep-section">
          <text class="ep-section-title">快捷入口</text>
          <view class="shortcut-grid">
            <view
              v-for="(item, i) in shortcuts"
              :key="i"
              class="shortcut-item"
              @tap="item.action"
            >
              <view class="shortcut-info">
                <text class="shortcut-label">{{ item.label }}</text>
                <text class="shortcut-desc">{{ item.desc }}</text>
              </view>
            </view>
          </view>
        </view>
      </view>
    </template>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { request } from '../../utils/request'

const emit = defineEmits(['navigate'])

const data = ref(null)
const loading = ref(true)
const error = ref('')

const STATUS_MAP = {
  'active': { label: '招聘中', color: 'var(--accent-green)' },
  'draft': { label: '草稿', color: 'var(--accent-orange)' },
  'closed': { label: '已关闭', color: 'var(--color-on-surface-variant)' },
}

onMounted(async () => {
  await load()
})

async function load() {
  loading.value = true
  error.value = ''
  try {
    const d = await request({ url: '/api/enterprise/dashboard', method: 'GET' })
    if (d.success) {
      data.value = d.data
    } else {
      error.value = d.message || '加载失败'
    }
  } catch {
    error.value = '网络错误'
  } finally {
    loading.value = false
  }
}

const metrics = computed(() => {
  if (!data.value) return []
  const m = data.value.metrics
  return [
    { label: '在招职位', value: m.active_jobs, action: () => emit('navigate', 'jobs') },
    { label: '匹配候选人', value: m.total_candidates, action: () => emit('navigate', 'talent') },
    { label: '高匹配人才 (≥85)', value: m.high_match, action: () => emit('navigate', 'talent') },
    { label: '待沟通', value: m.pending_count, action: () => emit('navigate', 'talent') },
  ]
})

const distributions = computed(() => {
  if (!data.value) return []
  const md = data.value.match_distribution
  return [
    { label: '高匹配 (≥85)', val: md.high, color: 'var(--accent-green)' },
    { label: '中匹配 (60-84)', val: md.mid, color: 'var(--color-primary)' },
    { label: '低匹配 (<60)', val: md.low, color: 'var(--color-on-surface-variant)' },
  ]
})

const totalDist = computed(() => {
  return distributions.value.reduce((s, d) => s + d.val, 0) || 1
})

const shortcuts = [
  { label: '人才星', desc: '查看匹配的候选人', action: () => emit('navigate', 'talent') },
  { label: '岗位管理', desc: '发布与编辑岗位', action: () => emit('navigate', 'jobs') },
  { label: '市场洞察', desc: '技能需求与趋势', action: () => emit('navigate', 'market') },
]

function pct(v) {
  return Math.round((v / totalDist.value) * 100)
}

function statusLabel(status) {
  return (STATUS_MAP[status] || STATUS_MAP['active']).label
}

function statusColor(status) {
  return (STATUS_MAP[status] || STATUS_MAP['active']).color
}

function goToJobs() {
  emit('navigate', 'jobs')
}

function goToJobDetail(id) {
  emit('navigate', 'jobs', { selectedJobId: id })
}
</script>

<style>
.ep-dashboard {
  min-height: 100%;
  box-sizing: border-box;
}

.ep-state {
  display: flex;
  min-height: 500rpx;
  align-items: center;
  justify-content: center;
}

.ep-loading, .ep-error, .ep-empty {
  padding: 40rpx;
  text-align: center;
}

.ep-loading-text {
  color: var(--color-on-surface-variant);
  font-size: 26rpx;
}

.ep-error {
  border: 1rpx solid var(--accent-red);
  border-radius: 16rpx;
  background: rgba(220, 38, 38, 0.08);
}

.ep-error-text {
  color: var(--accent-red);
  font-size: 24rpx;
}

.ep-empty-text {
  color: var(--color-on-surface-variant);
  font-size: 26rpx;
}

.ep-content {
  padding: 28rpx 32rpx;
  display: flex;
  flex-direction: column;
  gap: 40rpx;
}

.ep-section {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.ep-section-title {
  font-size: 28rpx;
  font-weight: 600;
  color: var(--color-on-surface-variant);
  letter-spacing: 2rpx;
  text-transform: uppercase;
}

.ep-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.ep-section-link {
  font-size: 26rpx;
  color: var(--color-on-surface-variant);
  padding: 8rpx 16rpx;
}

/* KPI 2x2 网格 */
.kpi-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rpx;
  border: 1rpx solid var(--color-outline-variant);
  border-radius: 16rpx;
  overflow: hidden;
  background: var(--color-outline-variant);
}

.kpi-item {
  background: var(--color-surface-container-lowest);
  padding: 32rpx 24rpx;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.kpi-item:active {
  background: var(--color-surface-container-low);
}

.kpi-label {
  font-size: 24rpx;
  color: var(--color-on-surface-variant);
}

.kpi-value {
  font-size: 72rpx;
  font-weight: 700;
  color: var(--color-on-surface);
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

/* 近期岗位列表 */
.job-list {
  border: 1rpx solid var(--color-outline-variant);
  border-radius: 16rpx;
  overflow: hidden;
}

.job-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 24rpx;
  border-bottom: 1rpx solid var(--color-outline-variant);
  background: var(--color-surface-container-lowest);
}

.job-item:last-child {
  border-bottom: none;
}

.job-item:active {
  background: var(--color-surface-container-low);
}

.job-info {
  min-width: 0;
  flex: 1;
}

.job-title-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 8rpx;
}

.job-title {
  font-size: 30rpx;
  font-weight: 600;
  color: var(--color-on-surface);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.job-status {
  font-size: 22rpx;
  flex-shrink: 0;
}

.job-date {
  font-size: 22rpx;
  color: var(--color-on-surface-variant);
  font-variant-numeric: tabular-nums;
}

.job-candidates {
  text-align: right;
  margin-left: 24rpx;
  flex-shrink: 0;
}

.job-candidates-value {
  font-size: 40rpx;
  font-weight: 700;
  color: var(--color-on-surface);
  font-variant-numeric: tabular-nums;
  display: block;
}

.job-candidates-label {
  font-size: 20rpx;
  color: var(--color-on-surface-variant);
  margin-top: 4rpx;
  display: block;
}

.ep-empty-small {
  padding: 48rpx;
  text-align: center;
  border: 1rpx solid var(--color-outline-variant);
  border-radius: 16rpx;
  background: var(--color-surface-container-lowest);
}

/* 匹配度分布 */
.match-dist {
  display: flex;
  flex-direction: column;
  gap: 28rpx;
  padding: 28rpx 24rpx;
  border: 1rpx solid var(--color-outline-variant);
  border-radius: 16rpx;
  background: var(--color-surface-container-lowest);
}

.match-row {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.match-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.match-label {
  font-size: 26rpx;
  color: var(--color-on-surface-variant);
}

.match-value {
  font-size: 26rpx;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.match-pct {
  font-size: 22rpx;
  color: var(--color-on-surface-variant);
  margin-left: 8rpx;
}

.match-bar-bg {
  height: 20rpx;
  border-radius: 10rpx;
  overflow: hidden;
  background: var(--color-surface-container-high);
}

.match-bar-fill {
  height: 100%;
  border-radius: 10rpx;
  transition: width 0.6s ease;
}

.match-total {
  padding-top: 24rpx;
  border-top: 1rpx solid var(--color-outline-variant);
}

.match-total-text {
  font-size: 24rpx;
  color: var(--color-on-surface-variant);
  font-variant-numeric: tabular-nums;
}

/* 快捷入口 */
.shortcut-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 2rpx;
  border: 1rpx solid var(--color-outline-variant);
  border-radius: 16rpx;
  overflow: hidden;
  background: var(--color-outline-variant);
}

.shortcut-item {
  background: var(--color-surface-container-lowest);
  padding: 32rpx 24rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.shortcut-item:active {
  background: var(--color-surface-container-low);
}

.shortcut-info {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.shortcut-label {
  font-size: 30rpx;
  font-weight: 600;
  color: var(--color-on-surface);
}

.shortcut-desc {
  font-size: 24rpx;
  color: var(--color-on-surface-variant);
}
</style>