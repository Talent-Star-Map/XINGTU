<template>
  <view class="learning-path">
    <!-- 无诊断结果 -->
    <view v-if="!targetJob || !diagnosis" class="no-diagnosis">
      <view class="hero-card">
        <view class="hero-characters">
          <view class="star-avatar">
            <view class="avatar-icon gold">
              <AppIcon name="star" class="avatar-ic" />
            </view>
            <text class="char-name orange">星星</text>
          </view>
          <view class="hero-title-area">
            <text class="hero-title">星星 ✦ 图图</text>
            <text class="hero-sub">请先完成岗位诊断，再进入学习</text>
          </view>
          <view class="tutu-avatar">
            <view class="avatar-icon purple">
              <AppIcon name="chat" class="avatar-ic" />
            </view>
            <text class="char-name primary">图图</text>
          </view>
        </view>
      </view>
      <view class="empty-card">
        <AppIcon name="target" class="empty-icon" />
        <text class="empty-title">还没有诊断结果</text>
        <text class="empty-desc">请先在岗位页面选择岗位进行诊断，然后进入学习</text>
        <view class="go-btn" @tap="goToMatch">
          <text class="go-btn-text">去选择岗位</text>
        </view>
      </view>
    </view>

    <!-- 有诊断结果 -->
    <view v-else class="path-content">
      <!-- 头部 -->
      <view class="hero-card">
        <view class="hero-main">
          <view class="hero-characters">
            <view class="star-avatar">
              <view class="avatar-icon gold">
                <AppIcon name="star" class="avatar-ic" />
              </view>
              <text class="char-name orange">星星</text>
              <text class="char-role">路径规划师</text>
            </view>
            <view class="hero-title-area">
              <text class="hero-title">星星 ✦ 图图</text>
              <text class="hero-sub">目标：{{ targetJob.title }} · {{ targetJob.company }}</text>
              <view class="hero-stats">
                <view class="hstat">
                  <AppIcon name="target" class="hstat-icon primary" />
                  <text class="hstat-text primary">匹配度 {{ diagnosis ? Math.round(diagnosis.overall) : '-' }}</text>
                </view>
                <view class="hstat">
                  <AppIcon name="check-circle" class="hstat-icon green" />
                  <text class="hstat-text green">已掌握 {{ masteredCount }}</text>
                </view>
                <view class="hstat">
                  <AppIcon name="zap" class="hstat-icon red" />
                  <text class="hstat-text red">待提升 {{ diagnosis?.skills?.miss?.length || 0 }}</text>
                </view>
              </view>
            </view>
          </view>
          <view class="hero-actions">
            <view class="action-btn outline primary" @tap="reDiagnose">
              <AppIcon name="refresh-cw" class="act-icon" />
              <text class="act-text">重新诊断</text>
            </view>
            <view class="action-btn outline muted" @tap="changeJob">
              <text class="act-text">换岗位</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 路径进度条 -->
      <view v-if="phases.length > 0" class="progress-bar-card">
        <view class="progress-header">
          <text class="progress-title">学习路径</text>
          <text class="progress-sub">预计 {{ totalWeeks }} 周</text>
        </view>
        <view class="progress-steps">
          <view class="progress-line">
            <view class="progress-fill" :style="{ width: ((step + 1) / phases.length * 100) + '%' }"></view>
          </view>
          <view class="steps-row">
            <view
              v-for="(p, i) in phases"
              :key="i"
              class="step-item"
              :class="{ active: i <= step, current: i === step }"
              @tap="changeStep(i)"
            >
              <view class="step-dot" :style="{ background: i <= step ? p.color : 'var(--color-surface)' }">
                <AppIcon :name="phaseIcons[i % phaseIcons.length]" class="step-icon" :style="{ color: i <= step ? '#fff' : 'var(--color-on-surface-variant)' }" />
              </view>
              <text class="step-label" :style="{ color: i <= step ? p.color : 'var(--color-on-surface-variant)' }">{{ p.title }}</text>
              <text class="step-sub">{{ getPhaseProgress(p.skills) }}% · {{ p.duration }}</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 当前阶段详情 -->
      <view class="phase-panel">
        <Transition name="phase-fade" mode="out-in">
          <view v-if="phases[step]" :key="step" class="phase-detail-card">
            <view class="phase-head">
              <view class="phase-icon-wrap" :style="{ background: phases[step].color + '15' }">
                <AppIcon :name="phaseIcons[step % phaseIcons.length]" class="phase-head-icon" :style="{ color: phases[step].color }" />
              </view>
              <view class="phase-head-info">
                <text class="phase-head-title">{{ phases[step].phase }}：{{ phases[step].title }}</text>
                <text class="phase-head-sub">{{ phases[step].duration }} · {{ phases[step].tip }}</text>
              </view>
            </view>

            <!-- 学习目标 -->
            <view class="goals-section">
              <view class="goals-header">
                <text class="goals-label">学习目标</text>
                <text class="goals-count">{{ phaseMasteredCount }}/{{ phases[step].skills.length }} 已掌握</text>
              </view>
              <view class="goals-bar">
                <view class="goals-bar-fill" :style="{ width: getPhaseProgress(phases[step].skills) + '%', background: `linear-gradient(90deg, ${phases[step].color}, ${phases[step].color}cc)` }"></view>
              </view>
              <view class="skill-chips">
                <view v-for="s in phases[step].skills" :key="s" class="skill-chip-row">
                  <view
                    class="skill-chip"
                    :class="{ mastered: isMastered(s) }"
                    :style="{ background: isMastered(s) ? phases[step].color + '25' : phases[step].color + '10', color: phases[step].color }"
                    @tap="loadResources([s])"
                  >
                    <AppIcon :name="isMastered(s) ? 'check-circle' : 'book'" class="chip-icon" />
                    <text class="chip-text" :style="{ textDecoration: isMastered(s) ? 'line-through' : 'none', opacity: isMastered(s) ? 0.7 : 1 }">{{ s }}</text>
                  </view>
                  <view
                    class="toggle-btn"
                    :class="{ mastered: isMastered(s) }"
                    @tap="toggleMastered(s)"
                  >
                    <text class="toggle-text">{{ isMastered(s) ? '✓' : '+' }}</text>
                  </view>
                </view>
              </view>
            </view>

            <!-- 学习资源 -->
            <view v-if="phases[step].skills.length > 0" class="resources-section">
              <view class="res-header">
                <text class="res-label">学习资源</text>
                <view v-if="resources.length === 0 && !loadingResources" class="res-load-btn" @tap="loadResources(phases[step].skills)">
                  <text class="res-load-text" :style="{ color: phases[step].color }">查看全部 →</text>
                </view>
              </view>
              <!-- 加载中 -->
              <view v-if="loadingResources" class="res-loading">
                <view v-for="i in 2" :key="i" class="res-skeleton"></view>
              </view>
              <!-- 有资源 -->
              <view v-else-if="resources.length > 0">
                <!-- 类型筛选 -->
                <view class="res-filters">
                  <view
                    v-for="f in resourceFilters"
                    :key="f.key"
                    class="res-filter"
                    :class="{ active: resourceFilter === f.key }"
                    :style="resourceFilter === f.key ? { background: phases[step].color + '20', color: phases[step].color, borderColor: phases[step].color } : {}"
                    @tap="resourceFilter = f.key"
                  >
                    <text class="filter-text">{{ f.label }} ({{ f.count }})</text>
                  </view>
                </view>
                <!-- 资源列表 -->
                <view class="res-list">
                  <view
                    v-for="(r, j) in filteredResources"
                    :key="j"
                    class="res-item"
                    @tap="openResource(r)"
                  >
                    <view class="res-icon-wrap" :style="{ background: getResourceColor(r) + '15' }">
                      <AppIcon :name="getResourceIcon(r)" class="res-icon" :style="{ color: getResourceColor(r) }" />
                      <view v-if="r.type === '视频'" class="video-badge">
                        <AppIcon name="play" class="video-icon" />
                      </view>
                    </view>
                    <view class="res-info">
                      <text class="res-name">{{ r.name }}</text>
                      <view class="res-meta">
                        <text class="res-type-tag" :style="{ background: getResourceColor(r) + '10', color: getResourceColor(r) }">{{ r.type }}</text>
                        <text v-if="r.type === '视频'" class="res-type-sub">视频教程</text>
                      </view>
                    </view>
                    <AppIcon name="external-link" class="res-link-icon" />
                  </view>
                </view>
              </view>
            </view>

            <!-- 底部提示 -->
            <view class="phase-tip">
              <AppIcon name="sparkles" class="tip-icon" />
              <text class="tip-text">星星建议：{{ phases[step].tip }}</text>
            </view>
            <text class="phase-hint">点击技能标签获取资源，点击 +/✓ 标记掌握状态</text>
          </view>
        </Transition>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, inject, onMounted } from 'vue'
