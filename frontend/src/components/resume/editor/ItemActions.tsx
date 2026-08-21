import { Plus, ArrowUp, ArrowDown, X } from 'lucide-react'

/** 条目级别 +/↑/↓/× 操作按钮组
 *  - onAdd: 添加一条新条目
 *  - onUp/onDown: 该条目上移/下移一格
 *  - onDelete: 删除该条目
 *  - isFirst / isLast: 控制 ↑/↓ 是否禁用
 */
export function ItemActions({
  onAdd,
  onUp,
  onDown,
  onDelete,
  isFirst,
  isLast,
  showAdd = true,
}: {
  onAdd?: () => void
  onUp?: () => void
  onDown?: () => void
  onDelete?: () => void
  isFirst?: boolean
  isLast?: boolean
  showAdd?: boolean
}) {
  const baseBtn = 'h-7 w-7 inline-flex items-center justify-center rounded-md transition-colors text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed'

  return (
    <div className="flex items-center justify-end gap-0.5">
      {showAdd && onAdd && (
        <button type="button" onClick={onAdd} className={baseBtn} title="添加一条">
          <Plus className="h-3.5 w-3.5" />
        </button>
      )}
      {onUp && (
        <button type="button" onClick={onUp} disabled={isFirst} className={baseBtn} title="上移">
          <ArrowUp className="h-3.5 w-3.5" />
        </button>
      )}
      {onDown && (
        <button type="button" onClick={onDown} disabled={isLast} className={baseBtn} title="下移">
          <ArrowDown className="h-3.5 w-3.5" />
        </button>
      )}
      {onDelete && (
        <button type="button" onClick={onDelete} className={baseBtn} title="删除">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}

/** 6 点拖拽图标占位(本期不实现拖拽,仅视觉占位 — 实际用 ↑↓ 按钮) */
export function DragHandle() {
  return (
    <div className="flex flex-col gap-0.5 text-zinc-300 select-none" title="拖拽(本期用 ↑↓ 按钮)">
      <div className="flex gap-0.5">
        <span className="h-0.5 w-0.5 rounded-full bg-current" />
        <span className="h-0.5 w-0.5 rounded-full bg-current" />
        <span className="h-0.5 w-0.5 rounded-full bg-current" />
        <span className="h-0.5 w-0.5 rounded-full bg-current" />
        <span className="h-0.5 w-0.5 rounded-full bg-current" />
        <span className="h-0.5 w-0.5 rounded-full bg-current" />
      </div>
      <div className="flex gap-0.5">
        <span className="h-0.5 w-0.5 rounded-full bg-current" />
        <span className="h-0.5 w-0.5 rounded-full bg-current" />
        <span className="h-0.5 w-0.5 rounded-full bg-current" />
        <span className="h-0.5 w-0.5 rounded-full bg-current" />
        <span className="h-0.5 w-0.5 rounded-full bg-current" />
        <span className="h-0.5 w-0.5 rounded-full bg-current" />
      </div>
      <div className="flex gap-0.5">
        <span className="h-0.5 w-0.5 rounded-full bg-current" />
        <span className="h-0.5 w-0.5 rounded-full bg-current" />
        <span className="h-0.5 w-0.5 rounded-full bg-current" />
        <span className="h-0.5 w-0.5 rounded-full bg-current" />
        <span className="h-0.5 w-0.5 rounded-full bg-current" />
        <span className="h-0.5 w-0.5 rounded-full bg-current" />
      </div>
    </div>
  )
}