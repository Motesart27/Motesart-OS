import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { TERMINAL_STATES, TRANSITIONS } from '../../operator-bridge/constants.mjs'
import { createStagingApi, STAGING_BANNER } from '../../staging-control-plane/app.mjs'
import { OrcaStagingWorker } from '../../operator-bridge/orca-staging-worker.mjs'
import { createPasswordHash, sha256, signToken } from '../../staging-control-plane/security.mjs'
import { BLOCKABLE_STATES, StagingStore } from '../../staging-control-plane/store.mjs'

const ORIGIN = 'https://deploy-preview-22--motesart-os.netlify.app'
const HEAD = 'a'.repeat(40)
const OWNER_PASSWORD = 'SYNTHETIC_OWNER_PASSWORD'
const SESSION_KEY = 'SYNTHETIC_SESSION_SIGNING_KEY_32_BYTES'
const ORCA_KEY = 'SYNTHETIC_ORCA_SIGNING_KEY_32_BYTES'
const BOOTSTRAP = 'SYNTHETIC_ORCA_BOOTSTRAP_TOKEN'

async function fixture({ clock = () => Date.now() } = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'mya-operator-bridge-staging-'))
  const store = await new StagingStore({ root, clock }).init()
  const logs = []
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
  const { server } = createStagingApi({ store, config, logger: { info: (entry) => logs.push(entry) } })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  const baseUrl = `http://127.0.0.1:${address.port}`
  const close = async () => {
    await new Promise((resolve) => server.close(resolve))
    await store.close()
  }
  return { root, store, config, logs, baseUrl, close }
}

async function call(baseUrl, path, { method = 'GET', token = null, body = null, origin = ORIGIN, head = HEAD, leaseToken = null } = {}) {
  const headers = {}
  if (origin) headers.origin = origin
  if (head) headers['x-motesart-preview-head'] = head
  if (token) headers.authorization = `Bearer ${token}`
  if (leaseToken) headers['x-lease-token'] = leaseToken
  if (body !== null) headers['content-type'] = 'application/json'
  const response = await fetch(`${baseUrl}${path}`, { method, headers, body: body === null ? undefined : JSON.stringify(body) })
  return { response, payload: response.status === 204 ? null : await response.json() }
}

async function login(baseUrl) {
  const result = await call(baseUrl, '/v1/auth/session', { method: 'POST', body: { owner_id: 'denarius-staging-owner', password: OWNER_PASSWORD } })
  assert.equal(result.response.status, 200)
  return result.payload.token
}

async function orcaLogin(baseUrl, bootstrap = BOOTSTRAP) {
  return call(baseUrl, '/v1/executors/orca/session', { method: 'POST', origin: null, head: null, token: bootstrap, body: { worker_id: 'orca-staging-test' } })
}

function workOrderBody(suffix, overrides = {}) {
  return {
    instruction: 'Synthetic staging control-plane test only.',
    originating_surface: 'motesart-os-netlify-preview',
    task_type: 'staging_smoke_test',
    scope: { data_class: 'synthetic', protected_writes: false },
    priority: 'normal',
    approval_class: 'READ_ONLY',
    executor: 'ORCA',
    idempotency_key: `staging-test:${suffix}`,
    ...overrides,
  }
}

async function createOrder(baseUrl, ownerToken, suffix, overrides = {}) {
  return call(baseUrl, '/v1/work-orders', { method: 'POST', token: ownerToken, body: workOrderBody(suffix, overrides) })
}

async function upload(baseUrl, token, workOrderId, leaseToken, artifactType, content) {
  const bytes = Buffer.from(content)
  return call(baseUrl, `/v1/executors/orca/work-orders/${workOrderId}/artifacts`, {
    method: 'POST', origin: null, head: null, token, leaseToken,
    body: { artifact_type: artifactType, content_base64: bytes.toString('base64'), sha256: sha256(bytes), byte_count: bytes.length, sensitivity_classification: 'synthetic' },
  })
}

