<template>
  <view class="resume-page">
    <view class="page-header">
      <view>
        <text class="page-title">简历管理</text>
        <text class="page-desc">上传简历自动解析，智能提取技能与个人信息</text>
      </view>
      <view v-if="file && !confirmed" class="reset-btn" @tap="reset">
        <AppIcon name="refresh-cw" class="reset-icon" />
        <text class="reset-text">重新选择</text>
      </view>
    </view>

    <!-- 上传区 -->
    <view v-if="!confirmed && !parsing && !parseDone" class="upload-area" @tap="chooseFile">
      <view class="upload-icon-wrap">
        <AppIcon name="upload" class="upload-icon" />
      </view>
      <text class="upload-title">{{ file ? file.name : '点击选择简历文件' }}</text>
      <text class="upload-desc">支持 PDF、DOCX、DOC、TXT 格式</text>
      <view v-if="file" class="parse-btn" @tap.stop="parse">
        <AppIcon name="file-text" class="btn-icon" />
        <text class="btn-text">开始解析</text>
      </view>
    </view>

    <!-- 错误提示 -->
    <view v-if="error" class="error-bar">
      <AppIcon name="alert-circle" class="error-icon" />
      <text class="error-text">{{ error }}</text>
    </view>

    <!-- 历史上传 -->
    <view v-if="history.length > 0 && !confirmed" class="history-card">
      <view class="history-header">
        <text class="history-title">
          <AppIcon name="clock" class="ht-icon" /> 历史上传 ({{ history.length }})
        </text>
      </view>
      <view v-for="(item, i) in history" :key="i" class="history-row">
        <view class="history-info">
          <view class="history-filename">
            <AppIcon name="file-text" class="hf-icon" />
            <text class="hf-text">{{ item.filename }}</text>
          </view>
          <view class="history-meta">
            <text class="hm-date">{{ item.date }}</text>
            <text v-if="item.skill_count > 0" class="hm-badge">{{ item.skill_count }} 项技能</text>
            <text v-if="item.target_position" class="hm-pos">{{ item.target_position }}</text>
          </view>
        </view>
        <view class="history-actions">
          <view class="ha-btn" @tap="previewHistory(item.path)">
            <AppIcon name="eye" class="ha-icon" />
          </view>
          <view class="ha-btn" @tap="reparseHistory(item.path)">
            <AppIcon name="rotate-ccw" class="ha-icon" />
          </view>
          <view class="ha-btn" @tap="exportResults(item.path)">
            <AppIcon name="download" class="ha-icon" />
          </view>
          <view class="ha-btn" @tap="deleteHistory(item.path)">
            <AppIcon name="trash" class="ha-icon" />
          </view>
        </view>
      </view>
    </view>

    <!-- 解析弹窗 -->
    <view v-if="parsing || parseDone" class="modal-mask" @tap.self="onMaskTap">
      <view class="modal-box">
        <template v-if="!parseDone">
          <AppIcon name="loader" class="modal-icon spinning" />
          <text class="modal-title">正在解析简历...</text>
          <view class="modal-steps">
            <view class="step-done">
              <AppIcon name="check-circle" class="step-icon" />
              <text class="step-text">文件已上传成功</text>
            </view>
            <view class="step-loading">
              <AppIcon name="loader" class="step-icon spinning" />
              <text class="step-text">智能识别技能与个人信息...</text>
            </view>
          </view>
          <text class="modal-hint">大模型解析中，请稍候...</text>
        </template>
        <template v-else>
          <AppIcon name="check-circle" class="modal-icon modal-icon-success" />
          <text class="modal-title">解析完成</text>
          <view class="result-preview">
            <text v-if="parseResult?.name" class="rp-line"><text class="rp-label">姓名：</text>{{ parseResult.name }}</text>
            <text v-if="parseResult?.phone" class="rp-line"><text class="rp-label">手机：</text>{{ parseResult.phone }}</text>
            <text v-if="parseResult?.education" class="rp-line"><text class="rp-label">学历：</text>{{ parseResult.education }}</text>
            <text class="rp-line">
              <text class="rp-label">技能：</text>
              <template v-if="parseResult?.skills?.length">
                <text v-for="s in parseResult.skills.slice(0, 8)" :key="s" class="rp-tag">{{ s }}</text>
                <text v-if="parseResult.skills.length > 8" class="rp-more">+{{ parseResult.skills.length - 8 }}项</text>
              </template>
              <text v-else class="rp-empty">未识别</text>
            </text>
          </view>
          <view class="confirm-btn" @tap="confirmResult">
            <AppIcon name="check-circle" class="btn-icon" />
            <text class="btn-text">确认查看结果</text>
          </view>
        </template>
      </view>
    </view>

    <!-- 预览弹窗 -->
    <view v-if="preview" class="modal-mask" @tap.self="preview = null">
      <view class="preview-modal">
        <view class="preview-header">
          <text class="preview-title">
            <AppIcon name="file-text" class="preview-title-icon" /> 简历预览
          </text>
          <view class="preview-close" @tap="preview = null">
            <AppIcon name="x" />
          </view>
        </view>
        <view class="preview-body">
          <view class="preview-grid">
            <PreviewField label="姓名" :value="preview.name" />
            <PreviewField label="手机" :value="preview.phone" />
            <PreviewField label="邮箱" :value="preview.email" />
            <PreviewField label="学历" :value="preview.education" />
            <PreviewField label="学校" :value="preview.school" />
            <PreviewField label="期望岗位" :value="preview.target_position" />
            <PreviewField label="工作经验" :value="preview.experience" />
          </view>
          <view v-if="preview.skills?.length > 0" class="preview-skills">
            <text class="ps-label">技能标签 ({{ preview.skills.length }}项)</text>
            <view class="ps-tags">
              <text v-for="s in preview.skills" :key="s" class="ps-tag">{{ s }}</text>
            </view>
          </view>
          <view v-if="preview.bio" class="preview-bio">
            <text class="pb-label">个人简介</text>
            <text class="pb-text">{{ preview.bio }}</text>
          </view>
          <view v-if="preview.raw_text_preview" class="preview-raw">
            <text class="pr-label">原文预览</text>
            <text class="pr-text">{{ preview.raw_text_preview }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 解析结果详情 -->
    <view v-if="result" class="result-section">
      <view class="result-success-bar">
        <AppIcon name="check-circle" class="rs-icon" />
        <view class="rs-info">
          <text class="rs-title">解析成功</text>
          <text class="rs-desc">解析方式：{{ result.method === 'deepseek' ? 'DeepSeek 大模型' : '规则提取' }}{{ result.method !== 'deepseek' ? ' · 配置 DEEPSEEK_API_KEY 可启用大模型精确解析' : '' }}</text>
        </view>
      </view>

      <view class="field-grid">
        <FieldCard icon="user" label="姓名" :value="result.name" />
        <FieldCard icon="phone" label="手机号" :value="result.phone" />
        <FieldCard icon="mail" label="邮箱" :value="result.email" />
        <FieldCard icon="graduation-cap" label="学历" :value="result.education" />
        <FieldCard icon="graduation-cap" label="学校" :value="result.school" />
        <FieldCard icon="briefcase" label="期望岗位" :value="result.target_position" />
        <FieldCard icon="briefcase" label="工作经验" :value="result.experience" />
      </view>

      <view v-if="result.skills?.length > 0" class="skills-card">
        <text class="sc-title"><AppIcon name="code" class="sc-icon" /> 提取技能 ({{ result.skills.length }}项)</text>
        <text v-if="result.quality" class="sc-quality">置信度 {{ result.quality.confidence_avg }} · {{ result.quality.verified_count }}项已验证 · {{ result.quality.unconfirmed_count > 0 ? result.quality.unconfirmed_count + '项待确认' : '全部通过' }}</text>
        <view class="sc-tags">
          <view v-for="s in result.skills" :key="s" class="sc-tag" :style="getSkillStyle(s)">
            <text>{{ s }}</text>
            <text class="sc-conf">{{ Math.round(getConf(s) * 100) }}%</text>
          </view>
        </view>
      </view>

      <view v-if="result.bio" class="bio-card">
        <text class="bio-title">个人简介</text>
        <text class="bio-text">{{ result.bio }}</text>
      </view>

      <view class="result-actions">
        <template v-if="!filled">
          <view class="action-fill" :class="{ disabled: filling }" @tap="fillProfile">
            <template v-if="filling">
              <AppIcon name="loader" class="btn-icon spinning" />
              <text class="btn-text">保存中...</text>
            </template>
            <template v-else>
              <AppIcon name="check-circle" class="btn-icon" />
              <text class="btn-text">确认并填充到个人资料</text>
            </template>
          </view>
        </template>
        <template v-else>
          <view class="action-view" @tap="nav.setPage('profile-home')">
            <AppIcon name="check-circle" class="btn-icon" />
            <text class="btn-text">已填充，查看个人主页</text>
          </view>
          <view class="action-graph" @tap="nav.setPage('my-skill-graph')">
            <AppIcon name="code" class="btn-icon" />
            <text class="btn-text">查看能力图谱</text>
            <AppIcon name="chevron-right" class="btn-icon" />
          </view>
        </template>
        <view class="action-reset" @tap="reset">
          <text class="ar-text">重新上传</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted, inject } from 'vue'
