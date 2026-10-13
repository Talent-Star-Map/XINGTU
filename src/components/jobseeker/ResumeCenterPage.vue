<template>
  <view class="rc-page">
    <!-- 顶部操作栏 -->
    <view class="rc-header">
      <view class="rc-header-left">
        <AppIcon name="file-text" class="rc-header-icon" />
        <text class="rc-title">简历工作台</text>
        <text class="rc-count-badge">共 {{ resumes.length }} 份</text>
      </view>
      <view class="rc-header-actions">
        <view class="rc-btn rc-btn-primary" @tap="genOpen = true">
          <AppIcon name="wand" />
          <text>AI 生成简历</text>
        </view>
        <view class="rc-btn rc-btn-outline" @tap="createOpen = true">
          <AppIcon name="plus" />
          <text>新建</text>
        </view>
      </view>
    </view>

    <!-- 工具栏 -->
    <view class="rc-toolbar">
      <view class="rc-search-box">
        <AppIcon name="search" class="rc-search-icon" />
        <input
          v-model="searchQuery"
          placeholder="搜索简历…"
          class="rc-search-input"
          confirm-type="search"
        />
      </view>
      <view class="rc-toolbar-right">
        <picker :value="sortIndex" :range="sortOptions" range-key="label" @change="onSortChange">
          <view class="rc-sort-btn">
            <text>{{ sortOptions[sortIndex].label }}</text>
            <AppIcon name="chevron-down" />
          </view>
        </picker>
        <view class="rc-view-toggle">
          <view
            class="rc-view-btn"
            :class="{ active: viewMode === 'grid' }"
            @tap="viewMode = 'grid'"
          >
            <AppIcon name="grid" />
          </view>
          <view
            class="rc-view-btn"
            :class="{ active: viewMode === 'list' }"
            @tap="viewMode = 'list'"
          >
            <AppIcon name="list" />
          </view>
        </view>
      </view>
    </view>

    <!-- 内容区 -->
    <view v-if="loading" class="rc-loading">
      <AppIcon name="loader" class="spin-icon" />
    </view>
    <view v-else-if="filtered.length === 0" class="rc-empty">
      <AppIcon name="file-text" class="rc-empty-icon" />
      <text class="rc-empty-text">{{ searchQuery ? '没有匹配的简历' : '还没有简历，点击右上角「AI 生成简历」创建' }}</text>
    </view>
    <view v-else-if="viewMode === 'grid'" class="rc-grid">
      <view
        v-for="r in filtered"
        :key="r.id"
        class="rc-grid-card"
      >
        <view class="rc-card-thumb">
          <view class="rc-thumb-inner">
            <view class="rc-thumb-bar">
              <view class="rc-thumb-dot"></view>
              <view class="rc-thumb-line"></view>
            </view>
            <view class="rc-thumb-body">
              <view v-for="(_, wi) in 3" :key="wi" class="rc-thumb-row">
                <view class="rc-thumb-short"></view>
                <view class="rc-thumb-long"></view>
              </view>
            </view>
          </view>
          <view class="rc-card-overlay" @tap="onEdit(r)">
            <view class="rc-overlay-btn" @tap.stop="onEdit(r)">
              <AppIcon name="edit" />
            </view>
            <view class="rc-overlay-btn" @tap.stop="shareResume(r.id)">
              <AppIcon name="share-2" />
            </view>
            <view class="rc-overlay-btn rc-overlay-btn-danger" @tap.stop="deleteResume(r.id)">
              <AppIcon name="trash" />
            </view>
          </view>
        </view>
        <view class="rc-card-info">
          <text class="rc-card-title">{{ r.title }}</text>
          <view class="rc-card-meta">
            <text>{{ templateName(r.template_key) }}</text>
            <text>{{ r.created_at?.slice(0, 10) }}</text>
          </view>
        </view>
      </view>
    </view>
    <view v-else class="rc-list">
      <view
        v-for="r in filtered"
        :key="r.id"
        class="rc-list-item"
      >
        <view class="rc-list-thumb">
          <view class="rc-thumb-inner rc-thumb-small">
            <view class="rc-thumb-bar">
              <view class="rc-thumb-dot"></view>
              <view class="rc-thumb-line"></view>
            </view>
            <view class="rc-thumb-body">
              <view v-for="(_, wi) in 2" :key="wi" class="rc-thumb-row">
                <view class="rc-thumb-short"></view>
                <view class="rc-thumb-long"></view>
              </view>
            </view>
          </view>
        </view>
        <view class="rc-list-info" @tap="onEdit(r)">
          <text class="rc-list-title">{{ r.title }}</text>
          <text class="rc-list-meta">{{ templateName(r.template_key) }} · {{ r.created_at?.slice(0, 10) }}</text>
        </view>
        <view class="rc-list-actions">
          <view class="rc-list-action" @tap="onEdit(r)">
            <AppIcon name="edit" />
          </view>
          <view class="rc-list-action" @tap="shareResume(r.id)">
            <AppIcon name="share-2" />
          </view>
          <view class="rc-list-action rc-list-action-danger" @tap="deleteResume(r.id)">
            <AppIcon name="trash" />
          </view>
        </view>
      </view>
    </view>

    <!-- 新建弹窗 -->
    <view v-if="createOpen" class="rc-modal-mask" @tap="createOpen = false">
      <view class="rc-modal" @tap.stop>
        <view class="rc-modal-head">
          <text class="rc-modal-title">选择模板新建简历</text>
          <view class="rc-modal-close" @tap="createOpen = false">
            <AppIcon name="x" />
          </view>
        </view>
        <view class="rc-modal-body">
          <view v-if="templates.length === 0" class="rc-modal-loading">
            <AppIcon name="loader" class="spin-icon" />
          </view>
          <view v-else class="rc-template-grid">
            <view
              v-for="t in templates"
              :key="t.id"
              class="rc-template-item"
              @tap="createResume(t.template_key)"
            >
              <view class="rc-template-thumb">
                <view class="rc-thumb-inner">
                  <view class="rc-thumb-bar">
                    <view class="rc-thumb-dot"></view>
                    <view class="rc-thumb-line"></view>
                  </view>
                  <view class="rc-thumb-body">
                    <view v-for="(_, wi) in 3" :key="wi" class="rc-thumb-row">
                      <view class="rc-thumb-short"></view>
                      <view class="rc-thumb-long"></view>
                    </view>
                  </view>
                </view>
              </view>
              <text class="rc-template-name">{{ t.name }}</text>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- AI 生成弹窗 -->
    <view v-if="genOpen" class="rc-modal-mask" @tap="genOpen = false">
      <view class="rc-modal" @tap.stop>
        <view class="rc-modal-head">
          <text class="rc-modal-title">
            <AppIcon name="sparkles" class="rc-modal-title-icon" />
            AI 生成简历
          </text>
          <view class="rc-modal-close" @tap="genOpen = false">
            <AppIcon name="x" />
          </view>
        </view>
        <view class="rc-modal-body">
          <view class="rc-form-group">
            <text class="rc-form-label">目标岗位 *</text>
            <input v-model="genForm.job_title" placeholder="如 AI应用开发工程师" class="rc-form-input" />
          </view>
          <view class="rc-form-row">
            <view class="rc-form-group rc-form-half">
              <text class="rc-form-label">经验年限</text>
              <picker :value="genForm.yearsIdx" :range="yearOptions" @change="onYearChange">
                <view class="rc-form-input rc-form-picker">
                  <text>{{ yearOptions[genForm.yearsIdx] }}</text>
                  <AppIcon name="chevron-down" />
                </view>
              </picker>
            </view>
            <view class="rc-form-group rc-form-half">
              <text class="rc-form-label">行业</text>
              <input v-model="genForm.industry" placeholder="如 人工智能" class="rc-form-input" />
            </view>
          </view>
          <view class="rc-form-group">
            <text class="rc-form-label">已有技能（逗号分隔）</text>
            <input v-model="genForm.skills" placeholder="如 Python, RAG, LangChain" class="rc-form-input" />
          </view>
          <view class="rc-form-group">
            <text class="rc-form-label">模板</text>
            <picker :value="genForm.templateIdx" :range="templateNames" @change="onTemplateChange">
              <view class="rc-form-input rc-form-picker">
                <text>{{ templateNames[genForm.templateIdx] || '选择模板' }}</text>
                <AppIcon name="chevron-down" />
              </view>
            </picker>
          </view>
          <view class="rc-form-actions">
            <view class="rc-btn rc-btn-outline" @tap="genOpen = false">取消</view>
            <view
              class="rc-btn rc-btn-primary"
              :class="{ disabled: generating }"
              @tap="submitGenerate"
            >
              <AppIcon v-if="generating" name="loader" class="spin-icon-sm" />
              <AppIcon v-else name="wand" />
              <text>{{ generating ? '生成中…' : '生成简历' }}</text>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- 分享弹窗 -->
    <view v-if="shareOpen" class="rc-modal-mask" @tap="shareOpen = false">
      <view class="rc-modal rc-modal-sm" @tap.stop>
        <view class="rc-modal-head">
          <text class="rc-modal-title">
            <AppIcon name="share-2" class="rc-modal-title-icon" />
            分享简历
          </text>
          <view class="rc-modal-close" @tap="shareOpen = false">
            <AppIcon name="x" />
          </view>
        </view>
        <view class="rc-modal-body">
          <view class="rc-share-row">
            <input v-model="shareLink" class="rc-form-input rc-share-input" readonly />
            <view class="rc-btn rc-btn-primary rc-share-btn" @tap="copyShare">
              <AppIcon name="copy" />
              <text>复制</text>
            </view>
          </view>
          <text class="rc-share-hint">任何有链接的人都可以查看这份简历</text>
        </view>
      </view>
    </view>

    <!-- Toast -->
    <view v-if="toast" class="rc-toast">{{ toast }}</view>
  </view>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { request, API_BASE_URL } from '../../utils/request'
