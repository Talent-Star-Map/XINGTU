/** 简历健康度打分
 *
 * 纯前端计算，不发请求：用户每敲一个字都应该看到分数变化，走接口会卡。
 * 评分只反映「这份简历是否完整、是否写得具体」，不代表岗位匹配度——
 * 后者走 `/api/resume-center/{id}/analyze`，用的是人岗匹配引擎。
 *
 * 三个维度：完整度 40 / 内容质量 30 / 篇幅规范 30。
 */

export interface HealthItem {
  key: string
  label: string
  score: number
  max: number
  hint: string
}

export interface HealthReport {
  total: number
  level: 'excellent' | 'good' | 'fair' | 'poor'
  levelText: string
  items: HealthItem[]
  /** 扣分项（score < max），按扣分多少排序，前端直接列 */
  issues: HealthItem[]
}

type AnySection = {
  type?: string
  section_type?: string
  content?: any
}

const sectionType = (s: AnySection) => s.type || s.section_type || ''
const items = (c: any): any[] => (Array.isArray(c?.items) ? c.items : [])

function textLength(value: unknown): number {
  return typeof value === 'string' ? value.replace(/\s/g, '').length : 0
}

function hasQuantified(text: string): boolean {
  return /\d/.test(text) && /(%|％|倍|万|千|百|ms|s\b|QPS|用户|人|条|个)/i.test(text)
}

function clamp(n: number, max: number): number {
  return Math.max(0, Math.min(max, n))
}

/** 收集简历里的技能名：技能区块优先，为空时退回工作/项目的技术栈 */
export function collectResumeSkills(sections: AnySection[]): string[] {
  const byType: Record<string, AnySection> = {}
  for (const s of sections || []) {
    const t = sectionType(s)
    if (t) byType[t] = s
  }
  const out: string[] = []
  for (const cat of byType.skills?.content?.categories || []) {
    for (const s of cat?.skills || []) {
      const name = String(s).trim()
      if (name && !out.includes(name)) out.push(name)
    }
  }
  if (out.length) return out
  for (const key of ['work_experience', 'projects']) {
    for (const item of items(byType[key]?.content)) {
      for (const t of item?.technologies || []) {
        const name = String(t).trim()
        if (name && !out.includes(name)) out.push(name)
      }
    }
  }
  return out
}

