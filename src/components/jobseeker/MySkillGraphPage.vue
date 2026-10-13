<template>
  <view class="msg-page">
      <view class="msg-content">
        <view class="msg-head">
          <AppIcon name="book" class="msg-head-icon" />
          <text class="msg-title">我的图谱</text>
        </view>
        <text class="msg-hint">
          <text v-if="selectedSkill">
            已选 <text class="hint-primary">{{ selectedSkill }}</text> — 点击其他技能切换，再次点击取消
          </text>
          <text v-else>
            点击任意技能标签查看关联岗位<text v-if="skills.length > 0"> — 共 {{ skills.length }} 项技能</text>
          </text>
        </text>

        <!-- loading -->
        <view v-if="loading" class="msg-loading">
          <AppIcon name="loader" class="spin-icon" />
        </view>

        <!-- 空状态 -->
        <view v-else-if="skills.length === 0" class="msg-empty">
          <AppIcon name="book" class="empty-icon" />
          <text class="empty-title">暂无技能数据</text>
          <text class="empty-desc">上传简历或在个人资料中添加技能标签，能力图谱将自动生成</text>
        </view>

        <!-- 有技能数据 -->
        <view v-else class="msg-body">
          <view class="msg-left">
            <!-- Canvas 2D 图谱 -->
            <view class="graph-wrap">
              <canvas
                canvas-id="skillGraphCanvas"
                id="skillGraphCanvas"
                class="graph-canvas"
                @tap="onCanvasTap"
              ></canvas>
            </view>

            <!-- 分类技能卡片 -->
            <view class="cat-grid">
              <view
                v-for="cat in categorized"
                :key="cat.name"
                class="cat-card"
              >
                <view class="cat-head">
                  <view class="cat-icon" :style="{ background: cat.color + '20' }">
                    <text :style="{ color: cat.color, fontSize: '28rpx', fontWeight: 700 }">{{ cat.name.charAt(0) }}</text>
                  </view>
                  <view class="cat-info">
                    <text class="cat-name">{{ cat.name }}</text>
                    <view class="cat-bar" :style="{ background: 'var(--color-surface-container)' }">
                      <view
                        class="cat-fill"
                        :style="{
                          width: cat.level + '%',
                          background: 'linear-gradient(90deg, ' + cat.color + '66, ' + cat.color + ')'
                        }"
                      ></view>
                    </view>
                    <text class="cat-stat" :style="{ color: cat.color }">{{ cat.level }}% · {{ cat.skills.length }}项</text>
                  </view>
                </view>
                <view class="cat-tags">
                  <text
                    v-for="s in cat.skills"
                    :key="s"
                    class="cat-tag"
                    :class="{ active: selectedSkill === s }"
                    :style="{
                      background: selectedSkill === s ? cat.color : cat.color + '15',
                      color: selectedSkill === s ? 'var(--color-on-primary)' : cat.color,
                    }"
                    @tap="onSkillTap(s)"
                  >{{ s }}</text>
                </view>
              </view>

              <!-- 其他技能 -->
              <view v-if="uncategorized.length > 0" class="cat-card">
                <view class="cat-head">
                  <view class="cat-icon" :style="{ background: '#6B728020' }">
                    <text style="color:#6B7280;font-size:28rpx;font-weight:700">其</text>
                  </view>
                  <text class="cat-name">其他技能</text>
                </view>
                <view class="cat-tags">
                  <text
                    v-for="s in uncategorized"
                    :key="s"
                    class="cat-tag"
                    :class="{ active: selectedSkill === s }"
                    :style="{
                      background: selectedSkill === s ? '#6B7280' : '#6B728015',
                      color: selectedSkill === s ? '#fff' : '#6B7280',
                    }"
                    @tap="onSkillTap(s)"
                  >{{ s }}</text>
                </view>
              </view>
            </view>
          </view>

          <!-- 右侧：关联岗位面板 -->
          <view v-if="selectedSkill" class="job-panel">
            <view v-if="!selectedJob" class="job-list-card">
              <view class="job-list-head">
                <view>
                  <text class="job-list-title">关联岗位</text>
                  <text class="job-list-sub">需要 <text class="hint-primary">{{ selectedSkill }}</text> 的岗位</text>
                </view>
                <view class="job-close-btn" @tap="clearSelection">
                  <AppIcon name="x" />
                </view>
              </view>
              <view class="job-list-body">
                <view v-if="jobsLoading" class="job-loading">
                  <AppIcon name="loader" class="spin-icon" />
                </view>
                <view v-else-if="jobs.length === 0" class="job-empty">
                  <text>暂无相关岗位数据</text>
                </view>
                <view v-else class="job-items">
                  <view
                    v-for="job in jobs"
                    :key="job.id"
                    class="job-item"
                    @tap="selectedJob = job"
                  >
                    <view class="job-item-info">
                      <text class="job-item-title">{{ job.title }}</text>
                      <text class="job-item-meta">
                        <text
                          class="job-company"
                          @tap.stop="companyModal = job.company"
                        >{{ job.company }}</text>
                        <text> · {{ job.location }}</text>
                      </text>
                      <text class="job-item-salary">{{ job.salary }}</text>
                    </view>
                    <AppIcon name="chevron-right" class="job-item-arrow" />
                  </view>
                </view>
              </view>
            </view>

            <!-- 岗位详情 -->
            <view v-else class="job-detail-card">
              <view class="job-detail-head">
                <text class="job-detail-title">岗位详情</text>
                <view class="job-detail-actions">
                  <text class="back-btn" @tap="selectedJob = null">返回列表</text>
                  <view class="job-close-btn" @tap="clearSelection">
                    <AppIcon name="x" />
                  </view>
                </view>
              </view>
              <view class="job-detail-body">
                <text class="detail-job-title">{{ selectedJob.title }}</text>
                <view class="detail-meta">
                  <view class="detail-meta-item">
                    <AppIcon name="briefcase" class="meta-icon" />
                    <text
                      class="meta-link"
                      @tap="companyModal = selectedJob.company"
                    >{{ selectedJob.company }}</text>
                  </view>
                  <view class="detail-meta-item">
                    <AppIcon name="map-pin" class="meta-icon" />
                    <text>{{ selectedJob.location }}</text>
                  </view>
                  <view class="detail-meta-item">
                    <AppIcon name="banknote" class="meta-icon" />
                    <text>{{ selectedJob.salary }}</text>
                  </view>
                  <view class="detail-meta-item">
                    <AppIcon name="graduation-cap" class="meta-icon" />
                    <text>{{ selectedJob.education }} · {{ selectedJob.experience }}</text>
                  </view>
                </view>
                <text class="detail-desc">{{ selectedJob.description }}</text>
                <view class="detail-skills-section">
                  <text class="detail-skills-label">岗位技能要求</text>
                  <view class="detail-skills-tags">
                    <text
                      v-for="s in selectedJob.skills"
                      :key="s"
                      class="detail-skill-tag"
                      :class="{ active: s.toLowerCase() === selectedSkill.toLowerCase() }"
                      :style="{
                        background: s.toLowerCase() === selectedSkill.toLowerCase() ? 'var(--color-primary)' : 'var(--color-primary-fixed)',
                        color: s.toLowerCase() === selectedSkill.toLowerCase() ? 'var(--color-on-primary)' : 'var(--color-primary)',
                      }"
                    >{{ s }}</text>
                  </view>
                </view>
                <view
                  class="detail-link"
                  @tap="openJobLink"
                >
                  <AppIcon name="external-link" />
                  <text>查看原招聘信息</text>
                </view>
                <text class="detail-source">数据来源：{{ selectedJob.source }} · {{ selectedJob.collected_at }}</text>
              </view>
            </view>
          </view>
        </view>
      </view>

    <!-- 公司详情弹窗 -->
    <CompanyCard
      :visible="!!companyModal"
      :company-name="companyModal || ''"
      @close="companyModal = ''"
    />
  </view>
