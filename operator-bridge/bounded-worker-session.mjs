import { randomUUID } from 'node:crypto'
import path from 'node:path'

import { writeExitEvidence } from './exit-evidence.mjs'
import {
  BLOCKER_CODES,
  BOUNDED_SESSION_DEFAULTS,
  STAGING_ENVIRONMENT,
  SESSION_EXIT_REASONS,
} from './constants.mjs'
import { ResourceRegistry } from './resource-registry.mjs'
import { WorkerLock } from './worker-lock.mjs'

export class BoundedWorkerSessionError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'BoundedWorkerSessionError'
    this.code = code
  }
}

// Abort-reason codes mapped to order blocker codes. A per-order abort is
// always deliberate: the 15-minute per-order ceiling, the 30-minute session
// ceiling, or an operator signal.
const ABORT_BLOCKERS = Object.freeze({
  ORDER_EXECUTION_TIMEOUT: BLOCKER_CODES.ORDER_EXECUTION_TIMEOUT,
  SESSION_TIME_EXHAUSTED: BLOCKER_CODES.SESSION_TIME_EXHAUSTED,
  SIGNAL_SHUTDOWN: BLOCKER_CODES.WORKER_SHUTDOWN_RESUMABLE,
})

function iso(ms) {
  return new Date(ms).toISOString()
}

// Bounded-worker session state machine. Wraps an OrcaEdgeWorker (never
// rewrites it) and enforces the full bounded-worker contract:
//   staging only · READ_ONLY only · task-type allowlist · at most 3 orders
//   per session · at most 30 minutes total runtime · at most 15 minutes per
//   order · automatic exit after 2 minutes idle · one-worker cross-process
//   lock · no automatic retry · no daemon · no auto-start · no shell-command
//   fields · no approval execution · no protected actions · no GitHub writes
//   · no production access · exit evidence on every result.
//
// The session is a one-shot process wrapper: run() executes until a bound is
// reached and always terminates with scrubbed exit evidence. Nothing here
// schedules, restarts, or daemonizes anything.
export class BoundedWorkerSession {
  constructor({
    worker,
    ledger,
    artifactStore = null,
    registry = null,
    lock = null,
    runRoot,
    logger = null,
    clock = () => Date.now(),
    environment = STAGING_ENVIRONMENT,
    allowedTaskTypes = ['github_pr_read_only_review'],
    allowedApprovalClasses = ['READ_ONLY'],
    maxOrdersPerSession = BOUNDED_SESSION_DEFAULTS.maxOrdersPerSession,
    sessionBudgetMs = BOUNDED_SESSION_DEFAULTS.sessionBudgetMs,
    perOrderBudgetMs = BOUNDED_SESSION_DEFAULTS.perOrderBudgetMs,
    idleExitMs = BOUNDED_SESSION_DEFAULTS.idleExitMs,
    pollMs = BOUNDED_SESSION_DEFAULTS.pollMs,
    killGraceMs = 1_000,
    executor = 'ORCA',
    installSignalHandlers = true,
  }) {
    if (environment !== STAGING_ENVIRONMENT) {
      throw new BoundedWorkerSessionError('WORKER_ENVIRONMENT_REJECTED', 'Bounded workers execute against staging only')
    }
    if (!worker || !ledger || !runRoot) {
      throw new BoundedWorkerSessionError('BOUNDED_SESSION_CONFIG_INVALID', 'worker, ledger, and runRoot are required')
    }
    // Contract ceilings are enforced in source: callers may tighten the
    // bounds below the contracted values but can never raise them. Each
    // bound is an independent wall — order cap, session clock, per-order
    // clock, and idle clock each fire on their own, and whichever is hit
    // first terminates the session with evidence.
    const bounds = { maxOrdersPerSession, sessionBudgetMs, perOrderBudgetMs, idleExitMs }
    const ceilings = {
      maxOrdersPerSession: BOUNDED_SESSION_DEFAULTS.maxOrdersPerSession,
      sessionBudgetMs: BOUNDED_SESSION_DEFAULTS.sessionBudgetMs,
      perOrderBudgetMs: BOUNDED_SESSION_DEFAULTS.perOrderBudgetMs,
      idleExitMs: BOUNDED_SESSION_DEFAULTS.idleExitMs,
    }
    for (const [name, value] of Object.entries(bounds)) {
      if (!Number.isFinite(value) || value <= 0 || !Number.isInteger(value)) {
        throw new BoundedWorkerSessionError('BOUNDED_SESSION_CONFIG_INVALID', `${name} must be a positive integer`)
      }
      if (value > ceilings[name]) {
        throw new BoundedWorkerSessionError('BOUNDED_SESSION_CONFIG_INVALID', `${name} exceeds the contracted ceiling`)
      }
    }
    if (!Number.isFinite(pollMs) || pollMs <= 0 || !Number.isInteger(pollMs)) {
      throw new BoundedWorkerSessionError('BOUNDED_SESSION_CONFIG_INVALID', 'pollMs must be a positive integer')
    }

    this.worker = worker
    this.ledger = ledger
    this.artifactStore = artifactStore
    this.registry = registry ?? new ResourceRegistry({ clock })
    this.lock = lock ?? new WorkerLock({ lockPath: path.join(runRoot, 'bounded-worker.lock'), workerId: worker.workerId, clock })
    this.runRoot = runRoot
    this.logger = logger
    this.clock = clock
    this.environment = environment
    this.allowedTaskTypes = new Set(allowedTaskTypes)
    this.allowedApprovalClasses = new Set(allowedApprovalClasses)
    this.maxOrdersPerSession = maxOrdersPerSession
    this.sessionBudgetMs = sessionBudgetMs
    this.perOrderBudgetMs = perOrderBudgetMs
    this.idleExitMs = idleExitMs
    this.pollMs = pollMs
    this.killGraceMs = killGraceMs
    this.executor = executor
    this.installSignalHandlers = installSignalHandlers

    this.sessionId = randomUUID()
    this.evidencePath = path.join(runRoot, 'SESSION_EXIT_EVIDENCE.json')
    this.timeline = []
    this.orderRecords = []
    this.skippedOrders = new Map()
    this.attemptedOrderIds = new Set()
    this._finalized = null
    this._shutdownSignal = null
    this._currentOrderController = null
    this._wakeUp = null
    this._signalHandlers = []
  }