import AppIcon from '../common/AppIcon.vue'
import FieldCard from './match/FieldCard.vue'
import PreviewField from './match/PreviewField.vue'
import { request, uploadFile, API_BASE_URL } from '../../utils/request'

const nav = inject('jobseekerNav')

const file = ref(null)
const parsing = ref(false)
const parseDone = ref(false)
const parseResult = ref(null)
const confirmed = ref(false)
const filling = ref(false)
const filled = ref(false)
const error = ref('')
const history = ref([])
const preview = ref(null)

const result = computed(() => confirmed.value && !parsing.value ? parseResult.value : null)

function onMaskTap() { if (parseDone.value) confirmResult() }

function fetchHistory() {
  request({ url: '/api/auth/resume-history' }).then(d => {
    if (d.success) history.value = d.data
  }).catch(() => {})
}

onMounted(() => fetchHistory())

function chooseFile() {
  uni.chooseMessageFile({
    count: 1,
    type: 'file',
    extension: ['pdf', 'docx', 'doc', 'txt'],
    success: (res) => {
      const f = res.tempFiles[0]
      file.value = { name: f.name, path: f.path }
      parseResult.value = null
      confirmed.value = false
      error.value = ''
      filled.value = false
    }
  })
}

function parse() {
  if (!file.value) return
  parsing.value = true
  error.value = ''
  parseResult.value = null
  parseDone.value = false

  uploadFile({ url: '/api/auth/resume-parse', filePath: file.value.path }).then(d => {
    if (d.success) {
      parseResult.value = d.data
      parseDone.value = true
      fetchHistory()
    } else {
      parsing.value = false
      error.value = d.message || '解析失败'
    }
  }).catch(() => {
    parsing.value = false
    error.value = '网络错误'
  })
}