import AppIcon from '../common/AppIcon.vue'
import { request } from '../../utils/request.js'

const nav = inject('jobseekerNav')
const learning = inject('learning')

const targetJob = ref(null)
const diagnosis = ref(null)
const step = ref(0)
const resources = ref([])
const loadingResources = ref(false)
const resourceFilter = ref('all')

const phaseIcons = ['rocket', 'zap', 'compass', 'brain']
const phaseColors = ['#00C8FF', '#7C3AED', '#00E599', '#FF8C42']

const masteredCount = computed(() => {
  if (!learning || !learning.masteredSkills) return 0
  return Array.isArray(learning.masteredSkills.value) ? learning.masteredSkills.value.length : 0
})

function isMastered(skill) {
  if (!learning || !learning.masteredSkills) return false
  const list = learning.masteredSkills.value
  return Array.isArray(list) ? list.includes(skill) : false
}

function toggleMastered(skill) {
  if (learning && learning.toggleMastered) {
    learning.toggleMastered(skill, targetJob.value?.id)
  }
}

function buildPhases(diag) {
  if (!diag) return []
  if (diag.phases && diag.phases.length) {
    const colorPool = ['#00C8FF', '#7C3AED', '#00E599', '#FF8C42']
    return diag.phases.map((p, i) => ({
      phase: `第${['一', '二', '三', '四'][i]}阶段`,
      title: p.title,
      duration: p.duration,
      skills: p.skills || [],
      resources: [],
      color: colorPool[i % colorPool.length],
      tip: p.goals?.[0] || `掌握 ${(p.skills || []).slice(0, 2).join('、')} 的核心用法`,
    }))
  }
  const miss = diag.skills?.miss || []
  if (!miss.length) return []
  const groups = { high: [], medium: [], low: [] }
  miss.forEach(s => {
    const name = typeof s === 'string' ? s : (s.skill || s.name || '')
    const priority = s.priority || 'low'
    const k = priority === 'high' ? 'high' : priority === 'medium' ? 'medium' : 'low'
    groups[k].push({ name, priority })
  })
  const colorPool = ['#00C8FF', '#7C3AED', '#00E599']
  const titles = ['核心技能补齐', '进阶能力提升', '拓宽技能栈']
  const baseWeeks = [2, 3, 2]
  const phases = []
  const priorities = ['high', 'medium', 'low']
  priorities.forEach((p, i) => {
    if (!groups[p].length) return
    const eta = p === 'high' ? 1 : p === 'medium' ? 0.5 : 0.3
    const weeks = Math.max(baseWeeks[i], Math.ceil(groups[p].length * eta))
    phases.push({
      phase: `第${['一', '二', '三'][phases.length]}阶段`,
      title: titles[i],
      duration: `${weeks} 周`,
      skills: groups[p].map(s => s.name),
      resources: [],
      color: colorPool[i % colorPool.length],
      tip: `掌握 ${groups[p].slice(0, 2).map(s => s.name).join('、')} 的核心用法`,
    })
  })
  return phases
}

