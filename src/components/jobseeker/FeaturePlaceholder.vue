<template><view class="placeholder"><AppIcon :name="icon" /><text class="placeholder-title">{{ title }}</text><text class="placeholder-copy">后续阶段迁移</text></view></template>
<script setup>
import AppIcon from '../common/AppIcon.vue'
defineProps({ title: String, icon: { type: String, default: 'file' } })
</script>
<style>.placeholder { display:flex; min-height:520rpx; margin:48rpx; flex-direction:column; align-items:center; justify-content:center; gap:20rpx; border:1rpx dashed var(--color-outline-variant); border-radius:32rpx; background:var(--color-surface-container-lowest); color:var(--color-on-surface-variant); }.placeholder .app-icon { color:var(--color-primary); font-size:76rpx; }.placeholder-title { color:var(--color-on-surface); font-size:32rpx; font-weight:700; }.placeholder-copy { font-size:26rpx; }</style>
