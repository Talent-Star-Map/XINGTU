import {
  User, FileText, Briefcase, GraduationCap, Wrench, FolderKanban,
  Award, Languages, GitFork, QrCode, LayoutList,
} from 'lucide-react'

/** 11 种 section type 对应的图标(对齐 JadeAI sidebar) */
export const SECTION_ICONS: Record<string, typeof User> = {
  personal_info: User,
  summary: FileText,
  work_experience: Briefcase,
  education: GraduationCap,
  skills: Wrench,
  projects: FolderKanban,
  certifications: Award,
  languages: Languages,
  github: GitFork,
  qr_codes: QrCode,
  custom: LayoutList,
}

/** 11 种 section type 的中文标签(对齐截图) */
export const SECTION_LABELS: Record<string, string> = {
  personal_info: '个人信息',
  summary: '个人简介',
  work_experience: '工作经历',
  education: '教育背景',
  skills: '技能特长',
  projects: '项目经历',
  certifications: '资格证书',
  languages: '语言能力',
  github: 'GitHub 项目',
  qr_codes: '二维码',
  custom: '自定义模块',
}

/** 默认新建某个 section 时的初始内容 */
export const DEFAULT_SECTION_CONTENT: Record<string, any> = {
  personal_info: {
    fullName: '', jobTitle: '', age: '', gender: '', politicalStatus: '',
    ethnicity: '', hometown: '', maritalStatus: '', yearsOfExperience: '',
    educationLevel: '', email: '', phone: '', wechat: '', location: '',
    website: '', linkedin: '', github: '',
  },
  summary: { text: '' },
  work_experience: { items: [] },
  education: { items: [] },
  skills: { categories: [] },
  projects: { items: [] },
  certifications: { items: [] },
  languages: { items: [] },
  github: { items: [] },
  qr_codes: { items: [] },
  custom: { items: [] },
}

/** 哪些 section 是"简历默认模块",哪些是"添加模块"分组 */
export const RESUME_MODULE_TYPES = ['personal_info', 'summary', 'work_experience', 'education', 'skills', 'projects'] as const
export const ADD_MODULE_TYPES = ['certifications', 'languages', 'github', 'qr_codes', 'custom'] as const