<template>
  <view class="resource-manage">
    <!-- Toast -->
    <view v-if="toast" class="toast">{{ toast }}</view>

    <!-- 顶部绿色导航栏 -->
    <view class="top-nav">
      <view class="top-nav-left" @tap="goBack">
        <AppIcon name="chevron-left" :size="40" color="#fff" />
        <text class="top-nav-title">学习资源管理</text>
      </view>
      <view class="top-nav-right">
        <view class="top-nav-icon" @tap="focusSearch">
          <AppIcon name="search" :size="18" color="#fff" />
        </view>
        <view class="top-nav-icon" @tap="openCreate">
          <AppIcon name="plus" :size="18" color="#fff" />
        </view>
        <view class="top-nav-icon" @tap="refreshList">
          <AppIcon name="refresh-cw" :size="18" color="#fff" />
        </view>
      </view>
    </view>

    <!-- 页面主体 -->
    <scroll-view class="page-body" scroll-y>
      <!-- 标题汇总卡片 -->
      <view class="summary-card">
        <view class="summary-left">
          <view class="summary-icon-wrap">
            <AppIcon name="book" :size="24" color="#009958" />
          </view>
          <view class="summary-text">
            <text class="summary-title">学习资源管理</text>
            <text class="summary-desc">管理平台中的技术学习资源</text>
          </view>
        </view>
        <view class="summary-right">
          <text class="summary-count">共 <text class="count-num">{{ total }}</text> 条资源</text>
          <view class="summary-add-btn" @tap="openCreate">
            <AppIcon name="plus" :size="14" color="#fff" />
            <text class="summary-add-text">新增资源</text>
          </view>
        </view>
      </view>

      <!-- 搜索框 -->
      <view class="search-box">
        <AppIcon name="search" :size="16" color="#9ca3af" />
        <input
          class="search-input"
          v-model="searchInput"
          placeholder="搜索资源标题或链接"
          confirm-type="search"
          @confirm="onSearch"
        />
        <view v-if="searchInput" class="search-clear" @tap="clearSearch">
          <AppIcon name="x" :size="25" color="#9ca3af" />
        </view>
        <view class="search-btn" @tap="onSearch">
          <text class="search-btn-text">搜索</text>
        </view>
      </view>

      <!-- 技能筛选栏 -->
      <view class="skill-section">
        <scroll-view class="skill-scroll" scroll-x :show-scrollbar="false">
          <view class="skill-list">
            <view
              class="skill-tag"
              :class="{ active: !skillFilter }"
              @tap="onSkillChange('')"
            >
              <text>全部</text>
            </view>
            <view
              v-for="s in skillList"
              :key="s"
              class="skill-tag"
              :class="{ active: skillFilter === s }"
              @tap="onSkillChange(s)"
            >
              <text>{{ s }}</text>
            </view>
          </view>
        </scroll-view>
      </view>

      <!-- 当前技能统计 -->
      <view class="stats-bar">
        <view class="stats-bar-line"></view>
        <view class="stats-text"><text class="stats-label">当前技能：</text><text class="stats-skill">{{ skillFilter || '全部' }}</text><text class="stats-divider">共</text><text class="stats-num">{{ total }}</text><text class="stats-divider">条资源</text></view>
      </view>

      <!-- 加载中 -->
      <view v-if="loading" class="loading-wrap">
        <AppIcon name="loader" :size="24" color="#009958" />
      </view>

      <!-- 错误 -->
      <view v-else-if="error" class="error-wrap">
        <text class="error-text">{{ error }}</text>
      </view>

      <!-- 空状态 -->
      <view v-else-if="resources.length === 0" class="empty-wrap">
        <text class="empty-text">暂无资源数据</text>
      </view>

      <!-- 资源卡片列表 -->
      <view v-else class="card-list">
        <view v-for="item in resources" :key="item.id" class="resource-card">
          <view class="card-body">
            <!-- 第一行：技能标签左 + 类型标签右 -->
            <view class="card-row1">
              <view class="card-skill-tag">
                <text class="card-skill-text">{{ item.skill_name }}</text>
              </view>
              <view
                class="card-type-tag"
                :style="{
                  background: typeTagBg(item.resource_type),
                  color: typeTagColor(item.resource_type)
                }"
              >
                <text>{{ item.resource_type }}</text>
              </view>
            </view>
            <!-- 图标 + 标题&URL -->
            <view class="card-icon-text-row">
              <view
                class="card-icon"
                :style="{ background: typeIconBg(item.resource_type) }"
              >
                <AppIcon
                  :name="typeIconName(item.resource_type)"
                  :size="35"
                  :color="typeIconColor(item.resource_type)"
                />
              </view>
              <view class="card-text-column">
                <text class="card-title">{{ item.title }}</text>
                <view class="card-url-row">
                  <AppIcon name="link" :size="40" color="#3B82F6" />
                  <text class="card-url-text">{{ item.url }}</text>
                  <view class="card-copy-btn" @tap.stop="copyUrl(item.url)">
                    <AppIcon name="copy" :size="35" color="#3B82F6" />
                  </view>
                </view>
              </view>
            </view>
          </view>
          <!-- 底部操作栏 -->
          <view class="card-footer">
            <view class="card-sort">
              <text>排序 {{ String(item.sort_order).padStart(2, '0') }}</text>
            </view>
            <view class="card-actions">
              <view class="card-action-btn edit-btn" @tap="openEdit(item)">
                <AppIcon name="edit" :size="35" color="#009958" />
              </view>
              <view class="card-action-btn delete-btn" @tap="setDeleteTarget(item)">
                <AppIcon name="trash" :size="35" color="#EF4444" />
              </view>
            </view>
          </view>
        </view>
      </view>

      <!-- 分页 -->
      <view v-if="!loading && total > 0" class="pagination">
        <view
          class="page-btn"
          :class="{ disabled: page <= 1 }"
          @tap="goPage(page - 1)"
        >
          <text>上一页</text>
        </view>
        <view class="page-info">
          <text>第{{ page }} / {{ totalPages }}页</text>
          <text class="page-total">共{{ total }}条资源</text>
        </view>
        <view
          class="page-btn"
          :class="{ disabled: page >= totalPages }"
          @tap="goPage(page + 1)"
        >
          <text>下一页</text>
        </view>
      </view>
    </scroll-view>

    <!-- 新增/编辑弹窗 -->
    <view v-if="formOpen" class="modal-mask" @tap.self="formOpen = false">
      <view class="modal-box" @tap.stop>
        <view class="modal-header">
          <text class="modal-title">{{ editId ? '编辑资源' : '新增资源' }}</text>
          <view class="modal-close" @tap="formOpen = false">
            <AppIcon name="x" :size="25" color="#6b7280" />
          </view>
        </view>
        <view class="modal-body">
          <view class="form-row two-col">
            <view class="form-field">
              <text class="form-label">技能名称 *</text>
              <input class="form-input" v-model="form.skill_name" placeholder="如 Python" />
            </view>
            <view class="form-field">
              <text class="form-label">资源类型</text>
              <picker :value="typeIndex" :range="TYPE_OPTIONS" @change="onTypeChange">
                <view class="form-input picker-input">
                  <text>{{ form.resource_type }}</text>
                  <AppIcon name="chevron-down" :size="20" color="#9ca3af" />
                </view>
              </picker>
            </view>
          </view>
          <view class="form-field">
            <text class="form-label">资源标题 *</text>
            <input class="form-input" v-model="form.title" placeholder="如 菜鸟教程 Python3" />
          </view>
          <view class="form-field">
            <text class="form-label">资源链接 *</text>
            <input class="form-input" v-model="form.url" placeholder="https://..." />
          </view>
          <view class="form-field">
            <text class="form-label">排序权重</text>
            <input class="form-input" type="number" v-model="form.sort_order" />
          </view>
        </view>
        <view class="modal-footer">
          <view class="btn-cancel" @tap="formOpen = false">
            <text class="btn-cancel-text">取消</text>
          </view>
          <view class="btn-submit" :class="{ disabled: saving }" @tap="submitForm">
            <AppIcon v-if="saving" name="loader" :size="25" color="#fff" />
            <AppIcon v-else name="check-circle" :size="25" color="#fff" />
            <text class="btn-submit-text">{{ editId ? '保存' : '创建' }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 删除确认弹窗 -->
    <view v-if="deleteTarget" class="modal-mask" @tap.self="deleteTarget = null">
      <view class="modal-box" @tap.stop>
        <view class="modal-header">
          <text class="modal-title">确认删除</text>
          <view class="modal-close" @tap="deleteTarget = null">
            <AppIcon name="x" :size="35" color="#6b7280" />
          </view>
        </view>
        <view class="modal-body">
          <text class="delete-msg">确定要删除资源「<text class="delete-name">{{ deleteTarget.title }}</text>」吗？</text>
          <text class="delete-hint">此操作不可撤销。</text>
        </view>
        <view class="modal-footer">
          <view class="btn-cancel" @tap="deleteTarget = null">
            <text class="btn-cancel-text">取消</text>
          </view>
          <view class="btn-danger" @tap="submitDelete">
            <text class="btn-danger-text">确认删除</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import AppIcon from '@/components/common/AppIcon.vue'
import { withToken, request } from '@/utils/request.js'

const props = defineProps({
  onBack: Function
})

const resources = ref([])
const skillList = ref(['C/C++', 'CSS', 'Docker', 'FastAPI', 'Flask', 'Git', 'Hadoop', 'HTML', 'Java', 'JavaScript', 'Kubernetes', 'Linux', 'MySQL', 'Nginx', 'Node.js'])
const loading = ref(true)
const error = ref('')
const toast = ref('')

const page = ref(1)
const pageSize = 20
const total = ref(0)
const keyword = ref('')
const searchInput = ref('')
const skillFilter = ref('')

const deleteTarget = ref(null)
const formOpen = ref(false)
const editId = ref(null)
const form = ref({ skill_name: '', resource_type: '文档', title: '', url: '', sort_order: 0 })
const saving = ref(false)

const TYPE_OPTIONS = ['文档', '教程', '视频', '课程', '搜索']
const typeIndex = computed(() => TYPE_OPTIONS.indexOf(form.value.resource_type))

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))

