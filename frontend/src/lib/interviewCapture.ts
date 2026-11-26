import { loadRnnoise, RnnoiseWorkletNode } from '@sapphi-red/web-noise-suppressor'
import workletURL from '@sapphi-red/web-noise-suppressor/rnnoiseWorklet.js?url'
import wasmURL from '@sapphi-red/web-noise-suppressor/rnnoise.wasm?url'
import simdURL from '@sapphi-red/web-noise-suppressor/rnnoise_simd.wasm?url'

export function wav16(samples: Float32Array, sampleRate: number): Blob {
  const ratio = sampleRate / 16000
  const count = Math.floor(samples.length / ratio)
  const buffer = new ArrayBuffer(44 + count * 2), view = new DataView(buffer)
  const str = (offset: number, value: string) => [...value].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)))
  str(0, 'RIFF'); view.setUint32(4, 36 + count * 2, true); str(8, 'WAVE'); str(12, 'fmt ')
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true)
  view.setUint32(24, 16000, true); view.setUint32(28, 32000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true)
  str(36, 'data'); view.setUint32(40, count * 2, true)
  for (let i = 0; i < count; i++) {
    let value = 0, n = 0
    for (let j = Math.floor(i * ratio); j < Math.floor((i + 1) * ratio); j++) { value += samples[j]; n++ }
    view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, value / (n || 1))) * 32767, true)
  }
  return new Blob([buffer], { type: 'audio/wav' })
}

/** A sustained, denoised signal starts capture; a transient click cannot interrupt TTS. */
export class InterviewCapture {
  private context: AudioContext | null = null
  private media: MediaStream | null = null
  private rnnoise: RnnoiseWorkletNode | null = null
  private capture: AudioWorkletNode | null = null
  private processed: MediaStreamAudioDestinationNode | null = null
  private enabled = false
  private chunks: Float32Array[] = []
  private pre: Float32Array[] = []
  private activeMs = 0
  private silentMs = 0
  private duration = 0
  private speech = false
  private disposed = false
  constructor(private onSegment: (wav: Blob) => void, private onActivity: () => void) {}
  async start() {
    this.context = new AudioContext({ sampleRate: 48000 })
    await this.context.resume()
    const media = await navigator.mediaDevices.getUserMedia({ audio: {
      echoCancellation: true, noiseSuppression: true, autoGainControl: false, channelCount: 1,
    } })
    if (this.disposed) { media.getTracks().forEach(t => t.stop()); return }
    this.media = media
    const wasmBinary = await loadRnnoise({ url: wasmURL, simdUrl: simdURL })
    if (this.disposed) return
    await this.context.audioWorklet.addModule(workletURL)
    await this.context.audioWorklet.addModule(`${import.meta.env.BASE_URL}media/interview/audio-capture.js`)
    if (this.disposed) return
    this.rnnoise = new RnnoiseWorkletNode(this.context, { wasmBinary, maxChannels: 1 })
    this.processed = this.context.createMediaStreamDestination()
    this.rnnoise.connect(this.processed)
    this.capture = new AudioWorkletNode(this.context, 'interview-capture')
    this.capture.port.onmessage = e => this.frame(e.data)
    this.context.createMediaStreamSource(media).connect(this.rnnoise).connect(this.capture).connect(this.context.destination)
  }
  setEnabled(value: boolean) { if (this.enabled !== value) this.clear(); this.enabled = value }
  get audioTrack() { return this.processed?.stream.getAudioTracks()[0] }
  private clear() { this.chunks = []; this.pre = []; this.activeMs = 0; this.silentMs = 0; this.duration = 0; this.speech = false }
  private frame(frame: Float32Array) {
    if (!this.enabled || !this.context) return
    const ms = frame.length / this.context.sampleRate * 1000
    let square = 0
    for (const value of frame) square += value * value
    const voiced = Math.sqrt(square / frame.length) > 0.012
    if (!this.speech) {
      this.pre.push(frame); if (this.pre.length > 25) this.pre.shift()
      this.activeMs = voiced ? this.activeMs + ms : Math.max(0, this.activeMs - ms * 2)
      if (this.activeMs < 400) return
      this.speech = true; this.chunks = this.pre; this.pre = []; this.onActivity()
    } else this.chunks.push(frame)
    this.duration += ms
    this.silentMs = voiced ? 0 : this.silentMs + ms
    if ((this.silentMs >= 1100 && this.duration >= 900) || this.duration >= 24000) {
      const samples = new Float32Array(this.chunks.reduce((n, c) => n + c.length, 0))
      let offset = 0
      for (const chunk of this.chunks) { samples.set(chunk, offset); offset += chunk.length }
      const wav = wav16(samples, this.context.sampleRate)
      this.clear(); this.onSegment(wav)
    }
  }
  dispose() {
    this.disposed = true; this.enabled = false; this.clear()
    this.media?.getTracks().forEach(t => t.stop()); this.capture?.disconnect()
    this.processed?.stream.getTracks().forEach(t => t.stop()); this.processed?.disconnect()
    this.rnnoise?.destroy(); this.rnnoise?.disconnect(); void this.context?.close().catch(() => {})
  }
}
