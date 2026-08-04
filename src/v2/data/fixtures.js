// fixtures.js — MOSV2-C deterministic FIXTURE data (PLAN §3.6/§8, ruling 9.6).
// Every export is Gallery demonstration data, visibly classified FIXTURE, and
// performs zero network calls. Dates are frozen so tests and screenshots are
// reproducible. This module must never import anything that touches network.

import { DATA_CLASSIFICATION } from './tileMachine.js'

export const FIXTURE_CLASSIFICATION = DATA_CLASSIFICATION.FIXTURE
export const FIXTURE_LABEL = 'FIXTURE — deterministic gallery data · zero network'

// Frozen clock for every fixture: Sunday 2026-08-02 20:00 America/New_York.
export const FIXTURE_NOW_ISO = '2026-08-02T20:00:00-04:00'
export const FIXTURE_NOW_MS = new Date(FIXTURE_NOW_ISO).getTime()

// Founder-ruled truthful copy (PLAN §3.8 pre-B2, G2, G4).
export const UNAVAILABLE_COPY = Object.freeze({
  FM_PRE_B2: 'Financial data unavailable — verification pending.',
  SOM_DEFERRED: 'SOM data connection pending.',
  REVENUE_DEFERRED: 'Revenue trend unavailable — daily source not connected.',
})

export const EMPTY_COPY = Object.freeze({
  AGENDA: 'Nothing scheduled today.',
  PROJECTS: 'No active projects.',
  BOOK: 'No Book tasks on the board.',
  PERSONAL_TASKS: 'No personal tasks open.',
  PERSONAL_CALENDAR: 'Nothing tracked today.',
})

const asFixture = (data) => Object.freeze({ classification: FIXTURE_CLASSIFICATION, ...data })

// ─── Z1 · Today ─────────────────────────────────────────────────────────────

export const fixtureGreeting = asFixture({
  name: 'Denarius',
  daypart: 'evening',
  dateLabel: 'Sunday, August 2',
})

// Known-severity signal set (7 entries) proving rank order and the max-6 law:
// crit > exec > ai > warn > info > good, and the 7th signal never renders.
export const fixtureSignals = asFixture({
  signals: Object.freeze([
    { id: 'sig-good-1', severity: 'good', summary: 'Weekly review complete', route: '/v2/work' },
    { id: 'sig-info-1', severity: 'info', summary: '3 tasks completed today', route: '/v2/work' },
    { id: 'sig-crit-1', severity: 'crit', summary: 'Invoice approval blocked 2 days', route: '/v2/money' },
    { id: 'sig-warn-1', severity: 'warn', summary: 'Book chapter draft overdue', route: '/v2/book' },
    { id: 'sig-exec-1', severity: 'exec', summary: 'Board deck needs sign-off', route: '/v2/exec' },
    { id: 'sig-ai-1', severity: 'ai', summary: 'Mya drafted 2 replies for review', route: '/v2/mya' },
    { id: 'sig-info-2', severity: 'info', summary: 'Calendar synced 4 minutes ago', route: '/v2/life' },
  ]),
  expectedOrder: Object.freeze(['sig-crit-1', 'sig-exec-1', 'sig-ai-1', 'sig-warn-1', 'sig-info-1', 'sig-info-2']),
  expectedDropped: 'sig-good-1',
})

export const fixtureAgenda = asFixture({
  events: Object.freeze([
    { title: 'Studio session — mixing', start: '2026-08-02T21:00:00-04:00', end: '2026-08-02T22:30:00-04:00' },
    { title: 'Call with Terrell', start: '2026-08-02T22:45:00-04:00', end: '2026-08-02T23:15:00-04:00' },
    { title: 'Wind-down review', start: '2026-08-02T23:30:00-04:00', end: '2026-08-03T00:00:00-04:00' },
  ]),
})
export const fixtureAgendaEmpty = asFixture({ events: Object.freeze([]), emptyCopy: EMPTY_COPY.AGENDA })

