import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { LocalArtifactStore } from '../../operator-bridge/artifact-store.mjs'
import {
  OrcaTransportBridge,
  OrcaTransportBridgeError,
  resolveDeliveryDecision,
} from '../../operator-bridge/orca-transport-bridge.mjs'
import { FileWorkOrderLedger } from '../../operator-bridge/work-order-ledger.mjs'

// Typed mock transport: records every action, answers with canned control-
// plane shapes, and supports scripted claim queues and heartbeat failure.
function mockTransport({ claims = [], failHeartbeat = false } = {}) {
  const calls = []
  let artifactCounter = 0
  return {
    calls,
    async execute({ action, payload = {} }) {
      calls.push({ action, payload })
      if (action === 'claim') return claims.length ? { claim: claims.shift() } : { claim: null }
      if (action === 'heartbeat') {
        if (failHeartbeat) throw Object.assign(new Error('LEASE_EXPIRED'), { code: 'LEASE_EXPIRED' })
        return { ok: true }
      }
      if (action === 'upload_artifact') {
        artifactCounter += 1
        return { artifact: { artifact_id: `remote-artifact-${artifactCounter}`, artifact_type: payload.artifact_type } }
      }
      if (action === 'complete') return { ok: true, status: 'VERIFYING' }
      if (action === 'block') return { ok: true, status: 'BLOCKED' }
      if (action === 'release') return { ok: true, status: 'QUEUED' }
      throw new Error(`UNEXPECTED_ACTION_${action}`)
    },
  }
}

function remoteClaim(workOrderId, overrides = {}) {
  return {
    lease_token: `lease-${workOrderId}`,
    work_order: {
      work_order_id: workOrderId,
      requested_by: 'mya',
      originating_surface: 'motesart-os-netlify-preview',
      task_type: 'github_pr_read_only_review',
      scope: { repository: 'Motesart27/Motesart-OS', pull_request: 27 },
      approval_class: 'READ_ONLY',
      executor: 'ORCA',
      ...overrides,
    },
  }
}

async function fixture({ transport } = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'orca-transport-bridge-'))
  const artifactStore = await new LocalArtifactStore({ root: path.join(root, 'artifacts') }).init()
  const ledger = await new FileWorkOrderLedger({ root: path.join(root, 'control-plane') }).init()
  const bridge = new OrcaTransportBridge({
    transport: transport ?? mockTransport(),
    ledger,
    artifactStore,
    heartbeatMs: 10,
  })
  return {
    root,
    artifactStore,
    ledger,
    bridge,
    async putLocalArtifact(workOrderId, artifactType, content) {
      return artifactStore.putArtifact({
        workOrderId,
        artifactType,
        content,
        producingExecutor: 'orca-transport-bridge-test',
        attempt: 1,
        sensitivity: 'public',
      })
    },
    async cleanup() {
      await bridge.close()
      await rm(root, { recursive: true, force: true })
    },
  }
}

test('resolveDeliveryDecision fails closed on every unresolved shape', () => {
  assert.equal(resolveDeliveryDecision(null).settle, 'block')
  assert.equal(resolveDeliveryDecision(undefined).settle, 'block')
  assert.equal(resolveDeliveryDecision({}).settle, 'block')
  assert.equal(resolveDeliveryDecision({ resolved: false, status: 'PASS' }).settle, 'block')
  assert.equal(resolveDeliveryDecision({ resolved: true, status: 'FAIL' }).settle, 'block')
  assert.equal(resolveDeliveryDecision({ resolved: true, status: 'PENDING' }).settle, 'block')
  assert.equal(
    resolveDeliveryDecision({ resolved: true, status: 'PASS', blocking_findings: [{ code: 'X' }] }).settle,
    'block',
  )
  const pass = resolveDeliveryDecision({ resolved: true, status: 'PASS', blocking_findings: [] })
  assert.equal(pass.settle, 'complete')
})

test('constructor rejects non-staging environments and malformed transports', async () => {
  const { ledger, artifactStore, cleanup } = await fixture()
  try {
    assert.throws(
      () => new OrcaTransportBridge({ transport: mockTransport(), ledger, artifactStore, environment: 'production' }),
      (error) => error instanceof OrcaTransportBridgeError && error.code === 'BRIDGE_ENVIRONMENT_REJECTED',
    )
    assert.throws(
      () => new OrcaTransportBridge({ transport: {}, ledger, artifactStore }),
      (error) => error.code === 'BRIDGE_CONFIG_INVALID',
    )
  } finally {
    await cleanup()
  }
})

