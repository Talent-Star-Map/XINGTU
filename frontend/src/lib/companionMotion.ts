/** Shared action sequencing for web and desktop video pets. */
export type MotionAction = 'idle' | 'wave' | 'eat' | 'sleep' | 'walk-left' | 'walk-right'
export type MotionPose = 'standing' | 'left-facing' | 'right-facing' | 'seated' | 'seated-eating' | 'sleeping'
export type MotionTravel =
  | { direction: -1 | 1; start: number; end: number; frameHeights: number }
  | { keyframes: readonly { time: number; x: number }[] }
export type MotionClip = {
  src: string
  from: MotionPose
  to: MotionPose
  loop?: boolean
  travel?: MotionTravel
  playbackRate?: number
  interruptible?: boolean
}
export type MotionPack = {
  clips: Record<string, MotionClip>
  actions: Record<MotionAction, readonly string[]>
  bridges: readonly string[]
  idleVariants?: readonly { clip: string; minLoops: number; maxLoops: number; routine?: boolean }[]
  idleGestureGapLoops?: number
}
export type MotionSnapshot = {
  action: MotionAction
  queued: MotionAction | null
  pose: MotionPose
  clip: string | null
  token: number
  phase: 'stopped' | 'loading' | 'playing' | 'error'
  paused: boolean
  error: string | null
}
export type MotionEvent =
  | { type: 'play'; id: string; clip: MotionClip; token: number }
  | { type: 'finish-loop'; token: number }
  | { type: 'pause'; paused: boolean }
  | { type: 'state'; state: MotionSnapshot }
  | { type: 'dispose' }

const ACTIONS: MotionAction[] = ['idle', 'wave', 'eat', 'sleep', 'walk-left', 'walk-right']
const POSES: MotionPose[] = ['standing', 'left-facing', 'right-facing', 'seated', 'seated-eating', 'sleeping']

function bridge(pack: MotionPack, from: MotionPose, to: MotionPose): string[] {
  if (from === to) return []
  const queue: { pose: MotionPose; path: string[] }[] = [{ pose: from, path: [] }]
  const visited = new Set<MotionPose>([from])
  for (let i = 0; i < queue.length; i++) {
    for (const id of pack.bridges) {
      const clip = pack.clips[id]
      if (!clip || clip.from !== queue[i].pose || visited.has(clip.to)) continue
      const path = [...queue[i].path, id]
      if (clip.to === to) return path
      visited.add(clip.to)
      queue.push({ pose: clip.to, path })
    }
  }
  throw new Error(`缺少从 ${from} 到 ${to} 的过渡动作`)
}

