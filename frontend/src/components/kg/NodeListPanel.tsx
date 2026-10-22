import { useMemo, useState } from 'react'
import { Search, ChevronRight, BriefcaseBusiness, Layers } from 'lucide-react'

interface Node {
  id: string
  type: string
  label?: string
  name?: string
  source?: string
  city?: string
  company?: string
}
interface Props {
  nodes: Node[]
  selectedId?: string
  onSelect: (id: string) => void
  searchTerm?: string
}
const labels: Record<string, string> = { Nature: '工作性质', Recruitment: '企业招聘', Job: '岗位', Skill: '技能', Industry: '领域', Category: '技能分类', Company: '企业', Cluster: '岗位方向', Other: '其他' }
const colors: Record<string, string> = { Nature: '#2dd4bf', Recruitment: '#f472b6', Job: '#eab308', Skill: '#38bdf8', Industry: '#2dd4bf', Company: '#f472b6', Cluster: '#ff9f1c' }

export default function NodeListPanel({ nodes, selectedId, onSelect, searchTerm = '' }: Props) {
  const [query, setQuery] = useState(searchTerm)
  const [category, setCategory] = useState('all')
  const [limit, setLimit] = useState(50)
  const counts = useMemo(() => nodes.reduce<Record<string, number>>((acc, n) => {
    acc[n.type || 'Other'] = (acc[n.type || 'Other'] || 0) + 1
    return acc
  }, {}), [nodes])
  const filtered = useMemo(() => nodes.filter(n =>
    (category === 'all' || (n.type || 'Other') === category) &&
    [n.name, n.label, n.city, n.company, n.source].filter(Boolean).join(' ').toLowerCase().includes(query.trim().toLowerCase())
  ), [nodes, category, query])

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 space-y-3 border-b p-3" style={{ borderColor: 'var(--color-outline-variant)' }}>
        <div className="flex items-center justify-between text-xs font-semibold"><span>节点目录</span><span className="font-normal" style={{ color: 'var(--color-on-surface-variant)' }}>{nodes.length}</span></div>
        <label className="flex items-center gap-2 rounded-lg border px-2.5 py-2" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-background)' }}>
          <Search className="h-3.5 w-3.5 shrink-0" />
          <input aria-label="搜索节点" value={query} onChange={e => { setQuery(e.target.value); setLimit(50) }} placeholder="搜索岗位、技能…" className="w-full min-w-0 bg-transparent text-xs outline-none" />
        </label>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="节点类型">
          {['all', ...Object.keys(counts)].map(type => <button key={type} aria-pressed={category === type} onClick={() => { setCategory(type); setLimit(50) }} className="rounded-md px-2 py-1 text-[11px] transition-colors" style={{ background: category === type ? 'var(--color-primary-fixed)' : 'var(--color-surface-container)', color: category === type ? 'var(--color-primary)' : 'var(--color-on-surface-variant)' }}>{type === 'all' ? '全部' : labels[type] || '其他'} {type === 'all' ? nodes.length : counts[type]}</button>)}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {filtered.length === 0 && <div className="px-3 py-10 text-center text-xs leading-6" style={{ color: 'var(--color-on-surface-variant)' }}>暂无匹配节点<br />试试其他关键词或分类</div>}
        {filtered.slice(0, limit).map(n => {
          const active = selectedId === n.id
          const Icon = n.type === 'Job' ? BriefcaseBusiness : Layers
          return <button key={n.id} onClick={() => onSelect(n.id)} aria-pressed={active} className="mb-1 flex w-full items-center gap-2 rounded-xl border p-2.5 text-left transition-colors hover:bg-black/5" style={{ borderColor: active ? 'var(--color-primary)' : 'transparent', background: active ? 'var(--color-primary-fixed)' : undefined }}>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: 'var(--color-surface-container)' }}><Icon className="h-4 w-4" style={{ color: colors[n.type] || '#94a3b8' }} /></span>
            <span className="min-w-0 flex-1"><span className="block truncate text-xs font-medium" title={n.label || n.name}>{n.label || n.name || '未命名节点'}</span><span className="mt-1 block truncate text-[10px]" style={{ color: 'var(--color-on-surface-variant)' }}>{[labels[n.type] || '其他', n.city, n.company || n.source].filter(Boolean).join(' · ')}</span></span>
            {active && <ChevronRight className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--color-primary)' }} />}
          </button>
        })}
        {filtered.length > limit && <button onClick={() => setLimit(v => v + 50)} className="w-full rounded-lg py-3 text-xs hover:bg-black/5" style={{ color: 'var(--color-primary)' }}>加载更多 · 还有 {filtered.length - limit} 个</button>}
      </div>
      <p className="shrink-0 border-t px-3 py-3 text-[10px] leading-5" style={{ borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface-variant)' }}>点击节点，聚焦相关岗位与技能</p>
    </div>
  )
}