test('intakeOne mirrors a remote claim into the local ledger as QUEUED', async () => {
  const transport = mockTransport({ claims: [remoteClaim('wo-transport-1')] })
  const { bridge, ledger, cleanup } = await fixture({ transport })
  try {
    const intake = await bridge.intakeOne()
    assert.equal(intake.order.work_order_id, 'wo-transport-1')
    assert.equal(intake.order.status, 'QUEUED')
    assert.equal(intake.leaseToken, 'lease-wo-transport-1')
    const mirrored = await ledger.get('wo-transport-1')
    assert.equal(mirrored.task_type, 'github_pr_read_only_review')
    assert.equal(mirrored.approval_class, 'READ_ONLY')
    assert.equal(mirrored.executor, 'ORCA')
    assert.equal(mirrored.idempotency_key, 'orca-transport:wo-transport-1')
  } finally {
    await cleanup()
  }
})

test('intakeOne returns null on an empty queue and never touches the ledger', async () => {
  const transport = mockTransport({ claims: [] })
  const { bridge, ledger, cleanup } = await fixture({ transport })
  try {
    assert.equal(await bridge.intakeOne(), null)
    assert.deepEqual(await ledger.list(), [])
  } finally {
    await cleanup()
  }
})

test('a re-claimed remote order deduplicates instead of duplicating', async () => {
  const transport = mockTransport({ claims: [remoteClaim('wo-dedup'), remoteClaim('wo-dedup')] })
  const { bridge, ledger, cleanup } = await fixture({ transport })
  try {
    await bridge.intakeOne()
    await bridge.intakeOne()
    const orders = await ledger.list()
    assert.equal(orders.length, 1)
    assert.equal(orders[0].work_order_id, 'wo-dedup')
  } finally {
    await cleanup()
  }
})

test('heartbeats flow while the lease is held and stop after settlement', async () => {
  const transport = mockTransport({ claims: [remoteClaim('wo-heartbeat')] })
  const { bridge, putLocalArtifact, cleanup } = await fixture({ transport })
  try {
    await bridge.intakeOne()
    await new Promise((resolve) => setTimeout(resolve, 60))
    const beats = transport.calls.filter((call) => call.action === 'heartbeat').length
    assert.ok(beats >= 2, `expected at least 2 heartbeats, saw ${beats}`)
    const result = await putLocalArtifact('wo-heartbeat', 'model_response', 'real result')
    const evidence = await putLocalArtifact('wo-heartbeat', 'evidence_report', '{"events":[]}')
    const card = await putLocalArtifact('wo-heartbeat', 'decision_card', '{"card":true}')
    await bridge.deliver({
      workOrderId: 'wo-heartbeat',
      resultArtifact: result,
      evidenceArtifact: evidence,
      decisionCardArtifact: card,
      review: { resolved: true, status: 'PASS', blocking_findings: [] },
    })
    const afterSettle = transport.calls.filter((call) => call.action === 'heartbeat').length
    await new Promise((resolve) => setTimeout(resolve, 40))
    assert.equal(transport.calls.filter((call) => call.action === 'heartbeat').length, afterSettle)
  } finally {
    await cleanup()
  }
})

test('deliver uploads real artifact bytes and completes only a resolved PASS', async () => {
  const transport = mockTransport({ claims: [remoteClaim('wo-complete')] })
  const { bridge, putLocalArtifact, cleanup } = await fixture({ transport })
  try {
    await bridge.intakeOne()
    const result = await putLocalArtifact('wo-complete', 'model_response', 'bounded review output')
    const evidence = await putLocalArtifact('wo-complete', 'evidence_report', '{"transport":{"github_writes":0}}')
    const card = await putLocalArtifact('wo-complete', 'decision_card', '{"banner":"SUPERVISED STAGING"}')
    const outcome = await bridge.deliver({
      workOrderId: 'wo-complete',
      resultArtifact: result,
      evidenceArtifact: evidence,
      decisionCardArtifact: card,
      review: { resolved: true, status: 'PASS', blocking_findings: [] },
    })
    assert.equal(outcome.settlement, 'complete')
    const uploads = transport.calls.filter((call) => call.action === 'upload_artifact')
    assert.equal(uploads.length, 3)
    assert.equal(String(uploads[0].payload.content), 'bounded review output')
    const complete = transport.calls.find((call) => call.action === 'complete')
    assert.equal(complete.payload.result_artifact_id, outcome.remote_artifacts.result_artifact_id)
    assert.equal(transport.calls.filter((call) => call.action === 'block').length, 0)
  } finally {
    await cleanup()
  }
})