// Handled-log digest: the second entry has result_summary null to prove the
// G9 response_text fallback; the first prefers result_summary when present.
export const fixtureHandledLog = asFixture({
  items: Object.freeze([
    { timestamp: '2026-08-02T19:41:00-04:00', route: 'create_task', result_summary: 'Task routed to E7A Executive', response_text: 'Created the task for you.' },
    { timestamp: '2026-08-02T18:12:00-04:00', route: 'calendar_query', result_summary: null, response_text: 'You have three events left today.' },
    { timestamp: '2026-08-02T16:05:00-04:00', route: 'brief', result_summary: 'Morning brief delivered', response_text: 'Here is your morning brief.' },
  ]),
})
export const fixtureHandledLogEmpty = asFixture({ items: Object.freeze([]) })

// ─── Z2 · Projects ──────────────────────────────────────────────────────────

// MASTER_TASKS-shaped payload with deliberately sparse optional fields
// (assigned_agent / requires_approval absent on some records, per live audit).
export const fixtureProjectTasks = asFixture({
  ok: true,
  count: 5,
  tasks: Object.freeze([
    { id: 'rec-fix-e7a-1', business: 'E7A', title: 'Mix revisions — single 3', status: 'in_progress', priority: 'urgent', owner: 'Denarius', assigned_agent: 'E7A Executive', due_date: '2026-08-04', created_at: '2026-07-28T14:00:00-04:00' },
    { id: 'rec-fix-e7a-2', business: 'E7A', title: 'Artwork approval', status: 'pending', priority: 'high', owner: 'Denarius', created_at: '2026-07-30T09:30:00-04:00' },
    { id: 'rec-fix-som-1', business: 'SOM', title: 'Curriculum outline — level 2', status: 'in_progress', priority: 'medium', owner: 'Denarius', requires_approval: true, approval_status: 'pending', created_at: '2026-07-25T11:00:00-04:00' },
    { id: 'rec-fix-fm-1', business: 'FM', title: 'Reconcile July statements', status: 'blocked', priority: 'high', owner: 'Denarius', created_at: '2026-07-29T16:45:00-04:00' },
    { id: 'rec-fix-e7a-3', business: 'E7A', title: 'Sync licensing quote', status: 'pending', priority: 'low', owner: 'Denarius', created_at: '2026-08-01T10:15:00-04:00' },
  ]),
})
export const fixtureProjectsEmpty = asFixture({ ok: true, count: 0, tasks: Object.freeze([]), emptyCopy: EMPTY_COPY.PROJECTS })

// G1 Book lane: task-based Book information only; quiet-empty when none exist.
export const fixtureBookTasks = asFixture({
  ok: true,
  count: 2,
  tasks: Object.freeze([
    { id: 'rec-fix-book-1', business: 'Book', title: 'Chapter 7 second pass', status: 'in_progress', priority: 'high', owner: 'Denarius', created_at: '2026-07-27T13:00:00-04:00' },
    { id: 'rec-fix-book-2', business: 'Book', title: 'Cover brief to designer', status: 'pending', priority: 'medium', owner: 'Denarius', created_at: '2026-08-01T08:00:00-04:00' },
  ]),
})
export const fixtureBookEmpty = asFixture({ ok: true, count: 0, tasks: Object.freeze([]), emptyCopy: EMPTY_COPY.BOOK })

// Dated task proving countdown math against the frozen clock:
// 2026-08-05T17:00 − 2026-08-02T20:00 = 2 days 21 hours remaining.
export const fixtureCountdowns = asFixture({
  countdowns: Object.freeze([
    { id: 'cd-fix-1', label: 'Mix revisions — single 3', targetDate: '2026-08-05T17:00:00-04:00', expected: Object.freeze({ days: 2, hours: 21 }) },
    { id: 'cd-fix-2', label: 'Chapter 7 second pass', targetDate: '2026-08-09T09:00:00-04:00', expected: Object.freeze({ days: 6, hours: 13 }) },
  ]),
})
export const fixtureCountdownsEmpty = asFixture({ countdowns: Object.freeze([]) })

// ─── Z3 · Business ──────────────────────────────────────────────────────────

