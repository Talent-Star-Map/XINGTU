<template>
  <view class="profile-edit">
    <ProfileSidebar />

    <view class="edit-main">
      <!-- 顶部操作栏 -->
      <view class="top-bar">
        <view>
          <text class="page-title">个人资料</text>
          <text class="page-hint"><text class="red">*</text> 为必填项</text>
        </view>
        <view class="save-btn" :class="{ saving, saved }" @tap="save">
          <AppIcon :name="saved ? 'check-circle' : 'save'" class="save-icon" />
          <text class="save-text">{{ saved ? '已保存' : '保存' }}</text>
        </view>
      </view>

      <!-- 错误提示 -->
      <view v-if="errors.length > 0" class="error-banner">
        <AppIcon name="alert-circle" class="error-icon" />
        <view>
          <text class="error-title">请填写以下必填项：</text>
          <text class="error-detail">{{ errors.join('、') }}</text>
        </view>
      </view>

      <!-- 联系方式 -->
      <view class="card">
        <text class="section-title">联系方式</text>
        <view class="form-grid">
          <view class="form-field">
            <text class="field-label"><AppIcon name="mail" class="field-icon" />邮箱（登录账号）</text>
            <input :value="form.email || ''" disabled class="field-input disabled" />
          </view>
          <view class="form-field">
            <text class="field-label"><AppIcon name="phone" class="field-icon" />手机号 <text class="red">*</text></text>
            <input v-model="form.phone" placeholder="请输入手机号" class="field-input" :class="{ empty: !form.phone }" />
          </view>
        </view>
      </view>

      <!-- 基本信息 -->
      <view class="card">
        <text class="section-title">基本信息</text>
        <view class="form-grid">
          <view v-for="f in basicFields" :key="f.key" class="form-field">
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
      </view>

      <!-- 个人简介 -->
      <view class="card">
        <text class="section-title">个人简介</text>
        <textarea v-model="form.bio" :maxlength="500" placeholder="简单介绍一下自己，如专业技能、项目经验、职业目标..." class="form-textarea" :class="{ empty: !form.bio }" />
      </view>

      <!-- 技能标签 -->
      <view class="card">
        <text class="section-title">技能标签</text>
        <text class="field-hint">点击选择技能，系统会根据您的简历自动更新</text>

        <!-- 搜索栏 -->
        <view class="search-bar">
          <AppIcon name="search" class="search-icon" />
          <input v-model="search" placeholder="搜索技能，回车添加..." class="search-input" @confirm="handleSearchEnter" />
        </view>

        <!-- 已选技能 -->
        <view v-if="selectedSkills.length > 0" class="selected-area">
          <view class="selected-tags">
            <view v-for="s in selectedSkills" :key="s" class="selected-tag" @tap="removeSkill(s)">
              <text class="tag-text">{{ s }}</text>
              <AppIcon name="x" class="tag-del" />
            </view>
          </view>
          <view class="reset-btn" @tap="selectedSkills = []">
            <AppIcon name="x" class="reset-icon" />
            <text class="reset-text">重置</text>
          </view>
        </view>

        <!-- 分类标签 -->
        <view class="category-tabs">
          <view
            v-for="(cat, idx) in filteredCategories"
            :key="cat.name"
            class="cat-tab"
            :class="{ active: activeCat === idx }"
            @tap="activeCat = idx"
          >
            <text class="cat-tab-text">{{ cat.name }}</text>
          </view>
        </view>

        <!-- 技能按钮 -->
        <view class="skill-buttons">
          <view
            v-for="s in currentCatSkills"
            :key="s"
            class="skill-btn"
            :class="{ active: selectedSkills.includes(s) }"
            @tap="toggleSkill(s)"
          >
            <text class="skill-btn-text">{{ s }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, reactive, computed, inject, onMounted } from 'vue'
import AppIcon from '../common/AppIcon.vue'
import ProfileSidebar from './ProfileSidebar.vue'
import { request } from '../../utils/request.js'

