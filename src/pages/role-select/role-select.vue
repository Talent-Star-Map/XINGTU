<template>
  <view class="role-select-page" :class="themeClass">
    <view class="aurora" aria-hidden="true">
      <view class="aurora-band aurora-one"></view>
      <view class="aurora-band aurora-two"></view>
      <view class="aurora-band aurora-three"></view>
    </view>
    <view class="star-field" aria-hidden="true"></view>

    <button class="theme-toggle" @tap="toggleTheme" aria-label="切换主题">
      <svg v-if="theme === 'dark'" class="icon icon-theme" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"></path></svg>
      <svg v-else class="icon icon-theme" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
    </button>

    <view class="content">
      <view class="brand-section">
        <view class="logo-box"><svg class="icon icon-logo" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg></view>
        <text class="page-title">星图</text>
        <text class="page-subtitle">岗位能力图谱动态演化与分析系统</text>
      </view>

      <view class="role-list">
        <view class="star-border jobseeker-border" @tap="goToLogin('jobseeker')">
          <view class="border-gradient border-bottom"></view><view class="border-gradient border-top"></view>
          <view class="role-card"><view class="card-glow jobseeker-glow"></view><view class="card-content">
            <view class="role-icon jobseeker-icon"><svg class="icon icon-role" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="13" rx="2" ry="2"></rect><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2"></path></svg></view>
            <view class="role-copy"><text class="role-title">求职者入口</text><text class="role-description">浏览岗位、上传简历、人岗匹配、技能图谱、趋势洞察</text></view>
            <svg class="icon icon-arrow jobseeker-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"></path></svg>
          </view></view>
        </view>

        <view class="star-border enterprise-border" @tap="goToLogin('enterprise')">
          <view class="border-gradient border-bottom"></view><view class="border-gradient border-top"></view>
          <view class="role-card"><view class="card-glow enterprise-glow"></view><view class="card-content">
            <view class="role-icon enterprise-icon"><svg class="icon icon-role" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M15 9h2a2 2 0 0 1 2 2v10M8 7h2M8 11h2M8 15h2M12 7h1M12 11h1M12 15h1"></path></svg></view>
            <view class="role-copy"><text class="role-title">企业入口</text><text class="role-description">岗位管理、人才搜索、市场洞察、行业报告</text></view>
            <svg class="icon icon-arrow enterprise-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"></path></svg>
          </view></view>
        </view>
      </view>

      <view class="admin-entry"><button class="admin-button" @tap="goToLogin('admin')"><svg class="icon icon-shield" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg><text>管理员入口</text></button></view>
      <view class="bottom-space"></view>
    </view>
  </view>
</template>

<script setup>
import { computed, ref } from 'vue'
import '../../styles/theme.css'
import { useTheme } from '../../composables/useTheme'

const { theme, themeClass, toggleTheme } = useTheme()

function goToLogin(role) {
  uni.navigateTo({ url: `/pages/login/login?role=${role}` })
}
</script>

