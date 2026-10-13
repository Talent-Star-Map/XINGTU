<template>
  <view class="ejm-page">
    <!-- 顶部工具栏 -->
    <view class="ejm-toolbar">
      <view class="ejm-toolbar-left">
        <text class="ejm-page-title">岗位</text>
        <text class="ejm-page-count">{{ allJobs.length }}</text>
      </view>
      <view class="ejm-create-btn" @tap="openCreate">
        <AppIcon name="plus" />
        <text class="ejm-create-text">发布新岗位</text>
      </view>
    </view>

    <!-- 状态过滤 -->
    <view class="ejm-filter-bar">
      <scroll-view class="ejm-filter-scroll" scroll-x :show-scrollbar="false">
        <view
          v-for="f in FILTERS"
          :key="f.key"
          class="ejm-filter-tab"
          :class="{ active: filter === f.key }"
          @tap="setFilter(f.key)"
        >
          <text class="ejm-filter-label">{{ f.label }}</text>
          <text class="ejm-filter-count">{{ filterCount(f.key) }}</text>
        </view>
      </scroll-view>
    </view>

    <!-- 错误提示 -->
    <view v-if="error" class="ejm-error">
      <text class="ejm-error-text">{{ error }}</text>
    </view>

    <!-- 加载状态 -->
    <view v-if="loading" class="ejm-state-box">
      <text class="ejm-state-text">加载中...</text>
    </view>

    <!-- 空数据 -->
    <view v-else-if="filteredJobs.length === 0" class="ejm-state-box">
      <text class="ejm-state-text">暂无岗位</text>
      <text class="ejm-state-sub">点击右上角"发布新岗位"创建</text>
    </view>

    <!-- 岗位列表 -->
    <scroll-view
      v-else
      class="ejm-list"
      scroll-y
      :show-scrollbar="false"
      :scroll-into-view="scrollIntoId"
    >
      <view
        v-for="(job, i) in filteredJobs"
        :key="job.id"
        :id="'job-' + job.id"
        class="ejm-card"
        :class="{ 'ejm-card-highlight': highlightId === job.id }"
      >
        <view class="ejm-card-top">
          <view class="ejm-card-title-row">
            <text class="ejm-card-title">{{ job.title }}</text>
            <text
              class="ejm-card-status"
              :style="{ background: statusBg(job.status), color: statusColor(job.status) }"
            >{{ statusLabel(job.status) }}</text>
          </view>
          <view class="ejm-card-meta">
            <text class="ejm-card-meta-item">{{ job.location || '—' }}</text>
            <text class="ejm-card-meta-divider">|</text>
            <text class="ejm-card-meta-item">{{ job.salary_range || '—' }}</text>
            <text class="ejm-card-meta-divider">|</text>
            <text class="ejm-card-meta-item">{{ job.experience || '—' }}</text>
          </view>
        </view>

        <!-- 技能标签 -->
        <view v-if="skillTags(job).length > 0" class="ejm-card-skills">
          <text
            v-for="s in skillTags(job)"
            :key="s"
            class="ejm-skill-tag"
          >{{ s }}</text>
          <text v-if="hiddenSkillCount(job) > 0" class="ejm-skill-more">+{{ hiddenSkillCount(job) }}</text>
        </view>

        <!-- 底部操作 -->
        <view class="ejm-card-actions">
          <view class="ejm-card-candidates" @tap.stop="goToTalent(job.id)">
            <text class="ejm-candidates-num">{{ job.candidates }}</text>
            <text class="ejm-candidates-label">候选人</text>
          </view>

          <view class="ejm-card-opts">
            <view class="ejm-opt-btn" @tap="openView(job)" title="查看详情">
              <AppIcon name="eye" />
            </view>
            <view class="ejm-opt-btn" @tap="openEdit(job)" title="编辑">
              <AppIcon name="edit" />
            </view>
            <view
              class="ejm-opt-btn"
              @tap="toggleStatus(job)"
              :title="job.status === 'active' ? '关闭岗位' : '重新开放'"
            >
              <AppIcon name="power" v-if="false" />
              <text class="ejm-opt-emoji">{{ job.status === 'active' ? '⏸' : '▶' }}</text>
            </view>
            <view class="ejm-opt-btn ejm-opt-danger" @tap="confirmDeleteJob(job)" title="删除">
              <AppIcon name="trash" />
            </view>
          </view>
        </view>
      </view>
    </scroll-view>

    <!-- Toast -->
    <view v-if="toast" class="ejm-toast">
      <text class="ejm-toast-text">{{ toast }}</text>
    </view>

    <!-- 详情弹窗 -->
    <EnterpriseJobModal
      v-if="viewing"
      title="岗位详情"
      @close="viewing = null"
    >
      <view class="ejm-detail">
        <view class="ejm-detail-row">
          <text class="ejm-detail-label">岗位名称</text>
          <text class="ejm-detail-value">{{ viewing.title }}</text>
        </view>
        <view class="ejm-detail-row">
          <text class="ejm-detail-label">工作城市</text>
          <text class="ejm-detail-value">{{ viewing.location || '—' }}</text>
        </view>
        <view class="ejm-detail-row">
          <text class="ejm-detail-label">薪资范围</text>
          <text class="ejm-detail-value">{{ viewing.salary_range || (viewing.salary_min != null ? viewing.salary_min + 'K-' + (viewing.salary_max ?? '?') + 'K' : '—') }}</text>
        </view>
        <view class="ejm-detail-row">
          <text class="ejm-detail-label">学历要求</text>
          <text class="ejm-detail-value">{{ viewing.education || '—' }}</text>
        </view>
        <view class="ejm-detail-row">
          <text class="ejm-detail-label">经验要求</text>
          <text class="ejm-detail-value">{{ viewing.experience || '—' }}</text>
        </view>
        <view class="ejm-detail-row">
          <text class="ejm-detail-label">状态</text>
          <text
            class="ejm-detail-value"
            :style="{ color: statusColor(viewing.status) }"
          >{{ statusLabel(viewing.status) }}</text>
        </view>
        <view class="ejm-detail-row">
          <text class="ejm-detail-label">候选人数量</text>
          <text class="ejm-detail-value">{{ viewing.candidates }} 人</text>
        </view>
        <view class="ejm-detail-row">
          <text class="ejm-detail-label">创建时间</text>
          <text class="ejm-detail-value">{{ viewing.created_at }}</text>
        </view>
        <view class="ejm-detail-row">
          <text class="ejm-detail-label">更新时间</text>
          <text class="ejm-detail-value">{{ viewing.updated_at }}</text>
        </view>
        <view class="ejm-detail-block">
          <text class="ejm-detail-label">技能要求</text>
          <view class="ejm-detail-skills">
            <text
              v-for="s in skillList(viewing.skills_required)"
              :key="s"
              class="ejm-skill-tag"
            >{{ s }}</text>
            <text v-if="skillList(viewing.skills_required).length === 0" class="ejm-detail-na">—</text>
          </view>
        </view>
        <view v-if="viewing.description" class="ejm-detail-block">
          <text class="ejm-detail-label">岗位描述</text>
          <text class="ejm-detail-desc">{{ viewing.description }}</text>
        </view>
      </view>
    </EnterpriseJobModal>

    <!-- 创建/编辑弹窗 -->
    <EnterpriseJobModal
      v-if="editorOpen"
      :title="editingId ? '编辑岗位' : '发布新岗位'"
      @close="editorOpen = false"
    >
      <view class="ejm-form">
        <view class="ejm-field">
          <text class="ejm-field-label">岗位名称 <text style="color: var(--accent-red)">*</text></text>
          <input
            class="ejm-input"
            v-model="form.title"
            placeholder="如：AI应用开发工程师"
          />
        </view>
        <view class="ejm-field-row">
          <view class="ejm-field ejm-field-half">
            <text class="ejm-field-label">工作城市</text>
            <input class="ejm-input" v-model="form.location" placeholder="如：北京" />
          </view>
          <view class="ejm-field ejm-field-half">
            <text class="ejm-field-label">学历要求</text>
            <input class="ejm-input" v-model="form.education" placeholder="如：本科" />
          </view>
        </view>
        <view class="ejm-field-row">
          <view class="ejm-field ejm-field-third">
            <text class="ejm-field-label">薪资下限(K)</text>
            <input class="ejm-input" type="number" v-model="form.salary_min" placeholder="如：30" />
          </view>
          <view class="ejm-field ejm-field-third">
            <text class="ejm-field-label">薪资上限(K)</text>
            <input class="ejm-input" type="number" v-model="form.salary_max" placeholder="如：50" />
          </view>
          <view class="ejm-field ejm-field-third">
            <text class="ejm-field-label">展示薪资</text>
            <input class="ejm-input" v-model="form.salary_range" placeholder="如：30K-50K" />
          </view>
        </view>
        <view class="ejm-field-row">
          <view class="ejm-field ejm-field-half">
            <text class="ejm-field-label">经验要求</text>
            <input class="ejm-input" v-model="form.experience" placeholder="如：3-5年" />
          </view>
          <view class="ejm-field ejm-field-half">
            <text class="ejm-field-label">状态</text>
            <picker
              :value="statusPickerIndex"
              :range="statusPickerOptions"
              @change="onStatusChange"
            >
              <view class="ejm-input ejm-picker">{{ statusPickerOptions[statusPickerIndex] || '请选择' }}</view>
            </picker>
          </view>
        </view>
        <view class="ejm-field">
          <text class="ejm-field-label">技能要求（逗号分隔）</text>
          <input
            class="ejm-input"
            v-model="form.skills_required"
            placeholder="如：Python,LangChain,RAG,PyTorch"
          />
        </view>
        <view class="ejm-field">
          <text class="ejm-field-label">岗位描述</text>
          <textarea
            class="ejm-input ejm-textarea"
            v-model="form.description"
            placeholder="岗位详细描述..."
          ></textarea>
        </view>
        <view class="ejm-form-actions">
          <view class="ejm-btn ejm-btn-cancel" @tap="editorOpen = false">取消</view>
          <view
            class="ejm-btn ejm-btn-primary"
            :class="{ disabled: saving }"
            @tap="submitForm"
          >
            <text>{{ saving ? '保存中...' : (editingId ? '保存修改' : '发布岗位') }}</text>
          </view>
        </view>
      </view>
    </EnterpriseJobModal>
  </view>
