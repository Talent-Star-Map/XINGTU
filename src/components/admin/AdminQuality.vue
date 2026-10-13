<template>
  <view class="admin-quality">
    <!-- 加载中 -->
    <view v-if="loading" class="loading-full">
      <view class="loading-spinner" />
      <text class="loading-text">加载质检数据...</text>
    </view>

    <template v-else>
      <!-- 顶部 page-header -->
      <view class="page-header">
        <view class="page-header-content">
          <view class="page-header-top">
            <view class="page-header-info">
              <text class="page-title">幻觉防控 · 质检看板</text>
              <text class="page-subtitle">DeepSeek 大模型 + 多源交叉验证 + 置信度评分 + 抄袭/通胀检测</text>
            </view>
          </view>
        </view>
        <view class="quality-hero-visual">
          <view class="hero-circle hero-circle-outer"></view>
          <view class="hero-circle hero-circle-middle"></view>
          <view class="hero-circle hero-circle-inner"></view>
          <view class="hero-shield">
            <AppIcon name="shield-check" />
          </view>
          <view class="hero-dot hero-dot-1"></view>
          <view class="hero-dot hero-dot-2"></view>
          <view class="hero-dot hero-dot-3"></view>
        </view>
      </view>

      <!-- 赛题三项硬指标 -->
      <view class="section">
        <view class="section-title-row">
          <text class="section-title">赛题三项硬指标（要求均 ≥90%）</text>
          <view class="refresh-btn" @tap="handleRefresh">
            <AppIcon name="refresh-cw" />
            <text class="refresh-btn-text">刷新</text>
          </view>
        </view>
        <view class="metrics-grid">
          <!-- JD解析精确率 -->
          <view class="metric-card" :class="jdResult ? (jdPass ? 'metric-card--pass' : 'metric-card--fail') : ''">
            <view class="metric-icon">
              <AppIcon name="target" />
            </view>
            <text class="metric-label">JD解析精确率</text>
            <text class="metric-value" :class="jdResult ? (jdPass ? 'metric-value--pass' : 'metric-value--fail') : ''">
              {{ jdResult ? `${(jdResult.avg_precision * 100).toFixed(1)}%` : '--' }}
            </text>
            <text class="metric-sub">{{ jdResult ? `${jdResult.total_samples}条JD · F1 ${(jdResult.avg_f1 * 100).toFixed(1)}% · 召回 ${(jdResult.avg_recall * 100).toFixed(0)}%` : '赛题要求精确率≥90%，基于DeepSeek+标准答案' }}</text>
            <view v-if="!jdResult" class="test-btn" :class="{ 'test-btn--busy': testing.jd }" @tap="runTest('jd')">
              <text class="test-btn-text">{{ testing.jd ? '测试中...' : '运行测试（较慢）' }}</text>
            </view>
          </view>

          <!-- 简历提取精确率 -->
          <view class="metric-card" :class="resumeResult ? (resumePass ? 'metric-card--pass' : 'metric-card--fail') : ''">
            <view class="metric-icon">
              <AppIcon name="file-text" />
            </view>
            <text class="metric-label">简历提取精确率</text>
            <text class="metric-value" :class="resumeResult ? (resumePass ? 'metric-value--pass' : 'metric-value--fail') : ''">
              {{ resumeResult ? `${(resumeResult.avg_precision * 100).toFixed(1)}%` : '--' }}
            </text>
            <text class="metric-sub">{{ resumeResult ? `${resumeResult.total_samples}份简历 · F1 ${(resumeResult.avg_f1 * 100).toFixed(1)}% · 召回 ${(resumeResult.avg_recall * 100).toFixed(0)}%` : '100份标注简历 · DeepSeek提取+标准答案对比' }}</text>
            <view v-if="!resumeResult" class="test-btn" :class="{ 'test-btn--busy': testing.resume }" @tap="runTest('resume')">
              <text class="test-btn-text">{{ testing.resume ? '测试中...' : '运行测试（较慢）' }}</text>
            </view>
          </view>

          <!-- 人岗匹配准确率 -->
          <view class="metric-card" :class="matchResult ? (matchPass ? 'metric-card--pass' : 'metric-card--fail') : ''">
            <view class="metric-icon">
              <AppIcon name="user" />
            </view>
            <text class="metric-label">人岗匹配准确率</text>
            <text class="metric-value" :class="matchResult ? (matchPass ? 'metric-value--pass' : 'metric-value--fail') : ''">
              {{ matchResult ? `${matchResult.accuracy}%` : '--' }}
            </text>
            <text class="metric-sub">{{ matchResult ? `${matchResult.total_pairs}组配对 · ${matchResult.correct_count}组正确` : '简历技能 vs 岗位技能匹配' }}</text>
            <view v-if="!matchResult" class="test-btn" :class="{ 'test-btn--busy': testing.match }" @tap="runTest('match')">
              <text class="test-btn-text">{{ testing.match ? '测试中...' : '运行测试' }}</text>
            </view>
          </view>

          <!-- 综合达标 -->
          <view class="metric-card metric-card--summary" :class="allRun ? (allPass ? 'metric-card--pass' : 'metric-card--fail') : ''">
            <view class="metric-icon">
              <AppIcon name="check-circle" />
            </view>
            <text class="metric-label">综合达标</text>
            <text class="metric-value" :class="allRun ? (allPass ? 'metric-value--pass' : 'metric-value--fail') : ''">
              {{ allRun ? (allPass ? '全部达标' : '部分达标') : '待测试' }}
            </text>
            <text class="metric-sub">{{ allRun ? `${[jdPass && 'JD', matchPass && '匹配', resumePass && '简历'].filter(Boolean).length}/3 通过` : '请依次点击上方三个测试按钮' }}</text>
          </view>
        </view>
      </view>

      <!-- 多源交叉验证 -->
      <view class="quality-card">
        <view class="quality-card-header">
          <view class="quality-card-header-left">
            <view class="quality-card-icon quality-card-icon--green">
              <AppIcon name="layers" />
            </view>
            <text class="quality-card-title">多源交叉验证</text>
          </view>
          <view class="quality-card-header-right">
            <text class="quality-card-refresh" @tap.stop="handleRefresh">刷新检测</text>
            <view class="quality-card-badge" style="background: rgba(59,130,246,0.1)">
              <text class="quality-card-badge-text" style="color: #1d4ed8">0 项唯一技能</text>
            </view>
          </view>
        </view>

        <view v-if="cv" class="quality-card-body">
          <view class="mini-stats">
            <view class="mini-stat">
              <text class="mini-stat-value" style="color: #059669">{{ cv.verified }}</text>
              <text class="mini-stat-label">已验证(≥2来源)</text>
            </view>
            <view class="mini-stat">
              <text class="mini-stat-value" style="color: #3b82f6">{{ cv.high_confidence }}</text>
              <text class="mini-stat-label">高置信</text>
            </view>
            <view class="mini-stat">
              <text class="mini-stat-value" style="color: #D97706">{{ cv.unconfirmed }}</text>
              <text class="mini-stat-label">待确认</text>
            </view>
          </view>

          <view class="confidence-row">
            <text class="confidence-label">平均置信度</text>
            <text class="confidence-value" :class="cv.avg_confidence >= 0.7 ? 'confidence-value--good' : 'confidence-value--warn'">{{ cv.avg_confidence }}</text>
            <view class="confidence-bar">
              <view class="confidence-bar-fill" :class="cv.avg_confidence >= 0.7 ? 'confidence-bar-fill--good' : 'confidence-bar-fill--warn'" :style="{ width: `${cv.avg_confidence * 100}%` }" />
            </view>
          </view>

          <view class="expand-toggle" @tap="expandedCvDetail = !expandedCvDetail">
            <text class="expand-toggle-text">查看已验证技能详情</text>
            <text class="expand-toggle-arrow">{{ expandedCvDetail ? '▾' : '▸' }}</text>
          </view>

          <scroll-view v-if="expandedCvDetail" class="skill-list" scroll-y>
            <template v-for="(info, skill) in cv.details" :key="skill">
              <view v-if="info.verified" class="skill-item">
                <view class="skill-item-left">
                  <view class="skill-check">
                    <AppIcon name="check" />
                  </view>
                  <text class="skill-name">{{ skill }}</text>
                </view>
                <text class="skill-sources">{{ info.sources.join(', ') }}（{{ info.confidence }}）</text>
              </view>
            </template>
          </scroll-view>
        </view>
      </view>

      <!-- JD抄袭检测 -->
      <view class="quality-card">
        <view class="quality-card-header">
          <view class="quality-card-header-left">
            <view class="quality-card-icon quality-card-icon--purple">
              <AppIcon name="copy" />
            </view>
            <text class="quality-card-title">JD抄袭检测</text>
          </view>
          <view class="quality-card-header-right">
            <text class="quality-card-refresh" @tap.stop="handleRefresh">刷新检测</text>
            <view class="quality-card-badge quality-card-badge--red">
              <text class="quality-card-badge-text">{{ pl?.total_pairs ?? 0 }} 对</text>
            </view>
          </view>
        </view>

        <view class="quality-card-body">
          <view class="flagged-summary">
            <text class="flagged-number" :class="(pl?.total_pairs ?? 0) > 0 ? 'flagged-number--red' : 'flagged-number--green'">{{ pl?.total_pairs ?? 0 }}</text>
            <text class="flagged-desc">对JD被标记为疑似抄袭（相似度 > 90%）</text>
          </view>
          <view v-for="(p, i) in (pl?.pairs || []).slice(0, 2)" :key="i" class="plagiarism-item">
            <view class="plagiarism-job">
              <text class="plagiarism-title">{{ p.title_a }}</text>
              <text class="plagiarism-company">@{{ p.company_a }}</text>
            </view>
            <view class="plagiarism-arrow">
              <text class="plagiarism-arrow-text">↕</text>
            </view>
            <view class="plagiarism-job">
              <text class="plagiarism-title">{{ p.title_b }}</text>
              <text class="plagiarism-company">@{{ p.company_b }}</text>
            </view>
            <view class="plagiarism-score">
              <text class="plagiarism-score-text">相似度 {{ (p.similarity * 100).toFixed(1) }}%</text>
            </view>
          </view>
          <text v-if="(pl?.total_pairs ?? 0) === 0" class="empty-hint" style="color: var(--accent-green)">未检测到抄袭对</text>
        </view>
      </view>

      <!-- 技能通胀检测 -->
      <view class="quality-card">
        <view class="quality-card-header">
          <view class="quality-card-header-left">
            <view class="quality-card-icon quality-card-icon--orange">
              <AppIcon name="trending-up" />
            </view>
            <text class="quality-card-title">技能通胀检测</text>
          </view>
          <view class="quality-card-header-right">
            <text class="quality-card-refresh" @tap.stop="handleRefresh">刷新检测</text>
            <view class="quality-card-badge" style="background: rgba(5,150,105,0.1)">
              <text class="quality-card-badge-text" style="color: #059669">{{ inf?.total_flagged ?? 0 }} 个异常</text>
            </view>
          </view>
        </view>

        <view class="quality-card-body">
          <view class="flagged-summary">
            <text class="flagged-number" :class="(inf?.total_flagged ?? 0) > 0 ? 'flagged-number--orange' : 'flagged-number--green'">{{ inf?.total_flagged ?? 0 }}</text>
            <text class="flagged-desc">个岗位存在技能要求虚高（超均值 2σ）</text>
          </view>
          <view v-for="(j, i) in (inf?.jobs || []).slice(0, 2)" :key="i" class="inflation-item">
            <text class="inflation-title">{{ j.title }}</text>
            <text class="inflation-company">@{{ j.company }}</text>
            <text class="inflation-stats">技能数 {{ j.skill_count }}（组均值 {{ j.group_mean }}）· z={{ j.z_score }}</text>
          </view>
          <text v-if="(inf?.total_flagged ?? 0) === 0" style="color: #059669; font-size: 22rpx">未检测到通胀异常</text>
        </view>
      </view>
    </template>

    <!-- Toast -->
    <view v-if="toast" class="toast-wrap">
      <text class="toast-text">{{ toast }}</text>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import AppIcon from '@/components/common/AppIcon.vue'

