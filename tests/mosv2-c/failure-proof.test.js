// failure-proof.test.js — MOSV2-C failure-stage proof gaps not covered by the
// per-zone suites: mock rejection for EVERY adapter (PLAN §13, ruling §3.6),
// typed failure-kind propagation through every read adapter, the 9.5
// tile-local auth-failure law (expired som_token ⇒ tile-local "sign-in
// needed"; never a global logout or redirect), and the §14 sanitized-title
// spot-check (raw vs rendered — verbatim passthrough, injection-safe).

import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchTasks, fetchPulse, mapTask } from '../../src/v2/data/adapters/tasks.js'
import { fetchCalendarEvents, mapCalendarEvents } from '../../src/v2/data/adapters/calendar.js'
import { fetchHandledLog } from '../../src/v2/data/adapters/auditLog.js'
import { fetchPersonalTasks } from '../../src/v2/data/adapters/personal.js'
import { fetchBookTasks } from '../../src/v2/data/adapters/book.js'

const realFetch = globalThis.fetch
const realLocalStorage = globalThis.localStorage

const read = (path) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8')
const tileSource = read('../../src/v2/zones/Tile.jsx')

const v2Root = fileURLToPath(new URL('../../src/v2', import.meta.url))
function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    return statSync(full).isDirectory() ? walk(full) : [full]
  })
}
const v2Sources = walk(v2Root).filter((file) => /\.jsx?$/.test(file))

// Every read adapter in PLAN §4 wiring order, each invoked the way its zone
// calls it. The dispatch adapter is excluded by ruling: it ships no live path
// (z5.test.js proves that separately).
const READ_ADAPTERS = [
  ['fetchTasks (Z1/Z2 signals+projects)', (signal) => fetchTasks(signal)],
  ['fetchTasks business=Book (Z2 Book lane)', (signal) => fetchTasks(signal, { business: 'Book' })],
  ['fetchPulse (Z3 pulse)', (signal) => fetchPulse(signal)],
  ['fetchCalendarEvents (Z1/Z2/Z4)', (signal) => fetchCalendarEvents(signal)],
  ['fetchHandledLog (Z1 handled digest)', (signal) => fetchHandledLog(signal)],
  ['fetchPersonalTasks (Z4)', (signal) => fetchPersonalTasks(signal)],
  ['fetchBookTasks (Z2)', (signal) => fetchBookTasks(signal)],
]

function jsonResponse(status, payload) {
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

describe('failure proof · mock rejection for EVERY adapter (§3.6, §13)', () => {
  for (const [name, call] of READ_ADAPTERS) {
    it(`${name}: a "status":"mock" payload rejects as mock, marker intact, never ok`, async () => {
      const mockPayload = { status: 'mock', source: 'hardcoded-fallback', value: 12345 }
      globalThis.fetch = async () => jsonResponse(200, mockPayload)
      const signal = new AbortController().signal
      const result = await call(signal)
      assert.equal(result.ok, false, `${name} must never resolve ok on a mock payload`)
      assert.equal(result.errorKind, 'mock')
      assert.deepEqual(result.data, mockPayload, 'marker never stripped (§3.6)')
    })
  }
})

describe('failure proof · typed failure kinds propagate through every adapter', () => {
  for (const [name, call] of READ_ADAPTERS) {
    it(`${name}: 502 → http, network throw → offline, 401 → permission — never thrown, never remapped`, async () => {
      const signal = new AbortController().signal

      globalThis.fetch = async () => jsonResponse(502, { detail: 'Handled log unavailable' })
      const httpResult = await call(signal)
      assert.equal(httpResult.ok, false)
      assert.equal(httpResult.errorKind, 'http')
      assert.equal(httpResult.status, 502)

      globalThis.fetch = async () => { throw new TypeError('fetch failed') }
      const offlineResult = await call(signal)
      assert.equal(offlineResult.ok, false)
      assert.equal(offlineResult.errorKind, 'offline')

      globalThis.fetch = async () => jsonResponse(401, { detail: 'Missing or invalid Authorization header' })
      const permissionResult = await call(signal)
      assert.equal(permissionResult.ok, false)
      assert.equal(permissionResult.errorKind, 'permission')
    })
  }
})

describe('failure proof · 9.5 tile-local auth failure (expired som_token)', () => {
  it('the permission-denied tile renders the ruled sign-in copy verbatim', () => {
    assert.ok(
      tileSource.includes('copy="Sign-in needed — this tile will resume after you sign in again."'),
      'Tile.jsx PERMISSION_DENIED branch carries the exact ruled copy',
    )
    assert.match(tileSource, /\[TILE_STATUS\.PERMISSION_DENIED\]: 'sign-in needed'/)
  })

  it('the permission-denied branch keeps the retry control and never blanks data by itself', () => {
    const branch = tileSource.slice(tileSource.indexOf('case TILE_STATUS.PERMISSION_DENIED'))
    const body = branch.slice(0, branch.indexOf('break'))
    assert.ok(/onRetry/.test(body), 'sign-in tile keeps the tile-local retry path')
    assert.ok(!/localStorage|location\.|navigate\(/.test(body), 'no logout or navigation inside the auth-failure branch')
  })

  it('no v2 source performs a global redirect or logout on any path', () => {
    const offenders = []
    for (const file of v2Sources) {
      const source = readFileSync(file, 'utf8')
      if (/location\.(assign|replace)\s*\(/.test(source)) offenders.push(`${file}: location redirect`)
      if (/location\.href\s*=/.test(source)) offenders.push(`${file}: location.href assignment`)
      if (/localStorage\.(removeItem|clear)\s*\(/.test(source)) offenders.push(`${file}: token/session wipe`)
    }
    assert.deepEqual(offenders, [], `global logout/redirect paths found:\n${offenders.join('\n')}`)
  })
})

describe('failure proof · sanitized-title spot-check (§14 raw vs rendered)', () => {
  const hostileTitle = '<img src=x onerror=alert(1)> "quoted" & <b>bold</b>'

  it('task titles pass through the mapper byte-identical (sanitization is server-side, packet A6)', () => {
    const mapped = mapTask({ id: 'rec1', business: 'E7A', title: hostileTitle, status: 'pending' })
    assert.equal(mapped.title, hostileTitle, 'raw title is never mutated client-side')
  })

  it('calendar titles/summaries pass through byte-identical, title → summary fallback intact', () => {
    const mapped = mapCalendarEvents({
      events: [
        { summary: hostileTitle, start: '2026-08-02T21:00:00-04:00', end: '2026-08-02T22:00:00-04:00' },
      ],
    })
    assert.equal(mapped.events[0].title, hostileTitle)
    assert.equal(mapped.events[0].summary, hostileTitle)
  })

  it('rendering is injection-safe by construction: no dangerouslySetInnerHTML anywhere in src/v2', () => {
    const offenders = v2Sources.filter((file) => /dangerouslySetInnerHTML|innerHTML\s*=/.test(readFileSync(file, 'utf8')))
    assert.deepEqual(offenders, [], `raw-HTML render sinks found: ${offenders.join(', ')}`)
  })
})
