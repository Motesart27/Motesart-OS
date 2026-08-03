// z1z2.test.js — Z1/Z2 pure-logic tests (PLAN §8 Z1/Z2, §13). No DOM: every
// behavior under test lives in the pure modules z1Signals.js, z1Agenda.js,
// z2Projects.js plus the adapters' mappers and tileMachine ranking.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { rankSignals, computeCountdown, MAX_SIGNALS } from '../../src/v2/data/tileMachine.js'
import { mapHandledLog } from '../../src/v2/data/adapters/auditLog.js'
import {
  BUSINESS_ROUTES,
  isDueToday,
  isOverdue,
  routeForBusiness,
  signalFromTask,
  signalsFromTasks,
} from '../../src/v2/zones/z1Signals.js'
import { agendaForToday, formatEventTime, greetingForHour } from '../../src/v2/zones/z1Agenda.js'
import {
  deriveCountdowns,
  formatCountdown,
  groupTasksByBusiness,
  summarizeBookLane,
} from '../../src/v2/zones/z2Projects.js'

// Fixed local clock for every test: Monday 2026-08-03, 12:00 local time.
const NOW = new Date(2026, 7, 3, 12, 0, 0)

const task = (overrides = {}) => ({
  id: 'rec-1',
  title: 'Task',
  business: 'E7A',
  status: 'pending',
  priority: 'medium',
  approvalStatus: null,
  dueDate: null,
  ...overrides,
})

// ─── Z1 signal mapping (severity outcomes) ──────────────────────────────────

describe('z1Signals · task → signal mapping', () => {
  it('overdue + urgent + not done → crit', () => {
    const signal = signalFromTask(task({ dueDate: '2026-08-01T09:00:00', priority: 'urgent' }), NOW)
    assert.equal(signal.severity, 'crit')
  })

  it('overdue but NOT urgent → no signal (mapping law)', () => {
    assert.equal(signalFromTask(task({ dueDate: '2026-08-01T09:00:00', priority: 'high' }), NOW), null)
  })

  it('overdue + urgent but status done → no signal', () => {
    assert.equal(
      signalFromTask(task({ dueDate: '2026-08-01T09:00:00', priority: 'urgent', status: 'done' }), NOW),
      null,
    )
  })

  it('approval_status pending → exec', () => {
    const signal = signalFromTask(task({ approvalStatus: 'pending' }), NOW)
    assert.equal(signal.severity, 'exec')
  })

  it('status blocked → warn', () => {
    const signal = signalFromTask(task({ status: 'blocked' }), NOW)
    assert.equal(signal.severity, 'warn')
  })

  it('due today (local) → info', () => {
    const signal = signalFromTask(task({ dueDate: '2026-08-03T17:00:00' }), NOW)
    assert.equal(signal.severity, 'info')
  })

  it('precedence: overdue+urgent beats approval pending; approval beats blocked', () => {
    const both = task({ dueDate: '2026-08-01T09:00:00', priority: 'urgent', approvalStatus: 'pending', status: 'blocked' })
    assert.equal(signalFromTask(both, NOW).severity, 'crit')
    const approvalAndBlocked = task({ approvalStatus: 'pending', status: 'blocked' })
    assert.equal(signalFromTask(approvalAndBlocked, NOW).severity, 'exec')
  })

  it('ordinary task → no signal', () => {
    assert.equal(signalFromTask(task(), NOW), null)
    assert.equal(signalFromTask(task({ dueDate: '2026-08-10T09:00:00' }), NOW), null)
  })

  it('sparse fields tolerated: missing dueDate/approvalStatus/assignedAgent never crash', () => {
    // Simulates mapTask output for records where Airtable omitted the fields.
    const sparse = { id: 'rec-sparse', title: 'Sparse', business: 'SOM', status: 'pending', priority: 'low' }
    assert.equal(signalFromTask(sparse, NOW), null)
    assert.equal(signalFromTask({ ...sparse, approvalStatus: 'pending' }, NOW).severity, 'exec')
  })

  it('business → owning module L2 route map', () => {
    assert.deepEqual(BUSINESS_ROUTES, {
      E7A: '/v2/work',
      SOM: '/v2/som',
      FM: '/v2/money',
      Book: '/v2/book',
      Personal: '/v2/life',
    })
    assert.equal(routeForBusiness('Personal'), '/v2/life')
    assert.equal(routeForBusiness('Unknown'), '/v2/home')
    assert.equal(signalFromTask(task({ business: 'Personal', status: 'blocked' }), NOW).route, '/v2/life')
  })

  it('due-today / overdue boundary: earlier today is info, yesterday is overdue', () => {
    assert.equal(isDueToday('2026-08-03T08:00:00', NOW), true)
    assert.equal(isOverdue('2026-08-03T08:00:00', 'pending', NOW), false, 'same local day is not overdue')
    assert.equal(isOverdue('2026-08-02T23:59:00', 'pending', NOW), true)
    assert.equal(isDueToday('2026-08-02T23:59:00', NOW), false)
  })
})

