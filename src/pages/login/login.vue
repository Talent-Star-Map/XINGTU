<template>
  <view class="login-page" :class="themeClass">
    <view class="login-content">
      <view class="back-link" @tap="backToRole">
        <AppIcon name="chevron-right" />
        <text>返回</text>
      </view>
      <view class="login-card">
        <view class="login-brand">
          <view class="brand-icon" :class="{ 'brand-icon-admin': userRole === 'admin', 'brand-icon-enterprise': userRole === 'enterprise' }">
            <AppIcon :name="userRole === 'admin' ? 'shield' : 'star'" />
          </view>
          <text class="login-title">{{ mode === 'login' ? '登录' : '注册' }}星图{{ userRole === 'admin' ? ' · 管理员' : '' }}</text>
        </view>
        <view v-if="userRole !== 'admin'" class="mode-tabs">
          <view class="tab" :class="{ active: mode === 'login' }" @tap="mode = 'login'">登录</view>
          <view class="tab" :class="{ active: mode === 'register' }" @tap="mode = 'register'">注册</view>
        </view>
        <text v-if="error" class="error-text">{{ error }}</text>
        <view class="form">
          <view class="field">
            <text class="field-label">{{ userRole === 'admin' ? '邮箱' : '邮箱 / 手机号' }}</text>
            <view class="input-wrap">
              <input
                class="field-input"
                type="text"
                v-model="account"
                :placeholder="userRole === 'admin' ? '请输入管理员邮箱' : '请输入邮箱或手机号'"
                :placeholder-style="placeholderStyle"
              />
            </view>
          </view>
          <view v-if="mode === 'register' && userRole !== 'admin'" class="field">
            <text class="field-label">验证码</text>
            <view class="code-row">
              <view class="input-wrap code-input-wrap">
                <input
                  class="field-input"
                  type="number"
                  v-model="code"
                  placeholder="输入验证码"
                  :placeholder-style="placeholderStyle"
                  maxlength="6"
                />
              </view>
              <view
                class="code-button"
                :class="{ disabled: loading || cd > 0 }"
                @tap="sendCode"
              >
                <text class="code-button-text">{{ cd > 0 ? `${cd}s` : '获取' }}</text>
              </view>
            </view>
          </view>
          <view class="field">
            <text class="field-label">密码</text>
            <view class="password-input-wrap">
              <input
                class="field-input password-field-input"
                :type="showPassword ? 'text' : 'password'"
                v-model="password"
                placeholder="请输入密码"
                :placeholder-style="placeholderStyle"
                confirm-type="done"
                @confirm="submit"
              />
              <view class="password-toggle" @tap="showPassword = !showPassword">
                <AppIcon :name="showPassword ? 'eye' : 'eye-off'" />
              </view>
            </view>
          </view>
          <view v-if="mode === 'login'" class="remember-row" @tap="remember = !remember">
            <view class="checkbox" :class="{ checked: remember }"></view>
            <text class="remember-text">记住账号密码（下次自动填充）</text>
          </view>
          <view class="submit-button" :class="{ disabled: loading, 'submit-button-admin': userRole === 'admin', 'submit-button-enterprise': userRole === 'enterprise' }" @tap="submit">
            <text class="submit-button-text">{{ loading ? '处理中...' : mode === 'login' ? '登录' : '注册' }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed, onUnmounted, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import AppIcon from '../../components/common/AppIcon.vue'
import { request } from '../../utils/request'
import { useTheme } from '../../composables/useTheme'

const STORAGE_KEY = 'xingtu_saved_login'
const placeholderStyle = 'color: var(--color-on-surface-variant); opacity: 0.6;'

const userRole = ref('jobseeker')
const mode = ref('login')
const account = ref('')
const password = ref('')
const code = ref('')
const loading = ref(false)
const error = ref('')
const cd = ref(0)
const showPassword = ref(false)
const remember = ref(true)
let timer

onLoad((query) => {
  if (query && query.role) {
    userRole.value = query.role
  }
})

const { theme, themeClass } = useTheme()


onUnmounted(() => {
  if (timer) clearInterval(timer)
})

async function sendCode() {
  if (!account.value) { error.value = '请输入邮箱或手机号'; return }
  loading.value = true
  error.value = ''
  try {
    const data = await request({
      url: '/api/auth/send-code',
      method: 'POST',
      data: { account: account.value },
      auth: false
    })
    if (!data.success) { error.value = data.message || '发送失败'; return }
    cd.value = 60
    timer = setInterval(() => {
      if (cd.value <= 1) { clearInterval(timer); cd.value = 0 }
      else cd.value -= 1
    }, 1000)
  } catch {
    error.value = '网络错误'
  } finally {
    loading.value = false
  }
}

async function submit() {
  if (!account.value || !password.value) { error.value = '请填写完整'; return }
  if (mode.value === 'register' && !code.value) { error.value = '请输入验证码'; return }
  loading.value = true
  error.value = ''
  try {
    const isAdmin = userRole.value === 'admin'
    const data = await request({
      url: isAdmin
        ? '/api/auth/admin/login'
        : (mode.value === 'login' ? '/api/auth/login' : '/api/auth/register'),
      method: 'POST',
      data: isAdmin
        ? { account: account.value, password: password.value }
        : (mode.value === 'login'
          ? { account: account.value, password: password.value, role: userRole.value }
          : { account: account.value, password: password.value, code: code.value, role: userRole.value }),
      auth: false
    })
    if (!data.success) { error.value = data.detail || data.message || '操作失败'; return }
    if (mode.value === 'register') {
      mode.value = 'login'
      account.value = ''
      password.value = ''
      code.value = ''
      showPassword.value = false
      error.value = ''
      return
    }
    if (remember.value) {
      uni.setStorageSync(STORAGE_KEY, JSON.stringify({
        role: userRole.value, account: account.value, password: password.value, savedAt: Date.now()
      }))
    } else {
      uni.removeStorageSync(STORAGE_KEY)
    }
    uni.setStorageSync('xingtu_token', data.data.token)
    uni.setStorageSync('xingtu_role', data.data.role)
    uni.setStorageSync('xingtu_user', JSON.stringify(data.data))
    let homeUrl = '/pages/jobseeker/index'
    if (userRole.value === 'enterprise') {
      homeUrl = '/pages/enterprise/index'
    } else if (userRole.value === 'admin') {
      homeUrl = '/pages/admin/index'
    }
    uni.reLaunch({ url: homeUrl })
  } catch {
    error.value = '网络错误'
  } finally {
    loading.value = false
  }
}

function backToRole() {
  uni.reLaunch({ url: '/pages/role-select/role-select' })
}
</script>

<style>
.login-page {
  position: relative;
  display: flex;
  width: 100%;
  min-height: 100vh;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  overflow: hidden;
  background: var(--color-background);
  color: var(--color-on-surface);
  font-family: Inter, "PingFang SC", "Microsoft YaHei", sans-serif;
}

.theme-light {
  --login-input-bg: rgba(240, 243, 250, 0.5);
}

.theme-dark {
  --login-input-bg: rgba(18, 24, 44, 0.5);
}



.login-content {
  position: relative;
  z-index: 10;
  width: 100%;
  max-width: 682rpx;
  padding: 36rpx;
  box-sizing: border-box;
}

.back-link {
  display: flex;
  margin-bottom: 53rpx;
  align-items: center;
  gap: 4rpx;
  color: var(--color-outline);
  font-size: 23rpx;
}

.back-link .app-icon {
  transform: rotate(180deg);
}

.login-card {
  position: relative;
  z-index: 11;
  padding: 53rpx;
  border: 1rpx solid var(--color-outline-variant);
  border-radius: 26rpx;
  background: var(--color-surface-container-lowest);
}

.login-brand {
  display: flex;
  margin-bottom: 44rpx;
  flex-direction: column;
  align-items: center;
  gap: 20rpx;
}

.brand-icon {
  display: flex;
  width: 106rpx;
  height: 106rpx;
  align-items: center;
  justify-content: center;
  border-radius: 26rpx;
  background: var(--color-primary-fixed);
  color: var(--color-primary);
  font-size: 48rpx;
}

.brand-icon-admin {
  background: var(--accent-green-dim, rgba(5, 150, 105, 0.08));
  color: var(--accent-green);
}

.brand-icon-enterprise {
  background: var(--accent-purple-dim, rgba(91, 33, 182, 0.08));
  color: var(--accent-purple);
}

.login-title {
  color: var(--color-on-surface);
  font-size: 32rpx;
  font-weight: 700;
}

.mode-tabs {
  display: flex;
  margin-bottom: 35rpx;
  padding: 4rpx;
  border: 1rpx solid var(--color-outline-variant);
  border-radius: 18rpx;
}

.tab {
  flex: 1;
  padding: 20rpx;
  border-radius: 14rpx;
  color: var(--color-on-surface-variant);
  font-size: 26rpx;
  font-weight: 600;
  text-align: center;
}

.tab.active {
  background: var(--color-primary);
  color: var(--color-on-primary);
}

.error-text {
  display: block;
  margin-bottom: 22rpx;
  padding: 18rpx;
  border-radius: 16rpx;
  background: rgba(220, 38, 38, 0.08);
  color: var(--accent-red);
  font-size: 23rpx;
  text-align: center;
}

.form,
.field {
  display: flex;
  flex-direction: column;
}

.form {
  gap: 31rpx;
}

.field {
  gap: 14rpx;
  color: var(--color-on-surface-variant);
  font-size: 23rpx;
  font-weight: 500;
}

.field-label {
  color: var(--color-on-surface-variant);
  font-size: 23rpx;
  font-weight: 500;
}

.input-wrap {
  position: relative;
  width: 100%;
}

.field-input {
  display: block;
  width: 100%;
  height: 88rpx;
  box-sizing: border-box;
  padding: 0 29rpx;
  border: 1rpx solid var(--color-outline-variant);
  border-radius: 18rpx;
  background: var(--login-input-bg);
  color: var(--color-on-surface);
  font-size: 27rpx;
  line-height: 88rpx;
}
.password-field-input {
  padding-right: 90rpx;
}

.code-row {
  display: flex;
  gap: 18rpx;
  align-items: center;
}

.code-button {
  display: flex;
  width: 72rpx;
  height: 72rpx;
  flex: none;
  align-items: center;
  justify-content: center;
  border-radius: 14rpx;
  background: var(--color-primary);
  color: var(--color-on-primary);
  position: relative;
  z-index: 2;
}

.code-button-text {
  color: var(--color-on-primary);
  font-size: 23rpx;
  font-weight: 600;
}

.code-input-wrap {
  flex: 1;
}
.password-input-wrap {
  position: relative;
  width: 100%;
}

.password-toggle {
  position: absolute;
  top: 50%;
  right: 18rpx;
  display: flex;
  width: 52rpx;
  height: 52rpx;
  align-items: center;
  justify-content: center;
  transform: translateY(-50%);
  color: var(--color-on-surface-variant);
  background: transparent;
  z-index: 3;
}

.password-toggle .app-icon {
  width: 70rpx;
  height: 68rpx;
}

.disabled {
  opacity: 0.55;
  pointer-events: none;
}

.remember-row {
  display: flex;
  align-items: center;
  gap: 15rpx;
  color: var(--color-on-surface-variant);
  font-size: 22rpx;
}

.checkbox {
  position: relative;
  width: 31rpx;
  height: 31rpx;
  box-sizing: border-box;
  border: 2rpx solid var(--color-outline);
  border-radius: 8rpx;
  background: transparent;
}

.checkbox.checked {
  border-color: var(--color-primary);
  background: var(--color-primary);
}

.checkbox.checked::after {
  content: '';
  position: absolute;
  left: 8rpx;
  top: 4rpx;
  width: 8rpx;
  height: 15rpx;
  border: solid var(--color-on-primary);
  border-width: 0 3rpx 3rpx 0;
  transform: rotate(45deg);
}

.remember-text {
  color: var(--color-on-surface-variant);
  font-size: 22rpx;
}

.submit-button {
  padding: 28rpx;
  border-radius: 18rpx;
  background: linear-gradient(135deg, var(--color-primary), var(--accent-purple));
  color: var(--color-on-primary);
  font-size: 28rpx;
  font-weight: 700;
  text-align: center;
  position: relative;
  z-index: 2;
}

.submit-button-admin {
  background: linear-gradient(135deg, var(--accent-green), var(--accent-purple));
}

.submit-button-enterprise {
  background: linear-gradient(135deg, var(--accent-purple), var(--color-primary));
}

.submit-button-text {
  color: var(--color-on-primary);
  font-size: 28rpx;
  font-weight: 700;
}
</style>