test('isolated staging control-plane security, failure, and return-channel contract', async (t) => {
  const f = await fixture()
  t.after(f.close)

  await t.test('health is public, bounded, and labeled', async () => {
    const { response, payload } = await call(f.baseUrl, '/v1/health', { origin: null, head: null })
    assert.equal(response.status, 200)
    assert.equal(payload.banner, STAGING_BANNER)
    assert.equal(payload.storage_namespace, 'staging')
    assert.equal(payload.approvals_enabled, false)
  })

  await t.test('unauthenticated phone submission is rejected before body use', async () => {
    const sentinel = 'SENSITIVE_PERSONAL_SENTINEL'
    const { response, payload } = await call(f.baseUrl, '/v1/work-orders', { method: 'POST', body: { instruction: sentinel } })
    assert.equal(response.status, 401)
    assert.equal(payload.error.code, 'AUTHENTICATION_REQUIRED')
    assert.equal(f.logs.join('\n').includes(sentinel), false)
  })

  await t.test('wrong owner password and stale preview head fail closed', async () => {
    const wrong = await call(f.baseUrl, '/v1/auth/session', { method: 'POST', body: { owner_id: 'denarius-staging-owner', password: 'WRONG_SYNTHETIC_PASSWORD' } })
    assert.equal(wrong.response.status, 401)
    const stale = await call(f.baseUrl, '/v1/auth/session', { method: 'POST', head: 'b'.repeat(40), body: { owner_id: 'denarius-staging-owner', password: OWNER_PASSWORD } })
    assert.equal(stale.response.status, 409)
    assert.equal(stale.payload.error.code, 'STALE_PREVIEW_HEAD')
  })

  const ownerToken = await login(f.baseUrl)

  await t.test('invalid phone role and expired session are rejected', async () => {
    const wrongRole = signToken({ sub: 'test', role: 'orca' }, SESSION_KEY, { issuer: f.config.issuer, audience: 'motesart-os-staging-preview', ttlSeconds: 60 })
    const forbidden = await call(f.baseUrl, '/v1/work-orders', { token: wrongRole })
    assert.equal(forbidden.response.status, 403)
    const expired = signToken({ sub: 'test', role: 'owner' }, SESSION_KEY, { issuer: f.config.issuer, audience: 'motesart-os-staging-preview', ttlSeconds: -1 })
    const rejected = await call(f.baseUrl, '/v1/work-orders', { token: expired })
    assert.equal(rejected.response.status, 401)
    assert.equal(rejected.payload.error.code, 'SESSION_EXPIRED')
  })

  await t.test('protected writes and arbitrary execution fields are denied', async () => {
    const protectedWrite = await createOrder(f.baseUrl, ownerToken, 'protected', { approval_class: 'PROTECTED_WRITE' })
    assert.equal(protectedWrite.response.status, 403)
    assert.equal(protectedWrite.payload.error.code, 'PROTECTED_WRITE_DISABLED')
    const shell = await createOrder(f.baseUrl, ownerToken, 'shell', { scope: { data_class: 'synthetic', command: 'SENSITIVE_SHELL_SENTINEL' } })
    assert.equal(shell.response.status, 400)
    assert.equal(shell.payload.error.code, 'ARBITRARY_EXECUTION_FIELD_REJECTED')
    assert.equal(f.logs.join('\n').includes('SENSITIVE_SHELL_SENTINEL'), false)
  })

  const created = await createOrder(f.baseUrl, ownerToken, 'primary')
  assert.equal(created.response.status, 201)
  const workOrderId = created.payload.work_order.work_order_id

  await t.test('duplicate submission is idempotent', async () => {
    const duplicate = await createOrder(f.baseUrl, ownerToken, 'primary')
    assert.equal(duplicate.response.status, 200)
    assert.equal(duplicate.payload.duplicate, true)
    assert.equal(duplicate.payload.work_order.work_order_id, workOrderId)
  })

  await t.test('unauthenticated and wrong ORCA identities are rejected', async () => {
    const anonymous = await call(f.baseUrl, '/v1/executors/orca/claim', { method: 'POST', origin: null, head: null, body: { capabilities: [], lease_ttl_seconds: 60 } })
    assert.equal(anonymous.response.status, 401)
    const wrong = await orcaLogin(f.baseUrl, 'WRONG_BOOTSTRAP')
    assert.equal(wrong.response.status, 401)
  })

  const orca = await orcaLogin(f.baseUrl)
  assert.equal(orca.response.status, 200)
  const orcaToken = orca.payload.token
  const claim = await call(f.baseUrl, '/v1/executors/orca/claim', { method: 'POST', origin: null, head: null, token: orcaToken, body: { capabilities: ['run_local_tests'], lease_ttl_seconds: 60 } })
  const leaseToken = claim.payload.claim.lease_token

  await t.test('atomic claim prevents a duplicate claim', async () => {
    assert.equal(claim.payload.claim.work_order.work_order_id, workOrderId)
    const duplicateClaim = await call(f.baseUrl, '/v1/executors/orca/claim', { method: 'POST', origin: null, head: null, token: orcaToken, body: { capabilities: [], lease_ttl_seconds: 60 } })
    assert.equal(duplicateClaim.payload.claim, null)
  })

  await t.test('stale fencing token is rejected and correct heartbeat starts execution', async () => {
    const stale = await call(f.baseUrl, `/v1/executors/orca/work-orders/${workOrderId}/heartbeat`, { method: 'POST', origin: null, head: null, token: orcaToken, leaseToken: 'STALE_TOKEN', body: { lease_ttl_seconds: 60 } })
    assert.equal(stale.response.status, 409)
    assert.equal(stale.payload.error.code, 'STALE_FENCING_TOKEN')
    const heartbeat = await call(f.baseUrl, `/v1/executors/orca/work-orders/${workOrderId}/heartbeat`, { method: 'POST', origin: null, head: null, token: orcaToken, leaseToken, body: { lease_ttl_seconds: 60 } })
    assert.equal(heartbeat.payload.work_order.status, 'RUNNING')
  })

  await t.test('corrupted artifact blocks the work order visibly', async () => {
    const corrupted = await call(f.baseUrl, `/v1/executors/orca/work-orders/${workOrderId}/artifacts`, { method: 'POST', origin: null, head: null, token: orcaToken, leaseToken, body: { artifact_type: 'test_log', content_base64: Buffer.from('actual').toString('base64'), sha256: sha256('different'), byte_count: 6, sensitivity_classification: 'synthetic' } })
    assert.equal(corrupted.response.status, 409)
    const order = await call(f.baseUrl, `/v1/work-orders/${workOrderId}`, { token: ownerToken })
    assert.equal(order.payload.work_order.status, 'BLOCKED')
    assert.equal(order.payload.work_order.blocker_code, 'ARTIFACT_INTEGRITY_FAILURE')
  })

  await t.test('offline queue and reconnect release/reclaim remain resumable', async () => {
    const offline = await createOrder(f.baseUrl, ownerToken, 'offline')
    const offlineId = offline.payload.work_order.work_order_id
    const queued = await call(f.baseUrl, `/v1/work-orders/${offlineId}`, { token: ownerToken })
    assert.equal(queued.payload.work_order.status, 'QUEUED')
    const claimed = await call(f.baseUrl, '/v1/executors/orca/claim', { method: 'POST', origin: null, head: null, token: orcaToken, body: { capabilities: [], lease_ttl_seconds: 60 } })
    const released = await call(f.baseUrl, `/v1/executors/orca/work-orders/${offlineId}/release`, { method: 'POST', origin: null, head: null, token: orcaToken, leaseToken: claimed.payload.claim.lease_token, body: {} })
    assert.equal(released.payload.work_order.status, 'QUEUED')
    const reclaimed = await call(f.baseUrl, '/v1/executors/orca/claim', { method: 'POST', origin: null, head: null, token: orcaToken, body: { capabilities: [], lease_ttl_seconds: 60 } })
    assert.equal(reclaimed.payload.claim.work_order.work_order_id, offlineId)
    const unavailable = await call(f.baseUrl, `/v1/executors/orca/work-orders/${offlineId}/block`, { method: 'POST', origin: null, head: null, token: orcaToken, leaseToken: reclaimed.payload.claim.lease_token, body: { blocker_code: 'FABLE_ADAPTER_UNAVAILABLE', next_action: 'RESUME_WHEN_VERIFIER_AVAILABLE' } })
    assert.equal(unavailable.payload.work_order.status, 'BLOCKED')
    assert.equal(unavailable.payload.work_order.blocker_code, 'FABLE_ADAPTER_UNAVAILABLE')
  })

  await t.test('missing return-channel artifacts block completion', async () => {
    const missing = await createOrder(f.baseUrl, ownerToken, 'missing')
    const missingId = missing.payload.work_order.work_order_id
    const missingClaim = await call(f.baseUrl, '/v1/executors/orca/claim', { method: 'POST', origin: null, head: null, token: orcaToken, body: { capabilities: [], lease_ttl_seconds: 60 } })
    const blocked = await call(f.baseUrl, `/v1/executors/orca/work-orders/${missingId}/complete`, { method: 'POST', origin: null, head: null, token: orcaToken, leaseToken: missingClaim.payload.claim.lease_token, body: { result_artifact_id: 'missing', evidence_artifact_id: 'missing', decision_card_artifact_id: 'missing' } })
    assert.equal(blocked.response.status, 409)
    const order = await call(f.baseUrl, `/v1/work-orders/${missingId}`, { token: ownerToken })
    assert.equal(order.payload.work_order.status, 'BLOCKED')
    assert.equal(order.payload.work_order.blocker_code, 'REQUIRED_ARTIFACT_MISSING')
  })

  await t.test('valid artifacts complete idempotently and publish a disabled-control decision card', async () => {
    const valid = await createOrder(f.baseUrl, ownerToken, 'valid')
    const validId = valid.payload.work_order.work_order_id
    const validClaim = await call(f.baseUrl, '/v1/executors/orca/claim', { method: 'POST', origin: null, head: null, token: orcaToken, body: { capabilities: [], lease_ttl_seconds: 60 } })
    const validLease = validClaim.payload.claim.lease_token
    await call(f.baseUrl, `/v1/executors/orca/work-orders/${validId}/heartbeat`, { method: 'POST', origin: null, head: null, token: orcaToken, leaseToken: validLease, body: { lease_ttl_seconds: 60 } })
    const log = await upload(f.baseUrl, orcaToken, validId, validLease, 'test_log', '{"passed":true}')
    const cardObject = { work_order_id: validId, controls: { approve: { enabled: false }, reject: { enabled: false }, revise: { enabled: false } }, kimi_result: { status: 'PASS' }, codex_result: { status: 'PASS' }, fable_verdict: { status: 'PASS' } }
    const card = await upload(f.baseUrl, orcaToken, validId, validLease, 'decision_card', JSON.stringify(cardObject))
    const completeBody = { result_artifact_id: log.payload.artifact.artifact_id, evidence_artifact_id: log.payload.artifact.artifact_id, decision_card_artifact_id: card.payload.artifact.artifact_id }
    const completed = await call(f.baseUrl, `/v1/executors/orca/work-orders/${validId}/complete`, { method: 'POST', origin: null, head: null, token: orcaToken, leaseToken: validLease, body: completeBody })
    assert.equal(completed.payload.work_order.status, 'COMPLETED')
    const replay = await call(f.baseUrl, `/v1/executors/orca/work-orders/${validId}/complete`, { method: 'POST', origin: null, head: null, token: orcaToken, leaseToken: validLease, body: completeBody })
    assert.equal(replay.payload.work_order.status, 'COMPLETED')
    const decision = await call(f.baseUrl, `/v1/work-orders/${validId}/decision-card`, { token: ownerToken })
    assert.equal(decision.payload.decision_card.controls.approve.enabled, false)
    const artifacts = await call(f.baseUrl, `/v1/work-orders/${validId}/artifacts`, { token: ownerToken })
    assert.equal(artifacts.payload.artifacts.length, 2)
  })

  await t.test('executor self-approval is rejected and blocks the work order', async () => {
    const invalid = await createOrder(f.baseUrl, ownerToken, 'self-approval')
    const invalidId = invalid.payload.work_order.work_order_id
    const invalidClaim = await call(f.baseUrl, '/v1/executors/orca/claim', { method: 'POST', origin: null, head: null, token: orcaToken, body: { capabilities: [], lease_ttl_seconds: 60 } })
    const invalidLease = invalidClaim.payload.claim.lease_token
    const log = await upload(f.baseUrl, orcaToken, invalidId, invalidLease, 'test_log', '{"passed":true}')
    const unsafeCard = await upload(f.baseUrl, orcaToken, invalidId, invalidLease, 'decision_card', JSON.stringify({ work_order_id: invalidId, controls: { approve: { enabled: true } } }))
    const rejected = await call(f.baseUrl, `/v1/executors/orca/work-orders/${invalidId}/complete`, { method: 'POST', origin: null, head: null, token: orcaToken, leaseToken: invalidLease, body: { result_artifact_id: log.payload.artifact.artifact_id, evidence_artifact_id: log.payload.artifact.artifact_id, decision_card_artifact_id: unsafeCard.payload.artifact.artifact_id } })
    assert.equal(rejected.response.status, 409)
    const order = await call(f.baseUrl, `/v1/work-orders/${invalidId}`, { token: ownerToken })
    assert.equal(order.payload.work_order.status, 'BLOCKED')
    assert.equal(order.payload.work_order.blocker_code, 'EXECUTOR_SELF_APPROVAL_REJECTED')
  })

  await t.test('ledger events form a valid hash chain and second writer is denied', async () => {
    const statePath = path.join(f.root, 'staging', 'ledger', 'state.json')
    const state = JSON.parse(await readFile(statePath, 'utf8'))
    assert.equal(state.events.at(-1).event_hash, state.chain_head)
    const second = new StagingStore({ root: f.root })
    await assert.rejects(second.init(), (error) => error.code === 'STAGING_LEDGER_LOCKED')
  })

  await t.test('staging source contains no production host or credential name', async () => {
    const files = ['app.mjs', 'server.mjs', 'store.mjs', 'security.mjs']
    const source = (await Promise.all(files.map((file) => readFile(path.resolve('staging-control-plane', file), 'utf8')))).join('\n')
    assert.equal(source.includes('deployable-python-codebase-som-production'), false)
    assert.equal(source.includes('MOONSHOT_API_KEY'), false)
    assert.equal(source.includes('AIRTABLE'), false)
    assert.equal(source.includes('GMAIL'), false)
  })

  await t.test('logs contain only structural metadata', async () => {
    for (const forbidden of [OWNER_PASSWORD, BOOTSTRAP, 'SENSITIVE_PERSONAL_SENTINEL', 'SENSITIVE_SHELL_SENTINEL']) {
      assert.equal(f.logs.join('\n').includes(forbidden), false)
    }
  })
})

