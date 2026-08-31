import { STAGING_ENVIRONMENT } from './constants.mjs'

// Transport bridge: connects the bounded execution loop (BoundedWorkerSession
// over the local FileWorkOrderLedger) to the staging control plane through the
// typed OrcaStagingWorker transport. The bridge owns exactly two seams:
//
//   intakeOne()  — claim ONE order from the staging control plane, mirror it
//                  into the local ledger (idempotent, deduplicated by the
//                  remote work-order id), and keep the remote lease alive
//                  with heartbeats while the bounded loop executes it.
//   deliver()    — after the bounded loop finishes an order, upload the real
//                  result/evidence/decision-card artifacts through the
//                  transport and settle the remote order: `complete` only for
//                  a RESOLVED passing independent review, `block` otherwise.
//
// Everything else — auth, host pinning, typed-action allowlist, forbidden
// command-field rejection — stays inside OrcaStagingWorker, and the bounded
// contract (order cap, clocks, one-worker lock, no retry) stays inside
// BoundedWorkerSession. The bridge never widens either contract.

export class OrcaTransportBridgeError extends Error {
  constructor(code, message) {
    super(message ?? code)
    this.name = 'OrcaTransportBridgeError'
    this.code = code
  }
}

// An unresolved or failing independent review may NEVER settle a remote order
// as complete. This decision is pure and fail-closed: `complete` requires an
// explicit resolved PASS with zero blocking findings; every other shape —
// missing review, unresolved review, blocking findings, unknown status —
// settles as `block` with a stable blocker code.
export function resolveDeliveryDecision(review) {
  if (!review || typeof review !== 'object') {
    return { settle: 'block', blocker_code: 'INDEPENDENT_REVIEW_MISSING', next_action: 'INVOKE_INDEPENDENT_VERIFIER' }
  }
  const blockingFindings = Array.isArray(review.blocking_findings) ? review.blocking_findings : []
  if (review.resolved !== true) {
    return {
      settle: 'block',
      blocker_code: review.blocker_code ?? 'INDEPENDENT_REVIEW_UNRESOLVED',
      next_action: review.next_action ?? 'HUMAN_REVIEW_REQUIRED_NO_AUTOMATIC_RETRY',
    }
  }
  if (review.status !== 'PASS' || blockingFindings.length > 0) {
    return {
      settle: 'block',
      blocker_code: review.blocker_code ?? 'INDEPENDENT_REVIEW_NOT_PASS',
      next_action: review.next_action ?? 'HUMAN_REVIEW_REQUIRED_NO_AUTOMATIC_RETRY',
    }
  }
  return { settle: 'complete' }
}

// Exact intake binding (MOS-ORCA-TRANSPORT-BINDING-C1-01). intakeOne() only
// runs with a complete expected-order binding: the claim names the exact
// remote work-order id, and the claimed order must match the binding on every
// field below or the lease is released immediately and intake fails closed.
export const INTAKE_BINDING_FIELDS = Object.freeze([
  'work_order_id',
  'task_type',
  'approval_class',
  'repository',
  'pull_request',
])

export function assertIntakeBinding(binding) {
  if (!binding || typeof binding !== 'object') {
    throw new OrcaTransportBridgeError('INTAKE_BINDING_REQUIRED', 'intakeOne requires an exact expected-order binding')
  }
  for (const field of ['work_order_id', 'task_type', 'approval_class', 'repository']) {
    if (typeof binding[field] !== 'string' || binding[field].trim() === '') {
      throw new OrcaTransportBridgeError('INTAKE_BINDING_REQUIRED', `Binding field ${field} must be a non-empty string`)
    }
  }
  if (!Number.isSafeInteger(binding.pull_request) || binding.pull_request <= 0) {
    throw new OrcaTransportBridgeError('INTAKE_BINDING_REQUIRED', 'Binding field pull_request must be a positive integer')
  }
}

export function bindingMismatches(binding, remoteOrder) {
  const scope = remoteOrder?.scope ?? {}
  const mismatches = []
  if (remoteOrder?.work_order_id !== binding.work_order_id) mismatches.push('work_order_id')
  if (remoteOrder?.task_type !== binding.task_type) mismatches.push('task_type')
  if (remoteOrder?.approval_class !== binding.approval_class) mismatches.push('approval_class')
  if (scope.repository !== binding.repository) mismatches.push('scope.repository')
  if (scope.pull_request !== binding.pull_request) mismatches.push('scope.pull_request')
  return mismatches
}

