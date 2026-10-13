<template>
  <view class="profile-sidebar">
    <view class="sidebar-card">
      <view
        v-for="item in items"
        :key="item.page"
        class="sidebar-item"
        :class="{ active: currentPage === item.page }"
        @tap="nav.setPage(item.page)"
      >
        <AppIcon :name="item.icon" class="sidebar-icon" />
        <text class="sidebar-label">{{ item.label }}</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { inject, computed } from 'vue'
import AppIcon from '../common/AppIcon.vue'

const nav = inject('jobseekerNav')
const currentPage = computed(() => nav?.currentPage?.value || 'profile-home')

const items = [
  { icon: 'user', label: '个人主页', page: 'profile-home' },
  { icon: 'edit', label: '个人资料', page: 'profile-edit' },
  { icon: 'upload', label: '简历管理', page: 'resume' },
  { icon: 'graph', label: '我的能力图谱', page: 'my-skill-graph' },
]
</script>

<style>
.profile-sidebar {
  width: 100%;
}

.sidebar-card {
  border: 1rpx solid var(--color-outline-variant);
  border-radius: 24rpx;
  padding: 12rpx;
  background: var(--color-surface-container-lowest);
}

.sidebar-item {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 22rpx 24rpx;
  border-radius: 18rpx;
  color: var(--color-on-surface-variant);
}

.sidebar-item:active {
  opacity: 0.8;
}

.sidebar-item.active {
  background: var(--color-primary-fixed);
  color: var(--color-primary);
}

.sidebar-icon {
  width: 36rpx;
  height: 36rpx;
}

.sidebar-label {
  font-size: 24rpx;
  font-weight: 600;
}
</style>
