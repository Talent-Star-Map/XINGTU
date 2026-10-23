import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import ts from 'typescript'

const source = readFileSync(new URL('../src/components/kg/api.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
const { streamChat } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
globalThis.localStorage = { getItem: () => 'offline' }
function response(text) {
  const bytes = new TextEncoder().encode(text)
  return new Response(new ReadableStream({ start(controller) {
    for (let i = 0; i < bytes.length; i += 5) controller.enqueue(bytes.slice(i, i + 5))
    controller.close()
  } }))
}
test('split UTF8 and CRLF frames preserve Chinese, history and selected job', async () => {
  let body
  globalThis.fetch = async (_, init) => { body = JSON.parse(init.body); return response('data:{"event":"report_token","token":"你好"}\r\n\r\ndata: {"event":"report_done","answer":"你好","references":[]}\r\n\r\ndata: [DONE]\r\n\r\n') }
  const events = []
  await streamChat('继续', event => events.push(event), [{ role: 'user', content: 'Python' }], 12)
  assert.equal(events[0].token, '你好')
  assert.equal(body.job_id, 12)
  assert.equal(body.history[0].content, 'Python')
})
test('truncated stream is an error even if partial tokens arrived', async () => {
  globalThis.fetch = async () => response('data: {"event":"report_token","token":"部分内容"}\n\n')
  await assert.rejects(streamChat('继续', () => {}), /连接已中断/)
})
test('premature DONE is not reported as success', async () => {
  globalThis.fetch = async () => response('data: [DONE]\n\n')
  await assert.rejects(streamChat('继续', () => {}), /回答未完成/)
})
