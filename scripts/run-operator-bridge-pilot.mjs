import { readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { LocalArtifactStore } from '../operator-bridge/artifact-store.mjs'
import { APPROVAL_CLASSES, DEFAULT_EXECUTION_ALLOWLIST } from '../operator-bridge/constants.mjs'
import { createDecisionCard } from '../operator-bridge/decision-card.mjs'
import { FableAdapter } from '../operator-bridge/fable-adapter.mjs'
import { GitHubReadOnlyCollector } from '../operator-bridge/github-collector.mjs'
import { KimiStreamingAdapter } from '../operator-bridge/kimi-streaming-adapter.mjs'
import { OrcaEdgeWorker } from '../operator-bridge/orca-edge-worker.mjs'
import { FileWorkOrderLedger } from '../operator-bridge/work-order-ledger.mjs'

const REPOSITORY = 'Motesart27/Deployable-python-codebase-som'
const PULL_REQUEST = 32
const EXPECTED_BASE = '15e4889b9a2ce9334755d471843e5bdf39faf430'

function parseArguments(argv) {
  const result = { root: path.resolve('.operator-bridge/pilot-pr32') }
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--root') result.root = path.resolve(argv[++index])
  }
  return result
}

async function loadGatewayConfig() {
  const secretsPath = path.join(os.homedir(), '.cli-proxy-api', 'motesart-secrets.env')
  const content = await readFile(secretsPath, 'utf8')
  const values = {}
  for (const rawLine of content.split(/\r?\n/)) {
    const match = rawLine.match(/^export\s+([A-Z0-9_]+)=(.*)$/)
    if (!match) continue
    values[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, '$2')
  }
  if (!values.CLIPROXY_CLIENT_KEY) throw new Error('LOCAL_GATEWAY_CREDENTIAL_UNAVAILABLE')
  const base = (values.CLIPROXY_BASE_URL ?? 'http://127.0.0.1:8317').replace(/\/$/, '')
  return { baseUrl: `${base}/v1`, apiKey: values.CLIPROXY_CLIENT_KEY }
}

function architecturePrompt(collection) {
  const hashes = collection.artifacts.map((artifact) => ({
    type: artifact.artifact_type,
    sha256: artifact.sha256,
    bytes: artifact.byte_count,
  }))
  return [
    'Perform a bounded read-only status review of a supervised Operator Bridge pilot workload.',
    'Do not claim access to the pull request or any system; analyze only this supplied metadata.',
    'Return at most 450 words with VERIFIED, INFERRED, UNKNOWN, RISKS, and NEXT SAFE ACTION sections.',
    `Repository: ${collection.repository}`,
    `Pull request: ${collection.pull_request}`,
    `Base SHA: ${collection.base_sha}`,
    `Head SHA: ${collection.head_sha}`,
    `State: ${collection.state}`,
    `Draft: ${collection.draft}`,
    `Changed files: ${collection.changed_file_count}`,
    `Collected artifact integrity metadata: ${JSON.stringify(hashes)}`,
    'This is advisory only. Do not recommend merge, deployment, credential changes, production mutation, or autonomy activation.',
  ].join('\n')
}

