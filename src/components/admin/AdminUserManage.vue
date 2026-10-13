<template>
  <view class="user-manage">
    <!-- 顶部工具栏 -->
    <view class="manage-header">
      <view class="header-left">
        <view class="header-icon">
          <AppIcon :name="isJobseeker ? 'users' : 'building'" />
        </view>
        <text class="header-title">{{ roleLabel }}管理</text>
        <view class="header-badge">
          <text class="header-badge-text">共 {{ total }} 条</text>
        </view>
      </view>
      <view class="create-btn" @tap="openCreate">
        <AppIcon name="plus" />
        <text class="create-btn-text">创建{{ roleLabel }}</text>
      </view>
    </view>

    <!-- 搜索栏 -->
    <view class="search-bar">
      <view class="search-input-wrap">
        <view class="search-icon">
          <AppIcon name="search" />
        </view>
        <input
          class="search-input"
          v-model="searchInput"
          :placeholder="isJobseeker ? '搜索邮箱/用户名/姓名/手机号，回车搜索' : '搜索邮箱/用户名/公司名/手机号，回车搜索'"
          confirm-type="search"
          @confirm="onSearchConfirm"
        />
        <view v-if="searchInput" class="search-clear" @tap="clearSearch">
          <AppIcon name="x" :size="14" color="#9ca3af" />
        </view>
        <view class="search-btn" @tap="onSearchConfirm">
          <text class="search-btn-text">搜索</text>
        </view>
      </view>
    </view>

    <!-- 列表主体 -->
    <scroll-view class="list-body" scroll-y>
      <!-- loading -->
      <view v-if="loading" class="loading-wrap">
        <view class="loading-spinner"></view>
      </view>

      <!-- error -->
      <view v-else-if="error" class="error-wrap">
        <text class="error-text">{{ error }}</text>
      </view>

      <!-- empty -->
      <view v-else-if="list.length === 0" class="empty-wrap">
        <text class="empty-text">暂无{{ roleLabel }}数据</text>
      </view>

      <!-- 列表 -->
      <view v-else class="list-content">
        <view
          v-for="item in list"
          :key="item.id"
          class="user-card"
        >
          <view class="card-top">
            <view class="card-id-wrap">
              <text class="card-id">#{{ item.id }}</text>
            </view>
            <text class="card-time">{{ item.created_at }}</text>
          </view>

          <view class="card-main">
            <view class="card-row">
              <text class="card-label">邮箱</text>
              <text class="card-value">{{ item.email || '-' }}</text>
            </view>
            <view v-if="isJobseeker" class="card-row">
              <text class="card-label">用户名</text>
              <text class="card-value">{{ item.real_name || item.username || '-' }}</text>
            </view>
            <view v-else class="card-row">
              <text class="card-label">公司名</text>
              <text class="card-value">{{ item.company_name || item.username || '-' }}</text>
            </view>
            <view v-if="isJobseeker" class="card-row">
              <text class="card-label">求职意向</text>
              <text class="card-value">{{ item.target_position || '-' }}</text>
            </view>
            <view v-else class="card-row">
              <text class="card-label">行业</text>
              <text class="card-value">{{ item.industry || '-' }}</text>
            </view>
            <view class="card-row">
              <text class="card-label">城市</text>
              <text class="card-value">{{ item.city || '-' }}</text>
            </view>
            <view v-if="isJobseeker" class="card-row">
              <text class="card-label">经验</text>
              <text class="card-value">{{ item.experience || '-' }}</text>
            </view>
            <view v-else class="card-row">
              <text class="card-label">认证状态</text>
              <text class="card-value" :class="item.verified ? 'status-verified' : 'status-unverified'">{{ item.verified ? '已认证' : '未认证' }}</text>
            </view>
          </view>

          <view class="card-actions">
            <view class="action-btn action-reset" @tap="openReset(item)">
              <AppIcon name="shield" />
              <text class="action-btn-text">重置密码</text>
            </view>
            <view class="action-btn action-delete" @tap="openDelete(item)">
              <AppIcon name="trash" />
              <text class="action-btn-text">删除</text>
            </view>
          </view>
        </view>

        <!-- 分页 -->
        <view class="pagination">
          <text class="page-info">第 {{ page }} / {{ totalPages }} 页 · 共 {{ total }} 条</text>
          <view class="page-btns">
            <view
              class="page-btn"
              :class="{ 'page-btn-disabled': page <= 1 }"
              @tap="goPage(page - 1)"
            >
              <AppIcon name="chevron-left" />
            </view>
            <view
              class="page-btn"
              :class="{ 'page-btn-disabled': page >= totalPages }"
              @tap="goPage(page + 1)"
            >
              <AppIcon name="chevron-right" />
            </view>
          </view>
        </view>
      </view>
    </scroll-view>

    <!-- 创建账号弹窗 -->
    <view v-if="createOpen" class="modal-mask" @tap="closeCreate">
      <view class="modal-card" @tap.stop>
        <view class="modal-header">
          <text class="modal-title">创建{{ roleLabel }}账号</text>
          <view class="modal-close" @tap="closeCreate">
            <AppIcon name="x" />
          </view>
        </view>
        <view class="modal-body">
          <view class="form-field">
            <text class="field-label">邮箱 *</text>
            <input
              class="field-input"
              v-model="form.email"
              placeholder="user@example.com"
            />
          </view>
          <view class="form-field">
            <text class="field-label">用户名（可选）</text>
            <input
              class="field-input"
              v-model="form.username"
              placeholder="留空则取邮箱前缀"
            />
          </view>
          <view v-if="!isJobseeker" class="form-field">
            <text class="field-label">公司名称（可选）</text>
            <input
              class="field-input"
              v-model="form.company_name"
              placeholder="如：星图科技有限公司"
            />
          </view>
          <view class="form-field">
            <text class="field-label">初始密码 *（至少 8 位，需含大小写字母 + 数字）</text>
            <input
              class="field-input"
              v-model="form.password"
              type="password"
              placeholder="如：Xing1234"
            />
          </view>
        </view>
        <view class="modal-footer">
          <view class="modal-btn modal-btn-cancel" @tap="closeCreate">
            <text class="modal-btn-cancel-text">取消</text>
          </view>
          <view class="modal-btn modal-btn-primary" :class="{ 'modal-btn-disabled': saving }" @tap="submitCreate">
            <text class="modal-btn-primary-text">{{ saving ? '创建中...' : '创建' }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 重置密码弹窗 -->
    <view v-if="resetTarget" class="modal-mask" @tap="closeReset">
      <view class="modal-card" @tap.stop>
        <view class="modal-header">
          <text class="modal-title">重置密码 · {{ resetTarget.name }}</text>
          <view class="modal-close" @tap="closeReset">
            <AppIcon name="x" />
          </view>
        </view>
        <view class="modal-body">
          <view class="form-field">
            <text class="field-label">新密码 *（至少 8 位，需含大小写字母 + 数字）</text>
            <input
              class="field-input"
              v-model="newPwd"
              type="password"
              placeholder="如：Xing1234"
            />
          </view>
        </view>
        <view class="modal-footer">
          <view class="modal-btn modal-btn-cancel" @tap="closeReset">
            <text class="modal-btn-cancel-text">取消</text>
          </view>
          <view class="modal-btn modal-btn-primary" :class="{ 'modal-btn-disabled': resetting || !newPwd }" @tap="submitReset">
            <text class="modal-btn-primary-text">{{ resetting ? '重置中...' : '确认重置' }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 删除确认弹窗 -->
    <view v-if="deleteTarget" class="modal-mask" @tap="closeDelete">
      <view class="modal-card" @tap.stop>
        <view class="modal-header">
          <text class="modal-title">确认删除</text>
          <view class="modal-close" @tap="closeDelete">
            <AppIcon name="x" />
          </view>
        </view>
        <view class="modal-body">
          <text class="delete-msg">确定要删除{{ roleLabel }}「<text class="delete-name">{{ deleteTarget.name }}</text>」吗？</text>
          <text class="delete-hint">{{ isJobseeker ? '该求职者的所有匹配记录将一并清理。此操作不可撤销。' : '该企业发布的所有岗位及匹配记录将一并清理。此操作不可撤销。' }}</text>
        </view>
        <view class="modal-footer">
          <view class="modal-btn modal-btn-cancel" @tap="closeDelete">
            <text class="modal-btn-cancel-text">取消</text>
          </view>
          <view class="modal-btn modal-btn-danger" @tap="submitDelete">
            <text class="modal-btn-danger-text">确认删除</text>
          </view>
        </view>
      </view>
    </view>

    <!-- toast -->
    <view v-if="toast" class="toast-wrap">
      <text class="toast-text">{{ toast }}</text>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { request } from '@/utils/request'
import AppIcon from '@/components/common/AppIcon.vue'

const props = defineProps({
  role: { type: String, default: 'jobseeker' },
  onBack: { type: Function, default: () => {} }
})

const isJobseeker = computed(() => props.role === 'jobseeker')
const roleLabel = computed(() => isJobseeker.value ? '求职者' : '企业')
const API_BASE = computed(() => isJobseeker.value ? '/api/admin/jobseekers' : '/api/admin/enterprises')
const PAGE_SIZE = 10

const list = ref([])
const loading = ref(true)
const error = ref('')
const toast = ref('')

const page = ref(1)
const total = ref(0)
const keyword = ref('')
const searchInput = ref('')

const createOpen = ref(false)
const form = ref({ email: '', username: '', password: '', company_name: '' })
const saving = ref(false)

const resetTarget = ref(null)
const newPwd = ref('')
const resetting = ref(false)

const deleteTarget = ref(null)

const PWD_HINT = '至少 8 位，需含大小写字母 + 数字'

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)))

