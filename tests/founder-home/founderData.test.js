// founderData.test.js — Founder Home composition + truth-law unit tests.
// Run: node --test tests/founder-home/*.test.js

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { DATA_CLASSIFICATION, TILE_STATUS } from '../../src/v2/data/tileMachine.js'
import {
  TRUTH,
  truthForTile,
  deriveBriefing,
  deriveLatestHandled,
  deriveRequiredAction,
  derivePriorities,
  deriveApprovals,
  deriveBlockers,
  deriveActiveWork,
  deriveCompletions,
  deriveSystemHealth,
  buildLaunchers,
} from '../../src/v2/founder/founderData.js'

const pulsePayload = {
  ok: true,
  pulse: {
    urgent: [
      { id: 'u1', title: 'Urgent thing', business: 'E7A', priority: 'urgent', status: 'in_progress' },
      { id: 'u2', title: 'Second urgent', business: 'SOM', priority: 'urgent', status: 'pending' },
    ],
    overdue: [{ id: 'o1', title: 'Overdue thing', business: 'Book', priority: 'high', status: 'in_progress', due_date: '2026-07-31' }],
    blocked: [{ id: 'b1', title: 'Blocked thing', business: 'FM', priority: 'high', status: 'blocked' }],
    approval: [{ id: 'a1', title: 'Approve curriculum', business: 'SOM', priority: 'medium', status: 'pending', approval_status: 'pending', next_action: 'Review level-2 outline' }],
    done_today: [
      { id: 'd1', title: 'Done one', business: 'E7A', status: 'done' },
      { id: 'd2', title: 'Done two', business: 'Personal', status: 'done' },
    ],
    stale: [],
  },
}

const tasksPayload = {
  ok: true,
  count: 5,
  tasks: [
    { id: 't1', title: 'Mix revisions', business: 'E7A', status: 'in_progress', priority: 'urgent', assigned_agent: 'E7A Executive', next_action: 'Bounce v3', latest_update_summary: 'v2 approved', due_date: '2026-08-04' },
    { id: 't2', title: 'Artwork approval', business: 'E7A', status: 'pending', priority: 'high' },
    { id: 't3', title: 'Low task', business: 'E7A', status: 'pending', priority: 'low' },
    { id: 't4', title: 'Finished task', business: 'SOM', status: 'done', priority: 'urgent' },
    { id: 't5', title: 'High sparse', business: 'SOM', status: 'in_progress', priority: 'high', latest_update_summary: 'Draft at 60%' },
  ],
}

describe('truthForTile · founder truth law', () => {
  it('maps populated/empty/partial live data to LIVE', () => {
    assert.equal(truthForTile({ status: TILE_STATUS.POPULATED }), TRUTH.LIVE)
    assert.equal(truthForTile({ status: TILE_STATUS.EMPTY }), TRUTH.LIVE)
    assert.equal(truthForTile({ status: TILE_STATUS.PARTIAL }), TRUTH.LIVE)
  })

  it('never labels fixture data LIVE — fixtures are STAGED', () => {
    assert.equal(truthForTile({ status: TILE_STATUS.POPULATED, classification: DATA_CLASSIFICATION.FIXTURE }), TRUTH.STAGED)
  })

  it('mock payloads are UNVERIFIED, never LIVE', () => {
    assert.equal(truthForTile({ status: TILE_STATUS.ERROR, classification: DATA_CLASSIFICATION.MOCK }), TRUTH.UNVERIFIED)
  })

  it('unavailable classifications and b2-pending are UNAVAILABLE', () => {
    assert.equal(truthForTile({ status: TILE_STATUS.B2_PENDING, classification: DATA_CLASSIFICATION.UNAVAILABLE_LIVE }), TRUTH.UNAVAILABLE)
    assert.equal(truthForTile({ status: TILE_STATUS.EMPTY, classification: DATA_CLASSIFICATION.DEFERRED }), TRUTH.UNAVAILABLE)
  })

  it('permission-denied and error are UNAVAILABLE', () => {
    assert.equal(truthForTile({ status: TILE_STATUS.PERMISSION_DENIED }), TRUTH.UNAVAILABLE)
    assert.equal(truthForTile({ status: TILE_STATUS.ERROR }), TRUTH.UNAVAILABLE)
  })

  it('stale / offline-with-last-good are UNVERIFIED — freshness unconfirmed, never LIVE', () => {
    assert.equal(truthForTile({ status: TILE_STATUS.STALE }), TRUTH.UNVERIFIED)
    assert.equal(truthForTile({ status: TILE_STATUS.OFFLINE, hasData: true }), TRUTH.UNVERIFIED)
  })

  it('offline with nothing held is UNAVAILABLE — no data to stand behind', () => {
    assert.equal(truthForTile({ status: TILE_STATUS.OFFLINE, hasData: false }), TRUTH.UNAVAILABLE)
    assert.equal(truthForTile({ status: TILE_STATUS.OFFLINE }), TRUTH.UNAVAILABLE)
  })

  it('loading makes no claim (null)', () => {
    assert.equal(truthForTile({ status: TILE_STATUS.LOADING }), null)
    assert.equal(truthForTile({ status: TILE_STATUS.IDLE }), null)
  })
})

