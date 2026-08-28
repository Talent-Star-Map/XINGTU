/**
 * 简历编辑器内部使用的 section 形状。
 *
 * 后端 /api/resumes 返回的字段是 snake_case，id 是数字、visible 是 0/1，
 * 而 types/resume.ts 里的 ResumeSection 是前端领域模型（camelCase、string id、boolean）。
 * 两者不是一回事，这里单独定义，避免编辑器代码按 snake_case 访问领域模型字段。
 */
export interface EditorSection {
  id: number | string
  /** 部分接口返回 type，部分返回 section_type，两者都可能存在 */
  type?: string
  section_type?: string
  title: string
  sort_order: number
  visible: number | boolean
  content: any
}

/** 后端返回的简历主体 */
export interface EditorResume {
  id: number | string
  title: string
  template_key: string
  language: string
  created_at: string
  sections: EditorSection[]
}
