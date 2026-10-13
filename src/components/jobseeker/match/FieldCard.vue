<template>
  <view class="field-card">
    <view class="fc-icon-wrap">
      <AppIcon :name="icon" class="fc-icon" />
    </view>
    <view class="fc-info">
      <text class="fc-label">{{ label }}</text>
      <text class="fc-value" :class="{ empty: !value }">{{ value || '未识别' }}</text>
    </view>
  </view>
</template>

<script setup>
import AppIcon from '../../common/AppIcon.vue'
defineProps({
  icon: { type: String, required: true },
  label: { type: String, required: true },
  value: { type: String, default: '' },
})
</script>

<style scoped>
.field-card { display: flex; align-items: center; gap: 16rpx; padding: 24rpx; border: 1rpx solid var(--color-outline-variant); border-radius: 16rpx; background: var(--color-surface-container-lowest); }
.fc-icon-wrap { display: flex; width: 72rpx; height: 72rpx; flex: none; align-items: center; justify-content: center; border-radius: 14rpx; background: var(--color-primary-fixed); }
.fc-icon { width: 32rpx; height: 32rpx; color: var(--color-primary); }
.fc-info { flex: 1; min-width: 0; }
.fc-label { font-size: 22rpx; font-weight: 500; color: var(--color-on-surface-variant); display: block; }
.fc-value { font-size: 24rpx; font-weight: 600; color: var(--color-on-surface); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: block; }
.fc-value.empty { color: var(--color-on-surface-variant); font-style: italic; font-weight: 400; }
</style>