export class OrcaTransportBridge {
  constructor({
    transport,
    ledger,
    artifactStore,
    environment = STAGING_ENVIRONMENT,
    heartbeatMs = 20_000,
    leaseTtlSeconds = 60,
    capabilities = ['run_local_tests', 'package_artifacts', 'return_result'],
    clock = () => Date.now(),
    logger = null,
  }) {
    if (environment !== STAGING_ENVIRONMENT) {
      throw new OrcaTransportBridgeError('BRIDGE_ENVIRONMENT_REJECTED', 'The transport bridge operates against staging only')
    }
    if (!transport || typeof transport.execute !== 'function') {
      throw new OrcaTransportBridgeError('BRIDGE_CONFIG_INVALID', 'A typed transport with execute() is required')
    }
    if (!ledger || !artifactStore) {
      throw new OrcaTransportBridgeError('BRIDGE_CONFIG_INVALID', 'ledger and artifactStore are required')
    }
    if (!Number.isInteger(heartbeatMs) || heartbeatMs <= 0) {
      throw new OrcaTransportBridgeError('BRIDGE_CONFIG_INVALID', 'heartbeatMs must be a positive integer')
    }
    this.transport = transport
    this.ledger = ledger
    this.artifactStore = artifactStore
    this.environment = environment
    this.heartbeatMs = heartbeatMs
    this.leaseTtlSeconds = leaseTtlSeconds
    this.capabilities = capabilities
    this.clock = clock
    this.logger = logger
    // remote work_order_id -> { leaseToken, heartbeatTimer, leaseLost }
    this.remoteLeases = new Map()
  }

  _log(event, metadata = {}) {
    this.logger?.info?.({ event, ...metadata })
  }

  // Claim exactly the bound order from the staging control plane and mirror
  // it into the local ledger so the bounded loop can pick it up through its
  // normal eligibility, claim, and clock machinery. Mirroring is idempotent:
  // the remote work-order id is reused verbatim and doubles as the
  // idempotency key, so a re-claimed or re-seen order can never create a
  // duplicate. Guards, in order and all fail-closed:
  //   1. A complete binding is required before any network or ledger access.
  //   2. The local ledger may hold no order other than the bound one — a
  //      stale locally queued order would otherwise be picked up by the
  //      bounded loop in place of the claimed remote order.
  //   3. A claimed order that does not match the binding exactly is released
  //      back to the control plane immediately and intake throws; it is never
  //      mirrored and never heartbeated.
  // An empty claim is null — never a substitute order.
  async intakeOne(binding) {
    assertIntakeBinding(binding)
    const existing = await this.ledger.list()
    const stale = existing.filter((order) => order.work_order_id !== binding.work_order_id)
    if (stale.length > 0) {
      throw new OrcaTransportBridgeError(
        'LOCAL_LEDGER_NOT_ISOLATED',
        `Local ledger already holds ${stale.length} unrelated order(s); each run requires a fresh isolated ledger`,
      )
    }
    const claim = await this.transport.execute({
      action: 'claim',
      payload: { work_order_id: binding.work_order_id, capabilities: this.capabilities, lease_ttl_seconds: this.leaseTtlSeconds },
    })
    if (!claim?.claim) return null
    const remoteOrder = claim.claim.work_order
    const leaseToken = claim.claim.lease_token
    if (typeof remoteOrder?.work_order_id !== 'string' || typeof leaseToken !== 'string') {
      throw new OrcaTransportBridgeError('TRANSPORT_CLAIM_MALFORMED', 'Claim response missing work order or lease token')
    }
    const mismatches = bindingMismatches(binding, remoteOrder)
    if (mismatches.length > 0) {
      try {
        await this.transport.execute({
          action: 'release',
          payload: { work_order_id: remoteOrder.work_order_id, lease_token: leaseToken },
        })
      } catch (error) {
        this._log('transport_mismatch_release_failed', { work_order_id: remoteOrder.work_order_id, error_code: error?.code ?? 'UNKNOWN' })
      }
      throw new OrcaTransportBridgeError(
        'TRANSPORT_CLAIM_BINDING_MISMATCH',
        `Claimed order does not match the expected binding: ${mismatches.join(', ')}`,
      )
    }
    const mirrored = await this.ledger.create({
      work_order_id: remoteOrder.work_order_id,
      requested_by: remoteOrder.requested_by ?? 'staging-control-plane',
      originating_surface: remoteOrder.originating_surface ?? 'staging-control-plane',
      task_type: remoteOrder.task_type,
      scope: remoteOrder.scope ?? {},
      approval_class: remoteOrder.approval_class,
      executor: remoteOrder.executor ?? 'ORCA',
      idempotency_key: `orca-transport:${remoteOrder.work_order_id}`,
      status: 'QUEUED',
      next_action: 'BOUNDED_EXECUTION',
    })
    this._startHeartbeat(remoteOrder.work_order_id, leaseToken)
    this._log('transport_order_mirrored', { work_order_id: remoteOrder.work_order_id })
    return { order: mirrored, leaseToken }
  }

  _startHeartbeat(workOrderId, leaseToken) {
    this._stopHeartbeat(workOrderId)
    const entry = { leaseToken, heartbeatTimer: null, leaseLost: false }
    entry.heartbeatTimer = setInterval(() => {
      this.transport
        .execute({
          action: 'heartbeat',
          payload: { work_order_id: workOrderId, lease_token: leaseToken, lease_ttl_seconds: this.leaseTtlSeconds },
        })
        .catch((error) => {
          // A lost remote lease is recorded, never retried: delivery will
          // refuse to settle and the order stays with the control plane's
          // canonical reclaim pathway.
          entry.leaseLost = true
          this._log('transport_heartbeat_failed', { work_order_id: workOrderId, error_code: error?.code ?? 'UNKNOWN' })
          this._stopHeartbeat(workOrderId, { keepEntry: true })
        })
    }, this.heartbeatMs)
    entry.heartbeatTimer.unref?.()
    this.remoteLeases.set(workOrderId, entry)
  }

