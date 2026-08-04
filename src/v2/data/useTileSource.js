// useTileSource.js — MOSV2-C uniform per-tile data hook (PLAN §7 contract).
// Owns the tile's cadence timer, visibility pause/resume, silent refresh, and
// per-fetch cancellation. All state transitions run through tileMachine, so
// forbidden transitions (skeleton replay, populated → empty on refresh
// failure, mock → populated) cannot occur here either.
//
// The fetcher contract: `fetcher(signal)` returns an apiFetch typed result
// `{ ok, status, data, errorKind }`. A fetcher may additionally annotate a
// successful result with `resolution` ('populated'|'empty'|'partial') and
// `viewData` (the mapped view model); without annotations an ok result is
// populated with the raw payload. The reducer, cadence timer, and fetch gate
// below are exported pure so the hook's logic is testable without a DOM.

import { useCallback, useEffect, useReducer, useRef } from 'react'
import { DATA_CLASSIFICATION, TILE_STATUS, createTileState, transition } from './tileMachine.js'

const CONTENT_STATUSES = new Set([TILE_STATUS.POPULATED, TILE_STATUS.PARTIAL, TILE_STATUS.STALE])

// enabled:false ⇒ no fetch ever. Pre-B2 FM (UNAVAILABLE_LIVE) holds the
// deterministic b2-pending state; deferred tiles hold quiet empty (§3.8, G2).
export function initialTileSourceState({ enabled = true, classification = DATA_CLASSIFICATION.LIVE } = {}) {
  if (!enabled) {
    return createTileState({
      status: classification === DATA_CLASSIFICATION.UNAVAILABLE_LIVE ? TILE_STATUS.B2_PENDING : TILE_STATUS.EMPTY,
      classification,
    })
  }
  return createTileState({ status: TILE_STATUS.IDLE, classification })
}

export function tileSourceReducer(state, action) {
  switch (action.type) {
    case 'mount':
      return transition(state, { type: 'mount' })
    case 'fetch-start': {
      // Silent refresh (§9): a cadence tick with rendered content keeps that
      // content on screen — loading/skeleton is never re-entered.
      if (action.reason === 'cadence' && CONTENT_STATUSES.has(state.status)) {
        return { ...state, error: null }
      }
      return { ...state, status: TILE_STATUS.LOADING, error: null }
    }
    case 'fetch-resolve': {
      const result = action.result
      if (!result || typeof result !== 'object') {
        return transition(state, { type: 'reject', kind: 'parse', message: 'Malformed adapter result' })
      }
      if (!result.ok) {
        const next = transition(state, {
          type: 'reject',
          kind: result.errorKind || 'http',
          message: result.errorKind === 'permission' ? 'Sign-in needed' : 'Source unreachable',
        })
        return result.errorKind === 'mock' ? { ...next, classification: DATA_CLASSIFICATION.MOCK } : next
      }
      const payload = Object.prototype.hasOwnProperty.call(result, 'viewData') ? result.viewData : result.data
      const next = transition(state, {
        type: 'resolve',
        payload,
        resolution: result.resolution || 'populated',
        at: action.at,
      })
      // Second line of §3.6 defense: a fetcher returning ok:true with a
      // "status":"mock" payload still lands in error, classified MOCK.
      return next.error && next.error.mock ? { ...next, classification: DATA_CLASSIFICATION.MOCK } : next
    }
    case 'fetch-reject':
      return transition(state, { type: 'reject', kind: action.kind || 'offline', message: action.message })
    case 'expire':
      return transition(state, { type: 'expire' })
    case 'retry':
      return transition(state, { type: 'retry' })
    default:
      return state
  }
}

// Cadence timer with visibility pause/resume (9.3). Resume never bursts: if
// one or more ticks were missed while hidden, exactly one catch-up tick fires
// and the regular cadence resumes. Timers and clock are injectable for tests.
export function createCadenceTimer({ cadenceMs, onTick, now = () => Date.now(), setTimeoutFn = setTimeout, clearTimeoutFn = clearTimeout }) {
  let handle = null
  let running = false
  let lastTickAt = null

  const clear = () => {
    if (handle !== null) {
      clearTimeoutFn(handle)
      handle = null
    }
  }
  const schedule = (delay) => {
    clear()
    handle = setTimeoutFn(fire, Math.max(delay, 0))
  }
  const fire = () => {
    handle = null
    if (!running) return
    lastTickAt = now()
    onTick()
    schedule(cadenceMs)
  }

  return {
    start() {
      if (running) return
      running = true
      lastTickAt = now()
      schedule(cadenceMs)
    },
    pause() {
      if (!running) return
      running = false
      clear()
    },
    resume() {
      if (running) return
      running = true
      const elapsed = lastTickAt === null ? Infinity : now() - lastTickAt
      if (elapsed >= cadenceMs) {
        lastTickAt = now()
        onTick()
        schedule(cadenceMs)
      } else {
        schedule(cadenceMs - elapsed)
      }
    },
    isRunning: () => running,
  }
}

// Per-fetch cancellation gate. Each new fetch supersedes and aborts the
// previous one; stale fetch completions are dropped by sequence check.
export function createFetchGate() {
  let seq = 0
  let controller = null
  return {
    next() {
      if (controller) controller.abort('superseded')
      controller = new AbortController()
      seq += 1
      return { signal: controller.signal, seq }
    },
    isCurrent(candidate) {
      return candidate === seq
    },
    abort(reason) {
      seq += 1
      if (controller) controller.abort(reason)
    },
  }
}

export function useTileSource({ fetcher, cadenceMs, enabled = true, initialClassification = DATA_CLASSIFICATION.LIVE }) {
  const [state, dispatch] = useReducer(
    tileSourceReducer,
    { enabled, classification: initialClassification },
    initialTileSourceState,
  )
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher
  const gateRef = useRef(null)
  if (!gateRef.current) gateRef.current = createFetchGate()

  const runFetch = useCallback(async (reason) => {
    const gate = gateRef.current
    const { signal, seq } = gate.next()
    dispatch({ type: 'fetch-start', reason })
    try {
      const result = await fetcherRef.current(signal)
      if (!gate.isCurrent(seq)) return
      dispatch({ type: 'fetch-resolve', result, at: Date.now() })
    } catch (error) {
      if (!gate.isCurrent(seq) || signal.aborted) return
      dispatch({ type: 'fetch-reject', kind: 'offline', message: error && error.message })
    }
  }, [])

  useEffect(() => {
    if (!enabled) return undefined
    dispatch({ type: 'mount' })
    runFetch('mount')

    const timer = cadenceMs ? createCadenceTimer({ cadenceMs, onTick: () => runFetch('cadence') }) : null
    if (timer) timer.start()

    const onVisibility = () => {
      if (!timer) return
      if (document.hidden) timer.pause()
      else timer.resume()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      if (timer) timer.pause()
      gateRef.current.abort('unmount')
    }
  }, [enabled, cadenceMs, runFetch])

  const retry = useCallback(() => {
    if (!enabled) return
    dispatch({ type: 'retry' })
    runFetch('retry')
  }, [enabled, runFetch])

  return {
    status: state.status,
    data: state.data,
    lastGood: state.lastGood,
    updatedAt: state.updatedAt,
    error: state.error,
    retry,
    classification: state.classification,
  }
}
