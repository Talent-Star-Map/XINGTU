<template>
  <text class="app-icon iconfont" :style="iconStyle">{{ iconChar }}</text>
</template>

<script setup>
import { computed } from 'vue'
import { iconMap } from '@/constants/iconMap'

const props = defineProps({
  name: { type: String, required: true },
  size: { type: [Number, String], default: null },
  color: { type: String, default: null }
})

const iconChar = computed(() => iconMap[props.name] || '')

const iconStyle = computed(() => {
  const style = {}
  if (props.size != null) {
    style.fontSize = typeof props.size === 'number' ? `${props.size}rpx` : props.size
  }
  if (props.color != null) {
    style.color = props.color
  }
  return style
})
</script>

<style>
.app-icon {
  display: inline-block;
  width: 1em;
  height: 1em;
}
</style>