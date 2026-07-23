import { useState, useMemo, useRef } from 'react'
import { Search, X, Sparkles, Upload, Briefcase } from 'lucide-react'

interface Props {
  tags: string[]
  onTagsChange: (skills: string[]) => void
  onConfirm: (skills: string[]) => void
  onAutoMatch: (skills: string[]) => void
  onSkip: () => void
  onGoToResume: () => void
  hasTargetJob?: boolean
  targetJobTitle?: string
}

const SKILL_CATEGORIES: { name: string; skills: string[] }[] = [
  { name: '编程语言', skills: ['Java', 'Python', 'Go', 'C++', 'Rust', 'TypeScript', 'JavaScript', 'Scala', 'Kotlin', 'Swift', 'PHP', 'Ruby', 'Shell', 'SQL', 'Git', 'Maven', 'Gradle', 'MATLAB'] },
  { name: '前端框架', skills: ['React', 'Vue', 'Angular', 'Svelte', 'Next.js', 'HTML', 'CSS', 'Node.js', 'Webpack', 'Vite', 'Tailwind CSS', 'Ant Design', 'Element Plus', 'Taro', 'uni-app', 'Electron'] },
  { name: '后端框架', skills: ['Spring Boot', 'Spring Cloud', 'Django', 'Flask', 'FastAPI', 'Express', 'MyBatis', 'Hibernate', 'Gin', 'gRPC', 'RESTful', 'Dubbo', 'Netty', 'Koa', 'NestJS', 'GraphQL'] },
  { name: '数据库',   skills: ['MySQL', 'PostgreSQL', 'Redis', 'MongoDB', 'Elasticsearch', 'SQLite', 'Oracle', 'Memcached', 'ClickHouse', 'Neo4j', 'TiDB', 'HBase', 'Cassandra', 'InfluxDB', 'DuckDB', 'MariaDB'] },
  { name: 'AI/大模型', skills: ['大模型', 'LLM', 'LangChain', 'RAG', 'Agent', 'Prompt Engineering', 'NLP', 'CV', 'PyTorch', 'TensorFlow', 'Pandas', 'NumPy', 'Transformer', 'Stable Diffusion', 'Ollama', 'vLLM', 'LoRA', 'PaddlePaddle', 'MindSpore', 'OpenCV'] },
  { name: '大数据',   skills: ['Spark', 'Flink', 'Hadoop', 'Kafka', 'Hive', 'HBase', 'DataX', 'Kettle', 'Airflow', 'ClickHouse', '数据仓库', 'ETL', 'Pulsar', 'Storm', 'Sqoop', 'Canal', 'Doris', 'StarRocks', 'Presto', 'Trino', 'Superset'] },
  { name: '云原生/DevOps', skills: ['Docker', 'Kubernetes', 'K8s', 'CI/CD', 'Jenkins', 'Terraform', 'Nginx', 'Linux', 'AWS', '阿里云', '腾讯云', '微服务', 'Serverless', 'GitLab', 'ArgoCD', 'Prometheus', 'Grafana', 'Istio', 'Consul', 'Ansible', 'Harbor', 'RabbitMQ'] },
  { name: '安全/测试', skills: ['渗透测试', 'Burp Suite', 'Metasploit', 'Selenium', 'JMeter', 'Postman', '安全架构', 'SDL', 'DevSecOps', 'OWASP', 'Nessus', 'Wireshark', 'Appium', 'LoadRunner', 'SonarQube', 'ZAP', 'SQL 注入', 'XSS'] },
  { name: '架构/分布式', skills: ['分布式', '微服务', '高并发', '架构设计', '分布式事务', '分布式缓存', '消息队列', 'RabbitMQ', 'RocketMQ', '负载均衡', '服务网格', 'DDD', 'CAP 理论', '服务治理', '链路追踪', 'SkyWalking', 'Seata', 'Nacos', 'Sentinel'] },
]

const EXPERIENCES = ['应届生', '1年以内', '1-3年', '3-5年', '5-10年', '10年以上']

