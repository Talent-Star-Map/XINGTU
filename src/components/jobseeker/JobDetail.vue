<template>
  <view class="job-detail">
    <!-- 无数据状态 -->
    <view v-if="!job" class="empty-state">
      <view class="empty-card">
        <AppIcon name="alert-circle" class="empty-icon" />
        <text class="empty-text">未选择岗位</text>
        <view class="back-btn" @tap="goBack">
          <text class="back-btn-text">返回匹配</text>
        </view>
      </view>
    </view>

    <!-- 错误状态 -->
    <view v-else-if="error" class="empty-state">
      <view class="empty-card error-card">
        <AppIcon name="alert-circle" class="error-icon" />
        <text class="error-title">加载失败</text>
        <text class="error-msg">{{ error }}</text>
        <view class="back-btn" @tap="goBack">
          <text class="back-btn-text">返回</text>
        </view>
      </view>
    </view>

    <!-- 正常内容 -->
    <view v-else class="detail-content">
      <!-- 返回按钮 -->
      <view class="go-back" @tap="goBack">
        <AppIcon name="arrow-left" class="back-icon" />
        <text class="back-text">返回岗位列表</text>
      </view>

      <view class="detail-grid">
        <!-- 主内容 -->
        <view class="main-col">
          <!-- 头部卡片 -->
          <view class="card">
            <text class="job-title">{{ job.title }}</text>
            <view class="meta-row">
              <view class="meta-item">
                <AppIcon name="building" class="meta-icon" />
                <text>{{ job.company }}</text>
              </view>
              <view class="meta-item">
                <AppIcon name="map-pin" class="meta-icon" />
                <text>{{ job.location }}</text>
              </view>
              <view class="meta-item">
                <AppIcon name="clock" class="meta-icon" />
                <text>{{ job.experience || '3-5年' }}</text>
              </view>
              <view class="meta-item">
                <AppIcon name="book" class="meta-icon" />
                <text>{{ job.education || '本科及以上' }}</text>
              </view>
            </view>
            <text class="salary">{{ job.salary }}</text>
          </view>

          <!-- 技能要求 -->
          <view v-if="job.skills && job.skills.length" class="card">
            <text class="section-title">技能要求</text>
            <view class="skill-list">
              <text v-for="s in job.skills" :key="s" class="skill-tag">{{ s }}</text>
            </view>
          </view>

          <!-- 职位描述 -->
          <view v-if="job.description" class="card">
            <text class="section-title">职位描述</text>
            <text class="desc-text">{{ job.description }}</text>
          </view>

          <!-- 岗位要求 -->
          <view v-if="job.requirements && job.requirements.length" class="card">
            <text class="section-title">岗位要求</text>
            <view class="req-list">
              <view v-for="(r, i) in job.requirements" :key="i" class="req-item">
                <view class="req-dot"></view>
                <text class="req-text">{{ r }}</text>
              </view>
            </view>
          </view>
        </view>

        <!-- 侧边栏 -->
        <view class="side-col">
          <!-- 诊断卡片 -->
          <view class="diagnosis-card">
            <view class="diag-header">
              <AppIcon name="target" class="diag-icon" />
              <text class="diag-title">岗位诊断</text>
            </view>
            <text class="diag-desc">基于你的技能画像，分析你与这个岗位的能力差距，生成个性化学习路径。</text>
            <view class="diag-btn" @tap="handleDiagnose">
              <AppIcon name="target" class="diag-btn-icon" />
              <text class="diag-btn-text">开始诊断</text>
            </view>
          </view>

          <!-- 岗位概要 -->
          <view class="summary-card">
            <text class="summary-title">岗位概要</text>
            <view class="summary-list">
              <view class="summary-item">
                <AppIcon name="banknote" class="summary-icon" />
                <text>{{ job.salary }}</text>
              </view>
              <view class="summary-item">
                <AppIcon name="map-pin" class="summary-icon" />
                <text>{{ job.location }}</text>
              </view>
              <view class="summary-item">
                <AppIcon name="clock" class="summary-icon" />
                <text>{{ job.experience || '3-5年' }}</text>
              </view>
              <view class="summary-item">
                <AppIcon name="book" class="summary-icon" />
                <text>{{ job.education || '本科及以上' }}</text>
              </view>
              <view class="summary-item">
                <AppIcon name="users" class="summary-icon" />
                <text>{{ job.company }}</text>
              </view>
            </view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, inject, onMounted } from 'vue'
import AppIcon from '../common/AppIcon.vue'

const nav = inject('jobseekerNav')

const job = ref(null)
const error = ref('')

function goBack() {
  nav.setPage('match')
}

function handleDiagnose() {
  if (!job.value) return
  uni.setStorageSync('jt_diagnosis_job', JSON.stringify(job.value))
  const existing = uni.getStorageSync('jt_diagnosis_skills')
  if (!existing) {
    uni.setStorageSync('jt_diagnosis_skills', JSON.stringify([]))
  }
  nav.setPage('diagnosis')
}

onMounted(() => {
  try {
    const raw = uni.getStorageSync('jt_job_detail')
    if (raw) {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
      job.value = parsed
    }
  } catch (e) {
    error.value = '岗位数据解析失败'
  }
})
</script>

