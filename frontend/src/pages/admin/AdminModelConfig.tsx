import { useState, useEffect } from 'react'
import { Loader2, Cpu, Save, RefreshCw, Check, X, Shield, Zap, Eye, EyeOff, Server } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

// ─── 管理员 token 注入 ───
const getToken = () => localStorage.getItem('xingtu_token') || ''
const withToken = (url: string) => `${url}${url.includes('?') ? '&' : '?'}token=${getToken()}`

// ─── 类型定义 ───
interface LlmConfigData {
  configs: Record<string, string>
  mock_mode: boolean
  global_enabled: boolean
  resolved: {
    strong: { provider: string; model: string; base_url: string }
    fast: { provider: string; model: string; base_url: string }
    vision: { provider: string; model: string; base_url: string }
  }
}

interface TestResult {
  success: boolean
  provider: string
  model: string
  mock?: boolean
  message: string
  latency_ms?: number
  usage?: Record<string, number>
}

// 各档次配置字段前缀
type TierKey = 'strong' | 'fast' | 'vision'
const TIERS: { key: TierKey; label: string; desc: string; icon: string }[] = [
  { key: 'strong', label: '大模型', desc: '复杂生成 / 推理 / 长文本（简历生成、深度优化、对话）', icon: '🧠' },
  { key: 'fast', label: '小模型', desc: '简单提取 / 分类 / 判断（关键词提取、字段解析）', icon: '⚡' },
  { key: 'vision', label: '多模态', desc: '图片理解 / 简历图片解析（预留，接多模态模型后启用）', icon: '👁️' },
]

const PROVIDER_OPTIONS = ['openai-compatible', 'deepseek', 'qwen', 'kimi', 'anthropic', 'custom']

