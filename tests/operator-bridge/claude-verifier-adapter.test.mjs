import assert from 'node:assert/strict'
import { mkdtemp, stat, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { LocalArtifactStore } from '../../operator-bridge/artifact-store.mjs'
import { ClaudeVerifierAdapter } from '../../operator-bridge/claude-verifier-adapter.mjs'

const HEAD = 'a'.repeat(40)

function passingVerdict(overrides = {}) {
  return {
    overall_verdict: 'PASS_EXACT_HEAD_REVIEW',
    merge_readiness: 'ELIGIBLE_FOR_DENARIUS_DECISION',
    deployment_readiness: 'NOT_AUTHORIZED',
    reviewed_head: HEAD,
    findings: [],
    verified: ['Fixture source was reviewed.'],
    inferred: [],
    unknown: [],
    ...overrides,
  }
}

async function fixture({ streamRunner, identityRunner, logger } = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'operator-bridge-verifier-'))
  const artifactStore = await new LocalArtifactStore({ root: path.join(root, 'artifacts') }).init()
  const source = await artifactStore.putArtifact({
    workOrderId: 'wo-verifier-test',
    artifactType: 'source_snapshot',
    content: 'export function safe() { return true }',
    producingExecutor: 'test-fixture',
    attempt: 1,
    sensitivity: 'synthetic',
  })
  const calls = []
  const defaultFakeRunner = async (input) => {
    calls.push(input)
    const result = JSON.stringify(passingVerdict())
    input.onEvent({ type: 'assistant', message: { model: 'claude-fable-test' } })
    input.onEvent({ type: 'stream_event', event: { delta: { text: result } } })
    input.onEvent({ type: 'result', result, modelUsage: { 'claude-fable-test': { inputTokens: 1, outputTokens: 1 } } })
    return { exit_code: 0, signal: null, timed_out: false, stderr_bytes: 0, events: [] }
  }
  const adapter = new ClaudeVerifierAdapter({
    artifactStore,
    workspaceRoot: path.join(root, 'workspaces'),
    streamRunner: streamRunner ?? defaultFakeRunner,
    identityRunner: identityRunner ?? (async () => ({
      exit_code: 0,
      logged_in: true,
      authentication_method_class: 'synthetic',
      provider: 'firstParty',
      authenticated_account_class: 'test',
    })),
    logger,
  })
  const request = {
    work_order_id: 'wo-verifier-test',
    review_contract_id: 'fixture-v1',
    artifacts: [source],
    repository_identity: 'Motesart27/synthetic',
    exact_head_sha: HEAD,
    approved_review_prompt: 'Review the supplied synthetic fixture and return strict JSON.',
    timeout_policy: { timeout_ms: 30_000, retry_policy: 'NONE' },
    attempt: 1,
  }
  return { root, artifactStore, source, adapter, request, calls }
}

test('identity record is bounded and records authenticated account class', async () => {
  const { adapter } = await fixture()
  const identity = await adapter.execute({ action: 'verify_identity' })
  assert.equal(identity.logged_in, true)
  assert.equal(identity.authorization_status, 'TECHNICALLY_AUTHENTICATED_PENDING_QUALIFICATION')
  assert.equal(identity.tools, 'DISABLED')
  assert.equal('credential' in identity, false)
})

test('separate-process review persists model metadata and immutable verdict', async () => {
  const { adapter, request, calls, artifactStore, root } = await fixture()
  const result = await adapter.execute({ action: 'stream_review', payload: request })
  assert.equal(result.verdict.overall_verdict, 'PASS_EXACT_HEAD_REVIEW')
  assert.deepEqual(result.model_metadata.effective_models, ['claude-fable-test'])
  assert.equal((await adapter.verifyOutputHash(result.verdict_artifact)).ok, true)
  assert.equal(calls.length, 1)
  assert.notEqual(calls[0].cwd, process.cwd())
  assert.ok(calls[0].args.includes('--safe-mode'))
  assert.equal(calls[0].args[calls[0].args.indexOf('--tools') + 1], '')
  assert.ok(calls[0].args.includes('--no-session-persistence'))
  await artifactStore.readArtifact(result.verdict_artifact)
  const sealedMode = (await stat(path.join(root, 'artifacts', result.verdict_artifact.immutable_relative_uri))).mode
  assert.equal(sealedMode & 0o222, 0)
  assert.notEqual(calls[0].cwd, root)
})

