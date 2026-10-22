import type { ReactNode } from 'react'
import { Edit3, Briefcase, GraduationCap, Link2, Star, ExternalLink, ArrowRight } from 'lucide-react'

/**
 * 个人主页的简历区块展示
 *
 * 数据取自「最近一份简历」的 sections（与简历中心同一份数据），
 * 所以工作/教育/项目/技能的字段项与简历编辑器天然一致：
 * 公司、职位、地点、起止、描述、技术栈、亮点、专业、GPA 一个不少。
 * 这里只负责展示，编辑统一跳简历中心，避免同一段经历维护两份。
 */

export interface WorkItem {
  company?: string; position?: string; location?: string
  startDate?: string; endDate?: string; current?: boolean
  description?: string; technologies?: string[]; highlights?: string[]
}
export interface EduItem {
  institution?: string; degree?: string; field?: string; location?: string
  startDate?: string; endDate?: string; gpa?: string; highlights?: string[]
}
export interface ProjItem {
  name?: string; url?: string; startDate?: string; endDate?: string
  description?: string; technologies?: string[]; highlights?: string[]
}
export interface SkillCat { name?: string; skills?: string[] }

export function dateRange(start?: string, end?: string, current?: boolean): string {
  const s = (start || '').trim()
  const e = current ? '至今' : (end || '').trim()
  if (!s && !e) return ''
  return [s, e].filter(Boolean).join(' - ')
}

