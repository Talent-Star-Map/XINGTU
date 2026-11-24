import assert from 'node:assert/strict'
import { PetMotionMachine, validateMotionPack, clipTravel } from '../src/lib/companionMotion.ts'

const clip = (id, from = 'standing', to = 'standing', loop = false) => ({ src: `/test/${id}.webm`, from, to, loop })
function makePack() {
  return {
    clips: {
      idle: clip('idle', 'standing', 'standing', true), wave: clip('wave'), eat: clip('eat'),
      left: { ...clip('left'), travel: { direction: -1, start: 2, end: 6, frameHeights: 1 } },
      right: clip('right'), down: clip('down', 'standing', 'sleeping'),
      sleeping: clip('sleeping', 'sleeping', 'sleeping', true), up: clip('up', 'sleeping', 'standing'),
    },
    actions: { idle: ['idle'], wave: ['wave'], eat: ['eat'], sleep: ['down', 'sleeping'], 'walk-left': ['left'], 'walk-right': ['right'] },
    bridges: ['up'],
  }
}
function setup() {
  const events = []
  const machine = new PetMotionMachine(makePack(), event => events.push(event))
  machine.start()
  return { machine, events, lastPlay: () => events.filter(e => e.type === 'play').at(-1) }
}
function finish(machine) { machine.ended(machine.snapshot().token) }

// Neutral idle responds without waiting for a long idle movie; body actions retain bridges.
{
  const pack = makePack(); pack.clips.idle.interruptible = true
  const events = []; const m = new PetMotionMachine(pack, e => events.push(e))
  m.start(); const old = m.snapshot().token; m.request('eat')
  assert.equal(m.snapshot().clip, 'eat')
  m.ended(old); assert.equal(m.snapshot().clip, 'eat')
  m.request('wave'); assert.equal(m.snapshot().clip, 'eat')
  finish(m); assert.equal(m.snapshot().clip, 'wave')
}
{
  const pack = makePack(); pack.clips.idle.interruptible = true
  const m = new PetMotionMachine(pack, () => {})
  m.start(); m.setPaused(true); m.request('eat')
  assert.equal(m.snapshot().clip, 'idle')
  m.setPaused(false); assert.equal(m.snapshot().clip, 'eat')
}
{
  const pack = makePack(); pack.clips.look = clip('look')
  pack.idleVariants = [{ clip: 'look', minLoops: 3, maxLoops: 3 }]
  const events = []; const m = new PetMotionMachine(pack, e => events.push(e), () => 0)
  m.start()
  assert.equal(events.filter(e => e.type === 'play').at(-1).clip.loop, false, 'base video must end to schedule incidental actions')
  assert.equal(pack.clips.idle.loop, true, 'do not mutate the manifest')
  finish(m); finish(m); assert.equal(m.snapshot().clip, 'idle')
  finish(m); assert.equal(m.snapshot().clip, 'look')
  finish(m); assert.equal(m.snapshot().clip, 'idle')
  const invalid = structuredClone(pack); invalid.actions.idle = ['wave', 'idle']
  assert.throws(() => validateMotionPack(invalid), /单一循环段/)
  pack.clips.look.travel = { direction: 1, start: 0, end: 1, frameHeights: 1 }
  assert.throws(() => validateMotionPack(pack), /待机插曲/)
}

// Occasional gestures cannot bunch up; routine blinks remain available in quiet gaps.
{
  const pack = makePack(); pack.clips.idle.interruptible = true
  pack.clips.blink = clip('blink'); pack.clips.look = clip('look'); pack.clips.stretch = clip('stretch')
  pack.idleVariants = [
    { clip: 'blink', minLoops: 2, maxLoops: 2, routine: true },
    { clip: 'look', minLoops: 3, maxLoops: 3 },
    { clip: 'stretch', minLoops: 3, maxLoops: 3 },
  ]
  pack.idleGestureGapLoops = 4
  let quiet = 0; const plays = []
  const m = new PetMotionMachine(pack, e => { if (e.type === 'play') plays.push({ id: e.id, quiet }) }, () => 0)
  m.start()
  for (let i = 0; i < 32; i++) {
    if (m.snapshot().clip === 'idle') quiet++
    finish(m)
  }
  const gestures = plays.filter(e => e.id === 'look' || e.id === 'stretch')
  assert.ok(gestures.length >= 2)
  assert.ok(gestures[0].quiet >= 4)
  for (let i = 1; i < gestures.length; i++) assert.ok(gestures[i].quiet - gestures[i - 1].quiet >= 4)
  assert.ok(plays.some(e => e.id === 'blink' && e.quiet < 4), 'routine blink is not blocked by a gesture cooldown')
  while (m.snapshot().clip !== 'idle') finish(m)
  m.request('wave'); finish(m)
  assert.equal(m.snapshot().clip, 'idle', 'a user action starts a fresh quiet period')
  finish(m); assert.equal(m.snapshot().clip, 'idle')
  const invalid = structuredClone(pack); invalid.idleGestureGapLoops = -1
  assert.throws(() => validateMotionPack(invalid), /安静间隔/)
}

