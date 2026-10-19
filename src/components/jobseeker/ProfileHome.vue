<template>
  <view class="profile-home">
    <!-- 加载状态 -->
    <view v-if="loading" class="loading-state">
      <view class="loading-spinner"></view>
    </view>

    <!-- 未登录 -->
    <view v-else-if="!profile" class="empty-hint">
      <text>请先登录</text>
    </view>

    <!-- 主内容 -->
    <view v-else class="profile-content">
      <view class="profile-main">
        <!-- 头部资料卡片 -->
        <view class="card header-card">
          <view class="header-row">
            <view class="avatar-area" @tap="handleAvatarUpload">
              <image v-if="profile.avatar" :src="avatarUrl" class="avatar-img" mode="aspectFill" />
              <view v-else class="avatar-placeholder">
                <AppIcon name="user" class="avatar-placeholder-icon" />
              </view>
              <view class="avatar-overlay">
                <AppIcon name="camera" class="camera-icon" />
              </view>
            </view>
            <view class="header-info">
              <view class="header-top">
                <view>
                  <text class="user-name">{{ displayName }}</text>
                  <view class="contact-row">
                    <view v-if="profile.email" class="contact-item">
                      <AppIcon name="mail" class="contact-icon" />
                      <text>{{ profile.email }}</text>
                    </view>
                    <view v-if="profile.phone" class="contact-item">
                      <AppIcon name="phone" class="contact-icon" />
                      <text>{{ profile.phone }}</text>
                    </view>
                    <view v-if="profile.city" class="contact-item">
                      <AppIcon name="map-pin" class="contact-icon" />
                      <text>{{ profile.city }}</text>
                    </view>
                  </view>
                  <text class="target-info">{{ profile.target_position || profile.education ? [profile.target_position, profile.education].filter(Boolean).join(' · ') : '未设置岗位和学历' }}</text>
                </view>
                <view class="header-actions">
                  <view class="action-btn outline" @tap="handleResumeImport">
                    <AppIcon name="upload" class="act-icon" />
                    <text class="act-text">导入简历</text>
                  </view>
                  <view class="action-btn gradient" @tap="openEditModal">
                    <AppIcon name="edit-3" class="act-icon white" />
                    <text class="act-text white">编辑资料</text>
                  </view>
                </view>
              </view>
              <!-- 资料完整度 -->
              <view class="completeness">
                <view class="comp-header">
                  <text class="comp-label">资料完整度</text>
                  <text class="comp-pct" :style="{ color: pct >= 70 ? 'var(--accent-green)' : 'var(--accent-orange)' }">{{ pct }}%</text>
                </view>
                <view class="comp-bar">
                  <view class="comp-bar-fill" :style="{ width: pct + '%', background: pct >= 70 ? 'var(--accent-green)' : 'var(--accent-orange)' }"></view>
                </view>
              </view>
            </view>
          </view>
        </view>

        <!-- 求职意向 -->
        <view class="card">
          <view class="section-header">
            <text class="section-title">求职意向</text>
            <view class="edit-btn" @tap="openEditModal">
              <AppIcon name="edit-3" class="edit-icon" />
            </view>
          </view>
          <view class="fields-grid">
            <FormField icon="target" label="目标岗位" :value="profile.target_position" />
            <FormField icon="map-pin" label="目标城市" :value="profile.target_city" />
            <FormField icon="star" label="期望薪资" :value="profile.expected_salary" />
          </view>
        </view>

        <!-- 教育背景 -->
        <view class="card">
          <view class="section-header">
            <text class="section-title">教育背景</text>
            <view class="edit-btn" @tap="openEditModal">
              <AppIcon name="edit-3" class="edit-icon" />
            </view>
          </view>
          <view class="fields-grid">
            <FormField icon="graduation-cap" label="学历" :value="profile.education" />
            <FormField icon="building" label="毕业院校" :value="profile.school" />
            <FormField icon="user" label="年龄" :value="profile.age ? profile.age + '岁' : ''" />
          </view>
        </view>

        <!-- 个人简介 -->
        <view class="card">
          <view class="section-header">
            <text class="section-title">个人简介</text>
            <view class="edit-btn" @tap="openEditModal">
              <AppIcon name="edit-3" class="edit-icon" />
            </view>
          </view>
          <text v-if="profile.bio" class="bio-text">{{ profile.bio }}</text>
          <text v-else class="bio-hint">点击 <text class="link" @tap="openEditModal">编辑资料</text> 添加个人简介</text>
        </view>

        <!-- 技能标签 -->
        <view class="card">
          <view class="section-header">
            <text class="section-title">技能标签</text>
            <view class="edit-btn" @tap="openEditModal">
              <AppIcon name="edit-3" class="edit-icon" />
            </view>
          </view>
          <view v-if="skillsArr.length > 0" class="skill-tags">
            <text v-for="s in skillsArr" :key="s" class="skill-tag">{{ s }}</text>
          </view>
          <text v-else class="bio-hint">点击 <text class="link" @tap="openEditModal">编辑资料</text> 添加技能标签，或上传简历自动填充</text>
        </view>

        <!-- 项目贡献 -->
        <view class="card">
          <view class="section-header">
            <view class="section-title-row">
              <AppIcon name="link-2" class="section-title-icon" />
              <text class="section-title">项目贡献</text>
            </view>
            <view class="add-btn" @tap="openEditModal">
              <AppIcon name="plus" class="add-icon" />
              <text class="add-text">添加项目</text>
            </view>
          </view>
          <view v-if="projects.length > 0" class="projects-grid">
            <view v-for="(proj, i) in projects" :key="i" class="project-card">
              <text class="project-name">
                {{ proj.name || '未命名项目' }}
                <text v-if="proj.url" class="project-link">↗</text>
              </text>
              <text v-if="proj.role" class="project-role">职责：{{ proj.role }}</text>
              <text v-if="proj.desc" class="project-desc">{{ proj.desc }}</text>
            </view>
          </view>
          <text v-else class="bio-hint">还没有添加项目，点击 <text class="link" @tap="openEditModal">编辑资料</text> 添加你的项目经历和 GitHub 仓库链接</text>
        </view>
      </view>
    </view>

    <!-- 编辑弹窗 -->
    <view v-if="modal" class="modal-mask" @tap.self="modal = false">
      <view class="modal-card">
        <view class="modal-header">
          <view>
            <text class="modal-title">编辑个人资料</text>
            <text class="modal-required"><text class="red">*</text> 为必填项</text>
          </view>
          <view class="modal-close" @tap="modal = false">
            <AppIcon name="x" class="close-icon" />
          </view>
        </view>

        <scroll-view class="modal-body" scroll-y>
          <!-- 错误提示 -->
          <view v-if="errors.length > 0" class="error-banner">
            <AppIcon name="alert-circle" class="error-icon" />
            <view>
              <text class="error-title">请填写以下必填项：</text>
              <text class="error-detail">{{ errors.map(k => editLabelMap[k] || k).join('、') }}</text>
            </view>
          </view>

          <!-- 基本信息 -->
          <text class="form-section-title">基本信息</text>
          <view class="form-grid">
            <view v-for="f in editFields" :key="f.key" class="form-field">
              <text class="field-label">
                <AppIcon :name="f.icon" class="field-icon" />
                {{ f.label }}
                <text v-if="f.required" class="red">*</text>
              </text>
              <picker v-if="f.type === 'select'" :value="f.opts.findIndex(o => o.v === form[f.key])" :range="f.opts.map(o => o.l)" @change="form[f.key] = f.opts[$event.detail.value].v">
                <view class="field-input" :class="{ empty: !form[f.key] }">{{ form[f.key] || '请选择' + f.label }}</view>
              </picker>
              <input v-else v-model="form[f.key]" :placeholder="f.placeholder || '请输入' + f.label" class="field-input" :class="{ empty: !form[f.key] }" />
            </view>
          </view>

          <!-- 联系方式 -->
          <text class="form-section-title">联系方式</text>
          <view class="form-grid">
            <view class="form-field">
              <text class="field-label"><AppIcon name="mail" class="field-icon" />邮箱（登录账号）</text>
              <input :value="profile.email || ''" disabled class="field-input disabled" />
            </view>
            <view class="form-field">
              <text class="field-label"><AppIcon name="phone" class="field-icon" />手机号 <text class="red">*</text></text>
              <input v-model="form.phone" placeholder="请输入手机号" class="field-input" :class="{ empty: !form.phone }" />
            </view>
          </view>

          <!-- 个人简介 -->
          <text class="form-section-title">个人简介</text>
          <textarea v-model="form.bio" :maxlength="500" placeholder="简单介绍一下自己，如专业技能、项目经验、职业目标..." class="form-textarea" :class="{ empty: !form.bio }" />

          <!-- 技能 -->
          <text class="form-section-title">技能标签</text>
          <textarea v-model="form.skills" placeholder="Java, Python, Spring Boot, React, MySQL（逗号分隔）" class="form-textarea" :class="{ empty: !form.skills }" />
          <view v-if="form.skills" class="skill-preview">
            <text v-for="s in form.skills.split(',').filter(Boolean)" :key="s" class="skill-chip">{{ s.trim() }}</text>
          </view>

          <!-- 项目经历 -->
          <text class="form-section-title">项目贡献</text>
          <view v-for="(proj, i) in projects" :key="i" class="project-edit-card">
            <view class="proj-row">
              <view class="proj-field">
                <text class="proj-label">项目名称</text>
                <input v-model="proj.name" placeholder="如：电商后台管理系统" class="proj-input" />
              </view>
              <view class="proj-field small">
                <text class="proj-label">担任角色</text>
                <input v-model="proj.role" placeholder="如：后端开发" class="proj-input" />
              </view>
              <view class="proj-del" @tap="projects.splice(i, 1)">
                <AppIcon name="trash-2" class="del-icon" />
              </view>
            </view>
            <view class="proj-field full">
              <text class="proj-label">项目简介</text>
              <input v-model="proj.desc" placeholder="简要描述项目内容和你的贡献" class="proj-input" />
            </view>
          </view>
          <view class="add-project-btn" @tap="projects.push({ name: '', desc: '', role: '', url: '' })">
            <AppIcon name="plus" class="add-proj-icon" />
            <text class="add-proj-text">添加项目</text>
          </view>
        </scroll-view>

        <view class="modal-footer">
          <view class="cancel-btn" @tap="modal = false">
            <text class="cancel-text">取消</text>
          </view>
          <view class="save-btn" :class="{ saving, saved }" @tap="saveProfile">
            <AppIcon :name="saved ? 'check-circle' : 'save'" class="save-icon" />
            <text class="save-text">{{ saved ? '已保存' : '保存' }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, inject, onMounted, reactive } from 'vue'
