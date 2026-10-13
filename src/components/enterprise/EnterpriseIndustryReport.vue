<template>
  <view class="ep-report">
    <!-- 顶部 -->
    <view class="ep-report-header">
      <text class="ep-report-title">行业报告</text>
      <text class="ep-report-subtitle">共 {{ reports.length }} 份报告</text>
    </view>

    <!-- 报告列表 -->
    <view class="ep-report-list">
      <view
        v-for="(report, i) in reports"
        :key="report.title"
        class="ep-report-item"
        @tap="onReportTap(report)"
      >
        <view class="ep-report-item-left">
          <text class="ep-report-icon">📄</text>
          <view class="ep-report-item-info">
            <text class="ep-report-item-title">{{ report.title }}</text>
            <view class="ep-report-item-meta">
              <text>{{ report.type }}</text>
              <text>·</text>
              <text>{{ report.pages }} 页</text>
              <text>·</text>
              <text>{{ report.date }}</text>
            </view>
          </view>
        </view>
        <view class="ep-report-download" @tap.stop="onDownload(report)">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" x2="12" y1="15" y2="3"/>
          </svg>
        </view>
      </view>
    </view>

    <!-- 底部说明 -->
    <view class="ep-report-footer">
      <text class="ep-report-footer-arrow">→</text>
      <text class="ep-report-footer-text">报告由星图研究院发布，仅供企业端用户参考</text>
    </view>
  </view>
</template>

<script setup>
const reports = [
  { title: '2026 Q2 人工智能领域人才需求报告', date: '2026-07-01', type: '季度报告', pages: 12 },
  { title: '大模型应用开发技能图谱白皮书', date: '2026-06-15', type: '白皮书', pages: 24 },
  { title: '新一代信息技术岗位薪酬调研', date: '2026-06-01', type: '调研报告', pages: 18 },
  { title: 'AI Agent 工程师岗位定义与技能标准', date: '2026-05-20', type: '岗位分析', pages: 8 },
]

function onReportTap(report) {
  uni.showModal({
    title: report.title,
    content: `类型：${report.type}\n页数：${report.pages} 页\n发布日期：${report.date}`,
    showCancel: false,
    confirmText: '知道了',
  })
}

function onDownload(report) {
  // 当前暂无下载接口，按钮仅作为固定展示按钮
}
</script>

<style>
.ep-report {
  min-height: 100%;
  box-sizing: border-box;
  padding: 28rpx 32rpx 60rpx;
  display: flex;
  flex-direction: column;
  gap: 40rpx;
}

/* 头部 */
.ep-report-header {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.ep-report-title {
  font-size: 38rpx;
  font-weight: 700;
  color: var(--color-on-surface);
  letter-spacing: 1rpx;
}

.ep-report-subtitle {
  font-size: 24rpx;
  color: var(--color-on-surface-variant);
}

/* 列表 */
.ep-report-list {
  display: flex;
  flex-direction: column;
  border-top: 1rpx solid var(--color-outline-variant);
}

.ep-report-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 32rpx 12rpx;
  border-bottom: 1rpx solid var(--color-outline-variant);
}

.ep-report-item:active {
  background: var(--color-surface-container-low);
}

.ep-report-item-left {
  display: flex;
  align-items: flex-start;
  gap: 24rpx;
  flex: 1;
  min-width: 0;
}

.ep-report-icon {
  font-size: 36rpx;
  flex-shrink: 0;
  margin-top: 4rpx;
}

.ep-report-item-info {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  min-width: 0;
}

.ep-report-item-title {
  font-size: 30rpx;
  font-weight: 500;
  color: var(--color-on-surface);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ep-report-item-meta {
  display: flex;
  align-items: center;
  gap: 10rpx;
  font-size: 24rpx;
  color: var(--color-on-surface-variant);
  font-variant-numeric: tabular-nums;
}

/* 下载按钮 */
.ep-report-download {
  width: 48rpx;
  height: 48rpx;
  flex-shrink: 0;
  margin-left: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ep-report-download:active {
  opacity: 0.6;
}

/* 底部说明 */
.ep-report-footer {
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.ep-report-footer-arrow {
  font-size: 26rpx;
  color: var(--color-on-surface-variant);
}

.ep-report-footer-text {
  font-size: 24rpx;
  color: var(--color-on-surface-variant);
}
</style>