const nav = inject('jobseekerNav')

const form = reactive({
  real_name: '', gender: '女', age: '',
  phone: '', email: '', education: '本科',
  school: '', city: '', target_city: '',
  experience: '', expected_salary: '',
  target_position: '', skills: '', bio: '',
})

const loading = ref(true)
const saving = ref(false)
const saved = ref(false)
const errors = ref([])
const search = ref('')
const activeCat = ref(0)

const requiredFields = ['real_name', 'phone', 'education', 'target_position']

const basicFields = [
  { icon: 'user', label: '姓名', key: 'real_name', required: true, placeholder: '请输入真实姓名' },
  { icon: 'user', label: '性别', key: 'gender', type: 'select', opts: [{ v: '女', l: '女' }, { v: '男', l: '男' }], required: false },
  { icon: 'user', label: '年龄', key: 'age', placeholder: '请输入年龄', required: false },
  { icon: 'building', label: '学历', key: 'education', type: 'select', opts: [{ v: '本科', l: '本科' }, { v: '大专', l: '大专' }, { v: '硕士', l: '硕士' }, { v: '博士', l: '博士' }], required: true },
  { icon: 'graduation-cap', label: '学校', key: 'school', placeholder: '请输入毕业院校', required: false },
  { icon: 'map-pin', label: '所在城市', key: 'city', placeholder: '如：北京', required: false },
  { icon: 'target', label: '目标城市', key: 'target_city', placeholder: '期望工作城市', required: false },
  { icon: 'briefcase', label: '工作经验', key: 'experience', placeholder: '如：3年 / 应届', required: false },
  { icon: 'star', label: '期望薪资', key: 'expected_salary', placeholder: '如：15K-25K', required: false },
  { icon: 'target', label: '目标岗位', key: 'target_position', placeholder: '如：Java后端开发', required: true },
]

const SKILL_CATEGORIES = [
  { name: '编程语言', skills: ['Java', 'Python', 'Go', 'C++', 'Rust', 'TypeScript', 'JavaScript', 'Scala', 'Kotlin', 'Swift', 'PHP', 'Ruby', 'Shell', 'SQL', 'Git', 'Maven', 'Gradle', 'MATLAB'] },
  { name: '前端框架', skills: ['React', 'Vue', 'Angular', 'Svelte', 'Next.js', 'HTML', 'CSS', 'Node.js', 'Webpack', 'Vite', 'Tailwind CSS', 'Ant Design', 'Element Plus', 'Taro', 'uni-app', 'Electron'] },
  { name: '后端框架', skills: ['Spring Boot', 'Spring Cloud', 'Django', 'Flask', 'FastAPI', 'Express', 'MyBatis', 'Hibernate', 'Gin', 'gRPC', 'RESTful', 'Dubbo', 'Netty', 'Koa', 'NestJS', 'GraphQL'] },
  { name: '数据库', skills: ['MySQL', 'PostgreSQL', 'Redis', 'MongoDB', 'Elasticsearch', 'SQLite', 'Oracle', 'Memcached', 'ClickHouse', 'Neo4j', 'TiDB', 'HBase', 'Cassandra', 'InfluxDB', 'DuckDB', 'MariaDB'] },
  { name: 'AI/大模型', skills: ['大模型', 'LLM', 'LangChain', 'RAG', 'Agent', 'Prompt Engineering', 'NLP', 'CV', 'PyTorch', 'TensorFlow', 'Pandas', 'NumPy', 'Transformer', 'Stable Diffusion', 'Ollama', 'vLLM', 'LoRA', 'PaddlePaddle', 'MindSpore', 'OpenCV'] },
  { name: '大数据', skills: ['Spark', 'Flink', 'Hadoop', 'Kafka', 'Hive', 'HBase', 'DataX', 'Kettle', 'Airflow', 'ClickHouse', '数据仓库', 'ETL', 'Pulsar', 'Storm', 'Sqoop', 'Canal', 'Doris', 'StarRocks', 'Presto', 'Trino', 'Superset'] },
  { name: '云原生/DevOps', skills: ['Docker', 'Kubernetes', 'K8s', 'CI/CD', 'Jenkins', 'Terraform', 'Nginx', 'Linux', 'AWS', '阿里云', '腾讯云', '微服务', 'Serverless', 'GitLab', 'ArgoCD', 'Prometheus', 'Grafana', 'Istio', 'Consul', 'Ansible', 'Harbor', 'RabbitMQ'] },
  { name: '安全/测试', skills: ['渗透测试', 'Burp Suite', 'Metasploit', 'Selenium', 'JMeter', 'Postman', '安全架构', 'SDL', 'DevSecOps', 'OWASP', 'Nessus', 'Wireshark', 'Appium', 'LoadRunner', 'SonarQube', 'ZAP', 'SQL 注入', 'XSS'] },
  { name: '架构/分布式', skills: ['分布式', '微服务', '高并发', '架构设计', '分布式事务', '分布式缓存', '消息队列', 'RabbitMQ', 'RocketMQ', '负载均衡', '服务网格', 'DDD', 'CAP 理论', '服务治理', '链路追踪', 'SkyWalking', 'Seata', 'Nacos', 'Sentinel'] },
]

