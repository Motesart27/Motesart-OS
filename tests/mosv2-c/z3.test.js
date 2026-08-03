// z3.test.js — Z3 Business pure-logic tests (PLAN §8 Z3, rulings G2/G4/§3.8,
// §13). No DOM: every behavior under test lives in the pure module
// z3Business.js plus the tasks adapter's pulse mapper, the tile state
// machine's mock-rejection law, the deterministic-state hook entry, and the
// Z3 fixture state specimens.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { mapPulse } from '../../src/v2/data/adapters/tasks.js'
import {
  DATA_CLASSIFICATION,
  TILE_STATUS,
  createTileState,
  transition,
} from '../../src/v2/data/tileMachine.js'
import { initialTileSourceState } from '../../src/v2/data/useTileSource.js'
import {
  FIXTURE_CLASSIFICATION,
  UNAVAILABLE_COPY,
  fixtureFmMockPayload,
  fixtureFmStats,
  fixturePulse,
  fixtureRevenueSeries,
  fixtureTileStates,
} from '../../src/v2/data/fixtures.js'
import {
  PULSE_ROWS,
  REVENUE_RANGES,
  chartGeometry,
  crosshairAnnouncement,
  crosshairIndex,
  fmStatViews,
  formatChartDate,
  formatMoney,
  nearestPointIndex,
  pulseRows,
} from '../../src/v2/zones/z3Business.js'

// ─── Z3 pulse rows (live candidate via the tasks adapter) ───────────────────

describe('z3Business · pulseRows', () => {
  it('renders all six buckets in the plan field order with text labels + tones', () => {
    const rows = pulseRows({ urgent: 2, overdue: 1, blocked: 0, approval: 1, done_today: 3, stale: 0 })
    assert.deepEqual(rows.map((r) => r.key), ['urgent', 'overdue', 'blocked', 'approval', 'done_today', 'stale'])
    assert.deepEqual(rows.map((r) => r.count), [2, 1, 0, 1, 3, 0])
    assert.ok(rows.every((r) => typeof r.label === 'string' && r.label.length > 0))
    assert.equal(PULSE_ROWS.length, 6)
  })

  it('missing/non-numeric buckets render as 0 — a bucket never disappears or crashes', () => {
    const rows = pulseRows({ urgent: 4, blocked: 'lots', stale: -2 })
    assert.deepEqual(rows.map((r) => r.count), [4, 0, 0, 0, 0, 0])
    assert.deepEqual(pulseRows(null).map((r) => r.count), [0, 0, 0, 0, 0, 0])
    assert.deepEqual(pulseRows(undefined).map((r) => r.count), [0, 0, 0, 0, 0, 0])
  })
})

describe('z3 fixtures · pulse (bucket-array counts)', () => {
  it('fixture pulse maps to the known counts (live-audit shape: arrays, not counts)', () => {
    const view = mapPulse(fixturePulse)
    assert.deepEqual(view.counts, fixturePulse.expectedCounts)
    assert.equal(view.total, 7)
    assert.equal(view.empty, false)
    assert.deepEqual(pulseRows(view.counts).map((r) => r.count), [2, 1, 0, 1, 3, 0])
  })

  it('all-empty buckets map to the quiet-empty path, never an error', () => {
    const view = mapPulse({ ok: true, pulse: {} })
    assert.equal(view.empty, true)
    assert.deepEqual(view.counts, { urgent: 0, overdue: 0, blocked: 0, approval: 0, done_today: 0, stale: 0 })
  })
})

// ─── FM stat formatting (§3.8: FIXTURE demonstration path only) ─────────────

describe('z3Business · FM stat formatting', () => {
  it('formatMoney renders tabular dollars; absent/non-finite → null (em-dash path)', () => {
    assert.equal(formatMoney(48240), '$48,240')
    assert.equal(formatMoney(0), '$0')
    assert.equal(formatMoney(null), null)
    assert.equal(formatMoney(undefined), null)
    assert.equal(formatMoney('48240'), null)
    assert.equal(formatMoney(NaN), null)
    assert.equal(formatMoney(Infinity), null)
  })

  it('fmStatViews keeps plan field order; absent fields keep label with null value (§8 partial)', () => {
    const views = fmStatViews(fixtureFmStats.ytd)
    assert.deepEqual(views.map((v) => v.key), ['income', 'expenses', 'net'])
    assert.deepEqual(views.map((v) => v.value), ['$48,240', '$31,980', '$16,260'])
    const sparse = fmStatViews({ income: 100 })
    assert.deepEqual(sparse.map((v) => v.value), ['$100', null, null])
    assert.deepEqual(fmStatViews(null).map((v) => v.value), [null, null, null])
  })
})

