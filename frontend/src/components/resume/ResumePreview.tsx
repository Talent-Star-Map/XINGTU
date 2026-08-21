import { Component, type ReactNode } from 'react'
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

/**
 * 简历预览渲染器 — 按 resume.template 选模板渲染
 * 50 套模板共用（每套模板只负责布局，区块内容由模板内部 SectionContent 渲染）
 *
 * 外层统一加 A4 尺寸（210mm × 297mm），让简历看起来像真正的纸张：
 * - 宽度 210mm（max-w-[210mm] 由各模板自己保证）
 * - 高度至少 297mm（min-h-[297mm]），即使内容不足也保持 A4 比例
 * - 内容超出 297mm 时允许继续增高（由父容器 overflow-auto 提供滚动）
 */
export function ResumePreview({ resume, scale = 1, className = '' }: ResumePreviewProps) {
  const adapted = adaptResume(resume)
  // 模板 key 到导出名的映射（连字符 key 在 index.ts 里用驼峰导出）
  const keyMap: Record<string, string> = { 'two-column': 'twoColumn' }
  const lookupKey = keyMap[adapted.template] || adapted.template
  const TemplateComp = (Templates as Record<string, any>)[lookupKey]
    || Templates.classic

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