const selectedSkills = computed(() => form.skills ? form.skills.split(',').map(s => s.trim()).filter(Boolean) : [])

const filteredCategories = computed(() => {
  const kw = search.value.toLowerCase().trim()
  return SKILL_CATEGORIES.map(cat => ({
    ...cat,
    skills: kw ? cat.skills.filter(s => s.toLowerCase().includes(kw)).sort() : [...cat.skills].sort(),
  }))
})

const currentCatSkills = computed(() => {
  return filteredCategories.value[activeCat.value]?.skills || []
})

function toggleSkill(s) {
  const arr = form.skills ? form.skills.split(',').map(x => x.trim()).filter(Boolean) : []
  const idx = arr.indexOf(s)
  if (idx >= 0) arr.splice(idx, 1)
  else arr.push(s)
  form.skills = arr.join(', ')
}

function removeSkill(s) {
  const arr = form.skills ? form.skills.split(',').map(x => x.trim()).filter(Boolean) : []
  form.skills = arr.filter(x => x !== s).join(', ')
}

function handleSearchEnter() {
  const kw = search.value.toLowerCase().trim()
  if (!kw) return
  const first = currentCatSkills.value.find(s => s.toLowerCase().includes(kw))
  if (first) {
    toggleSkill(first)
    search.value = ''
  }
}

async function save() {
  const missing = requiredFields.filter(k => !form[k]?.trim())
  if (missing.length > 0) {
    errors.value = missing.map(k => basicFields.find(f => f.key === k)?.label || k)
    setTimeout(() => { errors.value = [] }, 4000)
    return
  }
  saving.value = true
  saved.value = false
  errors.value = []
  try {
    const body = { ...form, age: form.age?.trim() ? parseInt(form.age) : null }
    const d = await request({ url: '/api/auth/profile', method: 'PUT', data: body })
    if (d.success) saved.value = true
  } catch {}
  saving.value = false
  setTimeout(() => { saved.value = false }, 3000)
}

onMounted(async () => {
  try {
    const d = await request({ url: '/api/auth/profile' })
    if (d.success) {
      const p = d.data
      Object.assign(form, {
        real_name: p.real_name || '', gender: p.gender || '女', age: p.age?.toString() || '',
        phone: p.phone || '', email: p.email || '', education: p.education || '本科',
        school: p.school || '', city: p.city || '', target_city: p.target_city || '',
        experience: p.experience || '', expected_salary: p.expected_salary || '',
        target_position: p.target_position || '', skills: p.skills || '', bio: p.bio || '',
      })
    }
  } catch {}
  loading.value = false
})
</script>

