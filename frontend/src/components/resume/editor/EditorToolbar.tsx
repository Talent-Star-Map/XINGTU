import {
  ArrowLeft, Undo2, Redo2, Download, Upload, Share2, Languages as LangIcon,
  FileSearch, FileText, SpellCheck, Palette, Save, Check,
  Loader2, ChevronDown, Globe, FileType, AlignLeft, Braces, Sparkles,
} from 'lucide-react'
import { useTheme } from '../../ThemeProvider'
import { useEffect, useRef, useState } from 'react'

/** 导出格式 — 与后端 POST /api/resume-center/{id}/export?format=... 对齐 */
type ExportFormat = 'pdf' | 'html' | 'docx' | 'txt' | 'json'
type ExportOption = {
  key: string
  format: ExportFormat
  fitOnePage?: boolean
  label: string
  desc: string
  icon: typeof Download
}

/** 6 个导出选项(对应后端 5 种格式;PDF 含两种渲染策略) */
const EXPORT_OPTIONS: ExportOption[] = [
  { key: 'pdf',        format: 'pdf',  fitOnePage: false, label: 'PDF',           desc: '高保真',     icon: FileText },
  { key: 'pdf-fit',    format: 'pdf',  fitOnePage: true,  label: 'PDF 一页装下',  desc: '智能缩放',   icon: Sparkles },
  { key: 'html',       format: 'html',                     label: 'HTML',          desc: '浏览器打开', icon: Globe },
  { key: 'docx',       format: 'docx',                     label: 'DOCX',          desc: 'Word 可编辑', icon: FileType },
  { key: 'txt',        format: 'txt',                      label: 'TXT',           desc: '纯文本',     icon: AlignLeft },
  { key: 'json',       format: 'json',                     label: 'JSON',          desc: '原始数据',   icon: Braces },
]

interface Props {
  title: string
  onTitleChange: (title: string) => void
  onBack: () => void
  onShare: () => void
  autoSaveState: 'idle' | 'saving' | 'saved'
  undoCount: number
  redoCount: number
  onUndo: () => void
  onRedo: () => void
  onPlaceholder: (key: string) => void
  onExport?: (format: ExportFormat, fitOnePage: boolean) => void
  exporting?: boolean
  language: string
  onLanguageChange: (lang: 'zh' | 'en') => void
}

