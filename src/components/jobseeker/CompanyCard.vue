<template>
  <view v-if="visible" class="card-mask" @tap="$emit('close')">
    <view class="card-panel" @tap.stop>
      <!-- loading -->
      <view v-if="loading" class="card-loading">
        <AppIcon name="loader" class="loading-spinner" />
      </view>

      <!-- 内容 -->
      <template v-else>
        <!-- 头部 -->
        <view class="card-header">
          <view class="header-top">
            <view class="logo-area" :style="{ borderColor: (companyData.verified || 0) >= 1 ? 'var(--color-primary)' : 'var(--color-outline-variant)' }">
              <image
                v-if="companyData.company_logo"
                :src="companyData.company_logo.startsWith('http') ? companyData.company_logo : 'http://localhost:8083' + companyData.company_logo"
                class="logo-image"
                mode="aspectFill"
              />
              <AppIcon v-else name="building" class="logo-placeholder" />
            </view>
            <view class="header-info">
              <view class="name-row">
                <text class="company-name">{{ companyData.company_name || companyName }}</text>
                <view class="verify-badge" :style="{ background: verifyInfo.bg, color: verifyInfo.color, borderColor: verifyInfo.color }">
                  <AppIcon :name="verifyInfo.iconName" class="verify-icon" />
                  <text>{{ verifyInfo.label }}</text>
                </view>
              </view>
              <view class="tag-row">
                <text v-if="companyData.industry" class="tag tag-purple">{{ companyData.industry }}</text>
                <text v-if="companyData.company_size" class="tag tag-primary">{{ companyData.company_size }}</text>
                <view v-if="companyData.city" class="tag tag-default">
                  <AppIcon name="map-pin" class="tag-icon" />
                  <text>{{ companyData.city }}</text>
                </view>
              </view>
            </view>
          </view>
          <view class="close-btn" @tap="$emit('close')">
            <AppIcon name="x" />
          </view>
        </view>

        <!-- 内容区 -->
        <view class="card-body">
          <view v-if="companyData.company_desc" class="section">
            <text class="section-title">公司简介</text>
            <text class="section-text">{{ companyData.company_desc }}</text>
          </view>

          <view v-if="companyData.company_benefits && companyData.company_benefits.trim()" class="section">
            <text class="section-title">公司福利</text>
            <view class="benefit-list">
              <text
                v-for="b in parseBenefits(companyData.company_benefits)"
                :key="b"
                class="benefit-tag"
              >{{ b }}</text>
            </view>
          </view>

          <view class="info-grid">
            <view v-if="companyData.company_website" class="info-item">
              <AppIcon name="globe" class="info-icon" />
              <text class="info-link" @tap="openLink(companyData.company_website)">公司官网</text>
            </view>
            <view v-if="companyData.city" class="info-item">
              <AppIcon name="map-pin" class="info-icon" />
              <text class="info-value">{{ companyData.city }}</text>
            </view>
            <view class="info-item">
              <AppIcon name="tag" class="info-icon" />
              <text class="info-value" :class="{ placeholder: !companyData.industry }">{{ companyData.industry || '未填写' }}</text>
            </view>
            <view class="info-item">
              <AppIcon name="users" class="info-icon" />
              <text class="info-value" :class="{ placeholder: !companyData.company_size }">{{ companyData.company_size || '未填写' }}</text>
            </view>
          </view>
        </view>
      </template>
    </view>
  </view>
</template>

<script setup>
import { ref, watch } from 'vue'
import AppIcon from '../common/AppIcon.vue'
import { request } from '../../utils/request'

const props = defineProps({
  visible: { type: Boolean, default: false },
  companyName: { type: String, default: '' },
})

const emit = defineEmits(['close'])

const loading = ref(true)
const companyData = ref({})

const VERIFY_MAP = {
  0: { iconName: 'shield-off', label: '未认证', color: 'var(--color-on-surface-variant)', bg: 'var(--color-neutral-dim)' },
  1: { iconName: 'shield-check', label: '官网已验证', color: 'var(--color-primary)', bg: 'var(--color-primary-fixed)' },
  2: { iconName: 'award', label: '三方认证', color: 'var(--accent-green)', bg: 'var(--accent-green-dim)' },
}

const verifyInfo = ref(VERIFY_MAP[0])

function parseBenefits(str) {
  return str.split(/[,，、]/).filter(Boolean).map(s => s.trim())
}

function openLink(url) {
  plus.runtime.openURL(url)
}

