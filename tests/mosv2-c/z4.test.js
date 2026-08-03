// z4.test.js — Z4 Life/Personal pure-logic tests (PLAN §8 Z4, G3 restricted
// set, §13). No DOM: every behavior under test lives in the pure module
// z4Personal.js plus the personal/calendar adapter mappers, the shared agenda
// derivation, and the Z4 fixture state specimens.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { mapPersonalTasks } from '../../src/v2/data/adapters/personal.js'
import { mapCalendarEvents } from '../../src/v2/data/adapters/calendar.js'
import {
  EMPTY_COPY,
  FIXTURE_CLASSIFICATION,
  fixturePersonalCalendar,
  fixturePersonalCalendarEmpty,
  fixturePersonalTasks,
  fixturePersonalTasksEmpty,
  fixtureTileStates,
} from '../../src/v2/data/fixtures.js'
import { MAX_PERSONAL_TASKS, formatDueDate, openPersonalTasks } from '../../src/v2/zones/z4Personal.js'
import { agendaForToday } from '../../src/v2/zones/z1Agenda.js'

// Fixed local clock for every test: Sunday 2026-08-02, 20:00 local time
// (matches the frozen fixture clock's wall time, kept timezone-naive so the
// today filter is deterministic on any machine).
const NOW = new Date(2026, 7, 2, 20, 0, 0)

const personalTask = (overrides = {}) => ({
  id: 'rec-p1',
  title: 'Personal task',
  business: 'Personal',
  status: 'pending',
  priority: 'medium',
  dueDate: null,
  ...overrides,
})

// ─── Z4 personal tasks · open-task derivation ───────────────────────────────

describe('z4Personal · openPersonalTasks', () => {
  it('drops done tasks; keeps every open status', () => {
    const open = openPersonalTasks([
      personalTask({ id: 'a', status: 'done' }),
      personalTask({ id: 'b', status: 'pending' }),
      personalTask({ id: 'c', status: 'in_progress' }),
      personalTask({ id: 'd', status: 'blocked' }),
    ])
    assert.deepEqual(open.map((t) => t.id), ['b', 'c', 'd'])
  })

  it('ranks by priority (urgent > high > medium > low; absent last), then soonest due date', () => {
    const open = openPersonalTasks([
      personalTask({ id: 'low', priority: 'low', dueDate: '2026-08-03' }),
      personalTask({ id: 'urgent', priority: 'urgent', dueDate: '2026-08-20' }),
      personalTask({ id: 'none', priority: null }),
      personalTask({ id: 'high-far', priority: 'high', dueDate: '2026-08-10' }),
      personalTask({ id: 'high-near', priority: 'high', dueDate: '2026-08-05' }),
      personalTask({ id: 'weird', priority: 'someday' }),
    ], { limit: 10 })
    assert.deepEqual(
      open.map((t) => t.id),
      ['urgent', 'high-near', 'high-far', 'low', 'none', 'weird'],
    )
  })

  it('unparseable due dates sort after dated tasks within the same priority', () => {
    const open = openPersonalTasks([
      personalTask({ id: 'broken', priority: 'high', dueDate: 'not-a-date' }),
      personalTask({ id: 'dated', priority: 'high', dueDate: '2026-08-06' }),
    ])
    assert.deepEqual(open.map((t) => t.id), ['dated', 'broken'])
  })

  it('caps at MAX_PERSONAL_TASKS and honors a smaller limit', () => {
    const many = Array.from({ length: MAX_PERSONAL_TASKS + 2 }, (_, index) =>
      personalTask({ id: `t-${index}` }),
    )
    assert.equal(MAX_PERSONAL_TASKS, 5)
    assert.equal(openPersonalTasks(many).length, MAX_PERSONAL_TASKS)
    assert.deepEqual(openPersonalTasks(many, { limit: 2 }).map((t) => t.id), ['t-0', 't-1'])
  })

  it('sparse fields tolerated: null title/priority/dueDate get safe defaults', () => {
    const [view] = openPersonalTasks([
      { id: null, title: '', business: 'Personal', status: 'pending', priority: null, dueDate: null },
    ])
    assert.deepEqual(view, { id: null, title: 'Untitled task', status: 'pending', priority: null, dueDate: null })
  })

  it('quiet-empty (G3): empty / non-array input yields an empty list, never an error', () => {
    assert.deepEqual(openPersonalTasks([]), [])
    assert.deepEqual(openPersonalTasks(null), [])
    assert.deepEqual(openPersonalTasks(undefined), [])
    assert.deepEqual(openPersonalTasks([personalTask({ status: 'done' })]), [])
  })
})

describe('z4Personal · formatDueDate', () => {
  it('renders a compact local date; absent/unparseable → em-dash (§8 partial rule)', () => {
    assert.equal(formatDueDate('2026-08-06T09:00:00'), 'Aug 6')
    assert.equal(formatDueDate('2026-12-25'), 'Dec 25')
    assert.equal(formatDueDate('not-a-date'), '—')
    assert.equal(formatDueDate(null), '—')
    assert.equal(formatDueDate(undefined), '—')
  })
})

// ─── Z4 fixtures · personal task lane (G3 quiet-empty law) ──────────────────

