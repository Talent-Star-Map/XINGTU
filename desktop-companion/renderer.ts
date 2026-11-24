import { PetMotionMachine, clipTravel, type MotionAction, type MotionPack, type MotionSnapshot } from '../frontend/src/lib/companionMotion'
import { PetVideoDeck } from '../frontend/src/lib/companionVideo'

type DesktopConfig = { assetBase: string; manifest: string; review: boolean; diagnostics: boolean; reviewPlaybackRate: number; size: string; bounds: { x: number; width: number }; workArea: { x: number; width: number } }
declare global {
  interface Window {
    xiaoxingDesktop: {
      config(): Promise<DesktopConfig>
      moveBy(dx: number, dy: number): void
      drag(phase: 'start' | 'move' | 'end', cursor?: { x: number; y: number }): void
      passthrough(ignore: boolean): void
      corner(): void
      size(value: string): void
      hide(): void
      quit(): void
      openStarMap(): Promise<boolean>
    }
  }
}
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T
const api = window.xiaoxingDesktop
const panel = $('panel'), character = $<HTMLButtonElement>('character'), portrait = $<HTMLImageElement>('portrait'), message = $('message')
const pause = $<HTMLInputElement>('pause'), wander = $<HTMLInputElement>('wander')
let machine: PetMotionMachine | null = null, deck: PetVideoDeck | null = null
let open = false, dragging = false, wanderTimer: ReturnType<typeof setTimeout> | undefined
let pointer: { id: number; x: number; y: number; moved: boolean } | null = null
let travelToken = 0, lastTravel = 0, dirty = true, hitPending = false
let config: DesktopConfig
let diagnosticTimer: ReturnType<typeof setInterval> | undefined
let diagnosticClip: { id: string; token: number; loadAt: number; readyAt: number; movementPixels: number; lastFrameAt: number; lastMediaTime: number; frameCallbacks: number; maxFrameGapMs: number; maxMediaJump: number; longTasks: number; maxLongTaskMs: number; hiddenAtStart: boolean; focusAtStart: boolean } | null = null
let diagnosticLongTaskObserver: PerformanceObserver | undefined
const diagnosticHistory: { id: string; token: number; duration: number; rate: number; loadMs: number; elapsedMs: number; totalFrames: number; droppedFrames: number; movementPixels: number }[] = []
const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128
const context = canvas.getContext('2d', { willReadFrequently: true })!
const labels: Record<MotionAction, string> = { idle: '陪着你', wave: '嗨，今天也一起加油。', eat: '开饭啦。', sleep: '我眯一会儿，点「叫醒」就好。', 'walk-left': '我去旁边走两步。', 'walk-right': '我去旁边走两步。' }
try {
  const prefs = JSON.parse(localStorage.getItem('xiaoxing-desktop') || 'null')
  pause.checked = typeof prefs?.paused === 'boolean' ? prefs.paused : matchMedia('(prefers-reduced-motion: reduce)').matches
  wander.checked = prefs?.wander === true
} catch { pause.checked = matchMedia('(prefers-reduced-motion: reduce)').matches }

