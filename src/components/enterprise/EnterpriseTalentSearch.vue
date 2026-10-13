<template>
  <view class="ets-page">
    <!-- 多选模式顶部操作栏 -->
    <view v-if="multiSelectMode" class="ets-multi-bar">
      <view class="ets-multi-bar-left">
        <text class="ets-multi-count">已选 <text class="ets-multi-num">{{ compareSelected.size }}</text> / {{ maxCompare }} 人</text>
        <picker :value="maxCompareIndex" :range="maxCompareOptions" @change="onMaxCompareChange">
          <view class="ets-max-picker">
            <text class="ets-max-label">上限</text>
            <text class="ets-max-value">{{ maxCompare }}人</text>
          </view>
        </picker>
      </view>
      <view class="ets-multi-exit" @tap="exitMultiSelect">
        <text class="ets-multi-exit-text">退出</text>
      </view>
    </view>

    <!-- 顶部工具栏 -->
    <view class="ets-toolbar">
      <view class="ets-toolbar-left">
        <text class="ets-page-title">人才星</text>
        <text class="ets-page-count">{{ candidates.length }} / {{ totalCount || '—' }}</text>
      </view>
      <view
        class="ets-match-btn"
        :class="{ 'ets-match-btn-disabled': matching }"
        @tap="runMatch"
      >
        <AppIcon :name="matching ? 'loader' : 'refresh-cw'" />
        <text class="ets-match-btn-text">{{ matching ? '五维度匹配中' : '重新匹配' }}</text>
      </view>
    </view>

    <!-- 搜索框 -->
    <view class="ets-search-row">
      <view class="ets-search-box">
        <AppIcon name="search" />
        <input
          class="ets-search-input"
          :value="search"
          @input="search = $event.detail.value"
          @confirm="applySearch"
          placeholder="搜索姓名/技能/岗位，按回车查询"
          confirm-type="search"
        />
        <view v-if="search" class="ets-search-clear" @tap="clearSearch">
          <AppIcon name="x" />
        </view>
      </view>
    </view>

    <!-- 岗位筛选 — 横向滚动标签 -->
    <view class="ets-job-row">
      <scroll-view class="ets-job-scroll" scroll-x :show-scrollbar="false">
        <view class="ets-job-tags">
          <view
            class="ets-job-tag"
            :class="{ 'ets-job-tag-active': selectedJob === null }"
            @tap="onJobTagClick(null)"
          >
            <text class="ets-job-tag-text">全部岗位 ({{ totalCount }})</text>
          </view>
          <view
            v-for="job in jobs"
            :key="job.id"
            class="ets-job-tag"
            :class="{ 'ets-job-tag-active': selectedJob === job.id }"
            @tap="onJobTagClick(job.id)"
          >
            <text class="ets-job-tag-text">{{ job.title }} ({{ job.count || 0 }})</text>
          </view>
        </view>
      </scroll-view>
    </view>

    <!-- 标签行 -->
    <view v-if="keyword || selectedJob || matchInfo" class="ets-tags-bar">
      <view v-if="keyword" class="ets-tag-item" @tap="clearSearch">
        <text class="ets-tag-text">关键词: {{ keyword }}</text>
        <AppIcon name="x" />
      </view>
      <view v-if="selectedJob" class="ets-tag-item" @tap="clearJob">
        <text class="ets-tag-text">岗位: {{ selectedJobTitle }}</text>
        <AppIcon name="x" />
      </view>
      <view v-if="matchInfo" class="ets-tag-item ets-tag-green">
        <AppIcon name="trend" />
        <text class="ets-tag-text">{{ matchInfo }}</text>
      </view>
    </view>

    <!-- 错误提示 -->
    <view v-if="error" class="ets-error">
      <text class="ets-error-text">{{ error }}</text>
    </view>

    <!-- 加载状态 -->
    <view v-if="loading" class="ets-state-box">
      <AppIcon name="loader" />
      <text class="ets-state-text">加载中</text>
    </view>

    <!-- 空数据 -->
    <view v-else-if="sorted.length === 0" class="ets-state-box">
      <text class="ets-state-text">暂无匹配人才</text>
      <text class="ets-state-sub">
        {{ keyword || selectedJob ? '调整筛选条件或换个关键词试试' : '点击"重新匹配"生成候选人列表' }}
      </text>
    </view>

    <!-- 候选人列表 -->
    <scroll-view
      v-else
      class="ets-list"
      scroll-y
      :show-scrollbar="false"
      refresher-enabled
      :refresher-triggered="refreshing"
      @refresherrefresh="onRefresh"
    >
      <EnterpriseCandidateCard
        v-for="c in sorted"
        :key="c.id"
        :candidate="c"
        :expanded="expandedId === c.id"
        :selected="compareSelected.has(c.id)"
        :multi-select-mode="multiSelectMode"
        @toggle-expand="toggleExpand(c.id)"
        @toggle-compare="toggleCompare(c.id)"
        @open-chat="openChat(c)"
        @longpress="enterMultiSelect(c.id)"
      />
    </scroll-view>

    <!-- 底部对比栏（仅多选模式且有选中时显示） -->
    <view v-if="multiSelectMode && compareSelected.size > 0" class="ets-compare-bar">
      <view class="ets-compare-bar-top">
        <view class="ets-selected-tags">
          <view v-for="(id, idx) in Array.from(compareSelected)" :key="id" class="ets-selected-tag">
            <view class="ets-selected-dot" :style="{ background: getColor(idx) }"></view>
            <text class="ets-selected-name">{{ getCandidateName(id) }}</text>
            <view class="ets-selected-remove" @tap="toggleCompare(id)">
              <AppIcon name="x" />
            </view>
          </view>
        </view>
      </view>
      <view class="ets-compare-bar-bottom">
        <view class="ets-clear-btn" @tap="clearCompare">
          <text class="ets-clear-text">清空</text>
        </view>
        <view
          class="ets-radar-btn"
          :class="{ 'ets-btn-disabled': compareSelected.size < 2 || compareLoading }"
          @tap="runCompare"
        >
          <AppIcon :name="compareLoading ? 'loader' : 'users'" />
          <text class="ets-radar-btn-text">雷达对比 ({{ compareSelected.size }})</text>
        </view>
        <view
          class="ets-ai-btn"
          :class="{ 'ets-btn-disabled': compareSelected.size < 2 || deepCompareLoading }"
          @tap="onDeepCompare"
        >
          <text class="ets-ai-btn-text">AI 深度对比 ({{ compareSelected.size }})</text>
        </view>
      </view>
    </view>

    <!-- 对比弹窗 -->
    <EnterpriseCompareModal
      :show="showCompare"
      :loading="compareLoading"
      :data="compareData"
      @close="closeCompare"
    />

    <!-- AI 深度对比弹窗 -->
    <EnterpriseDeepCompareModal
      :show="showDeepPanel"
      :loading="deepCompareLoading"
      :error="deepCompareError"
      :data="deepCompareData"
      @close="closeDeepPanel"
      @start-analyze="runDeepCompare"
    />

  </view>
