import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'
const source = await readFile(new URL('../src/lib/interviewVoice.ts', import.meta.url), 'utf8')
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText
const { InterviewVoice } = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))
globalThis.localStorage = { getItem: () => 'offline-test' }
const starts = []
let releases = []
class Context {
  state = 'running'; destination = {}; resume() { return Promise.resolve() }; close() { return Promise.resolve() }
  decodeAudioData(value) { return Promise.resolve(new Uint8Array(value)[0]) }
  createBufferSource() {
    const result = { buffer: null, onended: null, connect() {}, disconnect() {},
      start() { starts.push(result.buffer); releases.push(() => result.onended?.()) }, stop() { result.onended?.() } }
    return result
  }
}
globalThis.AudioContext = Context
let requests = 0
const errors = []
globalThis.fetch = async (_url, options) => { requests++; return { ok: true, arrayBuffer: async () => new Uint8Array([JSON.parse(options.body).text === '第一句' ? 1 : 2]).buffer } }
const tick = () => new Promise(resolve => setTimeout(resolve, 0))
const voice = new InterviewVoice(() => {}, message => errors.push(message), () => {})
voice.begin(); voice.enqueue('第一句'); voice.enqueue('第二句')
await tick(); await tick()
assert.equal(requests, 2, 'next sentence must synthesize while first is playing')
assert.deepEqual(starts, [1], 'playback must remain sequential')
releases.shift()(); await tick()
assert.deepEqual(starts, [1, 2])
releases.shift()(); await voice.finish()
assert.equal(errors.length, 0)
voice.begin(); voice.enqueue('第一句'); voice.enqueue('第二句')
await tick(); voice.stop(); await tick()
assert.deepEqual(starts, [1, 2, 1], 'interrupt must discard queued second sentence')
let deferred
globalThis.fetch = (_url, options) => new Promise((resolve, reject) => {
  deferred = resolve
  options.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
})
voice.begin(); voice.enqueue('第一句'); await tick(); voice.stop(); await tick()
assert.equal(errors.length, 0, 'cancellation is not a synthesis error')
assert.deepEqual(starts, [1, 2, 1])
voice.dispose()
console.log('PASS: sentence prefetch, ordered playback, interruption and in-flight cancellation')