  _stopHeartbeat(workOrderId, { keepEntry = false } = {}) {
    const entry = this.remoteLeases.get(workOrderId)
    if (!entry) return
    if (entry.heartbeatTimer) clearInterval(entry.heartbeatTimer)
    entry.heartbeatTimer = null
    if (!keepEntry) this.remoteLeases.delete(workOrderId)
  }

  _requireLease(workOrderId) {
    const entry = this.remoteLeases.get(workOrderId)
    if (!entry) throw new OrcaTransportBridgeError('TRANSPORT_LEASE_UNKNOWN', 'No remote lease is held for this work order')
    if (entry.leaseLost) throw new OrcaTransportBridgeError('TRANSPORT_LEASE_LOST', 'The remote lease was lost; the control plane will reclaim the order')
    return entry
  }

  // Upload one locally produced artifact through the transport, reading its
  // real bytes from the local artifact store. Returns the remote artifact
  // record from the control plane.
  async _uploadArtifact(workOrderId, leaseToken, artifact) {
    const content = await this.artifactStore.readArtifact(artifact)
    const uploaded = await this.transport.execute({
      action: 'upload_artifact',
      payload: {
        work_order_id: workOrderId,
        lease_token: leaseToken,
        artifact_type: artifact.artifact_type,
        content,
        sensitivity_classification: artifact.sensitivity ?? artifact.sensitivity_classification ?? 'synthetic',
      },
    })
    return uploaded.artifact
  }

  // Settle one finished bounded order with the staging control plane. All
  // three canonical artifacts travel through the transport as their real
  // bytes; settlement is decided by resolveDeliveryDecision and can only be
  // `complete` for a resolved passing independent review.
  async deliver({ workOrderId, resultArtifact, evidenceArtifact, decisionCardArtifact, review }) {
    const entry = this._requireLease(workOrderId)
    const leaseToken = entry.leaseToken
    const decision = resolveDeliveryDecision(review)
    const remoteResult = await this._uploadArtifact(workOrderId, leaseToken, resultArtifact)
    const remoteEvidence = await this._uploadArtifact(workOrderId, leaseToken, evidenceArtifact)
    const remoteCard = await this._uploadArtifact(workOrderId, leaseToken, decisionCardArtifact)
    if (decision.settle === 'complete') {
      await this.transport.execute({
        action: 'complete',
        payload: {
          work_order_id: workOrderId,
          lease_token: leaseToken,
          result_artifact_id: remoteResult.artifact_id,
          evidence_artifact_id: remoteEvidence.artifact_id,
          decision_card_artifact_id: remoteCard.artifact_id,
        },
      })
    } else {
      await this.transport.execute({
        action: 'block',
        payload: {
          work_order_id: workOrderId,
          lease_token: leaseToken,
          blocker_code: decision.blocker_code,
          next_action: decision.next_action,
        },
      })
    }
    this._stopHeartbeat(workOrderId)
    this._log('transport_order_settled', {
      work_order_id: workOrderId,
      settlement: decision.settle,
      blocker_code: decision.blocker_code ?? null,
    })
    return {
      settlement: decision.settle,
      blocker_code: decision.blocker_code ?? null,
      remote_artifacts: {
        result_artifact_id: remoteResult.artifact_id,
        evidence_artifact_id: remoteEvidence.artifact_id,
        decision_card_artifact_id: remoteCard.artifact_id,
      },
    }
  }

  // Stop-control pathway: an aborted or shut-down order is released back to
  // the control plane (never completed, never retried here).
  async releaseRemote(workOrderId) {
    const entry = this.remoteLeases.get(workOrderId)
    if (!entry) return { released: false, reason: 'NO_LEASE_HELD' }
    this._stopHeartbeat(workOrderId, { keepEntry: true })
    try {
      if (!entry.leaseLost) {
        await this.transport.execute({
          action: 'release',
          payload: { work_order_id: workOrderId, lease_token: entry.leaseToken },
        })
      }
      return { released: !entry.leaseLost, reason: entry.leaseLost ? 'LEASE_ALREADY_LOST' : 'RELEASED' }
    } finally {
      this.remoteLeases.delete(workOrderId)
    }
  }

  // Terminal cleanup for the owning script: every heartbeat stops, every
  // still-held lease is released. Safe to call multiple times.
  async close() {
    const results = []
    for (const workOrderId of [...this.remoteLeases.keys()]) {
      results.push({ work_order_id: workOrderId, ...(await this.releaseRemote(workOrderId)) })
    }
    return results
  }
}
