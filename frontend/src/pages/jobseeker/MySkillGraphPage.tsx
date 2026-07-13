import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Code, Database, Cloud, Terminal, BookOpen, Loader2, TrendingUp, Wrench, Cpu, Globe, X, ArrowRight, Briefcase, MapPin, GraduationCap, Banknote, ExternalLink } from 'lucide-react'
import Graph3D from '../../components/Graph3D'
import ProfileSidebar from '../../components/ProfileSidebar'
import CompanyCard from '../../components/CompanyCard'

const skillCats: { name: string; icon: any; color: string; keywords: string[] }[] = [
  { name: '编程语言', icon: Code, color: '#0052D9', keywords: ['java', 'python', 'go', 'rust', 'c++', 'typescript', 'javascript', 'c#', 'php', 'ruby', 'swift', 'kotlin', 'scala'] },
  { name: '框架与工具', icon: Terminal, color: '#5B21B6', keywords: ['spring', 'django', 'flask', 'fastapi', 'react', 'vue', 'angular', 'node', 'express', 'mybatis', 'hibernate', 'jquery'] },
  { name: '数据库', icon: Database, color: '#059669', keywords: ['mysql', 'postgresql', 'redis', 'mongodb', 'elasticsearch', 'oracle', 'sqlite', 'cassandra', 'neo4j'] },
  { name: '云原生/DevOps', icon: Cloud, color: '#D97706', keywords: ['docker', 'kubernetes', 'k8s', 'jenkins', 'git', 'linux', 'aws', 'azure', 'gcp', 'nginx', 'ci/cd', 'devops', 'terraform'] },
  { name: 'AI/ML', icon: Cpu, color: '#DC2626', keywords: ['机器学习', '深度学习', 'nlp', 'cv', '大模型', 'llm', 'rag', 'tensorflow', 'pytorch', 'langchain', 'agent', 'transformer', 'ai'] },
  { name: '数据/流处理', icon: TrendingUp, color: '#7C3AED', keywords: ['spark', 'flink', 'hadoop', 'kafka', 'rabbitmq', 'pandas', 'numpy', 'hive', 'airflow'] },
  { name: '其他工具', icon: Wrench, color: '#0891B2', keywords: ['git', 'restful', 'graphql', 'websocket', '微服务', '分布式', '高并发', '架构设计', 'html', 'css', 'sass', 'less'] },
]

interface JobItem {
  id: number; title: string; company: string; location: string
  salary: string; education: string; experience: string
  description: string; skills: string[]; source: string; collected_at: string
}

function classifySkill(skill: string): string | null {
  const s = skill.trim().toLowerCase()
  for (const cat of skillCats) {
    for (const kw of cat.keywords) {
      if (s.includes(kw) || kw.includes(s)) return cat.name
    }
  }
  return null
}

