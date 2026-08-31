import assert from 'node:assert/strict'
import { mkdtemp } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { createStagingApi } from '../../staging-control-plane/app.mjs'
import { createPasswordHash, sha256, signToken } from '../../staging-control-plane/security.mjs'
import { StagingStore } from '../../staging-control-plane/store.mjs'

const ORIGIN = 'https://deploy-preview-22--motesart-os.netlify.app'
const HEAD = 'c'.repeat(40)
const OWNER_PASSWORD = 'SYNTHETIC_MANUAL_RETRY_PASSWORD'
const SESSION_KEY = 'SYNTHETIC_MANUAL_RETRY_SESSION_KEY_32_BYTES'
const ORCA_KEY = 'SYNTHETIC_MANUAL_RETRY_ORCA_KEY_32_BYTES'
const BOOTSTRAP = 'SYNTHETIC_MANUAL_RETRY_BOOTSTRAP'

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'manual-retry-'))
  const store = await new StagingStore({ root }).init()
  const config = {
    allowedOrigin: ORIGIN,
    expectedPreviewHead: HEAD,
    ownerId: 'denarius-staging-owner',
    ownerPasswordHash: createPasswordHash(OWNER_PASSWORD, '00112233445566778899aabbccddeeff'),
    sessionSigningKey: SESSION_KEY,
    orcaBootstrapTokenHash: sha256(BOOTSTRAP),
    orcaSigningKey: ORCA_KEY,
    issuer: 'mya-operator-bridge-staging-v1',
    ownerSessionTtlSeconds: 900,
    orcaSessionTtlSeconds: 900,
  }
  const { server } = createStagingApi({ store, config, logger: { info() {} } })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const baseUrl = `http://127.0.0.1:${server.address().port}`
  return {
    root,
    store,
    config,
    baseUrl,
    close: async () => {
      await new Promise((resolve) => server.close(resolve))
      await store.close()
    },
  }
}

async function call(baseUrl, route, { token, head = HEAD, body = {}, method = 'POST' } = {}) {
  const headers = { origin: ORIGIN, 'x-motesart-preview-head': head, 'content-type': 'application/json' }
  if (token) headers.authorization = `Bearer ${token}`
  const response = await fetch(`${baseUrl}${route}`, { method, headers, body: JSON.stringify(body) })
  return { response, payload: await response.json() }
}

function ownerToken(config, overrides = {}) {
  return signToken({ sub: config.ownerId, role: 'owner', scopes: ['work-orders:submit', 'work-orders:read', 'work-orders:retry'], ...overrides }, SESSION_KEY, {
    issuer: config.issuer,
    audience: 'motesart-os-staging-preview',
    ttlSeconds: overrides.ttlSeconds ?? 60,
  })
}

async function blockedOrder(store, suffix, blockerCode = 'KIMI_RESPONSE_UNAVAILABLE', readOnly = true) {
  const created = await store.createWorkOrder({
    requested_by: 'staging-owner',
    originating_surface: 'motesart-os-netlify-preview',
    instruction: 'Synthetic same-ID retry test.',
    task_type: 'github_pr_read_only_review',
    scope: { repository: 'Synthetic/Fixture', pull_request: 22, read_only: readOnly },
    priority: 'normal',
    approval_class: 'READ_ONLY',
    executor: 'ORCA',
    idempotency_key: `manual-retry-create:${suffix}`,
  })
  const claimed = await store.claim({ workOrderId: created.work_order.work_order_id, leaseOwner: 'orca-synthetic', leaseTtlMs: 60_000 })
  const bytes = Buffer.from(`artifact-${suffix}`)
  await store.uploadArtifact(created.work_order.work_order_id, {
    leaseOwner: 'orca-synthetic',
    leaseToken: claimed.lease_token,
    artifact: {
      artifact_type: 'repository_identity',
      content_base64: bytes.toString('base64'),
      sha256: sha256(bytes),
      byte_count: bytes.length,
      sensitivity_classification: 'synthetic',
    },
  })
  await store.block(created.work_order.work_order_id, {
    leaseOwner: 'orca-synthetic',
    leaseToken: claimed.lease_token,
    blockerCode,
    nextAction: 'OWNER_MANUAL_RETRY_REQUIRED',
  })
  return created.work_order.work_order_id
}