test('remote shell, repository-write, and internal persistence actions are denied', async () => {
  const { adapter, request } = await fixture()
  await assert.rejects(
    adapter.execute({ action: 'stream_review', payload: { ...request, command: 'git push' } }),
    (error) => error.code === 'REJECTED_UNSUPPORTED_FIELD',
  )
  await assert.rejects(
    adapter.execute({ action: 'stream_review', payload: { ...request, github_write: true } }),
    (error) => error.code === 'REJECTED_UNSUPPORTED_FIELD',
  )
  await assert.rejects(
    adapter.execute({ action: 'persist_final', payload: { content: 'replacement' } }),
    (error) => error.code === 'INTERNAL_ACTION_ONLY',
  )
})

test('corrupted input artifact stops before reviewer execution', async () => {
  let calls = 0
  const { artifactStore, adapter, request, source, root } = await fixture({
    streamRunner: async () => { calls += 1 },
  })
  await writeFile(path.join(root, 'artifacts', source.immutable_relative_uri), 'corrupted')
  await assert.rejects(adapter.review(request), (error) => error.code === 'BLOCKED_ARTIFACT_INTEGRITY')
  assert.equal(calls, 0)
  await assert.rejects(artifactStore.readArtifact(source), (error) => error.code === 'ARTIFACT_INTEGRITY_FAILURE')
})

test('package without source or diff blocks before reviewer execution', async () => {
  let calls = 0
  const { artifactStore, adapter, request } = await fixture({ streamRunner: async () => { calls += 1 } })
  const report = await artifactStore.putArtifact({
    workOrderId: request.work_order_id,
    artifactType: 'evidence_report',
    content: 'author narrative only',
    producingExecutor: 'author',
    attempt: 1,
  })
  await assert.rejects(adapter.review({ ...request, artifacts: [report] }), (error) => error.code === 'BLOCKED_INCOMPLETE_PACKAGE')
  assert.equal(calls, 0)
})

test('timeout preserves a hashed partial verdict and does not retry', async () => {
  let calls = 0
  const runner = async (input) => {
    calls += 1
    input.onEvent({ type: 'stream_event', event: { delta: { text: '{"partial":true' } } })
    return { exit_code: null, signal: 'SIGTERM', timed_out: true, stderr_bytes: 0, events: [] }
  }
  const { adapter, request, artifactStore } = await fixture({ streamRunner: runner })
  let failure
  try { await adapter.review(request) } catch (error) { failure = error }
  assert.equal(failure.code, 'BLOCKED_VERIFIER_TIMEOUT')
  assert.equal(calls, 1)
  assert.ok(failure.metadata.partial_artifact)
  assert.equal((await artifactStore.readArtifact(failure.metadata.partial_artifact)).toString(), '{"partial":true')
})

test('wrong reviewed head and non-JSON output are rejected', async () => {
  const wrongHeadRunner = async (input) => {
    const result = JSON.stringify(passingVerdict({ reviewed_head: 'b'.repeat(40) }))
    input.onEvent({ type: 'stream_event', event: { delta: { text: result } } })
    input.onEvent({ type: 'result', result, modelUsage: { test: {} } })
    return { exit_code: 0, timed_out: false, stderr_bytes: 0, events: [] }
  }
  const { adapter, request } = await fixture({ streamRunner: wrongHeadRunner })
  await assert.rejects(adapter.review(request), (error) => error.code === 'BLOCKED_VERDICT_SCHEMA')
})

test('secrets, prompts, and reviewer output never enter structural logs', async () => {
  const entries = []
  const logger = { info: (entry) => entries.push(JSON.stringify(entry)) }
  const sentinel = 'SENSITIVE_VERIFIER_SENTINEL'
  const runner = async (input) => {
    const result = JSON.stringify(passingVerdict({ verified: [sentinel] }))
    input.onEvent({ type: 'stream_event', event: { delta: { text: result } } })
    input.onEvent({ type: 'result', result, modelUsage: { 'claude-fable-test': {} } })
    return { exit_code: 0, timed_out: false, stderr_bytes: 0, events: [] }
  }
  const { adapter, request } = await fixture({ streamRunner: runner, logger })
  await adapter.review({ ...request, approved_review_prompt: `Review synthetic input ${sentinel}` })
  assert.equal(entries.join('\n').includes(sentinel), false)
})
