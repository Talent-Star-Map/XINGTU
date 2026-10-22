import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const source = await readFile(new URL('../src/lib/authFetch.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText
const { createAuthenticatedFetch } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
const origin = 'http://localhost:3000'
const calls = []
const sender = async (input, init) => {
  calls.push(new Request(input instanceof Request ? input : new URL(input, origin), init))
  return new Response('{}', { headers: { 'Content-Type': 'application/json' } })
}
let token = 'first-fixture'
const fetchWithIdentity = createAuthenticatedFetch(sender, origin, () => token)
await fetchWithIdentity('/api/jobs/stats')
assert.equal(calls.at(-1).headers.get('Authorization'), 'Bearer first-fixture')
token = 'second-fixture'
await fetchWithIdentity('/api/kg/catalog')
assert.equal(calls.at(-1).headers.get('Authorization'), 'Bearer second-fixture')
for (const path of ['/api/auth/login', '/api/auth/admin/login', '/api/auth/register', '/api/auth/send-code',
  '/api/health', '/api/resume-center/share/' + 'a'.repeat(16), '/api/resume-center/print/' + 'a'.repeat(43),
  '/api/jobs/stats?token=query-fixture', '/assets/icon.svg', 'https://external.example/api/jobs/stats']) {
  await fetchWithIdentity(path, path.startsWith('/api/auth/') ? { method: 'POST' } : undefined)
  assert.equal(calls.at(-1).headers.get('Authorization'), null, path)
}
await fetchWithIdentity('/api/jobs/stats', { headers: { Authorization: 'Bearer explicit-fixture' } })
assert.equal(calls.at(-1).headers.get('Authorization'), 'Bearer explicit-fixture')
await fetchWithIdentity('/api/resume-center/share/1', { method: 'POST' })
assert.equal(calls.at(-1).headers.get('Authorization'), 'Bearer second-fixture')
await fetchWithIdentity('/api/resume-center/share/1', { method: 'DELETE' })
assert.equal(calls.at(-1).headers.get('Authorization'), 'Bearer second-fixture')
const request = new Request(origin + '/api/match/analyze', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ job_id: 1 }),
})
await fetchWithIdentity(request)
assert.equal(calls.at(-1).method, 'POST')
assert.equal(calls.at(-1).headers.get('Authorization'), 'Bearer second-fixture')
assert.deepEqual(await calls.at(-1).json(), { job_id: 1 })
token = ''
await fetchWithIdentity('/api/jobs/stats')
assert.equal(calls.at(-1).headers.get('Authorization'), null)
console.log('PASS: same-origin identity, fresh token, public/capability exclusions, external isolation, query/header compatibility and Request bodies')
