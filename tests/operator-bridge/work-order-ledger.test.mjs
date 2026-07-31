import assert from 'node:assert/strict'
import { mkdtemp } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { APPROVAL_CLASSES } from '../../operator-bridge/constants.mjs'
import { FileWorkOrderLedger } from '../../operator-bridge/work-order-ledger.mjs'

async function fixture(clock = () => Date.now()) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'operator-bridge-ledger-'))
  return new FileWorkOrderLedger({ root, clock }).init()
}

function input(overrides = {}) {
  return {
    work_order_id: 'wo-test-1',
    requested_by: 'operator:test',
    originating_surface: 'test',
    task_type: 'github_pr_read_only_review',
    scope: { repository: 'Motesart27/example', pull_request: 1, read_only: true },
    approval_class: APPROVAL_CLASSES.READ_ONLY,
    executor: 'ORCA',
    required_artifacts: ['pull_request_identity', 'diff'],
    input_hashes: [],
    idempotency_key: 'test:pr:1:head',
    ...overrides,
  }
}

test('valid transitions proceed and invalid transitions are rejected', async () => {
  const ledger = await fixture()
  await ledger.create(input())
  await ledger.transition('wo-test-1', 'QUEUED', { actor: 'operator:test' })
  const claimed = await ledger.claim('wo-test-1', { leaseOwner: 'orca-1' })
  const running = await ledger.transition('wo-test-1', 'RUNNING', {
    actor: 'orca-1',
    leaseToken: claimed.lease_token,
  })
  assert.equal(running.status, 'RUNNING')
  await assert.rejects(
    ledger.transition('wo-test-1', 'COMPLETED', { actor: 'orca-1', leaseToken: claimed.lease_token }),
    (error) => error.code === 'INVALID_TRANSITION',
  )
})

test('duplicate submission returns the original work order', async () => {
  const ledger = await fixture()
  const first = await ledger.create(input())
  const duplicate = await ledger.create(input({ work_order_id: 'wo-test-2' }))
  assert.equal(duplicate.work_order_id, first.work_order_id)
  assert.equal((await ledger.events(first.work_order_id)).length, 1)
})

test('one active lease wins contention and heartbeat requires the fencing token', async () => {
  const ledger = await fixture()
  await ledger.create(input({ status: 'QUEUED' }))
  const results = await Promise.allSettled([
    ledger.claim('wo-test-1', { leaseOwner: 'orca-a' }),
    ledger.claim('wo-test-1', { leaseOwner: 'orca-b' }),
  ])
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1)
  const claimed = results.find((result) => result.status === 'fulfilled').value
  await assert.rejects(
    ledger.heartbeat('wo-test-1', { leaseOwner: claimed.lease_owner, leaseToken: 'wrong' }),
    (error) => error.code === 'LEASE_MISMATCH',
  )
  const heartbeat = await ledger.heartbeat('wo-test-1', {
    leaseOwner: claimed.lease_owner,
    leaseToken: claimed.lease_token,
  })
  assert.equal(heartbeat.lease_owner, claimed.lease_owner)
})

test('expired lease is reclaimed and increments attempt only on a fresh claim', async () => {
  let now = Date.parse('2026-07-25T00:00:00Z')
  const ledger = await fixture(() => now)
  await ledger.create(input({ status: 'QUEUED' }))
  await ledger.claim('wo-test-1', { leaseOwner: 'orca-a', leaseTtlMs: 1000 })
  now += 1001
  const [reclaimed] = await ledger.reclaimExpired()
  assert.equal(reclaimed.status, 'QUEUED')
  assert.equal(reclaimed.attempt_count, 1)
  const claimedAgain = await ledger.claim('wo-test-1', { leaseOwner: 'orca-b' })
  assert.equal(claimedAgain.attempt_count, 2)
})

test('offline ORCA creates a visible resumable block and reconnect requeues it', async () => {
  const ledger = await fixture()
  await ledger.create(input({ status: 'QUEUED' }))
  const blocked = await ledger.blockForOfflineExecutor('wo-test-1', { executor: 'ORCA' })
  assert.equal(blocked.status, 'BLOCKED')
  assert.equal(blocked.blocker_code, 'WAITING_FOR_ORCA')
  const queued = await ledger.resumeAfterExecutorReconnect('wo-test-1', { executor: 'ORCA' })
  assert.equal(queued.status, 'QUEUED')
  assert.equal(queued.blocker_code, null)
})

test('idempotent completion accepts equal hashes and rejects divergent replay', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'operator-bridge-ledger-'))
  const ledger = await new FileWorkOrderLedger({
    root,
    artifactVerifier: async () => [
      { artifact_type: 'pull_request_identity', sha256: 'a'.repeat(64), work_order_id: 'wo-test-1' },
      { artifact_type: 'diff', sha256: 'b'.repeat(64), work_order_id: 'wo-test-1' },
    ],
  }).init()
  await ledger.create(input({ status: 'QUEUED' }))
  const claimed = await ledger.claim('wo-test-1', { leaseOwner: 'orca-a' })
  await ledger.transition('wo-test-1', 'RUNNING', { actor: 'orca-a', leaseToken: claimed.lease_token })
  await ledger.transition('wo-test-1', 'VERIFYING', { actor: 'orca-a', leaseToken: claimed.lease_token })
  const completed = await ledger.completeIdempotently('wo-test-1', {
    actor: 'control-plane',
    leaseToken: claimed.lease_token,
    resultUri: 'objects/sha256/result',
    resultHash: 'a'.repeat(64),
    evidenceUri: 'objects/sha256/evidence',
    evidenceHash: 'b'.repeat(64),
  })
  const replay = await ledger.completeIdempotently('wo-test-1', {
    actor: 'control-plane',
    leaseToken: claimed.lease_token,
    resultUri: 'objects/sha256/result',
    resultHash: 'a'.repeat(64),
    evidenceUri: 'objects/sha256/evidence',
    evidenceHash: 'b'.repeat(64),
  })
  assert.equal(replay.updated_at, completed.updated_at)
  await assert.rejects(
    ledger.completeIdempotently('wo-test-1', {
      actor: 'control-plane',
      leaseToken: claimed.lease_token,
      resultUri: 'objects/sha256/result-2',
      resultHash: 'c'.repeat(64),
      evidenceUri: 'objects/sha256/evidence',
      evidenceHash: 'b'.repeat(64),
    }),
    (error) => error.code === 'COMPLETION_CONFLICT',
  )
})
