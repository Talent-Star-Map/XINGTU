<template>
  <view
    class="etc-card"
    :class="{ 'etc-card-expanded': expanded, 'etc-card-selected': selected && multiSelectMode }"
    @tap="onTap"
    @longpress="$emit('longpress')"
  >
    <!-- 顶部区域 -->
    <view class="etc-card-top">
      <!-- 头像 / 多选选中 -->
      <view
        class="etc-avatar"
        :class="{ 'etc-avatar-selected': selected && multiSelectMode }"
      >
        <text v-if="!(selected && multiSelectMode)" class="etc-avatar-text">{{ candidate.name ? candidate.name[0] : '?' }}</text>
        <text v-else class="etc-avatar-check">✓</text>
      </view>

      <!-- 姓名 + 测试标签 + 意向 -->
      <view class="etc-name-area">
        <view class="etc-name-row">
          <text class="etc-name">{{ candidate.name }}</text>
          <text v-if="candidate.job_title" class="etc-test-tag">{{ candidate.job_title }}</text>
        </view>
        <text v-if="candidate.title" class="etc-intent">意向：{{ candidate.title }}</text>
      </view>

      <!-- 匹配度徽章 -->
      <view
        class="etc-match-badge"
        :style="{ background: badgeBg(candidate.match), color: badgeColor(candidate.match) }"
      >
        <text class="etc-match-badge-text">{{ candidate.match != null ? candidate.match : '—' }}%</text>
      </view>
    </view>

    <!-- 技能标签 -->
    <view class="etc-skills">
      <text
        v-for="s in visibleSkills"
        :key="s"
        class="etc-skill-tag"
      >{{ s }}</text>
      <text v-if="hiddenCount > 0" class="etc-skill-more">+{{ hiddenCount }}</text>
      <text v-if="(candidate.skills || []).length === 0" class="etc-skill-empty">—</text>
    </view>

    <!-- 分隔线 -->
    <view class="etc-divider"></view>

    <!-- 底部数据 -->
    <view class="etc-bottom">
      <text class="etc-bottom-item">经验：{{ candidate.exp || '—' }}</text>
      <text class="etc-bottom-item">期望：{{ candidate.salary || '—' }}</text>
      <text class="etc-score" :style="{ color: scoreColor(candidate.match) }">{{ candidate.match != null ? candidate.match : '—' }}</text>
      <view class="etc-arrow" :class="{ 'etc-arrow-up': expanded }">
        <AppIcon name="chevron-down" />
      </view>
    </view>

    <!-- 展开详情 -->
    <view v-if="expanded" class="etc-card-detail">
      <view class="etc-detail-section">
        <text class="etc-detail-title">匹配维度（五维）</text>
        <view class="etc-dim-list">
          <view v-for="dim in DIMENSIONS" :key="dim.key" class="etc-dim-row">
            <text class="etc-dim-label">{{ dim.label }}</text>
            <view class="etc-dim-bar-bg">
              <view
                class="etc-dim-bar"
                :style="{ width: (getScore(dim.key)) + '%', background: dim.color }"
              ></view>
            </view>
            <text class="etc-dim-score" :style="{ color: dim.color }">
              {{ getScore(dim.key) || '—' }}
            </text>
          </view>
        </view>
        <text v-if="candidate.match == null" class="etc-dim-hint">
          匹配引擎尚未计算，点击右上角"重新匹配"
        </text>
      </view>

      <view class="etc-detail-section">
        <text class="etc-detail-title">技能 ({{ candidate.skills.length }})</text>
        <view class="etc-detail-skills">
          <text
            v-for="s in candidate.skills"
            :key="s"
            class="etc-skill-tag"
          >{{ s }}</text>
          <text v-if="candidate.skills.length === 0" class="etc-skill-empty">未提供</text>
        </view>
        <view class="etc-detail-meta">
          <text class="etc-meta-item">学历：{{ candidate.education || '未提供' }}</text>
          <text class="etc-meta-item">意向城市：{{ candidate.city || '未提供' }}</text>
        </view>
      </view>

      <view class="etc-detail-section">
        <text class="etc-detail-title">操作</text>
        <view class="etc-detail-actions">
          <view class="etc-action-btn" @tap.stop="$emit('open-chat')">
            <AppIcon name="mail" />
            <text class="etc-action-text">发起沟通</text>
          </view>
          <text class="etc-match-status">状态：{{ matchStatusLabel }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed } from 'vue'
