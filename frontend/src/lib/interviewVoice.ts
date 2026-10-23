/** Sentence synthesis overlaps playback; generation IDs prevent stale speech after interruption. */
export class InterviewVoice {
  private context: AudioContext | null = null
  private source: AudioBufferSourceNode | null = null
  private aborter = new AbortController()
  private synthesis: Promise<void> = Promise.resolve()
  private playback: Promise<void> = Promise.resolve()
  private generation = 0
  private resolvePlaying: (() => void) | null = null
  private started = 0
  constructor(private status: (playing: boolean) => void, private failed: (message: string) => void,
              private latency: (milliseconds: number) => void) {}
  unlock() {
    if (!this.context) this.context = new AudioContext()
    void this.context.resume().catch(() => this.failed('浏览器暂停了音频，请点击重播语音。'))
  }
  begin() { this.stop(); this.unlock(); this.started = performance.now() }
  enqueue(text: string) {
    const generation = this.generation
    const signal = this.aborter.signal
    const work = this.synthesis.then(async () => {
      if (generation !== this.generation) return null
      const response = await fetch('/api/interview/speech', { method: 'POST', signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('xingtu_token') || ''}` }, body: JSON.stringify({ text }) })
      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(typeof error.detail === 'string' ? error.detail : '语音服务不可用，请重播或选择系统语音')
      }
      const data = await response.arrayBuffer()
      if (generation !== this.generation || !this.context) return null
      return this.context.decodeAudioData(data)
    })
    this.synthesis = work.then(() => {}, () => {})
    // Attach immediately: a fetch error must not become an unhandled rejection while prior audio plays.
    const safe = work.catch(error => {
      if (generation === this.generation && !signal.aborted) {
        this.stop()
        this.failed(error instanceof Error ? error.message : '语音合成失败')
      }
      return null
    })
    this.playback = this.playback.then(async () => {
      const buffer = await safe
      if (!buffer || generation !== this.generation || !this.context) return
      if (this.context.state !== 'running') { this.failed('浏览器暂停了音频，请点击重播语音。'); return }
      await new Promise<void>(resolve => {
        this.resolvePlaying = resolve
        const source = this.context!.createBufferSource()
        this.source = source; source.buffer = buffer; source.connect(this.context!.destination)
        source.onended = () => { source.disconnect(); this.resolvePlaying = null; resolve() }
        if (this.started) { this.latency(Math.round(performance.now() - this.started)); this.started = 0 }
        this.status(true); source.start()
      })
    }).catch(() => { if (generation === this.generation) this.failed('音频播放失败，请重试。') })
  }
  async finish() {
    const generation = this.generation
    await this.synthesis; await this.playback
    if (generation === this.generation) { this.status(false); return true }
    return false
  }
  stop() {
    this.generation++; this.aborter.abort(); this.aborter = new AbortController()
    this.source?.stop(); this.source = null; this.resolvePlaying?.(); this.resolvePlaying = null
    this.synthesis = Promise.resolve(); this.playback = Promise.resolve(); this.status(false)
  }
  dispose() { this.stop(); void this.context?.close(); this.context = null }
}