</template>

<script setup>
import { computed, onMounted, ref, nextTick, watch } from 'vue'
import { request } from '../../utils/request'
import AppIcon from '../common/AppIcon.vue'
import CompanyCard from './CompanyCard.vue'

const skillCats = [
  { name: '编程语言', color: '#00C8FF', keywords: ['java', 'python', 'go', 'rust', 'c++', 'typescript', 'javascript', 'c#', 'php', 'ruby', 'swift', 'kotlin', 'scala'] },
  { name: '框架与工具', color: '#7C3AED', keywords: ['spring', 'django', 'flask', 'fastapi', 'react', 'vue', 'angular', 'node', 'express', 'mybatis', 'hibernate', 'jquery'] },
  { name: '数据库', color: '#00E599', keywords: ['mysql', 'postgresql', 'redis', 'mongodb', 'elasticsearch', 'oracle', 'sqlite', 'cassandra', 'neo4j'] },
  { name: '云原生/DevOps', color: '#FF8C42', keywords: ['docker', 'kubernetes', 'k8s', 'jenkins', 'git', 'linux', 'aws', 'azure', 'gcp', 'nginx', 'ci/cd', 'devops', 'terraform'] },
  { name: 'AI/ML', color: '#FF4D6A', keywords: ['机器学习', '深度学习', 'nlp', 'cv', '大模型', 'llm', 'rag', 'tensorflow', 'pytorch', 'langchain', 'agent', 'transformer', 'ai'] },
  { name: '数据/流处理', color: '#A78BFA', keywords: ['spark', 'flink', 'hadoop', 'kafka', 'rabbitmq', 'pandas', 'numpy', 'hive', 'airflow'] },
  { name: '其他工具', color: '#06B6D4', keywords: ['git', 'restful', 'graphql', 'websocket', '微服务', '分布式', '高并发', '架构设计', 'html', 'css', 'sass', 'less'] },
]

