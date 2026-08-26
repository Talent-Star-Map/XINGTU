/**
 * NodeListPanel — 左栏节点列表
 * 按 type 分组,显示 Job / Skill 等节点,支持点击选中。
 */
import { useMemo } from 'react'

interface Node {
  id: string
  type: string
  label?: string  // 显示名
  name?: string
  source?: string
}

interface Props {
  nodes: Node[]
  selectedId?: string
  onSelect: (id: string) => void
  searchTerm?: string
}

export default function NodeListPanel({ nodes, selectedId, onSelect, searchTerm = '' }: Props) {
  const grouped = useMemo(() => {
    const m = new Map<string, Node[]>()
    nodes.forEach((n) => {
      const k = n.type || 'Other'
      if (!m.has(k)) m.set(k, [])
      m.get(k)!.push(n)
    })
    return m
  }, [nodes])

  const filterFn = (n: Node) =>
    !searchTerm || (n.label || n.name || n.id).toLowerCase().includes(searchTerm.toLowerCase())

  return (
    <div className="overflow-auto h-full">
      {[...grouped.entries()].map(([type, list]) => {
        const filtered = list.filter(filterFn)
        if (filtered.length === 0) return null
        return (
          <div key={type} className="border-b" style={{ borderColor: 'var(--color-outline-variant)' }}>
            <div className="px-3 py-1.5 text-xs font-semibold sticky top-0"
                 style={{ background: 'var(--color-surface)', color: 'var(--color-on-surface-variant)' }}>
              {type} ({filtered.length})
            </div>
            {filtered.slice(0, 50).map((n) => {
              const active = selectedId === n.id
              return (
                <button
                  key={n.id}
                  onClick={() => onSelect(n.id)}
                  className="w-full text-left px-3 py-1 text-xs truncate hover:bg-black/5"
                  style={{
                    background: active ? 'var(--color-primary-fixed)' : 'transparent',
                    color: active ? 'var(--color-primary)' : 'inherit',
                  }}
                  title={n.label || n.name || n.id}
                >
                  {n.label || n.name || n.id}
                </button>
              )
            })}
            {filtered.length > 50 && (
              <div className="px-3 py-1 text-[10px]"
                   style={{ color: 'var(--color-on-surface-variant)' }}>
                还有 {filtered.length - 50} 个...
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}