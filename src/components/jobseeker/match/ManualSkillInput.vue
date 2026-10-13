<template>
  <view class="manual-input">
    <view class="input-header">
      <view>
        <text class="input-title">手动输入</text>
        <text class="input-desc">输入技能和经历，智能推荐匹配岗位</text>
      </view>
      <view class="close-btn" @tap="$emit('skip')">
        <AppIcon name="x" />
      </view>
    </view>

    <view class="input-section">
      <view class="section-label">
        <AppIcon name="briefcase" class="label-icon" />
        <text>技能</text>
      </view>
      <view class="search-wrap">
        <AppIcon name="search" class="s-icon" />
        <input class="s-input" v-model="search" placeholder="搜索技能，回车添加..." @confirm="addFromSearch" />
      </view>
      <view v-if="tags.length > 0" class="selected-tags">
        <view class="tags-row">
          <view v-for="t in tags" :key="t" class="selected-tag" @tap="removeSkill(t)">
            <text>{{ t }}</text>
            <AppIcon name="x" class="tag-x" />
          </view>
        </view>
        <view class="reset-btn" @tap="resetAll">
          <AppIcon name="x" class="reset-icon" />
          <text>重置</text>
        </view>
      </view>
      <scroll-view scroll-x class="cat-scroll">
        <view class="cat-list">
          <view v-for="(cat, idx) in filteredCats" :key="cat.name" class="cat-btn" :class="{ active: activeCat === idx }" @tap="activeCat = idx">
            <text>{{ cat.name }}</text>
          </view>
        </view>
      </scroll-view>
      <view class="skill-grid">
        <view v-for="s in currentSkills" :key="s" class="skill-btn" :class="{ active: tags.includes(s) }" @tap="toggleSkill(s)">
          <text>{{ s }}</text>
        </view>
      </view>
    </view>

    <view class="input-section">
      <view class="section-label">
        <AppIcon name="briefcase" class="label-icon" />
        <text>工作经验</text>
      </view>
      <view class="exp-list">
        <view v-for="e in EXPERIENCES" :key="e" class="exp-btn" :class="{ active: experience === e }" @tap="experience = experience === e ? null : e">
          <text>{{ e }}</text>
        </view>
      </view>
    </view>

    <view class="action-row">
      <view class="match-btn" :class="{ disabled: tags.length === 0 }" @tap="handleMatch">
        <AppIcon name="sparkles" class="btn-icon" />
        <text class="btn-text">智能匹配</text>
      </view>
      <view class="upload-btn" @tap="$emit('goToResume')">
        <AppIcon name="upload" class="btn-icon" />
        <text>上传简历</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import AppIcon from '../../common/AppIcon.vue'

const props = defineProps({ tags: { type: Array, default: () => [] } })
const emit = defineEmits(['tagsChange', 'confirm', 'autoMatch', 'skip', 'goToResume'])

const search = ref('')
const activeCat = ref(0)
const experience = ref(null)

const SKILL_CATEGORIES = [
  { name: '编程语言', skills: ['Java', 'Python', 'Go', 'C++', 'Rust', 'TypeScript', 'JavaScript', 'Scala', 'Kotlin', 'Swift', 'PHP', 'Ruby', 'Shell', 'SQL', 'Git', 'Maven', 'Gradle'] },
  { name: '前端框架', skills: ['React', 'Vue', 'Angular', 'Svelte', 'Next.js', 'HTML', 'CSS', 'Node.js', 'Webpack', 'Vite', 'Tailwind CSS', 'uni-app'] },
  { name: '后端框架', skills: ['Spring Boot', 'Spring Cloud', 'Django', 'Flask', 'FastAPI', 'Express', 'MyBatis', 'Gin', 'gRPC', 'RESTful', 'Dubbo', 'Netty'] },
  { name: '数据库', skills: ['MySQL', 'PostgreSQL', 'Redis', 'MongoDB', 'Elasticsearch', 'SQLite', 'Oracle', 'ClickHouse', 'Neo4j', 'TiDB'] },
  { name: 'AI/大模型', skills: ['大模型', 'LLM', 'LangChain', 'RAG', 'Agent', 'Prompt Engineering', 'NLP', 'CV', 'PyTorch', 'TensorFlow', 'Pandas', 'NumPy'] },
  { name: '大数据', skills: ['Spark', 'Flink', 'Hadoop', 'Kafka', 'Hive', 'HBase', 'Airflow', 'ClickHouse', '数据仓库', 'ETL', 'Doris'] },
  { name: '云原生', skills: ['Docker', 'Kubernetes', 'K8s', 'CI/CD', 'Jenkins', 'Terraform', 'Nginx', 'Linux', 'AWS', '阿里云', '微服务', 'Serverless'] },
  { name: '架构', skills: ['分布式', '微服务', '高并发', '架构设计', '消息队列', 'RabbitMQ', 'RocketMQ', '负载均衡', 'DDD', 'Nacos'] },
]
const EXPERIENCES = ['应届生', '1年以内', '1-3年', '3-5年', '5-10年', '10年以上']

