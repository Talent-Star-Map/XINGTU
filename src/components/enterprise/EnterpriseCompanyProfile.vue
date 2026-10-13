<template>
  <view class="cp-page">
    <view v-if="loading" class="cp-loading">
      <AppIcon name="loader" class="cp-spin" />
      <text>加载中</text>
    </view>
    <view v-else-if="!p" class="cp-loading">
      <text>请先登录</text>
    </view>
    <template v-else>
      <!-- 顶部标题 -->
      <view class="cp-header">
        <text class="cp-header-title">企业信息</text>
      </view>

      <!-- Hero 蓝色渐变卡片 -->
      <view class="cp-hero">
        <!-- 企业建筑插画 -->
        <view class="cp-hero-illustration">

          <!-- 装饰元素 -->
          <view class="cp-hero-deco-dot cp-deco-dot-1"></view>
          <view class="cp-hero-deco-dot cp-deco-dot-2"></view>
          <view class="cp-hero-deco-dot cp-deco-dot-3"></view>

          <view class="cp-hero-diamond cp-diamond-1"></view>
          <view class="cp-hero-diamond cp-diamond-2"></view>

          <view class="cp-hero-triangle"></view>

          <!-- 建筑整体 -->
          <view class="cp-hero-buildings">

            <!-- 建筑底部蓝色基座 -->
            <view class="cp-building-base">
              <view class="cp-building-base-top"></view>
              <view class="cp-building-base-front"></view>
              <view class="cp-building-base-side"></view>
            </view>

            <!-- 左后方副楼 -->
            <view class="cp-sub-building">

              <!-- 副楼顶部 -->
              <view class="cp-sub-roof">
                <view class="cp-sub-roof-inner"></view>
              </view>

              <!-- 副楼主体 -->
              <view class="cp-sub-front">
                <view class="cp-sub-windows">
                  <view class="cp-sub-window"></view>
                  <view class="cp-sub-window"></view>
                  <view class="cp-sub-window"></view>
                  <view class="cp-sub-window"></view>
                  <view class="cp-sub-window"></view>
                  <view class="cp-sub-window"></view>
                  <view class="cp-sub-window"></view>
                  <view class="cp-sub-window"></view>
                  <view class="cp-sub-window"></view>
                  <view class="cp-sub-window"></view>
                  <view class="cp-sub-window"></view>
                  <view class="cp-sub-window"></view>
                </view>
              </view>

              <!-- 副楼右侧面 -->
              <view class="cp-sub-side">
                <view class="cp-sub-side-windows">
                  <view class="cp-side-window"></view>
                  <view class="cp-side-window"></view>
                  <view class="cp-side-window"></view>
                  <view class="cp-side-window"></view>
                  <view class="cp-side-window"></view>
                  <view class="cp-side-window"></view>
                  <view class="cp-side-window"></view>
                  <view class="cp-side-window"></view>
                </view>
              </view>
            </view>
            <!-- 主楼 -->
            <view class="cp-main-building">
              <!-- 主楼右侧厚度面 -->
              <view class="cp-main-side">
                <view class="cp-main-side-windows">
                  <view class="cp-side-window"></view>
                  <view class="cp-side-window"></view>
                  <view class="cp-side-window"></view>
                  <view class="cp-side-window"></view>
                  <view class="cp-side-window"></view>
                  <view class="cp-side-window"></view>
                  <view class="cp-side-window"></view>
                  <view class="cp-side-window"></view>
                </view>
              </view>
              <!-- 主楼正面 -->
              <view class="cp-main-front">
                <!-- 主楼玻璃窗 -->
                <view class="cp-main-windows">
                  <view class="cp-main-window"></view>
                  <view class="cp-main-window"></view>
                  <view class="cp-main-window"></view>
                  <view class="cp-main-window"></view>

                  <view class="cp-main-window"></view>
                  <view class="cp-main-window"></view>
                  <view class="cp-main-window"></view>
                  <view class="cp-main-window"></view>

                  <view class="cp-main-window"></view>
                  <view class="cp-main-window"></view>
                  <view class="cp-main-window"></view>
                  <view class="cp-main-window"></view>

                  <view class="cp-main-window"></view>
                  <view class="cp-main-window"></view>
                  <view class="cp-main-window"></view>
                  <view class="cp-main-window"></view>

                  <view class="cp-main-window"></view>
                  <view class="cp-main-window"></view>
                  <view class="cp-main-window"></view>
                  <view class="cp-main-window"></view>

                </view>

                <!-- 建筑入口 -->
                <view class="cp-main-entrance">
                  <view class="cp-main-door"></view>
                  <view class="cp-main-door-glass"></view>
                </view>

              </view>

              <!-- 主楼入口平台 -->
              <view class="cp-main-platform">
                <view class="cp-main-step step-a"></view>
                <view class="cp-main-step step-b"></view>
                <view class="cp-main-step step-c"></view>
              </view>

            </view>

            <!-- 地面阴影 -->
            <view class="cp-building-shadow"></view>

          </view>

          <!-- 左侧小植物 -->
          <view class="cp-hero-plant-l">
            <view class="cp-hero-leaf ly1"></view>
            <view class="cp-hero-leaf ly2"></view>
          </view>

          <!-- 右下绿植 -->
          <view class="cp-hero-plant-r">
            <view class="cp-hero-leaf lr1"></view>
            <view class="cp-hero-leaf lr2"></view>
            <view class="cp-hero-leaf lr3"></view>
            <view class="cp-hero-leaf lr4"></view>
          </view>

        </view>

        <!-- 文字内容 -->
        <view class="cp-hero-content">
          <view class="cp-hero-top-row">
            <text class="cp-hero-name">{{ df(p.company_name, '未命名企业') }}</text>
            <view class="cp-hero-verify" :class="p.verified > 0 ? 'cp-hero-verify-done' : ''">
              <AppIcon :name="verifyIcon" class="cp-hero-verify-icon" />
              <text>{{ verifyLabel }}</text>
            </view>
          </view>
          <view class="cp-hero-completeness">
            <text class="cp-hero-pct">资料完整度 {{ pct }}%</text>
            <text class="cp-hero-separator">·</text>
            <text class="cp-hero-count">{{ filledCount }}/{{ requiredFields.length }} 项必填</text>
          </view>
        </view>

        <!-- 白色完善提示卡 -->
        <view v-if="pct < 100" class="cp-hero-tip-card">
          <text class="cp-hero-tip-title">完善企业信息可提升可信度</text>
          <text class="cp-hero-tip-title">与曝光率</text>
          <view class="cp-hero-btn" @tap="goEdit">
            <text class="cp-hero-btn-text">立即完善</text>
            <text class="cp-hero-btn-arrow">→</text>
          </view>
        </view>
      </view>

      <!-- 岗位统计 -->
      <view v-if="stats && stats.total > 0" class="cp-section">
        <text class="cp-section-title">岗位统计</text>
        <view class="cp-stats-card">
          <view class="cp-stats-item" :class="{ 'cp-stats-clickable': true }" @tap="emit('navigate', 'jobs')">
            <text class="cp-stats-val">{{ stats.active }}</text>
            <text class="cp-stats-label">在招</text>
          </view>
          <view class="cp-stats-divider"></view>
          <view class="cp-stats-item">
            <text class="cp-stats-val">{{ stats.closed }}</text>
            <text class="cp-stats-label">已关闭</text>
          </view>
          <view class="cp-stats-divider"></view>
          <view class="cp-stats-item">
            <text class="cp-stats-val">{{ stats.draft }}</text>
            <text class="cp-stats-label">草稿</text>
          </view>
          <view class="cp-stats-divider"></view>
          <view class="cp-stats-item" :class="{ 'cp-stats-clickable': true }" @tap="emit('navigate', 'jobs')">
            <text class="cp-stats-val">{{ stats.total }}</text>
            <text class="cp-stats-label">总计</text>
          </view>
        </view>
      </view>

      <!-- 基本信息 -->
      <view class="cp-section">
        <text class="cp-section-title">基本信息</text>
        <view class="cp-info-card">
          <view class="cp-info-row">
            <view class="cp-info-left">
              <AppIcon name="building" class="cp-info-icon" />
              <text class="cp-info-label">公司名称</text>
            </view>
            <view class="cp-info-right">
              <text class="cp-info-val">{{ df(p.company_name) }}</text>
              <AppIcon name="chevron-right" class="cp-info-arrow" />
            </view>
          </view>
          <view class="cp-info-row">
            <view class="cp-info-left">
              <AppIcon name="tag" class="cp-info-icon" />
              <text class="cp-info-label">所属行业</text>
            </view>
            <view class="cp-info-right">
              <text class="cp-info-val">{{ df(p.industry) }}</text>
              <AppIcon name="chevron-right" class="cp-info-arrow" />
            </view>
          </view>
          <view class="cp-info-row">
            <view class="cp-info-left">
              <AppIcon name="users" class="cp-info-icon" />
              <text class="cp-info-label">公司规模</text>
            </view>
            <view class="cp-info-right">
              <text class="cp-info-val">{{ df(p.company_size) }}</text>
              <AppIcon name="chevron-right" class="cp-info-arrow" />
            </view>
          </view>
          <view class="cp-info-row" @tap="openWebsite">
            <view class="cp-info-left">
              <AppIcon name="globe" class="cp-info-icon" />
              <text class="cp-info-label">公司官网</text>
            </view>
            <view class="cp-info-right">
              <text v-if="p.company_website" class="cp-info-val cp-info-link">{{ p.company_website }}</text>
              <text v-else class="cp-info-val cp-info-muted">未填写</text>
              <AppIcon name="chevron-right" class="cp-info-arrow" />
            </view>
          </view>
          <view class="cp-info-row">
            <view class="cp-info-left">
              <AppIcon name="mail" class="cp-info-icon" />
              <text class="cp-info-label">联系邮箱</text>
            </view>
            <view class="cp-info-right">
              <text class="cp-info-val">{{ df(p.email) }}</text>
              <AppIcon name="chevron-right" class="cp-info-arrow" />
            </view>
          </view>
          <view class="cp-info-row">
            <view class="cp-info-left">
              <AppIcon name="map-pin" class="cp-info-icon" />
              <text class="cp-info-label">所在城市</text>
            </view>
            <view class="cp-info-right">
              <text class="cp-info-val">{{ df(p.city || p.target_city) }}</text>
              <AppIcon name="chevron-right" class="cp-info-arrow" />
            </view>
          </view>
        </view>
      </view>

      <!-- 公司简介 -->
      <view class="cp-section">
        <text class="cp-section-title">公司简介</text>
        <view class="cp-desc-card">
          <text v-if="p.company_desc && p.company_desc.trim()" class="cp-desc-text">{{ p.company_desc }}</text>
          <text v-else class="cp-desc-placeholder">暂未填写公司简介</text>
        </view>
      </view>

      <!-- 公司福利 -->
      <view class="cp-section">
        <text class="cp-section-title">公司福利</text>
        <view v-if="p.company_benefits && p.company_benefits.trim()" class="cp-benefits-card">
          <view v-for="b in parseBenefits(p.company_benefits)" :key="b" class="cp-benefit-tag">
            <text class="cp-benefit-tag-text">{{ b }}</text>
          </view>
        </view>
        <view v-else class="cp-desc-card">
          <text class="cp-desc-placeholder">暂未填写公司福利</text>
        </view>
      </view>

      <!-- 企业认证 -->
      <view class="cp-section">
        <text class="cp-section-title">企业认证</text>
        <view class="cp-verify-card">
          <AppIcon :name="verifyIcon" class="cp-verify-card-icon" :class="p.verified > 0 ? 'cp-verify-card-icon-active' : ''" />
          <view class="cp-verify-card-info">
            <text class="cp-verify-card-label">{{ verifyLabel }}</text>
            <text class="cp-verify-card-desc">{{ verifyDesc }}</text>
          </view>
        </view>
        <view class="cp-verify-actions">
          <view class="cp-verify-btn" :class="{ 'cp-verify-btn-disabled': p.verified >= 1 }" @tap="handleVerify(1)">
            <view class="cp-verify-btn-left">
              <AppIcon name="globe" class="cp-verify-btn-icon" />
              <text>官网认证</text>
            </view>
            <AppIcon v-if="p.verified >= 1" name="check-circle" class="cp-verify-check" />
            <text v-else class="cp-verify-go">去认证</text>
          </view>
          <view class="cp-verify-btn" :class="{ 'cp-verify-btn-disabled': p.verified >= 2 }" @tap="handleVerify(2)">
            <view class="cp-verify-btn-left">
              <AppIcon name="award" class="cp-verify-btn-icon" />
              <text>三方认证</text>
            </view>
            <AppIcon v-if="p.verified >= 1" name="check-circle" class="cp-verify-check" />
            <text v-else class="cp-verify-go">去认证</text>
          </view>
        </view>
        <!-- 第三方查询入口 -->
        <view v-if="p.company_name" class="cp-thirdparty">
          <view class="cp-thirdparty-btn" @tap="openThirdParty('qichacha')">
            <view class="cp-thirdparty-left">
              <AppIcon name="external-link" class="cp-thirdparty-icon" />
              <text>企查查</text>
            </view>
            <text class="cp-thirdparty-name">{{ p.company_name }}</text>
          </view>
          <view class="cp-thirdparty-btn" @tap="openThirdParty('tianyancha')">
            <view class="cp-thirdparty-left">
              <AppIcon name="external-link" class="cp-thirdparty-icon" />
              <text>天眼查</text>
            </view>
            <text class="cp-thirdparty-name">{{ p.company_name }}</text>
          </view>
        </view>
      </view>
    </template>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { request, API_BASE_URL } from '../../utils/request'
