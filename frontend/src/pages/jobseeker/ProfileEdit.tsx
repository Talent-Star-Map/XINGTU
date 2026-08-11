import { useState, useEffect, useMemo, useRef } from 'react'
import { Save, User, MapPin, GraduationCap, Briefcase, Target, Star, Building, Loader2, CheckCircle, AlertCircle, Mail, Phone, Search, X } from 'lucide-react'
import ProfileSidebar from '../../components/ProfileSidebar'

const requiredFields = ['real_name', 'phone', 'education', 'target_position']

interface Field {
  icon: any; label: string; key: string; required: boolean
  type?: string; opts?: { v: string; l: string }[]; placeholder?: string
}

const basicFields: Field[] = [
  { icon: User, label: '姓名', key: 'real_name', required: true, placeholder: '请输入真实姓名' },
  { icon: User, label: '性别', key: 'gender', type: 'select', opts: [{ v: '女', l: '女' }, { v: '男', l: '男' }], required: false },
  { icon: User, label: '年龄', key: 'age', placeholder: '请输入年龄', required: false },
  { icon: Building, label: '学历', key: 'education', type: 'select', opts: [{ v: '本科', l: '本科' }, { v: '大专', l: '大专' }, { v: '硕士', l: '硕士' }, { v: '博士', l: '博士' }], required: true },
  { icon: GraduationCap, label: '学校', key: 'school', placeholder: '请输入毕业院校', required: false },
  { icon: MapPin, label: '所在城市', key: 'city', placeholder: '如：北京', required: false },
  { icon: Target, label: '目标城市', key: 'target_city', placeholder: '期望工作城市', required: false },
  { icon: Briefcase, label: '工作经验', key: 'experience', placeholder: '如：3年 / 应届', required: false },
  { icon: Star, label: '期望薪资', key: 'expected_salary', placeholder: '如：15K-25K', required: false },
  { icon: Target, label: '目标岗位', key: 'target_position', placeholder: '如：Java后端开发', required: true },
]

