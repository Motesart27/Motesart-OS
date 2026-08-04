import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { LocalArtifactStore } from '../../operator-bridge/artifact-store.mjs'
import { BoundedWorkerSession, BoundedWorkerSessionError } from '../../operator-bridge/bounded-worker-session.mjs'
import { OrcaEdgeWorker } from '../../operator-bridge/orca-edge-worker.mjs'
import { ResourceRegistry } from '../../operator-bridge/resource-registry.mjs'
import { WorkerLock } from '../../operator-bridge/worker-lock.mjs'
import { FileWorkOrderLedger } from '../../operator-bridge/work-order-ledger.mjs'

const FAST = { sessionBudgetMs: 4_000, perOrderBudgetMs: 1_000, idleExitMs: 250, pollMs: 20, killGraceMs: 20 }

async function fixture({ orders = [], sessionOverrides = {} } = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'operator-bridge-bounded-'))
  const artifactStore = await new LocalArtifactStore({ root: path.join(root, 'artifacts') }).init()
  const ledger = await new FileWorkOrderLedger({ root: path.join(root, 'control-plane') }).init()
  const worker = new OrcaEdgeWorker({
    workerId: 'orca-bounded-test',
    ledger,
    githubCollector: {},
    kimiAdapter: {},
    artifactStore,
    environment: 'staging',
  })
  for (const [index, overrides] of orders.entries()) {
    await ledger.create({
      work_order_id: overrides.work_order_id ?? `wo-bounded-${index}`,
      requested_by: 'bounded-test',
      originating_surface: 'test',
      task_type: overrides.task_type ?? 'github_pr_read_only_review',
      scope: overrides.scope ?? { repository: 'Motesart27/example', pull_request: 1, read_only: true },
      approval_class: overrides.approval_class ?? 'READ_ONLY',
      executor: overrides.executor ?? 'ORCA',
      required_artifacts: [],
      input_hashes: [],
      idempotency_key: `bounded:test:${index}:${Math.random()}`,
      status: 'QUEUED',
    })
  }
  const session = new BoundedWorkerSession({
    worker,
    ledger,
    artifactStore,
    runRoot: root,
    installSignalHandlers: false,
    ...FAST,
    ...sessionOverrides,
  })
  return { root, artifactStore, ledger, worker, session }
}

function waitForSignal(signal, ms = 5_000) {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve()
    const timer = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => { clearTimeout(timer); resolve() }, { once: true })
  })
}

test('session constructor rejects non-staging environments and out-of-contract bounds', async () => {
  const { worker, ledger } = await fixture()
  assert.throws(
    () => new BoundedWorkerSession({ worker, ledger, runRoot: os.tmpdir(), environment: 'production' }),
    (error) => error instanceof BoundedWorkerSessionError && error.code === 'WORKER_ENVIRONMENT_REJECTED',
  )
  assert.throws(
    () => new BoundedWorkerSession({ worker, ledger, runRoot: os.tmpdir(), environment: 'development' }),
    (error) => error.code === 'WORKER_ENVIRONMENT_REJECTED',
  )
  assert.throws(
    () => new BoundedWorkerSession({ worker, ledger, runRoot: os.tmpdir(), maxOrdersPerSession: 4 }),
    (error) => error.code === 'BOUNDED_SESSION_CONFIG_INVALID',
  )
  assert.throws(
    () => new BoundedWorkerSession({ worker, ledger, runRoot: os.tmpdir(), sessionBudgetMs: 31 * 60_000 }),
    (error) => error.code === 'BOUNDED_SESSION_CONFIG_INVALID',
  )
  assert.throws(
    () => new BoundedWorkerSession({ worker, ledger, runRoot: os.tmpdir(), perOrderBudgetMs: 16 * 60_000 }),
    (error) => error.code === 'BOUNDED_SESSION_CONFIG_INVALID',
  )
  assert.throws(
    () => new BoundedWorkerSession({ worker, ledger, runRoot: os.tmpdir(), idleExitMs: 3 * 60_000 }),
    (error) => error.code === 'BOUNDED_SESSION_CONFIG_INVALID',
  )
  // Explicit staging passes, and so does the default (staging) environment.
  assert.ok(new BoundedWorkerSession({ worker, ledger, runRoot: os.tmpdir(), environment: 'staging' }))
  assert.ok(new BoundedWorkerSession({ worker, ledger, runRoot: os.tmpdir() }))
})

