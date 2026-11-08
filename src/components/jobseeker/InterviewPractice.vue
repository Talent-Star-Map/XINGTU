<template>
  <view class="practice">
    <text class="heading">AI 模拟面试</text>
    <text>根据目标岗位练习，完成后查看回答反馈。</text>
    <input v-if="!session" v-model="role" placeholder="输入目标岗位" maxlength="120" />
    <text v-if="error" class="error">{{ error }}</text>
    <button v-if="!session" :disabled="busy || !role.trim()" @tap="start">{{ busy ? '正在准备…' : '开始面试' }}</button>
    <template v-else>
      <text>第 {{ index }} / {{ session.target_questions }} 题</text>
      <view v-for="(turn, i) in history" :key="i" class="card">
        <text>面试官：{{ turn.question }}</text>
        <text>你的回答：{{ turn.answer }}</text>
      </view>
      <view v-if="question" class="card"><text>面试官：{{ question }}</text></view>
      <view v-if="question && !report"><button size="mini" :disabled="voiceBusy" @tap="playVoice">{{ voiceBusy ? '正在合成…' : '晓晓朗读' }}</button><button size="mini" @tap="stopVoice">停止朗读</button><text v-if="voiceError" class="error">{{ voiceError }}</text></view>
      <textarea v-if="!complete && !report" v-model="answer" maxlength="2000" placeholder="输入你的回答，也可以请面试官解释题目" />
      <button v-if="!complete && !report" :disabled="busy || !answer.trim()" @tap="submit">提交回答</button>
      <button v-if="!report && history.length" :disabled="busy" @tap="feedback">生成练习反馈</button>
      <view v-if="report" class="card">
        <text>{{ report.summary }}</text>
        <view v-for="item in report.items" :key="item.index" class="card">
          <text>第 {{ item.index }} 轮：{{ item.quote }}</text>
          <text>亮点：{{ item.strength }}</text>
          <text>改进：{{ item.improvement }}</text>
          <text>回答思路：{{ item.outline }}</text>
        </view>
        <text>{{ report.notice }}</text>
      </view>
      <button :disabled="busy" @tap="reset">重新练习</button>
    </template>
  </view>
</template>

<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { API_BASE_URL, request } from '../../utils/request'

const role = ref('')
const session = ref(null)
const question = ref('')
const index = ref(1)
const history = ref([])
const answer = ref('')
const report = ref(null)
const complete = ref(false)
const busy = ref(false)
const error = ref('')
const api = (path, data, options = {}) => request({
  url: '/api/interview/' + path, method: data ? 'POST' : 'GET', data,
  timeout: 90000, ...options,
})

const voiceBusy = ref(false)
const voiceError = ref('')
let audio, cleanup, voiceVersion = 0
function stopVoice() {
  voiceVersion++
  if (audio) { const player = audio; audio = null; player.stop(); player.destroy() }
  cleanup?.(); cleanup = null
  voiceBusy.value = false
}
onUnmounted(stopVoice)
async function playVoice() {
  stopVoice()
  voiceError.value = ''
  voiceBusy.value = true
  const version = voiceVersion
  try {
    const segments = Array.from(question.value.matchAll(/[^。！？!?；;]{1,100}[。！？!?；;]?/g), m => m[0].trim()).filter(Boolean)
    for (const text of segments) {
      if (version !== voiceVersion) return
      const bytes = await new Promise((resolve, reject) => uni.request({
        url: API_BASE_URL + '/api/interview/speech', method: 'POST', data: { text }, responseType: 'arraybuffer', timeout: 50000,
        header: { Authorization: 'Bearer ' + uni.getStorageSync('xingtu_token'), 'Content-Type': 'application/json' },
        success: r => r.statusCode === 200 ? resolve(r.data) : reject(new Error('晓晓语音暂不可用，可继续文字面试。')),
        fail: reject,
      }))
      if (version !== voiceVersion) return
      let src, release
      // #ifdef H5
      src = URL.createObjectURL(new Blob([bytes], { type: 'audio/mpeg' }))
      release = () => URL.revokeObjectURL(src)
      // #endif
      // #ifdef MP-WEIXIN
      src = wx.env.USER_DATA_PATH + '/interview-' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.mp3'
      const fs = uni.getFileSystemManager()
      await new Promise((resolve, reject) => fs.writeFile({ filePath: src, data: bytes, success: resolve, fail: reject }))
      release = () => fs.unlink({ filePath: src, fail() {} })
      // #endif
      if (version !== voiceVersion) { release?.(); return }
      await new Promise((resolve, reject) => {
        const player = uni.createInnerAudioContext()
        audio = player
        cleanup = () => { release?.(); resolve() }
        player.onEnded(() => { if (audio !== player) return; audio = null; cleanup = null; player.destroy(); release?.(); resolve() })
        player.onError(() => { if (audio !== player) return; audio = null; cleanup = null; player.destroy(); release?.(); reject(new Error('语音播放失败，请重试。')) })
        player.src = src
        player.play()
      })
    }
  } catch (e) { if (version === voiceVersion) voiceError.value = e.message || '语音暂不可用，可继续文字面试。' }
  finally { if (version === voiceVersion) voiceBusy.value = false }
}

onMounted(async () => {
  try {
    const profile = await api('bootstrap')
    if (!role.value) role.value = profile.target_role || ''
  } catch { /* The role can still be entered manually. */ }
})

async function run(work) {
  if (busy.value) return
  busy.value = true
  error.value = ''
  try { await work() }
  catch (e) { error.value = e.message || '面试暂不可用，请重试。' }
  finally { busy.value = false }
}

async function next(context, turns) {
  const raw = await api('conversation', {
    role: role.value.trim(), context_id: context.context_id, history: turns,
  }, { dataType: 'text' })
  let reply = '', metadata, done = false
  for (const line of String(raw).split('\n')) {
    if (!line.trim()) continue
    const event = JSON.parse(line)
    if (event.type === 'error') throw new Error(event.message)
    if (event.type === 'delta') reply += event.text
    if (event.type === 'context') metadata = event
    if (event.type === 'done') done = true
  }
  if (!done || !metadata || !reply.trim()) throw new Error('面试回复不完整，请重试。')
  stopVoice()
  voiceError.value = ''
  question.value = reply.trim()
  index.value = metadata.main_index
  complete.value = metadata.complete || turns.length >= 30
}

function start() {
  return run(async () => {
    const prepared = await api('prepare', { role: role.value.trim(), target_questions: 7 })
    await next(prepared, [])
    session.value = prepared
  })
}
function submit() {
  return run(async () => {
    const turns = [...history.value, { question: question.value, answer: answer.value.trim(), main_index: index.value }]
    await next(session.value, turns)
    history.value = turns
    answer.value = ''
  })
}
function feedback() {
  return run(async () => {
    stopVoice()
    report.value = await api('report', { role: role.value.trim(), context_id: session.value.context_id, history: history.value })
  })
}
function reset() {
  stopVoice()
  voiceError.value = ''
  session.value = null
  history.value = []
  answer.value = ''
  question.value = ''
  report.value = null
  error.value = ''
  complete.value = false
}
</script>

<style scoped>
.practice { padding: 32rpx; display: flex; flex-direction: column; gap: 20rpx; }
.heading { font-size: 40rpx; font-weight: 700; }
.card, input, textarea { border: 1px solid #8794a555; border-radius: 16rpx; padding: 20rpx; box-sizing: border-box; width: 100%; }
.card { display: flex; flex-direction: column; gap: 12rpx; }
textarea { min-height: 180rpx; }
.error { color: #b43c31; }
button { width: 100%; }
</style>