describe('z4 fixtures · personal tasks lane (G3)', () => {
  it('fixture lane maps to open tasks ranked by priority', () => {
    const view = mapPersonalTasks(fixturePersonalTasks)
    assert.equal(view.count, 2)
    assert.equal(view.empty, false)
    assert.ok(view.tasks.every((task) => task.business === 'Personal'))
    const open = openPersonalTasks(view.tasks)
    assert.deepEqual(open.map((t) => t.title), ['Renew car insurance', 'Book dentist appointment'])
    assert.equal(open[0].priority, 'medium')
    assert.equal(open[1].priority, 'low')
  })

  it('empty lane payload maps to quiet-empty — the G3 absence path, never an error', () => {
    const view = mapPersonalTasks(fixturePersonalTasksEmpty)
    assert.equal(view.count, 0)
    assert.equal(view.empty, true)
    assert.deepEqual(openPersonalTasks(view.tasks), [])
    assert.equal(fixturePersonalTasksEmpty.emptyCopy, EMPTY_COPY.PERSONAL_TASKS)
    assert.equal(EMPTY_COPY.PERSONAL_TASKS, 'No personal tasks open.')
  })
})

// ─── Z4 fixtures · personal calendar (shared calendar adapter) ──────────────

describe('z4 fixtures · personal calendar (G3)', () => {
  it('fixture events map verbatim (title/start/end pass-through, server-sanitized)', () => {
    const view = mapCalendarEvents(fixturePersonalCalendar)
    assert.equal(view.count, 2)
    assert.equal(view.empty, false)
    assert.deepEqual(
      view.events.map((event) => [event.title, event.start, event.end]),
      fixturePersonalCalendar.events.map((event) => [event.title, event.start, event.end]),
    )
  })

  it('today filter keeps only local-today events, sorted by start', () => {
    const agenda = agendaForToday([
      { title: 'Dinner with family', start: '2026-08-02T19:00:00', end: '2026-08-02T20:30:00' },
      { title: 'Gym tomorrow', start: '2026-08-03T06:30:00', end: '2026-08-03T07:30:00' },
      { title: 'Late wind-down', start: '2026-08-02T23:30:00', end: '2026-08-03T00:00:00' },
      { title: 'Broken', start: 'not-a-date' },
    ], NOW)
    assert.deepEqual(agenda.map((event) => event.title), ['Dinner with family', 'Late wind-down'])
  })

  it('empty calendar payload maps to quiet-empty with the ruled copy', () => {
    const view = mapCalendarEvents(fixturePersonalCalendarEmpty)
    assert.equal(view.empty, true)
    assert.deepEqual(agendaForToday(view.events, NOW), [])
    assert.equal(fixturePersonalCalendarEmpty.emptyCopy, EMPTY_COPY.PERSONAL_CALENDAR)
    assert.equal(EMPTY_COPY.PERSONAL_CALENDAR, 'Nothing tracked today.')
  })
})

// ─── Z4 fixture state specimens (every §9 state, FIXTURE-classified) ────────

describe('z4 fixtures · tile state specimens', () => {
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

  for (const [tile, copy] of [
    ['z4PersonalTasks', EMPTY_COPY.PERSONAL_TASKS],
    ['z4PersonalCalendar', EMPTY_COPY.PERSONAL_CALENDAR],
  ]) {
    it(`${tile} covers every canonical state, FIXTURE-labeled, with ruled empty copy`, () => {
      const states = fixtureTileStates[tile]
      for (const name of CANONICAL_STATES) {
        assert.ok(states[name], `${tile}.${name} must exist`)
        assert.equal(states[name].status, name)
        assert.equal(states[name].classification, FIXTURE_CLASSIFICATION)
      }
      assert.equal(states.empty.copy, copy)
      assert.equal(states.stale.data != null, true, 'stale keeps last-good data')
      assert.equal(states.error.data, null, 'error never carries data')
      assert.equal(states['permission-denied'].error.kind, 'permission')
    })
  }
})

// ─── G3 restricted set law (static source scan, zero network) ───────────────

describe('z4 · G3 restricted set law', () => {
  const zoneSource = readFileSync(
    fileURLToPath(new URL('../../src/v2/zones/Z4Personal.jsx', import.meta.url)),
    'utf8',
  )
  // Comments name the excluded sources by law; the scan covers code only.
  const codeOnly = zoneSource
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('//'))
    .join('\n')

  it('Z4 fetches only through the personal and calendar adapters', () => {
    assert.match(codeOnly, /adapters\/personal\.js/)
    assert.match(codeOnly, /adapters\/calendar\.js/)
    assert.equal(/adapters\/(tasks|auditLog|book)\.js/.test(codeOnly), false)
  })

  it('Z4 contains no excluded sources — no VitalStack, travel, people, or direct network', () => {
    assert.equal(/vital/i.test(codeOnly), false)
    assert.equal(/travel/i.test(codeOnly), false)
    assert.equal(/people/i.test(codeOnly), false)
    assert.equal(/(?<![A-Za-z])fetch\s*\(/.test(codeOnly), false)
    assert.equal(/XMLHttpRequest/.test(codeOnly), false)
    assert.equal(/https?:\/\//.test(codeOnly), false)
  })
})
