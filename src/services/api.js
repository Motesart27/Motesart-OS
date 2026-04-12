const SOM_API = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
const FM_URL  = (import.meta.env.FM_APP_URL   || '').replace(/\/$/, '')

function getToken() { return localStorage.getItem('som_token') }
export function setToken(t) { localStorage.setItem('som_token', t) }
export function clearToken() { localStorage.removeItem('som_token'); localStorage.removeItem('som_user') }

const api = {
  async login(email, password) {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.message || `Login failed: ${res.status}`)
    return data
  },
  verifySession() {
    const t = getToken()
    if (!t) throw new Error('No token')
    try {
      const payload = JSON.parse(atob(t.split('.')[0]))
      if (payload.exp < Date.now()) throw new Error('Expired')
      return Promise.resolve({ valid: true, user: payload })
    } catch { throw new Error('Invalid token') }
  },
  post(path, body = {}) {
    const t = getToken()
    return fetch(`${SOM_API}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) },
      body: JSON.stringify(body)
    }).then(r => r.json())
  },
  fm(path) { return fetch(`${FM_URL}${path}`).then(r => r.json()) },
  async wake() {
    try { const r = await fetch(`${SOM_API}/api/health`); return r.json() }
    catch { return { ok: false } }
  }
}
export default api
export { api }