// Startup must actually request a decoded idle clip, not leave a stopped machine.
{
  const { machine, lastPlay } = setup()
  assert.equal(lastPlay()?.id, 'idle')
  assert.equal(machine.snapshot().phase, 'loading')
  machine.ready(lastPlay().token)
  assert.equal(machine.snapshot().phase, 'playing')
}

// A click ends an idle cycle before a complete body action starts.
{
  const { machine, events, lastPlay } = setup()
  machine.request('wave')
  assert.equal(lastPlay().id, 'idle')
  assert.equal(events.at(-2).type, 'finish-loop')
  finish(machine)
  assert.equal(lastPlay().id, 'wave')
  machine.request('eat')
  machine.request('sleep')
  assert.equal(lastPlay().id, 'wave', 'do not hard-cut an unfinished wave')
  finish(machine)
  assert.equal(lastPlay().id, 'down', 'the latest pending command wins')
  finish(machine)
  assert.equal(lastPlay().id, 'sleeping')
}

// Feeding a sleeping pet must play wake-up before introducing the bowl.
{
  const { machine, lastPlay } = setup()
  machine.request('sleep'); finish(machine); finish(machine)
  assert.equal(lastPlay().id, 'sleeping')
  machine.request('sleep')
  assert.equal(machine.snapshot().queued, null, 'repeat sleep should not wake and sit again')
  finish(machine)
  assert.equal(lastPlay().id, 'sleeping', 'an unexpected EOF cannot wake the pet')
  machine.request('eat'); finish(machine)
  assert.equal(lastPlay().id, 'up')
  finish(machine)
  assert.equal(lastPlay().id, 'eat')
  finish(machine)
  assert.equal(lastPlay().id, 'idle')
}

// Waking alone returns through the real rise clip without an extra greeting.
{
  const { machine, events, lastPlay } = setup()
  machine.request('sleep'); finish(machine); finish(machine)
  machine.request('idle'); finish(machine)
  assert.equal(lastPlay().id, 'up')
  finish(machine)
  assert.equal(lastPlay().id, 'idle')
  assert.equal(machine.snapshot().action, 'idle')
  assert.equal(events.some(event => event.type === 'play' && event.id === 'wave'), false)
}

// Pause is independent of loading and must not discard queued work or pose.
{
  const { machine, events, lastPlay } = setup()
  machine.setPaused(true)
  machine.request('wave')
  assert.equal(machine.snapshot().paused, true)
  machine.ready(lastPlay().token)
  assert.equal(machine.snapshot().paused, true)
  machine.setPaused(false)
  assert.deepEqual(events.filter(e => e.type === 'pause').map(e => e.paused), [true, false])
  finish(machine)
  assert.equal(lastPlay().id, 'wave')
}

// Late events from hidden video slots cannot end the current action.
{
  const { machine, lastPlay } = setup()
  const old = lastPlay().token
  machine.request('wave'); finish(machine)
  const current = machine.snapshot()
  machine.ended(old); machine.ready(old); machine.failed(old, 'stale decoder')
  assert.deepEqual(machine.snapshot(), current)
}

// A resource failure must not falsely report completion or silently jump to idle.
{
  const { machine, lastPlay } = setup()
  machine.request('wave'); finish(machine)
  const token = lastPlay().token
  machine.failed(token, 'missing clip')
  assert.equal(machine.snapshot().phase, 'error')
  machine.ended(token)
  assert.equal(lastPlay().id, 'wave')
  machine.request('eat')
  assert.equal(lastPlay().id, 'wave')
  machine.restart()
  assert.equal(lastPlay().id, 'idle')
}

// Teardown prevents in-flight decoder callbacks or UI commands from resurrecting a pet.
{
  const { machine, events, lastPlay } = setup()
  const token = lastPlay().token
  machine.dispose()
  const length = events.length
  machine.request('wave'); machine.ready(token); machine.ended(token); machine.restart()
  assert.equal(events.length, length)
}

