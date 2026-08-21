import { Plus } from 'lucide-react'
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
}

/** 左侧模块导航:简历模块(已有) + 添加模块(未添加)
 *
 *  设计:
 *  - 简历模块:每项只显示 SECTION_LABELS[type] 名称(无图标,简洁)
 *  - 添加模块:每项显示 + 图标 + 对应 section 图标 + SECTION_LABELS[type] 名称
 *    只列出 ADD_MODULE_TYPES,不重复简历模块已经有的(避免冗余)
 */
export function EditorSidebar({
  resumeSections, callbacks,
}: {
  resumeSections: { id: string; type: string; title: string; sort_order: number; visible: number }[]
  callbacks: SidebarCallbacks
}) {
  // 按 sort_order 升序列出已有 section
  const sorted = [...resumeSections].sort((a, b) => a.sort_order - b.sort_order)

  return (
    <aside className="w-56 shrink-0 border-r overflow-y-auto" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface)' }}>
      <div className="p-3 space-y-5">
        {/* 简历模块 — 已有 section,按 sort_order 列出 */}
        <div>
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2 px-2">
            简历模块
          </h3>
          <div className="space-y-0.5">
            {sorted.map((s) => {
              const isSelected = callbacks.selectedSectionId === String(s.id)
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => callbacks.onSelectSection(String(s.id))}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors text-left ${
                    isSelected
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-zinc-700 hover:bg-zinc-50'
                  }`}
                >
                  <span className="truncate">{SECTION_LABELS[s.type] || s.title || s.type}</span>
                </button>
              )
            })}
            {sorted.length === 0 && (
              <div className="px-2 py-3 text-xs text-zinc-400">还没有任何模块</div>
            )}
          </div>
        </div>

        {/* 添加模块 — 只显示 ADD_MODULE_TYPES(资格证书/语言/GitHub/二维码/自定义)
            不重复简历模块默认类型(个人信息/简介/工作/教育/技能/项目) */}
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
