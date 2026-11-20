import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import { Hand, Moon, Utensils, Footprints, Minimize2, X, RotateCcw } from 'lucide-react'
import { clampPetPosition, PET_DEFAULTS, PET_LABELS, PET_SIZES, PET_STORAGE_KEY, petAsset, readPetPreferences, type PetAction, type PetPreferences, type Point } from '../../lib/companion'
import './xiaogui.css'

export function PetSprite({ action, animated = true }: { action: PetAction; animated?: boolean }) {
  const [failed, setFailed] = useState(false)
  if (failed) return <span className="xiaogui-fallback" role="img" aria-label="星图">✦</span>
  return <span className={`xiaogui-sprite xiaogui-sprite--${action}${animated ? ' is-animated' : ''}`}>
    <img src={petAsset(action)} alt="" draggable={false} onError={() => setFailed(true)} />
    {action === 'eat' && animated && <img className="xiaogui-chew" src={petAsset('eat', true)} alt="" draggable={false} onError={() => setFailed(true)} />}
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

function defaultPosition(size: number): Point {
  // Leave room below the pet for the existing chat launcher.
  return clampPetPosition({ x: window.innerWidth - size - 24, y: window.innerHeight - size - 88 }, window.innerWidth, window.innerHeight, size)
}

export default function XiaoguiPet() {
  const { pathname } = useLocation()
  const [preferences, setPreferences] = useState<PetPreferences>(loadPreferences)
  const [position, setPosition] = useState<Point>(() => clampPetPosition(preferences.position || defaultPosition(PET_SIZES[preferences.size]), window.innerWidth, window.innerHeight, PET_SIZES[preferences.size]))
  const [action, setAction] = useState<PetAction>('idle')
  const [open, setOpen] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [bubble, setBubble] = useState('')
  const [paused, setPaused] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [pageVisible, setPageVisible] = useState(!document.hidden)
  const drag = useRef<{ pointer: number; x: number; y: number; origin: Point; moved: boolean } | null>(null)
  const actionTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const bubbleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const root = useRef<HTMLDivElement>(null)
  const size = PET_SIZES[preferences.size]
  const effectiveSize = preferences.collapsed ? 52 : size
  const enabled = !/^\/(print|share|resume-reader)(\/|$)/.test(pathname)
  const animated = !paused && pageVisible

  const speak = useCallback((message: string) => {
    clearTimeout(bubbleTimer.current)
    setBubble(message)
    bubbleTimer.current = setTimeout(() => setBubble(''), 4500)
  }, [])

  const perform = useCallback((next: PetAction, message: string) => {
    clearTimeout(actionTimer.current)
    setAction(next)
    speak(message)
    if (next !== 'sleep' && next !== 'idle') actionTimer.current = setTimeout(() => setAction('idle'), next === 'eat' ? 14000 : next === 'walk' ? 3200 : 3500)
  }, [speak])

  useEffect(() => () => { clearTimeout(actionTimer.current); clearTimeout(bubbleTimer.current) }, [])

  useEffect(() => {
    try { localStorage.setItem(PET_STORAGE_KEY, JSON.stringify({ ...preferences, position, layoutVersion: 2 })) } catch { /* Companion works without storage. */ }
  }, [preferences, position])

  useEffect(() => {
    const resize = () => setPosition(p => clampPetPosition(p, window.innerWidth, window.innerHeight, effectiveSize))
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
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

  useEffect(() => {
    if (!preferences.wander || preferences.collapsed || !animated || dragging || open || action !== 'idle' || !enabled) return
    const timer = setTimeout(() => {
      perform('walk', '我去旁边走两步。')
      setPosition(p => clampPetPosition({ x: p.x + (p.x > window.innerWidth / 2 ? -110 : 110), y: p.y }, window.innerWidth, window.innerHeight, size))
    }, 26000)
    return () => clearTimeout(timer)
  }, [preferences.wander, preferences.collapsed, animated, dragging, open, action, size, enabled, perform])

  const pointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { pointer: event.pointerId, x: event.clientX, y: event.clientY, origin: position, moved: false }
  }
  const pointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const start = drag.current
    if (!start || start.pointer !== event.pointerId) return
    const dx = event.clientX - start.x, dy = event.clientY - start.y
    if (Math.hypot(dx, dy) > 5) start.moved = true
    if (!start.moved) return
    setDragging(true)
    setOpen(false)
    setBubble('')
    setPosition(clampPetPosition({ x: start.origin.x + dx, y: start.origin.y + dy }, window.innerWidth, window.innerHeight, effectiveSize))
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
    if (preferences.collapsed) { setPreferences(p => ({ ...p, collapsed: false })); speak('星图回来啦！'); return }
    setOpen(v => !v)
  }
  const keyboardMove = (event: KeyboardEvent<HTMLButtonElement>) => {
    const offsets: Record<string, Point> = { ArrowLeft: { x: -20, y: 0 }, ArrowRight: { x: 20, y: 0 }, ArrowUp: { x: 0, y: -20 }, ArrowDown: { x: 0, y: 20 } }
    const delta = offsets[event.key]
    if (!delta) return
    event.preventDefault()
    setPosition(p => clampPetPosition({ x: p.x + delta.x, y: p.y + delta.y }, window.innerWidth, window.innerHeight, effectiveSize))
  }
  const doAction = (next: PetAction, message: string) => {
    perform(next, message)
    setOpen(false)
    if (next === 'walk' && animated) setPosition(p => clampPetPosition({ x: p.x + (p.x > window.innerWidth / 2 ? -100 : 100), y: p.y }, window.innerWidth, window.innerHeight, size))
  }

  if (!enabled) return null
  const panelWidth = Math.min(286, window.innerWidth - 24)
  const panelLeft = Math.max(12, Math.min(position.x + effectiveSize / 2 - panelWidth / 2, window.innerWidth - panelWidth - 12)) - position.x
  const panelTop = Math.max(12, Math.min(position.y > 360 ? position.y - 360 : position.y + effectiveSize + 10, window.innerHeight - 360))
  return createPortal(<div ref={root} className={`xiaogui-pet${dragging ? ' is-dragging' : ''}${animated ? '' : ' is-paused'}`} style={{ left: position.x, top: position.y, width: effectiveSize, height: effectiveSize, '--pet-size': `${size}px` } as CSSProperties}>
    <div className="xiaogui-live" role="status" aria-live="polite">{bubble}</div>
    {bubble && !open && !preferences.collapsed && <div className={`xiaogui-bubble ${position.y < 100 ? 'below' : ''}`} aria-hidden="true" style={{ left: panelLeft, width: panelWidth }}>{bubble}</div>}
    {open && !preferences.collapsed && <section id="xiaogui-panel-content" className="xiaogui-panel" aria-label="星图互动面板" style={{ position: 'fixed', left: position.x + panelLeft, top: panelTop, width: panelWidth }}>
      <header><span className="xiaogui-avatar"><PetPortrait /></span><div><strong>星图</strong><span>{PET_LABELS[action]} · 你的星图伙伴</span></div><button aria-label="关闭互动面板" onClick={() => setOpen(false)}><X size={16} /></button></header>
      <div className="xiaogui-actions">
        {ACTIONS.map(item => <button key={item.action} onClick={() => doAction(item.action, item.message)} aria-pressed={action === item.action}><item.icon size={19} /><span>{item.label}</span></button>)}
      </div>
      {action === 'sleep' && <button className="xiaogui-wake" onClick={() => doAction('wave', '睡醒啦！继续陪你。')}>叫醒星图</button>}
      <div className="xiaogui-size"><span>显示大小</span><div>{(['small', 'medium', 'large'] as const).map((key, i) => <button key={key} aria-pressed={preferences.size === key} onClick={() => setPreferences(p => ({ ...p, size: key }))}>{['小', '中', '大'][i]}</button>)}</div></div>
      <label className="xiaogui-setting"><span>偶尔自己散步</span><input type="checkbox" checked={preferences.wander} onChange={event => setPreferences(p => ({ ...p, wander: event.target.checked }))} /></label>
      <label className="xiaogui-setting"><span>安静模式 · 暂停动画</span><input type="checkbox" checked={paused} onChange={event => setPaused(event.target.checked)} /></label>
      <footer><button onClick={() => { setPosition(defaultPosition(size)); setOpen(false) }}><RotateCcw size={14} />回到角落</button><button onClick={() => { setPreferences(p => ({ ...p, collapsed: true })); setOpen(false); setBubble('') }}><Minimize2 size={14} />收起</button></footer>
      <p>拖动换位置，也可聚焦后按方向键移动</p>
    </section>}
    <button className={`xiaogui-character${preferences.collapsed ? ' is-collapsed' : ''}`} aria-label={preferences.collapsed ? '展开星图桌宠' : `星图：${PET_LABELS[action]}，点击互动，拖动可移动`} aria-expanded={open} aria-controls={open ? 'xiaogui-panel-content' : undefined} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={() => { drag.current = null; setDragging(false) }} onLostPointerCapture={() => setDragging(false)} onClick={toggle} onKeyDown={keyboardMove}>
      {preferences.collapsed ? <><PetPortrait /><span>星图</span></> : <PetSprite action={action} animated={animated && !dragging} />}
    </button>
  </div>, document.body)
}
