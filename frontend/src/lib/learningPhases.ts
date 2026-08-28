/**
 * 学习路径阶段计算 — 诊断页与学习中心共用同一份算法，
 * 避免两处各写一遍导致阶段划分/预计周期对不上。
 */

export type Priority = 'high' | 'medium' | 'low'

export interface MissingSkill {
  skill?: string
  name?: string
  priority?: string
  is_core?: boolean
}

export interface SkillGroups {
  high: string[]
  medium: string[]
  low: string[]
}

export const PHASE_TITLES: Record<Priority, string> = {
  high: '核心技能补齐',
  medium: '进阶能力提升',
  low: '拓宽技能栈',
}

/** 每个阶段的最低周数下限 */
const BASE_WEEKS: Record<Priority, number> = { high: 2, medium: 3, low: 2 }
/** 每项技能的预估周数系数 */
const ETA_PER_SKILL: Record<Priority, number> = { high: 1, medium: 0.5, low: 0.3 }

const ORDER: Priority[] = ['high', 'medium', 'low']

const normalizePriority = (p?: string): Priority =>
  p === 'high' ? 'high' : p === 'medium' ? 'medium' : 'low'

/** 把缺失技能按优先级分组，组内保持原顺序并去重 */
export function groupMissingSkills(miss: MissingSkill[] | undefined | null): SkillGroups {
  const groups: SkillGroups = { high: [], medium: [], low: [] }
  const seen = new Set<string>()
  for (const item of miss || []) {
    const name = (item?.skill || item?.name || '').trim()
    if (!name || seen.has(name)) continue
    seen.add(name)
    groups[normalizePriority(item?.priority)].push(name)
  }
  return groups
}

/** 单个阶段的预计周数 */
export function estimateWeeks(priority: Priority, count: number): number {
  if (count <= 0) return 0
  return Math.max(BASE_WEEKS[priority], Math.ceil(count * ETA_PER_SKILL[priority]))
}

/** 有内容的阶段列表（按 high → medium → low 顺序） */
export function activePhases(groups: SkillGroups): Priority[] {
  return ORDER.filter(p => groups[p].length > 0)
}

/** 全部阶段预计周数之和 */
export function totalWeeksOf(groups: SkillGroups): number {
  return activePhases(groups).reduce((sum, p) => sum + estimateWeeks(p, groups[p].length), 0)
}