const API_BASE_URL = 'http://192.168.156.230:8081'

const report = ref(null)
const loading = ref(true)
const testing = ref({ jd: false, match: false, resume: false })
const jdResult = ref(null)
const matchResult = ref(null)
const resumeResult = ref(null)
const panelLoading = ref(false)
const toast = ref('')
const expandedCvDetail = ref(false)

const cv = computed(() => report.value?.cross_validation || null)
const pl = computed(() => report.value?.plagiarism || null)
const inf = computed(() => report.value?.inflation || null)

const jdPass = computed(() => jdResult.value ? jdResult.value.avg_precision >= 0.9 : false)
const resumePass = computed(() => resumeResult.value ? resumeResult.value.avg_precision >= 0.9 : false)
const matchPass = computed(() => matchResult.value?.pass ?? false)
const allRun = computed(() => !!(jdResult.value && matchResult.value && resumeResult.value))
const allPass = computed(() => jdPass.value && matchPass.value && resumePass.value)

const showToast = (msg) => {
  toast.value = msg
  setTimeout(() => { toast.value = '' }, 3000)
}

const withTokenUrl = (url) => {
  const token = uni.getStorageSync('xingtu_token') || ''
  if (!token) return url
  return `${url}${url.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`
}

const qualityRequest = (url) => {
  return new Promise((resolve, reject) => {
    uni.request({
      url: `${API_BASE_URL}${withTokenUrl(url)}`,
      method: 'GET',
      header: { 'Content-Type': 'application/json' },
      timeout: 60000,
      success: (response) => {
        if (response.statusCode >= 200 && response.statusCode < 300) resolve(response.data)
        else reject(new Error(`请求失败：${response.statusCode}`))
      },
      fail: (error) => reject(new Error(error?.errMsg || '网络错误')),
    })
  })
}

