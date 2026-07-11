import { useState } from 'react'
import { Upload, CheckCircle, Loader2, FileText, ArrowRight } from 'lucide-react'

export default function Resume() {
  const [uploading, setUploading] = useState(false)
  const [uploaded, setUploaded] = useState(false)

  const handleFile = () => {
    setUploading(true)
    setTimeout(() => { setUploading(false); setUploaded(true) }, 2000)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-xl font-bold">简历管理</h1>
      <div className="rounded-xl border p-12 text-center transition-all" style={{ borderColor: uploaded ? 'rgba(0,229,153,0.3)' : 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)', borderStyle: 'dashed' }}>
        {!uploading && !uploaded && (
          <div>
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl mb-4" style={{ background: 'rgba(0,200,255,0.1)' }}>
              <Upload className="h-8 w-8" style={{ color: 'var(--color-primary)' }} />
            </div>
            <h2 className="text-base font-semibold mb-2">上传简历</h2>
            <p className="text-xs mb-4" style={{ color: 'var(--color-outline)' }}>支持 PDF、DOCX 格式</p>
            <button onClick={handleFile} className="inline-flex cursor-pointer items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-semibold text-white" style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--accent-purple))' }}>
              <Upload className="h-4 w-4" /> 选择文件
            </button>
          </div>
        )}
        {uploading && <div><Loader2 className="h-10 w-10 mx-auto mb-4 animate-spin" style={{ color: 'var(--color-primary)' }} /><p className="text-sm">正在解析...</p></div>}
        {uploaded && (
          <div>
            <CheckCircle className="h-12 w-12 mx-auto mb-3" style={{ color: 'var(--accent-green)' }} />
            <h2 className="text-base font-semibold mb-1">解析完成</h2>
            <p className="text-xs mb-4" style={{ color: 'var(--color-outline)' }}>demo_resume.pdf</p>
            <button className="inline-flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-semibold text-white" style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--accent-purple))' }}>
              查看匹配结果 <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
