import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import { Hand, Moon, Utensils, Footprints, Minimize2, X, RotateCcw } from 'lucide-react'
import { clampPetPosition, PET_DEFAULTS, PET_LABELS, PET_SIZES, PET_STORAGE_KEY, petAsset, readPetPreferences, type PetAction, type PetPreferences, type Point } from '../../lib/companion'
import PetMotionSurface, { displayPetAction, type PetCommand, type PetMotionAvailability } from './PetMotionSurface'
import type { MotionSnapshot } from '../../lib/companionMotion'
import { useDesktopCompanion } from '../../lib/companionBridge'
import './xiaogui.css'

export function PetSprite({ action, animated = true }: { action: PetAction; animated?: boolean }) {
  const [failed, setFailed] = useState(false)
  if (failed) return <span className="xiaogui-fallback" role="img" aria-label="小星">✦</span>
  if (animated) return <PetMotionSurface command={{ action: action === 'walk' ? 'walk-left' : action, sequence: 0 }} />
  return <span className={`xiaogui-sprite xiaogui-sprite--${action}`}>
    <img src={petAsset(action)} alt="" draggable={false} onError={() => setFailed(true)} />
  </span>
}

function PetPortrait() {
  return <span className="xiaogui-portrait"><img src={petAsset('idle')} alt="" draggable={false} /></span>
}

const ACTIONS = [
  { action: 'wave', label: '打招呼', icon: Hand, message: '嗨！今天也一起探索星图吧。' },
  { action: 'eat', label: '喂饭', icon: Utensils, message: '开饭啦！吃饱才有力气陪你。' },
  { action: 'sleep', label: '睡觉', icon: Moon, message: '我眯一会儿，点击「叫醒」就好。' },
  { action: 'walk', label: '散步', icon: Footprints, message: '活动一下，换个位置陪你。' },
] as const

function loadPreferences() {
  try {
    const raw = localStorage.getItem(PET_STORAGE_KEY)
    const preferences = readPetPreferences(raw)
    // Move the previous default corner once, while keeping manually chosen positions.
    if (raw && JSON.parse(raw)?.layoutVersion !== 2 && preferences.position?.x === 24) preferences.position = null
    return preferences
  } catch { return { ...PET_DEFAULTS } }
}

function petViewport() {
  const scale = (parseFloat(getComputedStyle(document.documentElement).zoom) || 1) * (parseFloat(getComputedStyle(document.body).zoom) || 1)
  return { width: window.innerWidth / scale, height: window.innerHeight / scale, scale }
}

function clampToViewport(point: Point, size: number): Point {
  const view = petViewport()
  return clampPetPosition(point, view.width, view.height, size)
}

function defaultPosition(size: number): Point {
  // Leave room below the pet for the existing chat launcher.
  const view = petViewport()
  return clampPetPosition({ x: view.width - size - 24, y: view.height - size - 88 }, view.width, view.height, size)
}