let toastTimer = null
function showToast(msg) {
  toast.value = msg
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value = '' }, 3000)
}

async function load(p = page.value, kw = keyword.value, skill = skillFilter.value) {
  loading.value = true
  error.value = ''
  try {
    let url = `/api/admin/resources?page=${p}&size=${pageSize}`
    if (kw) url += `&keyword=${encodeURIComponent(kw)}`
    if (skill) url += `&skill=${encodeURIComponent(skill)}`
    const d = await request({ url: withToken(url), method: 'GET', auth: true })
    if (d.success) {
      resources.value = d.data.list
      total.value = d.data.total
    } else {
      error.value = d.error?.message || '加载失败'
    }
  } catch {
    error.value = '网络错误'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  load(1, '', '')
})

function onSearch() {
  keyword.value = searchInput.value
  page.value = 1
  load(1, searchInput.value, skillFilter.value)
}

function clearSearch() {
  searchInput.value = ''
  keyword.value = ''
  page.value = 1
  load(1, '', skillFilter.value)
}

function onSkillChange(s) {
  skillFilter.value = s
  page.value = 1
  load(1, keyword.value, s)
}

function goPage(p) {
  if (p < 1 || p > totalPages.value) return
  page.value = p
  load(p, keyword.value, skillFilter.value)
}

