import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { mkdtemp } from 'node:fs/promises'
import test from 'node:test'

import { clientIdentity, createLoginThrottle, createStagingApi } from '../../staging-control-plane/app.mjs'
import { createPasswordHash, sha256, signToken } from '../../staging-control-plane/security.mjs'
import { StagingStore, StagingStoreError } from '../../staging-control-plane/store.mjs'

// ---------------------------------------------------------------------------
// Shared helpers for post-merge hardening Phase 1 (items A-H)
// ---------------------------------------------------------------------------

const ORIGIN = 'https://deploy-preview-22--motesart-os.netlify.app'
const PREVIEW_HEAD = 'e'.repeat(40)
const OWNER_PASSWORD = 'SYNTHETIC_HARDENING_PASSWORD'
const SESSION_KEY = 'SYNTHETIC_HARDENING_SESSION_KEY'
const ORCA_KEY = 'SYNTHETIC_HARDENING_ORCA_KEY'
const BOOTSTRAP = 'SYNTHETIC_HARDENING_BOOTSTRAP'
const OWNER_SCOPES = ['work-orders:submit', 'work-orders:read', 'work-orders:retry']

async function apiFixture({ now } = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'hardening-api-'))
  const store = await new StagingStore({ root }).init()
  const config = {
    allowedOrigin: ORIGIN,
    expectedPreviewHead: PREVIEW_HEAD,
    ownerId: 'denarius-staging-owner',
    ownerPasswordHash: createPasswordHash(OWNER_PASSWORD, '00112233445566778899aabbccddeeff'),
    sessionSigningKey: SESSION_KEY,
    orcaBootstrapTokenHash: sha256(BOOTSTRAP),
    orcaSigningKey: ORCA_KEY,
    issuer: 'mya-operator-bridge-staging-v1',
    ownerSessionTtlSeconds: 900,
    orcaSessionTtlSeconds: 900,
    trustedProxyIps: [],
    ...(now ? { now } : {}),
  }
  const { server } = createStagingApi({ store, config, logger: { info() {} } })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const baseUrl = `http://127.0.0.1:${server.address().port}`
  return {
    store,
    config,
    baseUrl,
    close: async () => {
      await new Promise((resolve) => server.close(resolve))
      await store.close()
    },
  }
}

async function post(baseUrl, route, { token = null, body = {}, leaseToken = null } = {}) {
  const headers = { origin: ORIGIN, 'x-motesart-preview-head': PREVIEW_HEAD, 'content-type': 'application/json' }
  if (token) headers.authorization = `Bearer ${token}`
  if (leaseToken) headers['x-lease-token'] = leaseToken
  const response = await fetch(`${baseUrl}${route}`, { method: 'POST', headers, body: JSON.stringify(body) })
  return { response, payload: await response.json() }
}

async function get(baseUrl, route, { token } = {}) {
  const response = await fetch(`${baseUrl}${route}`, { headers: { origin: ORIGIN, 'x-motesart-preview-head': PREVIEW_HEAD, authorization: `Bearer ${token}` } })
  return { response, payload: await response.json() }
}

function ownerLoginBody(password = OWNER_PASSWORD, ownerId = 'denarius-staging-owner') {
  return { owner_id: ownerId, password }
}

function mintOwner(config, scopes) {
  return signToken({ sub: config.ownerId, role: 'owner', scopes }, SESSION_KEY, { issuer: config.issuer, audience: 'motesart-os-staging-preview', ttlSeconds: 120 })
}

function mintOrca(config, scopes, key = ORCA_KEY) {
  return signToken({ sub: 'orca-hardening-test', role: 'orca', scopes }, key, { issuer: config.issuer, audience: 'operator-bridge-staging-orca', ttlSeconds: 120 })
}

function workOrderBody(suffix) {
  return {
    instruction: 'Synthetic hardening test only.',
    originating_surface: 'motesart-os-netlify-preview',
    task_type: 'staging_smoke_test',
    scope: { data_class: 'synthetic', read_only: true, protected_writes: false },
    priority: 'normal',
    approval_class: 'READ_ONLY',
    executor: 'ORCA',
    idempotency_key: `hardening-test:${suffix}`,
  }
}

function deadPid() {
  const child = spawnSync(process.execPath, ['-e', '0'])
  assert.ok(Number.isInteger(child.pid) && child.pid > 0)
  return child.pid
}

async function staleLock(root, content) {
  const ledgerDirectory = path.join(root, 'staging', 'ledger')
  await mkdir(ledgerDirectory, { recursive: true })
  const lockPath = path.join(ledgerDirectory, 'writer.lock')
  await writeFile(lockPath, content, { mode: 0o600 })
  return lockPath
}

async function recoveryLog(root) {
  try {
    return await readFile(path.join(root, 'staging', 'ledger', 'lock-recovery.jsonl'), 'utf8')
  } catch {
    return ''
  }
}

// ---------------------------------------------------------------------------
// Item A: crash-stale writer-lock recovery
// ---------------------------------------------------------------------------

