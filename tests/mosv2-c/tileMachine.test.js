// tileMachine.test.js — MOSV2-C PLAN §9 machine: lawful transitions, forbidden
// transitions impossible, mock rejection (§3.6), signal ranking, countdown.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  DATA_CLASSIFICATION,
  MAX_SIGNALS,
  SIGNAL_SEVERITY_ORDER,
  TILE_STATUS,
  computeCountdown,
  createTileState,
  isMockPayload,
  rankSignals,
  transition,
} from '../../src/v2/data/tileMachine.js'

const S = TILE_STATUS

describe('tileMachine · lawful transitions (PLAN §9)', () => {
  it('mount: idle → loading', () => {
    const next = transition(createTileState(), { type: 'mount' })
    assert.equal(next.status, S.LOADING)
  })

  it('resolve: loading → populated with data, lastGood and updatedAt', () => {
    const loading = transition(createTileState(), { type: 'mount' })
    const next = transition(loading, { type: 'resolve', payload: { items: [1] }, at: 1000 })
    assert.equal(next.status, S.POPULATED)
    assert.deepEqual(next.data, { items: [1] })
    assert.deepEqual(next.lastGood, { items: [1] })
    assert.equal(next.updatedAt, 1000)
    assert.equal(next.error, null)
  })

  it('resolve: loading → empty', () => {
    const loading = transition(createTileState(), { type: 'mount' })
    const next = transition(loading, { type: 'resolve', payload: { items: [] }, resolution: 'empty', at: 1000 })
    assert.equal(next.status, S.EMPTY)
  })

  it('resolve: loading → partial', () => {
    const loading = transition(createTileState(), { type: 'mount' })
    const next = transition(loading, { type: 'resolve', payload: { a: 1 }, resolution: 'partial', at: 1000 })
    assert.equal(next.status, S.PARTIAL)
    assert.deepEqual(next.lastGood, { a: 1 })
  })

  it('reject without last-good: loading → error', () => {
    const loading = transition(createTileState(), { type: 'mount' })
    const next = transition(loading, { type: 'reject', kind: 'http' })
    assert.equal(next.status, S.ERROR)
    assert.equal(next.error.kind, 'http')
  })

  it('reject with last-good: populated → stale, data retained', () => {
    const populated = transition(createTileState({ status: S.LOADING }), { type: 'resolve', payload: { v: 1 }, at: 1 })
    const next = transition(populated, { type: 'reject', kind: 'http' })
    assert.equal(next.status, S.STALE)
    assert.deepEqual(next.data, { v: 1 })
    assert.deepEqual(next.lastGood, { v: 1 })
  })

  it('reject kind permission without last-good → permission-denied', () => {
    const loading = transition(createTileState(), { type: 'mount' })
    const next = transition(loading, { type: 'reject', kind: 'permission' })
    assert.equal(next.status, S.PERMISSION_DENIED)
  })

  it('reject kind permission with last-good → stale (never blanks data)', () => {
    const populated = transition(createTileState({ status: S.LOADING }), { type: 'resolve', payload: { v: 1 }, at: 1 })
    const next = transition(populated, { type: 'reject', kind: 'permission' })
    assert.equal(next.status, S.STALE)
    assert.equal(next.error.kind, 'permission')
  })

  it('reject kind offline without last-good → offline; with last-good → stale', () => {
    const loading = transition(createTileState(), { type: 'mount' })
    assert.equal(transition(loading, { type: 'reject', kind: 'offline' }).status, S.OFFLINE)
    const populated = transition(createTileState({ status: S.LOADING }), { type: 'resolve', payload: { v: 1 }, at: 1 })
    assert.equal(transition(populated, { type: 'reject', kind: 'offline' }).status, S.STALE)
  })

  it('freshness expiry: populated → stale; empty stays empty', () => {
    const populated = createTileState({ status: S.POPULATED, data: { v: 1 }, lastGood: { v: 1 } })
    assert.equal(transition(populated, { type: 'expire' }).status, S.STALE)
    const empty = createTileState({ status: S.EMPTY })
    assert.equal(transition(empty, { type: 'expire' }).status, S.EMPTY)
  })

  it('retry: error → loading; permission-denied → loading; offline → loading', () => {
    assert.equal(transition(createTileState({ status: S.ERROR }), { type: 'retry' }).status, S.LOADING)
    assert.equal(transition(createTileState({ status: S.PERMISSION_DENIED }), { type: 'retry' }).status, S.LOADING)
    assert.equal(transition(createTileState({ status: S.OFFLINE }), { type: 'retry' }).status, S.LOADING)
  })

  it('stale recovers to populated on a good refresh', () => {
    const stale = createTileState({ status: S.STALE, data: { v: 1 }, lastGood: { v: 1 } })
    const next = transition(stale, { type: 'resolve', payload: { v: 2 }, at: 2000 })
    assert.equal(next.status, S.POPULATED)
    assert.deepEqual(next.data, { v: 2 })
    assert.equal(next.updatedAt, 2000)
  })
})

