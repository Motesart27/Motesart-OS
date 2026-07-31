import assert from 'node:assert/strict'
import { mkdtemp } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { ApprovalPolicy } from '../../operator-bridge/approval-policy.mjs'
import { LocalArtifactStore } from '../../operator-bridge/artifact-store.mjs'
import { APPROVAL_CLASSES } from '../../operator-bridge/constants.mjs'
import { createDecisionCard } from '../../operator-bridge/decision-card.mjs'
import { FableAdapter } from '../../operator-bridge/fable-adapter.mjs'
import { OrcaEdgeWorker } from '../../operator-bridge/orca-edge-worker.mjs'

test('approval policy allows supervised read-only work and disables protected writes', () => {
  const policy = new ApprovalPolicy()
  assert.equal(policy.evaluate({ approvalClass: APPROVAL_CLASSES.READ_ONLY }).allowed, true)
  assert.deepEqual(
    policy.evaluate({ approvalClass: APPROVAL_CLASSES.PROTECTED_WRITE, executor: 'codex', approver: 'denarius' }),
    { allowed: false, requires_human: true, code: 'PHASE_1_PROTECTED_WRITE_DISABLED' },
  )
})

test('executor self-approval is rejected', () => {
  const policy = new ApprovalPolicy()
  assert.throws(
    () => policy.evaluate({ approvalClass: APPROVAL_CLASSES.PROTECTED_WRITE, executor: 'codex', approver: 'codex' }),
    (error) => error.code === 'SELF_APPROVAL_REJECTED',
  )
})

test('Fable adapter returns an honest resumable machine-readable block', async () => {
  const result = await new FableAdapter().review({ work_order_id: 'wo-1' })
  assert.equal(result.blocker_code, 'BLOCKED_ADAPTER_UNAVAILABLE')
  assert.equal(result.resumable, true)
})

test('ORCA worker rejects unsupported and arbitrary shell actions', async () => {
  const worker = new OrcaEdgeWorker({ workerId: 'orca-test' })
  await assert.rejects(worker.execute({ action: 'execute_shell', payload: {} }), /UNSUPPORTED_EXECUTOR_ACTION/)
  await assert.rejects(
    worker.execute({ action: 'health', payload: { command: 'rm -rf anything' } }),
    /ARBITRARY_COMMAND_REJECTED/,
  )
  const health = await worker.execute({ action: 'health', payload: {} })
  assert.equal(health.connection_model, 'OUTBOUND_ONLY')
})

test('package action verifies artifacts before emitting a valid immutable ZIP', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'operator-bridge-package-'))
  const store = await new LocalArtifactStore({ root }).init()
  const source = await store.putArtifact({
    workOrderId: 'wo-1', artifactType: 'diff', content: 'diff', producingExecutor: 'test', attempt: 1,
  })
  const worker = new OrcaEdgeWorker({ workerId: 'orca-test', artifactStore: store })
  const result = await worker.execute({
    action: 'package_artifacts',
    payload: { work_order_id: 'wo-1', artifacts: [source], attempt: 1 },
  })
  assert.equal(result.artifact_type, 'zip_package')
  assert.match(result.sha256, /^[a-f0-9]{64}$/)
  const packaged = await store.readArtifact(result)
  assert.equal(packaged.subarray(0, 4).toString('hex'), '504b0304')
  assert.equal(packaged.subarray(-22, -18).toString('hex'), '504b0506')
})

test('decision card exposes artifacts and blocked verifier without executable approvals', () => {
  const card = createDecisionCard({
    workOrder: {
      work_order_id: 'wo-1', status: 'BLOCKED', executor: 'ORCA', lease_owner: null, lease_expires_at: null,
      blocker_code: 'BLOCKED_ADAPTER_UNAVAILABLE', next_action: 'WAIT_FOR_FABLE', approval_class: 'READ_ONLY',
    },
    originatingInstruction: 'Read-only review',
    artifacts: [{ artifact_id: 'art-1', artifact_type: 'diff', immutable_relative_uri: 'objects/x', sha256: 'a'.repeat(64) }],
    kimiResult: { status: 'COMPLETED' },
    codexResult: { status: 'COMPLETED' },
    fableResult: { status: 'BLOCKED', blocker_code: 'BLOCKED_ADAPTER_UNAVAILABLE' },
  })
  assert.equal(card.controls.approve.enabled, false)
  assert.equal(card.fable_result.blocker_code, 'BLOCKED_ADAPTER_UNAVAILABLE')
  assert.equal(card.artifacts[0].artifact_id, 'art-1')
})