test('A: an active writer lock is preserved and never stolen', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'hardening-lock-active-'))
  const first = await new StagingStore({ root, lockWaitMs: 100, lockPollMs: 20 }).init()
  const second = new StagingStore({ root, lockWaitMs: 100, lockPollMs: 20 })
  await assert.rejects(second.init(), (error) => error.code === 'STAGING_LEDGER_LOCKED' && error.status === 503)
  await first.createWorkOrder({
    requested_by: 'hardening-test', originating_surface: 'motesart-os-netlify-preview', instruction: 'lock test',
    task_type: 'staging_smoke_test', scope: { read_only: true }, priority: 'normal', approval_class: 'READ_ONLY',
    executor: 'ORCA', idempotency_key: 'hardening:lock:active',
  })
  assert.equal((await first.listWorkOrders()).length, 1)
  await first.close()
})

test('A: a demonstrably stale lock (dead holder pid) is recovered with evidence', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'hardening-lock-stale-'))
  const pid = deadPid()
  await staleLock(root, JSON.stringify({ pid, created_at: '2026-07-30T00:00:00.000Z' }))
  const store = await new StagingStore({ root, lockWaitMs: 300, lockPollMs: 20 }).init()
  const log = recoveryLog(root)
  assert.match(await log, /recovered_stale_lock/)
  assert.match(await log, new RegExp(`"stale_pid":${pid}`))
  await store.close()
})

test('A: malformed lock metadata fails closed without recovery', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'hardening-lock-malformed-'))
  await staleLock(root, 'not-json{')
  const store = new StagingStore({ root, lockWaitMs: 150, lockPollMs: 20 })
  await assert.rejects(store.init(), (error) => error.code === 'STAGING_LEDGER_LOCKED')
  assert.match(await recoveryLog(root), /malformed_lock_metadata/)
})

test('A: a lock with a non-integer pid fails closed without recovery', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'hardening-lock-badpid-'))
  await staleLock(root, JSON.stringify({ pid: '999999', created_at: '2026-07-30T00:00:00.000Z' }))
  const store = new StagingStore({ root, lockWaitMs: 150, lockPollMs: 20 })
  await assert.rejects(store.init(), (error) => error.code === 'STAGING_LEDGER_LOCKED')
  assert.match(await recoveryLog(root), /malformed_lock_metadata/)
})

test('A: concurrent recovery attempts produce exactly one winner', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'hardening-lock-race-'))
  await staleLock(root, JSON.stringify({ pid: deadPid(), created_at: '2026-07-30T00:00:00.000Z' }))
  const results = await Promise.allSettled([
    new StagingStore({ root, lockWaitMs: 400, lockPollMs: 20 }).init(),
    new StagingStore({ root, lockWaitMs: 400, lockPollMs: 20 }).init(),
  ])
  const winners = results.filter((result) => result.status === 'fulfilled')
  const losers = results.filter((result) => result.status === 'rejected')
  assert.equal(winners.length, 1)
  assert.equal(losers.length, 1)
  assert.equal(losers[0].reason.code, 'STAGING_LEDGER_LOCKED')
  await winners[0].value.close()
})

test('A: lock acquisition waiting is bounded and fails closed on timeout', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'hardening-lock-timeout-'))
  const first = await new StagingStore({ root }).init()
  const started = Date.now()
  const second = new StagingStore({ root, lockWaitMs: 200, lockPollMs: 25 })
  await assert.rejects(second.init(), (error) => error.code === 'STAGING_LEDGER_LOCKED')
  const elapsed = Date.now() - started
  assert.ok(elapsed >= 150, `expected bounded wait, got ${elapsed}ms`)
  assert.ok(elapsed < 5_000, `wait was not bounded: ${elapsed}ms`)
  await first.close()
})

test('A: process-restart scenario recovers stale lock and preserves ledger state', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'hardening-lock-restart-'))
  const before = await new StagingStore({ root }).init()
  await before.createWorkOrder({
    requested_by: 'hardening-test', originating_surface: 'motesart-os-netlify-preview', instruction: 'restart test',
    task_type: 'staging_smoke_test', scope: { read_only: true }, priority: 'normal', approval_class: 'READ_ONLY',
    executor: 'ORCA', idempotency_key: 'hardening:lock:restart',
  })
  await before.close()
  // Simulate a crashed holder: a stale lock left behind by a dead process.
  await staleLock(root, JSON.stringify({ pid: deadPid(), created_at: '2026-07-30T00:00:00.000Z' }))
  const after = await new StagingStore({ root, lockWaitMs: 300, lockPollMs: 20 }).init()
  const orders = await after.listWorkOrders()
  assert.equal(orders.length, 1)
  assert.equal(orders[0].instruction, 'restart test')
  await after.close()
})

// ---------------------------------------------------------------------------
// Item B: proxy-aware bounded login throttling
// ---------------------------------------------------------------------------

test('B: valid throttling rejects the sixth attempt within the window', async (t) => {
  const f = await apiFixture()
  t.after(f.close)
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const wrong = await post(f.baseUrl, '/v1/auth/session', { body: ownerLoginBody('WRONG_SYNTHETIC') })
    assert.equal(wrong.response.status, 401)
  }
  const limited = await post(f.baseUrl, '/v1/auth/session', { body: ownerLoginBody('WRONG_SYNTHETIC') })
  assert.equal(limited.response.status, 429)
  assert.equal(limited.payload.error.code, 'AUTH_RATE_LIMITED')
})

