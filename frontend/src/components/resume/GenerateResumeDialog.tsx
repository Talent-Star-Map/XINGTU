import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, X, Loader2, Wand2, Check, AlertTriangle, User, Briefcase, GraduationCap, Wrench } from 'lucide-react'
import { withToken } from '../../lib/authFetch'

interface Template { id: number; name: string; template_key: string }

/** 后端 GET /generate-context 的返回：会用到哪些资料、还缺什么 */
export interface GenerateContext {
  fullName: string; phone: string; email: string; city: string
  school: string; degree: string; targetPosition: string
  years: number | null
  skills: string[]; skillCount: number
  workCount: number; educationCount: number; projectCount: number
  filled: string[]; missing: string[]
  hasAny: boolean
  sourceResume: { id: number | null; title: string; aiGenerated?: boolean }
}

interface Props {
  templates: Template[]
  templateName: (key: string) => string
  onClose: () => void
  onToast: (msg: string) => void
  onGenerated: (resume: any, warnings: string[]) => void
}

/**
 * AI 生成简历弹窗
 *
 * 与旧版最大的区别：旧版只把岗位/年限/技能发给模型，姓名公司学校全是模型编的。
 * 现在先拉一份「会用到哪些资料」的预览，目标岗位/年限/技能用账号资料预填，
 * 生成结果的事实层也全部来自资料；「AI 润色」由用户自己决定开不开。
 */
