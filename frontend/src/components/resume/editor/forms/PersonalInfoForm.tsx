import { memo, useRef } from 'react'
import { Camera } from 'lucide-react'
import type { PersonalInfoContent } from '../../../../types/resume'

/** 表单字段定义 — 顺序按截图排版 */
const FIELDS: {
  key: keyof PersonalInfoContent
  label: string
  type?: 'text' | 'select'
  options?: string[]
  fullWidth?: boolean
}[] = [
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
  { key: 'website', label: '个人网站', fullWidth: true },
]

/** 输入框统一样式 — 圆角细边 + focus 蓝边 */
const INPUT_CLASS = 'w-full h-10 px-3 rounded-lg border border-zinc-200 text-sm text-zinc-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-colors bg-white placeholder:text-zinc-400'

function PersonalInfoFormImpl({
  content, onChange,
}: { content: PersonalInfoContent; onChange: (c: PersonalInfoContent) => void }) {
  const c = content || ({} as PersonalInfoContent)
  const set = (k: keyof PersonalInfoContent, v: string) => onChange({ ...c, [k]: v })
  const fileRef = useRef<HTMLInputElement>(null)

  const avatarShape: 'circle' | 'photo1inch' = c.avatarShape || 'circle'
  const onPickFile = () => fileRef.current?.click()
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => set('avatar', String(reader.result || ''))
    reader.readAsDataURL(file)
  }

  return (
    <div className="space-y-6">
      {/* ─── 头像区 ─── */}
      <div className="flex items-center gap-4 pb-5 border-b border-zinc-100">
        {/* 上传框 */}
        <button
          type="button"
          onClick={onPickFile}
          className="relative h-20 w-20 rounded-full border-2 border-dashed border-zinc-300 hover:border-blue-400 transition-colors flex items-center justify-center bg-zinc-50 text-zinc-400 overflow-hidden shrink-0"
          title="点击上传头像"
        >
          {c.avatar ? (
            <img src={c.avatar} alt="avatar" className="h-full w-full object-cover" />
          ) : (
            <Camera className="h-6 w-6" />
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onFileChange}
          />
        </button>
        {/* 形状选择 pill */}
        <div className="inline-flex p-1 rounded-full bg-zinc-100 text-sm">
          {(['circle', 'photo1inch'] as const).map((shape) => (
            <button
              key={shape}
              type="button"
              onClick={() => set('avatarShape', shape)}
              className={`px-4 h-8 rounded-full transition-colors ${
                avatarShape === shape
                  ? 'bg-white text-zinc-800 shadow-sm font-medium'
                  : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >
              {shape === 'circle' ? '圆形' : '1寸照'}
            </button>
          ))}
        </div>
      </div>

      {/* ─── 字段两列布局 ─── */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-4">
        {FIELDS.map((f) => (
          <div key={f.key} className={`space-y-1.5 ${f.fullWidth ? 'col-span-2' : ''}`}>
            <label className="block text-xs text-zinc-500">{f.label}</label>
            {f.type === 'select' ? (
              <div className="relative">
                <select
                  value={c[f.key] as string || ''}
                  onChange={(e) => set(f.key, e.target.value)}
                  className={`${INPUT_CLASS} appearance-none pr-9`}
                >
                  {f.options!.map(o => <option key={o} value={o}>{o || f.label}</option>)}
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 text-xs">▾</span>
              </div>
            ) : (
              <input
                type="text"
                value={c[f.key] as string || ''}
                onChange={(e) => set(f.key, e.target.value)}
                placeholder={f.label}
                className={INPUT_CLASS}
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
