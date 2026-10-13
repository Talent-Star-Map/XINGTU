<template>
  <view class="skill-gap">
    <view class="gap-header">
      <text class="gap-title">技能差距对比</text>
      <view class="gap-legend">
        <view class="legend-item"><view class="legend-dot" style="background: var(--accent-green);"></view><text>已掌握</text></view>
        <view class="legend-item"><view class="legend-dot" style="background: var(--accent-red);"></view><text>待提升</text></view>
        <view class="legend-item"><view class="legend-dot" style="background: var(--accent-purple);"></view><text>加分项</text></view>
      </view>
    </view>
    <view class="gap-grid">
      <view class="gap-col">
        <view class="col-header" style="color: var(--accent-green);">
          <text>已掌握</text>
          <view class="col-count" style="background: rgba(5,150,105,0.15);">{{ have.length }}</view>
        </view>
        <view class="skill-list">
          <view v-for="s in visibleHave" :key="s.skill" class="skill-chip" style="background: rgba(5,150,105,0.08); border: 1rpx solid rgba(5,150,105,0.2);">
            <text style="color: var(--accent-green);">{{ s.skill }}</text>
            <text v-if="s.verified" class="chip-badge" style="background: rgba(5,150,105,0.2); color: var(--accent-green);">&#x2713;</text>
          </view>
          <view v-if="have.length > MAX_SHOW" class="expand-btn" @tap="haveExpanded = !haveExpanded">
            <text style="color: var(--color-primary);">{{ haveExpanded ? '收起' : '还有 ' + (have.length - MAX_SHOW) + ' 项' }}</text>
          </view>
        </view>
        <text class="col-note">你已具备的技能</text>
      </view>

      <view class="gap-col">
        <view class="col-header" style="color: var(--accent-red);">
          <text>待提升</text>
          <view class="col-count" style="background: rgba(220,38,38,0.15);">{{ miss.length }}</view>
        </view>
        <view class="skill-list">
          <view v-for="s in visibleMiss" :key="s.skill" class="skill-chip" style="background: rgba(220,38,38,0.08); border: 1rpx solid rgba(220,38,38,0.2);">
            <text style="color: var(--accent-red);">{{ s.skill }}</text>
            <text v-if="s.priority" class="chip-badge" :style="{ background: priorityColor(s.priority) + '22', color: priorityColor(s.priority) }">{{ priorityLabel(s.priority) }}</text>
          </view>
          <view v-if="miss.length > MAX_SHOW" class="expand-btn" @tap="missExpanded = !missExpanded">
            <text style="color: var(--color-primary);">{{ missExpanded ? '收起' : '还有 ' + (miss.length - MAX_SHOW) + ' 项' }}</text>
          </view>
        </view>
        <text class="col-note">岗位需要但你还未掌握</text>
      </view>

      <view class="gap-col">
        <view class="col-header" style="color: var(--accent-purple);">
          <text>加分项</text>
          <view class="col-count" style="background: rgba(167,139,250,0.15);">{{ extra.length }}</view>
        </view>
        <view class="skill-list">
          <view v-for="s in visibleExtra" :key="s.skill" class="skill-chip" style="background: rgba(167,139,250,0.08); border: 1rpx solid rgba(167,139,250,0.2);">
            <text style="color: var(--accent-purple);">{{ s.skill }}</text>
          </view>
          <view v-if="extra.length > MAX_SHOW" class="expand-btn" @tap="extraExpanded = !extraExpanded">
            <text style="color: var(--color-primary);">{{ extraExpanded ? '收起' : '还有 ' + (extra.length - MAX_SHOW) + ' 项' }}</text>
          </view>
        </view>
        <text class="col-note">你具备但岗位未要求</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  have: { type: Array, default: () => [] },
  miss: { type: Array, default: () => [] },
  extra: { type: Array, default: () => [] },
})

const MAX_SHOW = 5
const haveExpanded = ref(false)
const missExpanded = ref(false)
const extraExpanded = ref(false)

const visibleHave = computed(() => haveExpanded.value ? props.have : props.have.slice(0, MAX_SHOW))
const visibleMiss = computed(() => missExpanded.value ? props.miss : props.miss.slice(0, MAX_SHOW))
const visibleExtra = computed(() => extraExpanded.value ? props.extra : props.extra.slice(0, MAX_SHOW))

const PRIORITY_LABELS = { high: '高', medium: '中', low: '低' }
const PRIORITY_COLORS = { high: 'var(--accent-red)', medium: 'var(--accent-orange)', low: 'var(--color-on-surface-variant)' }

function priorityLabel(p) { return PRIORITY_LABELS[p] || '低' }
function priorityColor(p) { return PRIORITY_COLORS[p] || 'var(--color-on-surface-variant)' }
</script>

<style>
.skill-gap { padding: 40rpx; border: 1rpx solid var(--color-outline-variant); border-radius: 24rpx; background: var(--color-surface-container-lowest); }
.gap-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 28rpx; }
.gap-title { font-size: 24rpx; font-weight: 700; color: var(--color-on-surface); }
.gap-legend { display: flex; gap: 16rpx; }
.legend-item { display: flex; align-items: center; gap: 6rpx; font-size: 18rpx; color: var(--color-on-surface-variant); }
.legend-dot { width: 14rpx; height: 14rpx; border-radius: 50%; }
.gap-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 28rpx; }
.gap-col {}
.col-header { display: flex; align-items: center; gap: 10rpx; font-size: 22rpx; font-weight: 600; margin-bottom: 14rpx; }
.col-count { padding: 2rpx 12rpx; border-radius: 999rpx; font-size: 18rpx; }
.skill-list { display: flex; flex-direction: column; gap: 8rpx; }
.skill-chip { display: flex; align-items: center; gap: 8rpx; padding: 10rpx 16rpx; border-radius: 14rpx; font-size: 22rpx; }
.chip-badge { font-size: 16rpx; padding: 2rpx 8rpx; border-radius: 6rpx; }
.expand-btn { padding-top: 8rpx; }
.expand-btn text { font-size: 18rpx; }
.col-note { display: block; text-align: center; margin-top: 14rpx; font-size: 18rpx; color: var(--color-on-surface-variant); }
</style>
