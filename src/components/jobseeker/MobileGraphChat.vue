<template><view class="mobile-page"><text class="mobile-title">AI 图谱问答</text><text>结合岗位图谱与个人资料，支持连续追问。</text><view v-for="(m,i) in history" :key="i" class="mobile-card"><text>{{ m.role === 'user' ? '你' : '星图助手' }}：{{ m.content }}</text></view><view v-if="references.length" class="mobile-card"><text>参考资料</text><text v-for="(r,i) in references" :key="i" selectable>{{ r.title || r.name || r.source || r.url || r }}</text></view><textarea v-model="question" maxlength="1000" placeholder="例如：前端开发需要掌握哪些技能？" :disabled="busy"/><text v-if="error" class="mobile-error">{{ error }}</text><button :disabled="busy || !question.trim()" @tap="send">{{ busy ? '正在查询…' : '发送' }}</button><button :disabled="busy || !history.length" @tap="clear">开启新对话</button></view></template>
<script setup>
import { ref } from 'vue'
import { request } from '../../utils/request'
const history=ref([]), references=ref([]), question=ref(''), busy=ref(false), error=ref('')
function clear(){ history.value=[]; references.value=[]; error.value='' }
async function send(){
 const message=question.value.trim()
 if(!message || busy.value) return
 busy.value=true; error.value=''
 try {
  const raw=await request({url:'/api/kg/chat',method:'POST',data:{message,history:history.value.slice(-8).map(turn=>({...turn,content:Array.from(turn.content).slice(0,4000).join('')}))},dataType:'text',timeout:90000})
  let report
  for(const line of String(raw).split(/\r?\n/)){
   if(!line.startsWith('data:')) continue
   const payload=line.slice(5).trim()
   if(!payload || payload==='[DONE]') continue
   const event=JSON.parse(payload)
   if(event.event==='error') throw new Error(event.message)
   if(event.event==='report_done') report=event
  }
  if(!report?.answer) throw new Error('回答未完成，请重试。')
  history.value.push({role:'user',content:message},{role:'assistant',content:report.answer})
  references.value=report.references || []; question.value=''
 } catch(e){error.value=e.message} finally{busy.value=false}
}
</script>
<style scoped src="../../styles/mobile-pages.css"></style>
