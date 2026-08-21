import { memo } from 'react'
import type { PersonalInfoContent } from '../../../../types/resume'

/** 简化的字段标签 */
const FIELDS: { key: keyof PersonalInfoContent; label: string; type?: 'text' | 'select'; options?: string[] }[] = [
  { key: 'fullName', label: '姓名' },
  { key: 'jobTitle', label: '职位' },
  { key: 'age', label: '年龄' },
  { key: 'gender', label: '性别', type: 'select', options: ['', '男', '女', '其他'] },
  { key: 'politicalStatus', label: '政治面貌', type: 'select', options: ['', '群众', '共青团员', '中共党员', '民主党派', '无党派人士'] },
  { key: 'ethnicity', label: '民族', type: 'select', options: ['', '汉族', '蒙古族', '回族', '藏族', '维吾尔族', '满族', '其他'] },
  { key: 'hometown', label: '籍贯' },
  { key: 'maritalStatus', label: '婚姻状况', type: 'select', options: ['', '未婚', '已婚', '离异', '保密'] },
  { key: 'yearsOfExperience', label: '工作年限' },
  { key: 'educationLevel', label: '最高学历', type: 'select', options: ['', '高中', '大专', '本科', '硕士', '博士', '其他'] },
  { key: 'email', label: '邮箱' },
  { key: 'phone', label: '电话' },
  { key: 'wechat', label: '微信' },
  { key: 'location', label: '所在地' },
  { key: 'website', label: '个人网站' },
]

function PersonalInfoFormImpl({
  content, onChange,
}: { content: PersonalInfoContent; onChange: (c: PersonalInfoContent) => void }) {
  const c = content || ({} as PersonalInfoContent)
  const set = (k: keyof PersonalInfoContent, v: string) => onChange({ ...c, [k]: v })

  return (
    <div className="space-y-4">
      {/* 头像占位 */}
      <div className="flex items-center gap-3 pb-3 border-b" style={{ borderColor: 'var(--color-outline-variant)' }}>
        <div className="h-16 w-16 rounded-full border-2 border-dashed border-zinc-300 flex items-center justify-center text-zinc-400 text-xs">
          头像
        </div>
        <div className="text-xs text-zinc-500">简历头像(本期占位,后续接入)</div>
      </div>

      {/* 字段两列布局 */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-4">
        {FIELDS.map((f) => (
          <div key={f.key} className="space-y-1">
            <label className="text-xs text-zinc-500">{f.label}</label>
            {f.type === 'select' ? (
              <select
                value={c[f.key] as string || ''}
                onChange={(e) => set(f.key, e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-zinc-200 text-sm outline-none focus:border-blue-400 bg-white"
              >
                {f.options!.map(o => <option key={o} value={o}>{o || '请选择'}</option>)}
              </select>
            ) : (
              <input
                type="text"
                value={c[f.key] as string || ''}
                onChange={(e) => set(f.key, e.target.value)}
                placeholder={f.label}
                className="w-full h-9 px-3 rounded-lg border border-zinc-200 text-sm outline-none focus:border-blue-400"
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// memo:content 引用不变时跳过重渲染
export const PersonalInfoForm = memo(PersonalInfoFormImpl)