test('edge worker rejects non-staging environments', () => {
  assert.throws(() => new OrcaEdgeWorker({ workerId: 'x', environment: 'production' }), /WORKER_ENVIRONMENT_REJECTED/)
  assert.throws(() => new OrcaEdgeWorker({ workerId: 'x', environment: 'development' }), /WORKER_ENVIRONMENT_REJECTED/)
  assert.ok(new OrcaEdgeWorker({ workerId: 'x', environment: 'staging' }))
  assert.ok(new OrcaEdgeWorker({ workerId: 'x' })) // default staging
})

test('happy path: one order processed, evidence written, lock released, idle exit', async () => {
  const { root, ledger, session } = await fixture({ orders: [{}] })
  let sawToken = null
  const result = await session.run(async ({ order, leaseToken }) => {
    sawToken = leaseToken
    const claimed = await ledger.get(order.work_order_id)
    assert.equal(claimed.status, 'RUNNING')
    return { outcome: 'RESULT_RETURNED' }
  })
  assert.equal(result.exit_reason, 'IDLE_EXIT')
  assert.equal(result.orders_attempted, 1)
  assert.equal(result.evidence_written, true)
  assert.equal(result.lock_released, true)
  const rawText = await readFile(path.join(root, 'SESSION_EXIT_EVIDENCE.json'), 'utf8')
  const evidence = JSON.parse(rawText)
  assert.equal(evidence.exit_reason, 'IDLE_EXIT')
  assert.equal(evidence.orders_attempted, 1)
  assert.equal(evidence.orders_result_returned, 1)
  assert.equal(evidence.environment, 'staging')
  assert.equal(evidence.contract.no_automatic_retry, true)
  assert.equal(evidence.contract.daemon, false)
  assert.equal(evidence.contract.auto_start, false)
  assert.equal(evidence.contract.github_writes, 0)
  assert.equal(evidence.contract.production_access, false)
  assert.deepEqual(evidence.bounds, {
    max_orders_per_session: 3,
    session_budget_ms: FAST.sessionBudgetMs,
    per_order_budget_ms: FAST.perOrderBudgetMs,
    idle_exit_ms: FAST.idleExitMs,
  })
  assert.ok(result.evidence_artifact_id) // sealed into the content-addressed store
  assert.ok(sawToken)
  assert.equal(rawText.includes(sawToken), false) // lease token never persists
})

test('order cap: exactly maxOrdersPerSession orders are attempted', async () => {
  const { ledger, session } = await fixture({ orders: [{}, {}, {}, {}, {}], sessionOverrides: { maxOrdersPerSession: 2, idleExitMs: 60_000 } })
  const result = await session.run(async () => ({ outcome: 'RESULT_RETURNED' }))
  assert.equal(result.exit_reason, 'ORDER_CAP_REACHED')
  assert.equal(result.orders_attempted, 2)
  assert.equal(result.order_records.length, 2)
  const queued = await ledger.list({ statuses: ['QUEUED'] })
  assert.equal(queued.length, 3) // the remaining orders were never claimed
})

test('task-type allowlist and READ_ONLY-only execution skip orders without claiming them', async () => {
  const { ledger, session } = await fixture({
    orders: [
      { work_order_id: 'wo-bad-type', task_type: 'execute_arbitrary_shell' },
      { work_order_id: 'wo-bad-class', approval_class: 'PROTECTED_WRITE' },
    ],
  })
  const result = await session.run(async () => {
    throw new Error('must never run')
  })
  assert.equal(result.exit_reason, 'IDLE_EXIT')
  assert.equal(result.orders_attempted, 0)
  const reasons = Object.fromEntries(result.skipped_orders.map((entry) => [entry.work_order_id, entry.reason]))
  assert.equal(reasons['wo-bad-type'], 'TASK_TYPE_NOT_ALLOWLISTED')
  assert.equal(reasons['wo-bad-class'], 'APPROVAL_CLASS_NOT_EXECUTABLE')
  for (const id of ['wo-bad-type', 'wo-bad-class']) {
    const order = await ledger.get(id)
    assert.equal(order.status, 'QUEUED')
    assert.equal(order.attempt_count, 0)
    assert.equal(order.lease_token, null)
  }
})