import AppIcon from '../common/AppIcon.vue'
import { request, API_BASE_URL } from '../../utils/request.js'

const nav = inject('jobseekerNav')

const profile = ref(null)
const loading = ref(true)
const modal = ref(false)
const form = reactive({})
const saving = ref(false)
const saved = ref(false)
const errors = ref([])
const projects = ref([])

const requiredEdits = ['real_name', 'phone', 'education', 'target_position']

const editFields = [
  { icon: 'user', label: '姓名', key: 'real_name', placeholder: '请输入真实姓名', required: true },
  { icon: 'user', label: '性别', key: 'gender', type: 'select', opts: [{ v: '女', l: '女' }, { v: '男', l: '男' }], required: false },
  { icon: 'user', label: '年龄', key: 'age', placeholder: '请输入年龄', required: false },
  { icon: 'building', label: '学历', key: 'education', type: 'select', opts: [{ v: '本科', l: '本科' }, { v: '大专', l: '大专' }, { v: '硕士', l: '硕士' }, { v: '博士', l: '博士' }], required: true },
  { icon: 'graduation-cap', label: '毕业院校', key: 'school', placeholder: '请输入毕业院校', required: false },
  { icon: 'map-pin', label: '所在城市', key: 'city', placeholder: '如：北京', required: false },
  { icon: 'target', label: '目标城市', key: 'target_city', placeholder: '期望工作城市', required: false },
  { icon: 'briefcase', label: '工作经验', key: 'experience', placeholder: '如：3年 / 应届', required: false },
  { icon: 'star', label: '期望薪资', key: 'expected_salary', placeholder: '如：15K-25K', required: false },
  { icon: 'target', label: '目标岗位', key: 'target_position', placeholder: '如：Java后端开发', required: true },
]

