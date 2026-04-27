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
  // POST /api/executives/{name}/run
  // Body: {} for top-priority selection, or { task_id, dry_run } per Phase 3A handoff
  runExecutive(name, body = {}) {
    return api.post(`/api/executives/${name}/run`, body)
  },
}

export default api
export { api }
