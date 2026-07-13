import { useState, useRef, useEffect } from 'react'
import { Upload, Loader2, CheckCircle, FileText, AlertCircle, ArrowRight, RefreshCw, User, Briefcase, GraduationCap, Code, Phone, Mail, Clock, Download, RotateCcw, Trash2, Eye, X, MapPin, Star } from 'lucide-react'
import ProfileSidebar from '../../components/ProfileSidebar'
import { JSNav } from '../../lib/NavContext'

interface ParseResult {
  name: string; phone: string; email: string
  skills: string[]; education: string; school: string
  experience: string; target_position: string; bio: string
  method?: string; raw_text_preview?: string
  quality?: { scored_skills: {skill:string;confidence:number;status:string;matched_in_text:boolean}[];
    traces: {skill:string;evidence:string[];found:boolean}[];
    confidence_avg: number; verified_count: number; unconfirmed_count: number }
}

interface HistoryItem {
  path: string; date: string; filename: string
  skills: string[]; skill_count: number
  name: string; target_position: string
}

export default function Resume() {
  const { setPage } = JSNav.use()
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [parsing, setParsing] = useState(false)
  const [parseDone, setParseDone] = useState(false)
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [filling, setFilling] = useState(false)
  const [filled, setFilled] = useState(false)
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [preview, setPreview] = useState<ParseResult | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  const fetchHistory = () => {
    const token = localStorage.getItem('xingtu_token')
    if (!token) return
    setHistoryLoading(true)
    fetch(`/api/auth/resume-history?token=${token}`).then(r => r.json()).then(d => {
      if (d.success) setHistory(d.data)
      setHistoryLoading(false)
    }).catch(() => setHistoryLoading(false))
  }

  useEffect(() => { fetchHistory() }, [])

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) { setFile(f); setParseResult(null); setConfirmed(false); setError(''); setFilled(false) }
  }

  const parse = async () => {
    if (!file) return
    setParsing(true); setError(''); setParseResult(null); setParseDone(false)
    const token = localStorage.getItem('xingtu_token')
    const fd = new FormData(); fd.append('file', file)
    try {
      const r = await fetch(`/api/auth/resume-parse?token=${token}`, { method: 'POST', body: fd })
      const d = await r.json()
      if (d.success) {
        setParseResult(d.data)
        setParseDone(true)
        fetchHistory()
      } else {
        setParsing(false)
        setError(d.message || '解析失败')
      }
    } catch { setParsing(false); setError('网络错误') }
  }

  const confirmResult = () => {
    setParsing(false)
    setParseDone(false)
    setConfirmed(true)
  }

  const fillProfile = async () => {
    if (!parseResult) return
    setFilling(true)
    const token = localStorage.getItem('xingtu_token')
    const body: Record<string, any> = {}
    if (parseResult.name) body.real_name = parseResult.name
    if (parseResult.phone) body.phone = parseResult.phone
    if (parseResult.education) body.education = parseResult.education
    if (parseResult.school) body.school = parseResult.school
    if (parseResult.target_position) body.target_position = parseResult.target_position
    if (parseResult.bio) body.bio = parseResult.bio
    if (parseResult.experience) body.experience = parseResult.experience
    if (parseResult.skills.length) body.skills = parseResult.skills.join(', ')

    const r = await fetch(`/api/auth/profile?token=${token}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const d = await r.json()
    setFilling(false)
    if (d.success) setFilled(true)
    else setError('保存失败')
  }

  const reset = () => {
    setFile(null); setParseResult(null); setConfirmed(false); setError(''); setFilled(false); setParseDone(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const reparseHistory = async (path: string) => {
    setFile(null); setParseResult(null); setConfirmed(false); setError('')
    setParsing(true); setParseDone(false)
    const token = localStorage.getItem('xingtu_token')
    try {
      const r = await fetch(`/api/auth/resume-reparse?token=${token}&filename=${encodeURIComponent(path)}`, { method: 'POST' })
      const d = await r.json()
      if (d.success) { setParseResult(d.data); setParseDone(true); fetchHistory() }
      else { setParsing(false); setError(d.message || '重新解析失败') }
    } catch { setParsing(false); setError('网络错误') }
  }

  const deleteHistory = async (path: string) => {
    const token = localStorage.getItem('xingtu_token')
    try {
      await fetch(`/api/auth/resume-delete?token=${token}&filename=${encodeURIComponent(path)}`, { method: 'DELETE' })
    } catch { /* ignore */ }
    setHistory(h => h.filter(i => i.path !== path))
  }

  const exportResults = async (path: string) => {
    const token = localStorage.getItem('xingtu_token')
    const r = await fetch(`/api/auth/resume-reparse?token=${token}&filename=${encodeURIComponent(path)}`, { method: 'POST' })
    const d = await r.json()
    if (!d.success) return
    const blob = new Blob([JSON.stringify(d.data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = path.replace(/\.[^.]+$/, '') + '_parsed.json'
    a.click(); URL.revokeObjectURL(url)
  }

  const previewHistory = async (path: string) => {
    setPreviewLoading(true); setPreview(null)
    const token = localStorage.getItem('xingtu_token')
    try {
      const r = await fetch(`/api/auth/resume-reparse?token=${token}&filename=${encodeURIComponent(path)}`, { method: 'POST' })
      const d = await r.json()
      if (d.success) setPreview(d.data)
    } catch { /* ignore */ }
    setPreviewLoading(false)
  }

  const result = confirmed && !parsing ? parseResult : null
  const hasContent = parseResult && (parseResult.skills.length > 0 || parseResult.name || parseResult.phone)

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex gap-8">
        <ProfileSidebar />
        <div className="flex-1 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold" style={{ color: 'var(--color-on-surface)' }}>简历管理</h1>
              <p className="text-sm mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>上传简历自动解析，智能提取技能与个人信息</p>
            </div>
            {file && !confirmed && (
              <button onClick={reset} className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
                <RefreshCw className="h-4 w-4" /> 重新选择
              </button>
            )}
          </div>

          {/* 上传区 */}
          {!confirmed && !parsing && !parseDone && (
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => {
                e.preventDefault(); setDragOver(false)
                const f = e.dataTransfer.files[0]
                if (f) { setFile(f); setError(''); setFilled(false); setParseResult(null); setConfirmed(false) }
              }}
              onClick={() => fileRef.current?.click()}
              className="rounded-xl border-2 p-16 text-center cursor-pointer transition-all"
              style={{
                borderColor: dragOver ? 'var(--color-primary)' : 'var(--color-outline-variant)',
                background: dragOver ? 'rgba(0,130,255,0.04)' : 'var(--color-surface-container-lowest)',
                borderStyle: 'dashed',
              }}>
              <input ref={fileRef} type="file" accept=".pdf,.docx,.doc,.txt" onChange={handleFile} hidden />
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl mb-4" style={{ background: 'rgba(0,200,255,0.1)' }}>
                <Upload className="h-8 w-8" style={{ color: 'var(--color-primary)' }} />
              </div>
              <h2 className="text-base font-semibold mb-2" style={{ color: 'var(--color-on-surface)' }}>
                {file ? file.name : '拖拽简历文件到此处，或点击选择'}
              </h2>
              <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>支持 PDF、DOCX、DOC、TXT 格式</p>

              {file && (
                <div className="mt-6">
                  <button onClick={e => { e.stopPropagation(); parse() }}
                    className="inline-flex items-center gap-2 rounded-lg px-8 py-3 text-sm font-semibold text-white"
                    style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--accent-purple))' }}>
                    <FileText className="h-4 w-4" /> 开始解析
                  </button>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="flex items-center gap-3 rounded-xl border p-4" style={{ borderColor: 'rgba(220,38,38,0.3)', background: 'rgba(220,38,38,0.06)' }}>
              <AlertCircle className="h-5 w-5 shrink-0" style={{ color: 'var(--accent-red)' }} />
              <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>{error}</p>
            </div>
          )}

          {/* 历史上传记录 */}
          {history.length > 0 && !confirmed && (
            <div className="rounded-2xl border" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
              <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--color-outline-variant)' }}>
                <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--color-on-surface)' }}>
                  <Clock className="h-4 w-4" /> 历史上传 ({history.length})
                </h3>
              </div>
              <div className="divide-y" style={{ borderColor: 'var(--color-outline-variant)' }}>
                {history.map((item, i) => (
                  <div key={i} className="flex items-center justify-between px-6 py-4 hover:bg-[var(--color-surface)] transition-colors">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 shrink-0" style={{ color: 'var(--color-on-surface-variant)' }} />
                        <span className="text-sm font-semibold truncate" style={{ color: 'var(--color-on-surface)' }}>{item.filename}</span>
                      </div>
                      <div className="flex items-center gap-4 mt-1.5">
                        <span className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>{item.date}</span>
                        {item.skill_count > 0 && (
                          <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-primary)' }}>
                            {item.skill_count} 项技能
                          </span>
                        )}
                        {item.target_position && (
                          <span className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>{item.target_position}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 ml-4">
                      <button onClick={() => previewHistory(item.path)}
                        className="p-2 rounded-lg transition-colors" title="预览"
                        style={{ color: 'var(--color-on-surface-variant)' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-surface-container)'; e.currentTarget.style.color = 'var(--color-primary)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-on-surface-variant)' }}>
                        <Eye className="h-4 w-4" />
                      </button>
                      <button onClick={() => reparseHistory(item.path)}
                        className="p-2 rounded-lg transition-colors" title="重新解析并填充"
                        style={{ color: 'var(--color-on-surface-variant)' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-surface-container)'; e.currentTarget.style.color = 'var(--color-primary)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-on-surface-variant)' }}>
                        <RotateCcw className="h-4 w-4" />
                      </button>
                      <button onClick={() => exportResults(item.path)}
                        className="p-2 rounded-lg transition-colors" title="导出解析结果"
                        style={{ color: 'var(--color-on-surface-variant)' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-surface-container)'; e.currentTarget.style.color = 'var(--color-primary)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-on-surface-variant)' }}>
                        <Download className="h-4 w-4" />
                      </button>
                      <button onClick={() => deleteHistory(item.path)}
                        className="p-2 rounded-lg transition-colors" title="从列表移除"
                        style={{ color: 'var(--color-on-surface-variant)' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-surface-container)'; e.currentTarget.style.color = 'var(--accent-red)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-on-surface-variant)' }}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═══ 解析弹窗 ═══ */}
          {(parsing || parseDone) && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
              <div className="rounded-2xl border p-10 w-[420px] text-center" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
                {!parseDone ? (
                  <>
                    <Loader2 className="h-14 w-14 mx-auto mb-5 animate-spin" style={{ color: 'var(--color-primary)' }} />
                    <p className="text-base font-bold" style={{ color: 'var(--color-on-surface)' }}>正在解析简历...</p>
                    <div className="mt-5 space-y-3 text-left mx-auto max-w-[280px]">
                      <div className="flex items-center gap-3 text-sm" style={{ color: 'var(--accent-green)' }}>
                        <CheckCircle className="h-4 w-4 shrink-0" /> 文件已上传成功
                      </div>
                      <div className="flex items-center gap-3 text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                        {file?.name?.endsWith('.pdf') ? '提取PDF文本内容...' :
                         file?.name?.endsWith('.docx') ? '提取DOCX文本内容...' :
                         '智能识别技能与个人信息...'}
                      </div>
                    </div>
                    <p className="text-xs mt-6" style={{ color: 'var(--color-on-surface-variant)' }}>大模型解析中，请稍候...</p>
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-14 w-14 mx-auto mb-5" style={{ color: 'var(--accent-green)' }} />
                    <p className="text-base font-bold" style={{ color: 'var(--color-on-surface)' }}>解析完成</p>
                    <div className="mt-4 mb-2 mx-auto bg-black/5 rounded-xl p-4 text-left space-y-2" style={{ background: 'var(--color-surface-container)' }}>
                      {parseResult?.name && <p className="text-sm" style={{ color: 'var(--color-on-surface)' }}><span style={{ color: 'var(--color-on-surface-variant)' }}>姓名：</span>{parseResult.name}</p>}
                      {parseResult?.phone && <p className="text-sm" style={{ color: 'var(--color-on-surface)' }}><span style={{ color: 'var(--color-on-surface-variant)' }}>手机：</span>{parseResult.phone}</p>}
                      {parseResult?.education && <p className="text-sm" style={{ color: 'var(--color-on-surface)' }}><span style={{ color: 'var(--color-on-surface-variant)' }}>学历：</span>{parseResult.education}</p>}
                      <p className="text-sm" style={{ color: 'var(--color-on-surface)' }}>
                        <span style={{ color: 'var(--color-on-surface-variant)' }}>技能：</span>
                        {parseResult?.skills?.length ? (
                          <span className="flex flex-wrap gap-1 mt-1">
                            {parseResult.skills.slice(0, 8).map(s => (
                              <span key={s} className="px-1.5 py-0.5 rounded text-xs font-medium" style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-primary)' }}>{s}</span>
                            ))}
                            {parseResult.skills.length > 8 && <span className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>+{parseResult.skills.length - 8}项</span>}
                          </span>
                        ) : <span style={{ color: 'var(--color-on-surface-variant)' }}>未识别</span>}
                      </p>
                    </div>
                    <button onClick={confirmResult}
                      className="mt-5 inline-flex items-center gap-2 rounded-lg px-8 py-3 text-sm font-semibold text-white"
                      style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--accent-purple))' }}>
                      <CheckCircle className="h-4 w-4" /> 确认查看结果
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* 预览弹窗 */}
          {preview && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={e => { if (e.target === e.currentTarget) setPreview(null) }}>
              <div className="rounded-2xl border w-full max-w-xl max-h-[80vh] overflow-y-auto" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
                <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
                  <h3 className="text-base font-bold flex items-center gap-2" style={{ color: 'var(--color-on-surface)' }}>
                    <FileText className="h-5 w-5" style={{ color: 'var(--color-primary)' }} /> 简历预览
                  </h3>
                  <button onClick={() => setPreview(null)} className="p-2 rounded-lg" style={{ color: 'var(--color-on-surface-variant)' }}><X className="h-5 w-5" /></button>
                </div>
                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <PreviewField label="姓名" value={preview.name} />
                    <PreviewField label="手机" value={preview.phone} />
                    <PreviewField label="邮箱" value={preview.email} />
                    <PreviewField label="学历" value={preview.education} />
                    <PreviewField label="学校" value={preview.school} />
                    <PreviewField label="期望岗位" value={preview.target_position} />
                    <PreviewField label="工作经验" value={preview.experience} />
                  </div>
                  {preview.skills.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold mb-2" style={{ color: 'var(--color-on-surface-variant)' }}>技能标签 ({preview.skills.length}项)</p>
                      <div className="flex flex-wrap gap-1.5">
                        {preview.skills.map(s => (
                          <span key={s} className="px-2 py-1 rounded-md text-xs font-medium" style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-primary)' }}>{s}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {preview.bio && (
                    <div>
                      <p className="text-xs font-semibold mb-1" style={{ color: 'var(--color-on-surface-variant)' }}>个人简介</p>
                      <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--color-on-surface)' }}>{preview.bio}</p>
                    </div>
                  )}
                  {preview.raw_text_preview && (
                    <details>
                      <summary className="text-xs cursor-pointer" style={{ color: 'var(--color-on-surface-variant)' }}>原文预览</summary>
                      <pre className="mt-2 text-xs p-3 rounded-lg whitespace-pre-wrap max-h-40 overflow-y-auto" style={{ background: 'var(--color-surface-container)', color: 'var(--color-on-surface-variant)' }}>{preview.raw_text_preview}</pre>
                    </details>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 解析结果详情 */}
          {result && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 rounded-xl border p-4" style={{ borderColor: 'rgba(0,229,153,0.3)', background: 'rgba(0,229,153,0.06)' }}>
                <CheckCircle className="h-5 w-5 shrink-0" style={{ color: 'var(--accent-green)' }} />
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--accent-green)' }}>解析成功</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>
                    解析方式：{result.method === 'deepseek' ? 'DeepSeek 大模型' : '规则提取'}
                    {result.method !== 'deepseek' && ' · 配置 DEEPSEEK_API_KEY 可启用大模型精确解析'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FieldCard icon={User} label="姓名" value={result.name} />
                <FieldCard icon={Phone} label="手机号" value={result.phone} />
                <FieldCard icon={Mail} label="邮箱" value={result.email} />
                <FieldCard icon={GraduationCap} label="学历" value={result.education} />
                <FieldCard icon={GraduationCap} label="学校" value={result.school} />
                <FieldCard icon={Briefcase} label="期望岗位" value={result.target_position} />
                <FieldCard icon={Briefcase} label="工作经验" value={result.experience} />
              </div>

              {result.skills.length > 0 && (
                <div className="rounded-2xl border p-6" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
                  <h3 className="text-base font-bold mb-1 flex items-center gap-2" style={{ color: 'var(--color-on-surface)' }}>
                    <Code className="h-4 w-4" /> 提取技能 ({result.skills.length}项)
                  </h3>
                  {result.quality && (
                    <p className="text-xs mb-3" style={{ color: 'var(--color-on-surface-variant)' }}>
                      置信度 {result.quality.confidence_avg} · {result.quality.verified_count}项已验证 · {result.quality.unconfirmed_count > 0 ? `${result.quality.unconfirmed_count}项待确认` : '全部通过'}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {result.skills.map(s => {
                      const scored = result.quality?.scored_skills?.find((q: any) => q.skill === s)
                      const conf = scored?.confidence ?? 0.5
                      const status = scored?.status ?? 'unconfirmed'
                      const trace = result.quality?.traces?.find((t: any) => t.skill === s)
                      const evidence = trace?.evidence?.[0]
                      const bg = status === 'verified' ? 'rgba(0,229,153,0.12)' : conf >= 0.7 ? 'var(--color-primary-fixed)' : 'rgba(255,140,66,0.12)'
                      const fg = status === 'verified' ? 'var(--accent-green)' : conf >= 0.7 ? 'var(--color-primary)' : 'var(--accent-orange)'
                      const border = status === 'verified' ? '1px solid rgba(0,229,153,0.3)' : conf >= 0.7 ? 'none' : '1px solid rgba(255,140,66,0.3)'
                      return (
                        <span key={s} className="px-3 py-1.5 rounded-lg text-sm font-semibold relative group cursor-help"
                          style={{ background: bg, color: fg, border }}>
                          {s}
                          <span className="text-[10px] ml-1 opacity-60">{Math.round(conf * 100)}%</span>
                          {evidence && (
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 rounded-xl border text-xs hidden group-hover:block z-50"
                              style={{ background: 'var(--color-surface-container-lowest)', borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface-variant)' }}>
                              <p className="font-semibold mb-1" style={{ color: 'var(--color-on-surface)' }}>原文依据：</p>
                              <p className="leading-relaxed">{evidence}</p>
                            </div>
                          )}
                        </span>
                      )
                    })}
                  </div>
                </div>
              )}

              {result.bio && (
                <div className="rounded-2xl border p-6" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
                  <h3 className="text-base font-bold mb-3" style={{ color: 'var(--color-on-surface)' }}>个人简介</h3>
                  <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--color-on-surface-variant)' }}>{result.bio}</p>
                </div>
              )}

              <div className="flex items-center gap-3">
                {!filled ? (
                  <button onClick={fillProfile} disabled={filling}
                    className="flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold text-white disabled:opacity-60"
                    style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--accent-purple))' }}>
                    {filling ? <><Loader2 className="h-4 w-4 animate-spin" /> 保存中...</> : <><CheckCircle className="h-4 w-4" /> 确认并填充到个人资料</>}
                  </button>
                ) : (
                  <>
                    <button onClick={() => setPage('profile-home')}
                      className="flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold text-white"
                      style={{ background: 'var(--accent-green)' }}>
                      <CheckCircle className="h-4 w-4" /> 已填充，查看个人主页
                    </button>
                    <button onClick={() => setPage('my-skill-graph')}
                      className="flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold"
                      style={{ color: 'var(--color-primary)', background: 'var(--color-primary-fixed)' }}>
                      <Code className="h-4 w-4" /> 查看能力图谱 <ArrowRight className="h-4 w-4" />
                    </button>
                  </>
                )}
                <button onClick={reset} className="px-4 py-2 text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>重新上传</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function FieldCard({ icon: Icon, label, value }: { icon: any; label: string; value?: string }) {
  return (
    <div className="rounded-xl border p-4 flex items-center gap-3" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: 'var(--color-primary-fixed)' }}>
        <Icon className="h-4.5 w-4.5" style={{ color: 'var(--color-primary)' }} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium" style={{ color: 'var(--color-on-surface-variant)' }}>{label}</p>
        <p className="text-sm font-semibold truncate" style={{ color: value ? 'var(--color-on-surface)' : 'var(--color-on-surface-variant)', fontStyle: value ? 'normal' : 'italic' }}>
          {value || '未识别'}
        </p>
      </div>
    </div>
  )
}

function PreviewField({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-lg border p-3" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface)' }}>
      <p className="text-[11px] font-medium" style={{ color: 'var(--color-on-surface-variant)' }}>{label}</p>
      <p className="text-sm mt-0.5" style={{ color: value ? 'var(--color-on-surface)' : 'var(--color-on-surface-variant)', fontStyle: value ? 'normal' : 'italic', fontWeight: value ? 600 : 400 }}>
        {value || '未识别'}
      </p>
    </div>
  )
}
