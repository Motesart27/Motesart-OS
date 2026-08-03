// tileMachine.js — MOSV2-C canonical per-tile state machine (PLAN §9).
// Pure and dependency-free: no fetch, no storage, no timers, no React.
// Forbidden transitions are impossible by construction: the transition table
// below simply has no branch that could emit them (e.g. a failed refresh can
// never blank populated data back to skeleton/empty — it can only go stale).

export const TILE_STATUS = Object.freeze({
  IDLE: 'idle',
  LOADING: 'loading',
  POPULATED: 'populated',
  EMPTY: 'empty',
  PARTIAL: 'partial',
  STALE: 'stale',
  ERROR: 'error',
  PERMISSION_DENIED: 'permission-denied',
  OFFLINE: 'offline',
  B2_PENDING: 'b2-pending',
})

// Data classification law (PLAN §0). Every tile carries exactly one class.
export const DATA_CLASSIFICATION = Object.freeze({
  LIVE: 'LIVE',
  UNAVAILABLE_LIVE: 'UNAVAILABLE_LIVE',
  FIXTURE: 'FIXTURE',
  MOCK: 'MOCK',
  DEFERRED: 'DEFERRED',
})

// Z1 signal ranking law (PLAN §8): crit > exec > ai > warn > info > good, max 6.
export const SIGNAL_SEVERITY_ORDER = Object.freeze(['crit', 'exec', 'ai', 'warn', 'info', 'good'])
export const MAX_SIGNALS = 6

const RESOLVABLE = new Set([
  TILE_STATUS.LOADING,
  TILE_STATUS.POPULATED,
  TILE_STATUS.EMPTY,
  TILE_STATUS.PARTIAL,
  TILE_STATUS.STALE,
  TILE_STATUS.ERROR,
  TILE_STATUS.PERMISSION_DENIED,
  TILE_STATUS.OFFLINE,
])

export function createTileState(overrides = {}) {
  return {
    status: TILE_STATUS.IDLE,
    data: null,
    lastGood: null,
    updatedAt: null,
    error: null,
    ...overrides,
  }
}

// §3.6 mock-data ruling: any payload carrying "status":"mock" is never valid
// populated data. The marker is detected here and never stripped.
export function isMockPayload(payload) {
  return Boolean(payload) && typeof payload === 'object' && payload.status === 'mock'
}

function resolveState(state, event) {
  // A mock payload always resolves to error — never populated (§3.6).
  // Last-good is retained untouched so a later good refresh can recover.
  if (isMockPayload(event.payload)) {
    return {
      ...state,
      status: TILE_STATUS.ERROR,
      error: { kind: 'mock', message: event.message || 'Source returned mock data', mock: true },
    }
  }
  const resolution = event.resolution || 'populated'
  if (resolution === 'empty') {
    return { ...state, status: TILE_STATUS.EMPTY, data: event.payload, updatedAt: event.at ?? state.updatedAt, error: null }
  }
  if (resolution === 'partial') {
    return { ...state, status: TILE_STATUS.PARTIAL, data: event.payload, lastGood: event.payload, updatedAt: event.at ?? state.updatedAt, error: null }
  }
  return { ...state, status: TILE_STATUS.POPULATED, data: event.payload, lastGood: event.payload, updatedAt: event.at ?? state.updatedAt, error: null }
}

function rejectState(state, event) {
  const kind = event.kind || 'http'
  const error = { kind, message: event.message || 'Source unreachable', mock: kind === 'mock' }
  // Last-good is always preferred over blanking (§9 fallback law): a failed
  // refresh with retained data goes stale and keeps rendering that data.
  if (state.lastGood != null) {
    return { ...state, status: TILE_STATUS.STALE, error }
  }
  if (kind === 'permission') return { ...state, status: TILE_STATUS.PERMISSION_DENIED, error }
  if (kind === 'offline') return { ...state, status: TILE_STATUS.OFFLINE, error }
  return { ...state, status: TILE_STATUS.ERROR, error }
}

// Pure transition function. Events:
//   { type: 'mount' }
//   { type: 'resolve', payload, resolution: 'populated'|'empty'|'partial', at }
//   { type: 'reject', kind: 'http'|'permission'|'offline'|'timeout'|'parse'|'mock', message }
//   { type: 'expire' }  — freshness expiry (populated → stale)
//   { type: 'retry' }   — user retry link (error subtypes → loading)
// Any event without a lawful branch returns the state unchanged, so forbidden
// transitions (populated → empty on refresh failure, skeleton replay on passive
// refresh, error → populated without a fetch, mock → populated, b2-pending →
// any data state) cannot be expressed.
export function transition(state, event) {
  if (!state || !event) return state
  switch (event.type) {
    case 'mount':
      return state.status === TILE_STATUS.IDLE
        ? { ...state, status: TILE_STATUS.LOADING, error: null }
        : state
    case 'resolve':
      return RESOLVABLE.has(state.status) ? resolveState(state, event) : state
    case 'reject':
      return RESOLVABLE.has(state.status) ? rejectState(state, event) : state
    case 'expire':
      return state.status === TILE_STATUS.POPULATED
        ? { ...state, status: TILE_STATUS.STALE }
        : state
    case 'retry':
      return state.status === TILE_STATUS.ERROR ||
        state.status === TILE_STATUS.PERMISSION_DENIED ||
        state.status === TILE_STATUS.OFFLINE
        ? { ...state, status: TILE_STATUS.LOADING, error: null }
        : state
    default:
      return state
  }
}

// Structural severity ranking: crit > exec > ai > warn > info > good, unknown
// severities last, input never mutated, hard cap of MAX_SIGNALS (§17.7).
export function rankSignals(signals) {
  if (!Array.isArray(signals)) return []
  const rank = (signal) => {
    const index = SIGNAL_SEVERITY_ORDER.indexOf(signal && signal.severity)
    return index === -1 ? SIGNAL_SEVERITY_ORDER.length : index
  }
  return signals
    .map((signal, index) => ({ signal, index }))
    .sort((a, b) => rank(a.signal) - rank(b.signal) || a.index - b.index)
    .slice(0, MAX_SIGNALS)
    .map((entry) => entry.signal)
}

// Truthful countdown breakdown from a target date. Returns null when the
// target is missing, unparseable, or already past — a countdown never lies.
export function computeCountdown(targetDate, now = Date.now()) {
  const targetMs = targetDate instanceof Date ? targetDate.getTime() : new Date(targetDate).getTime()
  const nowMs = now instanceof Date ? now.getTime() : now
  if (!Number.isFinite(targetMs) || !Number.isFinite(nowMs)) return null
  const remainingMs = targetMs - nowMs
  if (remainingMs <= 0) return null
  const totalHours = Math.floor(remainingMs / 3600000)
  return {
    days: Math.floor(totalHours / 24),
    hours: totalHours % 24,
    totalHours,
    targetMs,
  }
}
