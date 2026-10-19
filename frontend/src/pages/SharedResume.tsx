import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Printer, Star } from 'lucide-react'
import { ResumePreview } from '../components/resume/ResumePreview'

/**
 * 公开分享页 — /share/:token
 *
 * 简历中心生成的分享链接指向这里（免登录）。数据走公开端点
 * GET /api/resume-center/share/{token}，服务端会校验有效期并累加访问次数。
 *
 * 之前没有这个路由：分享出去 `/share/xxx` 会落到 `*`，未登录时直接被重定向回
 * 角色选择页，登录了则被当成未知页面塞进求职端外壳——链接实际是打不开的。
 */
export default function SharedResume() {
  const { token } = useParams<{ token: string }>()
  const [resume, setResume] = useState<any>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    if (!token) {
      setError('链接不完整')
      return
    }
    fetch(`/api/resume-center/share/${token}`)
      .then(r => r.json())
      .then(j => {
        if (cancelled) return
        if (j.success && j.data) setResume(j.data)
        else setError(j.error?.message || j.message || '这份简历暂时无法查看')
      })
      .catch(e => !cancelled && setError(`网络错误：${e?.message || e}`))
    return () => { cancelled = true }
  }, [token])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6"
        style={{ background: 'var(--color-background)', color: 'var(--color-on-surface)' }}>
        <div className="max-w-sm text-center">
          <p className="text-sm font-medium mb-2">无法打开这份简历</p>
          <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>{error}</p>
        </div>
      </div>
    )
  }

  if (!resume) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm"
        style={{ background: 'var(--color-background)', color: 'var(--color-on-surface-variant)' }}>
        正在加载简历…
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-12" style={{ background: '#f5f5f4' }}>
      <header className="sticky top-0 z-10 border-b"
        style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(8px)', borderColor: '#e4e4e7' }}>
        <div className="max-w-[900px] mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Star className="h-4 w-4 shrink-0" style={{ color: 'var(--color-primary)' }} />
            <span className="text-sm font-semibold truncate" style={{ color: '#18181b' }}>
              {resume.title || '简历'}
            </span>
            <span className="text-[11px] px-1.5 py-0.5 rounded shrink-0"
              style={{ background: '#f4f4f5', color: '#71717a' }}>
              在线简历
            </span>
          </div>
          <button onClick={() => window.print()}
            className="h-8 px-3 rounded-lg text-xs inline-flex items-center gap-1.5 shrink-0"
            style={{ background: 'var(--color-primary)', color: '#fff' }}>
            <Printer className="h-3.5 w-3.5" /> 打印 / 存为 PDF
          </button>
        </div>
      </header>

      <div className="max-w-[900px] mx-auto px-4 pt-6">
        <div className="resume-export overflow-x-auto">
          <ResumePreview resume={resume} scale={0.92} />
        </div>
        <p className="mt-4 text-center text-[11px]" style={{ color: '#a1a1aa' }}>
          由星图 · 面向求职者的智能人岗匹配与诊断系统生成
        </p>
      </div>
    </div>
  )
}
