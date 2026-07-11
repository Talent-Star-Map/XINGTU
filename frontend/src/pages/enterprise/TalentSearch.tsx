import { useState } from 'react'
import { Search, Users, Mail, ChevronDown } from 'lucide-react'
import { motion } from 'framer-motion'

const jobs = [
  { id: 1, title: 'AI 应用开发工程师', status: '招聘中', count: 8 },
  { id: 2, title: 'Java 后端开发', status: '招聘中', count: 12 },
  { id: 3, title: '大模型算法工程师', status: '招聘中', count: 4 },
]

const candidates = [
  { name: '张明', title: 'AI应用开发工程师', skills: ['Python','LangChain','RAG','FastAPI'], exp: '5年', salary: '35K', match: 92, av: '张' },
  { name: '李华', title: 'Java后端开发', skills: ['Java','Spring Boot','K8s','Docker','MySQL'], exp: '4年', salary: '28K', match: 88, av: '李' },
  { name: '王强', title: '大模型算法工程师', skills: ['Python','PyTorch','LLM','NLP'], exp: '3年', salary: '40K', match: 85, av: '王' },
  { name: '赵丽', title: '数据工程师', skills: ['Spark','Flink','Kafka','SQL','Python'], exp: '4年', salary: '30K', match: 78, av: '赵' },
  { name: '陈思', title: 'AI Agent工程师', skills: ['Python','LangChain','Agent框架','MCP'], exp: '3年', salary: '32K', match: 82, av: '陈' },
  { name: '刘洋', title: '全栈开发', skills: ['React','TypeScript','Node.js','Java','MySQL'], exp: '5年', salary: '33K', match: 74, av: '刘' },
]

export default function TalentSearch() {
  const [selectedJob, setSelectedJob] = useState(1)
  const [search, setSearch] = useState('')
  const [jobOpen, setJobOpen] = useState(false)

  return (
    <div className="space-y-6 px-6 py-8 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{color:'var(--color-on-surface)'}}>人才星</h1>
          <p className="text-sm mt-0.5" style={{color:'var(--color-on-surface-variant)'}}>基于能力图谱精准匹配候选人</p>
        </div>
      </div>
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4.5 w-4.5" style={{color:'var(--color-on-surface-variant)'}} />
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="搜索候选人姓名或技能..."
            className="w-full h-11 rounded-xl border pl-11 pr-4 text-sm outline-none"
            style={{borderColor:'var(--color-outline-variant)',background:'var(--color-surface-container-lowest)',color:'var(--color-on-surface)'}} />
        </div>
        <div className="relative">
          <button onClick={()=>setJobOpen(!jobOpen)}
            className="flex items-center gap-2 h-11 px-4 rounded-xl border text-sm font-medium"
            style={{borderColor:'var(--color-outline-variant)',background:'var(--color-surface-container-lowest)',color:'var(--color-on-surface-variant)'}}>
            <Users className="h-4.5 w-4.5" />
            {jobs.find(j=>j.id===selectedJob)?.title||'选择岗位'}
            <ChevronDown className="h-4 w-4" />
          </button>
          {jobOpen && (
            <motion.div initial={{opacity:0,y:-4}} animate={{opacity:1,y:0}}
              className="absolute right-0 top-full mt-2 w-64 rounded-xl border py-1 z-50"
              style={{borderColor:'var(--color-outline-variant)',background:'var(--color-surface-container-lowest)'}}>
              {jobs.map(job=>(
                <button key={job.id} onClick={()=>{setSelectedJob(job.id);setJobOpen(false)}}
                  className="flex items-center justify-between w-full px-4 py-3 text-sm transition-colors"
                  style={{color:selectedJob===job.id?'var(--color-primary)':'var(--color-on-surface)',background:selectedJob===job.id?'var(--color-primary-fixed)':'transparent'}}>
                  <span>{job.title}</span>
                  <span className="text-xs" style={{color:'var(--color-on-surface-variant)'}}>{job.count} 人</span>
                </button>
              ))}
            </motion.div>
          )}
        </div>
      </div>
      <div className="space-y-4">
        {candidates.filter(c=>!search||c.name.includes(search)||c.skills.some(s=>s.includes(search))).map((c,i)=>(
          <motion.div key={c.name} initial={{opacity:0,y:12}} whileInView={{opacity:1,y:0}} viewport={{once:true}} transition={{delay:i*0.04}}
            className="rounded-xl border p-5 transition-all hover:shadow-md cursor-pointer"
            style={{borderColor:'var(--color-outline-variant)',background:'var(--color-surface-container-lowest)'}}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-base font-bold" style={{background:'var(--color-primary-fixed)',color:'var(--color-primary)'}}>{c.av}</div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold" style={{color:'var(--color-on-surface)'}}>{c.name}</h3>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{background:'var(--color-primary-fixed)',color:'var(--color-primary)'}}>{c.title}</span>
                  </div>
                  <p className="text-xs mt-1" style={{color:'var(--color-on-surface-variant)'}}>{c.exp} · {c.salary}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <p className="text-xl font-bold" style={{color:c.match>=85?'var(--accent-green)':'var(--color-primary)'}}>{c.match}%</p>
                <button className="p-2 rounded-lg border" style={{borderColor:'var(--color-outline-variant)',color:'var(--color-primary)'}}><Mail className="h-4.5 w-4.5" /></button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-4">{c.skills.map(s=><span key={s} className="text-xs px-2.5 py-1 rounded-full" style={{background:'#D5E4FA',color:'var(--color-on-surface-variant)'}}>{s}</span>)}</div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
