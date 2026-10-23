import { useEffect, useState } from 'react'
import { kgApi } from '../../components/kg/api'

type EvidenceItem = { text: string; quote: string; snapshot_id: string; source_url: string }
type Fields = Record<string, EvidenceItem[]>
type Version = { version: number; state: string; created_at: string; review_note: string; fields: Fields }
type Source = { snapshot_id: string; title: string; source_url: string; job_description: string }
const labels: Record<string, string> = {
  name: '岗位名称', duties: '核心职责', required_skills: '必备技能',
  preferred_skills: '加分技能', applications: '典型行业应用场景',
}
const fieldNames = Object.keys(labels)

export default function AdminRoleDefinitions() {
  const [roles, setRoles] = useState<string[]>([])
  const [role, setRole] = useState('')
  const [fields, setFields] = useState<Fields | null>(null)
  const [history, setHistory] = useState<Version[]>([])
  const [sources, setSources] = useState<Source[]>([])
  const [note, setNote] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    kgApi.catalog().then((data: { roles: { name: string }[] }) => {
      const names = [...new Set(data.roles.map(r => r.name))].sort()
      setRoles(names); setRole(names[0] || '')
    }).catch(() => setMessage('岗位目录加载失败'))
  }, [])

  useEffect(() => {
    if (!role) return
    let active = true
    setFields(null); setMessage('')
    Promise.all([kgApi.roleDefinition(role, true), kgApi.roleDefinitionHistory(role), kgApi.roleDefinitionEvidence(role)])
      .then(([draft, versions, evidence]: [{ fields: Fields }, Version[], Source[]]) => {
        if (active) { setFields(draft.fields); setHistory(versions); setSources(evidence) }
      }).catch(() => { if (active) setMessage('岗位定义或审核记录加载失败') })
    return () => { active = false }
  }, [role])

  const update = (key: string, index: number, part: keyof EvidenceItem, value: string) => {
    setFields(prev => {
      if (!prev) return prev
      const next = { ...prev, [key]: prev[key].map((item, i) => i === index ? { ...item, [part]: value } : item) }
      return next
    })
  }
  const remove = (key: string, index: number) => setFields(prev => prev ?
    { ...prev, [key]: prev[key].filter((_, i) => i !== index) } : prev)
  const add = (key: string) => setFields(prev => {
    if (!prev) return prev
    const source = sources[0]
    return { ...prev, [key]: [...prev[key], { text: '', quote: '', snapshot_id: source?.snapshot_id || '', source_url: source?.source_url || '' }] }
  })
  const save = async (publish: boolean) => {
    if (!fields) return
    setSaving(true); setMessage('')
    try {
      const result = await kgApi.saveRoleDefinition(role, fields, publish, note)
      setMessage(`版本 ${result.version} 已${publish ? '审核发布' : '保存草稿'}`)
      setHistory(await kgApi.roleDefinitionHistory(role))
    } catch (error) { setMessage(`保存失败：${error instanceof Error ? error.message : '请核对五字段和原文引文'}`) }
    finally { setSaving(false) }
  }

  return <div className="p-5 md:p-8 space-y-5" style={{ color: 'var(--color-on-surface)' }}>
    <div><h1 className="text-2xl font-bold">岗位定义审核</h1>
      <p className="text-sm mt-2">逐字段核对招聘原句。发布要求五字段都有可回溯证据；编辑保留新版本，历史记录可回看。</p></div>
    <label className="block text-sm">岗位方向 <select value={role} onChange={e => setRole(e.target.value)} className="border rounded-lg p-2 ml-2" style={{ background: 'var(--color-surface)' }}>
      {roles.map(r => <option key={r} value={r}>{r}</option>)}
    </select></label>
    {message && <p role="status" className="text-sm">{message}</p>}
    {fields && <>
      {fieldNames.map(key => <section key={key} className="rounded-xl border p-4" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-outline-variant)' }}>
        <div className="flex justify-between"><h2 className="font-semibold">{labels[key]}</h2><button onClick={() => add(key)} className="text-sm underline">添加证据项</button></div>
        {!fields[key]?.length && <p className="text-sm mt-2">当前无可核验内容；可从同岗位原始招聘补充引文。</p>}
        {fields[key]?.map((item, index) => <div key={index} className="border-t mt-3 pt-3 grid gap-2">
          <label className="text-xs">定义内容 <textarea aria-label={`${labels[key]}内容${index + 1}`} value={item.text} onChange={e => update(key, index, 'text', e.target.value)} className="block w-full border rounded p-2 mt-1" style={{ background: 'var(--color-surface)' }} /></label>
          <label className="text-xs">招聘原句 <textarea aria-label={`${labels[key]}引文${index + 1}`} value={item.quote} onChange={e => update(key, index, 'quote', e.target.value)} className="block w-full border rounded p-2 mt-1" style={{ background: 'var(--color-surface)' }} /></label>
          <label className="text-xs">证据来源 <select value={item.snapshot_id} onChange={e => {
            const source = sources.find(s => s.snapshot_id === e.target.value)
            update(key, index, 'snapshot_id', e.target.value)
            if (source) update(key, index, 'source_url', source.source_url)
          }} className="block w-full border rounded p-2 mt-1" style={{ background: 'var(--color-surface)' }}>
            {sources.map(s => <option key={s.snapshot_id} value={s.snapshot_id}>{s.title} · {s.snapshot_id.slice(0, 22)}</option>)}
          </select></label>
          <details className="text-xs"><summary className="cursor-pointer">查看所选招聘原文</summary><p className="whitespace-pre-wrap mt-1 max-h-56 overflow-auto">{sources.find(s => s.snapshot_id === item.snapshot_id)?.job_description}</p></details>
          <p className="text-xs break-all">证据标识：{item.snapshot_id || '待填写'} {item.source_url && <a className="underline ml-2" href={item.source_url} target="_blank" rel="noreferrer">打开原招聘</a>}</p>
          <button onClick={() => remove(key, index)} className="text-xs underline justify-self-start">移除该项</button>
        </div>)}
      </section>)}
      <label className="block text-sm">审核说明 <textarea value={note} onChange={e => setNote(e.target.value)} className="block border rounded-lg p-2 w-full mt-1" style={{ background: 'var(--color-surface)' }} /></label>
      <div className="flex gap-3"><button disabled={saving} onClick={() => save(false)} className="border rounded-lg px-4 py-2">保存草稿</button>
        <button disabled={saving} onClick={() => save(true)} className="rounded-lg px-4 py-2 text-white" style={{ background: 'var(--accent-green)' }}>审核并发布</button></div>
    </>}
    <section><h2 className="font-semibold">历史版本</h2>
      {history.length === 0 && <p className="text-sm mt-2">暂无审核记录</p>}
      {history.map(v => <details key={v.version} className="border rounded-lg p-3 mt-2 text-sm">
        <summary className="cursor-pointer">第 {v.version} 版 · {v.state} · {v.created_at}</summary>
        <p className="mt-2">{v.review_note || '无审核说明'}</p>
        <pre className="text-xs whitespace-pre-wrap mt-2">{JSON.stringify(v.fields, null, 2)}</pre>
      </details>)}
    </section>
  </div>
}
