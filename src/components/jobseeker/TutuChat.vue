<template>
  <view class="chat-root" :style="chatRootStyle" @touchstart="onTouchStart" @touchmove="onTouchMove" @touchend="onTouchEnd"><view class="chat-toggle"><text class="tutu-icon">{{ open ? '✕' : '🤖' }}</text></view><view v-if="open" class="chat-panel"><view class="chat-head"><text class="head-icon">🤖</text><view><text>图图</text><text>AI 学习助手</text></view></view><scroll-view class="chat-log" scroll-y :scroll-into-view="lastId"><view v-for="(message,index) in messages" :id="`message-${index}`" :key="index" class="message" :class="message.role"><text v-if="message.role === 'tutu'" class="sender">图图</text><text>{{ message.text }}</text></view></scroll-view><view class="chat-input"><input v-model="input" confirm-type="send" placeholder="输入问题..." @confirm="sendMessage"/><view class="send-button" @tap="sendMessage"><AppIcon name="send" /></view></view></view>
  </view>
</template>
<script setup>
import { computed, ref, onMounted } from 'vue'
import AppIcon from '../common/AppIcon.vue'
import { request } from '../../utils/request'
const open = ref(false)
const input = ref('')
const messages = ref([{ role:'tutu', text:'你好！我是图图，你的 AI 学习助手。有任何问题都可以问我！' }])
const lastId = computed(() => `message-${messages.value.length - 1}`)
const posX = ref(0)
const posY = ref(0)
const startX = ref(0)
const startY = ref(0)
const isDragging = ref(false)
const chatRootStyle = computed(() => ({ left: posX.value + 'px', top: posY.value + 'px' }))
function onTouchStart(e) { const touch = e.touches[0]; startX.value = touch.clientX - posX.value; startY.value = touch.clientY - posY.value; isDragging.value = false }
function onTouchMove(e) { const touch = e.touches[0]; const newX = touch.clientX - startX.value; const newY = touch.clientY - startY.value; const dx = newX - posX.value; const dy = newY - posY.value; if (Math.abs(dx) > 3 || Math.abs(dy) > 3) isDragging.value = true; posX.value = newX; posY.value = newY }
function onTouchEnd() { if (isDragging.value) { const sys = uni.getSystemInfoSync(); const btnW = 112 * sys.windowWidth / 750; const margin = 36 * sys.windowWidth / 750; if (posX.value + btnW / 2 > sys.windowWidth / 2) { posX.value = sys.windowWidth - btnW - margin } else { posX.value = margin }; if (posY.value < margin) posY.value = margin; if (posY.value + btnW > sys.windowHeight - margin) posY.value = sys.windowHeight - btnW - margin } else { open.value = !open.value } }
const learningKB = [
  { keywords: ['langchain'], answer: 'LangChain 是当前最主流的 LLM 应用开发框架。建议从官方文档的 Quickstart 开始，先理解 Chain、Agent、Memory 三个核心概念，然后动手写一个简单的 QA 应用。 📚' },
  { keywords: ['rag', '检索增强', '知识库'], answer: 'RAG（检索增强生成）是企业级 LLM 应用的核心模式。关键步骤：文档分割 → 向量化 → 存储到向量数据库 → 检索相关片段 → 送入 LLM 生成。推荐先掌握 Chroma 或 Milvus 作为向量数据库。 🔍' },
  { keywords: ['agent', '智能体', '工具调用'], answer: 'Agent 是让 LLM 具备行动能力的关键技术。核心思路：LLM 作为大脑，根据任务目标决定调用什么工具（搜索、计算、API等），然后根据工具结果做下一步决策。建议从 LangChain 的 ReAct Agent 入门。 🤖' },
  { keywords: ['prompt', '提示词', 'prompt engineering'], answer: 'Prompt Engineering 是操控 LLM 的核心技能。关键原则：1）明确角色设定 2）给出具体任务 3）提供示例（Few-shot）4）指定输出格式。推荐学习吴恩达的 ChatGPT Prompt Engineering 课程。 ✍️' },
  { keywords: ['部署', '生产', '上线', 'docker', 'kubernetes'], answer: 'LLM 应用部署关键点：1）模型服务化（FastAPI/Flask）2）容器化（Docker）3）负载均衡 4）监控告警 5）成本控制。建议先用 Docker + FastAPI 做单机部署，再进阶到 K8s。 🚀' },
  { keywords: ['向量数据库', 'embedding', '向量化', 'chroma', 'milvus'], answer: '向量数据库是 RAG 的存储核心。轻量级推荐 Chroma（本地开发）和 Qdrant（生产环境），大规模场景用 Milvus 或 Weaviate。关键指标：检索速度、召回率、支持的数据规模。 💾' },
  { keywords: ['mcp', 'protocol', 'model context protocol'], answer: 'MCP（Model Context Protocol）是 Anthropic 提出的标准协议，让 LLM 能标准化地连接各种数据源和工具。它定义了 Client-Server 架构，类似"AI 的 USB-C 接口"。建议关注官方规范文档。 🔌' },
  { keywords: ['技能', '学习', '怎么学', '如何开始', '入门', '新手', '初学'], answer: '学习建议：1）先选一个目标岗位，明确技能要求 2）对照差距，按优先级补核心技能 3）每个技能配合动手项目 4）定期重新诊断看进步。星星已经帮你规划好了路径，按阶段推进就行！ 🌟' },
  { keywords: ['面试', '简历', '求职', '找工作'], answer: '求职建议：1）简历突出项目经验，量化成果 2）准备 2-3 个核心项目的深度讲解 3）刷 LeetCode + 系统设计 4）了解目标公司的技术栈。匹配度提升到 80+ 会更有竞争力！ 💪' },
  { keywords: ['谢谢', '感谢', 'thanks', 'thank'], answer: '不客气！有问题随时找我。加油学习，早日拿到心仪 Offer！ 🎉' },
  { keywords: ['你好', 'hi', 'hello', '嗨'], answer: '你好呀！我是图图，你的 AI 学习助手。可以问我任何关于技能学习、求职、技术的问题哦~ 😊' },
]

