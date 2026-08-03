// useTileSource.test.js — MOSV2-C hook logic at the pure level: initial state
// (incl. §3.8 b2-pending), reducer transitions (silent refresh, stale, retry),
// cadence pause/resume without burst, and abort-on-supersede. No DOM required.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  createCadenceTimer,
  createFetchGate,
  initialTileSourceState,
  tileSourceReducer,
} from '../../src/v2/data/useTileSource.js'
import { DATA_CLASSIFICATION, TILE_STATUS } from '../../src/v2/data/tileMachine.js'

const S = TILE_STATUS

describe('useTileSource · initial state', () => {
  it('enabled tiles start idle', () => {
    assert.equal(initialTileSourceState({ enabled: true }).status, S.IDLE)
  })

  it('enabled:false + UNAVAILABLE_LIVE → b2-pending, no fetch ever (§3.8)', () => {
    const state = initialTileSourceState({ enabled: false, classification: DATA_CLASSIFICATION.UNAVAILABLE_LIVE })
    assert.equal(state.status, S.B2_PENDING)
    assert.equal(state.classification, 'UNAVAILABLE_LIVE')
    assert.equal(state.data, null)
  })

  it('enabled:false + DEFERRED → quiet empty (G2/G4)', () => {
    const state = initialTileSourceState({ enabled: false, classification: DATA_CLASSIFICATION.DEFERRED })
    assert.equal(state.status, S.EMPTY)
    assert.equal(state.classification, 'DEFERRED')
  })
})

describe('useTileSource · reducer', () => {
  const mount = () => tileSourceReducer(initialTileSourceState({ enabled: true }), { type: 'mount' })

  it('mount → loading, then ok result → populated with lastGood/updatedAt', () => {
    let state = mount()
    assert.equal(state.status, S.LOADING)
    state = tileSourceReducer(state, { type: 'fetch-resolve', result: { ok: true, status: 200, data: { v: 1 }, errorKind: null }, at: 1234 })
    assert.equal(state.status, S.POPULATED)
    assert.deepEqual(state.data, { v: 1 })
    assert.deepEqual(state.lastGood, { v: 1 })
    assert.equal(state.updatedAt, 1234)
  })

  it('fetcher annotations: resolution empty and viewData win over raw payload', () => {
    let state = mount()
    state = tileSourceReducer(state, {
      type: 'fetch-resolve',
      result: { ok: true, status: 200, data: { ok: true, tasks: [] }, viewData: { tasks: [] }, resolution: 'empty', errorKind: null },
      at: 1,
    })
    assert.equal(state.status, S.EMPTY)
    assert.deepEqual(state.data, { tasks: [] })
  })

  it('silent refresh: cadence start never re-enters loading when content exists', () => {
    let state = mount()
    state = tileSourceReducer(state, { type: 'fetch-resolve', result: { ok: true, data: { v: 1 } }, at: 1 })
    const refreshed = tileSourceReducer(state, { type: 'fetch-start', reason: 'cadence' })
    assert.equal(refreshed.status, S.POPULATED, 'no skeleton replay on passive refresh')
    assert.deepEqual(refreshed.data, { v: 1 })
  })

  it('silent refresh: failed cadence goes stale and keeps last-good', () => {
    let state = mount()
    state = tileSourceReducer(state, { type: 'fetch-resolve', result: { ok: true, data: { v: 1 } }, at: 1 })
    state = tileSourceReducer(state, { type: 'fetch-start', reason: 'cadence' })
    state = tileSourceReducer(state, { type: 'fetch-resolve', result: { ok: false, status: 502, data: null, errorKind: 'http' } })
    assert.equal(state.status, S.STALE)
    assert.deepEqual(state.data, { v: 1 })
  })

  it('permission result without last-good → permission-denied; with last-good → stale', () => {
    let state = mount()
    state = tileSourceReducer(state, { type: 'fetch-resolve', result: { ok: false, status: 401, data: null, errorKind: 'permission' } })
    assert.equal(state.status, S.PERMISSION_DENIED)

    let rich = tileSourceReducer(mount(), { type: 'fetch-resolve', result: { ok: true, data: { v: 1 } }, at: 1 })
    rich = tileSourceReducer(rich, { type: 'fetch-resolve', result: { ok: false, status: 403, data: null, errorKind: 'permission' } })
    assert.equal(rich.status, S.STALE)
    assert.equal(rich.error.kind, 'permission')
  })

  it('mock result → error classified MOCK, never populated (§3.6)', () => {
    let state = mount()
    state = tileSourceReducer(state, { type: 'fetch-resolve', result: { ok: false, status: 200, data: { status: 'mock' }, errorKind: 'mock' } })
    assert.equal(state.status, S.ERROR)
    assert.equal(state.classification, DATA_CLASSIFICATION.MOCK)
    assert.equal(state.error.mock, true)
  })

  it('defense in depth: ok result carrying a mock payload still lands in error', () => {
    let state = mount()
    state = tileSourceReducer(state, { type: 'fetch-resolve', result: { ok: true, status: 200, data: { status: 'mock', ytd: { income: 1 } }, errorKind: null }, at: 1 })
    assert.equal(state.status, S.ERROR)
    assert.equal(state.classification, DATA_CLASSIFICATION.MOCK)
    assert.equal(state.data, null)
  })

  it('retry: error → loading once, then a good result populates', () => {
    let state = mount()
    state = tileSourceReducer(state, { type: 'fetch-resolve', result: { ok: false, status: 500, data: null, errorKind: 'http' } })
    assert.equal(state.status, S.ERROR)
    state = tileSourceReducer(state, { type: 'retry' })
    assert.equal(state.status, S.LOADING)
    state = tileSourceReducer(state, { type: 'fetch-resolve', result: { ok: true, data: { v: 2 } }, at: 2 })
    assert.equal(state.status, S.POPULATED)
  })

  it('thrown fetcher error → offline reject semantics', () => {
    let state = mount()
    state = tileSourceReducer(state, { type: 'fetch-reject', kind: 'offline', message: 'fetch failed' })
    assert.equal(state.status, S.OFFLINE)
  })

  it('malformed adapter result → parse rejection, never a crash', () => {
    const state = tileSourceReducer(mount(), { type: 'fetch-resolve', result: undefined })
    assert.equal(state.status, S.ERROR)
    assert.equal(state.error.kind, 'parse')
  })
})