import AppIcon from '../common/AppIcon.vue'

const DIMENSIONS = [
  { key: 'skill', label: '技能', color: 'var(--color-primary)' },
  { key: 'exp', label: '经验', color: 'var(--accent-purple)' },
  { key: 'edu', label: '学历', color: 'var(--accent-orange)' },
  { key: 'location', label: '地域', color: 'var(--accent-green)' },
  { key: 'salary', label: '薪资', color: 'var(--color-on-surface-variant)' },
]

const props = defineProps({
  candidate: { type: Object, required: true },
  expanded: { type: Boolean, default: false },
  selected: { type: Boolean, default: false },
  multiSelectMode: { type: Boolean, default: false },
})

const emit = defineEmits(['toggle-expand', 'toggle-compare', 'open-chat', 'longpress'])

const visibleSkills = computed(() => (props.candidate.skills || []).slice(0, 3))
const hiddenCount = computed(() => Math.max(0, (props.candidate.skills || []).length - 3))

const matchStatusLabel = computed(() => {
  const s = props.candidate.match_status
  if (s === 'accepted') return '已接受'
  if (s === 'rejected') return '已拒绝'
  if (s === 'communicating') return '沟通中'
  return '待沟通'
})

function onTap() {
  if (props.multiSelectMode) {
    emit('toggle-compare')
  } else {
    emit('toggle-expand')
  }
}

function badgeBg(v) {
  if (v == null) return '#F5F5F5'
  if (v >= 90) return '#E6F7F0'
  if (v >= 70) return '#EAF0FF'
  return '#F0F1F2'
}

function badgeColor(v) {
  if (v == null) return '#8C8C8C'
  if (v >= 90) return '#009966'
  if (v >= 70) return '#165DFF'
  return '#333844'
}

function scoreColor(v) {
  if (v == null) return '#8C8C8C'
  if (v >= 90) return '#009966'
  if (v >= 70) return '#165DFF'
  return '#333844'
}

function getScore(key) {
  if (!props.candidate || !props.candidate.match_breakdown) return 0
  const v = props.candidate.match_breakdown[key]
  return (v != null) ? v : 0
}
</script>

<style>
.etc-card {
  background: #FFFFFF;
  border-radius: 32rpx;
  border: 2rpx solid #EAEAEA;
  margin-bottom: 32rpx;
  overflow: hidden;
  position: relative;
}

.etc-card-selected {
  background: #F5F7FF;
  border-color: #2B7DE9;
}

.etc-card-expanded {
  background: #FAFBFC;
}

.etc-card-top {
  display: flex;
  align-items: flex-start;
  padding: 24rpx 32rpx 0 32rpx;
  gap: 20rpx;
}

.etc-avatar {
  width: 88rpx;
  height: 88rpx;
  border-radius: 50%;
  background: #EBF2FF;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.2s;
}

.etc-avatar-selected {
  background: #2B7DE9;
  border: 4rpx solid #2B7DE9;
}

.etc-avatar-text {
  font-size: 30rpx;
  font-weight: 600;
  color: #2B7DE9;
}

.etc-avatar-selected .etc-avatar-text {
  display: none;
}

.etc-avatar-check {
  font-size: 36rpx;
  font-weight: 700;
  color: #FFFFFF;
}

.etc-name-area {
  flex: 1;
  min-width: 0;
  padding-top: 8rpx;
}