const phases = computed(() => buildPhases(diagnosis.value))
const totalWeeks = computed(() => phases.value.reduce((s, p) => s + (parseInt(p.duration) || 0), 0))

const phaseMasteredCount = computed(() => {
  if (!phases.value[step.value]) return 0
  return phases.value[step.value].skills.filter(s => isMastered(s)).length
})

function getPhaseProgress(skills) {
  if (!skills || !skills.length) return 0
  const mastered = skills.filter(s => isMastered(s)).length
  return Math.round((mastered / skills.length) * 100)
}

function changeStep(i) {
  step.value = i
  resources.value = []
  resourceFilter.value = 'all'
}

function goToMatch() {
  nav.setPage('match')
}

function reDiagnose() {
  uni.removeStorageSync('jt_diagnosis_result')
  nav.setPage('match')
}

function changeJob() {
  uni.removeStorageSync('jt_diagnosis_result')
  uni.removeStorageSync('jt_diagnosis_job')
  uni.removeStorageSync('jt_diagnosis_skills')
  nav.setPage('match')
}

const resourceFilters = computed(() => {
  const types = ['all', '视频', '文档', '教程']
  return types.map(t => {
    const count = t === 'all' ? resources.value.length : resources.value.filter(r => r.type === t).length
    return { key: t, label: t === 'all' ? '全部' : t, count }
  }).filter(f => f.key === 'all' || f.count > 0)
})