</template>

<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { request } from '../../utils/request'
import AppIcon from '../common/AppIcon.vue'
import EnterpriseCandidateCard from './EnterpriseCandidateCard.vue'
import EnterpriseCompareModal from './EnterpriseCompareModal.vue'
import EnterpriseDeepCompareModal from './EnterpriseDeepCompareModal.vue'

const COMPARE_COLOR_POOL = [
  'var(--color-primary)', 'var(--accent-green)', 'var(--accent-purple)',
  'var(--accent-orange)', '#E91E63', '#00BCD4', '#795548', '#607D8B',
  '#FF5722', '#3F51B5',
]

const props = defineProps({
  filterJobId: { type: Number, default: null },
  autoCompare: { type: Boolean, default: false },
})

const emit = defineEmits(['navigate'])

// ── 状态 ──
const jobs = ref([])
const candidates = ref([])
const selectedJob = ref(null)
const search = ref('')
const keyword = ref('')
const loading = ref(true)
const error = ref('')
const matching = ref(false)
const matchInfo = ref('')
const expandedId = ref(null)

// ── 多选模式 ──
const multiSelectMode = ref(false)
const refreshing = ref(false)

// ── 对比功能 ──
const compareSelected = ref(new Set())
const showCompare = ref(false)
const compareData = ref(null)
const compareLoading = ref(false)
const maxCompare = ref(4)

