// z5.test.js — Z5 Quick Actions pure-logic tests (PLAN §8 Z5, §10 qbtn/toast
// rows, §13). No DOM: every behavior under test lives in the pure module
// z5QuickActions.js plus the dispatch adapter's body/response mapping and
// deterministic fixture dispatcher, the Z5 fixture specimens, and static
// source scans proving no live submission path exists this stage.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import {
  buildDispatchBody,
  fixtureDispatch,
  mapDispatchResponse,
  mapDispatchResult,
} from '../../src/v2/data/adapters/dispatch.js'
import {
  FIXTURE_CLASSIFICATION,
  fixtureDispatchDeduped,
  fixtureDispatchFailure,
  fixtureDispatchSuccess,
  fixtureTileStates,
} from '../../src/v2/data/fixtures.js'
import {
  DISPATCH_FAILURE_COPY,
  QUICK_ACTIONS,
  dispatchSuccessCopy,
  dispatchToast,
} from '../../src/v2/zones/z5QuickActions.js'

// ─── Z5 action law (desktop mockup, locked labels + routes, in order) ───────

describe('z5QuickActions · QUICK_ACTIONS', () => {
  it('exactly the five mockup actions, in mockup order, with locked labels', () => {
    assert.equal(QUICK_ACTIONS.length, 5)
    assert.deepEqual(
      QUICK_ACTIONS.map((a) => a.label),
      ['New student', 'Create invoice', 'Brain dump', 'Voice note', 'Capture idea'],
    )
  })

  it('executive routes are the mockup data-routes via the audited backend mapping (PLAN §4)', () => {
    assert.deepEqual(
      QUICK_ACTIONS.map((a) => a.executive),
      ['SOM Executive', 'FM Executive', 'MYA', 'MYA', 'MYA'],
    )
    assert.deepEqual(
      QUICK_ACTIONS.map((a) => a.business),
      ['SOM', 'FM', 'Personal', 'Personal', 'Personal'],
    )
  })

  it('keys are unique and every action carries label + business + executive', () => {
    const keys = QUICK_ACTIONS.map((a) => a.key)
    assert.equal(new Set(keys).size, keys.length)
    for (const action of QUICK_ACTIONS) {
      assert.ok(action.label.length > 0)
      assert.ok(action.business.length > 0)
      assert.ok(action.executive.length > 0)
    }
  })
})

// ─── Dispatch body (approval-gated write — the ONLY write, never executed) ──

describe('dispatch adapter · buildDispatchBody', () => {
  it('emits the verbatim lowercase create_task_core fields for every action', () => {
    for (const action of QUICK_ACTIONS) {
      const body = buildDispatchBody(action)
      assert.equal(body.title, action.label)
      assert.equal(body.business, action.business)
      assert.equal(body.assigned_agent, action.executive)
      assert.equal(body.requires_approval, true, 'every quick action is approval-gated')
    }
  })

  it('invents no unruled fields: the five locked actions carry no priority', () => {
    for (const action of QUICK_ACTIONS) {
      assert.deepEqual(
        Object.keys(buildDispatchBody(action)).sort(),
        ['assigned_agent', 'business', 'requires_approval', 'title'],
      )
    }
  })

  it('priority passes through only when the action defines one', () => {
    const body = buildDispatchBody({ key: 'x', label: 'X', business: 'E7A', executive: 'E7A Executive', priority: 'high' })
    assert.equal(body.priority, 'high')
  })

  it('tolerates a malformed action without throwing', () => {
    const body = buildDispatchBody(null)
    assert.equal(body.title, '')
    assert.equal(body.business, null)
    assert.equal(body.requires_approval, true)
  })
})

// ─── Response mapping ({"ok","task":{"id","deduped",...}}; §13 dedupe law) ──

