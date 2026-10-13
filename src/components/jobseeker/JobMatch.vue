<template>
  <view class="job-match">
    <!-- 错误状态 -->
    <view v-if="error" class="error-state">
      <view class="error-card">
        <AppIcon name="alert-circle" class="error-icon" />
        <text class="error-title">匹配失败</text>
        <text class="error-msg">{{ error }}</text>
        <view class="error-btn" @tap="error = ''">
          <text class="error-btn-text">返回</text>
        </view>
      </view>
    </view>

    <!-- 正常内容 -->
    <view v-else class="match-content">
      <!-- 标题 -->
      <view class="page-header">
        <text class="page-title">岗位</text>
        <text class="page-sub">基于技能画像推荐最适合的岗位</text>
      </view>

      <!-- 简历/技能上传区 -->
      <ResumeUploader
        :has-profile="hasProfile"
        :show-skill-input="showSkillInput"
        :sel-skills="selSkills"
        @tags-change="selSkills = $event"
        @confirm="onConfirmSkills"
        @auto-match="onAutoMatch"
        @show-skill-input="showSkillInput = true"
        @skip="showSkillInput = false"
        @go-to-resume="nav.setPage('resume')"
      />

      <!-- 加载骨架屏 -->
      <view v-if="analyzing" class="skeleton-list">
        <SkeletonCard v-for="i in 3" :key="i" />
      </view>

      <!-- 岗位列表 -->
      <JobSelector
        v-else
        :jobs="allJobs"
        :display-jobs="currentJobs"
        :recommendations="recommendations"
        mode="recommend"
        :selected-job-id="null"
        @select-job="handleSelectJob"
        @diagnose="handleDiagnose"
        @filter-change="handleFilterChange"
      />

      <!-- 分页 - 有推荐结果时不显示 -->
      <view v-if="recommendations.length === 0 && totalPages > 1" class="pagination">
        <view class="page-btn" :class="{ disabled: page === 1 }" @tap="jumpToPage(1)">
          <AppIcon name="chevrons-left" class="page-icon" />
        </view>
        <view class="page-btn" :class="{ disabled: page === 1 }" @tap="jumpToPage(page - 1)">
          <AppIcon name="chevron-left" class="page-icon" />
        </view>
        <template v-for="(n, i) in getPageNumbers()" :key="i">
          <text v-if="n === '...'" class="page-ellipsis">...</text>
          <view
            v-else
            class="page-num"
            :class="{ active: n === page }"
            @tap="jumpToPage(n)"
          >
            <text class="page-num-text">{{ n }}</text>
          </view>
        </template>
        <view class="page-btn" :class="{ disabled: page === totalPages }" @tap="jumpToPage(page + 1)">
          <AppIcon name="chevron-right" class="page-icon" />
        </view>
        <view class="page-btn" :class="{ disabled: page === totalPages }" @tap="jumpToPage(totalPages)">
          <AppIcon name="chevrons-right" class="page-icon" />
        </view>
        <text class="page-info">共 {{ total }} 条</text>
        <text class="page-divider">|</text>
        <text class="page-info">第</text>
        <input
          v-model="inputPage"
          type="number"
          :min="1"
          :max="totalPages"
          class="page-input"
          @confirm="jumpToPage(parseInt(inputPage))"
        />
        <text class="page-info">/ {{ totalPages }} 页</text>
        <view class="jump-btn" @tap="inputPage && jumpToPage(parseInt(inputPage))">
          <text class="jump-btn-text">跳转</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, inject, onMounted, watch } from 'vue'
import AppIcon from '../common/AppIcon.vue'
import ResumeUploader from './match/ResumeUploader.vue'
import JobSelector from './match/JobSelector.vue'
import SkeletonCard from './match/Skeleton.vue'
import { request } from '../../utils/request.js'

const nav = inject('jobseekerNav')

const PAGE_SIZE = 20

const allJobs = ref([])
const filtered = ref([])
const analyzing = ref(false)
const showSkillInput = ref(false)
const recommendations = ref([])
const selSkills = ref([])
const page = ref(1)
const error = ref('')
const inputPage = ref('')

const hasProfile = computed(() => selSkills.value.length > 0)
const total = computed(() => filtered.value.length)
const totalPages = computed(() => Math.ceil(total.value / PAGE_SIZE))

const currentJobs = computed(() => {
  if (recommendations.value.length > 0) {
    return recommendations.value
      .map(r => filtered.value.find(j => j.id === r.job_id))
      .filter(Boolean)
  }
  return filtered.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE)
})

// 恢复用户技能
function restoreSkills() {
  try {
    const raw = uni.getStorageSync('jt_selected_skills')
    if (raw) {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
      if (Array.isArray(parsed) && parsed.length > 0) {
        selSkills.value = parsed
      }
    }
  } catch {}
}

// 持久化技能到 localStorage
watch(selSkills, (val) => {
  uni.setStorageSync('jt_selected_skills', JSON.stringify(val))
}, { deep: true })

// 加载全部岗位数据
function loadJobs() {
  request({ url: '/api/jobs?size=500', auth: false })
    .then(d => {
      if (d.success && d.data?.length) {
        const mapped = d.data.map(j => ({
          id: j.id, title: j.title, company: j.company,
          salary: j.salary, location: j.location, skills: j.skills || []
        }))
        allJobs.value = mapped
        filtered.value = mapped
      }
    })
    .catch(() => {})
}