export default function XiaoguiPet() {
  const { pathname } = useLocation()
  const desktopCompanion = useDesktopCompanion()
  const [preferences, setPreferences] = useState<PetPreferences>(loadPreferences)
  const [position, setPosition] = useState<Point>(() => clampToViewport(preferences.position || defaultPosition(PET_SIZES[preferences.size]), PET_SIZES[preferences.size]))
  const [action, setAction] = useState<PetAction>('idle')
  const [command, setCommand] = useState<PetCommand>({ action: 'idle', sequence: 0 })
  const [motion, setMotion] = useState<PetMotionAvailability>({ ready: false, error: null })
  const [retry, setRetry] = useState(0)
  const [queued, setQueued] = useState(false)
  const [panelHeight, setPanelHeight] = useState(360)
  const [open, setOpen] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [bubble, setBubble] = useState('')
  const [paused, setPaused] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [pageVisible, setPageVisible] = useState(!document.hidden)
  const drag = useRef<{ pointer: number; x: number; y: number; origin: Point; moved: boolean } | null>(null)
  const bubbleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const root = useRef<HTMLDivElement>(null)
  const size = PET_SIZES[preferences.size]
  const effectiveSize = preferences.collapsed ? 52 : size
  const enabled = !desktopCompanion && !/^\/(print|share|resume-reader)(\/|$)/.test(pathname)
  const animated = !paused && pageVisible

  const speak = useCallback((message: string) => {
    clearTimeout(bubbleTimer.current)
    setBubble(message)
    bubbleTimer.current = setTimeout(() => setBubble(''), 4500)
  }, [])

  const perform = useCallback((next: PetAction, message: string) => {
    if (!motion.ready) return
    const direction = position.x + size / 2 > petViewport().width / 2 ? 'walk-left' : 'walk-right'
    setCommand(current => ({ action: next === 'walk' ? direction : next, sequence: current.sequence + 1 }))
    speak(message)
  }, [motion.ready, position.x, size, speak])

  const motionState = useCallback((state: MotionSnapshot) => {
    setAction(displayPetAction(state.action))
    setQueued(state.queued !== null)
  }, [])
  const travel = useCallback((delta: number) => {
    setPosition(p => clampToViewport({ x: p.x + delta, y: p.y }, size))
  }, [size])

  useEffect(() => () => { clearTimeout(bubbleTimer.current) }, [])

  useEffect(() => {
    if (!enabled || preferences.collapsed) {
      setCommand(current => ({ action: 'idle', sequence: current.sequence + 1 }))
      setAction('idle')
      setQueued(false)
    }
  }, [enabled, preferences.collapsed])

  useEffect(() => {
    try { localStorage.setItem(PET_STORAGE_KEY, JSON.stringify({ ...preferences, position, layoutVersion: 2 })) } catch { /* Companion works without storage. */ }
  }, [preferences, position])

  useEffect(() => {
    const resize = () => setPosition(p => clampToViewport(p, effectiveSize))
    resize()
    window.addEventListener('resize', resize)
    const zoom = new MutationObserver(resize)
    zoom.observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'class', 'data-auth-layout'] })
    return () => { window.removeEventListener('resize', resize); zoom.disconnect() }
  }, [effectiveSize])

  useEffect(() => {
    const visibility = () => setPageVisible(!document.hidden)
    document.addEventListener('visibilitychange', visibility)
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const motion = () => setPaused(media.matches)
    media.addEventListener('change', motion)
    return () => { document.removeEventListener('visibilitychange', visibility); media.removeEventListener('change', motion) }
  }, [])

  useEffect(() => {
    if (!open) return
    const outside = (event: globalThis.PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false) }
    const escape = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); root.current?.querySelector<HTMLButtonElement>('.xiaogui-character')?.focus() } }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape) }
  }, [open])

  useLayoutEffect(() => {
    if (!open) return
    const panel = root.current?.querySelector<HTMLElement>('#xiaogui-panel-content')
    if (!panel) return
    const measure = () => setPanelHeight(panel.getBoundingClientRect().height / petViewport().scale)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(panel)
    return () => observer.disconnect()
  }, [open])

  useEffect(() => {
    if (!motion.ready || !preferences.wander || preferences.collapsed || !animated || dragging || open || action !== 'idle' || queued || !enabled) return
    const timer = setTimeout(() => {
      perform('walk', '我去旁边走两步。')
    }, 26000)
    return () => clearTimeout(timer)
  }, [motion.ready, preferences.wander, preferences.collapsed, animated, dragging, open, action, queued, enabled, perform])

  const pointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { pointer: event.pointerId, x: event.clientX, y: event.clientY, origin: position, moved: false }
  }
  const pointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const start = drag.current
    if (!start || start.pointer !== event.pointerId) return
    const scale = petViewport().scale
    const dx = (event.clientX - start.x) / scale, dy = (event.clientY - start.y) / scale
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 5) start.moved = true
    if (!start.moved) return
    setDragging(true)
    setOpen(false)
    setBubble('')
    setPosition(clampToViewport({ x: start.origin.x + dx, y: start.origin.y + dy }, effectiveSize))
  }
  const pointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    if (drag.current?.pointer !== event.pointerId) return
    // Keep the drag flag until the synthetic click has been handled.
    setDragging(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }
  const toggle = () => {
    if (drag.current?.moved) { drag.current = null; return }
    drag.current = null
    if (preferences.collapsed) { setPreferences(p => ({ ...p, collapsed: false })); speak('小星回来啦！'); return }
    setOpen(v => !v)
  }
  const keyboardMove = (event: KeyboardEvent<HTMLButtonElement>) => {
    const offsets: Record<string, Point> = { ArrowLeft: { x: -20, y: 0 }, ArrowRight: { x: 20, y: 0 }, ArrowUp: { x: 0, y: -20 }, ArrowDown: { x: 0, y: 20 } }
    const delta = offsets[event.key]
    if (!delta) return
    event.preventDefault()
    setPosition(p => clampToViewport({ x: p.x + delta.x, y: p.y + delta.y }, effectiveSize))
  }
  const doAction = (next: PetAction, message: string) => {
    perform(next, message)
    setOpen(false)
  }

  if (!enabled) return null
  const view = petViewport()
  const panelWidth = Math.min(286, view.width - 24)
  const panelLeft = Math.max(12, Math.min(position.x + effectiveSize / 2 - panelWidth / 2, view.width - panelWidth - 12)) - position.x
  const actualPanelHeight = Math.min(panelHeight, view.height - 24)
  const fitTop = (top: number) => Math.max(12, Math.min(top, view.height - actualPanelHeight - 12))
  let panelX = position.x + panelLeft, panelTop = fitTop(position.y - actualPanelHeight - 12)
  if (position.x - panelWidth - 12 >= 12) {
    panelX = position.x - panelWidth - 12
    panelTop = fitTop(position.y + effectiveSize - actualPanelHeight)
  } else if (position.x + effectiveSize + panelWidth + 24 <= view.width) {
    panelX = position.x + effectiveSize + 12
    panelTop = fitTop(position.y + effectiveSize - actualPanelHeight)
  } else if (position.y < actualPanelHeight + 24) panelTop = fitTop(position.y + effectiveSize + 12)
  return createPortal(<div ref={root} className={`xiaogui-pet${dragging ? ' is-dragging' : ''}${animated ? '' : ' is-paused'}`} style={{ left: position.x, top: position.y, width: effectiveSize, height: effectiveSize, '--pet-size': `${size}px` } as CSSProperties}>
    <div className="xiaogui-live" role="status" aria-live="polite">{bubble}</div>
    {bubble && !open && !preferences.collapsed && <div className={`xiaogui-bubble ${position.y < 100 ? 'below' : ''}`} aria-hidden="true" style={{ left: panelLeft, width: panelWidth }}>{bubble}</div>}
    {open && !preferences.collapsed && <section id="xiaogui-panel-content" className="xiaogui-panel" aria-label="小星互动面板" style={{ position: 'fixed', left: panelX, top: panelTop, width: panelWidth, maxHeight: view.height - 24 }}>
      <header><span className="xiaogui-avatar"><PetPortrait /></span><div><strong>小星</strong><span>{queued ? '等这个动作做完就来' : PET_LABELS[action]} · 你的星图伙伴</span></div><button aria-label="关闭互动面板" onClick={() => setOpen(false)}><X size={16} /></button></header>
      <div className="xiaogui-actions">
        {ACTIONS.map(item => <button key={item.action} disabled={!motion.ready} onClick={() => doAction(item.action, item.message)} aria-pressed={action === item.action}><item.icon size={19} /><span>{item.label}</span></button>)}
      </div>
      {motion.error && <><p role="status">{motion.error}</p><button className="xiaogui-wake" onClick={() => setRetry(value => value + 1)}>重新加载动作</button></>}
      {action === 'sleep' && <button className="xiaogui-wake" disabled={!motion.ready} onClick={() => doAction('idle', '睡醒啦！继续陪你。')}>叫醒小星</button>}
      <div className="xiaogui-size"><span>显示大小</span><div>{(['small', 'medium', 'large'] as const).map((key, i) => <button key={key} aria-pressed={preferences.size === key} onClick={() => setPreferences(p => ({ ...p, size: key }))}>{['小', '中', '大'][i]}</button>)}</div></div>
      <label className="xiaogui-setting"><span>偶尔自己散步</span><input type="checkbox" checked={preferences.wander} onChange={event => setPreferences(p => ({ ...p, wander: event.target.checked }))} /></label>
      <label className="xiaogui-setting"><span>安静模式 · 暂停动画</span><input type="checkbox" checked={paused} onChange={event => setPaused(event.target.checked)} /></label>
      <footer><button onClick={() => { setPosition(defaultPosition(size)); setOpen(false) }}><RotateCcw size={14} />回到角落</button><button onClick={() => { setPreferences(p => ({ ...p, collapsed: true })); setOpen(false); setBubble('') }}><Minimize2 size={14} />收起</button></footer>
      <p>拖动换位置，也可聚焦后按方向键移动</p>
    </section>}
    <button className={`xiaogui-character${preferences.collapsed ? ' is-collapsed' : ''}`} aria-label={preferences.collapsed ? '展开小星桌宠' : `小星：${PET_LABELS[action]}，点击互动，拖动可移动`} aria-expanded={open} aria-controls={open ? 'xiaogui-panel-content' : undefined} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={() => { drag.current = null; setDragging(false) }} onLostPointerCapture={() => setDragging(false)} onClick={toggle} onKeyDown={keyboardMove}>
      {preferences.collapsed ? <><PetPortrait /><span>小星</span></> : <PetMotionSurface key={retry} command={command} paused={!animated || dragging} onState={motionState} onTravel={travel} onAvailability={setMotion} />}
    </button>
  </div>, document.body)
}
