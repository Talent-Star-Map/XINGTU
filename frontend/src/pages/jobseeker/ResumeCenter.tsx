import { useState, useEffect, useCallback, useMemo } from 'react'
import { Search, LayoutGrid, List, Plus, Wand2, Pencil, Trash2, Share2, Copy, Loader2, Sparkles, FileText, X, Check } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { ResumePreview } from '../../components/resume/ResumePreview'

// ─── token 注入 ───
const getToken = () => localStorage.getItem('xingtu_token') || ''
const withToken = (url: string) => `${url}${url.includes('?') ? '&' : '?'}token=${getToken()}`

// ─── 类型 ───
interface Template { id: number; name: string; template_key: string; category: string; thumbnail: string }
interface ResumeSection { id?: number; section_type: string; title: string; content: any; sort_order: number; visible: number }
interface ResumeItem { id: number; title: string; template_key: string; language: string; created_at: string; sections: ResumeSection[] }

type SortOption = 'lastEdited' | 'created' | 'nameAsc' | 'nameDesc'
type ViewMode = 'grid' | 'list'

const VIEW_PREF_KEY = 'xingtu_resume_view'

function sortResumes(resumes: ResumeItem[], sort: SortOption): ResumeItem[] {
  const sorted = [...resumes]
  switch (sort) {
    case 'created': return sorted.sort((a, b) => b.id - a.id)
    case 'nameAsc': return sorted.sort((a, b) => a.title.localeCompare(b.title))
    case 'nameDesc': return sorted.sort((a, b) => b.title.localeCompare(a.title))
    default: return sorted.sort((a, b) => b.id - a.id) // lastEdited
  }
}