import AppIcon from '../common/AppIcon.vue'

const templates = ref([])
const resumes = ref([])
const loading = ref(true)
const toast = ref('')
const searchQuery = ref('')
const sortIndex = ref(0)
const viewMode = ref('grid')

const createOpen = ref(false)
const genOpen = ref(false)
const genForm = ref({ job_title: '', yearsIdx: 0, industry: '', skills: '', templateIdx: 0 })
const generating = ref(false)

const shareOpen = ref(false)
const shareLink = ref('')

const sortOptions = [
  { value: 'lastEdited', label: '最近编辑' },
  { value: 'created', label: '最新创建' },
  { value: 'nameAsc', label: '名称 A-Z' },
  { value: 'nameDesc', label: '名称 Z-A' },
]

const yearOptions = ['应届生', '1 年', '2 年', '3 年', '5 年', '8 年']
const yearValues = [0, 1, 2, 3, 5, 8]

const templateNames = computed(() => templates.value.map(t => t.name))

function showToast(msg) {
  toast.value = msg
  setTimeout(() => { toast.value = '' }, 3000)
}

function sortResumes(list) {
  const sorted = [...list]
  const opt = sortOptions[sortIndex.value].value
  switch (opt) {
    case 'created': return sorted.sort((a, b) => b.id - a.id)
    case 'nameAsc': return sorted.sort((a, b) => a.title.localeCompare(b.title))
    case 'nameDesc': return sorted.sort((a, b) => b.title.localeCompare(a.title))
    default: return sorted.sort((a, b) => b.id - a.id)
  }
}

