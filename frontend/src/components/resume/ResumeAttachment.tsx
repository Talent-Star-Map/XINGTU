import { useState } from 'react'
import { Download, Eye, FileText, Loader2 } from 'lucide-react'
import { attachmentReaderUrl, attachmentSize, downloadAttachment, type AttachmentInfo } from '../../lib/resumeAttachments'
export { attachmentSize, downloadAttachment, type AttachmentInfo } from '../../lib/resumeAttachments'

export default function ResumeAttachment({ item }: { item: AttachmentInfo }) {
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState('')
  const download = async () => {
    setDownloading(true); setError('')
    try { await downloadAttachment(item) }
    catch (e) { setError(e instanceof Error ? e.message : '附件下载失败') }
    finally { setDownloading(false) }
  }

  return <section className="space-y-3" aria-label="简历附件">
    <h4 className="text-sm font-semibold">简历附件</h4>
    <div className="rounded-xl border p-4" style={{ borderColor: 'var(--color-outline-variant)' }}>
      <div className="flex flex-wrap items-center gap-3">
        <FileText className="h-5 w-5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium break-all">{item.filename}</p>
          <p className="text-xs mt-1 opacity-70">{[item.extension?.toUpperCase(), attachmentSize(item.size), item.date].filter(Boolean).join(' · ')}</p>
        </div>
        <a href={attachmentReaderUrl(item)} className="flex items-center gap-1 text-sm px-3 py-2 rounded-lg border"><Eye className="h-4 w-4" />预览附件</a>
        <button onClick={download} disabled={downloading} className="flex items-center gap-1 text-sm px-3 py-2 rounded-lg border disabled:opacity-50">
          {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}下载原文件
        </button>
      </div>
      {error && <p role="alert" className="mt-3 text-sm">{error}</p>}
    </div>
  </section>
}