// ── AI 深度对比 ──
const deepCompareData = ref(null)
const deepCompareLoading = ref(false)
const deepCompareError = ref('')
const showDeepPanel = ref(false)

let autoCompareTriggered = false

// ── 计算属性 ──
const totalCount = computed(() => {
  return jobs.value.reduce((s, j) => s + (j.count || 0), 0)
})

const selectedJobTitle = computed(() => {
  if (!selectedJob.value) return '全部岗位'
  const j = jobs.value.find(j => j.id === selectedJob.value)
  return j ? j.title : '全部岗位'
})

const sorted = computed(() => {
  return [...candidates.value].sort((a, b) => {
    const av = a.match ?? -1
    const bv = b.match ?? -1
    return bv - av
  })
})

const maxCompareOptions = ['2人', '3人', '4人', '5人', '6人', '7人', '8人', '9人', '10人']
const maxCompareValues = [2, 3, 4, 5, 6, 7, 8, 9, 10]

const maxCompareIndex = computed(() => {
  return maxCompareValues.indexOf(maxCompare.value)
})

// ── API ──
async function loadCandidates() {
  loading.value = true
  error.value = ''
  try {
    const params = { page: '1', size: '20' }
    if (selectedJob.value) params.job_id = String(selectedJob.value)
    if (keyword.value) params.keyword = keyword.value
    const d = await request({ url: '/api/enterprise/candidates', data: params })
    if (d.success && d.data) {
      jobs.value = d.data.jobs || []
      candidates.value = d.data.candidates || []
    } else {
      error.value = d.error?.message || d.message || '查询失败'
    }
  } catch {
    error.value = '网络错误，请稍后重试'
  } finally {
    loading.value = false
  }
}

async function runMatch() {
  matching.value = true
  matchInfo.value = ''
  error.value = ''
  try {
    const d = await request({ url: '/api/enterprise/run-match', method: 'POST' })
    if (d.success) {
      const info = d.data || {}
      matchInfo.value = '五维度匹配完成：' + (info.total_jobs || 0) + ' 岗位 × ' + (info.total_seekers || 0) + ' 候选人 → 更新 ' + (info.updated || 0) + ' 条，过滤 ' + (info.skipped || 0) + ' 对'
      await loadCandidates()
    } else {
      error.value = d.error?.message || d.message || '匹配失败'
    }
  } catch {
    error.value = '匹配请求失败'
  } finally {
    matching.value = false
  }
}

async function runCompare() {
  if (compareSelected.value.size < 2) return
  compareLoading.value = true
  showCompare.value = true
  try {
    const d = await request({
      url: '/api/enterprise/candidates/compare',
      method: 'POST',
      data: { ids: Array.from(compareSelected.value) },
    })
    if (d.success) {
      compareData.value = d.data
    } else {
      error.value = d.error?.message || d.message || '对比失败'
      showCompare.value = false
    }
  } catch {
    error.value = '对比请求失败'
    showCompare.value = false
  } finally {
    compareLoading.value = false
  }
}

function onDeepCompare() {
  if (compareSelected.value.size < 2) return
  showDeepPanel.value = true
  runDeepCompare()
}