test('per-order ceiling: a stuck order is aborted at the bound, blocked, never retried', async () => {
  const { ledger, session } = await fixture({ orders: [{}], sessionOverrides: { perOrderBudgetMs: 120 } })
  let abortSeen = false
  const started = Date.now()
  const result = await session.run(async ({ signal }) => {
    await waitForSignal(signal)
    abortSeen = true
    throw new Error('aborted mid-order')
  })
  const elapsed = Date.now() - started
  assert.equal(abortSeen, true)
  assert.ok(elapsed >= 120, `per-order abort fired too early: ${elapsed}ms`)
  assert.ok(elapsed < 3_000, `per-order abort took too long: ${elapsed}ms`)
  assert.equal(result.orders_attempted, 1)
  assert.equal(result.order_records[0].outcome, 'FAILED')
  assert.equal(result.order_records[0].blocker_code, 'ORDER_EXECUTION_TIMEOUT')
  const order = await ledger.get('wo-bounded-0')
  assert.equal(order.status, 'BLOCKED')
  assert.equal(order.blocker_code, 'ORDER_EXECUTION_TIMEOUT')
  assert.equal(order.next_action, 'HUMAN_REVIEW_REQUIRED_NO_AUTOMATIC_RETRY')
  assert.equal(order.lease_token, null)
  assert.equal(order.attempt_count, 1)
})

test('session clock aborts an in-flight order and exits; remaining orders stay queued', async () => {
  const { ledger, session } = await fixture({ orders: [{}, {}], sessionOverrides: { sessionBudgetMs: 200, perOrderBudgetMs: 3_000, idleExitMs: 60_000 } })
  const result = await session.run(async ({ signal }) => {
    await waitForSignal(signal)
    throw new Error('aborted by session clock')
  })
  assert.equal(result.exit_reason, 'SESSION_TIME_EXHAUSTED')
  assert.equal(result.orders_attempted, 1)
  const order = await ledger.get('wo-bounded-0')
  assert.equal(order.status, 'BLOCKED')
  assert.equal(order.blocker_code, 'SESSION_TIME_EXHAUSTED')
  const second = await ledger.get('wo-bounded-1')
  assert.equal(second.status, 'QUEUED')
  assert.equal(second.attempt_count, 0)
})

test('idle exit: an empty queue terminates the session at the idle bound', async () => {
  const { session } = await fixture({ orders: [], sessionOverrides: { idleExitMs: 150, pollMs: 25 } })
  const started = Date.now()
  const result = await session.run(async () => {
    throw new Error('must never run')
  })
  const elapsed = Date.now() - started
  assert.equal(result.exit_reason, 'IDLE_EXIT')
  assert.equal(result.orders_attempted, 0)
  assert.ok(elapsed >= 150, `idle exit fired too early: ${elapsed}ms`)
  assert.ok(elapsed < 2_000, `idle exit took too long: ${elapsed}ms`)
})