describe('deriveBriefing', () => {
  it('composes the one-glance line from pulse buckets', () => {
    const briefing = deriveBriefing(pulsePayload)
    assert.equal(briefing.counts.approval, 1)
    assert.equal(briefing.counts.urgent, 2)
    assert.equal(briefing.counts.doneToday, 2)
    assert.ok(briefing.line.includes('1 approval waiting'))
    assert.ok(briefing.line.includes('2 urgent'))
    assert.ok(briefing.line.includes('2 completed today'))
    assert.equal(briefing.allClear, false)
  })

  it('empty pulse is all-clear, never fabricated concern', () => {
    const briefing = deriveBriefing({ pulse: { urgent: [], overdue: [], blocked: [], approval: [], done_today: [], stale: [] } })
    assert.equal(briefing.allClear, true)
    assert.ok(briefing.line.includes('No fires'))
  })

  it('tolerates null payload', () => {
    assert.equal(deriveBriefing(null).allClear, true)
  })
})

describe('deriveLatestHandled', () => {
  it('returns the newest handled item or null', () => {
    assert.deepEqual(
      deriveLatestHandled({ items: [{ summary: 'Task routed', route: 'create_task', timestamp: '2026-08-02T19:41:00-04:00' }] }),
      { summary: 'Task routed', route: 'create_task', timestamp: '2026-08-02T19:41:00-04:00' },
    )
    assert.equal(deriveLatestHandled({ items: [] }), null)
    assert.equal(deriveLatestHandled(null), null)
  })
})

describe('deriveRequiredAction · exactly one, deterministic order', () => {
  it('approvals outrank urgent and overdue', () => {
    const action = deriveRequiredAction(pulsePayload)
    assert.equal(action.task.id, 'a1')
    assert.equal(action.reason, 'Approval needed')
  })

  it('falls back to urgent, then overdue, then null', () => {
    const noApproval = { pulse: { ...pulsePayload.pulse, approval: [] } }
    assert.equal(deriveRequiredAction(noApproval).task.id, 'u1')
    const onlyOverdue = { pulse: { urgent: [], overdue: [{ id: 'o1', title: 'x' }], blocked: [], approval: [], done_today: [], stale: [] } }
    assert.equal(deriveRequiredAction(onlyOverdue).reason, 'Overdue')
    const empty = { pulse: { urgent: [], overdue: [], blocked: [], approval: [], done_today: [], stale: [] } }
    assert.equal(deriveRequiredAction(empty), null)
  })
})

describe('derivePriorities', () => {
  it('keeps urgent+high, drops low and done, urgent first, caps at limit', () => {
    const priorities = derivePriorities(tasksPayload)
    assert.deepEqual(priorities.map((t) => t.id), ['t1', 't2', 't5'])
    assert.equal(priorities[0].priority, 'urgent')
  })

  it('preserves latest_update_summary and next_action, tolerates sparse fields', () => {
    const priorities = derivePriorities(tasksPayload)
    const sparse = priorities.find((t) => t.id === 't2')
    assert.equal(sparse.assignedAgent, null)
    const full = priorities.find((t) => t.id === 't5')
    assert.equal(full.latestUpdate, 'Draft at 60%')
  })
})

describe('bucket derivations', () => {
  it('approvals / blockers / completions come straight from pulse buckets', () => {
    assert.deepEqual(deriveApprovals(pulsePayload).map((t) => t.id), ['a1'])
    assert.deepEqual(deriveBlockers(pulsePayload).map((t) => t.id), ['b1', 'o1'])
    assert.deepEqual(deriveCompletions(pulsePayload).map((t) => t.id), ['d1', 'd2'])
  })

  it('active work is in_progress tasks with agent/update/next-action carried', () => {
    const active = deriveActiveWork(tasksPayload)
    assert.deepEqual(active.map((t) => t.id), ['t1', 't5'])
    assert.equal(active[0].assignedAgent, 'E7A Executive')
    assert.equal(active[0].latestUpdate, 'v2 approved')
  })
})

describe('deriveSystemHealth', () => {
  it('reports each source with its truth label — never unconditional green', () => {
    const health = deriveSystemHealth({
      tasks: { status: TILE_STATUS.POPULATED, classification: DATA_CLASSIFICATION.LIVE },
      pulse: { status: TILE_STATUS.ERROR, classification: DATA_CLASSIFICATION.LIVE },
      calendar: { status: TILE_STATUS.PERMISSION_DENIED, classification: DATA_CLASSIFICATION.LIVE },
      audit: { status: TILE_STATUS.LOADING, classification: DATA_CLASSIFICATION.LIVE },
    })
    assert.deepEqual(health.map((h) => h.truth), [TRUTH.LIVE, TRUTH.UNAVAILABLE, TRUTH.UNAVAILABLE, null])
    assert.deepEqual(health.map((h) => h.name), ['Tasks', 'Pulse', 'Calendar', 'MYA log'])
  })
})

describe('buildLaunchers', () => {
  it('returns the five founder launchers with truth labels; staged entries never LIVE', () => {
    const launchers = buildLaunchers()
    assert.equal(launchers.length, 5)
    const byId = Object.fromEntries(launchers.map((l) => [l.id, l]))
    assert.equal(byId['som-app'].truth, TRUTH.LIVE)
    assert.equal(byId['book-app'].truth, TRUTH.STAGED)
    assert.equal(byId['fm-app'].truth, TRUTH.STAGED)
    assert.equal(byId['personal-mya'].truth, TRUTH.STAGED)
    assert.equal(byId['motesart-converter'].label, 'Motesart Technologies')
    for (const launcher of launchers) {
      assert.ok(launcher.url, `${launcher.id} has a target`)
      assert.ok(Object.values(TRUTH).includes(launcher.truth))
    }
  })
})
