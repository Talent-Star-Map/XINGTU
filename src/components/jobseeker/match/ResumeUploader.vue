<template>
  <view v-if="hasProfile && !showSkillInput" class="uploader-ready">
    <view class="ready-header">
      <AppIcon name="check-circle" class="ready-icon" />
      <text class="ready-text">已选择 {{ selSkills.length }} 项技能</text>
      <view class="modify-btn" @tap="$emit('showSkillInput')">
        <AppIcon name="chevron-down" class="modify-icon" />
        <text class="modify-text">修改</text>
      </view>
    </view>
    <view class="skill-tags">
      <text v-for="s in selSkills" :key="s" class="skill-tag">{{ s }}</text>
    </view>
    <view class="match-btn" @tap="$emit('autoMatch', selSkills)">
      <AppIcon name="sparkles" class="btn-icon" />
      <text class="btn-text">智能匹配</text>
    </view>
  </view>

  <view v-else-if="!showSkillInput" class="uploader-empty">
    <view class="empty-content">
      <view class="empty-icon-wrap">
        <AppIcon name="upload" class="empty-icon" />
      </view>
      <view class="empty-info">
        <text class="empty-title">尚未检测到简历或技能数据</text>
        <text class="empty-desc">上传简历可获取智能匹配结果，或手动输入快速体验</text>
      </view>
      <view class="empty-actions">
        <view class="action-primary" @tap="$emit('showSkillInput')">
          <text class="action-primary-text">手动输入</text>
        </view>
        <view class="action-secondary" @tap="$emit('goToResume')">
          <text class="action-secondary-text">前往简历管理</text>
        </view>
      </view>
    </view>
  </view>

  <ManualSkillInput
    v-else
    :tags="selSkills"
    @tags-change="(tags) => $emit('tagsChange', tags)"
    @confirm="(tags) => $emit('confirm', tags)"
    @auto-match="(tags) => $emit('autoMatch', tags)"
    @skip="$emit('skip')"
    @go-to-resume="$emit('goToResume')"
  />
</template>

<script setup>
import AppIcon from '../../common/AppIcon.vue'
import ManualSkillInput from './ManualSkillInput.vue'

defineProps({
  hasProfile: { type: Boolean, default: false },
  showSkillInput: { type: Boolean, default: false },
  selSkills: { type: Array, default: () => [] },
})

defineEmits(['tagsChange', 'confirm', 'autoMatch', 'showSkillInput', 'skip', 'goToResume'])
</script>

<style>
.uploader-ready { padding: 32rpx; border: 1rpx solid rgba(0, 229, 153, 0.2); border-radius: 20rpx; background: rgba(0, 229, 153, 0.05); }
.ready-header { display: flex; align-items: center; gap: 16rpx; margin-bottom: 16rpx; }
.ready-icon { flex: none; width: 36rpx; height: 36rpx; color: var(--accent-green); }
.ready-text { font-size: 22rpx; font-weight: 500; color: var(--accent-green); }
.modify-btn { margin-left: auto; display: flex; align-items: center; gap: 6rpx; }
.modify-icon { width: 22rpx; height: 22rpx; color: var(--color-primary); }
.modify-text { font-size: 22rpx; font-weight: 500; color: var(--color-primary); }
.skill-tags { display: flex; flex-wrap: wrap; gap: 12rpx; margin-bottom: 24rpx; }
.skill-tag { padding: 6rpx 16rpx; border-radius: 8rpx; background: var(--color-primary-fixed); color: var(--color-primary); font-size: 22rpx; font-weight: 500; }
.match-btn { display: flex; align-items: center; justify-content: center; gap: 12rpx; height: 72rpx; border-radius: 16rpx; background: var(--color-primary); }
.match-btn:active { opacity: 0.85; }
.btn-icon { width: 28rpx; height: 28rpx; color: #fff; }
.btn-text { font-size: 26rpx; font-weight: 600; color: #fff; }
.uploader-empty { padding: 40rpx; border: 2rpx dashed var(--color-outline-variant); border-radius: 20rpx; background: var(--color-surface-container-lowest); }
.empty-content { display: flex; flex-direction: column; align-items: center; gap: 24rpx; }
.empty-icon-wrap { display: flex; width: 88rpx; height: 88rpx; align-items: center; justify-content: center; border-radius: 20rpx; background: rgba(0, 200, 255, 0.1); }
.empty-icon { width: 48rpx; height: 48rpx; color: var(--color-primary); }
.empty-info { text-align: center; }
.empty-title { display: block; font-size: 26rpx; font-weight: 600; color: var(--color-on-surface); }
.empty-desc { display: block; margin-top: 8rpx; font-size: 22rpx; color: var(--color-on-surface-variant); }
.empty-actions { display: flex; gap: 16rpx; }
.action-primary { height: 68rpx; padding: 0 32rpx; display: flex; align-items: center; justify-content: center; border-radius: 16rpx; background: var(--color-primary); }
.action-primary-text { font-size: 24rpx; font-weight: 600; color: #fff; }
.action-secondary { height: 68rpx; padding: 0 32rpx; display: flex; align-items: center; justify-content: center; border: 1rpx solid var(--color-outline-variant); border-radius: 16rpx; }
.action-secondary-text { font-size: 24rpx; font-weight: 600; color: var(--color-on-surface-variant); }
</style>