// G4: the revenue chart is FIXTURE-only. Hand-written daily points with known
// values — never interpolated or subdivided from monthly data.
export const fixtureRevenueSeries = asFixture({
  '7D': Object.freeze({
    range: '7D',
    points: Object.freeze([
      { date: '2026-07-27', value: 412 },
      { date: '2026-07-28', value: 388 },
      { date: '2026-07-29', value: 455 },
      { date: '2026-07-30', value: 470 },
      { date: '2026-07-31', value: 521 },
      { date: '2026-08-01', value: 498 },
      { date: '2026-08-02', value: 536 },
    ]),
  }),
  '30D': Object.freeze({
    range: '30D',
    points: Object.freeze([
      { date: '2026-07-04', value: 301 }, { date: '2026-07-05', value: 289 },
      { date: '2026-07-06', value: 315 }, { date: '2026-07-07', value: 342 },
      { date: '2026-07-08', value: 330 }, { date: '2026-07-09', value: 356 },
      { date: '2026-07-10', value: 371 }, { date: '2026-07-11', value: 348 },
      { date: '2026-07-12', value: 362 }, { date: '2026-07-13', value: 390 },
      { date: '2026-07-14', value: 405 }, { date: '2026-07-15', value: 418 },
      { date: '2026-07-16', value: 402 }, { date: '2026-07-17', value: 433 },
      { date: '2026-07-18', value: 447 }, { date: '2026-07-19', value: 421 },
      { date: '2026-07-20', value: 438 }, { date: '2026-07-21', value: 456 },
      { date: '2026-07-22', value: 471 }, { date: '2026-07-23', value: 449 },
      { date: '2026-07-24', value: 463 }, { date: '2026-07-25', value: 480 },
      { date: '2026-07-26', value: 427 }, { date: '2026-07-27', value: 412 },
      { date: '2026-07-28', value: 388 }, { date: '2026-07-29', value: 455 },
      { date: '2026-07-30', value: 470 }, { date: '2026-07-31', value: 521 },
      { date: '2026-08-01', value: 498 }, { date: '2026-08-02', value: 536 },
    ]),
  }),
  QTD: Object.freeze({
    range: 'QTD',
    // Quarter-to-date through the frozen clock: Jul 1 → Aug 2 = 33 daily points.
    points: Object.freeze([
      { date: '2026-07-01', value: 268 }, { date: '2026-07-02', value: 284 },
      { date: '2026-07-03', value: 297 }, { date: '2026-07-04', value: 301 },
      { date: '2026-07-05', value: 289 }, { date: '2026-07-06', value: 315 },
      { date: '2026-07-07', value: 342 }, { date: '2026-07-08', value: 330 },
      { date: '2026-07-09', value: 356 }, { date: '2026-07-10', value: 371 },
      { date: '2026-07-11', value: 348 }, { date: '2026-07-12', value: 362 },
      { date: '2026-07-13', value: 390 }, { date: '2026-07-14', value: 405 },
      { date: '2026-07-15', value: 418 }, { date: '2026-07-16', value: 402 },
      { date: '2026-07-17', value: 433 }, { date: '2026-07-18', value: 447 },
      { date: '2026-07-19', value: 421 }, { date: '2026-07-20', value: 438 },
      { date: '2026-07-21', value: 456 }, { date: '2026-07-22', value: 471 },
      { date: '2026-07-23', value: 449 }, { date: '2026-07-24', value: 463 },
      { date: '2026-07-25', value: 480 }, { date: '2026-07-26', value: 427 },
      { date: '2026-07-27', value: 412 }, { date: '2026-07-28', value: 388 },
      { date: '2026-07-29', value: 455 }, { date: '2026-07-30', value: 470 },
      { date: '2026-07-31', value: 521 }, { date: '2026-08-01', value: 498 },
      { date: '2026-08-02', value: 536 },
    ]),
  }),
})

// FM stat tiles: FIXTURE demonstration only (§3.8 — nothing FM renders live
// pre-B2). Live tile copy is UNAVAILABLE_COPY.FM_PRE_B2.
export const fixtureFmStats = asFixture({
  status: 'live',
  as_of: '2026-08-02',
  ytd: Object.freeze({ income: 48240, expenses: 31980, net: 16260, expense_ratio: 0.663 }),
})

// §3.6 proof payload: a "status":"mock" FM summary that must always enter the
// unavailable/error state and never render as executive data.
export const fixtureFmMockPayload = Object.freeze({
  status: 'mock',
  source: 'hardcoded-fallback',
  as_of: '2026-08-02',
  ytd: Object.freeze({ income: 99999, expenses: 11111, net: 88888, expense_ratio: 0.111 }),
})

