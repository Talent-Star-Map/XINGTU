<template><slot></slot></template>
<script setup>
import { onMounted, provide, ref } from 'vue'
import { request } from '../../utils/request'
const masteredSkills = ref([])
const diagnosisHistory = ref([])
const learningProgress = ref([])
async function refreshSkills() { try { const data = await request({ url: '/api/learning/skills' }); if (data.success) masteredSkills.value = data.data.filter(item => item.mastered).map(item => item.skill_name) } catch {} }
async function refreshHistory() { try { const data = await request({ url: '/api/learning/history?limit=20' }); if (data.success) diagnosisHistory.value = data.data } catch {} }
async function refreshProgress(jobId) { try { const data = await request({ url: jobId ? `/api/learning/progress?job_id=${jobId}` : '/api/learning/progress' }); if (data.success) learningProgress.value = data.data } catch {} }
async function toggleMastered(skill, jobId) { const mastered = !masteredSkills.value.includes(skill); masteredSkills.value = mastered ? [...masteredSkills.value, skill] : masteredSkills.value.filter(item => item !== skill); try { await request({ url: '/api/learning/skills', method: 'POST', data: { skill_name: skill, job_id: jobId || null, mastered } }) } catch {} }
provide('learning', { masteredSkills, diagnosisHistory, learningProgress, refreshHistory, refreshProgress, toggleMastered })
onMounted(() => { refreshSkills(); refreshHistory() })
</script>
<style></style>
