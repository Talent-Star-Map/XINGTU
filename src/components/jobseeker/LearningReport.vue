<template>
  <view class="learning-report">
    <!-- 详情视图 -->
    <view v-if="activeReport" class="report-detail">
      <view class="go-back" @tap="activeId = null">
        <AppIcon name="arrow-left" class="back-icon" />
        <text class="back-text">返回记录列表</text>
      </view>

      <!-- 详情头部 -->
      <view class="card detail-header">
        <view class="header-main">
          <view class="header-icon-wrap">
            <AppIcon name="target" class="header-icon" />
          </view>
          <view class="header-info">
            <text class="header-title">{{ activeReport.jobTitle }}</text>
            <text class="header-meta">{{ activeReport.jobCompany }} · {{ activeReport.jobLocation }} · {{ activeReport.jobSalary }}</text>
            <view class="header-stats">
              <view class="stat-item">
                <AppIcon name="check-circle" class="stat-icon green" />
                <text class="stat-text green">已掌握 {{ activeReport.haveCount }} 项</text>
              </view>
              <view class="stat-item">
                <AppIcon name="target" class="stat-icon red" />
                <text class="stat-text red">待提升 {{ activeReport.missCount }} 项</text>
              </view>
              <view class="stat-item">
                <AppIcon name="clock" class="stat-icon primary" />
                <text class="stat-text primary">预计 {{ detailTotalWeeks }}-{{ detailTotalWeeks + 2 }} 周</text>
              </view>
            </view>
          </view>
          <view class="score-area">
            <text class="score-num" :style="{ color: scoreColor(activeReport.overall) }">{{ activeReport.overall }}</text>
            <text class="score-label">匹配度</text>
          </view>
        </view>
      </view>

      <!-- 学习路径 -->
      <view v-if="detailPhases.length > 0" class="card">
        <text class="section-title">学习路径规划</text>
        <view class="timeline">
          <view class="timeline-line"></view>
          <view v-for="(p, idx) in detailPhases" :key="p.phase" class="timeline-item">
            <view class="timeline-dot" :style="{ background: phaseColors[idx % phaseColors.length] }">{{ p.phase }}</view>
            <view class="phase-card">
              <view class="phase-header">
                <text class="phase-name">第 {{ p.phase }} 阶段：{{ p.title }}</text>
                <view class="phase-duration" :style="{ background: phaseColors[idx % phaseColors.length] + '15', color: phaseColors[idx % phaseColors.length] }">
                  {{ p.duration }}
                </view>
              </view>
              <view class="skill-tags">
                <text
                  v-for="s in p.skills"
                  :key="s"
                  class="skill-chip"
                  :style="{ background: phaseColors[idx % phaseColors.length] + '15', color: phaseColors[idx % phaseColors.length] }"
                >
                  {{ s }}{{ p.etaPerSkill ? ` · ${p.etaPerSkill}w` : '' }}
                </text>
              </view>
              <view class="goals-list">
                <view v-for="g in p.goals" :key="g" class="goal-item">
                  <AppIcon name="check-circle" class="goal-icon" :style="{ color: phaseColors[idx % phaseColors.length] }" />
                  <text class="goal-text">{{ g }}</text>
                </view>
              </view>
            </view>
          </view>
        </view>
      </view>

      <!-- 改进建议 -->
      <view v-if="activeReport.recommendations && activeReport.recommendations.length > 0" class="card">
        <text class="section-title">改进建议</text>
        <view class="rec-list">
          <view v-for="(rec, i) in activeReport.recommendations" :key="i" class="rec-item">
            <view class="rec-badge">{{ i + 1 }}</view>
            <text class="rec-text">{{ rec }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 列表视图 -->
    <view v-else class="report-list">
      <view class="list-header">
        <text class="page-title">诊断记录</text>
        <view class="header-actions">
          <view v-if="history.length > 0" class="clear-btn" @tap="clearAll">
            <AppIcon name="trash-2" class="clear-icon" />
            <text class="clear-text">清空记录</text>
          </view>
          <view class="back-btn" @tap="goBack">
            <text class="back-btn-text">返回岗位</text>
          </view>
        </view>
      </view>

      <!-- 空状态 -->
      <view v-if="history.length === 0" class="empty-card">
        <AppIcon name="book" class="empty-icon" />
        <text class="empty-title">暂无诊断记录</text>
        <text class="empty-desc">完成岗位诊断后，报告将自动保存在这里</text>
        <view class="go-btn" @tap="goBack">
          <text class="go-btn-text">前往岗位</text>
        </view>
      </view>

      <!-- 记录列表 -->
      <view v-else class="record-list">
        <view
          v-for="r in history"
          :key="r.id"
          class="record-item"
          @tap="activeId = r.id"
        >
          <view class="record-icon-wrap">
            <AppIcon name="target" class="record-icon" />
          </view>
          <view class="record-info">
            <text class="record-title">{{ r.jobTitle }}</text>
            <text class="record-meta">{{ r.jobCompany }} · {{ r.jobLocation }} · {{ r.jobSalary }}</text>
            <view class="record-stats">
              <text class="stat-green">已掌握 {{ r.haveCount }}</text>
              <text class="stat-red">待提升 {{ r.missCount }}</text>
              <text class="stat-date">{{ formatDate(r.id) }}</text>
            </view>
          </view>
          <view class="record-score-area">
            <text class="record-score" :style="{ color: scoreColor(r.overall) }">{{ r.overall }}</text>
            <text class="record-score-label">匹配度</text>
          </view>
          <view class="record-delete" @tap.stop="deleteReport(r.id)">
            <AppIcon name="trash-2" class="delete-icon" />
          </view>
          <AppIcon name="chevron-right" class="record-arrow" />
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, inject, onMounted } from 'vue'
import AppIcon from '../common/AppIcon.vue'

