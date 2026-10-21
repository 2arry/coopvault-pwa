// Thin client for the Cooperative360 Frappe API. Auth uses short-lived server-side session tokens
// (Authorization: Session …) so the PWA on Firebase never depends on cross-site cookies.
export const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
const TOKEN_KEY = 'coopvault.token'

let onUnauthorized = () => {}
export const setUnauthorizedHandler = (fn) => (onUnauthorized = fn)

export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY) } catch { return null }
}
export function setToken(token) {
  try { token ? localStorage.setItem(TOKEN_KEY, token) : localStorage.removeItem(TOKEN_KEY) } catch {}
}

export class ApiError extends Error {
  constructor(message, status, type) {
    super(message)
    this.status = status
    this.type = type
  }
}

function stripHtml(s) {
  return String(s || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()
}

function errorMessage(body, status) {
  // Frappe's own rate-limit wording ("try after sometime") reads poorly; ours are already friendly
  if (status === 429 && /hit the rate limit/.test(body?._server_messages || '')) return 'Too many attempts. Please wait a few minutes and try again.'
  try {
    if (body?._server_messages) {
      const msgs = JSON.parse(body._server_messages).map((m) => stripHtml(JSON.parse(m).message))
      if (msgs.length) return msgs.join('\n')
    }
  } catch {}
  if (body?.exception) return stripHtml(String(body.exception).split(':').slice(1).join(':')) || body.exception
  if (typeof body?.message === 'string') return body.message
  if (status === 429) return 'Too many attempts. Please wait a few minutes and try again.'
  if (status >= 500) return 'The server had a problem. Please try again shortly.'
  return 'Something went wrong. Please try again.'
}

async function request(path, { method = 'GET', params, body, raw = false } = {}) {
  const headers = { Accept: 'application/json' }
  const token = getToken()
  if (token) headers.Authorization = `Session ${token}`
  let url = `${API_URL}${path}`
  if (params) {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''))
    if ([...qs].length) url += `?${qs}`
  }
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  let res
  try {
    res = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  } catch {
    throw new ApiError('You appear to be offline. Check your connection and try again.', 0, 'NetworkError')
  }
  if (raw && res.ok) return res

  let data = {}
  try { data = await res.json() } catch {}
  if (!res.ok) {
    const err = new ApiError(errorMessage(data, res.status), res.status, data?.exc_type)
    if (res.status === 401 && token) onUnauthorized(err)
    throw err
  }
  return data.message
}

/** Read endpoint: api.get('coop.get_dashboard', { cooperative }) */
export const get = (method, params) => request(`/api/method/coopvault.api.${method}`, { params })
/** Write endpoint: api.post('finance.apply_loan', {...}) */
export const post = (method, body = {}) => request(`/api/method/coopvault.api.${method}`, { method: 'POST', body })

