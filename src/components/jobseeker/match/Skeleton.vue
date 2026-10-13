<template>
  <view class="skel-card">
    <view class="skel-header">
      <view class="skel-circle skel-sm"></view>
      <view class="skel-text" style="width: 60%;"></view>
    </view>
    <view class="skel-text" style="width: 40%; height: 16rpx;"></view>
    <view class="skel-text" style="width: 80%; height: 16rpx;"></view>
    <view class="skel-tags">
      <view class="skel-tag"></view>
      <view class="skel-tag"></view>
      <view class="skel-tag"></view>
    </view>
  </view>
</template>

<script setup>
</script>

<style>
.skel-card {
  padding: 32rpx;
  border: 1rpx solid var(--color-outline-variant);
  border-radius: 20rpx;
  background: var(--color-surface-container-lowest);
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.skel-header {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.skel-circle {
  border-radius: 50%;
  background: var(--color-surface-container);
  animation: skel-pulse 1.5s ease-in-out infinite;
}

.skel-sm {
  width: 48rpx;
  height: 48rpx;
}

.skel-text {
  height: 20rpx;
  border-radius: 8rpx;
  background: var(--color-surface-container);
  animation: skel-pulse 1.5s ease-in-out infinite;
}

.skel-tags {
  display: flex;
  gap: 12rpx;
}

.skel-tag {
  width: 96rpx;
  height: 36rpx;
  border-radius: 8rpx;
  background: var(--color-surface-container);
  animation: skel-pulse 1.5s ease-in-out infinite;
}

@keyframes skel-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
</style>