test('B: owner lockout protection keys buckets per identity and owner id', async (t) => {
  const f = await apiFixture()
  t.after(f.close)
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await post(f.baseUrl, '/v1/auth/session', { body: ownerLoginBody('WRONG_SYNTHETIC') })
  }
  const limited = await post(f.baseUrl, '/v1/auth/session', { body: ownerLoginBody('WRONG_SYNTHETIC') })
  assert.equal(limited.response.status, 429)
  const otherIdentity = await post(f.baseUrl, '/v1/auth/session', { body: ownerLoginBody('WRONG_SYNTHETIC', 'other-owner-id') })
  assert.equal(otherIdentity.response.status, 401)
  assert.equal(otherIdentity.payload.error.code, 'AUTHENTICATION_INVALID')
})

test('B: buckets expire after the window', async (t) => {
  let now = 1_000_000
  const f = await apiFixture({ now: () => now })
  t.after(f.close)
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await post(f.baseUrl, '/v1/auth/session', { body: ownerLoginBody('WRONG_SYNTHETIC') })
  }
  assert.equal((await post(f.baseUrl, '/v1/auth/session', { body: ownerLoginBody('WRONG_SYNTHETIC') })).response.status, 429)
  now += 61_000
  const after = await post(f.baseUrl, '/v1/auth/session', { body: ownerLoginBody('WRONG_SYNTHETIC') })
  assert.equal(after.response.status, 401)
})

test('B: client identity honors forwarded headers only from a trusted proxy peer', () => {
  const request = (remoteAddress, forwarded) => ({ socket: { remoteAddress }, headers: forwarded === undefined ? {} : { 'x-forwarded-for': forwarded } })
  assert.equal(clientIdentity(request('10.0.0.1', '203.0.113.7'), ['10.0.0.1']), '203.0.113.7')
  assert.equal(clientIdentity(request('10.0.0.1', '198.51.100.9, 203.0.113.7'), ['10.0.0.1']), '203.0.113.7')
  assert.equal(clientIdentity(request('10.0.0.1', '198.51.100.9'), []), '10.0.0.1')
  assert.equal(clientIdentity(request('10.0.0.1', undefined), ['10.0.0.1']), '10.0.0.1')
  assert.equal(clientIdentity(request('10.0.0.1', 'x'.repeat(600)), ['10.0.0.1']), '10.0.0.1')
  assert.equal(clientIdentity(request('10.0.0.1', '  '), ['10.0.0.1']), '10.0.0.1')
  assert.equal(clientIdentity(request('10.0.0.1', '198.51.100.9'), ['10.0.0.2']), '10.0.0.1')
})

test('B: distinct trusted identities get independent buckets and spoofed headers share the edge bucket', () => {
  const throttle = createLoginThrottle({ limit: 2, windowMs: 60_000 })
  throttle('203.0.113.1|owner')
  throttle('203.0.113.1|owner')
  throttle('203.0.113.2|owner')
  assert.throws(() => throttle('203.0.113.1|owner'), (error) => error.code === 'AUTH_RATE_LIMITED')
  assert.doesNotThrow(() => throttle('203.0.113.2|owner'))
  const edgeThrottle = createLoginThrottle({ limit: 2, windowMs: 60_000 })
  edgeThrottle('edge-proxy|owner')
  edgeThrottle('edge-proxy|owner')
  assert.throws(() => edgeThrottle('edge-proxy|owner'), (error) => error.code === 'AUTH_RATE_LIMITED')
})

test('B: bucket count is bounded and full maps fail closed until expiry', () => {
  let now = 5_000
  const throttle = createLoginThrottle({ now: () => now, limit: 1, windowMs: 60_000, maxBuckets: 3 })
  throttle('a')
  throttle('b')
  throttle('c')
  assert.throws(() => throttle('d'), (error) => error.code === 'AUTH_RATE_LIMITED')
  assert.throws(() => throttle('a'), (error) => error.code === 'AUTH_RATE_LIMITED')
  now += 61_000
  assert.doesNotThrow(() => throttle('d'))
})

// ---------------------------------------------------------------------------
// Item E: JWT-scope enforcement
// ---------------------------------------------------------------------------

test('E: scope matrix rejects missing, malformed, unknown, and insufficient scopes', async (t) => {
  const f = await apiFixture()
  t.after(f.close)

  const missing = await get(f.baseUrl, '/v1/work-orders', { token: mintOwner(f.config, undefined) })
  assert.equal(missing.response.status, 401)
  assert.equal(missing.payload.error.code, 'AUTHENTICATION_INVALID')

  const notArray = await get(f.baseUrl, '/v1/work-orders', { token: mintOwner(f.config, 'work-orders:read') })
  assert.equal(notArray.response.status, 401)

  const empty = await get(f.baseUrl, '/v1/work-orders', { token: mintOwner(f.config, []) })
  assert.equal(empty.response.status, 401)

  const unknown = await get(f.baseUrl, '/v1/work-orders', { token: mintOwner(f.config, ['work-orders:read', 'admin:all']) })
  assert.equal(unknown.response.status, 401)
  assert.equal(unknown.payload.error.code, 'AUTHENTICATION_INVALID')

  const readOnly = mintOwner(f.config, ['work-orders:read'])
  assert.equal((await get(f.baseUrl, '/v1/work-orders', { token: readOnly })).response.status, 200)
  const submitDenied = await post(f.baseUrl, '/v1/work-orders', { token: readOnly, body: workOrderBody('scope-denied') })
  assert.equal(submitDenied.response.status, 403)
  assert.equal(submitDenied.payload.error.code, 'INSUFFICIENT_SCOPE')
  const retryDenied = await post(f.baseUrl, '/v1/work-orders/wo_staging_scope/manual-retry', { token: readOnly, body: { idempotency_key: 'hardening:scope:retry' } })
  assert.equal(retryDenied.response.status, 403)
  assert.equal(retryDenied.payload.error.code, 'INSUFFICIENT_SCOPE')

  const submitOnly = mintOwner(f.config, ['work-orders:submit'])
  assert.equal((await post(f.baseUrl, '/v1/work-orders', { token: submitOnly, body: workOrderBody('scope-submit') })).response.status, 201)
  assert.equal((await get(f.baseUrl, '/v1/work-orders', { token: submitOnly })).response.status, 403)
})

