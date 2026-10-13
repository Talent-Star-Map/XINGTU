<template>
  <view class="dim-bars">
    <text class="dim-title">四维度匹配分数</text>
    <view class="dim-grid">
      <view v-for="(item, key) in dimItems" :key="key" class="dim-item">
        <view class="dim-header">
          <text class="dim-label">{{ item.label }}</text>
          <text class="dim-score" :style="{ color: item.color }">{{ Math.round(item.data.score) }}%</text>
        </view>
        <view class="dim-track">
          <view class="dim-fill" :style="{ width: item.data.score + '%', background: 'linear-gradient(90deg, ' + item.color + '66, ' + item.color + ')' }"></view>
        </view>
        <view class="dim-footer">
          <text class="dim-meta">权重 {{ (item.data.weight * 100).toFixed(0) }}%</text>
          <text class="dim-meta">加权 {{ item.data.weighted.toFixed(1) }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  dims: { type: Object, required: true },
})

const LABELS = { skill: '技能匹配', experience: '经验匹配', education: '学历匹配', salary: '薪资匹配' }
const COLORS = { skill: 'var(--color-primary)', experience: 'var(--accent-purple)', education: 'var(--accent-green)', salary: 'var(--accent-orange)' }

const dimItems = computed(() => {
  const result = {}
  for (const key of ['skill', 'experience', 'education', 'salary']) {
    if (props.dims && props.dims[key]) {
      result[key] = { label: LABELS[key], color: COLORS[key], data: props.dims[key] }
    }
  }
  return result
})
</script>

<style>
.dim-bars { padding: 40rpx; border: 1rpx solid var(--color-outline-variant); border-radius: 24rpx; background: var(--color-surface-container-lowest); }
.dim-title { font-size: 24rpx; font-weight: 700; color: var(--color-on-surface); display: block; margin-bottom: 28rpx; }
.dim-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32rpx; }
.dim-item {}
.dim-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10rpx; }
.dim-label { font-size: 22rpx; color: var(--color-on-surface-variant); }
.dim-score { font-size: 22rpx; font-weight: 700; }
.dim-track { height: 14rpx; border-radius: 999rpx; background: var(--color-surface-container); overflow: hidden; }
.dim-fill { height: 100%; border-radius: 999rpx; transition: width 0.8s ease-out; }
.dim-footer { display: flex; justify-content: space-between; margin-top: 8rpx; }
.dim-meta { font-size: 18rpx; color: var(--color-on-surface-variant); }
</style>
