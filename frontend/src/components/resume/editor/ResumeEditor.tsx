import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ResumeSection } from '../../../types/resume'
import { EditorToolbar } from './EditorToolbar'
import { EditorSidebar } from './EditorSidebar'
import { EditorCanvas } from './EditorCanvas'
import { EditorPreviewPanel } from './EditorPreviewPanel'
import { DEFAULT_SECTION_CONTENT, SECTION_LABELS } from './icons'

// ──────────────── 类型 ────────────────
interface ResumeItem {
  id: number
  title: string
  template_key: string
  language: string
  created_at: string
  sections: ResumeSection[]
}

interface Props {
  resume: ResumeItem
  templates: { id: number; name: string; template_key: string; category: string; thumbnail: string }[]
  onBack: () => void
  onSave: (r: ResumeItem) => Promise<void>  // 父组件传,触发后端 PUT
  onShare: () => void
  onPlaceholder: (key: string) => void
}

const TOKEN = () => localStorage.getItem('xingtu_token') || ''
const withToken = (url: string) =>
  `${url}${url.includes('?') ? '&' : '?'}token=${TOKEN()}`

const AUTOSAVE_DEBOUNCE_MS = 800
const UNDO_STACK_MAX = 50

// ──────────────── 主组件 ────────────────
export default function ResumeEditor({ resume: initial, templates, onBack, onSave, onShare, onPlaceholder }: Props) {
  const [resume, setResume] = useState<ResumeItem>(initial)
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(
    initial.sections[0] ? String(initial.sections[0].id) : null
  )
  const [previewZoom, setPreviewZoom] = useState(0.8)
  const [autoSaveState, setAutoSaveState] = useState<'idle' | 'saving' | 'saved'>('saved')
  const [optimizingId, setOptimizingId] = useState<string | null>(null)

  // 撤销/重做栈 — 存的是 sections 数组的深拷贝(只对 sections 变化做记录)
  const undoStackRef = useRef<string[]>([])
  const redoStackRef = useRef<string[]>([])

  // 自动保存定时器
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 当 initial 变化(例如切换到另一份简历)→ 重置所有状态
  useEffect(() => {
    setResume(initial)
    setSelectedSectionId(initial.sections[0] ? String(initial.sections[0].id) : null)
    undoStackRef.current = []
    redoStackRef.current = []
    setAutoSaveState('saved')
  }, [initial.id])  // eslint-disable-line react-hooks/exhaustive-deps

  const existingTypes = useMemo(
    () => new Set(resume.sections.map(s => s.type)),
    [resume.sections]
  )

  // ── 推送撤销快照 ──
  const pushUndo = useCallback(() => {
    const snap = JSON.stringify(resume.sections)
    const stack = undoStackRef.current
    if (stack[stack.length - 1] === snap) return  // 没变化不入栈
    stack.push(snap)
    if (stack.length > UNDO_STACK_MAX) stack.shift()
    redoStackRef.current = []  // 新操作清空 redo
  }, [resume.sections])

  // ── 调度自动保存 ──
  const scheduleAutoSave = useCallback(() => {
    setAutoSaveState('idle')
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      setAutoSaveState('saving')
      try {
        await onSave(resume)
        setAutoSaveState('saved')
      } catch (e) {
        setAutoSaveState('idle')
      }
    }, AUTOSAVE_DEBOUNCE_MS)
  }, [resume, onSave])

  // ── 修改 section 内容 ──
  const updateSectionContent = useCallback((sectionId: string, content: any) => {
    pushUndo()
    setResume(prev => ({
      ...prev,
      sections: prev.sections.map(s =>
        String(s.id) === sectionId ? { ...s, content } : s
      ),
    }))
    scheduleAutoSave()
  }, [pushUndo, scheduleAutoSave])

  // ── 重命名 section ──
  const renameSection = useCallback((sectionId: string, title: string) => {
    pushUndo()
    setResume(prev => ({
      ...prev,
      sections: prev.sections.map(s =>
        String(s.id) === sectionId ? { ...s, title } : s
      ),
    }))
    scheduleAutoSave()
  }, [pushUndo, scheduleAutoSave])

  // ── 删除 section ──
  const deleteSection = useCallback((sectionId: string) => {
    pushUndo()
    setResume(prev => ({
      ...prev,
      sections: prev.sections
        .filter(s => String(s.id) !== sectionId)
        // 重新排序
        .map((s, i) => ({ ...s, sort_order: i })),
    }))
    scheduleAutoSave()
  }, [pushUndo, scheduleAutoSave])

  // ── 移动 section ──
  const moveSection = useCallback((sectionId: string, dir: 'up' | 'down') => {
    pushUndo()
    setResume(prev => {
      const sorted = [...prev.sections].sort((a, b) => a.sort_order - b.sort_order)
      const idx = sorted.findIndex(s => String(s.id) === sectionId)
      const target = dir === 'up' ? idx - 1 : idx + 1
      if (idx < 0 || target < 0 || target >= sorted.length) return prev
      ;[sorted[idx], sorted[target]] = [sorted[target], sorted[idx]]
      return {
        ...prev,
        sections: sorted.map((s, i) => ({ ...s, sort_order: i })),
      }
    })
    scheduleAutoSave()
  }, [pushUndo, scheduleAutoSave])

  // ── 添加 section ──
  const addSection = useCallback((sectionType: string) => {
    pushUndo()
    setResume(prev => {
      const newSection: ResumeSection = {
        id: String(Date.now()),  // 本地临时 id,后端保存时会替换
        resumeId: String(prev.id),
        type: sectionType,
        title: SECTION_LABELS[sectionType] || sectionType,
        sortOrder: prev.sections.length,
        visible: true,
        content: DEFAULT_SECTION_CONTENT[sectionType] || {},
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any
      return { ...prev, sections: [...prev.sections, newSection] }
    })
    scheduleAutoSave()
  }, [pushUndo, scheduleAutoSave])

  // ── 修改简历标题 ──
  const updateTitle = useCallback((title: string) => {
    pushUndo()
    setResume(prev => ({ ...prev, title }))
    scheduleAutoSave()
  }, [pushUndo, scheduleAutoSave])

  // ── 修改模板 ──
  const updateTemplate = useCallback((template_key: string) => {
    pushUndo()
    setResume(prev => ({ ...prev, template_key }))
    scheduleAutoSave()
  }, [pushUndo, scheduleAutoSave])

  // ── 修改语言 ──
  const updateLanguage = useCallback((language: string) => {
    pushUndo()
    setResume(prev => ({ ...prev, language }))
    scheduleAutoSave()
  }, [pushUndo, scheduleAutoSave])

  // ── 撤销 ──
  const undo = useCallback(() => {
    const stack = undoStackRef.current
    if (stack.length === 0) return
    const cur = JSON.stringify(resume.sections)
    const prev = stack.pop()!
    redoStackRef.current.push(cur)
    setResume(r => ({ ...r, sections: JSON.parse(prev) }))
    scheduleAutoSave()
  }, [resume.sections, scheduleAutoSave])

  // ── 重做 ──
  const redo = useCallback(() => {
    const stack = redoStackRef.current
    if (stack.length === 0) return
    const cur = JSON.stringify(resume.sections)
    const next = stack.pop()!
    undoStackRef.current.push(cur)
    setResume(r => ({ ...r, sections: JSON.parse(next) }))
    scheduleAutoSave()
  }, [resume.sections, scheduleAutoSave])

  // ── AI 优化 ──
  const handleAIOptimize = useCallback(async (section: ResumeSection) => {
    setOptimizingId(String(section.id))
    try {
      const r = await fetch(withToken('/api/resume-center/optimize'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section_type: section.type,
          content: section.content,
          instruction: '优化措辞,更专业、更有说服力',
          language: resume.language || 'zh',
        }),
      })
      const d = await r.json()
      if (d.success) {
        pushUndo()
        setResume(prev => ({
          ...prev,
          sections: prev.sections.map(s =>
            String(s.id) === String(section.id) ? { ...s, content: d.data.content } : s
          ),
        }))
        scheduleAutoSave()
        onPlaceholder(`AI 优化完成:${section.title}`)
      } else {
        onPlaceholder(d.error?.message || 'AI 优化失败')
      }
    } catch (e: any) {
      onPlaceholder(`网络错误:${e?.message || e}`)
    } finally {
      setOptimizingId(null)
    }
  }, [resume.language, pushUndo, scheduleAutoSave, onPlaceholder])

  // 组件卸载时,如果有未保存的变更,立即保存一次
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        // 卸载时尝试触发保存(父组件的 onSave 会处理)
      }
    }
  }, [])

  return (
    <div className="flex flex-col h-full">
      <EditorToolbar
        title={resume.title}
        onTitleChange={updateTitle}
        onBack={onBack}
        onShare={onShare}
        autoSaveState={autoSaveState}
        undoCount={undoStackRef.current.length}
        redoCount={redoStackRef.current.length}
        onUndo={undo}
        onRedo={redo}
        onPlaceholder={onPlaceholder}
        language={resume.language || 'zh'}
        onLanguageChange={(lang) => updateLanguage(lang)}
      />

      <div className="flex-1 flex overflow-hidden">
        <EditorSidebar
          resumeSections={resume.sections}
          callbacks={{
            onSelectSection: setSelectedSectionId,
            onAddSection: addSection,
            selectedSectionId,
            existingSectionTypes: existingTypes,
          }}
        />

        <EditorCanvas
          resumeSections={resume.sections}
          selectedSectionId={selectedSectionId}
          optimizingId={optimizingId}
          callbacks={{
            onUpdateContent: updateSectionContent,
            onRenameSection: renameSection,
            onDeleteSection: deleteSection,
            onMoveSection: moveSection,
            onSelectSection: setSelectedSectionId,
            onAIOptimize: handleAIOptimize,
          }}
        />

        <EditorPreviewPanel
          resume={resume}
          zoom={previewZoom}
          onZoomChange={setPreviewZoom}
          templates={templates}
          onTemplateChange={updateTemplate}
        />
      </div>
    </div>
  )
}