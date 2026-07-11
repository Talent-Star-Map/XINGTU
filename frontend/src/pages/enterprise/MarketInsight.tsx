import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, Zap, Braces, Database, Code, Cpu, Activity, Share2 } from 'lucide-react'
import Graph3D from '../../components/Graph3D'

const rising = [
  { n:'LangChain', r:'+320%', icon:Braces, c:'#2DD4BF' },
  { n:'MCP协议', r:'+280%', icon:Code, c:'#38BDF8' },
  { n:'Agent框架', r:'+180%', icon:Cpu, c:'#A78BFA' },
  { n:'RAG', r:'+210%', icon:Database, c:'#34D399' },
  { n:'Prompt', r:'+95%', icon:Zap, c:'#FB923C' },
]

const declining = [
  { n:'Struts', r:'-95%', icon:Braces, c:'#F87171' },
  { n:'Hibernate', r:'-80%', icon:Database, c:'#F87171' },
  { n:'jQuery', r:'-70%', icon:Code, c:'#F87171' },
]

const emerging = [
  { n:'MCP协议工程师', g:'+230%', c:'#00C8FF' },
  { n:'AI Agent工程师', g:'+180%', c:'#7C3AED' },
  { n:'提示词工程师', g:'+95%', c:'#00E599' },
]

export default function MarketInsight() {
  return (
    <div className="space-y-6 px-6 py-8 max-w-[1400px] mx-auto">
      <div><h1 className="text-xl font-bold" style={{color:'var(--color-on-surface)'}}>市场洞察</h1>
        <p className="text-sm mt-0.5" style={{color:'var(--color-on-surface-variant)'}}>实时追踪新一代信息技术领域技能需求变化</p></div>

      <motion.div initial={{opacity:0,y:12}} animate={{opacity:1,y:0}}
        className="rounded-2xl border overflow-hidden" style={{borderColor:'var(--color-outline-variant)',background:'var(--color-surface-container-lowest)',height:380}}>
        <div className="flex items-center gap-2 px-6 py-4 border-b" style={{borderColor:'var(--color-outline-variant)'}}>
          <Share2 className="h-5 w-5" style={{color:'var(--color-primary)'}} />
          <h2 className="text-base font-bold" style={{color:'var(--color-on-surface)'}}>岗位图谱概览</h2>
          <span className="text-xs ml-auto" style={{color:'var(--color-on-surface-variant)'}}>5岗位 · 14技能 · 24关联</span>
        </div>
        <div className="w-full" style={{height:330}}>
          <Graph3D />
        </div>
      </motion.div>

      <div className="grid grid-cols-3 gap-5">
        {[{t:'快速增长技能',icon:TrendingUp,bg:'rgba(45,212,191,0.1)',iconC:'#2DD4BF',delay:0.05,items:rising},
          {t:'需求下降技能',icon:TrendingDown,bg:'rgba(248,113,113,0.1)',iconC:'#F87171',delay:0.1,items:declining},
          {t:'新兴岗位增长',icon:Zap,bg:'rgba(0,200,255,0.1)',iconC:'#00C8FF',delay:0.15,items:emerging},
        ].map(col=>(
          <motion.div key={col.t} initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{delay:col.delay}}
            className="rounded-2xl border p-5" style={{borderColor:'var(--color-outline-variant)',background:'var(--color-surface-container-lowest)'}}>
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{background:col.bg}}>
                <col.icon className="h-4.5 w-4.5" style={{color:col.iconC}} />
              </div>
              <h3 className="text-sm font-bold" style={{color:'var(--color-on-surface)'}}>{col.t}</h3>
            </div>
            <div className="space-y-3">
              {col.items.map((item:any,i:number)=>(
                <div key={i} className="flex items-center justify-between py-1.5 border-b last:border-0" style={{borderColor:'var(--color-outline-variant)'}}>
                  <div className="flex items-center gap-2.5">
                    {item.icon && <div className="flex h-7 w-7 items-center justify-center rounded-md" style={{background:`${item.c}15`}}>
                      <item.icon className="h-3.5 w-3.5" style={{color:item.c}} />
                    </div>}
                    <span className="text-xs font-medium" style={{color:'var(--color-on-surface)'}}>{item.n}</span>
                  </div>
                  <span className="text-xs font-bold" style={{color:item.c||item.color}}>{item.r||item.g}</span>
                </div>
              ))}
            </div>
            {col.t==='新兴岗位增长'&&<div className="mt-4 pt-3 border-t flex items-center gap-2 text-[10px]" style={{borderColor:'var(--color-outline-variant)',color:'var(--color-on-surface-variant)'}}>
              <Activity className="h-3 w-3" />基于近6个月多源招聘数据
            </div>}
          </motion.div>
        ))}
      </div>
    </div>
  )
}
