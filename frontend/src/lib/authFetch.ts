const getToken = (): string => localStorage.getItem('xingtu_token') || ''

/** Attach identity only to this application's API, never external services. */
export function createAuthenticatedFetch(fetcher: typeof fetch, origin: string, readToken = getToken): typeof fetch {
  return async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input.toString(), origin)
    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()
    const publicPath = (method === 'POST' && /^\/api\/auth\/(?:login|admin\/login|register|send-code)\/?$/.test(url.pathname))
      || (method === 'GET' && (url.pathname === '/api/health'
        || /^\/api\/resume-center\/share\/[a-f0-9]{16}\/?$/.test(url.pathname)
        || /^\/api\/resume-center\/print\/[A-Za-z0-9_-]{32,128}\/?$/.test(url.pathname)))
    if (url.origin !== origin || !url.pathname.startsWith('/api/') || publicPath) {
      return fetcher(input, init)
    }
    const token = readToken()
    if (!token) return fetcher(input, init)
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined))
    if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`)
    const response = await fetcher(input, { ...init, headers })
    // token 失效时必须可见地退回登录页：只让请求失败会让页面显示空数据，
    // 用户以为“没有消息”，实际是掉线。
    if (response.status === 401 && typeof window !== 'undefined'
      && headers.get('Authorization') === `Bearer ${readToken()}`) {
      window.dispatchEvent(new Event('xingtu:unauthorized'))
    }
    return response
  }
}

export function installApiAuthentication() {
  window.fetch = createAuthenticatedFetch(window.fetch.bind(window), window.location.origin)
}
