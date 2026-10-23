/** 三个个人页面共用的技能口径，不按岗位分别统计同一个技能。 */
export interface UserSkillCategory { name: string; skills: string[] }
export interface SkillMark { skill_name: string; mastered: boolean | number; job_id?: number | null }
const keyOf = (skill: string) => skill.trim().toLocaleLowerCase()

export function latestResume<T extends { id: number | string; updated_at?: string; created_at?: string }>(rows: T[]): T | undefined {
  return [...rows].sort((a, b) =>
    (b.updated_at || b.created_at || '').localeCompare(a.updated_at || a.created_at || '') || Number(b.id) - Number(a.id))[0]
}

export function resolveUserSkills(profileSkills: string | string[] | undefined, sections: any[], marks: SkillMark[]): UserSkillCategory[] {
  const content = sections.find(s => (s.section_type || s.type) === 'skills')?.content
  const categories: UserSkillCategory[] = (content?.categories || []).map((c: any) => ({
    name: String(c.name || '其他技能'), skills: Array.isArray(c.skills) ? c.skills.filter((s: unknown) => typeof s === 'string') : [],
  }))
  const source = categories.some(c => c.skills.some(s => s.trim())) ? categories : [{
    name: '技能特长', skills: Array.isArray(profileSkills) ? profileSkills : (profileSkills || '').split(/[,，、;；\n]+/),
  }]
  const skills = new Map<string, { name: string; category: string }>()
  for (const category of source) for (const raw of category.skills) {
    const name = raw.trim()
    if (name && !skills.has(keyOf(name))) skills.set(keyOf(name), { name, category: category.name })
  }
  const bySkill = new Map<string, SkillMark[]>()
  for (const mark of marks) {
    if (!mark.skill_name?.trim()) continue
    const key = keyOf(mark.skill_name)
    bySkill.set(key, [...(bySkill.get(key) || []), mark])
  }
  for (const [key, records] of bySkill) {
    // 全局手动标记优先；旧的按岗位记录只作为没有全局标记时的补充。
    const global = records.find(r => r.job_id == null)
    const mastered = global ? Boolean(global.mastered) : records.some(r => Boolean(r.mastered))
    if (global && !mastered) skills.delete(key)
    else if (mastered && !skills.has(key)) skills.set(key, { name: records[0].skill_name.trim(), category: '学习已掌握' })
  }
  const groups = new Map<string, string[]>()
  for (const skill of skills.values()) groups.set(skill.category, [...(groups.get(skill.category) || []), skill.name])
  return Array.from(groups, ([name, skills]) => ({ name, skills }))
}