describe('dispatch adapter · mapDispatchResponse', () => {
  it('success fixture maps to ok with id, deduped false, approval pending, executive from assigned_agent', () => {
    const outcome = mapDispatchResponse(fixtureDispatchSuccess)
    assert.equal(outcome.ok, true)
    assert.equal(outcome.id, 'rec-fix-dispatch-1')
    assert.equal(outcome.deduped, false)
    assert.equal(outcome.approvalStatus, 'pending')
    assert.equal(outcome.executive, 'E7A Executive')
  })

  it('deduped:true is a SUCCESS — the existing record, never a failure (§13)', () => {
    const outcome = mapDispatchResponse(fixtureDispatchDeduped)
    assert.equal(outcome.ok, true)
    assert.equal(outcome.deduped, true)
    assert.equal(outcome.id, 'rec-fix-dispatch-1')
    assert.equal(outcome.approvalStatus, 'pending')
  })

  it('malformed payloads map to ok:false and never throw', () => {
    for (const bad of [null, undefined, {}, { ok: false }, { ok: true }, { ok: true, task: 'nope' }, { ok: 'yes', task: {} }]) {
      assert.equal(mapDispatchResponse(bad).ok, false)
    }
  })

  it('mapDispatchResult unwraps the typed result; failure results map ok:false', () => {
    assert.equal(mapDispatchResult({ ok: true, status: 201, data: fixtureDispatchSuccess, errorKind: null }).ok, true)
    assert.equal(mapDispatchResult(fixtureDispatchFailure).ok, false)
    assert.equal(mapDispatchResult(null).ok, false)
  })
})

// ─── Fixture dispatcher (deterministic, approval-gated, ZERO network) ───────

describe('dispatch adapter · fixtureDispatch (no real submission)', () => {
  it('resolves the approval-pending outcome for every action without touching fetch', async () => {
    const realFetch = globalThis.fetch
    let calls = 0
    globalThis.fetch = () => { calls += 1; throw new Error('network forbidden') }
    try {
      for (const action of QUICK_ACTIONS) {
        const result = await fixtureDispatch(action)
        assert.equal(result.ok, true)
        assert.equal(result.data.task.requires_approval, true)
        assert.equal(result.data.task.approval_status, 'pending', 'approval-gated: nothing executes')
        assert.equal(result.data.task.deduped, false)
        assert.equal(result.data.task.title, action.label)
        assert.equal(result.data.task.business, action.business)
        assert.equal(result.data.task.assigned_agent, action.executive)
        assert.equal(result.data.task.id, `rec-fix-dispatch-${action.key}`)
      }
      assert.equal(calls, 0, 'fixture dispatcher performs zero network')
    } finally {
      if (realFetch === undefined) delete globalThis.fetch
      else globalThis.fetch = realFetch
    }
  })
})

// ─── Toast derivation (ruled copy, no auto-retry) ───────────────────────────

describe('z5QuickActions · dispatch toasts', () => {
  const newStudent = QUICK_ACTIONS[0]

  it('success copy is "‹action› → routed to ‹executive›" from assigned_agent', () => {
    const outcome = mapDispatchResponse(fixtureDispatchSuccess)
    const toast = dispatchToast(outcome, newStudent)
    assert.equal(toast.tone, 'good')
    assert.equal(toast.copy, 'New student → routed to E7A Executive', 'response executive wins')
  })

  it('falls back to the action executive on a sparse response', () => {
    const toast = dispatchToast({ ok: true, id: 'rec-1', deduped: false, approvalStatus: 'pending', executive: null }, newStudent)
    assert.equal(toast.copy, 'New student → routed to SOM Executive')
  })

  it('deduped dispatch still toasts success (§13)', () => {
    const toast = dispatchToast(mapDispatchResponse(fixtureDispatchDeduped), newStudent)
    assert.equal(toast.tone, 'good')
    assert.match(toast.copy, /→ routed to /)
  })

  it('failure toasts the ruled crit copy verbatim — exactly once, no auto-retry', () => {
    const toast = dispatchToast(mapDispatchResult(fixtureDispatchFailure), newStudent)
    assert.equal(toast.tone, 'crit')
    assert.equal(toast.copy, "couldn't route — try again")
    assert.equal(DISPATCH_FAILURE_COPY, "couldn't route — try again")
  })

  it('dispatchSuccessCopy never fabricates a route when none exists', () => {
    assert.equal(dispatchSuccessCopy({ label: 'Loose action' }), 'Loose action')
  })
})

// ─── Z5 fixture specimens (FIXTURE-classified, code-verified shapes) ────────

