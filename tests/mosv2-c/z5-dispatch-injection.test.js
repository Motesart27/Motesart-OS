// z5-dispatch-injection.test.js — D4 Z5 failure-state evidence by DIRECT
// dispatcher injection (frozen matrix §10; Codex: z5.test.js previously
// tested derivation only, no injection). Mounts the production Z5QuickActions
// zone with call-counted injected dispatchers and proves the §10 qbtn law in
// the DOM:
//   · a failed dispatch produces EXACTLY ONE crit toast with the ruled copy
//     ("couldn't route — try again") — verified against the fixture failure
//     specimen and a throwing dispatcher;
//   · ZERO retries — the dispatcher is never called again without a click;
//   · one toast per dispatch, never stacked;
//   · the toast auto-dismisses (~3s) and no retry fires during or after.
// Zero network: the injected dispatchers are fixtures/stubs by construction;
// the live POST remains unshipped (static no-live-submission scans in
// z5.test.js keep fencing that law).

import { afterEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  React, act, mount, fireEvent, byClass, textOf, waitFor, sleep, h, dom,
} from './helpers/dom-mount.mjs'

import { fixtureDispatchFailure } from '../../src/v2/data/fixtures.js'

const { default: Z5QuickActions } = await import('../../src/v2/zones/Z5QuickActions.jsx')

const BRAIN_DUMP_INDEX = 2
const TOAST_DISMISS_MS = 3000
const TOAST_LEAVE_MS = 220

function toasts() {
  return byClass(dom.document.body, 'v2-toast')
}

