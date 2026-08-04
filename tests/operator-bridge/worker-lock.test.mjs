import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { WorkerLock, WorkerLockError } from '../../operator-bridge/worker-lock.mjs'

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'operator-bridge-worker-lock-'))
  return { root, lockPath: path.join(root, 'bounded-worker.lock') }
}

// Spawns a short-lived process and resolves its pid once the process is
// verifiably dead (ESRCH), giving tests a genuinely-dead pid to work with.
async function deadPid() {
  const child = spawn(process.execPath, ['-e', 'setTimeout(() => process.exit(0), 5)'])
  await new Promise((resolve) => child.on('close', resolve))
  for (;;) {
    try {
      process.kill(child.pid, 0)
      await new Promise((resolve) => setTimeout(resolve, 10))
    } catch (error) {
      if (error.code === 'ESRCH') return child.pid
      throw error
    }
  }
}

test('duplicate worker startup is refused across lock instances', async () => {
  const { lockPath } = await fixture()
  const first = await new WorkerLock({ lockPath, workerId: 'orca-a' }).acquire()
  await assert.rejects(
    new WorkerLock({ lockPath, workerId: 'orca-b' }).acquire(),
    (error) => error instanceof WorkerLockError && error.code === 'WORKER_LOCK_HELD',
  )
  assert.equal(first.held, true)
  const metadata = JSON.parse(await readFile(lockPath, 'utf8'))
  assert.equal(metadata.pid, process.pid)
  assert.equal(metadata.worker_id, 'orca-a')
  await first.release()
})

test('release frees the lock and a released lock can be reacquired', async () => {
  const { lockPath } = await fixture()
  const first = await new WorkerLock({ lockPath, workerId: 'orca-a' }).acquire()
  assert.equal(await first.release(), true)
  assert.equal(first.held, false)
  const second = await new WorkerLock({ lockPath, workerId: 'orca-b' }).acquire()
  assert.equal(second.held, true)
  await second.release()
})

test('stale lock is recovered only after the owning pid is confirmed dead', async () => {
  const { lockPath } = await fixture()
  const stale = await deadPid()
  await writeFile(lockPath, JSON.stringify({ pid: stale, created_at: new Date(Date.now() - 60_000).toISOString() }), { mode: 0o600 })
  const lock = await new WorkerLock({ lockPath, workerId: 'orca-b' }).acquire()
  assert.equal(lock.held, true)
  const metadata = JSON.parse(await readFile(lockPath, 'utf8'))
  assert.equal(metadata.pid, process.pid)
  const recoveryLog = JSON.parse((await readFile(`${lockPath}.recovery.jsonl`, 'utf8')).trim())
  assert.equal(recoveryLog.outcome, 'recovered_stale_lock')
  assert.equal(recoveryLog.stale_pid, stale)
  await lock.release()
})

test('a live holder is never recovered and acquisition fails closed', async () => {
  const { lockPath } = await fixture()
  await writeFile(lockPath, JSON.stringify({ pid: process.pid, created_at: new Date().toISOString() }), { mode: 0o600 })
  await assert.rejects(
    new WorkerLock({ lockPath, workerId: 'orca-b' }).acquire(),
    (error) => error.code === 'WORKER_LOCK_HELD',
  )
  // The live lock content is untouched.
  const metadata = JSON.parse(await readFile(lockPath, 'utf8'))
  assert.equal(metadata.pid, process.pid)
})

test('malformed lock metadata fails closed and is logged', async () => {
  const { lockPath } = await fixture()
  await writeFile(lockPath, 'not-json-at-all', { mode: 0o600 })
  await assert.rejects(
    new WorkerLock({ lockPath, workerId: 'orca-b' }).acquire(),
    (error) => error.code === 'WORKER_LOCK_HELD',
  )
  const recoveryLog = JSON.parse((await readFile(`${lockPath}.recovery.jsonl`, 'utf8')).trim())
  assert.equal(recoveryLog.outcome, 'malformed_lock_metadata')
  await writeFile(lockPath, JSON.stringify({ pid: 'not-a-pid' }), { mode: 0o600 })
  await assert.rejects(
    new WorkerLock({ lockPath, workerId: 'orca-c' }).acquire(),
    (error) => error.code === 'WORKER_LOCK_HELD',
  )
})

test('exactly one of two concurrent acquirers wins the lock', async () => {
  const { lockPath } = await fixture()
  const results = await Promise.allSettled([
    new WorkerLock({ lockPath, workerId: 'orca-a' }).acquire(),
    new WorkerLock({ lockPath, workerId: 'orca-b' }).acquire(),
  ])
  const winners = results.filter((result) => result.status === 'fulfilled')
  const losers = results.filter((result) => result.status === 'rejected')
  assert.equal(winners.length, 1)
  assert.equal(losers.length, 1)
  assert.equal(losers[0].reason.code, 'WORKER_LOCK_HELD')
  await winners[0].value.release()
})

test('exactly one of two concurrent recoverers wins a dead-pid lock', async () => {
  const { lockPath } = await fixture()
  const stale = await deadPid()
  await writeFile(lockPath, JSON.stringify({ pid: stale, created_at: new Date(Date.now() - 60_000).toISOString() }), { mode: 0o600 })
  const results = await Promise.allSettled([
    new WorkerLock({ lockPath, workerId: 'orca-a' }).acquire(),
    new WorkerLock({ lockPath, workerId: 'orca-b' }).acquire(),
  ])
  const winners = results.filter((result) => result.status === 'fulfilled')
  assert.equal(winners.length, 1)
  const metadata = JSON.parse(await readFile(lockPath, 'utf8'))
  assert.equal(metadata.pid, process.pid)
  await winners[0].value.release()
})

test('cross-process duplicate startup is refused and stale recovery works after SIGKILL', async () => {
  const { root, lockPath } = await fixture()
  const holderScript = path.join(root, 'lock-holder.mjs')
  const modulePath = fileURLToPath(new URL('../../operator-bridge/worker-lock.mjs', import.meta.url))
  await writeFile(holderScript, `
import { WorkerLock } from ${JSON.stringify(modulePath)}
await new WorkerLock({ lockPath: ${JSON.stringify(lockPath)}, workerId: 'child-worker' }).acquire()
process.stdout.write('LOCKED\\n')
setTimeout(() => {}, 30_000)
`)
  const child = spawn(process.execPath, [holderScript], { stdio: ['ignore', 'pipe', 'pipe'] })
  await new Promise((resolve, reject) => {
    child.stdout.once('data', resolve)
    setTimeout(() => reject(new Error('child did not acquire lock')), 10_000)
  })
  // A second process (this one) cannot acquire while the child lives.
  await assert.rejects(
    new WorkerLock({ lockPath, workerId: 'parent-worker' }).acquire(),
    (error) => error.code === 'WORKER_LOCK_HELD',
  )
  // SIGKILL leaves the lock file behind: no cleanup ran in the child.
  child.kill('SIGKILL')
  await new Promise((resolve) => child.on('close', resolve))
  // The orphaned lock is recovered because the owning pid is confirmed dead.
  const recovered = await new WorkerLock({ lockPath, workerId: 'parent-worker' }).acquire()
  assert.equal(recovered.held, true)
  const recoveryLog = (await readFile(`${lockPath}.recovery.jsonl`, 'utf8')).trim().split('\n').map(JSON.parse)
  assert.equal(recoveryLog.at(-1).outcome, 'recovered_stale_lock')
  assert.equal(recoveryLog.at(-1).stale_pid, child.pid)
  await recovered.release()
})