import { useTheme } from '../../composables/useTheme'
import AppIcon from '../common/AppIcon.vue'

const emit = defineEmits(['navigate'])
const { theme } = useTheme()

const requiredFields = ['company_name', 'industry', 'company_size', 'company_desc']
const verifyInfo = [
  { level: 0, icon: 'shield-off', label: '未认证', desc: '完善企业信息后可申请官网认证' },
  { level: 1, icon: 'shield-check', label: '官网已验证', desc: '已通过企业官网真实性核验' },
  { level: 2, icon: 'award', label: '三方认证', desc: '已通过企查查/天眼查工商数据认证' },
]

const p = ref(null)
const loading = ref(true)
const stats = ref(null)

function df(val, fb = '未填写') { return val?.trim() || fb }
function hasVal(val) { return val != null && val !== '' && val.toString().trim() ? true : false }

const currentVerify = computed(() => verifyInfo.find(v => v.level === (p.value?.verified || 0)) || verifyInfo[0])
const verifyIcon = computed(() => currentVerify.value.icon)
const verifyLabel = computed(() => currentVerify.value.label)
const verifyDesc = computed(() => currentVerify.value.desc)

const filledCount = computed(() => {
  if (!p.value) return 0

  return requiredFields.filter(field => {
    return hasVal(p.value[field])
  }).length
})

