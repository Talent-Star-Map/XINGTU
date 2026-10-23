import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import ts from 'typescript'

const source = readFileSync(new URL('../src/lib/userSkills.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
const { resolveUserSkills, latestResume } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
const section = categories => [{ section_type: 'skills', content: { categories } }]
const names = groups => groups.flatMap(g => g.skills)

test('简历21项、学习记录6项重叠时，统一结果仍是21项，旧账号技能不混入', () => {
  const skills = Array.from({ length: 21 }, (_, i) => `技能${i + 1}`)
  const result = resolveUserSkills('旧账号技能', section([{ name: '专业技能', skills }]),
    skills.slice(0, 6).map(skill_name => ({ skill_name, mastered: true, job_id: 9 })))
  assert.deepEqual(names(result), skills)
})

test('跨分类和大小写重复只计一次，C和C++保持独立', () => {
  const result = resolveUserSkills('', section([
    { name: '语言', skills: [' Python ', 'C', 'C++', ''] },
    { name: '数据', skills: ['python', 'SQL'] },
  ]), [{ skill_name: 'PYTHON', mastered: true, job_id: null }])
  assert.deepEqual(names(result), ['Python', 'C', 'C++', 'SQL'])
})

test('学习新增技能合并，全局取消掌握覆盖简历和旧岗位记录', () => {
  const result = resolveUserSkills('', section([{ name: '技能', skills: ['Python', 'SQL'] }]), [
    { skill_name: 'Python', mastered: false, job_id: null },
    { skill_name: 'Python', mastered: true, job_id: 1 },
    { skill_name: 'SQL', mastered: false, job_id: 1 },
    { skill_name: 'Docker', mastered: true, job_id: null },
  ])
  assert.deepEqual(names(result), ['SQL', 'Docker'])
})

test('没有有效简历技能才回退账号技能，空白不计数', () => {
  assert.deepEqual(names(resolveUserSkills('Python，SQL; Python\nDocker', section([{ name: '空分类', skills: [' '] }]), [])), ['Python', 'SQL', 'Docker'])
  assert.deepEqual(resolveUserSkills('', [], []), [])
})

test('同时间的简历以ID确定最新一份，不改变原列表', () => {
  const resumes = [{ id: 1, updated_at: '2026-10-23' }, { id: 3, updated_at: '2026-10-23' }, { id: 4, updated_at: '2026-10-22' }]
  assert.equal(latestResume(resumes).id, 3)
  assert.equal(resumes[0].id, 1)
  assert.equal(latestResume([]), undefined)
})
