import { useEffect, useRef, useState } from 'react'
import { Video, Mic, MicOff, Volume2, VolumeX, ArrowRight, RotateCcw, Download, Loader2, CheckCircle2, Camera, CameraOff, Send, Settings2, Sparkles, MessageCircle, Check, ChevronRight, Maximize2, Minimize2 } from 'lucide-react'
import GraphRolePicker from '../../components/interview/GraphRolePicker'
import { InterviewVoice } from '../../lib/interviewVoice'
import { JSNav } from '../../lib/NavContext'

type Turn = { question: string; answer: string; main_index?: number }
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
  const [background] = useState(params.interviewContext || '')
  const [difficulty] = useState('基础')
  const [contextId, setContextId] = useState('')
  const [prepared, setPrepared] = useState<any>(null)
  const [profileInfo, setProfileInfo] = useState<any>(null)
  const [profileError, setProfileError] = useState('')
  const [profileLoading, setProfileLoading] = useState(true)
  const [profileRevision, setProfileRevision] = useState(0)
  const [mainIndex, setMainIndex] = useState(1)
  const [targetCount, setTargetCount] = useState(7)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [autoMic, setAutoMic] = useState(true)
  const [audioPending, setAudioPending] = useState(false)
  const [notice, setNotice] = useState('')
  const bottom = useRef<HTMLDivElement>(null)
  const scrollArea = useRef<HTMLDivElement>(null)
  const shouldFollow = useRef(true)
  const answerRef = useRef('')
  const silenceTimer = useRef<number | undefined>(undefined)
  const submitOnEnd = useRef(false)
  const actions = useRef<{ advance: () => void; listen: () => void }>({ advance: () => {}, listen: () => {} })
  const autoAllowed = useRef(true)
  const preparingMedia = useRef(false)
  const speechGeneration = useRef(0)
  const live = useRef({ busy: false, playing: false, question: '', stage: 'setup' })
  const capturing = useRef(false)
  const restartTimer = useRef<number | undefined>(undefined)
  const interrupted = useRef(false)
  const micActions = useRef({ stopAudio: () => {}, abortReply: () => {} })
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
  const [voiceEngine, setVoiceEngine] = useState('browser')
  const [systemVoices, setSystemVoices] = useState<SpeechSynthesisVoice[]>([])
  const [selectedVoiceURI, setSelectedVoiceURI] = useState('')
  const [voiceConfigured, setVoiceConfigured] = useState<boolean | null>(null)
  const [firstAudio, setFirstAudio] = useState<number | null>(null)
  const [firstToken, setFirstToken] = useState<number | null>(null)
  const voice = useRef<InterviewVoice | null>(null)
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [camera, setCamera] = useState(false)
  const [largePreview, setLargePreview] = useState(true)
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

  useEffect(() => {
    if (!speechAvailable) return
    const refresh = () => {
      const voices = window.speechSynthesis.getVoices().filter(v => /^(zh|cmn)/i.test(v.lang))
      setSystemVoices(voices)
      const preferred = voices.find(v => /xiaoxiao|xiaoyi|huihui|yaoyao|ting.?ting|meijia|sinji|晓晓|晓伊|慧慧|瑶瑶|婷婷|美嘉/i.test(v.name))
      setSelectedVoiceURI(current => current || preferred?.voiceURI || '')
    }
    refresh()
    window.speechSynthesis.addEventListener('voiceschanged', refresh)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', refresh)
  }, [speechAvailable])

  const stopVoice = () => {
    speechGeneration.current++
    if (speechAvailable) window.speechSynthesis.cancel()
    voice.current?.stop()
    if (avatar.current) { avatar.current.muted = true; if (stage !== 'session') avatar.current.pause() }
    setSpeaking(false); setIntro(false); setAudioPending(false)
  }
  const stopListening = () => {
    clearTimeout(silenceTimer.current)
    submitOnEnd.current = false
    capturing.current = false
    recognition.current?.abort()
    setListening(false)
  }
  useEffect(() => {
    alive.current = true
    voice.current = new InterviewVoice(v => { if (alive.current) setSpeaking(v) }, message => { if (alive.current) { setError(message); setAudioPending(false) } }, ms => { if (alive.current) setFirstAudio(ms) })
    const statusController = new AbortController()

    void fetch('/api/interview/voice/status', { signal: statusController.signal, headers: { Authorization: `Bearer ${localStorage.getItem('xingtu_token') || ''}` } }).then(r => { if (!r.ok) throw new Error(); return r.json() }).then(r => setVoiceConfigured(r.configured)).catch(() => {})
    return () => {
      alive.current = false
      clearTimeout(silenceTimer.current)
      clearTimeout(restartTimer.current)
      statusController.abort()
      voice.current?.dispose()
      controller.current?.abort()
      recognition.current?.abort()
      stream.current?.getTracks().forEach(track => track.stop())
      if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    }
  }, [])
  useEffect(() => {
    const abort = new AbortController()
    setProfileLoading(true); setProfileError('')
    fetch('/api/interview/bootstrap', { signal: abort.signal, headers: { Authorization: `Bearer ${localStorage.getItem('xingtu_token') || ''}` } })
      .then(async response => { const info = await response.json(); if (!response.ok) throw new Error(typeof info.detail === 'string' ? info.detail : `资料读取失败（${response.status}）`); return info })
      .then(info => { if (abort.signal.aborted) return; setProfileInfo(info); if (!params.interviewRole) setRole(current => current || info.target_role || '') })
      .catch(reason => { if (!abort.signal.aborted) setProfileError(reason.message || '个人资料读取失败，请重试') })
      .finally(() => { if (!abort.signal.aborted) setProfileLoading(false) })
    return () => abort.abort()
  }, [profileRevision, params.interviewRole])

  useEffect(() => {
    if (avatar.current) {
      avatar.current.muted = true; avatar.current.loop = stage === 'session'
      if (stage === 'session') void avatar.current.play().catch(() => {})
      else avatar.current.pause()
    }
    if (stage !== 'session') return
    const timer = window.setInterval(() => setElapsed(v => v + 1), 1000)
    return () => clearInterval(timer)
  }, [stage])
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => { if (stage === 'session') event.preventDefault() }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [stage])

  useEffect(() => { answerRef.current = answer }, [answer])
  useEffect(() => {
    if (shouldFollow.current) bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [history, question, interim, busy])
  useEffect(() => {
    if (stage !== 'session' || !autoMic || error || !RecognitionAPI) return
    const timer = window.setTimeout(() => actions.current.listen(), 150)
    return () => clearTimeout(timer)
  }, [stage, autoMic, error])
  useEffect(() => {
    if (stage !== 'session' || busy || !autoMic || !answerRef.current.trim()) return
    const timer = window.setTimeout(() => { if (alive.current && autoAllowed.current) actions.current.advance() }, 2800)
    return () => clearTimeout(timer)
  }, [stage, busy, autoMic])

  function speak(text: string) {
    stopVoice()
    if (voiceEngine === 'gpt-sovits') {
      voice.current?.begin()
      setAudioPending(true)
      const chunks = text.match(/[^。！？!?；;\n]{1,100}[。！？!?；;\n]?/g) || [text]
      chunks.forEach(chunk => voice.current?.enqueue(chunk))
      void voice.current?.finish().then(active => { if (active && alive.current) setAudioPending(false) })
      return
    }
    if (!speechAvailable) { setError('此浏览器不支持语音朗读，可直接阅读题目。'); return }
    const currentSpeech = speechGeneration.current
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'zh-CN'; utterance.rate = 0.95
    const selectedVoice = window.speechSynthesis.getVoices().find(v => v.voiceURI === selectedVoiceURI)
    if (!selectedVoice) { setError('尚未找到可用中文女声，请在声音列表选择并试听，或使用已配置的 GPT-SoVITS 女声。'); return }
    utterance.voice = selectedVoice
    setAudioPending(true)
    utterance.onstart = () => {
      if (!alive.current || currentSpeech !== speechGeneration.current) return
      setSpeaking(true)
      if (avatar.current) { avatar.current.muted = true; avatar.current.loop = true; void avatar.current.play().catch(() => {}) }
    }
    utterance.onend = () => { if (alive.current && currentSpeech === speechGeneration.current) { setSpeaking(false); setAudioPending(false) } }
    utterance.onerror = () => { if (alive.current && currentSpeech === speechGeneration.current) { setSpeaking(false); setAudioPending(false); setError('语音播放未完成，可以点击朗读题目重试。') } }
    window.speechSynthesis.speak(utterance)
  }
  function playIntro() {
    stopVoice()
    if (!avatar.current || stage === 'session') return
    avatar.current.currentTime = 0; avatar.current.loop = false; avatar.current.muted = false
    setIntro(true); setSpeaking(true)
    void avatar.current.play().catch(() => { setSpeaking(false); setIntro(false); setError('视频播放失败，请重试或直接开始面试。') })
  }
  function startListening() {
    if (!RecognitionAPI || capturing.current || !autoAllowed.current || live.current.stage !== 'session') return
    setInterim('')
    const rec: Recognition = new RecognitionAPI()
    rec.lang = 'zh-CN'; rec.continuous = true; rec.interimResults = true
    rec.onresult = event => {
      let final = '', partial = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) final += event.results[i][0].transcript
        else partial += event.results[i][0].transcript
      }
      if (!alive.current || !autoAllowed.current) return
      const heard = (final || partial).trim()
      // Suppress exact playback echoes; headphones remain recommended for reliable interruption.
      if (live.current.playing && heard.length > 3 && live.current.question.includes(heard)) return
      if (heard && (live.current.playing || live.current.busy)) {
        interrupted.current = true
        micActions.current.stopAudio()
        micActions.current.abortReply()
      }
      if (final) {
        answerRef.current = (answerRef.current + final).slice(0, 6000)
        setAnswer(answerRef.current)
      }
      clearTimeout(silenceTimer.current)
      if (final || partial) silenceTimer.current = window.setTimeout(() => {
        if (!autoAllowed.current || !answerRef.current.trim()) return
        if (!live.current.busy) actions.current.advance()
      }, 2600)
      setInterim(partial)
    }
    rec.onerror = event => { if (alive.current) { submitOnEnd.current = false; clearTimeout(silenceTimer.current); autoAllowed.current = false; setAutoMic(false); setListening(false); setInterim(''); setError(event.error === 'not-allowed' ? '麦克风未获授权，请允许麦克风后恢复。' : '语音识别中断，请恢复麦克风重试。') } }
    rec.onend = () => {
      capturing.current = false
      if (!alive.current) return
      setListening(false); setInterim('')
      if (autoAllowed.current && live.current.stage === 'session') {
        clearTimeout(restartTimer.current)
        restartTimer.current = window.setTimeout(() => { if (alive.current) actions.current.listen() }, 200)
      }
    }
    recognition.current = rec
    try { rec.start(); capturing.current = true; setListening(true) } catch { setError('无法启动语音识别，请检查麦克风权限后重试。') }
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
    interrupted.current = false
    if (starting ? !role.trim() : !answerRef.current.trim()) return
    if (!starting && history.length >= 29) { setError('已达本次交流上限，请结束并生成报告。'); return }
    locked.current = true; setBusy(true); setError(''); stopVoice()
    voice.current?.unlock()
    const submittedAnswer = answerRef.current.trim()
    const nextHistory = starting ? [] : [...history, { question, answer: submittedAnswer, main_index: mainIndex }]
    answerRef.current = ''; setAnswer('')
    const ctrl = new AbortController(); controller.current = ctrl
    const timer = window.setTimeout(() => ctrl.abort(), 90000)
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
    const previousQuestion = question
    const previousMainIndex = mainIndex
    let committed = false
    const previousStage = stage
    shouldFollow.current = true
    setStage('session'); setQuestion(''); setFocus('自由交流'); setFirstAudio(null); setFirstToken(null)
    if (avatar.current) { avatar.current.muted = true; avatar.current.loop = true; void avatar.current.play().catch(() => {}) }
    if (voiceEngine === 'gpt-sovits') { voice.current?.begin(); setAudioPending(true) }
    let activeContext = contextId
    let full = '', completed = false, interviewDone = false
    try {
      if (starting) {
        const ready = await request('prepare', { role: role.trim(), target_questions: targetCount }, ctrl.signal)
        setPrepared(ready); activeContext = ready.context_id; setContextId(activeContext)
      }
      const response = await fetch('/api/interview/conversation' , { method: 'POST', signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('xingtu_token') || ''}` },
        body: JSON.stringify({ role: role.trim(), background, difficulty, history: nextHistory, context_id: activeContext }) })
      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => ({}))
        throw new Error(typeof data.detail === 'string' ? data.detail : '面试服务不可用，请重试。')
      }
      reader = response.body.getReader()
      const decoder = new TextDecoder(); let pending = ''
      const handle = (line: string) => {
        if (!line.trim()) return
        const event = JSON.parse(line)
        if (event.type === 'context') { setMainIndex(event.main_index); setTargetCount(event.target_questions); setFocus(event.focus); interviewDone = event.complete }
        if (event.type === 'error') throw new Error(event.message)
        if (event.type === 'delta') { full += event.text; setQuestion(full) }
        if (event.type === 'sentence' && voiceEngine === 'gpt-sovits') voice.current?.enqueue(event.text)
        if (event.type === 'latency') setFirstToken(event.first_token_ms)
        if (event.type === 'done') completed = true
      }
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        pending += decoder.decode(value, { stream: true })
        let end: number
        while ((end = pending.indexOf('\n')) >= 0) { handle(pending.slice(0, end)); pending = pending.slice(end + 1) }
      }
      pending += decoder.decode(); if (pending.trim()) handle(pending)
      if (!completed || !full.trim()) throw new Error('回复未完整生成，请重试。')
      committed = true
      setHistory(nextHistory); setAnswer(''); answerRef.current = ''; interrupted.current = false; setInterim('')
      if (voiceEngine === 'gpt-sovits') void voice.current?.finish().then(active => { if (active && alive.current) setAudioPending(false) })
      else speak(full)
      if (interviewDone) {
        autoAllowed.current = false; setAutoMic(false)
        const result = await request('report', { role: role.trim(), difficulty, history: nextHistory }, ctrl.signal)
        setReport(result); setStage('report'); stopListening(); stopVoice()
        stream.current?.getTracks().forEach(t => t.stop()); stream.current = null; setCamera(false)
      }
    } catch (e) {
      stopVoice()
      if (alive.current) { if (!committed) { answerRef.current = [submittedAnswer, answerRef.current].filter(Boolean).join(' '); setAnswer(answerRef.current); setStage(previousStage); setQuestion(previousQuestion); setMainIndex(previousMainIndex); if (previousStage === 'setup') { stream.current?.getTracks().forEach(t => t.stop()); stream.current = null; setCamera(false) } } setError(e instanceof Error && e.name !== 'AbortError' ? e.message : (interrupted.current ? '' : '请求超时，请重试；你的回答仍在。')) }
    } finally {
      void reader?.cancel().catch(() => {}); clearTimeout(timer); locked.current = false
      if (alive.current) setBusy(false)
    }
  }
  async function finishInterview() {
    if (locked.current) return
    const turns = answerRef.current.trim() ? [...history, { question, answer: answerRef.current.trim(), main_index: mainIndex }] : history
    if (!turns.length) { setError('请先完成至少一轮回答。'); return }
    locked.current = true; autoAllowed.current = false; setAutoMic(false); setBusy(true); stopListening(); stopVoice(); setError('')
    const ctrl = new AbortController(); controller.current = ctrl
    const timer = window.setTimeout(() => ctrl.abort(), 90000)
    try {
      const result: Report = await request('report', { role: role.trim(), background, difficulty, history: turns }, ctrl.signal)
      setHistory(turns); setReport(result); setStage('report')
      stream.current?.getTracks().forEach(t => t.stop()); stream.current = null; setCamera(false)
    } catch (e) { if (alive.current) setError(e instanceof Error && e.name !== 'AbortError' ? e.message : '报告生成超时，请重试。') }
    finally { clearTimeout(timer); locked.current = false; if (alive.current) setBusy(false) }
  }

  function reset() {
    stopVoice(); stopListening(); stream.current?.getTracks().forEach(t => t.stop()); stream.current = null
    autoAllowed.current = true; setAutoMic(true); setPrepared(null); setContextId(''); setMainIndex(1); answerRef.current = '';
    setCamera(false); setStage('setup'); setHistory([]); setReport(null); setAnswer(''); setElapsed(0); setError('')
  }
  function download() {
    if (!report) return
    const text = [`星图模拟面试练习报告`, `岗位：${role}`, report.summary, ...report.items.map(item => `\n第 ${item.index} 题：${history[item.index - 1].question}\n回答：${history[item.index - 1].answer}\n原文引用：${item.quote}\n亮点：${item.strength}\n改进：${item.improvement}\n组织思路：${item.outline}`), report.notice].join('\n')
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }))
    const link = document.createElement('a'); link.href = url; link.download = '星图模拟面试报告.txt'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  live.current = { busy, playing: speaking || audioPending, question, stage }
  micActions.current = { stopAudio: stopVoice, abortReply: () => controller.current?.abort() }
  actions.current = { advance: () => { void advance() }, listen: startListening }
  async function startRoom() {
    if (busy || preparingMedia.current || !role.trim()) return
    preparingMedia.current = true; setBusy(true)
    autoAllowed.current = true; setAutoMic(true); setNotice('')
    // User gesture unlocks sound; camera prompt happens on this same explicit start action.
    if (voiceEngine === 'gpt-sovits') voice.current?.unlock()
    if (!stream.current) {
      try {
        const media = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        if (!alive.current) { media.getTracks().forEach(t => t.stop()); preparingMedia.current = false; return }
        stream.current = media; setCamera(true)
        if (preview.current) { preview.current.srcObject = media; void preview.current.play().catch(() => {}) }
      } catch { setNotice('摄像头未开启，可继续语音面试。') }
    }
    preparingMedia.current = false
    if (alive.current) void advance()
  }
  function toggleAuto() {
    if (autoMic) { autoAllowed.current = false; setAutoMic(false); stopListening() }
    else { autoAllowed.current = true; setAutoMic(true); setError('') }
  }
  const status = busy ? '面试官正在思考' : audioPending || speaking ? '面试官正在说话' : listening ? '正在聆听你的回答' : stage === 'report' ? '本次面试已完成' : '准备就绪'

  return <div className="mx-auto flex h-full min-h-[680px] max-w-[1400px] flex-col gap-4 p-4 md:p-6">
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-3">
      <div><p className="mb-1 text-[11px] font-semibold tracking-widest" style={{ color: 'var(--color-primary)' }}>INTERVIEW STUDIO / 星图模拟面试</p><h1 className="text-xl font-bold md:text-2xl">把下一场面试，提前练好</h1></div>
      <div className="flex items-center gap-2"><span className="rounded-full border px-3 py-2 text-xs" style={surface}>{stage === 'setup' ? '约 15–25 分钟 · 默认 7 道主问题' : `${mainIndex} / ${targetCount} 道主问题 · ${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`}</span><button aria-label="声音设置" onClick={() => setSettingsOpen(v => !v)} className="rounded-full border p-2" style={surface}><Settings2 className="h-4 w-4" /></button></div>
    </header>
    {settingsOpen && <section className="flex shrink-0 flex-wrap items-center gap-3 rounded-xl border p-3 text-xs" style={surface}>
      <label>声音引擎 <select disabled={busy} value={voiceEngine} onChange={e => { stopVoice(); setVoiceEngine(e.target.value) }} className="rounded border bg-transparent p-2"><option value="browser">系统中文女声</option><option value="gpt-sovits">GPT-SoVITS</option></select></label>
      {voiceEngine === 'browser' && <><select aria-label="中文声音" value={selectedVoiceURI} onChange={e => { stopVoice(); setSelectedVoiceURI(e.target.value) }} className="max-w-xs rounded border bg-transparent p-2"><option value="">请选择女声</option>{systemVoices.map(v => <option key={v.voiceURI} value={v.voiceURI}>{v.name}</option>)}</select><button onClick={() => speak('你好，我们开始今天的模拟面试。')}>试听</button></>}
      {voiceEngine === 'gpt-sovits' && <span>{voiceConfigured ? '语音服务已配置' : '语音服务尚未配置，可使用系统女声'}</span>}
      {firstToken !== null && <span>首字 {firstToken}ms</span>}{firstAudio !== null && <span>首段声音 {firstAudio}ms</span>}
    </section>}
    {(error || notice) && <div role={error ? 'alert' : 'status'} className="flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs leading-5 text-amber-900"><span>{error || notice}</span><div className="flex gap-3">{error && stage === 'session' && <button disabled={busy} onClick={() => { setError(''); if (answerRef.current.trim()) void advance(); else speak(question) }} className="font-semibold underline">重试</button>}<button onClick={() => { setError(''); setNotice('') }}>关闭</button></div></div>}
    <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)]">
      <aside className="flex min-h-0 flex-col overflow-hidden rounded-2xl border" style={surface}>
        <div className="relative min-h-[260px] flex-1 overflow-hidden bg-[#080c1b]">
          <video ref={avatar} src={asset} preload="auto" playsInline muted onError={() => setMediaError(true)} onEnded={() => { if (intro) { setSpeaking(false); setIntro(false) } }} className="absolute inset-0 h-full w-full object-contain" aria-label="面试官" />
          <span className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 text-[11px] text-white"><span className={`h-1.5 w-1.5 rounded-full ${speaking || listening ? 'animate-pulse bg-emerald-400' : 'bg-slate-400'}`} />{status}</span>
          {mediaError && <span className="absolute inset-0 flex items-center justify-center text-sm text-white">形象加载失败，不影响面试对话</span>}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-4 pb-4 pt-12 text-white"><h2 className="font-semibold">星图面试官</h2><p className="mt-1 text-[10px] text-white/60">岗位技能 × 个人经历 × 面试练习题</p></div>
        </div>
        <div className="shrink-0 space-y-3 p-4"><div className="flex items-center gap-2 text-xs"><span className="h-2 w-2 rounded-full bg-emerald-500" />{stage === 'setup' ? '选择岗位，即可开始' : status}</div><p className="text-[11px] leading-5 opacity-60">形象视频循环播放，声音独立合成；口型不逐字同步。</p>{stage === 'session' && <div className="flex gap-2"><button onClick={() => { stopVoice(); controller.current?.abort() }} className="flex flex-1 items-center justify-center gap-2 rounded-lg border p-2 text-xs" style={surface}><VolumeX className="h-3.5 w-3.5" />打断</button><button disabled={busy || (!history.length && !answer.trim())} onClick={finishInterview} className="flex-1 rounded-lg border p-2 text-xs disabled:opacity-40" style={surface}>结束面试</button></div>}</div>
      </aside>
      <main className="flex min-h-[540px] min-w-0 flex-col overflow-hidden rounded-2xl border" style={surface}>
        <div className="flex shrink-0 items-center justify-between gap-3 border-b px-5 py-3" style={{ borderColor: 'var(--color-outline-variant)' }}><div className="flex items-center gap-2 text-sm font-semibold"><MessageCircle className="h-4 w-4" style={{ color: 'var(--color-primary)' }} />{stage === 'setup' ? '今天，想挑战哪个岗位？' : `${role} · 面试现场`}</div><span className="text-[10px] opacity-50">{stage === 'setup' ? '资料自动准备，无需重复填写' : '语音面试 · 实时字幕'}</span></div>
        <div className={`${stage === 'setup' ? 'hidden' : ''} relative shrink-0 overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950`}>
          <div className={largePreview ? 'flex h-[340px] items-center justify-center md:h-[min(48vh,460px)]' : 'flex h-[240px] items-center justify-center md:h-[min(36vh,340px)]'}>
            <video ref={preview} muted playsInline className="h-full w-full object-contain" style={{ transform: 'scaleX(-1)' }} />
          </div>
          {!camera && <div className="absolute inset-0 flex items-center justify-center gap-2 text-xs text-slate-400"><CameraOff className="h-4 w-4" />{stage === 'report' ? '摄像头已关闭' : '摄像头未开启，可继续面试'}</div>}
          <span className="absolute bottom-3 left-3 rounded-full bg-black/50 px-3 py-1.5 text-[11px] text-white/80">我的画面 · 仅本地预览</span>
          <button onClick={() => setLargePreview(v => !v)} aria-label={largePreview ? '缩小我的画面' : '放大我的画面'} aria-pressed={largePreview} className="absolute right-14 top-3 flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-2 text-xs text-white">{largePreview ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}{largePreview ? '缩小' : '放大'}</button><button onClick={toggleCamera} className="absolute right-3 top-3 rounded-full bg-black/50 p-2 text-white" aria-label={camera ? '关闭摄像头' : '开启摄像头'}>{camera ? <Camera className="h-4 w-4" /> : <CameraOff className="h-4 w-4" />}</button>
        </div>
        <div ref={scrollArea} onScroll={() => { const el = scrollArea.current; if (el) shouldFollow.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100 }} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 md:p-5">
          {stage === 'setup' ? <div className="space-y-5">
            <div className="rounded-2xl p-4" style={{ background: 'var(--color-primary-fixed)' }}><div className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--color-primary)' }}><Sparkles className="h-4 w-4" />你只需要选岗位，剩下的交给我</div><p className="mt-2 text-xs leading-6 opacity-70">我会结合你的个人资料、最近简历和岗位技能准备问题。开始后自动开启摄像头预览，听完问题即可回答，我会持续聆听，回答停顿后自动接话，你也可以直接开口提问。</p></div>
            <GraphRolePicker value={role} onChange={setRole} />
            {profileError && <div role="alert" className="flex items-center justify-between gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-900"><span>{profileError}</span><button onClick={() => setProfileRevision(v => v+1)} className="shrink-0 font-semibold underline">重新读取资料</button></div>}
            <label className="flex items-center gap-3 rounded-xl border px-4 py-3" style={surface}><span className="shrink-0 text-xs opacity-60">目标岗位</span><input aria-label="目标岗位" value={role} onChange={e => setRole(e.target.value)} maxLength={120} placeholder="也可以输入其他岗位" className="min-w-0 flex-1 bg-transparent text-sm outline-none" /><Check className="h-4 w-4" style={{ color: 'var(--color-primary)' }} /></label>
            <div className="divide-y rounded-xl border px-4 text-xs" style={surface}>{[['个人资料', profileLoading ? '正在读取…' : profileError ? '读取失败，请重试' : profileInfo?.profile_available ? '已读取，开始时自动关联' : '尚未完善，可直接练习'], ['最近简历', profileLoading ? '正在读取…' : profileError ? '读取失败，暂无法确认简历' : profileInfo?.resume_title || '暂无简历，按岗位通用要求练习'], ['岗位技能', '开始时检索岗位技能要求'], ['面试题库', '按岗位和技能检索匹配题目']].map(([label,value]) => <div key={label} className="flex items-center justify-between gap-3 py-3"><span className="shrink-0 opacity-50">{label}</span><span className="truncate">{value}</span></div>)}</div>
            <div className="flex items-center justify-between text-xs"><span className="opacity-60">本次主问题数量</span><div className="flex gap-1">{[6,7,8].map(n => <button key={n} aria-pressed={targetCount === n} onClick={() => setTargetCount(n)} className="rounded-lg border px-3 py-1.5" style={targetCount === n ? primary : surface}>{n} 道</button>)}</div></div>
            <p className="text-[11px] leading-5 opacity-50">点击开始会申请设备权限；摄像头不上传、不录像。相关资料和回答文字用于 AI 出题与反馈，语音识别可能由浏览器服务处理。面试全程使用语音，请先允许麦克风权限；建议佩戴耳机避免扬声器回声。</p>
          </div> : <div className="space-y-5">
            {prepared && <div className="text-center text-[10px] leading-5 opacity-50">已准备 {targetCount} 道主问题 · {prepared.resume_title ? '已关联最近简历' : '通用岗位练习'} · {prepared.job_evidence_count} 条岗位证据 · {prepared.question_bank_count} 道匹配题</div>}
            {stage === 'session' && <section aria-label="面试官字幕" className="space-y-4 py-3">
              <div className="flex items-center gap-2 text-xs font-medium" style={{ color: 'var(--color-primary)' }}><Volume2 className="h-4 w-4" />面试官字幕 · 第 {mainIndex} / {targetCount} 题</div>
              <p aria-live="polite" className="whitespace-pre-wrap text-lg font-medium leading-9 md:text-xl md:leading-10">{question || '面试官正在准备问题…'}</p>
              <p className="text-xs opacity-50">{listening ? '麦克风已开启，直接说话即可。' : autoMic ? '正在连接麦克风…' : '麦克风已暂停。'}</p>
            </section>}
            {stage === 'report' && report && <section className="space-y-4 border-t pt-5" style={{ borderColor: 'var(--color-outline-variant)' }}><div className="flex items-center gap-2 text-base font-semibold"><CheckCircle2 className="h-5 w-5 text-emerald-500" />面试完成，看看你的练习反馈</div><p className="text-sm leading-7">{report.summary}</p>{report.items.map(item => <article key={item.index} className="space-y-2 rounded-xl border p-4 text-xs leading-6" style={surface}><h3 className="font-semibold">第 {item.index} 轮反馈</h3><blockquote className="border-l-2 border-blue-400 pl-3 opacity-60">“{item.quote}”</blockquote><p><strong>亮点：</strong>{item.strength}</p><p><strong>建议：</strong>{item.improvement}</p><details><summary className="cursor-pointer">参考回答思路</summary>{item.outline}</details></article>)}<p className="text-[10px] opacity-50">{report.notice}</p></section>}
          </div>}
          <div ref={bottom} />
        </div>
        <footer className="shrink-0 border-t p-4" style={{ borderColor: 'var(--color-outline-variant)' }}>
          {stage === 'setup' ? <button onClick={startRoom} disabled={busy || !role.trim() || !RecognitionAPI} className="flex w-full items-center justify-center gap-2 rounded-xl p-3 text-sm font-semibold disabled:opacity-40" style={primary}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}开始面试 · 自动准备资料</button> : stage === 'report' ? <div className="flex flex-wrap gap-2"><button onClick={download} className="flex items-center gap-2 rounded-lg px-4 py-2 text-xs" style={primary}><Download className="h-4 w-4" />下载报告</button><button onClick={reset} className="rounded-lg border px-4 py-2 text-xs" style={surface}>再练一次</button><button onClick={() => setPage('learning')} className="rounded-lg border px-4 py-2 text-xs" style={surface}>去学习中心</button></div> : <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3"><button disabled={!RecognitionAPI} onClick={toggleAuto} aria-label={autoMic ? '暂停麦克风' : '恢复麦克风'} className="rounded-full border p-3" style={autoMic ? primary : surface}>{autoMic ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}</button><div><p className="text-xs font-medium">{autoMic ? '持续聆听中' : '麦克风已暂停'}</p><p className="mt-1 text-[10px] opacity-50">直接开口回答或提问 · 停顿后面试官自动接话</p></div></div>
            <button disabled={busy || !question} onClick={() => speak(question)} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs" style={surface}><Volume2 className="h-4 w-4" />再听一遍</button>
            {!RecognitionAPI && <p className="w-full text-xs text-amber-700">此浏览器不支持语音识别，请使用支持中文语音识别的浏览器继续。</p>}
          </div>}

        </footer>
      </main>
    </div>
  </div>
}
