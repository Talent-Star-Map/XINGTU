import { useState } from 'react'
import { TrendingUp, TrendingDown, Plus, Minus, Edit3, Zap, BarChart3, LineChart, Activity } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line as ReLine, LineChart as ReLineChart } from 'recharts'

const skillData = [
  { m:'1月', Python:45, LangChain:12, K8s:30, RAG:8, Agent:5 },
  { m:'2月', Python:48, LangChain:20, K8s:32, RAG:15, Agent:10 },
  { m:'3月', Python:50, LangChain:35, K8s:35, RAG:28, Agent:18 },
  { m:'4月', Python:52, LangChain:48, K8s:38, RAG:40, Agent:30 },
  { m:'5月', Python:55, LangChain:60, K8s:42, RAG:55, Agent:45 },
  { m:'6月', Python:58, LangChain:72, K8s:45, RAG:68, Agent:60 },
]

const salaryData = [
  { n:'AI应用开发', v:35 }, { n:'Java后端', v:28 }, { n:'大数据工程', v:30 },
  { n:'云原生', v:32 }, { n:'AI Agent', v:38 }, { n:'前端开发', v:22 },
]

const growthData = [
  { n:'MCP协议工程师', v:230 }, { n:'AI Agent工程师', v:180 },
  { n:'提示词工程师', v:95 }, { n:'LLM运维工程师', v:72 }, { n:'AI数据标注师', v:45 },
]