test('shutdown path: in-flight order is blocked resumable, evidence written, handlers removed', async () => {
  const baselineListeners = {
    sigterm: process.listenerCount('SIGTERM'),
    sigint: process.listenerCount('SIGINT'),
    uncaught: process.listenerCount('uncaughtException'),
    rejection: process.listenerCount('unhandledRejection'),
  }
  const { root, ledger, session } = await fixture({ orders: [{}], sessionOverrides: { installSignalHandlers: true, idleExitMs: 60_000 } })
  const result = await session.run(async ({ signal }) => {
    setTimeout(() => session.requestShutdown('SIGTERM'), 80)
    await waitForSignal(signal)
    throw new Error('aborted by signal')
  })
  assert.equal(result.exit_reason, 'SIGNAL_SHUTDOWN')
  assert.equal(result.exit_detail, 'SIGTERM')
  assert.equal(result.orders_attempted, 1)
  const order = await ledger.get('wo-bounded-0')
  assert.equal(order.status, 'BLOCKED')
  assert.equal(order.blocker_code, 'BLOCKED_WORKER_SHUTDOWN_RESUMABLE')
  const evidence = JSON.parse(await readFile(path.join(root, 'SESSION_EXIT_EVIDENCE.json'), 'utf8'))
  assert.equal(evidence.exit_reason, 'SIGNAL_SHUTDOWN')
  // Signal handlers installed by the session are removed on finalize.
  assert.equal(process.listenerCount('SIGTERM'), baselineListeners.sigterm)
  assert.equal(process.listenerCount('SIGINT'), baselineListeners.sigint)
  assert.equal(process.listenerCount('uncaughtException'), baselineListeners.uncaught)
  assert.equal(process.listenerCount('unhandledRejection'), baselineListeners.rejection)
})

test('duplicate startup is refused by the cross-process lock with evidence', async () => {
  const { root, ledger, worker, artifactStore } = await fixture()
  const heldLock = await new WorkerLock({ lockPath: path.join(root, 'bounded-worker.lock'), workerId: 'other-worker' }).acquire()
  const session = new BoundedWorkerSession({
    worker,
    ledger,
    artifactStore,
    runRoot: root,
    installSignalHandlers: false,
    ...FAST,
  })
  const result = await session.run(async () => {
    throw new Error('must never run')
  })
  assert.equal(result.exit_reason, 'WORKER_LOCK_UNAVAILABLE')
  assert.equal(result.orders_attempted, 0)
  const evidence = JSON.parse(await readFile(path.join(root, 'SESSION_EXIT_EVIDENCE.json'), 'utf8'))
  assert.equal(evidence.exit_reason, 'WORKER_LOCK_UNAVAILABLE')
  await heldLock.release()
})

test('timer, child, and controller cleanup runs on exit', async () => {
  const { session } = await fixture({ orders: [{}] })
  const fakeChild = {
    exitCode: null,
    signalCode: null,
    killed: [],
    kill(signal) { this.killed.push(signal); this.signalCode = signal; return true },
    once() { return this },
  }
  const result = await session.run(async () => {
    session.registry.trackTimer(setTimeout(() => {}, 60_000))
    session.registry.trackChild(fakeChild)
    session.registry.trackController(new AbortController())
    return { outcome: 'RESULT_RETURNED' }
  })
  assert.equal(result.evidence_written, true)
  assert.deepEqual(fakeChild.killed, ['SIGTERM'])
  assert.equal(result.resources.timers_cleared >= 1, true)
  assert.equal(result.resources.children_terminated >= 1, true)
  assert.equal(result.resources.controllers_aborted >= 1, true)
  assert.deepEqual(session.registry.counts(), { timers: 0, children: 0, controllers: 0 })
})

test('a failed order is blocked without retry and the next order still runs', async () => {
  const { ledger, session } = await fixture({ orders: [{}, {}] })
  let calls = 0
  const result = await session.run(async ({ order }) => {
    calls += 1
    if (order.work_order_id === 'wo-bounded-0') throw Object.assign(new Error('adapter unavailable'), { code: 'BLOCKED_ADAPTER_UNAVAILABLE' })
    return { outcome: 'RESULT_RETURNED' }
  })
  assert.equal(calls, 2)
  assert.equal(result.orders_attempted, 2)
  const failed = await ledger.get('wo-bounded-0')
  assert.equal(failed.status, 'BLOCKED')
  assert.equal(failed.blocker_code, 'BLOCKED_ADAPTER_UNAVAILABLE')
  assert.equal(failed.attempt_count, 1) // exactly one attempt: no automatic retry
})

