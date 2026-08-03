// apiFetch.test.js — MOSV2-C same-origin guard (§3.5), typed results, auth
// header behavior, timeout path, and the static no-absolute-URL scan (§13).

import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { apiFetch, assertApiPath, combineSignals } from '../../src/v2/data/apiFetch.js'

const realFetch = globalThis.fetch
const realLocalStorage = globalThis.localStorage

function jsonResponse(status, payload, { ok = status >= 200 && status < 300, raw = null } = {}) {
  return {
    ok,
    status,
    json: raw !== null ? async () => { throw new Error('bad json') } : async () => payload,
  }
}

beforeEach(() => {
  globalThis.localStorage = {
    store: new Map(),
    getItem(key) { return this.store.has(key) ? this.store.get(key) : null },
  }
})

afterEach(() => {
  globalThis.fetch = realFetch
  if (realLocalStorage === undefined) delete globalThis.localStorage
  else globalThis.localStorage = realLocalStorage
})

describe('apiFetch · same-origin guard (§3.5)', () => {
  it('rejects absolute http/https URLs, protocol-relative URLs, and non-/api paths', async () => {
    const rejected = [
      'https://deployable-python-codebase-som-production.up.railway.app/api/tasks',
      'http://localhost:8000/api/tasks',
      '//evil.example/api/tasks',
      '/students/',
      '/students/active',
      'api/tasks',
      '/api',
      '',
      '/APItasks',
    ]
    for (const path of rejected) {
      await assert.rejects(apiFetch(path), TypeError, `must reject: ${path}`)
    }
  })

  it('assertApiPath throws synchronously on guard violations only', () => {
    assert.throws(() => assertApiPath('https://example.com/api/x'), TypeError)
    assert.throws(() => assertApiPath(null), TypeError)
    assert.doesNotThrow(() => assertApiPath('/api/tasks'))
  })

  it('accepts /api/* paths and issues exactly one same-origin request', async () => {
    const calls = []
    globalThis.fetch = async (path, init) => { calls.push([path, init]); return jsonResponse(200, { ok: true }) }
    const result = await apiFetch('/api/tasks?limit=2')
    assert.equal(result.ok, true)
    assert.equal(calls.length, 1)
    assert.equal(calls[0][0], '/api/tasks?limit=2')
  })
})

describe('apiFetch · auth header (som_token read only)', () => {
  it('sends Authorization: Bearer when som_token exists', async () => {
    globalThis.localStorage.store.set('som_token', 'test.jwt.token')
    let seen
    globalThis.fetch = async (path, init) => { seen = init; return jsonResponse(200, { ok: true }) }
    await apiFetch('/api/pulse')
    assert.equal(seen.headers.Authorization, 'Bearer test.jwt.token')
  })

  it('omits the header when no token exists', async () => {
    let seen
    globalThis.fetch = async (path, init) => { seen = init; return jsonResponse(200, { ok: true }) }
    await apiFetch('/api/pulse')
    assert.equal(seen.headers.Authorization, undefined)
  })
})

