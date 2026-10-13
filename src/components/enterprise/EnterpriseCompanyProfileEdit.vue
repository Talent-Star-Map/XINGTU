<template>
  <view class="cpe-page">
    <!-- 顶部返回 -->
    <view class="cpe-topbar">
      <view class="cpe-back" @tap="goBack">
        <AppIcon name="chevron-left" />
      </view>
      <text class="cpe-topbar-title">编辑企业信息</text>
    </view>

    <view v-if="loading" class="cpe-loading">
      <AppIcon name="loader" class="cpe-spin" />
      <text>加载中</text>
    </view>
    <template v-else>
      <!-- 资料完整度卡片 -->
      <view class="cpe-completeness-card">
        <view class="cpe-completeness-top">
          <text class="cpe-completeness-pct">资料完整度 {{ pct }}%</text>
          <text class="cpe-completeness-count">{{ filledCount }}/{{ requiredFields.length }} 项必填</text>
        </view>
        <view class="cpe-completeness-track">
          <view class="cpe-completeness-fill" :style="{ width: pct + '%' }" />
        </view>
      </view>

      <!-- 错误提示 -->
      <view v-if="errors.length > 0" class="cpe-error-bar">
        <AppIcon name="alert-circle" class="cpe-error-icon" />
        <text class="cpe-error-text">请填写必填项：{{ errorLabels }}</text>
      </view>

      <!-- 基本信息 -->
      <view class="cpe-section">
        <text class="cpe-section-title">基本信息</text>
        <view class="cpe-info-card">
          <view class="cpe-field-row">
            <view class="cpe-field-left">
              <AppIcon name="building" class="cpe-field-icon" />
              <text class="cpe-field-label">公司名称</text>
              <text class="cpe-req">*</text>
            </view>
            <view class="cpe-field-right">
              <input class="cpe-field-input" v-model="form.company_name" placeholder="如：字节跳动" />
            </view>
          </view>
          <view class="cpe-field-row">
            <view class="cpe-field-left">
              <AppIcon name="tag" class="cpe-field-icon" />
              <text class="cpe-field-label">所属行业</text>
              <text class="cpe-req">*</text>
            </view>
            <view class="cpe-field-right">
              <picker :value="industryIdx" :range="industryOpts" @change="onIndustryChange">
                <view class="cpe-picker-inner">
                  <text class="cpe-picker-text" :class="{ 'cpe-picker-placeholder': !form.industry }">{{ form.industry || '请选择' }}</text>
                  <AppIcon name="chevron-right" class="cpe-picker-arrow" />
                </view>
              </picker>
            </view>
          </view>
          <view class="cpe-field-row">
            <view class="cpe-field-left">
              <AppIcon name="users" class="cpe-field-icon" />
              <text class="cpe-field-label">公司规模</text>
              <text class="cpe-req">*</text>
            </view>
            <view class="cpe-field-right">
              <picker :value="sizeIdx" :range="sizeOpts" @change="onSizeChange">
                <view class="cpe-picker-inner">
                  <text class="cpe-picker-text" :class="{ 'cpe-picker-placeholder': !form.company_size }">{{ form.company_size || '请选择' }}</text>
                  <AppIcon name="chevron-right" class="cpe-picker-arrow" />
                </view>
              </picker>
            </view>
          </view>
          <view class="cpe-field-row">
            <view class="cpe-field-left">
              <AppIcon name="globe" class="cpe-field-icon" />
              <text class="cpe-field-label">公司官网</text>
            </view>
            <view class="cpe-field-right">
              <input class="cpe-field-input" v-model="form.company_website" placeholder="https://www.example.com" />
            </view>
          </view>
        </view>
      </view>

      <!-- 公司简介 -->
      <view class="cpe-section">
        <text class="cpe-section-title">公司简介 <text class="cpe-req">*</text></text>
        <view class="cpe-desc-card">
          <textarea class="cpe-desc-textarea" v-model="form.company_desc" placeholder="点击输入公司简介（选填）" maxlength="200" @input="onDescInput" />
          <text class="cpe-desc-counter">{{ descLen }}/200</text>
        </view>
      </view>

      <!-- 公司福利 -->
      <view class="cpe-section">
        <text class="cpe-section-title">公司福利</text>
        <view class="cpe-info-card">
          <view class="cpe-field-row">
            <view class="cpe-field-left">
              <AppIcon name="tag" class="cpe-field-icon" />
              <text class="cpe-field-label">公司福利</text>
            </view>
            <view class="cpe-field-right">
              <input class="cpe-field-input" v-model="form.company_benefits" placeholder="五险一金、双休、弹性工作、年终奖" />
            </view>
          </view>
        </view>
      </view>

      <!-- 保存按钮 -->
      <view class="cpe-save" :class="{ 'cpe-save-disabled': saving }" @tap="save">
        <AppIcon :name="saving ? 'loader' : saved ? 'check-circle' : 'save'" class="cpe-save-icon" :class="{ 'cpe-spin': saving }" />
        <text>{{ saved ? '已保存' : '保存信息' }}</text>
      </view>
    </template>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { request } from '../../utils/request'