describe('z1Signals · ranking + max 6 (via rankSignals)', () => {
  const many = [
    task({ id: 'a', dueDate: '2026-08-03T15:00:00' }), // info
    task({ id: 'b', dueDate: '2026-07-30T09:00:00', priority: 'urgent' }), // crit
    task({ id: 'c', status: 'blocked' }), // warn
    task({ id: 'd', approvalStatus: 'pending' }), // exec
    task({ id: 'e', dueDate: '2026-08-03T18:00:00' }), // info
    task({ id: 'f', status: 'blocked' }), // warn
    task({ id: 'g', dueDate: '2026-07-29T09:00:00', priority: 'urgent' }), // crit
    task({ id: 'h' }), // no signal
  ]

  it('signalsFromTasks produces one signal per matching task, none for the rest', () => {
    const signals = signalsFromTasks(many, NOW)
    assert.equal(signals.length, 7)
    assert.deepEqual(signals.map((s) => s.id), ['sig-a', 'sig-b', 'sig-c', 'sig-d', 'sig-e', 'sig-f', 'sig-g'])
  })

  it('rankSignals orders crit > exec > warn > info and caps at MAX_SIGNALS', () => {
    const ranked = rankSignals(signalsFromTasks(many, NOW))
    assert.equal(ranked.length, MAX_SIGNALS)
    assert.deepEqual(
      ranked.map((s) => s.severity),
      ['crit', 'crit', 'exec', 'warn', 'warn', 'info'],
    )
    assert.equal(MAX_SIGNALS, 6)
  })

  it('rankSignals tolerates non-arrays and never mutates input', () => {
    assert.deepEqual(rankSignals(null), [])
    const input = [{ severity: 'info' }, { severity: 'crit' }]
    const ranked = rankSignals(input)
    assert.deepEqual(input, [{ severity: 'info' }, { severity: 'crit' }])
    assert.deepEqual(ranked.map((s) => s.severity), ['crit', 'info'])
  })
})

// ─── Z1 agenda (fixed clock) ────────────────────────────────────────────────

describe('z1Agenda · today filter + start sort', () => {
  const events = [
    { title: 'Late', start: '2026-08-03T18:00:00', end: '2026-08-03T19:00:00' },
    { title: 'Tomorrow', start: '2026-08-04T09:00:00', end: '2026-08-04T10:00:00' },
    { title: 'Early', start: '2026-08-03T08:30:00', end: '2026-08-03T09:00:00' },
    { title: 'Yesterday', start: '2026-08-02T12:00:00', end: '2026-08-02T13:00:00' },
    { title: 'Broken', start: 'not-a-date' },
    { title: 'No start' },
  ]

  it('keeps only today (local), sorted by start, dropping invalid rows', () => {
    const agenda = agendaForToday(events, NOW)
    assert.deepEqual(agenda.map((e) => e.title), ['Early', 'Late'])
  })

  it('non-array input yields an empty agenda', () => {
    assert.deepEqual(agendaForToday(null, NOW), [])
    assert.deepEqual(agendaForToday(undefined, NOW), [])
  })

  it('formatEventTime renders local time; unparseable → em-dash', () => {
    const rendered = formatEventTime('2026-08-03T08:30:00')
    assert.match(rendered, /8:30/)
    assert.equal(formatEventTime('nope'), '—')
  })

  it('greeting follows the local hour', () => {
    assert.equal(greetingForHour(7), 'Good morning')
    assert.equal(greetingForHour(13), 'Good afternoon')
    assert.equal(greetingForHour(20), 'Good evening')
    assert.equal(greetingForHour(11), 'Good morning')
    assert.equal(greetingForHour(17), 'Good afternoon')
    assert.equal(greetingForHour(18), 'Good evening')
  })
})

// ─── Z1 handled-log fallback (G9) ───────────────────────────────────────────

describe('handled-log · result_summary → response_text fallback (G9)', () => {
  it('prefers result_summary when non-null; falls back to response_text', () => {
    const view = mapHandledLog({
      ok: true,
      items: [
        { timestamp: 't1', route: 'create_task', result_summary: 'Routed to E7A', response_text: 'Created it.' },
        { timestamp: 't2', route: 'calendar_query', result_summary: null, response_text: 'Three events left.' },
        { timestamp: 't3', route: 'brief', response_text: 'Brief delivered.' },
      ],
    })
    assert.equal(view.items[0].summary, 'Routed to E7A')
    assert.equal(view.items[1].summary, 'Three events left.')
    assert.equal(view.items[2].summary, 'Brief delivered.')
  })

  it('both fields null → empty summary string, never undefined', () => {
    const view = mapHandledLog({ ok: true, items: [{ timestamp: 't', route: 'x', result_summary: null, response_text: null }] })
    assert.equal(view.items[0].summary, '')
  })

  it('missing items array → empty view (tile hides quietly)', () => {
    const view = mapHandledLog({ ok: true })
    assert.equal(view.empty, true)
    assert.deepEqual(view.items, [])
  })
})

