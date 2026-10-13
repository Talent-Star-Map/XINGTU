<template>
  <view class="webview-page">
    <web-view v-if="url" :src="url"></web-view>
    <view v-else class="error-tip">
      <text class="error-text">无法加载该资源链接</text>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'

const url = ref('')

onLoad((options) => {
  if (options && options.url) {
    url.value = decodeURIComponent(options.url)
  }
})
</script>

<style>
.webview-page {
  width: 100%;
  height: 100vh;
}

.error-tip {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
}

.error-text {
  font-size: 28rpx;
  color: var(--color-on-surface-variant);
}
</style>