const nav = inject('jobseekerNav')

const history = ref([])
const activeId = ref(null)
const phaseColors = ['#00C8FF', '#7C3AED', '#00E599']

const activeReport = computed(() => history.value.find(r => r.id === activeId.value))
const detailPhases = computed(() => activeReport.value?.phases || [])
const detailTotalWeeks = computed(() => detailPhases.value.reduce((s, p) => s + (parseInt(p.duration) || 0), 0))

function scoreColor(score) {
  if (score >= 70) return 'var(--accent-green)'
  if (score >= 60) return 'var(--color-primary)'
  return 'var(--accent-red)'
}

function formatDate(ts) {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function goBack() {
  nav.setPage('match')
}

function deleteReport(id) {
  const next = history.value.filter(r => r.id !== id)
  history.value = next
  uni.setStorageSync('jt_diagnosis_history', JSON.stringify(next))
  if (activeId.value === id) activeId.value = null
}

function clearAll() {
  history.value = []
  activeId.value = null
  uni.removeStorageSync('jt_diagnosis_history')
}

onMounted(() => {
  try {
    const raw = uni.getStorageSync('jt_diagnosis_history')
    if (raw) {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
      history.value = parsed
    }
  } catch {}
})
</script>

<style>
.learning-report {
  width: 100%;
  box-sizing: border-box;
  padding: 28rpx 24rpx 48rpx;
}

.report-detail,
.report-list {
  display: flex;
  flex-direction: column;
  gap: 32rpx;
}

.go-back {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.back-icon {
  width: 28rpx;
  height: 28rpx;
  color: var(--color-on-surface-variant);
}

.back-text {
  font-size: 26rpx;
  font-weight: 500;
  color: var(--color-on-surface-variant);
}

.card {
  padding: 40rpx;
  border: 1rpx solid var(--color-outline-variant);
  border-radius: 24rpx;
  background: var(--color-surface-container-lowest);
}

.header-main {
  display: flex;
  gap: 24rpx;
  align-items: flex-start;
}

.header-icon-wrap {
  flex: none;
  width: 88rpx;
  height: 88rpx;
  border-radius: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-primary-fixed);
}

.header-icon {
  width: 48rpx;
  height: 48rpx;
  color: var(--color-primary);
}

.header-info {
  flex: 1;
  min-width: 0;
}

.header-title {
  display: block;
  font-size: 28rpx;
  font-weight: 700;
  color: var(--color-on-surface);
}

.header-meta {
  display: block;
  font-size: 22rpx;
  margin-top: 8rpx;
  color: var(--color-on-surface-variant);
}

.header-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 24rpx;
  margin-top: 16rpx;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 6rpx;
}

.stat-icon {
  width: 24rpx;
  height: 24rpx;
}

.stat-icon.green { color: var(--accent-green); }
.stat-icon.red { color: var(--accent-red); }
.stat-icon.primary { color: var(--color-primary); }

.stat-text {
  font-size: 22rpx;
}

.stat-text.green { color: var(--accent-green); }
.stat-text.red { color: var(--accent-red); }
.stat-text.primary { color: var(--color-primary); }

.score-area {
  flex: none;
  text-align: right;
}

.score-num {
  display: block;
  font-size: 48rpx;
  font-weight: 800;
}

.score-label {
  display: block;
  font-size: 18rpx;
  color: var(--color-on-surface-variant);
}

.section-title {
  display: block;
  font-size: 26rpx;
  font-weight: 700;
  color: var(--color-on-surface);
  margin-bottom: 32rpx;
}

.timeline {
  position: relative;
  padding-left: 48rpx;
}

.timeline-line {
  position: absolute;
  left: 20rpx;
  top: 16rpx;
  bottom: 16rpx;
  width: 2rpx;
  background: var(--color-outline-variant);
}

.timeline-item {
  position: relative;
  padding-bottom: 32rpx;
}