async function runDeepCompare() {
  if (compareSelected.value.size < 2) return
  deepCompareLoading.value = true
  deepCompareError.value = ''
  deepCompareData.value = null
  try {
    const d = await request({
      url: '/api/enterprise/candidates/deep-compare',
      method: 'POST',
      data: { ids: Array.from(compareSelected.value) },
    })
    if (d.success) {
      deepCompareData.value = d.data
    } else {
      deepCompareError.value = d.error?.message || d.message || 'AI 分析失败'
    }
  } catch {
    deepCompareError.value = 'AI 分析请求失败，请检查网络'
  } finally {
    deepCompareLoading.value = false
  }
}

// ── 操作函数 ──
function toggleExpand(id) {
  expandedId.value = expandedId.value === id ? null : id
}

function toggleCompare(id) {
  const next = new Set(compareSelected.value)
  if (next.has(id)) {
    next.delete(id)
  } else {
    if (next.size >= maxCompare.value) return
    next.add(id)
  }
  compareSelected.value = next
}

function clearCompare() {
  compareSelected.value = new Set()
}

function applySearch() {
  keyword.value = search.value.trim()
}

function clearSearch() {
  search.value = ''
  keyword.value = ''
}

function clearJob() {
  selectedJob.value = null
}

function onMaxCompareChange(e) {
  const v = maxCompareValues[e.detail.value] || 4
  maxCompare.value = v
  if (compareSelected.value.size > v) {
    const trimmed = new Set(Array.from(compareSelected.value).slice(0, v))
    compareSelected.value = trimmed
  }
}

function getCompareIndex(id) {
  const arr = Array.from(compareSelected.value)
  return arr.indexOf(id)
}

function getCandidateName(id) {
  const c = candidates.value.find(x => x.id === id)
  return c ? c.name : ''
}

function getColor(idx) {
  if (idx < COMPARE_COLOR_POOL.length) return COMPARE_COLOR_POOL[idx]
  const hue = (idx * 137.5) % 360
  return 'hsl(' + hue + ', 65%, 50%)'
}

function openChat(c) {
  uni.navigateTo({
    url:
      '/pages/enterprise/chat' +
      '?match_record_id=' + encodeURIComponent(c.id) +
      '&candidate_name=' + encodeURIComponent(c.name || '') +
      '&job_title=' + encodeURIComponent(c.job_title || '') +
      '&match=' + encodeURIComponent(c.match != null ? c.match : '')
  })
}

function closeCompare() {
  showCompare.value = false
  compareData.value = null
  deepCompareData.value = null
  deepCompareError.value = ''
}

function closeDeepPanel() {
  showDeepPanel.value = false
}

// ── 新增函数 ──
function enterMultiSelect(id) {
  multiSelectMode.value = true
  if (!compareSelected.value.has(id)) {
    toggleCompare(id)
  }
}

function exitMultiSelect() {
  multiSelectMode.value = false
  clearCompare()
}

function onJobTagClick(jobId) {
  selectedJob.value = jobId || null
}

async function onRefresh() {
  refreshing.value = true
  try {
    await loadCandidates()
  } finally {
    refreshing.value = false
  }
}

// ── watch ──
watch([selectedJob, keyword], () => {
  loadCandidates()
})

watch(() => props.filterJobId, (val) => {
  if (val && jobs.value.length > 0) {
    const exists = jobs.value.find(j => j.id === val)
    if (exists) {
      selectedJob.value = val
    }
  }
}, { immediate: true })

// autoCompare 逻辑
watch([() => props.autoCompare, () => props.filterJobId, candidates, loading], () => {
  if (props.autoCompare && props.filterJobId && candidates.value.length > 0 && !loading.value && !autoCompareTriggered) {
    autoCompareTriggered = true
    const ids = new Set()
    for (const c of candidates.value) {
      if (ids.size >= maxCompare.value) break
      ids.add(c.id)
    }
    if (ids.size >= 2) {
      compareSelected.value = ids
      nextTick(() => {
        runCompare()
      })
    }
  }
})

// ── 初始加载 ──
onMounted(() => {
  loadCandidates()
  if (props.filterJobId) {
    selectedJob.value = props.filterJobId
  }
})
</script>