export default function AdminModelConfig() {
  const [configs, setConfigs] = useState<Record<string, string>>({})
  const [mockMode, setMockMode] = useState(true)
  const [globalEnabled, setGlobalEnabled] = useState(true)
  const [resolved, setResolved] = useState<LlmConfigData['resolved'] | null>(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [testBusy, setTestBusy] = useState<TierKey | null>(null)
  const [testResults, setTestResults] = useState<Record<TierKey, TestResult | null>>({
    strong: null, fast: null, vision: null,
  })

  // 掩码显示/明文切换（API Key 输入框）
  const [showKeys, setShowKeys] = useState(false)

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  // ── 拉取配置 ──
  const load = async () => {
    setLoading(true)
    try {
      const r = await fetch(withToken('/api/admin/llm-config'))
      const d = await r.json()
      if (d.success) {
        setConfigs(d.data.configs || {})
        setMockMode(d.data.mock_mode)
        setGlobalEnabled(d.data.global_enabled)
        setResolved(d.data.resolved)
      } else showToast(d.error?.message || '加载失败')
    } catch { showToast('网络错误') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  // ── 通用配置项读写 ──
  const setCfg = (key: string, val: string) => setConfigs(prev => ({ ...prev, [key]: val }))
  const tierCfg = (tier: TierKey, suffix: string) => configs[`${tier}_${suffix}`] || ''

  // ── 保存 ──
  const save = async () => {
    setSaving(true)
    try {
      const payload: Record<string, string> = {
        ...configs,
        global_enabled: globalEnabled ? '1' : '0',
        mock_mode: mockMode ? '1' : '0',
      }
      const r = await fetch(withToken('/api/admin/llm-config'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configs: payload }),
      })
      const d = await r.json()
      if (d.success) { showToast(d.message || '已保存'); load() }
      else showToast(d.error?.message || '保存失败')
    } catch { showToast('网络错误') }
    finally { setSaving(false) }
  }

  // ── 测试连接 ──
  const testTier = async (tier: TierKey) => {
    setTestBusy(tier)
    try {
      const r = await fetch(withToken('/api/admin/llm-config/test'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier }),
      })
      const d = await r.json()
      const result = d.success && d.data ? d.data : { success: false, message: d.error?.message || d.message || '测试失败' }
      setTestResults(prev => ({ ...prev, [tier]: result }))
      if (result.success) showToast(`${TIERS.find(t => t.key === tier)?.label}连接成功`)
    } catch { setTestResults(prev => ({ ...prev, [tier]: { success: false, message: '网络错误' } })) }
    finally { setTestBusy(null) }
  }

  // ── 渲染一个档次的配置卡片 ──
  const renderTierCard = (tier: TierKey) => {
    const meta = TIERS.find(t => t.key === tier)!
    const result = testResults[tier]
    const resolvedInfo = resolved?.[tier]
    return (
      <div className="rounded-2xl border p-5" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">{meta.icon}</span>
            <div>
              <h3 className="text-sm font-semibold" style={{ color: 'var(--color-on-surface)' }}>{meta.label}</h3>
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>{meta.desc}</p>
            </div>
          </div>
          {resolvedInfo && (
            <span className="text-xs px-2 py-1 rounded-full"
              style={{ background: 'var(--accent-blue-dim, #dbeafe)', color: 'var(--accent-blue, #3b82f6)' }}>
              当前: {resolvedInfo.model || '未配置'}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--color-on-surface-variant)' }}>Provider</label>
            <select value={tierCfg(tier, 'provider')} onChange={e => setCfg(`${tier}_provider`, e.target.value)}
              className="w-full h-9 px-3 rounded-lg text-sm border outline-none"
              style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface)', color: 'var(--color-on-surface)' }}>
              <option value="">默认</option>
              {PROVIDER_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--color-on-surface-variant)' }}>模型名</label>
            <input value={tierCfg(tier, 'model')} onChange={e => setCfg(`${tier}_model`, e.target.value)}
              placeholder="如 deepseek-chat" className="w-full h-9 px-3 rounded-lg text-sm border outline-none"
              style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface)', color: 'var(--color-on-surface)' }} />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--color-on-surface-variant)' }}>API Base URL</label>
            <input value={tierCfg(tier, 'base_url')} onChange={e => setCfg(`${tier}_base_url`, e.target.value)}
              placeholder="如 https://api.deepseek.com/v1" className="w-full h-9 px-3 rounded-lg text-sm border outline-none"
              style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface)', color: 'var(--color-on-surface)' }} />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--color-on-surface-variant)' }}>API Key</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input type={showKeys ? 'text' : 'password'} value={tierCfg(tier, 'api_key')}
                  onChange={e => setCfg(`${tier}_api_key`, e.target.value)}
                  placeholder="sk-..." className="w-full h-9 pl-3 pr-9 rounded-lg text-sm border outline-none"
                  style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface)', color: 'var(--color-on-surface)' }} />
                <button onClick={() => setShowKeys(v => !v)} title="显示/隐藏"
                  className="absolute right-2 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-on-surface-variant)' }}>
                  {showKeys ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <button onClick={() => testTier(tier)} disabled={testBusy !== null}
                className="h-9 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 border disabled:opacity-60"
                style={{ borderColor: 'var(--color-outline-variant)', color: 'var(--accent-blue, #3b82f6)', background: 'var(--color-surface)' }}>
                {testBusy === tier ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                测试
              </button>
            </div>
          </div>
        </div>

        {/* 测试结果 */}
        {result && (
          <div className="mt-3 rounded-lg px-3 py-2.5 text-xs border"
            style={{ borderColor: result.success ? 'var(--accent-green-dim, #d1fae5)' : 'var(--accent-red-dim, #fecaca)',
                     background: result.success ? 'var(--accent-green-dim, #ecfdf5)' : 'var(--accent-red-dim, #fef2f2)',
                     color: result.success ? 'var(--accent-green, #10b981)' : 'var(--accent-red)' }}>
            <div className="flex items-center gap-1.5">
              {result.success ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
              <span className="font-medium">{result.success ? '连接成功' : '连接失败'}</span>
              {result.latency_ms !== undefined && <span className="ml-auto tabular-nums">{result.latency_ms}ms</span>}
            </div>
            <div className="mt-1 opacity-80">{result.message}</div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* ── 顶部 ── */}
      <header className="shrink-0 border-b" style={{ borderColor: 'var(--color-outline-variant)' }}>
        <div className="max-w-[1200px] mx-auto px-8 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Cpu className="h-5 w-5" style={{ color: 'var(--accent-green)' }} />
            <h1 className="text-lg font-semibold" style={{ color: 'var(--color-on-surface)' }}>模型配置</h1>
            <span className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: mockMode ? 'var(--accent-green-dim, #d1fae5)' : 'var(--accent-blue-dim, #dbeafe)',
                       color: mockMode ? 'var(--accent-green, #10b981)' : 'var(--accent-blue, #3b82f6)' }}>
              {mockMode ? '自定义模式' : '默认模式'}
            </span>
          </div>
          <button onClick={save} disabled={saving}
            className="h-9 px-4 rounded-lg text-sm font-medium flex items-center gap-1.5 disabled:opacity-60"
            style={{ background: 'var(--accent-green)', color: '#fff' }}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            保存配置
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-auto">
        <div className="max-w-[1200px] mx-auto px-8 py-6 space-y-5">
          {loading ? (
            <div className="flex items-center justify-center h-40"><Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--accent-green)' }} /></div>
          ) : (
            <>
              {/* ── 全局开关 ── */}
              <div className="rounded-2xl border p-5" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Shield className="h-5 w-5" style={{ color: 'var(--accent-blue, #3b82f6)' }} />
                    <div>
                      <h3 className="text-sm font-semibold" style={{ color: 'var(--color-on-surface)' }}>全局开关</h3>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>
                        Mock 模式下不调用任何外部 API（零费用，开发期建议开启）；关闭后使用下方配置的真实模型
                      </p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="flex items-center justify-between rounded-xl border px-4 py-3"
                    style={{ borderColor: 'var(--color-outline-variant)' }}>
                    <div>
                      <div className="text-sm font-medium flex items-center gap-1.5" style={{ color: 'var(--color-on-surface)' }}>
                        <Server className="h-4 w-4" /> 默认调用开关
                      </div>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>开启后 AI 功能按默认配置调用；关闭则禁用所有 AI 功能</div>
                    </div>
                    <button onClick={() => setGlobalEnabled(v => !v)}
                      className="relative w-11 h-6 rounded-full transition-colors"
                      style={{ background: globalEnabled ? 'var(--accent-green)' : 'var(--color-outline)', transition: 'background .2s' }}>
                      <span className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all"
                        style={{ left: globalEnabled ? 'calc(100% - 22px)' : '2px', transition: 'left .2s' }} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border px-4 py-3"
                    style={{ borderColor: 'var(--color-outline-variant)' }}>
                    <div>
                      <div className="text-sm font-medium flex items-center gap-1.5" style={{ color: 'var(--color-on-surface)' }}>
                        <Zap className="h-4 w-4" /> 自定义调用模式开关
                      </div>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>开启=使用下方自定义配置的模型，关闭=使用默认调用方式</div>
                    </div>
                    <button onClick={() => setMockMode(v => !v)}
                      className="relative w-11 h-6 rounded-full transition-colors"
                      style={{ background: mockMode ? 'var(--accent-green)' : 'var(--color-outline)', transition: 'background .2s' }}>
                      <span className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all"
                        style={{ left: mockMode ? 'calc(100% - 22px)' : '2px', transition: 'left .2s' }} />
                    </button>
                  </div>
                </div>
              </div>

              {/* ── 三档次模型配置 ── */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                {TIERS.map(t => renderTierCard(t.key))}
              </div>

              {/* ── 说明 ── */}
              <div className="rounded-2xl border px-5 py-4" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
                <h4 className="text-xs font-semibold mb-2" style={{ color: 'var(--color-on-surface)' }}>💡 配置说明</h4>
                <ul className="text-xs space-y-1.5" style={{ color: 'var(--color-on-surface-variant)' }}>
                  <li>· 留空的配置项会回退到 <code className="px-1 py-0.5 rounded" style={{ background: 'var(--color-surface-container)' }}>.env</code> 环境变量或代码默认值</li>
                  <li>· 保存后约 30 秒内全站生效（路由层有缓存），「测试」按钮可立即验证当前配置</li>
                  <li>· API Key 只显示掩码，不会回显明文；再次保存会覆盖原值</li>
                  <li>· Provider 统一走 OpenAI 兼容格式（DeepSeek / 通义千问 / Kimi / Qwen 等均支持）</li>
                </ul>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Toast ── */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg text-sm shadow-lg"
            style={{ background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface)' }}>
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
