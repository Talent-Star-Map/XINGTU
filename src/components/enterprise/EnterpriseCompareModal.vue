<template>
  <view v-if="show" class="ets-modal-mask" @tap.self="$emit('close')">
    <view class="ets-modal-box ets-modal-compare">
      <!-- 头部 -->
      <view class="ets-modal-header">
        <view class="ets-modal-header-left">
          <text class="ets-modal-title">候选人对比</text>
        </view>
        <view class="ets-modal-close" @tap="$emit('close')">
          <AppIcon name="x" />
        </view>
      </view>

      <!-- 加载 -->
      <view v-if="loading" class="ets-modal-loading">
        <AppIcon name="loader" />
        <text class="ets-loading-text">加载对比数据</text>
      </view>

      <!-- 内容 -->
      <scroll-view v-else-if="data" class="ets-modal-scroll" scroll-y :show-scrollbar="false">
        <view class="ets-modal-body">
          <!-- 雷达图 -->
          <view class="ets-compare-radar">
            <EnterpriseRadarChart :candidates="data.candidates" :size="280" />
            <view class="ets-compare-legend">
              <view v-for="(c, idx) in data.candidates" :key="c.id" class="ets-legend-item">
                <view class="ets-legend-dot" :style="{ background: getColor(idx) }"></view>
                <text class="ets-legend-name">{{ c.name }}</text>
                <text class="ets-legend-score">{{ c.match }}分</text>
              </view>
            </view>
          </view>

          <!-- 技能对比 -->
          <view class="ets-compare-skills">
            <!-- 共同技能 -->
            <view class="ets-compare-skill-block">
              <text class="ets-compare-section-title">共同技能 ({{ data.skill_analysis.common.length }})</text>
              <view class="ets-compare-tags">
                <template v-if="data.skill_analysis.common.length > 0">
                  <text
                    v-for="s in data.skill_analysis.common"
                    :key="s"
                    class="ets-tag-green"
                  >{{ s }}</text>
                </template>
                <text v-else class="ets-compare-empty">无共同技能</text>
              </view>
            </view>

            <!-- 独有技能 -->
            <view class="ets-compare-skill-block">
              <text class="ets-compare-section-title">独有技能</text>
              <view v-for="(c, idx) in data.candidates" :key="c.id" class="ets-unique-group">
                <view class="ets-unique-header">
                  <view class="ets-legend-dot" :style="{ background: getColor(idx) }"></view>
                  <text class="ets-unique-name">{{ c.name }}</text>
                  <text class="ets-unique-count">({{ getUniqueSkills(c.id).length }})</text>
                </view>
                <view class="ets-compare-tags">
                  <template v-if="getUniqueSkills(c.id).length > 0">
                    <text
                      v-for="s in getUniqueSkills(c.id)"
                      :key="s"
                      class="ets-tag-default"
                    >{{ s }}</text>
                  </template>
                  <text v-else class="ets-compare-empty">无独有技能</text>
                </view>
              </view>
            </view>
          </view>

          <!-- 基本信息对比 -->
          <view class="ets-compare-info">
            <text class="ets-compare-section-title">基本信息</text>
            <view class="ets-compare-table">
              <!-- 表头 -->
              <view class="ets-table-row ets-table-header">
                <text class="ets-table-cell ets-table-label">项目</text>
                <text
                  v-for="(c, idx) in data.candidates"
                  :key="c.id"
                  class="ets-table-cell"
                >
                  <view class="ets-table-name">
                    <view class="ets-legend-dot" :style="{ background: getColor(idx) }"></view>
                    <text>{{ c.name }}</text>
                  </view>
                </text>
              </view>
              <!-- 数据行 -->
              <view
                v-for="row in infoRows"
                :key="row.key"
                class="ets-table-row"
              >
                <text class="ets-table-cell ets-table-label">{{ row.label }}</text>
                <text
                  v-for="c in data.candidates"
                  :key="c.id"
                  class="ets-table-cell"
                >{{ c[row.key] || '—' }}</text>
              </view>
            </view>
          </view>
        </view>
      </scroll-view>
    </view>
  </view>
</template>

<script setup>
import AppIcon from '../common/AppIcon.vue'
import EnterpriseRadarChart from './EnterpriseRadarChart.vue'

const COMPARE_COLOR_POOL = [
  'var(--color-primary)',
  'var(--accent-green)',
  'var(--accent-purple)',
  'var(--accent-orange)',
  '#E91E63', '#00BCD4', '#795548', '#607D8B', '#FF5722', '#3F51B5',
]