export default function MySkillGraphPage() {
  const [skills, setSkills] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null)
  const [jobs, setJobs] = useState<JobItem[]>([])
  const [jobsLoading, setJobsLoading] = useState(false)
  const [selectedJob, setSelectedJob] = useState<JobItem | null>(null)
  const [companyModal, setCompanyModal] = useState<string | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('xingtu_token')
    if (!token) { setLoading(false); return }
    fetch(`/api/auth/profile?token=${token}`).then(r => r.json()).then(d => {
      if (d.success && d.data.skills) {
        setSkills(d.data.skills.split(',').map((s: string) => s.trim()).filter(Boolean))
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const handleSkillClick = async (skill: string) => {
    if (selectedSkill === skill) { setSelectedSkill(null); setJobs([]); setSelectedJob(null); return }
    setSelectedSkill(skill)
    setSelectedJob(null)
    setJobsLoading(true)
    try {
      const r = await fetch(`/api/jobs?skill=${encodeURIComponent(skill)}`)
      const d = await r.json()
      if (d.success) setJobs(d.data)
    } catch { /* ignore */ }
    setJobsLoading(false)
  }

  const categorized = skillCats.map(cat => ({
    ...cat,
    skills: skills.filter(s => classifySkill(s) === cat.name),
    level: skills.length ? Math.min(Math.round((skills.filter(s => classifySkill(s) === cat.name).length / skills.length) * 100 + 20), 100) : 0,
  })).filter(cat => cat.skills.length > 0)

  const uncategorized = skills.filter(s => !classifySkill(s))

  const jobDetail = selectedJob || (jobs.length === 1 ? jobs[0] : null)

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--color-primary)' }} />
    </div>
  )

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex gap-8">
        <ProfileSidebar />
        <div className="flex-1 space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <BookOpen className="h-5 w-5" style={{ color: 'var(--color-primary)' }} />
            <h1 className="text-xl font-bold" style={{ color: 'var(--color-on-surface)' }}>我的能力图谱</h1>
          </div>
          <p className="text-sm -mt-3 mb-4" style={{ color: 'var(--color-on-surface-variant)' }}>
            {selectedSkill ? (
              <span>已选 <span className="font-semibold" style={{ color: 'var(--color-primary)' }}>{selectedSkill}</span> — 点击其他技能切换，再次点击取消</span>
            ) : (
              <span>点击任意技能标签查看关联岗位{skills.length > 0 && ` — 共 ${skills.length} 项技能`}</span>
            )}
          </p>

          {skills.length === 0 ? (
            <div className="rounded-2xl border p-16 text-center" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)', borderStyle: 'dashed' }}>
              <BookOpen className="h-12 w-12 mx-auto mb-4" style={{ color: 'var(--color-on-surface-variant)' }} />
              <h3 className="text-base font-semibold mb-2" style={{ color: 'var(--color-on-surface)' }}>暂无技能数据</h3>
              <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>上传简历或在个人资料中添加技能标签，能力图谱将自动生成</p>
            </div>
          ) : (
            <div className="flex gap-6">
              {/* 左侧：图谱+技能卡片 */}
              <div className="flex-1 space-y-6 min-w-0">
                {/* 3D 图谱 */}
                <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)', height: 320 }}>
                  <Graph3D skills={skills} />
                </div>

                {/* 分类技能卡片 */}
                <div className="grid grid-cols-2 gap-4">
                  {categorized.map(cat => (
                    <div key={cat.name} className="rounded-2xl border p-5" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
                      <div className="flex items-center gap-3 mb-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: `${cat.color}15` }}>
                          <cat.icon className="h-5 w-5" style={{ color: cat.color }} />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-sm font-semibold" style={{ color: 'var(--color-on-surface)' }}>{cat.name}</h3>
                          <div className="mt-2 h-2 rounded-full" style={{ background: 'var(--color-surface-container)' }}>
                            <motion.div className="h-full rounded-full"
                              initial={{ width: 0 }} whileInView={{ width: `${cat.level}%` }} viewport={{ once: true }} transition={{ duration: 1, ease: 'easeOut' }}
                              style={{ background: `linear-gradient(90deg, ${cat.color}66, ${cat.color})` }} />
                          </div>
                          <span className="text-xs mt-1 block text-right font-semibold" style={{ color: cat.color }}>{cat.level}% · {cat.skills.length}项</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {cat.skills.map(s => (
                          <button key={s} onClick={() => handleSkillClick(s)}
                            className="px-2.5 py-1 rounded-md text-xs font-medium transition-all hover:ring-2 cursor-pointer"
                            style={{
                              background: selectedSkill === s ? cat.color : `${cat.color}10`,
                              color: selectedSkill === s ? '#fff' : cat.color,
                              ringColor: cat.color,
                            }}>
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  {uncategorized.length > 0 && (
                    <div className="rounded-2xl border p-5" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
                      <div className="flex items-center gap-3 mb-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'rgba(128,128,128,0.1)' }}>
                          <Globe className="h-5 w-5" style={{ color: '#888' }} />
                        </div>
                        <h3 className="text-sm font-semibold" style={{ color: 'var(--color-on-surface)' }}>其他技能</h3>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {uncategorized.map(s => (
                          <button key={s} onClick={() => handleSkillClick(s)}
                            className="px-2.5 py-1 rounded-md text-xs font-medium transition-all hover:ring-2 cursor-pointer"
                            style={{
                              background: selectedSkill === s ? '#888' : 'rgba(128,128,128,0.08)',
                              color: selectedSkill === s ? '#fff' : '#888',
                            }}>
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 右侧：关联岗位面板 */}
              {selectedSkill && (
                <div className="w-80 shrink-0 space-y-4" style={{ maxHeight: 'calc(100vh - 120px)', position: 'sticky', top: 88 }}>
                  {!selectedJob ? (
                    <div className="rounded-2xl border" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
                      <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--color-outline-variant)' }}>
                        <div>
                          <h3 className="text-sm font-bold" style={{ color: 'var(--color-on-surface)' }}>关联岗位</h3>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>需要 <span className="font-semibold" style={{ color: 'var(--color-primary)' }}>{selectedSkill}</span> 的岗位</p>
                        </div>
                        <button onClick={() => { setSelectedSkill(null); setJobs([]) }} className="p-1.5 rounded-lg" style={{ color: 'var(--color-on-surface-variant)' }}><X className="h-4 w-4" /></button>
                      </div>
                      <div className="divide-y max-h-[60vh] overflow-y-auto" style={{ borderColor: 'var(--color-outline-variant)' }}>
                        {jobsLoading ? (
                          <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--color-primary)' }} /></div>
                        ) : jobs.length === 0 ? (
                          <div className="py-10 text-center"><p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>暂无相关岗位数据</p></div>
                        ) : (
                          jobs.map(job => (
                            <button key={job.id} onClick={() => setSelectedJob(job)}
                              className="w-full text-left px-5 py-4 transition-colors hover:bg-[var(--color-surface)] block">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-on-surface)' }}>{job.title}</p>
                                  <p className="text-xs mt-1" style={{ color: 'var(--color-on-surface-variant)' }}><button onClick={e => { e.stopPropagation(); setCompanyModal(job.company) }} className="hover:underline font-medium" style={{ color: 'var(--color-primary)' }}>{job.company}</button> · {job.location}</p>
                                  <p className="text-xs mt-1" style={{ color: 'var(--color-primary)' }}>{job.salary}</p>
                                </div>
                                <ArrowRight className="h-4 w-4 shrink-0 mt-1" style={{ color: 'var(--color-on-surface-variant)' }} />
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  ) : (
                    /* 岗位详情 */
                    <div className="rounded-2xl border" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
                      <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--color-outline-variant)' }}>
                        <h3 className="text-sm font-bold" style={{ color: 'var(--color-on-surface)' }}>岗位详情</h3>
                        <div className="flex items-center gap-1">
                          <button onClick={() => setSelectedJob(null)} className="p-1.5 rounded-lg text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>返回列表</button>
                          <button onClick={() => { setSelectedSkill(null); setJobs([]); setSelectedJob(null) }} className="p-1.5 rounded-lg" style={{ color: 'var(--color-on-surface-variant)' }}><X className="h-4 w-4" /></button>
                        </div>
                      </div>
                      <div className="p-5 space-y-4 max-h-[65vh] overflow-y-auto">
                        <h4 className="text-base font-bold" style={{ color: 'var(--color-on-surface)' }}>{selectedJob.title}</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2"><Briefcase className="h-4 w-4 shrink-0" style={{ color: 'var(--color-on-surface-variant)' }} /><button onClick={() => setCompanyModal(selectedJob.company)} className="hover:underline font-semibold" style={{ color: 'var(--color-primary)' }}>{selectedJob.company}</button></div>
                          <div className="flex items-center gap-2"><MapPin className="h-4 w-4 shrink-0" style={{ color: 'var(--color-on-surface-variant)' }} /><span style={{ color: 'var(--color-on-surface)' }}>{selectedJob.location}</span></div>
                          <div className="flex items-center gap-2"><Banknote className="h-4 w-4 shrink-0" style={{ color: 'var(--color-on-surface-variant)' }} /><span style={{ color: 'var(--color-on-surface)' }}>{selectedJob.salary}</span></div>
                          <div className="flex items-center gap-2"><GraduationCap className="h-4 w-4 shrink-0" style={{ color: 'var(--color-on-surface-variant)' }} /><span style={{ color: 'var(--color-on-surface)' }}>{selectedJob.education} · {selectedJob.experience}</span></div>
                        </div>
                        <p className="text-sm leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>{selectedJob.description}</p>
                        <div>
                          <p className="text-xs font-semibold mb-2" style={{ color: 'var(--color-on-surface-variant)' }}>岗位技能要求</p>
                          <div className="flex flex-wrap gap-1.5">
                            {selectedJob.skills.map(s => {
                              const isSelected = s.toLowerCase() === selectedSkill.toLowerCase()
                              return (
                                <span key={s} className={`px-2.5 py-1 rounded-md text-xs font-medium ${isSelected ? 'ring-2' : ''}`}
                                  style={{
                                    background: isSelected ? 'var(--color-primary)' : 'var(--color-primary-fixed)',
                                    color: isSelected ? '#fff' : 'var(--color-primary)',
                                    ...(isSelected ? { ringColor: 'var(--color-primary)' } : {}),
                                  }}>
                                  {s}
                                </span>
                              )
                            })}
                          </div>
                        </div>
                        <a href={`https://www.zhipin.com/web/geek/job?query=${encodeURIComponent(selectedJob.title)}&city=100010000`}
                          target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1.5 mt-3 text-xs font-semibold px-3 py-2 rounded-lg w-fit"
                          style={{ color: '#fff', background: 'linear-gradient(135deg, var(--color-primary), var(--accent-purple))' }}>
                          <ExternalLink className="h-3.5 w-3.5" /> 查看原招聘信息
                        </a>
                        <p className="text-[10px] mt-2" style={{ color: 'var(--color-on-surface-variant)' }}>数据来源：{selectedJob.source} · {selectedJob.collected_at}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {companyModal && <CompanyCard companyName={companyModal} onClose={() => setCompanyModal(null)} />}
    </div>
  )
}
