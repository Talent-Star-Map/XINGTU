<template>
  <view class="diagnosis">
    <!-- 无岗位数据 -->
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
        <text class="error-title">分析失败</text>
        <text class="error-msg">{{ error }}</text>
        <view class="error-btns">
          <view class="back-btn" @tap="goBack">
            <text class="back-btn-text">返回</text>
          </view>
          <view v-if="isExpired" class="relogin-btn" @tap="handleRelogin">
            <AppIcon name="log-in" class="relogin-icon" />
            <text class="relogin-text">重新登录</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 正常内容 -->
    <view v-else class="diagnosis-content">
      <!-- 顶部导航 -->
      <view class="top-nav">
        <view class="go-back" @tap="goBack">
          <AppIcon name="arrow-left" class="back-icon" />
          <text class="back-text">返回匹配</text>
        </view>
        <view class="page-title">
          <AppIcon name="target" class="title-icon" />
          <text class="title-text">诊断结果：{{ job.title }}</text>
        </view>
      </view>

      <!-- 加载骨架屏 -->
      <view v-if="analyzing" class="skeleton-list">
        <Skeleton v-for="i in 3" :key="i" />
      </view>

      <!-- 诊断结果 -->
      <view v-if="!analyzing && result" class="result-section">
        <!-- 评分面板 -->
        <MatchScorePanel :result="result" />

        <!-- 差距分析 -->
        <GapAnalysisList
          :result="result"
          @go-to-learning="goToLearning"
        />

        <!-- 学习路径规划 -->
        <view v-if="phases.length > 0" class="card phases-card">
          <view class="phases-header">
            <view class="phases-info">
              <text class="phases-title">学习路径规划</text>
              <text class="phases-sub">预计 {{ totalWeeks }} 周完成，共 {{ phases.length }} 个阶段</text>
            </view>
            <view class="learn-btn" @tap="goToLearning">
              <AppIcon name="book" class="learn-btn-icon" />
              <text class="learn-btn-text">进入学习</text>
            </view>
          </view>
          <view class="phases-list">
            <view v-for="(p, i) in phases" :key="i" class="phase-item">
              <view class="phase-num">{{ i + 1 }}</view>
              <view class="phase-info">
                <text class="phase-title">{{ p.title }}</text>
                <text class="phase-desc">
                  {{ p.skills.slice(0, 3).join('、') }}{{ p.skills.length > 3 ? ` 等${p.skills.length}项` : '' }} · {{ p.duration }}
                </text>
              </view>
            </view>
          </view>
        </view>

        <!-- 底部操作 -->
        <view class="bottom-actions">
          <view class="action-btn secondary" @tap="goBack">
            <AppIcon name="sparkles" class="action-icon" />
            <text class="action-text">匹配其他岗位</text>
          </view>
          <view class="action-btn primary" @tap="goToLearning">
            <AppIcon name="book" class="action-icon white" />
            <text class="action-text white">开始学习</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, inject, onMounted } from 'vue'
import AppIcon from '../common/AppIcon.vue'
import Skeleton from './match/Skeleton.vue'
import MatchScorePanel from './match/MatchScorePanel.vue'
import GapAnalysisList from './match/GapAnalysisList.vue'
import { request } from '../../utils/request.js'

const nav = inject('jobseekerNav')

const job = ref(null)
const result = ref(null)
const analyzing = ref(false)
const error = ref('')
const isExpired = ref(false)

function goBack() {
  nav.setPage('match')
}

function goToLearning() {
  nav.setPage('learning')
}

function handleRelogin() {
  uni.removeStorageSync('xingtu_token')
  uni.removeStorageSync('xingtu_role')
  uni.removeStorageSync('xingtu_user')
  uni.reLaunch({ url: '/pages/role-select/role-select' })
}

function buildPhases(r) {
  const miss = r.skills.miss
  if (!miss || !miss.length) return []
  const groups = { high: [], medium: [], low: [] }
  miss.forEach(s => {
    const k = s.priority === 'high' ? 'high' : s.priority === 'medium' ? 'medium' : 'low'
    groups[k].push(s)
  })
  const phases = []
  const titles = ['核心技能补齐', '进阶能力提升', '拓宽技能栈']
  const baseWeeks = [2, 3, 2]
  const priorities = ['high', 'medium', 'low']
  priorities.forEach((p, i) => {
    const eta = p === 'high' ? 1 : p === 'medium' ? 0.5 : 0.3
    const weeks = Math.max(baseWeeks[i], Math.ceil(groups[p].length * eta))
    if (groups[p].length) {
      phases.push({
        phase: i + 1,
        title: titles[i],
        duration: `${weeks} 周`,
        skills: groups[p].map(s => s.skill),
        etaPerSkill: eta,
        goals: groups[p].map(s => `掌握 ${s.skill} 的基本使用`),
      })
    }
  })
  return phases
}

const phases = computed(() => result.value ? buildPhases(result.value) : [])
const totalWeeks = computed(() => phases.value.reduce((s, p) => s + (parseInt(p.duration) || 0), 0))