</template>

<script setup>
import { computed, ref, watch, onMounted, nextTick } from 'vue'
import { request } from '../../utils/request'
import AppIcon from '../common/AppIcon.vue'
import EnterpriseJobModal from './EnterpriseJobModal.vue'

const STATUS_MAP = {
  'active': { label: '招聘中', bg: 'rgba(5, 150, 105, 0.12)', color: 'var(--accent-green)' },
  'draft': { label: '草稿', bg: 'rgba(217, 119, 6, 0.12)', color: 'var(--accent-orange)' },
  'closed': { label: '已关闭', bg: 'rgba(115, 118, 134, 0.12)', color: 'var(--color-on-surface-variant)' },
}

const FILTERS = [
  { key: '', label: '全部' },
  { key: 'active', label: '招聘中' },
  { key: 'draft', label: '草稿' },
  { key: 'closed', label: '已关闭' },
]

const statusPickerOptions = ['招聘中', '草稿', '已关闭']
const statusPickerValues = ['active', 'draft', 'closed']

const EMPTY_FORM = {
  title: '', description: '', location: '',
  salary_min: '', salary_max: '',
  salary_range: '', education: '', experience: '', skills_required: '',
  status: 'active',
}

const allJobs = ref([])
const loading = ref(true)
const error = ref('')
const filter = ref('')
const toast = ref('')
let toastTimer = null