const editLabelMap = Object.fromEntries(editFields.map(f => [f.key, f.label]))

const displayName = computed(() => profile.value?.real_name?.trim() || profile.value?.username || '未登录用户')

const skillsArr = computed(() => {
  if (!profile.value?.skills) return []
  return profile.value.skills.split(',').map(s => s.trim()).filter(Boolean)
})

const pct = computed(() => {
  if (!profile.value) return 0
  const fields = ['real_name', 'phone', 'education', 'school', 'city', 'target_city', 'target_position', 'experience', 'bio']
  const filled = fields.filter(k => profile.value[k] && profile.value[k].toString().trim()).length
  return Math.round((filled / 9) * 100)
})

const avatarUrl = computed(() => {
  if (!profile.value?.avatar) return ''
  return profile.value.avatar.startsWith('http') ? profile.value.avatar : `${API_BASE_URL}${profile.value.avatar}`
})

function openEditModal() {
  Object.assign(form, {
    real_name: profile.value.real_name || '',
    phone: profile.value.phone || '',
    gender: profile.value.gender || '女',
    age: profile.value.age?.toString() || '',
    education: profile.value.education || '本科',
    school: profile.value.school || '',
    city: profile.value.city || '',
    target_city: profile.value.target_city || '',
    experience: profile.value.experience || '',
    expected_salary: profile.value.expected_salary || '',
    target_position: profile.value.target_position || '',
    skills: profile.value.skills || '',
    bio: profile.value.bio || '',
  })
  errors.value = []
  saved.value = false
  modal.value = true
}

