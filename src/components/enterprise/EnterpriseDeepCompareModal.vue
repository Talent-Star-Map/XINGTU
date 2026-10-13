<template>
  <view v-if="show" class="ets-modal-mask" @tap.self="$emit('close')">
    <view class="ets-modal-box ets-modal-deep">
      <!-- 头部 -->
      <view class="ets-modal-header">
        <view class="ets-modal-header-left">
          <text class="ets-deep-icon">AI</text>
          <view>
            <text class="ets-modal-title">AI 深度对比</text>
            <text class="ets-modal-subtitle">多维度分析 · 技能迁移评估 · 综合决策</text>
          </view>
        </view>
        <view class="ets-modal-close" @tap="$emit('close')">
          <AppIcon name="x" />
        </view>
      </view>

      <!-- 内容 -->
      <scroll-view class="ets-modal-scroll" scroll-y :show-scrollbar="false">
        <view class="ets-modal-body">
          <!-- 加载中 -->
          <view v-if="loading" class="ets-deep-loading">
            <AppIcon name="loader" />
            <text class="ets-deep-loading-text">AI 分析中，预计 10-20 秒...</text>
          </view>

          <!-- 错误 -->
          <view v-else-if="error" class="ets-deep-error">
            <text class="ets-deep-error-text">{{ error }}</text>
          </view>

          <!-- 等待启动 -->
          <view v-else-if="!data" class="ets-deep-idle">
            <text class="ets-deep-idle-text">点击「启动分析」，多 Agent 协同分析候选人技能迁移能力与综合匹配度</text>
          </view>

          <!-- 结果 -->
          <template v-else>
            <!-- 整体总结 -->
            <view class="ets-deep-summary">
              <text class="ets-deep-summary-text">{{ data.overall_summary }}</text>
            </view>

            <!-- 排名推荐 -->
            <view class="ets-deep-rankings">
              <view
                v-for="item in sortedRanking"
                :key="item.candidate_id"
                class="ets-deep-rank-card"
              >
                <view class="ets-rank-header">
                  <view class="ets-rank-badge" :class="{ 'ets-rank-first': item.rank === 1 }">
                    <text class="ets-rank-num">{{ item.rank }}</text>
                  </view>
                  <text class="ets-rank-name">{{ item.candidate_name }}</text>
                  <text v-if="item.rank === 1" class="ets-rank-tag">最推荐</text>
                </view>

                <!-- 优劣势 -->
                <view class="ets-rank-details">
                  <view class="ets-rank-col">
                    <text class="ets-rank-col-title ets-col-green">优势</text>
                    <view v-for="(s, i) in item.strengths" :key="'s'+i" class="ets-rank-item">
                      <text class="ets-rank-plus">+</text>
                      <text class="ets-rank-item-text">{{ s }}</text>
                    </view>
                  </view>
                  <view class="ets-rank-col">
                    <text class="ets-rank-col-title ets-col-orange">劣势</text>
                    <view v-for="(s, i) in item.weaknesses" :key="'w'+i" class="ets-rank-item">
                      <text class="ets-rank-minus">-</text>
                      <text class="ets-rank-item-text">{{ s }}</text>
                    </view>
                  </view>
                  <view class="ets-rank-col">
                    <text class="ets-rank-col-title ets-col-red">风险</text>
                    <view v-for="(s, i) in item.risks" :key="'r'+i" class="ets-rank-item">
                      <text class="ets-rank-bang">!</text>
                      <text class="ets-rank-item-text">{{ s }}</text>
                    </view>
                  </view>
                </view>

                <!-- 推荐理由 -->
                <view class="ets-rank-reason">
                  <text class="ets-rank-reason-label">推荐理由：</text>
                  <text class="ets-rank-reason-text">{{ item.recommendation }}</text>
                </view>
              </view>
            </view>

            <!-- 关键洞察 -->
            <view v-if="data.key_insights && data.key_insights.length > 0" class="ets-deep-insights">
              <text class="ets-insights-title">关键洞察</text>
              <view v-for="(insight, i) in data.key_insights" :key="i" class="ets-insight-item">
                <text class="ets-insight-dot">•</text>
                <text class="ets-insight-text">{{ insight }}</text>
              </view>
            </view>
          </template>
        </view>
      </scroll-view>

      <!-- 底部按钮 -->
      <view v-if="!loading && !data && !error" class="ets-modal-footer">
        <view class="ets-deep-start-btn" @tap="$emit('start-analyze')">
          <text class="ets-deep-start-text">启动分析</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed } from 'vue'
import AppIcon from '../common/AppIcon.vue'

const props = defineProps({
  show: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
  data: { type: Object, default: null },
})

defineEmits(['close', 'start-analyze'])

const sortedRanking = computed(() => {
  if (!props.data || !props.data.ranking) return []
  return [...props.data.ranking].sort((a, b) => a.rank - b.rank)
})
</script>