  _record(event, metadata = {}) {
    const entry = { timestamp_utc: iso(this.clock()), event, ...metadata }
    this.timeline.push(entry)
    this.logger?.info?.(entry)
    return entry
  }

  // Returns null when the order is executable, otherwise the stable reason
  // code it was skipped under. Skipped orders are never claimed; they remain
  // visible in exit evidence for a human.
  _eligibility(order) {
    if (order.executor !== this.executor) return 'EXECUTOR_MISMATCH'
    if (this.attemptedOrderIds.has(order.work_order_id)) return 'ALREADY_ATTEMPTED_THIS_SESSION'
    if (!this.allowedTaskTypes.has(order.task_type)) return BLOCKER_CODES.TASK_TYPE_NOT_ALLOWLISTED
    if (!this.allowedApprovalClasses.has(order.approval_class)) return BLOCKER_CODES.APPROVAL_CLASS_NOT_EXECUTABLE
    return null
  }

  _installProcessHandlers() {
    if (!this.installSignalHandlers) return
    const onSignal = (signalName) => {
      this.requestShutdown(signalName)
    }
    const onUncaught = (error) => {
      this._finalize({
        exitReason: 'ABNORMAL_EXIT',
        detail: error?.code ?? error?.name ?? 'UNKNOWN',
        errorMessage: typeof error?.message === 'string' ? error.message.slice(0, 200) : null,
      }).finally(() => process.exit(1))
    }
    const sigint = () => onSignal('SIGINT')
    const sigterm = () => onSignal('SIGTERM')
    const uncaughtException = (error) => onUncaught(error)
    const unhandledRejection = (reason) => onUncaught(reason instanceof Error ? reason : new Error('UNHANDLED_REJECTION'))
    process.once('SIGINT', sigint)
    process.once('SIGTERM', sigterm)
    process.once('uncaughtException', uncaughtException)
    process.once('unhandledRejection', unhandledRejection)
    this._signalHandlers = [
      ['SIGINT', sigint],
      ['SIGTERM', sigterm],
      ['uncaughtException', uncaughtException],
      ['unhandledRejection', unhandledRejection],
    ]
  }

