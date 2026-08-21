import { memo, useEffect, useRef, useState, type ReactNode } from 'react'
import { Sparkles, Eye, X as XIcon, Loader2 } from 'lucide-react'
import { DragHandle } from './ItemActions'
import { SECTION_ICONS } from './icons'

interface Props {
  sectionType: string
  title: string
  isSelected: boolean
  onSelect: () => void  // 滚动到此卡片 + 高亮
  onRenameTitle?: (title: string) => void
  onDelete: () => void
  onAIOptimize?: () => Promise<void>  // undefined 表示该类型不支持 AI 优化
  optimizing?: boolean
  children: ReactNode  // 由 EditorCanvas 注入对应 Form
  showDragHandle?: boolean
}

/** 通用 section 卡片 — 标题/拖拽柄/AI 优化/预览/删除
 *  - 选中态用 CSS ring 实现(不引入 framer-motion,降低 GPU 占用)
 *  - 整个组件用 React.memo 包裹,只在 props 真正变化时重渲染
 */
function SectionCardImpl({
  sectionType, title, isSelected, onSelect, onRenameTitle, onDelete,
  onAIOptimize, optimizing, children, showDragHandle = true,
}: Props) {
  const Icon = SECTION_ICONS[sectionType]
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(title)
  const inputRef = useRef<HTMLInputElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  // 选中时滚动 + 高亮
  useEffect(() => {
    if (isSelected && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [isSelected])

  useEffect(() => {
    if (isRenaming) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [isRenaming])

  const commitRename = () => {
    const trimmed = renameValue.trim()
    if (trimmed && trimmed !== title && onRenameTitle) {
      onRenameTitle(trimmed)
    } else {
      setRenameValue(title)
    }
    setIsRenaming(false)
  }

  return (
    <div
      ref={cardRef}
      className={`rounded-xl border bg-white transition-shadow duration-150 ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
      style={{ borderColor: 'var(--color-outline-variant)' }}
      onClick={onSelect}
    >
      {/* 卡片头部:拖拽柄 + 标题 + 操作按钮 */}
      <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: 'var(--color-outline-variant)' }}>
        {showDragHandle && <DragHandle />}
        {Icon && <Icon className="h-4 w-4 text-zinc-500 shrink-0" />}
        {isRenaming ? (
          <input
            ref={inputRef}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename()
              if (e.key === 'Escape') { setRenameValue(title); setIsRenaming(false) }
            }}
            className="flex-1 text-sm font-medium bg-transparent outline-none border-b border-blue-400"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className="flex-1 text-sm font-medium text-zinc-800 cursor-pointer"
            onDoubleClick={(e) => {
              e.stopPropagation()
              if (onRenameTitle) setIsRenaming(true)
            }}
            title={onRenameTitle ? '双击改名' : ''}
          >
            {title}
          </span>
        )}
        <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
          {onAIOptimize && (
            <button
              type="button"
              onClick={onAIOptimize}
              disabled={optimizing}
              className="h-7 w-7 inline-flex items-center justify-center rounded-md text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"
              title="AI 优化"
            >
              {optimizing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            </button>
          )}
          <button
            type="button"
            className="h-7 w-7 inline-flex items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100"
            title="预览(在右栏)"
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="h-7 w-7 inline-flex items-center justify-center rounded-md text-zinc-500 hover:bg-red-50 hover:text-red-500"
            title="删除该模块"
          >
            <XIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* 卡片内容:由调用方注入对应 Form */}
      <div className="p-5">
        {children}
      </div>
    </div>
  )
}

// 用 React.memo 包裹,只在 props 实际变化时重渲染
// children 用 ReactNode,父组件通常传不同引用,这里用比较函数:title/isSelected 变化才更新
export const SectionCard = memo(SectionCardImpl, (prev, next) => {
  // 只要这几项不变就不重渲染(children 由父组件控制,这里不参与比较)
  return (
    prev.title === next.title &&
    prev.isSelected === next.isSelected &&
    prev.optimizing === next.optimizing &&
    prev.sectionType === next.sectionType &&
    prev.onSelect === next.onSelect &&
    prev.onRenameTitle === next.onRenameTitle &&
    prev.onDelete === next.onDelete &&
    prev.onAIOptimize === next.onAIOptimize &&
    prev.children === next.children  // 表单内容变更时父组件会传新引用,自然触发重渲染
  )
})