async function fetchData() {
  if (!props.companyName) return
  loading.value = true
  try {
    const data = await request({
      url: `/api/company/public/${encodeURIComponent(props.companyName)}`,
      auth: false,
    })
    if (data.success) {
      companyData.value = data.data
      verifyInfo.value = VERIFY_MAP[data.data.verified] || VERIFY_MAP[0]
    }
  } catch {
    // ignore
  } finally {
    loading.value = false
  }
}

watch(() => props.visible, (val) => {
  if (val && props.companyName) {
    fetchData()
  }
})
</script>

<style>
.card-mask {
  position: fixed;
  z-index: 100;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 32rpx;
  background: var(--color-scrim);
}

.card-panel {
  position: relative;
  width: 100%;
  max-width: 680rpx;
  max-height: 85vh;
  overflow-y: auto;
  border: 1rpx solid var(--color-outline-variant);
  border-radius: 24rpx;
  background: var(--color-surface-container-lowest);
}

.card-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 80rpx;
}

.loading-spinner {
  width: 64rpx;
  height: 64rpx;
  color: var(--accent-purple);
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.card-header {
  position: relative;
  padding: 48rpx 48rpx 36rpx;
  border-bottom: 1rpx solid var(--color-outline-variant);
}

.header-top {
  display: flex;
  gap: 28rpx;
  align-items: flex-start;
}

.logo-area {
  flex: none;
  display: flex;
  width: 120rpx;
  height: 120rpx;
  align-items: center;
  justify-content: center;
  border: 1rpx solid var(--color-outline-variant);
  border-radius: 20rpx;
  overflow: hidden;
  background: var(--color-surface);
}

.logo-image {
  width: 100%;
  height: 100%;
}

.logo-placeholder {
  width: 48rpx;
  height: 48rpx;
  color: var(--color-on-surface-variant);
}

.header-info {
  flex: 1;
  min-width: 0;
}

.name-row {
  display: flex;
  align-items: center;
  gap: 14rpx;
  flex-wrap: wrap;
}

.company-name {
  font-size: 30rpx;
  font-weight: 700;
  color: var(--color-on-surface);
}

.verify-badge {
  display: flex;
  align-items: center;
  gap: 6rpx;
  padding: 6rpx 16rpx;
  border: 1rpx solid;
  border-radius: 999rpx;
  font-size: 18rpx;
  font-weight: 600;
}

.verify-icon {
  width: 20rpx;
  height: 20rpx;
}

.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
  margin-top: 16rpx;
}

.tag {
  display: flex;
  align-items: center;
  gap: 6rpx;
  padding: 6rpx 16rpx;
  border-radius: 999rpx;
  font-size: 20rpx;
  font-weight: 500;
}

.tag-purple {
  background: var(--accent-purple-dim);
  color: var(--accent-purple);
}

.tag-primary {
  background: var(--color-primary-fixed);
  color: var(--color-primary);
}

.tag-default {
  background: var(--color-surface-container);
  color: var(--color-on-surface-variant);
}

.tag-icon {
  width: 20rpx;
  height: 20rpx;
}

.close-btn {
  position: absolute;
  top: 32rpx;
  right: 32rpx;
  display: flex;
  width: 56rpx;
  height: 56rpx;
  align-items: center;
  justify-content: center;
  border-radius: 14rpx;
  color: var(--color-on-surface-variant);
}

.close-btn:active {
  background: var(--color-surface-container);
}

.card-body {
  padding: 40rpx 48rpx;
}

.section {
  margin-bottom: 36rpx;
}

.section-title {
  display: block;
  margin-bottom: 14rpx;
  font-size: 20rpx;
  font-weight: 600;
  color: var(--color-on-surface-variant);
}

.section-text {
  font-size: 24rpx;
  line-height: 1.7;
  color: var(--color-on-surface);
  white-space: pre-wrap;
}

.benefit-list {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.benefit-tag {
  padding: 8rpx 20rpx;
  border-radius: 10rpx;
  background: var(--accent-purple-dim);
  color: var(--accent-purple);
  font-size: 22rpx;
  font-weight: 500;
}

.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16rpx;
}

.info-item {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.info-icon {
  flex: none;
  width: 28rpx;
  height: 28rpx;
  color: var(--color-on-surface-variant);
}

.info-value {
  font-size: 24rpx;
  color: var(--color-on-surface);
}

.info-value.placeholder {
  color: var(--color-on-surface-variant);
  font-style: italic;
}

.info-link {
  font-size: 24rpx;
  color: var(--color-primary);
}
</style>