function confirmResult() {
  parsing.value = false
  parseDone.value = false
  confirmed.value = true
}

function fillProfile() {
  if (!parseResult.value) return
  filling.value = true
  const body = {}
  const pr = parseResult.value
  if (pr.name) body.real_name = pr.name
  if (pr.phone) body.phone = pr.phone
  if (pr.education) body.education = pr.education
  if (pr.school) body.school = pr.school
  if (pr.target_position) body.target_position = pr.target_position
  if (pr.bio) body.bio = pr.bio
  if (pr.experience) body.experience = pr.experience
  if (pr.skills?.length) body.skills = pr.skills.join(', ')

  request({ url: '/api/auth/profile', method: 'PUT', data: body }).then(d => {
    filling.value = false
    if (d.success) filled.value = true
    else error.value = '保存失败'
  }).catch(() => {
    filling.value = false
    error.value = '网络错误'
  })
}

function reset() {
  file.value = null
  parseResult.value = null
  confirmed.value = false
  error.value = ''
  filled.value = false
  parseDone.value = false
}

function reparseHistory(path) {
  file.value = null
  parseResult.value = null
  confirmed.value = false
  error.value = ''
  parsing.value = true
  parseDone.value = false

  request({ url: `/api/auth/resume-reparse?filename=${encodeURIComponent(path)}`, method: 'POST' }).then(d => {
    if (d.success) {
      parseResult.value = d.data
      parseDone.value = true
      fetchHistory()
    } else {
      parsing.value = false
      error.value = d.message || '重新解析失败'
    }
  }).catch(() => {
    parsing.value = false
    error.value = '网络错误'
  })
}

function deleteHistory(path) {
  request({ url: `/api/auth/resume-delete?filename=${encodeURIComponent(path)}`, method: 'DELETE' }).catch(() => {})
  history.value = history.value.filter(i => i.path !== path)
}