const pct = computed(() => {
  if (!requiredFields.length) return 100

  return Math.round(
    (filledCount.value / requiredFields.length) * 100
  )
})

const logoUrl = computed(() => {
  if (!p.value?.company_logo) return ''
  return p.value.company_logo.startsWith('http') ? p.value.company_logo : `${API_BASE_URL}${p.value.company_logo}`
})

async function fetchProfile() {
  try {
    const d = await request({ url: '/api/auth/profile' })
    if (d.success) {
      p.value = d.data
      fetchStats(d.data.company_name)
    }
  } catch {} finally { loading.value = false }
}

async function fetchStats(companyName) {
  const name = companyName || p.value?.company_name
  if (!name) return
  try {
    const d = await request({ url: `/api/jobs/stats?company=${encodeURIComponent(name)}` })
    if (d.success) stats.value = d.data
  } catch {}
}

function goEdit() { emit('navigate', 'company-profile-edit') }

function parseBenefits(raw) {
  if (!raw || !raw.trim()) return []
  return raw.split(/[,，、]/).map(s => s.trim()).filter(Boolean)
}

async function handleVerify(level) {
  if (level === 1) {
    if (!p.value?.company_website?.trim()) {
      uni.showToast({ title: '请先在编辑企业信息中填写公司官网', icon: 'none' })
      return
    }
    await request({ url: '/api/auth/profile', method: 'PUT', data: { verified: 1 } })
    fetchProfile()
  } else if (level === 2) {
    if (p.value?.verified < 1) {
      uni.showToast({ title: '请先完成官网验证', icon: 'none' })
      return
    }
    await request({ url: '/api/auth/profile', method: 'PUT', data: { verified: 2 } })
    fetchProfile()
  }
}