// ─── §3.6 mock rejection + §3.8 fail-closed entry ────────────────────────────

describe('z3 · FM mock rejection and pre-B2 fail-closed law', () => {
  it('a "status":"mock" FM payload resolves to error — never populated (§3.6)', () => {
    const state = transition(createTileState({ status: TILE_STATUS.LOADING }), {
      type: 'resolve',
      payload: fixtureFmMockPayload,
      resolution: 'populated',
    })
    assert.equal(state.status, TILE_STATUS.ERROR)
    assert.equal(state.error.kind, 'mock')
    assert.equal(state.error.mock, true)
    assert.equal(state.data, null, 'mock values never reach tile data')
  })

  it('the fixture mock-rejection specimen mirrors that machine outcome', () => {
    const specimen = fixtureTileStates.z3FmMockRejection
    assert.equal(specimen.classification, FIXTURE_CLASSIFICATION)
    assert.equal(specimen.mockPayload, fixtureFmMockPayload)
    assert.equal(specimen.resultingState.status, 'error')
    assert.equal(specimen.resultingState.error.kind, 'mock')
    assert.equal(specimen.resultingState.error.mock, true)
  })

  it('pre-B2 deterministic entries: FM → b2-pending, SOM/revenue → quiet empty; no fetch path', () => {
    const fm = initialTileSourceState({ enabled: false, classification: DATA_CLASSIFICATION.UNAVAILABLE_LIVE })
    assert.equal(fm.status, TILE_STATUS.B2_PENDING)
    const som = initialTileSourceState({ enabled: false, classification: DATA_CLASSIFICATION.DEFERRED })
    assert.equal(som.status, TILE_STATUS.EMPTY)
    const revenue = initialTileSourceState({ enabled: false, classification: DATA_CLASSIFICATION.DEFERRED })
    assert.equal(revenue.status, TILE_STATUS.EMPTY)
  })

  it('b2-pending is terminal without B2-green: resolve/reject events cannot move it', () => {
    const pending = initialTileSourceState({ enabled: false, classification: DATA_CLASSIFICATION.UNAVAILABLE_LIVE })
    const afterResolve = transition(pending, { type: 'resolve', payload: fixtureFmStats, resolution: 'populated' })
    assert.equal(afterResolve.status, TILE_STATUS.B2_PENDING)
    assert.equal(afterResolve.data, null)
  })
})

// ─── Revenue chart geometry (G4: verbatim fixture points, zero-anchored) ─────

describe('z3Business · chartGeometry', () => {
  it('7D fixture → one coordinate per hand-written point, in order', () => {
    const points = fixtureRevenueSeries['7D'].points
    const geometry = chartGeometry(points, { width: 320, height: 120, padX: 4, padY: 8 })
    assert.equal(geometry.coords.length, 7)
    assert.deepEqual(geometry.coords.map((c) => c.point), points)
    assert.equal(geometry.coords[0].x, 4)
    assert.equal(geometry.coords[6].x, 316)
  })

  it('scale truthfulness: y domain anchored at zero; max value touches the top pad', () => {
    const geometry = chartGeometry(fixtureRevenueSeries['7D'].points, { width: 320, height: 120, padX: 4, padY: 8 })
    assert.equal(geometry.max, 536)
    assert.equal(geometry.baseline, 112)
    const topCoord = geometry.coords.find((c) => c.point.value === 536)
    assert.equal(topCoord.y, 8)
    // A zero-valued point would sit exactly on the baseline — never truncated.
    const withZero = chartGeometry([{ date: '2026-08-01', value: 0 }, { date: '2026-08-02', value: 10 }])
    assert.equal(withZero.coords[0].y, withZero.baseline)
  })

  it('area path closes to the baseline at both ends', () => {
    const geometry = chartGeometry(fixtureRevenueSeries['7D'].points)
    assert.match(geometry.areaPath, / Z$/)
    assert.ok(geometry.areaPath.includes(`L316,${geometry.baseline}`))
    assert.ok(geometry.areaPath.includes(`L4,${geometry.baseline}`))
    assert.equal(geometry.linePath.startsWith('M'), true)
  })

  it('30D and QTD fixtures carry 30 and 33 verbatim daily points (no resampling)', () => {
    assert.equal(fixtureRevenueSeries['30D'].points.length, 30)
    assert.equal(fixtureRevenueSeries.QTD.points.length, 33)
    assert.equal(chartGeometry(fixtureRevenueSeries['30D'].points).coords.length, 30)
    assert.equal(chartGeometry(fixtureRevenueSeries.QTD.points).coords.length, 33)
  })

  it('empty/absent/non-numeric series → null (quiet state, never a fabricated line)', () => {
    assert.equal(chartGeometry([]), null)
    assert.equal(chartGeometry(null), null)
    assert.equal(chartGeometry(undefined), null)
    assert.equal(chartGeometry([{ date: '2026-08-01', value: 'lots' }]), null)
  })
})

