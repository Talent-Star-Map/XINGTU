<template>
  <view class="conv-page">
    <!-- 顶部标题 -->
    <view class="conv-header">
      <text class="conv-title">消息</text>
      <text v-if="unreadTotal > 0" class="conv-unread">{{ unreadTotal }} 条未读</text>
    </view>

    <!-- 错误提示 -->
    <view v-if="error" class="conv-error">
      <text>{{ error }}</text>
    </view>

    <!-- 对话列表 -->
    <view class="conv-list-wrap">
      <!-- 加载中 -->
      <view v-if="loading" class="conv-status">
        <AppIcon name="loader" />
        <text class="conv-status-text">加载中</text>
      </view>

      <!-- 空状态 -->
      <view v-else-if="conversations.length === 0" class="conv-empty">
        <AppIcon name="chat" />
        <text class="conv-empty-title">暂无对话</text>
        <text class="conv-empty-desc">在"人才星"中发起沟通后，对话将出现在这里</text>
      </view>

      <!-- 对话列表 -->
      <view v-else class="conv-list">
        <view
          v-for="conv in conversations"
          :key="conv.match_record_id"
          class="conv-item"
          @tap="openChat(conv)"
        >
          <!-- 头像 -->
          <view class="conv-avatar-wrap">
            <view class="conv-avatar">
              <text class="conv-avatar-text">{{ conv.candidate_av }}</text>
            </view>
            <view v-if="conv.unread_count > 0" class="conv-badge">
              <text class="conv-badge-text">{{ conv.unread_count > 99 ? '99+' : conv.unread_count }}</text>
            </view>
          </view>

          <!-- 内容 -->
          <view class="conv-content">
            <view class="conv-top-row">
              <view class="conv-name-row">
                <text class="conv-name">{{ conv.candidate_name }}</text>
                <text v-if="conv.job_title" class="conv-job">{{ conv.job_title }}</text>
              </view>
              <text class="conv-time">{{ formatTime(conv.last_time) }}</text>
            </view>
            <view class="conv-bottom-row">
              <text class="conv-last">{{ conv.last_message || (conv.status === 'pending' ? '暂无消息，点击发起沟通' : '暂无消息') }}</text>
              <view class="conv-status-wrap">
                <text class="conv-status-label">{{ STATUS_LABEL[conv.status] || conv.status }}</text>
                <AppIcon name="chevron-right" />
              </view>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- 聊天弹窗已迁移为独立页面 -->
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { request } from '../../utils/request'
import AppIcon from '../common/AppIcon.vue'

const emit = defineEmits(['unread-change'])

const STATUS_LABEL = {
  pending: '待沟通',
  communicating: '沟通中',
  accepted: '已接受',
  rejected: '已拒绝',
}

const conversations = ref([])
const loading = ref(true)
const error = ref('')
const unreadTotal = ref(0)

async function load() {
  loading.value = true
  error.value = ''
  try {
    const d = await request({ url: '/api/enterprise/conversations?size=100' })
    if (d.success && d.data) {
      conversations.value = d.data.conversations || []
      unreadTotal.value = d.data.unread_total || 0
      emit('unread-change', unreadTotal.value)
    } else {
      error.value = d.error?.message || '加载失败'
    }
  } catch {
    error.value = '网络错误，请稍后重试'
  }
  loading.value = false
}

function openChat(conv) {
  uni.navigateTo({
    url:
      '/pages/enterprise/chat' +
      '?match_record_id=' + encodeURIComponent(conv.match_record_id) +
      '&candidate_name=' + encodeURIComponent(conv.candidate_name || '') +
      '&job_title=' + encodeURIComponent(conv.job_title || '')
  })
}

function formatTime(timeStr) {
  if (!timeStr) return ''
  const today = new Date()
  const d = new Date(timeStr.replace(' ', 'T'))
  if (isNaN(d.getTime())) return timeStr.slice(5, 11)

  const isToday = d.toDateString() === today.toDateString()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const isYesterday = d.toDateString() === yesterday.toDateString()

  if (isToday) return timeStr.slice(11, 16)
  if (isYesterday) return '昨天'
  return timeStr.slice(5, 10)
}

onMounted(() => { load() })
</script>