  _removeProcessHandlers() {
    for (const [event, handler] of this._signalHandlers) process.removeListener(event, handler)
    this._signalHandlers = []
  }

  // Initiated by a signal handler. Aborts the in-flight order (blocked
  // resumable, never retried) and wakes the poll loop so the session exits
  // promptly with evidence.
  requestShutdown(signalName) {
    if (this._finalized || this._shutdownSignal) return
    this._shutdownSignal = signalName
    this._record('worker_shutdown_requested', { signal: signalName })
    this._currentOrderController?.abort({ code: 'SIGNAL_SHUTDOWN' })
    this._wakeUp?.()
  }

  _interruptibleSleep(ms) {
    return new Promise((resolve) => {
      const timer = this.registry.trackTimer(setTimeout(() => {
        this._wakeUp = null
        resolve()
      }, ms))
      this._wakeUp = () => {
        clearTimeout(timer)
        this.registry.untrackTimer(timer)
        resolve()
      }
    })
  }

  async run(runOrder) {
    if (typeof runOrder !== 'function') {
      throw new BoundedWorkerSessionError('BOUNDED_SESSION_CONFIG_INVALID', 'runOrder must be a function')
    }
    const startedAt = this.clock()
    this.startedAt = startedAt
    this.sessionDeadline = startedAt + this.sessionBudgetMs
    try {
      await this.lock.acquire()
      this._record('worker_lock_acquired', { worker_id: this.worker.workerId })
    } catch (error) {
      return this._finalize({ exitReason: 'WORKER_LOCK_UNAVAILABLE', detail: error.code ?? 'WORKER_LOCK_HELD' })
    }
    this._installProcessHandlers()
    // Session-clock deadline: 30-minute total-runtime ceiling. Fires even
    // mid-order, aborting the in-flight order with the session blocker.
    this.registry.trackTimer(setTimeout(() => {
      this._record('session_clock_exhausted')
      this._currentOrderController?.abort({ code: 'SESSION_TIME_EXHAUSTED' })
      this._wakeUp?.()
    }, this.sessionBudgetMs))

    let lastActivityAt = this.clock()
    for (;;) {
      if (this._shutdownSignal) {
        return this._finalize({ exitReason: 'SIGNAL_SHUTDOWN', detail: this._shutdownSignal })
      }
      if (this.orderRecords.length >= this.maxOrdersPerSession) {
        return this._finalize({ exitReason: 'ORDER_CAP_REACHED', detail: `${this.orderRecords.length}/${this.maxOrdersPerSession}` })
      }
      if (this.clock() >= this.sessionDeadline) {
        return this._finalize({ exitReason: 'SESSION_TIME_EXHAUSTED' })
      }
      await this.ledger.reclaimExpired({ actor: this.worker.workerId })
      const queued = await this.ledger.list({ statuses: ['QUEUED'] })
      const eligible = []
      for (const order of queued) {
        const skip = this._eligibility(order)
        if (skip) {
          if (!this.skippedOrders.has(order.work_order_id)) {
            this.skippedOrders.set(order.work_order_id, skip)
            this._record('work_order_skipped', { work_order_id: order.work_order_id, reason: skip })
          }
          continue
        }
        eligible.push(order)
      }
      if (eligible.length === 0) {
        if (this.clock() - lastActivityAt >= this.idleExitMs) {
          return this._finalize({ exitReason: 'IDLE_EXIT', detail: `${this.idleExitMs}ms_without_claimable_work` })
        }
        await this._interruptibleSleep(this.pollMs)
        continue
      }
      lastActivityAt = this.clock()
      await this._processOrder(eligible[0], runOrder)
    }
  }

