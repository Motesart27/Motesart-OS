import { randomBytes, randomUUID } from 'node:crypto'
import { appendFile, chmod, mkdir, open, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { constantTimeEqual, sha256 } from './security.mjs'

const EMPTY_HEAD = '0'.repeat(64)
const ACTIVE_LEASE_STATES = new Set(['CLAIMED', 'RUNNING'])
const MANUAL_RETRY_BLOCKERS = new Set(['KIMI_RESPONSE_UNAVAILABLE', 'KIMI_REASONING_ONLY_LENGTH'])
// States from which a block operation is a valid transition. Mirrors the
// canonical deny-by-default TRANSITIONS table in operator-bridge/constants.mjs
// projected onto the BLOCKED target; terminal states (COMPLETED, FAILED,
// CANCELLED, EXPIRED) and DRAFT/NEEDS_APPROVAL/BLOCKED are excluded. Kept
// inline because the Railway Dockerfile deploy context contains only
// staging-control-plane/*.mjs; the control-plane tests assert parity with the
// canonical table.
export const BLOCKABLE_STATES = new Set(['QUEUED', 'CLAIMED', 'RUNNING', 'VERIFYING', 'READY_FOR_APPROVAL'])

export class StagingStoreError extends Error {
  constructor(code, status = 409) {
    super(code)
    this.name = 'StagingStoreError'
    this.code = code
    this.status = status
  }
}

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function publicOrder(order) {
  const { lease_token_hash: _leaseTokenHash, ...safe } = order
  safe.manual_retry_count = order.manual_retry_count ?? 0
  safe.manual_retry_eligible = order.status === 'BLOCKED'
    && MANUAL_RETRY_BLOCKERS.has(order.blocker_code)
    && !order.lease_owner
    && !order.lease_token_hash
    && !order.lease_expires_at
    && !order.heartbeat_at
    && safe.manual_retry_count < 1
    && order.approval_class === 'READ_ONLY'
    && order.scope?.read_only === true
  return structuredClone(safe)
}

export class StagingStore {
  constructor({ root, clock = () => Date.now(), retentionDays = 30, lockWaitMs = 500, lockPollMs = 50 }) {
    this.root = root
    this.clock = clock
    this.retentionDays = retentionDays
    this.lockWaitMs = lockWaitMs
    this.lockPollMs = lockPollMs
    this.namespaceRoot = path.join(root, 'staging')
    this.ledgerDirectory = path.join(this.namespaceRoot, 'ledger')
    this.artifactDirectory = path.join(this.namespaceRoot, 'artifacts', 'sha256')
    this.statePath = path.join(this.ledgerDirectory, 'state.json')
    this.lockPath = path.join(this.ledgerDirectory, 'writer.lock')
    this.recoveryLogPath = path.join(this.ledgerDirectory, 'lock-recovery.jsonl')
    this._tail = Promise.resolve()
    this._lockHandle = null
  }

  async init() {
    await mkdir(this.ledgerDirectory, { recursive: true, mode: 0o700 })
    await mkdir(this.artifactDirectory, { recursive: true, mode: 0o700 })
    this._lockHandle = await this._acquireWriterLock()
    try {
      await readFile(this.statePath, 'utf8')
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
      await this._write({
        schema_version: 'motesart.operator_bridge.staging_store.v1',
        namespace: 'staging',
        chain_head: EMPTY_HEAD,
        work_orders: {},
        idempotency: {},
        manual_retry_idempotency: {},
        events: [],
        artifacts: {},
        decision_cards: {},
      })
    }
    await this._readVerified()
    return this
  }

  // Writer-lock acquisition with bounded waiting and demonstrably-stale
  // recovery. A lock is recovered only when its recorded holder PID is
  // verifiably dead (ESRCH); a live, foreign-permission (EPERM), or malformed
  // lock always fails closed with STAGING_LEDGER_LOCKED. Recovery moves the
  // stale lock to a unique tombstone via atomic rename so that exactly one
  // concurrent recoverer can win.
  async _acquireWriterLock() {
    const deadline = Date.now() + this.lockWaitMs
    for (;;) {
      try {
        const handle = await open(this.lockPath, 'wx', 0o600)
        await handle.writeFile(JSON.stringify({ pid: process.pid, created_at: new Date(this.clock()).toISOString() }))
        return handle
      } catch (error) {
        if (error.code !== 'EEXIST') throw error
        const recovered = await this._recoverStaleLock()
        if (!recovered) {
          if (Date.now() >= deadline) throw new StagingStoreError('STAGING_LEDGER_LOCKED', 503)
          await new Promise((resolve) => setTimeout(resolve, this.lockPollMs))
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
      await this._recordLockRecovery({ outcome: 'malformed_lock_metadata' })
      return false
    }
    const pid = metadata?.pid
    if (!Number.isInteger(pid) || pid <= 0) {
      await this._recordLockRecovery({ outcome: 'malformed_lock_metadata' })
      return false
    }
    let holderAlive = true
    try {
      process.kill(pid, 0)
    } catch (error) {
      holderAlive = error.code === 'EPERM' // ESRCH means demonstrably dead; EPERM means alive but foreign
    }
    if (holderAlive) return false
    const tombstone = `${this.lockPath}.stale-${process.pid}-${randomUUID()}`
    try {
      await rename(this.lockPath, tombstone)
    } catch (error) {
      return error.code === 'ENOENT' // another recoverer won the race; retry acquire
    }
    // Re-validate the file actually renamed: between the staleness check and
    // the rename a fresh holder may have acquired the lock. Never tombstone a
    // live lock — restore it and fail closed.
    if (!(await this._revalidateRenamedLock(tombstone, pid))) {
      await rename(tombstone, this.lockPath).catch(() => undefined)
      return false
    }
    await unlink(tombstone).catch(() => undefined)
    await this._recordLockRecovery({ outcome: 'recovered_stale_lock', stale_pid: pid, stale_created_at: typeof metadata.created_at === 'string' ? metadata.created_at : null })
    return true
  }

  async _revalidateRenamedLock(tombstone, expectedPid) {
    try {
      const renamed = JSON.parse(await readFile(tombstone, 'utf8'))
      return renamed?.pid === expectedPid
    } catch {
      return false
    }
  }

  async _recordLockRecovery(entry) {
    const line = JSON.stringify({ schema_version: 'motesart.operator_bridge.lock_recovery.v1', recorded_at: new Date(this.clock()).toISOString(), ...entry })
    await appendFile(this.recoveryLogPath, `${line}\n`, { mode: 0o600 }).catch(() => undefined)
  }

  async close() {
    await this._lockHandle?.close().catch(() => undefined)
    this._lockHandle = null
    await unlink(this.lockPath).catch(() => undefined)
  }

  _exclusive(operation) {
    const next = this._tail.then(operation, operation)
    this._tail = next.catch(() => undefined)
    return next
  }

  async _write(state) {
    const temporary = `${this.statePath}.${process.pid}.${randomUUID()}.tmp`
    await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 })
    await rename(temporary, this.statePath)
  }

  _appendEvent(state, { workOrderId, fromStatus, toStatus, code, actor, metadata = {} }) {
    const event = {
      event_id: randomUUID(),
      work_order_id: workOrderId,
      from_status: fromStatus,
      to_status: toStatus,
      code,
      actor,
      metadata,
      created_at: new Date(this.clock()).toISOString(),
      previous_hash: state.chain_head,
    }
    event.event_hash = sha256(stable(event))
    state.events.push(event)
    state.chain_head = event.event_hash
    return event
  }

  _verifyChain(state) {
    let head = EMPTY_HEAD
    for (const event of state.events) {
      if (event.previous_hash !== head) throw new StagingStoreError('LEDGER_INTEGRITY_FAILURE', 503)
      const { event_hash: eventHash, ...unsigned } = event
      if (sha256(stable(unsigned)) !== eventHash) throw new StagingStoreError('LEDGER_INTEGRITY_FAILURE', 503)
      head = eventHash
    }
    if (state.chain_head !== head) throw new StagingStoreError('LEDGER_INTEGRITY_FAILURE', 503)
  }

  async _readVerified() {
    const state = JSON.parse(await readFile(this.statePath, 'utf8'))
    if (state.namespace !== 'staging') throw new StagingStoreError('STAGING_NAMESPACE_INVALID', 503)
    this._verifyChain(state)
    return state
  }

  _reconcileExpired(state) {
    const now = this.clock()
    for (const order of Object.values(state.work_orders)) {
      if (!ACTIVE_LEASE_STATES.has(order.status) || Date.parse(order.lease_expires_at) > now) continue
      const prior = order.status
      Object.assign(order, {
        status: 'QUEUED',
        lease_owner: null,
        lease_token_hash: null,
        lease_expires_at: null,
        heartbeat_at: null,
        blocker_code: 'LEASE_EXPIRED',
        next_action: 'RECLAIM_BY_ORCA',
        updated_at: new Date(now).toISOString(),
      })
      this._appendEvent(state, {
        workOrderId: order.work_order_id,
        fromStatus: prior,
        toStatus: 'QUEUED',
        code: 'LEASE_EXPIRED_RECLAIMED',
        actor: 'staging-control-plane',
      })
    }
  }

  async createWorkOrder(input) {
    return this._exclusive(async () => {
      const state = await this._readVerified()
      const existingId = state.idempotency[input.idempotency_key]
      if (existingId) return { work_order: publicOrder(state.work_orders[existingId]), duplicate: true }
      const now = new Date(this.clock()).toISOString()
      const workOrder = {
        work_order_id: `wo_staging_${randomUUID()}`,
        requested_by: input.requested_by,
        originating_surface: input.originating_surface,
        instruction: input.instruction,
        task_type: input.task_type,
        scope: input.scope,
        priority: input.priority,
        approval_class: input.approval_class,
        executor: input.executor === 'AUTO_ROUTE' ? 'ORCA' : input.executor,
        requested_executor: input.executor,
        required_artifacts: input.task_type === 'staging_smoke_test'
          ? ['test_log', 'decision_card']
          : ['repository_identity', 'workflow_status', 'model_response', 'test_log', 'verifier_verdict', 'decision_card'],
        status: 'DRAFT',
        lease_owner: null,
        lease_token_hash: null,
        lease_expires_at: null,
        heartbeat_at: null,
        attempt_count: 0,
        idempotency_key: input.idempotency_key,
        result_artifact_id: null,
        evidence_artifact_id: null,
        decision_card_artifact_id: null,
        blocker_code: null,
        manual_retry_count: 0,
        manual_retry_history: [],
        next_action: 'QUEUE_FOR_ORCA',
        created_at: now,
        updated_at: now,
      }
      state.work_orders[workOrder.work_order_id] = workOrder
      state.idempotency[input.idempotency_key] = workOrder.work_order_id
      this._appendEvent(state, { workOrderId: workOrder.work_order_id, fromStatus: null, toStatus: 'DRAFT', code: 'WORK_ORDER_CREATED', actor: input.requested_by })
      workOrder.status = 'QUEUED'
      workOrder.updated_at = new Date(this.clock()).toISOString()
      this._appendEvent(state, { workOrderId: workOrder.work_order_id, fromStatus: 'DRAFT', toStatus: 'QUEUED', code: 'SUPERVISED_SUBMISSION_QUEUED', actor: input.requested_by })
      await this._write(state)
      return { work_order: publicOrder(workOrder), duplicate: false }
    })
  }

  async listWorkOrders() {
    return this._exclusive(async () => {
      const state = await this._readVerified()
      this._reconcileExpired(state)
      await this._write(state)
      return Object.values(state.work_orders).map(publicOrder).sort((a, b) => b.created_at.localeCompare(a.created_at))
    })
  }

  async getWorkOrder(workOrderId) {
    const state = await this._readVerified()
    const order = state.work_orders[workOrderId]
    if (!order) throw new StagingStoreError('WORK_ORDER_NOT_FOUND', 404)
    return publicOrder(order)
  }

  async getEvents(workOrderId) {
    await this.getWorkOrder(workOrderId)
    const state = await this._readVerified()
    return state.events.filter((event) => event.work_order_id === workOrderId).map((event) => structuredClone(event))
  }

  async getArtifacts(workOrderId) {
    await this.getWorkOrder(workOrderId)
    const state = await this._readVerified()
    return Object.values(state.artifacts).filter((artifact) => artifact.work_order_id === workOrderId).map((artifact) => structuredClone(artifact))
  }

  async getDecisionCard(workOrderId) {
    await this.getWorkOrder(workOrderId)
    const state = await this._readVerified()
    const card = state.decision_cards[workOrderId]
    if (!card) throw new StagingStoreError('DECISION_CARD_NOT_AVAILABLE', 404)
    return structuredClone(card)
  }

  async manualRetry(workOrderId, { actor, idempotencyKey }) {
    return this._exclusive(async () => {
      const state = await this._readVerified()
      state.manual_retry_idempotency ??= {}
      const idempotencyHash = sha256(`${workOrderId}:${idempotencyKey}`)
      const recorded = state.manual_retry_idempotency[idempotencyHash]
      if (recorded) return { ...structuredClone(recorded), duplicate: true }

      const order = state.work_orders[workOrderId]
      if (!order) throw new StagingStoreError('WORK_ORDER_NOT_FOUND', 404)
      if (order.lease_owner || order.lease_token_hash || order.lease_expires_at || order.heartbeat_at) {
        throw new StagingStoreError('MANUAL_RETRY_ACTIVE_LEASE', 409)
      }
      if ((order.manual_retry_count ?? 0) >= 1) throw new StagingStoreError('MANUAL_RETRY_LIMIT_REACHED', 409)
      if (order.status !== 'BLOCKED') throw new StagingStoreError('MANUAL_RETRY_STATE_NOT_ALLOWED', 409)
      if (!MANUAL_RETRY_BLOCKERS.has(order.blocker_code)) throw new StagingStoreError('MANUAL_RETRY_BLOCKER_NOT_ALLOWED', 409)
      if (order.approval_class !== 'READ_ONLY' || order.scope?.read_only !== true) {
        throw new StagingStoreError('MANUAL_RETRY_READ_ONLY_REQUIRED', 409)
      }
      const now = new Date(this.clock()).toISOString()
      const priorBlocker = order.blocker_code
      const authorized = this._appendEvent(state, {
        workOrderId,
        fromStatus: 'BLOCKED',
        toStatus: 'BLOCKED',
        code: 'MANUAL_RETRY_AUTHORIZED',
        actor,
        metadata: {
          attempt_count: order.attempt_count,
          blocker_code: priorBlocker,
          idempotency_key_sha256: sha256(idempotencyKey),
          manual_retry_count: 1,
        },
      })
      order.manual_retry_count = 1
      order.manual_retry_history = [
        ...(order.manual_retry_history ?? []),
        {
          authorized_at: now,
          authorized_event_id: authorized.event_id,
          blocker_code: priorBlocker,
          execution_attempt: order.attempt_count,
          idempotency_key_sha256: sha256(idempotencyKey),
        },
      ]
      Object.assign(order, {
        status: 'QUEUED',
        blocker_code: null,
        next_action: 'QUEUE_FOR_ORCA',
        lease_owner: null,
        lease_token_hash: null,
        lease_expires_at: null,
        heartbeat_at: null,
        updated_at: now,
      })
      const requeued = this._appendEvent(state, {
        workOrderId,
        fromStatus: 'BLOCKED',
        toStatus: 'QUEUED',
        code: 'WORK_ORDER_REQUEUED',
        actor,
        metadata: {
          authorized_event_id: authorized.event_id,
          manual_retry_count: order.manual_retry_count,
          preserved_attempt_count: order.attempt_count,
        },
      })
      order.manual_retry_history.at(-1).requeued_event_id = requeued.event_id
      const result = {
        work_order: publicOrder(order),
        authorized_event_id: authorized.event_id,
        requeued_event_id: requeued.event_id,
      }
      state.manual_retry_idempotency[idempotencyHash] = structuredClone(result)
      await this._write(state)
      return { ...result, duplicate: false }
    })
  }

  // Exact-target atomic claim (MOS-ORCA-TRANSPORT-BINDING-C1-01): the worker
  // must name the precise work order it intends to execute. There is no
  // oldest-queued fallback — an unnamed target is rejected before the ledger
  // is read, an unknown target is a 404, and a target that is not currently a
  // QUEUED ORCA order yields a null claim rather than a substitute order.
  async claim({ workOrderId, leaseOwner, leaseTtlMs = 60_000 }) {
    return this._exclusive(async () => {
      if (typeof workOrderId !== 'string' || workOrderId.trim() === '') {
        throw new StagingStoreError('CLAIM_TARGET_REQUIRED', 400)
      }
      const state = await this._readVerified()
      this._reconcileExpired(state)
      const order = state.work_orders[workOrderId]
      if (!order) {
        await this._write(state)
        throw new StagingStoreError('WORK_ORDER_NOT_FOUND', 404)
      }
      if (order.executor !== 'ORCA' || order.status !== 'QUEUED') {
        await this._write(state)
        return null
      }
      const leaseToken = randomBytes(32).toString('base64url')
      const prior = order.status
      const now = this.clock()
      Object.assign(order, {
        status: 'CLAIMED',
        lease_owner: leaseOwner,
        lease_token_hash: sha256(leaseToken),
        lease_expires_at: new Date(now + leaseTtlMs).toISOString(),
        heartbeat_at: new Date(now).toISOString(),
        attempt_count: order.attempt_count + 1,
        blocker_code: null,
        next_action: 'START_TYPED_EXECUTION',
        updated_at: new Date(now).toISOString(),
      })
      this._appendEvent(state, { workOrderId: order.work_order_id, fromStatus: prior, toStatus: 'CLAIMED', code: 'LEASE_CLAIMED', actor: leaseOwner })
      await this._write(state)
      return { work_order: publicOrder(order), lease_token: leaseToken }
    })
  }

  _requireLease(order, leaseToken) {
    if (!order.lease_token_hash || !constantTimeEqual(order.lease_token_hash, sha256(leaseToken ?? ''))) {
      throw new StagingStoreError('STALE_FENCING_TOKEN', 409)
    }
    if (Date.parse(order.lease_expires_at) <= this.clock()) throw new StagingStoreError('LEASE_EXPIRED', 409)
  }

  async heartbeat(workOrderId, { leaseOwner, leaseToken, leaseTtlMs = 60_000 }) {
    return this._exclusive(async () => {
      const state = await this._readVerified()
      const order = state.work_orders[workOrderId]
      if (!order) throw new StagingStoreError('WORK_ORDER_NOT_FOUND', 404)
      this._requireLease(order, leaseToken)
      if (order.lease_owner !== leaseOwner) throw new StagingStoreError('WRONG_LEASE_OWNER', 403)
      const now = this.clock()
      const prior = order.status
      order.status = 'RUNNING'
      order.heartbeat_at = new Date(now).toISOString()
      order.lease_expires_at = new Date(now + leaseTtlMs).toISOString()
      order.updated_at = new Date(now).toISOString()
      order.next_action = 'CONTINUE_TYPED_EXECUTION'
      this._appendEvent(state, { workOrderId, fromStatus: prior, toStatus: 'RUNNING', code: prior === 'CLAIMED' ? 'EXECUTION_STARTED' : 'LEASE_HEARTBEAT', actor: leaseOwner })
      await this._write(state)
      return publicOrder(order)
    })
  }

  async uploadArtifact(workOrderId, { leaseOwner, leaseToken, artifact }) {
    const content = Buffer.from(artifact.content_base64, 'base64')
    if (content.length !== artifact.byte_count || sha256(content) !== artifact.sha256) {
      await this.block(workOrderId, { leaseOwner, leaseToken, blockerCode: 'ARTIFACT_INTEGRITY_FAILURE', nextAction: 'REGENERATE_ARTIFACT' })
      throw new StagingStoreError('ARTIFACT_INTEGRITY_FAILURE', 409)
    }
    return this._exclusive(async () => {
      const state = await this._readVerified()
      const order = state.work_orders[workOrderId]
      if (!order) throw new StagingStoreError('WORK_ORDER_NOT_FOUND', 404)
      this._requireLease(order, leaseToken)
      if (order.lease_owner !== leaseOwner) throw new StagingStoreError('WRONG_LEASE_OWNER', 403)
      const objectPath = path.join(this.artifactDirectory, artifact.sha256)
      try {
        const existing = await readFile(objectPath)
        if (sha256(existing) !== artifact.sha256) throw new StagingStoreError('ARTIFACT_INTEGRITY_FAILURE', 503)
      } catch (error) {
        if (error.code !== 'ENOENT') throw error
        await writeFile(objectPath, content, { mode: 0o400, flag: 'wx' })
      }
      const artifactId = `art_staging_${randomUUID()}`
      const metadata = {
        artifact_id: artifactId,
        work_order_id: workOrderId,
        artifact_type: artifact.artifact_type,
        immutable_uri: `staging/artifacts/sha256/${artifact.sha256}`,
        sha256: artifact.sha256,
        byte_count: artifact.byte_count,
        producer: leaseOwner,
        attempt: order.attempt_count,
        sensitivity_classification: artifact.sensitivity_classification,
        retention_status: `delete-after-${this.retentionDays}-days`,
        created_at: new Date(this.clock()).toISOString(),
      }
      state.artifacts[artifactId] = metadata
      const prior = order.status
      order.status = 'RUNNING'
      order.updated_at = new Date(this.clock()).toISOString()
      this._appendEvent(state, { workOrderId, fromStatus: prior, toStatus: 'RUNNING', code: 'ARTIFACT_STORED', actor: leaseOwner, metadata: { artifact_id: artifactId, artifact_type: artifact.artifact_type, sha256: artifact.sha256 } })
      await this._write(state)
      const roundTrip = await readFile(objectPath)
      if (sha256(roundTrip) !== artifact.sha256) throw new StagingStoreError('ARTIFACT_INTEGRITY_FAILURE', 503)
      return structuredClone(metadata)
    })
  }

  async complete(workOrderId, { leaseOwner, leaseToken, resultArtifactId, evidenceArtifactId, decisionCardArtifactId }) {
    return this._exclusive(async () => {
      const state = await this._readVerified()
      const order = state.work_orders[workOrderId]
      if (!order) throw new StagingStoreError('WORK_ORDER_NOT_FOUND', 404)
      if (order.status === 'COMPLETED') {
        if (order.result_artifact_id === resultArtifactId && order.evidence_artifact_id === evidenceArtifactId && order.decision_card_artifact_id === decisionCardArtifactId) return publicOrder(order)
        throw new StagingStoreError('COMPLETION_CONFLICT', 409)
      }
      this._requireLease(order, leaseToken)
      if (order.lease_owner !== leaseOwner) throw new StagingStoreError('WRONG_LEASE_OWNER', 403)
      const artifacts = Object.values(state.artifacts).filter((artifact) => artifact.work_order_id === workOrderId)
      const types = new Set(artifacts.map((artifact) => artifact.artifact_type))
      const missing = order.required_artifacts.filter((type) => !types.has(type))
      if (missing.length) {
        const prior = order.status
        Object.assign(order, { status: 'BLOCKED', blocker_code: 'REQUIRED_ARTIFACT_MISSING', next_action: 'UPLOAD_REQUIRED_ARTIFACTS', lease_owner: null, lease_token_hash: null, lease_expires_at: null, heartbeat_at: null, updated_at: new Date(this.clock()).toISOString() })
        this._appendEvent(state, { workOrderId, fromStatus: prior, toStatus: 'BLOCKED', code: 'REQUIRED_ARTIFACT_MISSING', actor: leaseOwner, metadata: { missing_artifact_types: missing } })
        await this._write(state)
        throw new StagingStoreError('REQUIRED_ARTIFACT_MISSING', 409)
      }
      for (const artifactId of [resultArtifactId, evidenceArtifactId, decisionCardArtifactId]) {
        if (!state.artifacts[artifactId] || state.artifacts[artifactId].work_order_id !== workOrderId) {
          const prior = order.status
          Object.assign(order, { status: 'BLOCKED', blocker_code: 'RETURN_CHANNEL_INCOMPLETE', next_action: 'REBUILD_RETURN_CHANNEL', lease_owner: null, lease_token_hash: null, lease_expires_at: null, heartbeat_at: null, updated_at: new Date(this.clock()).toISOString() })
          this._appendEvent(state, { workOrderId, fromStatus: prior, toStatus: 'BLOCKED', code: 'RETURN_CHANNEL_INCOMPLETE', actor: leaseOwner })
          await this._write(state)
          throw new StagingStoreError('ARTIFACT_REFERENCE_INVALID', 409)
        }
      }
      const cardMetadata = state.artifacts[decisionCardArtifactId]
      if (cardMetadata.artifact_type !== 'decision_card') throw new StagingStoreError('DECISION_CARD_INVALID', 409)
      const cardContent = JSON.parse(await readFile(path.join(this.root, cardMetadata.immutable_uri), 'utf8'))
      const controls = cardContent.controls ?? {}
      // Server-side non-execution contract: a card with any enabled control is
      // never completable, and a card marked human_decision_required must carry
      // every control explicitly disabled. Protected actions stay disabled
      // regardless of the flag; no path may convert a card into an action.
      const controlViolation = cardContent.work_order_id !== workOrderId ? 'DECISION_CARD_INVALID'
        : controls.approve?.enabled !== false ? 'EXECUTOR_SELF_APPROVAL_REJECTED'
        : controls.reject?.enabled === true || controls.revise?.enabled === true ? 'PROTECTED_CONTROL_ENABLED'
        : cardContent.human_decision_required === true && (controls.reject?.enabled !== false || controls.revise?.enabled !== false) ? 'HUMAN_DECISION_CONTROL_UNVERIFIED'
        : null
      if (controlViolation) {
        const prior = order.status
        Object.assign(order, { status: 'BLOCKED', blocker_code: controlViolation, next_action: 'INDEPENDENT_REVIEW_REQUIRED', lease_owner: null, lease_token_hash: null, lease_expires_at: null, heartbeat_at: null, updated_at: new Date(this.clock()).toISOString() })
        this._appendEvent(state, { workOrderId, fromStatus: prior, toStatus: 'BLOCKED', code: controlViolation, actor: leaseOwner })
        await this._write(state)
        throw new StagingStoreError('DECISION_CARD_INVALID', 409)
      }
      const prior = order.status
      order.status = 'VERIFYING'
      order.updated_at = new Date(this.clock()).toISOString()
      this._appendEvent(state, { workOrderId, fromStatus: prior, toStatus: 'VERIFYING', code: 'RETURN_CHANNEL_VERIFYING', actor: leaseOwner })
      Object.assign(order, {
        status: 'COMPLETED',
        result_artifact_id: resultArtifactId,
        evidence_artifact_id: evidenceArtifactId,
        decision_card_artifact_id: decisionCardArtifactId,
        blocker_code: null,
        next_action: 'SUPERVISED_REVIEW_COMPLETE',
        lease_owner: null,
        lease_token_hash: null,
        lease_expires_at: null,
        heartbeat_at: null,
        updated_at: new Date(this.clock()).toISOString(),
      })
      state.decision_cards[workOrderId] = cardContent
      this._appendEvent(state, { workOrderId, fromStatus: 'VERIFYING', toStatus: 'COMPLETED', code: 'DECISION_CARD_PUBLISHED', actor: leaseOwner, metadata: { decision_card_artifact_id: decisionCardArtifactId } })
      await this._write(state)
      return publicOrder(order)
    })
  }

  async block(workOrderId, { leaseOwner, leaseToken, blockerCode, nextAction }) {
    return this._exclusive(async () => {
      const state = await this._readVerified()
      const order = state.work_orders[workOrderId]
      if (!order) throw new StagingStoreError('WORK_ORDER_NOT_FOUND', 404)
      if (!BLOCKABLE_STATES.has(order.status)) throw new StagingStoreError('INVALID_TRANSITION', 409)
      if (order.lease_token_hash) this._requireLease(order, leaseToken)
      if (order.lease_owner && order.lease_owner !== leaseOwner) throw new StagingStoreError('WRONG_LEASE_OWNER', 403)
      const prior = order.status
      Object.assign(order, { status: 'BLOCKED', blocker_code: blockerCode, next_action: nextAction, lease_owner: null, lease_token_hash: null, lease_expires_at: null, heartbeat_at: null, updated_at: new Date(this.clock()).toISOString() })
      this._appendEvent(state, { workOrderId, fromStatus: prior, toStatus: 'BLOCKED', code: blockerCode, actor: leaseOwner })
      await this._write(state)
      return publicOrder(order)
    })
  }

  async release(workOrderId, { leaseOwner, leaseToken }) {
    return this._exclusive(async () => {
      const state = await this._readVerified()
      const order = state.work_orders[workOrderId]
      if (!order) throw new StagingStoreError('WORK_ORDER_NOT_FOUND', 404)
      this._requireLease(order, leaseToken)
      if (order.lease_owner !== leaseOwner) throw new StagingStoreError('WRONG_LEASE_OWNER', 403)
      const prior = order.status
      Object.assign(order, { status: 'QUEUED', blocker_code: 'WAITING_FOR_ORCA', next_action: 'RECLAIM_AFTER_RECONNECT', lease_owner: null, lease_token_hash: null, lease_expires_at: null, heartbeat_at: null, updated_at: new Date(this.clock()).toISOString() })
      this._appendEvent(state, { workOrderId, fromStatus: prior, toStatus: 'QUEUED', code: 'ORCA_RELEASED', actor: leaseOwner })
      await this._write(state)
      return publicOrder(order)
    })
  }
}