function openWebsite() {
  if (p.value?.company_website) uni.setClipboardData({ data: p.value.company_website })
}

function openThirdParty(type) {
  const name = p.value?.company_name
  if (!name) return
  const url = type === 'qichacha'
    ? `https://www.qcc.com/web/search?key=${encodeURIComponent(name)}`
    : `https://www.tianyancha.com/search?key=${encodeURIComponent(name)}`
  uni.setClipboardData({ data: url, success: () => {
    uni.showToast({ title: '链接已复制，请在浏览器中打开', icon: 'none' })
  }})
}

fetchProfile()
</script>

<style>
/* ── Page ── */
.cp-page {
  padding: 0 0 48rpx;
  min-height: 100%;
  background: #F8FAFD;
}

.cp-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  gap: 12rpx;
  color: #9CA3AF;
  font-size: 26rpx;
}

.cp-spin {
  animation: cp-rotate 1s linear infinite;
  width: 36rpx;
  height: 36rpx;
}

@keyframes cp-rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

/* ── Header ── */
.cp-header {
  padding: 28rpx 24rpx 0;
}

.cp-header-title {
  font-size: 36rpx;
  font-weight: 800;
  color: #111827;
}

/* ── Hero ── */
.cp-hero {
  position: relative;
  margin: 20rpx 24rpx 28rpx;
  padding: 40rpx 32rpx 28rpx;
  min-height: 440rpx;
  border-radius: 24rpx;
  background: linear-gradient(135deg, #2563EB 0%, #1D5FEA 48%, #1454E8 100%);
  box-shadow: 0 8rpx 32rpx rgba(37, 99, 235, 0.18);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* ═══════════════════════════════════════
   建筑插画整体
   ═══════════════════════════════════════ */

.cp-hero-illustration {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 57%;
  height: 82%;
  z-index: 1;
  pointer-events: none;
}

/* ── 装饰圆点 ── */

.cp-hero-deco-dot {
  position: absolute;
  border-radius: 50%;
  background: rgba(191, 219, 254, 0.65);
}

.cp-deco-dot-1 {
  right: 58rpx;
  top: 28rpx;
  width: 8rpx;
  height: 8rpx;
}

.cp-deco-dot-2 {
  right: 18rpx;
  top: 88rpx;
  width: 6rpx;
  height: 6rpx;
  opacity: 0.55;
}

.cp-deco-dot-3 {
  right: 104rpx;
  top: 6rpx;
  width: 5rpx;
  height: 5rpx;
  opacity: 0.48;
}

/* ── 菱形 ── */

.cp-hero-diamond {
  position: absolute;
  width: 8rpx;
  height: 8rpx;
  border: 1rpx solid rgba(255,255,255,0.60);
  transform: rotate(45deg);
}

.cp-diamond-1 {
  right: 8rpx;
  top: 120rpx;
}

.cp-diamond-2 {
  right: 74rpx;
  top: 52rpx;
}

/* ── 黄色三角装饰 ── */

.cp-hero-triangle {
  position: absolute;
  right: 86rpx;
  top: 8rpx;
  width: 0;
  height: 0;
  border-left: 7rpx solid transparent;
  border-right: 7rpx solid transparent;
  border-bottom: 11rpx solid rgba(253, 230, 138, 0.88);
}


/* ═══════════════════════════════════════
   建筑整体容器
   ═══════════════════════════════════════ */

.cp-hero-buildings {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 100%;
}


/* ═══════════════════════════════════════
   建筑底部蓝色基座
   ═══════════════════════════════════════ */

.cp-building-base {
  position: absolute;
  left: 8%;
  bottom: 12rpx;
  width: 84%;
  height: 20%;
  z-index: 1;
}

/* 基座顶面 */

.cp-building-base-top {
  position: absolute;
  left: 0;
  top: 0;
  width: 78%;
  height: 34rpx;
  background: linear-gradient(
    135deg,
    rgba(122, 170, 242, 0.55),
    rgba(94, 145, 232, 0.42)
  );
  transform: skewX(-30deg);
  transform-origin: left top;
  border-radius: 4rpx;
}

/* 基座正面 */

.cp-building-base-front {
  position: absolute;
  left: 8%;
  top: 22rpx;
  width: 78%;
  height: calc(100% - 22rpx);
  background: linear-gradient(
    180deg,
    rgba(80, 139, 232, 0.62),
    rgba(47, 104, 214, 0.78)
  );
  border-radius: 3rpx 3rpx 0 0;
}

/* 基座右侧面 */

.cp-building-base-side {
  position: absolute;
  left: 86%;
  top: 8rpx;
  width: 14%;
  height: calc(100% - 8rpx);
  background: linear-gradient(
    180deg,
    rgba(70, 126, 224, 0.58),
    rgba(36, 91, 199, 0.68)
  );
  transform: skewY(-18deg);
  transform-origin: left bottom;
  border-radius: 2rpx;
}


/* ═══════════════════════════════════════
   左后方副楼
   ═══════════════════════════════════════ */

.cp-sub-building {
  position: absolute;
  left: 13%;
  bottom: 27%;
  width: 31%;
  height: 46%;
  z-index: 2;
}

/* 副楼正面 */

.cp-sub-front {
  position: absolute;
  left: 0;
  bottom: 0;
  width: 72%;
  height: 100%;
  background: linear-gradient(
    180deg,
    rgba(244, 248, 255, 0.92),
    rgba(219, 232, 251, 0.78)
  );
  border: 1rpx solid rgba(255,255,255,0.48);
  border-radius: 5rpx 5rpx 0 0;
  z-index: 2;
}

/* 副楼顶部 */

.cp-sub-roof {
  position: absolute;
  left: 0;
  top: -20rpx;
  width: 72%;
  height: 24rpx;
  background: linear-gradient(
    135deg,
    rgba(230, 240, 253, 0.92),
    rgba(196, 216, 247, 0.72)
  );
  transform: skewX(-30deg);
  transform-origin: left bottom;
  border: 1rpx solid rgba(255,255,255,0.42);
  border-radius: 4rpx 4rpx 0 0;
  z-index: 3;
}

.cp-sub-roof-inner {
  position: absolute;
  left: 18%;
  top: 5rpx;
  width: 58%;
  height: 12rpx;
  background: rgba(151, 186, 235, 0.28);
  border-radius: 2rpx;
}

/* 副楼侧面 */

.cp-sub-side {
  position: absolute;
  left: 72%;
  top: 0;
  width: 28%;
  height: 100%;
  background: linear-gradient(
    180deg,
    rgba(178, 208, 246, 0.64),
    rgba(139, 179, 232, 0.46)
  );
  transform: skewY(-10deg);
  transform-origin: left bottom;
  z-index: 1;
}

/* ── 副楼右侧立面窗户 ── */
.cp-sub-side-windows {
position: absolute;
left: 12%;
top: 16%;
width: 72%;
height: 70%;
display: grid;
grid-template-columns: repeat(2, 1fr);
grid-template-rows: repeat(4, 1fr);
gap: 7rpx 6rpx;
align-items: center;
justify-items: center;
z-index: 2;
}

.cp-sub-side-windows .cp-side-window {
width: 70%;
height: 70%;
border-radius: 2rpx;
background: linear-gradient(
180deg,
rgba(170, 202, 239, 0.76),
rgba(120, 164, 224, 0.54)
);
box-shadow:
inset 1rpx 1rpx 0 rgba(255,255,255,0.42),
inset -1rpx -1rpx 0 rgba(91, 137, 204, 0.16);
}

/* 副楼窗户 */

.cp-sub-windows {
  position: absolute;
  left: 12%;
  top: 16%;
  width: 72%;
  height: 70%;
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  justify-content: center;
  gap: 7rpx 6rpx;
}

.cp-sub-window {
  width: 18%;
  height: 17%;
  border-radius: 2rpx;
  background: linear-gradient(
    180deg,
    rgba(173, 204, 241, 0.58),
    rgba(137, 178, 231, 0.38)
  );
  box-shadow:
    inset 1rpx 1rpx 0 rgba(255,255,255,0.35);
}


/* ═══════════════════════════════════════
   主楼
   ═══════════════════════════════════════ */

.cp-main-building {
  position: absolute;
  right: 7%;
  bottom: 28%;
  width: 47%;
  height: 70%;
  z-index: 4;
}

/* ── 主楼正面 ── */

.cp-main-front {
  position: absolute;
  left: 0;
  bottom: 0;
  width: 72%;
  height: 100%;
  background: linear-gradient(
    180deg,
    rgba(250, 252, 255, 0.96),
    rgba(232, 238, 250, 0.94) 55%,
    rgba(211, 225, 246, 0.88)
  );
  border-radius: 5rpx 5rpx 0 0;
  border: 1rpx solid rgba(255,255,255,0.62);
  box-shadow:
    inset 2rpx 0 rgba(255,255,255,0.45),
    -4rpx 0 12rpx rgba(53, 103, 199, 0.08);
  z-index: 3;
}

/* ── 主楼右侧立面 ── */

.cp-main-side {
  position: absolute;
  left: 72%;
  bottom: 0;
  width: 28%;
  height: 100%;
  background: linear-gradient(
    180deg,
    rgba(166, 201, 244, 0.82),
    rgba(126, 171, 229, 0.68) 45%,
    rgba(101, 151, 218, 0.54)
  );
  transform: skewY(-13deg);
  transform-origin: left bottom;
  border-right: 1rpx solid rgba(255,255,255,0.38);
  z-index: 2;
}

/* ── 主楼右侧立面窗户 ── */
.cp-main-side-windows {
position: absolute;
left: 12%;
top: 20%;
width: 72%;
height: 60%;
display: grid;
grid-template-columns: repeat(2, 1fr);
grid-template-rows: repeat(4, 1fr);
gap: 7rpx 6rpx;
align-items: center;
justify-items: center;
z-index: 3;
}

.cp-main-side-windows .cp-side-window {
width: 70%;
height: 70%;
border-radius: 2rpx;
background: linear-gradient(
180deg,
rgba(170, 202, 239, 0.76),
rgba(120, 164, 224, 0.54)
);
box-shadow:
inset 1rpx 1rpx 0 rgba(255,255,255,0.42),
inset -1rpx -1rpx 0 rgba(91, 137, 204, 0.16);
}

/* ═══════════════════════════════════════
   主楼玻璃窗
   ═══════════════════════════════════════ */

.cp-main-windows {
  position: absolute;
  left: 13%;
  top: 23%;
  width: 69%;
  height: 61%;
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  justify-content: center;
  gap: 7rpx 6rpx;
}

/* 单个窗户 */

.cp-main-window {
  width: 18%;
  height: 14%;
  border-radius: 2rpx;
  background: linear-gradient(
    180deg,
    rgba(170, 202, 239, 0.76),
    rgba(120, 164, 224, 0.54)
  );
  box-shadow:
  inset 2rpx 0 rgba(255,255,255,0.45),
  inset 0 12rpx 18rpx rgba(82, 128, 199, 0.08),
  -4rpx 0 12rpx rgba(53, 103, 199, 0.08);
}


/* ═══════════════════════════════════════
   主楼入口
   ═══════════════════════════════════════ */

.cp-main-entrance {
  position: absolute;
  left: 9%;
  bottom: 0;
  width: 31%;
  height: 17%;
  z-index: 6;
}

/* 门框 */

.cp-main-door {
  position: absolute;
  left: 0;
  bottom: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    180deg,
    rgba(132, 175, 229, 0.60),
    rgba(82, 133, 207, 0.72)
  );
  border-radius: 3rpx 3rpx 0 0;
  border: 2rpx solid rgba(255,255,255,0.52);
}

/* 玻璃门 */

.cp-main-door-glass {
  position: absolute;
  left: 16%;
  bottom: 0;
  width: 68%;
  height: 82%;
  background: linear-gradient(
    180deg,
    rgba(205, 229, 252, 0.72),
    rgba(110, 163, 222, 0.48)
  );
  border-radius: 2rpx 2rpx 0 0;
}


/* ═══════════════════════════════════════
   主楼入口平台
   ═══════════════════════════════════════ */

.cp-main-platform {
  position: absolute;
  left: -9%;
  bottom: -13rpx;
  width: 46%;
  height: 28rpx;
  z-index: 8;
}

/* 台阶 */

.cp-main-step {
  position: absolute;
  left: 0;
  height: 8rpx;
  border-radius: 2rpx;
  background: linear-gradient(
    135deg,
    rgba(248,251,255,0.94),
    rgba(194,218,248,0.76)
  );
  border: 1rpx solid rgba(255,255,255,0.55);
}

.step-a {
  bottom: 16rpx;
  width: 72%;
}

.step-b {
  bottom: 8rpx;
  left: -5%;
  width: 88%;
}

.step-c {
  bottom: 0;
  left: -10%;
  width: 100%;
}


/* ═══════════════════════════════════════
   建筑地面阴影
   ═══════════════════════════════════════ */

.cp-building-shadow {
  position: absolute;
  left: 5%;
  bottom: 5rpx;
  width: 88%;
  height: 22rpx;
  background: rgba(56, 108, 203, 0.28);
  border-radius: 50%;
  filter: blur(9rpx);
  z-index: 0;
}


/* ═══════════════════════════════════════
   建筑绿植
   ═══════════════════════════════════════ */

.cp-hero-leaf {
  border-radius: 70% 35% 70% 35%;
  box-shadow: 0 2rpx 5rpx rgba(0,0,0,0.10);
}

/* 左侧小黄叶 */

.cp-hero-plant-l {
  position: absolute;
  left: 2%;
  bottom: 25%;
  display: flex;
  align-items: flex-end;
  gap: 3rpx;
  z-index: 10;
}

.ly1 {
  width: 13rpx;
  height: 30rpx;
  background: linear-gradient(
    180deg,
    rgba(254, 243, 199, 0.92),
    rgba(252, 211, 77, 0.68)
  );
  transform: rotate(-12deg);
}

.ly2 {
  width: 10rpx;
  height: 23rpx;
  background: linear-gradient(
    180deg,
    rgba(255, 247, 210, 0.84),
    rgba(253, 230, 138, 0.64)
  );
  transform: rotate(10deg);
}


/* ── 右下四片阔叶 ── */

.cp-hero-plant-r {
  position: absolute;
  right: -1%;
  bottom: 0;
  display: flex;
  align-items: flex-end;
  gap: 2rpx;
  z-index: 12;
}

.lr1 {
  width: 29rpx;
  height: 50rpx;
  background: linear-gradient(
    180deg,
    rgba(180, 230, 184, 0.86),
    rgba(89, 198, 144, 0.62)
  );
  transform: rotate(-15deg);
}

.lr2 {
  width: 22rpx;
  height: 44rpx;
  background: linear-gradient(
    180deg,
    rgba(180, 222, 207, 0.84),
    rgba(103, 187, 202, 0.60)
  );
  transform: rotate(-5deg);
}

.lr3 {
  width: 19rpx;
  height: 41rpx;
  background: linear-gradient(
    180deg,
    rgba(160, 213, 213, 0.82),
    rgba(90, 178, 196, 0.58)
  );
  transform: rotate(10deg);
}

.lr4 {
  width: 17rpx;
  height: 58rpx;
  background: linear-gradient(
    180deg,
    rgba(157, 208, 245, 0.88),
    rgba(71, 167, 207, 0.60)
  );
  transform: rotate(5deg);
}

/* ── 内容层 ── */
.cp-hero-content {
  position: relative;
  z-index: 2;
}

.cp-hero-top-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 14rpx;
  margin-bottom: 16rpx;
}