const infoRows = [
  { label: '意向岗位', key: 'title' },
  { label: '经验', key: 'exp' },
  { label: '学历', key: 'education' },
  { label: '意向城市', key: 'city' },
  { label: '期望薪资', key: 'salary' },
]

const props = defineProps({
  show: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  data: { type: Object, default: null },
})

defineEmits(['close'])

function getColor(idx) {
  if (idx < COMPARE_COLOR_POOL.length) return COMPARE_COLOR_POOL[idx]
  const hue = (idx * 137.5) % 360
  return 'hsl(' + hue + ', 65%, 50%)'
}

function getUniqueSkills(candidateId) {
  if (!props.data || !props.data.skill_analysis) return []
  return props.data.skill_analysis.unique[candidateId] || []
}
</script>

<style>
.ets-modal-mask {
  position: fixed;
  z-index: 100;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32rpx;
}

.ets-modal-box {
  width: 100%;
  max-height: 90vh;
  background: var(--color-surface);
  border-radius: 24rpx;
  border: 1rpx solid var(--color-outline-variant);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.ets-modal-compare {
  max-width: 800rpx;
}

.ets-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx 28rpx;
  border-bottom: 1rpx solid var(--color-outline-variant);
  flex-shrink: 0;
}

.ets-modal-header-left {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.ets-modal-title {
  font-size: 32rpx;
  font-weight: 700;
  color: var(--color-on-surface);
}

.ets-modal-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56rpx;
  height: 56rpx;
  border-radius: 14rpx;
}

.ets-modal-close:active {
  background: var(--color-surface-container-high);
}

.ets-modal-close .app-icon {
  width: 32rpx;
  height: 32rpx;
  color: var(--color-on-surface-variant);
}

.ets-modal-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 120rpx 32rpx;
  gap: 16rpx;
  color: var(--color-on-surface-variant);
}

.ets-modal-loading .app-icon {
  width: 48rpx;
  height: 48rpx;
}

.ets-loading-text {
  font-size: 28rpx;
}

.ets-modal-scroll {
  flex: 1;
  max-height: 75vh;
}

.ets-modal-body {
  padding: 28rpx;
  display: flex;
  flex-direction: column;
  gap: 36rpx;
}

/* 雷达图 */
.ets-compare-radar {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16rpx;
}

.ets-compare-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 20rpx;
  justify-content: center;
}

.ets-legend-item {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.ets-legend-dot {
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
}

.ets-legend-name {
  font-size: 24rpx;
  font-weight: 500;
  color: var(--color-on-surface);
}

.ets-legend-score {
  font-size: 22rpx;
  color: var(--color-on-surface-variant);
  font-variant-numeric: tabular-nums;
}

/* 技能对比 */
.ets-compare-skills {
  display: flex;
  flex-direction: column;
  gap: 28rpx;
}

.ets-compare-skill-block {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.ets-compare-section-title {
  font-size: 22rpx;
  font-weight: 500;
  color: var(--color-on-surface-variant);
  text-transform: uppercase;
  letter-spacing: 1rpx;
}

.ets-compare-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
}

.ets-tag-green {
  font-size: 22rpx;
  padding: 8rpx 20rpx;
  border-radius: 8rpx;
  background: rgba(5, 150, 105, 0.12);
  color: var(--accent-green);
}

.ets-tag-default {
  font-size: 22rpx;
  padding: 8rpx 20rpx;
  border-radius: 8rpx;
  background: var(--color-surface-container-high);
  color: var(--color-on-surface);
}

.ets-compare-empty {
  font-size: 24rpx;
  color: var(--color-on-surface-variant);
}

.ets-unique-group {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  margin-bottom: 12rpx;
}

.ets-unique-header {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.ets-unique-name {
  font-size: 24rpx;
  font-weight: 500;
  color: var(--color-on-surface);
}

.ets-unique-count {
  font-size: 20rpx;
  color: var(--color-on-surface-variant);
}

/* 基本信息表格 */
.ets-compare-info {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.ets-compare-table {
  border: 1rpx solid var(--color-outline-variant);
  border-radius: 14rpx;
  overflow: hidden;
}

.ets-table-row {
  display: flex;
  border-bottom: 1rpx solid var(--color-outline-variant);
}

.ets-table-row:last-child {
  border-bottom: none;
}

.ets-table-header {
  background: var(--color-surface-container-low);
}

.ets-table-cell {
  flex: 1;
  padding: 14rpx 16rpx;
  font-size: 22rpx;
  color: var(--color-on-surface);
}

.ets-table-label {
  color: var(--color-on-surface-variant);
  font-weight: 500;
}

.ets-table-name {
  display: flex;
  align-items: center;
  gap: 8rpx;
}
</style>