test('E: ORCA scopes are least-privilege per action', async (t) => {
  const f = await apiFixture()
  t.after(f.close)
  const ownerToken = mintOwner(f.config, OWNER_SCOPES)
  await post(f.baseUrl, '/v1/work-orders', { token: ownerToken, body: workOrderBody('orca-scopes') })
  const orders = await get(f.baseUrl, '/v1/work-orders', { token: ownerToken })
  const workOrderId = orders.payload.work_orders[0].work_order_id

  const claimOnly = mintOrca(f.config, ['claim'])
  const claimed = await post(f.baseUrl, '/v1/executors/orca/claim', { token: claimOnly, body: { capabilities: [], lease_ttl_seconds: 60 } })
  assert.equal(claimed.response.status, 200)
  assert.notEqual(claimed.payload.claim, null)

  const heartbeatDenied = await post(f.baseUrl, `/v1/executors/orca/work-orders/${workOrderId}/heartbeat`, { token: claimOnly, body: { lease_ttl_seconds: 60 } })
  assert.equal(heartbeatDenied.response.status, 403)
  assert.equal(heartbeatDenied.payload.error.code, 'INSUFFICIENT_SCOPE')

  const blockOnly = mintOrca(f.config, ['block'])
  const uploadDenied = await post(f.baseUrl, `/v1/executors/orca/work-orders/${workOrderId}/artifacts`, { token: blockOnly, body: {} })
  assert.equal(uploadDenied.response.status, 403)
  assert.equal(uploadDenied.payload.error.code, 'INSUFFICIENT_SCOPE')

  const unknownScope = await post(f.baseUrl, '/v1/executors/orca/claim', { token: mintOrca(f.config, ['claim', 'shell:exec']), body: { capabilities: [], lease_ttl_seconds: 60 } })
  assert.equal(unknownScope.response.status, 401)

  const wrongKey = await post(f.baseUrl, '/v1/executors/orca/claim', { token: mintOrca(f.config, ['claim'], 'SYNTHETIC_WRONG_KEY'), body: { capabilities: [], lease_ttl_seconds: 60 } })
  assert.equal(wrongKey.response.status, 401)
})

test('E: complete, release, and retry scopes are independently enforced', async (t) => {
  const f = await apiFixture()
  t.after(f.close)
  const ownerToken = mintOwner(f.config, OWNER_SCOPES)
  await post(f.baseUrl, '/v1/work-orders', { token: ownerToken, body: workOrderBody('scope-matrix-2') })
  const orders = await get(f.baseUrl, '/v1/work-orders', { token: ownerToken })
  const workOrderId = orders.payload.work_orders[0].work_order_id
  const claimToken = mintOrca(f.config, ['claim'])
  const claimed = await post(f.baseUrl, '/v1/executors/orca/claim', { token: claimToken, body: { capabilities: [], lease_ttl_seconds: 60 } })
  const leaseToken = claimed.payload.claim.lease_token

  for (const action of ['complete', 'release', 'block', 'heartbeat', 'artifacts']) {
    const denied = await post(f.baseUrl, `/v1/executors/orca/work-orders/${workOrderId}/${action}`, { token: claimToken, leaseToken, body: {} })
    assert.equal(denied.response.status, 403, `${action} must require its own scope`)
    assert.equal(denied.payload.error.code, 'INSUFFICIENT_SCOPE')
  }

  const retryWithoutScope = mintOwner(f.config, ['work-orders:read', 'work-orders:submit'])
  const retryDenied = await post(f.baseUrl, `/v1/work-orders/${workOrderId}/manual-retry`, { token: retryWithoutScope, body: { idempotency_key: 'hardening:scope:retry2' } })
  assert.equal(retryDenied.response.status, 403)
  assert.equal(retryDenied.payload.error.code, 'INSUFFICIENT_SCOPE')
})

// ---------------------------------------------------------------------------
// Item C: local-ledger required-artifact enforcement
// ---------------------------------------------------------------------------

import { LocalArtifactStore } from '../../operator-bridge/artifact-store.mjs'
import { FileWorkOrderLedger } from '../../operator-bridge/work-order-ledger.mjs'