export default function ManualSkillInput({ tags, onTagsChange, onConfirm, onAutoMatch, onSkip, onGoToResume, hasTargetJob = false, targetJobTitle = '' }: Props) {
  const [search, setSearch] = useState('')
  const [activeCat, setActiveCat] = useState(0)
  const [experience, setExperience] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const addSkill = (s: string) => { if (s && !tags.includes(s)) onTagsChange([...tags, s]) }
  const removeSkill = (s: string) => { onTagsChange(tags.filter(x => x !== s)) }
  const toggleFn = (s: string) => { if (tags.includes(s)) removeSkill(s); else addSkill(s) }

  const filteredCats = useMemo(() => {
    const kw = search.toLowerCase().trim()
    return SKILL_CATEGORIES.map(cat => ({
      ...cat,
      skills: kw ? [...cat.skills.filter(s => s.toLowerCase().includes(kw))].sort() : [...cat.skills].sort(),
    }))
  }, [search])

  const currentCat = filteredCats[activeCat]

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && search.trim()) {
      e.preventDefault()
      const kw = search.toLowerCase().trim()
      const first = currentCat.skills.find(s => s.toLowerCase().includes(kw))
      if (first) { addSkill(first); setSearch(''); inputRef.current?.focus() }
    }
  }

  const handleMatch = () => {
    onAutoMatch(tags)
  }

  return (
    <div className="rounded-2xl border p-5" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
      {/* 标题 */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold" style={{ color: 'var(--color-on-surface)' }}>手动输入</h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>输入技能和经历，智能推荐匹配岗位</p>
        </div>
        <button onClick={onSkip} className="p-1 rounded-md" style={{ color: 'var(--color-on-surface-variant)' }}>
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* 技能 */}
      <div className="mb-4">
        <label className="text-xs font-semibold mb-2 flex items-center gap-1" style={{ color: 'var(--color-on-surface)' }}>
          <Briefcase className="h-3 w-3" />技能
        </label>
        <div className="relative mb-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--color-on-surface-variant)' }} />
          <input ref={inputRef} value={search} onChange={e => setSearch(e.target.value)} onKeyDown={handleKey}
            placeholder="搜索技能，回车添加..."
            className="w-full h-8 rounded-lg border pl-9 pr-3 text-xs outline-none"
            style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface)', color: 'var(--color-on-surface)' }} />
        </div>
        {tags.length > 0 && (
          <div className="flex items-center justify-between mb-2">
            <div className="flex flex-wrap gap-1.5">
              {tags.map(t => (
                <span key={t} onClick={() => removeSkill(t)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium cursor-pointer"
                  style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-primary)' }}>
                  {t} <X className="h-2.5 w-2.5" />
                </span>
              ))}
            </div>
            <button onClick={() => { onTagsChange([]); setExperience(null) }}
              className="shrink-0 text-[10px] px-2 py-1 rounded-md flex items-center gap-1"
              style={{ color: 'var(--color-on-surface-variant)', background: 'var(--color-surface)' }}>
              <X className="h-3 w-3" /> 重置
            </button>
          </div>
        )}
        <div className="flex gap-1 overflow-x-auto pb-1 mb-2">
          {filteredCats.map((cat, idx) => (
            <button key={cat.name} onClick={() => setActiveCat(idx)}
              className="shrink-0 px-2.5 py-1 rounded text-[11px] font-medium"
              style={{ background: activeCat === idx ? 'var(--color-primary)' : 'var(--color-surface)', color: activeCat === idx ? '#fff' : 'var(--color-on-surface-variant)' }}
            >{cat.name}</button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
          {currentCat.skills.map(s => {
            const active = tags.includes(s)
            return (
              <button key={s} onClick={() => toggleFn(s)}
                className="px-2 py-0.5 rounded text-[11px] font-medium"
                style={{ background: active ? 'var(--color-primary)' : 'var(--color-surface)', color: active ? '#fff' : 'var(--color-on-surface-variant)', border: active ? 'none' : '1px solid var(--color-outline-variant)' }}
              >{s}</button>
            )
          })}
        </div>
      </div>

      {/* 工作经验 */}
      <div className="mb-4">
        <label className="text-xs font-semibold mb-2 flex items-center gap-1" style={{ color: 'var(--color-on-surface)' }}>
          <Briefcase className="h-3 w-3" />工作经验
        </label>
        <div className="flex flex-wrap gap-1.5">
          {EXPERIENCES.map(e => (
            <button key={e} onClick={() => setExperience(experience === e ? null : e)}
              className="px-2.5 py-1 rounded text-[11px] font-medium"
              style={{ background: experience === e ? 'var(--color-primary)' : 'var(--color-surface)', color: experience === e ? '#fff' : 'var(--color-on-surface-variant)', border: experience === e ? 'none' : '1px solid var(--color-outline-variant)' }}
            >{e}</button>
          ))}
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex items-center gap-3">
        <button onClick={handleMatch} disabled={tags.length === 0}
          className="flex-1 h-9 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: 'var(--color-primary)' }}>
          <Sparkles className="h-4 w-4" />智能匹配
        </button>
        <button onClick={onGoToResume}
          className="h-9 px-4 rounded-lg text-xs font-medium border flex items-center gap-1"
          style={{ borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface-variant)' }}>
          <Upload className="h-3.5 w-3.5" /> 上传简历
        </button>
      </div>
    </div>
  )
}