// ─── Z2 business grouping ───────────────────────────────────────────────────

describe('z2Projects · groupTasksByBusiness', () => {
  it('counts by status per lane, sparse-status tolerant, canonical lane order', () => {
    const groups = groupTasksByBusiness([
      task({ id: '1', business: 'SOM', status: 'in_progress' }),
      task({ id: '2', business: 'E7A', status: 'done' }),
      task({ id: '3', business: 'E7A', status: 'pending' }),
      task({ id: '4', business: 'E7A', status: 'blocked' }),
      task({ id: '5', business: 'E7A', status: null }), // sparse: total only
      task({ id: '6', business: 'E7A', status: 'weird' }), // unknown: total only
      task({ id: '7', business: null }), // no lane: ignored
      task({ id: '8', business: 'OuterSpace' }), // unknown lane: ignored
    ])
    assert.deepEqual(groups.map((g) => g.business), ['E7A', 'SOM'])
    const e7a = groups[0]
    assert.equal(e7a.total, 5)
    assert.deepEqual(e7a.counts, { pending: 1, in_progress: 0, blocked: 1, done: 1 })
    assert.equal(e7a.done, 1)
    assert.equal(e7a.percent, 20)
    assert.equal(groups[1].total, 1)
    assert.equal(groups[1].percent, 0)
  })

  it('empty / non-array input → no groups (empty tile copy)', () => {
    assert.deepEqual(groupTasksByBusiness([]), [])
    assert.deepEqual(groupTasksByBusiness(null), [])
  })
})

// ─── Z2 Book lane (G1 quiet-empty input) ────────────────────────────────────

describe('z2Projects · summarizeBookLane', () => {
  it('quiet-empty input: no Book tasks → count 0, empty true, no titles', () => {
    const summary = summarizeBookLane([])
    assert.deepEqual(summary, { count: 0, topTitles: [], empty: true })
    assert.deepEqual(summarizeBookLane(null).topTitles, [])
  })

  it('top titles ranked by priority (urgent > high > medium > low), max 3', () => {
    const summary = summarizeBookLane([
      task({ id: 'b1', title: 'Low', priority: 'low' }),
      task({ id: 'b2', title: 'Urgent', priority: 'urgent' }),
      task({ id: 'b3', title: 'Medium', priority: 'medium' }),
      task({ id: 'b4', title: 'High', priority: 'high' }),
      task({ id: 'b5', title: 'No priority', priority: null }),
    ])
    assert.equal(summary.count, 5)
    assert.equal(summary.empty, false)
    assert.deepEqual(summary.topTitles.map((t) => t.title), ['Urgent', 'High', 'Medium'])
  })
})

// ─── Z2 countdowns (nearest future, max 3, past excluded) ───────────────────

describe('z2Projects · deriveCountdowns', () => {
  it('selects up to 3 nearest FUTURE due dates; past/unparseable/absent excluded', () => {
    const countdowns = deriveCountdowns([
      task({ id: 'c1', title: 'Far', dueDate: '2026-08-20T09:00:00' }),
      task({ id: 'c2', title: 'Past', dueDate: '2026-08-01T09:00:00' }),
      task({ id: 'c3', title: 'Near', dueDate: '2026-08-04T09:00:00' }),
      task({ id: 'c4', title: 'Mid', dueDate: '2026-08-10T09:00:00' }),
      task({ id: 'c5', title: 'Broken', dueDate: 'not-a-date' }),
      task({ id: 'c6', title: 'None', dueDate: null }),
      task({ id: 'c7', title: 'Fourth', dueDate: '2026-08-15T09:00:00' }),
    ], { now: NOW })
    assert.deepEqual(countdowns.map((c) => c.label), ['Near', 'Mid', 'Fourth'])
    assert.equal(countdowns.length, 3)
  })

  it('countdown math matches computeCountdown against the fixed clock', () => {
    const [near] = deriveCountdowns([task({ id: 'c3', dueDate: '2026-08-05T12:00:00' })], { now: NOW })
    assert.deepEqual(
      { days: near.countdown.days, hours: near.countdown.hours },
      { days: computeCountdown('2026-08-05T12:00:00', NOW).days, hours: 0 },
    )
    assert.equal(formatCountdown(near.countdown), '2d 0h')
  })

  it('quiet-empty when nothing is dated', () => {
    assert.deepEqual(deriveCountdowns([], { now: NOW }), [])
    assert.deepEqual(deriveCountdowns([task({ dueDate: '2026-08-01T09:00:00' })], { now: NOW }), [])
  })

  it('formatCountdown renders hours-only under a day', () => {
    const countdown = computeCountdown('2026-08-03T17:00:00', NOW)
    assert.equal(formatCountdown(countdown), '5h')
    assert.equal(formatCountdown(null), '')
  })
})
