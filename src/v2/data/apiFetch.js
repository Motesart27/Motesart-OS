// apiFetch.js — MOSV2-C same-origin fetch helper (PLAN §3.5, §7).
// Self-contained: never imports the legacy src/services/api.js module; it only
// replicates the existing `som_token` localStorage read pattern. Same-origin
// law is enforced here: only paths beginning `/api/` are accepted — any
// absolute URL, protocol-relative URL, or other path throws before a request
// can be constructed.

import { isMockPayload } from './tileMachine.js'

export const API_TIMEOUT_MS = 15000

// Same-origin guard (§3.5). Programmer error — throws synchronously by design.
export function assertApiPath(path) {
  if (typeof path !== 'string' || !path.startsWith('/api/')) {
    throw new TypeError(`apiFetch: same-origin /api/* paths only — rejected: ${String(path)}`)
  }
}

// Reads the existing `som_token` key only. Never writes. (No new storage keys.)
function readToken() {
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage.getItem('som_token')
  } catch {
    return null
  }
}

// Minimal AbortSignal combiner (AbortSignal.any is not assumed to exist).
// The combined signal aborts when any input signal aborts, preserving reason.
export function combineSignals(signals) {
  const controller = new AbortController()
  const active = signals.filter(Boolean)
  const onAbort = (event) => controller.abort(event.target.reason)
  for (const signal of active) {
    if (signal.aborted) {
      controller.abort(signal.reason)
      break
    }
    signal.addEventListener('abort', onAbort, { once: true })
  }
  return {
    signal: controller.signal,
    abort: (reason) => controller.abort(reason),
    detach: () => active.forEach((signal) => signal.removeEventListener('abort', onAbort)),
  }
}

// Typed result, never throws on HTTP errors:
//   { ok, status, data, errorKind }
// errorKind ∈ null | 'http' | 'permission' | 'offline' | 'timeout' | 'parse' | 'mock'
// Throws only on: same-origin guard violations and caller-initiated aborts
// (supersede/unmount), which callers are expected to swallow.
export async function apiFetch(path, { signal, method = 'GET', body, timeoutMs = API_TIMEOUT_MS } = {}) {
  assertApiPath(path)

  const combined = combineSignals([signal])
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    combined.abort('timeout')
  }, timeoutMs)

  const headers = { Accept: 'application/json' }
  const token = readToken()
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  try {
    const response = await fetch(path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: combined.signal,
    })
    const status = response.status

    let data = null
    let parseFailed = false
    try {
      data = await response.json()
    } catch {
      parseFailed = true
    }

    // 401/403 never throw — tile-local permission state, never a logout (9.5).
    if (status === 401 || status === 403) return { ok: false, status, data, errorKind: 'permission' }
    if (!response.ok) return { ok: false, status, data, errorKind: 'http' }
    if (parseFailed) return { ok: false, status, data: null, errorKind: 'parse' }
    // §3.6: a mock payload is an unavailable/error result, never data. The
    // marker is returned intact — never stripped, never rendered.
    if (isMockPayload(data)) return { ok: false, status, data, errorKind: 'mock' }
    return { ok: true, status, data, errorKind: null }
  } catch (error) {
    if (timedOut) return { ok: false, status: 0, data: null, errorKind: 'timeout' }
    // Caller aborts (supersede/unmount) propagate so callers can ignore them.
    if (combined.signal.aborted) throw error
    return { ok: false, status: 0, data: null, errorKind: 'offline' }
  } finally {
    clearTimeout(timer)
    combined.detach()
  }
}
