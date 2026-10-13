<template>
  <view class="learning-path">
    <LearningTimeline :phases="phases" :total-weeks="totalWeeks" :target-job-title="targetJobTitle" />
  </view>
</template>

<script setup>
import LearningTimeline from './LearningTimeline.vue'

defineProps({
  phases: { type: Array, default: () => [] },
  totalWeeks: { type: String, default: '' },
  targetJobTitle: { type: String, default: '' },
})
</script>

<style>
.learning-path {}
</style>
