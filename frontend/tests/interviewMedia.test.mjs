import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'
const source = await readFile(new URL('../src/lib/interviewVision.ts', import.meta.url), 'utf8')
const js = ts.transpileModule(source.replace(/^import .*$/m, ''), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText
const { PresenceGate } = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))
const gate = new PresenceGate()
assert.equal(gate.next(1, false).allowed, false)
assert.equal(gate.next(1, false).allowed, false)
assert.equal(gate.next(1, false).allowed, true)
assert.equal(gate.next(0, false).allowed, true, 'one dropped frame does not pause')
assert.equal(gate.next(0, false).allowed, false, 'sustained missing face pauses')
gate.next(1, false); gate.next(1, false)
assert.equal(gate.next(1, false).allowed, true)
gate.next(1, true)
assert.match(gate.next(1, true).message, /手机/)
assert.equal(gate.next(1, true).allowed, false)
gate.next(1, false); gate.next(1, false); gate.next(1, false)
gate.next(2, false)
assert.equal(gate.next(2, false).allowed, false)
gate.reset()
assert.equal(gate.next(1, false).allowed, false, 'stale frame invalidates previous approval')
console.log('PASS: missing face, phone, multiple faces, debounce and recovery')