<style>
.ets-modal-deep {
  max-width: 700rpx;
  border-color: var(--color-primary);
  border-width: 2rpx;
}

.ets-modal-subtitle {
  font-size: 20rpx;
  color: var(--color-on-surface-variant);
  margin-top: 4rpx;
}

.ets-deep-icon {
  font-size: 28rpx;
  font-weight: 800;
  color: var(--color-primary);
  width: 56rpx;
  height: 56rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 14rpx;
  background: var(--color-primary-fixed);
}

.ets-deep-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16rpx;
  padding: 80rpx 32rpx;
}

.ets-deep-loading .app-icon {
  width: 56rpx;
  height: 56rpx;
  color: var(--color-primary);
}

.ets-deep-loading-text {
  font-size: 26rpx;
  color: var(--color-on-surface-variant);
}

.ets-deep-error {
  padding: 28rpx;
  border-radius: 14rpx;
  background: rgba(220, 38, 38, 0.08);
}

.ets-deep-error-text {
  font-size: 26rpx;
  color: var(--accent-red);
}

.ets-deep-idle {
  padding: 80rpx 32rpx;
  text-align: center;
}

.ets-deep-idle-text {
  font-size: 26rpx;
  color: var(--color-on-surface-variant);
}

/* 整体总结 */
.ets-deep-summary {
  padding: 24rpx;
  border-radius: 14rpx;
  background: var(--color-primary-fixed-dim);
}

.ets-deep-summary-text {
  font-size: 26rpx;
  line-height: 1.7;
  color: var(--color-on-surface);
}

/* 排名推荐 */
.ets-deep-rankings {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.ets-deep-rank-card {
  border: 1rpx solid var(--color-outline-variant);
  border-radius: 14rpx;
  padding: 24rpx;
}

.ets-rank-header {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 20rpx;
}

.ets-rank-badge {
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-surface-container-high);
}

.ets-rank-first {
  background: var(--accent-green);
}

.ets-rank-num {
  font-size: 28rpx;
  font-weight: 700;
  color: var(--color-on-surface-variant);
}

.ets-rank-first .ets-rank-num {
  color: #fff;
}

.ets-rank-name {
  font-size: 28rpx;
  font-weight: 600;
  color: var(--color-on-surface);
}

.ets-rank-tag {
  font-size: 20rpx;
  padding: 4rpx 14rpx;
  border-radius: 8rpx;
  background: rgba(5, 150, 105, 0.12);
  color: var(--accent-green);
}

.ets-rank-details {
  display: flex;
  gap: 16rpx;
  margin-bottom: 16rpx;
}

.ets-rank-col {
  flex: 1;
}

.ets-rank-col-title {
  font-size: 22rpx;
  font-weight: 500;
  margin-bottom: 8rpx;
}

.ets-col-green { color: var(--accent-green); }
.ets-col-orange { color: var(--accent-orange); }
.ets-col-red { color: var(--accent-red-strong, #dc2626); }

.ets-rank-item {
  display: flex;
  gap: 6rpx;
  margin-bottom: 6rpx;
}

.ets-rank-plus {
  font-size: 22rpx;
  color: var(--accent-green);
}

.ets-rank-minus {
  font-size: 22rpx;
  color: var(--accent-orange);
}

.ets-rank-bang {
  font-size: 22rpx;
  color: var(--accent-red-strong, #dc2626);
}

.ets-rank-item-text {
  font-size: 22rpx;
  color: var(--color-on-surface);
}

.ets-rank-reason {
  padding: 16rpx;
  border-radius: 10rpx;
  background: var(--color-surface-container-low);
}

.ets-rank-reason-label {
  font-size: 22rpx;
  font-weight: 500;
  color: var(--color-on-surface);
}

.ets-rank-reason-text {
  font-size: 22rpx;
  color: var(--color-on-surface-variant);
}

/* 关键洞察 */
.ets-deep-insights {
  padding: 24rpx;
  border-radius: 14rpx;
  background: var(--color-surface-container-low);
}

.ets-insights-title {
  font-size: 24rpx;
  font-weight: 500;
  color: var(--color-primary);
  margin-bottom: 12rpx;
}

.ets-insight-item {
  display: flex;
  gap: 10rpx;
  margin-bottom: 8rpx;
}

.ets-insight-dot {
  font-size: 26rpx;
  color: var(--color-primary);
}

.ets-insight-text {
  font-size: 24rpx;
  color: var(--color-on-surface);
}

/* 底部按钮 */
.ets-modal-footer {
  padding: 20rpx 28rpx;
  border-top: 1rpx solid var(--color-outline-variant);
  display: flex;
  justify-content: center;
}

.ets-deep-start-btn {
  padding: 18rpx 48rpx;
  border-radius: 14rpx;
  background: var(--color-primary);
}

.ets-deep-start-btn:active {
  opacity: 0.8;
}

.ets-deep-start-text {
  font-size: 26rpx;
  font-weight: 600;
  color: #fff;
}
</style>