const viewing = ref(null)
const editorOpen = ref(false)
const editingId = ref(null)
const form = ref({ ...EMPTY_FORM })
const saving = ref(false)

const highlightId = ref(null)
const scrollIntoId = ref('')

const props = defineProps({
  selectedJobId: { type: Number, default: null }
})

const emit = defineEmits(['navigate'])

const statusPickerIndex = computed(() => {
  const idx = statusPickerValues.indexOf(form.value.status)
  return idx >= 0 ? idx : 0
})

function onStatusChange(e) {
  form.value.status = statusPickerValues[e.detail.value] || 'active'
}

const filteredJobs = computed(() => {
  if (!filter.value) return allJobs.value
  return allJobs.value.filter(j => j.status === filter.value)
})

const counts = computed(() => ({
  all: allJobs.value.length,
  active: allJobs.value.filter(j => j.status === 'active').length,
  draft: allJobs.value.filter(j => j.status === 'draft').length,
  closed: allJobs.value.filter(j => j.status === 'closed').length,
}))

function filterCount(key) {
  if (key === '') return counts.value.all
  return counts.value[key] || 0
}

function statusLabel(s) {
  return (STATUS_MAP[s] || STATUS_MAP['active']).label
}

function statusColor(s) {
  return (STATUS_MAP[s] || STATUS_MAP['active']).color
}

