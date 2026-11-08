<template><view class="mobile-page"><text class="mobile-title">个人经历与技术证据</text><text v-if="error" class="mobile-error">{{ error }}</text><text v-if="loading">正在读取个人图谱…</text><template v-if="graph"><text>{{ graph.summary.experiences }} 段经历 · {{ graph.summary.skills }} 项技术 · {{ graph.summary.supportedSkills }} 项有经历依据</text><text>{{ graph.sourceResume?.title || '来自个人资料与技能记录' }}</text><view class="mobile-actions"><button v-for="f in filters" :key="f.key" size="mini" :type="filter===f.key?'primary':'default'" @tap="filter=f.key">{{ f.label }}</button></view><text v-if="!nodes.length">暂无相关经历或技能。</text><view v-for="n in nodes" :key="n.id" class="mobile-card"><text @tap="selected=selected===n.id?'':n.id">{{ n.name }} {{ selected===n.id?'▴':'▾' }}</text><template v-if="selected===n.id"><text>{{ n.description || n.summary || '' }}</text><text v-if="!proofs.length">暂无关联原文依据。</text><view v-for="p in proofs" :key="p.id" class="mobile-card"><text>{{ graph.nodes.find(x=>x.id===(n.kind==='skill'?p.experienceId:p.skillId))?.name }} · {{ p.basis }}</text><text selectable>{{ p.quote }}</text><text>来自用户填写的资料，未经独立核实</text></view></template></view></template></view></template>
<script setup>
import {computed,onMounted,ref} from 'vue'
import {request} from '../../utils/request'
const filters=[{key:'all',label:'全部'},{key:'project',label:'项目'},{key:'work',label:'工作经历'},{key:'skill',label:'技术'}]
const graph=ref(null),error=ref(''),loading=ref(true),filter=ref('all'),selected=ref('')
const nodes=computed(()=>graph.value?.nodes.filter(n=>n.kind!=='person'&&(filter.value==='all'||n.kind===filter.value))||[])
const proofs=computed(()=>graph.value?.evidence.filter(p=>p.experienceId===selected.value||p.skillId===selected.value)||[])
onMounted(async()=>{try{const r=await request({url:'/api/kg/personal/graph'});if(!r.success||!r.data?.summary)throw new Error(r.message||'个人图谱暂不可用');graph.value=r.data}catch(e){error.value=e.message}finally{loading.value=false}})
</script>
<style scoped src="../../styles/mobile-pages.css"></style>
