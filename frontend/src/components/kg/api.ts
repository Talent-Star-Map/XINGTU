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
  personalGraph: () => getJson('/api/kg/personal/graph'),
  overview: () => getJson(withToken('/api/kg/jobs/overview')),
  catalog: (includeUnverified = false, techStack = '', level = '') => {
    const p = new URLSearchParams({ include_unverified: String(includeUnverified) })
    if (techStack) p.set('tech_stack', techStack)
    if (level) p.set('level', level)
    return getJson(withToken(`/api/kg/catalog?${p}`))
  },
  roleDefinition: (role: string, draft = false) => getJson(withToken(`/api/kg/roles/definition?role=${encodeURIComponent(role)}&draft=${draft}`)),
  roleDefinitionHistory: (role: string) => getJson(withToken(`/api/kg/admin/roles/${encodeURIComponent(role)}/versions`)),
  roleDefinitionEvidence: (role: string) => getJson(withToken(`/api/kg/admin/roles/${encodeURIComponent(role)}/evidence`)),
  saveRoleDefinition: (role: string, fields: Record<string, unknown>, publish: boolean, reviewNote: string) =>
    postJson(withToken(`/api/kg/admin/roles/${encodeURIComponent(role)}/versions`), { fields, publish, review_note: reviewNote }),
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
  semanticSearch: (query: string, topK = 20, asOf?: string) =>
    postJson(withToken('/api/kg/semantic-search'), { query, top_k: topK, as_of: asOf }),
  personalRecommend: () => getJson(withToken('/api/kg/personal/recommend')),
  personalGap: (jobId: number) => getJson(withToken(`/api/kg/personal/gap?job_id=${jobId}`)),
  chatTools: () => getJson(withToken('/api/kg/chat/tools')),
}

export type KgEvent =
  | { event: 'profile_ready'; status: 'ready' | 'empty' | 'unavailable'; sources: string[] }
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
export async function streamChat(
  message: string,
  onEvent: (ev: KgEvent) => void,
  history?: any[],
  jobId?: number,
  signal?: AbortSignal,
) {
  const resp = await fetch('/api/kg/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TOKEN()}`,
    },
    body: JSON.stringify({ message, history, job_id: jobId }),
    signal,
  })
  if (!resp.ok || !resp.body) {
    throw new Error(resp.status === 401 ? '登录已失效，请重新登录' : resp.status === 422 ? '问题或对话过长，请缩短后重试' : '智能问答暂不可用，请稍后重试')
  }
    const reader = resp.body.getReader()
    const decoder = new TextDecoder()
    let buf = ''
    let completed = false
    try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      buf = buf.replace(/\r\n/g, '\n')
      let nl
      while ((nl = buf.indexOf('\n\n')) !== -1) {
        const chunk = buf.slice(0, nl)
        buf = buf.slice(nl + 2)
        const payload = chunk.split('\n').filter(l => l.startsWith('data:')).map(l => l.slice(5).trimStart()).join('\n').trim()
        if (!payload) continue
        if (payload === '[DONE]') {
          if (!completed) throw new Error('回答未完成，请重试')
          return
        }
        try {
          const ev: KgEvent = JSON.parse(payload)
          if (ev.event === 'report_done' || ev.event === 'error') completed = true
          onEvent(ev)
        } catch {
          /* ignore */
        }
      }
    }
    if (!completed && !signal?.aborted) throw new Error('连接已中断，已保留收到的内容，请重试')
    } finally {
      await reader.cancel().catch(() => {})
      reader.releaseLock()
    }
}