function statusBg(s) {
  return (STATUS_MAP[s] || STATUS_MAP['active']).bg
}

function skillTags(job) {
  return job.skills_required.split(',').map(s => s.trim()).filter(Boolean).slice(0, 4)
}

function hiddenSkillCount(job) {
  const all = job.skills_required.split(',').map(s => s.trim()).filter(Boolean)
  return Math.max(0, all.length - 4)
}

function skillList(skills) {
  return skills.split(',').map(s => s.trim()).filter(Boolean)
}

function setFilter(key) {
  filter.value = key
}

function showToast(msg) {
  toast.value = msg
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value = '' }, 3000)
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const d = await request({ url: '/api/enterprise/jobs', data: { page: '1', size: '50' } })
    if (d.success) {
      allJobs.value = d.data.jobs || []
    } else {
      error.value = d.message || '加载失败'
    }
  } catch {
    error.value = '网络错误'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  load()
})

watch(() => props.selectedJobId, (val) => {
  if (val && allJobs.value.length > 0) {
    nextTick(() => {
      scrollIntoId.value = 'job-' + val
      highlightId.value = val
      setTimeout(() => { highlightId.value = null }, 1500)
    })
  }
})

function openCreate() {
  editingId.value = null
  form.value = { ...EMPTY_FORM }
  editorOpen.value = true
}

async function openEdit(job) {
  try {
    const d = await request({ url: '/api/enterprise/jobs/' + job.id })
    if (d.success) {
      const j = d.data
      editingId.value = job.id
      form.value = {
        title: j.title, description: j.description, location: j.location,
        salary_min: j.salary_min ?? '', salary_max: j.salary_max ?? '',
        salary_range: j.salary_range, education: j.education,
        experience: j.experience, skills_required: j.skills_required,
        status: j.status,
      }
      editorOpen.value = true
    } else {
      showToast(d.message || '加载详情失败')
    }
  } catch {
    showToast('网络错误')
  }
}

async function openView(job) {
  try {
    const d = await request({ url: '/api/enterprise/jobs/' + job.id })
    if (d.success) {
      viewing.value = d.data
    } else {
      showToast(d.message || '加载详情失败')
    }
  } catch {
    showToast('网络错误')
  }
}

async function submitForm() {
  if (!form.value.title.trim()) {
    showToast('岗位名称不能为空')
    return
  }
  saving.value = true
  try {
    const body = {
      title: form.value.title.trim(),
      description: form.value.description,
      location: form.value.location,
      salary_min: form.value.salary_min === '' ? null : Number(form.value.salary_min),
      salary_max: form.value.salary_max === '' ? null : Number(form.value.salary_max),
      salary_range: form.value.salary_range,
      education: form.value.education,
      experience: form.value.experience,
      skills_required: form.value.skills_required,
      status: form.value.status,
    }

    const url = editingId.value ? '/api/enterprise/jobs/' + editingId.value : '/api/enterprise/jobs'
    const method = editingId.value ? 'PUT' : 'POST'
    const d = await request({ url, method, data: body })
    if (d.success) {
      editorOpen.value = false
      showToast(d.message || (editingId.value ? '更新成功' : '发布成功'))
      await load()
    } else {
      showToast(d.message || '保存失败')
    }
  } catch {
    showToast('网络错误')
  } finally {
    saving.value = false
  }
}

async function toggleStatus(job) {
  const next = job.status === 'active' ? 'closed' : 'active'
  try {
    const d = await request({
      url: '/api/enterprise/jobs/' + job.id + '/status',
      method: 'PATCH',
      data: { status: next },
    })
    if (d.success) {
      showToast(d.message || '状态已更新')
      await load()
    } else {
      showToast(d.message || '操作失败')
    }
  } catch {
    showToast('网络错误')
  }
}

