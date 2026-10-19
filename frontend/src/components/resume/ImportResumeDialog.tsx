import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Upload, X, Loader2, FileText, CheckCircle2, AlertTriangle, Wand2 } from 'lucide-react'

const getToken = () => localStorage.getItem('xingtu_token') || ''

interface ImportMeta {
  method: string
  filename: string
  confidence_avg: number
  verified_count: number
  unconfirmed_count: number
  section_types: string[]
  warnings: string[]
}

interface ImportedResume {
  id: number
  title: string
  template_key: string
  sections: any[]
  import_meta?: ImportMeta
}

interface Props {
  onClose: () => void
  onImported: (resume: ImportedResume) => void
  onToast: (msg: string) => void
}

const SECTION_TEXT: Record<string, string> = {
  personal_info: '个人信息',
  summary: '个人简介',
  work_experience: '工作经历',
  education: '教育背景',
  skills: '技能特长',
  projects: '项目经历',
  certifications: '证书资质',
}

const ACCEPT = '.pdf,.docx,.doc,.txt'

export default function ImportResumeDialog({ onClose, onImported, onToast }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<ImportedResume | null>(null)

  const pick = (f?: File | null) => {
    if (!f) return
    const ext = f.name.split('.').pop()?.toLowerCase() || ''
    if (!['pdf', 'docx', 'doc', 'txt'].includes(ext)) {
      onToast('只支持 PDF / Word / TXT')
      return
    }
    if (f.size > 8 * 1024 * 1024) {
      onToast('文件不能超过 8MB')
      return
    }
    setFile(f)
  }

  const upload = async () => {
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const r = await fetch(`/api/resume-center/import?token=${getToken()}`, { method: 'POST', body: fd })
      const d = await r.json()
      if (!d.success) {
        onToast(d.error?.message || '导入失败')
        return
      }
      setResult(d.data)
      onToast('导入完成，请核对内容')
    } catch {
      onToast('网络错误，导入失败')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={onClose}>
      <motion.div initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        className="w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: 'var(--color-surface-container-lowest)' }}
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--color-outline-variant)' }}>
          <div>
            <h3 className="text-base font-semibold flex items-center gap-2" style={{ color: 'var(--color-on-surface)' }}>
              <Upload className="h-4 w-4" style={{ color: 'var(--accent-blue)' }} /> 导入旧简历
            </h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>
              上传已有的简历文件，自动整理成可编辑的在线简历
            </p>
          </div>
          <button onClick={onClose} style={{ color: 'var(--color-on-surface-variant)' }}><X className="h-4 w-4" /></button>
        </div>

        <div className="px-6 py-5">
          {!result ? (
            <>
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={e => { e.preventDefault(); setDragging(false); pick(e.dataTransfer.files?.[0]) }}
                onClick={() => inputRef.current?.click()}
                className="rounded-xl border-2 border-dashed px-6 py-10 text-center cursor-pointer transition-colors"
                style={{
                  borderColor: dragging ? 'var(--accent-blue)' : 'var(--color-outline-variant)',
                  background: dragging ? 'var(--accent-blue-dim, #dbeafe)' : 'var(--color-surface)',
                }}>
                <input ref={inputRef} type="file" accept={ACCEPT} className="hidden"
                  onChange={e => pick(e.target.files?.[0])} />
                <FileText className="h-9 w-9 mx-auto mb-3 opacity-40" style={{ color: 'var(--accent-blue)' }} />
                {file ? (
                  <>
                    <p className="text-sm font-medium" style={{ color: 'var(--color-on-surface)' }}>{file.name}</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>
                      {(file.size / 1024).toFixed(0)} KB · 点击可重新选择
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm" style={{ color: 'var(--color-on-surface)' }}>拖拽文件到这里，或点击选择</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>支持 PDF / DOCX / DOC / TXT，最大 8MB</p>
                  </>
                )}
              </div>

              <div className="mt-4 text-[11px] leading-relaxed space-y-1" style={{ color: 'var(--color-on-surface-variant)' }}>
                <p>· 解析会尽量抽取姓名、联系方式、教育、工作与项目经历，导入后逐块核对即可</p>
                <p>· 扫描版 PDF（纯图片）无法抽取文字，请改用文字版或先做 OCR</p>
                <p>· 解析通常需要 10~30 秒，配置了模型密钥时结果更完整</p>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="h-5 w-5" style={{ color: '#10b981' }} />
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--color-on-surface)' }}>{result.title}</p>
                  <p className="text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>
                    已生成 {result.sections.length} 个可编辑区块
                    {(result.import_meta?.method === 'deepseek') ? ' · AI 解析' : ' · 规则解析'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 mb-3">
                {result.sections.map(s => (
                  <span key={s.section_type || s.type} className="text-[11px] px-2 py-1 rounded-lg"
                    style={{ background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface)' }}>
                    {SECTION_TEXT[s.section_type || s.type] || s.section_type || s.type}
                  </span>
                ))}
              </div>

              {!!result.import_meta?.warnings?.length && (
                <div className="rounded-xl p-3" style={{ background: 'rgba(245,158,11,0.10)' }}>
                  {result.import_meta.warnings.map((w, i) => (
                    <p key={i} className="text-[11px] flex gap-1.5 leading-relaxed" style={{ color: '#b45309' }}>
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />{w}
                    </p>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-3 border-t" style={{ borderColor: 'var(--color-outline-variant)' }}>
          {!result ? (
            <>
              <button onClick={onClose} className="h-9 px-4 rounded-lg text-sm border"
                style={{ borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface-variant)' }}>取消</button>
              <button onClick={upload} disabled={!file || uploading}
                className="h-9 px-4 rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50"
                style={{ background: 'var(--accent-blue)', color: '#fff' }}>
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                {uploading ? '解析中…' : '开始解析'}
              </button>
            </>
          ) : (
            <button onClick={() => onImported(result)}
              className="h-9 px-4 rounded-lg text-sm font-medium flex items-center gap-2"
              style={{ background: 'var(--accent-blue)', color: '#fff' }}>
              打开编辑器核对 <CheckCircle2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </motion.div>
    </div>
  )
}