const filtered = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  const list = q
    ? resumes.value.filter(r => r.title.toLowerCase().includes(q) || r.template_key.toLowerCase().includes(q))
    : resumes.value
  return sortResumes(list)
})

function templateName(key) {
  return templates.value.find(t => t.template_key === key)?.name || key
}

function onSortChange(e) {
  sortIndex.value = e.detail.value
}

function onYearChange(e) {
  genForm.value.yearsIdx = e.detail.value
}

function onTemplateChange(e) {
  genForm.value.templateIdx = e.detail.value
}

async function loadAll() {
  loading.value = true
  try {
    const [tr, mr] = await Promise.all([
      request({ url: '/api/resume-center/templates/list' }),
      request({ url: '/api/resume-center/list' }),
    ])
    if (tr.success) templates.value = tr.data
    if (mr.success) resumes.value = mr.data
  } catch { showToast('网络错误') }
  loading.value = false
}

onMounted(() => { loadAll() })

async function createResume(templateKey) {
  try {
    const d = await request({
      url: '/api/resume-center',
      method: 'POST',
      data: { title: '未命名简历', template_key: templateKey },
    })
    if (!d.success) { showToast(d.error?.message || '创建失败'); return }
    createOpen.value = false
    showToast('简历已创建')
    await loadAll()
  } catch { showToast('网络错误') }
}