export default function GenerateResumeDialog({ templates, templateName, onClose, onToast, onGenerated }: Props) {
  const [ctx, setCtx] = useState<GenerateContext | null>(null)
  const [loadingCtx, setLoadingCtx] = useState(true)
  const [form, setForm] = useState({
    job_title: '', years_of_experience: 0, skills: '', industry: '', template_key: 'classic',
  })
  const [polish, setPolish] = useState(true)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const r = await fetch(withToken('/api/resume-center/generate-context'))
        const d = await r.json()
        if (!alive) return
        if (d.success) {
          const c: GenerateContext = d.data
          setCtx(c)
          // 用已有资料预填，用户仍可改
          setForm(f => ({
            ...f,
            job_title: c.targetPosition || '',
            years_of_experience: c.years ?? 0,
            skills: c.skills.slice(0, 12).join(', '),
          }))
        } else {
          onToast(d.error?.message || '读取资料失败')
        }
      } catch {
        if (alive) onToast('读取资料失败，可继续生成')
      } finally {
        if (alive) setLoadingCtx(false)
      }
    })()
    return () => { alive = false }
  }, [])

  const summaryChips = useMemo(() => {
    if (!ctx) return []
    return [
      { icon: User, label: '姓名', value: ctx.fullName },
      { icon: User, label: '联系方式', value: [ctx.phone, ctx.email].filter(Boolean).join(' / ') },
      { icon: GraduationCap, label: '学校学历', value: [ctx.school, ctx.degree].filter(Boolean).join(' ') },
      { icon: Briefcase, label: '工作经历', value: ctx.workCount ? `${ctx.workCount} 段` : '' },
      { icon: Wrench, label: '技能', value: ctx.skillCount ? `${ctx.skillCount} 项` : '' },
    ]
  }, [ctx])

  const submit = async () => {
    if (!form.job_title.trim()) { onToast('请填写目标岗位'); return }
    setGenerating(true)
    try {
      const r = await fetch(withToken('/api/resume-center/generate'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_title: form.job_title,
          years_of_experience: form.years_of_experience,
          skills: form.skills.split(/[,，、]/).map(s => s.trim()).filter(Boolean),
          industry: form.industry,
          language: 'zh',
          template_key: form.template_key,
          polish,
        }),
      })
      const d = await r.json()
      if (d.success) {
        onGenerated(d.data, d.warnings || [])
      } else {
        onToast(d.error?.message || '生成失败')
      }
    } catch {
      onToast('网络错误')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}>
      <motion.div initial={{ scale: 0.96, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 10 }}
        className="w-full max-w-xl rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
        style={{ background: 'var(--color-surface-container-lowest)' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold flex items-center gap-2" style={{ color: 'var(--color-on-surface)' }}>
              <Sparkles className="h-4 w-4" style={{ color: 'var(--color-primary)' }} /> AI 生成简历
            </h3>
            <p className="text-xs mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>
              内容取自你的账号资料与已有简历，不会编造姓名、公司或学历
            </p>
          </div>
          <button onClick={onClose} style={{ color: 'var(--color-on-surface-variant)' }}><X className="h-4 w-4" /></button>
        </div>

        {/* ── 资料预览 ── */}
        <div className="rounded-xl border p-3 mb-4" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface)' }}>
          {loadingCtx ? (
            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> 正在读取你的资料…
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium" style={{ color: 'var(--color-on-surface)' }}>将使用这些资料</span>
                {ctx?.sourceResume?.title && (
                  <span className="text-[10px]" style={{ color: 'var(--color-on-surface-variant)' }}>
                    含已有简历「{ctx.sourceResume.title}」
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {summaryChips.map(({ icon: Icon, label, value }) => (
                  <span key={label} className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg"
                    style={{
                      background: value ? 'var(--accent-cyan-dim)' : 'var(--color-surface-container-high)',
                      color: value ? 'var(--color-primary)' : 'var(--color-on-surface-variant)',
                    }}>
                    <Icon className="h-3 w-3" />
                    {value ? `${label}：${value}` : `无${label}`}
                  </span>
                ))}
              </div>
              {ctx?.sourceResume?.aiGenerated && (
                <p className="text-[11px] mt-2 flex items-start gap-1" style={{ color: '#b45309' }}>
                  <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                  「{ctx.sourceResume.title}」是此前 AI 生成的，其中的经历与数字请自行核对，确认无误再用于投递
                </p>
              )}
              {ctx && ctx.missing.filter(m => m !== '目标岗位').length > 0 && (
                <p className="text-[11px] mt-2 flex items-start gap-1" style={{ color: '#b45309' }}>
                  <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                  缺少 {ctx.missing.filter(m => m !== '目标岗位').join('、')}，对应区块会留空，生成后可在编辑器里补
                </p>
              )}
              {ctx && !ctx.hasAny && (
                <p className="text-[11px] mt-2 flex items-start gap-1" style={{ color: '#b45309' }}>
                  <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                  账号里还没有任何资料，这次只能生成空白框架。建议先到「我的资料」填写姓名、联系方式、学校与经历
                </p>
              )}
            </>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--color-on-surface-variant)' }}>目标岗位 *</label>
            <input value={form.job_title} onChange={e => setForm({ ...form, job_title: e.target.value })}
              placeholder="如 AI应用开发工程师" className="w-full h-9 px-3 rounded-lg text-sm border outline-none"
              style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface)', color: 'var(--color-on-surface)' }} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--color-on-surface-variant)' }}>经验年限</label>
              <select value={form.years_of_experience} onChange={e => setForm({ ...form, years_of_experience: Number(e.target.value) })}
                className="w-full h-9 px-3 rounded-lg text-sm border outline-none"
                style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface)', color: 'var(--color-on-surface)' }}>
                {[0, 1, 2, 3, 5, 8].map(y => <option key={y} value={y}>{y === 0 ? '应届生' : `${y} 年`}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--color-on-surface-variant)' }}>行业</label>
              <input value={form.industry} onChange={e => setForm({ ...form, industry: e.target.value })}
                placeholder="如 人工智能" className="w-full h-9 px-3 rounded-lg text-sm border outline-none"
                style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface)', color: 'var(--color-on-surface)' }} />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--color-on-surface-variant)' }}>
              技能 <span className="font-normal opacity-70">（已从资料带入，可增删）</span>
            </label>
            <input value={form.skills} onChange={e => setForm({ ...form, skills: e.target.value })}
              placeholder="如 Python, RAG, LangChain" className="w-full h-9 px-3 rounded-lg text-sm border outline-none"
              style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface)', color: 'var(--color-on-surface)' }} />
          </div>
          <div>
            <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--color-on-surface-variant)' }}>模板</label>
            <select value={form.template_key} onChange={e => setForm({ ...form, template_key: e.target.value })}
              className="w-full h-9 px-3 rounded-lg text-sm border outline-none"
              style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface)', color: 'var(--color-on-surface)' }}>
              {templates.map(t => <option key={t.id} value={t.template_key}>{templateName(t.template_key)}</option>)}
            </select>
          </div>

          {/* ── AI 润色开关（用户自主选择） ── */}
          <button type="button" role="switch" aria-checked={polish} onClick={() => setPolish(v => !v)}
            className="w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-colors"
            style={{
              borderColor: polish ? 'var(--color-primary)' : 'var(--color-outline-variant)',
              background: polish ? 'var(--accent-cyan-dim)' : 'transparent',
            }}>
            <span className="mt-0.5 w-8 h-4.5 rounded-full p-0.5 flex items-center shrink-0 transition-colors"
              style={{ background: polish ? 'var(--color-primary)' : 'var(--color-outline-variant)', height: 18 }}>
              <span className="block rounded-full bg-white transition-transform"
                style={{ width: 14, height: 14, transform: polish ? 'translateX(14px)' : 'translateX(0)' }} />
            </span>
            <span className="flex-1">
              <span className="flex items-center gap-1.5 text-sm font-medium" style={{ color: 'var(--color-on-surface)' }}>
                AI 润色措辞
                {polish && <Check className="h-3.5 w-3.5" style={{ color: 'var(--color-primary)' }} />}
              </span>
              <span className="block text-[11px] mt-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>
                {polish
                  ? '只改写表达方式，姓名/公司/学校/时间与业绩数字都和资料一致；不合规的句子会被丢弃'
                  : '关闭后直接使用你的资料原文，不调用模型'}
              </span>
            </span>
          </button>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="h-9 px-4 rounded-lg text-sm border"
            style={{ borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface-variant)' }}>取消</button>
          <button onClick={submit} disabled={generating}
            className="h-9 px-4 rounded-lg text-sm font-medium flex items-center gap-1.5 disabled:opacity-60"
            style={{ background: 'var(--color-primary)', color: '#fff' }}>
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            {generating ? '生成中…' : '生成简历'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
