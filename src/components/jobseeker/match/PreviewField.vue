<template>
  <view class="preview-field">
    <text class="pf-label">{{ label }}</text>
    <text class="pf-value" :class="{ empty: !value }">{{ value || '未识别' }}</text>
  </view>
</template>

<script setup>
defineProps({
  label: { type: String, required: true },
  value: { type: String, default: '' },
})
</script>

<style scoped>
.preview-field { padding: 20rpx; border: 1rpx solid var(--color-outline-variant); border-radius: 12rpx; background: var(--color-surface); }
.pf-label { font-size: 20rpx; font-weight: 500; color: var(--color-on-surface-variant); display: block; }
.pf-value { font-size: 24rpx; margin-top: 4rpx; display: block; font-weight: 600; color: var(--color-on-surface); }
.pf-value.empty { color: var(--color-on-surface-variant); font-style: italic; font-weight: 400; }
</style>
