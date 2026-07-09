const SOM_API = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
const FM_URL  = (import.meta.env.FM_APP_URL   || '').replace(/\/$/, '')

function getToken() { return localStorage.getItem('som_token') }
export function setToken(t) { localStorage.setItem('som_token', t) }
export function clearToken() { localStorage.removeItem('som_token'); localStorage.removeItem('som_user') }

function isTokenLocallyExpired(token) {
  try {
    const [, payload] = token.split('.')
    if (!payload) return false
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(payload.length / 4) * 4, '=')
    const decoded = JSON.parse(atob(normalized))
    return Boolean(decoded.exp && decoded.exp * 1000 < Date.now())
  } catch {
    return false
  }
}

const api = {
  async login(email, password) {
    const res = await fetch(`${SOM_API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.message || `Login failed: ${res.status}`)
    return data
  },
  async verifySession() {
    const t = getToken()
    if (!t) return { valid: false, logout: true, reason: 'missing_token' }
    if (isTokenLocallyExpired(t)) return { valid: false, logout: true, reason: 'expired_token' }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)

    try {
      const res = await fetch(`${SOM_API}/auth/verify`, {
        headers: { Authorization: `Bearer ${t}` },
        signal: controller.signal,
      })

      if (res.status === 401 || res.status === 403) {
        return { valid: false, logout: true, reason: 'rejected_token', status: res.status }
      }
      if (res.status >= 500) {
        return { valid: false, logout: false, reason: 'backend_unavailable', status: res.status }
      }
      if (!res.ok) {
        return { valid: false, logout: true, reason: 'verify_failed', status: res.status }
      }

      const data = await res.json().catch(() => null)
      if (!data || !data.valid || !data.user) {
        return { valid: false, logout: true, reason: 'bad_verify_response' }
      }

      return { valid: true, user: data.user, exp: data.exp ?? null }
    } catch {
      return { valid: false, logout: false, reason: 'network_unavailable' }
    } finally {
      clearTimeout(timeout)
    }
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
    try { const r = await fetch(`${SOM_API}/health`); return r.json() }
    catch { return { ok: false } }
  },
  // ─── Phase 4A — Approvals ───────────────────────────────
  listApprovals(biz) {
    const url = biz ? `/api/approvals?biz=${encodeURIComponent(biz)}` : '/api/approvals'
    const t = getToken()
    return fetch(`${SOM_API}${url}`, {
      headers: t ? { Authorization: `Bearer ${t}` } : {},
    }).then(r => { if (!r.ok) throw new Error(`approvals ${r.status}`); return r.json() })
  },
  patchApprovalStatus(contentId, approval_status, revision_reason = null) {
    const t = getToken()
    const body = { approval_status }
    if (revision_reason !== null) body.revision_reason = revision_reason
    return fetch(`${SOM_API}/api/approvals/${encodeURIComponent(contentId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) },
      body: JSON.stringify(body),
    }).then(r => { if (!r.ok) throw new Error(`patch approval ${r.status}`); return r.json() })
  },
  // ─── Dispatch ──────────────────────────────────────────
  postDispatch({ message, route, priority, source = 'motesart-os', client_dispatch_id = null }) {
    const t = getToken()
    return fetch(`${SOM_API}/api/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) },
      body: JSON.stringify({ message, route, priority, source, client_dispatch_id }),
    }).then(r => { if (!r.ok) throw new Error(`dispatch ${r.status}`); return r.json() })
  },
  async postMyaDispatch(message, biz = 'som') {
    const t = getToken()
    const res = await fetch(`${SOM_API}/api/mya/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) },
      body: JSON.stringify({ message, biz }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`ERROR: ${res.status} ${body}`)
    }
    return res.json()
  },
  async postMyaDispatchPending(pendingDispatch) {
    const t = getToken()
    const res = await fetch(`${SOM_API}/api/mya/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) },
      body: JSON.stringify(pendingDispatch),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`ERROR: ${res.status} ${body}`)
    }
    return res.json()
  },
  async classifyMyaDispatch(body) {
    const t = getToken()
    const res = await fetch(`${SOM_API}/api/mya/classify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(`classify ${res.status}`)
    return data
  },
  getDispatches(limit = 50) {
    const t = getToken()
    return fetch(`${SOM_API}/api/dispatch?limit=${limit}`, {
      headers: t ? { Authorization: `Bearer ${t}` } : {},
    }).then(r => { if (!r.ok) throw new Error(`getDispatches ${r.status}`); return r.json() })
  },
  getDispatch(id) {
    const t = getToken()
    return fetch(`${SOM_API}/api/dispatch/${encodeURIComponent(id)}`, {
      headers: t ? { Authorization: `Bearer ${t}` } : {},
    }).then(r => { if (!r.ok) throw new Error(`getDispatch ${r.status}`); return r.json() })
  },
  // ─── Phase 5A — Dispatch Tasks ────────────────────────────────────────
  listDispatchTasks(biz, limit = 20) {
    const t = getToken()
    const params = new URLSearchParams({ limit })
    if (biz) params.set('biz', biz)
    return fetch(`${SOM_API}/api/dispatch-tasks?${params}`, {
      headers: t ? { Authorization: `Bearer ${t}` } : {},
    }).then(r => { if (!r.ok) throw new Error(`listDispatchTasks ${r.status}`); return r.json() })
  },
  createDispatchTask(body) {
    const t = getToken()
    return fetch(`${SOM_API}/api/dispatch-tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) },
      body: JSON.stringify(body),
    }).then(r => { if (!r.ok) throw new Error(`createDispatchTask ${r.status}`); return r.json() })
  },
  patchDispatchTask(id, body) {
    const t = getToken()
    return fetch(`${SOM_API}/api/dispatch-tasks/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) },
      body: JSON.stringify(body),
    }).then(r => { if (!r.ok) throw new Error(`patchDispatchTask ${r.status}`); return r.json() })
  },
  // ─── Phase 3B — Executive runner ─────────────────────
  runExecutive(name, body = {}) {
    return api.post(`/api/executives/${name}/run`, body)
  },
}

export default api
export { api }