<style>
.profile-edit {
  width: 100%;
  box-sizing: border-box;
  padding: 28rpx 24rpx 48rpx;
  display: flex;
  gap: 48rpx;
}

@media (max-width: 700px) {
  .profile-edit {
    flex-direction: column;
  }
}

.edit-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 32rpx;
  min-width: 0;
}

.top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.page-title {
  font-size: 34rpx;
  font-weight: 700;
  color: var(--color-on-surface);
}

.page-hint {
  display: block;
  font-size: 20rpx;
  margin-top: 4rpx;
  color: var(--color-on-surface-variant);
}

.red { color: var(--accent-red); }

.save-btn {
  display: flex;
  align-items: center;
  gap: 10rpx;
  padding: 18rpx 36rpx;
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

.error-banner {
  display: flex;
  align-items: flex-start;
  gap: 20rpx;
  padding: 28rpx;
  border: 1rpx solid var(--accent-red);
  border-radius: 16rpx;
  background: rgba(220,38,38,0.06);
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

.card {
  padding: 40rpx;
  border: 1rpx solid var(--color-outline-variant);
  border-radius: 24rpx;
  background: var(--color-surface-container-lowest);
}

.section-title {
  display: block;
  font-size: 28rpx;
  font-weight: 700;
  color: var(--color-on-surface);
  margin-bottom: 28rpx;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 20rpx;
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
}

.form-textarea.empty {
  color: var(--color-on-surface-variant);
}

.field-hint {
  display: block;
  font-size: 20rpx;
  color: var(--color-on-surface-variant);
  margin-bottom: 20rpx;
}

.search-bar {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 14rpx 24rpx;
  border: 1rpx solid var(--color-outline-variant);
  border-radius: 14rpx;
  background: var(--color-surface);
  margin-bottom: 20rpx;
}

.search-icon {
  flex: none;
  width: 28rpx;
  height: 28rpx;
  color: var(--color-on-surface-variant);
}

.search-input {
  flex: 1;
  font-size: 24rpx;
  color: var(--color-on-surface);
}

.selected-area {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16rpx;
  margin-bottom: 20rpx;
}

.selected-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  flex: 1;
}

.selected-tag {
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 8rpx 18rpx;
  border-radius: 10rpx;
  background: var(--color-primary-fixed);
}

.tag-text {
  font-size: 20rpx;
  font-weight: 500;
  color: var(--color-primary);
}

.tag-del {
  width: 22rpx;
  height: 22rpx;
  color: var(--color-primary);
}

.reset-btn {
  display: flex;
  align-items: center;
  gap: 6rpx;
  padding: 8rpx 16rpx;
  border-radius: 10rpx;
  background: var(--color-surface);
  flex: none;
}

.reset-icon {
  width: 20rpx;
  height: 20rpx;
  color: var(--color-on-surface-variant);
}

.reset-text {
  font-size: 20rpx;
  color: var(--color-on-surface-variant);
}

.category-tabs {
  display: flex;
  gap: 10rpx;
  margin-bottom: 20rpx;
  overflow-x: auto;
}

.cat-tab {
  flex: none;
  padding: 10rpx 22rpx;
  border-radius: 10rpx;
  background: var(--color-surface);
}

.cat-tab.active {
  background: var(--color-primary);
}

.cat-tab-text {
  font-size: 20rpx;
  font-weight: 600;
  color: var(--color-on-surface-variant);
}

.cat-tab.active .cat-tab-text {
  color: #fff;
}

.skill-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  max-height: 520rpx;
  overflow-y: auto;
}

.skill-btn {
  padding: 10rpx 22rpx;
  border-radius: 10rpx;
  border: 1rpx solid var(--color-outline-variant);
  background: var(--color-surface);
}

.skill-btn.active {
  background: var(--color-primary);
  border-color: var(--color-primary);
}

.skill-btn-text {
  font-size: 20rpx;
  font-weight: 500;
  color: var(--color-on-surface-variant);
}

.skill-btn.active .skill-btn-text {
  color: #fff;
}
</style>