// Live-audit shape clarification: pulse buckets are ARRAYS of task objects —
// the tile counts lengths. Known counts: 2 / 1 / 0 / 1 / 3 / 0.
export const fixturePulse = asFixture({
  ok: true,
  pulse: Object.freeze({
    urgent: Object.freeze([
      { id: 'rec-fix-pulse-1', business: 'E7A', title: 'Mix revisions — single 3', priority: 'urgent', status: 'in_progress' },
      { id: 'rec-fix-pulse-2', business: 'SOM', title: 'Curriculum outline — level 2', priority: 'urgent', status: 'pending', assigned_agent: 'SOM Executive' },
    ]),
    overdue: Object.freeze([
      { id: 'rec-fix-pulse-3', business: 'Book', title: 'Chapter 7 second pass', priority: 'high', status: 'in_progress', due_date: '2026-07-31' },
    ]),
    blocked: Object.freeze([]),
    approval: Object.freeze([
      { id: 'rec-fix-pulse-4', business: 'SOM', title: 'Curriculum outline — level 2', priority: 'medium', status: 'pending', requires_approval: true, approval_status: 'pending' },
    ]),
    done_today: Object.freeze([
      { id: 'rec-fix-pulse-5', business: 'E7A', title: 'Send stems to mixer', priority: 'medium', status: 'done' },
      { id: 'rec-fix-pulse-6', business: 'Personal', title: 'Book dentist appointment', priority: 'low', status: 'done' },
      { id: 'rec-fix-pulse-7', business: 'FM', title: 'Pay studio invoice', priority: 'high', status: 'done' },
    ]),
    stale: Object.freeze([]),
  }),
  expectedCounts: Object.freeze({ urgent: 2, overdue: 1, blocked: 0, approval: 1, done_today: 3, stale: 0 }),
})

// G2: SOM tile is DEFERRED — this FIXTURE demonstrates the eventual populated
// state in the Gallery only; the live tile renders UNAVAILABLE_COPY.SOM_DEFERRED.
export const fixtureSomCount = asFixture({ activeStudents: 24 })

// ─── Z4 · Life (G3 restricted set) ──────────────────────────────────────────

export const fixturePersonalTasks = asFixture({
  ok: true,
  count: 2,
  tasks: Object.freeze([
    { id: 'rec-fix-per-1', business: 'Personal', title: 'Book dentist appointment', status: 'pending', priority: 'low', due_date: '2026-08-06', created_at: '2026-07-30T12:00:00-04:00' },
    { id: 'rec-fix-per-2', business: 'Personal', title: 'Renew car insurance', status: 'in_progress', priority: 'medium', due_date: '2026-08-10', created_at: '2026-07-29T17:20:00-04:00' },
  ]),
})
export const fixturePersonalTasksEmpty = asFixture({ ok: true, count: 0, tasks: Object.freeze([]), emptyCopy: EMPTY_COPY.PERSONAL_TASKS })

export const fixturePersonalCalendar = asFixture({
  events: Object.freeze([
    { title: 'Dinner with family', start: '2026-08-02T19:00:00-04:00', end: '2026-08-02T20:30:00-04:00' },
    { title: 'Gym', start: '2026-08-03T06:30:00-04:00', end: '2026-08-03T07:30:00-04:00' },
  ]),
})
export const fixturePersonalCalendarEmpty = asFixture({ events: Object.freeze([]), emptyCopy: EMPTY_COPY.PERSONAL_CALENDAR })

// ─── Z5 · Quick actions (dispatch — the ONLY write) ─────────────────────────

// create_task_core response shapes (code-verified): {"ok", "task": {"id",
// "deduped", ...}}; requires_approval:true ⇒ approval_status "pending".
export const fixtureDispatchSuccess = asFixture({
  ok: true,
  task: Object.freeze({
    id: 'rec-fix-dispatch-1',
    deduped: false,
    title: 'Follow up on sync licensing quote',
    business: 'E7A',
    priority: 'high',
    assigned_agent: 'E7A Executive',
    requires_approval: true,
    approval_status: 'pending',
  }),
})
export const fixtureDispatchDeduped = asFixture({
  ok: true,
  task: Object.freeze({
    id: 'rec-fix-dispatch-1',
    deduped: true,
    title: 'Follow up on sync licensing quote',
    business: 'E7A',
    priority: 'high',
    assigned_agent: 'E7A Executive',
    requires_approval: true,
    approval_status: 'pending',
  }),
})
export const fixtureDispatchFailure = asFixture({
  ok: false,
  status: 502,
  data: Object.freeze({ detail: 'Upstream unavailable' }),
  errorKind: 'http',
})