// Malformed action packs fail before presentation.
{
  const pack = makePack(); pack.actions.eat = ['sleeping']
  assert.throws(() => validateMotionPack(pack), /姿态不连续/)
  const missingWake = makePack(); missingWake.bridges = []
  assert.throws(() => validateMotionPack(missingWake), /缺少从 sleeping/)
  const blocked = makePack(); blocked.actions.wave = ['idle', 'wave']
  assert.throws(() => validateMotionPack(blocked), /循环段挡住/)
}

// Native/Web displacement stays still through turning and stops after the last step.
{
  const { left } = makePack().clips
  assert.equal(Math.abs(clipTravel(left, 0, 200)), 0)
  assert.equal(Math.abs(clipTravel(left, 2, 200)), 0)
  assert.equal(clipTravel(left, 4, 200), -100)
  assert.equal(clipTravel(left, 6, 200), -200)
  assert.equal(clipTravel(left, 99, 200), -200)
  assert.equal(clipTravel(left, Number.NaN, 200), 0)
}
// An interrupted side-facing sequence returns through its real facing bridge.
{
  const pack = makePack()
  pack.clips.turn = clip('turn', 'standing', 'left-facing')
  pack.clips.stride = clip('stride', 'left-facing', 'left-facing')
  pack.clips.face = clip('face', 'left-facing', 'standing')
  pack.actions['walk-left'] = ['turn', 'stride', 'face']
  pack.bridges.push('face')
  const plays = []; const machine = new PetMotionMachine(pack, e => { if (e.type === 'play') plays.push(e.id) })
  machine.start(); machine.request('walk-left'); finish(machine)
  assert.equal(plays.at(-1), 'turn')
  machine.request('eat'); finish(machine)
  assert.equal(plays.at(-1), 'face')
  finish(machine); assert.equal(plays.at(-1), 'eat')
  assert.equal(plays.includes('stride'), false, 'finish the turn before cancelling further walking')
  const missingReturn = structuredClone(pack); missingReturn.bridges = ['up']
  assert.throws(() => validateMotionPack(missingReturn), /缺少从 left-facing/)
}

// Leaving sleep may require sitting and standing before another body action.
{
  const pack = makePack()
  pack.clips.sit = clip('sit', 'standing', 'seated')
  pack.clips.down = clip('down', 'seated', 'sleeping')
  pack.clips.up = clip('up', 'sleeping', 'seated')
  pack.clips.rise = clip('rise', 'seated', 'standing')
  pack.actions.sleep = ['sit', 'down', 'sleeping']; pack.bridges.push('rise')
  const plays = []; const machine = new PetMotionMachine(pack, e => { if (e.type === 'play') plays.push(e.id) })
  machine.start(); machine.request('sleep'); finish(machine); finish(machine); finish(machine)
  assert.equal(plays.at(-1), 'sleeping')
  machine.request('wave'); finish(machine)
  assert.equal(plays.at(-1), 'up')
  finish(machine); assert.equal(plays.at(-1), 'rise')
  finish(machine); assert.equal(plays.at(-1), 'wave')
}

// Decoded time follows measured stop/start curves and scales with rendered frame size.
{
  const pack = makePack()
  pack.clips.left.travel = { keyframes: [{ time: 0, x: 0 }, { time: 1, x: 0 }, { time: 2, x: -.1 }, { time: 3, x: -.3 }, { time: 4, x: -.3 }] }
  validateMotionPack(pack)
  const left = pack.clips.left
  assert.equal(Math.abs(clipTravel(left, .5, 200)), 0)
  assert.equal(clipTravel(left, 1.5, 200), -10)
  assert.equal(clipTravel(left, 2.5, 200), -40)
  assert.equal(clipTravel(left, 99, 200), -60)
  assert.equal(clipTravel(left, 4, 400), -120)
  for (const keyframes of [
    [{ time: 0, x: 0 }, { time: 0, x: -.1 }],
    [{ time: 0, x: .1 }, { time: 1, x: -.1 }],
    [{ time: 0, x: 0 }, { time: 1, x: -.1 }, { time: 2, x: -.05 }],
  ]) {
    const invalid = makePack(); invalid.clips.left.travel = { keyframes }
    assert.throws(() => validateMotionPack(invalid), /位移曲线无效/)
  }
}
console.log('Companion motion behavior passed: command boundaries, pose bridges, pause, stale callbacks, failure, disposal, validation and video-clock travel curves. Visual motion acceptance is separate.')