async function submitGenerate() {
  if (!genForm.value.job_title.trim()) { showToast('请填写岗位名称'); return }
  generating.value = true
  try {
    const skills = genForm.value.skills.split(/[,，、]/).map(s => s.trim()).filter(Boolean)
    const d = await request({
      url: '/api/resume-center/generate',
      method: 'POST',
      data: {
        job_title: genForm.value.job_title,
        years_of_experience: yearValues[genForm.value.yearsIdx],
        skills,
        industry: genForm.value.industry,
        language: 'zh',
        template_key: templates.value[genForm.value.templateIdx]?.template_key || 'classic',
      },
    })
    if (d.success) {
      showToast(d.message || 'AI 简历生成成功')
      genOpen.value = false
      await loadAll()
    } else {
      showToast(d.error?.message || '生成失败')
    }
  } catch { showToast('网络错误') }
  generating.value = false
}

async function deleteResume(id) {
  uni.showModal({
    title: '确定删除这份简历吗？',
    success: async (res) => {
      if (!res.confirm) return
      try {
        const d = await request({ url: `/api/resume-center/${id}`, method: 'DELETE' })
        if (d.success) { showToast('简历已删除'); await loadAll() }
        else showToast(d.error?.message || '删除失败')
      } catch { showToast('网络错误') }
    }
  })
}

async function shareResume(id) {
  try {
    const d = await request({
      url: `/api/resume-center/share/${id}`,
      method: 'POST',
      data: {},
    })
    if (d.success) {
      shareLink.value = `${API_BASE_URL}/share/${d.data.token}`
      shareOpen.value = true
    } else showToast(d.error?.message || '生成分享失败')
  } catch { showToast('网络错误') }
}

function copyShare() {
  uni.setClipboardData({
    data: shareLink.value,
    success: () => { showToast('已复制到剪贴板') },
    fail: () => { showToast('复制失败，请手动复制') },
  })
}

function onEdit(r) {
  uni.showToast({ title: '简历编辑器即将开放', icon: 'none' })
}
</script>

