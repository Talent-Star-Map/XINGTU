import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const source = await readFile(new URL('../src/lib/authFetch.ts', import.meta.url), 'utf8')
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
})
const { createAuthenticatedFetch } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)

const origin = 'https://xingtu.example'
const requests = []
let token = 'test-session'
let status = 200
let unauthorized = 0
globalThis.window = { dispatchEvent: () => { unauthorized++ } }
const authenticatedFetch = createAuthenticatedFetch(async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : input, origin)
  requests.push({ url, headers: new Headers(init?.headers) })
  return new Response(null, { status })
}, origin, () => token)

await authenticatedFetch('/api/jobseeker/unread-total')
assert.equal(requests.at(-1).url.search, '')
assert.equal(requests.at(-1).headers.get('Authorization'), 'Bearer test-session')

const request = new Request(`${origin}/api/resume-center/1/export?format=pdf`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
})
await authenticatedFetch(request)
assert.equal(requests.at(-1).url.search, '?format=pdf')
assert.equal(requests.at(-1).headers.get('Content-Type'), 'application/json')
assert.equal(requests.at(-1).headers.get('Authorization'), 'Bearer test-session')

await authenticatedFetch('https://other.example/api/user')
assert.equal(requests.at(-1).headers.has('Authorization'), false)
await authenticatedFetch('/api/auth/login', { method: 'POST' })
assert.equal(requests.at(-1).headers.has('Authorization'), false)

status = 401
await authenticatedFetch('/api/auth/profile', { headers: { Authorization: 'Bearer old-session' } })
assert.equal(requests.at(-1).headers.get('Authorization'), 'Bearer old-session')
assert.equal(unauthorized, 0)
await authenticatedFetch('/api/auth/profile')
assert.equal(unauthorized, 1)

token = ''
await authenticatedFetch('/api/auth/profile')
assert.equal(requests.at(-1).headers.has('Authorization'), false)
console.log('PASS: URL without JWT, Bearer header, same-origin scope and unauthorized handling')
