<template>
  <view v-if="show" class="ets-modal-mask" @tap.self="$emit('close')">
    <view class="ets-modal-box ets-modal-chat">
      <!-- 头部 -->
      <view class="ets-chat-header">
        <view class="ets-chat-header-left">
          <view class="ets-chat-avatar">
            <text class="ets-chat-avatar-text">{{ candidate.name ? candidate.name[0] : '?' }}</text>
          </view>
          <view>
            <text class="ets-chat-name">{{ candidate.name }}</text>
            <text class="ets-chat-meta">{{ candidate.job_title || '未指定岗位' }} · 匹配度 {{ candidate.match != null ? candidate.match : '—' }}%</text>
          </view>
        </view>
        <view class="ets-modal-close" @tap="$emit('close')">
          <AppIcon name="x" />
        </view>
      </view>

      <!-- 消息列表 -->
      <scroll-view
        ref="scrollRef"
        class="ets-chat-messages"
        scroll-y
        :show-scrollbar="false"
        :scroll-into-view="scrollToId"
        :scroll-with-animation="true"
      >
        <view v-if="loading" class="ets-chat-loading">
          <AppIcon name="loader" />
          <text class="ets-chat-loading-text">加载消息</text>
        </view>
        <view v-else-if="messages.length === 0" class="ets-chat-empty">
          <text class="ets-chat-empty-text">暂无消息</text>
          <text class="ets-chat-empty-sub">发送第一条消息开始沟通</text>
        </view>
        <template v-else>
          <view
            v-for="msg in messages"
            :key="msg.id"
            :id="'msg-' + msg.id"
            class="ets-msg-row"
            :class="{ 'ets-msg-mine': msg.sender_type === 'enterprise' }"
          >
            <view
              class="ets-msg-bubble"
              :class="{ 'ets-msg-bubble-mine': msg.sender_type === 'enterprise' }"
            >
              <text class="ets-msg-content">{{ msg.content }}</text>
              <text class="ets-msg-time">{{ formatTime(msg.created_at) }}</text>
            </view>
          </view>
        </template>
      </scroll-view>

      <!-- 输入框 -->
      <view class="ets-chat-input-bar">
        <input
          class="ets-chat-input"
          :value="input"
          @input="onInput"
          @confirm="handleSend"
          placeholder="输入消息，按发送"
          :disabled="sending"
          confirm-type="send"
        />
        <view
          class="ets-chat-send-btn"
          :class="{ 'ets-chat-send-disabled': !input.trim() || sending }"
          @tap="handleSend"
        >
          <AppIcon name="send" />
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'
import { request } from '../../utils/request'
import AppIcon from '../common/AppIcon.vue'

const props = defineProps({
  show: { type: Boolean, default: false },
  matchRecordId: { type: Number, default: 0 },
  candidate: { type: Object, default: () => ({}) },
})

defineEmits(['close'])

const messages = ref([])
const input = ref('')
const loading = ref(false)
const sending = ref(false)
const scrollRef = ref(null)
const scrollToId = ref('')

function formatTime(t) {
  if (!t) return ''
  return t.slice(11, 16)
}

async function loadMessages() {
  if (!props.matchRecordId) return
  loading.value = true
  try {
    const d = await request({ url: '/api/enterprise/messages/' + props.matchRecordId + '?size=100' })
    if (d.success && d.data) {
      messages.value = d.data.messages || []
      await nextTick()
      scrollToBottom()
    }
  } catch {
    // 忽略加载错误
  } finally {
    loading.value = false
  }
}

async function markRead() {
  if (!props.matchRecordId) return
  try {
    await request({
      url: '/api/enterprise/messages/read?match_record_id=' + props.matchRecordId,
      method: 'POST',
    })
  } catch {
    // 忽略
  }
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
      data: { match_record_id: props.matchRecordId, content: text },
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
    }
  } catch {
    // 忽略发送错误
  } finally {
    sending.value = false
  }
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

watch(() => props.show, (val) => {
  if (val) {
    loadMessages()
    markRead()
    input.value = ''
  }
})
</script>

<style>
.ets-modal-chat {
  max-width: 600rpx;
  height: 800rpx;
}

.ets-chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 24rpx;
  border-bottom: 1rpx solid var(--color-outline-variant);
  flex-shrink: 0;
}

.ets-chat-header-left {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.ets-chat-avatar {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-primary-fixed);
}

.ets-chat-avatar-text {
  font-size: 26rpx;
  font-weight: 600;
  color: var(--color-primary);
}

.ets-chat-name {
  font-size: 28rpx;
  font-weight: 500;
  color: var(--color-on-surface);
  display: block;
}

.ets-chat-meta {
  font-size: 20rpx;
  color: var(--color-on-surface-variant);
  display: block;
  margin-top: 2rpx;
}

.ets-chat-messages {
  flex: 1;
  padding: 20rpx 24rpx;
}

.ets-chat-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  padding: 120rpx 0;
  color: var(--color-on-surface-variant);
}

.ets-chat-loading .app-icon {
  width: 36rpx;
  height: 36rpx;
}

.ets-chat-loading-text {
  font-size: 26rpx;
}

.ets-chat-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 120rpx 0;
  gap: 8rpx;
}

.ets-chat-empty-text {
  font-size: 26rpx;
  color: var(--color-on-surface-variant);
}

.ets-chat-empty-sub {
  font-size: 22rpx;
  color: var(--color-on-surface-variant);
  opacity: 0.6;
}

.ets-msg-row {
  display: flex;
  justify-content: flex-start;
  margin-bottom: 16rpx;
}

.ets-msg-mine {
  justify-content: flex-end;
}

.ets-msg-bubble {
  max-width: 75%;
  padding: 16rpx 20rpx;
  border-radius: 24rpx;
  background: var(--color-surface-container-high);
}

.ets-msg-bubble-mine {
  background: var(--color-primary);
}

.ets-msg-content {
  font-size: 26rpx;
  color: var(--color-on-surface);
  line-height: 1.5;
  word-break: break-all;
}

.ets-msg-bubble-mine .ets-msg-content {
  color: #fff;
}

.ets-msg-time {
  font-size: 18rpx;
  color: var(--color-on-surface-variant);
  opacity: 0.6;
  margin-top: 6rpx;
  display: block;
  text-align: right;
}

.ets-msg-bubble-mine .ets-msg-time {
  color: rgba(255, 255, 255, 0.6);
}

/* 输入框 */
.ets-chat-input-bar {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 16rpx 24rpx;
  border-top: 1rpx solid var(--color-outline-variant);
  flex-shrink: 0;
}

.ets-chat-input {
  flex: 1;
  height: 72rpx;
  padding: 0 20rpx;
  border: 1rpx solid var(--color-outline-variant);
  border-radius: 14rpx;
  background: var(--color-surface);
  color: var(--color-on-surface);
  font-size: 26rpx;
}

.ets-chat-send-btn {
  width: 72rpx;
  height: 72rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 14rpx;
  background: var(--color-primary);
}

.ets-chat-send-btn:active {
  opacity: 0.8;
}

.ets-chat-send-btn .app-icon {
  width: 28rpx;
  height: 28rpx;
  color: #fff;
}

.ets-chat-send-disabled {
  opacity: 0.5;
}
</style>