import { useTheme } from '../../composables/useTheme'
import AppIcon from '../common/AppIcon.vue'

const emit = defineEmits(['navigate'])
const { theme } = useTheme()

const requiredFields = ['company_name', 'industry', 'company_size', 'company_desc']
const industryOpts = ['人工智能', '互联网/电商', '企业服务/SaaS', '金融科技', '教育培训', '医疗健康', '硬件/芯片', '游戏', '汽车/出行', '其他']
const sizeOpts = ['少于15人', '15-50人', '50-150人', '150-500人', '500-2000人', '2000人以上']

const loading = ref(true)
const form = ref({})
const saving = ref(false)
const saved = ref(false)
const errors = ref([])
const descLen = ref(0)

function hasVal(val) { return val != null && val !== '' && val.toString().trim() ? true : false }

const filledCount = computed(() => {
  if (!form.value) return 0
  return requiredFields.filter(k => hasVal(form.value[k])).length
})
const pct = computed(() => {
  if (!requiredFields.length) return 100
  return Math.round((filledCount.value / requiredFields.length) * 100)
})

const industryIdx = computed(() => { const i = industryOpts.indexOf(form.value.industry); return i >= 0 ? i : 0 })
const sizeIdx = computed(() => { const i = sizeOpts.indexOf(form.value.company_size); return i >= 0 ? i : 0 })

const errorLabels = computed(() => errors.value.map(k => ({
  company_name: '公司名称', industry: '所属行业', company_size: '公司规模', company_desc: '公司简介'
})[k] || k).join('、'))

function goBack() { emit('navigate', 'company-profile') }

function onIndustryChange(e) { form.value.industry = industryOpts[e.detail.value]; syncDescLen() }
function onSizeChange(e) { form.value.company_size = sizeOpts[e.detail.value]; syncDescLen() }
function onDescInput() { descLen.value = (form.value.company_desc || '').length }
function syncDescLen() { descLen.value = (form.value.company_desc || '').length }

async function fetchData() {
  try {
    const d = await request({ url: '/api/auth/profile' })
    if (d.success) {
      form.value = {
        company_name: d.data.company_name || '',
        industry: d.data.industry || '',
        company_size: d.data.company_size || '',
        company_website: d.data.company_website || '',
        company_desc: d.data.company_desc || '',
        company_benefits: d.data.company_benefits || '',
        }
      descLen.value = (d.data.company_desc || '').length
    }
  } catch {} finally { loading.value = false }
}

async function save() {
  const missing = requiredFields.filter(k => !form.value[k]?.trim())
  if (missing.length > 0) {
    errors.value = missing
    setTimeout(() => { errors.value = [] }, 4000)
    return
  }
  saving.value = true; saved.value = false; errors.value = []
  try {
    const d = await request({ url: '/api/auth/profile', method: 'PUT', data: form.value })
    if (d.success) {
      saved.value = true
      setTimeout(() => { emit('navigate', 'company-profile') }, 800)
    }
  } catch {} finally {
    saving.value = false
    setTimeout(() => { saved.value = false }, 3000)
  }
}

fetchData()
</script>

<style>
.cpe-page {
  padding: 0 0 60rpx;
  min-height: 100%;
  background: #F8FAFD;
}

.cpe-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  gap: 12rpx;
  color: #9CA3AF;
  font-size: 26rpx;
}

.cpe-spin { animation: cpe-rotate 1s linear infinite; width: 36rpx; height: 36rpx; }
@keyframes cpe-rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

/* ── Topbar ── */
.cpe-topbar {
  display: flex;
  align-items: center;
  height: 100rpx;
  padding: 0 24rpx;
  border-bottom: 1rpx solid #EEF1F5;
  background: #FFFFFF;
  flex-shrink: 0;
  position: sticky;
  top: 0;
  z-index: 10;
}

.cpe-back {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56rpx;
  height: 56rpx;
  margin-right: 12rpx;
  color: #111827;
}

.cpe-back:active { opacity: 0.6; }

.cpe-back .app-icon { width: 36rpx; height: 36rpx; }

