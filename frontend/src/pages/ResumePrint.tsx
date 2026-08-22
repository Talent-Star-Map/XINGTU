import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ResumePreview } from '../components/resume/ResumePreview'

/**
 * 公开打印路由 — /print/:token
 *
 * Playwright 加载这个路由来渲染 PDF/HTML。
 * - 无登录壳(不渲染 RoleSelect/Login/Shell)
 * - A4 锁定 + 打印 CSS(覆盖 ResumePreview 的 shadow/scale)
 * - 调公开端点 GET /api/resume-center/print/{token} 拿简历数据
 *
 * 注意:token 是 print_token(单次消费、5 分钟过期),不是用户 JWT —
 * 这条路由无登录可用,服务端用 token 验证打印权限。
 */

// ── 打印 CSS — 锁死 A4,关掉缩放/阴影/背景 ────────────────────────────
const PRINT_CSS = `
  @page { size: A4; margin: 0; }
  html, body {
    margin: 0 !important;
    padding: 0 !important;
    background: #fff !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .resume-export {
    width: 210mm !important;
    min-height: 297mm !important;
    margin: 0 auto !important;
    padding: 0 !important;
    background: #fff !important;
    box-shadow: none !important;
    transform: none !important;
    overflow: visible !important;
  }
  .resume-export > div {
    box-shadow: none !important;
    transform: none !important;
    margin: 0 !important;
  }
  /* 智能分页:允许 section 跨页,保持单个 item 不被切断 */
  .resume-export [data-section] {
    break-inside: auto !important;
    page-break-inside: auto !important;
  }
  .resume-export [data-section] > div,
  .resume-export .item {
    break-inside: avoid !important;
    page-break-inside: avoid !important;
  }
  .resume-export h2,
  .resume-export h3 {
    break-after: avoid !important;
    page-break-after: avoid !important;
  }
  @media print {
    html, body { background: #fff !important; }
    .resume-export { box-shadow: none !important; }
  }
`

export default function ResumePrint() {
  const { token } = useParams<{ token: string }>()
  const [resume, setResume] = useState<any>(null)
  const [error, setError] = useState<string>('')

  useEffect(() => {
    let cancelled = false
    if (!token) {
      setError('缺少打印参数')
      return
    }
    fetch(`/api/resume-center/print/${token}`)
      .then(r => r.json())
      .then(j => {
        if (cancelled) return
        if (j.success && j.data) {
          setResume(j.data)
        } else {
          setError(j.error?.message || j.message || '加载失败')
        }
      })
      .catch(e => !cancelled && setError(`网络错误: ${e?.message || e}`))
    return () => { cancelled = true }
  }, [token])

  if (error) {
    return (
      <div style={{ padding: 40, color: '#dc2626', fontFamily: 'system-ui' }}>
        <h2 style={{ fontSize: 16, marginBottom: 8 }}>加载失败</h2>
        <p>{error}</p>
      </div>
    )
  }
  if (!resume) {
    return (
      <div style={{ padding: 40, color: '#71717a', fontFamily: 'system-ui' }}>
        正在加载简历…
      </div>
    )
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />
      <div className="resume-export">
        <ResumePreview resume={resume} scale={1} />
      </div>
    </>
  )
}