function exportResults(path) {
  request({ url: `/api/auth/resume-reparse?filename=${encodeURIComponent(path)}`, method: 'POST' }).then(d => {
    if (!d.success) return
    const json = JSON.stringify(d.data, null, 2)
    const fileName = path.replace(/\.[^.]+$/, '') + '_parsed.json'
    // #ifdef H5
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.click()
    URL.revokeObjectURL(url)
    // #endif
    // #ifndef H5
    try {
      const fs = uni.getFileSystemManager()
      const filePath = `${wx.env.USER_DATA_PATH}/${fileName}`
      fs.writeFileSync(filePath, json, 'utf8')
      uni.showToast({ title: '已保存到本地', icon: 'success' })
    } catch (e) {
      uni.setClipboardData({ data: json, success: () => uni.showToast({ title: '已复制到剪贴板', icon: 'success' }) })
    }
    // #endif
  }).catch(() => {})
}

function previewHistory(path) {
  preview.value = null
  request({ url: `/api/auth/resume-reparse?filename=${encodeURIComponent(path)}`, method: 'POST' }).then(d => {
    if (d.success) preview.value = d.data
  }).catch(() => {})
}

function getConf(skill) {
  return parseResult.value?.quality?.scored_skills?.find(q => q.skill === skill)?.confidence ?? 0.5
}

function getStatus(skill) {
  return parseResult.value?.quality?.scored_skills?.find(q => q.skill === skill)?.status ?? 'unconfirmed'
}

function getSkillStyle(skill) {
  const conf = getConf(skill)
  const status = getStatus(skill)
  if (status === 'verified') return { background: 'var(--accent-green-dim)', color: 'var(--accent-green)', border: '1rpx solid var(--accent-green)' }
  if (conf >= 0.7) return { background: 'var(--color-primary-fixed)', color: 'var(--color-primary)' }
  return { background: 'var(--accent-orange-dim)', color: 'var(--accent-orange)', border: '1rpx solid var(--accent-orange)' }
}
</script>

<style scoped>
.resume-page { padding: 32rpx; }
.page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32rpx; }
.page-title { font-size: 36rpx; font-weight: 700; color: var(--color-on-surface); display: block; }
.page-desc { font-size: 24rpx; color: var(--color-on-surface-variant); margin-top: 8rpx; display: block; }
.reset-btn { display: flex; align-items: center; gap: 8rpx; padding: 12rpx 20rpx; border-radius: 12rpx; background: var(--color-surface); }
.reset-icon { width: 28rpx; height: 28rpx; color: var(--color-on-surface-variant); }
.reset-text { font-size: 24rpx; color: var(--color-on-surface-variant); }

