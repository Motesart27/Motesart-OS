import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { LocalArtifactStore } from '../operator-bridge/artifact-store.mjs'
import { ClaudeVerifierAdapter, VERIFIER_ADAPTER_ID } from '../operator-bridge/claude-verifier-adapter.mjs'
import { APPROVAL_CLASSES } from '../operator-bridge/constants.mjs'
import { createDecisionCard } from '../operator-bridge/decision-card.mjs'
import { GitHubReadOnlyCollector } from '../operator-bridge/github-collector.mjs'
import { FileWorkOrderLedger } from '../operator-bridge/work-order-ledger.mjs'

const execFileAsync = promisify(execFile)
const args = process.argv.slice(2)
const headIndex = args.indexOf('--head')
const rootIndex = args.indexOf('--root')
if (headIndex < 0 || !/^[a-f0-9]{40}$/.test(args[headIndex + 1] ?? '')) throw new Error('EXACT_HEAD_REQUIRED')
const exactHead = args[headIndex + 1]
const root = path.resolve(rootIndex >= 0 ? args[rootIndex + 1] : `.operator-bridge/phase1b-pr22-review-${exactHead.slice(0, 12)}`)
const repository = 'Motesart27/Motesart-OS'
const pullRequest = 22
const workOrderId = `WO-MYA-BRIDGE-PR22-REVIEW-${exactHead.slice(0, 12).toUpperCase()}`
const qualificationRoot = path.resolve('.operator-bridge/verifier-qualification-v3/artifacts')
const pilotRoot = path.resolve('.operator-bridge/pilot-pr32-phase1-final-v2/artifacts')
const qualificationHashes = new Set([
  '723abe20dcc81f32205316537964367bc664bdeadde2917b1b14af7b7d7e7cde',
  'b68c5a284e93e5404a97b5557399801b66ab1252eeae55418dacb38f492dd8a5',
])

const reviewContract = `You are Fable, the qualified independent, read-only verifier for a supervised Operator Bridge exact-head review.
You are a separate reviewer. Do not rely on Codex conclusions or author reports over executable source and tests.
You have no write, approval, merge, deployment, credential, production, autonomy, or loop authority.

Review Motesart27/Motesart-OS PR #22 at the exact supplied head. Verify:
1. work-order state transitions; 2. invalid transition denial; 3. terminal-state behavior;
4. lease fencing; 5. expiry/reclaim; 6. duplicate submission idempotency;
7. duplicate completion idempotency; 8. offline ORCA queue behavior;
9. outbound-only ORCA architecture; 10. remote shell/command rejection;
11. typed handler boundaries; 12. Kimi streaming/partial persistence;
13. timeout classification; 14. artifact immutability; 15. hash verification;
16. corrupted artifact rejection; 17. GitHub read-only enforcement;
18. credential redaction before diff persistence; 19. exact upstream diff hash preservation;
20. verifier separation; 21. self-approval rejection; 22. disabled protected approvals;
23. decision-card evidence accuracy; 24. no autonomy or loop activation;
25. no production write path; 26. secret/personal-data log hygiene;
27. preview-versus-production deployment distinction; 28. zero manual artifact movement claim.

Return one strict JSON object through the enforced schema. Findings must cite concrete supplied source or test evidence.
Use PASS_EXACT_HEAD_REVIEW only when no blocking defect remains.
Use PASS_WITH_NONBLOCKING_FOLLOW_UP only for genuinely nonblocking findings.
Use REQUEST_CHANGES for blocking correctable defects and FAIL_CRITICAL for a critical bypass.
Deployment is not authorized regardless of code quality.`

async function changedFiles() {
  const { stdout } = await execFileAsync('gh', [
    'pr', 'view', String(pullRequest), '--repo', repository, '--json', 'headRefOid,files',
  ], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 })
  const parsed = JSON.parse(stdout)
  if (parsed.headRefOid !== exactHead) throw new Error('PR22_HEAD_MOVED')
  return parsed.files.map((file) => file.path)
}

