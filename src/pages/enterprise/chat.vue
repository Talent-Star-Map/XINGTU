<template>
  <view class="chat-page" :class="themeClass">
    <!-- 顶部导航 -->
    <view class="chat-header">
      <view class="chat-header-left" @tap="goBack">
        <AppIcon name="chevron-left" />
      </view>
      <view class="chat-header-info">
        <text class="chat-header-name">{{ candidateName }}</text>
        <text v-if="jobTitle" class="chat-header-meta">{{ jobTitle }}<text v-if="matchScore"> · 匹配度 {{ matchScore }}%</text></text>
      </view>
      <view class="chat-header-right"></view>
    </view>

    <!-- 消息区域 -->
    <scroll-view
      class="chat-messages"
      scroll-y
      :show-scrollbar="false"
      :scroll-into-view="scrollToId"
      :scroll-with-animation="true"
    >
      <!-- 加载中 -->
      <view v-if="loading" class="chat-status">
        <AppIcon name="loader" />
        <text class="chat-status-text">加载消息中...</text>
      </view>

      <!-- 加载失败 -->
      <view v-else-if="loadError" class="chat-error">
        <text class="chat-error-text">{{ loadError }}</text>
        <view class="chat-retry-btn" @tap="loadMessages">
          <text class="chat-retry-text">重新加载</text>
        </view>
      </view>

      <!-- 空消息 -->
      <view v-else-if="messages.length === 0" class="chat-empty">
        <text class="chat-empty-title">暂无聊天记录</text>
        <text class="chat-empty-desc">可以在这里向候选人发起沟通</text>
      </view>

      <!-- 消息列表 -->
      <template v-else>
        <view
          v-for="msg in messages"
          :key="msg.id"
          :id="'msg-' + msg.id"
          class="msg-row"
          :class="{ 'msg-mine': msg.sender_type === 'enterprise' }"
        >
          <view
            class="msg-bubble"
            :class="{ 'msg-bubble-mine': msg.sender_type === 'enterprise' }"
          >
            <text class="msg-content">{{ msg.content }}</text>
            <text class="msg-time">{{ formatMsgTime(msg.created_at) }}</text>
          </view>
        </view>
      </template>
    </scroll-view>

    <!-- 输入框 -->
    <view class="chat-input-bar">
      <input
        class="chat-input"
        :value="input"
        @input="onInput"
        @confirm="handleSend"
        placeholder="输入消息..."
        :disabled="sending"
        confirm-type="send"
      />
      <view
        class="chat-send-btn"
        :class="{ 'chat-send-disabled': !input.trim() || sending }"
        @tap="handleSend"
      >
        <text class="chat-send-text">{{ sending ? '发送中' : '发送' }}</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { request } from '../../utils/request'
import AppIcon from '../../components/common/AppIcon.vue'
import '../../styles/theme.css'
import { useTheme } from '../../composables/useTheme'

const matchRecordId = ref(0)
const candidateName = ref('')
const jobTitle = ref('')
const matchScore = ref('')
const messages = ref([])
const input = ref('')
const loading = ref(true)
const loadError = ref('')
const sending = ref(false)
const scrollToId = ref('')

const { theme, themeClass } = useTheme()

function goBack() {
  uni.navigateBack()
}

function formatMsgTime(t) {
  if (!t) return ''
  return t.slice(11, 16)
}

async function loadMessages() {
  if (!matchRecordId.value) return
  loading.value = true
  loadError.value = ''
  try {
    const d = await request({ url: '/api/enterprise/messages/' + matchRecordId.value + '?size=100' })
    if (d.success && d.data) {
      messages.value = d.data.messages || []
      await nextTick()
      scrollToBottom()
    } else {
      loadError.value = d.error?.message || '加载失败'
    }
  } catch {
    loadError.value = '网络错误，请稍后重试'
  }
  loading.value = false
}

async function markRead() {
  if (!matchRecordId.value) return
  try {
    await request({
      url: '/api/enterprise/messages/read?match_record_id=' + matchRecordId.value,
      method: 'POST',
    })
  } catch {}
}

async function handleSend() {
  const text = input.value.trim()
  if (!text || sending.value) return

  sending.value = true
  input.value = ''
  try {
    const d = await request({
      url: '/api/enterprise/messages',
      method: 'POST',
      data: { match_record_id: matchRecordId.value, content: text },
    })
    if (d.success) {
      messages.value.push({
        id: d.data.id,
        sender_type: 'enterprise',
        sender_id: 0,
        content: text,
        is_read: 0,
        created_at: d.data.created_at || new Date().toLocaleString(),
      })
      await nextTick()
      scrollToBottom()
    } else {
      uni.showToast({ title: '发送失败', icon: 'none' })
      input.value = text
    }
  } catch {
    uni.showToast({ title: '发送失败', icon: 'none' })
    input.value = text
  }
  sending.value = false
}

function onInput(e) {
  input.value = e.detail.value
}

