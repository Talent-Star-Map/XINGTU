import {
  ArrowLeft, Undo2, Redo2, Download, Upload, Share2, Languages as LangIcon,
  FileSearch, FileText, SpellCheck, Palette, Save, Check,
} from 'lucide-react'
import { useTheme } from '../../ThemeProvider'

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
  language: string
  onLanguageChange: (lang: 'zh' | 'en') => void
}

export function EditorToolbar({
  title, onTitleChange, onBack, onShare,
  autoSaveState, undoCount, redoCount, onUndo, onRedo,
  onPlaceholder, language, onLanguageChange,
}: Props) {
  const { theme, toggle } = useTheme()

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

        {/* 占位按钮组(后端未实现的功能,先给提示) */}
        <button onClick={() => onPlaceholder('导出功能开发中,后续 PR 接入 PDF/DOCX/HTML 导出引擎')} className="h-8 px-2 inline-flex items-center gap-1 rounded text-xs text-zinc-600 hover:bg-zinc-100" title="导出">
          <Download className="h-3.5 w-3.5" /> 导出
        </button>
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