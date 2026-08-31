#!/usr/bin/env node
// Smallest one-job, read-only, transport-connected staging pilot.
//
// This is the closure of the gap Codex identified at bb1e223e: the bounded
// execution loop (run-bounded-worker-pilot) previously ran only against a
// LOCAL ledger/artifact store, while the staging transport smoke
// (run-orca-staging-smoke) moved only SYNTHETIC evidence. This pilot runs the
// same bounded loop — one-worker lock, session/order clocks, allowlists, no
// retry, exit evidence — against ONE real order claimed from the staging
// control plane, executes the real read-only review work locally, and returns
// the real artifacts to MYA through the typed OrcaStagingWorker transport.
//
// Bounds beyond the standard bounded-worker contract: exactly ONE order per
// session (maxOrdersPerSession=1), READ_ONLY approval class only, staging
// host pin only, and an explicit activation gate — without
// --confirm-staging-pilot the script prints the gate and exits 3 without
// touching the network or the keychain.
//
// MOS-ORCA-TRANSPORT-BINDING-C1-01 correction: the pilot claims only an
// EXACTLY named order (--work-order-id/--repository/--pull-request, bound to
// the allowlisted task type and READ_ONLY) — there is no oldest-queued
// fallback; each run uses a fresh isolated local ledger so stale locally
// queued orders can never reach the bounded loop; and
// --deterministic-local-canary runs the first canary at zero model cost (no
// gateway secret read, no model call, byte-reproducible local analysis). An unresolved independent review is
// always settled as `block`, never `complete`.
//
// Exit codes: 0 = bounded exit after the one order (or clean idle), 2 = the
// one-worker lock is held, 3 = activation gate (no founder confirmation),
// 130/143 = SIGINT/SIGTERM, 1 = abnormal exit.

import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

import { LocalArtifactStore } from '../operator-bridge/artifact-store.mjs'
import { BoundedWorkerSession } from '../operator-bridge/bounded-worker-session.mjs'
import { DEFAULT_EXECUTION_ALLOWLIST } from '../operator-bridge/constants.mjs'
import { createDecisionCard } from '../operator-bridge/decision-card.mjs'
import { buildDeterministicCanaryReview, DETERMINISTIC_CANARY_MODEL } from '../operator-bridge/deterministic-local-canary.mjs'
import { FableAdapter } from '../operator-bridge/fable-adapter.mjs'
import { GitHubReadOnlyCollector } from '../operator-bridge/github-collector.mjs'
import { KimiStreamingAdapter } from '../operator-bridge/kimi-streaming-adapter.mjs'
import { OrcaEdgeWorker } from '../operator-bridge/orca-edge-worker.mjs'
import { OrcaStagingWorker } from '../operator-bridge/orca-staging-worker.mjs'
import { OrcaTransportBridge, resolveDeliveryDecision } from '../operator-bridge/orca-transport-bridge.mjs'
import { ResourceRegistry } from '../operator-bridge/resource-registry.mjs'
import { FileWorkOrderLedger } from '../operator-bridge/work-order-ledger.mjs'

const execFileAsync = promisify(execFile)
const STAGING_BASE_URL = 'https://operator-bridge-control-plane-staging.up.railway.app'

function parseArguments(argv) {
  const result = {
    root: path.resolve('.operator-bridge/orca-transport-pilot'),
    confirmed: false,
    workOrderId: null,
    repository: null,
    pullRequest: null,
    deterministicLocalCanary: false,
  }
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--root') result.root = path.resolve(argv[++index])
    if (argv[index] === '--confirm-staging-pilot') result.confirmed = true
    if (argv[index] === '--work-order-id') result.workOrderId = argv[++index]
    if (argv[index] === '--repository') result.repository = argv[++index]
    if (argv[index] === '--pull-request') result.pullRequest = Number(argv[++index])
    if (argv[index] === '--deterministic-local-canary') result.deterministicLocalCanary = true
  }
  return result
}

