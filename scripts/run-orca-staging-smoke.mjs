import { execFile } from 'node:child_process'
import path from 'node:path'
import { promisify } from 'node:util'

import { writeExitEvidence } from '../operator-bridge/exit-evidence.mjs'
import { OrcaStagingWorker } from '../operator-bridge/orca-staging-worker.mjs'

const execFileAsync = promisify(execFile)
const baseUrl = 'https://operator-bridge-control-plane-staging.up.railway.app'
const previewOrigin = 'https://deploy-preview-22--motesart-os.netlify.app'
const exactHead = process.argv[process.argv.indexOf('--head') + 1]
if (!/^[a-f0-9]{40}$/.test(exactHead ?? '')) throw new Error('EXACT_HEAD_REQUIRED')
const evidenceArgument = process.argv.indexOf('--evidence')
const evidencePath = path.resolve(
  evidenceArgument >= 0 ? process.argv[evidenceArgument + 1] : '.operator-bridge/staging-smoke/STAGING_SMOKE_EXIT_EVIDENCE.json',
)

async function keychain(service) {
  const { stdout } = await execFileAsync('security', ['find-generic-password', '-w', '-a', 'operator-bridge-phase2a', '-s', service], { encoding: 'utf8', maxBuffer: 4096 })
  return stdout.trim()
}

async function ownerRequest(pathSuffix, { method = 'GET', token = null, body = null } = {}) {
  const headers = { origin: previewOrigin, 'x-motesart-preview-head': exactHead }
  if (token) headers.authorization = `Bearer ${token}`
  if (body) headers['content-type'] = 'application/json'
  const response = await fetch(`${baseUrl}${pathSuffix}`, { method, headers, body: body ? JSON.stringify(body) : undefined })
  const payload = await response.json()
  if (!response.ok) throw new Error(payload.error?.code ?? 'STAGING_REQUEST_FAILED')
  return payload
}

// Exit evidence is emitted on EVERY result — pass, failure, or signal. A
// mid-run throw can no longer leave the smoke run without evidence, and
// SIGINT/SIGTERM finalize with the signal recorded before exiting.
const startedAt = Date.now()
let settled = false
async function finalize(evidence, { exitCode = null } = {}) {
  if (settled) return undefined
  settled = true
  try {
    return await writeExitEvidence({
      filePath: evidencePath,
      evidence: {
        schema_version: 'motesart.operator_bridge.staging_smoke_exit.v1',
        environment: 'staging',
        base_url: baseUrl,
        exact_head: exactHead,
        started_at: new Date(startedAt).toISOString(),
        exited_at: new Date().toISOString(),
        duration_ms: Date.now() - startedAt,
        production_calls: 0,
        ...evidence,
      },
    })
  } finally {
    // The process must never hang without producing a terminal state: even if
    // the evidence write itself fails, the requested exit still happens.
    if (exitCode !== null) process.exit(exitCode)
  }
}
for (const [signalName, code] of [['SIGINT', 130], ['SIGTERM', 143]]) {
  process.once(signalName, () => {
    finalize({ status: 'STAGING_SMOKE_ABORTED', exit_reason: 'SIGNAL_SHUTDOWN', exit_detail: signalName }, { exitCode: code })
  })
}