const filteredResources = computed(() => {
  if (resourceFilter.value === 'all') return resources.value.slice(0, 6)
  return resources.value.filter(r => r.type === resourceFilter.value).slice(0, 6)
})

const typeIcons = { '文档': 'file-text', '视频': 'play', '教程': 'book', '课程': 'play', '文章': 'file-text' }
const typeColors = { '文档': 'var(--color-primary)', '视频': '#ef4444', '教程': 'var(--accent-green)', '课程': 'var(--accent-purple)' }

function getResourceIcon(r) {
  return typeIcons[r.type] || 'book'
}

function getResourceColor(r) {
  return typeColors[r.type] || 'var(--color-primary)'
}

function openResource(r) {
  if (r.url) {
    uni.navigateTo({ url: `/pages/webview/webview?url=${encodeURIComponent(r.url)}` })
  }
}

async function fetchResources(skills) {
  if (!skills.length) return []
  try {
    const d = await request({ url: '/api/chat/resources', method: 'POST', data: { skills } })
    return d.resources || []
  } catch {
    return []
  }
}

async function loadResources(skills) {
  loadingResources.value = true
  resources.value = await fetchResources(skills)
  loadingResources.value = false
}

onMounted(() => {
  try {
    const raw = uni.getStorageSync('jt_diagnosis_result')
    if (raw) {
      const data = typeof raw === 'string' ? JSON.parse(raw) : raw
      const age = Date.now() - (data.timestamp || 0)
      if (age < 24 * 60 * 60 * 1000) {
        targetJob.value = data.job
        diagnosis.value = data.result
      } else {
        uni.removeStorageSync('jt_diagnosis_result')
      }
    }
  } catch {}
})
</script>

<style>
.learning-path {
  width: 100%;
  box-sizing: border-box;
  padding: 28rpx 24rpx 48rpx;
}

.no-diagnosis,
.path-content {
  display: flex;
  flex-direction: column;
  gap: 32rpx;
}

.hero-card {
  padding: 40rpx;
  border: 1rpx solid var(--color-outline-variant);
  border-radius: 24rpx;
  background: linear-gradient(135deg, var(--color-primary-fixed) 0%, var(--color-surface-container-lowest) 100%);
  overflow: hidden;
}

.hero-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 24rpx;
}

.hero-characters {
  display: flex;
  align-items: center;
  gap: 40rpx;
}

.star-avatar,
.tutu-avatar {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
}

