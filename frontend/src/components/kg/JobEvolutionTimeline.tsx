/**
 * JobEvolutionTimeline — 岗位动态演化(三大维度)
 *
 * 主视图(可切换 Tab):
 *   1. **技能演化**(主)— 多线图,该岗位所要求技能的"被需要次数"随时间变化
 *   2. **岗位名称演化**(主)— 同族岗位名(同 title_normalized)的时间轴出现/淡出
 *   3. **薪资**(次)— 单线图,该岗位平均薪资随时间变化
 *
 * 当前为演示版,所有数据由 jobId 派生稳定种子生成。
 */
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceDot, Legend,
} from 'recharts'
import { TrendingUp, GitBranch, Wallet } from 'lucide-react'

type Tab = 'skill' | 'title' | 'salary'

interface Props {
  jobId?: number
  height?: number
  onChangePointClick?: (date: string) => void
}

// ── 稳定种子哈希(给定 jobId → 同一份曲线) ──
function seedHash(s: string): number {
  let v = 0
  for (let i = 0; i < s.length; i++) v = (v * 31 + s.charCodeAt(i)) >>> 0
  return v
}
function rand(seed: number): () => number {
  // mulberry32 — 简单稳定 PRNG
  let t = seed >>> 0
  return () => {
    t = (t + 0x6d2b79f5) >>> 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

// ── 时间范围(给所有 tab 共享) ──
const RANGE_START = '2024-04-01'
const RANGE_END   = '2026-07-01'
function monthsBetween(): string[] {
  const out: string[] = []
  const start = new Date(RANGE_START)
  const end = new Date(RANGE_END)
  const cur = new Date(start)
  while (cur <= end) {
    out.push(cur.toISOString().slice(0, 10))
    cur.setMonth(cur.getMonth() + 1)
  }
  return out
}
const MONTHS = monthsBetween()

// ── 技能库(120+ 通用技能池,演示从 jobId 选 6 个相关技能) ──
const SKILL_POOL = [
  'Python', 'Java', 'JavaScript', 'TypeScript', 'Go', 'Rust', 'C++', 'C#',
  'SQL', 'MySQL', 'PostgreSQL', 'MongoDB', 'Redis', 'Elasticsearch', 'Kafka',
  'React', 'Vue', 'Angular', 'Node.js', 'Next.js', 'Spring Boot', 'Django',
  'Flask', 'FastAPI', 'GraphQL', 'gRPC', 'Docker', 'Kubernetes', 'Jenkins',
  'GitLab CI', 'AWS', 'Azure', 'GCP', 'Terraform', 'Ansible', 'Linux',
  'Shell', 'Nginx', 'Spark', 'Hadoop', 'Flink', 'Airflow', 'Hive', 'Presto',
  'TensorFlow', 'PyTorch', 'Pandas', 'NumPy', 'Scikit-learn', 'Keras',
  'Hugging Face', 'LangChain', 'OpenCV', 'NLTK', 'spaCy', 'RAG', 'LLM',
  'Prompt Engineering', 'Fine-tuning', '向量数据库', 'Embedding', 'A/B Test',
  'Tableau', 'Power BI', 'Excel', 'SPSS', 'R 语言', 'Matplotlib', 'Seaborn',
  'ETL', '数据仓库', '数据建模', '用户画像', '推荐系统', '搜索算法', '广告投放',
  '用户增长', '增长黑客', '产品经理', 'Axure', 'Figma', 'Sketch', '原型设计',
  '用户研究', 'AARRR', '需求分析', 'Scrum', 'Kanban', 'Jira', 'OKR', 'KPI',
  'MyBatis', 'Hibernate', 'Spring Cloud', 'Dubbo', 'Netty', 'WebSocket',
  'OAuth 2.0', 'JWT', 'HTTPS', 'TLS', '加密算法', '网络安全', '渗透测试',
  'SOC', 'SIEM', '威胁情报', 'ISO 27001', '等保', 'GDPR', '合规审计',
  'Figma', 'Photoshop', 'Illustrator', 'After Effects', 'Premiere', '剪映',
  'Unity', 'Unreal Engine', 'Cocos', 'OpenGL', 'WebGL', 'Shader', 'Vulkan',
  'iOS', 'Swift', 'Objective-C', 'Android', 'Kotlin', 'Jetpack Compose',
  'Flutter', 'React Native', '微信小程序', 'Taro', 'Electron', '鸿蒙',
]

// ── 岗位族名池(从 jobId 派生同族 title_normalized 的 ~6 个变体) ──
const TITLE_POOL = [
  ['软件工程师', '高级软件工程师', '资深软件工程师', '全栈工程师', '初级软件工程师', '软件研发工程师'],
  ['数据分析师', '高级数据分析师', '资深数据分析师', '商业数据分析师', '初级数据分析师', '数据运营'],
  ['产品经理', '高级产品经理', '产品总监', '初级产品经理', '产品实习生', '产品负责人'],
  ['Java 开发', 'Java 高级开发', 'Java 架构师', 'Java 实习生', 'Java 工程师', 'Java 技术专家'],
  ['前端工程师', '高级前端工程师', '资深前端工程师', 'Web 前端', '初级前端', '前端架构师'],
  ['算法工程师', '高级算法工程师', '资深算法工程师', '推荐算法工程师', '搜索算法工程师', 'NLP 算法工程师'],
  ['测试工程师', '高级测试工程师', '自动化测试工程师', '性能测试工程师', '测试开发工程师', 'QA 工程师'],
  ['运维工程师', '高级运维工程师', 'DevOps 工程师', 'SRE 工程师', '运维开发工程师', '云运维工程师'],
  ['AI 工程师', '高级 AI 工程师', 'AI 研究员', '机器学习工程师', '深度学习工程师', 'AI 产品经理'],
  ['数据科学家', '高级数据科学家', '资深数据科学家', '首席数据科学家', '数据科学实习生', '数据科学负责人'],
  ['Python 开发', 'Python 高级开发', 'Python 全栈开发', 'Python 后端', 'Python 数据工程师', 'Python 爬虫工程师'],
  ['iOS 开发工程师', '高级 iOS 开发', 'iOS 架构师', 'iOS 实习生', '资深 iOS 开发', 'iOS 技术负责人'],
  ['Android 开发工程师', '高级 Android 开发', 'Android 架构师', 'Android 实习生', '资深 Android 开发', 'Android 技术负责人'],
  ['产品运营', '高级产品运营', '用户运营', '内容运营', '社群运营', '活动运营'],
  ['市场专员', '高级市场专员', '市场总监', '品牌经理', '市场营销实习生', '市场负责人'],
  ['HRBP', '人力资源专员', '高级 HR', '招聘经理', '薪酬绩效专员', 'HR 实习生'],
  ['财务分析师', '高级财务分析师', '财务经理', '财务总监', '财务实习生', '财务负责人'],
  ['销售经理', '高级销售经理', '销售总监', '大客户销售', '渠道销售', '销售实习生'],
  ['UI 设计师', '高级 UI 设计师', '资深 UI 设计师', 'UI 设计总监', '初级 UI 设计师', 'UI 设计实习生'],
  ['UX 设计师', '高级 UX 设计师', '资深 UX 设计师', 'UX 设计总监', '交互设计师', 'UX 研究员'],
]

function pickFromPool<T>(pool: T[], n: number, jobId: number): T[] {
  const r = rand(seedHash(`pool:${jobId}`))
  const copy = [...pool]
  const out: T[] = []
  for (let i = 0; i < n && copy.length > 0; i++) {
    const idx = Math.floor(r() * copy.length)
    out.push(copy.splice(idx, 1)[0])
  }
  return out
}

// ── Tab 1: 技能演化 ──
function genSkillEvolution(jobId: number) {
  // 该岗位族下选 6 个相关技能
  const skills = pickFromPool(SKILL_POOL, 6, jobId)
  const r = rand(seedHash(`skill-evo:${jobId}`))
  // 每个技能有自己的"出现月份 + 兴衰曲线"
  const series: Record<string, { emergeMonth: number; peakMonth: number; peakVal: number; decay: boolean }> = {}
  skills.forEach((sk, i) => {
    const emerge = Math.floor(r() * 6)             // 0~6 月开始出现
    const peak = emerge + 4 + Math.floor(r() * 12) // 4~15 月达到高峰
    series[sk] = {
      emergeMonth: emerge,
      peakMonth: peak,
      peakVal: 50 + Math.floor(r() * 80),         // 高峰 50~130 个岗位需要
      decay: r() > 0.5,                            // 半数衰减
    }
  })

  // 按月聚合
  const data = MONTHS.map((date, mi) => {
    const point: any = { date }
    skills.forEach((sk) => {
      const cfg = series[sk]
      let v = 0
      if (mi < cfg.emergeMonth) {
        v = 0
      } else if (mi <= cfg.peakMonth) {
        const t = (mi - cfg.emergeMonth) / Math.max(1, cfg.peakMonth - cfg.emergeMonth)
        v = Math.round(cfg.peakVal * t)
      } else {
        // 高峰之后
        const decayRate = cfg.decay ? 0.6 : 0.9   // 衰减 vs 微降
        v = Math.round(cfg.peakVal * Math.pow(decayRate, mi - cfg.peakMonth))
      }
      // 加一点噪声让曲线自然
      v = Math.max(0, v + Math.round((r() - 0.5) * 6))
      point[sk] = v
    })
    return point
  })

  return { skills, data }
}

// ── Tab 2: 岗位名称演化 ──
function genTitleEvolution(jobId: number) {
  const titles = pickFromPool(TITLE_POOL, 6, jobId)
  const r = rand(seedHash(`title-evo:${jobId}`))
  // 每个变体有 first_seen / last_seen / 总出现次数
  const spans = MONTHS.map((_, mi) => mi)
  const out = titles.map((t, i) => {
    const startMonth = Math.floor(r() * 12)              // 0~11 月出现
    const lifespan = 6 + Math.floor(r() * 18)             // 持续 6~24 月
    const endMonth = Math.min(27, startMonth + lifespan)  // 不超过当前
    const peak = Math.floor(startMonth + lifespan * (0.3 + r() * 0.3))
    const peakCount = 20 + Math.floor(r() * 60)
    const events: { date: string; type: 'title_emerged' | 'title_peak' | 'title_decayed'; title: string }[] = []
    events.push({ date: MONTHS[startMonth], type: 'title_emerged', title: t })
    events.push({ date: MONTHS[peak], type: 'title_peak', title: t })
    if (endMonth < 27) {
      events.push({ date: MONTHS[endMonth], type: 'title_decayed', title: t })
    }
    return {
      title: t,
      first_seen: MONTHS[startMonth],
      last_seen: endMonth < 27 ? MONTHS[endMonth] : null,
      peak_month: MONTHS[peak],
      peak_count: peakCount,
      events,
    }
  })
  // 按 first_seen 排序
  out.sort((a, b) => a.first_seen.localeCompare(b.first_seen))
  return out
}

// ── Tab 3: 薪资(次要) ──
function genSalaryEvolution(jobId: number) {
  const h = seedHash(`salary:${jobId}`)
  const base = 15 + (h % 26)
  const amp = 3 + ((h >> 8) % 7)
  const phase = ((h >> 16) % 100) / 100 * Math.PI * 2
  const growth = 0.3 + ((h >> 24) % 10) / 10

  return MONTHS.map((date, mi) => {
    const t = mi / 12
    const trend = base + amp * growth * t
    const season = Math.sin(2 * Math.PI * t + phase) * (amp * 0.3)
    const noise = Math.sin(mi * 1.7 + phase) * (amp * 0.15)
    return { date, value: Math.round((trend + season + noise) * 10) / 10 }
  })
}

// ── 配色(技能多线图需要区分度高的调色板) ──
const LINE_COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']
const EVENT_COLOR: Record<string, string> = {
  title_emerged: '#10b981',
  title_peak: '#f59e0b',
  title_decayed: '#ef4444',
}

export default function JobEvolutionTimeline({ jobId, height = 220, onChangePointClick }: Props) {
  const [tab, setTab] = useState<Tab>('skill')

  // 按 jobId 派生三份数据(都 memo 化)
  const skillData = useMemo(() => jobId ? genSkillEvolution(jobId) : null, [jobId])
  const titleData = useMemo(() => jobId ? genTitleEvolution(jobId) : null, [jobId])
  const salaryData = useMemo(() => jobId ? genSalaryEvolution(jobId) : null, [jobId])

  if (!jobId) {
    return (
      <div className="flex items-center justify-center h-full text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
        <span>选择岗位后展示演化轨迹</span>
      </div>
    )
  }

  const tabs: { key: Tab; label: string; icon: any; primary: boolean }[] = [
    { key: 'skill',  label: '技能演化', icon: TrendingUp, primary: true },
    { key: 'title',  label: '岗位名称演化', icon: GitBranch, primary: true },
    { key: 'salary', label: '薪资', icon: Wallet, primary: false },
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Header: Tabs(收紧) */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b" style={{ borderColor: 'var(--color-outline-variant)' }}>
        {tabs.map((t) => {
          const Icon = t.icon
          const active = tab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors"
              style={{
                background: active ? 'var(--color-primary)' : 'transparent',
                color: active ? 'var(--color-on-primary)' : 'var(--color-on-surface-variant)',
              }}
              title={t.primary ? '主要维度' : '次要维度'}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{t.label}</span>
              {!t.primary && (
                <span className="text-[9px] opacity-70 ml-0.5">·次</span>
              )}
            </button>
          )
        })}
      </div>

      {/* Content */}
      <div className="flex-1 p-2 min-h-0">
        {tab === 'skill' && skillData && (
          <SkillEvolutionView skills={skillData.skills} data={skillData.data} height={height} />
        )}
        {tab === 'title' && titleData && (
          <TitleEvolutionView data={titleData} height={height} onChangePointClick={onChangePointClick} />
        )}
        {tab === 'salary' && salaryData && (
          <SalaryEvolutionView data={salaryData} height={height} />
        )}
      </div>
    </div>
  )
}

// ─── Tab 1: 技能演化(多线图) ───
function SkillEvolutionView({ skills, data, height }: { skills: string[]; data: any[]; height: number }) {
  return (
    <div className="flex flex-col h-full">
      <div className="text-[10px] mb-0.5 px-1" style={{ color: 'var(--color-on-surface-variant)' }}>
        该岗位相关 {skills.length} 项技能的被需求次数随时间变化
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
          <XAxis dataKey="date" tickFormatter={(d) => d?.slice(2, 7)} tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip
            contentStyle={{ fontSize: 12, background: 'var(--color-surface)', border: '1px solid var(--color-outline)' }}
            labelFormatter={(d) => d?.slice(0, 10)}
          />
          <Legend wrapperStyle={{ fontSize: 10 }} />
          {skills.map((sk, i) => (
            <Line
              key={sk}
              type="monotone"
              dataKey={sk}
              stroke={LINE_COLORS[i % LINE_COLORS.length]}
              strokeWidth={1.8}
              dot={{ r: 2 }}
              activeDot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── Tab 2: 岗位名称演化(横向甘特图式时间轴) ───
function TitleEvolutionView({ data, height, onChangePointClick }: {
  data: ReturnType<typeof genTitleEvolution>
  height: number
  onChangePointClick?: (date: string) => void
}) {
  // 当前时间游标(月份索引 0..MONTHS.length-1),默认最右
  const [activeMonth, setActiveMonth] = useState<number>(MONTHS.length - 1)
  // 时间轴轨道的 DOM ref(用于拖动算位置)
  const trackRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef(false)

  // 把月份索引映射到百分比位置
  const pct = (idx: number) => (idx / (MONTHS.length - 1)) * 100

  // 根据拖动事件的 clientX 算出月份索引
  const setFromClientX = (clientX: number) => {
    const el = trackRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left))
    const ratio = rect.width === 0 ? 0 : x / rect.width
    const idx = Math.round(ratio * (MONTHS.length - 1))
    setActiveMonth(idx)
  }

  // 绑定全局 pointermove/up,避免拖出轨道就丢了
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!dragRef.current) return
      setFromClientX(e.clientX)
    }
    const onUp = () => { dragRef.current = false }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [])

  const activeDate = MONTHS[activeMonth]

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 列表 + "now" 垂直游标 */}
      <div className="flex-1 min-h-0 overflow-hidden px-3 pt-1">
        <div className="flex items-center justify-between text-[10px] mb-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>
          <span>同族岗位名生命周期</span>
          <span className="font-mono font-semibold" style={{ color: 'var(--color-primary)' }}>
            📅 {activeDate?.slice(0, 7)}
          </span>
        </div>
        <div className="grid grid-cols-[80px_1fr] gap-y-0.5 text-[11px] relative pr-2">
          {/* 时间轴标头 */}
          <div />
          <div className="flex justify-between text-[9px] px-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>
            {['24', '25', '26'].map((y) => (
              <span key={y}>{y}</span>
            ))}
          </div>
          {/* 每个 title 一行 */}
          {data.map((t) => {
            const startIdx = MONTHS.indexOf(t.first_seen)
            const endIdx = t.last_seen ? MONTHS.indexOf(t.last_seen) : MONTHS.length - 1
            const leftPct = pct(startIdx)
            const widthPct = pct(endIdx) - leftPct
            const alive = activeMonth >= startIdx && activeMonth <= endIdx
            const peakedHere = MONTHS.indexOf(t.peak_month) === activeMonth
            const emergedHere = startIdx === activeMonth
            const decayedHere = t.last_seen ? endIdx === activeMonth : false
            const accent = emergedHere
              ? EVENT_COLOR.title_emerged
              : peakedHere
                ? EVENT_COLOR.title_peak
                : decayedHere
                  ? EVENT_COLOR.title_decayed
                  : null
            return (
              <Fragment key={`row-${t.title}`}>
                <div
                  className="truncate pr-1 self-center transition-colors"
                  style={{
                    color: alive ? 'var(--color-on-surface)' : 'var(--color-on-surface-variant)',
                    opacity: alive ? 1 : 0.4,
                    fontWeight: accent ? 700 : 400,
                  }}
                  title={`${t.title} · 峰值 ${t.peak_count} 个岗位`}
                >
                  {t.title}
                </div>
                <div
                  className="relative h-4 rounded"
                  style={{ background: 'var(--color-surface-container)' }}
                >
                  {/* 时间轴条 */}
                  <div
                    className="absolute h-full rounded transition-all"
                    style={{
                      left: `${leftPct}%`,
                      width: `${Math.max(widthPct, 1)}%`,
                      background: `linear-gradient(90deg, ${EVENT_COLOR.title_emerged}, ${EVENT_COLOR.title_peak}, ${EVENT_COLOR.title_decayed})`,
                      opacity: alive ? 0.85 : 0.3,
                    }}
                  />
                  {/* 起止标记 */}
                  <span
                    className="absolute -top-0.5 w-1.5 h-1.5 rounded-full"
                    style={{
                      left: `${leftPct}%`,
                      transform: 'translateX(-50%)',
                      background: EVENT_COLOR.title_emerged,
                    }}
                    title={`出现: ${t.first_seen}`}
                  />
                  {t.last_seen && (
                    <span
                      className="absolute -top-0.5 w-1.5 h-1.5 rounded-full"
                      style={{
                        left: `${leftPct + widthPct}%`,
                        transform: 'translateX(-50%)',
                        background: EVENT_COLOR.title_decayed,
                      }}
                      title={`淡出: ${t.last_seen}`}
                    />
                  )}
                  {/* 峰值标记 */}
                  <span
                    className="absolute -top-0.5 w-1.5 h-1.5 rounded-full"
                    style={{
                      left: `${pct(MONTHS.indexOf(t.peak_month))}%`,
                      transform: 'translateX(-50%)',
                      background: EVENT_COLOR.title_peak,
                      cursor: 'pointer',
                    }}
                    title={`峰值: ${t.peak_month} (${t.peak_count} 个岗位)`}
                    onClick={(e) => {
                      e.stopPropagation()
                      setActiveMonth(MONTHS.indexOf(t.peak_month))
                      onChangePointClick?.(t.peak_month)
                    }}
                  />
                  {/* 当前"now"位置标(此 title 行内的) */}
                  {alive && (
                    <div
                      className="absolute -top-1 bottom-0 w-0.5"
                      style={{
                        left: `${pct(activeMonth)}%`,
                        background: accent || 'var(--color-primary)',
                        opacity: 0.9,
                        pointerEvents: 'none',
                      }}
                    />
                  )}
                </div>
              </Fragment>
            )
          })}
        </div>
      </div>

      {/* 拖动时间轴 scrubber */}
      <div className="pt-0.5 pb-1 px-3 shrink-0">
        <div
          ref={trackRef}
          className="relative h-3.5 rounded-full cursor-pointer select-none"
          style={{
            background: 'linear-gradient(90deg, rgba(16,185,129,0.15), rgba(245,158,11,0.15), rgba(239,68,68,0.15))',
            border: '1px solid var(--color-outline-variant)',
          }}
          onPointerDown={(e) => {
            dragRef.current = true
            setFromClientX(e.clientX)
            ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
          }}
          onClick={(e) => setFromClientX(e.clientX)}
        >
          {/* 月份刻度 */}
          {MONTHS.map((m, i) => {
            if (i % 3 !== 0 && i !== MONTHS.length - 1) return null
            return (
              <div
                key={m}
                className="absolute top-0 bottom-0 w-px"
                style={{
                  left: `${pct(i)}%`,
                  background: 'rgba(148,163,184,0.4)',
                }}
              />
            )
          })}
          {/* 拖动手柄 */}
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full shadow-md cursor-grab active:cursor-grabbing transition-transform hover:scale-110"
            style={{
              left: `${pct(activeMonth)}%`,
              background: 'var(--color-primary)',
              border: '2px solid white',
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            }}
            title={`当前: ${activeDate}`}
          />
          {/* 当前月份标签 */}
          <div
            className="absolute -top-3 -translate-x-1/2 text-[9px] font-semibold px-1 rounded whitespace-nowrap"
            style={{
              left: `${pct(activeMonth)}%`,
              background: 'var(--color-primary)',
              color: 'var(--color-on-primary)',
            }}
          >
            {activeDate?.slice(0, 7)}
          </div>
        </div>
        <div className="flex items-center gap-2 text-[9px] pt-1" style={{ color: 'var(--color-on-surface-variant)' }}>
          <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full" style={{ background: EVENT_COLOR.title_emerged }} /> 出现</span>
          <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full" style={{ background: EVENT_COLOR.title_peak }} /> 峰值</span>
          <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full" style={{ background: EVENT_COLOR.title_decayed }} /> 淡出</span>
          <span className="ml-auto">{data.filter((d) => {
            const s = MONTHS.indexOf(d.first_seen)
            const e = d.last_seen ? MONTHS.indexOf(d.last_seen) : MONTHS.length - 1
            return activeMonth >= s && activeMonth <= e
          }).length} / {data.length} 在岗</span>
        </div>
      </div>
    </div>
  )
}

// ─── Tab 3: 薪资(单线,次要) ───
function SalaryEvolutionView({ data, height }: { data: any[]; height: number }) {
  return (
    <div className="flex flex-col h-full">
      <div className="text-[10px] mb-0.5 px-1" style={{ color: 'var(--color-on-surface-variant)' }}>
        平均薪资(K)随时间变化(参考维度)
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
          <XAxis dataKey="date" tickFormatter={(d) => d?.slice(2, 7)} tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} unit="K" />
          <Tooltip
            contentStyle={{ fontSize: 12, background: 'var(--color-surface)', border: '1px solid var(--color-outline)' }}
            labelFormatter={(d) => d?.slice(0, 10)}
          />
          <Line type="monotone" dataKey="value" stroke="#94a3b8" strokeWidth={1.8} dot={{ r: 2 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}