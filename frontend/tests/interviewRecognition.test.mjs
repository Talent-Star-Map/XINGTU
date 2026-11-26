import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'
const source = await readFile(new URL('../src/lib/interviewRecognition.ts', import.meta.url), 'utf8')
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText
const { InterviewRecognition } = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))
let rec, usedTrack, errors = []
class Recognition {
  start(track) { rec = this; usedTrack = track }
  abort() { this.onend?.() }
  stop() { this.onend?.() }
}
globalThis.window = { SpeechRecognition: Recognition }
const asr = new InterviewRecognition(text => errors.push(text))
const track = { kind: 'audio', readyState: 'live' }
asr.setTrack(track); asr.setEnabled(true)
assert.equal(usedTrack, track)
let partial = [{ transcript: '杂音临时结果' }]; partial.isFinal = false
rec.onresult({ resultIndex: 0, results: [partial] })
let final = [{ transcript: '我用日志定位问题' }]; final.isFinal = true
rec.onresult({ resultIndex: 0, results: [final] })
assert.equal(await asr.takeFinal(), '我用日志定位问题')
asr.setEnabled(true)
const stale = rec
asr.setEnabled(false)
stale.onresult({ resultIndex: 0, results: [final] })
assert.equal(await asr.takeFinal(), '', 'pause drops stale recognition')
window.SpeechRecognition = class extends Recognition { start(track) { if (track) throw new TypeError('unsupported track'); super.start() } }
asr.setEnabled(true)
assert.equal(usedTrack, undefined, 'older browser falls back to microphone')
rec.onerror({ error: 'not-allowed' })
assert.match(errors[0], /权限/)
asr.dispose()
console.log('PASS: browser ASR, processed track, interim filtering, pause, fallback, errors')