.avatar-icon {
  width: 120rpx;
  height: 120rpx;
  border-radius: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-icon.gold {
  background: linear-gradient(135deg, #FFD700, #FFA500);
}

.avatar-icon.purple {
  background: linear-gradient(135deg, #00C8FF, #7C3AED);
}

.avatar-ic {
  font-size: 68rpx;
  color: #fff;
}

.char-name {
  font-size: 20rpx;
  font-weight: 700;
}

.char-name.orange { color: var(--accent-orange); }
.char-name.primary { color: var(--color-primary); }

.char-role {
  font-size: 16rpx;
  color: var(--color-on-surface-variant);
}

.hero-title-area {
  flex: 1;
  min-width: 0;
}

.hero-title {
  display: block;
  font-size: 36rpx;
  font-weight: 800;
  background: linear-gradient(90deg, var(--color-primary), var(--accent-purple));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.hero-sub {
  display: block;
  font-size: 24rpx;
  margin-top: 8rpx;
  font-weight: 500;
  color: var(--color-on-surface);
}

.hero-stats {
  display: flex;
  gap: 28rpx;
  margin-top: 16rpx;
}

.hstat {
  display: flex;
  align-items: center;
  gap: 6rpx;
}

.hstat-icon {
  width: 24rpx;
  height: 24rpx;
}

.hstat-icon.primary { color: var(--color-primary); }
.hstat-icon.green { color: var(--accent-green); }
.hstat-icon.red { color: var(--accent-red); }

.hstat-text {
  font-size: 22rpx;
}

.hstat-text.primary { color: var(--color-primary); }
.hstat-text.green { color: var(--accent-green); }
.hstat-text.red { color: var(--accent-red); }

.hero-actions {
  display: flex;
  gap: 16rpx;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 14rpx 24rpx;
  border-radius: 14rpx;
}

.action-btn.outline {
  border: 1rpx solid var(--color-outline-variant);
}

.action-btn.primary {
  border-color: var(--color-primary);
}

.act-icon {
  width: 24rpx;
  height: 24rpx;
  color: var(--color-primary);
}

.act-text {
  font-size: 22rpx;
  font-weight: 500;
  color: var(--color-primary);
}

.action-btn.muted .act-text {
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
  font-size: 116rpx;
  color: var(--color-primary);
  margin-bottom: 24rpx;
}

.empty-title {
  font-size: 28rpx;
  font-weight: 700;
  color: var(--color-on-surface);
  margin-bottom: 12rpx;
}

.empty-desc {
  font-size: 22rpx;
  color: var(--color-on-surface-variant);
  margin-bottom: 32rpx;
  text-align: center;
}

.go-btn {
  padding: 18rpx 40rpx;
  border-radius: 16rpx;
  background: var(--color-primary);
}

.go-btn-text {
  font-size: 24rpx;
  font-weight: 600;
  color: #fff;
}

.progress-bar-card {
  padding: 36rpx;
  border: 1rpx solid var(--color-outline-variant);
  border-radius: 24rpx;
  background: var(--color-surface-container-lowest);
}

.progress-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 32rpx;
}

.progress-title {
  font-size: 26rpx;
  font-weight: 700;
  color: var(--color-on-surface);
}

.progress-sub {
  font-size: 22rpx;
  color: var(--color-on-surface-variant);
}

.progress-steps {
  position: relative;
}

.progress-line {
  position: absolute;
  top: 40rpx;
  left: 36rpx;
  right: 36rpx;
  height: 4rpx;
  background: var(--color-outline-variant);
  z-index: 0;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--color-primary), var(--accent-purple));
  border-radius: 4rpx;
  transition: width 0.5s ease;
}

.steps-row {
  display: flex;
  gap: 24rpx;
  overflow-x: auto;
  position: relative;
  z-index: 1;
}

.step-item {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  align-items: center;
  gap: 12rpx;
  min-width: 120rpx;
}

.step-dot {
  width: 80rpx;
  height: 80rpx;
  border-radius: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.step-dot:active {
  transform: scale(0.95);
}

.step-icon {
  width: 40rpx;
  height: 40rpx;
}

.step-label {
  font-size: 18rpx;
  font-weight: 600;
  text-align: center;
  max-width: 120rpx;
}

.step-sub {
  font-size: 16rpx;
  color: var(--color-on-surface-variant);
}

.phase-panel {
  display: flex;
  flex-direction: column;
}

.phase-fade-enter-active,
.phase-fade-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}

.phase-fade-enter-from {
  opacity: 0;
  transform: translateY(12rpx);
}

.phase-fade-leave-to {
  opacity: 0;
  transform: translateY(-12rpx);
}

.phase-detail-card {
  padding: 40rpx;
  border: 1rpx solid var(--color-outline-variant);
  border-radius: 24rpx;
  background: var(--color-surface-container-lowest);
}

.phase-head {
  display: flex;
  align-items: center;
  gap: 24rpx;
  margin-bottom: 32rpx;
}

.phase-icon-wrap {
  flex: none;
  width: 80rpx;
  height: 80rpx;
  border-radius: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.phase-head-icon {
  width: 40rpx;
  height: 40rpx;
}

.phase-head-info {
  flex: 1;
  min-width: 0;
}

.phase-head-title {
  display: block;
  font-size: 28rpx;
  font-weight: 700;
  color: var(--color-on-surface);
}

.phase-head-sub {
  display: block;
  font-size: 22rpx;
  margin-top: 6rpx;
  color: var(--color-on-surface-variant);
}

.goals-section {
  margin-bottom: 32rpx;
}

.goals-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12rpx;
}

.goals-label {
  font-size: 22rpx;
  font-weight: 600;
  color: var(--color-on-surface-variant);
}

.goals-count {
  font-size: 22rpx;
  color: var(--color-on-surface-variant);
}

.goals-bar {
  height: 12rpx;
  border-radius: 6rpx;
  margin-bottom: 20rpx;
  background: var(--color-surface);
}

.goals-bar-fill {
  height: 100%;
  border-radius: 6rpx;
}

.skill-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 14rpx;
}