describe('useTileSource · cadence timer (9.3 hidden-tab law)', () => {
  function harness(cadenceMs = 60000) {
    const pending = new Map()
    let id = 0
    let now = 1000000
    const ticks = []
    const timer = createCadenceTimer({
      cadenceMs,
      onTick: () => ticks.push(now),
      now: () => now,
      setTimeoutFn: (fn, delay) => { id += 1; pending.set(id, { fn, delay }); return id },
      clearTimeoutFn: (handle) => pending.delete(handle),
    })
    return {
      timer,
      ticks,
      advance: (ms) => { now += ms },
      fireNext: () => {
        const [handle, entry] = [...pending.entries()].sort((a, b) => a[1].delay - b[1].delay)[0]
        pending.delete(handle)
        entry.fn()
      },
      pendingCount: () => pending.size,
    }
  }

  it('ticks on cadence and reschedules', () => {
    const h = harness()
    h.timer.start()
    assert.equal(h.pendingCount(), 1)
    h.advance(60000)
    h.fireNext()
    assert.equal(h.ticks.length, 1)
    assert.equal(h.pendingCount(), 1, 'rescheduled after tick')
  })

  it('pause stops all timers; resume before a missed tick schedules the remainder without ticking', () => {
    const h = harness()
    h.timer.start()
    h.advance(20000) // hidden 20s into a 60s cadence
    h.timer.pause()
    assert.equal(h.pendingCount(), 0)
    h.advance(20000)
    h.timer.resume()
    assert.equal(h.ticks.length, 0, 'no catch-up — no tick was missed')
    assert.equal(h.pendingCount(), 1)
  })

  it('resume after missed ticks fires exactly ONE catch-up — never a burst', () => {
    const h = harness()
    h.timer.start()
    h.advance(20000)
    h.timer.pause()
    h.advance(185000) // hidden for >3 cadence periods
    h.timer.resume()
    assert.equal(h.ticks.length, 1, 'single catch-up tick only')
    assert.equal(h.pendingCount(), 1, 'regular cadence rescheduled')
  })

  it('start is idempotent', () => {
    const h = harness()
    h.timer.start()
    h.timer.start()
    assert.equal(h.pendingCount(), 1)
  })
})

describe('useTileSource · fetch gate (abort on supersede/unmount)', () => {
  it('next() aborts the previous fetch with reason superseded', () => {
    const gate = createFetchGate()
    const first = gate.next()
    const second = gate.next()
    assert.equal(first.signal.aborted, true)
    assert.equal(first.signal.reason, 'superseded')
    assert.equal(second.signal.aborted, false)
    assert.equal(gate.isCurrent(first.seq), false)
    assert.equal(gate.isCurrent(second.seq), true)
  })

  it('abort() invalidates in-flight fetches (unmount)', () => {
    const gate = createFetchGate()
    const current = gate.next()
    gate.abort('unmount')
    assert.equal(current.signal.aborted, true)
    assert.equal(current.signal.reason, 'unmount')
    assert.equal(gate.isCurrent(current.seq), false)
  })
})
