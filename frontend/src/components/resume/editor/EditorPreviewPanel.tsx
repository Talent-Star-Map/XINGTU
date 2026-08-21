import { useDeferredValue } from 'react'
import { ZoomIn, ZoomOut, Search } from 'lucide-react'
import { ResumePreview } from '../ResumePreview'

interface Props {
  resume: any  // 后端 ResumeItem 结构
  zoom: number
  onZoomChange: (z: number) => void
  templates: { id: number; name: string; template_key: string; category: string; thumbnail: string }[]
  onTemplateChange: (key: string) => void
}

/** 右侧预览面板 — 顶部模板切换 + zoom 控件 + ResumePreview
 *
 *  使用 React 18+ useDeferredValue:表单快速输入时,简历渲染降级为低优先级,
 *  让输入框保持流畅;React 自动批处理预览更新,避免每键重渲染 50 套模板
 */
export function EditorPreviewPanel({ resume, zoom, onZoomChange, templates, onTemplateChange }: Props) {
  // 降级预览用的 resume — React 在主线程空闲时才更新预览
  const deferredResume = useDeferredValue(resume)

  const decrease = () => onZoomChange(Math.max(0.4, +(zoom - 0.1).toFixed(2)))
  const increase = () => onZoomChange(Math.min(1.5, +(zoom + 0.1).toFixed(2)))

  return (
    <aside className="w-1/2 shrink-0 border-l overflow-hidden flex flex-col" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface)' }}>
      {/* 顶部控件栏 */}
      <div className="shrink-0 flex items-center justify-between px-4 h-10 border-b gap-3" style={{ borderColor: 'var(--color-outline-variant)' }}>
        <span className="text-sm font-medium text-zinc-700 shrink-0">预览</span>
        <select
          value={resume.template_key}
          onChange={(e) => onTemplateChange(e.target.value)}
          className="h-7 px-2 rounded text-xs border outline-none max-w-[160px]"
          style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface)' }}
          title="切换模板"
        >
          {templates.map(t => <option key={t.id} value={t.template_key}>{t.name}</option>)}
        </select>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={decrease} className="h-7 w-7 inline-flex items-center justify-center rounded text-zinc-500 hover:bg-zinc-100" title="缩小">
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <span className="text-xs text-zinc-500 tabular-nums w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={increase} className="h-7 w-7 inline-flex items-center justify-center rounded text-zinc-500 hover:bg-zinc-100" title="放大">
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <button className="h-7 w-7 inline-flex items-center justify-center rounded text-zinc-500 hover:bg-zinc-100 ml-1" title="搜索(占位)">
            <Search className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* 预览画布 */}
      <div className="flex-1 overflow-auto p-6" style={{ background: '#f5f5f4' }}>
        <div className="flex justify-center">
          <ResumePreview resume={deferredResume} scale={zoom} />
        </div>
      </div>
    </aside>
  )
}