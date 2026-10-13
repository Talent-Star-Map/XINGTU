<template>
  <view class="enterprise-header" :class="themeClass">
    <view class="header-left">
      <view class="brand-box">
        <text class="brand-name">星图</text>
        <text class="brand-badge">企业版</text>
      </view>
    </view>

    <view class="header-right">
      <view class="header-btn" @tap="onIndustryReport">
        <AppIcon name="file-text" />
      </view>

      <view class="header-btn" @tap="$emit('toggle-theme')">
        <AppIcon :name="theme === 'dark' ? 'sun' : 'moon'" />
      </view>

      <view class="avatar-wrap" @tap="toggleMenu">
        <view class="avatar">
          <text class="avatar-text">{{ avatarText }}</text>
        </view>
      </view>
    </view>

    <view v-if="menuOpen" class="menu-mask" @tap="closeMenu"></view>

    <view v-if="menuOpen" class="avatar-menu" :class="themeClass">
      <view class="menu-item" @tap="onMenuItem('company-profile')">
        <AppIcon name="building" />
        <text class="menu-item-text">企业信息</text>
      </view>
      <view class="menu-divider"></view>
      <view class="menu-item menu-item-danger" @tap="onMenuItem('logout')">
        <AppIcon name="logout" />
        <text class="menu-item-text">退出登录</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed, ref } from 'vue'
import AppIcon from '../common/AppIcon.vue'

const props = defineProps({
  avatarText: { type: String, default: '企' },
  theme: { type: String, default: 'light' }
})

const emit = defineEmits(['menu-select', 'toggle-theme'])

const menuOpen = ref(false)
const themeClass = computed(() => `theme-${props.theme}`)

function toggleMenu() {
  menuOpen.value = !menuOpen.value
}

function closeMenu() {
  menuOpen.value = false
}

function onIndustryReport() {
  emit('menu-select', 'industry-report')
}

function onMenuItem(type) {
  menuOpen.value = false
  emit('menu-select', type)
}
</script>

<style>
.enterprise-header {
  position: relative;
  z-index: 30;
  display: flex;
  height: 100rpx;
  padding: 0 32rpx;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1rpx solid var(--color-outline-variant);
  background: var(--color-surface-container-lowest);
  box-sizing: border-box;
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
}

.brand-box {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.brand-name {
  font-size: 36rpx;
  font-weight: 800;
  background: linear-gradient(135deg, var(--color-primary), var(--accent-purple));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  letter-spacing: 2rpx;
}

.brand-badge {
  font-size: 20rpx;
  font-weight: 600;
  padding: 4rpx 16rpx;
  border-radius: 8rpx;
  background: var(--accent-purple-dim);
  color: var(--accent-purple);
  line-height: 1.4;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.header-btn {
  display: flex;
  width: 64rpx;
  height: 64rpx;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: var(--color-on-surface-variant);
}

.header-btn:active {
  background: var(--color-surface-container-high);
}

.header-btn .app-icon {
  width: 36rpx;
  height: 36rpx;
}

.avatar-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6rpx;
}

.avatar {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent-purple-dim);
  color: var(--accent-purple);
  font-size: 26rpx;
  font-weight: 700;
}

.avatar-text {
  line-height: 1;
}

.menu-mask {
  position: fixed;
  z-index: 40;
  inset: 0;
  background: transparent;
}

.avatar-menu {
  position: absolute;
  z-index: 41;
  top: 100rpx;
  right: 24rpx;
  width: 280rpx;
  padding: 12rpx 0;
  border: 1rpx solid var(--color-outline-variant);
  border-radius: 20rpx;
  background: var(--color-surface-container-lowest);
  box-shadow: 0 8rpx 40rpx rgba(0, 0, 0, 0.12);
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 24rpx 32rpx;
  font-size: 28rpx;
  color: var(--color-on-surface);
}

.menu-item:active {
  background: var(--color-surface-container-high);
}

.menu-item-text {
  line-height: 1.4;
}

.menu-item-danger .menu-item-text {
  color: var(--accent-red);
}

.menu-divider {
  height: 1rpx;
  margin: 8rpx 24rpx;
  background: var(--color-outline-variant);
}
</style>