let toastTimer = null

function showToast(msg) {
  toast.value = msg
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value = '' }, 3000)
}

async function load(p, kw) {
  if (p === undefined) p = page.value
  if (kw === undefined) kw = keyword.value
  loading.value = true
  error.value = ''
  try {
    const params = `?page=${p}&size=${PAGE_SIZE}${kw ? '&keyword=' + encodeURIComponent(kw) : ''}`
    const d = await request({ url: `${API_BASE.value}${params}`, method: 'GET' })
    if (d.success) {
      list.value = d.data.list
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

function onSearchConfirm() {
  keyword.value = searchInput.value
  page.value = 1
  load(1, searchInput.value)
}

function clearSearch() {
  searchInput.value = ''
  keyword.value = ''
  page.value = 1
  load(1, '')
}

function goPage(p) {
  if (p < 1 || p > totalPages.value) return
  page.value = p
  load(p, keyword.value)
}

function openCreate() {
  form.value = { email: '', username: '', password: '', company_name: '' }
  createOpen.value = true
}

function closeCreate() {
  createOpen.value = false
}

async function submitCreate() {
  if (!form.value.email.trim() || !form.value.password) {
    showToast('邮箱和密码不能为空')
    return
  }
  saving.value = true
  try {
    const body = {
      email: form.value.email.trim(),
      username: form.value.username.trim(),
      password: form.value.password
    }
    if (!isJobseeker.value) body.company_name = form.value.company_name.trim()
    const d = await request({ url: API_BASE.value, method: 'POST', data: body })
    if (d.success) {
      createOpen.value = false
      form.value = { email: '', username: '', password: '', company_name: '' }
      showToast(d.message || '创建成功')
      await load(1, keyword.value)
    } else {
      showToast(d.error?.message || '创建失败')
    }
  } catch {
    showToast('网络错误')
  } finally {
    saving.value = false
  }
}

function openReset(item) {
  resetTarget.value = { id: item.id, name: isJobseeker.value ? (item.real_name || item.username || item.email) : (item.company_name || item.username || item.email) }
  newPwd.value = ''
}

function closeReset() {
  resetTarget.value = null
  newPwd.value = ''
}

async function submitReset() {
  if (!resetTarget.value) return
  resetting.value = true
  try {
    const d = await request({
      url: `${API_BASE.value}/${resetTarget.value.id}/reset-password`,
      method: 'POST',
      data: { password: newPwd.value }
    })
    if (d.success) {
      showToast(d.message || '密码已重置')
      resetTarget.value = null
      newPwd.value = ''
    } else {
      showToast(d.error?.message || '重置失败')
    }
  } catch {
    showToast('网络错误')
  } finally {
    resetting.value = false
  }
}

function openDelete(item) {
  deleteTarget.value = { id: item.id, name: isJobseeker.value ? (item.real_name || item.username || item.email) : (item.company_name || item.username || item.email) }
}

function closeDelete() {
  deleteTarget.value = null
}

async function submitDelete() {
  if (!deleteTarget.value) return
  try {
    const d = await request({
      url: `${API_BASE.value}/${deleteTarget.value.id}`,
      method: 'DELETE'
    })
    if (d.success) {
      showToast(d.message || '已删除')
      deleteTarget.value = null
      const remaining = total.value - 1
      const maxPage = Math.max(1, Math.ceil(remaining / PAGE_SIZE))
      const targetPage = Math.min(page.value, maxPage)
      if (targetPage !== page.value) {
        page.value = targetPage
        load(targetPage, keyword.value)
      } else {
        await load(page.value, keyword.value)
      }
    } else {
      showToast(d.error?.message || '删除失败')
    }
  } catch {
    showToast('网络错误')
  }
}

onMounted(() => {
  load(1, '')
})
</script>

<style scoped>
.user-manage {
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* 顶部工具栏 */
.manage-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 32rpx;
  border-bottom: 1px solid var(--color-outline-variant, #e1e2e4);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 14rpx;
}

.header-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56rpx;
  height: 56rpx;
  border-radius: 14rpx;
  background: var(--accent-green-dim, rgba(5, 150, 105, 0.08));
  color: var(--accent-green, #059669);
  font-size: 28rpx;
}

.header-title {
  font-size: 30rpx;
  font-weight: 700;
  color: var(--color-on-surface, #191c1e);
}

.header-badge {
  padding: 4rpx 16rpx;
  border-radius: 999rpx;
  background: var(--accent-green-dim, rgba(5, 150, 105, 0.08));
}

.header-badge-text {
  font-size: 21rpx;
  color: var(--accent-green, #059669);
}

.create-btn {
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 14rpx 28rpx;
  border-radius: 14rpx;
  background: var(--accent-green, #059669);
  color: #ffffff;
  font-size: 24rpx;
}

.create-btn:active {
  opacity: 0.85;
}

.create-btn-text {
  color: #ffffff;
  font-size: 24rpx;
  font-weight: 600;
}

/* 搜索栏 */
.search-bar {
  padding: 20rpx 32rpx;
  border-bottom: 1px solid var(--color-outline-variant, #e1e2e4);
}

.search-input-wrap {
  display: flex;
  align-items: center;
  gap: 8rpx;
  height: 76rpx;
  padding: 0 20rpx;
  border-radius: 12rpx;
  background: #FFFFFF;
  box-sizing: border-box;
}

.search-icon {
  color: #9ca3af;
  font-size: 16rpx;
  display: flex;
  align-items: center;
}

.search-input {
  flex: 1;
  height: 100%;
  font-size: 26rpx;
  color: #172033;
  background: transparent;
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

/* 列表主体 */
.list-body {
  flex: 1;
  min-height: 0;
}

.loading-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 120rpx 0;
}

.loading-spinner {
  width: 48rpx;
  height: 48rpx;
  border: 4rpx solid var(--color-outline-variant, #e1e2e4);
  border-top-color: var(--accent-green, #059669);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 80rpx 32rpx;
}

.error-text {
  font-size: 26rpx;
  color: var(--accent-red, #dc2626);
  text-align: center;
}

.empty-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 80rpx 32rpx;
}

.empty-text {
  font-size: 26rpx;
  color: var(--color-on-surface-variant, #434654);
}

.list-content {
  padding: 0 28rpx 32rpx;
}

/* 用户卡片 */
.user-card {
  margin-top: 20rpx;
  padding: 28rpx;
  border: 1px solid rgba(15, 23, 42, 0.045);
  border-radius: 22rpx;
  background: #ffffff;
  box-shadow: 0 8rpx 24rpx rgba(31, 41, 55, 0.045);
}

.card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20rpx;
  padding-bottom: 16rpx;
  border-bottom: 1px solid rgba(15, 23, 42, 0.045);
}

.card-id-wrap {
  padding: 4rpx 14rpx;
  border-radius: 8rpx;
  background: var(--accent-green-dim, rgba(5, 150, 105, 0.08));
}

.card-id {
  font-size: 22rpx;
  font-weight: 600;
  color: var(--accent-green, #059669);
}

.card-time {
  font-size: 21rpx;
  color: var(--color-on-surface-variant, #434654);
}

.card-main {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
  margin-bottom: 20rpx;
}

.card-row {
  display: flex;
  align-items: center;
}

.card-label {
  width: 140rpx;
  flex-shrink: 0;
  font-size: 23rpx;
  color: var(--color-on-surface-variant, #434654);
}

.card-value {
  flex: 1;
  font-size: 24rpx;
  color: var(--color-on-surface, #191c1e);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status-verified {
  color: #009958;
  font-weight: 600;
}

.status-unverified {
  color: #777777;
}

/* 操作按钮 */
.card-actions {
  display: flex;
  justify-content: flex-end;
  gap: 16rpx;
  padding-top: 16rpx;
  border-top: 1px solid rgba(15, 23, 42, 0.045);
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 12rpx 20rpx;
  border-radius: 12rpx;
  font-size: 23rpx;
}

.action-btn:active {
  opacity: 0.8;
}

.action-reset {
  color: var(--accent-green, #059669);
  background: var(--accent-green-dim, rgba(5, 150, 105, 0.08));
}

.action-delete {
  color: var(--accent-red, #dc2626);
  background: rgba(220, 38, 38, 0.08);
}

.action-btn-text {
  font-size: 23rpx;
}

/* 分页 */
.pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 4rpx 12rpx;
}

.page-info {
  font-size: 22rpx;
  color: var(--color-on-surface-variant, #434654);
}

.page-btns {
  display: flex;
  gap: 12rpx;
}

.page-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64rpx;
  height: 64rpx;
  border: 1px solid var(--color-outline-variant, #e1e2e4);
  border-radius: 14rpx;
  background: var(--color-surface, #f8f9fb);
  color: var(--color-on-surface-variant, #434654);
}

.page-btn:active {
  background: var(--color-surface-container, #e5eeff);
}

.page-btn-disabled {
  opacity: 0.4;
  pointer-events: none;
}

/* 弹窗 */
.modal-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32rpx;
  background: rgba(0, 0, 0, 0.4);
}

.modal-card {
  width: 100%;
  max-width: 640rpx;
  padding: 40rpx;
  border-radius: 28rpx;
  background: var(--color-surface-container-lowest, #ffffff);
  box-shadow: 0 24rpx 64rpx rgba(0, 0, 0, 0.15);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 32rpx;
}

.modal-title {
  font-size: 30rpx;
  font-weight: 700;
  color: var(--color-on-surface, #191c1e);
}

.modal-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48rpx;
  height: 48rpx;
  border-radius: 12rpx;
  color: var(--color-on-surface-variant, #434654);
}

.modal-close:active {
  background: var(--color-surface-container, #e5eeff);
}

.modal-body {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.field-label {
  font-size: 22rpx;
  font-weight: 500;
  color: var(--color-on-surface-variant, #434654);
}

.field-input {
  width: 100%;
  height: 80rpx;
  padding: 0 24rpx;
  border: 1px solid var(--color-outline-variant, #e1e2e4);
  border-radius: 14rpx;
  background: var(--color-surface, #f8f9fb);
  color: var(--color-on-surface, #191c1e);
  font-size: 26rpx;
  box-sizing: border-box;
}

.field-input:focus {
  border-color: var(--accent-green, #059669);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 16rpx;
  margin-top: 36rpx;
}

.modal-btn {
  padding: 16rpx 32rpx;
  border-radius: 14rpx;
  font-size: 25rpx;
}

.modal-btn:active {
  opacity: 0.85;
}

.modal-btn-cancel {
  border: 1px solid var(--color-outline-variant, #e1e2e4);
}

.modal-btn-cancel-text {
  color: var(--color-on-surface-variant, #434654);
  font-size: 25rpx;
}

.modal-btn-primary {
  background: var(--accent-green, #059669);
}

.modal-btn-primary-text {
  color: #ffffff;
  font-size: 25rpx;
  font-weight: 600;
}

.modal-btn-danger {
  background: var(--accent-red, #dc2626);
}

.modal-btn-danger-text {
  color: #ffffff;
  font-size: 25rpx;
  font-weight: 600;
}

.modal-btn-disabled {
  opacity: 0.55;
  pointer-events: none;
}

.delete-msg {
  font-size: 26rpx;
  color: var(--color-on-surface, #191c1e);
  line-height: 1.6;
}

.delete-name {
  color: var(--accent-red, #dc2626);
  font-weight: 600;
}

.delete-hint {
  display: block;
  margin-top: 12rpx;
  font-size: 22rpx;
  color: var(--color-on-surface-variant, #434654);
  line-height: 1.5;
}

/* toast */
.toast-wrap {
  position: fixed;
  top: 160rpx;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  padding: 16rpx 36rpx;
  border-radius: 14rpx;
  background: var(--color-surface-container-high, #dbe9ff);
  box-shadow: 0 12rpx 36rpx rgba(0, 0, 0, 0.1);
}

.toast-text {
  font-size: 25rpx;
  color: var(--color-on-surface, #191c1e);
}
</style>
