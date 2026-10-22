/** 统一的带 token 请求工具
 *
 * 企业端/求职端接口现在都从 token 取身份，不再接受前端传 user id。
 * 所有私有接口调用都要经过这里拼 `?token=`，避免各处手写漏掉。
 */
export const getToken = (): string => localStorage.getItem('xingtu_token') || ''

export const withToken = (url: string): string => {
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}token=${encodeURIComponent(getToken())}`
}

/** Attach identity only to this application's API, never external services. */
export function createAuthenticatedFetch(fetcher: typeof fetch, origin: string, readToken = getToken): typeof fetch {
  return (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input.toString(), origin)
    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()
    const publicPath = (method === 'POST' && /^\/api\/auth\/(?:login|admin\/login|register|send-code)\/?$/.test(url.pathname))
      || (method === 'GET' && (url.pathname === '/api/health'
        || /^\/api\/resume-center\/share\/[a-f0-9]{16}\/?$/.test(url.pathname)
        || /^\/api\/resume-center\/print\/[A-Za-z0-9_-]{32,128}\/?$/.test(url.pathname)))
    if (url.origin !== origin || !url.pathname.startsWith('/api/') || publicPath || url.searchParams.has('token')) {
      return fetcher(input, init)
    }
    const token = readToken()
    if (!token) return fetcher(input, init)
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined))
    if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`)
    return fetcher(input, { ...init, headers })
  }
}

export function installApiAuthentication() {
  window.fetch = createAuthenticatedFetch(window.fetch.bind(window), window.location.origin)
}
