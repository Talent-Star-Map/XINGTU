<template>
  <view class="shell" :class="themeClass">
    <JobseekerHeader
      :current-page="currentPage"
      :theme="theme"
      :avatar-text="avatarText"
      :menu-open="menuOpen"
      @change-page="setPage"
      @toggle-theme="toggleTheme"
      @toggle-menu="menuOpen = !menuOpen"
    />

    <JobseekerUserMenu
      :open="menuOpen"
      :theme="theme"
      :avatar-text="avatarText"
      @close="menuOpen = false"
      @change-page="setPage"
      @toggle-theme="toggleTheme"
      @logout="logout"
    />

    <scroll-view
      class="shell-main"
      scroll-y
      :show-scrollbar="false"
    >
      <LearningProvider>
        <Dashboard v-if="currentPage === 'dashboard'" />
        <JobMatch v-else-if="currentPage === 'match'" />
        <JobDetail v-else-if="currentPage === 'job-detail'" />
        <Diagnosis v-else-if="currentPage === 'diagnosis'" />
        <LearningPath v-else-if="currentPage === 'learning'" />
        <LearningReport v-else-if="currentPage === 'learning-report'" />
        <ProfileHome v-else-if="currentPage === 'profile-home'" />
        <ProfileEdit v-else-if="currentPage === 'profile-edit'" />
        <Resume v-else-if="currentPage === 'resume'" />
        <SkillGraph v-else-if="currentPage === 'skill-graph'" />
        <MySkillGraphPage v-else-if="currentPage === 'my-skill-graph'" />
        <ResumeCenterPage v-else-if="currentPage === 'resume-center'" />
        <Trend v-else-if="currentPage === 'trend'" />
        <FeaturePlaceholder
          v-else
          :title="pageTitle"
          :icon="pageIcon"
        />
      </LearningProvider>
    </scroll-view>

    <view class="bottom-nav">
      <view
        v-for="item in bottomNavItems"
        :key="item.key"
        class="bottom-nav-item"
        :class="{ active: currentPage === item.key }"
        @tap="setPage(item.key)"
      >
        <view class="bottom-nav-icon">
          <AppIcon :name="item.icon" />
        </view>
        <text class="bottom-nav-label">{{ item.label }}</text>
      </view>
    </view>

    <TutuChat />
  </view>
</template>

<script setup>
import { computed, provide, ref } from 'vue'
import '../../styles/theme.css'
import { useTheme } from '../../composables/useTheme'
import AppIcon from '../common/AppIcon.vue'
import JobseekerHeader from './JobseekerHeader.vue'
import JobseekerUserMenu from './JobseekerUserMenu.vue'
import LearningProvider from './LearningProvider.vue'
import Dashboard from './Dashboard.vue'
import JobMatch from './JobMatch.vue'
import JobDetail from './JobDetail.vue'
import Diagnosis from './Diagnosis.vue'
import LearningReport from './LearningReport.vue'
import LearningPath from './LearningPath.vue'
import ProfileHome from './ProfileHome.vue'
import ProfileEdit from './ProfileEdit.vue'
import Resume from './Resume.vue'
import SkillGraph from './SkillGraph.vue'
import MySkillGraphPage from './MySkillGraphPage.vue'
import ResumeCenterPage from './ResumeCenterPage.vue'
import Trend from './Trend.vue'
import FeaturePlaceholder from './FeaturePlaceholder.vue'
import TutuChat from './TutuChat.vue'

const currentPage = ref('dashboard')
const menuOpen = ref(false)

const { theme, themeClass, toggleTheme } = useTheme()

const userData = computed(() => {
  try {
    const raw = uni.getStorageSync('xingtu_user')
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
})

const avatarText = computed(() => {
  const account = userData.value.email || userData.value.phone || ''
  const digits = String(account).replace(/\D/g, '')

  return digits
    ? digits.slice(-3)
    : String(account).slice(-3) || '?'
})

const bottomNavItems = [
  {
    key: 'dashboard',
    icon: 'dashboard',
    label: '工作台'
  },
  {
    key: 'skill-graph',
    icon: 'share-2',
    label: '岗位图谱'
  },
  {
    key: 'match',
    icon: 'briefcase',
    label: '岗位'
  },
  {
    key: 'learning',
    icon: 'book',
    label: '学习'
  },
  {
    key: 'trend',
    icon: 'trend',
    label: '趋势'
  }
]

const pageMeta = {
  'skill-graph': ['岗位图谱', 'share-2'],
  match: ['岗位', 'briefcase'],
  learning: ['学习', 'book'],
  trend: ['趋势', 'trend'],
  'resume-center': ['简历中心', 'file'],
  'profile-home': ['个人主页', 'user'],
  resume: ['简历管理', 'upload'],
  'my-skill-graph': ['我的图谱', 'graph'],
  diagnosis: ['人岗诊断', 'target'],
  'job-detail': ['岗位详情', 'briefcase']
}

const pageTitle = computed(
  () => pageMeta[currentPage.value]?.[0] || ''
)

const pageIcon = computed(
  () => pageMeta[currentPage.value]?.[1] || 'file'
)

function setPage(page) {
  currentPage.value = page
  menuOpen.value = false
}

function logout() {
  uni.removeStorageSync('xingtu_token')
  uni.removeStorageSync('xingtu_role')
  uni.removeStorageSync('xingtu_user')

  uni.reLaunch({
    url: '/pages/role-select/role-select'
  })
}

provide('jobseekerNav', {
  currentPage,
  setPage
})
</script>

<style>
.shell {
  position: relative;
  display: flex;
  width: 100%;
  height: 100vh;
  min-height: 100vh;
  flex-direction: column;
  overflow: hidden;
  background: var(--color-background);
  color: var(--color-on-surface);
  font-family: Inter, "PingFang SC", "Microsoft YaHei", sans-serif;
}

.shell-main {
  min-height: 0;
  flex: 1;
  padding-bottom: 112rpx;
  box-sizing: border-box;
}

.bottom-nav {
  position: fixed;
  z-index: 35;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  height: 112rpx;
  padding: 10rpx 12rpx calc(10rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
  align-items: flex-start;
  justify-content: space-around;
  border-top: 1rpx solid var(--color-outline-variant);
  background: var(--color-surface-container-lowest);
  box-shadow: 0 -8rpx 28rpx rgba(20, 40, 70, 0.06);
}

.bottom-nav-item {
  display: flex;
  min-width: 108rpx;
  height: 86rpx;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 5rpx;
  border-radius: 18rpx;
  color: var(--color-on-surface-variant);
}

.bottom-nav-item:active {
  transform: scale(0.96);
}

.bottom-nav-item.active {
  color: var(--color-primary);
}

.bottom-nav-icon {
  display: flex;
  width: 48rpx;
  height: 48rpx;
  align-items: center;
  justify-content: center;
  border-radius: 16rpx;
}

.bottom-nav-item.active .bottom-nav-icon {
  background: var(--color-primary-fixed);
}

.bottom-nav-icon .app-icon {
  width: 34rpx;
  height: 34rpx;
}

.bottom-nav-label {
  font-size: 19rpx;
  font-weight: 600;
  line-height: 1;
}

@media (min-width: 700px) {
  .bottom-nav {
    padding-left: 80rpx;
    padding-right: 80rpx;
  }
}
</style>