describe('z5 fixtures · dispatch specimens', () => {
  it('z5Dispatch carries success / deduped / failure specimens, FIXTURE-labeled', () => {
    const specimens = fixtureTileStates.z5Dispatch
    assert.equal(specimens.classification, FIXTURE_CLASSIFICATION)
    assert.equal(specimens.success, fixtureDispatchSuccess)
    assert.equal(specimens.deduped, fixtureDispatchDeduped)
    assert.equal(specimens.failure, fixtureDispatchFailure)
  })

  it('success and deduped specimens share the record id — dedupe returns the existing task', () => {
    assert.equal(fixtureDispatchSuccess.task.id, fixtureDispatchDeduped.task.id)
    assert.equal(fixtureDispatchSuccess.task.deduped, false)
    assert.equal(fixtureDispatchDeduped.task.deduped, true)
    assert.equal(fixtureDispatchSuccess.task.requires_approval, true)
    assert.equal(fixtureDispatchSuccess.task.approval_status, 'pending')
  })

  it('failure specimen is a typed adapter failure, never a populated shape', () => {
    assert.equal(fixtureDispatchFailure.ok, false)
    assert.equal(fixtureDispatchFailure.errorKind, 'http')
    assert.equal(mapDispatchResult(fixtureDispatchFailure).ok, false)
  })
})

// ─── Z5 no-live-submission law (static source scans, zero network) ──────────

describe('z5 · no live submission path (owner constraint; §3.4 gate pending)', () => {
  const read = (path) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8')
  // Comments name the gated endpoint by law; the scans cover code only.
  const codeOnly = (source) =>
    source
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('//'))
      .join('\n')

  const zoneSource = codeOnly(read('../../src/v2/zones/Z5QuickActions.jsx'))
  const logicSource = codeOnly(read('../../src/v2/zones/z5QuickActions.js'))
  const adapterSource = codeOnly(read('../../src/v2/data/adapters/dispatch.js'))

  it('the zone performs no network and references no endpoint at all', () => {
    assert.equal(/(?<![A-Za-z])fetch\s*\(/.test(zoneSource), false)
    assert.equal(/XMLHttpRequest/.test(zoneSource), false)
    assert.equal(/https?:\/\//.test(zoneSource), false)
    assert.equal(/\/api\//.test(zoneSource), false, 'zone names no endpoint')
    assert.equal(/apiFetch/.test(zoneSource), false, 'zone never imports the fetch helper')
    assert.equal(/fixtures\.js/.test(zoneSource), false, 'zone never imports the fixture module')
  })

  it('the zone dispatches only through the injected dispatcher (default: fixtureDispatch)', () => {
    assert.match(zoneSource, /adapters\/dispatch\.js/)
    assert.match(zoneSource, /fixtureDispatch/)
    assert.equal(/localStorage|sessionStorage/.test(zoneSource), false)
  })

  it('the dispatch adapter ships no live path: no apiFetch, no fetch, no POST, no endpoint', () => {
    assert.equal(/apiFetch/.test(adapterSource), false, 'dispatch adapter never imports the fetch helper')
    assert.equal(/(?<![A-Za-z])fetch\s*\(/.test(adapterSource), false)
    assert.equal(/XMLHttpRequest/.test(adapterSource), false)
    assert.equal(/https?:\/\//.test(adapterSource), false)
    assert.equal(/\/api\//.test(adapterSource), false, 'no endpoint is referenced in code')
    assert.equal(/method\s*:/.test(adapterSource), false, 'no request init exists')
    assert.equal(/['"]POST['"]/.test(adapterSource), false, 'no POST anywhere in the adapter')
  })

  it('z5QuickActions.js stays pure: no imports, no fetch, no React', () => {
    assert.equal(/from '/.test(logicSource), false)
    assert.equal(/(?<![A-Za-z])fetch\s*\(/.test(logicSource), false)
    assert.equal(/https?:\/\//.test(logicSource), false)
  })

  it('the only write field set is approval-gated by construction', () => {
    assert.match(adapterSource, /requires_approval:\s*true/)
    assert.equal(/requires_approval:\s*false/.test(adapterSource), false)
  })
})

// ─── Home wiring (Z5 is the last skeleton replaced; G10 label law) ──────────

describe('z5 · Home wiring', () => {
  const homeSource = readFileSync(
    fileURLToPath(new URL('../../src/v2/zones/Home.jsx', import.meta.url)),
    'utf8',
  )

  it('zone 5 renders Z5QuickActions and no skeleton placeholder remains', () => {
    assert.match(homeSource, /import Z5QuickActions from '\.\/Z5QuickActions\.jsx'/)
    assert.match(homeSource, /content: <Z5QuickActions \/>/)
    assert.equal(/ZoneSkeleton/.test(homeSource), false, 'no zone skeleton left in Home')
  })

  it('zone labels are exactly Today / Projects / Business / Life / Quick Actions (G10)', () => {
    assert.deepEqual(
      [...homeSource.matchAll(/label: '([^']+)'/g)].map((m) => m[1]),
      ['Today', 'Projects', 'Business', 'Life', 'Quick Actions'],
    )
  })
})
