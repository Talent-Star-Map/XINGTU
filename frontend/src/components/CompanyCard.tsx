import { useState, useEffect } from 'react'
import { Building, Globe, Users, Tag, MapPin, X, Loader2, ShieldCheck, Award, ShieldOff, Star } from 'lucide-react'

interface Props {
  companyName: string
  onClose: () => void
}

const verifyInfo = [
  { level: 0, icon: ShieldOff, label: '未认证', color: 'var(--color-on-surface-variant)', bg: 'rgba(128,128,128,0.08)' },
  { level: 1, icon: ShieldCheck, label: '官网已验证', color: 'var(--color-primary)', bg: 'var(--color-primary-fixed)' },
  { level: 2, icon: Award, label: '三方认证', color: 'var(--accent-green)', bg: 'rgba(0,229,153,0.1)' },
]

export default function CompanyCard({ companyName, onClose }: Props) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/company/public/${encodeURIComponent(companyName)}`).then(r => r.json()).then(d => {
      if (d.success) setData(d.data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [companyName])

  if (loading) return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div className="rounded-2xl border p-10" style={{ background: 'var(--color-surface-container-lowest)', borderColor: 'var(--color-outline-variant)' }} onClick={e => e.stopPropagation()}>
        <Loader2 className="h-8 w-8 animate-spin mx-auto" style={{ color: 'var(--accent-purple)' }} />
      </div>
    </div>
  )

  const v = verifyInfo.find(x => x.level === (data?.verified || 0)) || verifyInfo[0]
  const VIcon = v.icon

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div className="rounded-2xl border w-full max-w-lg max-h-[85vh] overflow-y-auto" style={{ background: 'var(--color-surface-container-lowest)', borderColor: 'var(--color-outline-variant)' }} onClick={e => e.stopPropagation()}>
        {/* 头部 */}
        <div className="relative p-6 pb-4 border-b" style={{ borderColor: 'var(--color-outline-variant)' }}>
          <button onClick={onClose} className="absolute right-4 top-4 p-2 rounded-lg" style={{ color: 'var(--color-on-surface-variant)' }}><X className="h-5 w-5" /></button>
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-xl overflow-hidden border flex items-center justify-center shrink-0" style={{ borderColor: data?.verified >= 1 ? 'var(--color-primary)' : 'var(--color-outline-variant)', background: 'var(--color-surface)' }}>
              {data?.company_logo ? (
                <img src={data.company_logo.startsWith('http') ? data.company_logo : `http://localhost:8083${data.company_logo}`} alt="" className="w-full h-full object-cover" />
              ) : (
                <Building className="h-8 w-8" style={{ color: 'var(--color-on-surface-variant)' }} />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-bold" style={{ color: 'var(--color-on-surface)' }}>{data?.company_name || companyName}</h3>
                <span className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-full font-semibold border" style={{ background: v.bg, color: v.color, borderColor: v.color + '33' }}>
                  <VIcon className="h-3 w-3" /> {v.label}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {data?.industry && <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'var(--accent-purple-dim)', color: 'var(--accent-purple)' }}>{data.industry}</span>}
                {data?.company_size && <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-primary)' }}>{data.company_size}</span>}
                {data?.city && <span className="text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1" style={{ background: 'var(--color-surface-container)', color: 'var(--color-on-surface-variant)' }}><MapPin className="h-3 w-3" />{data.city}</span>}
              </div>
            </div>
          </div>
        </div>

        {/* 内容 */}
        <div className="p-6 space-y-5">
          {data?.company_desc && (
            <div>
              <p className="text-xs font-semibold mb-2" style={{ color: 'var(--color-on-surface-variant)' }}>公司简介</p>
              <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--color-on-surface)' }}>{data.company_desc}</p>
            </div>
          )}

          {data?.company_benefits?.trim() && (
            <div>
              <p className="text-xs font-semibold mb-2" style={{ color: 'var(--color-on-surface-variant)' }}>公司福利</p>
              <div className="flex flex-wrap gap-1.5">
                {data.company_benefits.split(/[,，、]/).filter(Boolean).map((b: string) => (
                  <span key={b} className="px-2.5 py-1 rounded-md text-xs font-medium" style={{ background: 'var(--accent-purple-dim)', color: 'var(--accent-purple)' }}>{b.trim()}</span>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 text-sm">
            {data?.company_website && (
              <div className="flex items-center gap-2"><Globe className="h-4 w-4 shrink-0" style={{ color: 'var(--color-on-surface-variant)' }} /><a href={data.company_website} target="_blank" rel="noopener noreferrer" className="hover:underline truncate" style={{ color: 'var(--color-primary)' }}>公司官网</a></div>
            )}
            {data?.city && <div className="flex items-center gap-2"><MapPin className="h-4 w-4 shrink-0" style={{ color: 'var(--color-on-surface-variant)' }} /><span style={{ color: 'var(--color-on-surface-variant)' }}>{data.city}</span></div>}
            <div className="flex items-center gap-2"><Tag className="h-4 w-4 shrink-0" style={{ color: 'var(--color-on-surface-variant)' }} /><span style={{ color: data?.industry ? 'var(--color-on-surface)' : 'var(--color-on-surface-variant)', fontStyle: data?.industry ? 'normal' : 'italic' }}>{data?.industry || '未填写'}</span></div>
            <div className="flex items-center gap-2"><Users className="h-4 w-4 shrink-0" style={{ color: 'var(--color-on-surface-variant)' }} /><span style={{ color: data?.company_size ? 'var(--color-on-surface)' : 'var(--color-on-surface-variant)', fontStyle: data?.company_size ? 'normal' : 'italic' }}>{data?.company_size || '未填写'}</span></div>
          </div>
        </div>
      </div>
    </div>
  )
}