test('expired lease is reclaimed with a fresh fencing token', async () => {
  let now = Date.parse('2026-07-26T00:00:00Z')
  const f = await fixture({ clock: () => now })
  try {
    const created = await f.store.createWorkOrder({ ...workOrderBody('expiry'), requested_by: 'synthetic-owner' })
    const first = await f.store.claim({ leaseOwner: 'orca-one', leaseTtlMs: 1_000 })
    now += 2_000
    const orders = await f.store.listWorkOrders()
    assert.equal(orders.find((order) => order.work_order_id === created.work_order.work_order_id).status, 'QUEUED')
    const second = await f.store.claim({ leaseOwner: 'orca-two', leaseTtlMs: 1_000 })
    assert.notEqual(second.lease_token, first.lease_token)
    assert.equal(second.work_order.attempt_count, 2)
  } finally {
    await f.close()
  }
})

test('ledger tampering fails startup closed', async () => {
  const f = await fixture()
  const statePath = path.join(f.root, 'staging', 'ledger', 'state.json')
  await f.store.createWorkOrder({ ...workOrderBody('tamper'), requested_by: 'synthetic-owner' })
  await f.close()
  const state = JSON.parse(await readFile(statePath, 'utf8'))
  state.events[0].code = 'TAMPERED'
  await writeFile(statePath, JSON.stringify(state))
  const reopened = new StagingStore({ root: f.root })
  await assert.rejects(reopened.init(), (error) => error.code === 'LEDGER_INTEGRITY_FAILURE')
  await reopened.close()
})

