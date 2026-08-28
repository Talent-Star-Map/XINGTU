import { useState } from 'react'
import { Plus, GripVertical } from 'lucide-react'
import type { EditorSection } from './types'
import { SECTION_ICONS, SECTION_LABELS, RESUME_MODULE_TYPES, ADD_MODULE_TYPES } from './icons'

export interface SidebarCallbacks {
  // 点击左侧"已有模块" → 中间栏滚动 + 高亮
  onSelectSection: (sectionId: string) => void
  // 点击左侧"添加模块" → 新建空 section
  onAddSection: (sectionType: string) => void
  // 当前选中的 section id
  selectedSectionId: string | null
  // 已有的 section type 列表(用于"添加模块"过滤)
  existingSectionTypes: Set<string>
  // 拖拽重排序:把 fromId 移动到目标索引位置
  onReorderSection: (fromId: string, toIndex: number) => void
}

/** 取 section 类型 — 兼容 camelCase(type)和 snake_case(section_type) */
function sectionTypeOf(s: any): string {
  return s?.type || s?.section_type || ''
}

/** 左侧模块导航:简历模块(已有,可拖拽排序) + 添加模块(未添加)
 *
 *  - 简历模块:HTML5 native drag-and-drop,支持鼠标拖动重排序
 *  - 添加模块:每项显示 + 图标 + 对应 section 图标 + SECTION_LABELS[type] 名称
 */
export function EditorSidebar({
  resumeSections, callbacks,
}: {
  resumeSections: EditorSection[]
  callbacks: SidebarCallbacks
}) {
  // 按 sort_order 升序列出已有 section
  const sorted = [...resumeSections].sort((a, b) => a.sort_order - b.sort_order)

  // 拖拽状态
  const [draggingId, setDraggingId] = useState<string | null>(null)
  // drop 指示线位置:'-1' 表示目标位置在该 section 之前;'1' 表示之后;null 表示无指示
  const [dropMarker, setDropMarker] = useState<{ id: string; position: -1 | 1 } | null>(null)

  const onDragStart = (e: React.DragEvent, id: string) => {
    setDraggingId(id)
    e.dataTransfer.effectAllowed = 'move'
    // 必须 setData 才能在某些浏览器(FF)触发 dragover/drop
    e.dataTransfer.setData('text/plain', id)
  }

  const onDragOver = (e: React.DragEvent, id: string) => {
    if (!draggingId || draggingId === id) return
    e.preventDefault()  // 允许 drop
    e.dataTransfer.dropEffect = 'move'
    // 根据鼠标 Y 在目标元素中的位置判断插入到上方还是下方
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const mid = rect.top + rect.height / 2
    const pos: -1 | 1 = e.clientY < mid ? -1 : 1
    setDropMarker((prev) => (prev?.id === id && prev.position === pos ? prev : { id, position: pos }))
  }

  const onDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    if (!draggingId || !dropMarker) return
    const fromIdx = sorted.findIndex(s => String(s.id) === draggingId)
    const targetIdx = sorted.findIndex(s => String(s.id) === targetId)
    if (fromIdx < 0 || targetIdx < 0) return
    // 计算拖动到目标元素的上方还是下方
    // 若 drop 在目标前:toIndex = targetIdx;若在目标后:toIndex = targetIdx + 1
    // 移除自身后索引会变,所以 fromIdx < targetIdx 时需要 -1
    let toIndex = dropMarker.position === -1 ? targetIdx : targetIdx + 1
    if (fromIdx < toIndex) toIndex -= 1
    callbacks.onReorderSection(draggingId, toIndex)
    setDraggingId(null)
    setDropMarker(null)
  }

  const onDragEnd = () => {
    setDraggingId(null)
    setDropMarker(null)
  }

  return (
    <aside className="w-56 shrink-0 border-r overflow-y-auto" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface)' }}>
      <div className="p-3 space-y-5">
        {/* 简历模块 — 已有 section,支持拖拽排序 */}
        <div>
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2 px-2">
            简历模块
          </h3>
          <div className="space-y-0.5">
            {sorted.map((s) => {
              const secType = sectionTypeOf(s)
              const isSelected = callbacks.selectedSectionId === String(s.id)
              const isDragging = draggingId === String(s.id)
              const showMarkerAbove = dropMarker?.id === String(s.id) && dropMarker.position === -1
              const showMarkerBelow = dropMarker?.id === String(s.id) && dropMarker.position === 1
              return (
                <div key={s.id} className="relative">
                  {/* 上方插入指示线 */}
                  {showMarkerAbove && (
                    <div className="absolute left-0 right-0 -top-0.5 h-0.5 bg-blue-500 rounded-full z-10" />
                  )}
                  <div
                    draggable
                    onDragStart={(e) => onDragStart(e, String(s.id))}
                    onDragOver={(e) => onDragOver(e, String(s.id))}
                    onDrop={(e) => onDrop(e, String(s.id))}
                    onDragEnd={onDragEnd}
                    onClick={() => callbacks.onSelectSection(String(s.id))}
                    className={`group w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-sm transition-colors text-left cursor-grab active:cursor-grabbing select-none ${
                      isDragging
                        ? 'opacity-40'
                        : isSelected
                        ? 'bg-blue-50 text-blue-700 font-medium'
                        : 'text-zinc-700 hover:bg-zinc-50'
                    }`}
                  >
                    {/* 拖拽手柄 */}
                    <GripVertical className="h-3.5 w-3.5 text-zinc-300 group-hover:text-zinc-500 shrink-0" />
                    <span className="truncate">{SECTION_LABELS[secType] || s.title || secType || '(未知)'}</span>
                  </div>
                  {/* 下方插入指示线 */}
                  {showMarkerBelow && (
                    <div className="absolute left-0 right-0 -bottom-0.5 h-0.5 bg-blue-500 rounded-full z-10" />
                  )}
                </div>
              )
            })}
            {sorted.length === 0 && (
              <div className="px-2 py-3 text-xs text-zinc-400">还没有任何模块</div>
            )}
          </div>
        </div>

        {/* 添加模块 — 只显示 ADD_MODULE_TYPES(资格证书/语言/GitHub/二维码/自定义)
            不重复简历模块默认类型(个人信息/简介/教育/技能/项目) */}
        <div>
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2 px-2">
            添加模块
          </h3>
          <div className="space-y-0.5">
            {ADD_MODULE_TYPES.map((type) => {
              const Icon = SECTION_ICONS[type] || Plus
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => callbacks.onAddSection(type)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-zinc-600 hover:bg-zinc-50 transition-colors text-left"
                >
                  <Plus className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{SECTION_LABELS[type]}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </aside>
  )
}

/** 导出给 EditorCanvas / SectionCard 用的辅助:RESUME_MODULE_TYPES 是哪些"简历默认模块"类型 */
export { RESUME_MODULE_TYPES, ADD_MODULE_TYPES }
