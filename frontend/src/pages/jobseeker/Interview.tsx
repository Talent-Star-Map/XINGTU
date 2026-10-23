import { useEffect, useRef, useState } from 'react'
import { Video, Mic, MicOff, Volume2, VolumeX, ArrowRight, RotateCcw, Download, Loader2, CheckCircle2, Camera, CameraOff } from 'lucide-react'
import { JSNav } from '../../lib/NavContext'

type Turn = { question: string; answer: string }
type Report = { summary: string; notice: string; items: { index: number; quote: string; strength: string; improvement: string; outline: string }[] }
type Recognition = { lang: string; continuous: boolean; interimResults: boolean; onresult: ((event: any) => void) | null; onerror: ((event: any) => void) | null; onend: (() => void) | null; start: () => void; stop: () => void; abort: () => void }
const asset = `${import.meta.env.BASE_URL}media/interview/interviewer-720p.mp4`
const surface = { background: 'var(--color-surface)', borderColor: 'var(--color-outline-variant)' }
const primary = { background: 'var(--color-primary)', color: 'var(--color-on-primary)' }

async function request(path: string, body: unknown, signal: AbortSignal) {
  const response = await fetch(`/api/interview/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('xingtu_token') || ''}` }, body: JSON.stringify(body), signal })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(typeof result.detail === 'string' ? result.detail : '请求失败，请稍后重试')
  return result
}