const palette = ['#00C8FF','#7C3AED','#00E599','#FF8C42','#FF4D6A','#38BDF8','#A78BFA','#C084FC','#2DD4BF','#FBBF24','#FCD34D','#34D399','#FB923C','#F472B6','#60A5FA','#A3E635','#FF6B6B','#4ECDC4']

const skills = ref([])
const loading = ref(true)
const selectedSkill = ref('')
const jobs = ref([])
const jobsLoading = ref(false)
const selectedJob = ref(null)
const companyModal = ref('')

const graphNodes = ref([])
let nodesInitialized = false

function classifySkill(skill) {
  const s = skill.trim().toLowerCase()
  for (const cat of skillCats) {
    for (const kw of cat.keywords) {
      if (s.includes(kw) || kw.includes(s)) return cat.name
    }
  }
  return null
}

const categorized = computed(() =>
  skillCats.map(cat => ({
    ...cat,
    skills: skills.value.filter(s => classifySkill(s) === cat.name),
    level: skills.value.length
      ? Math.min(Math.round((skills.value.filter(s => classifySkill(s) === cat.name).length / skills.value.length) * 100 + 20), 100)
      : 0,
  })).filter(cat => cat.skills.length > 0)
)

const uncategorized = computed(() =>
  skills.value.filter(s => !classifySkill(s))
)

onMounted(async () => {
  try {
    const token = uni.getStorageSync('xingtu_token')
    if (!token) { loading.value = false; return }
    const res = await request({ url: '/api/auth/profile' })
    if (res.success && res.data.skills) {
      skills.value = res.data.skills.split(',').map(s => s.trim()).filter(Boolean)
    }
  } catch {}
  loading.value = false
})

watch(skills, (newSkills) => {
  if (newSkills.length > 0) {
    nodesInitialized = false
    nextTick(() => drawGraph())
  }
})

