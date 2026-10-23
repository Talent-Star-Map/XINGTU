import { LayoutDashboard, Activity, Users, Building2, Briefcase, GitBranch, FileCheck2, ShieldCheck, BookOpen, Cpu, Network, Settings2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type AdminPage = 'dashboard' | 'databoard' | 'quality' | 'jobseekers' | 'enterprises' | 'jobs' | 'resources' | 'models' | 'role-definitions' | 'classification-review'
export type AdminGroup = 'overview' | 'users' | 'knowledge' | 'learning' | 'settings'
export const adminPages: Record<AdminPage, { label: string; description: string; icon: LucideIcon }> = {
  dashboard: { label: '工作台', description: '查看平台运行状态、最近动态与常用操作。', icon: LayoutDashboard },
  databoard: { label: '数据大屏', description: '集中分析全平台指标与趋势，支持展示与汇报。', icon: Activity },
  jobseekers: { label: '求职者管理', description: '维护求职者账号、资料与账号状态。', icon: Users },
  enterprises: { label: '企业管理', description: '管理入驻企业、资质与账号状态。', icon: Building2 },
  jobs: { label: '职位管理', description: '查看和维护平台职位与招聘信息。', icon: Briefcase },
  'classification-review': { label: '分类审核', description: '核对招聘原文，审核工作性质与岗位方向归类。', icon: GitBranch },
  'role-definitions': { label: '岗位定义', description: '维护岗位职责、技能证据及定义版本，审核后发布。', icon: FileCheck2 },
  quality: { label: '数据质检', description: '检查多源一致性、疑似复制与异常要求，追踪数据质量。', icon: ShieldCheck },
  resources: { label: '学习资源', description: '维护课程、资料及技能学习资源。', icon: BookOpen },
  models: { label: '模型配置', description: '配置模型服务、调用参数并验证连接状态。', icon: Cpu },
}
export const adminGroups: { key: AdminGroup; label: string; icon: LucideIcon; pages: AdminPage[] }[] = [
  { key: 'overview', label: '平台总览', icon: LayoutDashboard, pages: ['dashboard', 'databoard'] },
  { key: 'users', label: '用户管理', icon: Users, pages: ['jobseekers', 'enterprises'] },
  { key: 'knowledge', label: '岗位与图谱', icon: Network, pages: ['jobs', 'classification-review', 'role-definitions', 'quality'] },
  { key: 'learning', label: '学习内容', icon: BookOpen, pages: ['resources'] },
  { key: 'settings', label: '系统设置', icon: Settings2, pages: ['models'] },
]
export function groupForPage(page: AdminPage) { return adminGroups.find(group => group.pages.includes(page))! }
export function readAdminPage(hash: string): AdminPage {
  const key = hash.replace(/^#\/?admin\/?/, '')
  return Object.prototype.hasOwnProperty.call(adminPages, key) ? key as AdminPage : 'dashboard'
}
