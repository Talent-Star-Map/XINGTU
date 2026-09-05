import { useState, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Search, LayoutGrid, List, Plus, Wand2, Pencil, Trash2, Share2, Copy, Loader2, Sparkles, FileText, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import ResumeEditor from '../../components/resume/editor/ResumeEditor'
import type { EditorResume, EditorSection } from '../../components/resume/editor/types'

// ─── token 注入 ───
const getToken = () => localStorage.getItem('xingtu_token') || ''
const withToken = (url: string) => `${url}${url.includes('?') ? '&' : '?'}token=${getToken()}`

// ─── 类型 ───
interface Template { id: number; name: string; template_key: string; category: string; thumbnail: string }
// 复用编辑器的 section 形状：后端返回 snake_case 字段，与 types/resume.ts 的领域模型不是一回事。
// 之前这里另起一份同名 ResumeSection，导致两份类型互不相容（TS2719）。
type ResumeSection = EditorSection
/** 列表里的简历 id 来自后端自增主键，一定是数字（新建草稿在保存后才会拿到真实 id） */
type ResumeItem = Omit<EditorResume, 'id'> & {
  id: number
  updated_at?: string  // 后端 _resume_to_dict 在 2026-09-05 简历工作台重命名功能里补返
}

type SortOption = 'lastEdited' | 'created' | 'nameAsc' | 'nameDesc'
type ViewMode = 'grid' | 'list'

const VIEW_PREF_KEY = 'xingtu_resume_view'

// ─── 新建空简历时默认插入的 5 个区块(让侧栏"简历模块"非空) ────────────
const EMPTY_PERSONAL = {
  fullName: '', jobTitle: '', age: '', gender: '', politicalStatus: '',
  ethnicity: '', hometown: '', maritalStatus: '', yearsOfExperience: '',
  educationLevel: '', email: '', phone: '', wechat: '', location: '',
  website: '', linkedin: '', github: '',
}
const NEW_RESUME_DEFAULT_SECTIONS: { section_type: string; title: string; content: any }[] = [
  { section_type: 'personal_info', title: '个人信息',  content: EMPTY_PERSONAL },
  { section_type: 'summary',       title: '个人简介',  content: { text: '' } },
  { section_type: 'education',     title: '教育背景',  content: { items: [] } },
  { section_type: 'skills',        title: '技能特长',  content: { categories: [] } },
  { section_type: 'projects',      title: '项目经历',  content: { items: [] } },
]

/** 给一份新简历构造默认区块,带上 sort_order 和临时 id,塞到编辑 state 里
 *  temp-{type} 作为 React key / 选中态判定用,等 PUT 成功返回真实 id 后会被替换
 *
 *  注意:同时写入 type(camelCase,前端类型)+ section_type(snake_case,后端字段),
 *  EditorCanvas/EditorSidebar 读 type,ResumePreview/后端 PUT 读 section_type
 */
function withDefaultSections(resume: ResumeItem): ResumeItem {
  return {
    ...resume,
    sections: NEW_RESUME_DEFAULT_SECTIONS.map((s, i) => ({
      id: `temp-${s.section_type}-${i}`,
      type: s.section_type,
      section_type: s.section_type,
      title: s.title,
      content: s.content,
      sort_order: i,
      visible: 1,
    })),
  }
}

// ── 简历工作台:默认名派生 + 手动重命名支持(2026-09-05) ──
// 后端 _DEFAULT_SECTION_CONTENT 里 personal_info.content.jobTitle 是空串,
// 拿到一份简历后从 sections 里反查。section 同时带 type 和 section_type(API 返回 snake_case,
// 本地 defaultSections 注入 camelCase,两套都查,二选一即可)。
function getJobTitle(r: ResumeItem): string {
  const s = r.sections.find(
    (x: any) => x.section_type === 'personal_info' || x.type === 'personal_info',
  )
  return ((s?.content as any)?.jobTitle ?? '').trim()
}

/** 默认名 = 求职者简历里填写的岗位名称 + 最近一次填写保存的日期 */
function deriveDefaultTitle(r: ResumeItem): string {
  const job = getJobTitle(r)
  // updated_at 优先(最近一次保存),缺失回退 created_at;slice(0,10) 取 YYYY-MM-DD
  const date = ((r.updated_at || r.created_at) ?? '').slice(0, 10)
  if (job && date) return `${job} - ${date}`
  if (job) return job
  if (date) return `简历 - ${date}`
  return '未命名简历'
}

/** 展示用 title:
 *   - 后端占位串('未命名简历' 或空)→ 派生
 *   - 用户手动改过的 → 原样返回(改了就以用户为准)
 */
function displayTitle(r: ResumeItem): string {
  const t = (r.title ?? '').trim()
  if (!t || t === '未命名简历') return deriveDefaultTitle(r)
  return t
}

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

  // 导出 loading 状态(避免双击连发)
  const [exporting, setExporting] = useState(false)

  // ── 简历工作台:重命名状态(2026-09-05) ──
  // 同时只允许一个卡片进入重命名态;renamingId 存的是后端 id(ResumeItem.id 一定 number)
  const [renamingId, setRenamingId] = useState<number | null>(null)
  const [renameDraft, setRenameDraft] = useState('')

  const startRename = (r: ResumeItem) => {
    setRenamingId(r.id)
    // 用展示名(已含派生默认名)做初值,避免出现「我刚重命名进去,默认值却突然换了」的跳变
    setRenameDraft(displayTitle(r))
  }

  const cancelRename = () => {
    setRenamingId(null)
    setRenameDraft('')
  }

  // 提交重命名 — PUT 必须带完整 sections(后端 SaveSectionsReq.sections 必填,空数组会清空简历)
  const commitRename = async (r: ResumeItem) => {
    const next = renameDraft.trim()
    // 清空 / 与原值相同 → 不发请求,只关 input
    if (!next || next === r.title) { cancelRename(); return }
    cancelRename()
    try {
      const resp = await fetch(withToken(`/api/resume-center/${r.id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: next,
          template_key: r.template_key,
          sections: r.sections,
        }),
      })
      const d = await resp.json()
      if (d.success) {
        showToast('已重命名')
        await loadAll()  // 刷新保证 updated_at / title 同步
      } else {
        showToast(d.error?.message || '重命名失败')
      }
    } catch {
      showToast('网络错误')
    }
  }

  // 导出处理器 — 调后端 /api/resume-center/{id}/export 拿二进制,触发浏览器下载
  const handleExport = useCallback(async (
    format: 'pdf' | 'html' | 'docx' | 'txt' | 'json',
    fitOnePage: boolean,
  ) => {
    if (!editing) return
    setExporting(true)
    try {
      const qs = new URLSearchParams({
        format,
        token: getToken(),
        ...(fitOnePage && { fit_one_page: 'true' }),
      })
      const r = await fetch(`/api/resume-center/${editing.id}/export?${qs}`, {
        method: 'POST',
      })
      if (!r.ok) {
        // 后端错误是 JSON {success:false, error:{message}}
        const errJson = await r.json().catch(() => null)
        const msg = errJson?.error?.message || errJson?.message || `HTTP ${r.status}`
        showToast(`导出失败: ${msg}`)
        return
      }
      // 从响应头拿 Content-Disposition 里的文件名,fallback 到默认
      const disp = r.headers.get('Content-Disposition') || ''
      const m = disp.match(/filename="?([^";]+)"?/)
      const filename = m?.[1] || `${editing.title}-${Date.now()}.${format}`

      const blob = await r.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      // 等浏览器开始下载再 revoke(否则大文件可能下载不完整)
      setTimeout(() => URL.revokeObjectURL(url), 5000)
      showToast('导出成功')
    } catch (e: any) {
      showToast(`导出失败: ${e?.message || e}`)
    } finally {
      setExporting(false)
    }
  }, [editing])

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
      if (!d.success) { showToast(d.error?.message || '创建失败'); return }
      // 后端只创建空 Resume 主记录,前端补上 5 个默认区块,让侧栏非空
      const filled = withDefaultSections(d.data)
      setCreateOpen(false)
      setEditing(filled)
      showToast('简历已创建,已初始化 5 个默认模块')
      // 立刻 PUT 把默认区块持久化到数据库(防止用户关闭页面丢失)
      try {
        await fetch(withToken(`/api/resume-center/${filled.id}`), {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: filled.title, template_key: filled.template_key, sections: filled.sections }),
        })
      } catch { /* 静默失败,用户后续编辑自动保存会再写 */ }
      await loadAll()
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

  // ── 编辑器视图(JadeAI 风格三栏:模块导航 + 表单编辑 + 实时预览) ──
  if (editing) {
    return (
      <ResumeEditor
        resume={editing}
        templates={templates}
        onBack={() => setEditing(null)}
        onShare={() => shareResume(editing.id)}
        onPlaceholder={(msg) => showToast(typeof msg === 'string' ? msg : '')}
        onExport={handleExport}
        exporting={exporting}
        onSave={async (r) => {
          try {
            const resp = await fetch(withToken(`/api/resume-center/${r.id}`), {
              method: 'PUT', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ title: r.title, template_key: r.template_key, sections: r.sections }),
            })
            const d = await resp.json()
            if (d.success) { await loadAll() } else throw new Error(d.error?.message || '保存失败')
          } catch (e: any) {
            throw e
          }
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
                <ResumeCard
                  key={r.id} resume={r} templateName={templateName(r.template_key)}
                  onEdit={() => setEditing(r)} onDelete={() => deleteResume(r.id)} onShare={() => shareResume(r.id)}
                  renamingId={renamingId} renameDraft={renameDraft} setRenameDraft={setRenameDraft}
                  startRename={startRename} commitRename={commitRename} cancelRename={cancelRename}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(r => (
                <ResumeListItem
                  key={r.id} resume={r} templateName={templateName(r.template_key)}
                  onEdit={() => setEditing(r)} onDelete={() => deleteResume(r.id)} onShare={() => shareResume(r.id)}
                  renamingId={renamingId} renameDraft={renameDraft} setRenameDraft={setRenameDraft}
                  startRename={startRename} commitRename={commitRename} cancelRename={cancelRename}
                />
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

      {/* ── Toast ── Portal 到 document.body,保证编辑器早 return 时也能显示 */}
      {createPortal(
        <AnimatePresence>
          {toast && (
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg text-sm shadow-lg"
              style={{ background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface)' }}>
              {toast}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  )
}

// ─── 简历卡片（网格视图） ───
function ResumeCard({ resume, templateName, onEdit, onDelete, onShare,
  renamingId, renameDraft, setRenameDraft, startRename, commitRename, cancelRename }: {
  resume: ResumeItem; templateName: string
  onEdit: () => void; onDelete: () => void; onShare: () => void
  renamingId: number | null; renameDraft: string
  setRenameDraft: (v: string) => void
  startRename: (r: ResumeItem) => void
  commitRename: (r: ResumeItem) => void
  cancelRename: () => void
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
        <RenameableTitle
          resume={resume}
          isRenaming={renamingId === resume.id}
          draft={renameDraft}
          setDraft={setRenameDraft}
          startRename={startRename}
          commitRename={commitRename}
          cancelRename={cancelRename}
        />
        <div className="text-xs mt-0.5 flex items-center justify-between" style={{ color: 'var(--color-on-surface-variant)' }}>
          <span className="truncate">{templateName}</span>
          <span className="shrink-0 ml-1">{resume.created_at?.slice(0, 10)}</span>
        </div>
      </div>
    </div>
  )
}

// ─── 简历列表项（列表视图） ───
function ResumeListItem({ resume, templateName, onEdit, onDelete, onShare,
  renamingId, renameDraft, setRenameDraft, startRename, commitRename, cancelRename }: {
  resume: ResumeItem; templateName: string
  onEdit: () => void; onDelete: () => void; onShare: () => void
  renamingId: number | null; renameDraft: string
  setRenameDraft: (v: string) => void
  startRename: (r: ResumeItem) => void
  commitRename: (r: ResumeItem) => void
  cancelRename: () => void
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors hover:bg-black/5"
      style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
      <div className="w-9 h-11 bg-white dark:bg-zinc-700 rounded ring-1 ring-zinc-200/50 overflow-hidden shrink-0">
        <TemplateThumb template={resume.template_key} />
      </div>
      <div className="flex-1 min-w-0">
        <RenameableTitle
          resume={resume}
          isRenaming={renamingId === resume.id}
          draft={renameDraft}
          setDraft={setRenameDraft}
          startRename={startRename}
          commitRename={commitRename}
          cancelRename={cancelRename}
        />
        <div className="text-xs mt-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>{templateName} · {resume.created_at?.slice(0, 10)}</div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button onClick={onEdit} className="p-1.5 rounded-lg hover:opacity-70" style={{ color: 'var(--color-on-surface-variant)' }}><Pencil className="h-4 w-4" /></button>
        <button onClick={onShare} className="p-1.5 rounded-lg hover:opacity-70" style={{ color: 'var(--color-on-surface-variant)' }}><Share2 className="h-4 w-4" /></button>
        <button onClick={onDelete} className="p-1.5 rounded-lg hover:opacity-70" style={{ color: 'var(--accent-red)' }}><Trash2 className="h-4 w-4" /></button>
      </div>
    </div>
  )
}

// ─── 可重命名标题(grid 卡片 / list 行共用)───
// 默认:span + 双击进入 + hover 露 ✎
// 重命名:input + autoFocus + 全选 + Enter 提交 / Esc 取消 / blur 提交
// 模式参考 components/resume/editor/SectionCard.tsx
function RenameableTitle({ resume, isRenaming, draft, setDraft, startRename, commitRename, cancelRename }: {
  resume: ResumeItem
  isRenaming: boolean
  draft: string
  setDraft: (v: string) => void
  startRename: (r: ResumeItem) => void
  commitRename: (r: ResumeItem) => void
  cancelRename: () => void
}) {
  if (isRenaming) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={(e) => e.target.select()}
        onBlur={() => commitRename(resume)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); commitRename(resume) }
          if (e.key === 'Escape') { e.preventDefault(); cancelRename() }
        }}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
        className="w-full text-sm font-medium px-1.5 py-0.5 rounded border outline-none"
        style={{
          borderColor: 'var(--accent-blue)',
          background: 'var(--color-surface)',
          color: 'var(--color-on-surface)',
        }}
      />
    )
  }
  return (
    <div
      className="group/title flex items-center gap-1 cursor-text min-w-0"
      onDoubleClick={(e) => {
        e.stopPropagation()
        startRename(resume)
      }}
      title="双击重命名"
    >
      <span
        className="text-sm font-medium truncate flex-1 min-w-0"
        style={{ color: 'var(--color-on-surface)' }}
      >
        {displayTitle(resume)}
      </span>
      <Pencil
        className="h-3 w-3 shrink-0 opacity-0 group-hover/title:opacity-60 transition-opacity"
        style={{ color: 'var(--color-on-surface-variant)' }}
      />
    </div>
  )
}

// 编辑器已迁移到 components/resume/editor/ResumeEditor.tsx