async function importArtifacts(sourceRoot, predicate, artifactStore) {
  const imported = []
  for (const file of (await readdir(path.join(sourceRoot, 'manifests'))).sort()) {
    const manifest = JSON.parse(await readFile(path.join(sourceRoot, 'manifests', file), 'utf8'))
    if (!predicate(manifest)) continue
    const content = await readFile(path.join(sourceRoot, manifest.immutable_relative_uri))
    imported.push(await artifactStore.putArtifact({
      workOrderId,
      artifactType: manifest.artifact_type,
      content,
      producingExecutor: 'operator-bridge-verified-local-import',
      attempt: 1,
      sensitivity: manifest.sensitivity_classification,
      retentionStatus: manifest.retention_status,
    }))
  }
  return imported
}

const artifactStore = await new LocalArtifactStore({ root: path.join(root, 'artifacts') }).init()
const ledger = await new FileWorkOrderLedger({ root: path.join(root, 'control-plane') }).init()
const adapter = new ClaudeVerifierAdapter({
  artifactStore,
  workspaceRoot: path.join(root, 'verifier-workspaces'),
  maxBudgetUsd: '4.00',
})
const identity = await adapter.verifyIdentity()
if (!identity.logged_in) throw new Error('VERIFIER_AUTHENTICATION_UNAVAILABLE')

const order = await ledger.create({
  work_order_id: workOrderId,
  requested_by: 'Denarius Motes',
  originating_surface: 'Motesart-OS#21',
  task_type: 'INDEPENDENT_EXACT_HEAD_REVIEW',
  scope: { repository, pull_request: pullRequest, exact_head: exactHead, read_only: true },
  approval_class: APPROVAL_CLASSES.READ_ONLY,
  executor: 'FABLE',
  required_artifacts: ['repository_identity', 'pull_request_identity', 'diff', 'source_snapshot', 'test_log', 'verifier_qualification', 'verifier_verdict', 'decision_card'],
  input_hashes: [exactHead],
  idempotency_key: `operator-bridge:phase1b-review:${repository}:pr:${pullRequest}:${exactHead}`,
  next_action: 'QUEUE_INDEPENDENT_REVIEW',
})
if (order.status === 'DRAFT') await ledger.transition(workOrderId, 'QUEUED', { actor: 'operator-bridge', reason: 'INDEPENDENT_REVIEW_QUEUED' })
const claimed = await ledger.claim(workOrderId, { leaseOwner: VERIFIER_ADAPTER_ID, leaseTtlMs: 600_000 })
await ledger.transition(workOrderId, 'RUNNING', {
  actor: VERIFIER_ADAPTER_ID,
  reason: 'INDEPENDENT_REVIEW_STARTED',
  leaseToken: claimed.lease_token,
})

const collector = new GitHubReadOnlyCollector({ artifactStore, executor: 'orca-edge-worker-read-only' })
const collection = await collector.collect({
  repository,
  pullRequest,
  selectedFiles: await changedFiles(),
  workOrderId,
  attempt: claimed.attempt_count,
})
if (collection.head_sha !== exactHead) throw new Error('PR22_HEAD_MOVED')
const qualificationArtifacts = await importArtifacts(qualificationRoot, (manifest) => qualificationHashes.has(manifest.sha256), artifactStore)
if (qualificationArtifacts.length !== 2) throw new Error('QUALIFICATION_ARTIFACTS_INCOMPLETE')
const pilotArtifacts = await importArtifacts(pilotRoot, () => true, artifactStore)
const reviewInputs = [...collection.artifacts, ...qualificationArtifacts, ...pilotArtifacts]

const review = await adapter.review({
  work_order_id: workOrderId,
  review_contract_id: 'mya-operator-bridge-pr22-exact-head-v1',
  artifacts: reviewInputs,
  repository_identity: repository,
  exact_head_sha: exactHead,
  approved_review_prompt: reviewContract,
  timeout_policy: { timeout_ms: 480_000, retry_policy: 'NONE' },
  attempt: claimed.attempt_count,
})
await ledger.transition(workOrderId, 'VERIFYING', {
  actor: VERIFIER_ADAPTER_ID,
  reason: 'INDEPENDENT_VERDICT_RETURNED',
  leaseToken: claimed.lease_token,
  patch: {
    result_uri: review.verdict_artifact.immutable_relative_uri,
    result_hash: review.verdict_artifact.sha256,
    next_action: 'GENERATE_DECISION_CARD',
  },
})