export function validateMotionPack(pack: MotionPack): void {
  for (const [id, clip] of Object.entries(pack.clips)) {
    if (clip.playbackRate !== undefined && (!Number.isFinite(clip.playbackRate) || clip.playbackRate < .5 || clip.playbackRate > 3)) throw new Error(`动作 ${id} 的播放速度无效`)
    if (clip.interruptible && (clip.from !== 'standing' || clip.to !== 'standing' || clip.travel)) throw new Error(`动作 ${id} 不能作为可响应待机`)
    if (!clip.src || !POSES.includes(clip.from) || !POSES.includes(clip.to)) throw new Error(`动作 ${id} 的素材或姿态无效`)
    if (clip.loop && clip.from !== clip.to) throw new Error(`循环动作 ${id} 起止姿态不一致`)
    const travel = clip.travel
    if (travel && 'keyframes' in travel) {
      const points = travel.keyframes
      if (!Array.isArray(points) || points.length < 2 || points.some(p => !p || !Number.isFinite(p.time) || p.time < 0 || !Number.isFinite(p.x)) || points[0].time !== 0 || points[0].x !== 0 || points[points.length - 1].x === 0 || points.some((p, i) => i > 0 && (p.time <= points[i - 1].time || (p.x - points[i - 1].x) * points[points.length - 1].x < 0))) throw new Error(`动作 ${id} 的位移曲线无效`)
    } else if (travel && (![-1, 1].includes(travel.direction) || !Number.isFinite(travel.start) || !Number.isFinite(travel.end) || travel.start < 0 || travel.end <= travel.start || !Number.isFinite(travel.frameHeights) || travel.frameHeights <= 0)) throw new Error(`动作 ${id} 的步行时序无效`)
  }
  for (const id of pack.bridges) {
    if (!pack.clips[id] || pack.clips[id].loop) throw new Error(`过渡动作 ${id} 不存在或不能结束`)
  }
  for (const action of ACTIONS) {
    const ids = pack.actions[action]
    if (!ids?.length) throw new Error(`缺少 ${action} 动作`)
    let pose: MotionPose = 'standing'
    ids.forEach((id, i) => {
      const clip = pack.clips[id]
      if (!clip || clip.from !== pose) throw new Error(`动作 ${action} 在 ${id} 处姿态不连续`)
      if (clip.loop && i !== ids.length - 1) throw new Error(`动作 ${action} 的循环段挡住了后续片段`)
      pose = clip.to
    })
    if (pose !== (action === 'sleep' ? 'sleeping' : 'standing')) throw new Error(`动作 ${action} 的结束姿态无效`)
    const last = pack.clips[ids[ids.length - 1]]
    if ((action === 'idle' || action === 'sleep') !== !!last.loop) throw new Error(`动作 ${action} 的循环设置无效`)
  }
  for (const pose of new Set(Object.values(pack.clips).map(clip => clip.to))) bridge(pack, pose, 'standing')
  for (const variant of pack.idleVariants || []) {
    const clip = pack.clips[variant.clip]
    if (!clip || clip.from !== 'standing' || clip.to !== 'standing' || clip.loop || clip.travel || !Number.isInteger(variant.minLoops) || !Number.isInteger(variant.maxLoops) || variant.minLoops < 1 || variant.maxLoops < variant.minLoops) throw new Error('待机插曲配置无效')
  }
  if (pack.idleGestureGapLoops !== undefined && (!Number.isInteger(pack.idleGestureGapLoops) || pack.idleGestureGapLoops < 0)) throw new Error('待机插曲安静间隔无效')
  if (pack.idleVariants?.length && pack.actions.idle.length !== 1) throw new Error('带插曲的基础待机必须是单一循环段')
}

/** Commands replace the pending command, never an unfinished body movement. */
export class PetMotionMachine {
  private state: MotionSnapshot = { action: 'idle', queued: null, pose: 'standing', clip: null, token: 0, phase: 'stopped', paused: false, error: null }
  private remaining: string[] = []
  private disposed = false
  private loopEnding = false
  private pack: MotionPack
  private emit: (event: MotionEvent) => void
  private idleCounts: number[] = []
  private idleTargets: number[] = []
  private random: () => number
  private idleQuietLoops = 0

  constructor(pack: MotionPack, emit: (event: MotionEvent) => void, random: () => number = Math.random) {
    validateMotionPack(pack)
    this.pack = pack
    this.emit = emit
    this.random = random
    this.resetIdleSchedule()
  }

  snapshot(): MotionSnapshot { return { ...this.state } }

  start(): void {
    if (this.disposed || this.state.phase !== 'stopped') return
    this.request('idle')
  }

  request(action: MotionAction): void {
    if (this.disposed || this.state.phase === 'error') return
    if (!ACTIONS.includes(action)) throw new Error(`未知动作 ${action}`)
    if (this.state.clip && action === this.state.action && !this.state.queued && (action === 'idle' || action === 'sleep')) return
    this.state.queued = action
    if (action !== 'idle' && this.state.action === 'idle' && this.state.clip && this.pack.clips[this.state.clip].interruptible && !this.state.paused) {
      this.state.pose = 'standing'
      this.state.clip = null
      this.remaining = []
      this.advance()
      return
    }
    if (!this.state.clip) this.advance()
    else {
      if (this.pack.clips[this.state.clip].loop && !this.loopEnding) {
        this.loopEnding = true
        this.emit({ type: 'finish-loop', token: this.state.token })
      }
      this.changed()
    }
  }

  ready(token: number): void {
    if (!this.current(token) || this.state.phase !== 'loading') return
    this.state.phase = 'playing'
    this.changed()
  }

  ended(token: number): void {
    if (!this.current(token) || this.state.phase === 'error') return
    const clip = this.pack.clips[this.state.clip!]
    const id = this.state.clip!
    if (this.state.action === 'idle' && id === this.pack.actions.idle[0]) {
      this.idleCounts = this.idleCounts.map(n => n + 1)
      this.idleQuietLoops++
    }
    this.state.pose = clip.to
    this.state.clip = null
    this.loopEnding = false
    if (clip.loop && !this.state.queued && this.state.action !== 'idle') this.remaining = [id]
    this.advance()
  }