.timeline-item:last-child {
  padding-bottom: 0;
}

.timeline-dot {
  position: absolute;
  left: -28rpx;
  top: 16rpx;
  width: 40rpx;
  height: 40rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20rpx;
  font-weight: 700;
  color: #fff;
}

.phase-card {
  padding: 28rpx;
  border: 1rpx solid var(--color-outline-variant);
  border-radius: 16rpx;
  background: var(--color-surface);
}

.phase-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16rpx;
}

.phase-name {
  font-size: 24rpx;
  font-weight: 600;
  color: var(--color-on-surface);
}

.phase-duration {
  padding: 4rpx 16rpx;
  border-radius: 999rpx;
  font-size: 20rpx;
  font-weight: 500;
}

.skill-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-bottom: 16rpx;
}

.skill-chip {
  padding: 6rpx 16rpx;
  border-radius: 8rpx;
  font-size: 18rpx;
  font-weight: 500;
}

.goals-list {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.goal-item {
  display: flex;
  align-items: flex-start;
  gap: 10rpx;
}

.goal-icon {
  flex: none;
  width: 24rpx;
  height: 24rpx;
  margin-top: 2rpx;
}

.goal-text {
  font-size: 18rpx;
  line-height: 1.5;
  color: var(--color-on-surface-variant);
}

.rec-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.rec-item {
  display: flex;
  align-items: flex-start;
  gap: 14rpx;
}

.rec-badge {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 32rpx;
  height: 32rpx;
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

.list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16rpx;
}

.page-title {
  font-size: 34rpx;
  font-weight: 700;
  color: var(--color-on-surface);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 20rpx;
}

.clear-btn {
  display: flex;
  align-items: center;
  gap: 6rpx;
}

.clear-icon {
  width: 26rpx;
  height: 26rpx;
  color: var(--accent-red);
}

.clear-text {
  font-size: 22rpx;
  font-weight: 500;
  color: var(--accent-red);
}

.back-btn {
  padding: 10rpx 24rpx;
  border-radius: 14rpx;
  border: 1rpx solid var(--color-outline-variant);
}

.back-btn-text {
  font-size: 22rpx;
  font-weight: 500;
  color: var(--color-on-surface-variant);
}

.empty-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 64rpx 40rpx;
  border: 1rpx solid var(--color-outline-variant);
  border-radius: 24rpx;
  background: var(--color-surface-container-lowest);
}

.empty-icon {
  width: 96rpx;
  height: 96rpx;
  color: var(--color-outline);
  margin-bottom: 24rpx;
}

.empty-title {
  font-size: 32rpx;
  font-weight: 700;
  color: var(--color-on-surface);
  margin-bottom: 12rpx;
}

.empty-desc {
  font-size: 24rpx;
  color: var(--color-on-surface-variant);
  margin-bottom: 32rpx;
}

.go-btn {
  padding: 16rpx 32rpx;
  border-radius: 14rpx;
  background: var(--color-primary);
}

.go-btn-text {
  font-size: 24rpx;
  font-weight: 600;
  color: #fff;
}

.record-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.record-item {
  display: flex;
  align-items: center;
  gap: 24rpx;
  padding: 28rpx;
  border: 1rpx solid var(--color-outline-variant);
  border-radius: 20rpx;
  background: var(--color-surface-container-lowest);
}

.record-item:active {
  opacity: 0.9;
}

.record-icon-wrap {
  flex: none;
  width: 84rpx;
  height: 84rpx;
  border-radius: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-primary-fixed);
}

.record-icon {
  width: 40rpx;
  height: 40rpx;
  color: var(--color-primary);
}

.record-info {
  flex: 1;
  min-width: 0;
}

.record-title {
  display: block;
  font-size: 24rpx;
  font-weight: 700;
  color: var(--color-on-surface);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.record-meta {
  display: block;
  font-size: 20rpx;
  margin-top: 6rpx;
  color: var(--color-on-surface-variant);
}

.record-stats {
  display: flex;
  gap: 16rpx;
  margin-top: 10rpx;
  font-size: 20rpx;
}

.stat-green { color: var(--accent-green); }
.stat-red { color: var(--accent-red); }
.stat-date { color: var(--color-on-surface-variant); }

.record-score-area {
  flex: none;
  text-align: right;
}

.record-score {
  display: block;
  font-size: 36rpx;
  font-weight: 800;
}

.record-score-label {
  display: block;
  font-size: 16rpx;
  color: var(--color-on-surface-variant);
}

.record-delete {
  padding: 12rpx;
}

.delete-icon {
  width: 28rpx;
  height: 28rpx;
  color: var(--accent-red);
  opacity: 0.5;
}

.record-arrow {
  flex: none;
  width: 28rpx;
  height: 28rpx;
  color: var(--color-outline);
}
</style>
