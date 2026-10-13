<template>
  <view class="ejm-mask" @tap="onMaskTap">
    <view class="ejm-content" @tap.stop>
      <view class="ejm-header">
        <text class="ejm-title">{{ title }}</text>
        <view class="ejm-close" @tap="onClose">
          <AppIcon name="x" />
        </view>
      </view>
      <scroll-view class="ejm-body" scroll-y :show-scrollbar="false">
        <slot></slot>
      </scroll-view>
    </view>
  </view>
</template>

<script setup>
import AppIcon from '../common/AppIcon.vue'

defineProps({
  title: { type: String, default: '' }
})

const emit = defineEmits(['close'])

function onClose() {
  emit('close')
}

function onMaskTap() {
  emit('close')
}
</script>

<style>
.ejm-mask {
  position: fixed;
  z-index: 50;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32rpx;
  background: var(--color-scrim);
  box-sizing: border-box;
}

.ejm-content {
  width: 100%;
  max-width: 620rpx;
  max-height: 80vh;
  border: 1rpx solid var(--color-outline-variant);
  border-radius: 24rpx;
  background: var(--color-surface-container-lowest);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.ejm-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 32rpx;
  border-bottom: 1rpx solid var(--color-outline-variant);
  flex-shrink: 0;
}

.ejm-title {
  font-size: 32rpx;
  font-weight: 700;
  color: var(--color-on-surface);
}

.ejm-close {
  display: flex;
  width: 48rpx;
  height: 48rpx;
  align-items: center;
  justify-content: center;
  border-radius: 12rpx;
  color: var(--color-on-surface-variant);
}

.ejm-close:active {
  background: var(--color-surface-container-high);
}

.ejm-close .app-icon {
  width: 28rpx;
  height: 28rpx;
}

.ejm-body {
  padding: 32rpx;
  flex: 1;
  overflow-y: auto;
}
</style>