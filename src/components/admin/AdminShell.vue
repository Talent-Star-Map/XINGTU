<template>
  <view class="admin-layout">
    <!-- 顶部品牌栏 -->
    <view class="admin-header">
      <view class="header-main">
        <!-- 品牌区 -->
        <view class="brand">
          <view class="brand-icon">
            <AppIcon name="star" />
          </view>
          <text class="brand-name">星图</text>
          <text class="role-badge">管理员</text>
        </view>

        <!-- 右侧用户区 -->
        <view class="header-right">
          <view class="profile-wrap">
            <view class="profile-btn" @tap="showUserMenu = !showUserMenu">
              <view class="profile-avatar">
                <text>管</text>
              </view>
            </view>

            <view v-if="showUserMenu" class="profile-menu">
              <view class="profile-menu-item" @tap="handleLogout">
                <AppIcon name="logout" />
                <text>退出登录</text>
              </view>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- 页面内容 -->
    <scroll-view class="admin-content" scroll-y>
      <!-- ==================== 首页 ==================== -->
      <view v-if="activeTab === 'home'" class="home-page">
        <!-- 页面标题 -->
        <view class="page-heading">
          <text class="page-title">智能质量控制中心</text>
          <text class="page-description">模型、数据与人岗匹配质量总览</text>
        </view>

        <!-- 智能质量控制中心核心卡片 -->
        <view class="quality-center-card">
          <view class="quality-card-decoration quality-card-decoration-one"></view>
          <view class="quality-card-decoration quality-card-decoration-two"></view>

          <view class="quality-card-top">
            <view class="quality-card-title-wrap">
              <view class="quality-card-icon">
                <AppIcon name="shield-check" />
              </view>
              <view>
                <text class="quality-card-title">智能质量控制中心</text>
                <text class="quality-card-subtitle">持续监控星图 AI 服务运行状态</text>
              </view>
            </view>

            <view class="system-status">
              <view class="status-dot"></view>
              <text>系统运行正常</text>
            </view>
          </view>

          <view class="service-grid">
            <view class="service-item">
              <text class="service-label">模型服务</text>
              <view class="service-status">
                <view class="mini-status-dot"></view>
                <text>正常</text>
              </view>
            </view>

            <view class="service-item">
              <text class="service-label">数据服务</text>
              <view class="service-status">
                <view class="mini-status-dot"></view>
                <text>正常</text>
              </view>
            </view>

            <view class="service-item">
              <text class="service-label">匹配服务</text>
              <view class="service-status">
                <view class="mini-status-dot"></view>
                <text>正常</text>
              </view>
            </view>

            <view class="service-item">
              <text class="service-label">质检服务</text>
              <view class="service-status">
                <view class="mini-status-dot"></view>
                <text>可用</text>
              </view>
            </view>
          </view>

          <view class="quality-card-action" @tap="goToQuality">
            <text>查看质量检测</text>
            <AppIcon name="arrow-right" />
          </view>
        </view>

        <!-- 质量检测概览 -->
        <view class="section">
          <view class="section-heading">
            <view>
              <text class="section-title">质量检测概览</text>
              <text class="section-description">赛题三项核心指标当前测试状态</text>
            </view>
            <view class="section-link" @tap="goToQuality">
              <text>查看全部</text>
              <AppIcon name="arrow-right" />
            </view>
          </view>

          <view class="metric-grid">
            <view class="metric-card">
              <view class="metric-card-header">
                <view class="metric-icon metric-icon-green">
                  <AppIcon name="file-text" />
                </view>
                <text class="metric-status">待测试</text>
              </view>
              <text class="metric-title">JD解析精确率</text>
              <text class="metric-value">--</text>
              <text class="metric-hint">要求精确率 ≥ 90%</text>
            </view>

            <view class="metric-card">
              <view class="metric-card-header">
                <view class="metric-icon metric-icon-blue">
                  <AppIcon name="user" />
                </view>
                <text class="metric-status">待测试</text>
              </view>
              <text class="metric-title">简历提取精确率</text>
              <text class="metric-value">--</text>
              <text class="metric-hint">100份标注简历对比</text>
            </view>

            <view class="metric-card metric-card-wide">
              <view class="metric-card-header">
                <view class="metric-icon metric-icon-purple">
                  <AppIcon name="target" />
                </view>
                <text class="metric-status">待测试</text>
              </view>
              <text class="metric-title">人岗匹配准确率</text>
              <text class="metric-value">--</text>
              <text class="metric-hint">简历技能与岗位技能匹配测试</text>
            </view>
          </view>
        </view>

        <!-- 风险检测摘要 -->
        <view class="section">
          <view class="section-heading">
            <view>
              <text class="section-title">风险检测</text>
              <text class="section-description">多源验证与异常检测摘要</text>
            </view>
            <view class="section-link" @tap="goToQuality">
              <text>查看详情</text>
              <AppIcon name="arrow-right" />
            </view>
          </view>

          <view class="risk-list">
            <view class="risk-item">
              <view class="risk-icon risk-icon-green">
                <AppIcon name="layers" />
              </view>
              <view class="risk-content">
                <text class="risk-title">多源交叉验证</text>
                <text class="risk-description">技能信息经过多来源交叉验证</text>
              </view>
              <view class="risk-number-wrap">
                <text class="risk-number">30</text>
                <text class="risk-unit">已验证</text>
              </view>
            </view>

            <view class="risk-item">
              <view class="risk-icon risk-icon-orange">
                <AppIcon name="copy" />
              </view>
              <view class="risk-content">
                <text class="risk-title">JD抄袭检测</text>
                <text class="risk-description">发现疑似高相似度职位描述</text>
              </view>
              <view class="risk-number-wrap risk-warning">
                <text class="risk-number">2</text>
                <text class="risk-unit">对异常</text>
              </view>
            </view>

            <view class="risk-item">
              <view class="risk-icon risk-icon-green">
                <AppIcon name="trending-up" />
              </view>
              <view class="risk-content">
                <text class="risk-title">技能通胀检测</text>
                <text class="risk-description">岗位技能要求异常检测</text>
              </view>
              <view class="risk-number-wrap">
                <text class="risk-number">0</text>
                <text class="risk-unit">个异常</text>
              </view>
            </view>
          </view>
        </view>

        <!-- 快捷操作 -->
        <view class="section quick-section">
          <view class="section-heading">
            <view>
              <text class="section-title">快捷操作</text>
              <text class="section-description">快速进入核心管理功能</text>
            </view>
          </view>

          <view class="quick-actions">
            <view class="quick-action quick-action-primary" @tap="switchTab('model')">
              <view class="quick-action-icon">
                <AppIcon name="cpu" />
              </view>
              <view class="quick-action-content">
                <text class="quick-action-title">模型配置</text>
                <text class="quick-action-description">管理 LLM 路由与模型参数</text>
              </view>
              <AppIcon name="arrow-right" class="quick-action-arrow" />
            </view>

            <view class="quick-action" @tap="goToQuality">
              <view class="quick-action-icon">
                <AppIcon name="shield-check" />
              </view>
              <view class="quick-action-content">
                <text class="quick-action-title">开始质检</text>
                <text class="quick-action-description">查看准确率与幻觉防控检测</text>
              </view>
              <AppIcon name="arrow-right" class="quick-action-arrow" />
            </view>
          </view>
        </view>
      </view>

      <!-- ==================== 数据 ==================== -->
      <view v-else-if="activeTab === 'data'" class="sub-page">
        <!-- 数据子页面：求职者管理 -->
        <view v-if="activeDataPage === 'jobseekers'" class="data-sub-page">
          <view class="sub-page-header">
            <view class="back-btn" @tap="closeDataPage">
              <AppIcon name="chevron-left" />
              <text class="back-btn-text">数据管理</text>
            </view>
          </view>
          <AdminUserManage :on-back="closeDataPage" />
        </view>

        <!-- 数据子页面：学习资源管理 -->
        <view v-else-if="activeDataPage === 'resources'" class="data-sub-page">
          <AdminResourceManage :on-back="closeDataPage" />
        </view>

        <!-- 数据子页面：企业管理 -->
        <view v-else-if="activeDataPage === 'enterprises'" class="data-sub-page">
          <view class="sub-page-header">
            <view class="back-btn" @tap="closeDataPage">
              <AppIcon name="chevron-left" />
              <text class="back-btn-text">数据管理</text>
            </view>
          </view>
          <AdminUserManage role="enterprise" :on-back="closeDataPage" />
        </view>

        <!-- 数据子页面：职位管理 -->
        <view v-else-if="activeDataPage === 'jobs'" class="data-sub-page">
          <view class="sub-page-header">
            <view class="back-btn" @tap="closeDataPage">
              <AppIcon name="chevron-left" />
              <text class="back-btn-text">数据管理</text>
            </view>
          </view>
          <AdminJobManage :on-back="closeDataPage" />
        </view>

        <!-- 数据导航页 -->
        <view v-else>
          <view class="page-heading">
            <text class="page-title">数据管理</text>
            <text class="page-description">管理星图平台核心业务数据</text>
          </view>

          <view class="data-grid">
            <view class="data-card" @tap="openDataPage('jobseekers')">
              <view class="data-card-icon data-icon-green">
                <AppIcon name="users" />
              </view>
              <text class="data-card-title">求职者</text>
              <text class="data-card-description">用户信息、求职意向与简历</text>
              <view class="data-card-link">
                <text>进入管理</text>
                <AppIcon name="arrow-right" />
              </view>
            </view>

            <view class="data-card" @tap="openDataPage('enterprises')">
              <view class="data-card-icon data-icon-blue">
                <AppIcon name="building" />
              </view>
              <text class="data-card-title">企业</text>
              <text class="data-card-description">企业信息、认证状态与资料</text>
              <view class="data-card-link">
                <text>进入管理</text>
                <AppIcon name="arrow-right" />
              </view>
            </view>

            <view class="data-card" @tap="openDataPage('jobs')">
              <view class="data-card-icon data-icon-orange">
                <AppIcon name="briefcase" />
              </view>
              <text class="data-card-title">职位</text>
              <text class="data-card-description">招聘职位、发布状态与信息</text>
              <view class="data-card-link">
                <text>进入管理</text>
                <AppIcon name="arrow-right" />
              </view>
            </view>

            <view class="data-card" @tap="openDataPage('resources')">
              <view class="data-card-icon data-icon-purple">
                <AppIcon name="book" />
              </view>
              <text class="data-card-title">学习资源</text>
              <text class="data-card-description">技能、课程与学习资料</text>
              <view class="data-card-link">
                <text>进入管理</text>
                <AppIcon name="arrow-right" />
              </view>
            </view>
          </view>
        </view>
      </view>

      <!-- ==================== 模型 ==================== -->
      <view v-else-if="activeTab === 'model'" class="sub-page">
        <AdminModelConfig />
      </view>

      <!-- ==================== 质检 ==================== -->
      <view v-else-if="activeTab === 'quality'" class="sub-page">
        <AdminQuality />
      </view>
    </scroll-view>

    <!-- 底部四项导航 -->
    <view class="bottom-nav">
      <view
        class="bottom-nav-item"
        :class="{ 'bottom-nav-item--active': activeTab === 'home' }"
        @tap="switchTab('home')"
      >
        <view class="bottom-nav-icon">
          <AppIcon name="home" />
        </view>
        <text class="bottom-nav-label">首页</text>
      </view>

      <view
        class="bottom-nav-item"
        :class="{ 'bottom-nav-item--active': activeTab === 'data' }"
        @tap="switchTab('data')"
      >
        <view class="bottom-nav-icon">
          <AppIcon name="database" />
        </view>
        <text class="bottom-nav-label">数据</text>
      </view>

      <view
        class="bottom-nav-item"
        :class="{ 'bottom-nav-item--active': activeTab === 'model' }"
        @tap="switchTab('model')"
      >
        <view class="bottom-nav-icon">
          <AppIcon name="cpu" />
        </view>
        <text class="bottom-nav-label">模型</text>
      </view>

      <view
        class="bottom-nav-item"
        :class="{ 'bottom-nav-item--active': activeTab === 'quality' }"
        @tap="switchTab('quality')"
      >
        <view class="bottom-nav-icon">
          <AppIcon name="shield-check" />
        </view>
        <text class="bottom-nav-label">质检</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import AppIcon from '@/components/common/AppIcon.vue'