async function localLedgerFixture({ verifier, requiredArtifacts = ['pull_request_identity', 'diff'] } = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'hardening-ledger-'))
  const ledger = await new FileWorkOrderLedger({ root, artifactVerifier: verifier }).init()
  await ledger.create({
    work_order_id: 'wo-hardening-1',
    requested_by: 'hardening-test',
    originating_surface: 'test',
    task_type: 'github_pr_read_only_review',
    scope: { repository: 'Synthetic/Fixture', pull_request: 1, read_only: true },
    approval_class: 'READ_ONLY',
    executor: 'ORCA',
    required_artifacts: requiredArtifacts,
    input_hashes: [],
    status: 'QUEUED',
    idempotency_key: 'hardening:artifacts:1',
  })
  const claimed = await ledger.claim('wo-hardening-1', { leaseOwner: 'orca-h' })
  await ledger.transition('wo-hardening-1', 'RUNNING', { actor: 'orca-h', leaseToken: claimed.lease_token })
  await ledger.transition('wo-hardening-1', 'VERIFYING', { actor: 'orca-h', leaseToken: claimed.lease_token })
  return { ledger, leaseToken: claimed.lease_token }
}

test('C: completion without a verifier fails closed when artifacts are required', async () => {
  const { ledger, leaseToken } = await localLedgerFixture()
  await assert.rejects(
    ledger.completeIdempotently('wo-hardening-1', { actor: 'control-plane', leaseToken, resultUri: 'r', resultHash: 'a'.repeat(64), evidenceUri: 'e', evidenceHash: 'b'.repeat(64) }),
    (error) => error.code === 'REQUIRED_ARTIFACT_UNVERIFIABLE',
  )
  assert.equal((await ledger.get('wo-hardening-1')).status, 'VERIFYING')
})

test('C: completion is refused when a required artifact type is missing', async () => {
  const verifier = async () => [{ artifact_type: 'pull_request_identity', sha256: 'a'.repeat(64), work_order_id: 'wo-hardening-1' }]
  const { ledger, leaseToken } = await localLedgerFixture({ verifier })
  await assert.rejects(
    ledger.completeIdempotently('wo-hardening-1', { actor: 'control-plane', leaseToken, resultUri: 'r', resultHash: 'a'.repeat(64), evidenceUri: 'e', evidenceHash: 'a'.repeat(64) }),
    (error) => error.code === 'REQUIRED_ARTIFACT_MISSING',
  )
  assert.equal((await ledger.get('wo-hardening-1')).status, 'VERIFYING')
})

test('C: completion is refused when result or evidence identity is foreign to the work order', async () => {
  const verifier = async () => [
    { artifact_type: 'pull_request_identity', sha256: 'a'.repeat(64), work_order_id: 'wo-hardening-1' },
    { artifact_type: 'diff', sha256: 'b'.repeat(64), work_order_id: 'wo-hardening-1' },
  ]
  const { ledger, leaseToken } = await localLedgerFixture({ verifier })
  await assert.rejects(
    ledger.completeIdempotently('wo-hardening-1', { actor: 'control-plane', leaseToken, resultUri: 'r', resultHash: 'f'.repeat(64), evidenceUri: 'e', evidenceHash: 'b'.repeat(64) }),
    (error) => error.code === 'ARTIFACT_REFERENCE_INVALID',
  )
  assert.equal((await ledger.get('wo-hardening-1')).status, 'VERIFYING')
})

test('C: artifact store lists only the target work-order artifacts with intact content addressing', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'hardening-artstore-'))
  const store = await new LocalArtifactStore({ root }).init()
  await store.putArtifact({ workOrderId: 'wo-a', artifactType: 'diff', content: 'alpha', producingExecutor: 'test', attempt: 1 })
  await store.putArtifact({ workOrderId: 'wo-b', artifactType: 'diff', content: 'beta', producingExecutor: 'test', attempt: 1 })
  await store.putArtifact({ workOrderId: 'wo-a', artifactType: 'test_log', content: 'log', producingExecutor: 'test', attempt: 1 })
  const listed = await store.listArtifacts('wo-a')
  assert.equal(listed.length, 2)
  assert.ok(listed.every((manifest) => manifest.work_order_id === 'wo-a'))
  for (const manifest of listed) await store.readArtifact(manifest)
  assert.equal((await store.listArtifacts('wo-missing')).length, 0)
})

test('C: verifier wired to the real artifact store completes only with all required types present', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'hardening-parity-'))
  const artifactStore = await new LocalArtifactStore({ root: path.join(root, 'artifacts') }).init()
  const ledger = await new FileWorkOrderLedger({ root: path.join(root, 'ledger'), artifactVerifier: (id) => artifactStore.listArtifacts(id) }).init()
  await ledger.create({
    work_order_id: 'wo-hardening-2', requested_by: 'hardening-test', originating_surface: 'test',
    task_type: 'github_pr_read_only_review', scope: { read_only: true }, approval_class: 'READ_ONLY', executor: 'ORCA',
    required_artifacts: ['diff', 'test_log'], input_hashes: [], status: 'QUEUED', idempotency_key: 'hardening:artifacts:2',
  })
  const claimed = await ledger.claim('wo-hardening-2', { leaseOwner: 'orca-h' })
  await ledger.transition('wo-hardening-2', 'RUNNING', { actor: 'orca-h', leaseToken: claimed.lease_token })
  await ledger.transition('wo-hardening-2', 'VERIFYING', { actor: 'orca-h', leaseToken: claimed.lease_token })
  const diff = await artifactStore.putArtifact({ workOrderId: 'wo-hardening-2', artifactType: 'diff', content: 'the-diff', producingExecutor: 'test', attempt: 1 })
  await assert.rejects(
    ledger.completeIdempotently('wo-hardening-2', { actor: 'control-plane', leaseToken: claimed.lease_token, resultUri: diff.immutable_relative_uri, resultHash: diff.sha256, evidenceUri: diff.immutable_relative_uri, evidenceHash: diff.sha256 }),
    (error) => error.code === 'REQUIRED_ARTIFACT_MISSING',
  )
  const log = await artifactStore.putArtifact({ workOrderId: 'wo-hardening-2', artifactType: 'test_log', content: 'the-log', producingExecutor: 'test', attempt: 1 })
  const completed = await ledger.completeIdempotently('wo-hardening-2', { actor: 'control-plane', leaseToken: claimed.lease_token, resultUri: diff.immutable_relative_uri, resultHash: diff.sha256, evidenceUri: log.immutable_relative_uri, evidenceHash: log.sha256 })
  assert.equal(completed.status, 'COMPLETED')
})

