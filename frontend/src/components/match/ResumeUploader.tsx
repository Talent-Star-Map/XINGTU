import { Upload, CheckCircle, ChevronDown } from 'lucide-react'
import ManualSkillInput from './ManualSkillInput'

interface Props {
  hasProfile: boolean | null
  showSkillInput: boolean
  selSkills: string[]
  onTagsChange: (skills: string[]) => void
  onConfirm: (skills: string[]) => void
  onAutoMatch: (skills: string[]) => void
  onShowSkillInput: () => void
  onSkip: () => void
  onGoToResume: () => void
}

export default function ResumeUploader({
  hasProfile, showSkillInput, selSkills, onTagsChange,
  onConfirm, onAutoMatch, onShowSkillInput, onSkip, onGoToResume,
}: Props) {
  // 已检测到简历 — 显示已选技能摘要
  if (hasProfile === true && !showSkillInput) {
    return (
      <div
        className="rounded-xl border p-4"
        style={{ borderColor: 'rgba(0,229,153,0.2)', background: 'rgba(0,229,153,0.05)' }}
      >
        <div className="flex items-center gap-3 mb-2">
          <CheckCircle className="h-5 w-5 shrink-0" style={{ color: 'var(--accent-green)' }} />
          <p className="text-xs font-medium" style={{ color: 'var(--accent-green)' }}>已选择 {selSkills.length} 项技能</p>
          <button
            onClick={onShowSkillInput}
            className="ml-auto text-xs font-medium flex items-center gap-1"
            style={{ color: 'var(--color-primary)' }}
          ><ChevronDown className="h-3 w-3" /> 修改</button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {selSkills.map(s => (
            <span key={s} className="px-2 py-0.5 rounded text-[11px] font-medium" style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-primary)' }}>{s}</span>
          ))}
        </div>
      </div>
    )
  }

  // 未检测到简历，显示引导横幅
  if (!showSkillInput) {
    return (
      <div
        className="rounded-xl border border-dashed p-5"
        style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}
      >
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
            style={{ background: 'rgba(0,200,255,0.1)' }}
          >
            <Upload className="h-6 w-6" style={{ color: 'var(--color-primary)' }} />
          </div>
          <div className="flex-1 text-center sm:text-left">
            <p className="text-sm font-semibold" style={{ color: 'var(--color-on-surface)' }}>尚未检测到简历或技能数据</p>
            <p className="text-xs mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>上传简历可获取智能匹配结果，或手动输入快速体验</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={onShowSkillInput}
              className="h-9 px-4 rounded-lg text-xs font-semibold text-white"
              style={{ background: 'var(--color-primary)' }}
            >手动输入</button>
            <button
              onClick={onGoToResume}
              className="h-9 px-4 rounded-lg text-xs font-semibold border"
              style={{ borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface-variant)' }}
            >前往简历管理</button>
          </div>
        </div>
      </div>
    )
  }

  // 手动输入技能面板
  return (
    <ManualSkillInput
      tags={selSkills}
      onTagsChange={onTagsChange}
      onConfirm={onConfirm}
      onAutoMatch={onAutoMatch}
      onSkip={onSkip}
      onGoToResume={onGoToResume}
    />
  )
}
