<template>
  <view class="low-conf-banner">
    <AppIcon name="alert-triangle" class="banner-icon" />
    <view class="banner-body">
      <text class="banner-title">简历解析置信度较低 ({{ confidenceAvg }})</text>
      <text class="banner-desc">以下技能建议确认是否准确，或补充简历后重新解析。</text>
      <view v-if="lowConfidenceSkills.length" class="banner-tags">
        <text v-for="s in lowConfidenceSkills" :key="s" class="banner-tag">{{ s }}</text>
      </view>
    </view>
    <view class="banner-close" @tap="$emit('dismiss')">
      <text class="close-x">&#x2715;</text>
    </view>
  </view>
</template>

<script setup>
import AppIcon from '../../common/AppIcon.vue'

defineProps({
  confidenceAvg: { type: [Number, String], default: 0 },
  lowConfidenceSkills: { type: Array, default: () => [] },
})

defineEmits(['dismiss'])
</script>

<style>
.low-conf-banner { display: flex; gap: 20rpx; padding: 28rpx; border: 1rpx solid rgba(255,181,71,0.3); border-radius: 20rpx; background: rgba(255,181,71,0.06); }
.banner-icon { flex: none; width: 36rpx; height: 36rpx; color: var(--accent-orange); margin-top: 4rpx; }
.banner-body { flex: 1; }
.banner-title { font-size: 22rpx; font-weight: 600; color: var(--accent-orange); display: block; }
.banner-desc { font-size: 20rpx; color: var(--color-on-surface-variant); margin-top: 8rpx; display: block; }
.banner-tags { display: flex; flex-wrap: wrap; gap: 10rpx; margin-top: 14rpx; }
.banner-tag { padding: 6rpx 14rpx; border: 1rpx solid var(--color-outline-variant); border-radius: 8rpx; background: var(--color-surface); color: var(--color-on-surface-variant); font-size: 20rpx; }
.banner-close { flex: none; }
.close-x { font-size: 28rpx; color: var(--color-outline); }
</style>