function localReply(text) {
  const lower = text.toLowerCase()
  for (const item of learningKB) {
    if (item.keywords.some(k => lower.includes(k))) return item.answer
  }
  if (/简历|CV/i.test(text)) return '建议突出量化成果，用 STAR 法则描述项目经历。'
  if (/面试/.test(text)) return '面试前了解公司背景，并准备几个有价值的问题。'
  if (/薪资|薪酬/.test(text)) return '先调研市场行情，再结合能力和经验合理定价。'
  return '图图还在学习中，试试问我简历优化、面试技巧或学习规划吧。'
}
onMounted(() => { const sys = uni.getSystemInfoSync(); const btnW = 112 * sys.windowWidth / 750; const margin = 36 * sys.windowWidth / 750; posX.value = sys.windowWidth - btnW - margin; posY.value = sys.windowHeight * 0.8 - btnW })
async function sendMessage() { const text = input.value.trim(); if (!text) return; input.value = ''; messages.value.push({ role:'user', text }, { role:'tutu', text:'思考中...' }); let diagnosis = null; try { const raw = uni.getStorageSync('jt_learning_report'); const report = raw ? JSON.parse(raw) : null; if (report?.result?.skills?.miss) diagnosis = { miss_skills: report.result.skills.miss.map(item => typeof item === 'string' ? item : item.skill || item.name || '').filter(Boolean), target_job:report.job?.title || '' } } catch {} try { const history = messages.value.filter(item => item.text !== '思考中...').slice(-6).map(item => ({ role:item.role === 'user' ? 'user' : 'assistant', content:item.text })); const data = await request({ url:'/api/chat', method:'POST', data:{ message:text, diagnosis, history } }); messages.value.splice(messages.value.length - 1, 1, { role:'tutu', text:data?.answer || localReply(text) }) } catch { messages.value.splice(messages.value.length - 1, 1, { role:'tutu', text:localReply(text) }) } }
</script>
<style>.chat-root { position:fixed; z-index:50; }.chat-toggle { display:flex; width:112rpx; height:112rpx; align-items:center; justify-content:center; border-radius:50%; background:var(--color-primary); color:#fff; font-size:50rpx; box-shadow:0 12rpx 28rpx rgba(0,82,217,.3); }.chat-toggle:active { transform:scale(.95); }.tutu-icon { font-size:52rpx; line-height:1; }.chat-panel { position:absolute; right:0; bottom:144rpx; display:flex; width:650rpx; height:800rpx; overflow:hidden; flex-direction:column; border:1rpx solid var(--color-outline-variant); border-radius:32rpx; background:var(--color-surface); box-shadow:0 20rpx 48rpx rgba(0,0,0,.22); animation:chat-enter .2s ease-out; }.chat-head { display:flex; padding:24rpx; align-items:center; gap:16rpx; background:var(--color-primary); color:#fff; }.head-icon { font-size:44rpx; line-height:1; }.chat-head view { display:flex; flex-direction:column; gap:4rpx; }.chat-head text:first-child { font-size:28rpx; font-weight:700; }.chat-head text:last-child { font-size:21rpx; opacity:.8; }.chat-log { flex:1; padding:16rpx 24rpx; }.message { display:flex; max-width:85%; margin-bottom:14rpx; padding:14rpx 18rpx; flex-direction:column; gap:6rpx; border:1rpx solid var(--color-outline-variant); border-radius:20rpx; background:var(--color-surface-container); color:var(--color-on-surface); font-size:25rpx; line-height:1.55; }.message.user { margin-left:auto; border-color:var(--color-primary); border-bottom-right-radius:6rpx; background:var(--color-primary); color:#fff; }.message.tutu { border-bottom-left-radius:6rpx; }.sender { color:var(--color-primary); font-size:20rpx; font-weight:700; }.chat-input { display:flex; padding:12rpx 18rpx; gap:12rpx; border-top:1rpx solid var(--color-outline-variant); align-items:center; }.chat-input input { flex:1; height:64rpx; padding:0 20rpx; border-radius:32rpx; background:var(--color-surface-container); color:var(--color-on-surface); font-size:24rpx; }.send-button { display:flex; width:64rpx; height:64rpx; align-items:center; justify-content:center; border-radius:50%; background:var(--color-primary); color:#fff; font-size:30rpx; } @keyframes chat-enter { from { opacity:0; transform:translateY(20rpx) scale(.95); } to { opacity:1; transform:translateY(0) scale(1); } }</style>
