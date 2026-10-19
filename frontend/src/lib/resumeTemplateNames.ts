/** 简历模板中文名
 *
 * 数据库 `resume_templates.name` 里存的是英文 key（academic / modern …），
 * 直接展示在界面上很突兀，这里做一层显示名映射。
 * 模板本身在 `components/resume/preview/templates/`，新增模板时记得补这里。
 */
const TEMPLATE_NAMES: Record<string, string> = {
  academic: '学术风',
  architect: '建筑感',
  artistic: '艺术风',
  ats: 'ATS 友好',
  berlin: '柏林',
  blocks: '积木块',
  bold: '醒目',
  card: '卡片式',
  classic: '经典',
  clean: '清爽',
  coder: '程序员',
  compact: '紧凑',
  consultant: '咨询顾问',
  corporate: '商务',
  creative: '创意',
  designer: '设计师',
  developer: '开发工程师',
  elegant: '优雅',
  engineer: '工程师',
  euro: '欧式',
  executive: '高管',
  finance: '金融',
  formal: '正式',
  gradient: '渐变',
  infographic: '信息图',
  japanese: '日式',
  legal: '法律',
  luxe: '轻奢',
  magazine: '杂志',
  material: '材质',
  medical: '医疗',
  metro: '都市',
  minimal: '极简',
  modern: '现代',
  mosaic: '马赛克',
  neon: '霓虹',
  nordic: '北欧',
  professional: '专业',
  retro: '复古',
  ribbon: '缎带',
  rose: '玫瑰',
  scientist: '科研',
  sidebar: '侧栏',
  startup: '创业',
  swiss: '瑞士',
  teacher: '教师',
  timeline: '时间轴',
  'two-column': '双栏',
  watercolor: '水彩',
  zigzag: '折线',
}

/** key → 中文名；未收录的 key 原样返回，避免界面出现空白 */
export function templateName(key?: string): string {
  if (!key) return '经典'
  return TEMPLATE_NAMES[key] || key
}
