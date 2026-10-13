<template>
  <view v-if="open" class="menu-mask" @tap="$emit('close')">
    <view class="user-menu" @tap.stop>
      <view
        v-for="item in profileItems"
        :key="item.key"
        class="menu-item"
        @tap="$emit('change-page', item.key)"
      >
        <AppIcon :name="item.icon" />
        <text>{{ item.label }}</text>
      </view>

      <view class="menu-divider"></view>

      <view
        class="menu-item"
        @tap="$emit('change-page', 'resume-center')"
      >
        <AppIcon name="file" />
        <text>简历中心</text>
      </view>

      <view
        class="menu-item"
        @tap="$emit('logout')"
      >
        <AppIcon name="logout" />
        <text>退出登录</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import AppIcon from '../common/AppIcon.vue'

defineProps({ open: Boolean })

defineEmits(['close', 'change-page', 'logout'])

const profileItems = [
  { key: 'profile-home', icon: 'user', label: '个人主页' },
  { key: 'resume', icon: 'upload', label: '简历管理' },
  { key: 'my-skill-graph', icon: 'activity', label: '我的图谱' }
]
</script>

<style>
.menu-mask {
  position: fixed;
  z-index: 40;
  inset: 0;
}

.user-menu {
  position: absolute;
  top: 150rpx;
  right: 10rpx;
  width: 212rpx;
  overflow: hidden;
  border: 1rpx solid var(--color-outline-variant);
  border-radius: 16rpx;
  background: var(--color-surface-container-lowest);
  box-shadow: 0 16rpx 32rpx rgba(14, 28, 44, .16);
  animation: menu-enter .2s ease-out;
}

.menu-item {
  display: flex;
  gap: 13rpx;
  padding: 16rpx 19rpx;
  align-items: center;
  color: var(--color-on-surface-variant);
  font-size: 22rpx;
}

.menu-item:active {
  background: var(--color-surface-container-low);
  color: var(--color-on-surface);
}

.menu-item .app-icon {
  font-size: 26rpx;
}

.menu-item.logout {
  color: var(--color-on-surface-variant);
}

.menu-item.logout:active {
  background: var(--color-surface-container-low);
  color: var(--color-on-surface);
}

.menu-divider {
  height: 1rpx;
  margin: 4rpx 0;
  background: var(--color-outline-variant);
}

@keyframes menu-enter {
  from {
    opacity: 0;
    transform: translateY(-16rpx);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