const loadReport = async () => {
  loading.value = true
  try {
    const d = await qualityRequest('/api/quality/report')
    if (d.success) report.value = d.data
  } catch {
    showToast('质检数据加载失败')
  } finally {
    loading.value = false
  }
}

const runTest = async (type) => {
  if (testing.value[type]) return
  testing.value = { ...testing.value, [type]: true }
  try {
    const urlMap = { jd: '/api/quality/accuracy-test', match: '/api/quality/match-test', resume: '/api/quality/resume-test' }
    const d = await qualityRequest(urlMap[type])
    if (d.success) {
      if (type === 'jd') jdResult.value = d.data
      else if (type === 'match') matchResult.value = d.data
      else if (type === 'resume') resumeResult.value = d.data
    } else {
      showToast(`${type} 测试失败`)
    }
  } catch {
    showToast(`${type} 测试失败`)
  } finally {
    testing.value = { ...testing.value, [type]: false }
  }
}

const handleRefresh = async () => {
  jdResult.value = null
  matchResult.value = null
  resumeResult.value = null
  panelLoading.value = true
  try {
    const d = await qualityRequest('/api/quality/report')
    if (d.success) report.value = d.data
  } catch {
    showToast('刷新失败')
  } finally {
    panelLoading.value = false
  }
}