<style>
.role-select-page { position: relative; display: flex; width: 100%; min-height: 100vh; overflow: hidden; align-items: center; justify-content: center; font-family: Inter, "PingFang SC", "Microsoft YaHei", sans-serif; background: var(--color-background); color: var(--color-on-surface); }
.theme-light { --color-primary: #0052D9; --color-surface-container: #E5EEFF; --color-surface-container-lowest: #FFFFFF; --color-outline-variant: #E1E2E4; --color-on-surface: #191C1E; --color-on-surface-variant: #434654; --color-background: #F8F9FF; --accent-cyan-dim: rgba(0, 82, 217, 0.08); --accent-purple: #5B21B6; --accent-purple-dim: rgba(91, 33, 182, 0.08); --accent-green: #059669; --card-background: rgba(255, 255, 255, 0.72); }
.theme-dark { --color-primary: #6B9EFF; --color-surface-container: #1F2770; --color-surface-container-lowest: #0F1422; --color-outline-variant: #1E2A5A; --color-on-surface: #E8ECF5; --color-on-surface-variant: #8899CC; --color-background: #0A0E1A; --accent-cyan-dim: rgba(107, 158, 255, 0.12); --accent-purple: #A78BFA; --accent-purple-dim: rgba(167, 139, 250, 0.12); --accent-green: #34D399; --card-background: rgba(15, 20, 34, 0.72); }
.aurora, .star-field { position: absolute; z-index: 0; inset: 0; overflow: hidden; pointer-events: none; }
.aurora { opacity: 0.3; }
.aurora-band { position: absolute; width: 150%; height: 58%; border-radius: 50%; filter: blur(38rpx); }
.aurora-one { top: -26%; left: -30%; background: linear-gradient(90deg, transparent 3%, rgba(82, 39, 255, 0.62) 30%, rgba(124, 255, 103, 0.5) 52%, rgba(82, 39, 255, 0.58) 76%, transparent 98%); animation: aurora-drift-one 16s ease-in-out infinite alternate; }
.aurora-two { top: 30%; left: -17%; background: radial-gradient(ellipse at center, rgba(124, 255, 103, 0.34), rgba(82, 39, 255, 0.28) 42%, transparent 72%); animation: aurora-drift-two 20s ease-in-out infinite alternate; }
.aurora-three { right: -43%; bottom: -28%; background: linear-gradient(90deg, transparent, rgba(82, 39, 255, 0.5) 40%, rgba(124, 255, 103, 0.32) 63%, transparent); animation: aurora-drift-three 18s ease-in-out infinite alternate; }
.star-field { display: none; }
.theme-dark .star-field { display: block; background-image: radial-gradient(1px 1px at 10% 20%, rgba(255,255,255,0.4), transparent), radial-gradient(1px 1px at 30% 65%, rgba(255,255,255,0.3), transparent), radial-gradient(1.5px 1.5px at 50% 10%, rgba(255,255,255,0.5), transparent), radial-gradient(1px 1px at 70% 40%, rgba(255,255,255,0.3), transparent), radial-gradient(1px 1px at 90% 80%, rgba(255,255,255,0.4), transparent), radial-gradient(1.5px 1.5px at 15% 85%, rgba(255,255,255,0.5), transparent); background-size: 400rpx 400rpx; }
.theme-toggle { position: absolute; top: 40rpx; right: 40rpx; z-index: 20; display: flex; width: 76rpx; height: 76rpx; padding: 0; align-items: center; justify-content: center; border: 1px solid var(--color-outline-variant); border-radius: 18rpx; background: var(--color-surface-container); color: var(--color-on-surface-variant); transition: transform .2s ease, opacity .2s ease; }
.theme-toggle::after, .admin-button::after { display: none; }
.theme-toggle:active, .admin-button:active { opacity: .86; transform: scale(.96); }
.content { position: relative; z-index: 10; width: 100%; max-width: 680rpx; padding: 32rpx; }
.brand-section { margin-bottom: 80rpx; text-align: center; animation: brand-enter .6s ease-out both; }
.logo-box { display: flex; width: 144rpx; height: 144rpx; margin: 0 auto 32rpx; align-items: center; justify-content: center; border: 1px solid var(--color-primary); border-radius: 29rpx; background: linear-gradient(135deg, var(--accent-cyan-dim), var(--accent-purple-dim)); color: var(--color-primary); animation: logo-float 6s ease-in-out infinite; }
.icon { display: block; flex: none; }.icon-theme { width: 40rpx; height: 40rpx; }.icon-logo { width: 80rpx; height: 80rpx; }
.page-title { display: block; font-family: Manrope, "Noto Sans SC", system-ui, sans-serif; font-size: 60rpx; font-weight: 700; line-height: 1.2; letter-spacing: 0; background: linear-gradient(135deg, var(--color-primary), var(--accent-purple)); -webkit-background-clip: text; background-clip: text; color: transparent; }
.page-subtitle { display: block; margin-top: 16rpx; color: var(--color-on-surface-variant); font-size: 26rpx; line-height: 1.6; opacity: 0; animation: subtitle-enter .3s ease-out .3s forwards; }
.role-list { display: flex; flex-direction: column; gap: 40rpx; }
.star-border { position: relative; display: block; width: 100%; overflow: hidden; border-radius: 20px; padding: 1px 0; transition: transform .3s ease-out; }
.star-border:active { transform: translateY(2rpx) scale(.98); transition-duration: .15s; }
.border-gradient { position: absolute; z-index: 0; width: 300%; height: 50%; border-radius: 50%; opacity: .7; animation-duration: 6s; animation-timing-function: linear; animation-iteration-count: infinite; animation-direction: alternate; }
.jobseeker-border .border-gradient { background: radial-gradient(circle, rgba(0,200,255,.4), transparent 10%); }.enterprise-border .border-gradient { background: radial-gradient(circle, rgba(124,58,237,.4), transparent 10%); }
.border-bottom { right: -250%; bottom: -11px; animation-name: border-flow-bottom; }.border-top { top: -10px; left: -250%; animation-name: border-flow-top; }
.role-card { position: relative; z-index: 1; overflow: hidden; border: 1px solid var(--color-outline-variant); border-radius: 20px; padding: 48rpx; background: var(--card-background); }
.card-glow { position: absolute; width: 256rpx; height: 256rpx; border-radius: 50%; opacity: .04; }.jobseeker-glow { top: -80rpx; right: -80rpx; background: radial-gradient(circle, #00C8FF, transparent 70%); animation: glow-pulse 4s ease-in-out infinite; }.enterprise-glow { bottom: -80rpx; left: -80rpx; background: radial-gradient(circle, #7C3AED, transparent 70%); animation: glow-pulse 5s ease-in-out infinite; }
.card-content { position: relative; z-index: 1; display: flex; align-items: center; gap: 40rpx; }.role-icon { display: flex; width: 112rpx; height: 112rpx; flex: none; align-items: center; justify-content: center; border-radius: 24rpx; transition: transform .2s ease; }.star-border:active .jobseeker-icon { transform: rotate(10deg); }.star-border:active .enterprise-icon { transform: rotate(-10deg); }.jobseeker-icon { background: var(--accent-cyan-dim); color: var(--color-primary); }.enterprise-icon { background: var(--accent-purple-dim); color: var(--accent-purple); }.icon-role { width: 56rpx; height: 56rpx; }
.role-copy { min-width: 0; flex: 1; }.role-title { display: block; color: var(--color-on-surface); font-family: Manrope, "Noto Sans SC", system-ui, sans-serif; font-size: 32rpx; font-weight: 700; line-height: 1.35; }.role-description { display: block; margin-top: 8rpx; color: var(--color-on-surface-variant); font-size: 26rpx; line-height: 1.6; }.icon-arrow { width: 40rpx; height: 40rpx; flex: none; transition: transform .2s ease; }.star-border:active .icon-arrow { transform: translateX(10rpx); }.jobseeker-arrow { color: var(--color-primary); }.enterprise-arrow { color: var(--accent-purple); }
.admin-entry { margin-top: 48rpx; text-align: center; opacity: 0; animation: admin-enter .3s ease-out .6s forwards; }.admin-button { display: inline-flex; min-height: 56rpx; padding: 16rpx 32rpx; align-items: center; justify-content: center; gap: 16rpx; box-sizing: border-box; border: 1px solid var(--color-outline-variant); border-radius: 16rpx; background: transparent; color: var(--color-on-surface-variant); font-size: 24rpx; line-height: 1; transition: color .2s ease, border-color .2s ease, transform .2s ease, opacity .2s ease; }.admin-button:active { border-color: var(--accent-green); color: var(--accent-green); }.icon-shield { width: 28rpx; height: 28rpx; }.bottom-space { height: 64rpx; }.admin-button::after { display: none;}
@keyframes brand-enter { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }
@keyframes subtitle-enter { from { opacity: 0; } to { opacity: 1; } }
@keyframes admin-enter { from { opacity: 0; } to {opacity: 1; } }
@keyframes logo-float { 0%,100% { transform: scale(1) rotate(0deg); } 33% { transform: scale(1.05) rotate(5deg); } 66% { transform: scale(1.05) rotate(-5deg); } }
@keyframes glow-pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.2); } }
@keyframes border-flow-bottom { 0% { transform: translate(0%,0%); opacity: 1; } 100% { transform: translate(-100%,0%); opacity: 0; } }
@keyframes border-flow-top { 0% { transform: translate(0%,0%); opacity: 1; } 100% { transform: translate(100%,0%); opacity: 0; } }
@keyframes aurora-drift-one { from { transform: translate3d(-5%,-3%,0) rotate(-8deg); } to { transform: translate3d(18%,14%,0) rotate(8deg); } }
@keyframes aurora-drift-two { from { transform: translate3d(12%,-5%,0) rotate(12deg); opacity: .65; } to { transform: translate3d(-14%,10%,0) rotate(-9deg); opacity: .95; } }
@keyframes aurora-drift-three { from { transform: translate3d(4%,8%,0) rotate(-14deg); } to { transform: translate3d(-18%,-9%,0) rotate(10deg); } }
</style>
