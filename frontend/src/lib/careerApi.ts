export type CareerEvent = { event: string; [key: string]: any }
export type CareerThread = { id: string; title: string; metadata?: Record<string, any> }
const initialization = new Map<string, Promise<CareerThread[]>>()
const token = () => localStorage.getItem('xingtu_token') || ''
export async function careerApi(path: string, method = 'GET', body?: unknown) {
  const response = await fetch('/api/career-assistant' + path, {
    method, headers: { Authorization: `Bearer ${token()}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  const data = await response.json()
  if (!response.ok || !data.success) throw new Error(data.detail || data.message || '小星服务暂不可用')
  return data.data
}
export async function careerTurn(thread: string, body: unknown, onEvent: (e: CareerEvent) => void, signal: AbortSignal) {
  const response = await fetch(`/api/career-assistant/threads/${thread}/turn`, {
    method: 'POST', signal, headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  if (!response.ok || !response.body) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.detail || '小星暂时无法处理消息')
  }
  const reader = response.body.getReader(), decoder = new TextDecoder()
  let buffer = ''
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let boundary: number
      while ((boundary = buffer.indexOf('\n\n')) >= 0) {
        const frame = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 2)
        for (const line of frame.split('\n')) {
          if (line.startsWith('data: ') && line.slice(6) !== '[DONE]') onEvent(JSON.parse(line.slice(6)))
        }
      }
    }
  } finally { reader.releaseLock() }
}
export function careerThreadKey() {
  // Key is only a UI selection hint. Ownership is always checked by the API.
  try {
    const user=JSON.parse(localStorage.getItem('xingtu_user') || '{}')
    return `xingtu_career_thread:${user.role || 'jobseeker'}:${user.id || user.user_id || 'current'}`
  } catch {return 'xingtu_career_thread:current'}
}
export function initializeCareer() {
  const actor=token()
  if (!initialization.has(actor)) {
    const promise=(async()=>{
      let rows=await careerApi('/threads') as CareerThread[]
      if (!rows.length && token()===actor) rows=[await careerApi('/threads','POST')]
      return rows
    })().finally(()=>initialization.delete(actor))
    initialization.set(actor,promise)
  }
  return initialization.get(actor)!
}
