<template>
  <view class="admin-model-config">
    <!-- ===== 加载中 ===== -->
    <view v-if="loading" class="loading-full">
      <view class="loading-spinner" />
      <text class="loading-text">加载配置中...</text>
    </view>

    <template v-else>
      <!-- ===== 顶部标题 + 保存按钮 ===== -->
      <view class="page-header">
        <view class="page-header-left">
          <text class="page-title">模型配置</text>
          <view class="mode-badge" :class="mockMode ? 'mode-badge--active' : 'mode-badge--off'">
            <text class="mode-badge-text">{{ mockMode ? '自定义模式' : '默认模式' }}</text>
          </view>
        </view>
        <view
          class="save-btn"
          :class="{ 'save-btn--disabled': saving }"
          @tap="onSave"
        >
          <text class="save-btn-text">{{ saving ? '保存中...' : '保存配置' }}</text>
        </view>
      </view>

      <!-- ===== 全局开关卡片 ===== -->
      <view class="card card--switches">
        <view class="card-header">
          <view class="card-header-icon card-header-icon--blue">
            <AppIcon name="shield" color="#3B82F6" />
          </view>
          <view class="card-header-info">
            <text class="card-header-title">全局开关</text>
            <text class="card-header-desc">Mock 模式下不调用任何外部 API（零费用，开发期建议开启）；关闭后使用下方配置的真实模型</text>
          </view>
        </view>

        <view class="switch-row">
          <view class="switch-row-left">
            <text class="switch-label">默认调用开关</text>
            <text class="switch-desc">开启后 AI 功能按默认配置调用；关闭则禁用所有 AI 功能</text>
          </view>
          <view
            class="toggle"
            :class="globalEnabled ? 'toggle--on' : 'toggle--off'"
            @tap="globalEnabled = !globalEnabled"
          >
            <view class="toggle-thumb" :class="globalEnabled ? 'toggle-thumb--on' : 'toggle-thumb--off'" />
          </view>
        </view>

        <view class="switch-row">
          <view class="switch-row-left">
            <text class="switch-label">自定义调用模式开关</text>
            <text class="switch-desc">开启=使用下方自定义配置的模型，关闭=使用默认调用方式</text>
          </view>
          <view
            class="toggle"
            :class="mockMode ? 'toggle--on' : 'toggle--off'"
            @tap="mockMode = !mockMode"
          >
            <view class="toggle-thumb" :class="mockMode ? 'toggle-thumb--on' : 'toggle-thumb--off'" />
          </view>
        </view>
      </view>

      <!-- ===== 三档模型卡片 ===== -->
      <view
        v-for="tier in TIERS"
        :key="tier.key"
        class="card card--tier"
        :class="'card--tier-' + tier.key"
      >
        <!-- tier 头部 -->
        <view class="tier-header">
          <view class="tier-header-left">
            <text class="tier-icon">{{ tier.icon }}</text>
            <view class="tier-header-info">
              <text class="tier-title">{{ tier.label }}</text>
              <text class="tier-desc">{{ tier.desc }}</text>
            </view>
          </view>
          <view v-if="resolved?.[tier.key]" class="resolved-badge">
            <text class="resolved-badge-text">当前: {{ resolved[tier.key]?.model || '未配置' }}</text>
          </view>
        </view>

        <!-- Provider -->
        <view class="field">
          <text class="field-label">Provider</text>
          <view class="picker-wrap">
            <picker
              :value="providerIndex(tier.key)"
              :range="providerOptions"
              @change="onProviderChange(tier.key, $event)"
            >
              <view class="picker-display">
                <text class="picker-text">
                  {{ configs[tier.key + '_provider'] || '默认' }}
                </text>
                <text class="picker-arrow">▾</text>
              </view>
            </picker>
          </view>
        </view>

        <!-- 模型名 -->
        <view class="field">
          <text class="field-label">模型名</text>
          <input
            class="field-input"
            :value="configs[tier.key + '_model'] || ''"
            placeholder="如 deepseek-chat"
            @input="onInput(tier.key + '_model', $event)"
          />
        </view>

        <!-- API Base URL -->
        <view class="field">
          <text class="field-label">API Base URL</text>
          <input
            class="field-input"
            :value="configs[tier.key + '_base_url'] || ''"
            placeholder="如 https://api.deepseek.com/v1"
            @input="onInput(tier.key + '_base_url', $event)"
          />
        </view>

        <!-- API Key -->
        <view class="field">
          <text class="field-label">API Key</text>
          <view class="apikey-row">
            <input
              class="apikey-input"
              :password="!showKeys"
              :value="configs[tier.key + '_api_key'] || ''"
              placeholder="sk-..."
              @input="onInput(tier.key + '_api_key', $event)"
            />
            <view class="eye-btn" @tap="showKeys = !showKeys">
              <text class="eye-btn-text">{{ showKeys ? '🙈' : '👁' }}</text>
            </view>
            <view class="test-btn" :class="{ 'test-btn--busy': testBusy === tier.key }" @tap="onTest(tier.key)">
              <text class="test-btn-text">{{ testBusy === tier.key ? '测试中...' : '测试' }}</text>
            </view>
          </view>
        </view>

        <!-- 测试结果区域 -->
        <view v-if="testResults[tier.key]" class="test-result" :class="testResults[tier.key]?.success ? 'test-result--ok' : 'test-result--fail'">
          <view class="test-result-header">
            <text class="test-result-status">{{ testResults[tier.key]?.success ? '✓ 连接成功' : '✗ 连接失败' }}</text>
            <text v-if="testResults[tier.key]?.latency_ms" class="test-result-latency">{{ testResults[tier.key]?.latency_ms }}ms</text>
          </view>
          <text class="test-result-msg">{{ testResults[tier.key]?.message }}</text>
        </view>
      </view>

      <!-- ===== 配置说明 ===== -->
      <view class="card card--notes">
        <view class="notes-title">
          <text class="notes-title-text">💡 配置说明</text>
        </view>
        <view class="notes-list">
          <text class="notes-item">· 留空的配置项会回退到 .env 环境变量或代码默认值</text>
          <text class="notes-item">· 保存后约 30 秒内全站生效（路由层有缓存），「测试」按钮可立即验证当前配置</text>
          <text class="notes-item">· API Key 只显示掩码，不会回显明文；再次保存会覆盖原值</text>
          <text class="notes-item">· Provider 统一走 OpenAI 兼容格式（DeepSeek / 通义千问 / Kimi / Qwen 等均支持）</text>
        </view>
      </view>
    </template>

    <!-- ===== Toast ===== -->
    <view v-if="toast" class="toast-wrap">
      <text class="toast-text">{{ toast }}</text>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { request } from '@/utils/request'
