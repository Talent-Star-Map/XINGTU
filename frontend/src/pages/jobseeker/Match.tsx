import { CheckCircle, XCircle, Lightbulb, ArrowRight } from 'lucide-react'

export default function Match() {
  const score = 72
  const dims = { skill: 65, experience: 80, education: 70, salary: 75 }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <h1 className="text-xl font-bold">人岗匹配</h1>
      <div className="rounded-xl border p-6" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
        <div className="flex items-start gap-6">
          <div className="shrink-0 text-center">
            <div className="flex h-24 w-24 items-center justify-center rounded-full" style={{ border: `4px solid ${score >= 80 ? '#00E599' : '#FFB547'}` }}>
              <span className="text-2xl font-bold" style={{ color: '#FFB547' }}>{score}</span>
            </div>
            <span className="text-xs mt-1 block" style={{ color: 'var(--color-outline)' }}>匹配度</span>
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold">AI 应用开发工程师</h2>
            <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>字节跳动 · 北京</p>
            <div className="flex gap-4 mt-3">
              {Object.entries(dims).map(([k, v]) => (
                <div key={k} className="flex-1">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span style={{ color: 'var(--color-outline)' }}>{k === 'skill' ? '技能' : k === 'experience' ? '经验' : k === 'education' ? '学历' : '薪资'}</span>
                    <span style={{ color: 'var(--color-primary)' }}>{v}%</span>
                  </div>
                  <div className="h-1.5 rounded-full" style={{ background: 'var(--color-surface-container-low)' }}>
                    <div className="h-full rounded-full" style={{ width: `${v}%`, background: 'linear-gradient(90deg, var(--color-primary), var(--accent-purple))' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border p-4" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
          <div className="flex items-center gap-2 mb-3"><CheckCircle className="h-4 w-4" style={{ color: 'var(--accent-green)' }} /><h3 className="text-sm font-semibold" style={{ color: 'var(--accent-green)' }}>已掌握</h3></div>
          <div className="flex flex-wrap gap-2">{['Python', 'FastAPI'].map(s => <span key={s} className="rounded-lg border px-3 py-1.5 text-xs" style={{ borderColor: 'rgba(0,229,153,0.2)', color: 'var(--accent-green)' }}>{s}</span>)}</div>
        </div>
        <div className="rounded-xl border p-4" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
          <div className="flex items-center gap-2 mb-3"><XCircle className="h-4 w-4" style={{ color: 'var(--accent-red)' }} /><h3 className="text-sm font-semibold" style={{ color: 'var(--accent-red)' }}>待提升</h3></div>
          <div className="flex flex-wrap gap-2">
            {['LangChain', 'RAG', 'Prompt Engineering'].map(s => (
              <span key={s} className="rounded-lg border px-3 py-1.5 text-xs" style={{ borderColor: 'rgba(255,77,106,0.2)', color: 'var(--accent-red)' }}>{s} →</span>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border p-4" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
        <div className="flex items-center gap-2 mb-3"><Lightbulb className="h-4 w-4" style={{ color: 'var(--accent-orange)' }} /><h3 className="text-sm font-semibold">改进建议</h3></div>
        <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>您的 Python 基础扎实，建议补充 LLM 应用开发相关知识。LangChain 是目前主流的 LLM 应用框架。</p>
        <button className="mt-3 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold text-white" style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--accent-purple))' }}>
          查看学习路径 <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