function onSkillTap(skill) {
  if (selectedSkill.value === skill) {
    clearSelection()
    return
  }
  selectedSkill.value = skill
  selectedJob.value = null
  jobsLoading.value = true
  request({ url: '/api/jobs', data: { skill } }).then(res => {
    if (res.success) jobs.value = res.data
  }).catch(() => {}).finally(() => {
    jobsLoading.value = false
  })
}

function clearSelection() {
  selectedSkill.value = ''
  jobs.value = []
  selectedJob.value = null
}

function openJobLink() {
  if (!selectedJob.value) return
  const url = 'https://www.zhipin.com/web/geek/job?query=' + encodeURIComponent(selectedJob.value.title) + '&city=100010000'
  uni.setClipboardData({
    data: url,
    success: () => {
      uni.showToast({ title: '链接已复制，请在浏览器中打开', icon: 'none' })
    }
  })
}

function generateNodePositions() {
  const skillList = skills.value
  if (skillList.length === 0) { graphNodes.value = []; return }
  const query = uni.createSelectorQuery()
  query.select('#skillGraphCanvas').fields({ node: true, size: true }).exec((res) => {
    if (!res[0]) return
    const dpr = uni.getSystemInfoSync().pixelRatio
    const w = res[0].width
    const h = res[0].height
    const canvas = res[0].node
    canvas.width = w * dpr
    canvas.height = h * dpr

    const cx = w / 2
    const cy = h / 2
    const radius = Math.min(w, h) * 0.32
    const nodes = []
    const seed = skillList.length

    skillList.forEach((name, i) => {
      const angle = (i / skillList.length) * Math.PI * 2 - Math.PI / 2
      const rOff = ((i * 7 + seed * 3) % 20 - 10) / 100 * radius
      const x = cx + (radius + rOff) * Math.cos(angle)
      const y = cy + (radius + rOff) * Math.sin(angle)
      nodes.push({
        id: `s${i}`,
        name,
        x, y,
        color: palette[i % palette.length],
        r: 20,
      })
    })
    graphNodes.value = nodes
    nodesInitialized = true
    renderGraph(canvas, w, h, dpr)
  })
}

function renderGraph(canvas, w, h, dpr) {
  doRender(canvas, w, h, dpr)
}

function doRender(canvas, w, h, dpr) {
  const ctx = canvas.getContext('2d')
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, w, h)
  const nodes = graphNodes.value
  if (nodes.length === 0) return

  ctx.lineWidth = 1.5
  for (let i = 0; i < nodes.length; i++) {
    const topLinks = Math.min(2, nodes.length - 1)
    for (let j = 0; j < topLinks; j++) {
      const t = (i + j + 1) % nodes.length
      if (t === i) continue
      const a = nodes[i]; const b = nodes[t]
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      const midX = (a.x + b.x) / 2
      const midY = (a.y + b.y) / 2 - 15
      ctx.quadraticCurveTo(midX, midY, b.x, b.y)
      ctx.strokeStyle = 'rgba(68, 136, 204, 0.12)'
      ctx.stroke()
    }
  }

  nodes.forEach((n) => {
    const isSelected = n.name === selectedSkill.value
    ctx.beginPath()
    ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2)
    ctx.fillStyle = isSelected ? n.color : n.color + 'CC'
    ctx.fill()
    if (isSelected) {
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 3
      ctx.stroke()
    }

    ctx.beginPath()
    ctx.arc(n.x, n.y, n.r + 4, 0, Math.PI * 2)
    ctx.fillStyle = n.color + '18'
    ctx.fill()

    ctx.fillStyle = '#f0f4ff'
    ctx.font = 'bold 12px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(n.name, n.x, n.y + n.r + 14)
  })
}

function drawGraph() {
  if (!nodesInitialized) {
    generateNodePositions()
  } else {
    const query = uni.createSelectorQuery()
    query.select('#skillGraphCanvas').fields({ node: true, size: true }).exec((res) => {
      if (!res[0]) return
      const dpr = uni.getSystemInfoSync().pixelRatio
      renderGraph(res[0].node, res[0].width, res[0].height, dpr)
    })
  }
}

