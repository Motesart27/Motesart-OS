import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { BLOCKER_CODES, TERMINAL_STATES, TRANSITIONS, WORK_ORDER_STATES } from './constants.mjs'

const REQUIRED_FIELDS = [
  'work_order_id',
  'requested_by',
  'originating_surface',
  'task_type',
  'scope',
  'approval_class',
  'executor',
  'required_artifacts',
  'input_hashes',
  'status',
  'lease_owner',
  'lease_expires_at',
  'attempt_count',
  'idempotency_key',
  'result_uri',
  'result_hash',
  'evidence_uri',
  'evidence_hash',
  'blocker_code',
  'next_action',
  'created_at',
  'updated_at',
]

export class WorkOrderError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'WorkOrderError'
    this.code = code
  }
}

function iso(now) {
  return new Date(now).toISOString()
}

function assertWorkOrder(order) {
  const missing = REQUIRED_FIELDS.filter((field) => !(field in order))
  if (missing.length) throw new WorkOrderError('INVALID_WORK_ORDER', `Missing fields: ${missing.join(', ')}`)
  if (!WORK_ORDER_STATES.includes(order.status)) throw new WorkOrderError('INVALID_STATUS', 'Unknown work-order status')
  if (!order.work_order_id || !order.idempotency_key || !order.executor) {
    throw new WorkOrderError('INVALID_WORK_ORDER', 'Identifiers and executor are required')
  }
}

export class FileWorkOrderLedger {
  constructor({ root, clock = () => Date.now(), artifactVerifier = null }) {
    this.root = root
    this.clock = clock
    this.artifactVerifier = artifactVerifier
    this.statePath = path.join(root, 'ledger.json')
    this._tail = Promise.resolve()
  }

  async init() {
    await mkdir(this.root, { recursive: true })
    try {
      await readFile(this.statePath, 'utf8')
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
      await this._write({ version: 1, work_orders: {}, idempotency: {}, events: [] })
    }
    return this
  }

  async _read() {
    return JSON.parse(await readFile(this.statePath, 'utf8'))
  }

