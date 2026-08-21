import type { ResumeSection } from '../../../types/resume'
import { SectionCard } from './SectionCard'
import { PersonalInfoForm } from './forms/PersonalInfoForm'
import { SummaryForm } from './forms/SummaryForm'
import { WorkExperienceForm } from './forms/WorkExperienceForm'
import { EducationForm } from './forms/EducationForm'
import { SkillsForm } from './forms/SkillsForm'
import { ProjectsForm } from './forms/ProjectsForm'
import { CertificationsForm } from './forms/CertificationsForm'
import { LanguagesForm } from './forms/LanguagesForm'
import { GitHubForm } from './forms/GitHubForm'
import { CustomForm } from './forms/CustomForm'
import { QrCodesForm } from './forms/QrCodesForm'
import { SECTION_LABELS } from './icons'

interface Callbacks {
  onUpdateContent: (sectionId: string, content: any) => void
  onRenameSection: (sectionId: string, title: string) => void
  onDeleteSection: (sectionId: string) => void
  onMoveSection: (sectionId: string, direction: 'up' | 'down') => void
  onSelectSection: (sectionId: string) => void
  onAIOptimize: (section: ResumeSection) => Promise<void>
}

interface Props {
  resumeSections: ResumeSection[]
  selectedSectionId: string | null
  optimizingId: string | null
  callbacks: Callbacks
}

/** 中间栏表单编辑 — 根据 section.type 路由到对应 Form */
export function EditorCanvas({
  resumeSections, selectedSectionId, optimizingId, callbacks,
}: Props) {
  const sorted = [...resumeSections].sort((a, b) => a.sort_order - b.sort_order)

  return (
    <main className="flex-1 overflow-y-auto" style={{ background: 'var(--color-background)' }}>
      <div className="max-w-3xl mx-auto px-6 py-6 space-y-4">
        {sorted.length === 0 && (
          <div className="text-center py-20 text-zinc-400">
            暂无模块,点击左侧"添加模块"开始构建简历
          </div>
        )}
        {sorted.map((section, idx) => (
          <SectionCard
            key={section.id}
            sectionType={section.type}
            title={section.title || SECTION_LABELS[section.type] || section.type}
            isSelected={selectedSectionId === String(section.id)}
            onSelect={() => callbacks.onSelectSection(String(section.id))}
            onRenameTitle={section.type !== 'personal_info'
              ? (t) => callbacks.onRenameSection(String(section.id), t)
              : undefined}
            onDelete={() => {
              if (confirm(`确认删除「${section.title || SECTION_LABELS[section.type]}」模块?`)) {
                callbacks.onDeleteSection(String(section.id))
              }
            }}
            optimizing={optimizingId === String(section.id)}
            onAIOptimize={section.type === 'personal_info' || section.type === 'qr_codes'
              ? undefined  // 这两类暂不接 AI 优化
              : () => callbacks.onAIOptimize(section)}
          >
            {renderForm(section, (c) => callbacks.onUpdateContent(String(section.id), c))}
          </SectionCard>
        ))}
      </div>
    </main>
  )
}

function renderForm(section: ResumeSection, onChange: (c: any) => void) {
  const content = section.content || {}
  switch (section.type) {
    case 'personal_info':  return <PersonalInfoForm content={content as any} onChange={onChange} />
    case 'summary':        return <SummaryForm content={content as any} onChange={onChange} />
    case 'work_experience':return <WorkExperienceForm content={content as any} onChange={onChange} />
    case 'education':      return <EducationForm content={content as any} onChange={onChange} />
    case 'skills':         return <SkillsForm content={content as any} onChange={onChange} />
    case 'projects':       return <ProjectsForm content={content as any} onChange={onChange} />
    case 'certifications': return <CertificationsForm content={content as any} onChange={onChange} />
    case 'languages':      return <LanguagesForm content={content as any} onChange={onChange} />
    case 'github':         return <GitHubForm content={content as any} onChange={onChange} />
    case 'custom':         return <CustomForm content={content as any} onChange={onChange} />
    case 'qr_codes':       return <QrCodesForm content={content as any} onChange={onChange} />
    default: return <div className="text-xs text-zinc-400">未知模块类型: {section.type}</div>
  }
}