function save() { try { localStorage.setItem('xiaoxing-desktop', JSON.stringify({ paused: pause.checked, wander: wander.checked })) } catch {} }
function pausePlayback() { machine?.setPaused(pause.checked || dragging || document.hidden) }
function scheduleWander() {
  clearTimeout(wanderTimer)
  const state = machine?.snapshot()
  if (wander.checked && !open && !dragging && state?.action === 'idle' && state.phase === 'playing' && !state.paused) wanderTimer = setTimeout(() => void walk(), 26000)
}
function togglePanel(next = !open) {
  const restoreFocus = panel.contains(document.activeElement)
  open = next; panel.hidden = !open; character.setAttribute('aria-expanded', String(open))
  if (open) { setIgnore(false); $('close').focus({ preventScroll: true }) }
  else if (restoreFocus) character.focus({ preventScroll: true })
  scheduleWander()
}
async function walk() {
  const state = await api.config()
  const left = state.bounds.x + state.bounds.width / 2 > state.workArea.x + state.workArea.width / 2
  machine?.request(left ? 'walk-left' : 'walk-right')
  togglePanel(false)
}
function showState(state: MotionSnapshot) {
  message.textContent = state.error || (state.queued ? '等这个动作做完就来。' : labels[state.action])
  $('wake').hidden = state.action !== 'sleep'
  $('retry').hidden = state.phase !== 'error'
  document.body.dataset.phase = state.phase
  document.body.dataset.clip = state.clip || ''
  scheduleWander()
}
function setIgnore(ignore: boolean) {
  api.passthrough(open ? false : ignore)
}
function hitCharacter(x: number, y: number): boolean {
  const rect = character.getBoundingClientRect()
  if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) return false
  const media = deck?.currentVideo() || portrait
  const width = media instanceof HTMLVideoElement ? media.videoWidth : media.naturalWidth
  const height = media instanceof HTMLVideoElement ? media.videoHeight : media.naturalHeight
  if (!width || !height) return true
  if (dirty) {
    const scale = Math.min(128 / width, 128 / height)
    context.clearRect(0, 0, 128, 128)
    context.drawImage(media, (128 - width * scale) / 2, (128 - height * scale) / 2, width * scale, height * scale)
    dirty = false
  }
  try { return context.getImageData(Math.min(127, Math.floor((x - rect.left) / rect.width * 128)), Math.min(127, Math.floor((y - rect.top) / rect.height * 128)), 1, 1).data[3] > 12 }
  catch { return true }
}
document.addEventListener('pointermove', event => {
  if (dragging || hitPending) return
  hitPending = true
  requestAnimationFrame(() => {
    hitPending = false
    const inPanel = open && event.target instanceof Element && !!event.target.closest('#panel')
    setIgnore(!inPanel && !hitCharacter(event.clientX, event.clientY))
  })
})
document.addEventListener('pointerleave', () => { if (!dragging) setIgnore(true) })
character.addEventListener('pointerdown', event => {
  if (event.button !== 0) return
  character.setPointerCapture(event.pointerId)
  pointer = { id: event.pointerId, x: event.screenX, y: event.screenY, moved: false }
  dragging = true; setIgnore(false); api.drag('start', { x: event.screenX, y: event.screenY }); pausePlayback(); clearTimeout(wanderTimer)
})
character.addEventListener('pointermove', event => {
  if (!pointer || event.pointerId !== pointer.id) return
  if (Math.hypot(event.screenX - pointer.x, event.screenY - pointer.y) > 5) pointer.moved = true
  if (pointer.moved) { togglePanel(false); api.drag('move', { x: event.screenX, y: event.screenY }) }
})
function endDrag(toggle: boolean) {
  const moved = pointer?.moved
  pointer = null; dragging = false; api.drag('end'); pausePlayback()
  if (toggle && !moved) togglePanel()
  scheduleWander()
}
character.addEventListener('pointerup', event => {
  if (pointer?.id !== event.pointerId) return
  endDrag(true)
  if (character.hasPointerCapture(event.pointerId)) character.releasePointerCapture(event.pointerId)
})
character.addEventListener('pointercancel', () => endDrag(false))
character.addEventListener('lostpointercapture', () => { if (pointer) endDrag(false) })
character.addEventListener('click', event => { if (event.detail === 0) togglePanel() })
character.addEventListener('keydown', event => {
  const moves: Record<string, [number, number]> = { ArrowLeft: [-20, 0], ArrowRight: [20, 0], ArrowUp: [0, -20], ArrowDown: [0, 20] }
  if (moves[event.key]) { event.preventDefault(); api.moveBy(...moves[event.key]) }
})
document.addEventListener('keydown', event => { if (event.key === 'Escape') togglePanel(false) })
document.querySelectorAll<HTMLButtonElement>('[data-action]').forEach(button => button.onclick = () => {
  if (button.dataset.action === 'walk') void walk()
  else { machine?.request(button.dataset.action as MotionAction); togglePanel(false) }
})
$('wake').onclick = () => { machine?.request('idle'); togglePanel(false) }
$('retry').onclick = () => machine?.restart()
$('close').onclick = () => togglePanel(false)
$('corner').onclick = () => { api.corner(); togglePanel(false) }
$('hide').onclick = () => { togglePanel(false); api.hide() }
$('quit').onclick = () => api.quit()
$('open-site').onclick = () => { void api.openStarMap().then(opened => { if (opened) togglePanel(false); else message.textContent = '请先打开星图页面。' }) }
pause.onchange = () => { pausePlayback(); save(); scheduleWander() }
wander.onchange = () => { save(); scheduleWander() }
document.addEventListener('visibilitychange', () => { pausePlayback(); scheduleWander() })
document.querySelectorAll<HTMLButtonElement>('[data-size]').forEach(button => button.onclick = () => {
  api.size(button.dataset.size!)
  document.querySelectorAll<HTMLButtonElement>('[data-size]').forEach(item => item.setAttribute('aria-pressed', String(item === button)))
  dirty = true
})