.skill-chip-row {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.skill-chip {
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 12rpx 22rpx;
  border-radius: 14rpx;
}

.skill-chip:active {
  opacity: 0.85;
}

.chip-icon {
  width: 24rpx;
  height: 24rpx;
}

.chip-text {
  font-size: 22rpx;
  font-weight: 500;
}

.toggle-btn {
  width: 44rpx;
  height: 44rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1rpx solid var(--color-outline-variant);
  background: var(--color-surface);
}

.toggle-btn.mastered {
  background: var(--accent-green);
  border-color: var(--accent-green);
}

.toggle-text {
  font-size: 20rpx;
  font-weight: 600;
  color: var(--color-on-surface-variant);
}

.toggle-btn.mastered .toggle-text {
  color: #fff;
}

.res-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16rpx;
}

.res-label {
  font-size: 22rpx;
  font-weight: 600;
  color: var(--color-on-surface-variant);
}

.res-load-text {
  font-size: 18rpx;
  font-weight: 500;
}

.res-loading {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.res-skeleton {
  height: 80rpx;
  border-radius: 16rpx;
  background: var(--color-surface);
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.res-filters {
  display: flex;
  gap: 12rpx;
  margin-bottom: 16rpx;
}

.res-filter {
  padding: 8rpx 20rpx;
  border-radius: 10rpx;
  border: 1rpx solid var(--color-outline-variant);
}

.res-filter.active {
  border-color: var(--color-primary);
}

.filter-text {
  font-size: 18rpx;
  font-weight: 600;
}

.res-list {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.res-item {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 20rpx;
  border-radius: 16rpx;
  background: var(--color-surface);
}

.res-item:active {
  opacity: 0.9;
}

.res-icon-wrap {
  flex: none;
  width: 64rpx;
  height: 64rpx;
  border-radius: 14rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.res-icon {
  width: 32rpx;
  height: 32rpx;
}

.video-badge {
  position: absolute;
  bottom: -4rpx;
  right: -4rpx;
  width: 28rpx;
  height: 28rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #ef4444;
}

.video-icon {
  width: 16rpx;
  height: 16rpx;
  color: #fff;
}

.res-info {
  flex: 1;
  min-width: 0;
}

.res-name {
  display: block;
  font-size: 22rpx;
  font-weight: 500;
  color: var(--color-on-surface);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.res-meta {
  display: flex;
  align-items: center;
  gap: 10rpx;
  margin-top: 6rpx;
}

.res-type-tag {
  padding: 2rpx 12rpx;
  border-radius: 6rpx;
  font-size: 16rpx;
}

.res-type-sub {
  font-size: 16rpx;
  color: var(--color-on-surface-variant);
}

.res-link-icon {
  flex: none;
  width: 24rpx;
  height: 24rpx;
  color: var(--color-on-surface-variant);
  opacity: 0.5;
}

.phase-tip {
  display: flex;
  align-items: center;
  gap: 10rpx;
  padding-top: 28rpx;
  margin-top: 28rpx;
  border-top: 1rpx solid var(--color-outline-variant);
}

.tip-icon {
  width: 24rpx;
  height: 24rpx;
  color: #FFD700;
}

.tip-text {
  font-size: 22rpx;
  color: var(--color-on-surface-variant);
}

.phase-hint {
  display: block;
  margin-top: 16rpx;
  font-size: 18rpx;
  color: var(--color-on-surface-variant);
}
</style>