describe('apiFetch · typed results', () => {
  it('401 and 403 → permission, never thrown (9.5 tile-local)', async () => {
    globalThis.fetch = async () => jsonResponse(401, { detail: 'Missing or invalid Authorization header' })
    const r401 = await apiFetch('/api/mya/audit/handled?limit=3')
    assert.deepEqual(r401, { ok: false, status: 401, data: { detail: 'Missing or invalid Authorization header' }, errorKind: 'permission' })

    globalThis.fetch = async () => jsonResponse(403, { detail: 'Forbidden' })
    const r403 = await apiFetch('/api/tasks')
    assert.equal(r403.ok, false)
    assert.equal(r403.errorKind, 'permission')
  })

  it('other HTTP errors → http kind', async () => {
    globalThis.fetch = async () => jsonResponse(502, { detail: 'Handled log unavailable' })
    const result = await apiFetch('/api/mya/audit/handled?limit=3')
    assert.equal(result.ok, false)
    assert.equal(result.errorKind, 'http')
    assert.equal(result.status, 502)
  })

  it('"status":"mock" payload → mock kind, marker intact (§3.6)', async () => {
    const mockPayload = { status: 'mock', source: 'hardcoded-fallback', ytd: { income: 99999 } }
    globalThis.fetch = async () => jsonResponse(200, mockPayload)
    const result = await apiFetch('/api/fm/summary')
    assert.equal(result.ok, false)
    assert.equal(result.errorKind, 'mock')
    assert.deepEqual(result.data, mockPayload, 'marker never stripped')
  })

  it('successful JSON → ok with data and null errorKind', async () => {
    globalThis.fetch = async () => jsonResponse(200, { ok: true, tasks: [], count: 0 })
    const result = await apiFetch('/api/tasks')
    assert.deepEqual(result, { ok: true, status: 200, data: { ok: true, tasks: [], count: 0 }, errorKind: null })
  })

  it('unparseable success body → parse kind', async () => {
    globalThis.fetch = async () => jsonResponse(200, null, { raw: 'not json' })
    const result = await apiFetch('/api/tasks')
    assert.equal(result.ok, false)
    assert.equal(result.errorKind, 'parse')
  })

  it('network failure → offline kind', async () => {
    globalThis.fetch = async () => { throw new TypeError('fetch failed') }
    const result = await apiFetch('/api/tasks')
    assert.equal(result.ok, false)
    assert.equal(result.errorKind, 'offline')
  })
})

describe('apiFetch · timeout and cancellation', () => {
  it('aborts past the timeout and returns timeout kind', async () => {
    globalThis.fetch = (path, { signal } = {}) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
    })
    const started = Date.now()
    const result = await apiFetch('/api/tasks', { timeoutMs: 25 })
    assert.equal(result.ok, false)
    assert.equal(result.errorKind, 'timeout')
    assert.ok(Date.now() - started < 5000, 'must not wait for the hanging fetch')
  })

  it('caller abort propagates (supersede/unmount path)', async () => {
    globalThis.fetch = (path, { signal } = {}) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
    })
    const controller = new AbortController()
    const pending = apiFetch('/api/tasks', { signal: controller.signal, timeoutMs: 5000 })
    controller.abort('superseded')
    await assert.rejects(pending, /Aborted/)
  })

  it('combineSignals aborts when any input aborts, preserving reason', () => {
    const a = new AbortController()
    const b = new AbortController()
    const combined = combineSignals([a.signal, b.signal])
    assert.equal(combined.signal.aborted, false)
    a.abort('superseded')
    assert.equal(combined.signal.aborted, true)
    assert.equal(combined.signal.reason, 'superseded')
    combined.detach()
  })

  it('combineSignals handles an already-aborted input', () => {
    const a = new AbortController()
    a.abort('unmount')
    const combined = combineSignals([a.signal])
    assert.equal(combined.signal.aborted, true)
    assert.equal(combined.signal.reason, 'unmount')
  })
})

describe('same-origin static guard (PLAN §13)', () => {
  const v2Root = fileURLToPath(new URL('../../src/v2', import.meta.url))

  function walk(dir) {
    return readdirSync(dir).flatMap((entry) => {
      const full = join(dir, entry)
      return statSync(full).isDirectory() ? walk(full) : [full]
    })
  }

  it('no v2 source contains an absolute backend/provider URL', () => {
    const offenders = []
    for (const file of walk(v2Root)) {
      if (!/\.(jsx?|css)$/.test(file)) continue
      const source = readFileSync(file, 'utf8')
      if (/https?:\/\//.test(source) || /[^:]\/\/[a-z0-9-]+\.[a-z]{2,}/i.test(source.replace(/https?:\/\//g, ''))) {
        offenders.push(file)
      }
    }
    assert.deepEqual(offenders, [], `absolute URLs found in: ${offenders.join(', ')}`)
  })
})