export default function ProfileEdit() {
  const [form, setForm] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [errors, setErrors] = useState<string[]>([])

  useEffect(() => {
    const token = localStorage.getItem('xingtu_token')
    if (!token) return
    fetch(`/api/auth/profile?token=${token}`).then(r => r.json()).then(d => {
      if (d.success) {
        const p = d.data; setForm({
          real_name: p.real_name || '', gender: p.gender || '女', age: p.age?.toString() || '',
          phone: p.phone || '', email: p.email || '', education: p.education || '本科',
          school: p.school || '', city: p.city || '', target_city: p.target_city || '',
          experience: p.experience || '', expected_salary: p.expected_salary || '',
          target_position: p.target_position || '', skills: p.skills || '', bio: p.bio || '',
        })
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const save = async () => {
    const missing = requiredFields.filter(k => !form[k]?.trim())
    if (missing.length > 0) {
      const labels = missing.map(k => basicFields.find(f => f.key === k)?.label || k)
      setErrors(labels)
      setTimeout(() => setErrors([]), 4000)
      return
    }
    const token = localStorage.getItem('xingtu_token')
    if (!token) return
    setSaving(true); setSaved(false); setErrors([])
    const body = { ...form, age: form.age?.toString().trim() ? parseInt(form.age) : null }
    const r = await fetch(`/api/auth/profile?token=${token}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const d = await r.json()
    if (d.success) setSaved(true)
    setSaving(false); setTimeout(() => setSaved(false), 3000)
  }

  const h = (k: string, v: string) => setForm((prev: any) => ({ ...prev, [k]: v }))
  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--color-primary)' }} /></div>

  const hasVal = (k: string) => form[k]?.toString().trim()
  const inputStyle = (k: string) => ({
    borderColor: hasVal(k) ? 'var(--color-outline-variant)' : 'var(--color-outline)',
    background: hasVal(k) ? 'var(--color-surface)' : 'var(--color-surface-container-low)',
    color: hasVal(k) ? 'var(--color-on-surface)' : 'var(--color-on-surface-variant)',
  })

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex gap-8">
        <ProfileSidebar />
        <div className="flex-1 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold" style={{ color: 'var(--color-on-surface)' }}>个人资料</h1>
              <p className="text-xs mt-1 flex items-center gap-1" style={{ color: 'var(--color-on-surface-variant)' }}>
                <span style={{ color: 'var(--accent-red)' }}>*</span> 为必填项
              </p>
            </div>
            <button onClick={save} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-opacity disabled:opacity-60" style={{ background: saved ? 'var(--accent-green)' : 'var(--color-primary)', color: 'var(--color-on-primary)' }}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <CheckCircle className="h-4 w-4" /> : <Save className="h-4 w-4" />}{saved ? '已保存' : '保存'}
            </button>
          </div>

          {errors.length > 0 && (
            <div className="flex items-start gap-3 rounded-xl border p-4" style={{ borderColor: 'var(--accent-red)', background: 'var(--accent-red-dim)' }}>
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" style={{ color: 'var(--accent-red)' }} />
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--accent-red)' }}>请填写以下必填项：</p>
                <p className="text-xs mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>{errors.join('、')}</p>
              </div>
            </div>
          )}

          {/* 联系方式区 */}
          <div className="rounded-2xl border p-6" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
            <h2 className="text-base font-bold mb-4" style={{ color: 'var(--color-on-surface)' }}>联系方式</h2>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <div>
                <label className="flex items-center gap-1 text-xs font-medium mb-1.5" style={{ color: 'var(--color-on-surface-variant)' }}>
                  <Mail className="h-3.5 w-3.5" />邮箱（登录账号）
                </label>
                <input value={form.email || ''} disabled
                  className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none opacity-60"
                  style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-low)', color: 'var(--color-on-surface-variant)' }} />
              </div>
              <div>
                <label className="flex items-center gap-1 text-xs font-medium mb-1.5" style={{ color: 'var(--color-on-surface-variant)' }}>
                  <Phone className="h-3.5 w-3.5" />手机号
                  <span style={{ color: 'var(--accent-red)' }}>*</span>
                </label>
                <input value={form.phone || ''} onChange={e => h('phone', e.target.value)} placeholder="请输入手机号"
                  className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors"
                  style={inputStyle('phone')} />
              </div>
            </div>
          </div>

          {/* 基本信息 */}
          <div className="rounded-2xl border p-6" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
            <h2 className="text-base font-bold mb-4" style={{ color: 'var(--color-on-surface)' }}>基本信息</h2>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              {basicFields.map(f => (
                <div key={f.key}>
                  <label className="flex items-center gap-1.5 text-xs font-medium mb-1.5" style={{ color: 'var(--color-on-surface-variant)' }}>
                    <f.icon className="h-3.5 w-3.5" />{f.label}
                    {f.required && <span style={{ color: 'var(--accent-red)' }}>*</span>}
                  </label>
                  {f.type === 'select' ? (
                    <select value={form[f.key] || ''} onChange={e => h(f.key, e.target.value)}
                      className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors"
                      style={inputStyle(f.key)}>
                      <option value="" disabled style={{ color: 'var(--color-on-surface-variant)' }}>请选择{f.label}</option>
                      {f.opts?.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                    </select>
                  ) : (
                    <input value={form[f.key] || ''} onChange={e => h(f.key, e.target.value)} placeholder={f.placeholder || `请输入${f.label}`}
                      className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors"
                      style={inputStyle(f.key)} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 个人简介 */}
          <div className="rounded-2xl border p-6" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
            <h2 className="text-base font-bold mb-4" style={{ color: 'var(--color-on-surface)' }}>个人简介</h2>
            <textarea value={form.bio || ''} onChange={e => h('bio', e.target.value)} rows={4}
              placeholder="简单介绍一下自己，如专业技能、项目经验、职业目标..."
              className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors resize-none"
              style={inputStyle('bio')} />
          </div>

          {/* 技能标签 */}
          <div className="rounded-2xl border p-6" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
            <h2 className="text-base font-bold mb-4" style={{ color: 'var(--color-on-surface)' }}>技能标签</h2>
            <p className="text-xs mb-3" style={{ color: 'var(--color-on-surface-variant)' }}>点击选择技能，系统会根据您的简历自动更新</p>
            <ProfileSkillSelector
              skills={form.skills ? form.skills.split(',').filter(Boolean) : []}
              onChange={(skills) => h('skills', skills.join(', '))}
            />
          </div>
        </div>
      </div>
    </div>
  )
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

function ProfileSkillSelector({ skills, onChange }: { skills: string[]; onChange: (s: string[]) => void }) {
  const [search, setSearch] = useState('')
  const [activeCat, setActiveCat] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const addSkill = (s: string) => { if (s && !skills.includes(s)) onChange([...skills, s]) }
  const removeSkill = (s: string) => { onChange(skills.filter(x => x !== s)) }
  const toggleFn = (s: string) => { skills.includes(s) ? removeSkill(s) : addSkill(s) }

  const filteredCats = useMemo(() => {
    const kw = search.toLowerCase().trim()
    return SKILL_CATEGORIES.map(cat => ({
      ...cat,
      skills: kw ? cat.skills.filter(s => s.toLowerCase().includes(kw)).sort() : [...cat.skills].sort(),
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

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--color-on-surface-variant)' }} />
        <input ref={inputRef} value={search} onChange={e => setSearch(e.target.value)} onKeyDown={handleKey}
          placeholder="搜索技能，回车添加..."
          className="w-full h-9 rounded-lg border pl-9 pr-3 text-sm outline-none"
          style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface)', color: 'var(--color-on-surface)' }} />
      </div>
      {skills.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="flex flex-wrap gap-1.5">
            {skills.map(t => (
              <span key={t} onClick={() => removeSkill(t)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer"
                style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-primary)' }}>
                {t} <X className="h-3 w-3" />
              </span>
            ))}
          </div>
          <button onClick={() => onChange([])}
            className="shrink-0 text-xs px-2 py-1 rounded-md flex items-center gap-1"
            style={{ color: 'var(--color-on-surface-variant)', background: 'var(--color-surface)' }}>
            <X className="h-3 w-3" /> 重置
          </button>
        </div>
      )}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {filteredCats.map((cat, idx) => (
          <button key={cat.name} onClick={() => setActiveCat(idx)}
            className="shrink-0 px-2.5 py-1 rounded text-xs font-medium"
            style={{ background: activeCat === idx ? 'var(--color-primary)' : 'var(--color-surface)', color: activeCat === idx ? '#fff' : 'var(--color-on-surface-variant)' }}
          >{cat.name}</button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
        {currentCat.skills.map(s => {
          const active = skills.includes(s)
          return (
            <button key={s} onClick={() => toggleFn(s)}
              className="px-2.5 py-1 rounded text-xs font-medium"
              style={{ background: active ? 'var(--color-primary)' : 'var(--color-surface)', color: active ? '#fff' : 'var(--color-on-surface-variant)', border: active ? 'none' : '1px solid var(--color-outline-variant)' }}
            >{s}</button>
          )
        })}
      </div>
    </div>
  )
}
