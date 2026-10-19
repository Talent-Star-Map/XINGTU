// H5 uses the local Vite proxy; mini-programs require an absolute API URL.
let defaultBaseUrl = 'http://180.76.227.159:8081'
// #ifdef H5
defaultBaseUrl = ''
// #endif
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? defaultBaseUrl).replace(/\/$/, '')

export function withToken(url) {
  const token = uni.getStorageSync('xingtu_token') || ''
  if (!token) return url
  return `${url}${url.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`
}

function buildErrorMessage(error) {
  const msg = error?.errMsg || error?.message || ''
  if (msg.includes('timeout') || msg.includes('超时')) {
    return '请求超时，请检查后端服务或网络连接'
  }
  if (msg.includes('fail') || msg.includes('connect') || msg.includes('ERR_CONNECTION')) {
    return '网络连接失败，请检查 API 地址和网络'
  }
  return msg || '网络错误'
}

export function uploadFile({ url, filePath, name = 'file', auth = true }) {
  return new Promise((resolve, reject) => {
    uni.uploadFile({
      url: `${API_BASE_URL}${auth ? withToken(url) : url}`,
      filePath,
      name,
      timeout: 30000,
      success: (response) => {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve(JSON.parse(response.data))
        } else {
          reject(new Error(`上传失败：${response.statusCode}`))
        }
      },
      fail: (error) => reject(new Error(buildErrorMessage(error))),
    })
  })
}

export function request({ url, method = 'GET', data, auth = true }) {
  return new Promise((resolve, reject) => {
    uni.request({
      url: `${API_BASE_URL}${auth ? withToken(url) : url}`,
      method,
      data,
      header: { 'Content-Type': 'application/json' },
      timeout: 15000,
      success: (response) => {
        if (response.statusCode >= 200 && response.statusCode < 300) resolve(response.data)
        else reject(new Error(`请求失败：${response.statusCode}`))
      },
      fail: (error) => reject(new Error(buildErrorMessage(error))),
    })
  })
}
