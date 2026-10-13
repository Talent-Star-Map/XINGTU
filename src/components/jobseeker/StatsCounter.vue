<template><text class="counter">{{ displayValue }}{{ suffix }}</text></template>
<script setup>
import { onMounted, ref } from 'vue'
const props = defineProps({ value: { type: Number, required: true }, suffix: { type: String, default: '' }, duration: { type: Number, default: 2 }, decimals: { type: Number, default: 0 } })
const displayValue = ref((0).toFixed(props.decimals))
onMounted(() => {
  let current = 0
  const increment = props.value / (props.duration * 60)
  const timer = setInterval(() => {
    current += increment
    if (current >= props.value) { current = props.value; clearInterval(timer) }
    displayValue.value = current.toFixed(props.decimals)
  }, 1000 / 60)
})
</script>
<style>.counter { font-variant-numeric: tabular-nums; }</style>