<style>
.rc-page {
  width: 100%;
  box-sizing: border-box;
  padding: 24rpx;
}
.rc-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20rpx;
}
.rc-header-left {
  display: flex;
  align-items: center;
  gap: 12rpx;
}
.rc-header-icon {
  font-size: 34rpx;
  color: var(--color-primary);
}
.rc-title {
  font-size: 30rpx;
  font-weight: 800;
  color: var(--color-on-surface);
}
.rc-count-badge {
  font-size: 20rpx;
  padding: 4rpx 16rpx;
  border-radius: 999rpx;
  background: var(--color-primary-fixed);
  color: var(--color-primary);
  font-weight: 600;
}
.rc-header-actions {
  display: flex;
  gap: 12rpx;
}
.rc-btn {
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 14rpx 24rpx;
  border-radius: 14rpx;
  font-size: 22rpx;
  font-weight: 600;
}
.rc-btn .app-icon {
  font-size: 28rpx;
}
.rc-btn-primary {
  background: var(--color-primary);
  color: var(--color-on-primary);
}
.rc-btn-outline {
  border: 1rpx solid var(--color-outline-variant);
  color: var(--color-on-surface-variant);
}
.rc-btn.disabled {
  opacity: 0.6;
}
.rc-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  margin-bottom: 20rpx;
}
.rc-search-box {
  position: relative;
  flex: 1;
  max-width: 400rpx;
}
.rc-search-icon {
  position: absolute;
  left: 20rpx;
  top: 50%;
  transform: translateY(-50%);
  font-size: 28rpx;
  color: var(--color-on-surface-variant);
}
.rc-search-input {
  width: 100%;
  height: 64rpx;
  padding: 0 20rpx 0 56rpx;
  border-radius: 14rpx;
  font-size: 22rpx;
  border: 1rpx solid var(--color-outline-variant);
  background: var(--color-surface);
  color: var(--color-on-surface);
  box-sizing: border-box;
}
.rc-toolbar-right {
  display: flex;
  align-items: center;
  gap: 12rpx;
}
.rc-sort-btn {
  display: flex;
  align-items: center;
  gap: 6rpx;
  padding: 10rpx 18rpx;
  border-radius: 12rpx;
  font-size: 22rpx;
  border: 1rpx solid var(--color-outline-variant);
  color: var(--color-on-surface-variant);
}
.rc-sort-btn .app-icon {
  font-size: 24rpx;
}
.rc-view-toggle {
  display: flex;
  border: 1rpx solid var(--color-outline-variant);
  border-radius: 12rpx;
  overflow: hidden;
}
.rc-view-btn {
  padding: 14rpx 18rpx;
  color: var(--color-on-surface-variant);
}
.rc-view-btn.active {
  background: var(--color-primary-fixed);
  color: var(--color-primary);
}
.rc-loading {
  display: flex;
  justify-content: center;
  padding: 120rpx 0;
}
.spin-icon {
  font-size: 48rpx;
  color: var(--color-primary);
  animation: spin 1s linear infinite;
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
.spin-icon-sm {
  font-size: 28rpx;
  animation: spin 1s linear infinite;
}
.rc-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 160rpx 0;
  color: var(--color-on-surface-variant);
}
.rc-empty-icon {
  font-size: 80rpx;
  opacity: 0.3;
  margin-bottom: 20rpx;
}
.rc-empty-text {
  font-size: 24rpx;
}