import AdminUserManage from '@/components/admin/AdminUserManage.vue'
import AdminModelConfig from '@/components/admin/AdminModelConfig.vue'
import AdminResourceManage from '@/components/admin/AdminResourceManage.vue'
import AdminJobManage from '@/components/admin/AdminJobManage.vue'
import AdminQuality from '@/components/admin/AdminQuality.vue'

const activeTab = ref('home')
const activeDataPage = ref('')
const showUserMenu = ref(false)

function switchTab(tab) {
  activeTab.value = tab
  if (tab !== 'data') {
    activeDataPage.value = ''
  }
}

function handleLogout() {
  showUserMenu.value = false
  uni.showModal({
    title: '提示',
    content: '确定退出当前管理员账号吗？',
    success: (res) => {
      if (res.confirm) {
        uni.removeStorageSync('xingtu_token')
        uni.removeStorageSync('xingtu_role')
        uni.removeStorageSync('xingtu_user')
        uni.reLaunch({
          url: '/pages/role-select/role-select'
        })
      }
    }
  })
}

function goToQuality() {
  activeTab.value = 'quality'
}

function openDataPage(page) {
  activeDataPage.value = page
}

function closeDataPage() {
  activeDataPage.value = ''
}
</script>

<style scoped>
.admin-layout {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100vh;
  overflow: hidden;
  background: var(--color-background, #f6f9f7);
  color: var(--color-on-surface, #1f2937);
}

/* ==================== 顶部品牌栏 ==================== */

.admin-header {
  flex-shrink: 0;
  padding-top: env(safe-area-inset-top);
  border-bottom: 1px solid var(--color-outline-variant, #e1e2e4);
  background: var(--color-surface, #f8f9fb);
  z-index: 20;
}

.header-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 128rpx;
  padding: 0 48rpx 0 40rpx;
}


.brand {
  display: flex;
  align-items: center;
  gap: 18rpx;
  padding-left: 8rpx;
}

.brand-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 80rpx;
  height: 80rpx;
  border-radius: 20rpx;
  background: var(--accent-green-dim, rgba(5, 150, 105, 0.08));
  color: var(--accent-green, #059669);
  font-size: 44rpx;
}

.brand-name {
  font-size: 40rpx;
  line-height: 1;
  font-weight: 800;
  background-image: linear-gradient(135deg, var(--color-primary, #0052D9), var(--accent-purple, #5B21B6));
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  color: transparent;
}

.role-badge {
  margin-left: 2rpx;
  transform: translateY(-15%);
  padding: 6rpx 24rpx;
  border-radius: 8rpx;
  background: var(--accent-green-dim, rgba(5, 150, 105, 0.08));
  color: var(--accent-green, #059669);
  font-size: 24rpx;
  font-weight: 600;
  line-height: 1.4;
  white-space: nowrap;
}

.header-right {
  display: flex;
  align-items: center;
  transform: translateX(10%);
}

.profile-wrap {
  position: relative;
}

.profile-btn {
  display: flex;
  align-items: center;
  padding: 14rpx 28rpx;
  border-radius: 16rpx;
}

.profile-btn:active {
  background: var(--color-surface-container, #e5eeff);
}

.profile-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  background: var(--accent-green-dim, rgba(5, 150, 105, 0.08));
  color: var(--accent-green, #059669);
  font-size: 26rpx;
  font-weight: 700;
}

.profile-menu {
  position: absolute;
  top: 100%;
  right: 0;
  z-index: 100;
  margin-top: 16rpx;
  min-width: 360rpx;
  padding: 12rpx;
  border-radius: 24rpx;
  border: 1px solid var(--color-outline-variant, #e1e2e4);
  background: var(--color-surface-container-lowest, #ffffff);
  box-shadow: 0 16rpx 48rpx rgba(31, 41, 55, 0.12);
}

.profile-menu-item {
  display: flex;
  align-items: center;
  gap: 24rpx;
  padding: 20rpx 32rpx;
  border-radius: 16rpx;
  color: var(--color-on-surface-variant, #434654);
  font-size: 26rpx;
  white-space: nowrap;
}

.profile-menu-item:active {
  background: var(--color-surface-container, #e5eeff);
}

.profile-menu-item .app-icon {
  width: 32rpx;
  height: 32rpx;
}

/* ==================== 内容区域 ==================== */

.admin-content {
  flex: 1;
  min-height: 0;
  box-sizing: border-box;
  padding: 32rpx 28rpx 48rpx;
  background:
    radial-gradient(circle at 100% 0%, rgba(5, 150, 105, 0.05), transparent 32%),
    #f6f9f7;
}

/* ==================== 页面标题 ==================== */

.page-heading {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  margin-bottom: 28rpx;
}

.page-title {
  font-size: 42rpx;
  line-height: 1.25;
  font-weight: 800;
  letter-spacing: -0.5rpx;
  color: #17211c;
}

.page-description {
  font-size: 24rpx;
  line-height: 1.55;
  color: #7a8a82;
}

/* ==================== 智能质量控制中心 ==================== */

.quality-center-card {
  position: relative;
  overflow: hidden;
  margin-bottom: 44rpx;
  padding: 32rpx;
  border-radius: 30rpx;
  background: linear-gradient(145deg, #087f5b 0%, #059669 52%, #0ca678 100%);
  box-shadow: 0 18rpx 45rpx rgba(5, 150, 105, 0.18);
  color: #ffffff;
}

.quality-card-decoration {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
}

.quality-card-decoration-one {
  width: 260rpx;
  height: 260rpx;
  right: -110rpx;
  top: -110rpx;
  background: rgba(255, 255, 255, 0.08);
}

.quality-card-decoration-two {
  width: 180rpx;
  height: 180rpx;
  left: -90rpx;
  bottom: -110rpx;
  background: rgba(255, 255, 255, 0.06);
}

.quality-card-top {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 24rpx;
  z-index: 1;
}

.quality-card-title-wrap {
  display: flex;
  align-items: center;
  gap: 18rpx;
}

.quality-card-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 76rpx;
  height: 76rpx;
  flex-shrink: 0;
  border-radius: 22rpx;
  background: rgba(255, 255, 255, 0.14);
  color: #ffffff;
  font-size: 38rpx;
}

.quality-card-title {
  display: block;
  margin-bottom: 7rpx;
  font-size: 32rpx;
  font-weight: 750;
  color: #ffffff;
}

.quality-card-subtitle {
  display: block;
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.76);
}

.system-status {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  gap: 10rpx;
  padding: 9rpx 16rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.13);
  font-size: 21rpx;
  color: #ffffff;
}

.status-dot,
.mini-status-dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  background: #d8f9e9;
  box-shadow: 0 0 0 5rpx rgba(216, 249, 233, 0.1);
}

.service-grid {
  position: relative;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14rpx;
  margin-top: 28rpx;
  z-index: 1;
}

.service-item {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  padding: 20rpx;
  border: 1px solid rgba(255, 255, 255, 0.11);
  border-radius: 18rpx;
  background: rgba(255, 255, 255, 0.09);
}

.service-label {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.72);
}

.service-status {
  display: flex;
  align-items: center;
  gap: 8rpx;
  font-size: 25rpx;
  font-weight: 650;
  color: #ffffff;
}

.quality-card-action {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 24rpx;
  padding: 22rpx 4rpx 2rpx;
  border-top: 1px solid rgba(255, 255, 255, 0.13);
  font-size: 25rpx;
  font-weight: 650;
  z-index: 1;
}

/* ==================== 区块 ==================== */

.section {
  margin-bottom: 42rpx;
}

.section-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20rpx;
  margin-bottom: 22rpx;
}

.section-title {
  display: block;
  margin-bottom: 6rpx;
  font-size: 30rpx;
  font-weight: 750;
  color: #1c2923;
}

.section-description {
  display: block;
  font-size: 21rpx;
  color: #8a9891;
}

.section-link {
  display: flex;
  align-items: center;
  gap: 5rpx;
  flex-shrink: 0;
  color: #059669;
  font-size: 21rpx;
  font-weight: 600;
}

/* ==================== 质量指标 ==================== */

.metric-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16rpx;
}

.metric-card {
  min-height: 220rpx;
  box-sizing: border-box;
  padding: 24rpx;
  border: 1px solid rgba(15, 23, 42, 0.045);
  border-radius: 24rpx;
  background: #ffffff;
  box-shadow: 0 8rpx 24rpx rgba(31, 41, 55, 0.045);
}

.metric-card-wide {
  grid-column: 1 / -1;
  min-height: 190rpx;
}

.metric-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 22rpx;
}

.metric-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 58rpx;
  height: 58rpx;
  border-radius: 17rpx;
  font-size: 28rpx;
}

.metric-icon-green {
  background: rgba(5, 150, 105, 0.09);
  color: #059669;
}

.metric-icon-blue {
  background: rgba(59, 130, 246, 0.09);
  color: #3b82f6;
}

.metric-icon-purple {
  background: rgba(124, 58, 237, 0.09);
  color: #7c3aed;
}

.metric-status {
  padding: 7rpx 12rpx;
  border-radius: 999rpx;
  background: #f4f7f5;
  color: #8a9891;
  font-size: 19rpx;
}

.metric-title {
  display: block;
  margin-bottom: 10rpx;
  font-size: 23rpx;
  color: #52615a;
}

.metric-value {
  display: block;
  margin-bottom: 8rpx;
  font-size: 40rpx;
  line-height: 1;
  font-weight: 750;
  color: #26342d;
}

.metric-hint {
  display: block;
  font-size: 19rpx;
  line-height: 1.45;
  color: #98a39e;
}

/* ==================== 风险检测 ==================== */

.risk-list {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.risk-item {
  display: flex;
  align-items: center;
  gap: 18rpx;
  padding: 22rpx;
  border: 1px solid rgba(15, 23, 42, 0.045);
  border-radius: 22rpx;
  background: #ffffff;
  box-shadow: 0 7rpx 20rpx rgba(31, 41, 55, 0.04);
}

.risk-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 60rpx;
  height: 60rpx;
  flex-shrink: 0;
  border-radius: 17rpx;
  font-size: 28rpx;
}

.risk-icon-green {
  background: rgba(5, 150, 105, 0.09);
  color: #059669;
}

.risk-icon-orange {
  background: rgba(245, 158, 11, 0.1);
  color: #d97706;
}

.risk-content {
  flex: 1;
  min-width: 0;
}

.risk-title {
  display: block;
  margin-bottom: 5rpx;
  font-size: 24rpx;
  font-weight: 650;
  color: #29372f;
}

.risk-description {
  display: block;
  overflow: hidden;
  font-size: 20rpx;
  line-height: 1.45;
  color: #929d97;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.risk-number-wrap {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  flex-shrink: 0;
}

.risk-number {
  font-size: 34rpx;
  line-height: 1.1;
  font-weight: 750;
  color: #059669;
}

.risk-unit {
  margin-top: 4rpx;
  font-size: 18rpx;
  color: #98a39e;
}

.risk-warning .risk-number {
  color: #d97706;
}

/* ==================== 快捷操作 ==================== */

.quick-section {
  padding-bottom: 20rpx;
}

.quick-actions {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}

.quick-action {
  display: flex;
  align-items: center;
  gap: 18rpx;
  padding: 24rpx;
  border: 1px solid rgba(15, 23, 42, 0.045);
  border-radius: 24rpx;
  background: #ffffff;
  box-shadow: 0 7rpx 20rpx rgba(31, 41, 55, 0.04);
}

.quick-action-primary {
  border-color: rgba(5, 150, 105, 0.1);
}

.quick-action-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 62rpx;
  height: 62rpx;
  flex-shrink: 0;
  border-radius: 18rpx;
  background: rgba(5, 150, 105, 0.09);
  color: #059669;
  font-size: 29rpx;
}

.quick-action-content {
  flex: 1;
  min-width: 0;
}

.quick-action-title {
  display: block;
  margin-bottom: 6rpx;
  font-size: 25rpx;
  font-weight: 700;
  color: #29372f;
}

.quick-action-description {
  display: block;
  font-size: 20rpx;
  color: #929d97;
}

.quick-action-arrow {
  flex-shrink: 0;
  color: #9aa59f;
  font-size: 27rpx;
}

/* ==================== 数据页面 ==================== */

.sub-page {
  min-height: 100%;
}

.data-sub-page {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.sub-page-header {
  flex-shrink: 0;
  padding: 20rpx 32rpx;
  border-bottom: 1px solid var(--color-outline-variant, #e1e2e4);
  background: var(--color-surface, #f8f9fb);
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 6rpx;
  color: var(--accent-green, #059669);
  font-size: 24rpx;
  font-weight: 600;
}

.back-btn:active {
  opacity: 0.7;
}

.back-btn-text {
  font-size: 24rpx;
}

.data-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16rpx;
}

.data-card {
  display: flex;
  flex-direction: column;
  min-height: 300rpx;
  box-sizing: border-box;
  padding: 24rpx;
  border: 1px solid rgba(15, 23, 42, 0.045);
  border-radius: 25rpx;
  background: #ffffff;
  box-shadow: 0 8rpx 24rpx rgba(31, 41, 55, 0.045);
}

.data-card-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 62rpx;
  height: 62rpx;
  margin-bottom: 22rpx;
  border-radius: 18rpx;
  font-size: 30rpx;
}

.data-icon-green {
  background: rgba(5, 150, 105, 0.09);
  color: #059669;
}

.data-icon-blue {
  background: rgba(59, 130, 246, 0.09);
  color: #3b82f6;
}

.data-icon-orange {
  background: rgba(245, 158, 11, 0.1);
  color: #d97706;
}

.data-icon-purple {
  background: rgba(124, 58, 237, 0.09);
  color: #7c3aed;
}

.data-card-title {
  display: block;
  margin-bottom: 9rpx;
  font-size: 29rpx;
  font-weight: 750;
  color: #26342d;
}

.data-card-description {
  display: block;
  flex: 1;
  font-size: 20rpx;
  line-height: 1.55;
  color: #929d97;
}

.data-card-link {
  display: flex;
  align-items: center;
  gap: 6rpx;
  margin-top: 22rpx;
  color: #059669;
  font-size: 20rpx;
  font-weight: 650;
}

/* ==================== 模型 / 质检 ==================== */

.feature-card {
  display: flex;
  flex-direction: column;
  padding: 36rpx;
  border: 1px solid rgba(5, 150, 105, 0.08);
  border-radius: 28rpx;
  background: #ffffff;
  box-shadow: 0 10rpx 30rpx rgba(31, 41, 55, 0.05);
}

.feature-card-quality {
  border-color: rgba(5, 150, 105, 0.12);
}

.feature-card-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 76rpx;
  height: 76rpx;
  margin-bottom: 24rpx;
  border-radius: 22rpx;
  background: rgba(5, 150, 105, 0.09);
  color: #059669;
  font-size: 36rpx;
}

.feature-card-title {
  display: block;
  margin-bottom: 12rpx;
  font-size: 32rpx;
  font-weight: 750;
  color: #26342d;
}

.feature-card-description {
  display: block;
  margin-bottom: 28rpx;
  font-size: 23rpx;
  line-height: 1.7;
  color: #7f8d86;
}

.feature-card-button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 21rpx 22rpx;
  border-radius: 18rpx;
  background: rgba(5, 150, 105, 0.08);
  color: #059669;
  font-size: 23rpx;
  font-weight: 650;
}

/* ==================== 底部导航 ==================== */

.bottom-nav {
  display: flex;
  align-items: stretch;
  justify-content: space-around;
  flex-shrink: 0;
  padding: 10rpx 18rpx calc(10rpx + env(safe-area-inset-bottom));
  border-top: 1px solid rgba(15, 23, 42, 0.055);
  background: rgba(255, 255, 255, 0.98);
  box-shadow: 0 -8rpx 28rpx rgba(31, 41, 55, 0.045);
  z-index: 30;
}

.bottom-nav-item {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5rpx;
  min-width: 0;
  min-height: 88rpx;
  border-radius: 18rpx;
  color: #8b9791;
}

.bottom-nav-item:active {
  background: rgba(0, 153, 88, 0.05);
}

.bottom-nav-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 54rpx;
  height: 42rpx;
  border-radius: 14rpx;
  font-size: 29rpx;
}

.bottom-nav-label {
  font-size: 20rpx;
  line-height: 1;
}

.bottom-nav-item--active {
  color: #009958;
}

.bottom-nav-item--active .bottom-nav-icon {
  background: rgba(0, 153, 88, 0.1);
}

.bottom-nav-item--active .bottom-nav-label {
  font-weight: 700;
}
</style>