.upload-area { display: flex; flex-direction: column; align-items: center; padding: 64rpx 32rpx; border: 2rpx dashed var(--color-outline-variant); border-radius: 20rpx; background: var(--color-surface-container-lowest); }
.upload-icon-wrap { display: flex; width: 128rpx; height: 128rpx; align-items: center; justify-content: center; border-radius: 32rpx; background: var(--accent-cyan-dim); margin-bottom: 24rpx; }
.upload-icon { width: 56rpx; height: 56rpx; color: var(--color-primary); }
.upload-title { font-size: 28rpx; font-weight: 600; color: var(--color-on-surface); margin-bottom: 12rpx; }
.upload-desc { font-size: 24rpx; color: var(--color-on-surface-variant); }
.parse-btn { display: flex; align-items: center; justify-content: center; gap: 12rpx; margin-top: 32rpx; padding: 24rpx 64rpx; border-radius: 16rpx; background: linear-gradient(135deg, var(--color-primary), var(--accent-purple)); }
.btn-icon { width: 28rpx; height: 28rpx; color: #fff; }
.btn-text { font-size: 26rpx; font-weight: 600; color: #fff; }

.error-bar { display: flex; align-items: center; gap: 12rpx; padding: 24rpx; border-radius: 16rpx; border: 1rpx solid var(--accent-red); background: var(--accent-red-dim); margin-bottom: 24rpx; }
.error-icon { width: 32rpx; height: 32rpx; color: var(--accent-red); flex: none; }
.error-text { font-size: 24rpx; color: var(--color-on-surface-variant); }

.history-card { border: 1rpx solid var(--color-outline-variant); border-radius: 24rpx; background: var(--color-surface-container-lowest); margin-bottom: 24rpx; }
.history-header { padding: 24rpx 32rpx; border-bottom: 1rpx solid var(--color-outline-variant); }
.history-title { font-size: 24rpx; font-weight: 700; color: var(--color-on-surface); display: flex; align-items: center; gap: 8rpx; }
.ht-icon { width: 28rpx; height: 28rpx; }
.history-row { display: flex; align-items: center; justify-content: space-between; padding: 24rpx 32rpx; border-bottom: 1rpx solid var(--color-outline-variant); }
.history-row:last-child { border-bottom: none; }
.history-info { flex: 1; min-width: 0; }
.history-filename { display: flex; align-items: center; gap: 8rpx; }
.hf-icon { width: 28rpx; height: 28rpx; color: var(--color-on-surface-variant); flex: none; }
.hf-text { font-size: 24rpx; font-weight: 600; color: var(--color-on-surface); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.history-meta { display: flex; align-items: center; gap: 16rpx; margin-top: 8rpx; }
.hm-date { font-size: 22rpx; color: var(--color-on-surface-variant); }
.hm-badge { font-size: 22rpx; padding: 4rpx 12rpx; border-radius: 6rpx; background: var(--color-primary-fixed); color: var(--color-primary); }
.hm-pos { font-size: 22rpx; color: var(--color-on-surface-variant); }
.history-actions { display: flex; gap: 8rpx; margin-left: 16rpx; }
.ha-btn { padding: 12rpx; border-radius: 12rpx; }
.ha-btn:active { background: var(--color-surface-container); }
.ha-icon { width: 28rpx; height: 28rpx; color: var(--color-on-surface-variant); }

.modal-mask { position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 100; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.5); }
.modal-box { width: 680rpx; padding: 64rpx 48rpx; border-radius: 24rpx; border: 1rpx solid var(--color-outline-variant); background: var(--color-surface-container-lowest); display: flex; flex-direction: column; align-items: center; }
.modal-icon { width: 96rpx; height: 96rpx; color: var(--color-primary); margin-bottom: 32rpx; }
.modal-icon-success { color: var(--accent-green); }
.modal-title { font-size: 30rpx; font-weight: 700; color: var(--color-on-surface); margin-bottom: 24rpx; }
.modal-steps { width: 100%; max-width: 480rpx; margin-bottom: 24rpx; }
.step-done, .step-loading { display: flex; align-items: center; gap: 12rpx; margin-bottom: 16rpx; }
.step-done { color: var(--accent-green); }
.step-loading { color: var(--color-on-surface-variant); }
.step-icon { width: 24rpx; height: 24rpx; flex: none; }
.step-text { font-size: 24rpx; }
.modal-hint { font-size: 22rpx; color: var(--color-on-surface-variant); margin-top: 16rpx; }

.result-preview { width: 100%; padding: 24rpx; border-radius: 16rpx; background: var(--color-surface-container); margin-bottom: 32rpx; }
.rp-line { font-size: 24rpx; color: var(--color-on-surface); display: flex; flex-wrap: wrap; align-items: center; margin-bottom: 8rpx; }
.rp-label { color: var(--color-on-surface-variant); }
.rp-tag { display: inline-block; padding: 4rpx 12rpx; border-radius: 6rpx; background: var(--color-primary-fixed); color: var(--color-primary); font-size: 22rpx; font-weight: 500; margin: 4rpx 4rpx 0 0; }
.rp-more { font-size: 22rpx; color: var(--color-on-surface-variant); }
.rp-empty { color: var(--color-on-surface-variant); }

.confirm-btn { display: flex; align-items: center; justify-content: center; gap: 12rpx; padding: 24rpx 64rpx; border-radius: 16rpx; background: linear-gradient(135deg, var(--color-primary), var(--accent-purple)); }

.preview-modal { width: 680rpx; max-height: 80vh; border-radius: 24rpx; border: 1rpx solid var(--color-outline-variant); background: var(--color-surface-container-lowest); overflow: hidden; }
.preview-header { display: flex; align-items: center; justify-content: space-between; padding: 24rpx 32rpx; border-bottom: 1rpx solid var(--color-outline-variant); }
.preview-title { font-size: 28rpx; font-weight: 700; color: var(--color-on-surface); display: flex; align-items: center; gap: 8rpx; }
.preview-title-icon { width: 32rpx; height: 32rpx; color: var(--color-primary); }
.preview-close { padding: 8rpx; }
.preview-body { padding: 32rpx; overflow-y: auto; max-height: 60vh; }
.preview-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16rpx; margin-bottom: 24rpx; }
.preview-skills { margin-bottom: 24rpx; }
.ps-label { font-size: 22rpx; font-weight: 600; color: var(--color-on-surface-variant); margin-bottom: 12rpx; display: block; }
.ps-tags { display: flex; flex-wrap: wrap; gap: 8rpx; }
.ps-tag { padding: 8rpx 16rpx; border-radius: 8rpx; background: var(--color-primary-fixed); color: var(--color-primary); font-size: 22rpx; font-weight: 500; }
.preview-bio { margin-bottom: 24rpx; }
.pb-label { font-size: 22rpx; font-weight: 600; color: var(--color-on-surface-variant); margin-bottom: 8rpx; display: block; }
.pb-text { font-size: 24rpx; color: var(--color-on-surface); white-space: pre-wrap; }
.preview-raw { margin-top: 16rpx; }
.pr-label { font-size: 22rpx; color: var(--color-on-surface-variant); display: block; margin-bottom: 8rpx; }
.pr-text { font-size: 22rpx; padding: 16rpx; border-radius: 12rpx; background: var(--color-surface-container); color: var(--color-on-surface-variant); white-space: pre-wrap; max-height: 320rpx; overflow-y: auto; display: block; }

.result-section { margin-top: 32rpx; }
.result-success-bar { display: flex; align-items: center; gap: 12rpx; padding: 24rpx; border-radius: 16rpx; border: 1rpx solid var(--accent-green); background: var(--accent-green-dim); margin-bottom: 24rpx; }
.rs-icon { width: 32rpx; height: 32rpx; color: var(--accent-green); flex: none; }
.rs-info { flex: 1; }
.rs-title { font-size: 24rpx; font-weight: 600; color: var(--accent-green); display: block; }
.rs-desc { font-size: 22rpx; color: var(--color-on-surface-variant); margin-top: 4rpx; display: block; }

.field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16rpx; margin-bottom: 24rpx; }