<style>
.ets-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  position: relative;
  background: #F2F4F8;
}

/* 多选模式顶部栏 */
.ets-multi-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16rpx 32rpx;
  background: #2B7DE9;
  flex-shrink: 0;
  z-index: 10;
}

.ets-multi-bar-left {
  display: flex;
  align-items: center;
  gap: 20rpx;
}

.ets-multi-count {
  font-size: 26rpx;
  color: #FFFFFF;
  font-weight: 500;
}

.ets-multi-num {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.ets-max-picker {
  display: flex;
  align-items: center;
  gap: 6rpx;
  padding: 6rpx 16rpx;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 10rpx;
}

.ets-max-label {
  font-size: 20rpx;
  color: rgba(255, 255, 255, 0.8);
}

.ets-max-value {
  font-size: 22rpx;
  font-weight: 500;
  color: #FFFFFF;
}

.ets-multi-exit {
  padding: 10rpx 24rpx;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 12rpx;
}

.ets-multi-exit:active {
  opacity: 0.8;
}

.ets-multi-exit-text {
  font-size: 24rpx;
  font-weight: 500;
  color: #FFFFFF;
}

/* 工具栏 */
.ets-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx 32rpx;
  background: #FFFFFF;
  flex-shrink: 0;
}

.ets-toolbar-left {
  display: flex;
  align-items: baseline;
  gap: 12rpx;
}

.ets-page-title {
  font-size: 40rpx;
  font-weight: 700;
  color: #1A1A1A;
}

.ets-page-count {
  font-size: 26rpx;
  color: #8C8C8C;
  font-variant-numeric: tabular-nums;
}

.ets-match-btn {
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 16rpx 24rpx;
  border: 2rpx solid #EAEAEA;
  border-radius: 14rpx;
  background: #FFFFFF;
}

.ets-match-btn:active {
  opacity: 0.8;
}

.ets-match-btn-disabled {
  opacity: 0.5;
}

.ets-match-btn .app-icon {
  width: 28rpx;
  height: 28rpx;
  color: #1A1A1A;
}

.ets-match-btn-text {
  font-size: 24rpx;
  font-weight: 500;
  color: #1A1A1A;
}

/* 搜索框 */
.ets-search-row {
  padding: 16rpx 32rpx;
  background: #FFFFFF;
  border-bottom: 2rpx solid #F0F0F0;
  flex-shrink: 0;
}

.ets-search-box {
  display: flex;
  align-items: center;
  gap: 10rpx;
  padding: 0 16rpx;
  height: 72rpx;
  border: 2rpx solid #EAEAEA;
  border-radius: 14rpx;
  background: #F5F7FA;
}

.ets-search-box .app-icon {
  width: 28rpx;
  height: 28rpx;
  color: #8C8C8C;
  flex-shrink: 0;
}

.ets-search-input {
  flex: 1;
  font-size: 26rpx;
  color: #1A1A1A;
}

.ets-search-clear {
  display: flex;
  padding: 8rpx;
}

.ets-search-clear .app-icon {
  width: 24rpx;
  height: 24rpx;
}

/* 岗位筛选横向滚动 */
.ets-job-row {
  padding: 12rpx 32rpx;
  background: #FFFFFF;
  border-bottom: 2rpx solid #F0F0F0;
  flex-shrink: 0;
}

.ets-job-scroll {
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
}

.ets-job-tags {
  display: inline-flex;
  gap: 12rpx;
  padding: 4rpx 0;
}

.ets-job-tag {
  display: inline-flex;
  align-items: center;
  padding: 12rpx 24rpx;
  border-radius: 16rpx;
  background: #F5F7FA;
  flex-shrink: 0;
}

.ets-job-tag:active {
  opacity: 0.8;
}

.ets-job-tag-active {
  background: #2B7DE9;
}