function openCreate() {
  editId.value = null
  form.value = { skill_name: '', resource_type: '文档', title: '', url: '', sort_order: 0 }
  formOpen.value = true
}

function openEdit(r) {
  editId.value = r.id
  form.value = { skill_name: r.skill_name, resource_type: r.resource_type, title: r.title, url: r.url, sort_order: r.sort_order }
  formOpen.value = true
}

function onTypeChange(e) {
  form.value.resource_type = TYPE_OPTIONS[e.detail.value]
}

async function submitForm() {
  if (!form.value.skill_name.trim() || !form.value.title.trim() || !form.value.url.trim()) {
    showToast('请填写完整')
    return
  }
  saving.value = true
  try {
    const url = editId.value ? `/api/admin/resources/${editId.value}` : '/api/admin/resources'
    const method = editId.value ? 'PUT' : 'POST'
    const d = await request({
      url: withToken(url),
      method,
      data: form.value,
      auth: true
    })
    if (d.success) {
      showToast(d.message)
      formOpen.value = false
      load()
    } else {
      showToast(d.error?.message || '操作失败')
    }
  } catch {
    showToast('网络错误')
  } finally {
    saving.value = false
  }
}

async function submitDelete() {
  if (!deleteTarget.value) return
  try {
    const d = await request({
      url: withToken(`/api/admin/resources/${deleteTarget.value.id}`),
      method: 'DELETE',
      auth: true
    })
    if (d.success) {
      showToast(d.message || '已删除')
      deleteTarget.value = null
      const remaining = total.value - 1
      const maxP = Math.max(1, Math.ceil(remaining / pageSize))
      const target = Math.min(page.value, maxP)
      if (target !== page.value) {
        page.value = target
        load(target, keyword.value, skillFilter.value)
      } else {
        load()
      }
      } else {
      showToast(d.error?.message || '删除失败')
    }
  } catch {
    showToast('网络错误')
  }
}