.skills-card { padding: 32rpx; border: 1rpx solid var(--color-outline-variant); border-radius: 24rpx; background: var(--color-surface-container-lowest); margin-bottom: 24rpx; }
.sc-title { font-size: 28rpx; font-weight: 700; color: var(--color-on-surface); display: flex; align-items: center; gap: 8rpx; margin-bottom: 8rpx; }
.sc-icon { width: 28rpx; height: 28rpx; }
.sc-quality { font-size: 22rpx; color: var(--color-on-surface-variant); margin-bottom: 16rpx; display: block; }
.sc-tags { display: flex; flex-wrap: wrap; gap: 12rpx; }
.sc-tag { display: flex; align-items: center; gap: 6rpx; padding: 10rpx 20rpx; border-radius: 12rpx; font-size: 24rpx; font-weight: 600; }
.sc-conf { font-size: 20rpx; opacity: 0.6; }

.bio-card { padding: 32rpx; border: 1rpx solid var(--color-outline-variant); border-radius: 24rpx; background: var(--color-surface-container-lowest); margin-bottom: 24rpx; }
.bio-title { font-size: 28rpx; font-weight: 700; color: var(--color-on-surface); margin-bottom: 12rpx; display: block; }
.bio-text { font-size: 24rpx; color: var(--color-on-surface-variant); white-space: pre-wrap; }

.result-actions { display: flex; align-items: center; gap: 16rpx; flex-wrap: wrap; }
.action-fill, .action-view, .action-graph { display: flex; align-items: center; justify-content: center; gap: 12rpx; padding: 24rpx 48rpx; border-radius: 16rpx; font-size: 24rpx; font-weight: 600; }
.action-fill { background: linear-gradient(135deg, var(--color-primary), var(--accent-purple)); color: #fff; }
.action-fill.disabled { opacity: 0.6; }
.action-fill .btn-icon, .action-fill .btn-text { color: #fff; }
.action-view { background: var(--accent-green); color: #fff; }
.action-view .btn-icon, .action-view .btn-text { color: #fff; }
.action-graph { background: var(--color-primary-fixed); color: var(--color-primary); }
.action-graph .btn-icon, .action-graph .btn-text { color: var(--color-primary); }
.action-reset { padding: 16rpx 32rpx; }
.ar-text { font-size: 24rpx; color: var(--color-on-surface-variant); }

.spinning { animation: spin 1s linear infinite; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
</style>