.etc-name-row {
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.etc-name {
  font-size: 30rpx;
  font-weight: 500;
  color: #1A1A1A;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.etc-test-tag {
  font-size: 20rpx;
  font-weight: 500;
  padding: 4rpx 16rpx;
  border-radius: 12rpx;
  background: #FFF2E8;
  color: #FA8C16;
  flex-shrink: 0;
  line-height: 1.4;
}

.etc-intent {
  font-size: 22rpx;
  color: #8C8C8C;
  font-weight: 400;
  margin-top: 6rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.etc-match-badge {
  padding: 4rpx 16rpx;
  border-radius: 20rpx;
  flex-shrink: 0;
  margin-top: 8rpx;
}

.etc-match-badge-text {
  font-size: 22rpx;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.etc-skills {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
  padding: 16rpx 32rpx 0 32rpx;
}

.etc-skill-tag {
  font-size: 20rpx;
  padding: 6rpx 16rpx;
  border-radius: 12rpx;
  background: #E8F0FF;
  color: #595959;
  line-height: 1.3;
}

.etc-skill-more {
  font-size: 20rpx;
  color: #595959;
  padding: 6rpx 8rpx;
  line-height: 1.3;
}

.etc-skill-empty {
  font-size: 20rpx;
  color: #8C8C8C;
  opacity: 0.5;
}

.etc-divider {
  height: 2rpx;
  background: #F0F0F0;
  margin: 16rpx 32rpx 0 32rpx;
}

.etc-bottom {
  display: flex;
  align-items: center;
  padding: 16rpx 32rpx 24rpx 32rpx;
  gap: 16rpx;
}

.etc-bottom-item {
  font-size: 24rpx;
  color: #8C8C8C;
  font-variant-numeric: tabular-nums;
  flex: 1;
}

.etc-score {
  font-size: 40rpx;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.etc-arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48rpx;
  flex-shrink: 0;
  color: #8C8C8C;
  transition: transform 0.2s;
}

.etc-arrow-up {
  transform: rotate(180deg);
}

.etc-arrow .app-icon {
  width: 32rpx;
  height: 32rpx;
}

/* 展开详情 */
.etc-card-detail {
  padding: 20rpx 32rpx 28rpx;
  border-top: 2rpx solid #F0F0F0;
  background: #FFFFFF;
  margin-top: 16rpx;
}

.etc-detail-section {
  margin-bottom: 28rpx;
}

.etc-detail-section:last-child {
  margin-bottom: 0;
}

.etc-detail-title {
  font-size: 22rpx;
  color: #8C8C8C;
  text-transform: uppercase;
  letter-spacing: 1rpx;
  margin-bottom: 16rpx;
  font-weight: 500;
}

.etc-dim-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.etc-dim-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.etc-dim-label {
  font-size: 24rpx;
  color: #8C8C8C;
  width: 60rpx;
}

.etc-dim-bar-bg {
  flex: 1;
  height: 12rpx;
  border-radius: 6rpx;
  background: #F5F7FA;
  overflow: hidden;
}

.etc-dim-bar {
  height: 100%;
  border-radius: 6rpx;
  transition: width 0.5s;
}

.etc-dim-score {
  font-size: 24rpx;
  font-weight: 600;
  width: 60rpx;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.etc-dim-hint {
  font-size: 22rpx;
  color: #8C8C8C;
  margin-top: 16rpx;
}

.etc-detail-skills {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
}

.etc-detail-meta {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  margin-top: 16rpx;
}

.etc-meta-item {
  font-size: 22rpx;
  color: #8C8C8C;
}

.etc-detail-actions {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.etc-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 10rpx;
  padding: 14rpx 28rpx;
  border: 2rpx solid #EAEAEA;
  border-radius: 14rpx;
  background: #FFFFFF;
  align-self: flex-start;
}

.etc-action-btn:active {
  opacity: 0.8;
}

.etc-action-btn .app-icon {
  width: 28rpx;
  height: 28rpx;
  color: #1A1A1A;
}

.etc-action-text {
  font-size: 24rpx;
  font-weight: 500;
  color: #1A1A1A;
}

.etc-match-status {
  font-size: 22rpx;
  color: #8C8C8C;
}
</style>