  async _processOrder(order, runOrder) {
    const workOrderId = order.work_order_id
    this.attemptedOrderIds.add(workOrderId) // no automatic retry: an attempted order is never reclaimed this session
    const record = {
      work_order_id: workOrderId,
      task_type: order.task_type,
      approval_class: order.approval_class,
      started_at: iso(this.clock()),
      outcome: null,
      blocker_code: null,
      duration_ms: null,
    }
    this.orderRecords.push(record)
    const controller = this.registry.trackController(new AbortController())
    this._currentOrderController = controller
    // Per-order wall-clock ceiling: 15 minutes maximum per order.
    const orderTimer = this.registry.trackTimer(setTimeout(() => {
      controller.abort({ code: 'ORDER_EXECUTION_TIMEOUT' })
    }, this.perOrderBudgetMs))
    let claim = null
    try {
      claim = await this.worker.execute({
        action: 'claim_work_order',
        payload: { work_order_id: workOrderId, lease_ttl_ms: this.perOrderBudgetMs + 30_000 },
      })
      record.attempt = claim.attempt_count
      this._record('work_order_claimed', { work_order_id: workOrderId, attempt: claim.attempt_count })
      await this.ledger.transition(workOrderId, 'RUNNING', {
        actor: this.worker.workerId,
        reason: 'BOUNDED_EXECUTION_STARTED',
        leaseToken: claim.lease_token,
      })
      const result = await runOrder({
        order: claim,
        worker: this.worker,
        ledger: this.ledger,
        artifactStore: this.artifactStore,
        leaseToken: claim.lease_token,
        attempt: claim.attempt_count,
        signal: controller.signal,
        record: (event, metadata) => this._record(event, { work_order_id: workOrderId, ...metadata }),
      })
      record.outcome = result?.outcome ?? 'RESULT_RETURNED'
      record.blocker_code = result?.blocker_code ?? null
      if (result?.blocker_code) this._record('work_order_blocked_by_pipeline', { work_order_id: workOrderId, blocker_code: result.blocker_code })
    } catch (error) {
      const abortCode = controller.signal.aborted ? controller.signal.reason?.code : null
      const blocker = ABORT_BLOCKERS[abortCode] ?? (typeof error?.code === 'string' ? error.code : BLOCKER_CODES.ORDER_EXECUTION_FAILED)
      record.outcome = 'FAILED'
      record.blocker_code = blocker
      this._record('work_order_failed', { work_order_id: workOrderId, blocker_code: blocker, error_class: error?.name ?? 'Error' })
      await this._blockAttemptedOrder(workOrderId, claim?.lease_token ?? null, blocker)
    } finally {
      clearTimeout(orderTimer)
      this.registry.untrackTimer(orderTimer)
      this.registry.untrackController(controller)
      this._currentOrderController = null
      record.duration_ms = this.clock() - Date.parse(record.started_at)
    }
    return record
  }

  // Best-effort block of a failed order. If the lease was already lost, the
  // canonical reclaim pathway returns the order to QUEUED instead; either
  // way the failure stays visible and nothing is retried automatically.
  async _blockAttemptedOrder(workOrderId, leaseToken, blocker) {
    if (leaseToken) {
      try {
        await this.worker.execute({
          action: 'release_or_block_work_order',
          payload: {
            work_order_id: workOrderId,
            status: 'BLOCKED',
            blocker_code: blocker,
            next_action: 'HUMAN_REVIEW_REQUIRED_NO_AUTOMATIC_RETRY',
            lease_token: leaseToken,
          },
        })
        return 'BLOCKED'
      } catch (error) {
        this._record('work_order_block_failed', { work_order_id: workOrderId, error_code: error?.code ?? error?.message ?? 'UNKNOWN' })
      }
    }
    const reclaimed = await this.ledger.reclaimExpired({ actor: this.worker.workerId })
    return reclaimed.some((order) => order.work_order_id === workOrderId) ? 'RECLAIMED_AFTER_LEASE_LOSS' : 'LEFT_FOR_HUMAN'
  }

