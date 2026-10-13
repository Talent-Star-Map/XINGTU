<template>
  <view class="gap-panel">
    <SkillGapCards :have="result.skills.have" :miss="result.skills.miss" :extra="extraItems" />

    <view class="summary-card">
      <view class="summary-header">
        <view class="summary-title">
          <AppIcon name="book" class="summary-icon" />
          <text class="summary-title-text">诊断总结与改进建议</text>
        </view>
        <view class="summary-link" @tap="$emit('goToLearning')">
          <AppIcon name="book" class="link-icon" />
          <text class="link-text">查看学习报告</text>
        </view>
      </view>
      <text class="summary-text">{{ result.summary }}</text>
      <view v-if="result.recommendations && result.recommendations.length" class="recommendations">
        <view
          v-for="(rec, idx) in result.recommendations"
          :key="idx"
          class="rec-item"
        >
          <view class="rec-badge">{{ idx + 1 }}</view>
          <text class="rec-text">{{ rec }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed } from 'vue'
import AppIcon from '../../common/AppIcon.vue'
import SkillGapCards from './SkillGapCards.vue'

const props = defineProps({
  result: {
    type: Object,
    required: true,
  },
})

defineEmits(['goToLearning'])

const extraItems = computed(() => {
  return (props.result.skills.extra || []).map(s =>
    typeof s === 'string' ? { skill: s } : s
  )
})
</script>

<style>
.gap-panel {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.summary-card {
  padding: 40rpx;
  border: 1rpx solid var(--color-outline-variant);
  border-radius: 24rpx;
  background: var(--color-surface-container-lowest);
}

.summary-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24rpx;
}

.summary-title {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.summary-icon {
  width: 28rpx;
  height: 28rpx;
  color: var(--accent-purple);
}

.summary-title-text {
  font-size: 24rpx;
  font-weight: 700;
  color: var(--color-on-surface);
}

.summary-link {
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 8rpx 20rpx;
  border: 1rpx solid var(--color-outline-variant);
  border-radius: 14rpx;
}

.link-icon {
  width: 22rpx;
  height: 22rpx;
  color: var(--color-primary);
}

.link-text {
  font-size: 20rpx;
  font-weight: 500;
  color: var(--color-primary);
}

.summary-text {
  font-size: 24rpx;
  line-height: 1.7;
  color: var(--color-on-surface);
}

.recommendations {
  margin-top: 24rpx;
  padding-top: 24rpx;
  border-top: 1rpx solid var(--color-outline-variant);
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.rec-item {
  display: flex;
  align-items: flex-start;
  gap: 12rpx;
}

.rec-badge {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 36rpx;
  height: 36rpx;
  padding: 0 8rpx;
  border-radius: 8rpx;
  background: var(--color-primary-fixed);
  color: var(--color-primary);
  font-size: 18rpx;
  font-weight: 700;
  margin-top: 2rpx;
}

.rec-text {
  font-size: 22rpx;
  line-height: 1.6;
  color: var(--color-on-surface-variant);
}
</style>