/* Grid view */
.rc-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
}
.rc-grid-card {
  border: 1rpx solid var(--color-outline-variant);
  border-radius: 20rpx;
  background: var(--color-surface-container-lowest);
  overflow: hidden;
}
.rc-card-thumb {
  position: relative;
  padding: 20rpx;
  border-bottom: 1rpx solid var(--color-outline-variant);
  background: var(--color-surface-container);
}
.rc-thumb-inner {
  width: 120rpx;
  height: 160rpx;
  margin: 0 auto;
  background: var(--color-surface-container-lowest);
  border-radius: 8rpx;
  padding: 12rpx;
  box-sizing: border-box;
}
.rc-thumb-small {
  width: 56rpx;
  height: 72rpx;
  padding: 8rpx;
}
.rc-thumb-bar {
  display: flex;
  align-items: center;
  gap: 6rpx;
  margin-bottom: 8rpx;
}
.rc-thumb-dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  background: var(--color-on-surface-variant);
}
.rc-thumb-line {
  flex: 1;
  height: 4rpx;
  border-radius: 2rpx;
  background: var(--color-outline-variant);
}
.rc-thumb-body {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}
.rc-thumb-row {
  display: flex;
  gap: 6rpx;
}
.rc-thumb-short {
  width: 24rpx;
  height: 4rpx;
  border-radius: 2rpx;
  background: var(--color-outline-variant);
}
.rc-thumb-long {
  flex: 1;
  height: 4rpx;
  border-radius: 2rpx;
  background: var(--color-outline-variant);
}
.rc-card-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  background: rgba(0,0,0,0.25);
  opacity: 0;
  transition: opacity 0.2s;
}
.rc-card-thumb:active .rc-card-overlay {
  opacity: 1;
}
.rc-overlay-btn {
  padding: 16rpx;
  border-radius: 12rpx;
  background: #fff;
  color: var(--color-on-surface-variant);
}
.rc-overlay-btn-danger {
  color: var(--accent-red);
}
.rc-card-info {
  padding: 16rpx;
}
.rc-card-title {
  display: block;
  font-size: 22rpx;
  font-weight: 700;
  color: var(--color-on-surface);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rc-card-meta {
  display: flex;
  justify-content: space-between;
  margin-top: 6rpx;
  font-size: 20rpx;
  color: var(--color-on-surface-variant);
}

/* List view */
.rc-list {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}
.rc-list-item {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 20rpx;
  border: 1rpx solid var(--color-outline-variant);
  border-radius: 16rpx;
  background: var(--color-surface-container-lowest);
}
.rc-list-info {
  flex: 1;
  min-width: 0;
}
.rc-list-title {
  display: block;
  font-size: 24rpx;
  font-weight: 700;
  color: var(--color-on-surface);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rc-list-meta {
  display: block;
  margin-top: 4rpx;
  font-size: 20rpx;
  color: var(--color-on-surface-variant);
}
.rc-list-actions {
  display: flex;
  gap: 8rpx;
  flex: none;
}
.rc-list-action {
  padding: 12rpx;
  border-radius: 12rpx;
  color: var(--color-on-surface-variant);
}
.rc-list-action-danger {
  color: var(--accent-red);
}

/* Modal */
.rc-modal-mask {
  position: fixed;
  z-index: 100;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24rpx;
  background: rgba(0,0,0,0.4);
}
.rc-modal {
  width: 100%;
  max-width: 600rpx;
  max-height: 80vh;
  border-radius: 24rpx;
  background: var(--color-surface-container-lowest);
  overflow: hidden;
}
.rc-modal-sm {
  max-width: 500rpx;
}
.rc-modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx;
  border-bottom: 1rpx solid var(--color-outline-variant);
}
.rc-modal-title {
  display: flex;
  align-items: center;
  gap: 10rpx;
  font-size: 26rpx;
  font-weight: 700;
  color: var(--color-on-surface);
}
.rc-modal-title-icon {
  font-size: 30rpx;
  color: var(--color-primary);
}
.rc-modal-close {
  padding: 8rpx;
  border-radius: 10rpx;
  color: var(--color-on-surface-variant);
}
.rc-modal-body {
  padding: 24rpx;
  max-height: 60vh;
  overflow-y: auto;
}
.rc-modal-loading {
  display: flex;
  justify-content: center;
  padding: 60rpx;
}

/* Template grid */
.rc-template-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16rpx;
}
.rc-template-item {
  padding: 12rpx;
  border-radius: 16rpx;
  border: 1rpx solid var(--color-outline-variant);
  text-align: center;
}
.rc-template-thumb {
  height: 180rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-surface);
  border-radius: 10rpx;
  margin-bottom: 8rpx;
}
.rc-template-name {
  display: block;
  font-size: 20rpx;
  color: var(--color-on-surface);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Form */
.rc-form-group {
  margin-bottom: 20rpx;
}
.rc-form-label {
  display: block;
  font-size: 22rpx;
  font-weight: 600;
  color: var(--color-on-surface-variant);
  margin-bottom: 10rpx;
}
.rc-form-input {
  width: 100%;
  height: 64rpx;
  padding: 0 20rpx;
  border-radius: 14rpx;
  font-size: 22rpx;
  border: 1rpx solid var(--color-outline-variant);
  background: var(--color-surface);
  color: var(--color-on-surface);
  box-sizing: border-box;
}
.rc-form-picker {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.rc-form-picker .app-icon {
  font-size: 24rpx;
  color: var(--color-on-surface-variant);
}
.rc-form-row {
  display: flex;
  gap: 16rpx;
}
.rc-form-half {
  flex: 1;
}
.rc-form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 16rpx;
  margin-top: 8rpx;
}

/* Share */
.rc-share-row {
  display: flex;
  gap: 12rpx;
}
.rc-share-input {
  flex: 1;
}
.rc-share-btn {
  flex: none;
}
.rc-share-hint {
  display: block;
  margin-top: 16rpx;
  font-size: 20rpx;
  color: var(--color-on-surface-variant);
}

/* Toast */
.rc-toast {
  position: fixed;
  z-index: 200;
  top: 120rpx;
  left: 50%;
  transform: translateX(-50%);
  padding: 16rpx 32rpx;
  border-radius: 14rpx;
  font-size: 24rpx;
  background: var(--color-surface-container-high);
  color: var(--color-on-surface);
  box-shadow: 0 8rpx 32rpx rgba(0,0,0,0.12);
}
</style>