function confirmDeleteJob(job) {
  uni.showModal({
    title: '提示',
    content: '确定要删除岗位「' + job.title + '」吗？删除后将同时清理该岗位的 ' + job.candidates + ' 条匹配记录，操作不可撤销。',
    success: async (res) => {
      if (res.confirm) {
        try {
          const d = await request({ url: '/api/enterprise/jobs/' + job.id, method: 'DELETE' })
          if (d.success) {
            showToast(d.message || '已删除')
            await load()
          } else {
            showToast(d.message || '删除失败')
          }
        } catch {
          showToast('网络错误')
        }
      }
    }
  })
}

function goToTalent(jobId) {
  emit('navigate', 'talent', { filterJobId: jobId })
}
</script>

<style>
.ejm-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  position: relative;
}

.ejm-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 32rpx;
  border-bottom: 1rpx solid var(--color-outline-variant);
  flex-shrink: 0;
}

.ejm-toolbar-left {
  display: flex;
  align-items: baseline;
  gap: 12rpx;
}

.ejm-page-title {
  font-size: 40rpx;
  font-weight: 700;
  color: var(--color-on-surface);
}

.ejm-page-count {
  font-size: 26rpx;
  color: var(--color-on-surface-variant);
  font-variant-numeric: tabular-nums;
}

.ejm-create-btn {
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 16rpx 28rpx;
  border-radius: 16rpx;
  background: var(--color-primary);
  color: var(--color-on-primary);
  font-size: 26rpx;
  font-weight: 600;
}

.ejm-create-btn:active {
  opacity: 0.8;
}

.ejm-create-btn .app-icon {
  width: 28rpx;
  height: 28rpx;
}

.ejm-create-text {
  line-height: 1;
}

.ejm-filter-bar {
  padding: 16rpx 32rpx;
  border-bottom: 1rpx solid var(--color-outline-variant);
  flex-shrink: 0;
}

.ejm-filter-scroll {
  display: flex;
  white-space: nowrap;
}

.ejm-filter-tab {
  display: inline-flex;
  align-items: center;
  gap: 8rpx;
  padding: 14rpx 28rpx;
  border-radius: 14rpx;
  margin-right: 12rpx;
  font-size: 26rpx;
  font-weight: 500;
  color: var(--color-on-surface-variant);
  background: transparent;
}

.ejm-filter-tab.active {
  background: var(--color-surface-container-high);
  color: var(--color-on-surface);
}

.ejm-filter-label {
  line-height: 1;
}

.ejm-filter-count {
  font-size: 22rpx;
  opacity: 0.6;
  font-variant-numeric: tabular-nums;
}

.ejm-error {
  margin: 24rpx 32rpx 0;
  padding: 20rpx 24rpx;
  border: 1rpx solid var(--accent-red);
  border-radius: 14rpx;
  background: rgba(220, 38, 38, 0.08);
}

.ejm-error-text {
  font-size: 24rpx;
  color: var(--accent-red);
}

.ejm-state-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 120rpx 32rpx;
  gap: 12rpx;
}

.ejm-state-text {
  font-size: 28rpx;
  color: var(--color-on-surface-variant);
}

.ejm-state-sub {
  font-size: 24rpx;
  color: var(--color-on-surface-variant);
  opacity: 0.6;
}

.ejm-list {
  flex: 1;
  padding: 24rpx 32rpx;
  box-sizing: border-box;
}

.ejm-card {
  padding: 28rpx;
  margin-bottom: 20rpx;
  border: 1rpx solid var(--color-outline-variant);
  border-radius: 20rpx;
  background: var(--color-surface-container-lowest);
  transition: background 0.3s;
}

.ejm-card-highlight {
  background: var(--color-primary-fixed);
}

.ejm-card-top {
  margin-bottom: 16rpx;
}

.ejm-card-title-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 10rpx;
}

.ejm-card-title {
  font-size: 32rpx;
  font-weight: 600;
  color: var(--color-on-surface);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

.ejm-card-status {
  font-size: 20rpx;
  font-weight: 500;
  padding: 4rpx 16rpx;
  border-radius: 8rpx;
  flex-shrink: 0;
  line-height: 1.4;
}

.ejm-card-meta {
  display: flex;
  align-items: center;
  gap: 12rpx;
  flex-wrap: wrap;
}

.ejm-card-meta-item {
  font-size: 24rpx;
  color: var(--color-on-surface-variant);
}

.ejm-card-meta-divider {
  font-size: 20rpx;
  color: var(--color-outline-variant);
}

.ejm-card-skills {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
  margin-bottom: 20rpx;
}

.ejm-skill-tag {
  font-size: 22rpx;
  padding: 6rpx 16rpx;
  border-radius: 8rpx;
  background: var(--color-surface-container-high);
  color: var(--color-on-surface-variant);
  line-height: 1.3;
}

.ejm-skill-more {
  font-size: 22rpx;
  color: var(--color-on-surface-variant);
  padding: 6rpx 8rpx;
  line-height: 1.3;
}

.ejm-card-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 16rpx;
  border-top: 1rpx solid var(--color-outline-variant);
}

