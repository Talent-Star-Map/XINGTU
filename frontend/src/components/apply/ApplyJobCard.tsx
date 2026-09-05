import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, ExternalLink, Loader2, CheckCircle2, Building, X, PartyPopper } from 'lucide-react'
import { JSNav } from '../../lib/NavContext'

interface ApplyJob {
  id: number
  title: string
  company: string
}

interface ChannelData {
  onboarded: boolean
  source: string
  source_url: string
  jump_url?: string
  company: string
}

const getSeekerId = (): number | null => {
  try {
    const u = JSON.parse(localStorage.getItem('xingtu_user') || 'null')
    return u?.id ?? null
  } catch { return null }
}

export default function ApplyJobCard({ job }: { job: ApplyJob }) {
  const { setPage } = JSNav.use()
  const [applied, setApplied] = useState(false)
  const [checking, setChecking] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [tip, setTip] = useState('')

  // 弹窗类型：external=未入驻跳原网站；success=站内投递成功
  const [modal, setModal] = useState<null | { kind: 'external'; data: ChannelData } | { kind: 'success'; company: string }>(null)

  useEffect(() => {
    let cancelled = false
    const seekerId = getSeekerId()
    if (!seekerId) { if (!cancelled) setChecking(false); return }
    fetch(`/api/apply/status?job_id=${job.id}&jobseeker_id=${seekerId}`)
      .then(r => r.json())
      .then(d => { if (!cancelled && d.success) setApplied(!!d.data.applied) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setChecking(false) })
    return () => { cancelled = true }
  }, [job.id])

  const handleApply = async () => {
    const seekerId = getSeekerId()
    if (!seekerId) { setTip('请先登录后再投递'); return }
    setTip('')
    setSubmitting(true)
    try {
      // 先判渠道：未入驻 → 弹窗跳原网站；已入驻 → 直接站内投递
      const cr = await fetch(`/api/apply/channel/${job.id}`)
      const cd = await cr.json()
      if (!cd.success) { setTip(cd.error?.message || '投递渠道查询失败'); return }
      const channel: ChannelData = cd.data

      if (!channel.onboarded) {
        setModal({ kind: 'external', data: channel })
        return
      }

      const ar = await fetch(`/api/apply/${job.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobseeker_id: seekerId }),
      })
      const ad = await ar.json()
      if (ad.success) {
        setApplied(true)
        setModal({ kind: 'success', company: ad.data.company || channel.company })
      } else if (ad.error?.code === 'NOT_ONBOARDED') {
        setModal({ kind: 'external', data: { ...channel, onboarded: false } })
      } else {
        setTip(ad.error?.message || '投递失败，请稍后重试')
      }
    } catch {
      setTip('网络错误，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <div className="rounded-2xl border p-5" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
        <div className="flex items-center gap-2 mb-3">
          <Building className="h-4 w-4" style={{ color: 'var(--color-primary)' }} />
          <h3 className="text-sm font-bold" style={{ color: 'var(--color-on-surface)' }}>投递 / 联系</h3>
        </div>
        <p className="text-xs mb-4" style={{ color: 'var(--color-on-surface-variant)' }}>
          入驻企业可在站内直接投递并与 HR 沟通；未入驻企业将跳转到原招聘网站。
        </p>
        {tip && (
          <p className="text-xs mb-3" style={{ color: 'var(--accent-orange)' }}>{tip}</p>
        )}
        <button
          onClick={handleApply}
          disabled={checking || submitting || applied}
          className="w-full h-10 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
          style={{ background: applied ? 'var(--color-surface-container-high)' : 'var(--color-primary)', color: applied ? 'var(--color-on-surface-variant)' : 'white' }}
        >
          {checking || submitting
            ? <><Loader2 className="h-4 w-4 animate-spin" /> {submitting ? '投递中...' : '检查中...'}</>
            : applied
              ? <><CheckCircle2 className="h-4 w-4" /> 已投递 · 去消息页沟通</>
              : <><Send className="h-4 w-4" /> 去投递 / 联系</>}
        </button>
        {applied && (
          <button onClick={() => setPage('messages')}
            className="w-full h-9 mt-2 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1.5"
            style={{ borderColor: 'var(--color-outline-variant)', color: 'var(--color-primary)' }}>
            查看沟通消息
          </button>
        )}
      </div>

      {/* ── 弹窗：未入驻跳转 / 投递成功 ── */}
      <AnimatePresence>
        {modal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-8"
            style={{ background: 'rgba(0,0,0,0.5)' }}
            onClick={() => setModal(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="rounded-2xl border w-full max-w-md p-6 relative"
              style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface)' }}
              onClick={e => e.stopPropagation()}
            >
              <button onClick={() => setModal(null)} className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-[var(--color-surface-container-high)]">
                <X className="h-4 w-4" style={{ color: 'var(--color-on-surface-variant)' }} />
              </button>

              {modal.kind === 'external' ? (
                <>
                  <div className="flex items-center gap-2.5 mb-3">
                    <ExternalLink className="h-5 w-5" style={{ color: 'var(--accent-orange)' }} />
                    <h3 className="text-base font-bold" style={{ color: 'var(--color-on-surface)' }}>该企业未入驻星图</h3>
                  </div>
                  <p className="text-sm leading-relaxed mb-2" style={{ color: 'var(--color-on-surface-variant)' }}>
                    「{modal.data.company || job.company || job.title}」尚未入驻星图招聘系统，暂时无法站内沟通。
                    你可以前往原招聘网站完成投递：
                  </p>
                  <div className="rounded-lg px-4 py-3 mb-4 text-xs space-y-1.5" style={{ background: 'var(--color-surface-container-low)', color: 'var(--color-on-surface-variant)' }}>
                    <p>岗位：{job.title}</p>
                    <p>来源渠道：{modal.data.source || '未知'}</p>
                  </div>
                  {modal.data.source_url || modal.data.jump_url ? (
                    <a href={modal.data.jump_url || modal.data.source_url} target="_blank" rel="noopener noreferrer"
                      onClick={() => setModal(null)}
                      className="w-full h-10 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2"
                      style={{ background: 'var(--color-primary)' }}>
                      <ExternalLink className="h-4 w-4" /> 前往原网站投递
                    </a>
                  ) : (
                    <p className="text-xs text-center py-2" style={{ color: 'var(--color-on-surface-variant)' }}>
                      该岗位未采集到原始链接，请通过「{modal.data.source || '其他渠道'}」自行搜索投递
                    </p>
                  )}
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2.5 mb-3">
                    <PartyPopper className="h-5 w-5" style={{ color: 'var(--color-primary)' }} />
                    <h3 className="text-base font-bold" style={{ color: 'var(--color-on-surface)' }}>投递成功</h3>
                  </div>
                  <p className="text-sm leading-relaxed mb-5" style={{ color: 'var(--color-on-surface-variant)' }}>
                    简历与求职意向已发送给「{modal.company}」的 HR，对方回复后会出现在你的「消息」页。
                  </p>
                  <div className="flex gap-3">
                    <button onClick={() => { setModal(null); setPage('messages') }}
                      className="flex-1 h-10 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2"
                      style={{ background: 'var(--color-primary)' }}>
                      去消息页沟通
                    </button>
                    <button onClick={() => setModal(null)}
                      className="flex-1 h-10 rounded-lg text-sm font-semibold border"
                      style={{ borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface-variant)' }}>
                      继续浏览岗位
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