test('outbound staging worker rejects unsupported and free-form commands before network access', async () => {
  let networkCalls = 0
  const worker = new OrcaStagingWorker({
    baseUrl: 'https://operator-bridge-control-plane-staging.up.railway.app',
    workerId: 'orca-test',
    bootstrapTokenProvider: async () => 'SYNTHETIC',
    fetchImpl: async () => { networkCalls += 1; throw new Error('NETWORK_SHOULD_NOT_RUN') },
  })
  await assert.rejects(worker.execute({ action: 'execute_shell', payload: {} }), (error) => error.code === 'UNSUPPORTED_STAGING_ACTION')
  await assert.rejects(worker.execute({ action: 'claim', payload: { command: 'SENSITIVE_COMMAND' } }), (error) => error.code === 'ARBITRARY_COMMAND_REJECTED')
  assert.equal(networkCalls, 0)
})

test('block obeys the canonical transition contract and terminal states are immutable', async (t) => {
  await t.test('blockable-state table mirrors the canonical TRANSITIONS projection', () => {
    for (const [state, targets] of Object.entries(TRANSITIONS)) {
      assert.equal(BLOCKABLE_STATES.has(state), targets.has('BLOCKED'), `BLOCKABLE_STATES parity for ${state}`)
    }
    for (const terminal of TERMINAL_STATES) {
      assert.equal(TRANSITIONS[terminal].has('BLOCKED'), false, `canonical ${terminal} must not allow BLOCKED`)
      assert.equal(BLOCKABLE_STATES.has(terminal), false, `terminal ${terminal} must not be blockable`)
    }
  })

  const f = await fixture()
  t.after(f.close)
  const ownerToken = await login(f.baseUrl)
  const orca = await orcaLogin(f.baseUrl)
  const orcaToken = orca.payload.token

  const created = await createOrder(f.baseUrl, ownerToken, 'terminal-immutability')
  const workOrderId = created.payload.work_order.work_order_id
  const claim = await call(f.baseUrl, '/v1/executors/orca/claim', { method: 'POST', origin: null, head: null, token: orcaToken, body: { capabilities: [], lease_ttl_seconds: 60 } })
  const leaseToken = claim.payload.claim.lease_token
  await call(f.baseUrl, `/v1/executors/orca/work-orders/${workOrderId}/heartbeat`, { method: 'POST', origin: null, head: null, token: orcaToken, leaseToken, body: { lease_ttl_seconds: 60 } })
  const log = await upload(f.baseUrl, orcaToken, workOrderId, leaseToken, 'test_log', '{"passed":true}')
  const cardObject = { work_order_id: workOrderId, controls: { approve: { enabled: false }, reject: { enabled: false }, revise: { enabled: false } }, kimi_result: { status: 'PASS' }, codex_result: { status: 'PASS' }, fable_verdict: { status: 'PASS' } }
  const card = await upload(f.baseUrl, orcaToken, workOrderId, leaseToken, 'decision_card', JSON.stringify(cardObject))
  const completed = await call(f.baseUrl, `/v1/executors/orca/work-orders/${workOrderId}/complete`, { method: 'POST', origin: null, head: null, token: orcaToken, leaseToken, body: { result_artifact_id: log.payload.artifact.artifact_id, evidence_artifact_id: log.payload.artifact.artifact_id, decision_card_artifact_id: card.payload.artifact.artifact_id } })
  assert.equal(completed.payload.work_order.status, 'COMPLETED')
  const eventsBefore = await f.store.getEvents(workOrderId)
  const artifactsBefore = await f.store.getArtifacts(workOrderId)

  await t.test('COMPLETED to BLOCKED is rejected through the unleased path and changes nothing', async () => {
    const blocked = await call(f.baseUrl, `/v1/executors/orca/work-orders/${workOrderId}/block`, { method: 'POST', origin: null, head: null, token: orcaToken, leaseToken: 'LEFT_OVER_FENCING_TOKEN', body: { blocker_code: 'FABLE_ADAPTER_UNAVAILABLE', next_action: 'RESUME_WHEN_VERIFIER_AVAILABLE' } })
    assert.equal(blocked.response.status, 409)
    assert.equal(blocked.payload.error.code, 'INVALID_TRANSITION')
    const order = await f.store.getWorkOrder(workOrderId)
    assert.equal(order.status, 'COMPLETED')
    assert.equal(order.blocker_code, null)
    assert.equal(order.manual_retry_count, 0)
    assert.equal(order.result_artifact_id, completed.payload.work_order.result_artifact_id)
    assert.equal(order.evidence_artifact_id, completed.payload.work_order.evidence_artifact_id)
    assert.equal(order.decision_card_artifact_id, completed.payload.work_order.decision_card_artifact_id)
    assert.deepEqual(await f.store.getEvents(workOrderId), eventsBefore)
    assert.deepEqual(await f.store.getArtifacts(workOrderId), artifactsBefore)
  })

  await t.test('re-blocking a BLOCKED order is rejected by the same deny-by-default contract', async () => {
    const second = await createOrder(f.baseUrl, ownerToken, 'reblock-rejected')
    const secondId = second.payload.work_order.work_order_id
    const secondClaim = await call(f.baseUrl, '/v1/executors/orca/claim', { method: 'POST', origin: null, head: null, token: orcaToken, body: { capabilities: [], lease_ttl_seconds: 60 } })
    const first = await call(f.baseUrl, `/v1/executors/orca/work-orders/${secondId}/block`, { method: 'POST', origin: null, head: null, token: orcaToken, leaseToken: secondClaim.payload.claim.lease_token, body: { blocker_code: 'FABLE_ADAPTER_UNAVAILABLE', next_action: 'RESUME_WHEN_VERIFIER_AVAILABLE' } })
    assert.equal(first.payload.work_order.status, 'BLOCKED')
    const eventsAfterFirst = await f.store.getEvents(secondId)
    const reblocked = await call(f.baseUrl, `/v1/executors/orca/work-orders/${secondId}/block`, { method: 'POST', origin: null, head: null, token: orcaToken, leaseToken: 'LEFT_OVER_FENCING_TOKEN', body: { blocker_code: 'KIMI_RESPONSE_UNAVAILABLE', next_action: 'OWNER_MANUAL_RETRY_REQUIRED' } })
    assert.equal(reblocked.response.status, 409)
    assert.equal(reblocked.payload.error.code, 'INVALID_TRANSITION')
    const order = await f.store.getWorkOrder(secondId)
    assert.equal(order.status, 'BLOCKED')
    assert.equal(order.blocker_code, 'FABLE_ADAPTER_UNAVAILABLE')
    assert.deepEqual(await f.store.getEvents(secondId), eventsAfterFirst)
  })

  await t.test('stale fencing token remains rejected and a valid leased block still works', async () => {
    const third = await createOrder(f.baseUrl, ownerToken, 'valid-block')
    const thirdId = third.payload.work_order.work_order_id
    const thirdClaim = await call(f.baseUrl, '/v1/executors/orca/claim', { method: 'POST', origin: null, head: null, token: orcaToken, body: { capabilities: [], lease_ttl_seconds: 60 } })
    const thirdLease = thirdClaim.payload.claim.lease_token
    const stale = await call(f.baseUrl, `/v1/executors/orca/work-orders/${thirdId}/block`, { method: 'POST', origin: null, head: null, token: orcaToken, leaseToken: 'STALE_TOKEN', body: { blocker_code: 'FABLE_ADAPTER_UNAVAILABLE', next_action: 'RESUME_WHEN_VERIFIER_AVAILABLE' } })
    assert.equal(stale.response.status, 409)
    assert.equal(stale.payload.error.code, 'STALE_FENCING_TOKEN')
    const valid = await call(f.baseUrl, `/v1/executors/orca/work-orders/${thirdId}/block`, { method: 'POST', origin: null, head: null, token: orcaToken, leaseToken: thirdLease, body: { blocker_code: 'FABLE_ADAPTER_UNAVAILABLE', next_action: 'RESUME_WHEN_VERIFIER_AVAILABLE' } })
    assert.equal(valid.response.status, 200)
    assert.equal(valid.payload.work_order.status, 'BLOCKED')
    assert.equal(valid.payload.work_order.blocker_code, 'FABLE_ADAPTER_UNAVAILABLE')
  })
})