import AppIcon from '@/components/common/AppIcon.vue'

const props = defineProps({ onBack: Function })

// ─── 类型 / 常量 ───
const TIERS = [
  { key: 'strong', label: '大模型', desc: '复杂生成 / 推理 / 长文本（简历生成、深度优化、对话）', icon: '🧠' },
  { key: 'fast',   label: '小模型', desc: '简单提取 / 分类 / 判断（关键词提取、字段解析）',     icon: '⚡' },
  { key: 'vision', label: '多模态', desc: '图片理解 / 简历图片解析（预留，接多模态模型后启用）', icon: '🖼️' },
]
const PROVIDER_OPTIONS = ['openai-compatible', 'deepseek', 'qwen', 'kimi', 'anthropic', 'custom']
const providerOptions = ['', ...PROVIDER_OPTIONS]

// ─── 状态 ───
const configs       = ref({})
const mockMode      = ref(true)
const globalEnabled = ref(true)
const resolved      = ref(null)
const loading       = ref(true)
const saving        = ref(false)
const toast         = ref('')
const testBusy      = ref(null)
const showKeys      = ref(false)
const testResults   = ref({ strong: null, fast: null, vision: null })

// ─── 辅助 ───
const showToast = (msg) => {
  toast.value = msg
  setTimeout(() => { toast.value = '' }, 3000)
}

const providerIndex = (tier) => {
  const val = configs.value[tier + '_provider'] || ''
  return val ? PROVIDER_OPTIONS.indexOf(val) + 1 : 0
}

const onProviderChange = (tier, e) => {
  const idx = e.detail.value
  configs.value = { ...configs.value, [tier + '_provider']: idx > 0 ? PROVIDER_OPTIONS[idx] : '' }
}

const onInput = (key, e) => {
  configs.value = { ...configs.value, [key]: e.detail.value }
}

// ─── 拉取配置 ───
const load = async () => {
  loading.value = true
  try {
    const d = await request({ url: '/api/admin/llm-config', method: 'GET' })
    if (d.success) {
      configs.value  = d.data.configs || {}
      mockMode.value = d.data.mock_mode
      globalEnabled.value = d.data.global_enabled
      resolved.value = d.data.resolved
    } else {
      showToast(d.error?.message || '加载失败')
    }
  } catch {
    showToast('网络错误')
  } finally {
    loading.value = false
  }
}

// ─── 保存 ───
const onSave = async () => {
  if (saving.value) return
  saving.value = true
  try {
    const payload = {
      ...configs.value,
      global_enabled: globalEnabled.value ? '1' : '0',
      mock_mode:      mockMode.value ? '1' : '0',
    }
    const d = await request({
      url:  '/api/admin/llm-config',
      method: 'POST',
      data: { configs: payload },
    })
    if (d.success) { showToast(d.message || '已保存'); await load() }
    else showToast(d.error?.message || '保存失败')
  } catch {
    showToast('网络错误')
  } finally {
    saving.value = false
  }
}