// ---------------------------------------------------------------------------
// Item D: human-decision flag enforcement
// ---------------------------------------------------------------------------

import { createDecisionCard } from '../../operator-bridge/decision-card.mjs'

test('D: decision-card creation always disables every control', () => {
  const card = createDecisionCard({
    workOrder: { work_order_id: 'wo-x', status: 'COMPLETED', executor: 'ORCA', approval_class: 'READ_ONLY', lease_owner: null, lease_expires_at: null, blocker_code: null, next_action: 'HUMAN_REVIEW_COMPLETE' },
    originatingInstruction: 'test',
    artifacts: [],
    kimiResult: null,
    codexResult: null,
    fableResult: { status: 'PASS' },
  })
  assert.equal(card.controls.approve.enabled, false)
  assert.equal(card.controls.reject.enabled, false)
  assert.equal(card.controls.revise.enabled, false)
  assert.equal(card.human_decision_required, false)
  const blockedCard = createDecisionCard({
    workOrder: { work_order_id: 'wo-y', status: 'BLOCKED', executor: 'ORCA', approval_class: 'READ_ONLY', lease_owner: null, lease_expires_at: null, blocker_code: 'X', next_action: 'REVIEW' },
    originatingInstruction: 'test', artifacts: [], kimiResult: null, codexResult: null, fableResult: { status: 'BLOCKED' },
  })
  assert.equal(blockedCard.human_decision_required, true)
  assert.equal(blockedCard.controls.approve.enabled, false)
})

async function completableOrder(f, suffix, card) {
  const ownerToken = mintOwner(f.config, OWNER_SCOPES)
  const orcaToken = mintOrca(f.config, ['claim', 'heartbeat', 'artifact:return', 'complete'])
  await post(f.baseUrl, '/v1/work-orders', { token: ownerToken, body: workOrderBody(suffix) })
  const orders = await get(f.baseUrl, '/v1/work-orders', { token: ownerToken })
  const workOrderId = orders.payload.work_orders.find((order) => order.idempotency_key === `hardening-test:${suffix}`).work_order_id
  const claimed = await post(f.baseUrl, '/v1/executors/orca/claim', { token: orcaToken, body: { capabilities: [], lease_ttl_seconds: 60 } })
  const leaseToken = claimed.payload.claim.lease_token
  await post(f.baseUrl, `/v1/executors/orca/work-orders/${workOrderId}/heartbeat`, { token: orcaToken, leaseToken, body: { lease_ttl_seconds: 60 } })
  const upload = async (type, content) => {
    const bytes = Buffer.from(content)
    return post(f.baseUrl, `/v1/executors/orca/work-orders/${workOrderId}/artifacts`, {
      token: orcaToken, leaseToken,
      body: { artifact_type: type, content_base64: bytes.toString('base64'), sha256: sha256(bytes), byte_count: bytes.length, sensitivity_classification: 'synthetic' },
    })
  }
  const log = await upload('test_log', '{"passed":true}')
  const cardArtifact = await upload('decision_card', JSON.stringify(card(workOrderId)))
  const body = { result_artifact_id: log.payload.artifact.artifact_id, evidence_artifact_id: log.payload.artifact.artifact_id, decision_card_artifact_id: cardArtifact.payload.artifact.artifact_id }
  return { ownerToken, orcaToken, leaseToken, workOrderId, body }
}

test('D: completion rejects a card with an enabled non-approve control', async (t) => {
  const f = await apiFixture()
  t.after(f.close)
  const { ownerToken, orcaToken, leaseToken, workOrderId, body } = await completableOrder(f, 'control-enabled', (id) => ({
    work_order_id: id,
    human_decision_required: true,
    controls: { approve: { enabled: false }, reject: { enabled: true }, revise: { enabled: false } },
  }))
  const completed = await post(f.baseUrl, `/v1/executors/orca/work-orders/${workOrderId}/complete`, { token: orcaToken, leaseToken, body })
  assert.equal(completed.response.status, 409)
  assert.equal(completed.payload.error.code, 'DECISION_CARD_INVALID')
  const order = await get(f.baseUrl, `/v1/work-orders/${workOrderId}`, { token: ownerToken })
  assert.equal(order.payload.work_order.status, 'BLOCKED')
  assert.equal(order.payload.work_order.blocker_code, 'PROTECTED_CONTROL_ENABLED')
})