// ─── 纯 CSS 模板缩略图（仿 JadeAI，用线框示意模板布局） ───
function TemplateThumb({ template }: { template: string }) {
  const isSidebar = ['sidebar', 'two-column'].includes(template)
  const isModern = ['modern', 'clean', 'minimal', 'nordic', 'gradient'].includes(template)
  const isBold = ['bold', 'blocks', 'mosaic', 'zigzag', 'ribbon'].includes(template)
  return (
    <div className={`flex h-full w-full ${isSidebar ? 'flex-row' : 'flex-col'} ${isModern ? 'p-2' : 'p-2.5'}`}>
      {isSidebar && <div className="w-6 shrink-0 bg-zinc-300 dark:bg-zinc-600" style={{ marginRight: 6 }} />}
      <div className="flex-1 min-w-0">
        {/* 头部 */}
        <div className={`mb-1.5 ${isModern ? 'pb-1' : 'border-b-2 pb-1.5'} ${isBold ? 'border-zinc-900 dark:border-zinc-100' : 'border-zinc-700'}`}>
          <div className={`mx-auto rounded-full ${isModern ? 'h-1.5 w-10 bg-zinc-800 dark:bg-zinc-200' : 'h-1.5 w-12 bg-zinc-700'}`} />
          <div className="mx-auto mt-1 h-1 w-8 rounded-full bg-zinc-400" />
          <div className="mx-auto mt-0.5 flex justify-center gap-1">
            <div className="h-0.5 w-4 rounded-full bg-zinc-300" />
            <div className="h-0.5 w-4 rounded-full bg-zinc-300" />
          </div>
        </div>
        {/* 正文行 */}
        <div className="space-y-1.5">
          {[10, 8, 9, 6, 8].map((w, i) => (
            <div key={i}>
              <div className="h-1 w-6 rounded-full bg-zinc-500" />
              <div className="mt-0.5 space-y-0.5">
                <div className={`h-0.5 rounded-full bg-zinc-200 dark:bg-zinc-600`} style={{ width: `${w}0%` }} />
                <div className="h-0.5 w-3/4 rounded-full bg-zinc-200 dark:bg-zinc-600" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function ResumeCenter() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [resumes, setResumes] = useState<ResumeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [toastTimer, setToastTimer] = useState<any>(null)

  // 搜索/排序/视图
  const [searchQuery, setSearchQuery] = useState('')
  const [sortOption, setSortOption] = useState<SortOption>('lastEdited')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')

  // 新建/AI 生成弹窗
  const [createOpen, setCreateOpen] = useState(false)
  const [genOpen, setGenOpen] = useState(false)
  const [genForm, setGenForm] = useState({ job_title: '', years_of_experience: 3, skills: '', industry: '', template_key: 'classic' })
  const [generating, setGenerating] = useState(false)

  // 分享
  const [shareOpen, setShareOpen] = useState(false)
  const [shareLink, setShareLink] = useState('')

  // 当前编辑中的简历（进编辑器）
  const [editing, setEditing] = useState<ResumeItem | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    if (toastTimer) clearTimeout(toastTimer)
    setToastTimer(setTimeout(() => setToast(''), 3000))
  }

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [tr, mr] = await Promise.all([
        fetch(withToken('/api/resume-center/templates/list')),
        fetch(withToken('/api/resume-center/list')),
      ])
      const td = await tr.json(); const md = await mr.json()
      if (td.success) setTemplates(td.data)
      if (md.success) setResumes(md.data)
    } catch { showToast('网络错误') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  // 视图偏好持久化
  useEffect(() => {
    const stored = localStorage.getItem(VIEW_PREF_KEY)
    if (stored === 'list' || stored === 'grid') setViewMode(stored)
  }, [])
  const handleViewChange = (mode: ViewMode) => { setViewMode(mode); localStorage.setItem(VIEW_PREF_KEY, mode) }

  // 筛选 + 排序
  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const list = q ? resumes.filter(r => r.title.toLowerCase().includes(q) || r.template_key.toLowerCase().includes(q)) : resumes
    return sortResumes(list, sortOption)
  }, [resumes, searchQuery, sortOption])

  // ── 新建空简历 ──
  const createResume = async (templateKey: string) => {
    try {
      const r = await fetch(withToken('/api/resume-center'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '未命名简历', template_key: templateKey }),
      })
      const d = await r.json()
      if (d.success) { showToast('简历已创建'); setCreateOpen(false); setEditing(d.data); await loadAll() }
      else showToast(d.error?.message || '创建失败')
    } catch { showToast('网络错误') }
  }

  // ── AI 生成简历 ──
  const submitGenerate = async () => {
    if (!genForm.job_title.trim()) { showToast('请填写岗位名称'); return }
    setGenerating(true)
    try {
      const r = await fetch(withToken('/api/resume-center/generate'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_title: genForm.job_title, years_of_experience: genForm.years_of_experience,
          skills: genForm.skills.split(/[,，、]/).map(s => s.trim()).filter(Boolean),
          industry: genForm.industry, language: 'zh', template_key: genForm.template_key,
        }),
      })
      const d = await r.json()
      if (d.success) { showToast(d.message || 'AI 简历生成成功'); setGenOpen(false); setEditing(d.data); await loadAll() }
      else showToast(d.error?.message || '生成失败')
    } catch { showToast('网络错误') }
    finally { setGenerating(false) }
  }

  // ── 删除 ──
  const deleteResume = async (id: number) => {
    if (!confirm('确定删除这份简历吗？')) return
    try {
      const r = await fetch(withToken(`/api/resume-center/${id}`), { method: 'DELETE' })
      const d = await r.json()
      if (d.success) { showToast('简历已删除'); if (editing?.id === id) setEditing(null); await loadAll() }
      else showToast(d.error?.message || '删除失败')
    } catch { showToast('网络错误') }
  }

  // ── 分享 ──
  const shareResume = async (id: number) => {
    try {
      const r = await fetch(withToken(`/api/resume-center/share/${id}`), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      const d = await r.json()
      if (d.success) {
        const link = `${window.location.origin}/share/${d.data.token}`
        setShareLink(link)
        setShareOpen(true)
      } else showToast(d.error?.message || '生成分享失败')
    } catch { showToast('网络错误') }
  }

  const copyShare = async () => {
    try { await navigator.clipboard.writeText(shareLink); showToast('已复制到剪贴板') } catch { showToast('复制失败，请手动复制') }
  }

  // 模板名
  const templateName = (key: string) => templates.find(t => t.template_key === key)?.name || key

  // ── 编辑器视图（编辑单份简历） ──
  if (editing) {
    return (
      <EditorView
        resume={editing}
        templates={templates}
        onBack={() => setEditing(null)}
        onSave={async (r) => {
          try {
            const resp = await fetch(withToken(`/api/resume-center/${r.id}`), {
              method: 'PUT', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ title: r.title, template_key: r.template_key, sections: r.sections }),
            })
            const d = await resp.json()
            if (d.success) { showToast('简历已保存'); await loadAll() } else showToast(d.error?.message || '保存失败')
          } catch { showToast('网络错误') }
        }}
      />
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* ── 顶部操作栏 ── */}
      <header className="shrink-0 border-b" style={{ borderColor: 'var(--color-outline-variant)' }}>
        <div className="max-w-[1400px] mx-auto px-8 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5" style={{ color: 'var(--accent-blue)' }} />
            <h1 className="text-lg font-semibold" style={{ color: 'var(--color-on-surface)' }}>简历工作台</h1>
            <span className="text-xs tabular-nums px-2 py-0.5 rounded-full"
              style={{ background: 'var(--accent-blue-dim, #dbeafe)', color: 'var(--accent-blue, #3b82f6)' }}>
              共 {resumes.length} 份
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setGenOpen(true)} data-tour="dash-ai-generate"
              className="h-9 px-4 rounded-lg text-sm font-medium flex items-center gap-1.5"
              style={{ background: 'var(--accent-blue)', color: '#fff' }}>
              <Wand2 className="h-4 w-4" /> AI 生成简历
            </button>
            <button onClick={() => setCreateOpen(true)} data-tour="dash-create"
              className="h-9 px-4 rounded-lg text-sm font-medium flex items-center gap-1.5 border"
              style={{ borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface-variant)' }}>
              <Plus className="h-4 w-4" /> 新建
            </button>
          </div>
        </div>
      </header>

      {/* ── 工具栏（搜索/排序/视图切换） ── */}
      <div className="shrink-0 border-b" style={{ borderColor: 'var(--color-outline-variant)' }}>
        <div className="max-w-[1400px] mx-auto px-8 py-3 flex items-center justify-between gap-3">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--color-on-surface-variant)' }} />
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="搜索简历…"
              className="w-full h-9 pl-9 pr-3 rounded-lg text-sm border outline-none"
              style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface)', color: 'var(--color-on-surface)' }} />
          </div>
          <div className="flex items-center gap-2">
            <select value={sortOption} onChange={e => setSortOption(e.target.value as SortOption)}
              className="h-9 px-3 rounded-lg text-sm border outline-none"
              style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface)', color: 'var(--color-on-surface)' }}>
              <option value="lastEdited">最近编辑</option>
              <option value="created">最新创建</option>
              <option value="nameAsc">名称 A-Z</option>
              <option value="nameDesc">名称 Z-A</option>
            </select>
            <div className="flex items-center border rounded-lg overflow-hidden" style={{ borderColor: 'var(--color-outline-variant)' }}>
              <button onClick={() => handleViewChange('grid')}
                className="h-9 w-9 flex items-center justify-center"
                style={{ background: viewMode === 'grid' ? 'var(--accent-blue-dim, #dbeafe)' : 'transparent', color: viewMode === 'grid' ? 'var(--accent-blue, #3b82f6)' : 'var(--color-on-surface-variant)' }}>
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button onClick={() => handleViewChange('list')}
                className="h-9 w-9 flex items-center justify-center"
                style={{ background: viewMode === 'list' ? 'var(--accent-blue-dim, #dbeafe)' : 'transparent', color: viewMode === 'list' ? 'var(--accent-blue, #3b82f6)' : 'var(--color-on-surface-variant)' }}>
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── 内容区 ── */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-[1400px] mx-auto px-8 py-6">
          {loading ? (
            <div className="flex items-center justify-center h-40"><Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--accent-blue)' }} /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-30" style={{ color: 'var(--color-on-surface-variant)' }} />
              <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>{searchQuery ? '没有匹配的简历' : '还没有简历，点击右上角「AI 生成简历」创建'}</p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {filtered.map(r => (
                <ResumeCard key={r.id} resume={r} templateName={templateName(r.template_key)}
                  onEdit={() => setEditing(r)} onDelete={() => deleteResume(r.id)} onShare={() => shareResume(r.id)} />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(r => (
                <ResumeListItem key={r.id} resume={r} templateName={templateName(r.template_key)}
                  onEdit={() => setEditing(r)} onDelete={() => deleteResume(r.id)} onShare={() => shareResume(r.id)} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── 新建弹窗 ── */}
      <AnimatePresence>
        {createOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}
            onClick={() => setCreateOpen(false)}>
            <motion.div initial={{ scale: 0.96, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 10 }}
              className="w-full max-w-2xl rounded-2xl p-6 shadow-2xl" style={{ background: 'var(--color-surface-container-lowest)' }}
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold" style={{ color: 'var(--color-on-surface)' }}>选择模板新建简历</h3>
                <button onClick={() => setCreateOpen(false)} style={{ color: 'var(--color-on-surface-variant)' }}><X className="h-4 w-4" /></button>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 max-h-[60vh] overflow-auto">
                {templates.map(t => (
                  <button key={t.id} onClick={() => createResume(t.template_key)}
                    className="rounded-xl border p-2 text-center transition-all hover:-translate-y-0.5 hover:shadow-lg"
                    style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface)' }}>
                    <div className="rounded-lg bg-white dark:bg-zinc-700 h-28 overflow-hidden ring-1 ring-zinc-200/50">
                      <TemplateThumb template={t.template_key} />
                    </div>
                    <div className="mt-1.5 text-xs truncate" style={{ color: 'var(--color-on-surface)' }}>{t.name}</div>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── AI 生成弹窗 ── */}
      <AnimatePresence>
        {genOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}
            onClick={() => setGenOpen(false)}>
            <motion.div initial={{ scale: 0.96, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 10 }}
              className="w-full max-w-lg rounded-2xl p-6 shadow-2xl" style={{ background: 'var(--color-surface-container-lowest)' }}
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-base font-semibold flex items-center gap-2" style={{ color: 'var(--color-on-surface)' }}>
                  <Sparkles className="h-4 w-4" style={{ color: 'var(--accent-blue)' }} /> AI 生成简历
                </h3>
                <button onClick={() => setGenOpen(false)} style={{ color: 'var(--color-on-surface-variant)' }}><X className="h-4 w-4" /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--color-on-surface-variant)' }}>目标岗位 *</label>
                  <input value={genForm.job_title} onChange={e => setGenForm({ ...genForm, job_title: e.target.value })}
                    placeholder="如 AI应用开发工程师" className="w-full h-9 px-3 rounded-lg text-sm border outline-none"
                    style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface)', color: 'var(--color-on-surface)' }} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--color-on-surface-variant)' }}>经验年限</label>
                    <select value={genForm.years_of_experience} onChange={e => setGenForm({ ...genForm, years_of_experience: Number(e.target.value) })}
                      className="w-full h-9 px-3 rounded-lg text-sm border outline-none"
                      style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface)', color: 'var(--color-on-surface)' }}>
                      {[0,1,2,3,5,8].map(y => <option key={y} value={y}>{y === 0 ? '应届生' : `${y} 年`}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--color-on-surface-variant)' }}>行业</label>
                    <input value={genForm.industry} onChange={e => setGenForm({ ...genForm, industry: e.target.value })}
                      placeholder="如 人工智能" className="w-full h-9 px-3 rounded-lg text-sm border outline-none"
                      style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface)', color: 'var(--color-on-surface)' }} />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--color-on-surface-variant)' }}>已有技能（逗号分隔）</label>
                  <input value={genForm.skills} onChange={e => setGenForm({ ...genForm, skills: e.target.value })}
                    placeholder="如 Python, RAG, LangChain" className="w-full h-9 px-3 rounded-lg text-sm border outline-none"
                    style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface)', color: 'var(--color-on-surface)' }} />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--color-on-surface-variant)' }}>模板</label>
                  <select value={genForm.template_key} onChange={e => setGenForm({ ...genForm, template_key: e.target.value })}
                    className="w-full h-9 px-3 rounded-lg text-sm border outline-none"
                    style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface)', color: 'var(--color-on-surface)' }}>
                    {templates.map(t => <option key={t.id} value={t.template_key}>{t.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button onClick={() => setGenOpen(false)} className="h-9 px-4 rounded-lg text-sm border"
                  style={{ borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface-variant)' }}>取消</button>
                <button onClick={submitGenerate} disabled={generating}
                  className="h-9 px-4 rounded-lg text-sm font-medium flex items-center gap-1.5 disabled:opacity-60"
                  style={{ background: 'var(--accent-blue)', color: '#fff' }}>
                  {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                  {generating ? '生成中…' : '生成简历'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 分享弹窗 ── */}
      <AnimatePresence>
        {shareOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}
            onClick={() => setShareOpen(false)}>
            <motion.div initial={{ scale: 0.96, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 10 }}
              className="w-full max-w-md rounded-2xl p-6 shadow-2xl" style={{ background: 'var(--color-surface-container-lowest)' }}
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold flex items-center gap-2" style={{ color: 'var(--color-on-surface)' }}>
                  <Share2 className="h-4 w-4" style={{ color: 'var(--accent-blue)' }} /> 分享简历
                </h3>
                <button onClick={() => setShareOpen(false)} style={{ color: 'var(--color-on-surface-variant)' }}><X className="h-4 w-4" /></button>
              </div>
              <div className="flex items-center gap-2">
                <input value={shareLink} readOnly className="flex-1 h-9 px-3 rounded-lg text-sm border outline-none"
                  style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface)', color: 'var(--color-on-surface)' }} />
                <button onClick={copyShare} className="h-9 px-3 rounded-lg text-sm font-medium flex items-center gap-1"
                  style={{ background: 'var(--accent-blue)', color: '#fff' }}>
                  <Copy className="h-4 w-4" /> 复制
                </button>
              </div>
              <p className="text-xs mt-3" style={{ color: 'var(--color-on-surface-variant)' }}>任何有链接的人都可以查看这份简历</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Toast ── */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg text-sm shadow-lg"
            style={{ background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface)' }}>
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── 简历卡片（网格视图） ───
function ResumeCard({ resume, templateName, onEdit, onDelete, onShare }: {
  resume: ResumeItem; templateName: string; onEdit: () => void; onDelete: () => void; onShare: () => void
}) {
  return (
    <div className="group relative overflow-hidden rounded-xl border transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
      style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
      {/* 模板缩略图 */}
      <div className="relative border-b p-2.5" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container)' }}>
        <div className="mx-auto h-[110px] w-[80px] bg-white dark:bg-zinc-700 rounded shadow-sm ring-1 ring-zinc-200/50 overflow-hidden">
          <TemplateThumb template={resume.template_key} />
        </div>
        {/* 悬停操作 */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100"
          style={{ background: 'rgba(0,0,0,0.25)' }}>
          <button onClick={onEdit} className="mx-1 p-2 rounded-lg bg-white text-zinc-700 hover:bg-zinc-100">
            <Pencil className="h-4 w-4" />
          </button>
          <button onClick={onShare} className="mx-1 p-2 rounded-lg bg-white text-zinc-700 hover:bg-zinc-100">
            <Share2 className="h-4 w-4" />
          </button>
          <button onClick={onDelete} className="mx-1 p-2 rounded-lg bg-white text-red-500 hover:bg-red-50">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      {/* 信息 */}
      <div className="p-2.5">
        <div className="text-sm font-medium truncate" style={{ color: 'var(--color-on-surface)' }}>{resume.title}</div>
        <div className="text-xs mt-0.5 flex items-center justify-between" style={{ color: 'var(--color-on-surface-variant)' }}>
          <span className="truncate">{templateName}</span>
          <span className="shrink-0 ml-1">{resume.created_at?.slice(0, 10)}</span>
        </div>
      </div>
    </div>
  )
}

// ─── 简历列表项（列表视图） ───
function ResumeListItem({ resume, templateName, onEdit, onDelete, onShare }: {
  resume: ResumeItem; templateName: string; onEdit: () => void; onDelete: () => void; onShare: () => void
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors hover:bg-black/5"
      style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
      <div className="w-9 h-11 bg-white dark:bg-zinc-700 rounded ring-1 ring-zinc-200/50 overflow-hidden shrink-0">
        <TemplateThumb template={resume.template_key} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate" style={{ color: 'var(--color-on-surface)' }}>{resume.title}</div>
        <div className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>{templateName} · {resume.created_at?.slice(0, 10)}</div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button onClick={onEdit} className="p-1.5 rounded-lg hover:opacity-70" style={{ color: 'var(--color-on-surface-variant)' }}><Pencil className="h-4 w-4" /></button>
        <button onClick={onShare} className="p-1.5 rounded-lg hover:opacity-70" style={{ color: 'var(--color-on-surface-variant)' }}><Share2 className="h-4 w-4" /></button>
        <button onClick={onDelete} className="p-1.5 rounded-lg hover:opacity-70" style={{ color: 'var(--accent-red)' }}><Trash2 className="h-4 w-4" /></button>
      </div>
    </div>
  )
}

// ─── 编辑器视图 ───
function EditorView({ resume, templates, onBack, onSave }: {
  resume: ResumeItem; templates: Template[]; onBack: () => void; onSave: (r: ResumeItem) => Promise<void>
}) {
  const [r, setR] = useState<ResumeItem>(resume)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)

  const updateContent = (idx: number, content: any) => {
    setR(prev => ({ ...prev, sections: prev.sections.map((s, i) => i === idx ? { ...s, content } : s) }))
  }

  return (
    <div className="h-full flex flex-col">
      <header className="shrink-0 border-b" style={{ borderColor: 'var(--color-outline-variant)' }}>
        <div className="max-w-[1400px] mx-auto px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={onBack} className="p-2 rounded-lg hover:opacity-70" style={{ color: 'var(--color-on-surface-variant)' }}><X className="h-4 w-4" /></button>
            <input value={r.title} onChange={e => setR({ ...r, title: e.target.value })}
              className="h-8 px-2 rounded text-sm font-medium bg-transparent outline-none w-64"
              style={{ color: 'var(--color-on-surface)' }} />
          </div>
          <div className="flex items-center gap-2">
            <select value={r.template_key} onChange={e => setR({ ...r, template_key: e.target.value })}
              className="h-8 px-2 rounded-lg text-xs border outline-none"
              style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface)', color: 'var(--color-on-surface)' }}>
              {templates.map(t => <option key={t.id} value={t.template_key}>{t.name}</option>)}
            </select>
            <button onClick={() => setEditing(!editing)} className="h-8 px-3 rounded-lg text-xs font-medium border"
              style={{ borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface-variant)' }}>
              {editing ? '预览' : '编辑'}
            </button>
            <button onClick={async () => { setSaving(true); await onSave(r); setSaving(false) }} disabled={saving}
              className="h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1 disabled:opacity-60"
              style={{ background: 'var(--accent-green)', color: '#fff' }}>
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} 保存
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-auto">
        <div className="max-w-[1000px] mx-auto px-8 py-6">
          {editing ? (
            <div className="space-y-4">
              {r.sections.map((s, idx) => (
                <SectionEditor key={idx} section={s} onChange={c => updateContent(idx, c)} />
              ))}
            </div>
          ) : (
            // 预览模式：不再嵌套带阴影/圆角的卡片，ResumePreview 内部已自带 A4 纸张样式
            // （width:210mm + minHeight:297mm + bg-white + shadow-lg）。去掉外层 overflow-hidden
            // 避免内容超出 297mm 时被裁切；超出部分由父级 overflow-auto 提供滚动。
            <div className="py-4">
              <ResumePreview resume={r} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── 区块编辑器 ───
function SectionEditor({ section, onChange }: { section: ResumeSection; onChange: (c: any) => void }) {
  const [json, setJson] = useState(JSON.stringify(section.content || {}, null, 2))
  return (
    <div className="rounded-xl border p-4" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium" style={{ color: 'var(--color-on-surface)' }}>{section.title} <span className="text-xs ml-1 opacity-60">{section.section_type}</span></div>
      </div>
      <textarea value={json} onChange={e => { setJson(e.target.value); try { onChange(JSON.parse(e.target.value)) } catch {} }}
        rows={6} className="w-full p-3 rounded-lg text-xs font-mono border outline-none"
        style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface)', color: 'var(--color-on-surface)' }} />
    </div>
  )
}
