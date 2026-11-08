<template><view class="mobile-page"><button size="mini" @tap="$emit('close')">返回简历管理</button><text class="mobile-title">简历附件</text><text v-if="item">{{ item.filename }}</text><text v-if="error" class="mobile-error">{{ error }}</text><text v-if="busy">正在读取附件…</text><view v-if="item" class="mobile-actions"><button size="mini" :disabled="busy" @tap="open(true)">预览</button><button size="mini" :disabled="busy" @tap="open(false)">下载原件</button></view><image v-if="image" :src="image" mode="widthFix" style="width:100%" /><text v-if="content" selectable class="mobile-card">{{ content }}</text></view></template>
<script setup>
import {ref,onMounted,onUnmounted} from 'vue'
import {API_BASE_URL,request} from '../../utils/request'
const props=defineProps({filename:{type:String,required:true}})
defineEmits(['close'])
const item=ref(null),busy=ref(true),error=ref(''),image=ref(''),content=ref('')
let disposed=false,objectUrl=''
const url=preview=>'/api/auth/resume-file?filename='+encodeURIComponent(props.filename)+'&preview='+preview
const headers=()=>({Authorization:'Bearer '+uni.getStorageSync('xingtu_token')})
function clear(){if(objectUrl){URL.revokeObjectURL(objectUrl);objectUrl=''}image.value='';content.value=''}
onUnmounted(()=>{disposed=true;clear()})
onMounted(async()=>{try{const r=await request({url:'/api/auth/resume-detail?filename='+encodeURIComponent(props.filename)});item.value=r.data?.attachment;if(!item.value)throw new Error('附件不存在。')}catch(e){error.value=e.message}finally{busy.value=false}})
async function open(preview){
 if(busy.value||!item.value)return
 busy.value=true;error.value='';clear()
 try {
  const extension=String(item.value.extension||'').toLowerCase()
  if(preview&&extension==='txt'){content.value=await request({url:url(true),dataType:'text'});return}
  // #ifdef H5
  const r=await fetch(API_BASE_URL+url(preview),{headers:headers()})
  if(!r.ok)throw new Error('附件读取失败（'+r.status+'）')
  const blob=await r.blob()
  if(disposed)return
  objectUrl=URL.createObjectURL(blob)
  if(preview&&blob.type.startsWith('image/')){image.value=objectUrl;return}
  const link=document.createElement('a');link.href=objectUrl
  if(preview){link.target='_blank';link.rel='noopener noreferrer'}else{link.download=item.value.filename}
  link.click()
  // #endif
  // #ifndef H5
  const path=await new Promise((resolve,reject)=>uni.downloadFile({url:API_BASE_URL+url(preview),header:headers(),success:r=>r.statusCode===200?resolve(r.tempFilePath):reject(new Error('附件读取失败（'+r.statusCode+'）')),fail:reject}))
  if(disposed)return
  if(!preview){
   await new Promise((resolve,reject)=>uni.saveFile({tempFilePath:path,success:resolve,fail:reject}))
   uni.showToast({title:'原件已保存',icon:'success'});return
  }
  if(['png','jpg','jpeg','webp','bmp','gif'].includes(extension)){image.value=path;return}
  await new Promise((resolve,reject)=>uni.openDocument({filePath:path,fileType:'pdf',showMenu:true,success:resolve,fail:reject}))
  // #endif
 }catch(e){error.value=e.message||e.errMsg||'无法打开附件。'}finally{busy.value=false}
}
</script>
<style scoped src="../../styles/mobile-pages.css"></style>