onMounted(() => { loadReport() })
</script>

<style scoped>
.admin-quality {
  position: relative;
  width: 100%;
  min-height: 100vh;
  padding: 24rpx 24rpx 160rpx;
  background: linear-gradient(180deg, #f0faf5 0%, #f6f9f7 40%, #f6f9f7 100%);
  box-sizing: border-box;
}

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

/* ═══════════════════════════════════════
   顶部：幻觉防控 · 质检看板
   ═══════════════════════════════════════ */

.page-header {
  position: relative;
  display: flex;
  width: 100%;
  min-height: 248rpx;
  margin-bottom: 28rpx;
  padding: 28rpx 28rpx 26rpx;
  box-sizing: border-box;
  overflow: hidden;
  border: 1rpx solid rgba(16, 185, 129, 0.12);
  border-radius: 28rpx;
  background:
    linear-gradient(
      135deg,
      rgba(236, 253, 245, 0.98) 0%,
      rgba(248, 255, 252, 0.98) 58%,
      rgba(255, 255, 255, 0.98) 100%
    );
  box-shadow: 0 10rpx 32rpx rgba(16, 185, 129, 0.08);
}

.page-header-content {
  position: relative;
  z-index: 5;
  display: flex;
  width: 100%;
  flex-direction: column;
  min-width: 0;
}

.page-header-top {
  display: flex;
  width: 100%;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18rpx;
  margin-top: 5%;
}

.page-header-info {
  display: flex;
  flex: 1;
  min-width: 0;
  max-width: 72%;
  flex-direction: column;
}

.page-title {
  display: block;
  color: #064e3b;
  font-size: 34rpx;
  font-weight: 800;
  line-height: 1.35;
  letter-spacing: -0.5rpx;
}

.page-subtitle {
  display: block;
  max-width: 100%;
  margin-top: 10rpx;
  color: #5f746b;
  font-size: 21rpx;
  line-height: 1.55;
}

/* 刷新按钮 */
.refresh-btn {
  position: relative;
  z-index: 10;
  display: flex;
  flex-shrink: 0;
  height: 54rpx;
  align-items: center;
  justify-content: center;
  gap: 7rpx;
  padding: 0 18rpx;
  box-sizing: border-box;
  border: 1rpx solid rgba(16, 185, 129, 0.18);
  border-radius: 14rpx;
  background: rgba(255, 255, 255, 0.78);
  box-shadow: 0 4rpx 14rpx rgba(16, 185, 129, 0.06);
}

.refresh-btn .app-icon {
  width: 25rpx;
  height: 25rpx;
  color: #059669;
}

.refresh-btn-text {
  color: #047857;
  font-size: 21rpx;
  font-weight: 600;
}

/* ═══════════════════════════════════════
   右侧绿色盾牌视觉
   ═══════════════════════════════════════ */

.quality-hero-visual {
  position: absolute;
  right: 13rpx;
  top: 50%;
  width: 210rpx;
  height: 210rpx;
  transform: translateY(-50%);
  pointer-events: none;
  z-index: 0;
}

.hero-circle {
  position: absolute;
  border-radius: 50%;
  box-sizing: border-box;
}

.hero-circle-outer {
  left: 4rpx;
  top: 4rpx;
  width: 202rpx;
  height: 202rpx;
  border: 1rpx solid rgba(16, 185, 129, 0.10);
  background: rgba(167, 243, 208, 0.12);
}

.hero-circle-middle {
  left: 27rpx;
  top: 27rpx;
  width: 156rpx;
  height: 156rpx;
  border: 1rpx solid rgba(16, 185, 129, 0.10);
  background: rgba(255, 255, 255, 0.55);
  box-shadow: 0 12rpx 30rpx rgba(16, 185, 129, 0.07);
}

.hero-circle-inner {
  left: 49rpx;
  top: 49rpx;
  width: 112rpx;
  height: 112rpx;
  background: rgba(236, 253, 245, 0.94);
  box-shadow:
    0 10rpx 24rpx rgba(16, 185, 129, 0.12),
    inset 0 0 0 1rpx rgba(16, 185, 129, 0.08);
}

.hero-shield {
  position: absolute;
  left: 68rpx;
  top: 64rpx;
  display: flex;
  width: 75rpx;
  height: 86rpx;
  align-items: center;
  justify-content: center;
  border-radius: 24rpx;
  background: linear-gradient(145deg, #34d399 0%, #059669 100%);
  color: #ffffff;
  box-shadow:
    0 12rpx 24rpx rgba(5, 150, 105, 0.22),
    0 3rpx 8rpx rgba(5, 150, 105, 0.12);
}

.hero-shield .app-icon {
  width: 49rpx;
  height: 49rpx;
  color: #ffffff;
}

.hero-dot {
  position: absolute;
  border-radius: 50%;
  background: #6ee7b7;
}

.hero-dot-1 {
  top: 30rpx;
  right: 27rpx;
  width: 12rpx;
  height: 12rpx;
}

.hero-dot-2 {
  top: 91rpx;
  left: 12rpx;
  width: 9rpx;
  height: 9rpx;
  background: #a7f3d0;
}

.hero-dot-3 {
  right: 38rpx;
  bottom: 25rpx;
  width: 7rpx;
  height: 7rpx;
  background: #34d399;
}

.section {
  margin-bottom: 28rpx;
}
.section-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16rpx;
}
.section-title {
  display: block;
  font-size: 28rpx;
  font-weight: 700;
  color: #065f46;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
}
.metric-card {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 220rpx;
  box-sizing: border-box;
  padding: 24rpx;
  border: 1rpx solid rgba(15, 23, 42, 0.045);
  border-radius: 28rpx;
  background: #fff;
  box-shadow: 0 8rpx 24rpx rgba(31, 41, 55, 0.045);
}
.metric-card--pass {
  border-color: var(--accent-green, #059669);
  background: var(--accent-green-dim, rgba(5, 150, 105, 0.05));
}
.metric-card--fail {
  border-color: var(--accent-red, #DC2626);
  background: var(--accent-red-dim, rgba(220, 38, 38, 0.03));
}
.metric-card--summary {
  display: flex;
  flex-direction: column;
}
.metric-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 76rpx;
  height: 76rpx;
  border-radius: 50%;
  background: var(--accent-green-dim, rgba(5, 150, 105, 0.1));
  color: var(--accent-green, #059669);
  font-size: 32rpx;
  margin-bottom: 16rpx;
  flex-shrink: 0;
}
.metric-icon--green {
  background: var(--accent-green-dim, rgba(5, 150, 105, 0.1));
  color: var(--accent-green, #059669);
}
.metric-icon--red {
  background: var(--accent-red-dim, rgba(220, 38, 38, 0.08));
  color: var(--accent-red, #DC2626);
}
.metric-label {
  display: block;
  font-size: 28rpx;
  font-weight: 700;
  line-height: 1.35;
  color: #1f2937;
  margin-bottom: 8rpx;
}
.metric-value {
  display: block;
  font-size: 42rpx;
  font-weight: 800;
  line-height: 1;
  color: #1f2937;
  margin-bottom: 8rpx;
}
.metric-value--pass {
  color: var(--accent-green, #059669);
}
.metric-value--fail {
  color: var(--accent-red, #DC2626);
}
.metric-sub {
  display: block;
  font-size: 21rpx;
  line-height: 1.55;
  color: #9ca3af;
  word-break: break-all;
}
.test-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 60rpx;
  margin-top: 16rpx;
  border-radius: 30rpx;
  background: linear-gradient(135deg, #34d399 0%, #16a34a 100%);
}
.test-btn--busy {
  opacity: 0.5;
}
.test-btn-text {
  font-size: 24rpx;
  font-weight: 600;
  color: #fff;
}

.quality-card {
  width: 100%;
  box-sizing: border-box;
  background: #fff;
  border-radius: 28rpx;
  border: 1rpx solid rgba(15, 23, 42, 0.045);
  margin-bottom: 20rpx;
  box-shadow: 0 8rpx 24rpx rgba(31, 41, 55, 0.045);
  overflow: hidden;
}
.quality-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx 28rpx;
}
.quality-card-header-left {
  display: flex;
  align-items: center;
  gap: 16rpx;
  flex: 1;
  min-width: 0;
}
.quality-card-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56rpx;
  height: 56rpx;
  border-radius: 16rpx;
  font-size: 26rpx;
  flex-shrink: 0;
}
.quality-card-icon--green {
  background: var(--accent-green-dim, rgba(5, 150, 105, 0.1));
  color: var(--accent-green, #059669);
}
.quality-card-icon--purple {
  background: var(--accent-purple-dim, rgba(91, 33, 182, 0.08));
  color: var(--accent-purple, #5B21B6);
}
.quality-card-icon--orange {
  background: var(--accent-orange-dim, rgba(217, 119, 6, 0.15));
  color: var(--accent-orange, #D97706);
}
.quality-card-title {
  font-size: 28rpx;
  font-weight: 700;
  color: #1f2937;
}
.quality-card-header-right {
  display: flex;
  align-items: center;
  gap: 12rpx;
  flex-shrink: 0;
}
.quality-card-refresh {
  font-size: 22rpx;
  font-weight: 500;
  color: #059669;
}
.quality-card-badge {
  padding: 6rpx 16rpx;
  border-radius: 20rpx;
}
.quality-card-badge--red {
  background: var(--accent-red-dim, rgba(220, 38, 38, 0.08));
}
.quality-card-badge--red .quality-card-badge-text {
  color: var(--accent-red, #DC2626);
}
.quality-card-badge--orange {
  background: var(--accent-orange-dim, rgba(217, 119, 6, 0.15));
}
.quality-card-badge--orange .quality-card-badge-text {
  color: var(--accent-orange, #D97706);
}
.quality-card-badge-text {
  font-size: 22rpx;
  font-weight: 600;
}
.quality-card-arrow {
  font-size: 24rpx;
  color: #9ca3af;
}
.quality-card-body {
  padding: 0 28rpx 24rpx;
}

.mini-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12rpx;
  margin-bottom: 20rpx;
}
.mini-stat {
  text-align: center;
  padding: 16rpx 8rpx;
  border-radius: 16rpx;
  background: var(--color-surface, #F8F9FB);
}
.mini-stat-value {
  display: block;
  font-size: 32rpx;
  font-weight: 800;
}
.mini-stat-label {
  display: block;
  font-size: 20rpx;
  color: #6b7280;
  margin-top: 4rpx;
}

.confidence-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 20rpx;
}
.confidence-label {
  font-size: 24rpx;
  color: #6b7280;
  flex-shrink: 0;
}
.confidence-value {
  font-size: 24rpx;
  font-weight: 700;
  flex-shrink: 0;
}
.confidence-value--good {
  color: var(--accent-green, #059669);
}
.confidence-value--warn {
  color: var(--accent-orange, #D97706);
}
.confidence-bar {
  flex: 1;
  height: 12rpx;
  border-radius: 6rpx;
  background: var(--color-surface-container, #E5EEFF);
  overflow: hidden;
}
.confidence-bar-fill {
  height: 100%;
  border-radius: 6rpx;
  transition: width 0.3s;
}
.confidence-bar-fill--good {
  background: var(--accent-green, #059669);
}
.confidence-bar-fill--warn {
  background: var(--accent-orange, #D97706);
}

.expand-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12rpx 0;
  margin-bottom: 8rpx;
}
.expand-toggle-text {
  font-size: 22rpx;
  color: #6b7280;
}
.expand-toggle-arrow {
  font-size: 22rpx;
  color: #9ca3af;
}

.skill-list {
  max-height: 360rpx;
  margin-top: 8rpx;
}
.skill-item + .skill-item {
  margin-top: 10rpx;
}
.skill-item {
  display: flex;
  flex-direction: column;
  padding: 12rpx 16rpx;
  border-radius: 12rpx;
  background: var(--accent-green-dim, rgba(5, 150, 105, 0.1));
}
.skill-item-left {
  display: flex;
  align-items: center;
  gap: 12rpx;
  min-width: 0;
}
.skill-check {
  color: var(--accent-green, #059669);
  font-size: 20rpx;
  flex-shrink: 0;
}
.skill-name {
  font-size: 24rpx;
  font-weight: 500;
  color: #374151;
}
.skill-sources {
  margin-left: 32rpx;
  margin-top: 4rpx;
  font-size: 22rpx;
  color: #6b7280;
}

.flagged-summary {
  display: flex;
  align-items: baseline;
  gap: 8rpx;
  margin-bottom: 16rpx;
}
.flagged-number {
  font-size: 40rpx;
  font-weight: 800;
  line-height: 1;
}
.flagged-number--red {
  color: var(--accent-red, #DC2626);
}
.flagged-number--orange {
  color: var(--accent-orange, #D97706);
}
.flagged-number--green {
  color: var(--accent-green, #059669);
}
.flagged-desc {
  font-size: 24rpx;
  color: #6b7280;
}

.plagiarism-item {
  background: rgba(220, 38, 38, 0.04);
  border: 1rpx solid rgba(220, 38, 38, 0.1);
  border-radius: 24rpx;
  padding: 28rpx 24rpx;
  margin-bottom: 20rpx;
  width: 100%;
  box-sizing: border-box;
}
.plagiarism-job {
  min-width: 0;
  width: 100%;
  box-sizing: border-box;
}
.plagiarism-title {
  display: inline;
  font-size: 27rpx;
  font-weight: 400;
  line-height: 1.45;
  color: #DC2626;
  word-break: break-all;
  overflow-wrap: break-word;
}
.plagiarism-company {
  display: inline;
  font-size: 24rpx;
  font-weight: 400;
  line-height: 1.45;
  color: #1f2937;
  margin-top: 0;
  word-break: break-all;
  overflow-wrap: break-word;
}
.plagiarism-arrow {
  display: flex;
  justify-content: center;
  margin: 2rpx 0;
}
.plagiarism-arrow-text {
  font-size: 28rpx;
  color: #94a3b8;
}
.plagiarism-score {
  display: flex;
  justify-content: flex-end;
  margin-top: 16rpx;
}
.plagiarism-score-text {
  font-size: 24rpx;
  font-weight: 600;
  color: #DC2626;
  background: rgba(220, 38, 38, 0.08);
  padding: 8rpx 18rpx;
  border-radius: 20rpx;
}

.inflation-item {
  background: rgba(217, 119, 6, 0.05);
  border: 1rpx solid rgba(217, 119, 6, 0.1);
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
}
.inflation-title {
  display: block;
  font-size: 26rpx;
  font-weight: 600;
  color: #D97706;
  word-break: break-all;
}
.inflation-company {
  display: block;
  font-size: 22rpx;
  color: #6b7280;
  margin-top: 4rpx;
  word-break: break-all;
}
.inflation-stats {
  display: block;
  font-size: 22rpx;
  color: #9ca3af;
  margin-top: 8rpx;
}

.empty-hint {
  font-size: 24rpx;
}

.toast-wrap {
  position: fixed;
  top: 200rpx;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(17, 24, 39, 0.88);
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