// ─── Crosshair behavior (9.1 keyboard + pointer) ─────────────────────────────

describe('z3Business · crosshair', () => {
  it('arrows step one point clamped at the ends; Home/End jump to endpoints', () => {
    assert.equal(crosshairIndex(3, 'ArrowLeft', 7), 2)
    assert.equal(crosshairIndex(3, 'ArrowRight', 7), 4)
    assert.equal(crosshairIndex(0, 'ArrowLeft', 7), 0)
    assert.equal(crosshairIndex(6, 'ArrowRight', 7), 6)
    assert.equal(crosshairIndex(3, 'Home', 7), 0)
    assert.equal(crosshairIndex(3, 'End', 7), 6)
    assert.equal(crosshairIndex(null, 'ArrowRight', 7), 1)
    assert.equal(crosshairIndex(2, 'Tab', 7), 2, 'non-crosshair keys leave the index')
    assert.equal(crosshairIndex(0, 'ArrowRight', 0), -1, 'empty series has no crosshair')
  })

  it('per-step polite announcement renders "‹date› — ‹value›"', () => {
    assert.equal(crosshairAnnouncement({ date: '2026-08-02', value: 536 }), 'Aug 2 — $536')
    assert.equal(crosshairAnnouncement(null), '')
    assert.equal(crosshairAnnouncement({ date: '2026-08-02', value: null }), 'Aug 2 — —')
  })

  it('nearestPointIndex picks the closest plotted x for the pointer crosshair', () => {
    const geometry = chartGeometry(fixtureRevenueSeries['7D'].points, { width: 320, height: 120, padX: 4, padY: 8 })
    assert.equal(nearestPointIndex(geometry.coords, geometry.coords[2].x), 2)
    assert.equal(nearestPointIndex(geometry.coords, 0), 0)
    assert.equal(nearestPointIndex(geometry.coords, 320), 6)
    assert.equal(nearestPointIndex([], 100), -1)
    assert.equal(nearestPointIndex(geometry.coords, NaN), -1)
  })

  it('formatChartDate renders fixture dates as local calendar days; bad input → em-dash', () => {
    assert.equal(formatChartDate('2026-07-27'), 'Jul 27')
    assert.equal(formatChartDate('2026-08-02'), 'Aug 2')
    assert.equal(formatChartDate('not-a-date'), '—')
    assert.equal(formatChartDate(null), '—')
  })

  it('ranges are exactly 7D / 30D / QTD and every fixture range is present', () => {
    assert.deepEqual([...REVENUE_RANGES], ['7D', '30D', 'QTD'])
    for (const range of REVENUE_RANGES) {
      assert.ok(fixtureRevenueSeries[range], `fixture series for ${range} must exist`)
      assert.equal(fixtureRevenueSeries[range].range, range)
    }
  })
})

// ─── Z3 fixture state specimens (every §9 state, FIXTURE-labeled, ruled copy) ─

