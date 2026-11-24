import { useEffect, useRef, useState } from 'react'
import { petAsset, type PetAction } from '../../lib/companion'
import { PetMotionMachine, clipTravel, type MotionAction, type MotionPack, type MotionSnapshot } from '../../lib/companionMotion'
import { PetVideoDeck } from '../../lib/companionVideo'

export type PetCommand = { action: MotionAction; sequence: number }
export type PetMotionAvailability = { ready: boolean; error: string | null }
export type PetMotionProps = {
  command: PetCommand
  paused?: boolean
  onState?: (state: MotionSnapshot) => void
  onTravel?: (delta: number) => void
  onAvailability?: (availability: PetMotionAvailability) => void
}

export function displayPetAction(action: MotionAction): PetAction {
  return action === 'walk-left' || action === 'walk-right' ? 'walk' : action
}

/** The normal web entry consumes the same approved motion pack as the desktop. */
export default function PetMotionSurface(props: PetMotionProps) {
  const container = useRef<HTMLSpanElement>(null)
  const machine = useRef<PetMotionMachine | null>(null)
  const latest = useRef(props)
  latest.current = props
  const [portrait, setPortrait] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    let deck: PetVideoDeck | null = null
    let current: PetMotionMachine | null = null
    let travelToken = 0, lastTravel = 0
    let disposed = false
    const pause = () => current?.setPaused(!!latest.current.paused || document.hidden)
    latest.current.onAvailability?.({ ready: false, error: null })
    const start = async () => {
      const base = new URL('/mascot/xiaoxing/', location.href)
      const response = await fetch(new URL('motion.json', base), { signal: controller.signal })
      if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error('连续动作素材尚未就绪。')
      let pack: { id: string; approved: boolean; motion: MotionPack }
      try { pack = await response.json() }
      catch { throw new Error('动作素材暂时无法读取，请稍后重试。') }
      if (disposed) return
      if (!pack || pack.id !== 'xiaoxing' || pack.approved !== true) throw new Error('小星动作仍在验收中。')
      current = new PetMotionMachine(pack.motion, event => {
        if (event.type === 'play') {
          travelToken = event.token; lastTravel = 0
          void deck!.play(event.clip, event.token)
        } else if (event.type === 'finish-loop') deck!.finishLoop(event.token)
        else if (event.type === 'pause') deck!.setPaused(event.paused)
        else if (event.type === 'state') latest.current.onState?.(event.state)
        else if (event.type === 'dispose') deck!.dispose()
      })
      deck = new PetVideoDeck(container.current!, base, {
        ready: token => {
          if (disposed) return
          setPortrait(false)
          latest.current.onAvailability?.({ ready: true, error: null })
          current!.ready(token)
        },
        ended: token => current!.ended(token),
        failed: (token, message) => {
          current!.failed(token, message)
          latest.current.onAvailability?.({ ready: false, error: message })
        },
        frame: (token, clip, time) => {
          if (token !== travelToken || latest.current.paused || document.hidden) return
          // Keep the clock normalized so a size change cannot teleport the pet.
          const next = clipTravel(clip, time, 1)
          const delta = (next - lastTravel) * container.current!.clientHeight
          lastTravel = next
          if (delta) latest.current.onTravel?.(delta)
        },
      }, 1, 'progressive')
      machine.current = current
      pause()
      current.start()
      if (latest.current.command.action !== 'idle') current.request(latest.current.command.action)
    }
    void start().catch(error => {
      if (!disposed) latest.current.onAvailability?.({ ready: false, error: error instanceof Error ? error.message : '连续动作加载失败。' })
    })
    document.addEventListener('visibilitychange', pause)
    return () => {
      disposed = true
      controller.abort()
      document.removeEventListener('visibilitychange', pause)
      current?.dispose()
      deck?.dispose()
      machine.current = null
    }
  }, [])

  useEffect(() => { machine.current?.request(props.command.action) }, [props.command.action, props.command.sequence])
  useEffect(() => { machine.current?.setPaused(!!props.paused || document.hidden) }, [props.paused])

  return <span ref={container} className="xiaogui-sprite">
    {portrait && <img src={petAsset('idle')} alt="" draggable={false} />}
  </span>
}
