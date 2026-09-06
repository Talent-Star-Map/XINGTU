/**
 * api.ts — 知识图谱 API 客户端(求职者端)
 * 封装 /api/kg/* 和 /api/kg/chat/* 的调用。
 */

const TOKEN = () => localStorage.getItem('xingtu_token') || ''

async function getJson<T = any>(url: string): Promise<T> {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN()}` } })
  if (!r.ok) throw new Error(`${url} → ${r.status}`)
  const j = await r.json()
  if (!j.success) throw new Error(j.message || 'API error')
  return j.data
}

async function postJson<T = any>(url: string, body: any): Promise<T> {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN()}` },
    body: JSON.stringify(body),
  })
  if (!r.ok) throw new Error(`${url} → ${r.status}`)
  const j = await r.json()
  if (!j.success) throw new Error(j.message || 'API error')
  return j.data
}

const withToken = (path: string) => `${path}${path.includes('?') ? '&' : '?'}token=${TOKEN()}`

export const kgApi = {
  overview: () => getJson(withToken('/api/kg/jobs/overview')),
  graph: (limitJobs = 200, limitSkills = 80, techStack?: string | null, level?: string | null) => {
    const p = new URLSearchParams({
      limit_jobs: String(limitJobs),
      limit_skills: String(limitSkills),
    })
    if (techStack) p.set('tech_stack', techStack)
    if (level) p.set('level', level)
    return getJson(withToken(`/api/kg/jobs/graph?${p.toString()}`))
  },
  jobDetail: (id: number) => getJson(withToken(`/api/kg/jobs/${id}`)),
  jobEvolution: (id: number, metric = 'salary_avg', from?: string, to?: string) => {
    const p = new URLSearchParams({ metric })
    if (from) p.set('from', from)
    if (to) p.set('to', to)
    return getJson(withToken(`/api/kg/jobs/${id}/evolution?${p.toString()}`))
  },
  jobChanges: (id: number) => getJson(withToken(`/api/kg/jobs/${id}/changes`)),
  timelineAnchors: (bucket = 'month') => getJson(withToken(`/api/kg/snapshot/timeline?bucket=${bucket}`)),
  snapshotAt: (date: string, limit = 100) =>
    getJson(withToken(`/api/kg/snapshot/at?date=${date}&limit=${limit}`)),
  semanticSearch: (query: string, topK = 20) =>
    postJson(withToken('/api/kg/semantic-search'), { query, top_k: topK }),
  personalRecommend: () => getJson(withToken('/api/kg/personal/recommend')),
  personalGap: (jobId: number) => getJson(withToken(`/api/kg/personal/gap?job_id=${jobId}`)),
  chatTools: () => getJson(withToken('/api/kg/chat/tools')),
}

export type KgEvent =
  | { event: 'plan_started'; step: string }
  | { event: 'plan_ready'; plan_id: string; tasks: any[]; execution_mode: string }
  | { event: 'executor_step'; task_id: string; status: string; tool: string; description: string }
  | { event: 'tool_call'; task_id: string; tool: string; args: any }
  | { event: 'tool_result'; task_id: string; result: string; full_result?: any }
  | { event: 'report_token'; token: string }
  | { event: 'report_done'; answer: string; references: any[]; execution_count: number }
  | { event: 'error'; message: string }

/**
 * 流式调用 /api/kg/chat,逐个回调事件。
 */
export function streamChat(
  message: string,
  onEvent: (ev: KgEvent) => void,
  history?: any[],
  jobId?: number,
  signal?: AbortSignal,
) {
  const r = fetch('/api/kg/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, history, job_id: jobId }),
    signal,
  })
  ;(async () => {
    const resp = await r
    if (!resp.ok || !resp.body) {
      onEvent({ event: 'error', message: `chat endpoint ${resp.status}` })
      return
    }
    const reader = resp.body.getReader()
    const decoder = new TextDecoder()
    let buf = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      let nl
      while ((nl = buf.indexOf('\n\n')) !== -1) {
        const chunk = buf.slice(0, nl)
        buf = buf.slice(nl + 2)
        const line = chunk.split('\n').find((l) => l.startsWith('data: '))
        if (!line) continue
        const payload = line.slice(6).trim()
        if (payload === '[DONE]') return
        try {
          const ev: KgEvent = JSON.parse(payload)
          onEvent(ev)
        } catch {
          /* ignore */
        }
      }
    }
  })()
}