const passing = ['PASS_EXACT_HEAD_REVIEW', 'PASS_WITH_NONBLOCKING_FOLLOW_UP'].includes(review.verdict.overall_verdict)
const finalStatus = passing ? 'READY_FOR_APPROVAL' : 'BLOCKED'
const nextAction = passing ? 'DENARIUS_MERGE_DECISION_NOT_EXECUTED' : 'REVISE_PR_BEFORE_REVIEW'
const projected = {
  ...(await ledger.get(workOrderId)),
  status: finalStatus,
  blocker_code: passing ? null : review.verdict.overall_verdict,
  next_action: nextAction,
}
const decisionCard = createDecisionCard({
  workOrder: projected,
  originatingInstruction: 'Issue #21 Phase 1B independent exact-head review of Motesart-OS PR #22',
  artifacts: [...reviewInputs, review.verdict_artifact],
  kimiResult: null,
  codexResult: { status: 'ADAPTER_IMPLEMENTED_AND_QUALIFIED', independent_verdict: false },
  fableResult: {
    status: 'COMPLETED',
    verifier_adapter_id: VERIFIER_ADAPTER_ID,
    overall_verdict: review.verdict.overall_verdict,
    merge_readiness: review.verdict.merge_readiness,
    deployment_readiness: review.verdict.deployment_readiness,
    reviewed_head: exactHead,
    verdict_artifact_id: review.verdict_artifact.artifact_id,
    verdict_sha256: review.verdict_artifact.sha256,
    model_metadata: review.model_metadata,
  },
  blockingFindings: review.verdict.findings.filter((finding) => finding.blocking),
})
const cardArtifact = await artifactStore.putArtifact({
  workOrderId,
  artifactType: 'decision_card',
  content: JSON.stringify(decisionCard, null, 2),
  producingExecutor: 'motesart-os-local-return-channel',
  attempt: claimed.attempt_count,
  sensitivity: 'internal',
})
await artifactStore.sealArtifact(cardArtifact)
const finalOrder = await ledger.transition(workOrderId, finalStatus, {
  actor: 'motesart-os-local-return-channel',
  reason: review.verdict.overall_verdict,
  leaseToken: claimed.lease_token,
  patch: {
    blocker_code: passing ? null : review.verdict.overall_verdict,
    next_action: nextAction,
    evidence_uri: cardArtifact.immutable_relative_uri,
    evidence_hash: cardArtifact.sha256,
  },
})

const evidence = {
  schema_version: 'motesart.operator_bridge.phase1b_review_evidence.v1',
  work_order: finalOrder,
  exact_reviewed_head: exactHead,
  exact_diff_source_hash: collection.diff_source_sha256,
  diff_redaction_count: collection.diff_redaction_count,
  collected_pr_artifact_count: collection.artifacts.length,
  imported_qualification_artifact_count: qualificationArtifacts.length,
  imported_pilot_artifact_count: pilotArtifacts.length,
  verifier_identity: identity,
  verdict: review.verdict,
  verdict_artifact: review.verdict_artifact,
  decision_card_artifact: cardArtifact,
  model_metadata: review.model_metadata,
  manual_artifact_movements: 0,
  github_writes: 0,
  production_mutations: 0,
  events: await ledger.events(workOrderId),
}
const evidenceArtifact = await artifactStore.putArtifact({
  workOrderId,
  artifactType: 'evidence_report',
  content: JSON.stringify(evidence, null, 2),
  producingExecutor: 'operator-bridge-phase1b-review',
  attempt: claimed.attempt_count,
  sensitivity: 'internal',
})
await artifactStore.sealArtifact(evidenceArtifact)
const summary = {
  status: finalStatus,
  work_order_id: workOrderId,
  exact_reviewed_head: exactHead,
  overall_verdict: review.verdict.overall_verdict,
  merge_readiness: review.verdict.merge_readiness,
  deployment_readiness: review.verdict.deployment_readiness,
  effective_models: review.model_metadata.effective_models,
  verdict_artifact_hash: review.verdict_artifact.sha256,
  decision_card_hash: cardArtifact.sha256,
  evidence_hash: evidenceArtifact.sha256,
  manual_artifact_movements: 0,
}
await writeFile(path.join(root, 'PHASE1B_REVIEW_SUMMARY.json'), `${JSON.stringify(summary, null, 2)}\n`, { mode: 0o600 })
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)
