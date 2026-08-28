import { useRef, useState } from 'react'
import { Upload, CheckCircle, ChevronDown, Sparkles, Loader2, AlertCircle, FileText } from 'lucide-react'
import ManualSkillInput from './ManualSkillInput'

const ACCEPT = '.pdf,.doc,.docx,.txt'

interface Props {
  hasProfile: boolean | null
  showSkillInput: boolean
  selSkills: string[]
  analyzing?: boolean
  onTagsChange: (skills: string[]) => void
  onConfirm: (skills: string[]) => void
  onAutoMatch: (skills: string[]) => void
  onShowSkillInput: () => void
  onSkip: () => void
  onGoToResume: () => void
}

type UploadState = 'idle' | 'uploading' | 'done' | 'error'

interface ParseSummary {
  filename: string
  skillCount: number
  method: string
  confidence: number
}

export default function ResumeUploader({
  hasProfile, showSkillInput, selSkills, analyzing = false, onTagsChange,
  onConfirm, onAutoMatch, onShowSkillInput, onSkip, onGoToResume,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [uploadState, setUploadState] = useState<UploadState>('idle')
  const [uploadError, setUploadError] = useState('')
  const [parsed, setParsed] = useState<ParseSummary | null>(null)

  const uploadFile = async (file: File) => {
    const token = localStorage.getItem('xingtu_token') || ''
    if (!token) { setUploadState('error'); setUploadError('请先登录后再上传简历'); return }

    setUploadState('uploading')
    setUploadError('')
    try {
      const form = new FormData()
      form.append('file', file)
      const r = await fetch(`/api/auth/resume-parse?token=${token}`, { method: 'POST', body: form })
      const d = await r.json()
      if (!r.ok || !d.success) {
        throw new Error(d.message || `解析失败 (${r.status})`)
      }
      const skills: string[] = d.data?.skills || []
      if (!skills.length) {
        setUploadState('error')
        setUploadError('没能从这份简历里识别出技能，可以手动补充几项')
        return
      }
      // 与已选技能合并去重，不覆盖用户手动填的内容
      const merged = Array.from(new Set([...selSkills, ...skills]))
      onTagsChange(merged)
      setParsed({
        filename: file.name,
        skillCount: skills.length,
        method: d.data?.method === 'deepseek' ? 'AI 解析' : '规则解析',
        confidence: d.data?.quality?.confidence_avg ?? 0,
      })
      setUploadState('done')
    } catch (e: any) {
      setUploadState('error')
      setUploadError(e?.message || '上传失败，请稍后重试')
    }
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) uploadFile(file)
  }

  // 已检测到简历/技能 — 显示已选技能摘要 + 智能匹配按钮
  if (hasProfile === true && !showSkillInput) {
    return (
      <div className="rounded-xl border p-4 space-y-3"
        style={{ borderColor: 'rgba(0,229,153,0.2)', background: 'rgba(0,229,153,0.05)' }}>
        <div className="flex items-center gap-3">
          <CheckCircle className="h-5 w-5 shrink-0" style={{ color: 'var(--accent-green)' }} />
          <p className="text-xs font-medium" style={{ color: 'var(--accent-green)' }}>已选择 {selSkills.length} 项技能</p>
          <button onClick={onShowSkillInput} className="ml-auto text-xs font-medium flex items-center gap-1"
            style={{ color: 'var(--color-primary)' }}><ChevronDown className="h-3 w-3" /> 修改</button>
        </div>

        {uploadState === 'done' && parsed && (
          <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
            <FileText className="h-3 w-3 inline mr-1" />
            来自「{parsed.filename}」· {parsed.method}提取 {parsed.skillCount} 项
            {parsed.confidence > 0 && ` · 平均置信度 ${parsed.confidence}`}
          </p>
        )}

        <div className="flex flex-wrap gap-1.5">
          {selSkills.map(s => (
            <span key={s} className="px-2 py-0.5 rounded text-[11px] font-medium"
              style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-primary)' }}>{s}</span>
          ))}
        </div>

        <button onClick={() => onAutoMatch(selSkills)} disabled={analyzing}
          className="w-full h-9 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          style={{ background: 'var(--color-primary)' }}>
          {analyzing
            ? <><Loader2 className="h-4 w-4 animate-spin" /> 正在匹配岗位...</>
            : <><Sparkles className="h-4 w-4" /> 智能匹配</>}
        </button>
      </div>
    )
  }

  // 未检测到简历，显示上传 + 引导横幅
  if (!showSkillInput) {
    return (
      <div className="space-y-3">
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => uploadState !== 'uploading' && inputRef.current?.click()}
          role="button" tabIndex={0}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); uploadState !== 'uploading' && inputRef.current?.click() } }}
          className="rounded-xl border border-dashed p-6 text-center cursor-pointer transition-colors"
          style={{
            borderColor: dragging ? 'var(--color-primary)' : 'var(--color-outline-variant)',
            background: dragging ? 'var(--color-primary-fixed)' : 'var(--color-surface-container-lowest)',
          }}
        >
          <input ref={inputRef} type="file" accept={ACCEPT} className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.target.value = '' }} />

          {uploadState === 'uploading' ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--color-primary)' }} />
              <p className="text-sm font-medium" style={{ color: 'var(--color-on-surface)' }}>正在解析简历...</p>
            </div>
          ) : (
            <>
              <Upload className="h-6 w-6 mx-auto mb-2" style={{ color: 'var(--color-primary)' }} />
              <p className="text-sm font-semibold" style={{ color: 'var(--color-on-surface)' }}>
                拖拽简历到此处，或点击上传
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>
                支持 PDF / Word / TXT，解析后自动提取技能
              </p>
            </>
          )}
        </div>

        {uploadState === 'error' && (
          <div className="rounded-lg border px-3 py-2 flex items-start gap-2"
            style={{ borderColor: 'rgba(220,38,38,0.2)', background: 'rgba(220,38,38,0.04)' }}>
            <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" style={{ color: 'var(--accent-red)' }} />
            <p className="text-xs" style={{ color: 'var(--accent-red)' }}>{uploadError}</p>
          </div>
        )}

        <div className="rounded-xl border p-5"
          style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="flex-1 text-center sm:text-left">
              <p className="text-sm font-semibold" style={{ color: 'var(--color-on-surface)' }}>还没有技能数据</p>
              <p className="text-xs mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>上传简历自动提取，或手动输入快速体验</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={onShowSkillInput}
                className="h-9 px-4 rounded-lg text-xs font-semibold text-white"
                style={{ background: 'var(--color-primary)' }}>手动输入</button>
              <button onClick={onGoToResume}
                className="h-9 px-4 rounded-lg text-xs font-semibold border"
                style={{ borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface-variant)' }}>前往简历管理</button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // 手动输入技能面板
  return (
    <ManualSkillInput
      tags={selSkills}
      onTagsChange={onTagsChange}
      onConfirm={onConfirm}
      onAutoMatch={onAutoMatch}
      onSkip={onSkip}
      onGoToResume={onGoToResume}
    />
  )
}