  async _write(state) {
    const temporary = `${this.statePath}.${process.pid}.${randomUUID()}.tmp`
    await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 })
    await rename(temporary, this.statePath)
  }

  _exclusive(operation) {
    const next = this._tail.then(operation, operation)
    this._tail = next.catch(() => undefined)
    return next
  }

  async create(input) {
    return this._exclusive(async () => {
      const state = await this._read()
      const existingId = state.idempotency[input.idempotency_key]
      if (existingId) return structuredClone(state.work_orders[existingId])
      const now = iso(this.clock())
      const workOrder = {
        work_order_id: input.work_order_id ?? randomUUID(),
        requested_by: input.requested_by,
        originating_surface: input.originating_surface,
        task_type: input.task_type,
        scope: input.scope,
        approval_class: input.approval_class,
        executor: input.executor,
        required_artifacts: input.required_artifacts ?? [],
        input_hashes: input.input_hashes ?? [],
        status: input.status ?? 'DRAFT',
        lease_owner: null,
        lease_token: null,
        lease_expires_at: null,
        heartbeat_at: null,
        attempt_count: 0,
        idempotency_key: input.idempotency_key,
        result_uri: null,
        result_hash: null,
        evidence_uri: null,
        evidence_hash: null,
        blocker_code: null,
        next_action: input.next_action ?? 'REVIEW_AND_QUEUE',
        created_at: now,
        updated_at: now,
      }
      assertWorkOrder(workOrder)
      if (state.work_orders[workOrder.work_order_id]) {
        throw new WorkOrderError('DUPLICATE_WORK_ORDER_ID', 'Work-order ID already exists')
      }
      state.work_orders[workOrder.work_order_id] = workOrder
      state.idempotency[workOrder.idempotency_key] = workOrder.work_order_id
      state.events.push(this._event(workOrder, null, workOrder.status, 'CREATE', input.requested_by))
      await this._write(state)
      return structuredClone(workOrder)
    })
  }

  _event(order, from, to, reason, actor, detail = {}) {
    return {
      event_id: randomUUID(),
      work_order_id: order.work_order_id,
      from_status: from,
      to_status: to,
      reason_code: reason,
      actor,
      detail,
      created_at: iso(this.clock()),
    }
  }

  async get(workOrderId) {
    const state = await this._read()
    const order = state.work_orders[workOrderId]
    if (!order) throw new WorkOrderError('WORK_ORDER_NOT_FOUND', 'Work order not found')
    return structuredClone(order)
  }

  async events(workOrderId) {
    const state = await this._read()
    return state.events
      .filter((event) => event.work_order_id === workOrderId)
      .map((event) => structuredClone(event))
  }

  async transition(workOrderId, nextStatus, { actor, reason = 'STATE_TRANSITION', patch = {}, leaseToken } = {}) {
    return this._exclusive(async () => {
      const state = await this._read()
      const order = state.work_orders[workOrderId]
      if (!order) throw new WorkOrderError('WORK_ORDER_NOT_FOUND', 'Work order not found')
      if (nextStatus === 'COMPLETED') {
        throw new WorkOrderError('COMPLETION_REQUIRES_CANONICAL_PATH', 'COMPLETED requires completeIdempotently with canonical artifact verification')
      }
      if (!TRANSITIONS[order.status]?.has(nextStatus)) {
        throw new WorkOrderError('INVALID_TRANSITION', `${order.status} cannot transition to ${nextStatus}`)
      }
      if (order.lease_token && leaseToken !== order.lease_token) {
        throw new WorkOrderError('LEASE_MISMATCH', 'Active lease token is required')
      }
      const prior = order.status
      Object.assign(order, patch, { status: nextStatus, updated_at: iso(this.clock()) })
      if (TERMINAL_STATES.has(nextStatus) || ['QUEUED', 'BLOCKED', 'READY_FOR_APPROVAL'].includes(nextStatus)) {
        order.lease_owner = null
        order.lease_token = null
        order.lease_expires_at = null
        order.heartbeat_at = null
      }
      assertWorkOrder(order)
      state.events.push(this._event(order, prior, nextStatus, reason, actor ?? 'system'))
      await this._write(state)
      return structuredClone(order)
    })
  }

  async claim(workOrderId, { leaseOwner, leaseTtlMs = 60_000 }) {
    return this._exclusive(async () => {
      const state = await this._read()
      const order = state.work_orders[workOrderId]
      if (!order) throw new WorkOrderError('WORK_ORDER_NOT_FOUND', 'Work order not found')
      if (order.status !== 'QUEUED') throw new WorkOrderError('NOT_CLAIMABLE', 'Work order is not queued')
      const prior = order.status
      const now = this.clock()
      order.status = 'CLAIMED'
      order.lease_owner = leaseOwner
      order.lease_token = randomUUID()
      order.lease_expires_at = iso(now + leaseTtlMs)
      order.heartbeat_at = iso(now)
      order.attempt_count += 1
      order.updated_at = iso(now)
      order.blocker_code = null
      order.next_action = 'START_EXECUTION'
      state.events.push(this._event(order, prior, order.status, 'LEASE_CLAIMED', leaseOwner))
      await this._write(state)
      return structuredClone(order)
    })
  }

  async heartbeat(workOrderId, { leaseOwner, leaseToken, leaseTtlMs = 60_000 }) {
    return this._exclusive(async () => {
      const state = await this._read()
      const order = state.work_orders[workOrderId]
      if (!order || !['CLAIMED', 'RUNNING'].includes(order.status)) {
        throw new WorkOrderError('LEASE_NOT_ACTIVE', 'Active lease not found')
      }
      if (order.lease_owner !== leaseOwner || order.lease_token !== leaseToken) {
        throw new WorkOrderError('LEASE_MISMATCH', 'Lease owner or token mismatch')
      }
      const now = this.clock()
      if (Date.parse(order.lease_expires_at) <= now) throw new WorkOrderError('LEASE_EXPIRED', 'Lease has expired')
      order.heartbeat_at = iso(now)
      order.lease_expires_at = iso(now + leaseTtlMs)
      order.updated_at = iso(now)
      state.events.push(this._event(order, order.status, order.status, 'LEASE_HEARTBEAT', leaseOwner))
      await this._write(state)
      return structuredClone(order)
    })
  }

  async reclaimExpired({ actor = 'lease-reclaimer' } = {}) {
    return this._exclusive(async () => {
      const state = await this._read()
      const reclaimed = []
      const now = this.clock()
      for (const order of Object.values(state.work_orders)) {
        if (!['CLAIMED', 'RUNNING'].includes(order.status) || Date.parse(order.lease_expires_at) > now) continue
        const prior = order.status
        order.status = 'QUEUED'
        order.lease_owner = null
        order.lease_token = null
        order.lease_expires_at = null
        order.heartbeat_at = null
        order.blocker_code = BLOCKER_CODES.LEASE_EXPIRED
        order.next_action = 'RECLAIM_BY_EXECUTOR'
        order.updated_at = iso(now)
        state.events.push(this._event(order, prior, 'QUEUED', 'LEASE_EXPIRED_RECLAIMED', actor))
        reclaimed.push(structuredClone(order))
      }
      if (reclaimed.length) await this._write(state)
      return reclaimed
    })
  }

  async blockForOfflineExecutor(workOrderId, { executor }) {
    const order = await this.get(workOrderId)
    if (order.status === 'BLOCKED' && order.blocker_code === BLOCKER_CODES.WAITING_FOR_ORCA) return order
    return this.transition(workOrderId, 'BLOCKED', {
      actor: 'control-plane',
      reason: BLOCKER_CODES.WAITING_FOR_ORCA,
      patch: { blocker_code: BLOCKER_CODES.WAITING_FOR_ORCA, next_action: `WAIT_FOR_${executor}` },
    })
  }

  async resumeAfterExecutorReconnect(workOrderId, { executor }) {
    const order = await this.get(workOrderId)
    if (order.status !== 'BLOCKED' || order.blocker_code !== BLOCKER_CODES.WAITING_FOR_ORCA) {
      throw new WorkOrderError('NOT_WAITING_FOR_EXECUTOR', 'Work order is not waiting for an executor')
    }
    return this.transition(workOrderId, 'QUEUED', {
      actor: executor,
      reason: 'EXECUTOR_RECONNECTED',
      patch: { blocker_code: null, next_action: 'CLAIM_WORK_ORDER' },
    })
  }

  async _verifyRequiredArtifacts(order, { resultHash, evidenceHash }) {
    if (!Array.isArray(order.required_artifacts) || order.required_artifacts.length === 0) return
    if (!this.artifactVerifier) {
      throw new WorkOrderError('REQUIRED_ARTIFACT_UNVERIFIABLE', 'Required artifacts cannot be verified without an artifact verifier')
    }
    const artifacts = await this.artifactVerifier(order.work_order_id)
    if (!Array.isArray(artifacts)) throw new WorkOrderError('REQUIRED_ARTIFACT_UNVERIFIABLE', 'Artifact verifier returned an invalid result')
    const owned = artifacts.filter((artifact) => artifact.work_order_id === order.work_order_id)
    const presentTypes = new Set(owned.map((artifact) => artifact.artifact_type))
    const missing = order.required_artifacts.filter((type) => !presentTypes.has(type))
    if (missing.length) throw new WorkOrderError('REQUIRED_ARTIFACT_MISSING', `Missing required artifacts: ${missing.join(', ')}`)
    const ownedHashes = new Set(owned.map((artifact) => artifact.sha256))
    if (!ownedHashes.has(resultHash) || !ownedHashes.has(evidenceHash)) {
      throw new WorkOrderError('ARTIFACT_REFERENCE_INVALID', 'Completion references artifacts that do not belong to this work order')
    }
  }

  async completeIdempotently(workOrderId, { actor, resultUri, resultHash, evidenceUri, evidenceHash, leaseToken }) {
    return this._exclusive(async () => {
      const state = await this._read()
      const order = state.work_orders[workOrderId]
      if (!order) throw new WorkOrderError('WORK_ORDER_NOT_FOUND', 'Work order not found')
      if (order.status === 'COMPLETED') {
        if (order.result_hash === resultHash && order.evidence_hash === evidenceHash) return structuredClone(order)
        throw new WorkOrderError('COMPLETION_CONFLICT', 'Completed result differs')
      }
      // Validation and the committed transition share this atomic write
      // boundary: the lease/fencing identity and the required-artifact
      // contract are revalidated against the state being committed.
      if (!TRANSITIONS[order.status]?.has('COMPLETED')) {
        throw new WorkOrderError('INVALID_TRANSITION', `${order.status} cannot transition to COMPLETED`)
      }
      if (order.lease_token && leaseToken !== order.lease_token) {
        throw new WorkOrderError('LEASE_MISMATCH', 'Active lease token is required')
      }
      await this._verifyRequiredArtifacts(order, { resultHash, evidenceHash })
      const prior = order.status
      Object.assign(order, {
        status: 'COMPLETED',
        result_uri: resultUri,
        result_hash: resultHash,
        evidence_uri: evidenceUri,
        evidence_hash: evidenceHash,
        blocker_code: null,
        next_action: 'HUMAN_REVIEW_COMPLETE',
        lease_owner: null,
        lease_token: null,
        lease_expires_at: null,
        heartbeat_at: null,
        updated_at: iso(this.clock()),
      })
      assertWorkOrder(order)
      state.events.push(this._event(order, prior, 'COMPLETED', 'IDEMPOTENT_COMPLETION', actor ?? 'system'))
      await this._write(state)
      return structuredClone(order)
    })
  }
}
