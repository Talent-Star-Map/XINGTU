<template>
  <view class="timeline-card">
    <view class="timeline-header">
      <view class="timeline-title-row">
        <AppIcon name="book" class="tl-icon" />
        <text class="tl-title">学习路径规划</text>
      </view>
      <view class="tl-badge">
        <text class="tl-badge-text">预计 {{ totalWeeks }}</text>
      </view>
    </view>
    <text class="tl-desc">基于您与「{{ targetJobTitle }}」的差距，为您生成分阶段提升路线图。</text>

    <view class="tl-body">
      <view class="tl-line"></view>
      <view v-for="(p, idx) in phases" :key="p.phase" class="tl-item">
        <view class="tl-dot" :style="{ background: phaseColors[idx % phaseColors.length] }">
          <text class="tl-dot-text">{{ p.phase }}</text>
        </view>
        <view class="tl-card" :class="{ open: expanded === idx }" @tap="toggle(idx)">
          <view class="tl-card-header">
            <view>
              <text class="tl-card-title">第{{ p.phase }}阶段：{{ p.title }}</text>
              <text class="tl-card-duration">{{ p.duration }}</text>
            </view>
            <AppIcon :name="expanded === idx ? 'chevron-down' : 'chevron-right'" class="tl-arrow" :style="{ color: expanded === idx ? phaseColors[idx % phaseColors.length] : 'var(--color-outline)' }" />
          </view>
          <view v-if="expanded === idx" class="tl-card-body">
            <view class="tl-section">
              <text class="tl-section-title">学习技能</text>
              <view class="tl-tags">
                <text v-for="s in p.skills" :key="s" class="tl-tag" :style="{ background: phaseColors[idx % phaseColors.length] + '15', color: phaseColors[idx % phaseColors.length] }">{{ s }}</text>
              </view>
            </view>
            <view class="tl-section">
              <text class="tl-section-title">学习目标</text>
              <view v-for="g in p.goals" :key="g" class="tl-goal">
                <AppIcon name="check-circle" class="tl-goal-icon" :style="{ color: phaseColors[idx % phaseColors.length] }" />
                <text class="tl-goal-text">{{ g }}</text>
              </view>
            </view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import AppIcon from '../../common/AppIcon.vue'

defineProps({
  phases: { type: Array, default: () => [] },
  totalWeeks: { type: String, default: '' },
  targetJobTitle: { type: String, default: '' },
})

const expanded = ref(0)
const phaseColors = ['#00C8FF', '#7C3AED', '#00E599', '#FF8C42']

function toggle(idx) { expanded.value = expanded.value === idx ? -1 : idx }
</script>

<style>
.timeline-card { padding: 40rpx; border: 1rpx solid var(--color-outline-variant); border-radius: 24rpx; background: var(--color-surface-container-lowest); }
.timeline-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12rpx; }
.timeline-title-row { display: flex; align-items: center; gap: 12rpx; }
.tl-icon { width: 28rpx; height: 28rpx; color: var(--color-primary); }
.tl-title { font-size: 24rpx; font-weight: 700; color: var(--color-on-surface); }
.tl-badge { padding: 8rpx 20rpx; border-radius: 999rpx; background: var(--color-primary-fixed); }
.tl-badge-text { font-size: 22rpx; font-weight: 500; color: var(--color-primary); }
.tl-desc { font-size: 22rpx; color: var(--color-on-surface-variant); margin-bottom: 28rpx; display: block; }
.tl-body { position: relative; }
.tl-line { position: absolute; left: 36rpx; top: 16rpx; bottom: 16rpx; width: 3rpx; background: var(--color-outline-variant); }
.tl-item { position: relative; padding-left: 92rpx; padding-bottom: 28rpx; }
.tl-item:last-child { padding-bottom: 0; }
.tl-dot { position: absolute; left: 20rpx; top: 12rpx; width: 36rpx; height: 36rpx; border-radius: 50%; display: flex; align-items: center; justify-content: center; z-index: 1; }
.tl-dot-text { font-size: 18rpx; font-weight: 700; color: #fff; }
.tl-card { border: 1rpx solid var(--color-outline-variant); border-radius: 20rpx; background: var(--color-surface); }
.tl-card.open { border-color: rgba(0,200,255,0.3); }
.tl-card-header { display: flex; justify-content: space-between; align-items: center; padding: 24rpx 28rpx; }
.tl-card-title { font-size: 24rpx; font-weight: 600; color: var(--color-on-surface); display: block; }
.tl-card-duration { font-size: 20rpx; color: var(--color-on-surface-variant); display: block; margin-top: 4rpx; }
.tl-arrow { width: 28rpx; height: 28rpx; }
.tl-card-body { padding: 0 28rpx 28rpx; border-top: 1rpx solid var(--color-outline-variant); }
.tl-section { margin-top: 20rpx; }
.tl-section-title { font-size: 22rpx; font-weight: 600; color: var(--color-on-surface-variant); display: block; margin-bottom: 12rpx; }
.tl-tags { display: flex; flex-wrap: wrap; gap: 10rpx; }
.tl-tag { padding: 8rpx 16rpx; border-radius: 10rpx; font-size: 20rpx; font-weight: 500; }
.tl-goal { display: flex; align-items: flex-start; gap: 10rpx; margin-bottom: 8rpx; }
.tl-goal-icon { width: 22rpx; height: 22rpx; margin-top: 2rpx; }
.tl-goal-text { font-size: 22rpx; color: var(--color-on-surface); line-height: 1.5; }
</style>
