import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { mkdtemp } from 'node:fs/promises'
import test from 'node:test'

import { StagingStore, StagingStoreError } from '../../staging-control-plane/store.mjs'

// ---------------------------------------------------------------------------
// Shared helpers for post-merge hardening Phase 1 (items A-H)
// ---------------------------------------------------------------------------

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