async function main() {
  const ownerPassword = await keychain('mya-operator-bridge-staging-owner-password')
  const owner = await ownerRequest('/v1/auth/session', {
    method: 'POST',
    body: { owner_id: 'denarius-staging-owner', password: ownerPassword },
  })
  const created = await ownerRequest('/v1/work-orders', {
    method: 'POST',
    token: owner.token,
    body: {
      instruction: 'Run the synthetic Phase 2A staging control-plane smoke proof. Do not contact production.',
      originating_surface: 'motesart-os-netlify-preview',
      task_type: 'staging_smoke_test',
      scope: { data_class: 'synthetic', repository_head: exactHead, protected_writes: false },
      priority: 'normal',
      approval_class: 'READ_ONLY',
      executor: 'ORCA',
      idempotency_key: `phase2a-staging-smoke:${exactHead}`,
    },
  })

  const worker = new OrcaStagingWorker({
    baseUrl,
    workerId: 'orca-phase2a-staging-worker',
    bootstrapTokenProvider: () => keychain('mya-operator-bridge-staging-orca-bootstrap'),
    environment: 'staging',
  })
  const identity = await worker.authenticate()
  const claim = await worker.execute({ action: 'claim', payload: { work_order_id: created.work_order.work_order_id, capabilities: ['run_local_tests', 'package_artifacts', 'return_result'], lease_ttl_seconds: 60 } })
  if (!claim.claim || claim.claim.work_order.work_order_id !== created.work_order.work_order_id) throw new Error('STAGING_CLAIM_MISMATCH')
  const workOrderId = claim.claim.work_order.work_order_id
  const leaseToken = claim.claim.lease_token
  await worker.execute({ action: 'heartbeat', payload: { work_order_id: workOrderId, lease_token: leaseToken, lease_ttl_seconds: 60 } })
  const testLog = await worker.execute({ action: 'upload_artifact', payload: { work_order_id: workOrderId, lease_token: leaseToken, artifact_type: 'test_log', content: JSON.stringify({ synthetic: true, tests: 1, passed: 1, production_calls: 0 }), sensitivity_classification: 'synthetic' } })
  const cardContent = JSON.stringify({
    schema_version: 'motesart.operator_bridge.decision_card.v1',
    work_order_id: workOrderId,
    banner: 'SUPERVISED STAGING — NOT PRODUCTION',
    original_instruction: created.work_order.instruction,
    exact_repository_head: exactHead,
    kimi_result: { status: 'NOT_REQUIRED_FOR_CONTROL_PLANE_SMOKE' },
    codex_result: { status: 'SYNTHETIC_SMOKE_PASS' },
    fable_verdict: { status: 'NOT_REQUIRED_FOR_CONTROL_PLANE_SMOKE' },
    blocking_findings: [],
    nonblocking_findings: [],
    approval_class: 'READ_ONLY',
    next_action: 'INDEPENDENT_EXACT_HEAD_REVIEW',
    controls: { approve: { enabled: false }, reject: { enabled: false }, revise: { enabled: false } },
  })
  const decisionCard = await worker.execute({ action: 'upload_artifact', payload: { work_order_id: workOrderId, lease_token: leaseToken, artifact_type: 'decision_card', content: cardContent, sensitivity_classification: 'synthetic' } })
  await worker.execute({ action: 'complete', payload: { work_order_id: workOrderId, lease_token: leaseToken, result_artifact_id: testLog.artifact.artifact_id, evidence_artifact_id: testLog.artifact.artifact_id, decision_card_artifact_id: decisionCard.artifact.artifact_id } })
  const finalOrder = await ownerRequest(`/v1/work-orders/${encodeURIComponent(workOrderId)}`, { token: owner.token })
  const events = await ownerRequest(`/v1/work-orders/${encodeURIComponent(workOrderId)}/events`, { token: owner.token })
  const artifacts = await ownerRequest(`/v1/work-orders/${encodeURIComponent(workOrderId)}/artifacts`, { token: owner.token })
  const finalCard = await ownerRequest(`/v1/work-orders/${encodeURIComponent(workOrderId)}/decision-card`, { token: owner.token })

  const summary = {
    status: 'STAGING_SMOKE_PASS',
    banner: finalOrder.banner,
    work_order_id: workOrderId,
    final_status: finalOrder.work_order.status,
    orca_connection_model: (await worker.execute({ action: 'health' })).connection_model,
    orca_session_ttl_seconds: identity.expires_in_seconds,
    event_count: events.events.length,
    artifact_count: artifacts.artifacts.length,
    decision_card_available: finalCard.decision_card.work_order_id === workOrderId,
    manual_artifact_movements: 0,
    production_calls: 0,
  }
  await finalize({ ...summary, exit_reason: 'COMPLETED' })
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)
}

main().catch(async (error) => {
  await finalize({ status: 'STAGING_SMOKE_FAILED', exit_reason: 'ABNORMAL_EXIT', error_code: error.code ?? error.name ?? 'UNKNOWN' })
  process.stderr.write(`${JSON.stringify({ status: 'STAGING_SMOKE_FAILED', error_code: error.code ?? error.name ?? 'UNKNOWN' })}\n`)
  process.exitCode = 1
})