export default function Trend() {
  const [tab, setTab] = useState<'trend'|'discovery'|'update'>('trend')

  return (
    <div className="space-y-6 px-6 py-8 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold" style={{color:'var(--color-on-surface)'}}>趋势洞察</h1>
        <div className="flex gap-2">
          {(['trend','discovery','update'] as const).map(t => (
            <button key={t} onClick={()=>setTab(t)} className="px-3.5 py-1.5 rounded-lg text-xs font-semibold"
              style={{background:tab===t?'var(--color-primary)':'var(--color-surface)', color:tab===t?'#fff':'var(--color-on-surface-variant)', border:tab===t?'none':'1px solid var(--color-outline-variant)'}}>
              {t==='trend'?'趋势':t==='discovery'?'新岗位':'更新'}
            </button>
          ))}
        </div>
      </div>

      {tab==='trend' && (
        <div className="space-y-6">
          <div className="rounded-2xl border p-6" style={{borderColor:'var(--color-outline-variant)',background:'var(--color-surface-container-lowest)'}}>
            <div className="flex items-center gap-2 mb-6"><LineChart className="h-5 w-5" style={{color:'var(--color-primary)'}} /><h2 className="text-base font-bold" style={{color:'var(--color-on-surface)'}}>技能需求趋势（近6月）</h2></div>
            <ResponsiveContainer width="100%" height={300}>
              <ReLineChart data={skillData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-outline-variant)" strokeOpacity={0.4} />
                <XAxis dataKey="m" tick={{fill:'var(--color-on-surface-variant)',fontSize:12}} axisLine={false} tickLine={false} />
                <YAxis tick={{fill:'var(--color-on-surface-variant)',fontSize:12}} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{background:'var(--color-surface-container-lowest)',border:'1px solid var(--color-outline-variant)',borderRadius:8,fontSize:12}} />
                <ReLine type="monotone" dataKey="Python" stroke="#38BDF8" strokeWidth={2} dot={false} />
                <ReLine type="monotone" dataKey="LangChain" stroke="#2DD4BF" strokeWidth={2.5} dot={false} />
                <ReLine type="monotone" dataKey="K8s" stroke="#FBBF24" strokeWidth={2} dot={false} />
                <ReLine type="monotone" dataKey="RAG" stroke="#34D399" strokeWidth={2.5} dot={false} />
                <ReLine type="monotone" dataKey="Agent" stroke="#A78BFA" strokeWidth={2.5} dot={false} />
              </ReLineChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-4 mt-3 text-xs" style={{color:'var(--color-on-surface-variant)'}}>
              {[{c:'#38BDF8',l:'Python'},{c:'#2DD4BF',l:'LangChain'},{c:'#FBBF24',l:'K8s'},{c:'#34D399',l:'RAG'},{c:'#A78BFA',l:'Agent'}].map(i=>(
                <span key={i.l} className="flex items-center gap-1.5"><span className="w-3 h-0.5 rounded" style={{background:i.c,height:3}} />{i.l}</span>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-5">
            <div className="rounded-2xl border p-6" style={{borderColor:'var(--color-outline-variant)',background:'var(--color-surface-container-lowest)'}}>
              <div className="flex items-center gap-2 mb-5"><BarChart3 className="h-5 w-5" style={{color:'var(--accent-purple)'}} /><h2 className="text-base font-bold" style={{color:'var(--color-on-surface)'}}>薪资分布(K)</h2></div>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={salaryData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-outline-variant)" strokeOpacity={0.4} />
                  <XAxis dataKey="n" tick={{fill:'var(--color-on-surface-variant)',fontSize:11}} axisLine={false} tickLine={false} />
                  <YAxis tick={{fill:'var(--color-on-surface-variant)',fontSize:11}} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{background:'var(--color-surface-container-lowest)',border:'1px solid var(--color-outline-variant)',borderRadius:8,fontSize:12}} />
                  <Bar dataKey="v" fill="#7C3AED" radius={[6,6,0,0]} maxBarSize={50} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="rounded-2xl border p-6" style={{borderColor:'var(--color-outline-variant)',background:'var(--color-surface-container-lowest)'}}>
              <div className="flex items-center gap-2 mb-5"><Activity className="h-5 w-5" style={{color:'var(--accent-green)'}} /><h2 className="text-base font-bold" style={{color:'var(--color-on-surface)'}}>新兴岗位增长(%)</h2></div>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={growthData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-outline-variant)" strokeOpacity={0.4} />
                  <XAxis type="number" tick={{fill:'var(--color-on-surface-variant)',fontSize:11}} axisLine={false} tickLine={false} />
                  <YAxis dataKey="n" type="category" tick={{fill:'var(--color-on-surface-variant)',fontSize:11}} axisLine={false} tickLine={false} width={80} />
                  <Tooltip contentStyle={{background:'var(--color-surface-container-lowest)',border:'1px solid var(--color-outline-variant)',borderRadius:8,fontSize:12}} />
                  <Bar dataKey="v" fill="#00C8FF" radius={[0,6,6,0]} maxBarSize={30} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {tab==='discovery' && (
        <div className="rounded-2xl border p-6" style={{borderColor:'var(--color-outline-variant)',background:'var(--color-surface-container-lowest)'}}>
          <div className="flex items-start gap-4 mb-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{background:'rgba(0,200,255,0.1)'}}>
              <Zap className="h-7 w-7" style={{color:'var(--color-primary)'}} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-lg font-bold" style={{color:'var(--color-primary)'}}>MCP 协议开发工程师</h2>
                <span className="text-xs px-2 py-0.5 rounded font-semibold" style={{background:'rgba(0,200,255,0.15)',color:'var(--color-primary)'}}>新发现</span>
              </div>
              <p className="text-sm" style={{color:'var(--color-on-surface-variant)'}}>随着 AI Agent 普及，MCP 协议催生了这一新兴岗位。</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="rounded-xl p-4" style={{background:'rgba(0,229,153,0.05)'}}>
              <p className="text-xs font-semibold mb-2" style={{color:'var(--accent-green)'}}>必备技能</p>
              <div className="flex flex-wrap gap-1.5">{['MCP协议','Python/Go','API设计','Agent框架'].map(s=><span key={s} className="text-xs px-2.5 py-1 rounded-lg" style={{background:'rgba(0,229,153,0.1)',color:'var(--accent-green)'}}>{s}</span>)}</div>
            </div>
            <div className="rounded-xl p-4" style={{background:'rgba(0,200,255,0.05)'}}>
              <p className="text-xs font-semibold mb-2" style={{color:'var(--color-primary)'}}>加分技能</p>
              <div className="flex flex-wrap gap-1.5">{['LangChain','协议缓冲','OAuth'].map(s=><span key={s} className="text-xs px-2.5 py-1 rounded-lg" style={{background:'rgba(0,200,255,0.1)',color:'var(--color-primary)'}}>{s}</span>)}</div>
            </div>
          </div>
          <div className="flex gap-4 text-xs" style={{color:'var(--color-on-surface-variant)'}}><span>📅 2026年3月</span><span>✅ 多源交叉验证</span></div>
        </div>
      )}

      {tab==='update' && (
        <div className="rounded-2xl border p-6" style={{borderColor:'var(--color-outline-variant)',background:'var(--color-surface-container-lowest)'}}>
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{background:'rgba(124,58,237,0.1)'}}>
              <Edit3 className="h-5 w-5" style={{color:'var(--accent-purple)'}} />
            </div>
            <div><h2 className="text-base font-bold" style={{color:'var(--color-on-surface)'}}>Java 后端开发工程师</h2><p className="text-xs mt-0.5" style={{color:'var(--color-on-surface-variant)'}}>2026 Q1-Q2 · 234 条 JD</p></div>
          </div>
          <div className="space-y-4">
            <div className="flex items-start gap-4 rounded-xl p-4" style={{background:'rgba(0,229,153,0.05)'}}>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg shrink-0" style={{background:'rgba(0,229,153,0.15)'}}>
                <Plus className="h-4 w-4" style={{color:'var(--accent-green)'}} />
              </div>
              <div>
                <p className="text-sm font-semibold mb-2" style={{color:'var(--accent-green)'}}>新增</p>
                <div className="flex flex-wrap gap-2 mb-2">{['Spring Cloud','Kubernetes','Docker','Redis'].map(s=><span key={s} className="text-xs px-3 py-1 rounded-lg font-medium" style={{background:'rgba(0,229,153,0.1)',color:'var(--accent-green)'}}>{s}</span>)}</div>
                <p className="text-xs" style={{color:'var(--color-on-surface-variant)'}}>63% 的 Java 岗位已要求 K8s</p>
              </div>
            </div>
            <div className="flex items-start gap-4 rounded-xl p-4" style={{background:'rgba(255,77,106,0.05)'}}>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg shrink-0" style={{background:'rgba(255,77,106,0.15)'}}>
                <Minus className="h-4 w-4" style={{color:'var(--accent-red)'}} />
              </div>
              <div><p className="text-sm font-semibold mb-2" style={{color:'var(--accent-red)'}}>移除</p><div className="flex flex-wrap gap-2">{['Struts','Hibernate'].map(s=><span key={s} className="text-xs px-3 py-1 rounded-lg font-medium" style={{background:'rgba(255,77,106,0.1)',color:'var(--accent-red)'}}>{s}</span>)}</div></div>
            </div>
            <div className="flex items-start gap-4 rounded-xl p-4" style={{background:'rgba(124,58,237,0.05)'}}>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg shrink-0" style={{background:'rgba(124,58,237,0.15)'}}>
                <Edit3 className="h-4 w-4" style={{color:'var(--accent-purple)'}} />
              </div>
              <div><p className="text-sm font-semibold mb-2" style={{color:'var(--accent-purple)'}}>修改</p><p className="text-sm">Spring Boot 2.x → 3.x</p></div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
