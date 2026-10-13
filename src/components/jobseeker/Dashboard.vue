<template>
  <view class="dashboard">
    <view class="welcome-card"><view class="welcome-glow one"></view><view class="welcome-glow two"></view><view class="welcome-content"><view class="update-line"><AppIcon name="sparkles" /><text>数据更新于 10 分钟前</text></view><text class="welcome-title">欢迎回来，<text class="gradient-text">探索者</text></text><text class="welcome-copy">基于多源异构数据与知识图谱，精准定位你的职业方向</text></view></view>
    <view class="stats-grid"><view v-for="stat in stats" :key="stat.label" class="stat-card card-enter"><text class="stat-label">{{ stat.label }}</text><view class="stat-value" :style="{ color: stat.color }"><StatsCounter :value="stat.value" /></view><view class="stat-track"><view class="stat-fill" :style="{ '--stat-progress': `${stat.progress}%`, background: stat.gradient }"></view></view></view></view>
    <text class="section-label">快捷功能</text>
    <view class="actions-grid"><view v-for="action in quickActions" :key="action.label" class="action-card card-enter" @tap="go(action.page)"><view class="action-icon" :style="{ background: action.dim, color: action.color }"><AppIcon :name="action.icon" /></view><text class="action-title">{{ action.label }}</text><text class="action-copy">{{ action.desc }}</text></view></view>
    <view class="bottom-grid"><view class="panel"><view class="panel-head"><text>最近诊断</text><view class="panel-link" @tap="go(history.length ? 'diagnosis' : 'match')"><text>{{ history.length ? '查看全部' : '去诊断' }}</text><AppIcon name="chevron-right" /></view></view><view v-if="!history.length" class="empty"><AppIcon name="target" /><text>暂无诊断记录</text><view class="primary-button" @tap="go('match')">开始诊断</view></view><view v-else class="history-list"><view v-for="item in history" :key="item.id" class="history-item" @tap="openHistory(item)"><view class="grade" :style="{ background: gradeColor(item.grade) }">{{ item.grade }}</view><view class="history-copy"><text>{{ item.jobTitle }}</text><text>{{ dateText(item.timestamp) }}</text></view><view class="history-score" :style="{ color: gradeColor(item.grade) }">{{ item.score }}</view></view></view></view>
      <view class="panel"><view class="panel-head"><text>学习进度</text><view class="panel-link" @tap="go('learning')"><text>进入学习</text><AppIcon name="chevron-right" /></view></view><view class="empty"><AppIcon name="book" /><text>已掌握 <text class="highlight">{{ masteredCount }}</text> 项技能</text><view class="progress-track"><view class="progress-fill" :style="{ width: `${Math.min(masteredCount * 5, 100)}%` }"></view></view><text class="progress-note">{{ masteredCount < 10 ? '继续加油，多掌握几项核心技能！' : '技能储备不错，可以挑战更高匹配度！' }}</text><view class="primary-button" @tap="go('skill-graph')">查看能力图谱</view></view></view></view>
  </view>