export function computeResumeHealth(sections: AnySection[]): HealthReport {
  const byType: Record<string, AnySection> = {}
  for (const s of sections || []) {
    const t = sectionType(s)
    if (t) byType[t] = s
  }

  const personal = byType.personal_info?.content || {}
  const summary = byType.summary?.content || {}
  const skills = byType.skills?.content || {}
  const works = items(byType.work_experience?.content)
  const edus = items(byType.education?.content)
  const projects = items(byType.projects?.content)

  const allSkills = collectResumeSkills(sections)

  const expItems = [...works, ...projects]
  const detailed = expItems.filter(i => (i?.highlights || []).filter(Boolean).length >= 2).length
  const quantified = expItems.filter(i =>
    hasQuantified(`${i?.description || ''} ${(i?.highlights || []).join(' ')}`),
  ).length
  const totalText = expItems
    .map(i => `${i?.description || ''}${(i?.highlights || []).join('')}`)
    .join('').length + textLength(summary.text)

  // ── 完整度 40 ──
  const contactOk = (personal.fullName ? 4 : 0) +
    ((personal.email ? 3 : 0) + (personal.phone ? 3 : 0))
  const completeness: HealthItem[] = [
    {
      key: 'personal',
      label: '个人信息与联系方式',
      score: contactOk,
      max: 10,
      hint: contactOk === 10 ? '姓名、邮箱、手机号齐全' : '补上姓名和手机号，HR 才能联系到你',
    },
    {
      key: 'summary',
      label: '个人简介',
      score: textLength(summary.text) >= 30 ? 6 : textLength(summary.text) > 0 ? 3 : 0,
      max: 6,
      hint: textLength(summary.text) >= 30 ? '已有 30 字以上简介' : '用 2~3 句话写清方向、年限和最擅长的技术',
    },
    {
      key: 'work',
      label: '工作经历',
      score: works.filter(i => i?.company && i?.position).length > 0 ? 8 : 0,
      max: 8,
      hint: works.length ? '已填写工作经历' : '哪怕只有实习或项目经历，也建议单独成条',
    },
    {
      key: 'education',
      label: '教育背景',
      score: edus.filter(i => i?.institution).length > 0 ? 6 : 0,
      max: 6,
      hint: edus.length ? '已填写教育背景' : '补上学校、学历与专业',
    },
    {
      key: 'skills',
      label: '技能特长',
      score: allSkills.length > 0 ? 6 : 0,
      max: 6,
      hint: allSkills.length ? `已填 ${allSkills.length} 项技能` : '技能是匹配打分的核心，建议单独整理',
    },
    {
      key: 'projects',
      label: '项目经历',
      score: projects.filter(i => i?.name).length > 0 ? 4 : 0,
      max: 4,
      hint: projects.length ? '已填写项目经历' : '项目经历能明显提升可信度',
    },
  ]

  // ── 内容质量 30 ──
  const quality: HealthItem[] = [
    {
      key: 'highlights',
      label: '成果分点描述',
      score: expItems.length === 0 ? 0 : clamp(Math.round((detailed / expItems.length) * 10), 10),
      max: 10,
      hint: detailed ? `${detailed} 条经历拆出了成果要点` : '把大段描述拆成 2~4 条成果，读起来轻松很多',
    },
    {
      key: 'quantified',
      label: '量化数据',
      score: expItems.length === 0 ? 0 : clamp(Math.round((quantified / expItems.length) * 10), 10),
      max: 10,
      hint: quantified ? `${quantified} 条经历带数字` : '写清「提升多少、支撑多少用户、耗时缩短多少」更有说服力',
    },
    {
      key: 'skill-depth',
      label: '技能密度',
      score: clamp(Math.round((allSkills.length / 8) * 10), 10),
      max: 10,
      hint: allSkills.length >= 8 ? `共 ${allSkills.length} 项技能` : `目前 ${allSkills.length} 项技能，建议补到 8 项以上`,
    },
  ]

  // ── 篇幅规范 30 ──
  const contactHalf = (personal.email ? 5 : 0) + (personal.phone ? 5 : 0)
  const summaryLen = textLength(summary.text)
  const layout: HealthItem[] = [
    {
      key: 'contact-complete',
      label: '联系方式完整',
      score: contactHalf,
      max: 10,
      hint: contactHalf === 10 ? '邮箱与手机号都有' : '邮箱、手机号缺一项都会影响投递',
    },
    {
      key: 'summary-length',
      label: '简介篇幅',
      score: summaryLen >= 60 && summaryLen <= 300 ? 10 : summaryLen > 0 ? 5 : 0,
      max: 10,
      hint: summaryLen > 300 ? '简介偏长，建议压到 300 字内' : summaryLen < 60 ? '简介偏短，建议补充到 60 字以上' : '简介篇幅合适',
    },
    {
      key: 'volume',
      label: '内容体量',
      score: totalText >= 800 && totalText <= 4000 ? 10 : totalText >= 400 ? 6 : totalText > 0 ? 3 : 0,
      max: 10,
      hint: totalText > 4000 ? '内容偏多，一页装不下时 HR 容易跳过' : totalText < 800 ? '正文偏少，建议补充经历细节' : '内容体量适中',
    },
  ]

  const all = [...completeness, ...quality, ...layout]
  const total = Math.round(all.reduce((sum, i) => sum + i.score, 0))
  const level: HealthReport['level'] =
    total >= 85 ? 'excellent' : total >= 70 ? 'good' : total >= 50 ? 'fair' : 'poor'
  const levelText = { excellent: '优秀', good: '良好', fair: '一般', poor: '待完善' }[level]
  const issues = all.filter(i => i.score < i.max).sort((a, b) => (b.max - b.score) - (a.max - a.score))

  return { total, level, levelText, items: all, issues }
}
