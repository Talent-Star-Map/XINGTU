import type { MotionClip } from './companionMotion'

export type VideoDeckCallbacks = {
  ready: (token: number) => void
  ended: (token: number) => void
  failed: (token: number, message: string) => void
  frame?: (token: number, clip: MotionClip, mediaTime: number) => void
}
type PendingClip = { token: number; loop: boolean; controller: AbortController }

/** Two decoded slots, one visible character. No opacity cross-fade or whole-body transform. */
export class PetVideoDeck {
  private videos: [HTMLVideoElement, HTMLVideoElement]
  private urls: [string | null, string | null] = [null, null]
  private active = -1
  private token = 0
  private pending: PendingClip | null = null
  private paused = false
  private pauseRevision = 0
  private disposed = false
  private callbacks: VideoDeckCallbacks
  private base: URL
  private rateMultiplier: number

  constructor(container: HTMLElement, base: string | URL, callbacks: VideoDeckCallbacks, rateMultiplier = 1) {
    this.callbacks = callbacks
    this.base = new URL(base)
    this.rateMultiplier = rateMultiplier
    this.videos = [document.createElement('video'), document.createElement('video')]
    if (getComputedStyle(container).position === 'static') container.style.position = 'relative'
    for (const video of this.videos) {
      video.muted = true
      video.playsInline = true
      video.preload = 'auto'
      video.setAttribute('aria-hidden', 'true')
      Object.assign(video.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', objectFit: 'contain', visibility: 'hidden', pointerEvents: 'none' })
      container.append(video)
    }
  }

  async play(clip: MotionClip, token: number): Promise<void> {
    if (this.disposed) return
    this.pending?.controller.abort()
    const request: PendingClip = { token, loop: !!clip.loop, controller: new AbortController() }
    this.pending = request
    const index = this.active === 0 ? 1 : 0
    const video = this.videos[index]
    video.pause()
    video.onended = null
    video.onerror = null
    if (this.urls[index]) URL.revokeObjectURL(this.urls[index]!)
    this.urls[index] = null
    const timeout = setTimeout(() => request.controller.abort(new Error('动作素材加载超时')), 15000)
    const current = () => !this.disposed && this.pending === request
    try {
      const url = new URL(clip.src, this.base)
      if (url.protocol !== this.base.protocol || url.host !== this.base.host || url.username || url.password) throw new Error('动作素材必须来自桌宠自己的素材目录')
      const response = await fetch(url, { signal: request.controller.signal, credentials: 'same-origin' })
      if (!response.ok) throw new Error(`动作素材请求失败：${response.status}`)
      const blob = await response.blob()
      if (!current()) return
      this.urls[index] = URL.createObjectURL(blob)
      video.src = this.urls[index]!
      await this.firstFrame(video, request.controller.signal)
      if (!current()) return
      const travelEnd = clip.travel ? ('keyframes' in clip.travel ? clip.travel.keyframes[clip.travel.keyframes.length - 1].time : clip.travel.end) : 0
      video.playbackRate = (clip.playbackRate || 1) * this.rateMultiplier
      if (travelEnd > video.duration) throw new Error('步行时序超过视频长度')
      video.loop = request.loop
      const outgoing = this.active >= 0 ? this.videos[this.active] : null
      this.active = index
      this.token = token
      this.pending = null
      if (outgoing) {
        outgoing.onended = null
        outgoing.onerror = null
        outgoing.pause()
        outgoing.style.visibility = 'hidden'
      }
      video.style.visibility = 'visible'
      video.onended = () => {
        if (!this.isActive(index, token)) return
        // The last decoded frame can precede duration; finish video-clock travel first.
        this.callbacks.frame?.(token, clip, video.duration)
        if (this.isActive(index, token)) this.callbacks.ended(token)
      }
      video.onerror = () => { if (this.isActive(index, token)) this.callbacks.failed(token, video.error?.message || '视频解码失败') }
      this.trackFrames(video, index, token, clip)
      if (this.paused) { video.pause(); this.callbacks.ready(token) }
      else this.playActive()
    } catch (error) {
      if (current()) {
        this.pending = null
        this.callbacks.failed(token, error instanceof Error ? error.message : '动作素材加载失败')
      }
    } finally { clearTimeout(timeout) }
  }

  finishLoop(token: number): void {
    if (this.pending?.token === token) this.pending.loop = false
    if (this.active >= 0 && token === this.token) this.videos[this.active].loop = false
  }

  setPaused(paused: boolean): void {
    this.paused = paused
    this.pauseRevision++
    if (paused) this.videos.forEach(video => video.pause())
    else if (!this.pending) this.playActive()
  }

  currentVideo(): HTMLVideoElement | null { return this.active < 0 ? null : this.videos[this.active] }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.pending?.controller.abort()
    this.pending = null
    this.videos.forEach((video, index) => {
      video.onended = null
      video.onerror = null
      video.pause()
      video.removeAttribute('src')
      video.load()
      video.remove()
      if (this.urls[index]) URL.revokeObjectURL(this.urls[index]!)
    })
  }

  private isActive(index: number, token: number): boolean { return !this.disposed && this.active === index && this.token === token }

  private playActive(): void {
    if (this.disposed || this.active < 0 || this.paused) return
    const index = this.active, token = this.token, revision = this.pauseRevision
    this.videos[index].play().then(() => {
      if (this.isActive(index, token)) this.callbacks.ready(token)
    }).catch(error => {
      if (this.isActive(index, token) && revision === this.pauseRevision && !this.paused) this.callbacks.failed(token, error instanceof Error ? error.message : '视频播放被拒绝')
    })
  }

  private firstFrame(video: HTMLVideoElement, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      const cleanup = () => { video.removeEventListener('loadeddata', ready); video.removeEventListener('error', failed); signal.removeEventListener('abort', aborted) }
      const ready = () => { cleanup(); resolve() }
      const failed = () => { cleanup(); reject(new Error(video.error?.message || '视频首帧解码失败')) }
      const aborted = () => { cleanup(); reject(signal.reason || new Error('素材加载已取消')) }
      video.addEventListener('loadeddata', ready, { once: true })
      video.addEventListener('error', failed, { once: true })
      signal.addEventListener('abort', aborted, { once: true })
      if (signal.aborted) aborted()
      else video.load()
    })
  }

  private trackFrames(video: HTMLVideoElement, index: number, token: number, clip: MotionClip): void {
    const next = () => {
      if (!this.isActive(index, token)) return
      if (video.requestVideoFrameCallback) {
        video.requestVideoFrameCallback((_time, metadata) => {
          if (!this.isActive(index, token)) return
          this.callbacks.frame?.(token, clip, metadata.mediaTime)
          next()
        })
      } else {
        requestAnimationFrame(() => {
          if (!this.isActive(index, token)) return
          if (!video.paused) this.callbacks.frame?.(token, clip, video.currentTime)
          next()
        })
      }
    }
    this.callbacks.frame?.(token, clip, video.currentTime)
    next()
  }
}
