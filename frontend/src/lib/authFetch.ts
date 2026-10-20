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
