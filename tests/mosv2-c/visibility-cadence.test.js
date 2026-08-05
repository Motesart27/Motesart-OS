// visibility-cadence.test.js — D3 hidden-tab cadence instrumentation (frozen
// matrix §11). The injected-timer pure tests (useTileSource.test.js) are
// retained; this file ADDS mounted instrumentation: the production
// useTileSource hook runs inside a real react-dom mount while the document
// visibility lifecycle is cycled through document.setVisibility() (mini DOM),
// delivering genuine visibilitychange events to the hook's subscription.
//
// Proven here: the hook subscribes to visibilitychange on mount and
// unsubscribes on unmount; hiding the document pauses cadence fetches to
// ZERO; re-showing after missed ticks fires EXACTLY ONE catch-up fetch and
// then resumes the regular cadence — never a burst (9.3).
//
// Headless-limit classification (also written into
// docs/vault/MOSV2_C_RELEASE_HARDENING_v1.md): this proves the app-level
// pause/resume contract against the visibilitychange signal. Real-browser
// background-tab timer throttling (clamp ≥1s) is browser policy, not app
// behavior, and cannot be faithfully reproduced headlessly; the app's
// correctness condition — no missed-tick burst on resume — is fully covered
// by the instrumentation below plus the retained injected-timer tests.

import { afterEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  React, act, mount, waitFor, sleep, h, dom,
} from './helpers/dom-mount.mjs'

import { useTileSource } from '../../src/v2/data/useTileSource.js'

const CADENCE_MS = 80

function ProbeTile({ fetcher, cadenceMs }) {
  const { status } = useTileSource({ fetcher, cadenceMs })
  return h('div', { className: 'probe-tile', 'data-status': status }, status)
}

describe('visibility cadence · D3 mounted instrumentation (9.3)', () => {
  const mountedThings = []
  afterEach(async () => {
    while (mountedThings.length) await mountedThings.pop().unmount()
    dom.document.setVisibility(false)
  })

  it('pauses to zero fetches while hidden; exactly one catch-up on show; no burst', async () => {
    const calls = []
    const fetcher = async () => {
      calls.push(Date.now())
      return { ok: true, status: 200, data: { n: calls.length }, errorKind: null }
    }
    const mounted = await mount(h(ProbeTile, { fetcher, cadenceMs: CADENCE_MS }))
    mountedThings.push(mounted)
    const statusText = () => mounted.container.textContent

    // Hook subscribes to visibilitychange at mount.
    assert.ok(dom.document.listenerCount('visibilitychange') >= 1, 'visibility listener registered')

    // Mount fetch resolves → populated, then cadence ticks fire while visible.
    await act(async () => {
      await waitFor(() => statusText() === 'populated', { timeoutMs: 3000, label: 'populated after mount fetch' })
    })
    await act(async () => { await sleep(CADENCE_MS * 2.5) })
    const visibleTicks = calls.length
    assert.ok(visibleTicks >= 2, `cadence ticks while visible (saw ${visibleTicks})`)

    // Hide: cadence must pause — zero fetches across several cadence periods.
    dom.document.setVisibility(true)
    const atHide = calls.length
    await act(async () => { await sleep(CADENCE_MS * 4) })
    assert.equal(calls.length, atHide, 'ZERO fetches while the document is hidden')

    // Show after missed ticks: EXACTLY ONE catch-up fetch, then cadence resumes.
    dom.document.setVisibility(false)
    await act(async () => {
      await waitFor(() => calls.length === atHide + 1, { timeoutMs: 2000, label: 'single catch-up fetch on show' })
    })
    assert.equal(calls.length, atHide + 1, 'exactly one catch-up — no synchronous burst')

    await act(async () => { await sleep(CADENCE_MS * 2.5) })
    const total = calls.length
    assert.ok(total >= atHide + 2, 'regular cadence resumed after the catch-up')
    assert.ok(total <= atHide + 4, `bounded resume — a burst would have fired ~4 extra fetches at once (saw ${total - atHide})`)
  })

  it('unmount removes the visibilitychange subscription', async () => {
    const fetcher = async () => ({ ok: true, status: 200, data: {}, errorKind: null })
    const before = dom.document.listenerCount('visibilitychange')
    const mounted = await mount(h(ProbeTile, { fetcher, cadenceMs: CADENCE_MS }))
    assert.ok(dom.document.listenerCount('visibilitychange') > before, 'listener added at mount')
    await mounted.unmount()
    assert.equal(dom.document.listenerCount('visibilitychange'), before, 'listener removed at unmount')
  })

  it('a hidden→visible cycle during an in-flight fetch resolves lawfully (stays populated)', async () => {
    let resolveFetch
    const fetcher = () => new Promise((resolve) => { resolveFetch = resolve })
    const mounted = await mount(h(ProbeTile, { fetcher, cadenceMs: CADENCE_MS }))
    mountedThings.push(mounted)
    dom.document.setVisibility(true)
    await act(async () => {
      resolveFetch({ ok: true, status: 200, data: { n: 1 }, errorKind: null })
    })
    assert.equal(mounted.container.textContent, 'populated')
    dom.document.setVisibility(false)
  })
})