// 从 profile 恢复技能
function restoreProfileSkills() {
  request({ url: '/api/auth/profile' })
    .then(d => {
      if (d.success && d.data?.skills && selSkills.value.length === 0) {
        selSkills.value = d.data.skills.split(',').map(s => s.trim()).filter(Boolean)
      }
    })
    .catch(() => {})
}

// 搜索/筛选变化回调
function handleFilterChange(list) {
  filtered.value = list
  page.value = 1
}

// 确认技能（手动输入完成）
function onConfirmSkills(skills) {
  selSkills.value = skills
  showSkillInput.value = false
  onAutoMatch(skills)
}

// 智能匹配
async function onAutoMatch(skills) {
  const token = uni.getStorageSync('xingtu_token')
  if (!token) return
  selSkills.value = skills
  analyzing.value = true
  try {
    const d = await request({
      url: '/api/match/recommend?n=10',
      method: 'POST',
      data: { skills, resume_text: `熟练掌握 ${skills.join('、')}，有相关开发经验` },
    })
    if (d.success && d.data) {
      recommendations.value = d.data
    }
  } catch {
    error.value = '网络错误'
  } finally {
    analyzing.value = false
  }
}

// 选择岗位 → 进入岗位详情
function handleSelectJob(job) {
  uni.setStorageSync('jt_job_detail', JSON.stringify(job))
  uni.setStorageSync('jt_diagnosis_skills', JSON.stringify(selSkills.value))
  nav.setPage('job-detail')
}

// 诊断岗位
function handleDiagnose(job) {
  uni.setStorageSync('jt_diagnosis_job', JSON.stringify(job))
  uni.setStorageSync('jt_diagnosis_skills', JSON.stringify(selSkills.value))
  nav.setPage('diagnosis')
}

// 分页
function jumpToPage(p) {
  page.value = Math.max(1, Math.min(p, totalPages.value))
  inputPage.value = ''
}

function getPageNumbers() {
  if (totalPages.value <= 7) {
    return Array.from({ length: totalPages.value }, (_, i) => i + 1)
  }
  const pages = [1]
  if (page.value > 3) pages.push('...')
  for (let i = Math.max(2, page.value - 1); i <= Math.min(totalPages.value - 1, page.value + 1); i++) {
    pages.push(i)
  }
  if (page.value < totalPages.value - 2) pages.push('...')
  pages.push(totalPages.value)
  return pages
}

onMounted(() => {
  restoreSkills()
  loadJobs()
  restoreProfileSkills()
})
</script>

<style>
.job-match {
  width: 100%;
  box-sizing: border-box;
  padding: 28rpx 24rpx 48rpx;
}

.error-state {
  display: flex;
  justify-content: center;
  padding: 80rpx 0;
}

.error-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 56rpx;
  border: 1rpx solid rgba(220, 38, 38, 0.2);
  border-radius: 24rpx;
  background: rgba(220, 38, 38, 0.04);
  width: 100%;
  max-width: 560rpx;
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

.error-btn {
  padding: 16rpx 32rpx;
  border-radius: 14rpx;
  background: var(--color-primary);
}

.error-btn-text {
  font-size: 24rpx;
  font-weight: 600;
  color: #fff;
}

.match-content {
  display: flex;
  flex-direction: column;
  gap: 32rpx;
}
.page-title {
  display: block;
  font-size: 34rpx;
  font-weight: 700;
  color: var(--color-on-surface);
}

.page-sub {
  display: block;
  font-size: 24rpx;
  margin-top: 8rpx;
  color: var(--color-on-surface-variant);
}

.skeleton-list {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

/* 分页 */
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  padding-top: 32rpx;
  flex-wrap: wrap;
}

.page-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64rpx;
  height: 64rpx;
  border-radius: 14rpx;
}

.page-btn:active {
  background: var(--color-surface-container);
}

.page-btn.disabled {
  opacity: 0.3;
}

.page-icon {
  width: 28rpx;
  height: 28rpx;
  color: var(--color-on-surface-variant);
}

.page-ellipsis {
  padding: 0 8rpx;
  font-size: 24rpx;
  color: var(--color-outline-variant);
}

.page-num {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64rpx;
  height: 64rpx;
  border-radius: 14rpx;
}

.page-num.active {
  background: var(--color-primary);
}

.page-num-text {
  font-size: 24rpx;
  font-weight: 500;
  color: var(--color-on-surface-variant);
}

.page-num.active .page-num-text {
  color: var(--color-on-primary);
}

.page-info {
  font-size: 22rpx;
  color: var(--color-outline-variant);
  margin-left: 12rpx;
}

.page-divider {
  font-size: 22rpx;
  color: var(--color-outline-variant);
  margin: 0 8rpx;
}

.page-input {
  width: 80rpx;
  height: 56rpx;
  border: 1rpx solid var(--color-outline-variant);
  border-radius: 10rpx;
  text-align: center;
  font-size: 24rpx;
  color: var(--color-on-surface);
  margin: 0 8rpx;
}

.jump-btn {
  height: 56rpx;
  padding: 0 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 14rpx;
  background: var(--color-primary);
  margin-left: 8rpx;
}

.jump-btn-text {
  font-size: 24rpx;
  font-weight: 500;
  color: #fff;
}
</style>
