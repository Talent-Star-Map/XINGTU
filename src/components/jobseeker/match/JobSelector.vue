<template>
  <view class="job-selector">
    <view class="search-bar">
      <view class="search-wrap">
        <AppIcon name="search" class="search-icon" />
        <input class="search-input" v-model="search" placeholder="搜索职位、技能或公司..." />
      </view>
      <view class="filter-btn" :class="{ active: showFilters }" @tap="showFilters = !showFilters">
        <AppIcon name="sliders" class="filter-icon" />
        <text>筛选</text>
      </view>
    </view>

    <view v-if="showFilters" class="filter-panel">
      <view class="filter-header">
        <text class="filter-title">地区</text>
        <text v-if="province" class="filter-clear" @tap="clearRegion">清除</text>
      </view>
      <view class="filter-row">
        <picker :range="provinceList" :value="provinceIdx" @change="onProvinceChange">
          <view class="picker-btn">{{ province || '不限' }}</view>
        </picker>
        <picker :range="cityList" :value="cityIdx" @change="onCityChange">
          <view class="picker-btn">{{ regionCity || '不限' }}</view>
        </picker>
        <picker :range="districtList" :value="districtIdx" @change="onDistrictChange">
          <view class="picker-btn">{{ district || '不限' }}</view>
        </picker>
      </view>
    </view>

    <view v-if="showRecBanner" class="rec-banner">
      <text class="rec-banner-text">为您推荐 {{ recommendations.length }} 个匹配岗位</text>
    </view>

    <view class="job-list">
      <view v-for="job in displayJobs" :key="job.id" class="job-card" :class="{ selected: selectedJobId === job.id }" @tap="$emit('selectJob', job)">
        <view class="job-top">
          <view class="job-info">
            <text class="job-title">{{ job.title }}</text>
            <view class="job-meta">
              <text>{{ job.company }}</text>
              <view class="dot"></view>
              <AppIcon name="map-pin" class="meta-icon" />
              <text>{{ job.location }}</text>
            </view>
          </view>
          <text class="job-salary">{{ job.salary }}</text>
        </view>
        <view class="job-tags">
          <text v-for="s in job.skills.slice(0, 6)" :key="s" class="tag">{{ s }}</text>
          <text v-if="job.skills.length > 6" class="tag-more">+{{ job.skills.length - 6 }}</text>
        </view>
        <view class="job-footer">
          <text class="job-active">招聘方 · 今日活跃</text>
          <view class="job-actions">
            <text v-if="getRec(job)" class="ai-score">AI {{ Math.round(getRec(job).overall) }}%</text>
            <view class="diagnose-btn" @tap.stop="$emit('diagnose', job)">
              <AppIcon name="target" class="d-icon" />
              <text class="d-text">诊断</text>
            </view>
          </view>
        </view>
      </view>
      <view v-if="displayJobs.length === 0" class="empty">
        <text class="empty-text">没有符合条件的岗位</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import AppIcon from '../../common/AppIcon.vue'
import { REGION_DATA } from './regionData.js'

const props = defineProps({
  jobs: { type: Array, default: () => [] },
  displayJobs: { type: Array, default: () => [] },
  recommendations: { type: Array, default: () => [] },
  mode: { type: String, default: 'recommend' },
  selectedJobId: { type: Number, default: null },
})

const emit = defineEmits(['selectJob', 'diagnose', 'filterChange'])

const search = ref('')
const showFilters = ref(false)
const province = ref('')
const regionCity = ref('')
const district = ref('')

const provinceList = computed(() => Object.keys(REGION_DATA))
const provinceIdx = computed(() => provinceList.value.indexOf(province.value))
const cityList = computed(() => province.value ? Object.keys(REGION_DATA[province.value] || {}) : [])
const cityIdx = computed(() => cityList.value.indexOf(regionCity.value))
const districtList = computed(() => (province.value && regionCity.value) ? (REGION_DATA[province.value]?.[regionCity.value] || []) : [])
const districtIdx = computed(() => districtList.value.indexOf(district.value))
const showRecBanner = computed(() => props.mode === 'recommend' && props.recommendations.length > 0)

function getRec(job) { return showRecBanner.value ? props.recommendations.find(r => r.job_id === job.id) || null : null }
function clearRegion() { province.value = ''; regionCity.value = ''; district.value = '' }
function onProvinceChange(e) { province.value = provinceList.value[e.detail.value] || ''; regionCity.value = ''; district.value = '' }
function onCityChange(e) { regionCity.value = cityList.value[e.detail.value] || ''; district.value = '' }
function onDistrictChange(e) { district.value = districtList.value[e.detail.value] || '' }

