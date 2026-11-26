/** Browser ASR owns transcription; server only checks the corresponding voice sample. */
export class InterviewRecognition {
  private recognizer: any = null
  private enabled = false
  private restart: ReturnType<typeof setTimeout> | undefined
  private final = ''
  private ended: (() => void) | null = null
  private track: MediaStreamTrack | undefined
  private generation = 0
  constructor(private failed: (message: string) => void) {}
  static available() { return !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) }
  setTrack(track: MediaStreamTrack | undefined) { this.track = track }
  setEnabled(enabled: boolean) {
    if (this.enabled === enabled) return
    this.enabled = enabled
    if (enabled) this.start()
    else { this.generation++; clearTimeout(this.restart); this.recognizer?.abort(); this.recognizer = null; this.final = ''; this.ended?.() }
  }
  private start() {
    if (!this.enabled || this.recognizer) return
    const API = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!API) { this.failed('此浏览器不支持语音识别，请使用支持中文语音识别的 Chrome 或 Edge。'); return }
    const rec = new API(), generation = this.generation
    this.recognizer = rec
    rec.lang = 'zh-CN'; rec.continuous = true; rec.interimResults = true
    rec.onresult = (event: any) => {
      if (generation !== this.generation) return
      // Only final results are submitted. Interim fragments cannot interrupt the avatar.
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) this.final = (this.final + event.results[i][0].transcript).slice(0, 512)
      }
    }
    rec.onerror = (event: any) => {
      if (generation !== this.generation || event.error === 'aborted' || event.error === 'no-speech') return
      this.enabled = false
      this.failed(event.error === 'not-allowed' ? '浏览器语音识别未获麦克风权限，请允许后重新检查设备。' : '浏览器语音识别中断，请检查网络后重新检查设备。')
    }
    rec.onend = () => {
      if (this.recognizer === rec) this.recognizer = null
      this.ended?.()
      if (this.enabled && generation === this.generation) this.restart = setTimeout(() => this.start(), 200)
    }
    try {
      // Modern implementations accept a processed audio track. Older ones use their microphone.
      // RNNoise activity gating and voice verification remain active on both paths.
      if (this.track) { try { rec.start(this.track) } catch { rec.start() } }
      else rec.start()
    } catch { this.recognizer = null; this.enabled = false; this.failed('无法启动浏览器语音识别，请重新检查设备。') }
  }
  async takeFinal(): Promise<string> {
    this.enabled = false; clearTimeout(this.restart)
    const rec = this.recognizer
    if (rec) await new Promise<void>(resolve => {
      const timer = setTimeout(resolve, 900)
      this.ended = () => { clearTimeout(timer); resolve() }
      try { rec.stop() } catch { clearTimeout(timer); resolve() }
    })
    this.ended = null
    const text = this.final.trim()
    this.generation++; rec?.abort(); this.recognizer = null; this.final = ''
    return text
  }
  dispose() { this.setEnabled(false); this.recognizer?.abort(); this.ended?.(); this.ended = null }
}