  setPaused(paused: boolean): void {
    if (this.disposed || this.state.paused === paused) return
    this.state.paused = paused
    this.emit({ type: 'pause', paused: paused || this.state.phase === 'error' })
    if (!paused && this.state.queued && this.state.action === 'idle' && this.state.clip && this.pack.clips[this.state.clip].interruptible) { this.request(this.state.queued); return }
    this.changed()
  }

  failed(token: number, message: string): void {
    if (!this.current(token)) return
    this.state.phase = 'error'
    this.state.error = message
    this.remaining = []
    this.state.queued = null
    this.emit({ type: 'pause', paused: true })
    this.changed()
  }

  /** Explicit recovery resets to a known neutral pose; it is not an animation transition. */
  restart(): void {
    if (this.disposed) return
    this.state = { ...this.state, clip: null, pose: 'standing', phase: 'stopped', error: null, queued: null }
    this.remaining = []
    this.resetIdleSchedule()
    this.emit({ type: 'pause', paused: this.state.paused })
    this.start()
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.remaining = []
    this.emit({ type: 'dispose' })
  }

  private current(token: number): boolean { return !this.disposed && this.state.clip !== null && token === this.state.token }
  private changed(): void { this.emit({ type: 'state', state: this.snapshot() }) }
  private resetIdleSchedule(): void {
    this.idleQuietLoops = 0
    this.idleCounts = (this.pack.idleVariants || []).map(() => 0)
    this.idleTargets = (this.pack.idleVariants || []).map(v => v.minLoops + Math.floor(Math.min(.999999, Math.max(0, this.random())) * (v.maxLoops - v.minLoops + 1)))
  }
  private idleSequence(): string[] {
    const variants = this.pack.idleVariants || []
    const due = variants.findIndex((v, i) => this.idleCounts[i] >= this.idleTargets[i] && (v.routine || this.idleQuietLoops >= (this.pack.idleGestureGapLoops || 0)))
    if (due < 0) return [...this.pack.actions.idle]
    const v = variants[due]
    if (!v.routine) this.idleQuietLoops = 0
    this.idleCounts[due] = 0
    this.idleTargets[due] = v.minLoops + Math.floor(Math.min(.999999, Math.max(0, this.random())) * (v.maxLoops - v.minLoops + 1))
    return [v.clip]
  }

  private advance(): void {
    if (this.state.queued) {
      const action = this.state.queued
      this.state.queued = null
      this.remaining = [...bridge(this.pack, this.state.pose, 'standing'), ...this.pack.actions[action]]
      this.state.action = action
      if (action !== 'idle') this.resetIdleSchedule()
    }
    if (!this.remaining.length) {
      this.state.action = 'idle'
      this.remaining = [...bridge(this.pack, this.state.pose, 'standing'), ...this.idleSequence()]
    }
    const id = this.remaining.shift()!
    const clip = this.pack.clips[id]
    if (clip.from !== this.state.pose) throw new Error(`动作 ${id} 无法衔接当前姿态 ${this.state.pose}`)
    this.state.clip = id
    this.state.token++
    this.state.phase = 'loading'
    this.loopEnding = false
    this.changed()
    // Scheduled idle needs an ended event for each cycle; native video looping
    // never emits it. The machine repeats the base or selects an incidental clip.
    const scheduledIdle = this.state.action === 'idle' && id === this.pack.actions.idle[0] && !!this.pack.idleVariants?.length
    this.emit({ type: 'play', id, clip: scheduledIdle ? { ...clip, loop: false } : clip, token: this.state.token })
  }
}

/** Positions are normalized to media-frame height and follow decoded video time. */
export function clipTravel(clip: MotionClip, videoTime: number, frameHeight: number): number {
  const travel = clip.travel
  if (!travel || !Number.isFinite(videoTime) || !Number.isFinite(frameHeight) || frameHeight <= 0) return 0
  if ('keyframes' in travel) {
    const points = travel.keyframes
    if (videoTime <= points[0].time) return points[0].x * frameHeight
    for (let i = 1; i < points.length; i++) {
      if (videoTime <= points[i].time) {
        const a = points[i - 1], b = points[i]
        return (a.x + (b.x - a.x) * (videoTime - a.time) / (b.time - a.time)) * frameHeight
      }
    }
    return points[points.length - 1].x * frameHeight
  }
  const progress = Math.max(0, Math.min(1, (videoTime - travel.start) / (travel.end - travel.start)))
  return travel.direction * progress * travel.frameHeights * frameHeight
}
