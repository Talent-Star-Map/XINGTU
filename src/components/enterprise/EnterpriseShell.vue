<template>
  <view class="ep-shell" :class="themeClass">
    <EnterpriseHeader
      v-if="currentPage !== 'company-profile-edit'"
      :avatar-text="avatarText"
      :theme="theme"
      @menu-select="onMenuSelect"
      @toggle-theme="toggleTheme"
    />

    <scroll-view
      class="ep-main"
      :class="{ 'ep-main--full': currentPage === 'company-profile-edit' }"
      scroll-y
      :show-scrollbar="false"
    >
      <EnterpriseDashboard
        v-if="currentPage === 'dashboard'"
        @navigate="onNavigate"
      />
      <EnterpriseJobManage
        v-else-if="currentPage === 'jobs'"
        :selected-job-id="navParams.selectedJobId"
        @navigate="onNavigate"
      />
      <EnterpriseTalentSearch
        v-else-if="currentPage === 'talent'"
        :filter-job-id="navParams.filterJobId"
        :auto-compare="navParams.autoCompare"
        @navigate="onNavigate"
      />
      <EnterpriseConversations
        v-else-if="currentPage === 'messages'"
        @unread-change="onUnreadChange"
      />
      <EnterpriseMarketInsight
        v-else-if="currentPage === 'market'"
      />
      <EnterpriseIndustryReport
        v-else-if="currentPage === 'industry-report'"
      />
      <EnterpriseCompanyProfile
        v-else-if="currentPage === 'company-profile'"
        @navigate="onNavigate"
      />
      <EnterpriseCompanyProfileEdit
        v-else-if="currentPage === 'company-profile-edit'"
        @navigate="onNavigate"
      />
      <FeaturePlaceholder
        v-else
        :title="pagePlaceholder.title"
        :icon="pagePlaceholder.icon"
      />
    </scroll-view>

    <view v-if="currentPage !== 'company-profile-edit'" class="ep-bottom-nav">
      <view
        v-for="item in bottomNavItems"
        :key="item.key"
        class="ep-nav-item"
        :class="{ active: currentPage === item.key }"
        @tap="setPage(item.key)"
      >
        <view class="ep-nav-icon">
          <AppIcon :name="item.icon" />
          <view v-if="item.key === 'messages' && unreadTotal > 0" class="ep-unread-badge">
            <text class="ep-unread-text">{{ unreadTotal > 99 ? '99+' : unreadTotal }}</text>
          </view>
        </view>
        <text class="ep-nav-label">{{ item.label }}</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import AppIcon from '../common/AppIcon.vue'
import EnterpriseHeader from './EnterpriseHeader.vue'
import EnterpriseDashboard from './EnterpriseDashboard.vue'
import EnterpriseJobManage from './EnterpriseJobManage.vue'
import EnterpriseTalentSearch from './EnterpriseTalentSearch.vue'
import EnterpriseConversations from './EnterpriseConversations.vue'
import EnterpriseMarketInsight from './EnterpriseMarketInsight.vue'
import EnterpriseIndustryReport from './EnterpriseIndustryReport.vue'
import EnterpriseCompanyProfile from './EnterpriseCompanyProfile.vue'
import EnterpriseCompanyProfileEdit from './EnterpriseCompanyProfileEdit.vue'
import FeaturePlaceholder from '../jobseeker/FeaturePlaceholder.vue'
import { request } from '../../utils/request'
import '../../styles/theme.css'
import { useTheme } from '../../composables/useTheme'

const { theme, themeClass, toggleTheme } = useTheme()

const currentPage = ref('dashboard')
const navParams = ref({})
const unreadTotal = ref(0)
let pollTimer = null

const userData = computed(() => {
  try {
    const raw = uni.getStorageSync('xingtu_user')
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
})

const avatarText = computed(() => '企')

const bottomNavItems = [
  { key: 'dashboard', icon: 'dashboard', label: '工作台' },
  { key: 'jobs', icon: 'briefcase', label: '岗位管理' },
  { key: 'talent', icon: 'users', label: '人才星' },
  { key: 'messages', icon: 'chat', label: '消息' },
  { key: 'market', icon: 'line-chart', label: '市场洞察' },
]

const pagePlaceholder = computed(() => {
  const map = {
    jobs: { title: '岗位管理', icon: 'briefcase' },
    talent: { title: '人才星', icon: 'users' },
    messages: { title: '消息', icon: 'chat' },
    market: { title: '市场洞察', icon: 'line-chart' },
    'industry-report': { title: '行业报告', icon: 'file-text' },
    'company-profile': { title: '企业信息', icon: 'building' },
    'company-profile-edit': { title: '编辑企业信息', icon: 'edit' },
  }
  return map[currentPage.value] || { title: '', icon: 'file' }
})

function setPage(page) {
  currentPage.value = page
  navParams.value = {}
}

function onNavigate(page, params) {
  currentPage.value = page
  navParams.value = params || {}
}

function onMenuSelect(type) {
  if (type === 'industry-report') {
    currentPage.value = 'industry-report'
  } else if (type === 'company-profile') {
    currentPage.value = 'company-profile'
  } else if (type === 'logout') {
    uni.showModal({
      title: '提示',
      content: '确定退出当前企业账号吗？',
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
}

function onUnreadChange(count) {
  unreadTotal.value = count
}

async function fetchUnread() {
  try {
    const d = await request({ url: '/api/enterprise/conversations?size=1' })
    if (d.success && d.data) {
      unreadTotal.value = d.data.unread_total || 0
    }
  } catch {}
}

onMounted(() => {
  fetchUnread()
  pollTimer = setInterval(fetchUnread, 30000)
})

onUnmounted(() => {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
})
</script>

<style>
.ep-shell {
  position: relative;
  display: flex;
  width: 100%;
  height: 100%;
  flex-direction: column;
  overflow: hidden;
  background: var(--color-background);
  color: var(--color-on-surface);
  font-family: Inter, "PingFang SC", "Microsoft YaHei", sans-serif;
}

.ep-main {
  min-height: 0;
  flex: 1;
  padding-bottom: 112rpx;
  box-sizing: border-box;
}

.ep-main--full {
  padding-bottom: 0;
}

.ep-bottom-nav {
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

.ep-nav-item {
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

.ep-nav-item:active {
  transform: scale(0.96);
}

.ep-nav-item.active {
  color: var(--accent-purple);
}

.ep-nav-icon {
  display: flex;
  width: 48rpx;
  height: 48rpx;
  align-items: center;
  justify-content: center;
  border-radius: 16rpx;
  position: relative;
}

.ep-nav-item.active .ep-nav-icon {
  background: var(--accent-purple-dim);
}

.ep-nav-icon .app-icon {
  width: 34rpx;
  height: 34rpx;
}

.ep-nav-label {
  font-size: 19rpx;
  font-weight: 600;
  line-height: 1;
}

.ep-unread-badge {
  position: absolute;
  top: -6rpx;
  right: -12rpx;
  display: flex;
  min-width: 28rpx;
  height: 28rpx;
  padding: 0 8rpx;
  align-items: center;
  justify-content: center;
  border-radius: 14rpx;
  background: var(--accent-red, #DC2626);
}

.ep-unread-text {
  color: #fff;
  font-size: 18rpx;
  font-weight: 700;
  line-height: 1;
}
</style>