export function EditorToolbar({
  title, onTitleChange, onBack, onShare,
  autoSaveState, undoCount, redoCount, onUndo, onRedo,
  onPlaceholder, onExport, exporting,
  language, onLanguageChange,
}: Props) {
  const { theme, toggle } = useTheme()

  // 导出 Dropdown 状态
  const [exportOpen, setExportOpen] = useState(false)
  const exportRef = useRef<HTMLDivElement>(null)

  // 点击外部关闭
  useEffect(() => {
    if (!exportOpen) return
    const handler = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false)
      }
    }
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExportOpen(false)
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', escHandler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', escHandler)
    }
  }, [exportOpen])

  const handleExportClick = (opt: ExportOption) => {
    setExportOpen(false)
    onExport?.(opt.format, !!opt.fitOnePage)
  }

  return (
    <div className="h-12 shrink-0 border-b flex items-center justify-between px-3 gap-2" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface)' }}>
      {/* 左侧:返回 + 标题 + 自动保存状态 */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <button onClick={onBack} className="h-8 w-8 inline-flex items-center justify-center rounded text-zinc-500 hover:bg-zinc-100 shrink-0" title="返回">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <input
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          className="min-w-0 max-w-[10rem] text-sm font-medium bg-transparent outline-none border-b border-transparent focus:border-blue-400 px-1"
        />
        <span className="text-xs text-zinc-400 inline-flex items-center gap-1">
          {autoSaveState === 'saving' ? (
            <><Save className="h-3 w-3 animate-pulse" /> 保存中...</>
          ) : autoSaveState === 'saved' ? (
            <><Check className="h-3 w-3 text-emerald-500" /> 已自动保存</>
          ) : (
            '未保存'
          )}
        </span>
      </div>

      {/* 右侧:工具按钮 */}
      <div className="flex items-center gap-0.5 shrink-0">
        {/* 撤销/重做 */}
        <button onClick={onUndo} disabled={undoCount === 0} className="h-8 w-8 inline-flex items-center justify-center rounded text-zinc-500 hover:bg-zinc-100 disabled:opacity-30" title="撤销">
          <Undo2 className="h-4 w-4" />
        </button>
        <button onClick={onRedo} disabled={redoCount === 0} className="h-8 w-8 inline-flex items-center justify-center rounded text-zinc-500 hover:bg-zinc-100 disabled:opacity-30" title="重做">
          <Redo2 className="h-4 w-4" />
        </button>

        <span className="mx-1 h-5 w-px bg-zinc-200" />

        {/* 导出 Dropdown */}
        <div ref={exportRef} className="relative">
          <button
            onClick={() => onExport && setExportOpen(o => !o)}
            disabled={!onExport || exporting}
            className="h-8 px-2 inline-flex items-center gap-1 rounded text-xs text-zinc-600 hover:bg-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed"
            title="导出"
          >
            {exporting
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Download className="h-3.5 w-3.5" />}
            导出
            <ChevronDown className="h-3 w-3 opacity-60" />
          </button>
          {exportOpen && (
            <ul
              className="absolute right-0 top-full mt-1 w-48 rounded-lg border shadow-lg overflow-hidden z-50"
              style={{ background: 'var(--color-surface)', borderColor: 'var(--color-outline-variant)' }}
            >
              {EXPORT_OPTIONS.map(opt => {
                const Icon = opt.icon
                return (
                  <li key={opt.key}>
                    <button
                      onClick={() => handleExportClick(opt)}
                      className="w-full px-3 py-2 flex items-center gap-2.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      <Icon className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-zinc-700">{opt.label}</div>
                        <div className="text-[10px] text-zinc-400">{opt.desc}</div>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <button onClick={() => onPlaceholder('导入功能开发中,后续 PR 接入 JSON 简历导入')} className="h-8 px-2 inline-flex items-center gap-1 rounded text-xs text-zinc-600 hover:bg-zinc-100" title="导入">
          <Upload className="h-3.5 w-3.5" /> 导入
        </button>
        <button onClick={onShare} className="h-8 px-2 inline-flex items-center gap-1 rounded text-xs text-zinc-600 hover:bg-zinc-100" title="分享">
          <Share2 className="h-3.5 w-3.5" /> 分享
        </button>
        <button onClick={() => onPlaceholder('JD 匹配分析开发中,后续 PR 接入 LLM 评分')} className="h-8 px-2 inline-flex items-center gap-1 rounded text-xs text-zinc-600 hover:bg-zinc-100" title="JD 匹配">
          <FileSearch className="h-3.5 w-3.5" /> JD匹配
        </button>
        <button onClick={() => onPlaceholder('简历翻译开发中,后续 PR 接入 DeepSeek 流式 NDJSON 翻译')} className="h-8 px-2 inline-flex items-center gap-1 rounded text-xs text-zinc-600 hover:bg-zinc-100" title="翻译">
          <LangIcon className="h-3.5 w-3.5" /> 翻译
        </button>
        <button onClick={() => onPlaceholder('求职信生成开发中,后续 PR 接入 Cover Letter LLM')} className="h-8 px-2 inline-flex items-center gap-1 rounded text-xs text-zinc-600 hover:bg-zinc-100" title="求职信">
          <FileText className="h-3.5 w-3.5" /> 求职信
        </button>
        <button onClick={() => onPlaceholder('语法检查开发中,后续 PR 接入 LLM issues/score 分析')} className="h-8 px-2 inline-flex items-center gap-1 rounded text-xs text-zinc-600 hover:bg-zinc-100" title="语法检查">
          <SpellCheck className="h-3.5 w-3.5" /> 语法检查
        </button>
        <button onClick={toggle} className="h-8 w-8 inline-flex items-center justify-center rounded text-zinc-600 hover:bg-zinc-100" title="切换主题">
          <Palette className="h-4 w-4" />
        </button>
        <select
          value={language}
          onChange={(e) => onLanguageChange(e.target.value as 'zh' | 'en')}
          className="h-8 px-2 rounded text-xs border outline-none"
          style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface)' }}
        >
          <option value="zh">中文</option>
          <option value="en">English</option>
        </select>
      </div>
    </div>
  )
}