export default function Interview() {
  const { params, setPage } = JSNav.use()
  const [stage, setStage] = useState<'setup' | 'session' | 'report'>('setup')
  const [role, setRole] = useState(params.interviewRole || '')
  const [background, setBackground] = useState(params.interviewContext || '')
  const [difficulty, setDifficulty] = useState('基础')
  const [question, setQuestion] = useState('')
  const [focus, setFocus] = useState('')
  const [history, setHistory] = useState<Turn[]>([])
  const [answer, setAnswer] = useState('')
  const [report, setReport] = useState<Report | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [mediaError, setMediaError] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [intro, setIntro] = useState(false)
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [camera, setCamera] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const avatar = useRef<HTMLVideoElement>(null)
  const preview = useRef<HTMLVideoElement>(null)
  const stream = useRef<MediaStream | null>(null)
  const recognition = useRef<Recognition | null>(null)
  const controller = useRef<AbortController | null>(null)
  const alive = useRef(true)
  const locked = useRef(false)
  const speechAvailable = typeof window !== 'undefined' && 'speechSynthesis' in window
  const RecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

  const stopVoice = () => {
    if (speechAvailable) window.speechSynthesis.cancel()
    avatar.current?.pause()
    if (avatar.current) avatar.current.muted = true
    setSpeaking(false); setIntro(false)
  }
  const stopListening = () => {
    recognition.current?.stop()
    setListening(false)
  }
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      controller.current?.abort()
      recognition.current?.abort()
      stream.current?.getTracks().forEach(track => track.stop())
      if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    }
  }, [])
  useEffect(() => {
    if (stage !== 'session') return
    const timer = window.setInterval(() => setElapsed(v => v + 1), 1000)
    return () => clearInterval(timer)
  }, [stage])
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => { if (stage === 'session') event.preventDefault() }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [stage])

  function speak(text: string) {
    stopListening(); stopVoice()
    if (!speechAvailable) { setError('此浏览器不支持语音朗读，可直接阅读题目。'); return }
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'zh-CN'; utterance.rate = 0.95
    const voice = window.speechSynthesis.getVoices().find(v => v.lang.startsWith('zh'))
    if (voice) utterance.voice = voice
    utterance.onstart = () => {
      if (!alive.current) return
      setSpeaking(true)
      if (avatar.current) { avatar.current.muted = true; avatar.current.loop = true; void avatar.current.play().catch(() => {}) }
    }
    utterance.onend = () => { if (alive.current) { setSpeaking(false); avatar.current?.pause() } }
    utterance.onerror = () => { if (alive.current) { setSpeaking(false); avatar.current?.pause(); setError('语音播放未完成，可以点击朗读题目重试。') } }
    window.speechSynthesis.speak(utterance)
  }
  function playIntro() {
    stopListening(); stopVoice()
    if (!avatar.current) return
    avatar.current.currentTime = 0; avatar.current.loop = false; avatar.current.muted = false
    setIntro(true); setSpeaking(true)
    void avatar.current.play().catch(() => { setSpeaking(false); setIntro(false); setError('视频播放失败，请重试或直接开始面试。') })
  }
  function startListening() {
    if (!RecognitionAPI || listening || busy) return
    stopVoice(); setError(''); setInterim('')
    const rec: Recognition = new RecognitionAPI()
    rec.lang = 'zh-CN'; rec.continuous = true; rec.interimResults = true
    rec.onresult = event => {
      let final = '', partial = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) final += event.results[i][0].transcript
        else partial += event.results[i][0].transcript
      }
      if (!alive.current) return
      if (final) setAnswer(value => value + final)
      setInterim(partial)
    }
    rec.onerror = event => { if (alive.current) { setListening(false); setInterim(''); setError(event.error === 'not-allowed' ? '麦克风未获授权，可使用文字回答。' : '语音识别中断，可重试或输入文字。') } }
    rec.onend = () => { if (alive.current) { setListening(false); setInterim('') } }
    recognition.current = rec
    try { rec.start(); setListening(true) } catch { setError('无法启动语音识别，请使用文字回答。') }
  }
  async function toggleCamera() {
    if (camera) { stream.current?.getTracks().forEach(t => t.stop()); stream.current = null; setCamera(false); return }
    try {
      const media = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      if (!alive.current) { media.getTracks().forEach(t => t.stop()); return }
      stream.current = media; setCamera(true)
      if (preview.current) { preview.current.srcObject = media; await preview.current.play() }
    } catch { if (alive.current) setError('摄像头不可用。可以关闭预览继续面试。') }
  }
  async function advance() {
    if (locked.current) return
    const starting = stage === 'setup'
    if (starting ? !role.trim() : !answer.trim() || listening || speaking) return
    locked.current = true; setBusy(true); setError(''); stopListening(); stopVoice()
    const nextHistory = starting ? [] : [...history, { question, answer: answer.trim() }]
    const ctrl = new AbortController(); controller.current = ctrl
    const timer = window.setTimeout(() => ctrl.abort(), 90000)
    try {
      const body = { role: role.trim(), background, difficulty, history: nextHistory }
      if (nextHistory.length === 5) {
        const result: Report = await request('report', body, ctrl.signal)
        setHistory(nextHistory); setReport(result); setStage('report')
        stream.current?.getTracks().forEach(t => t.stop()); stream.current = null; setCamera(false)
      } else {
        const result = await request('question', body, ctrl.signal)
        setHistory(nextHistory); setQuestion(result.question); setFocus(result.focus); setAnswer(''); setInterim(''); setStage('session')
      }
    } catch (e) { if (alive.current) setError(e instanceof Error && e.name !== 'AbortError' ? e.message : '请求超时，请重试；你的回答仍在。') }
    finally { clearTimeout(timer); locked.current = false; if (alive.current) setBusy(false) }
  }
  function reset() {
    stopVoice(); stopListening(); stream.current?.getTracks().forEach(t => t.stop()); stream.current = null
    setCamera(false); setStage('setup'); setHistory([]); setReport(null); setAnswer(''); setElapsed(0); setError('')
  }
  function download() {
    if (!report) return
    const text = [`星图模拟面试练习报告`, `岗位：${role}`, report.summary, ...report.items.map(item => `\n第 ${item.index} 题：${history[item.index - 1].question}\n回答：${history[item.index - 1].answer}\n原文引用：${item.quote}\n亮点：${item.strength}\n改进：${item.improvement}\n组织思路：${item.outline}`), report.notice].join('\n')
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }))
    const link = document.createElement('a'); link.href = url; link.download = '星图模拟面试报告.txt'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-7">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="mb-2 flex items-center gap-2 text-xs font-medium" style={{ color: 'var(--color-primary)' }}><Video className="h-4 w-4" /> 职业准备 / AI 模拟面试</p><h1 className="text-2xl font-bold">让下一次面试，更有准备</h1><p className="mt-2 text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>围绕目标岗位练习表达，从每一次回答中找到改进方向。</p></div>
      <span className="rounded-full border px-3 py-1.5 text-xs" style={surface}>五题练习 · {difficulty}{stage === 'session' ? ` · ${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}` : ''}</span>
    </header>
    {error && <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{error}</div>}
    <div className="grid items-start gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="overflow-hidden rounded-2xl border" style={surface}>
        <div className="relative bg-slate-950">
          <video ref={avatar} src={asset} preload="metadata" playsInline muted onError={() => setMediaError(true)} onEnded={() => { if (intro) { setSpeaking(false); setIntro(false); if (avatar.current) avatar.current.muted = true } }} className="mx-auto aspect-[9/16] max-h-[480px] w-full object-contain" aria-label="AI 面试官形象" />
          {mediaError && <div className="absolute inset-0 flex items-center justify-center text-sm text-white">形象视频暂不可用，仍可继续文字面试</div>}
          <span className="absolute left-3 top-3 rounded-full bg-black/60 px-3 py-1.5 text-xs text-white">{speaking ? '● 面试官正在说话' : listening ? '● 正在聆听' : 'AI 面试官 · 准备就绪'}</span>
        </div>
        <div className="space-y-3 p-4"><div className="flex items-center justify-between"><span className="text-sm font-semibold">星图面试官</span><span className="text-[10px] opacity-60">HeyGen 形象素材</span></div>
          <button onClick={speaking ? stopVoice : playIntro} disabled={busy || mediaError} className="flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs disabled:opacity-40" style={surface}>{speaking ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}{speaking ? '停止播放' : '播放开场介绍'}</button>
          <p className="text-[11px] leading-5 opacity-60">动态问题使用系统语音，人物视频作为说话动画，口型不与问题逐字同步。</p>
        </div>
      </aside>
      <main className="min-w-0 space-y-4">
        {stage === 'setup' && <section className="space-y-5 rounded-2xl border p-5 md:p-7" style={surface}>
          <div><h2 className="text-lg font-semibold">准备你的专属练习</h2><p className="mt-1 text-xs opacity-60">设置目标岗位，AI 会根据你的回答继续追问。</p></div>
          <label className="block space-y-2 text-sm font-medium"><span>目标岗位</span><input value={role} onChange={e => setRole(e.target.value)} maxLength={120} placeholder="例如：Java 后端开发工程师" className="w-full rounded-xl border bg-transparent p-3 text-sm outline-none focus:ring-2 focus:ring-blue-400" style={{ borderColor: 'var(--color-outline-variant)' }} /></label>
          <div className="flex flex-wrap gap-2">{['Java 后端开发', '前端开发工程师', '数据分析师', '产品经理'].map(name => <button key={name} onClick={() => setRole(name)} className="rounded-full border px-3 py-1.5 text-xs hover:opacity-70" style={surface}>{name}</button>)}</div>
          <label className="block space-y-2 text-sm font-medium"><span>项目经历 / 岗位要求 <span className="font-normal opacity-50">（选填）</span></span><textarea value={background} onChange={e => setBackground(e.target.value)} maxLength={6000} rows={5} placeholder="粘贴与目标岗位相关的项目经历或岗位要求，无需填写姓名、电话等个人信息。" className="w-full resize-y rounded-xl border bg-transparent p-3 text-sm outline-none focus:ring-2 focus:ring-blue-400" style={{ borderColor: 'var(--color-outline-variant)' }} /></label>
          <div className="flex items-center gap-3 text-sm"><span>练习难度</span>{['基础', '进阶'].map(level => <button key={level} aria-pressed={difficulty === level} onClick={() => setDifficulty(level)} className="rounded-lg border px-4 py-2" style={difficulty === level ? primary : surface}>{level}</button>)}</div>
          <div className="rounded-xl p-3 text-xs leading-6" style={{ background: 'var(--color-surface-container)' }}>回答文字及填写的经历将发送至系统配置的 AI 服务用于出题和反馈，本功能不持久保存。摄像头仅本地预览，不上传、不录像。语音输入依赖浏览器服务，可能由浏览器供应商处理音频；也可全程文字作答。离开页面将清除本次练习。</div>
          <button disabled={busy || !role.trim()} onClick={advance} className="flex w-full items-center justify-center gap-2 rounded-xl p-3 text-sm font-semibold disabled:opacity-50" style={primary}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}{busy ? '正在准备面试问题…' : '开始五题模拟面试'}</button>
        </section>}
        {stage === 'session' && <>
          <section className="rounded-2xl border p-5 md:p-7" style={surface}>
            <div className="mb-4 flex items-center justify-between gap-3"><span className="text-xs font-semibold" style={{ color: 'var(--color-primary)' }}>第 {history.length + 1} / 5 题 · {focus}</span><button disabled={busy || !speechAvailable} onClick={() => speaking ? stopVoice() : speak(question)} className="flex shrink-0 items-center gap-1.5 text-xs disabled:opacity-40"><Volume2 className="h-4 w-4" />{speaking ? '停止朗读' : '朗读题目'}</button></div>
            <div className="mb-5 flex gap-1.5" aria-label={`已完成 ${history.length} 题`}>{[0,1,2,3,4].map(i => <span key={i} className="h-1.5 flex-1 rounded-full" style={{ background: i <= history.length ? 'var(--color-primary)' : 'var(--color-surface-container)' }} />)}</div>
            <h2 className="text-lg font-semibold leading-8">{question}</h2>
            <label className="mt-6 block text-xs font-medium" htmlFor="interview-answer">你的回答 · 可输入文字或语音转写后修正</label>
            <textarea id="interview-answer" value={answer} onChange={e => setAnswer(e.target.value)} disabled={busy || listening} maxLength={6000} rows={7} placeholder="结合真实经历，讲清背景、你的行动和最终结果…" className="mt-2 w-full resize-y rounded-xl border bg-transparent p-3 text-sm leading-7 outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60" style={{ borderColor: 'var(--color-outline-variant)' }} />
            {interim && <p aria-live="polite" className="mt-2 text-xs opacity-60">识别中：{interim}</p>}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><button disabled={!RecognitionAPI || busy || speaking} onClick={listening ? stopListening : startListening} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs disabled:opacity-40" style={surface}>{listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}{listening ? '停止语音输入' : '语音输入'}</button><span className="text-xs opacity-50">{answer.length} / 6000 字</span></div>
            {!RecognitionAPI && <p className="mt-2 text-xs opacity-60">此浏览器不支持语音识别，请输入文字回答。</p>}
            <button disabled={busy || listening || speaking || !answer.trim() || answer.length > 6000} onClick={advance} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl p-3 text-sm font-semibold disabled:opacity-50" style={primary}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}{busy ? 'AI 正在分析，请稍候…' : history.length === 4 ? '完成面试，生成报告' : '提交回答，进入下一题'}</button>
          </section>
          <section className="rounded-xl border p-4" style={surface}><div className="flex items-center justify-between"><span className="text-xs opacity-70">我的画面 · 仅本地预览</span><button onClick={toggleCamera} className="flex items-center gap-2 text-xs">{camera ? <CameraOff className="h-4 w-4" /> : <Camera className="h-4 w-4" />}{camera ? '关闭摄像头' : '开启摄像头'}</button></div><video ref={preview} muted playsInline className={camera ? 'mt-3 aspect-video max-h-48 rounded-lg bg-black' : 'hidden'} style={{ transform: 'scaleX(-1)' }} /></section>
          {history.length > 0 && <details className="rounded-xl border p-4 text-xs" style={surface}><summary className="cursor-pointer">已完成 {history.length} 题 · 查看回答</summary>{history.map((turn, i) => <div key={i} className="mt-4 space-y-2 border-t pt-3" style={{ borderColor: 'var(--color-outline-variant)' }}><p className="font-semibold">{i + 1}. {turn.question}</p><p className="whitespace-pre-wrap leading-6 opacity-70">{turn.answer}</p></div>)}</details>}
        </>}
        {stage === 'report' && report && <section className="space-y-5 rounded-2xl border p-5 md:p-7" style={surface}>
          <div className="flex items-center gap-3"><CheckCircle2 className="h-7 w-7 text-emerald-500" /><div><h2 className="text-xl font-semibold">练习完成，看看你的成长方向</h2><p className="mt-1 text-xs opacity-60">{role} · 已完成 {history.length} 道题</p></div></div>
          <p className="text-sm leading-7">{report.summary}</p>
          {report.items.map(item => <article key={item.index} className="space-y-3 rounded-xl border p-4" style={{ borderColor: 'var(--color-outline-variant)' }}><h3 className="text-sm font-semibold">第 {item.index} 题 · {history[item.index - 1]?.question}</h3><blockquote className="border-l-2 border-blue-400 pl-3 text-xs leading-6 opacity-70">你的回答：“{item.quote}”</blockquote><p className="text-sm leading-6"><strong>回答亮点：</strong>{item.strength}</p><p className="text-sm leading-6"><strong>改进建议：</strong>{item.improvement}</p><details className="text-xs leading-6"><summary className="cursor-pointer font-medium">参考回答组织思路</summary><p className="mt-2 whitespace-pre-wrap opacity-70">{item.outline}</p></details></article>)}
          <p className="text-xs leading-6 opacity-60">{report.notice}</p>
          <div className="flex flex-wrap gap-2"><button onClick={download} className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm" style={primary}><Download className="h-4 w-4" />下载报告</button><button onClick={reset} className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm" style={surface}><RotateCcw className="h-4 w-4" />再练一次</button><button onClick={() => setPage('learning')} className="rounded-lg border px-4 py-2 text-sm" style={surface}>前往学习中心</button></div>
        </section>}
      </main>
    </div>
  </div>
}
