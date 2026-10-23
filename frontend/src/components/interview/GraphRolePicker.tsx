import { useEffect, useState } from 'react'
import { ChevronRight, Loader2, RotateCcw, Network } from 'lucide-react'
type Node = { id: string; name: string; type: string; member_count?: number }
export default function GraphRolePicker({ value, onChange }: { value: string; onChange: (role: string) => void }) {
  const [nature, setNature] = useState('')
  const [nodes, setNodes] = useState<Node[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [query, setQuery] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError(''); setNodes([])
    const params = new URLSearchParams({ stage: nature ? 'roles' : 'nature', nature })
    fetch(`/api/kg/explorer/employment?${params}`, { signal: controller.signal,
      headers: { Authorization: `Bearer ${localStorage.getItem('xingtu_token') || ''}` } })
      .then(async r => { const result = await r.json(); if (!r.ok || !result.success) throw new Error(typeof result.detail === 'string' ? result.detail : result.message || '岗位目录加载失败'); return result.data })
      .then(data => { if (controller.signal.aborted) return; if (!data.ready) throw new Error(data.message || '岗位图谱尚未就绪'); setNodes(data.nodes || []) })
      .catch(reason => { if (!controller.signal.aborted) setError(reason.message || '岗位目录加载失败') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [nature, revision])
  const options = nodes.filter(node => node.type === (nature ? 'Cluster' : 'Nature') && node.name.toLowerCase().includes(query.toLowerCase()))
  return <section className="space-y-3" aria-label="图谱分级岗位选择">
    <div className="flex flex-wrap items-center gap-2 text-xs"><Network className="h-4 w-4 text-blue-500" /><button onClick={() => { setNature(''); setQuery('') }} className="font-semibold text-blue-500">岗位全景</button><ChevronRight className="h-3 w-3" /><span>{nature || '选择工作性质'}</span>{nature && <><ChevronRight className="h-3 w-3" /><span className="opacity-60">选择岗位方向</span></>}</div>
    <input aria-label="筛选图谱岗位" value={query} onChange={e => setQuery(e.target.value)} placeholder={nature ? '筛选该工作性质下的岗位方向' : '筛选工作性质'} className="w-full rounded-xl border bg-transparent px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-blue-300" style={{ borderColor: 'var(--color-outline-variant)' }} />
    {loading ? <p className="flex items-center gap-2 py-4 text-xs opacity-60"><Loader2 className="h-4 w-4 animate-spin" />正在读取岗位图谱目录…</p> : error ? <div role="alert" className="flex items-center justify-between gap-3 text-xs text-amber-700"><span>{error}</span><button onClick={() => setRevision(v => v+1)} className="flex shrink-0 items-center gap-1"><RotateCcw className="h-3 w-3" />重试</button></div> : <div className="grid max-h-64 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">{options.map(node => <button key={node.id} onClick={() => { if (nature) onChange(node.name); else { setNature(node.name); setQuery('') } }} aria-pressed={nature ? value === node.name : undefined} className="flex items-center justify-between gap-2 rounded-xl border p-3 text-left text-xs" style={{ borderColor: nature && value === node.name ? 'var(--color-primary)' : 'var(--color-outline-variant)', background: nature && value === node.name ? 'var(--color-primary-fixed)' : undefined }}><span className="font-medium">{node.name}</span><span className="flex shrink-0 items-center gap-1 text-[10px] opacity-50">{node.member_count || 0} 条招聘<ChevronRight className="h-3 w-3" /></span></button>)}{!options.length && <p className="py-3 text-xs opacity-50">暂无匹配目录，可更换工作性质或在下方填写目标岗位。</p>}</div>}
    <p className="text-[10px] opacity-50">与岗位图谱共用工作性质、岗位方向和招聘统计。</p>
  </section>
}
