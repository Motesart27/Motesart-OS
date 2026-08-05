// gallery.test.js — D1 Phase C specimen harness DOM proof (frozen matrix §6).
// Mounts the production Gallery through react-dom into the mini DOM (helpers/
// dom-mount.mjs) and asserts: every fixtureTileStates state of every tile is
// mounted through the production Tile renderer, the Z3 FIXTURE views render
// (Z3RevenueChart / Z3FMStatsView / Z3SOMCountView), the §3.6 mock rejection
// and Z5 dispatch outcomes are present, and the whole mount produces ZERO
// console errors and ZERO console warnings.
//
// The Gallery page mounts zero network sources by construction — fixtures.js
// never imports anything that touches network; these assertions run offline.

import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  React, act, mount, spyConsole, findAll, byClass, textOf, h,
} from './helpers/dom-mount.mjs'

import { fixtureTileStates } from '../../src/v2/data/fixtures.js'

const { default: Gallery } = await import('../../src/v2/Gallery.jsx')

const STATE_SET_KEYS = [
  'z1Signals', 'z1Agenda', 'z1HandledLog',
  'z2Projects', 'z2Book', 'z2Countdowns',
  'z3RevenueChart', 'z3FmStats', 'z3Pulse', 'z3SomCount',
  'z4PersonalTasks', 'z4PersonalCalendar',
]
const CANONICAL_STATES = [
  'loading', 'populated', 'empty', 'partial', 'stale',
  'error', 'permission-denied', 'offline', 'b2-pending',
]

function specimenFigures(root, tileKey) {
  return findAll(root, (el) => el.getAttribute('data-specimen') === tileKey && el.hasAttribute('data-specimen-state'))
}

let mounted
let consoleSpy