// ─── Forced-state specimens (every tile × every §9 state) ───────────────────
// Ready-made tile-state objects for Gallery specimens and tests. `data` is the
// populated payload; states that render content reuse it so every state of the
// same tile stays visually comparable. All specimens are FIXTURE-classified.

function specimen(status, { data = null, error = null, copy = null } = {}) {
  return Object.freeze({
    classification: FIXTURE_CLASSIFICATION,
    status,
    data,
    lastGood: status === 'stale' || status === 'offline' ? data : null,
    updatedAt: data ? FIXTURE_NOW_ISO : null,
    error,
    copy,
  })
}

const HTTP_ERROR = Object.freeze({ kind: 'http', message: 'Source unreachable', mock: false })
const PERMISSION_ERROR = Object.freeze({ kind: 'permission', message: 'Sign-in needed', mock: false })
const MOCK_ERROR = Object.freeze({ kind: 'mock', message: 'Source returned mock data', mock: true })

function stateSet(data, { emptyCopy, unavailableCopy = null } = {}) {
  return Object.freeze({
    loading: specimen('loading'),
    populated: specimen('populated', { data }),
    empty: specimen('empty', { copy: emptyCopy }),
    partial: specimen('partial', { data }),
    stale: specimen('stale', { data, error: HTTP_ERROR }),
    error: specimen('error', { error: HTTP_ERROR }),
    'permission-denied': specimen('permission-denied', { error: PERMISSION_ERROR }),
    offline: specimen('offline', { data, error: Object.freeze({ kind: 'offline', message: 'You appear to be offline', mock: false }) }),
    'b2-pending': specimen('b2-pending', { copy: unavailableCopy || UNAVAILABLE_COPY.FM_PRE_B2 }),
  })
}

export const fixtureTileStates = Object.freeze({
  classification: FIXTURE_CLASSIFICATION,
  z1Signals: stateSet(fixtureSignals),
  z1Agenda: stateSet(fixtureAgenda, { emptyCopy: EMPTY_COPY.AGENDA }),
  z1HandledLog: stateSet(fixtureHandledLog),
  z2Projects: stateSet(fixtureProjectTasks, { emptyCopy: EMPTY_COPY.PROJECTS }),
  z2Book: stateSet(fixtureBookTasks, { emptyCopy: EMPTY_COPY.BOOK }),
  z2Countdowns: stateSet(fixtureCountdowns),
  z3RevenueChart: stateSet(fixtureRevenueSeries, { unavailableCopy: UNAVAILABLE_COPY.REVENUE_DEFERRED }),
  z3FmStats: stateSet(fixtureFmStats, { unavailableCopy: UNAVAILABLE_COPY.FM_PRE_B2 }),
  z3FmMockRejection: Object.freeze({
    classification: FIXTURE_CLASSIFICATION,
    mockPayload: fixtureFmMockPayload,
    resultingState: specimen('error', { error: MOCK_ERROR }),
  }),
  z3Pulse: stateSet(fixturePulse),
  z3SomCount: stateSet(fixtureSomCount, { unavailableCopy: UNAVAILABLE_COPY.SOM_DEFERRED }),
  z4PersonalTasks: stateSet(fixturePersonalTasks, { emptyCopy: EMPTY_COPY.PERSONAL_TASKS }),
  z4PersonalCalendar: stateSet(fixturePersonalCalendar, { emptyCopy: EMPTY_COPY.PERSONAL_CALENDAR }),
  z5Dispatch: Object.freeze({
    classification: FIXTURE_CLASSIFICATION,
    success: fixtureDispatchSuccess,
    deduped: fixtureDispatchDeduped,
    failure: fixtureDispatchFailure,
  }),
})