test('JWT expiration must be a valid future integer', async (t) => {
  const f = await fixture()
  t.after(f.close)

  // Non-finite values (NaN, Infinity) serialize to null in JSON and are
  // covered by the null case below.
  function mint(payload, key = SESSION_KEY) {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
    const body = Buffer.from(JSON.stringify({ sub: 'test', role: 'owner', scopes: ['work-orders:submit', 'work-orders:read', 'work-orders:retry'], ...payload, iss: f.config.issuer, aud: 'motesart-os-staging-preview', iat: Math.floor(Date.now() / 1000) })).toString('base64url')
    const signature = createHmac('sha256', key).update(`${header}.${body}`).digest('base64url')
    return `${header}.${body}.${signature}`
  }
  const list = (token) => call(f.baseUrl, '/v1/work-orders', { token })
  const now = Math.floor(Date.now() / 1000)

  await t.test('valid future integer exp is accepted', async () => {
    const accepted = await list(mint({ exp: now + 600 }))
    assert.equal(accepted.response.status, 200)
  })

  await t.test('expired integer exp is rejected as expired', async () => {
    const expired = await list(mint({ exp: now - 10 }))
    assert.equal(expired.response.status, 401)
    assert.equal(expired.payload.error.code, 'SESSION_EXPIRED')
  })

  for (const [label, exp] of [
    ['string exp', String(now + 600)],
    ['fractional exp', now + 600.5],
    ['null exp', null],
    ['boolean exp', true],
  ]) {
    await t.test(`${label} is rejected without bypassing expiration`, async () => {
      const rejected = await list(mint({ exp }))
      assert.equal(rejected.response.status, 401)
      assert.equal(rejected.payload.error.code, 'AUTHENTICATION_INVALID')
    })
  }

  await t.test('missing exp is rejected', async () => {
    const rejected = await list(mint({}))
    assert.equal(rejected.response.status, 401)
    assert.equal(rejected.payload.error.code, 'AUTHENTICATION_INVALID')
  })

  await t.test('invalid signature is still rejected', async () => {
    const rejected = await list(mint({ exp: now + 600 }, 'SYNTHETIC_WRONG_SIGNING_KEY'))
    assert.equal(rejected.response.status, 401)
    assert.equal(rejected.payload.error.code, 'AUTHENTICATION_INVALID')
  })

  await t.test('current valid owner and ORCA token handling is unchanged', async () => {
    const ownerToken = await login(f.baseUrl)
    assert.equal((await list(ownerToken)).response.status, 200)
    const orca = await orcaLogin(f.baseUrl)
    assert.equal(orca.response.status, 200)
    await createOrder(f.baseUrl, ownerToken, 'jwt-regression')
    const claim = await call(f.baseUrl, '/v1/executors/orca/claim', { method: 'POST', origin: null, head: null, token: orca.payload.token, body: { capabilities: [], lease_ttl_seconds: 60 } })
    assert.equal(claim.response.status, 200)
    assert.notEqual(claim.payload.claim, null)
  })
})
