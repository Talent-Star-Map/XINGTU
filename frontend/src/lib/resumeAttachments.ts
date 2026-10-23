import { useEffect, useState } from 'react'

export interface AttachmentInfo {
  path: string; filename: string; size?: number; extension?: string; date?: string
}

export const attachmentReaderUrl = (item: AttachmentInfo) => `/resume-reader?filename=${encodeURIComponent(item.path)}`
export const attachmentHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('xingtu_token') || ''}` })
const fileUrl = (path: string, preview = false) => `/api/auth/resume-file?filename=${encodeURIComponent(path)}&preview=${preview}`

async function checkedBlob(response: Response) {
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(typeof data.detail === 'string' ? data.detail : '附件读取失败，请重试')
  }
  return response.blob()
}

export async function downloadAttachment(item: AttachmentInfo) {
  const blob = await checkedBlob(await fetch(fileUrl(item.path), { headers: attachmentHeaders() }))
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url; link.download = item.filename; document.body.appendChild(link); link.click(); link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 30000)
}

export function attachmentSize(size?: number) {
  if (size === undefined) return ''
  return size < 1024 * 1024 ? `${Math.max(1, Math.round(size / 1024))} KB` : `${(size / 1024 / 1024).toFixed(1)} MB`
}

export function useAttachmentPage(item: AttachmentInfo | null, page: number) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<{ url: string; type: string; text?: string } | null>(null)
  const [pageCount, setPageCount] = useState(1)
  const [attempt, setAttempt] = useState(0)
  const path = item?.path
  const paginated = ['pdf', 'doc', 'docx', 'tif', 'tiff'].includes(item?.extension || path?.split('.').pop()?.toLowerCase() || '')

  useEffect(() => {
    if (!path) return
    let disposed = false
    let objectUrl = ''
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 75000)
    setLoading(true); setError(''); setPreview(null)
    void (async () => {
      try {
        const response = await fetch(fileUrl(path, true) + (paginated ? `&page=${page}` : ''), { headers: attachmentHeaders(), signal: controller.signal })
        const blob = await checkedBlob(response)
        const text = blob.type.startsWith('text/') ? await blob.text() : undefined
        if (disposed) return
        setPageCount(Number(response.headers.get('X-Page-Count')) || 1)
        objectUrl = URL.createObjectURL(blob)
        setPreview({ url: objectUrl, type: blob.type, text })
      } catch (e) {
        if (!disposed) setError(e instanceof Error && e.name !== 'AbortError' ? e.message : '附件预览超时，请重试或下载原文件')
      } finally { window.clearTimeout(timeout); if (!disposed) setLoading(false) }
    })()
    return () => { disposed = true; controller.abort(); window.clearTimeout(timeout); if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [path, attempt, page, paginated])

  return { loading, error, preview, pageCount, retry: () => setAttempt(v => v + 1) }
}