.ets-job-tag-text {
  font-size: 24rpx;
  color: #595959;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

.ets-job-tag-active .ets-job-tag-text {
  color: #FFFFFF;
}

/* 标签行 */
.ets-tags-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
  padding: 12rpx 32rpx 16rpx;
  flex-shrink: 0;
  background: #FFFFFF;
}

.ets-tag-item {
  display: inline-flex;
  align-items: center;
  gap: 8rpx;
  padding: 8rpx 16rpx;
  border-radius: 8rpx;
  background: #F5F7FA;
}

.ets-tag-item .app-icon {
  width: 22rpx;
  height: 22rpx;
  color: #8C8C8C;
}

.ets-tag-text {
  font-size: 22rpx;
  color: #595959;
}

.ets-tag-green {
  background: rgba(5, 150, 105, 0.12);
}

.ets-tag-green .ets-tag-text {
  color: var(--accent-green);
}

.ets-tag-green .app-icon {
  color: var(--accent-green);
}

/* 错误 */
.ets-error {
  margin: 16rpx 32rpx 0;
  padding: 16rpx 20rpx;
  border: 2rpx solid var(--accent-red);
  border-radius: 14rpx;
  background: rgba(220, 38, 38, 0.08);
  flex-shrink: 0;
}

.ets-error-text {
  font-size: 24rpx;
  color: var(--accent-red);
}

/* 状态 */
.ets-state-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 160rpx 32rpx;
  gap: 12rpx;
}

.ets-state-box .app-icon {
  width: 48rpx;
  height: 48rpx;
  color: #8C8C8C;
}

.ets-state-text {
  font-size: 28rpx;
  color: #8C8C8C;
  font-weight: 500;
}

.ets-state-sub {
  font-size: 24rpx;
  color: #8C8C8C;
  opacity: 0.6;
  text-align: center;
}

/* 列表 */
.ets-list {
  flex: 1;
  padding: 32rpx 32rpx;
  box-sizing: border-box;
}

/* 底部对比栏 */
.ets-compare-bar {
  position: fixed;
  z-index: 40;
  left: 0;
  right: 0;
  bottom: 112rpx;
  border-top: 2rpx solid #EAEAEA;
  background: #FFFFFF;
  box-shadow: 0 -4rpx 20rpx rgba(0, 0, 0, 0.06);
}

.ets-compare-bar-top {
  padding: 12rpx 32rpx;
}

.ets-selected-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
}

.ets-selected-tag {
  display: inline-flex;
  align-items: center;
  gap: 6rpx;
  padding: 6rpx 14rpx;
  border-radius: 8rpx;
  background: #F5F7FA;
}

.ets-selected-dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
}

.ets-selected-name {
  font-size: 22rpx;
  color: #1A1A1A;
}

.ets-selected-remove {
  display: flex;
  padding: 4rpx;
}

.ets-selected-remove .app-icon {
  width: 20rpx;
  height: 20rpx;
  color: #8C8C8C;
}

.ets-compare-bar-bottom {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12rpx;
  padding: 12rpx 32rpx 16rpx;
}

.ets-clear-btn {
  padding: 14rpx 20rpx;
}

.ets-clear-text {
  font-size: 24rpx;
  color: #8C8C8C;
}

.ets-radar-btn {
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 14rpx 24rpx;
  border: 2rpx solid #EAEAEA;
  border-radius: 14rpx;
  background: #F5F7FA;
}

.ets-radar-btn:active {
  opacity: 0.8;
}

.ets-radar-btn .app-icon {
  width: 26rpx;
  height: 26rpx;
  color: #1A1A1A;
}

.ets-radar-btn-text {
  font-size: 24rpx;
  font-weight: 500;
  color: #1A1A1A;
}

.ets-ai-btn {
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 14rpx 24rpx;
  border-radius: 14rpx;
  background: #2B7DE9;
}

.ets-ai-btn:active {
  opacity: 0.8;
}

.ets-ai-btn-text {
  font-size: 24rpx;
  font-weight: 500;
  color: #FFFFFF;
}

.ets-btn-disabled {
  opacity: 0.5;
}
</style>