async function saveProfile() {
  const missing = requiredEdits.filter(k => !form[k]?.trim())
  if (missing.length > 0) {
    errors.value = missing
    setTimeout(() => { errors.value = [] }, 4000)
    return
  }
  const body = {
    ...form,
    age: form.age?.trim() ? parseInt(form.age) : null,
    projects: JSON.stringify(projects.value),
  }
  saving.value = true
  saved.value = false
  errors.value = []
  try {
    const d = await request({ url: '/api/auth/profile', method: 'PUT', data: body })
    if (d.success) {
      saved.value = true
      fetchProfile()
      setTimeout(() => { modal.value = false }, 800)
    }
  } catch {}
  saving.value = false
  setTimeout(() => { saved.value = false }, 3000)
}

function handleAvatarUpload() {
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: async (res) => {
      const filePath = res.tempFilePaths[0]
      try {
        await new Promise((resolve, reject) => {
          uni.uploadFile({
            url: `${API_BASE_URL}/api/auth/avatar`,
            filePath,
            name: 'file',
            header: { Authorization: `Bearer ${uni.getStorageSync('xingtu_token')}` },
            formData: { token: uni.getStorageSync('xingtu_token') },
            success: (r) => { if (r.statusCode === 200) resolve(); else reject(r) },
            fail: reject,
          })
        })
        fetchProfile()
      } catch {}
    },
  })
}

function handleResumeImport() {
  uni.chooseMessageFile({
    count: 1,
    type: 'file',
    extension: ['.pdf', '.docx', '.doc', '.txt'],
    success: async (res) => {
      const file = res.tempFiles[0]
      try {
        const d = await new Promise((resolve, reject) => {
          uni.uploadFile({
            url: `${API_BASE_URL}/api/auth/resume-parse`,
            filePath: file.path,
            name: 'file',
            formData: { token: uni.getStorageSync('xingtu_token') },
            success: (r) => { resolve(JSON.parse(r.data)) },
            fail: reject,
          })
        })
        if (d.success && d.data.text) {
          const text = d.data.text
          const phoneM = text.match(/1[3-9]\d{9}/)
          const nameM = text.match(/姓名[：:\s]*(\S+)/)
          const skillsM = text.match(/技能[：:\s]*([\s\S]+?)(?:\n\n|\n(?=[^\n]{2,10}[：:])|$)/)
          if (phoneM) form.phone = phoneM[0]
          if (nameM) form.real_name = nameM[1]
          if (skillsM) form.skills = skillsM[1].replace(/\n/g, ', ').replace(/[,，、]\s*/g, ', ')
          if (!modal.value) openEditModal()
        }
      } catch {}
    },
  })
}

async function fetchProfile() {
  try {
    const d = await request({ url: '/api/auth/profile' })
    if (d.success) {
      profile.value = d.data
      try { projects.value = JSON.parse(d.data.projects || '[]') } catch { projects.value = [] }
    }
  } catch {}
  loading.value = false
}