async function runAnalyze(j, skills) {
  const token = uni.getStorageSync('xingtu_token')
  if (!token) {
    error.value = '请先登录'
    analyzing.value = false
    return
  }
  analyzing.value = true
  error.value = ''
  isExpired.value = false

  try {
    const body = { job_id: j.id, use_profile_skills: true }
    if (skills.length) {
      body.resume_text = `熟练掌握 ${skills.join('、')}`
      body.use_profile_skills = false
    }

    const d = await request({
      url: '/api/match/analyze',
      method: 'POST',
      data: body,
    })

    if (!d.success) {
      const msg = d.message || '分析失败'
      if (d.code === 'NO_PROFILE') {
        error.value = '暂无技能数据。请先在个人主页填写技能，或上传简历后重试。'
      } else {
        error.value = msg
      }
      analyzing.value = false
      return
    }

    result.value = d.data

    const fullResult = {
      job: j,
      result: d.data,
      phases: buildPhases(d.data),
      timestamp: Date.now(),
    }
    uni.setStorageSync('jt_diagnosis_result', JSON.stringify(fullResult))

    const report = {
      id: Date.now(),
      jobId: j.id,
      jobTitle: j.title,
      jobCompany: j.company,
      jobLocation: j.location,
      jobSalary: j.salary,
      overall: Math.round(d.data.overall),
      grade: d.data.grade,
      haveCount: d.data.skills.have.length,
      missCount: d.data.skills.miss.length,
      phases: buildPhases(d.data),
      recommendations: d.data.recommendations,
      skills: d.data.skills,
    }
    let history = []
    try {
      const raw = uni.getStorageSync('jt_diagnosis_history')
      history = raw ? JSON.parse(raw) : []
    } catch {}
    history.unshift(report)
    uni.setStorageSync('jt_diagnosis_history', JSON.stringify(history))
  } catch (e) {
    error.value = e.message || '网络错误'
  } finally {
    analyzing.value = false
  }
}

onMounted(() => {
  try {
    const resultRaw = uni.getStorageSync('jt_diagnosis_result')
    if (resultRaw) {
      const data = typeof resultRaw === 'string' ? JSON.parse(resultRaw) : resultRaw
      if (data.job && data.result) {
        job.value = data.job
        result.value = data.result
        return
      }
    }

    const raw = uni.getStorageSync('jt_diagnosis_job')
    const skillsRaw = uni.getStorageSync('jt_diagnosis_skills')
    if (raw) {
      const j = typeof raw === 'string' ? JSON.parse(raw) : raw
      const skills = skillsRaw ? (typeof skillsRaw === 'string' ? JSON.parse(skillsRaw) : skillsRaw) : []
      job.value = j
      runAnalyze(j, skills)
    }
  } catch (e) {
    // ignore
  }
})
</script>

<style>
.diagnosis {
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

.error-btns {
  display: flex;
  gap: 16rpx;
}

.back-btn {
  padding: 16rpx 32rpx;
  border-radius: 14rpx;
  border: 1rpx solid var(--color-outline-variant);
}

.back-btn-text {
  font-size: 24rpx;
  font-weight: 600;
  color: var(--color-on-surface-variant);
}

.relogin-btn {
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 16rpx 32rpx;
  border-radius: 14rpx;
  background: var(--color-primary);
}

.relogin-icon {
  width: 24rpx;
  height: 24rpx;
  color: #fff;
}

.relogin-text {
  font-size: 24rpx;
  font-weight: 600;
  color: #fff;
}

.diagnosis-content {
  display: flex;
  flex-direction: column;
  gap: 32rpx;
}

.top-nav {
  display: flex;
  align-items: center;
  gap: 32rpx;
  flex-wrap: wrap;
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

.page-title {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.title-icon {
  width: 32rpx;
  height: 32rpx;
  color: var(--color-primary);
}

.title-text {
  font-size: 34rpx;
  font-weight: 700;
  color: var(--color-on-surface);
}

.skeleton-list {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.result-section {
  display: flex;
  flex-direction: column;
  gap: 32rpx;
}

.card {
  padding: 40rpx;
  border: 1rpx solid var(--color-outline-variant);
  border-radius: 24rpx;
  background: var(--color-surface-container-lowest);
}


.phases-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 32rpx;
}

.phases-title {
  display: block;
  font-size: 28rpx;
  font-weight: 700;
  color: var(--color-on-surface);
}

.phases-sub {
  display: block;
  font-size: 24rpx;
  margin-top: 8rpx;
  color: var(--color-on-surface-variant);
}

.learn-btn {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 18rpx 32rpx;
  border-radius: 20rpx;
  background: var(--color-primary);
}

.learn-btn:active {
  opacity: 0.85;
}

.learn-btn-icon {
  width: 28rpx;
  height: 28rpx;
  color: #fff;
}

.learn-btn-text {
  font-size: 24rpx;
  font-weight: 600;
  color: #fff;
}

.phases-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.phase-item {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 24rpx;
  border-radius: 16rpx;
  background: var(--color-surface);
}

.phase-num {
  flex: none;
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
  font-weight: 700;
  color: #fff;
  background: var(--color-primary);
}

.phase-info {
  flex: 1;
  min-width: 0;
}

.phase-title {
  display: block;
  font-size: 24rpx;
  font-weight: 600;
  color: var(--color-on-surface);
}

.phase-desc {
  display: block;
  font-size: 22rpx;
  margin-top: 6rpx;
  color: var(--color-on-surface-variant);
}

.bottom-actions {
  display: flex;
  gap: 24rpx;
}

.action-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  height: 84rpx;
  border-radius: 20rpx;
}

.action-btn:active {
  opacity: 0.85;
}

.action-btn.secondary {
  border: 1rpx solid var(--color-outline-variant);
}

.action-btn.primary {
  background: var(--color-primary);
}

.action-icon {
  width: 28rpx;
  height: 28rpx;
  color: var(--color-on-surface-variant);
}

.action-icon.white {
  color: #fff;
}

.action-text {
  font-size: 24rpx;
  font-weight: 600;
  color: var(--color-on-surface-variant);
}

.action-text.white {
  color: #fff;
}
</style>