test('cross-process: SIGTERM produces signal-path exit evidence in a real child process', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'operator-bridge-bounded-child-'))
  const moduleDir = fileURLToPath(new URL('../../operator-bridge/', import.meta.url))
  const childScript = path.join(root, 'bounded-child.mjs')
  await writeFile(childScript, `
import { LocalArtifactStore } from ${JSON.stringify(path.join(moduleDir, 'artifact-store.mjs'))}
import { BoundedWorkerSession } from ${JSON.stringify(path.join(moduleDir, 'bounded-worker-session.mjs'))}
import { OrcaEdgeWorker } from ${JSON.stringify(path.join(moduleDir, 'orca-edge-worker.mjs'))}
import { FileWorkOrderLedger } from ${JSON.stringify(path.join(moduleDir, 'work-order-ledger.mjs'))}

const root = ${JSON.stringify(root)}
const mode = process.argv[2]
const artifactStore = await new LocalArtifactStore({ root: root + '/artifacts' }).init()
const ledger = await new FileWorkOrderLedger({ root: root + '/control-plane' }).init()
await ledger.create({
  work_order_id: 'wo-child-1', requested_by: 'test', originating_surface: 'test',
  task_type: 'github_pr_read_only_review', scope: { read_only: true }, approval_class: 'READ_ONLY',
  executor: 'ORCA', required_artifacts: [], input_hashes: [], idempotency_key: 'child:1', status: 'QUEUED',
})
const worker = new OrcaEdgeWorker({ workerId: 'orca-child', ledger, githubCollector: {}, kimiAdapter: {}, artifactStore, environment: 'staging' })
const session = new BoundedWorkerSession({
  worker, ledger, artifactStore, runRoot: root,
  sessionBudgetMs: 10_000, perOrderBudgetMs: 5_000, idleExitMs: 5_000, pollMs: 50, killGraceMs: 20,
})
if (mode === 'crash') {
  // An uncaught error outside the session's order handling must still
  // produce ABNORMAL_EXIT evidence before the process dies.
  setTimeout(() => { throw new Error('CHILD_CRASH_SENTINEL') }, 400)
}
await session.run(async ({ signal }) => {
  // READY is printed only from inside order handling: by now the lock is
  // held and every signal/uncaught handler is installed, so the parent's
  // SIGTERM exercises the real signal path rather than the default kill.
  process.stdout.write('READY\\n')
  await new Promise((resolve) => signal.addEventListener('abort', resolve, { once: true }))
  throw new Error('aborted')
})
`)

  async function runChild(mode, { signal = null } = {}) {
    // Each child run starts from a clean run root: the first run blocks the
    // shared order, so without a reset the second child would find no QUEUED
    // work and idle out before printing READY.
    await rm(path.join(root, 'SESSION_EXIT_EVIDENCE.json'), { force: true })
    await rm(path.join(root, 'bounded-worker.lock'), { force: true })
    await rm(path.join(root, 'control-plane'), { recursive: true, force: true })
    await rm(path.join(root, 'artifacts'), { recursive: true, force: true })
    const child = spawn(process.execPath, [childScript, mode], { stdio: ['ignore', 'pipe', 'pipe'] })
    await new Promise((resolve, reject) => {
      child.stdout.once('data', resolve)
      setTimeout(() => reject(new Error('child never became ready')), 10_000)
    })
    if (signal) child.kill(signal)
    return new Promise((resolve) => child.on('close', (code) => resolve(code)))
  }

  const termCode = await runChild('wait', { signal: 'SIGTERM' })
  assert.equal(termCode, 0)
  const termEvidence = JSON.parse(await readFile(path.join(root, 'SESSION_EXIT_EVIDENCE.json'), 'utf8'))
  assert.equal(termEvidence.exit_reason, 'SIGNAL_SHUTDOWN')
  assert.equal(termEvidence.exit_detail, 'SIGTERM')
  assert.equal(termEvidence.orders_attempted, 1)
  assert.equal(termEvidence.contract.no_automatic_retry, true)
  assert.equal(termEvidence.contract.daemon, false)

  const crashCode = await runChild('crash')
  assert.equal(crashCode, 1)
  const crashEvidence = JSON.parse(await readFile(path.join(root, 'SESSION_EXIT_EVIDENCE.json'), 'utf8'))
  assert.equal(crashEvidence.exit_reason, 'ABNORMAL_EXIT')
  const crashedOrder = crashEvidence.order_records.find((record) => record.work_order_id === 'wo-child-1')
  assert.ok(crashedOrder)
})