function setDeleteTarget(r) {
  deleteTarget.value = r
}

function copyUrl(url) {
  uni.setClipboardData({
    data: url,
    success: () => {
      uni.showToast({ title: '已复制', icon: 'success' })
    }
  })
}

function goBack() {
  if (props.onBack) props.onBack()
}

function focusSearch() {
  // Visual hint only — search is triggered by Enter in the search input
}

function refreshList() {
  load(page.value, keyword.value, skillFilter.value)
}

function typeIconName(type) {
  const map = { '文档': 'file-text', '教程': 'book', '视频': 'video', '课程': 'graduation-cap', '搜索': 'search' }
  return map[type] || 'book'
}

function typeIconBg(type) {
  const map = { '文档': '#E8F2FF', '教程': '#E6F7EF', '视频': '#F3EDFC', '课程': '#E6F7EF', '搜索': '#E8F2FF' }
  return map[type] || '#E6F7EF'
}

function typeIconColor(type) {
  const map = { '文档': '#3B82F6', '教程': '#009958', '视频': '#8B5CF6', '课程': '#009958', '搜索': '#3B82F6' }
  return map[type] || '#009958'
}

function typeTagBg(type) {
  const map = { '文档': '#E8F2FF', '教程': '#E6F7EF', '视频': '#F3EDFC', '课程': '#E6F7EF', '搜索': '#E8F2FF' }
  return map[type] || '#E6F7EF'
}

function typeTagColor(type) {
  const map = { '文档': '#3B82F6', '教程': '#009958', '视频': '#8B5CF6', '课程': '#009958', '搜索': '#3B82F6' }
  return map[type] || '#009958'
}
</script>

<style scoped>
.resource-manage {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #F5F8F7;
}

.toast {
  position: fixed;
  top: 120rpx;
  left: 50%;
  transform: translateX(-50%);
  z-index: 999;
  padding: 12rpx 32rpx;
  border-radius: 12rpx;
  background: rgba(0, 0, 0, 0.75);
  color: #fff;
  font-size: 26rpx;
  white-space: nowrap;
}

/* ── 顶部绿色导航 ── */
.top-nav {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 88rpx;
  padding: 0 24rpx;
  background: #009958;
  color: #fff;
  box-sizing: border-box;
}
.top-nav-left {
  display: flex;
  align-items: center;
  gap: 6rpx;
}
.top-nav-title {
  font-size: 30rpx;
  font-weight: 700;
  color: #fff;
}
.top-nav-right {
  display: flex;
  align-items: center;
  gap: 8rpx;
}
.top-nav-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56rpx;
  height: 56rpx;
  border-radius: 12rpx;
}
.top-nav-icon:active {
  background: rgba(255, 255, 255, 0.15);
}

/* ── 页面主体 ── */
.page-body {
  flex: 1;
  min-height: 0;
  box-sizing: border-box;
}

/* ── 标题汇总卡片 ── */
.summary-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 20rpx 24rpx 0;
  padding: 32rpx;
  border-radius: 16rpx;
  background: #FFFFFF;
}
.summary-left {
  display: flex;
  align-items: center;
  gap: 20rpx;
}
.summary-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  background: #E6F7EF;
  flex-shrink: 0;
}
.summary-text {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}
.summary-title {
  font-size: 36rpx;
  font-weight: 700;
  color: #172033;
}
.summary-desc {
  font-size: 24rpx;
  color: #888888;
}
.summary-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 12rpx;
  flex-shrink: 0;
}
.summary-count {
  font-size: 22rpx;
  color: #888888;
}
.summary-add-btn {
  display: flex;
  align-items: center;
  gap: 6rpx;
  padding: 12rpx 24rpx;
  border-radius: 8rpx;
  background: #009958;
}
.summary-add-text {
  font-size: 24rpx;
  font-weight: 600;
  color: #FFFFFF;
}