function doFilter() {
  const regionKw = district.value || (regionCity.value ? regionCity.value.replace(/市$/, '') : '') || province.value || ''
  const kw = search.value.toLowerCase().trim()
  emit('filterChange', props.jobs.filter(j => {
    const matchSearch = !kw || j.title.toLowerCase().includes(kw) || j.company.toLowerCase().includes(kw) || (j.skills || []).some(s => s.toLowerCase().includes(kw))
    const matchRegion = !regionKw || (j.location || '').includes(regionKw)
    return matchSearch && matchRegion
  }))
}

watch([search, province, regionCity, district], doFilter)
</script>

<style>
.search-bar { display: flex; gap: 16rpx; }
.search-wrap { flex: 1; position: relative; display: flex; align-items: center; }
.search-icon { position: absolute; left: 24rpx; width: 28rpx; height: 28rpx; color: var(--color-on-surface-variant); }
.search-input { width: 100%; height: 80rpx; padding: 0 24rpx 0 68rpx; border: 1rpx solid var(--color-outline-variant); border-radius: 20rpx; background: var(--color-surface-container-lowest); color: var(--color-on-surface); font-size: 24rpx; }
.filter-btn { display: flex; align-items: center; gap: 12rpx; height: 80rpx; padding: 0 32rpx; border: 1rpx solid var(--color-outline-variant); border-radius: 20rpx; background: var(--color-surface-container-lowest); color: var(--color-on-surface-variant); font-size: 24rpx; font-weight: 500; }
.filter-btn.active { border-color: var(--color-primary); background: var(--color-primary-fixed); color: var(--color-primary); }
.filter-icon { width: 28rpx; height: 28rpx; }
.filter-panel { padding: 32rpx; border: 1rpx solid var(--color-outline-variant); border-radius: 20rpx; background: var(--color-surface-container-lowest); }
.filter-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16rpx; }
.filter-title { font-size: 26rpx; font-weight: 600; color: var(--color-on-surface); }
.filter-clear { font-size: 22rpx; color: var(--color-primary); }
.filter-row { display: flex; gap: 16rpx; }
.picker-btn { flex: 1; height: 60rpx; display: flex; align-items: center; justify-content: center; border: 1rpx solid var(--color-outline-variant); border-radius: 14rpx; font-size: 22rpx; background: var(--color-surface); color: var(--color-on-surface); }
.rec-banner { padding: 24rpx 32rpx; border: 1rpx solid var(--color-primary-fixed); border-radius: 20rpx; background: var(--color-primary-fixed); }
.rec-banner-text { font-size: 26rpx; font-weight: 600; color: var(--color-primary); }
.job-list { display: flex; flex-direction: column; gap: 24rpx; }
.job-card { padding: 36rpx; border: 1rpx solid var(--color-outline-variant); border-radius: 20rpx; background: var(--color-surface-container-lowest); }
.job-card.selected { border-color: var(--color-primary); }
.job-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16rpx; }
.job-info { flex: 1; min-width: 0; }
.job-title { font-size: 28rpx; font-weight: 700; color: var(--color-on-surface); }
.job-meta { display: flex; align-items: center; gap: 8rpx; margin-top: 8rpx; font-size: 22rpx; color: var(--color-on-surface-variant); }
.dot { width: 8rpx; height: 8rpx; border-radius: 50%; background: var(--color-outline-variant); }
.meta-icon { width: 22rpx; height: 22rpx; }
.job-salary { font-size: 28rpx; font-weight: 700; color: var(--color-primary); flex: none; }
.job-tags { display: flex; flex-wrap: wrap; gap: 10rpx; margin-bottom: 20rpx; }
.tag { padding: 6rpx 18rpx; border-radius: 999rpx; background: var(--color-surface-container); color: var(--color-on-surface-variant); font-size: 20rpx; }
.tag-more { font-size: 20rpx; color: var(--color-on-surface-variant); }
.job-footer { display: flex; justify-content: space-between; align-items: center; padding-top: 16rpx; border-top: 1rpx solid var(--color-outline-variant); }
.job-active { font-size: 20rpx; color: var(--color-on-surface-variant); }
.job-actions { display: flex; align-items: center; gap: 12rpx; }
.ai-score { padding: 6rpx 16rpx; border-radius: 999rpx; background: var(--color-primary-fixed); color: var(--color-primary); font-size: 20rpx; font-weight: 700; }
.diagnose-btn { display: flex; align-items: center; gap: 8rpx; padding: 10rpx 20rpx; border-radius: 14rpx; background: var(--color-primary); }
.d-icon { width: 22rpx; height: 22rpx; color: #fff; }
.d-text { font-size: 22rpx; font-weight: 600; color: #fff; }
.empty { padding: 80rpx 0; text-align: center; }
.empty-text { font-size: 24rpx; color: var(--color-on-surface-variant); }
</style>