<style>
.conv-page {
  display: flex;
  flex-direction: column;
  min-height: 100%;
}

.conv-header {
  display: flex;
  align-items: baseline;
  gap: 16rpx;
  padding: 28rpx 32rpx 20rpx;
  border-bottom: 1rpx solid var(--color-outline-variant);
  flex-shrink: 0;
}

.conv-title {
  color: var(--color-on-surface);
  font-size: 36rpx;
  font-weight: 700;
}

.conv-unread {
  color: var(--accent-red, #DC2626);
  font-size: 24rpx;
}

.conv-error {
  margin: 20rpx 32rpx 0;
  padding: 20rpx 28rpx;
  border: 1rpx solid var(--accent-red, #DC2626);
  border-radius: 12rpx;
  background: rgba(220, 38, 38, 0.06);
  color: var(--accent-red, #DC2626);
  font-size: 26rpx;
}

.conv-list-wrap {
  flex: 1;
}

.conv-status {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  padding: 200rpx 0;
  color: var(--color-on-surface-variant);
}

.conv-status .app-icon {
  width: 36rpx;
  height: 36rpx;
}

.conv-status-text {
  font-size: 28rpx;
}

.conv-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 200rpx 0;
  gap: 12rpx;
}

.conv-empty .app-icon {
  width: 80rpx;
  height: 80rpx;
  color: var(--color-on-surface-variant);
  opacity: 0.3;
}

.conv-empty-title {
  color: var(--color-on-surface-variant);
  font-size: 28rpx;
}

.conv-empty-desc {
  color: var(--color-on-surface-variant);
  font-size: 24rpx;
  opacity: 0.6;
}

.conv-list {
  border: 1rpx solid var(--color-outline-variant);
  border-radius: 16rpx;
  margin: 20rpx 32rpx;
  overflow: hidden;
}

.conv-item {
  display: flex;
  align-items: center;
  gap: 24rpx;
  padding: 28rpx 24rpx;
  border-bottom: 1rpx solid var(--color-outline-variant);
}

.conv-item:last-child {
  border-bottom: none;
}

.conv-item:active {
  background: var(--color-surface-container-low, #EEF4FF);
}

.conv-avatar-wrap {
  position: relative;
  flex: none;
}

.conv-avatar {
  display: flex;
  width: 88rpx;
  height: 88rpx;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--color-primary-fixed, #DBE1FF);
}

.conv-avatar-text {
  color: var(--color-primary, #0052D9);
  font-size: 32rpx;
  font-weight: 700;
}

.conv-badge {
  position: absolute;
  top: -8rpx;
  right: -8rpx;
  display: flex;
  min-width: 32rpx;
  height: 32rpx;
  padding: 0 10rpx;
  align-items: center;
  justify-content: center;
  border-radius: 16rpx;
  background: var(--accent-red, #DC2626);
}

.conv-badge-text {
  color: #fff;
  font-size: 20rpx;
  font-weight: 700;
}

.conv-content {
  flex: 1;
  min-width: 0;
}

.conv-top-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10rpx;
}

.conv-name-row {
  display: flex;
  align-items: center;
  gap: 14rpx;
  min-width: 0;
}

.conv-name {
  color: var(--color-on-surface);
  font-size: 28rpx;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.conv-job {
  flex: none;
  padding: 2rpx 14rpx;
  border-radius: 6rpx;
  background: var(--color-primary-fixed, #DBE1FF);
  color: var(--color-primary, #0052D9);
  font-size: 20rpx;
}

.conv-time {
  flex: none;
  margin-left: 16rpx;
  color: var(--color-on-surface-variant);
  font-size: 22rpx;
}

.conv-bottom-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.conv-last {
  flex: 1;
  min-width: 0;
  color: var(--color-on-surface-variant);
  font-size: 24rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.conv-status-wrap {
  flex: none;
  display: flex;
  align-items: center;
  gap: 4rpx;
  margin-left: 16rpx;
}

.conv-status-wrap .app-icon {
  width: 24rpx;
  height: 24rpx;
  color: var(--color-on-surface-variant);
}

.conv-status-label {
  color: var(--color-on-surface-variant);
  font-size: 22rpx;
  opacity: 0.7;
}
</style>