describe('tileMachine · forbidden transitions are impossible by construction', () => {
  it('idle cannot resolve — a fetch must mount first', () => {
    const idle = createTileState()
    assert.equal(transition(idle, { type: 'resolve', payload: { v: 1 } }).status, S.IDLE)
  })

  it('b2-pending cannot resolve or reject — no fetch exists pre-B2 (§3.8)', () => {
    const pending = createTileState({ status: S.B2_PENDING })
    assert.equal(transition(pending, { type: 'resolve', payload: { v: 1 } }).status, S.B2_PENDING)
    assert.equal(transition(pending, { type: 'reject', kind: 'http' }).status, S.B2_PENDING)
    assert.equal(transition(pending, { type: 'retry' }).status, S.B2_PENDING)
  })

  it('a failed refresh never produces empty or loading from populated', () => {
    const populated = createTileState({ status: S.POPULATED, data: { v: 1 }, lastGood: { v: 1 } })
    for (const kind of ['http', 'permission', 'offline', 'timeout', 'parse', 'mock']) {
      const next = transition(populated, { type: 'reject', kind })
      assert.notEqual(next.status, S.EMPTY, `reject ${kind} must never blank to empty`)
      assert.notEqual(next.status, S.LOADING, `reject ${kind} must never replay skeleton`)
      assert.equal(next.status, S.STALE)
    }
  })

  it('retry from populated is a no-op (no skeleton replay)', () => {
    const populated = createTileState({ status: S.POPULATED, data: { v: 1 } })
    assert.equal(transition(populated, { type: 'retry' }).status, S.POPULATED)
  })

  it('unknown events are no-ops', () => {
    const populated = createTileState({ status: S.POPULATED, data: { v: 1 } })
    assert.equal(transition(populated, { type: 'explode' }), populated)
  })
})

describe('tileMachine · mock rejection (§3.6)', () => {
  it('isMockPayload detects the marker and ignores everything else', () => {
    assert.equal(isMockPayload({ status: 'mock', ytd: { income: 1 } }), true)
    assert.equal(isMockPayload({ status: 'live' }), false)
    assert.equal(isMockPayload({}), false)
    assert.equal(isMockPayload(null), false)
    assert.equal(isMockPayload('mock'), false)
  })

  it('a mock payload resolves to error with mock:true — never populated', () => {
    const loading = transition(createTileState(), { type: 'mount' })
    const next = transition(loading, { type: 'resolve', payload: { status: 'mock', ytd: { income: 99999 } }, at: 1 })
    assert.equal(next.status, S.ERROR)
    assert.equal(next.error.mock, true)
    assert.equal(next.error.kind, 'mock')
    assert.equal(next.data, null, 'mock values must never enter data')
  })

  it('a mock payload during refresh keeps last-good and never populates', () => {
    const populated = createTileState({ status: S.POPULATED, data: { v: 1 }, lastGood: { v: 1 } })
    const next = transition(populated, { type: 'resolve', payload: { status: 'mock' }, at: 2 })
    assert.equal(next.status, S.ERROR)
    assert.equal(next.error.mock, true)
    assert.deepEqual(next.lastGood, { v: 1 }, 'last-good retained for recovery')
    assert.deepEqual(next.data, { v: 1 }, 'previous data untouched by mock payload')
  })
})

describe('tileMachine · signal ranking (crit>exec>ai>warn>info>good, max 6)', () => {
  it('orders by severity and caps at 6, stably', () => {
    const signals = [
      { id: 'g', severity: 'good' },
      { id: 'i1', severity: 'info' },
      { id: 'c', severity: 'crit' },
      { id: 'w', severity: 'warn' },
      { id: 'e', severity: 'exec' },
      { id: 'a', severity: 'ai' },
      { id: 'i2', severity: 'info' },
    ]
    const ranked = rankSignals(signals)
    assert.deepEqual(ranked.map((s) => s.id), ['c', 'e', 'a', 'w', 'i1', 'i2'])
    assert.equal(ranked.length, MAX_SIGNALS)
    assert.equal(ranked.some((s) => s.id === 'g'), false, 'lowest severity drops at max 6')
    assert.equal(signals.length, 7, 'input never mutated')
  })

  it('unknown severities rank last; non-arrays return empty', () => {
    const ranked = rankSignals([{ id: 'x', severity: 'mystery' }, { id: 'c', severity: 'crit' }])
    assert.deepEqual(ranked.map((s) => s.id), ['c', 'x'])
    assert.deepEqual(rankSignals(null), [])
    assert.deepEqual(rankSignals(undefined), [])
    assert.equal(SIGNAL_SEVERITY_ORDER.join(','), 'crit,exec,ai,warn,info,good')
  })
})

describe('tileMachine · countdown math', () => {
  const now = new Date('2026-08-02T20:00:00-04:00').getTime()

  it('returns a truthful days/hours breakdown', () => {
    const result = computeCountdown('2026-08-05T17:00:00-04:00', now)
    assert.deepEqual({ days: result.days, hours: result.hours }, { days: 2, hours: 21 })
    assert.equal(result.totalHours, 69)
  })

  it('accepts Date instances and sub-day remainders', () => {
    const result = computeCountdown(new Date(now + 5 * 3600000), now)
    assert.deepEqual({ days: result.days, hours: result.hours }, { days: 0, hours: 5 })
  })

  it('returns null for past, invalid, or missing targets', () => {
    assert.equal(computeCountdown('2026-08-01T00:00:00-04:00', now), null)
    assert.equal(computeCountdown('not-a-date', now), null)
    assert.equal(computeCountdown(null, now), null)
    assert.equal(computeCountdown(undefined, now), null)
    assert.equal(computeCountdown('2026-08-05T17:00:00-04:00', Number.NaN), null)
  })
})

describe('tileMachine · classifications', () => {
  it('exposes the five data classes (PLAN §0)', () => {
    assert.deepEqual({ ...DATA_CLASSIFICATION }, {
      LIVE: 'LIVE',
      UNAVAILABLE_LIVE: 'UNAVAILABLE_LIVE',
      FIXTURE: 'FIXTURE',
      MOCK: 'MOCK',
      DEFERRED: 'DEFERRED',
    })
  })
})