.cp-hero-name {
  font-size: 40rpx;
  font-weight: 700;
  color: #FFFFFF;
  max-width: 60%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cp-hero-verify {
  display: inline-flex;
  align-items: center;
  gap: 6rpx;
  padding: 8rpx 14rpx;
  border-radius: 10rpx;
  font-size: 20rpx;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.18);
  border: 1rpx solid rgba(255, 255, 255, 0.25);
  color: #FFFFFF;
}
.cp-hero-verify-done {
  background: rgba(255, 255, 255, 0.28);
}
.cp-hero-verify-icon { width: 22rpx; height: 22rpx; }

.cp-hero-completeness {
  display: flex;
  align-items: center;
  gap: 10rpx;
}
.cp-hero-pct {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.92);
  font-weight: 400;
}
.cp-hero-separator {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.4);
}
.cp-hero-count {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.65);
  font-weight: 400;
}

/* ── 白色完善提示卡 ── */
.cp-hero-tip-card {
  margin-top: auto;
  width: 52%;
  padding: 24rpx 22rpx;
  border-radius: 20rpx;
  background: rgba(255, 255, 255, 0.92);
  z-index: 2;
  align-self: flex-start;
}
.cp-hero-tip-title {
  display: block;
  font-size: 26rpx;
  font-weight: 500;
  color: #1F2937;
  line-height: 1.6;
}
.cp-hero-btn {
  display: flex;
  align-items: center;
  gap: 8rpx;
  margin-top: 18rpx;
}
.cp-hero-btn-text {
  font-size: 28rpx;
  font-weight: 700;
  color: #2563EB;
}
.cp-hero-btn-arrow {
  font-size: 28rpx;
  font-weight: 700;
  color: #2563EB;
}
.cp-hero-btn:active .cp-hero-btn-text,
.cp-hero-btn:active .cp-hero-btn-arrow {
  opacity: 0.7;
}