/** 区块外壳：沿用个人主页原来的卡片样式，避免与页面其它区块风格打架 */
export function SectionShell({ title, icon: Icon, count, onEdit, editHint, action, children }: {
  title: string; icon?: any; count?: number; onEdit?: () => void
  editHint?: string; action?: ReactNode; children: ReactNode
}) {
  return (
    <section className="rounded-2xl border p-8"
      style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="h-5 w-5" style={{ color: 'var(--color-on-surface-variant)' }} />}
          <h3 className="text-lg font-black" style={{ color: 'var(--color-on-surface)' }}>{title}</h3>
          {typeof count === 'number' && count > 0 && (
            <span className="text-xs tabular-nums px-2 py-0.5 rounded-full"
              style={{ background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface-variant)' }}>
              {count}
            </span>
          )}
          {onEdit && (
            <button onClick={onEdit} className="p-1.5 rounded-lg transition-colors" title={editHint || `编辑${title}`}
              style={{ color: 'var(--color-on-surface-variant)' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-surface-container)'; e.currentTarget.style.color = 'var(--color-primary)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-on-surface-variant)' }}>
              <Edit3 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

/** 时间线单条：左侧圆点 + 竖线，右侧标题行、描述、技术栈、亮点 */
function TimelineItem({ title, subtitle, meta, description, technologies, highlights }: {
  title: string; subtitle?: string; meta?: string
  description?: string; technologies?: string[]; highlights?: string[]
}) {
  return (
    <div className="relative pl-5 pb-5 last:pb-0 border-l last:border-transparent"
      style={{ borderColor: 'var(--color-outline-variant)' }}>
      <span className="absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full ring-2"
        style={{ background: 'var(--color-primary)', boxShadow: '0 0 0 3px var(--color-surface-container-lowest)' }} />
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <p className="text-sm font-bold" style={{ color: 'var(--color-on-surface)' }}>
          {title}
          {subtitle && <span className="font-normal" style={{ color: 'var(--color-on-surface-variant)' }}> · {subtitle}</span>}
        </p>
        {meta && <span className="text-[11px] tabular-nums shrink-0" style={{ color: 'var(--color-on-surface-variant)' }}>{meta}</span>}
      </div>
      {description && (
        <p className="text-xs mt-1.5 leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>{description}</p>
      )}
      {!!technologies?.length && (
        <div className="flex flex-wrap gap-1 mt-2">
          {technologies.map(t => (
            <span key={t} className="px-1.5 py-0.5 rounded text-[10px] font-medium"
              style={{ background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface-variant)' }}>{t}</span>
          ))}
        </div>
      )}
      {!!highlights?.length && (
        <ul className="mt-2 space-y-1">
          {highlights.map((h, i) => (
            <li key={i} className="text-xs leading-relaxed flex gap-1.5" style={{ color: 'var(--color-on-surface)' }}>
              <span style={{ color: 'var(--color-primary)' }}>·</span>
              <span className="flex-1">{h}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function WorkSection({ items, onEdit }: { items: WorkItem[]; onEdit: () => void }) {
  return (
    <SectionShell title="工作经历" icon={Briefcase} count={items.length} onEdit={onEdit} editHint="去简历中心编辑工作经历">
      {items.length ? (
        <div>
          {items.map((w, i) => (
            <TimelineItem key={i}
              title={w.company || w.position || '（未填写公司与职位）'}
              subtitle={[w.company ? w.position : '', w.location].filter(Boolean).join(' · ')}
              meta={dateRange(w.startDate, w.endDate, w.current)}
              description={w.description}
              technologies={w.technologies}
              highlights={w.highlights} />
          ))}
        </div>
      ) : (
        <EmptyInResume text="还没有工作经历，去简历中心补上后这里会自动同步" onEdit={onEdit} />
      )}
    </SectionShell>
  )
}

export function EducationSection({ items, onEdit }: { items: EduItem[]; onEdit: () => void }) {
  return (
    <SectionShell title="教育背景" icon={GraduationCap} count={items.length} onEdit={onEdit} editHint="去简历中心编辑教育背景">
      {items.length ? (
        <div>
          {items.map((e, i) => (
            <TimelineItem key={i}
              title={e.institution || [e.degree, e.field].filter(Boolean).join(' · ') || '（未填写学校）'}
              subtitle={[e.institution ? e.degree : '', e.field, e.location].filter(Boolean).join(' · ')}
              meta={[dateRange(e.startDate, e.endDate), e.gpa ? `GPA ${e.gpa}` : ''].filter(Boolean).join('  ')}
              highlights={e.highlights} />
          ))}
        </div>
      ) : (
        <EmptyInResume text="还没有教育经历，去简历中心补上后这里会自动同步" onEdit={onEdit} />
      )}
    </SectionShell>
  )
}

export function ProjectsSection({ items, onEdit }: { items: ProjItem[]; onEdit: () => void }) {
  return (
    <SectionShell title="项目经历" icon={Link2} count={items.length} onEdit={onEdit} editHint="去简历中心编辑项目经历">
      {items.length ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((p, i) => (
            <div key={i} className="rounded-xl border p-5" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface)' }}>
              <div className="flex items-baseline justify-between gap-2">
                <h4 className="text-sm font-bold min-w-0" style={{ color: 'var(--color-on-surface)' }}>
                  {p.url ? (
                    <a href={p.url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 hover:underline truncate" style={{ color: 'var(--color-primary)' }}>
                      <span className="truncate">{p.name || '未命名项目'}</span> <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  ) : (p.name || '未命名项目')}
                </h4>
                {dateRange(p.startDate, p.endDate) && (
                  <span className="text-[11px] tabular-nums shrink-0" style={{ color: 'var(--color-on-surface-variant)' }}>
                    {dateRange(p.startDate, p.endDate)}
                  </span>
                )}
              </div>
              {p.description && (
                <p className="text-xs mt-1.5 leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>{p.description}</p>
              )}
              {!!p.technologies?.length && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {p.technologies.map(t => (
                    <span key={t} className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                      style={{ background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface-variant)' }}>{t}</span>
                  ))}
                </div>
              )}
              {!!p.highlights?.length && (
                <ul className="mt-2 space-y-1">
                  {p.highlights.slice(0, 4).map((h, j) => (
                    <li key={j} className="text-xs leading-relaxed flex gap-1.5" style={{ color: 'var(--color-on-surface)' }}>
                      <span style={{ color: 'var(--color-primary)' }}>·</span>
                      <span className="flex-1">{h}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      ) : (
        <EmptyInResume text="还没有项目经历，去简历中心补上后这里会自动同步" onEdit={onEdit} />
      )}
    </SectionShell>
  )
}

export function SkillsSection({ categories, flat, onEdit }: {
  categories: SkillCat[]; flat: string[]; onEdit: () => void
}) {
  const total = categories.length
    ? categories.reduce((n, c) => n + (c.skills?.length || 0), 0)
    : flat.length
  return (
    <SectionShell title="技能特长" icon={Star} count={total} onEdit={onEdit} editHint="去简历中心编辑技能">
      {categories.length ? (
        <div className="space-y-3">
          {categories.map((c, i) => (
            <div key={i} className="flex gap-3 flex-wrap items-start">
              <span className="text-xs font-semibold w-20 shrink-0 pt-1" style={{ color: 'var(--color-on-surface-variant)' }}>
                {c.name || '其他'}
              </span>
              <div className="flex flex-wrap gap-1.5 flex-1">
                {(c.skills || []).map(s => (
                  <span key={s} className="px-2.5 py-1 rounded-lg text-xs font-semibold"
                    style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-primary)' }}>{s}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : flat.length ? (
        <div className="flex flex-wrap gap-2">
          {flat.map(s => (
            <span key={s} className="px-3 py-1.5 rounded-lg text-sm font-semibold"
              style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-primary)' }}>{s}</span>
          ))}
        </div>
      ) : (
        <EmptyInResume text="还没有技能标签，去简历中心补上后这里会自动同步" onEdit={onEdit} />
      )}
    </SectionShell>
  )
}

function EmptyInResume({ text, onEdit }: { text: string; onEdit: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>{text}</p>
      <button onClick={onEdit}
        className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg"
        style={{ color: 'var(--color-primary)', background: 'var(--color-primary-fixed)' }}>
        去简历中心 <ArrowRight className="h-3 w-3" />
      </button>
    </div>
  )
}