const filteredCats = computed(() => {
  const kw = search.value.toLowerCase().trim()
  return SKILL_CATEGORIES.map(cat => ({
    ...cat,
    skills: kw ? cat.skills.filter(s => s.toLowerCase().includes(kw)).sort() : [...cat.skills].sort(),
  }))
})
const currentSkills = computed(() => filteredCats.value[activeCat.value]?.skills || [])

function addSkill(s) { if (s && !props.tags.includes(s)) emit('tagsChange', [...props.tags, s]) }
function removeSkill(s) { emit('tagsChange', props.tags.filter(x => x !== s)) }
function toggleSkill(s) { props.tags.includes(s) ? removeSkill(s) : addSkill(s) }
function resetAll() { emit('tagsChange', []); experience.value = null }
function addFromSearch() { const kw = search.value.toLowerCase().trim(); const first = currentSkills.value.find(s => s.toLowerCase().includes(kw)); if (first) { addSkill(first); search.value = '' } }
function handleMatch() { if (props.tags.length > 0) emit('autoMatch', props.tags) }
</script>

<style>
.manual-input { padding: 36rpx; border: 1rpx solid var(--color-outline-variant); border-radius: 24rpx; background: var(--color-surface-container-lowest); }
.input-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28rpx; }
.input-title { font-size: 26rpx; font-weight: 700; color: var(--color-on-surface); display: block; }
.input-desc { font-size: 22rpx; color: var(--color-on-surface-variant); margin-top: 4rpx; display: block; }
.close-btn { padding: 8rpx; color: var(--color-on-surface-variant); }
.input-section { margin-bottom: 28rpx; }
.section-label { display: flex; align-items: center; gap: 8rpx; font-size: 22rpx; font-weight: 600; color: var(--color-on-surface); margin-bottom: 16rpx; }
.label-icon { width: 22rpx; height: 22rpx; }
.search-wrap { position: relative; display: flex; align-items: center; margin-bottom: 16rpx; }
.s-icon { position: absolute; left: 20rpx; width: 28rpx; height: 28rpx; color: var(--color-on-surface-variant); }
.s-input { width: 100%; height: 60rpx; padding: 0 20rpx 0 56rpx; border: 1rpx solid var(--color-outline-variant); border-radius: 14rpx; background: var(--color-surface); color: var(--color-on-surface); font-size: 22rpx; }
.selected-tags { margin-bottom: 16rpx; }
.tags-row { display: flex; flex-wrap: wrap; gap: 10rpx; margin-bottom: 12rpx; }
.selected-tag { display: flex; align-items: center; gap: 6rpx; padding: 6rpx 16rpx; border-radius: 8rpx; background: var(--color-primary-fixed); color: var(--color-primary); font-size: 22rpx; font-weight: 500; }
.tag-x { width: 20rpx; height: 20rpx; }
.reset-btn { display: flex; align-items: center; gap: 6rpx; padding: 8rpx 16rpx; border-radius: 10rpx; background: var(--color-surface); color: var(--color-on-surface-variant); font-size: 20rpx; align-self: flex-start; }
.reset-icon { width: 20rpx; height: 20rpx; }
.cat-scroll { white-space: nowrap; margin-bottom: 16rpx; }
.cat-list { display: flex; gap: 8rpx; }
.cat-btn { flex: none; padding: 10rpx 20rpx; border-radius: 10rpx; background: var(--color-surface); color: var(--color-on-surface-variant); font-size: 22rpx; font-weight: 500; }
.cat-btn.active { background: var(--color-primary); color: #fff; }
.skill-grid { display: flex; flex-wrap: wrap; gap: 10rpx; max-height: 360rpx; overflow-y: auto; }
.skill-btn { padding: 8rpx 18rpx; border-radius: 8rpx; border: 1rpx solid var(--color-outline-variant); background: var(--color-surface); color: var(--color-on-surface-variant); font-size: 22rpx; }
.skill-btn.active { background: var(--color-primary); color: #fff; border-color: var(--color-primary); }
.exp-list { display: flex; flex-wrap: wrap; gap: 12rpx; }
.exp-btn { padding: 10rpx 22rpx; border-radius: 10rpx; border: 1rpx solid var(--color-outline-variant); background: var(--color-surface); color: var(--color-on-surface-variant); font-size: 22rpx; }
.exp-btn.active { background: var(--color-primary); color: #fff; border-color: var(--color-primary); }
.action-row { display: flex; align-items: center; gap: 20rpx; }
.match-btn { flex: 1; display: flex; align-items: center; justify-content: center; gap: 12rpx; height: 72rpx; border-radius: 16rpx; background: var(--color-primary); }
.match-btn.disabled { opacity: 0.4; }
.btn-icon { width: 28rpx; height: 28rpx; color: #fff; }
.btn-text { font-size: 26rpx; font-weight: 600; color: #fff; }
.upload-btn { display: flex; align-items: center; gap: 10rpx; height: 72rpx; padding: 0 28rpx; border: 1rpx solid var(--color-outline-variant); border-radius: 16rpx; font-size: 24rpx; font-weight: 500; color: var(--color-on-surface-variant); }
</style>
