import { EXECUTOR_ACTIONS } from './constants.mjs'
import { createStoredZip } from './zip-package.mjs'

// Forbidden command-like fields, aligned with the canonical staging worker
// and control-plane rejectForbidden sets. Applied recursively at every
// nested object or array depth; typed handlers never interpret such fields.
const FORBIDDEN_REMOTE_FIELDS = new Set(['command', 'shell', 'script', 'argv', 'executable', 'remote_command', 'remoteCommand', 'process'])

function rejectFreeFormCommand(value) {
  if (!value || typeof value !== 'object') return
  if (Array.isArray(value)) {
    for (const item of value) rejectFreeFormCommand(item)
    return
  }
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_REMOTE_FIELDS.has(key)) throw new Error('ARBITRARY_COMMAND_REJECTED')
    rejectFreeFormCommand(nested)
  }
}

export class OrcaEdgeWorker {
  constructor({ workerId, ledger, githubCollector, kimiAdapter, artifactStore, testProfiles = {}, testRunner = null }) {
    this.workerId = workerId
    this.ledger = ledger
    this.githubCollector = githubCollector
    this.kimiAdapter = kimiAdapter
    this.artifactStore = artifactStore
    this.testProfiles = testProfiles
    this.testRunner = testRunner
    this.startedAt = new Date().toISOString()
  }

  async execute(request) {
    if (!request || !EXECUTOR_ACTIONS.includes(request.action)) throw new Error('UNSUPPORTED_EXECUTOR_ACTION')
    rejectFreeFormCommand(request)
    switch (request.action) {
      case 'health':
        return { ok: true, worker_id: this.workerId, connection_model: 'OUTBOUND_ONLY', started_at: this.startedAt }
      case 'claim_work_order':
        return this.ledger.claim(request.payload.work_order_id, { leaseOwner: this.workerId, leaseTtlMs: request.payload.lease_ttl_ms })
      case 'heartbeat':
        return this.ledger.heartbeat(request.payload.work_order_id, {
          leaseOwner: this.workerId,
          leaseToken: request.payload.lease_token,
          leaseTtlMs: request.payload.lease_ttl_ms,
        })
      case 'collect_github_read_only':
        return this.githubCollector.collect(request.payload)
      case 'invoke_kimi_analysis':
        return this.kimiAdapter.analyzeSections(request.payload)
      case 'run_local_tests':
        return this._runLocalTests(request.payload)
      case 'package_artifacts':
        return this._packageManifest(request.payload)
      case 'return_result':
        return this.ledger.transition(request.payload.work_order_id, 'VERIFYING', {
          actor: this.workerId,
          reason: 'RESULT_RETURNED',
          leaseToken: request.payload.lease_token,
          patch: request.payload.result_patch ?? {},
        })
      case 'release_or_block_work_order':
        return this.ledger.transition(request.payload.work_order_id, request.payload.status, {
          actor: this.workerId,
          reason: request.payload.blocker_code ?? 'WORK_RELEASED',
          leaseToken: request.payload.lease_token,
          patch: { blocker_code: request.payload.blocker_code ?? null, next_action: request.payload.next_action },
        })
      default:
        throw new Error('UNSUPPORTED_EXECUTOR_ACTION')
    }
  }

  async _runLocalTests(payload) {
    const profile = this.testProfiles[payload.profile]
    if (!profile || !this.testRunner) throw new Error('UNSUPPORTED_TEST_PROFILE')
    return this.testRunner(profile)
  }

  async _packageManifest(payload) {
    const entries = []
    for (const artifact of payload.artifacts) {
      const content = await this.artifactStore.readArtifact(artifact)
      entries.push({ name: `${artifact.artifact_id}-${artifact.artifact_type}.bin`, content })
    }
    return this.artifactStore.putArtifact({
      workOrderId: payload.work_order_id,
      artifactType: 'zip_package',
      content: createStoredZip(entries),
      producingExecutor: this.workerId,
      attempt: payload.attempt,
      sensitivity: payload.sensitivity ?? 'public',
    })
  }
}
