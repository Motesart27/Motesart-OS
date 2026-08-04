// fixtures.test.js — MOSV2-C fixture law: determinism, FIXTURE classification
// on every tile fixture, mock-payload detection (§3.6), chart series lengths
// (7/30/QTD, G4), countdown proof, and a zero-network static scan (9.6).

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  FIXTURE_CLASSIFICATION,
  FIXTURE_NOW_MS,
  fixtureCountdowns,
  fixtureFmMockPayload,
  fixturePulse,
  fixtureRevenueSeries,
  fixtureSignals,
  fixtureTileStates,
} from '../../src/v2/data/fixtures.js'
import { computeCountdown, isMockPayload, rankSignals } from '../../src/v2/data/tileMachine.js'

describe('fixtures · determinism', () => {
  it('repeated reads are byte-identical', async () => {
    const fresh = await import('../../src/v2/data/fixtures.js')
    assert.equal(JSON.stringify(fresh.fixturePulse), JSON.stringify(fixturePulse))
    assert.equal(JSON.stringify(fresh.fixtureRevenueSeries), JSON.stringify(fixtureRevenueSeries))
  })

  it('every tile fixture and state specimen is classified FIXTURE', () => {
    assert.equal(FIXTURE_CLASSIFICATION, 'FIXTURE')
    assert.equal(fixtureSignals.classification, 'FIXTURE')
    assert.equal(fixturePulse.classification, 'FIXTURE')
    assert.equal(fixtureRevenueSeries.classification, 'FIXTURE')
    assert.equal(fixtureTileStates.classification, 'FIXTURE')
    for (const [tile, states] of Object.entries(fixtureTileStates)) {
      if (tile === 'classification') continue
      for (const [name, specimen] of Object.entries(states)) {
        if (specimen && typeof specimen === 'object' && 'classification' in specimen) {
          assert.equal(specimen.classification, 'FIXTURE', `${tile}.${name} must be FIXTURE-labeled`)
        }
      }
    }
  })
})

describe('fixtures · signal ranking proof', () => {
  it('the known-severity set ranks exactly as specified and drops the 7th', () => {
    const ranked = rankSignals(fixtureSignals.signals)
    assert.deepEqual(ranked.map((s) => s.id), [...fixtureSignals.expectedOrder])
    assert.equal(ranked.some((s) => s.id === fixtureSignals.expectedDropped), false)
  })
})

describe('fixtures · countdown proof', () => {
  it('the dated fixture produces the recorded days/hours at the frozen clock', () => {
    for (const countdown of fixtureCountdowns.countdowns) {
      const result = computeCountdown(countdown.targetDate, FIXTURE_NOW_MS)
      assert.deepEqual({ days: result.days, hours: result.hours }, { days: countdown.expected.days, hours: countdown.expected.hours }, countdown.label)
    }
  })
})

describe('fixtures · mock rejection proof (§3.6)', () => {
  it('the FM mock payload is detected and carries the marker', () => {
    assert.equal(isMockPayload(fixtureFmMockPayload), true)
    assert.equal(fixtureFmMockPayload.status, 'mock')
  })

  it('the mock rejection specimen resolves to an error state, never populated', () => {
    const { resultingState } = fixtureTileStates.z3FmMockRejection
    assert.equal(resultingState.status, 'error')
    assert.equal(resultingState.error.mock, true)
    assert.equal(resultingState.data, null)
  })
})

describe('fixtures · revenue chart series (G4)', () => {
  it('7D/30D/QTD series have exact lengths and known values', () => {
    assert.equal(fixtureRevenueSeries['7D'].points.length, 7)
    assert.equal(fixtureRevenueSeries['30D'].points.length, 30)
    assert.equal(fixtureRevenueSeries.QTD.points.length, 33)
    assert.equal(fixtureRevenueSeries['7D'].points[0].date, '2026-07-27')
    assert.equal(fixtureRevenueSeries['7D'].points.at(-1).value, 536)
    assert.equal(fixtureRevenueSeries['30D'].points.at(-1).date, '2026-08-02')
  })

  it('QTD is daily points only — never monthly values subdivided', () => {
    const dates = fixtureRevenueSeries.QTD.points.map((p) => p.date)
    assert.equal(new Set(dates).size, dates.length, 'no duplicated dates')
    for (let i = 1; i < dates.length; i += 1) {
      const prev = new Date(`${dates[i - 1]}T00:00:00Z`).getTime()
      const curr = new Date(`${dates[i]}T00:00:00Z`).getTime()
      assert.equal(curr - prev, 86400000, `${dates[i - 1]} → ${dates[i]} must be consecutive days`)
    }
  })
})

describe('fixtures · pulse arrays (live-audit clarification)', () => {
  it('buckets are arrays whose lengths match the recorded counts', () => {
    for (const [bucket, expected] of Object.entries(fixturePulse.expectedCounts)) {
      assert.ok(Array.isArray(fixturePulse.pulse[bucket]), `${bucket} must be an array`)
      assert.equal(fixturePulse.pulse[bucket].length, expected)
    }
  })
})

describe('fixtures · zero network (9.6)', () => {
  it('fixtures.js contains no fetch, XHR, or URL strings', () => {
    const source = readFileSync(fileURLToPath(new URL('../../src/v2/data/fixtures.js', import.meta.url)), 'utf8')
    assert.equal(/fetch\s*\(/.test(source), false)
    assert.equal(/XMLHttpRequest/.test(source), false)
    assert.equal(/https?:\/\//.test(source), false)
  })
})