/* ── Section ── */
.cp-section {
  padding: 0 24rpx;
  margin-bottom: 32rpx;
}

.cp-section-title {
  display: block;
  font-size: 28rpx;
  font-weight: 700;
  color: #111827;
  margin-bottom: 18rpx;
}

/* ── Info Card ── */
.cp-info-card {
  border-radius: 20rpx;
  background: #FFFFFF;
  border: 1rpx solid #EEF1F5;
  overflow: hidden;
}

.cp-info-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 88rpx;
  padding: 0 24rpx;
  border-bottom: 1rpx solid #EEF1F5;
}
.cp-info-row:last-child { border-bottom: none; }

.cp-info-left {
  display: flex;
  align-items: center;
  gap: 14rpx;
  flex-shrink: 0;
}

.cp-info-icon {
  width: 32rpx;
  height: 32rpx;
  color: #9CA3AF;
}

.cp-info-label {
  font-size: 27rpx;
  color: #1F2937;
}

.cp-info-right {
  display: flex;
  align-items: center;
  gap: 6rpx;
  min-width: 0;
}

.cp-info-val {
  font-size: 24rpx;
  color: #6B7280;
  text-align: right;
  max-width: 320rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cp-info-arrow {
  width: 22rpx;
  height: 22rpx;
  flex-shrink: 0;
  color: #D1D5DB;
}

.cp-info-link { color: #2563EB; }
.cp-info-muted { color: #9CA3AF; }

/* ── Certification ── */
.cp-verify-card {
  display: flex;
  align-items: center;
  gap: 18rpx;
  padding: 24rpx;
  border-radius: 20rpx;
  border: 1rpx solid #EEF1F5;
  background: #FFFFFF;
  margin-bottom: 16rpx;
}

.cp-verify-card-icon {
  width: 44rpx;
  height: 44rpx;
  flex-shrink: 0;
  color: #9CA3AF;
}
.cp-verify-card-icon-active { color: #2563EB; }

.cp-verify-card-info { flex: 1; }

.cp-verify-card-label {
  display: block;
  font-size: 26rpx;
  font-weight: 600;
  color: #111827;
}

.cp-verify-card-desc {
  display: block;
  margin-top: 4rpx;
  font-size: 22rpx;
  color: #6B7280;
}

.cp-verify-actions {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}

.cp-verify-btn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 88rpx;
  padding: 0 24rpx;
  border-radius: 16rpx;
  border: 1rpx solid #EEF1F5;
  font-size: 26rpx;
  color: #111827;
  background: #FFFFFF;
}
.cp-verify-btn:active { background: #F9FAFB; }
.cp-verify-btn-disabled { opacity: 0.45; }

.cp-verify-btn-left {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.cp-verify-btn-icon { width: 28rpx; height: 28rpx; color: #6B7280; }
.cp-verify-check { width: 28rpx; height: 28rpx; color: #10B981; }
.cp-verify-go { color: #2563EB; font-weight: 600; }

/* ── Stats ── */
.cp-stats-card {
  display: flex;
  align-items: center;
  border-radius: 20rpx;
  background: #FFFFFF;
  border: 1rpx solid #EEF1F5;
  overflow: hidden;
}

.cp-stats-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 28rpx 0;
  gap: 8rpx;
}

.cp-stats-clickable:active { background: #F3F4F6; }

.cp-stats-val {
  font-size: 40rpx;
  font-weight: 700;
  color: #111827;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.cp-stats-label {
  font-size: 22rpx;
  color: #6B7280;
}

.cp-stats-divider {
  width: 1rpx;
  height: 56rpx;
  background: #EEF1F5;
  flex-shrink: 0;
}

/* ── Description Card ── */
.cp-desc-card {
  border-radius: 20rpx;
  background: #FFFFFF;
  border: 1rpx solid #EEF1F5;
  padding: 24rpx;
}

.cp-desc-text {
  font-size: 26rpx;
  color: #111827;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-all;
}

.cp-desc-placeholder {
  font-size: 26rpx;
  color: #9CA3AF;
  font-style: italic;
}

/* ── Benefits ── */
.cp-benefits-card {
  display: flex;
  flex-wrap: wrap;
  gap: 14rpx;
}

.cp-benefit-tag {
  padding: 12rpx 22rpx;
  border-radius: 12rpx;
  background: #F0F4FF;
  border: 1rpx solid #DBEAFE;
}

.cp-benefit-tag-text {
  font-size: 24rpx;
  font-weight: 500;
  color: #2563EB;
}

/* ── Third-party Query ── */
.cp-thirdparty {
  margin-top: 16rpx;
  padding-top: 16rpx;
  border-top: 1rpx solid #EEF1F5;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.cp-thirdparty-btn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 80rpx;
  padding: 0 24rpx;
  border-radius: 16rpx;
  border: 1rpx solid #EEF1F5;
  background: #FFFFFF;
}

.cp-thirdparty-btn:active { background: #F9FAFB; }

.cp-thirdparty-left {
  display: flex;
  align-items: center;
  gap: 12rpx;
  font-size: 26rpx;
  color: #111827;
}

.cp-thirdparty-icon { width: 28rpx; height: 28rpx; color: #6B7280; }
.cp-thirdparty-name { font-size: 24rpx; color: #6B7280; }
</style>