async function main() {
  const { root } = parseArguments(process.argv.slice(2))
  const timeline = []
  const record = (event, metadata = {}) => timeline.push({ timestamp_utc: new Date().toISOString(), event, ...metadata })
  const artifactStore = await new LocalArtifactStore({ root: path.join(root, 'artifacts') }).init()
  const ledger = await new FileWorkOrderLedger({ root: path.join(root, 'control-plane') }).init()
  const gateway = await loadGatewayConfig()
  const logger = { info: ({ event, ...metadata }) => record(event, metadata) }
  const githubCollector = new GitHubReadOnlyCollector({ artifactStore })
  const kimiAdapter = new KimiStreamingAdapter({
    artifactStore,
    baseUrl: gateway.baseUrl,
    model: 'kimi-k3',
    timeoutMs: 240_000,
    maxOutputTokens: 1600,
    maxAttempts: 1,
    logger,
  })
  const worker = new OrcaEdgeWorker({
    workerId: 'orca-local-supervised-phase1',
    ledger,
    githubCollector,
    kimiAdapter,
    artifactStore,
    environment: 'staging',
    executionAllowlist: DEFAULT_EXECUTION_ALLOWLIST,
  })
  const fableAdapter = new FableAdapter()

  const workOrder = await ledger.create({
    work_order_id: 'WO-MYA-BRIDGE-PR32-PHASE1',
    requested_by: 'Denarius Motes',
    originating_surface: 'Motesart-OS#21',
    task_type: 'github_pr_read_only_review',
    scope: { repository: REPOSITORY, pull_request: PULL_REQUEST, protected_writes: false },
    approval_class: APPROVAL_CLASSES.READ_ONLY,
    executor: 'ORCA',
    required_artifacts: ['repository_identity', 'pull_request_identity', 'diff', 'workflow_status', 'model_response', 'decision_card'],
    input_hashes: [],
    idempotency_key: `operator-bridge:v1:${REPOSITORY}:pr:${PULL_REQUEST}:supervised`,
    next_action: 'QUEUE_READ_ONLY_COLLECTION',
  })
  record('work_order_created', { work_order_id: workOrder.work_order_id })
  if (workOrder.status === 'DRAFT') await ledger.transition(workOrder.work_order_id, 'QUEUED', { actor: 'Denarius Motes', reason: 'SUPERVISED_READ_ONLY_QUEUE' })
  const claimed = await worker.execute({
    action: 'claim_work_order',
    payload: { work_order_id: workOrder.work_order_id, lease_ttl_ms: 300_000 },
  })
  record('work_order_claimed', { attempt: claimed.attempt_count, lease_owner: claimed.lease_owner })
  await ledger.transition(workOrder.work_order_id, 'RUNNING', {
    actor: worker.workerId,
    reason: 'SUPERVISED_EXECUTION_STARTED',
    leaseToken: claimed.lease_token,
  })

  const collection = await worker.execute({
    action: 'collect_github_read_only',
    payload: {
      repository: REPOSITORY,
      pullRequest: PULL_REQUEST,
      selectedFiles: [],
      workOrderId: workOrder.work_order_id,
      attempt: claimed.attempt_count,
    },
  })
  if (collection.base_sha !== EXPECTED_BASE) throw new Error('PR32_BASE_SHA_MISMATCH')
  record('github_collection_completed', {
    base_sha: collection.base_sha,
    head_sha: collection.head_sha,
    changed_file_count: collection.changed_file_count,
    artifact_count: collection.artifacts.length,
    exact_diff_source_hash: collection.diff_source_sha256,
    diff_redaction_count: collection.diff_redaction_count,
  })

  const kimiResult = await worker.execute({
    action: 'invoke_kimi_analysis',
    payload: {
      workOrderId: workOrder.work_order_id,
      sections: [{ id: 'pr32-status', title: 'PR #32 supervised status review', prompt: architecturePrompt(collection) }],
      apiKey: gateway.apiKey,
      attempt: claimed.attempt_count,
    },
  })
  record('kimi_analysis_completed', {
    model: kimiResult.model,
    response_byte_count: kimiResult.response_byte_count,
    response_hash: kimiResult.assembled_artifact.sha256,
  })

  const verifying = await worker.execute({
    action: 'return_result',
    payload: {
      work_order_id: workOrder.work_order_id,
      lease_token: claimed.lease_token,
      result_patch: {
        result_uri: kimiResult.assembled_artifact.immutable_relative_uri,
        result_hash: kimiResult.assembled_artifact.sha256,
        next_action: 'INVOKE_INDEPENDENT_VERIFIER',
      },
    },
  })
  const fableResult = await fableAdapter.review({
    work_order_id: workOrder.work_order_id,
    artifact_ids: collection.artifacts.map((artifact) => artifact.artifact_id).concat(kimiResult.assembled_artifact.artifact_id),
  })
  record('fable_adapter_result', { blocker_code: fableResult.blocker_code, resumable: fableResult.resumable })

  const projected = {
    ...verifying,
    status: 'BLOCKED',
    lease_owner: null,
    lease_expires_at: null,
    blocker_code: fableResult.blocker_code,
    next_action: fableResult.next_action,
  }
  const allArtifacts = [...collection.artifacts, kimiResult.assembled_artifact]
  const decisionCard = createDecisionCard({
    workOrder: projected,
    originatingInstruction: 'Issue #21 supervised read-only PR #32 orchestration proof',
    artifacts: allArtifacts,
    kimiResult: {
      model: kimiResult.model,
      streaming: kimiResult.streaming,
      response_hash: kimiResult.assembled_artifact.sha256,
      response_byte_count: kimiResult.response_byte_count,
      time_to_first_token_ms: kimiResult.sections[0].time_to_first_token_ms,
      duration_ms: kimiResult.sections[0].duration_ms,
    },
    codexResult: { status: 'PHASE_1_LOCAL_SLICE_EXECUTED', protected_writes: 0 },
    fableResult,
    blockingFindings: [{ code: fableResult.blocker_code, blocking: true }],
  })
  const cardArtifact = await artifactStore.putArtifact({
    workOrderId: workOrder.work_order_id,
    artifactType: 'decision_card',
    content: JSON.stringify(decisionCard, null, 2),
    producingExecutor: 'motesart-os-local-return-channel',
    attempt: claimed.attempt_count,
    sensitivity: 'public',
  })
  allArtifacts.push(cardArtifact)
  const blocked = await ledger.transition(workOrder.work_order_id, 'BLOCKED', {
    actor: 'fable-adapter',
    reason: fableResult.blocker_code,
    leaseToken: claimed.lease_token,
    patch: {
      blocker_code: fableResult.blocker_code,
      next_action: fableResult.next_action,
      evidence_uri: cardArtifact.immutable_relative_uri,
      evidence_hash: cardArtifact.sha256,
    },
  })
  record('work_order_blocked_resumably', { blocker_code: blocked.blocker_code, decision_card_hash: cardArtifact.sha256 })

  const events = await ledger.events(workOrder.work_order_id)
  const evidence = {
    schema_version: 'motesart.operator_bridge.pilot_evidence.v1',
    work_order: blocked,
    events,
    timeline,
    kimi_metadata: {
      model: kimiResult.model,
      streaming: kimiResult.streaming,
      sections: kimiResult.sections,
      response_byte_count: kimiResult.response_byte_count,
    },
    artifacts: allArtifacts,
    transport: { manual_artifact_movements: 0, outbound_orca: true, github_writes: 0, production_mutations: 0 },
  }
  const evidenceArtifact = await artifactStore.putArtifact({
    workOrderId: workOrder.work_order_id,
    artifactType: 'evidence_report',
    content: JSON.stringify(evidence, null, 2),
    producingExecutor: 'orca-local-supervised-phase1',
    attempt: claimed.attempt_count,
    sensitivity: 'public',
  })
  const summary = {
    status: blocked.status,
    blocker_code: blocked.blocker_code,
    work_order_id: blocked.work_order_id,
    pr_base_sha: collection.base_sha,
    pr_head_sha: collection.head_sha,
    github_artifact_count: collection.artifacts.length,
    exact_diff_source_hash: collection.diff_source_sha256,
    diff_redaction_count: collection.diff_redaction_count,
    kimi_model: kimiResult.model,
    kimi_streaming: kimiResult.streaming,
    kimi_time_to_first_token_ms: kimiResult.sections[0].time_to_first_token_ms,
    kimi_duration_ms: kimiResult.sections[0].duration_ms,
    kimi_response_hash: kimiResult.assembled_artifact.sha256,
    decision_card_hash: cardArtifact.sha256,
    evidence_hash: evidenceArtifact.sha256,
    manual_artifact_movements: 0,
    output_root: root,
  }
  await writeFile(path.join(root, 'PILOT_SUMMARY.json'), `${JSON.stringify(summary, null, 2)}\n`, { mode: 0o600 })
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({ status: 'PILOT_FAILED', error_code: error.code ?? error.name ?? 'UNKNOWN' })}\n`)
  process.exitCode = 1
})