test('deliver settles an unresolved review as block — never complete', async () => {
  const transport = mockTransport({ claims: [remoteClaim('wo-blocked')] })
  const { bridge, putLocalArtifact, cleanup } = await fixture({ transport })
  try {
    await bridge.intakeOne()
    const result = await putLocalArtifact('wo-blocked', 'model_response', 'result')
    const evidence = await putLocalArtifact('wo-blocked', 'evidence_report', '{}')
    const card = await putLocalArtifact('wo-blocked', 'decision_card', '{}')
    const outcome = await bridge.deliver({
      workOrderId: 'wo-blocked',
      resultArtifact: result,
      evidenceArtifact: evidence,
      decisionCardArtifact: card,
      review: { resolved: false, blocker_code: 'FABLE_REVIEW_PENDING', next_action: 'INVOKE_INDEPENDENT_VERIFIER' },
    })
    assert.equal(outcome.settlement, 'block')
    assert.equal(outcome.blocker_code, 'FABLE_REVIEW_PENDING')
    const block = transport.calls.find((call) => call.action === 'block')
    assert.equal(block.payload.blocker_code, 'FABLE_REVIEW_PENDING')
    assert.equal(transport.calls.filter((call) => call.action === 'complete').length, 0)
    // Artifacts still travel even for a blocked settlement: the human reviews
    // real evidence, not an empty order.
    assert.equal(transport.calls.filter((call) => call.action === 'upload_artifact').length, 3)
  } finally {
    await cleanup()
  }
})

test('a lost remote lease makes delivery refuse to settle', async () => {
  const transport = mockTransport({ claims: [remoteClaim('wo-lost')], failHeartbeat: true })
  const { bridge, putLocalArtifact, cleanup } = await fixture({ transport })
  try {
    await bridge.intakeOne()
    await new Promise((resolve) => setTimeout(resolve, 40))
    const result = await putLocalArtifact('wo-lost', 'model_response', 'result')
    await assert.rejects(
      bridge.deliver({
        workOrderId: 'wo-lost',
        resultArtifact: result,
        evidenceArtifact: result,
        decisionCardArtifact: result,
        review: { resolved: true, status: 'PASS', blocking_findings: [] },
      }),
      (error) => error.code === 'TRANSPORT_LEASE_LOST',
    )
    assert.equal(transport.calls.filter((call) => call.action === 'complete').length, 0)
  } finally {
    await cleanup()
  }
})

test('releaseRemote returns an aborted order to the control plane', async () => {
  const transport = mockTransport({ claims: [remoteClaim('wo-release')] })
  const { bridge, cleanup } = await fixture({ transport })
  try {
    await bridge.intakeOne()
    const released = await bridge.releaseRemote('wo-release')
    assert.equal(released.released, true)
    const release = transport.calls.find((call) => call.action === 'release')
    assert.equal(release.payload.work_order_id, 'wo-release')
    assert.equal(release.payload.lease_token, 'lease-wo-release')
    assert.deepEqual(await bridge.releaseRemote('wo-release'), { released: false, reason: 'NO_LEASE_HELD' })
  } finally {
    await cleanup()
  }
})

test('close releases every outstanding lease exactly once', async () => {
  const transport = mockTransport({ claims: [remoteClaim('wo-a'), remoteClaim('wo-b')] })
  const { bridge, cleanup } = await fixture({ transport })
  try {
    await bridge.intakeOne()
    await bridge.intakeOne()
    const closed = await bridge.close()
    assert.equal(closed.length, 2)
    assert.equal(transport.calls.filter((call) => call.action === 'release').length, 2)
    assert.deepEqual(await bridge.close(), [])
  } finally {
    await cleanup()
  }
})