  // Idempotent finalization: every exit path — caps, idle, signal, abnormal —
  // lands here exactly once. Terminates every tracked timer, child, and
  // controller, writes scrubbed exit evidence (file + sealed artifact), and
  // releases the one-worker lock.
  async _finalize({ exitReason, detail = null, errorMessage = null }) {
    if (!SESSION_EXIT_REASONS.includes(exitReason)) throw new BoundedWorkerSessionError('BOUNDED_SESSION_EXIT_REASON_INVALID', exitReason)
    if (this._finalized) return this._finalized
    this._finalized = (async () => {
      const exitedAt = this.clock()
      this._removeProcessHandlers()
      const resources = await this.registry.cleanup({ killGraceMs: this.killGraceMs })
      this._record('worker_session_finalized', { exit_reason: exitReason })
      const evidence = {
        schema_version: 'motesart.operator_bridge.bounded_worker_exit.v1',
        session_id: this.sessionId,
        worker_id: this.worker.workerId,
        environment: this.environment,
        started_at: iso(this.startedAt ?? exitedAt),
        exited_at: iso(exitedAt),
        duration_ms: exitedAt - (this.startedAt ?? exitedAt),
        exit_reason: exitReason,
        exit_detail: detail,
        exit_error_message: errorMessage,
        bounds: {
          max_orders_per_session: this.maxOrdersPerSession,
          session_budget_ms: this.sessionBudgetMs,
          per_order_budget_ms: this.perOrderBudgetMs,
          idle_exit_ms: this.idleExitMs,
        },
        orders_attempted: this.orderRecords.length,
        orders_result_returned: this.orderRecords.filter((record) => record.outcome === 'RESULT_RETURNED').length,
        orders_blocked: this.orderRecords.filter((record) => record.outcome === 'BLOCKED').length,
        orders_failed: this.orderRecords.filter((record) => record.outcome === 'FAILED').length,
        order_records: this.orderRecords,
        skipped_orders: [...this.skippedOrders.entries()].map(([workOrderId, reason]) => ({ work_order_id: workOrderId, reason })),
        timeline: this.timeline,
        resources,
        lock: {
          path: this.lock.lockPath,
          acquired_at: this.lock.acquiredAt,
          held_at_exit: this.lock.held,
        },
        contract: {
          read_only_only: true,
          no_automatic_retry: true,
          daemon: false,
          auto_start: false,
          shell_command_fields: 'REJECTED_BY_WORKER',
          approval_executions: 0,
          protected_actions: 0,
          github_writes: 0,
          production_access: false,
        },
      }
      let written = null
      try {
        written = await writeExitEvidence({
          filePath: this.evidencePath,
          evidence,
          artifactStore: this.artifactStore,
          workOrderId: `bounded-session-${this.sessionId}`,
          producingExecutor: this.worker.workerId,
        })
      } catch (error) {
        // Evidence failure must never mask the exit itself; it is surfaced in
        // the result and on stderr by the calling script.
        this._record('exit_evidence_write_failed', { error_code: error?.code ?? error?.name ?? 'UNKNOWN' })
      }
      const released = await this.lock.release()
      return {
        exit_reason: exitReason,
        exit_detail: detail,
        session_id: this.sessionId,
        evidence_path: this.evidencePath,
        evidence_artifact_id: written?.artifact?.artifact_id ?? null,
        evidence_written: Boolean(written),
        evidence_redaction_count: written?.redactionCount ?? 0,
        lock_released: released,
        resources,
        orders_attempted: evidence.orders_attempted,
        order_records: this.orderRecords.map((record) => ({ ...record })),
        skipped_orders: evidence.skipped_orders,
      }
    })()
    return this._finalized
  }
}
