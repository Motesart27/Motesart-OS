import { randomUUID } from 'node:crypto'
import { appendFile, mkdir, open, readFile, rename, unlink } from 'node:fs/promises'
import path from 'node:path'

export class WorkerLockError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'WorkerLockError'
    this.code = code
  }
}

// Cross-process one-worker lock. Acquisition atomically creates the lock file
// (O_EXCL via 'wx'), records the owning pid, and fails closed with
// WORKER_LOCK_HELD when another worker holds it. A lock is recovered only
// when its recorded holder pid is verifiably dead (ESRCH); a live holder, a
// foreign-permission holder (EPERM), or malformed metadata always fails
// closed. Recovery renames the stale lock to a unique tombstone atomically so
// exactly one concurrent recoverer wins, re-validates the renamed metadata to
// avoid tombstoning a live fresh lock, and appends every decision to a
// structured recovery log that never contains secrets.
export class WorkerLock {
  constructor({
    lockPath,
    workerId,
    clock = () => Date.now(),
    waitMs = 0,
    pollMs = 50,
    pid = process.pid,
  }) {
    if (!lockPath) throw new WorkerLockError('WORKER_LOCK_PATH_REQUIRED', 'A lock path is required')
    this.lockPath = lockPath
    this.workerId = workerId ?? 'bounded-worker'
    this.clock = clock
    this.waitMs = waitMs
    this.pollMs = pollMs
    this.pid = pid
    this.recoveryLogPath = `${lockPath}.recovery.jsonl`
    this._handle = null
    this._acquiredAt = null
  }

  get held() {
    return this._handle !== null
  }

  get acquiredAt() {
    return this._acquiredAt
  }

  async acquire() {
    await mkdir(path.dirname(this.lockPath), { recursive: true, mode: 0o700 })
    const deadline = Date.now() + this.waitMs
    for (;;) {
      try {
        const handle = await open(this.lockPath, 'wx', 0o600)
        await handle.writeFile(JSON.stringify({
          schema_version: 'motesart.operator_bridge.worker_lock.v1',
          pid: this.pid,
          worker_id: this.workerId,
          created_at: new Date(this.clock()).toISOString(),
        }))
        this._handle = handle
        this._acquiredAt = new Date(this.clock()).toISOString()
        return this
      } catch (error) {
        if (error.code !== 'EEXIST') throw error
        const recovered = await this._recoverStaleLock()
        if (!recovered) {
          if (Date.now() >= deadline) {
            throw new WorkerLockError('WORKER_LOCK_HELD', 'Another worker holds the one-worker lock')
          }
          await new Promise((resolve) => setTimeout(resolve, this.pollMs))
        }
      }
    }
  }

  async _recoverStaleLock() {
    let metadata
    try {
      metadata = JSON.parse(await readFile(this.lockPath, 'utf8'))
    } catch (error) {
      if (error.code === 'ENOENT') return true // holder released between attempts; retry acquire
      await this._recordRecovery({ outcome: 'malformed_lock_metadata' })
      return false
    }
    const pid = metadata?.pid
    if (!Number.isInteger(pid) || pid <= 0) {
      await this._recordRecovery({ outcome: 'malformed_lock_metadata' })
      return false
    }
    let holderAlive = true
    try {
      process.kill(pid, 0)
    } catch (error) {
      holderAlive = error.code === 'EPERM' // ESRCH means demonstrably dead; EPERM means alive but foreign
    }
    if (holderAlive) return false
    const tombstone = `${this.lockPath}.stale-${this.pid}-${randomUUID()}`
    try {
      await rename(this.lockPath, tombstone)
    } catch (error) {
      return error.code === 'ENOENT' // another recoverer won the race; retry acquire
    }
    // Re-validate the file actually renamed: between the staleness check and
    // the rename a fresh holder may have acquired the lock. Never tombstone a
    // live lock — restore it and fail closed.
    if (!(await this._revalidateTombstone(tombstone, pid))) {
      await rename(tombstone, this.lockPath).catch(() => undefined)
      return false
    }
    await unlink(tombstone).catch(() => undefined)
    await this._recordRecovery({
      outcome: 'recovered_stale_lock',
      stale_pid: pid,
      stale_created_at: typeof metadata.created_at === 'string' ? metadata.created_at : null,
    })
    return true
  }

  async _revalidateTombstone(tombstone, expectedPid) {
    try {
      const renamed = JSON.parse(await readFile(tombstone, 'utf8'))
      return renamed?.pid === expectedPid
    } catch {
      return false
    }
  }

  async _recordRecovery(entry) {
    const line = JSON.stringify({
      schema_version: 'motesart.operator_bridge.worker_lock_recovery.v1',
      recorded_at: new Date(this.clock()).toISOString(),
      worker_id: this.workerId,
      ...entry,
    })
    await appendFile(this.recoveryLogPath, `${line}\n`, { mode: 0o600 }).catch(() => undefined)
  }

  // Releases only a lock this process still owns. The metadata pid is checked
  // before unlinking so a recovered/foreign lock is never removed.
  async release() {
    const handle = this._handle
    this._handle = null
    if (!handle) return false
    await handle.close().catch(() => undefined)
    try {
      const metadata = JSON.parse(await readFile(this.lockPath, 'utf8'))
      if (metadata?.pid === this.pid) await unlink(this.lockPath)
    } catch { /* already gone */ }
    this._acquiredAt = null
    return true
  }
}