describe('z5 dispatcher injection · D4 failure-state proof', () => {
  const mountedThings = []
  afterEach(async () => {
    while (mountedThings.length) await mountedThings.pop().unmount()
  })

  async function mountWith(dispatch) {
    const mounted = await mount(h(Z5QuickActions, { dispatch }))
    mountedThings.push(mounted)
    return mounted
  }

  it('typed failure result: exactly one call, exactly one crit toast, zero retries', async () => {
    const calls = []
    const failing = async (action) => { calls.push(action.key); return fixtureDispatchFailure }
    const mounted = await mountWith(failing)
    const buttons = byClass(mounted.container, 'v2-qbtn')

    fireEvent(buttons[BRAIN_DUMP_INDEX], 'click')
    await act(async () => { await sleep(60) })

    assert.deepEqual(calls, ['brain-dump'], 'dispatcher called exactly once with the clicked action')
    assert.equal(toasts().length, 1, 'exactly one toast on screen')
    assert.match(textOf(toasts()[0]), /couldn't route — try again/)
    assert.ok(toasts()[0].className.includes('v2-toast--crit'), 'failure toast uses the ruled crit tone')

    // Zero retries: across the full dismiss window no further dispatch occurs.
    // Two-stage flush: the 3s dismiss timer fires inside act, then the
    // Toast's 220ms leave timer is scheduled by that render — the second act
    // lets it fire and drains the unmount.
    await act(async () => { await sleep(TOAST_DISMISS_MS + 300) })
    await act(async () => { await sleep(TOAST_LEAVE_MS + 300) })
    assert.equal(calls.length, 1, 'no auto-retry during or after the toast lifecycle')
    assert.equal(toasts().length, 0, 'toast auto-dismissed')
  })

  it('throwing dispatcher: the catch branch yields the same single crit toast, zero retries', async () => {
    let calls = 0
    const throwing = async () => { calls += 1; throw new Error('upstream exploded') }
    const mounted = await mountWith(throwing)
    const buttons = byClass(mounted.container, 'v2-qbtn')

    fireEvent(buttons[0], 'click')
    await act(async () => { await sleep(60) })

    assert.equal(calls, 1)
    assert.equal(toasts().length, 1)
    assert.match(textOf(toasts()[0]), /couldn't route — try again/)
    assert.ok(toasts()[0].className.includes('v2-toast--crit'))

    // Two-stage flush: the 3s dismiss timer fires inside act, then the
    // Toast's 220ms leave timer is scheduled by that render — the second act
    // lets it fire and drains the unmount.
    await act(async () => { await sleep(TOAST_DISMISS_MS + 300) })
    await act(async () => { await sleep(TOAST_LEAVE_MS + 300) })
    assert.equal(calls, 1, 'no auto-retry after a thrown failure')
    assert.equal(toasts().length, 0)
  })

  it('one toast per dispatch — two failures never stack two toasts', async () => {
    let calls = 0
    const failing = async () => { calls += 1; return fixtureDispatchFailure }
    const mounted = await mountWith(failing)
    const buttons = byClass(mounted.container, 'v2-qbtn')

    fireEvent(buttons[BRAIN_DUMP_INDEX], 'click')
    await act(async () => { await sleep(60) })
    fireEvent(buttons[BRAIN_DUMP_INDEX], 'click')
    await act(async () => { await sleep(60) })

    assert.equal(calls, 2, 'each click dispatches once')
    assert.equal(toasts().length, 1, 'the single toast is replaced, never stacked')
    assert.match(textOf(toasts()[0]), /couldn't route — try again/)

    // Two-stage flush: the 3s dismiss timer fires inside act, then the
    // Toast's 220ms leave timer is scheduled by that render — the second act
    // lets it fire and drains the unmount.
    await act(async () => { await sleep(TOAST_DISMISS_MS + 300) })
    await act(async () => { await sleep(TOAST_LEAVE_MS + 300) })
    assert.equal(calls, 2, 'still zero retries')
  })

  it('success control: an injected succeeding dispatcher toasts good tone once', async () => {
    let calls = 0
    const succeeding = async (action) => {
      calls += 1
      return {
        ok: true,
        status: 201,
        data: { ok: true, task: { id: 'rec-x', deduped: false, assigned_agent: action.executive } },
        errorKind: null,
      }
    }
    const mounted = await mountWith(succeeding)
    const buttons = byClass(mounted.container, 'v2-qbtn')

    fireEvent(buttons[BRAIN_DUMP_INDEX], 'click')
    await act(async () => { await sleep(60) })

    assert.equal(calls, 1)
    assert.equal(toasts().length, 1)
    assert.match(textOf(toasts()[0]), /Brain dump → routed to MYA/)
    assert.ok(toasts()[0].className.includes('v2-toast--good'))

    // Two-stage flush: the 3s dismiss timer fires inside act, then the
    // Toast's 220ms leave timer is scheduled by that render — the second act
    // lets it fire and drains the unmount.
    await act(async () => { await sleep(TOAST_DISMISS_MS + 300) })
    await act(async () => { await sleep(TOAST_LEAVE_MS + 300) })
    assert.equal(toasts().length, 0)
  })

  it('the control never disables and stays dispatch-ready across a failure (DB-G8)', async () => {
    let calls = 0
    const flip = async () => {
      calls += 1
      return calls === 1 ? fixtureDispatchFailure : {
        ok: true, status: 201,
        data: { ok: true, task: { id: 'rec-y', deduped: false, assigned_agent: 'MYA' } },
        errorKind: null,
      }
    }
    const mounted = await mountWith(flip)
    const buttons = byClass(mounted.container, 'v2-qbtn')
    assert.equal(buttons.every((b) => b.disabled === false), true, 'qbtns carry no disabled state')

    fireEvent(buttons[BRAIN_DUMP_INDEX], 'click')
    await act(async () => { await sleep(60) })
    assert.match(textOf(toasts()[0]), /couldn't route — try again/)
    assert.equal(buttons.every((b) => b.disabled === false), true, 'still no disabled state after failure')

    fireEvent(buttons[BRAIN_DUMP_INDEX], 'click')
    await act(async () => { await sleep(60) })
    assert.match(textOf(toasts()[0]), /Brain dump → routed to MYA/, 'manual re-click succeeds — human retry only')
    assert.equal(calls, 2)
  })
})