<style>
.job-detail {
  width: 100%;
  box-sizing: border-box;
  padding: 28rpx 24rpx 48rpx;
}

.empty-state {
  display: flex;
  justify-content: center;
  padding: 80rpx 0;
}

.empty-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 56rpx;
  border: 1rpx solid var(--color-outline-variant);
  border-radius: 24rpx;
  background: var(--color-surface-container-lowest);
  width: 100%;
  max-width: 560rpx;
}

.empty-icon {
  width: 80rpx;
  height: 80rpx;
  color: var(--color-outline);
  margin-bottom: 20rpx;
}

.empty-text {
  font-size: 26rpx;
  font-weight: 500;
  color: var(--color-on-surface-variant);
  margin-bottom: 28rpx;
}

.error-card {
  border-color: rgba(220, 38, 38, 0.2);
  background: rgba(220, 38, 38, 0.04);
}

.error-icon {
  width: 80rpx;
  height: 80rpx;
  color: var(--accent-red);
  margin-bottom: 20rpx;
}

.error-title {
  font-size: 26rpx;
  font-weight: 500;
  color: var(--accent-red);
  margin-bottom: 8rpx;
}

.error-msg {
  font-size: 22rpx;
  color: var(--color-on-surface-variant);
  margin-bottom: 28rpx;
}

.back-btn {
  padding: 16rpx 32rpx;
  border-radius: 14rpx;
  background: var(--color-primary);
}

.back-btn-text {
  font-size: 24rpx;
  font-weight: 600;
  color: #fff;
}


.go-back {
  display: flex;
  align-items: center;
  gap: 8rpx;
  margin-bottom: 36rpx;
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

.detail-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 24rpx;
}

@media (min-width: 700px) {
  .detail-grid {
    grid-template-columns: 1fr 320rpx;
  }
}

.main-col {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.side-col {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.card {
  padding: 40rpx;
  border: 1rpx solid var(--color-outline-variant);
  border-radius: 24rpx;
  background: var(--color-surface-container-lowest);
}

.job-title {
  font-size: 34rpx;
  font-weight: 700;
  color: var(--color-on-surface);
  display: block;
}

.meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 24rpx;
  margin-top: 20rpx;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 8rpx;
  font-size: 24rpx;
  color: var(--color-on-surface-variant);
}

.meta-icon {
  width: 26rpx;
  height: 26rpx;
}

.salary {
  display: block;
  margin-top: 20rpx;
  font-size: 32rpx;
  font-weight: 700;
  color: var(--color-primary);
}

.section-title {
  display: block;
  font-size: 26rpx;
  font-weight: 700;
  color: var(--color-on-surface);
  margin-bottom: 20rpx;
}

.skill-list {
  display: flex;
  flex-wrap: wrap;
  gap: 14rpx;
}

.skill-tag {
  padding: 10rpx 22rpx;
  border-radius: 999rpx;
  background: var(--color-surface-container);
  color: var(--color-on-surface-variant);
  font-size: 22rpx;
  font-weight: 500;
}

.desc-text {
  font-size: 24rpx;
  line-height: 1.7;
  color: var(--color-on-surface);
  white-space: pre-wrap;
}

.req-list {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}

.req-item {
  display: flex;
  align-items: flex-start;
  gap: 14rpx;
}

.req-dot {
  flex: none;
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  background: var(--color-primary);
  margin-top: 12rpx;
}

.req-text {
  font-size: 24rpx;
  line-height: 1.6;
  color: var(--color-on-surface);
}

.diagnosis-card {
  padding: 36rpx;
  border: 1rpx solid var(--color-primary-fixed);
  border-radius: 24rpx;
  background: var(--color-primary-fixed);
}

.diag-header {
  display: flex;
  align-items: center;
  gap: 14rpx;
  margin-bottom: 16rpx;
}

.diag-icon {
  width: 36rpx;
  height: 36rpx;
  color: var(--color-primary);
}

.diag-title {
  font-size: 26rpx;
  font-weight: 700;
  color: var(--color-primary);
}

.diag-desc {
  display: block;
  font-size: 22rpx;
  line-height: 1.6;
  color: var(--color-on-surface-variant);
  margin-bottom: 28rpx;
}

.diag-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  height: 76rpx;
  border-radius: 16rpx;
  background: var(--color-primary);
}

.diag-btn:active {
  opacity: 0.85;
}

.diag-btn-icon {
  width: 28rpx;
  height: 28rpx;
  color: #fff;
}

.diag-btn-text {
  font-size: 26rpx;
  font-weight: 600;
  color: #fff;
}

.summary-card {
  padding: 36rpx;
  border: 1rpx solid var(--color-outline-variant);
  border-radius: 24rpx;
  background: var(--color-surface-container-lowest);
}

.summary-title {
  display: block;
  font-size: 26rpx;
  font-weight: 700;
  color: var(--color-on-surface);
  margin-bottom: 20rpx;
}

.summary-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.summary-item {
  display: flex;
  align-items: center;
  gap: 14rpx;
  font-size: 22rpx;
  color: var(--color-on-surface-variant);
}

.summary-icon {
  width: 26rpx;
  height: 26rpx;
}
</style>