test('D: completion rejects a human-decision card whose controls are not all explicitly disabled', async (t) => {
  const f = await apiFixture()
  t.after(f.close)
  const { ownerToken, orcaToken, leaseToken, workOrderId, body } = await completableOrder(f, 'control-unverified', (id) => ({
    work_order_id: id,
    human_decision_required: true,
    controls: { approve: { enabled: false } },
  }))
  const completed = await post(f.baseUrl, `/v1/executors/orca/work-orders/${workOrderId}/complete`, { token: orcaToken, leaseToken, body })
  assert.equal(completed.response.status, 409)
  const order = await get(f.baseUrl, `/v1/work-orders/${workOrderId}`, { token: ownerToken })
  assert.equal(order.payload.work_order.blocker_code, 'HUMAN_DECISION_CONTROL_UNVERIFIED')
})

test('D: a fully disabled human-decision card completes and is served read-only with no action path', async (t) => {
  const f = await apiFixture()
  t.after(f.close)
  const { ownerToken, orcaToken, leaseToken, workOrderId, body } = await completableOrder(f, 'control-valid', (id) => ({
    work_order_id: id,
    human_decision_required: true,
    controls: { approve: { enabled: false }, reject: { enabled: false }, revise: { enabled: false } },
  }))
  const completed = await post(f.baseUrl, `/v1/executors/orca/work-orders/${workOrderId}/complete`, { token: orcaToken, leaseToken, body })
  assert.equal(completed.response.status, 200)
  assert.equal(completed.payload.work_order.status, 'COMPLETED')
  const card = await get(f.baseUrl, `/v1/work-orders/${workOrderId}/decision-card`, { token: ownerToken })
  assert.equal(card.response.status, 200)
  assert.equal(card.payload.decision_card.human_decision_required, true)
  assert.equal(card.payload.decision_card.controls.approve.enabled, false)
  for (const actionPath of ['approve', 'reject', 'execute', 'act']) {
    const attempt = await post(f.baseUrl, `/v1/work-orders/${workOrderId}/${actionPath}`, { token: ownerToken, body: {} })
    assert.equal(attempt.response.status, 404, `no programmatic action path may exist for ${actionPath}`)
  }
})

test('D: staging UI source keeps every decision control disabled', async () => {
  const source = await readFile(path.resolve('src/operator-bridge-staging/StagingOperatorBridgeApp.jsx'), 'utf8')
  assert.equal(source.includes('enabled: true'), false)
  assert.match(source, /disabled/)
})

// ---------------------------------------------------------------------------
// Item G: completion-replay artifact identity
// ---------------------------------------------------------------------------

test('G: replay compares the complete canonical completion identity', async (t) => {
  const f = await apiFixture()
  t.after(f.close)
  const ownerToken = mintOwner(f.config, OWNER_SCOPES)
  const orcaToken = mintOrca(f.config, ['claim', 'heartbeat', 'artifact:return', 'complete'])
  await post(f.baseUrl, '/v1/work-orders', { token: ownerToken, body: workOrderBody('replay-identity') })
  const orders = await get(f.baseUrl, '/v1/work-orders', { token: ownerToken })
  const workOrderId = orders.payload.work_orders[0].work_order_id
  const claimed = await post(f.baseUrl, '/v1/executors/orca/claim', { token: orcaToken, body: { capabilities: [], lease_ttl_seconds: 60 } })
  const leaseToken = claimed.payload.claim.lease_token
  await post(f.baseUrl, `/v1/executors/orca/work-orders/${workOrderId}/heartbeat`, { token: orcaToken, leaseToken, body: { lease_ttl_seconds: 60 } })
  const upload = async (type, content) => {
    const bytes = Buffer.from(content)
    const result = await post(f.baseUrl, `/v1/executors/orca/work-orders/${workOrderId}/artifacts`, {
      token: orcaToken, leaseToken,
      body: { artifact_type: type, content_base64: bytes.toString('base64'), sha256: sha256(bytes), byte_count: bytes.length, sensitivity_classification: 'synthetic' },
    })
    return result.payload.artifact.artifact_id
  }
  const log1 = await upload('test_log', '{"passed":true,"n":1}')
  const log2 = await upload('test_log', '{"passed":true,"n":2}')
  const card = await upload('decision_card', JSON.stringify({ work_order_id: workOrderId, controls: { approve: { enabled: false }, reject: { enabled: false }, revise: { enabled: false } } }))
  const body = { result_artifact_id: log1, evidence_artifact_id: log1, decision_card_artifact_id: card }
  const completed = await post(f.baseUrl, `/v1/executors/orca/work-orders/${workOrderId}/complete`, { token: orcaToken, leaseToken, body })
  assert.equal(completed.payload.work_order.status, 'COMPLETED')

  const exactReplay = await post(f.baseUrl, `/v1/executors/orca/work-orders/${workOrderId}/complete`, { token: orcaToken, leaseToken, body })
  assert.equal(exactReplay.response.status, 200)
  assert.equal(exactReplay.payload.work_order.status, 'COMPLETED')

  const divergentEvidence = await post(f.baseUrl, `/v1/executors/orca/work-orders/${workOrderId}/complete`, { token: orcaToken, leaseToken, body: { ...body, evidence_artifact_id: log2 } })
  assert.equal(divergentEvidence.response.status, 409)
  assert.equal(divergentEvidence.payload.error.code, 'COMPLETION_CONFLICT')

  const divergentResult = await post(f.baseUrl, `/v1/executors/orca/work-orders/${workOrderId}/complete`, { token: orcaToken, leaseToken, body: { ...body, result_artifact_id: log2 } })
  assert.equal(divergentResult.response.status, 409)

  const divergentCard = await post(f.baseUrl, `/v1/executors/orca/work-orders/${workOrderId}/complete`, { token: orcaToken, leaseToken, body: { ...body, decision_card_artifact_id: log2 } })
  assert.equal(divergentCard.response.status, 409)

  const order = await get(f.baseUrl, `/v1/work-orders/${workOrderId}`, { token: ownerToken })
  assert.equal(order.payload.work_order.status, 'COMPLETED')
  assert.equal(order.payload.work_order.result_artifact_id, log1)
  assert.equal(order.payload.work_order.evidence_artifact_id, log1)
  assert.equal(order.payload.work_order.decision_card_artifact_id, card)
})