/* ── 搜索框 ── */
.search-box {
  display: flex;
  align-items: center;
  gap: 12rpx;
  height: 76rpx;
  margin: 20rpx 24rpx 0;
  padding: 0 20rpx;
  border-radius: 12rpx;
  background: #FFFFFF;
  box-sizing: border-box;
}
.search-input {
  flex: 1;
  height: 100%;
  font-size: 26rpx;
  color: #172033;
  background: transparent;
}
.search-input::-webkit-input-placeholder {
  color: #9ca3af;
}
.search-clear {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48rpx;
  height: 48rpx;
  border-radius: 8rpx;
  flex-shrink: 0;
}
.search-clear:active {
  background: rgba(0, 0, 0, 0.05);
}
.search-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 56rpx;
  padding: 0 24rpx;
  border-radius: 8rpx;
  background: #E6F7EF;
  flex-shrink: 0;
}
.search-btn-text {
  font-size: 24rpx;
  font-weight: 600;
  color: #009958;
}

/* ── 技能筛选栏 ── */
.skill-section {
  margin: 20rpx 24rpx 0;
}
.skill-scroll {
  width: 100%;
  white-space: nowrap;
}
.skill-list {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  gap: 12rpx;
}
.skill-tag {
  flex-shrink: 0;
  padding: 12rpx 24rpx;
  border: 1px solid #E5E7EB;
  border-radius: 8rpx;
  background: #FFFFFF;
  font-size: 24rpx;
  color: #666666;
  white-space: nowrap;
}
.skill-tag.active {
  border: none;
  background: #E6F7EF;
  color: #009958;
  font-weight: 600;
}

/* ── 当前技能统计 ── */
.stats-bar {
  display: flex;
  align-items: center;
  gap: 10rpx;
  margin: 20rpx 24rpx 0;
}
.stats-bar-line {
  width: 6rpx;
  height: 28rpx;
  border-radius: 3rpx;
  background: #009958;
  flex-shrink: 0;
}
.stats-text {
  display: flex;
  align-items: center;
  font-size: 24rpx;
  color: #777777;
}
.stats-label {
  font-size: 25rpx;
  font-weight: 700;
  color: #172033;
}
.stats-skill {
  margin-right: 14rpx;
  font-size: 25rpx;
  font-weight: 700;
  color: #172033;
}
.stats-divider {
  font-size: 24rpx;
  color: #777777;
}
.stats-num {
  margin: 0 4rpx;
  font-size: 24rpx;
  color: #009958;
}
.count-num {
  color: #009958;
}

/* ── 加载 / 空状态 ── */
.loading-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 300rpx;
}
.error-wrap,
.empty-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 300rpx;
}
.error-text {
  font-size: 26rpx;
  color: #EF4444;
}
.empty-text {
  font-size: 26rpx;
  color: #777777;
}

/* ── 资源卡片列表 ── */
.card-list {
  padding: 0 24rpx;
}
.resource-card {
  margin: 16rpx 0;
  padding: 30rpx;
  border-radius: 16rpx;
  background: #FFFFFF;
}

/* ── 卡片主体 ── */
.card-body {
  display: block;
}

/* ── 第一行：技能标签左 + 类型标签右 ── */
.card-row1 {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16rpx;
}
.card-skill-tag {
  padding: 6rpx 14rpx;
  border-radius: 6rpx;
  background: #E8F2FF;
}
.card-skill-text {
  font-size: 22rpx;
  font-weight: 600;
  color: #3B82F6;
}
.card-type-tag {
  padding: 6rpx 14rpx;
  border-radius: 6rpx;
  font-size: 22rpx;
  font-weight: 600;
}

/* ── 标题 ── */
.card-title {
  display: block;
  margin-bottom: 8rpx;
  font-size: 32rpx;
  font-weight: 700;
  color: #172033;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── 图标 + 标题&URL ── */
.card-icon-text-row {
  display: flex;
  gap: 16rpx;
}
.card-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 78rpx;
  height: 78rpx;
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 6rpx;
}
.card-text-column {
  flex: 1;
  min-width: 0;
}
.card-url-row {
  display: flex;
  align-items: center;
  gap: 8rpx;
}
.card-url-text {
  flex: 1;
  min-width: 0;
  font-size: 24rpx;
  color: #3B82F6;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.card-copy-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40rpx;
  height: 40rpx;
  border-radius: 8rpx;
  flex-shrink: 0;
}
.card-copy-btn:active {
  background: rgba(59, 130, 246, 0.1);
}