test('manual retry API requires a current staging-owner JWT and exact preview head', async (t) => {
  const f = await fixture()
  t.after(f.close)
  const id = await blockedOrder(f.store, 'auth')
  const route = `/v1/work-orders/${id}/manual-retry`
  const body = { idempotency_key: 'manual-retry:auth:unique' }

  assert.equal((await call(f.baseUrl, route, { body })).response.status, 401)
  assert.equal((await call(f.baseUrl, route, { token: 'invalid.synthetic.token', body })).response.status, 401)
  const expired = ownerToken(f.config, { ttlSeconds: -1 })
  assert.equal((await call(f.baseUrl, route, { token: expired, body })).response.status, 401)
  const nonOwner = signToken({ sub: 'orca-synthetic', role: 'orca' }, SESSION_KEY, { issuer: f.config.issuer, audience: 'motesart-os-staging-preview', ttlSeconds: 60 })
  assert.equal((await call(f.baseUrl, route, { token: nonOwner, body })).response.status, 403)
  const stale = await call(f.baseUrl, route, { token: ownerToken(f.config), head: 'd'.repeat(40), body })
  assert.equal(stale.response.status, 409)
  assert.equal(stale.payload.error.code, 'STALE_PREVIEW_HEAD')
})

test('eligible retry preserves ID, artifacts, history, and execution attempt until normal claim', async (t) => {
  const f = await fixture()
  t.after(f.close)
  const id = await blockedOrder(f.store, 'preserve')
  const beforeOrders = await f.store.listWorkOrders()
  const beforeEvents = await f.store.getEvents(id)
  const beforeArtifacts = await f.store.getArtifacts(id)
  const before = await f.store.getWorkOrder(id)
  assert.equal(before.manual_retry_eligible, true)

  const result = await call(f.baseUrl, `/v1/work-orders/${id}/manual-retry`, {
    token: ownerToken(f.config),
    body: { idempotency_key: 'manual-retry:preserve:unique' },
  })
  assert.equal(result.response.status, 200)
  assert.equal(result.payload.work_order.work_order_id, id)
  assert.equal(result.payload.work_order.status, 'QUEUED')
  assert.equal(result.payload.work_order.attempt_count, before.attempt_count)
  assert.equal(result.payload.work_order.manual_retry_count, 1)
  assert.equal((await f.store.listWorkOrders()).length, beforeOrders.length)
  assert.deepEqual(await f.store.getArtifacts(id), beforeArtifacts)
  const afterEvents = await f.store.getEvents(id)
  assert.deepEqual(afterEvents.slice(0, beforeEvents.length), beforeEvents)
  assert.deepEqual(afterEvents.slice(-2).map((event) => event.code), ['MANUAL_RETRY_AUTHORIZED', 'WORK_ORDER_REQUEUED'])

  const replay = await call(f.baseUrl, `/v1/work-orders/${id}/manual-retry`, {
    token: ownerToken(f.config),
    body: { idempotency_key: 'manual-retry:preserve:unique' },
  })
  assert.equal(replay.response.status, 200)
  assert.equal(replay.payload.duplicate, true)
  assert.equal(replay.payload.work_order.work_order_id, id)
  const second = await call(f.baseUrl, `/v1/work-orders/${id}/manual-retry`, {
    token: ownerToken(f.config),
    body: { idempotency_key: 'manual-retry:preserve:second' },
  })
  assert.equal(second.response.status, 409)
  assert.equal(second.payload.error.code, 'MANUAL_RETRY_LIMIT_REACHED')

  const claimed = await f.store.claim({ workOrderId: id, leaseOwner: 'orca-retry', leaseTtlMs: 60_000 })
  assert.equal(claimed.work_order.work_order_id, id)
  assert.equal(claimed.work_order.attempt_count, before.attempt_count + 1)
})

