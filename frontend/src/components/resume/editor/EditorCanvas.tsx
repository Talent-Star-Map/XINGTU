import type { EditorSection } from './types'
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
  onAIOptimize: (section: EditorSection) => Promise<void>
}

interface Props {
  resumeSections: EditorSection[]
  selectedSectionId: string | null
  optimizingId: string | null
  callbacks: Callbacks
}

/** 取 section 类型 — 兼容 camelCase(type)和 snake_case(section_type) */
function sectionTypeOf(section: any): string {
  return section?.type || section?.section_type || ''
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
        {sorted.map((section, idx) => {
          const secType = sectionTypeOf(section)
          return (
            <SectionCard
              key={section.id}
              sectionType={secType}
              title={section.title || SECTION_LABELS[secType] || secType}
              isSelected={selectedSectionId === String(section.id)}
              onSelect={() => callbacks.onSelectSection(String(section.id))}
              onRenameTitle={secType !== 'personal_info'
                ? (t) => callbacks.onRenameSection(String(section.id), t)
                : undefined}
              onDelete={() => {
                if (confirm(`确认删除「${section.title || SECTION_LABELS[secType]}」模块?`)) {
                  callbacks.onDeleteSection(String(section.id))
                }
              }}
              optimizing={optimizingId === String(section.id)}
              onAIOptimize={secType === 'personal_info' || secType === 'qr_codes'
                ? undefined  // 这两类暂不接 AI 优化
                : () => callbacks.onAIOptimize(section)}
            >
              {renderForm(secType, section.content || {}, (c) => callbacks.onUpdateContent(String(section.id), c))}
            </SectionCard>
          )
        })}
      </div>
    </main>
  )
}

function renderForm(secType: string, content: any, onChange: (c: any) => void) {
  switch (secType) {
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
    default: return <div className="text-xs text-zinc-400">未知模块类型: {secType || '(空)'}</div>
  }
}