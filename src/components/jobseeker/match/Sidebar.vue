<template>
  <view class="match-sidebar">
    <view class="sidebar-card">
      <view v-for="item in items" :key="item.key" class="sidebar-item" :class="{ active: mode === item.key }" @tap="$emit('modeChange', item.key)">
        <AppIcon :name="item.icon" class="si-icon" />
        <view class="si-info">
          <text class="si-label">{{ item.label }}</text>
          <text class="si-desc">{{ item.desc }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import AppIcon from '../../common/AppIcon.vue'

defineProps({
  mode: { type: String, default: 'recommend' },
})

defineEmits(['modeChange'])

const items = [
  { key: 'recommend', icon: 'sparkles', label: '智能推荐', desc: '匹配最佳岗位' },
  { key: 'diagnose', icon: 'target', label: '岗位诊断', desc: '分析能力差距' },
]
</script>

<style>
.match-sidebar { width: 100%; }
.sidebar-card { padding: 10rpx; border: 1rpx solid var(--color-outline-variant); border-radius: 24rpx; background: var(--color-surface-container-lowest); display: flex; flex-direction: column; gap: 6rpx; }
.sidebar-item { display: flex; align-items: center; gap: 20rpx; padding: 22rpx 20rpx; border-radius: 18rpx; border-left: 6rpx solid transparent; }
.sidebar-item.active { background: var(--color-primary-fixed); border-left-color: var(--color-primary); }
.si-icon { flex: none; width: 36rpx; height: 36rpx; }
.sidebar-item.active .si-icon { color: var(--color-primary); }
.si-info {}
.si-label { font-size: 24rpx; font-weight: 600; color: var(--color-on-surface); display: block; }
.sidebar-item.active .si-label { color: var(--color-primary); }
.si-desc { font-size: 18rpx; color: var(--color-outline); display: block; margin-top: 4rpx; }
</style>