</template>
<script setup>
import { inject, onMounted, ref } from 'vue'
import AppIcon from '../common/AppIcon.vue'
import StatsCounter from './StatsCounter.vue'
const nav = inject('jobseekerNav')
const history = ref([])
const masteredCount = ref(0)
const stats = [{ label:'收录岗位', value:2817, progress:72, color:'var(--color-primary)', gradient:'linear-gradient(90deg,rgba(0,82,217,.4),var(--color-primary))' }, { label:'技能标签', value:1024, progress:58, color:'var(--accent-purple)', gradient:'linear-gradient(90deg,rgba(91,33,182,.4),var(--accent-purple))' }, { label:'新岗位发现', value:12, progress:24, color:'var(--accent-green)', gradient:'linear-gradient(90deg,rgba(5,150,105,.4),var(--accent-green))' }, { label:'平台用户', value:8642, progress:88, color:'var(--accent-orange)', gradient:'linear-gradient(90deg,rgba(217,119,6,.4),var(--accent-orange))' }]
const quickActions = [{ icon:'upload', label:'上传简历', desc:'AI 自动解析，1 分钟建立能力档案', color:'var(--color-primary)', dim:'var(--color-primary-fixed)', page:'resume' }, { icon:'briefcase', label:'浏览岗位', desc:'基于能力图谱精准推荐', color:'var(--accent-purple)', dim:'var(--accent-purple-dim)', page:'match' }, { icon:'graph', label:'人岗匹配', desc:'多维度匹配诊断与差距分析', color:'var(--accent-green)', dim:'rgba(5,150,105,.1)', page:'match' }, { icon:'trend', label:'趋势洞察', desc:'实时追踪技能需求变化', color:'var(--accent-orange)', dim:'rgba(217,119,6,.15)', page:'trend' }]
onMounted(() => { try { const saved = uni.getStorageSync('jt_diagnosis_history'); const list = saved ? JSON.parse(saved) : []; history.value = Array.isArray(list) ? list.slice(0,3) : [] } catch {} try { const skills = uni.getStorageSync('jt_mastered_skills'); masteredCount.value = skills ? JSON.parse(skills).length : 0 } catch {} })
function go(page) { nav.setPage(page) }
function gradeColor(grade) { return ({ S:'#10b981', A:'#22c55e', B:'#3b82f6', C:'#f59e0b', D:'#ef4444' })[grade] || 'var(--color-primary)' }
function dateText(value) { return value ? new Date(value).toLocaleDateString() : '' }
function openHistory(item) { uni.setStorageSync('jt_diagnosis_result', JSON.stringify({ job:{ id:item.jobId, title:item.jobTitle, company:item.jobCompany, salary:item.jobSalary, location:item.jobLocation, skills:[] }, result:{ overall:item.overall || item.score, grade:item.grade, skills:item.skills || { have:[], miss:[], extra:[] }, recommendations:item.recommendations || [] }, phases:item.phases || [], timestamp:item.timestamp })); go('learning') }
</script>
<style>
.dashboard {
  width: 100%;
  box-sizing: border-box;
  padding: 28rpx 24rpx 36rpx;
}
.welcome-card,
.stat-card,
.action-card,
.panel {
  border: 1rpx solid var(--color-outline-variant);
  background: var(--color-surface-container-lowest);
}
.welcome-card {
  position: relative;
  overflow: hidden;
  padding: 34rpx 28rpx;
  border: 1rpx solid rgba(59, 130, 246, 0.16);
  border-radius: 24rpx;
  background: var(--welcome-bg);
}
.theme-light {
  --welcome-bg: linear-gradient(135deg, rgba(239,246,255,.96) 0%, rgba(245,243,255,.96) 55%, rgba(239,246,255,.96) 100%);
}
.theme-dark {
  --welcome-bg: linear-gradient(135deg, rgba(25,39,72,.96) 0%, rgba(39,32,68,.96) 55%, rgba(25,39,72,.96) 100%);
}
.welcome-glow {
  position: absolute;
  border-radius: 50%;
  filter: blur(56rpx);
}
.welcome-glow.one {
  top: -260rpx;
  right: -180rpx;
  width: 520rpx;
  height: 520rpx;
  opacity: .08;
  background: var(--color-primary);
}
.welcome-glow.two {
  bottom: -220rpx;
  left: -160rpx;
  width: 460rpx;
  height: 460rpx;
  opacity: .06;
  background: var(--accent-purple);
}
.welcome-content {
  position: relative;
  z-index: 1;
}
.update-line {
  display: flex;
  margin-bottom: 16rpx;
  align-items: center;
  gap: 6rpx;
  color: var(--color-primary);
  font-size: 20rpx;
  font-weight: 600;
}
.update-line .app-icon {
  font-size: 34rpx;
}
.welcome-title {
  display: block;
  color: var(--color-on-surface);
  font-size: 40rpx;
  font-weight: 800;
  line-height: 1.3;
}
.welcome-copy {
  display: block;
  margin-top: 14rpx;
  color: var(--color-on-surface-variant);
  font-size: 23rpx;
  line-height: 1.6;
}
.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
  margin-top: 24rpx;
}
.stat-card {
  padding: 24rpx;
  border-radius: 20rpx;
}
.card-enter {
  animation: card-enter .45s ease-out both;
}
.stat-label {
  color: var(--color-on-surface-variant);
  font-size: 20rpx;
  font-weight: 700;
  letter-spacing: 1rpx;
}
.stat-value {
  display: block;
  margin-top: 8rpx;
  font-size: 38rpx;
  font-weight: 800;
}
.stat-track {
  height: 8rpx;
  margin-top: 18rpx;
  overflow: hidden;
  border-radius: 999rpx;
  background: var(--color-surface-container);
}
.stat-fill {
  width: 0;
  height: 100%;
  border-radius: inherit;
  animation: stat-bar-enter 1.2s ease-out forwards;
}
.section-label {
  display: block;
  margin-top: 28rpx;
  color: var(--color-on-surface);
  font-size: 25rpx;
  font-weight: 700;
  letter-spacing: 0;
}
.actions-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
  margin-top: 18rpx;
}
.action-card {
  min-height: 210rpx;
  padding: 24rpx;
  border-radius: 20rpx;
}
.action-card:active {
  transform: scale(.98);
}
.action-icon {
  display: flex;
  width: 70rpx;
  height: 70rpx;
  margin-bottom: 20rpx;
  align-items: center;
  justify-content: center;
  border-radius: 18rpx;
  font-size: 36rpx;
}
.action-title {
  display: block;
  color: var(--color-on-surface);
  font-size: 25rpx;
  font-weight: 700;
}
.action-copy {
  display: block;
  margin-top: 8rpx;
  color: var(--color-on-surface-variant);
  font-size: 20rpx;
  line-height: 1.5;
}
.bottom-grid {
  display: flex;
  margin-top: 24rpx;
  flex-direction: column;
  gap: 18rpx;
}
.panel {
  overflow: hidden;
  border-radius: 20rpx;
}
.panel-head {
  display: flex;
  min-height: 82rpx;
  padding: 0 24rpx;
  box-sizing: border-box;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1rpx solid var(--color-outline-variant);
  color: var(--color-on-surface);
  font-size: 25rpx;
  font-weight: 700;
}
.panel-link {
  display: flex;
  align-items: center;
  gap: 4rpx;
  color: var(--color-primary);
  font-size: 20rpx;
}
.panel-link .app-icon {
  font-size: 28rpx;
}
.empty {
  display: flex;
  min-height: 230rpx;
  padding: 28rpx 24rpx;
  box-sizing: border-box;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14rpx;
  color: var(--color-on-surface-variant);
  font-size: 22rpx;
  text-align: center;
}
.empty > .app-icon {
  width: 64rpx;
  height: 64rpx;
  opacity: .3;
}
.primary-button {
  margin-top: 4rpx;
  padding: 16rpx 26rpx;
  border-radius: 14rpx;
  background: var(--color-primary);
  color: var(--color-on-primary);
  font-size: 22rpx;
  font-weight: 700;
}
.highlight {
  color: var(--color-primary);
  font-weight: 700;
}
.progress-track {
  width: 100%;
  height: 10rpx;
  margin-top: 10rpx;
  overflow: hidden;
  border-radius: 999rpx;
  background: var(--color-surface-container);
}
.progress-fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--color-primary), var(--accent-purple));
  transition: width 1s ease;
}
.progress-note {
  color: var(--color-on-surface-variant);
  font-size: 19rpx;
  line-height: 1.5;
}
.history-list {
  padding: 18rpx;
}
.history-item {
  display: flex;
  margin-bottom: 12rpx;
  padding: 16rpx;
  align-items: center;
  gap: 14rpx;
  border-radius: 16rpx;
  background: var(--color-surface-container);
}
.grade {
  display: flex;
  width: 56rpx;
  height: 56rpx;
  flex: none;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: #fff;
  font-size: 22rpx;
  font-weight: 700;
}
.history-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 4rpx;
}
.history-copy text:first-child {
  overflow: hidden;
  color: var(--color-on-surface);
  font-size: 22rpx;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.history-copy text:last-child {
  color: var(--color-on-surface-variant);
  font-size: 18rpx;
}
.history-score {
  flex: none;
  font-size: 28rpx;
  font-weight: 700;
}
@keyframes card-enter {
  from {
    opacity: 0;
    transform: translateY(16rpx);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@keyframes stat-bar-enter {
  from {
    width: 0;
  }

  to {
    width: var(--stat-progress);
  }
}
</style>
