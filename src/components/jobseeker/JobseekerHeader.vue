<template>
  <view class="header">
    <view class="header-inner">
      <view class="brand">
        <view class="brand-star">
          <AppIcon name="star" />
        </view>

        <view class="brand-info">
          <text class="brand-name gradient-text">星图</text>
          <text class="role-badge">求职者</text>
        </view>
      </view>

      <view class="header-actions">
        <view
          class="header-button"
          @tap="$emit('toggle-theme')"
        >
          <AppIcon :name="theme === 'dark' ? 'sun' : 'moon'" />
        </view>

        <view class="header-button notification">
          <AppIcon name="bell" />
          <view class="notification-dot"></view>
        </view>

        <view
          class="user-trigger"
          :class="{ open: menuOpen }"
          @tap="$emit('toggle-menu')"
        >
          <view class="avatar">
            {{ avatarText }}
          </view>

          <text class="user-label">我的</text>

          <AppIcon
            name="chevron-right"
            class="user-chevron"
          />
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import AppIcon from '../common/AppIcon.vue'

defineProps({
  currentPage: String,
  theme: String,
  avatarText: String,
  menuOpen: Boolean
})

const emit = defineEmits([
  'toggle-theme',
  'toggle-menu'
])

</script>

<style>
.header {
  position: relative;
  z-index: 30;
  flex: none;
  border-bottom: 1rpx solid var(--color-outline-variant);
  background: var(--color-surface-container-lowest);
}

.header-inner {
  display: flex;
  width: 100%;
  height: 104rpx;
  padding: 0 28rpx;
  box-sizing: border-box;
  align-items: center;
  justify-content: space-between;
}

.brand {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 14rpx;
}

.brand-star {
  display: flex;
  width: 58rpx;
  height: 58rpx;
  align-items: center;
  justify-content: center;
  border-radius: 17rpx;
  background: var(--color-primary-fixed);
  color: var(--color-primary);
}

.brand-star .app-icon {
  width: 34rpx;
  height: 34rpx;
}

.brand-info {
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.brand-name {
  font-size: 34rpx;
  font-weight: 800;
  line-height: 1;
}

.role-badge {
  padding: 6rpx 12rpx;
  border-radius: 8rpx;
  background: var(--color-primary-fixed);
  color: var(--color-primary);
  font-size: 18rpx;
  font-weight: 600;
  line-height: 1;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.header-button {
  position: relative;
  display: flex;
  width: 66rpx;
  height: 66rpx;
  align-items: center;
  justify-content: center;
  border-radius: 18rpx;
  color: var(--color-on-surface-variant);
}

.header-button:active {
  background: var(--color-surface-container);
}

.header-button .app-icon {
  width: 34rpx;
  height: 34rpx;
}

.notification-dot {
  position: absolute;
  top: 14rpx;
  right: 14rpx;
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  background: var(--color-primary);
  border: 2rpx solid var(--color-surface-container-lowest);
}

.user-trigger {
  display: flex;
  height: 70rpx;
  padding: 5rpx 8rpx 5rpx 6rpx;
  box-sizing: border-box;
  align-items: center;
  gap: 9rpx;
  border-radius: 18rpx;
}

.user-trigger:active,
.user-trigger.open {
  background: var(--color-surface-container);
}

.avatar {
  display: flex;
  width: 58rpx;
  height: 58rpx;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--color-primary-fixed);
  color: var(--color-primary);
  font-size: 19rpx;
  font-weight: 700;
}

.user-label {
  color: var(--color-on-surface);
  font-size: 22rpx;
  font-weight: 600;
}

.user-chevron {
  width: 24rpx;
  height: 24rpx;
  transform: rotate(90deg);
  color: var(--color-outline);
}
</style>