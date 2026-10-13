<template>
  <view class="score-panel">
    <view class="gauge-area">
      <MatchGauge :overall="result.overall" :grade="result.grade" :score-version="result.score_version" />
    </view>
    <view class="dims-area">
      <DimensionBars :dims="result.dims" />
    </view>
  </view>
</template>

<script setup>
import MatchGauge from './MatchGauge.vue'
import DimensionBars from './DimensionBars.vue'

defineProps({
  result: {
    type: Object,
    required: true,
  },
})
</script>

<style>
.score-panel {
  display: grid;
  grid-template-columns: 2fr 3fr;
  gap: 24rpx;
}

@media (max-width: 600px) {
  .score-panel {
    grid-template-columns: 1fr;
  }
}

.gauge-area,
.dims-area {
  min-width: 0;
}
</style>
