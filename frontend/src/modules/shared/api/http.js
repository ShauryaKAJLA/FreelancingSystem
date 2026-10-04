import axios from 'axios'
import { API_BASE_URL } from './config'

// ── Token storage (sessionStorage) ──────────────────────────
const TOKEN_KEY = 'ff_token'
export const tokenStore = {
  get() { try { return sessionStorage.getItem(TOKEN_KEY) } catch { return null } },
  set(token) { try { sessionStorage.setItem(TOKEN_KEY, token) } catch { /* storage unavailable */ } },
  clear() { try { sessionStorage.removeItem(TOKEN_KEY) } catch { /* storage unavailable */ } },
}

// store.js registers a handler so an expired/invalid token signs the user out (avoids a circular import).
let onUnauthorized = () => {}
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn }

export const http = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

http.interceptors.request.use((config) => {
  const token = tokenStore.get()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

http.interceptors.response.use(
  (res) => res,
  (err) => {
    // 401 on a protected endpoint while we hold a token = session expired -> sign out.
    // Login/register are excluded: a wrong password there is a normal form error, and firing the
    // sign-out handler would reset API state mid-request and swallow the error message.
    const isAuthCall = /\/auth\/(login|register)$/.test(err.config?.url ?? '')
    if (err.response?.status === 401 && tokenStore.get() && !isAuthCall) onUnauthorized()
    return Promise.reject(err)
  }
)

// ── Error contract ──────────────────────────────────────────────────────────────────────────
// The UI reads `result.error.data` as a plain STRING everywhere (notify.error(result.error?.data ?? '...'),
// `setError(error.data || '...')`). The backend sends { success:false, message, errors? }, so flatten it.
export function toRtkError(err) {
  if (err?.response) {
    const { status, data } = err.response
    const details = Array.isArray(data?.errors) && data.errors.length ? data.errors.join('; ') : ''
    const message = data?.message ?? 'Request failed.'
    return { status, data: details ? `${message}: ${details}` : message }
  }
  if (err?.code === 'ECONNABORTED') return { status: 'TIMEOUT_ERROR', data: 'The server took too long to respond. Please try again.' }
  return { status: 'FETCH_ERROR', data: 'Cannot reach the server. Check your connection and try again.' }
}

// Live-endpoint helper for RTK Query `queryFn`s. Returns { data } | { error } like RTK Query's fakeBaseQuery expects.
//   const res = await request('get', `/jobs/${id}`)
// The backend envelope is { success, message, data }; `data` is unwrapped (and optionally mapped).
export async function request(method, url, { params, data, map } = {}) {
  try {
    const res = await http.request({ method, url, params, data })
    const payload = res.data?.data
    return { data: map ? map(payload, res.data) : payload }
  } catch (err) {
    return { error: toRtkError(err) }
  }
}

// Paged list endpoints (Phase 9): the body is a plain array and paging travels in X-Total-Count / X-Page / X-Limit / X-Total-Pages
// (exposed through CORS). Returns { data: { rows, meta } } where meta = { page, limit, total, totalPages }. If the headers are
// missing (server called without ?page/&limit) the whole array is treated as a single page.
export async function requestPaged(url, { params } = {}) {
  try {
    const res = await http.request({ method: 'get', url, params })
    const rows = Array.isArray(res.data?.data) ? res.data.data : []
    const h = res.headers ?? {}
    const total = Number(h['x-total-count'])
    const meta = Number.isFinite(total) && h['x-total-count'] !== undefined
      ? { page: Number(h['x-page']) || 1, limit: Number(h['x-limit']) || rows.length, total, totalPages: Number(h['x-total-pages']) || 1 }
      : { page: 1, limit: rows.length, total: rows.length, totalPages: 1 }
    return { data: { rows, meta } }
  } catch (err) {
    return { error: toRtkError(err) }
  }
}

// Drops '' / null / undefined so filter forms (which default every field to '') don't send empty query params.
export const cleanParams = (obj = {}) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== '' && v !== null && v !== undefined))
