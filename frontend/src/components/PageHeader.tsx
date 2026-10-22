import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

/**
 * 页面顶部信息栏 — 简历工作台与个人主页共用
 *
 * 统一成「图标 + 标题 + 状态徽标」+ 右侧操作按钮组，两个页面视觉一致，
 * 不再各写一套（个人主页原来是一个大卡片，跟简历中心的条状信息栏差得远）。
 */
export interface PageHeaderProps {
  icon: LucideIcon
  title: string
  /** 标题后的胶囊徽标，如「共 12 份」「资料完整度 78%」 */
  badge?: { text: string; tone?: 'primary' | 'success' | 'warning' }
  /** 标题下的补充说明（可选，一行以内） */
  hint?: string
  actions?: ReactNode
  /** 内层容器宽度，默认对齐 1400px 正文宽度；嵌在侧栏布局里时传更窄的值 */
  innerClassName?: string
  /** 是否吸顶（整页滚动布局可关闭） */
  sticky?: boolean
}

const TONE: Record<string, { bg: string; fg: string }> = {
  primary: { bg: 'var(--accent-cyan-dim)', fg: 'var(--color-primary)' },
  success: { bg: 'var(--accent-green-dim, rgba(16,185,129,0.12))', fg: 'var(--accent-green, #10b981)' },
  warning: { bg: 'var(--accent-orange-dim, rgba(245,158,11,0.12))', fg: 'var(--accent-orange, #f59e0b)' },
}

export default function PageHeader({
  icon: Icon, title, badge, hint, actions, innerClassName, sticky = true,
}: PageHeaderProps) {
  const tone = TONE[badge?.tone || 'primary'] || TONE.primary
  return (
    <header
      className={`shrink-0 border-b ${sticky ? 'sticky top-0 z-10' : ''}`}
      style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}
    >
      <div className={innerClassName || 'max-w-[1400px] mx-auto px-8 py-5'}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <Icon className="h-5 w-5 shrink-0" style={{ color: 'var(--color-primary)' }} />
            <h1 className="text-lg font-semibold truncate" style={{ color: 'var(--color-on-surface)' }}>{title}</h1>
            {badge && (
              <span className="text-xs tabular-nums px-2 py-0.5 rounded-full shrink-0"
                style={{ background: tone.bg, color: tone.fg }}>
                {badge.text}
              </span>
            )}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
        {hint && (
          <p className="text-xs mt-1 ml-8" style={{ color: 'var(--color-on-surface-variant)' }}>{hint}</p>
        )}
      </div>
    </header>
  )
}