test('manual retry is atomic, idempotent, and limited to one authorization', async (t) => {
  const f = await fixture()
  t.after(f.close)
  const id = await blockedOrder(f.store, 'atomic', 'KIMI_REASONING_ONLY_LENGTH')
  const sameKey = 'manual-retry:atomic:same-key'
  const first = await f.store.manualRetry(id, { actor: 'denarius-staging-owner', idempotencyKey: sameKey })
  const replay = await f.store.manualRetry(id, { actor: 'denarius-staging-owner', idempotencyKey: sameKey })
  assert.equal(first.duplicate, false)
  assert.equal(replay.duplicate, true)
  assert.deepEqual(replay.work_order, first.work_order)
  assert.equal((await f.store.getEvents(id)).filter((event) => event.code === 'MANUAL_RETRY_AUTHORIZED').length, 1)

  await assert.rejects(
    f.store.manualRetry(id, { actor: 'denarius-staging-owner', idempotencyKey: 'manual-retry:atomic:second' }),
    (error) => error.code === 'MANUAL_RETRY_LIMIT_REACHED',
  )
})

test('concurrent retries cannot both succeed', async (t) => {
  const f = await fixture()
  t.after(f.close)
  const id = await blockedOrder(f.store, 'concurrent')
  const settled = await Promise.allSettled([
    f.store.manualRetry(id, { actor: 'owner', idempotencyKey: 'manual-retry:concurrent:one' }),
    f.store.manualRetry(id, { actor: 'owner', idempotencyKey: 'manual-retry:concurrent:two' }),
  ])
  assert.deepEqual(settled.map((result) => result.status).sort(), ['fulfilled', 'rejected'])
  assert.equal((await f.store.getWorkOrder(id)).manual_retry_count, 1)
})

test('active leases, nonallowlisted blockers, non-BLOCKED states, and write scopes cannot retry', async (t) => {
  const f = await fixture()
  t.after(f.close)

  const active = await f.store.createWorkOrder({
    requested_by: 'owner', originating_surface: 'motesart-os-netlify-preview', instruction: 'Synthetic active lease.',
    task_type: 'github_pr_read_only_review', scope: { read_only: true }, priority: 'normal', approval_class: 'READ_ONLY', executor: 'ORCA', idempotency_key: 'manual-retry-active-create',
  })
  await f.store.claim({ workOrderId: active.work_order.work_order_id, leaseOwner: 'orca-active', leaseTtlMs: 60_000 })
  await assert.rejects(f.store.manualRetry(active.work_order.work_order_id, { actor: 'owner', idempotencyKey: 'manual-retry:active:test' }), (error) => error.code === 'MANUAL_RETRY_ACTIVE_LEASE')

  const wrongBlocker = await blockedOrder(f.store, 'wrong-blocker', 'FABLE_ADAPTER_UNAVAILABLE')
  await assert.rejects(f.store.manualRetry(wrongBlocker, { actor: 'owner', idempotencyKey: 'manual-retry:blocker:test' }), (error) => error.code === 'MANUAL_RETRY_BLOCKER_NOT_ALLOWED')

  const writeScope = await blockedOrder(f.store, 'write-scope', 'KIMI_RESPONSE_UNAVAILABLE', false)
  await assert.rejects(f.store.manualRetry(writeScope, { actor: 'owner', idempotencyKey: 'manual-retry:write:test' }), (error) => error.code === 'MANUAL_RETRY_READ_ONLY_REQUIRED')

  const queued = await f.store.createWorkOrder({
    requested_by: 'owner', originating_surface: 'motesart-os-netlify-preview', instruction: 'Synthetic queued order.',
    task_type: 'github_pr_read_only_review', scope: { read_only: true }, priority: 'normal', approval_class: 'READ_ONLY', executor: 'ORCA', idempotency_key: 'manual-retry-queued-create',
  })
  await assert.rejects(f.store.manualRetry(queued.work_order.work_order_id, { actor: 'owner', idempotencyKey: 'manual-retry:queued:test' }), (error) => error.code === 'MANUAL_RETRY_STATE_NOT_ALLOWED')
})