describe('gallery · Phase C specimen harness (D1)', () => {
  before(async () => {
    consoleSpy = spyConsole()
    mounted = await mount(h(Gallery))
  })
  after(async () => {
    await mounted.unmount()
    consoleSpy.restore()
  })

  it('mounts with zero console errors and zero console warnings', () => {
    assert.deepEqual(consoleSpy.calls.error, [], 'zero console.error across the whole Gallery mount')
    assert.deepEqual(consoleSpy.calls.warn, [], 'zero console.warn across the whole Gallery mount')
  })

  it('renders the Phase C specimen harness section', () => {
    assert.match(textOf(mounted.container), /Phase C specimen harness/)
    assert.match(textOf(mounted.container), /FIXTURE — deterministic gallery data · zero network/)
  })

  it('mounts every fixtureTileStates state for all twelve tiles — 108 specimens', () => {
    assert.equal(STATE_SET_KEYS.length, 12)
    for (const key of STATE_SET_KEYS) {
      const figures = specimenFigures(mounted.container, key)
      const expectedStates = Object.keys(fixtureTileStates[key])
      assert.deepEqual(
        expectedStates,
        CANONICAL_STATES,
        `${key} fixture set itself carries exactly the nine §9 states`,
      )
      assert.equal(figures.length, 9, `${key} mounts all nine states`)
      for (const state of CANONICAL_STATES) {
        const figure = figures.find((el) => el.getAttribute('data-specimen-state') === state)
        assert.ok(figure, `${key} · ${state} specimen exists`)
        const tile = byClass(figure, 'v2-tile')[0]
        assert.ok(tile, `${key} · ${state} renders through the production Tile`)
        assert.equal(tile.getAttribute('data-status'), state, `${key} · ${state} tile status matches`)
      }
    }
  })

  it('loading states render the skeleton; error/permission states render a retry control', () => {
    for (const key of STATE_SET_KEYS) {
      const figures = specimenFigures(mounted.container, key)
      const loading = figures.find((el) => el.getAttribute('data-specimen-state') === 'loading')
      assert.ok(byClass(loading, 'v2-tile__skeleton').length >= 1, `${key} loading shows skeleton`)
      for (const state of ['error', 'permission-denied']) {
        const figure = figures.find((el) => el.getAttribute('data-specimen-state') === state)
        assert.ok(byClass(figure, 'v2-tile__retry').length === 1, `${key} ${state} renders one retry control`)
      }
    }
  })

  it('stale and offline states retain last-good content with an "as of" tag (§9 fallback law)', () => {
    for (const key of ['z1Signals', 'z3FmStats', 'z3SomCount', 'z3RevenueChart']) {
      const figures = specimenFigures(mounted.container, key)
      for (const state of ['stale', 'offline']) {
        const figure = figures.find((el) => el.getAttribute('data-specimen-state') === state)
        assert.equal(byClass(figure, 'v2-tile__skeleton').length, 0, `${key} ${state} never blanks to skeleton`)
        assert.ok(byClass(figure, 'v2-tile__asof').length === 1, `${key} ${state} carries the as-of tag`)
        assert.match(textOf(figure), /as of 20:00/, `${key} ${state} timestamps the frozen fixture clock`)
      }
    }
  })

  it('Z3RevenueChart renders the interactive fixture chart in every content state', () => {
    const figures = specimenFigures(mounted.container, 'z3RevenueChart')
    for (const state of ['populated', 'partial', 'stale', 'offline']) {
      const figure = figures.find((el) => el.getAttribute('data-specimen-state') === state)
      const plots = byClass(figure, 'v2-chart__plot')
      assert.equal(plots.length, 1, `${state} chart plot mounted`)
      assert.equal(plots[0].getAttribute('role'), 'img')
      assert.ok(plots[0].getAttribute('aria-label').includes('fixture data'), 'chart is labeled as fixture')
      const ranges = byClass(figure, 'v2-chart__range')
      assert.deepEqual(ranges.map((el) => textOf(el)), ['7D', '30D', 'QTD'])
    }
  })

  it('Z3FMStatsView renders the fixture stat tiles with tabular values', () => {
    const figure = specimenFigures(mounted.container, 'z3FmStats')
      .find((el) => el.getAttribute('data-specimen-state') === 'populated')
    const stats = byClass(figure, 'v2-fm-stat')
    assert.equal(stats.length, 3)
    const text = textOf(figure)
    assert.ok(text.includes('Income YTD') && text.includes('$48,240'), 'fixture income renders')
    assert.ok(text.includes('Net YTD') && text.includes('$16,260'), 'fixture net renders')
  })

  it('Z3SOMCountView renders the eventual populated state', () => {
    const figure = specimenFigures(mounted.container, 'z3SomCount')
      .find((el) => el.getAttribute('data-specimen-state') === 'populated')
    assert.match(textOf(figure), /24/)
    assert.match(textOf(figure), /active students/)
  })

  it('b2-pending specimens carry the ruled unavailability copy for the three deferred tiles', () => {
    const expectations = {
      z3RevenueChart: 'Revenue trend unavailable — daily source not connected.',
      z3FmStats: 'Financial data unavailable — verification pending.',
      z3SomCount: 'SOM data connection pending.',
    }
    for (const [key, copy] of Object.entries(expectations)) {
      const figure = specimenFigures(mounted.container, key)
        .find((el) => el.getAttribute('data-specimen-state') === 'b2-pending')
      assert.ok(textOf(figure).includes(copy), `${key} b2-pending renders the ruled copy`)
    }
  })

  it('the §3.6 mock-rejection specimen is an error tile, never populated data', () => {
    const figure = specimenFigures(mounted.container, 'z3FmMockRejection')[0]
    assert.ok(figure, 'mock rejection specimen exists')
    assert.equal(figure.getAttribute('data-specimen-state'), 'error')
    const tile = byClass(figure, 'v2-tile')[0]
    assert.equal(tile.getAttribute('data-status'), 'error')
    assert.match(textOf(figure), /Source returned mock data/)
    assert.equal(textOf(figure).includes('$99,999'), false, 'mock values never render')
  })

  it('Z5 dispatch outcomes: success, deduped, and the ruled failure line', () => {
    const container = findAll(mounted.container, (el) => el.getAttribute('data-specimen') === 'z5Dispatch')[0]
    assert.ok(container, 'z5Dispatch specimen container exists')
    const specimens = findAll(container, (el) => el.hasAttribute('data-specimen-state'))
    assert.equal(specimens.length, 3)
    const byState = Object.fromEntries(specimens.map((el) => [el.getAttribute('data-specimen-state'), textOf(el)]))
    assert.match(byState.success, /New student → routed to E7A Executive/)
    assert.match(byState.deduped, /→ routed to /)
    assert.equal(byState.failure.includes("couldn't route — try again"), true, 'ruled crit failure copy')
    // The failure line appears exactly once in the entire gallery.
    const matches = textOf(mounted.container).match(/couldn't route — try again/g) ?? []
    assert.equal(matches.length, 1)
  })

  it('every specimen is visibly FIXTURE-labeled', () => {
    const figures = findAll(mounted.container, (el) => el.hasAttribute('data-specimen-state'))
    assert.ok(figures.length >= 109, '108 tile specimens + mock rejection (+3 dispatch outcomes)')
    const tiles = findAll(mounted.container, (el) => el.nodeType === 1 && el.localName === 'figure' && el.hasAttribute('data-specimen'))
    for (const figure of tiles) {
      assert.ok(textOf(figure).includes('FIXTURE'), `${figure.getAttribute('data-specimen')} specimen is labeled`)
    }
  })
})
