// adapters.test.js — MOSV2-C adapter mappers: sparse-field tolerance (live
// audit §3.4), pulse bucket length counting, G9 fallback, lane filtering, and
// exact same-origin request paths.

import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { fetchPulse, fetchTasks, mapPulse, mapTask, mapTasks } from '../../src/v2/data/adapters/tasks.js'
import { fetchCalendarEvents, mapCalendarEvents } from '../../src/v2/data/adapters/calendar.js'
import { fetchHandledLog, mapHandledLog } from '../../src/v2/data/adapters/auditLog.js'
import { fetchPersonalTasks, mapPersonalTasks } from '../../src/v2/data/adapters/personal.js'
import { fetchBookTasks, mapBookTasks } from '../../src/v2/data/adapters/book.js'
import { fixturePulse } from '../../src/v2/data/fixtures.js'

const realFetch = globalThis.fetch
const realLocalStorage = globalThis.localStorage

function jsonResponse(payload, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => payload }
}

beforeEach(() => {
  globalThis.localStorage = { getItem: () => null }
})

afterEach(() => {
  globalThis.fetch = realFetch
  if (realLocalStorage === undefined) delete globalThis.localStorage
  else globalThis.localStorage = realLocalStorage
})

describe('adapters · request paths (same-origin /api/* only)', () => {
  it('builds the exact verified endpoint URLs', async () => {
    const seen = []
    globalThis.fetch = async (path) => { seen.push(path); return jsonResponse({ ok: true }) }
    const signal = new AbortController().signal
    await fetchTasks(signal)
    await fetchTasks(signal, { business: 'Book' })
    await fetchPulse(signal)
    await fetchCalendarEvents(signal)
    await fetchHandledLog(signal)
    await fetchPersonalTasks(signal)
    await fetchBookTasks(signal)
    assert.deepEqual(seen, [
      '/api/tasks',
      '/api/tasks?business=Book',
      '/api/pulse',
      '/api/mya/calendar/events?days_ahead=1&max_results=20',
      '/api/mya/audit/handled?limit=3',
      '/api/tasks?business=Personal',
      '/api/tasks?business=Book',
    ])
  })
})

describe('adapters · tasks mapper (sparse-field tolerance)', () => {
  it('treats assigned_agent / requires_approval as optional (audit §3.4)', () => {
    const sparse = mapTask({ id: 'rec1', business: 'E7A', title: 'A', priority: 'high', status: 'pending' })
    assert.equal(sparse.assignedAgent, null)
    assert.equal(sparse.requiresApproval, null)
    assert.equal(sparse.approvalStatus, null)
    assert.equal(sparse.dueDate, null)

    const full = mapTask({ id: 'rec2', business: 'SOM', title: 'B', assigned_agent: 'SOM Executive', requires_approval: true, approval_status: 'pending' })
    assert.equal(full.assignedAgent, 'SOM Executive')
    assert.equal(full.requiresApproval, true)
  })

  it('tolerates null, empty, and malformed payloads without throwing', () => {
    assert.deepEqual(mapTasks(null), { tasks: [], count: 0, empty: true })
    assert.deepEqual(mapTasks({}), { tasks: [], count: 0, empty: true })
    assert.deepEqual(mapTasks({ tasks: 'nope' }), { tasks: [], count: 0, empty: true })
    assert.equal(mapTasks({ tasks: [null, undefined] }).count, 2, 'records normalize, never crash')
  })
})

describe('adapters · pulse mapper (buckets are ARRAYS — count lengths)', () => {
  it('counts bucket array lengths, never reads pre-computed counts', () => {
    const { counts, total, empty } = mapPulse(fixturePulse)
    assert.deepEqual(counts, fixturePulse.expectedCounts)
    assert.equal(total, 7)
    assert.equal(empty, false)
  })

  it('missing or malformed buckets count as zero', () => {
    assert.deepEqual(mapPulse(null).counts, { urgent: 0, overdue: 0, blocked: 0, approval: 0, done_today: 0, stale: 0 })
    assert.equal(mapPulse(null).empty, true)
    const weird = mapPulse({ pulse: { urgent: 5, overdue: null, blocked: {} } })
    assert.deepEqual(weird.counts, { urgent: 0, overdue: 0, blocked: 0, approval: 0, done_today: 0, stale: 0 })
  })
})

describe('adapters · calendar mapper', () => {
  it('maps verified fields and falls back title → summary', () => {
    const mapped = mapCalendarEvents({
      events: [
        { summary: 'Only summary', start: '2026-08-02T21:00:00-04:00', end: '2026-08-02T22:00:00-04:00' },
        { title: 'Has title', summary: 'And summary', start: '2026-08-02T23:00:00-04:00', end: '2026-08-03T00:00:00-04:00', source_calendar_id: 'primary' },
      ],
      fetched_at: '2026-08-02T20:00:00-04:00',
    })
    assert.equal(mapped.count, 2)
    assert.equal(mapped.events[0].title, 'Only summary')
    assert.equal(mapped.events[1].title, 'Has title')
    assert.equal(mapped.events[1].sourceCalendarId, 'primary')
    assert.equal(mapped.fetchedAt, '2026-08-02T20:00:00-04:00')
  })

  it('tolerates empty and malformed payloads', () => {
    assert.equal(mapCalendarEvents({ events: [] }).empty, true)
    assert.equal(mapCalendarEvents(null).empty, true)
    assert.equal(mapCalendarEvents({}).fetchedAt, null)
  })
})

describe('adapters · handled-log mapper (G9 fallback)', () => {
  it('prefers result_summary, falls back to response_text when null', () => {
    const mapped = mapHandledLog({
      items: [
        { timestamp: 't1', route: 'create_task', result_summary: 'Task routed', response_text: 'Created it.' },
        { timestamp: 't2', route: 'brief', result_summary: null, response_text: 'Here is your brief.' },
        { timestamp: 't3', route: 'query', result_summary: null, response_text: null },
      ],
    })
    assert.equal(mapped.items[0].summary, 'Task routed')
    assert.equal(mapped.items[1].summary, 'Here is your brief.')
    assert.equal(mapped.items[2].summary, '')
  })

  it('tolerates empty and malformed payloads', () => {
    assert.equal(mapHandledLog(null).empty, true)
    assert.equal(mapHandledLog({ items: null }).empty, true)
  })
})

describe('adapters · business lanes (G1 Book, G3 Personal)', () => {
  const mixed = {
    ok: true,
    tasks: [
      { id: 'a', business: 'Personal', title: 'Dentist', status: 'pending' },
      { id: 'b', business: 'Book', title: 'Chapter 7', status: 'in_progress' },
      { id: 'c', business: 'E7A', title: 'Mix', status: 'pending' },
      { id: 'd', title: 'No business field', status: 'pending' },
    ],
  }

  it('personal lane keeps only Personal tasks', () => {
    const mapped = mapPersonalTasks(mixed)
    assert.deepEqual(mapped.tasks.map((t) => t.id), ['a'])
    assert.equal(mapped.empty, false)
  })

  it('book lane keeps only Book tasks; empty lane is lawful quiet-empty (G1)', () => {
    assert.deepEqual(mapBookTasks(mixed).tasks.map((t) => t.id), ['b'])
    const none = mapBookTasks({ ok: true, tasks: [{ id: 'c', business: 'E7A', title: 'Mix' }] })
    assert.equal(none.empty, true)
    assert.equal(none.count, 0)
  })
})
