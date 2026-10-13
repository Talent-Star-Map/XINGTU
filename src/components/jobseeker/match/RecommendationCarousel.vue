<template>
  <view v-if="jobs.length === 0" class="empty-rec"></view>
  <view v-else class="rec-panel">
    <view class="rec-title-row">
      <AppIcon name="briefcase" class="rec-title-icon" />
      <text class="rec-title">推荐岗位 Top {{ jobs.length }}</text>
    </view>
    <scroll-view scroll-x class="rec-scroll">
      <view class="rec-list">
        <view v-for="(j, i) in jobs" :key="j.job_id" class="rec-card" :class="{ best: i === 0 }" @tap="$emit('select', j)">
          <view v-if="i === 0" class="best-badge">最佳匹配</view>
          <view class="rec-top">
            <view class="rec-info">
              <text class="rec-job-title">{{ j.title }}</text>
              <view class="rec-company">
                <AppIcon name="building" class="rec-company-icon" />
                <text>{{ j.company }}</text>
              </view>
            </view>
            <view class="rec-score">
              <text class="score-num" :style="{ color: gradeColor(j.grade) }">{{ Math.round(j.overall) }}</text>
              <text class="score-unit">分</text>
            </view>
          </view>
          <view class="rec-meta">
            <AppIcon name="map-pin" class="rec-meta-icon" />
            <text>{{ j.location }}</text>
            <text>{{ j.salary }}</text>
          </view>
          <view class="rec-match">
            <AppIcon name="check-circle" class="match-icon" />
            <text class="match-text">匹配 {{ j.matched_count || 0 }}/{{ j.job_skill_count || 0 }} 项技能</text>
          </view>
          <view v-if="j.top_missing && j.top_missing.length" class="rec-missing">
            <text class="missing-label">需补：</text>
            <text v-for="s in j.top_missing.slice(0, 2)" :key="s" class="missing-tag">{{ s }}</text>
          </view>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import AppIcon from '../../common/AppIcon.vue'

defineProps({
  jobs: { type: Array, default: () => [] },
})

defineEmits(['select'])

const GRADE_COLORS = { S: '#00E599', A: '#00C8FF', B: '#FFB547', C: '#FF8C42', D: '#FF4D6A' }
function gradeColor(g) { return GRADE_COLORS[g] || 'var(--color-primary)' }
</script>

<style>
.rec-panel { padding: 40rpx; border: 1rpx solid var(--color-outline-variant); border-radius: 24rpx; background: var(--color-surface-container-lowest); }
.rec-title-row { display: flex; align-items: center; gap: 12rpx; margin-bottom: 28rpx; }
.rec-title-icon { width: 28rpx; height: 28rpx; color: var(--color-primary); }
.rec-title { font-size: 24rpx; font-weight: 700; color: var(--color-on-surface); }
.rec-scroll { white-space: nowrap; }
.rec-list { display: flex; gap: 24rpx; padding-bottom: 16rpx; }
.rec-card { display: inline-block; flex: none; width: 420rpx; padding: 28rpx; border: 2rpx solid var(--color-outline-variant); border-radius: 20rpx; background: var(--color-surface); vertical-align: top; }
.rec-card.best { border-color: var(--color-primary); box-shadow: 0 0 0 6rpx rgba(0,82,217,0.12); }
.best-badge { display: inline-block; padding: 4rpx 16rpx; border-radius: 8rpx; background: var(--color-primary); color: #fff; font-size: 18rpx; font-weight: 700; margin-bottom: 16rpx; }
.rec-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12rpx; }
.rec-info { flex: 1; min-width: 0; }
.rec-job-title { font-size: 26rpx; font-weight: 600; color: var(--color-on-surface); display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rec-company { display: flex; align-items: center; gap: 6rpx; margin-top: 6rpx; font-size: 20rpx; color: var(--color-on-surface-variant); }
.rec-company-icon { width: 20rpx; height: 20rpx; }
.rec-score { text-align: right; flex: none; }
.score-num { font-size: 36rpx; font-weight: 800; }
.score-unit { font-size: 18rpx; color: var(--color-on-surface-variant); display: block; }
.rec-meta { display: flex; align-items: center; gap: 8rpx; font-size: 20rpx; color: var(--color-on-surface-variant); margin-bottom: 12rpx; }
.rec-meta-icon { width: 20rpx; height: 20rpx; }
.rec-match { padding: 14rpx; border-radius: 14rpx; background: rgba(0,229,153,0.06); margin-bottom: 12rpx; }
.match-icon { width: 20rpx; height: 20rpx; color: var(--accent-green); }
.match-text { font-size: 20rpx; font-weight: 500; color: var(--accent-green); }
.rec-missing { display: flex; flex-wrap: wrap; align-items: center; gap: 8rpx; }
.missing-label { font-size: 20rpx; color: var(--color-on-surface-variant); }
.missing-tag { padding: 4rpx 12rpx; border-radius: 6rpx; background: rgba(255,77,106,0.08); color: var(--accent-red); font-size: 18rpx; }
</style>