function onCanvasTap(e) {
  const nodes = graphNodes.value
  if (nodes.length === 0) return
  const tapX = e.detail.x || 0
  const tapY = e.detail.y || 0
  for (const n of nodes) {
    const dx = tapX - n.x
    const dy = tapY - n.y
    if (dx * dx + dy * dy <= (n.r + 8) * (n.r + 8)) {
      onSkillTap(n.name)
      return
    }
  }
}

watch(selectedSkill, () => {
  nextTick(() => drawGraph())
})
</script>

<style>
.msg-page {
  width: 100%;
  box-sizing: border-box;
  padding: 28rpx 24rpx 36rpx;
}
.msg-content {
  width: 100%;
}
.msg-head {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 12rpx;
}
.msg-head-icon {
  font-size: 34rpx;
  color: var(--color-primary);
}
.msg-title {
  font-size: 32rpx;
  font-weight: 800;
  color: var(--color-on-surface);
}
.msg-hint {
  display: block;
  margin-bottom: 24rpx;
  font-size: 22rpx;
  color: var(--color-on-surface-variant);
}
.hint-primary {
  font-weight: 700;
  color: var(--color-primary);
}
.msg-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 300rpx;
}
.spin-icon {
  font-size: 48rpx;
  color: var(--color-primary);
  animation: spin 1s linear infinite;
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
.msg-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 120rpx 40rpx;
  border: 2rpx dashed var(--color-outline-variant);
  border-radius: 24rpx;
  background: var(--color-surface-container-lowest);
  text-align: center;
}
.empty-icon {
  font-size: 80rpx;
  color: var(--color-on-surface-variant);
  margin-bottom: 24rpx;
}
.empty-title {
  font-size: 26rpx;
  font-weight: 700;
  color: var(--color-on-surface);
  margin-bottom: 12rpx;
}
.empty-desc {
  font-size: 22rpx;
  color: var(--color-on-surface-variant);
  line-height: 1.5;
}
.msg-body {
  display: flex;
  gap: 24rpx;
}
.msg-left {
  flex: 1;
  min-width: 0;
}
.graph-wrap {
  height: 360rpx;
  border: 1rpx solid var(--color-outline-variant);
  border-radius: 24rpx;
  background: var(--color-surface-container-lowest);
  overflow: hidden;
  margin-bottom: 24rpx;
}
.graph-canvas {
  width: 100%;
  height: 100%;
}
.cat-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
}
.cat-card {
  border: 1rpx solid var(--color-outline-variant);
  border-radius: 24rpx;
  background: var(--color-surface-container-lowest);
  padding: 24rpx;
}
.cat-head {
  display: flex;
  gap: 16rpx;
  margin-bottom: 20rpx;
}
.cat-icon {
  display: flex;
  width: 56rpx;
  height: 56rpx;
  flex: none;
  align-items: center;
  justify-content: center;
  border-radius: 16rpx;
}
.cat-info {
  flex: 1;
  min-width: 0;
}
.cat-name {
  display: block;
  font-size: 24rpx;
  font-weight: 700;
  color: var(--color-on-surface);
  margin-bottom: 8rpx;
}
.cat-bar {
  height: 12rpx;
  border-radius: 999rpx;
  overflow: hidden;
}
.cat-fill {
  height: 100%;
  border-radius: inherit;
  transition: width 1s ease;
}
.cat-stat {
  display: block;
  margin-top: 6rpx;
  font-size: 20rpx;
  font-weight: 700;
  text-align: right;
}
.cat-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
}
.cat-tag {
  padding: 8rpx 16rpx;
  border-radius: 10rpx;
  font-size: 20rpx;
  font-weight: 600;
  transition: all 0.2s;
}
.cat-tag:active {
  opacity: 0.7;
}