// ─── 测试连接 ───
const onTest = async (tier) => {
  if (testBusy.value) return
  testBusy.value = tier
  try {
    const d = await request({
      url:  '/api/admin/llm-config/test',
      method: 'POST',
      data: { tier },
    })
    const result = d.success && d.data
      ? d.data
      : { success: false, message: d.error?.message || d.message || '测试失败' }
    testResults.value = { ...testResults.value, [tier]: result }
    if (result.success) showToast(`${TIERS.find(t => t.key === tier)?.label}连接成功`)
  } catch {
    testResults.value = { ...testResults.value, [tier]: { success: false, message: '网络错误' } }
  } finally {
    testBusy.value = null
  }
}

// ─── 初始化 ───
onMounted(() => { load() })
</script>

<style scoped>
/* ========== 容器 ========== */
.admin-model-config {
  position: relative;
  width: 100%;
  min-height: 100vh;
  padding: 24rpx 24rpx 160rpx;
  background: linear-gradient(180deg, #f0faf5 0%, #f6f9f7 40%, #f6f9f7 100%);
  box-sizing: border-box;
}

/* ========== 加载中 ========== */
.loading-full {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 60vh;
}
.loading-spinner {
  width: 56rpx; height: 56rpx;
  border: 5rpx solid #d1d5db;
  border-top-color: #059669;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.loading-text { margin-top: 16rpx; font-size: 26rpx; color: #6b7280; }

/* ========== 顶部标题行 ========== */
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 28rpx;
}
.page-header-left { display: flex; align-items: center; gap: 16rpx; }
.page-title {
  font-size: 36rpx;
  font-weight: 700;
  color: #065f46;
}
.mode-badge {
  padding: 6rpx 16rpx;
  border-radius: 20rpx;
  margin-left: 12rpx;
}
.mode-badge--active {
  background: #d1fae5;
}
.mode-badge--active .mode-badge-text {
  color: #059669;
}
.mode-badge--off {
  background: #dbeafe;
}
.mode-badge--off .mode-badge-text {
  color: #3b82f6;
}

/* 保存按钮 */
.save-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 68rpx;
  padding: 0 32rpx;
  border-radius: 16rpx;
  background: linear-gradient(135deg, #059669 0%, #10b981 100%);
  box-shadow: 0 4rpx 16rpx rgba(5,150,105,0.25);
}
.save-btn--disabled {
  opacity: 0.5;
}
.save-btn-text {
  font-size: 28rpx;
  font-weight: 600;
  color: #fff;
}

/* ========== 通用卡片 ========== */
.card {
  border-radius: 24rpx;
  padding: 32rpx;
  margin-bottom: 24rpx;
  border: 1rpx solid rgba(0,0,0,0.05);
}
.card--switches {
  background: #fff;
}
.card--tier {
  background: #fff;
}
.card--notes {
  background: #fff;
  border: 1rpx solid rgba(0,0,0,0.04);
}
.card--notes .notes-title {
  margin-bottom: 16rpx;
}
.notes-title-text {
  font-size: 30rpx;
  font-weight: 700;
  color: #065f46;
}
.notes-list {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}
.notes-item {
  font-size: 24rpx;
  line-height: 1.6;
  color: #6b7280;
}

/* ========== 全局开关卡片 ========== */
.card-header {
  display: flex;
  align-items: center;
  gap: 20rpx;
  margin-bottom: 28rpx;
}
.card-header-icon {
  width: 80rpx; height: 80rpx;
  border-radius: 18rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}
.card-header-icon--blue {
  background: transparent;
  font-size: 44rpx;
}
.card-header-icon--blue :deep(.app-icon) {
  stroke-width: 2.5;
}
.card-header-icon--blue :deep(.app-icon) {
  stroke-width: 3;
}
.icon-text { font-size: 40rpx; }
.card-header-info { display: flex; flex-direction: column; }
.card-header-title { font-size: 30rpx; font-weight: 700; color: #111827; }
.card-header-desc { font-size: 24rpx; color: #6b7280; margin-top: 4rpx; }

/* 开关行 */
.switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 0;
}
.switch-row + .switch-row {
  border-top: 1rpx solid #f3f4f6;
}
.switch-row-left {
  display: flex;
  flex-direction: column;
  flex: 1;
  margin-right: 20rpx;
}
.switch-label { font-size: 28rpx; font-weight: 600; color: #111827; }
.switch-desc  { font-size: 22rpx; color: #9ca3af; margin-top: 4rpx; }

/* toggle 开关 */
.toggle {
  width: 96rpx; height: 52rpx;
  border-radius: 26rpx;
  position: relative;
  transition: background 0.25s;
}
.toggle--on  { background: #059669; }
.toggle--off { background: #d1d5db; }
.toggle-thumb {
  width: 44rpx; height: 44rpx;
  border-radius: 22rpx;
  background: #fff;
  position: absolute;
  top: 4rpx;
  transition: left 0.25s;
  box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.15);
}
.toggle-thumb--on  { left: 48rpx; }
.toggle-thumb--off { left: 4rpx; }

/* ========== 三档模型卡片 ========== */
.tier-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 24rpx;
}
.tier-header-left { display: flex; align-items: center; gap: 16rpx; flex: 1; }
.tier-icon { font-size: 40rpx; }
.tier-header-info { display: flex; flex-direction: column; }
.tier-title { font-size: 30rpx; font-weight: 700; color: #111827; }
.tier-desc  { font-size: 22rpx; color: #9ca3af; margin-top: 4rpx; }

/* 当前resolved badge */
.resolved-badge {
  padding: 6rpx 16rpx;
  border-radius: 20rpx;
  background: #dbeafe;
}
.resolved-badge-text { font-size: 22rpx; color: #2563eb; }

/* 各档视觉色 */
.card--tier-strong {
  border-left: 6rpx solid #059669;
}
.card--tier-fast {
  border-left: 6rpx solid #d97706;
}
.card--tier-vision {
  border-left: 6rpx solid #7c3aed;
}

/* ========== 表单字段 ========== */
.field {
  margin-bottom: 20rpx;
}
.field-label {
  font-size: 24rpx;
  font-weight: 600;
  color: #374151;
  margin-bottom: 8rpx;
  display: block;
}
.field-input {
  width: 100%;
  height: 72rpx;
  border: 1rpx solid #e5e7eb;
  border-radius: 14rpx;
  padding: 0 20rpx;
  font-size: 26rpx;
  color: #111827;
  background: #fafafa;
  box-sizing: border-box;
}

/* picker */
.picker-wrap {
  border: 1rpx solid #e5e7eb;
  border-radius: 14rpx;
  background: #fafafa;
  height: 72rpx;
  display: flex;
  align-items: center;
}
.picker-display {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 0 20rpx;
}
.picker-text {
  font-size: 26rpx;
  color: #111827;
}
.picker-arrow { font-size: 22rpx; color: #9ca3af; }

/* API Key 行 */
.apikey-row {
  display: flex;
  gap: 12rpx;
  align-items: center;
}
.apikey-input {
  flex: 1;
  height: 72rpx;
  border: 1rpx solid #e5e7eb;
  border-radius: 14rpx;
  padding: 0 20rpx;
  font-size: 26rpx;
  color: #111827;
  background: #fafafa;
  box-sizing: border-box;
}
.eye-btn {
  width: 72rpx; height: 72rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 14rpx;
  background: #f3f4f6;
  flex-shrink: 0;
}
.eye-btn-text { font-size: 32rpx; }

/* 测试按钮 */
.test-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 72rpx;
  padding: 0 24rpx;
  border-radius: 14rpx;
  background: #fff;
  border: 1rpx solid #e5e7eb;
  flex-shrink: 0;
}
.test-btn--busy { opacity: 0.5; }
.test-btn-text {
  font-size: 26rpx;
  font-weight: 600;
  color: #3b82f6;
}

/* 测试结果 */
.test-result {
  border-radius: 14rpx;
  padding: 16rpx 20rpx;
  margin-top: 12rpx;
}
.test-result--ok  { background: #ecfdf5; border: 1rpx solid #bbf7d0; }
.test-result--fail { background: #fef2f2; border: 1rpx solid #fecaca; }
.test-result-header { display: flex; align-items: center; gap: 8rpx; margin-bottom: 6rpx; }
.test-result-status { font-size: 26rpx; font-weight: 600; }
.test-result--ok  .test-result-status { color: #10b981; }
.test-result--fail .test-result-status { color: #dc2626; }
.test-result-latency { font-size: 22rpx; color: #9ca3af; margin-left: auto; font-variant-numeric: tabular-nums; }
.test-result-msg { font-size: 24rpx; color: #6b7280; display: block; opacity: 0.8; }

/* ========== Toast ========== */
.toast-wrap {
  position: fixed;
  top: 200rpx;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(17,24,39,0.88);
  border-radius: 16rpx;
  padding: 16rpx 36rpx;
  z-index: 9999;
}
.toast-text {
  font-size: 26rpx;
  color: #fff;
  white-space: nowrap;
}
</style>