describe('z3 fixtures · tile state specimens', () => {
  const CANONICAL_STATES = [
    'loading',
    'populated',
    'empty',
    'partial',
    'stale',
    'error',
    'permission-denied',
    'offline',
    'b2-pending',
  ]

  for (const [tile, unavailableCopy] of [
    ['z3RevenueChart', UNAVAILABLE_COPY.REVENUE_DEFERRED],
    ['z3FmStats', UNAVAILABLE_COPY.FM_PRE_B2],
    ['z3Pulse', UNAVAILABLE_COPY.FM_PRE_B2],
    ['z3SomCount', UNAVAILABLE_COPY.SOM_DEFERRED],
  ]) {
    it(`${tile} covers every canonical state, FIXTURE-labeled, with ruled copy`, () => {
      const states = fixtureTileStates[tile]
      for (const name of CANONICAL_STATES) {
        assert.ok(states[name], `${tile}.${name} must exist`)
        assert.equal(states[name].status, name)
        assert.equal(states[name].classification, FIXTURE_CLASSIFICATION)
      }
      assert.equal(states['b2-pending'].copy, unavailableCopy)
      assert.equal(states.stale.data != null, true, 'stale keeps last-good data')
      assert.equal(states.error.data, null, 'error never carries data')
      assert.equal(states['permission-denied'].error.kind, 'permission')
    })
  }

  it('ruled copy is exact (§13 deferred/unavailable truthfulness)', () => {
    assert.equal(UNAVAILABLE_COPY.FM_PRE_B2, 'Financial data unavailable — verification pending.')
    assert.equal(UNAVAILABLE_COPY.SOM_DEFERRED, 'SOM data connection pending.')
    assert.equal(UNAVAILABLE_COPY.REVENUE_DEFERRED, 'Revenue trend unavailable — daily source not connected.')
  })
})

// ─── Z3 source law (static source scan, zero network) ───────────────────────

describe('z3 · source restriction law (G2/G4/§3.8)', () => {
  const zoneSource = readFileSync(
    fileURLToPath(new URL('../../src/v2/zones/Z3Business.jsx', import.meta.url)),
    'utf8',
  )
  // Comments name the deferred sources by law; the scan covers code only.
  const codeOnly = zoneSource
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('//'))
    .join('\n')

  it('Z3 fetches only through the tasks adapter (pulse) — no other adapter imports', () => {
    assert.match(codeOnly, /adapters\/tasks\.js/)
    assert.equal(/adapters\/(calendar|auditLog|personal|book)\.js/.test(codeOnly), false)
  })

  it('no SOM /students route access, no FM endpoint, no revenue-series source (G2/G4/§3.8)', () => {
    assert.equal(/\/students/.test(codeOnly), false)
    assert.equal(/\/api\/fm/.test(codeOnly), false)
    assert.equal(/\/api\/(?!pulse|tasks)/.test(codeOnly), false, 'no endpoint other than /api/pulse or /api/tasks')
    assert.equal(/fixtures\.js/.test(codeOnly), false, 'zone never imports the fixture module')
  })

  it('no direct network and no absolute URLs anywhere in the zone (§3.5)', () => {
    assert.equal(/(?<![A-Za-z])fetch\s*\(/.test(codeOnly), false)
    assert.equal(/XMLHttpRequest/.test(codeOnly), false)
    assert.equal(/https?:\/\//.test(codeOnly), false)
  })

  it('the ruled unavailability copies ship verbatim in the live tiles', () => {
    assert.ok(codeOnly.includes(UNAVAILABLE_COPY.FM_PRE_B2))
    assert.ok(codeOnly.includes(UNAVAILABLE_COPY.SOM_DEFERRED))
    assert.ok(codeOnly.includes(UNAVAILABLE_COPY.REVENUE_DEFERRED))
  })

  it('z3Business.js stays pure: no fetch, no React, no adapter imports', () => {
    const logicSource = readFileSync(
      fileURLToPath(new URL('../../src/v2/zones/z3Business.js', import.meta.url)),
      'utf8',
    )
    const logicCodeOnly = logicSource
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('//'))
      .join('\n')
    assert.equal(/(?<![A-Za-z])fetch\s*\(/.test(logicCodeOnly), false)
    assert.equal(/from 'react'/.test(logicCodeOnly), false)
    assert.equal(/adapters\//.test(logicCodeOnly), false)
    assert.equal(/https?:\/\//.test(logicCodeOnly), false)
  })
})