/* Job panel */
.job-panel {
  width: 320rpx;
  flex: none;
}
.job-list-card,
.job-detail-card {
  border: 1rpx solid var(--color-outline-variant);
  border-radius: 24rpx;
  background: var(--color-surface-container-lowest);
  overflow: hidden;
}
.job-list-head,
.job-detail-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 24rpx;
  border-bottom: 1rpx solid var(--color-outline-variant);
}
.job-list-title {
  display: block;
  font-size: 24rpx;
  font-weight: 700;
  color: var(--color-on-surface);
}
.job-list-sub {
  display: block;
  margin-top: 4rpx;
  font-size: 20rpx;
  color: var(--color-on-surface-variant);
}
.job-close-btn {
  padding: 8rpx;
  border-radius: 12rpx;
  color: var(--color-on-surface-variant);
}
.job-list-body {
  max-height: 60vh;
  overflow-y: auto;
}
.job-loading,
.job-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 60rpx;
  font-size: 22rpx;
  color: var(--color-on-surface-variant);
}
.job-item {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 20rpx 24rpx;
  border-bottom: 1rpx solid var(--color-outline-variant);
}
.job-item:last-child {
  border-bottom: none;
}
.job-item:active {
  background: var(--color-surface);
}
.job-item-info {
  flex: 1;
  min-width: 0;
}
.job-item-title {
  display: block;
  font-size: 22rpx;
  font-weight: 700;
  color: var(--color-on-surface);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.job-item-meta {
  display: block;
  margin-top: 4rpx;
  font-size: 20rpx;
  color: var(--color-on-surface-variant);
}
.job-company {
  font-weight: 600;
  color: var(--color-primary);
}
.job-item-salary {
  display: block;
  margin-top: 4rpx;
  font-size: 20rpx;
  font-weight: 700;
  color: var(--color-primary);
}
.job-item-arrow {
  font-size: 28rpx;
  color: var(--color-on-surface-variant);
  flex: none;
}

/* Job detail */
.job-detail-actions {
  display: flex;
  align-items: center;
  gap: 8rpx;
}
.back-btn {
  font-size: 20rpx;
  color: var(--color-on-surface-variant);
  padding: 8rpx;
}
.job-detail-body {
  padding: 24rpx;
  max-height: 65vh;
  overflow-y: auto;
}
.detail-job-title {
  display: block;
  font-size: 28rpx;
  font-weight: 800;
  color: var(--color-on-surface);
  margin-bottom: 16rpx;
}
.detail-meta {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  margin-bottom: 20rpx;
}
.detail-meta-item {
  display: flex;
  align-items: center;
  gap: 12rpx;
  font-size: 22rpx;
  color: var(--color-on-surface);
}
.meta-icon {
  font-size: 28rpx;
  color: var(--color-on-surface-variant);
  flex: none;
}
.meta-link {
  font-weight: 700;
  color: var(--color-primary);
}
.detail-desc {
  display: block;
  font-size: 22rpx;
  color: var(--color-on-surface-variant);
  line-height: 1.6;
  margin-bottom: 20rpx;
}
.detail-skills-section {
  margin-bottom: 20rpx;
}
.detail-skills-label {
  display: block;
  font-size: 20rpx;
  font-weight: 700;
  color: var(--color-on-surface-variant);
  margin-bottom: 12rpx;
}
.detail-skills-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
}
.detail-skill-tag {
  padding: 8rpx 16rpx;
  border-radius: 10rpx;
  font-size: 20rpx;
  font-weight: 600;
}
.detail-link {
  display: flex;
  align-items: center;
  gap: 10rpx;
  padding: 16rpx 20rpx;
  border-radius: 14rpx;
  font-size: 22rpx;
  font-weight: 700;
  color: var(--color-on-primary);
  background: linear-gradient(135deg, var(--color-primary), var(--accent-purple));
  margin-bottom: 12rpx;
}
.detail-link:active {
  opacity: 0.85;
}
.detail-source {
  display: block;
  font-size: 18rpx;
  color: var(--color-on-surface-variant);
}
</style>