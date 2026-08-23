import { useState, useEffect } from 'react'
import { Shield, CheckCircle, AlertTriangle, TrendingUp, Loader2, Crosshair, Copy, Zap, Users, FileText } from 'lucide-react'

// 拼接管理员 token 到质检接口 URL（质检 API 已加管理员鉴权，必须携带 token）
const getToken = () => localStorage.getItem('xingtu_token') || ''
const withToken = (url: string) => `${url}${url.includes('?') ? '&' : '?'}token=${getToken()}`

export default function QualityDashboard() {
  const [report, setReport] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [testing, setTesting] = useState<Set<string>>(new Set())
  const [jdResult, setJdResult] = useState<any>(null)
  const [matchResult, setMatchResult] = useState<any>(null)
  const [resumeResult, setResumeResult] = useState<any>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [panelLoading, setPanelLoading] = useState(false)

  const loadReport = () => {
    setLoading(true)
    fetch(withToken('/api/quality/report')).then(r => r.json()).then(d => {
      if (d.success) setReport(d.data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  const refreshPanels = async () => {
    setPanelLoading(true)
    const r = await fetch(withToken('/api/quality/report'))
    const d = await r.json()
    if (d.success) setReport(d.data)
    setPanelLoading(false)
  }

  useEffect(() => { loadReport() }, [])

  const runTest = async (type: string) => {
    setTesting(prev => new Set(prev).add(type))
    let url = ''
    if (type === 'jd') url = '/api/quality/accuracy-test'
    else if (type === 'match') url = '/api/quality/match-test'
    else if (type === 'resume') url = '/api/quality/resume-test'

    const r = await fetch(withToken(url))
    const d = await r.json()
    if (d.success) {
      if (type === 'jd') setJdResult(d.data)
      else if (type === 'match') setMatchResult(d.data)
      else if (type === 'resume') setResumeResult(d.data)
      setErrors(prev => { const n = { ...prev }; delete n[type]; return n })
    } else {
      setErrors(prev => ({ ...prev, [type]: d.message || '测试运行失败' }))
    }
    setTesting(prev => { const n = new Set(prev); n.delete(type); return n })
  }

  const refreshAll = () => {
    setJdResult(null)
    setMatchResult(null)
    setResumeResult(null)
    setErrors({})
    loadReport()
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--color-primary)' }} />
    </div>
  )

  const cv = report?.cross_validation
  const pl = report?.plagiarism
  const inf = report?.inflation

  const jdPass = jdResult ? jdResult.avg_precision >= 0.9 : false
  const resumePass = resumeResult ? resumeResult.avg_precision >= 0.9 : false
  const matchPass = matchResult?.pass ?? false
  const allRun = jdResult && matchResult && resumeResult
  const allPass = jdPass && matchPass && resumePass

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6" style={{ color: 'var(--accent-green)' }} />
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--color-on-surface)' }}>幻觉防控 · 质检看板</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>
              DeepSeek 大模型 + 多源交叉验证 + 置信度评分 + 抄袭/通胀检测
            </p>
          </div>
        </div>
        <button onClick={refreshAll} className="px-4 py-2 rounded-lg text-sm font-semibold border" style={{ borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface-variant)' }}>
          刷新数据
        </button>
      </div>

      {/* ─── 三项硬指标 ─── */}
      <div>
        <h2 className="text-sm font-bold mb-3" style={{ color: 'var(--color-on-surface)' }}>赛题三项硬指标（要求均 ≥90%）</h2>
        <div className="grid grid-cols-4 gap-4">
          {/* JD解析 — 精确率（赛题要求的指标） */}
          <TestCard
            icon={Crosshair} label="JD解析精确率" testType="jd"
            result={jdResult} testing={testing} onTest={runTest}
            error={errors['jd']}
            value={jdResult ? `${(jdResult.avg_precision * 100).toFixed(1)}%` : null}
            sub={jdResult ? `${jdResult.total_samples}条JD · F1 ${(jdResult.avg_f1 * 100).toFixed(1)}% · 召回 ${(jdResult.avg_recall * 100).toFixed(0)}%` : '赛题要求精确率≥90%，基于DeepSeek+标准答案'}
            pass={jdResult ? jdResult.avg_precision >= 0.9 : false}
            passLabel={jdResult ? (jdResult.avg_precision >= 0.9 ? '已达标' : '未达标') : '点击测试'}
            slow
          />
          {/* 简历提取 — 独立测试 */}
          <TestCard
            icon={FileText} label="简历提取精确率" testType="resume"
            result={resumeResult} testing={testing} onTest={runTest}
            error={errors['resume']}
            value={resumeResult ? `${(resumeResult.avg_precision * 100).toFixed(1)}%` : null}
            sub={resumeResult ? `${resumeResult.total_samples}份简历 · F1 ${(resumeResult.avg_f1 * 100).toFixed(1)}% · 召回 ${(resumeResult.avg_recall * 100).toFixed(0)}%` : '100份标注简历 · DeepSeek提取+标准答案对比'}
            pass={resumePass}
            passLabel={resumeResult ? (resumePass ? '已达标' : '未达标') : '点击测试'}
            slow
          />
          {/* 人岗匹配 */}
          <TestCard
            icon={Users} label="人岗匹配准确率" testType="match"
            result={matchResult} testing={testing} onTest={runTest}
            error={errors['match']}
            value={matchResult ? `${matchResult.accuracy}%` : null}
            sub={matchResult ? `${matchResult.total_pairs}组配对 · ${matchResult.correct_count}组正确` : '简历技能 vs 岗位技能匹配'}
            pass={matchPass}
            passLabel={matchResult ? (matchPass ? '已达标' : '未达标') : '点击测试'}
          />
          {/* 综合 */}
          <div className="rounded-2xl border p-5 text-center" style={{
            borderColor: allRun ? (allPass ? 'var(--accent-green)' : 'var(--accent-red)') : 'var(--color-outline-variant)',
            background: allRun ? (allPass ? 'var(--accent-green-dim)' : 'var(--accent-red-dim)') : 'var(--color-surface-container-lowest)',
          }}>
            <CheckCircle className="h-5 w-5 mx-auto mb-2" style={{ color: allRun ? (allPass ? 'var(--accent-green)' : 'var(--accent-red)') : 'var(--color-on-surface-variant)' }} />
            <p className="text-sm font-semibold" style={{ color: 'var(--color-on-surface-variant)' }}>综合达标</p>
            <p className="text-2xl font-extrabold mt-1" style={{ color: allRun ? (allPass ? 'var(--accent-green)' : 'var(--accent-red)') : 'var(--color-on-surface-variant)' }}>
              {allRun ? (allPass ? '全部达标' : '部分达标') : '待测试'}
            </p>
            <p className="text-[10px] mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>
              {allRun ? `${[jdPass && 'JD', matchPass && '匹配', resumePass && '简历'].filter(Boolean).length}/3 通过` : '请依次点击上方三个测试按钮'}
            </p>
          </div>
        </div>
      </div>

      {/* ─── 多源交叉验证 + 抄袭/通胀 ─── */}
      <div className="grid grid-cols-2 gap-6">
        {/* 多源交叉验证 */}
        <div className="rounded-2xl border p-6" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold flex items-center gap-2" style={{ color: 'var(--color-on-surface)' }}>
              <Zap className="h-4 w-4" style={{ color: 'var(--accent-green)' }} /> 多源交叉验证
            </h3>
            <div className="flex items-center gap-2">
              <button onClick={refreshPanels} disabled={panelLoading} className="text-xs px-2 py-1 rounded-lg font-medium border" style={{ borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface-variant)' }}>
                {panelLoading ? <Loader2 className="h-3 w-3 animate-spin inline" /> : null} 刷新检测
              </button>
              <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-primary)' }}>
                {cv?.total_skills ?? 0} 项唯一技能
              </span>
            </div>
          </div>
          {cv && (
            <>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <MiniStat label="已验证(≥2来源)" value={cv.verified} color="var(--accent-green)" />
                <MiniStat label="高置信" value={cv.high_confidence} color="var(--color-primary)" />
                <MiniStat label="待确认" value={cv.unconfirmed} color="var(--accent-orange)" />
              </div>
              <div className="flex items-center gap-2 text-sm mb-2">
                <span style={{ color: 'var(--color-on-surface-variant)' }}>平均置信度</span>
                <span className="font-bold" style={{ color: cv.avg_confidence >= 0.7 ? 'var(--accent-green)' : 'var(--accent-orange)' }}>{cv.avg_confidence}</span>
                <div className="flex-1 h-2 rounded-full" style={{ background: 'var(--color-surface-container)' }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${cv.avg_confidence * 100}%`, background: cv.avg_confidence >= 0.7 ? 'var(--accent-green)' : 'var(--accent-orange)' }} />
                </div>
              </div>
              <details>
                <summary className="text-xs cursor-pointer" style={{ color: 'var(--color-on-surface-variant)' }}>查看已验证技能详情</summary>
                <div className="mt-2 max-h-48 overflow-y-auto space-y-1">
                  {Object.entries(cv.details).filter(([_, v]: [string, any]) => v.verified).map(([skill, info]: [string, any]) => (
                    <div key={skill} className="flex items-center justify-between text-xs p-1.5 rounded" style={{ background: 'var(--accent-green-dim)' }}>
                      <span className="flex items-center gap-1.5"><CheckCircle className="h-3 w-3" style={{ color: 'var(--accent-green)' }} />{skill}</span>
                      <span style={{ color: 'var(--color-on-surface-variant)' }}>{info.sources.join(', ')}（{info.confidence}）</span>
                    </div>
                  ))}
                </div>
              </details>
            </>
          )}
        </div>

        {/* 抄袭 + 通胀 */}
        <div className="space-y-6">
          <div className="rounded-2xl border p-6" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold flex items-center gap-2" style={{ color: 'var(--color-on-surface)' }}>
                <Copy className="h-4 w-4" style={{ color: 'var(--accent-purple)' }} /> JD抄袭检测
              </h3>
              <div className="flex items-center gap-2">
                <button onClick={refreshPanels} disabled={panelLoading} className="text-xs px-2 py-1 rounded-lg font-medium border" style={{ borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface-variant)' }}>
                {panelLoading ? <Loader2 className="h-3 w-3 animate-spin inline" /> : null} 刷新检测
              </button>
                <span className="text-xs px-2 py-1 rounded-full font-medium"
                  style={{ background: (pl?.total_pairs ?? 0) > 0 ? 'var(--accent-red-dim)' : 'var(--accent-green-dim)', color: (pl?.total_pairs ?? 0) > 0 ? 'var(--accent-red)' : 'var(--accent-green)' }}>
                  {pl?.total_pairs ?? 0} 对
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl font-extrabold" style={{ color: (pl?.total_pairs ?? 0) > 0 ? 'var(--accent-red)' : 'var(--accent-green)' }}>{pl?.total_pairs ?? 0}</span>
              <span className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>对JD被标记为疑似抄袭（相似度 &gt; 90%）</span>
            </div>
            {pl?.pairs?.slice(0, 2).map((p: any, i: number) => (
              <div key={i} className="text-xs p-2 rounded-lg mb-1" style={{ background: 'var(--accent-red-dim)' }}>
                <span style={{ color: 'var(--accent-red)' }}>{p.title_a}</span> @{p.company_a} ↔ <span style={{ color: 'var(--accent-red)' }}>{p.title_b}</span> @{p.company_b} · 相似度 {(p.similarity * 100).toFixed(1)}%
              </div>
            ))}
            {(pl?.total_pairs ?? 0) === 0 && <p className="text-xs" style={{ color: 'var(--accent-green)' }}>未检测到抄袭对</p>}
          </div>

          <div className="rounded-2xl border p-6" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold flex items-center gap-2" style={{ color: 'var(--color-on-surface)' }}>
                <TrendingUp className="h-4 w-4" style={{ color: 'var(--accent-orange)' }} /> 技能通胀检测
              </h3>
              <div className="flex items-center gap-2">
                <button onClick={refreshPanels} disabled={panelLoading} className="text-xs px-2 py-1 rounded-lg font-medium border" style={{ borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface-variant)' }}>
                {panelLoading ? <Loader2 className="h-3 w-3 animate-spin inline" /> : null} 刷新检测
              </button>
                <span className="text-xs px-2 py-1 rounded-full font-medium"
                  style={{ background: (inf?.total_flagged ?? 0) > 0 ? 'var(--accent-orange-dim)' : 'var(--accent-green-dim)', color: (inf?.total_flagged ?? 0) > 0 ? 'var(--accent-orange)' : 'var(--accent-green)' }}>
                  {inf?.total_flagged ?? 0} 个异常
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl font-extrabold" style={{ color: (inf?.total_flagged ?? 0) > 0 ? 'var(--accent-orange)' : 'var(--accent-green)' }}>{inf?.total_flagged ?? 0}</span>
              <span className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>个岗位存在技能要求虚高（超均值 2σ）</span>
            </div>
            {inf?.jobs?.slice(0, 2).map((j: any, i: number) => (
              <div key={i} className="text-xs p-2 rounded-lg mb-1" style={{ background: 'var(--accent-orange-dim)' }}>
                <span style={{ color: 'var(--accent-orange)' }}>{j.title}</span> @{j.company} · 技能数 {j.skill_count}（组均值 {j.group_mean}）· z={j.z_score}
              </div>
            ))}
            {(inf?.total_flagged ?? 0) === 0 && <p className="text-xs" style={{ color: 'var(--accent-green)' }}>未检测到通胀异常</p>}
          </div>
        </div>
      </div>
    </div>
  )
}

function TestCard({ icon: Icon, label, testType, result, testing, onTest, error, value, sub, pass, passLabel, slow }: {
  icon: any; label: string; testType: string; result: any; testing: Set<string>
  onTest: (t: string) => void; error?: string; value: string | null; sub: string; pass: boolean; passLabel: string; slow?: boolean
}) {
  const isTesting = testing.has(testType)
  return (
    <div className="rounded-2xl border p-5 text-center" style={{
      borderColor: result ? (pass ? 'var(--accent-green)' : 'var(--accent-red)') : 'var(--color-outline-variant)',
      background: 'var(--color-surface-container-lowest)',
    }}>
      <Icon className="h-5 w-5 mx-auto mb-2" style={{ color: result ? (pass ? 'var(--accent-green)' : 'var(--accent-red)') : 'var(--accent-purple)' }} />
      <p className="text-sm font-semibold" style={{ color: 'var(--color-on-surface-variant)' }}>{label}</p>
      {value ? (
        <>
          <p className="text-3xl font-extrabold mt-1" style={{ color: pass ? 'var(--accent-green)' : 'var(--accent-red)' }}>{value}</p>
          <p className="text-[10px] mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>{sub}</p>
          <p className="text-xs font-bold mt-1" style={{ color: pass ? 'var(--accent-green)' : 'var(--accent-red)' }}>{passLabel}</p>
        </>
      ) : (
        <>
          <p className="text-3xl font-extrabold mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>--</p>
          <p className="text-[10px] mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>{sub}</p>
          <button onClick={() => onTest(testType)} disabled={isTesting}
            className="mt-3 px-4 py-2 rounded-lg text-xs font-semibold disabled:opacity-60"
            style={{ background: 'var(--accent-purple)', color: 'var(--color-on-primary)' }}>
            {isTesting ? <Loader2 className="h-3.5 w-3.5 animate-spin mx-auto" /> : slow ? '运行测试（较慢）' : '运行测试'}
          </button>
          {error && <p className="text-[10px] mt-2 px-1 text-left" style={{ color: 'var(--accent-red)' }}>{error}</p>}
        </>
      )}
    </div>
  )
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="text-center p-3 rounded-xl" style={{ background: 'var(--color-surface)' }}>
      <p className="text-lg font-extrabold" style={{ color }}>{value}</p>
      <p className="text-[10px] font-medium" style={{ color: 'var(--color-on-surface-variant)' }}>{label}</p>
    </div>
  )
}