/* ── 底部操作栏 ── */
.card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 20rpx;
  padding-top: 20rpx;
  border-top: 1px solid #F0F0F0;
}
.card-sort {
  display: inline-flex;
  padding: 6rpx 14rpx;
  border-radius: 6rpx;
  background: #E6F7EF;
  font-size: 24rpx;
  color: #777777;
}
.card-actions {
  display: flex;
  gap: 12rpx;
}
.card-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56rpx;
  height: 56rpx;
  border-radius: 12rpx;
}
.card-action-btn:active {
  background: rgba(0, 0, 0, 0.05);
}
.delete-btn:active {
  background: rgba(239, 68, 68, 0.08);
}

/* ── 分页 ── */
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20rpx;
  padding: 24rpx 24rpx 40rpx;
}
.page-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 60rpx;
  padding: 0 24rpx;
  border: 1px solid #009958;
  border-radius: 12rpx;
  background: #FFFFFF;
  font-size: 26rpx;
  color: #009958;
}
.page-btn.disabled {
  border: 1px solid transparent;
  background: #F3F4F6;
  color: #9CA3AF;
  pointer-events: none;
}
.page-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4rpx;
  font-size: 24rpx;
  color: #777777;
}
.page-total {
  font-size: 22rpx;
  color: #9CA3AF;
}

/* ── 弹窗 ── */
.modal-mask {
  position: fixed;
  inset: 0;
  z-index: 900;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40rpx;
  background: rgba(0, 0, 0, 0.45);
}
.modal-box {
  width: 100%;
  max-width: 680rpx;
  border-radius: 24rpx;
  background: #fff;
  box-shadow: 0 24rpx 64rpx rgba(0, 0, 0, 0.2);
}
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 32rpx 0;
}
.modal-title {
  font-size: 30rpx;
  font-weight: 700;
  color: #172033;
}
.modal-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48rpx;
  height: 48rpx;
  border-radius: 12rpx;
}
.modal-close:active {
  background: rgba(0, 0, 0, 0.05);
}
.modal-body {
  padding: 24rpx 32rpx;
}
.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 16rpx;
  padding: 0 32rpx 28rpx;
}

/* ── 表单 ── */
.form-row {
  display: flex;
  gap: 16rpx;
  margin-bottom: 20rpx;
}
.form-row.two-col > .form-field {
  flex: 1;
}
.form-field {
  margin-bottom: 20rpx;
}
.form-label {
  display: block;
  margin-bottom: 8rpx;
  font-size: 22rpx;
  font-weight: 600;
  color: #777777;
}
.form-input {
  width: 100%;
  height: 68rpx;
  padding: 0 20rpx;
  border: 1px solid #E5E7EB;
  border-radius: 12rpx;
  background: #fff;
  font-size: 26rpx;
  color: #172033;
  box-sizing: border-box;
}
.picker-input {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

/* ── 弹窗按钮 ── */
.btn-cancel {
  padding: 14rpx 28rpx;
  border: 1px solid #E5E7EB;
  border-radius: 12rpx;
}
.btn-cancel-text {
  font-size: 26rpx;
  color: #777777;
}
.btn-submit {
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 14rpx 28rpx;
  border-radius: 12rpx;
  background: #009958;
}
.btn-submit.disabled {
  opacity: 0.6;
  pointer-events: none;
}
.btn-submit-text {
  font-size: 26rpx;
  font-weight: 600;
  color: #fff;
}
.btn-danger {
  padding: 14rpx 28rpx;
  border-radius: 12rpx;
  background: #EF4444;
}
.btn-danger-text {
  font-size: 26rpx;
  font-weight: 600;
  color: #fff;
}

/* ── 删除确认 ── */
.delete-msg {
  font-size: 26rpx;
  color: #172033;
}
.delete-name {
  color: #EF4444;
  font-weight: 600;
}
.delete-hint {
  display: block;
  margin-top: 8rpx;
  font-size: 22rpx;
  color: #777777;
}
</style>