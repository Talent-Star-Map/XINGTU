import { Component, memo, useMemo, type ReactNode } from 'react'
import type { Resume } from '../../types/resume'
import * as Templates from './preview/templates'

interface ResumePreviewProps {
  /** 后端返回的简历数据（含 sections 数组）或已适配好的 Resume */
  resume: any
  scale?: number
  className?: string
}

/** 错误边界：模板渲染异常时不白屏，显示降级提示 */
class PreviewErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: string }> {
  state = { hasError: false, error: '' }
  static getDerivedStateFromError(e: any) {
    return { hasError: true, error: String(e?.message || e) }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 text-center text-sm text-red-500">
          简历预览渲染失败：{this.state.error}
        </div>
      )
    }
    return this.props.children
  }
}

/** 把后端 resume 数据适配成模板需要的 Resume 结构 */
export function adaptResume(data: any): Resume {
  return {
    id: String(data.id ?? ''),
    userId: String(data.user_id ?? ''),
    title: data.title || '未命名简历',
    template: data.template_key || 'classic',
    themeConfig: {
      primaryColor: '#111827',
      accentColor: '#3b82f6',
      fontFamily: 'Inter, sans-serif',
      fontSize: '13px',
      lineSpacing: 1.4,
      margin: { top: 24, right: 24, bottom: 24, left: 24 },
      sectionSpacing: 16,
    },
    isDefault: false,
    language: data.language || 'zh',
    sections: (data.sections || []).map((s: any) => ({
      id: String(s.id ?? ''),
      type: s.section_type,
      title: s.title,
      visible: s.visible !== 0,
      content: s.content || {},
    })),
    createdAt: data.created_at ? new Date(data.created_at) : new Date(),
    updatedAt: data.created_at ? new Date(data.created_at) : new Date(),
  }
}

/** 浅比较 — 用于 memo 自定义比较 */
function shallowEqualContent(a: any, b: any): boolean {
  if (a === b) return true
  if (typeof a !== typeof b) return false
  if (a == null || b == null) return a === b
  if (typeof a !== 'object') return a === b
  const ak = Object.keys(a)
  const bk = Object.keys(b)
  if (ak.length !== bk.length) return false
  for (const k of ak) {
    if (a[k] !== b[k]) return false
  }
  return true
}

function sectionsEqual(a: any[], b: any[]): boolean {
  if (a === b) return true
  if (!a || !b || a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    const sa = a[i], sb = b[i]
    if (sa === sb) continue
    if (sa.id !== sb.id || sa.type !== sb.type || sa.title !== sb.title
        || sa.visible !== sb.visible || sa.sort_order !== sb.sort_order) return false
    if (!shallowEqualContent(sa.content, sb.content)) return false
  }
  return true
}

/**
 * 简历预览渲染器 — 按 resume.template 选模板渲染
 * 50 套模板共用(每套模板只负责布局,区块内容由模板内部 SectionContent 渲染)
 *
 * 优化:
 * - React.memo + 自定义 sectionsEqual:内容不变不重渲染模板
 *   (避免每按键都重画 50 套模板的 React 树)
 * - useMemo 缓存 TemplateComp 查找和 adapted 对象
 */
function ResumePreviewImpl({ resume, scale = 1, className = '' }: ResumePreviewProps) {
  // 模板查找用 useMemo(只跟 template_key 挂钩)
  const TemplateComp = useMemo(() => {
    const keyMap: Record<string, string> = { 'two-column': 'twoColumn' }
    const lookupKey = keyMap[resume?.template_key] || resume?.template_key || 'classic'
    return (Templates as Record<string, any>)[lookupKey] || Templates.classic
  }, [resume?.template_key])

  const language = resume?.language || 'zh'

  // sections 适配 — useMemo 缓存,避免每次 render 都新建对象
  const adaptedSections = useMemo(() =>
    (resume?.sections || []).map((s: any) => ({
      id: String(s.id ?? ''),
      type: s.section_type,
      title: s.title,
      visible: s.visible !== 0,
      content: s.content || {},
    })), [resume?.sections])

  const adapted: Resume = useMemo(() => ({
    id: String(resume?.id ?? ''),
    userId: String(resume?.user_id ?? ''),
    title: resume?.title || '未命名简历',
    template: resume?.template_key || 'classic',
    themeConfig: {
      primaryColor: '#111827', accentColor: '#3b82f6',
      fontFamily: 'Inter, sans-serif', fontSize: '13px', lineSpacing: 1.4,
      margin: { top: 24, right: 24, bottom: 24, left: 24 }, sectionSpacing: 16,
    },
    isDefault: false,
    language,
    sections: adaptedSections,
    createdAt: new Date(),
    updatedAt: new Date(),
  }), [resume?.id, resume?.user_id, resume?.title, resume?.template_key, language, adaptedSections])

  return (
    <PreviewErrorBoundary>
      <div
        className={`mx-auto bg-white shadow-lg ${className}`}
        style={{
          width: '210mm',
          minHeight: '297mm',
          transform: `scale(${scale})`,
          transformOrigin: 'top center',
        }}
      >
        <TemplateComp resume={adapted} />
      </div>
    </PreviewErrorBoundary>
  )
}

// React.memo + 自定义浅比较:只在 resume 内容真正变化时重渲染模板
export const ResumePreview = memo(ResumePreviewImpl, (prev, next) => {
  return (
    prev.scale === next.scale &&
    prev.className === next.className &&
    prev.resume?.id === next.resume?.id &&
    prev.resume?.title === next.resume?.title &&
    prev.resume?.template_key === next.resume?.template_key &&
    prev.resume?.language === next.resume?.language &&
    sectionsEqual(prev.resume?.sections || [], next.resume?.sections || [])
  )
})