#!/usr/bin/env node
// Bounded worker pilot — a one-shot, supervised, staging-only worker process.
//
// This script IS the bounded worker: it acquires the cross-process one-worker
// lock, claims at most 3 READ_ONLY github_pr_read_only_review orders, enforces
// the 30-minute session clock, the 15-minute per-order clock, and the
// 2-minute idle exit, writes exit evidence on every result, and exits. There
// is no daemon, no auto-start, no retry, no GitHub write, and no production
// access anywhere in this process.
//
// Exit codes: 0 = graceful bounded exit (queue idle / order cap / session
// clock), 2 = another worker holds the one-worker lock, 130/143 = SIGINT /
// SIGTERM shutdown, 1 = abnormal exit.

import { readFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { LocalArtifactStore } from '../operator-bridge/artifact-store.mjs'
import { BoundedWorkerSession } from '../operator-bridge/bounded-worker-session.mjs'
import { DEFAULT_EXECUTION_ALLOWLIST } from '../operator-bridge/constants.mjs'
import { createDecisionCard } from '../operator-bridge/decision-card.mjs'
import { FableAdapter } from '../operator-bridge/fable-adapter.mjs'
import { GitHubReadOnlyCollector } from '../operator-bridge/github-collector.mjs'
import { KimiStreamingAdapter } from '../operator-bridge/kimi-streaming-adapter.mjs'
import { OrcaEdgeWorker } from '../operator-bridge/orca-edge-worker.mjs'
import { ResourceRegistry } from '../operator-bridge/resource-registry.mjs'
import { FileWorkOrderLedger } from '../operator-bridge/work-order-ledger.mjs'

function parseArguments(argv) {
  const result = { root: path.resolve('.operator-bridge/bounded-worker-pilot') }
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
  const { root } = parseArguments(process.argv.slice(2))
  const registry = new ResourceRegistry()
  const artifactStore = await new LocalArtifactStore({ root: path.join(root, 'artifacts') }).init()
  const ledger = await new FileWorkOrderLedger({
    root: path.join(root, 'control-plane'),
    artifactVerifier: (workOrderId) => artifactStore.listArtifacts(workOrderId),
  }).init()
  const gateway = await loadGatewayConfig()
  const githubCollector = new GitHubReadOnlyCollector({ artifactStore, processRegistry: registry })
  const kimiAdapter = new KimiStreamingAdapter({
    artifactStore,
    baseUrl: gateway.baseUrl,
    model: 'kimi-k3',
    timeoutMs: 240_000,
    maxOutputTokens: 1600,
    maxAttempts: 1,
  })
  const worker = new OrcaEdgeWorker({
    workerId: 'orca-bounded-worker-pilot',
    ledger,
    githubCollector,
    kimiAdapter,
    artifactStore,
    environment: 'staging',
    executionAllowlist: DEFAULT_EXECUTION_ALLOWLIST,
  })
  const fableAdapter = new FableAdapter()

  const runOrder = async ({ order, worker: edgeWorker, leaseToken, attempt, signal, record }) => {
    const scope = order.scope ?? {}
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
      diff_redaction_count: collection.diff_redaction_count,
    })
    const kimiResult = await edgeWorker.execute({
      action: 'invoke_kimi_analysis',
      payload: {
        workOrderId: order.work_order_id,
        sections: [{ id: 'bounded-status', title: `${scope.repository} PR #${scope.pull_request} bounded status review`, prompt: reviewPrompt(collection) }],
        apiKey: gateway.apiKey,
        attempt,
      },
    })
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
      artifact_ids: collection.artifacts.map((artifact) => artifact.artifact_id).concat(kimiResult.assembled_artifact.artifact_id),
    })
    const current = await ledger.get(order.work_order_id)
    const allArtifacts = [...collection.artifacts, kimiResult.assembled_artifact]
    const decisionCard = createDecisionCard({
      workOrder: { ...current, status: 'BLOCKED', blocker_code: fableResult.blocker_code, next_action: fableResult.next_action },
      originatingInstruction: 'Bounded worker supervised read-only review',
      artifacts: allArtifacts,
      kimiResult: {
        model: kimiResult.model,
        streaming: kimiResult.streaming,
        response_hash: kimiResult.assembled_artifact.sha256,
        response_byte_count: kimiResult.response_byte_count,
        time_to_first_token_ms: kimiResult.sections[0].time_to_first_token_ms,
        duration_ms: kimiResult.sections[0].duration_ms,
      },
      codexResult: { status: 'BOUNDED_SESSION_EXECUTED', protected_writes: 0 },
      fableResult,
      blockingFindings: [{ code: fableResult.blocker_code, blocking: true }],
    })
    const cardArtifact = await artifactStore.putArtifact({
      workOrderId: order.work_order_id,
      artifactType: 'decision_card',
      content: JSON.stringify(decisionCard, null, 2),
      producingExecutor: 'motesart-os-local-return-channel',
      attempt,
      sensitivity: 'public',
    })
    await edgeWorker.execute({
      action: 'release_or_block_work_order',
      payload: {
        work_order_id: order.work_order_id,
        status: 'BLOCKED',
        blocker_code: fableResult.blocker_code,
        next_action: fableResult.next_action,
        lease_token: leaseToken,
      },
    })
    const evidence = await artifactStore.putArtifact({
      workOrderId: order.work_order_id,
      artifactType: 'evidence_report',
      content: JSON.stringify({
        schema_version: 'motesart.operator_bridge.bounded_order_evidence.v1',
        work_order: await ledger.get(order.work_order_id),
        events: await ledger.events(order.work_order_id),
        artifacts: [...allArtifacts, cardArtifact],
        transport: { manual_artifact_movements: 0, outbound_orca: true, github_writes: 0, production_mutations: 0 },
      }, null, 2),
      producingExecutor: 'orca-bounded-worker-pilot',
      attempt,
      sensitivity: 'public',
    })
    record('bounded_order_completed', {
      blocker_code: fableResult.blocker_code,
      decision_card_hash: cardArtifact.sha256,
      evidence_hash: evidence.sha256,
    })
    return { outcome: 'BLOCKED', blocker_code: fableResult.blocker_code }
  }

  const session = new BoundedWorkerSession({
    worker,
    ledger,
    artifactStore,
    registry,
    runRoot: root,
    allowedTaskTypes: DEFAULT_EXECUTION_ALLOWLIST.taskTypes,
    allowedApprovalClasses: DEFAULT_EXECUTION_ALLOWLIST.approvalClasses,
    executor: 'ORCA',
  })
  const result = await session.run(runOrder)
  const summary = {
    status: 'BOUNDED_WORKER_EXIT',
    exit_reason: result.exit_reason,
    exit_detail: result.exit_detail,
    session_id: result.session_id,
    orders_attempted: result.orders_attempted,
    evidence_path: result.evidence_path,
    evidence_written: result.evidence_written,
    evidence_redaction_count: result.evidence_redaction_count,
    lock_released: result.lock_released,
    resources: result.resources,
    output_root: root,
  }
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)
  if (result.exit_reason === 'WORKER_LOCK_UNAVAILABLE') process.exitCode = 2
  else if (result.exit_reason === 'SIGNAL_SHUTDOWN') process.exitCode = result.exit_detail === 'SIGINT' ? 130 : 143
  else if (!['IDLE_EXIT', 'ORDER_CAP_REACHED', 'SESSION_TIME_EXHAUSTED'].includes(result.exit_reason)) process.exitCode = 1
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({ status: 'BOUNDED_WORKER_FAILED', error_code: error.code ?? error.name ?? 'UNKNOWN' })}\n`)
  process.exitCode = 1
})