.cpe-topbar-title {
  font-size: 32rpx;
  font-weight: 700;
  color: #111827;
}

/* ── Completeness Card ── */
.cpe-completeness-card {
  margin: 24rpx 24rpx 28rpx;
  padding: 28rpx 24rpx 24rpx;
  border-radius: 20rpx;
  background: linear-gradient(135deg, #3B73ED, #2C65EA);
  box-shadow: 0 6rpx 24rpx rgba(37, 99, 235, 0.15);
}

.cpe-completeness-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18rpx;
}

.cpe-completeness-pct {
  font-size: 28rpx;
  font-weight: 700;
  color: #FFFFFF;
}

.cpe-completeness-count {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.75);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.cpe-completeness-track {
  width: 100%;
  height: 10rpx;
  border-radius: 5rpx;
  background: rgba(255, 255, 255, 0.2);
  overflow: hidden;
}

.cpe-completeness-fill {
  height: 100%;
  border-radius: 5rpx;
  background: #FFFFFF;
  transition: width 0.4s ease;
}

/* ── Error ── */
.cpe-error-bar {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin: 0 24rpx 24rpx;
  padding: 14rpx 18rpx;
  border-radius: 14rpx;
  border: 1rpx solid #EF4444;
  background: rgba(239, 68, 68, 0.06);
}

.cpe-error-icon { width: 28rpx; height: 28rpx; flex-shrink: 0; color: #EF4444; }
.cpe-error-text { font-size: 22rpx; color: #EF4444; line-height: 1.4; }

/* ── Section ── */
.cpe-section {
  padding: 0 24rpx;
  margin-bottom: 32rpx;
}

.cpe-section-title {
  display: block;
  font-size: 28rpx;
  font-weight: 700;
  color: #111827;
  margin-bottom: 18rpx;
}

/* ── Info Card ── */
.cpe-info-card {
  border-radius: 20rpx;
  background: #FFFFFF;
  border: 1rpx solid #EEF1F5;
  overflow: hidden;
}

.cpe-field-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 88rpx;
  padding: 0 24rpx;
  border-bottom: 1rpx solid #EEF1F5;
}

.cpe-field-row:last-child { border-bottom: none; }

.cpe-field-left {
  display: flex;
  align-items: center;
  gap: 12rpx;
  flex-shrink: 0;
  min-width: 180rpx;
}

.cpe-field-icon {
  width: 30rpx;
  height: 30rpx;
  color: #9CA3AF;
  flex-shrink: 0;
}

.cpe-field-label {
  font-size: 26rpx;
  color: #1F2937;
}

.cpe-req {
  color: #EF4444;
  font-size: 24rpx;
}

.cpe-field-right {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  min-width: 0;
  margin-left: 16rpx;
}

.cpe-field-input {
  width: 100%;
  padding: 16rpx 0;
  border: none;
  background: transparent;
  color: #111827;
  font-size: 26rpx;
  text-align: right;
  outline: none;
}

.cpe-picker-inner {
  display: flex;
  align-items: center;
  gap: 6rpx;
  justify-content: flex-end;
}

.cpe-picker-text {
  font-size: 26rpx;
  color: #111827;
  text-align: right;
}

.cpe-picker-placeholder {
  color: #9CA3AF;
}

.cpe-picker-arrow {
  width: 22rpx;
  height: 22rpx;
  color: #D1D5DB;
  flex-shrink: 0;
}

/* ── Description Card ── */
.cpe-desc-card {
  border-radius: 20rpx;
  background: #FFFFFF;
  border: 1rpx solid #EEF1F5;
  padding: 24rpx;
}

.cpe-desc-textarea {
  width: 100%;
  min-height: 200rpx;
  border: none;
  background: transparent;
  color: #111827;
  font-size: 26rpx;
  line-height: 1.6;
  resize: none;
  padding: 0;
  box-sizing: border-box;
}

.cpe-desc-counter {
  display: block;
  text-align: right;
  margin-top: 10rpx;
  font-size: 22rpx;
  color: #9CA3AF;
  font-variant-numeric: tabular-nums;
}

/* ── Save ── */
.cpe-save {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  margin: 0 24rpx;
  padding: 26rpx 0;
  border-radius: 18rpx;
  font-size: 30rpx;
  font-weight: 700;
  background: linear-gradient(135deg, #2563EB, #3B82F6);
  color: #FFFFFF;
}

.cpe-save:active { opacity: 0.85; }
.cpe-save-disabled { opacity: 0.6; }
.cpe-save-icon { width: 30rpx; height: 30rpx; }
</style>