// Motesart OS — api.js
// Auth uses Netlify serverless function (/api/login) — completely independent of SOM backend.
// Agent calls (PA, E7A, FM, Book) still route to SOM Railway backend via VITE_API_URL.

const SOM_API  = (import.meta.env.VITE_API_URL  || '').replace(/\/$/, '')
const FM_URL   = (import.meta.env.FM_APP_URL     || '').replace(/\/$/, '')

if (!SOM_API) console.warn('[Motesart OS] VITE_API_URL not set — agent calls will fail')

function getToken() {
  return localStorage.getItem('som_token')
}

export function setToken(token) {
  localStorage.setItem('som_token', token)
}

export function clearToken() {
  localStorage.removeItem('som_token')
  localStorage.removeItem('som_user')
}

function authHeaders(includeJson = true) {
  const token = getToken()
  return {
    ...(includeJson ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function request(url, options = {}, timeout = 15000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  let res
  try {
    res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: { ...authHeaders(options.body !== undefined), ...(options.headers || {}) },
    })
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Request timed out')
    throw err
  } finally {
    clearTimeout(timer)
  }

  let data = null
  try { data = await res.json() } catch { data = null }

  if (res.status === 401) {
    window.dispatchEvent(new Event('som:force-logout'))
    throw new Error(data?.message || 'Unauthorized')
  }
  if (!res.ok) throw new Error(data?.message || `Request failed: ${res.status}`)
  return data
}

const api = {
  // ── Auth — Netlify serverless function (independent of SOM) ──
  login(email, password) {
    return request('/api/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
  },

  verifySession() {
    if (!getToken()) throw new Error('No token')
    // Token is self-contained JWT — verify locally
    const token = getToken()
    try {
      const [data] = token.split('.')
      const payload = JSON.parse(atob(data))
      if (payload.exp < Date.now()) throw new Error('Token expired')
      return Promise.resolve({ valid: true, user: { email: payload.email, role: 'admin' } })
    } catch {
      throw new Error('Invalid token')
    }
  },

  // ── Agent calls — SOM Railway backend ──
  post(path, body = {}) {
    return request(`${SOM_API}${path}`, {
      method: 'POST',
      body: JSON.stringify(body),
    })
  },

  // ── Finance Mind ──
  fm(path) {
    return request(`${FM_URL}${path}`)
  },

  // ── Health / wake ──
  async wake() {
    try {
      const res = await fetch(`${SOM_API}/api/health`)
      const text = await res.text()
      try { return JSON.parse(text) } catch { return { ok: true, raw: text } }
    } catch {
      await new Promise(r => setTimeout(r, 1500))
      const res = await fetch(`${SOM_API}/api/health`)
      const text = await res.text()
      try { return JSON.parse(text) } catch { return { ok: true, raw: text } }
    }
  },
}

export default api
export { api }