onMounted(() => { fetchProfile() })
</script>

<style>
.profile-home {
  width: 100%;
  box-sizing: border-box;
  padding: 28rpx 24rpx 48rpx;
}

.loading-state {
  display: flex;
  justify-content: center;
  padding: 120rpx 0;
}

.loading-spinner {
  width: 48rpx;
  height: 48rpx;
  border: 4rpx solid var(--color-outline-variant);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.empty-hint {
  text-align: center;
  padding: 80rpx 0;
  color: var(--color-on-surface-variant);
  font-size: 26rpx;
}

.profile-content {
  display: flex;
  flex-direction: column;
}

.profile-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 32rpx;
  min-width: 0;
}

.card {
  padding: 48rpx;
  border: 1rpx solid var(--color-outline-variant);
  border-radius: 24rpx;
  background: var(--color-surface-container-lowest);
}

.header-card {
  padding: 56rpx;
}

.header-row {
  display: flex;
  gap: 40rpx;
  flex-wrap: wrap;
}

.avatar-area {
  flex: none;
  width: 216rpx;
  height: 216rpx;
  border-radius: 50%;
  overflow: hidden;
  border: 8rpx solid var(--color-surface);
  box-shadow: 0 4rpx 12rpx rgba(0,0,0,0.08);
  position: relative;
}

.avatar-img {
  width: 100%;
  height: 100%;
}

.avatar-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-surface-variant);
}

.avatar-placeholder-icon {
  width: 96rpx;
  height: 96rpx;
  color: var(--color-on-surface-variant);
}

.avatar-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0,0,0,0.4);
  opacity: 0;
}

.avatar-area:active .avatar-overlay {
  opacity: 1;
}

.camera-icon {
  width: 52rpx;
  height: 52rpx;
  color: #fff;
}

.header-info {
  flex: 1;
  min-width: 0;
}

.header-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 20rpx;
}

.user-name {
  display: block;
  font-size: 40rpx;
  font-weight: 800;
  color: var(--color-on-surface);
}

.contact-row {
  display: flex;
  flex-wrap: wrap;
  gap: 24rpx;
  margin-top: 12rpx;
}

.contact-item {
  display: flex;
  align-items: center;
  gap: 10rpx;
  font-size: 24rpx;
  color: var(--color-on-surface-variant);
}

.contact-icon {
  width: 28rpx;
  height: 28rpx;
}

.target-info {
  display: block;
  font-size: 24rpx;
  margin-top: 12rpx;
  color: var(--color-on-surface-variant);
}

.header-actions {
  display: flex;
  gap: 24rpx;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 10rpx;
  padding: 16rpx 28rpx;
  border-radius: 14rpx;
  white-space: nowrap;
}

.action-btn.outline {
  border: 1rpx solid var(--color-outline-variant);
}

.action-btn.gradient {
  background: linear-gradient(135deg, var(--color-primary), var(--accent-purple));
}

.act-icon {
  width: 28rpx;
  height: 28rpx;
  color: var(--color-on-surface-variant);
}

.act-icon.white { color: #fff; }

.act-text {
  font-size: 22rpx;
  font-weight: 600;
  color: var(--color-on-surface-variant);
  white-space: nowrap;
}

.act-text.white { color: #fff; }

.completeness {
  margin-top: 32rpx;
  max-width: 480rpx;
}

.comp-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10rpx;
}

.comp-label {
  font-size: 20rpx;
  font-weight: 600;
  color: var(--color-on-surface-variant);
}

.comp-pct {
  font-size: 20rpx;
  font-weight: 700;
}

.comp-bar {
  height: 14rpx;
  border-radius: 7rpx;
  background: var(--color-surface-container);
}

.comp-bar-fill {
  height: 100%;
  border-radius: 7rpx;
  transition: width 0.5s;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 28rpx;
}

.section-title-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.section-title-icon {
  width: 32rpx;
  height: 32rpx;
  color: var(--color-on-surface);
}

.section-title {
  font-size: 32rpx;
  font-weight: 800;
  color: var(--color-on-surface);
}

.edit-btn {
  padding: 10rpx;
  border-radius: 12rpx;
}

.edit-btn:active {
  background: var(--color-surface-container);
}

.edit-icon {
  width: 28rpx;
  height: 28rpx;
  color: var(--color-on-surface-variant);
}

.fields-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16rpx;
}