async function keychain(service) {
  const { stdout } = await execFileAsync(
    'security',
    ['find-generic-password', '-w', '-a', 'operator-bridge-phase2a', '-s', service],
    { encoding: 'utf8', maxBuffer: 4096 },
  )
  return stdout.trim()
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

function reviewPrompt(collection) {
  const hashes = collection.artifacts.map((artifact) => ({
    type: artifact.artifact_type,
    sha256: artifact.sha256,
    bytes: artifact.byte_count,
  }))
  return [
    'Perform a bounded read-only status review of a supervised Operator Bridge workload.',
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
  const args = parseArguments(process.argv.slice(2))
  const { root, confirmed } = args
  if (!confirmed) {
    process.stdout.write(
      `${JSON.stringify(
        {
          status: 'ACTIVATION_GATE',
          gate: 'FOUNDER_CONFIRMATION_REQUIRED',
          detail:
            'This pilot claims ONE real READ_ONLY order from the staging control plane and returns real artifacts through the transport. Re-run with --confirm-staging-pilot after founder approval.',
          network_calls_made: 0,
          keychain_reads_made: 0,
        },
        null,
        2,
      )}\n`,
    )
    process.exitCode = 3
    return
  }
  // Exact order binding gate: the pilot never claims "whatever is queued".
  // Without a complete binding it exits 3 before any network or keychain use.
  const binding = {
    work_order_id: typeof args.workOrderId === 'string' ? args.workOrderId.trim() : '',
    task_type: DEFAULT_EXECUTION_ALLOWLIST.taskTypes[0],
    approval_class: 'READ_ONLY',
    repository: typeof args.repository === 'string' ? args.repository.trim() : '',
    pull_request: args.pullRequest,
  }
  if (
    binding.work_order_id === ''
    || binding.repository === ''
    || !Number.isSafeInteger(binding.pull_request)
    || binding.pull_request <= 0
  ) {
    process.stdout.write(
      `${JSON.stringify(
        {
          status: 'ACTIVATION_GATE',
          gate: 'EXACT_ORDER_BINDING_REQUIRED',
          detail:
            'This pilot claims only an exactly named remote order. Re-run with --work-order-id <id> --repository <owner/repo> --pull-request <n>. There is no fallback claim.',
          network_calls_made: 0,
          keychain_reads_made: 0,
        },
        null,
        2,
      )}\n`,
    )
    process.exitCode = 3
    return
  }

  const registry = new ResourceRegistry()
  const artifactStore = await new LocalArtifactStore({ root: path.join(root, 'artifacts') }).init()
  // Fresh isolated local ledger per run: stale queued orders from any prior
  // run can never leak into this session's bounded loop.
  const ledger = await new FileWorkOrderLedger({
    root: path.join(root, 'control-plane', 'runs', randomUUID()),
    artifactVerifier: (workOrderId) => artifactStore.listArtifacts(workOrderId),
  }).init()
  // Deterministic-local canary mode is zero model cost: the gateway secrets
  // file is never read and no model adapter is constructed.
  const gateway = args.deterministicLocalCanary ? null : await loadGatewayConfig()
  const transport = new OrcaStagingWorker({
    baseUrl: STAGING_BASE_URL,
    workerId: 'orca-transport-pilot',
    bootstrapTokenProvider: () => keychain('mya-operator-bridge-staging-orca-bootstrap'),
    environment: 'staging',
  })
  await transport.authenticate()
  const bridge = new OrcaTransportBridge({ transport, ledger, artifactStore })

  // Intake exactly the bound remote order before the bounded loop starts. A
  // null claim (order not claimable) is a clean, evidenced idle exit —
  // nothing is fabricated and nothing else is ever claimed in its place.
  const intake = await bridge.intakeOne(binding)

  const githubCollector = new GitHubReadOnlyCollector({ artifactStore, processRegistry: registry })
  const kimiAdapter = args.deterministicLocalCanary
    ? null
    : new KimiStreamingAdapter({
        artifactStore,
        baseUrl: gateway.baseUrl,
        model: 'kimi-k3',
        timeoutMs: 240_000,
        maxOutputTokens: 1600,
        maxAttempts: 1,
      })
  const worker = new OrcaEdgeWorker({
    workerId: 'orca-transport-pilot',
    ledger,
    githubCollector,
    kimiAdapter,
    artifactStore,
    environment: 'staging',
    executionAllowlist: DEFAULT_EXECUTION_ALLOWLIST,
  })
  const fableAdapter = new FableAdapter()
  const settlements = []

  const runOrder = async ({ order, worker: edgeWorker, leaseToken, attempt, signal, record }) => {
    const scope = order.scope ?? {}
    // Belt-and-suspenders: even with the fresh per-run ledger, refuse to
    // execute any order other than the one this run is bound to.
    if (order.work_order_id !== binding.work_order_id) {
      throw Object.assign(new Error('ORDER_BINDING_VIOLATION'), { code: 'ORDER_BINDING_VIOLATION' })
    }
    if (typeof scope.repository !== 'string' || !Number.isSafeInteger(scope.pull_request)) {
      throw Object.assign(new Error('ORDER_SCOPE_INVALID'), { code: 'ORDER_SCOPE_INVALID' })
    }
    const collection = await edgeWorker.execute({
      action: 'collect_github_read_only',
      payload: {
        repository: scope.repository,
        pullRequest: scope.pull_request,
        selectedFiles: Array.isArray(scope.selected_files) ? scope.selected_files : [],
        workOrderId: order.work_order_id,
        attempt,
      },
    })
    if (signal.aborted) throw new Error('ORDER_ABORTED')
    record('github_collection_completed', {
      base_sha: collection.base_sha,
      head_sha: collection.head_sha,
      changed_file_count: collection.changed_file_count,
    })
    let kimiResult
    if (args.deterministicLocalCanary) {
      const assembled = await artifactStore.putArtifact({
        workOrderId: order.work_order_id,
        artifactType: 'model_response',
        content: buildDeterministicCanaryReview(collection),
        producingExecutor: 'orca-transport-pilot',
        attempt,
        sensitivity: 'public',
      })
      kimiResult = {
        model: DETERMINISTIC_CANARY_MODEL,
        streaming: false,
        assembled_artifact: assembled,
        response_byte_count: assembled.byte_count,
      }
    } else {
      kimiResult = await edgeWorker.execute({
        action: 'invoke_kimi_analysis',
        payload: {
          workOrderId: order.work_order_id,
          sections: [
            {
              id: 'bounded-status',
              title: `${scope.repository} PR #${scope.pull_request} bounded status review`,
              prompt: reviewPrompt(collection),
            },
          ],
          apiKey: gateway.apiKey,
          attempt,
        },
      })
    }
    if (signal.aborted) throw new Error('ORDER_ABORTED')
    await edgeWorker.execute({
      action: 'return_result',
      payload: {
        work_order_id: order.work_order_id,
        lease_token: leaseToken,
        result_patch: {
          result_uri: kimiResult.assembled_artifact.immutable_relative_uri,
          result_hash: kimiResult.assembled_artifact.sha256,
          next_action: 'INVOKE_INDEPENDENT_VERIFIER',
        },
      },
    })
    const fableResult = await fableAdapter.review({
      work_order_id: order.work_order_id,
      artifact_ids: collection.artifacts
        .map((artifact) => artifact.artifact_id)
        .concat(kimiResult.assembled_artifact.artifact_id),
    })
    // The independent review verdict is mapped HONESTLY: only an explicit
    // resolved PASS may complete upstream. The stock FableAdapter returns a
    // resumable blocker until a founder-authorized verifier is wired in, so
    // this pilot settles as `block` — that is the correct, truthful result.
    const review =
      fableResult.status === 'PASS'
        ? { resolved: true, status: 'PASS', blocking_findings: fableResult.blocking_findings ?? [] }
        : {
            resolved: false,
            status: fableResult.status,
            blocker_code: fableResult.blocker_code,
            next_action: fableResult.next_action,
          }
    const current = await ledger.get(order.work_order_id)
    const allArtifacts = [...collection.artifacts, kimiResult.assembled_artifact]
    const decisionCard = createDecisionCard({
      workOrder: {
        ...current,
        status: resolveDeliveryDecision(review).settle === 'complete' ? current.status : 'BLOCKED',
        blocker_code: review.blocker_code ?? null,
        next_action: review.next_action ?? 'INDEPENDENT_EXACT_HEAD_REVIEW',
      },
      originatingInstruction: 'Transport-connected bounded read-only review pilot',
      artifacts: allArtifacts,
      kimiResult: {
        model: kimiResult.model,
        streaming: kimiResult.streaming,
        response_hash: kimiResult.assembled_artifact.sha256,
        response_byte_count: kimiResult.response_byte_count,
      },
      codexResult: { status: 'BOUNDED_SESSION_EXECUTED', protected_writes: 0 },
      fableResult,
      blockingFindings: review.resolved && review.status === 'PASS' ? [] : [{ code: review.blocker_code, blocking: true }],
    })
    const cardArtifact = await artifactStore.putArtifact({
      workOrderId: order.work_order_id,
      artifactType: 'decision_card',
      content: JSON.stringify(decisionCard, null, 2),
      producingExecutor: 'orca-transport-pilot',
      attempt,
      sensitivity: 'public',
    })
    const evidenceArtifact = await artifactStore.putArtifact({
      workOrderId: order.work_order_id,
      artifactType: 'evidence_report',
      content: JSON.stringify(
        {
          schema_version: 'motesart.operator_bridge.transport_pilot_evidence.v1',
          work_order: await ledger.get(order.work_order_id),
          events: await ledger.events(order.work_order_id),
          artifacts: [...allArtifacts, cardArtifact],
          transport: { connected: true, manual_artifact_movements: 0, github_writes: 0, production_mutations: 0 },
        },
        null,
        2,
      ),
      producingExecutor: 'orca-transport-pilot',
      attempt,
      sensitivity: 'public',
    })
    // Return the REAL artifacts to MYA through the staging transport and
    // settle honestly (complete only on resolved PASS).
    const settlement = await bridge.deliver({
      workOrderId: order.work_order_id,
      resultArtifact: kimiResult.assembled_artifact,
      evidenceArtifact,
      decisionCardArtifact: cardArtifact,
      review,
    })
    settlements.push({ work_order_id: order.work_order_id, ...settlement })
    // Mirror the settlement into the local ledger so local and remote state
    // agree in evidence.
    if (settlement.settlement === 'block') {
      await edgeWorker.execute({
        action: 'release_or_block_work_order',
        payload: {
          work_order_id: order.work_order_id,
          status: 'BLOCKED',
          blocker_code: review.blocker_code,
          next_action: review.next_action,
          lease_token: leaseToken,
        },
      })
      return { outcome: 'BLOCKED', blocker_code: review.blocker_code }
    }
    return { outcome: 'RESULT_RETURNED' }
  }

  const session = new BoundedWorkerSession({
    worker,
    ledger,
    artifactStore,
    registry,
    runRoot: root,
    allowedTaskTypes: DEFAULT_EXECUTION_ALLOWLIST.taskTypes,
    allowedApprovalClasses: DEFAULT_EXECUTION_ALLOWLIST.approvalClasses,
    maxOrdersPerSession: 1,
    idleExitMs: 30_000,
    executor: 'ORCA',
  })
  let result
  try {
    result = await session.run(runOrder)
  } finally {
    // Whatever the exit path, every still-held remote lease is released back
    // to the control plane — an aborted pilot never strands a remote order.
    await bridge.close()
  }
  const summary = {
    status: 'TRANSPORT_PILOT_EXIT',
    exit_reason: result.exit_reason,
    exit_detail: result.exit_detail,
    session_id: result.session_id,
    remote_intake: intake ? intake.order.work_order_id : null,
    exact_order_binding: {
      work_order_id: binding.work_order_id,
      task_type: binding.task_type,
      approval_class: binding.approval_class,
      repository: binding.repository,
      pull_request: binding.pull_request,
    },
    deterministic_local_canary: args.deterministicLocalCanary,
    orders_attempted: result.orders_attempted,
    settlements,
    evidence_path: result.evidence_path,
    evidence_written: result.evidence_written,
    lock_released: result.lock_released,
    output_root: root,
  }
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)
  if (result.exit_reason === 'WORKER_LOCK_UNAVAILABLE') process.exitCode = 2
  else if (result.exit_reason === 'SIGNAL_SHUTDOWN') process.exitCode = result.exit_detail === 'SIGINT' ? 130 : 143
  else if (!['IDLE_EXIT', 'ORDER_CAP_REACHED', 'SESSION_TIME_EXHAUSTED'].includes(result.exit_reason)) process.exitCode = 1
}

main().catch((error) => {
  process.stderr.write(
    `${JSON.stringify({ status: 'TRANSPORT_PILOT_FAILED', error_code: error.code ?? error.name ?? 'UNKNOWN' })}\n`,
  )
  process.exitCode = 1
})
