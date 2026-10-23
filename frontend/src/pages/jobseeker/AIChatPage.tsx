import { useEffect, useState } from 'react'
import { ArrowLeft, BrainCircuit, X } from 'lucide-react'
import KGChat from '../../components/kg/KGChat'
import SemanticSearchBox from '../../components/kg/SemanticSearchBox'
import { kgApi } from '../../components/kg/api'
import { JSNav } from '../../lib/NavContext'

export default function AIChatPage() {
  const { setPage, page, params, updateParams } = JSNav.use()
  const jobId = params.selectedJobId
  const [jobTitle, setJobTitle] = useState('')
  const [jobError, setJobError] = useState(false)

  useEffect(() => {
    let active = true
    setJobTitle('')
    setJobError(false)
    if (jobId) {
      kgApi.jobDetail(jobId).then(job => {
        if (active) setJobTitle(job?.title || '')
      }).catch(() => { if (active) setJobError(true) })
    }
    return () => { active = false }
  }, [jobId])

  const selectJob = (id: number) => {
    updateParams({ selectedJobId: id, selectedNodeId: `job:${id}` })
  }

  return (
    <div className="flex h-full min-h-0 flex-col" style={{ background: 'var(--color-background)' }}>
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b px-5 py-4"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-outline-variant)' }}>
        <div className="flex items-center gap-3">
          <BrainCircuit className="h-6 w-6" style={{ color: 'var(--color-primary)' }} />
          <div>
            <h1 className="text-lg font-semibold">智能问答</h1>
            <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>探索岗位、分析能力差距、了解岗位变化</p>
          </div>
        </div>
        <button onClick={() => setPage('skill-graph')}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
          style={{ background: 'var(--color-surface-container)', color: 'var(--color-on-surface)' }}>
          <ArrowLeft className="h-4 w-4" /> 返回岗位图谱
        </button>
      </header>

      <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col gap-4 p-3 sm:p-5">
        <section className="flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3"
          aria-label="当前岗位上下文"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-outline-variant)' }}>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">{jobId ? (jobTitle || `已关联岗位 #${jobId}`) : '通用岗位问答'}</div>
            <p className="mt-1 text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
              {jobError ? '岗位详情暂未读取成功，可更换岗位后重试。' : jobId ? '围绕此岗位分析要求、技能差距与已记录变化；切换岗位会开启新对话。' : '可直接提问，也可选择岗位，获得更明确的技能与求职建议。'}
            </p>
          </div>
          <SemanticSearchBox onPick={selectJob} label={jobId ? '更换岗位' : '选择岗位'} enabled={page === 'ai-chat'} />
          {jobId && (
            <button onClick={() => updateParams({ selectedJobId: undefined, selectedNodeId: undefined })}
              className="rounded-lg p-2" aria-label="清除当前岗位"
              style={{ color: 'var(--color-on-surface-variant)' }}>
              <X className="h-4 w-4" />
            </button>
          )}
        </section>

        <div className="min-h-0 flex-1 overflow-hidden rounded-xl border"
          style={{ borderColor: 'var(--color-outline-variant)' }}>
          <KGChat active={page === 'ai-chat'} selectedJobId={jobId} onJobPick={id => {
            setPage('skill-graph', { selectedJobId: id, selectedNodeId: `job:${id}` })
          }} />
        </div>
      </div>
    </div>
  )
}