// ---------------------------------------------------------------------------
// Item H: local-ledger completion TOCTOU
// ---------------------------------------------------------------------------

test('H: concurrent divergent completions produce exactly one canonical outcome', async () => {
  const verifier = async () => [
    { artifact_type: 'pull_request_identity', sha256: 'a'.repeat(64), work_order_id: 'wo-hardening-1' },
    { artifact_type: 'diff', sha256: 'b'.repeat(64), work_order_id: 'wo-hardening-1' },
  ]
  const { ledger, leaseToken } = await localLedgerFixture({ verifier })
  const first = ledger.completeIdempotently('wo-hardening-1', { actor: 'control-plane', leaseToken, resultUri: 'r1', resultHash: 'a'.repeat(64), evidenceUri: 'e1', evidenceHash: 'b'.repeat(64) })
  const second = ledger.completeIdempotently('wo-hardening-1', { actor: 'control-plane', leaseToken, resultUri: 'r2', resultHash: 'c'.repeat(64), evidenceUri: 'e2', evidenceHash: 'd'.repeat(64) })
  const [winner, loser] = await Promise.allSettled([first, second])
  assert.equal(winner.status, 'fulfilled')
  assert.equal(loser.status, 'rejected')
  assert.equal(loser.reason.code, 'COMPLETION_CONFLICT')
  const order = await ledger.get('wo-hardening-1')
  assert.equal(order.status, 'COMPLETED')
  assert.equal(order.result_uri, 'r1')
  assert.equal(order.evidence_uri, 'e1')
  const events = await ledger.events('wo-hardening-1')
  assert.equal(events.filter((event) => event.to_status === 'COMPLETED').length, 1)
})

test('H: concurrent identical replays both return the same canonical record', async () => {
  const verifier = async () => [
    { artifact_type: 'pull_request_identity', sha256: 'a'.repeat(64), work_order_id: 'wo-hardening-1' },
    { artifact_type: 'diff', sha256: 'b'.repeat(64), work_order_id: 'wo-hardening-1' },
  ]
  const { ledger, leaseToken } = await localLedgerFixture({ verifier })
  const args = { actor: 'control-plane', leaseToken, resultUri: 'r', resultHash: 'a'.repeat(64), evidenceUri: 'e', evidenceHash: 'b'.repeat(64) }
  const [first, second] = await Promise.all([
    ledger.completeIdempotently('wo-hardening-1', args),
    ledger.completeIdempotently('wo-hardening-1', args),
  ])
  assert.equal(first.updated_at, second.updated_at)
  assert.equal(first.result_hash, second.result_hash)
  const events = await ledger.events('wo-hardening-1')
  assert.equal(events.filter((event) => event.to_status === 'COMPLETED').length, 1)
})

test('H: lease identity is revalidated at commit time', async () => {
  const verifier = async () => [
    { artifact_type: 'pull_request_identity', sha256: 'a'.repeat(64), work_order_id: 'wo-hardening-1' },
    { artifact_type: 'diff', sha256: 'b'.repeat(64), work_order_id: 'wo-hardening-1' },
  ]
  const { ledger } = await localLedgerFixture({ verifier })
  await assert.rejects(
    ledger.completeIdempotently('wo-hardening-1', { actor: 'control-plane', leaseToken: 'forged-token', resultUri: 'r', resultHash: 'a'.repeat(64), evidenceUri: 'e', evidenceHash: 'b'.repeat(64) }),
    (error) => error.code === 'LEASE_MISMATCH',
  )
  assert.equal((await ledger.get('wo-hardening-1')).status, 'VERIFYING')
})

test('H: completion from a state without a canonical COMPLETED transition fails closed', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'hardening-toctou-'))
  const ledger = await new FileWorkOrderLedger({ root, artifactVerifier: async () => [] }).init()
  await ledger.create({
    work_order_id: 'wo-hardening-3', requested_by: 'hardening-test', originating_surface: 'test',
    task_type: 'github_pr_read_only_review', scope: { read_only: true }, approval_class: 'READ_ONLY', executor: 'ORCA',
    required_artifacts: [], input_hashes: [], status: 'QUEUED', idempotency_key: 'hardening:toctou:3',
  })
  await assert.rejects(
    ledger.completeIdempotently('wo-hardening-3', { actor: 'control-plane', resultUri: 'r', resultHash: 'a'.repeat(64), evidenceUri: 'e', evidenceHash: 'b'.repeat(64) }),
    (error) => error.code === 'INVALID_TRANSITION',
  )
  assert.equal((await ledger.get('wo-hardening-3')).status, 'QUEUED')
})
