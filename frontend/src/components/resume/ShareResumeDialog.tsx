import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Share2, X, Copy, Loader2, Eye, ShieldOff, Link2, Clock } from 'lucide-react'

const getToken = () => localStorage.getItem('xingtu_token') || ''
const withToken = (url: string) => `${url}${url.includes('?') ? '&' : '?'}token=${getToken()}`

interface ShareInfo {
  exists: boolean
  expired?: boolean
  token?: string
  visit_count?: number
  expire_at?: string
  created_at?: string
}

interface Props {
  resumeId: number
  resumeTitle: string
  onClose: () => void
  onToast: (msg: string) => void
}

const EXPIRE_OPTIONS = [
  { value: 0, label: '永久有效' },
  { value: 7, label: '7 天' },
  { value: 30, label: '30 天' },
]

export default function ShareResumeDialog({ resumeId, resumeTitle, onClose, onToast }: Props) {
  const [info, setInfo] = useState<ShareInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [expireDays, setExpireDays] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(withToken(`/api/resume-center/share-info/${resumeId}`))
      const d = await r.json()
      if (d.success) setInfo(d.data)
    } catch {
      onToast('分享状态读取失败')
    } finally {
      setLoading(false)
    }
  }, [resumeId, onToast])

  useEffect(() => { load() }, [load])

  const create = async () => {
    setBusy(true)
    try {
      const r = await fetch(withToken(`/api/resume-center/share/${resumeId}`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expire_days: expireDays }),
      })
      const d = await r.json()
      if (!d.success) { onToast(d.error?.message || '生成失败'); return }
      await load()
      onToast(d.data.reused ? '已复用现有链接' : '分享链接已生成')
    } catch {
      onToast('网络错误')
    } finally {
      setBusy(false)
    }
  }

  const revoke = async () => {
    if (!confirm('撤销后原链接立即失效，确定吗？')) return
    setBusy(true)
    try {
      const r = await fetch(withToken(`/api/resume-center/share/${resumeId}`), { method: 'DELETE' })
      const d = await r.json()
      if (!d.success) { onToast(d.error?.message || '撤销失败'); return }
      setInfo({ exists: false })
      onToast('分享已撤销')
    } catch {
      onToast('网络错误')
    } finally {
      setBusy(false)
    }
  }

  const link = info?.token ? `${window.location.origin}/share/${info.token}` : ''

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      onToast('链接已复制')
    } catch {
      onToast('复制失败，请手动选中复制')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={onClose}>
      <motion.div initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        className="w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: 'var(--color-surface-container-lowest)' }}
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--color-outline-variant)' }}>
          <div>
            <h3 className="text-base font-semibold flex items-center gap-2" style={{ color: 'var(--color-on-surface)' }}>
              <Share2 className="h-4 w-4" style={{ color: 'var(--accent-blue)' }} /> 分享简历
            </h3>
            <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--color-on-surface-variant)' }}>{resumeTitle}</p>
          </div>
          <button onClick={onClose} style={{ color: 'var(--color-on-surface-variant)' }}><X className="h-4 w-4" /></button>
        </div>

        <div className="px-6 py-5">
          {loading ? (
            <div className="flex items-center justify-center py-8 gap-2 text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
              <Loader2 className="h-4 w-4 animate-spin" /> 读取分享状态…
            </div>
          ) : info?.exists ? (
            <>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--color-on-surface-variant)' }} />
                  <input readOnly value={link}
                    className="w-full h-10 pl-9 pr-3 rounded-xl text-xs border outline-none"
                    style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface)', color: 'var(--color-on-surface)' }} />
                </div>
                <button onClick={copy} className="h-10 px-4 rounded-xl text-sm font-medium flex items-center gap-1.5"
                  style={{ background: 'var(--accent-blue)', color: '#fff' }}>
                  <Copy className="h-4 w-4" /> 复制
                </button>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl p-3" style={{ background: 'var(--color-surface-container)' }}>
                  <p className="text-[11px] flex items-center gap-1" style={{ color: 'var(--color-on-surface-variant)' }}>
                    <Eye className="h-3 w-3" /> 访问次数
                  </p>
                  <p className="text-xl font-bold tabular-nums mt-0.5" style={{ color: 'var(--color-on-surface)' }}>
                    {info.visit_count || 0}
                  </p>
                </div>
                <div className="rounded-xl p-3" style={{ background: 'var(--color-surface-container)' }}>
                  <p className="text-[11px] flex items-center gap-1" style={{ color: 'var(--color-on-surface-variant)' }}>
                    <Clock className="h-3 w-3" /> 有效期
                  </p>
                  <p className="text-sm font-semibold mt-1" style={{ color: 'var(--color-on-surface)' }}>
                    {info.expire_at || '永久有效'}
                  </p>
                </div>
              </div>

              <p className="mt-3 text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>
                拿到链接的人无需登录即可查看这份简历，分享记录会统计访问次数。
              </p>
            </>
          ) : (
            <>
              <p className="text-sm mb-3" style={{ color: 'var(--color-on-surface)' }}>选择链接有效期</p>
              <div className="flex gap-2">
                {EXPIRE_OPTIONS.map(o => (
                  <button key={o.value} onClick={() => setExpireDays(o.value)}
                    className="h-9 px-4 rounded-lg text-sm border transition-colors"
                    style={{
                      borderColor: expireDays === o.value ? 'var(--accent-blue)' : 'var(--color-outline-variant)',
                      background: expireDays === o.value ? 'var(--accent-blue-dim, #dbeafe)' : 'transparent',
                      color: expireDays === o.value ? 'var(--accent-blue)' : 'var(--color-on-surface-variant)',
                    }}>
                    {o.label}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-[11px] leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>
                生成后可以随时撤销；同一份简历再次分享会复用已有链接，不会重复生成。
              </p>
            </>
          )}
        </div>

        <div className="flex items-center justify-between px-6 py-3 border-t" style={{ borderColor: 'var(--color-outline-variant)' }}>
          {info?.exists ? (
            <button onClick={revoke} disabled={busy}
              className="text-xs flex items-center gap-1 disabled:opacity-50"
              style={{ color: 'var(--accent-red, #ef4444)' }}>
              <ShieldOff className="h-3.5 w-3.5" /> 撤销分享
            </button>
          ) : <span />}
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="h-9 px-4 rounded-lg text-sm border"
              style={{ borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface-variant)' }}>关闭</button>
            {!info?.exists && (
              <button onClick={create} disabled={busy}
                className="h-9 px-4 rounded-lg text-sm font-medium flex items-center gap-1.5 disabled:opacity-50"
                style={{ background: 'var(--accent-blue)', color: '#fff' }}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />} 生成链接
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  )
}
