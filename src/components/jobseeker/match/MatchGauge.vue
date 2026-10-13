<template>
  <view class="gauge-card">
    <view class="gauge-wrap">
      <view class="gauge-svg">
        <svg width="140" height="140" viewBox="0 0 140 140" style="transform: rotate(-90deg);">
          <circle cx="70" cy="70" r="54" fill="none" stroke="var(--color-surface-container)" stroke-width="10"></circle>
          <circle cx="70" cy="70" r="54" fill="none" :stroke="color" stroke-width="10" stroke-linecap="round"
            :stroke-dasharray="circumference" :stroke-dashoffset="dashOffset"
            style="transition: stroke-dashoffset 0.8s ease-out;"></circle>
        </svg>
        <view class="gauge-center">
          <text class="gauge-score" :style="{ color }">{{ Math.round(overall) }}</text>
          <text class="gauge-label">匹配度</text>
        </view>
      </view>
    </view>

    <view class="grade-badge" :style="{ background: bg, borderColor: color + '33' }">
      <text class="grade-text" :style="{ color }">等级 {{ grade }}</text>
      <text class="grade-version">SCORE {{ scoreVersion }}</text>
    </view>

    <view class="grade-list">
      <text v-for="t in ['S 优秀', 'A 良好', 'B 中等', 'C 偏低', 'D 不足']" :key="t"
        :class="t.startsWith(grade) ? 'grade-item active' : 'grade-item'"
        :style="t.startsWith(grade) ? { color } : {}">{{ t }}</text>
    </view>
  </view>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  overall: { type: Number, default: 0 },
  grade: { type: String, default: 'D' },
  scoreVersion: { type: String, default: '' },
})

const GRADE_COLORS = { S: '#00E599', A: '#00C8FF', B: '#FFB547', C: '#FF8C42', D: '#FF4D6A' }
const GRADE_BG = { S: 'rgba(0,229,153,0.12)', A: 'rgba(0,200,255,0.12)', B: 'rgba(255,181,71,0.12)', C: 'rgba(255,140,66,0.12)', D: 'rgba(255,77,106,0.12)' }

const color = computed(() => GRADE_COLORS[props.grade] || 'var(--color-primary)')
const bg = computed(() => GRADE_BG[props.grade] || 'var(--color-primary-fixed)')
const circumference = 2 * Math.PI * 54
const dashOffset = computed(() => circumference * (1 - props.overall / 100))
</script>

<style>
.gauge-card { padding: 40rpx; border: 1rpx solid var(--color-outline-variant); border-radius: 24rpx; background: var(--color-surface-container-lowest); text-align: center; }
.gauge-wrap { display: flex; justify-content: center; margin-bottom: 20rpx; }
.gauge-svg { position: relative; display: inline-flex; align-items: center; justify-content: center; width: 140px; height: 140px; }
.gauge-center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.gauge-score { font-size: 56rpx; font-weight: 800; }
.gauge-label { font-size: 18rpx; color: var(--color-on-surface-variant); margin-top: 4rpx; }
.grade-badge { display: inline-flex; align-items: center; gap: 12rpx; padding: 10rpx 28rpx; border: 1rpx solid; border-radius: 999rpx; margin-bottom: 20rpx; }
.grade-text { font-size: 28rpx; font-weight: 800; }
.grade-version { font-size: 18rpx; color: var(--color-on-surface-variant); }
.grade-list { display: flex; justify-content: center; gap: 20rpx; }
.grade-item { font-size: 18rpx; color: var(--color-on-surface-variant); opacity: 0.6; }
.grade-item.active { font-weight: 700; opacity: 1; }
</style>
