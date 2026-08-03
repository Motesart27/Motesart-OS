// adapters/auditLog.js — MOSV2-C Mya handled-log adapter (PLAN §4 Domain 3).
// Serves the Z1 handled-log digest. This is the only JWT-enforced cockpit
// feed: 401/403 surfaces as the tile-local permission state (9.5) — never a
// global logout or redirect. G9 render rule: result_summary is preferred when
// non-null, response_text is the fallback (the writer never writes
// result_summary on some rows).

import { apiFetch } from '../apiFetch.js'

export function fetchHandledLog(signal, limit = 3) {
  return apiFetch(`/api/mya/audit/handled?limit=${limit}`, { signal })
}

const toArray = (value) => (Array.isArray(value) ? value : [])

export function mapHandledLog(payload) {
  const items = toArray(payload && payload.items).map((item) => {
    const i = item && typeof item === 'object' ? item : {}
    return {
      timestamp: i.timestamp ?? null,
      route: i.route ?? null,
      summary: i.result_summary ?? i.response_text ?? '',
    }
  })
  return { items, count: items.length, empty: items.length === 0 }
}