.ejm-card-candidates {
  display: flex;
  align-items: baseline;
  gap: 6rpx;
}

.ejm-card-candidates:active {
  opacity: 0.7;
}

.ejm-candidates-num {
  font-size: 36rpx;
  font-weight: 700;
  color: var(--color-on-surface);
  font-variant-numeric: tabular-nums;
}

.ejm-candidates-label {
  font-size: 22rpx;
  color: var(--color-on-surface-variant);
}

.ejm-card-opts {
  display: flex;
  align-items: center;
  gap: 4rpx;
}

.ejm-opt-btn {
  display: flex;
  width: 56rpx;
  height: 56rpx;
  align-items: center;
  justify-content: center;
  border-radius: 14rpx;
  color: var(--color-on-surface-variant);
}

.ejm-opt-btn:active {
  background: var(--color-surface-container-high);
}

.ejm-opt-danger:active {
  background: rgba(220, 38, 38, 0.1);
}

.ejm-opt-btn .app-icon {
  width: 28rpx;
  height: 28rpx;
}

.ejm-opt-emoji {
  font-size: 24rpx;
  line-height: 1;
}

/* Toast */
.ejm-toast {
  position: fixed;
  z-index: 60;
  bottom: 160rpx;
  left: 50%;
  transform: translateX(-50%);
  padding: 20rpx 40rpx;
  border-radius: 16rpx;
  background: var(--color-on-surface);
  color: var(--color-surface);
  font-size: 26rpx;
  box-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.15);
}

.ejm-toast-text {
  line-height: 1;
}

/* Detail */
.ejm-detail {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.ejm-detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.ejm-detail-label {
  font-size: 24rpx;
  color: var(--color-on-surface-variant);
  flex-shrink: 0;
}

.ejm-detail-value {
  font-size: 28rpx;
  font-weight: 500;
  color: var(--color-on-surface);
  text-align: right;
}

.ejm-detail-block {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.ejm-detail-skills {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
}

.ejm-detail-na {
  font-size: 24rpx;
  color: var(--color-on-surface-variant);
}

.ejm-detail-desc {
  font-size: 26rpx;
  color: var(--color-on-surface);
  line-height: 1.6;
  white-space: pre-wrap;
}

/* Form */
.ejm-form {
  display: flex;
  flex-direction: column;
  gap: 28rpx;
}

.ejm-field {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.ejm-field-label {
  font-size: 24rpx;
  font-weight: 500;
  color: var(--color-on-surface-variant);
}

.ejm-field-row {
  display: flex;
  gap: 20rpx;
}

.ejm-field-half {
  flex: 1;
  min-width: 0;
}

.ejm-field-third {
  flex: 1;
  min-width: 0;
}

.ejm-input {
  width: 100%;
  padding: 18rpx 24rpx;
  border: 1rpx solid var(--color-outline-variant);
  border-radius: 14rpx;
  background: var(--color-surface);
  color: var(--color-on-surface);
  font-size: 26rpx;
  box-sizing: border-box;
  outline: none;
}

.ejm-picker {
  display: flex;
  align-items: center;
  min-height: 56rpx;
}

.ejm-textarea {
  height: 160rpx;
  resize: none;
}

.ejm-form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 20rpx;
  padding-top: 12rpx;
}

.ejm-btn {
  padding: 20rpx 40rpx;
  border-radius: 14rpx;
  font-size: 26rpx;
  font-weight: 600;
  text-align: center;
}

.ejm-btn:active {
  opacity: 0.8;
}

.ejm-btn-cancel {
  border: 1rpx solid var(--color-outline-variant);
  color: var(--color-on-surface-variant);
  background: transparent;
}

.ejm-btn-primary {
  background: var(--color-primary);
  color: var(--color-on-primary);
}

.ejm-btn.disabled {
  opacity: 0.6;
}
</style>