function scrollToBottom() {
  if (messages.value.length > 0) {
    const last = messages.value[messages.value.length - 1]
    scrollToId.value = 'msg-' + last.id
  }
}

onLoad((options) => {
  matchRecordId.value = Number(options.match_record_id) || 0
  candidateName.value = decodeURIComponent(options.candidate_name || '')
  jobTitle.value = decodeURIComponent(options.job_title || '')
  matchScore.value = decodeURIComponent(options.match || '')
  loadMessages()
  markRead()
})
</script>

<style>
.chat-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  min-height: 100vh;
  background: var(--color-background, #F8F9FF);
  color: var(--color-on-surface);
  font-family: Inter, "PingFang SC", "Microsoft YaHei", sans-serif;
}

.chat-header {
  display: flex;
  align-items: center;
  height: 88rpx;
  padding: 0 24rpx;
  border-bottom: 1rpx solid var(--color-outline-variant, #E1E2E4);
  background: var(--color-surface, #F8F9FB);
  flex-shrink: 0;
}

.chat-header-left {
  display: flex;
  width: 60rpx;
  height: 60rpx;
  align-items: center;
  justify-content: center;
}

.chat-header-left .app-icon {
  width: 36rpx;
  height: 36rpx;
  color: var(--color-on-surface);
}

.chat-header-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2rpx;
}

.chat-header-name {
  font-size: 30rpx;
  font-weight: 600;
  color: var(--color-on-surface);
}

.chat-header-meta {
  font-size: 20rpx;
  color: var(--color-on-surface-variant, #434654);
}

.chat-header-right {
  width: 60rpx;
}

.chat-messages {
  flex: 1;
  padding: 24rpx;
}

.chat-status {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  padding: 200rpx 0;
  color: var(--color-on-surface-variant, #434654);
}

.chat-status .app-icon {
  width: 36rpx;
  height: 36rpx;
}

.chat-status-text {
  font-size: 26rpx;
}

.chat-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 200rpx 0;
  gap: 20rpx;
}

.chat-error-text {
  color: var(--accent-red, #DC2626);
  font-size: 26rpx;
}

.chat-retry-btn {
  padding: 14rpx 36rpx;
  border: 1rpx solid var(--color-primary, #0052D9);
  border-radius: 12rpx;
}

.chat-retry-text {
  color: var(--color-primary, #0052D9);
  font-size: 26rpx;
}

.chat-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 200rpx 0;
  gap: 12rpx;
}

.chat-empty-title {
  color: var(--color-on-surface-variant, #434654);
  font-size: 28rpx;
}

.chat-empty-desc {
  color: var(--color-on-surface-variant, #434654);
  font-size: 24rpx;
  opacity: 0.6;
}

.msg-row {
  display: flex;
  justify-content: flex-start;
  margin-bottom: 20rpx;
  padding-left: 45rpx;
}

.msg-mine {
  justify-content: flex-end;
  padding-left: 0;
  padding-right: 45rpx;
}

.msg-bubble {
  max-width: 75%;
  padding: 18rpx 24rpx;
  border-radius: 24rpx 24rpx 24rpx 6rpx;
  background: var(--color-surface-container-high, #DBE9FF);
}

.msg-bubble-mine {
  border-radius: 24rpx 24rpx 6rpx 24rpx;
  background: var(--color-primary, #0052D9);
}

.msg-content {
  font-size: 28rpx;
  color: var(--color-on-surface);
  line-height: 1.5;
  word-break: break-all;
}

.msg-bubble-mine .msg-content {
  color: #fff;
}

.msg-time {
  font-size: 20rpx;
  color: var(--color-on-surface-variant, #434654);
  opacity: 0.6;
  margin-top: 8rpx;
  display: block;
  text-align: right;
}

.msg-bubble-mine .msg-time {
  color: rgba(255, 255, 255, 0.6);
}

.chat-input-bar {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 16rpx 24rpx;
  padding-bottom: calc(16rpx + env(safe-area-inset-bottom));
  border-top: 1rpx solid var(--color-outline-variant, #E1E2E4);
  background: var(--color-surface, #F8F9FB);
  flex-shrink: 0;
}

.chat-input {
  flex: 1;
  height: 72rpx;
  padding: 0 24rpx;
  border: 1rpx solid var(--color-outline-variant, #E1E2E4);
  border-radius: 14rpx;
  background: var(--color-surface-container-lowest, #FFFFFF);
  color: var(--color-on-surface);
  font-size: 26rpx;
}

.chat-send-btn {
  display: flex;
  height: 72rpx;
  padding: 0 28rpx;
  align-items: center;
  justify-content: center;
  border-radius: 14rpx;
  background: var(--color-primary, #0052D9);
  flex-shrink: 0;
}

.chat-send-btn:active {
  opacity: 0.8;
}

.chat-send-text {
  color: #fff;
  font-size: 26rpx;
  font-weight: 600;
}

.chat-send-disabled {
  opacity: 0.5;
}
</style>