async function start() {
  document.querySelectorAll<HTMLButtonElement>('[data-action]').forEach(button => button.disabled = true)
  config = await api.config()
  if (config.diagnostics) {
    if (PerformanceObserver.supportedEntryTypes.includes('longtask')) {
      diagnosticLongTaskObserver = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          if (diagnosticClip && entry.startTime >= diagnosticClip.loadAt) {
            diagnosticClip.longTasks++
            diagnosticClip.maxLongTaskMs = Math.max(diagnosticClip.maxLongTaskMs, entry.duration)
          }
        }
      })
      diagnosticLongTaskObserver.observe({ type: 'longtask' })
    }
    const diagnostic = document.createElement('output')
    diagnostic.setAttribute('aria-label', '绘制诊断')
    Object.assign(diagnostic.style, { position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clipPath: 'inset(50%)' })
    document.body.append(diagnostic)
    diagnosticTimer = setInterval(() => {
      const current = deck?.currentVideo()
      diagnostic.textContent = JSON.stringify({ viewport: [innerWidth, innerHeight], character: [character.clientWidth, character.clientHeight], video: current ? [current.clientWidth, current.clientHeight, current.videoWidth, current.videoHeight, current.currentTime, current.readyState] : null, videoRate: current?.playbackRate ?? null, videoDuration: current?.duration ?? null, videoQuality: current ? { totalFrames: current.getVideoPlaybackQuality().totalVideoFrames, droppedFrames: current.getVideoPlaybackQuality().droppedVideoFrames } : null, lastCompletedClips: diagnosticHistory, panelWidth: panel.clientWidth, phase: document.body.dataset.phase, motion: machine?.snapshot(), focus: document.activeElement?.id || document.activeElement?.textContent?.trim().slice(0, 20) })
    }, 250)
  }
  document.querySelector<HTMLButtonElement>(`[data-size="${config.size}"]`)?.setAttribute('aria-pressed', 'true')
  $('badge').hidden = !config.review
  const response = await fetch(config.manifest)
  if (!response.ok) throw new Error('连续动作素材尚未就绪。')
  const pack: { id: string; name: string; approved: boolean; motion: MotionPack } = await response.json()
  if (!config.review && (pack.id !== 'xiaoxing' || pack.approved !== true)) throw new Error('小星动作还在验收中。')
  if (config.review) $('badge').textContent = `${pack.name} · 素材验证`
  machine = new PetMotionMachine(pack.motion, event => {
    if (event.type === 'play') {
      travelToken = event.token; lastTravel = 0
      if (config.diagnostics) diagnosticClip = { id: event.id, token: event.token, loadAt: performance.now(), readyAt: 0, movementPixels: 0, lastFrameAt: 0, lastMediaTime: 0, frameCallbacks: 0, maxFrameGapMs: 0, maxMediaJump: 0, longTasks: 0, maxLongTaskMs: 0, hiddenAtStart: document.hidden, focusAtStart: document.hasFocus() }
      void deck!.play(event.clip, event.token)
    }
    else if (event.type === 'finish-loop') deck!.finishLoop(event.token)
    else if (event.type === 'pause') { if (diagnosticClip) diagnosticClip.lastFrameAt = 0; deck!.setPaused(event.paused) }
    else if (event.type === 'state') showState(event.state)
    else if (event.type === 'dispose') deck!.dispose()
  })
  deck = new PetVideoDeck($('video'), config.assetBase, {
    ready: token => {
      if (diagnosticClip?.token === token && !diagnosticClip.readyAt) diagnosticClip.readyAt = performance.now()
      portrait.hidden = true; machine!.ready(token); dirty = true
    },
    ended: token => {
      const v = deck!.currentVideo(), info = diagnosticClip
      if (v && info?.token === token && info.id !== 'idle' && info.id !== 'idle-blink') {
        const quality = v.getVideoPlaybackQuality()
        const record = { id: info.id, token, duration: v.duration, rate: v.playbackRate, loadMs: info.readyAt - info.loadAt, elapsedMs: performance.now() - info.readyAt, totalFrames: quality.totalVideoFrames, droppedFrames: quality.droppedVideoFrames, movementPixels: info.movementPixels, frameCallbacks: info.frameCallbacks, maxFrameGapMs: info.maxFrameGapMs, maxMediaJump: info.maxMediaJump, longTasks: info.longTasks, maxLongTaskMs: info.maxLongTaskMs, hiddenAtStart: info.hiddenAtStart, hiddenAtEnd: document.hidden, focusAtStart: info.focusAtStart, focusAtEnd: document.hasFocus() }
        diagnosticHistory.push(record)
        if (diagnosticHistory.length > 12) diagnosticHistory.shift()
        console.info('PET_PLAYBACK_TRACE ' + JSON.stringify({ at: new Date().toISOString(), ...record }))
      }
      machine!.ended(token)
    },
    failed: (token, error) => machine!.failed(token, error),
    frame: (token, clip, mediaTime) => {
      dirty = true
      const info = diagnosticClip
      if (info?.token === token && info.readyAt && !machine!.snapshot().paused) {
        const now = performance.now()
        if (info.lastFrameAt) {
          info.maxFrameGapMs = Math.max(info.maxFrameGapMs, now - info.lastFrameAt)
          info.maxMediaJump = Math.max(info.maxMediaJump, mediaTime - info.lastMediaTime)
        }
        info.lastFrameAt = now; info.lastMediaTime = mediaTime; info.frameCallbacks++
      }
      if (token !== travelToken || dragging) return
      const next = clipTravel(clip, mediaTime, 1)
      const delta = (next - lastTravel) * character.clientHeight
      lastTravel = next
      if (diagnosticClip?.token === token) diagnosticClip.movementPixels += delta
      if (delta) api.moveBy(delta, 0)
    },
  }, config.review ? config.reviewPlaybackRate : 1)
  pausePlayback(); machine.start()
  document.querySelectorAll<HTMLButtonElement>('[data-action]').forEach(button => button.disabled = false)
}
start().catch(error => { message.textContent = error instanceof Error ? error.message : '动作加载失败'; document.body.dataset.phase = 'unavailable' })
window.addEventListener('beforeunload', () => { clearTimeout(wanderTimer); clearInterval(diagnosticTimer); diagnosticLongTaskObserver?.disconnect(); machine?.dispose(); deck?.dispose() })