@media (min-width: 700px) {
  .fields-grid {
    grid-template-columns: 1fr 1fr 1fr;
  }
}

.field-card {
  padding: 28rpx;
  border: 1rpx solid var(--color-outline-variant);
  border-radius: 16rpx;
  background: var(--color-surface);
}

.field-card-label {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 10rpx;
  font-size: 20rpx;
  color: var(--color-on-surface-variant);
}

.field-card-icon {
  width: 28rpx;
  height: 28rpx;
}

.field-card-value {
  font-size: 24rpx;
  font-weight: 600;
  color: var(--color-on-surface);
}

.field-card-empty {
  font-style: italic;
  color: var(--color-on-surface-variant);
}

.bio-text {
  font-size: 24rpx;
  line-height: 1.7;
  color: var(--color-on-surface);
  white-space: pre-wrap;
}

.bio-hint {
  font-size: 24rpx;
  font-style: italic;
  color: var(--color-on-surface-variant);
}

.link {
  color: var(--color-primary);
  text-decoration: underline;
}

.skill-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 14rpx;
}

.skill-tag {
  padding: 12rpx 24rpx;
  border-radius: 14rpx;
  background: var(--color-primary-fixed);
  color: var(--color-primary);
  font-size: 24rpx;
  font-weight: 600;
}

.add-btn {
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 10rpx 22rpx;
  border-radius: 12rpx;
  background: var(--color-primary-fixed);
}

.add-icon {
  width: 24rpx;
  height: 24rpx;
  color: var(--color-primary);
}

.add-text {
  font-size: 22rpx;
  font-weight: 600;
  color: var(--color-primary);
}

.projects-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16rpx;
}

@media (min-width: 700px) {
  .projects-grid {
    grid-template-columns: 1fr 1fr;
  }
}

.project-card {
  padding: 28rpx;
  border: 1rpx solid var(--color-outline-variant);
  border-radius: 16rpx;
  background: var(--color-surface);
}

.project-name {
  font-size: 24rpx;
  font-weight: 700;
  color: var(--color-on-surface);
}

.project-link {
  color: var(--color-primary);
}

.project-role {
  display: block;
  font-size: 20rpx;
  margin-top: 8rpx;
  color: var(--color-on-surface-variant);
}

.project-desc {
  display: block;
  font-size: 20rpx;
  margin-top: 12rpx;
  line-height: 1.6;
  color: var(--color-on-surface-variant);
}

.modal-mask {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 40rpx 32rpx;
  background: rgba(0,0,0,0.5);
  overflow-y: auto;
}

.modal-card {
  width: 100%;
  max-width: 1200rpx;
  border: 1rpx solid var(--color-outline-variant);
  border-radius: 24rpx;
  background: var(--color-surface-container-lowest);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 36rpx 48rpx;
  border-bottom: 1rpx solid var(--color-outline-variant);
}

.modal-title {
  font-size: 32rpx;
  font-weight: 700;
  color: var(--color-on-surface);
}

.modal-required {
  display: block;
  font-size: 20rpx;
  margin-top: 4rpx;
  color: var(--color-on-surface-variant);
}

.red { color: var(--accent-red); }

.modal-close {
  padding: 14rpx;
}

.close-icon {
  width: 40rpx;
  height: 40rpx;
  color: var(--color-on-surface-variant);
}

.modal-body {
  padding: 40rpx 48rpx;
  max-height: 1200rpx;
}

.error-banner {
  display: flex;
  align-items: flex-start;
  gap: 20rpx;
  padding: 28rpx;
  border: 1rpx solid var(--accent-red);
  border-radius: 16rpx;
  background: rgba(220,38,38,0.06);
  margin-bottom: 32rpx;
}

.error-icon {
  flex: none;
  width: 40rpx;
  height: 40rpx;
  color: var(--accent-red);
}

.error-title {
  display: block;
  font-size: 24rpx;
  font-weight: 600;
  color: var(--accent-red);
}

.error-detail {
  display: block;
  font-size: 20rpx;
  margin-top: 6rpx;
  color: var(--color-on-surface-variant);
}

.form-section-title {
  display: block;
  font-size: 24rpx;
  font-weight: 700;
  color: var(--color-on-surface);
  margin-bottom: 20rpx;
  margin-top: 8rpx;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 20rpx;
  margin-bottom: 32rpx;
}

@media (min-width: 700px) {
  .form-grid {
    grid-template-columns: 1fr 1fr;
  }
}

.field-label {
  display: flex;
  align-items: center;
  gap: 8rpx;
  font-size: 20rpx;
  font-weight: 500;
  color: var(--color-on-surface-variant);
  margin-bottom: 10rpx;
}

.field-icon {
  width: 24rpx;
  height: 24rpx;
}

.field-input {
  width: 100%;
  padding: 18rpx 24rpx;
  border: 1rpx solid var(--color-outline-variant);
  border-radius: 14rpx;
  background: var(--color-surface);
  color: var(--color-on-surface);
  font-size: 24rpx;
  box-sizing: border-box;
}

.field-input.empty {
  color: var(--color-on-surface-variant);
}

.field-input.disabled {
  opacity: 0.6;
  background: var(--color-surface-container-low);
}

.form-textarea {
  width: 100%;
  min-height: 160rpx;
  padding: 18rpx 24rpx;
  border: 1rpx solid var(--color-outline-variant);
  border-radius: 14rpx;
  background: var(--color-surface);
  color: var(--color-on-surface);
  font-size: 24rpx;
  box-sizing: border-box;
  margin-bottom: 24rpx;
}

.form-textarea.empty {
  color: var(--color-on-surface-variant);
}

.skill-preview {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-bottom: 24rpx;
}

.skill-chip {
  padding: 8rpx 20rpx;
  border-radius: 10rpx;
  background: var(--color-primary-fixed);
  color: var(--color-primary);
  font-size: 20rpx;
  font-weight: 500;
}

.project-edit-card {
  padding: 28rpx;
  border: 1rpx solid var(--color-outline-variant);
  border-radius: 16rpx;
  margin-bottom: 20rpx;
}

.proj-row {
  display: flex;
  gap: 16rpx;
  margin-bottom: 16rpx;
}

.proj-field {
  flex: 1;
  min-width: 0;
}

.proj-field.small {
  flex: 0 0 200rpx;
}

.proj-field.full {
  width: 100%;
}

.proj-label {
  display: block;
  font-size: 18rpx;
  font-weight: 600;
  color: var(--color-on-surface-variant);
  margin-bottom: 8rpx;
}

.proj-input {
  width: 100%;
  padding: 14rpx 20rpx;
  border: 1rpx solid var(--color-outline-variant);
  border-radius: 10rpx;
  background: var(--color-surface);
  color: var(--color-on-surface);
  font-size: 22rpx;
  box-sizing: border-box;
}

.proj-del {
  flex: none;
  display: flex;
  align-items: flex-end;
  padding: 10rpx;
}

.del-icon {
  width: 28rpx;
  height: 28rpx;
  color: var(--accent-red);
}

.add-project-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
  padding: 20rpx;
  border: 2rpx dashed var(--color-outline-variant);
  border-radius: 14rpx;
}

.add-proj-icon {
  width: 24rpx;
  height: 24rpx;
  color: var(--color-on-surface-variant);
}

.add-proj-text {
  font-size: 22rpx;
  font-weight: 600;
  color: var(--color-on-surface-variant);
}

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 20rpx;
  padding: 32rpx 48rpx;
  border-top: 1rpx solid var(--color-outline-variant);
}

.cancel-btn {
  padding: 18rpx 36rpx;
  border-radius: 16rpx;
}

.cancel-text {
  font-size: 24rpx;
  font-weight: 600;
  color: var(--color-on-surface-variant);
}

.save-btn {
  display: flex;
  align-items: center;
  gap: 10rpx;
  padding: 18rpx 40rpx;
  border-radius: 16rpx;
  background: var(--color-primary);
}

.save-btn.saved {
  background: var(--accent-green);
}

.save-icon {
  width: 28rpx;
  height: 28rpx;
  color: #fff;
}

.save-text {
  font-size: 24rpx;
  font-weight: 600;
  color: #fff;
}
</style>
