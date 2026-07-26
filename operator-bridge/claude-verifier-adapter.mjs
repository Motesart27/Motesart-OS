import { createHash, randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import { appendFileSync } from 'node:fs'
import { chmod, mkdir, mkdtemp, readFile, rm, unlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const ADAPTER_ID = 'proposed-fable-claude-code-local-v1'
const PROVIDER = 'Anthropic'
const VERDICTS = new Set([
  'PASS_EXACT_HEAD_REVIEW',
  'PASS_WITH_NONBLOCKING_FOLLOW_UP',
  'REQUEST_CHANGES',
  'FAIL_CRITICAL',
  'BLOCKED_ADAPTER_UNAVAILABLE',
  'BLOCKED_ARTIFACT_INTEGRITY',
  'BLOCKED_INCOMPLETE_PACKAGE',
])
const MERGE_READINESS = new Set(['ELIGIBLE_FOR_DENARIUS_DECISION', 'NOT_READY', 'BLOCKED'])
const DEPLOYMENT_READINESS = new Set([
  'SUPERVISED_STAGING_ELIGIBLE',
  'INCIDENT_ACTIONS_REQUIRED',
  'BLOCKED_BY_CODE',
  'BLOCKED_BY_REVIEW',
  'NOT_AUTHORIZED',
])
const VERDICT_JSON_SCHEMA = Object.freeze({
  type: 'object',
  properties: {
    overall_verdict: { enum: [...VERDICTS] },
    merge_readiness: { enum: [...MERGE_READINESS] },
    deployment_readiness: { enum: [...DEPLOYMENT_READINESS] },
    reviewed_head: { type: 'string', pattern: '^[a-f0-9]{40}$' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          code: { type: 'string' },
          summary: { type: 'string' },
          blocking: { type: 'boolean' },
          severity: { type: 'string' },
        },
        required: ['code', 'summary', 'blocking', 'severity'],
        additionalProperties: false,
      },
    },
    verified: { type: 'array', items: { type: 'string' } },
    inferred: { type: 'array', items: { type: 'string' } },
    unknown: { type: 'array', items: { type: 'string' } },
  },
  required: ['overall_verdict', 'merge_readiness', 'deployment_readiness', 'reviewed_head', 'findings', 'verified', 'inferred', 'unknown'],
  additionalProperties: false,
})
const ALLOWED_REQUEST_FIELDS = new Set([
  'work_order_id',
  'review_contract_id',
  'artifacts',
  'repository_identity',
  'exact_head_sha',
  'approved_review_prompt',
  'timeout_policy',
  'attempt',
])
const ALLOWED_ARTIFACT_FIELDS = new Set([
  'artifact_id',
  'work_order_id',
  'artifact_type',
  'immutable_relative_uri',
  'sha256',
  'byte_count',
  'producing_executor',
  'source_work_order_attempt',
  'created_at',
  'sensitivity_classification',
  'retention_status',
])
const EXECUTION_ACTIONS = new Set([
  'health',
  'verify_identity',
  'submit_review',
  'stream_review',
  'persist_partial',
  'persist_final',
  'record_model_metadata',
  'return_verdict',
  'block_review',
  'verify_output_hash',
])

export class VerifierAdapterError extends Error {
  constructor(code, message, metadata = {}) {
    super(message)
    this.name = 'VerifierAdapterError'
    this.code = code
    this.metadata = metadata
  }
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function safeLog(logger, event, metadata = {}) {
  logger?.info?.({ event, ...metadata })
}

function assertExactFields(value, allowed, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new VerifierAdapterError('INVALID_ADAPTER_REQUEST', `${label} must be an object`)
  }
  const extras = Object.keys(value).filter((key) => !allowed.has(key))
  if (extras.length) throw new VerifierAdapterError('REJECTED_UNSUPPORTED_FIELD', `${label} contains unsupported fields`)
}

function validateReviewRequest(request) {
  assertExactFields(request, ALLOWED_REQUEST_FIELDS, 'review request')
  if (!/^[A-Za-z0-9._:-]{1,160}$/.test(request.work_order_id ?? '')) {
    throw new VerifierAdapterError('INVALID_ADAPTER_REQUEST', 'Invalid work-order ID')
  }
  if (!/^[A-Za-z0-9._:-]{1,160}$/.test(request.review_contract_id ?? '')) {
    throw new VerifierAdapterError('INVALID_ADAPTER_REQUEST', 'Invalid review-contract ID')
  }
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(request.repository_identity ?? '')) {
    throw new VerifierAdapterError('INVALID_ADAPTER_REQUEST', 'Invalid repository identity')
  }
  if (!/^[a-f0-9]{40}$/.test(request.exact_head_sha ?? '')) {
    throw new VerifierAdapterError('INVALID_ADAPTER_REQUEST', 'Invalid exact head SHA')
  }
  if (typeof request.approved_review_prompt !== 'string' || request.approved_review_prompt.length < 1 || request.approved_review_prompt.length > 60_000) {
    throw new VerifierAdapterError('INVALID_ADAPTER_REQUEST', 'Approved review prompt is invalid')
  }
  if (!Array.isArray(request.artifacts) || request.artifacts.length < 1 || request.artifacts.length > 160) {
    throw new VerifierAdapterError('BLOCKED_INCOMPLETE_PACKAGE', 'Review artifact package is incomplete')
  }
  for (const artifact of request.artifacts) {
    assertExactFields(artifact, ALLOWED_ARTIFACT_FIELDS, 'artifact reference')
    if (!/^art_[a-f0-9]{32}$/.test(artifact.artifact_id ?? '') || !/^[a-f0-9]{64}$/.test(artifact.sha256 ?? '')) {
      throw new VerifierAdapterError('INVALID_ADAPTER_REQUEST', 'Artifact identity or hash is invalid')
    }
  }
  if (!request.artifacts.some((artifact) => ['source_snapshot', 'diff'].includes(artifact.artifact_type))) {
    throw new VerifierAdapterError('BLOCKED_INCOMPLETE_PACKAGE', 'Review package contains no committed source or diff')
  }
  assertExactFields(request.timeout_policy, new Set(['timeout_ms', 'retry_policy']), 'timeout policy')
  if (!Number.isInteger(request.timeout_policy.timeout_ms) || request.timeout_policy.timeout_ms < 10_000 || request.timeout_policy.timeout_ms > 600_000) {
    throw new VerifierAdapterError('INVALID_ADAPTER_REQUEST', 'Verifier timeout is outside policy')
  }
  if (request.timeout_policy.retry_policy !== 'NONE') {
    throw new VerifierAdapterError('REJECTED_RETRY_POLICY', 'Verifier review retries are disabled')
  }
}

function normalizeVerdict(output, exactHeadSha) {
  if (!output || typeof output !== 'object' || Array.isArray(output)) {
    throw new VerifierAdapterError('BLOCKED_VERDICT_SCHEMA', 'Verifier did not return a JSON object')
  }
  if (!VERDICTS.has(output.overall_verdict)) throw new VerifierAdapterError('BLOCKED_VERDICT_SCHEMA', 'Invalid verifier verdict')
  if (!MERGE_READINESS.has(output.merge_readiness)) throw new VerifierAdapterError('BLOCKED_VERDICT_SCHEMA', 'Invalid merge-readiness verdict')
  if (!DEPLOYMENT_READINESS.has(output.deployment_readiness)) throw new VerifierAdapterError('BLOCKED_VERDICT_SCHEMA', 'Invalid deployment-readiness verdict')
  if (output.reviewed_head !== exactHeadSha) throw new VerifierAdapterError('BLOCKED_VERDICT_SCHEMA', 'Verifier reviewed-head mismatch')
  if (!Array.isArray(output.findings) || !Array.isArray(output.verified) || !Array.isArray(output.inferred) || !Array.isArray(output.unknown)) {
    throw new VerifierAdapterError('BLOCKED_VERDICT_SCHEMA', 'Verifier evidence sections are missing')
  }
  for (const finding of output.findings) {
    if (!finding || typeof finding !== 'object' || typeof finding.code !== 'string' || typeof finding.summary !== 'string' || typeof finding.blocking !== 'boolean') {
      throw new VerifierAdapterError('BLOCKED_VERDICT_SCHEMA', 'Verifier finding is malformed')
    }
  }
  return output
}

function parseJsonResult(result) {
  if (typeof result !== 'string') throw new VerifierAdapterError('BLOCKED_VERDICT_SCHEMA', 'Verifier result is unavailable')
  const trimmed = result.trim()
  try {
    return JSON.parse(trimmed)
  } catch {
    throw new VerifierAdapterError('BLOCKED_VERDICT_SCHEMA', 'Verifier result is not strict JSON')
  }
}

async function defaultIdentityRunner(executable) {
  return new Promise((resolve) => {
    const child = spawn(executable, ['auth', 'status', '--json'], { stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    child.stdout.on('data', (chunk) => { stdout += chunk.toString() })
    child.on('close', (exitCode) => {
      let parsed = {}
      try { parsed = JSON.parse(stdout) } catch {}
      resolve({
        exit_code: exitCode,
        logged_in: Boolean(parsed.loggedIn),
        authentication_method_class: parsed.authMethod ?? null,
        provider: parsed.apiProvider ?? null,
        authenticated_account_class: parsed.subscriptionType ?? null,
      })
    })
  })
}

async function defaultStreamRunner({ executable, args, prompt, cwd, timeoutMs, onEvent }) {
  return new Promise((resolve) => {
    const environment = {}
    for (const name of ['HOME', 'PATH', 'TMPDIR', 'LANG', 'LC_ALL', 'LC_CTYPE', 'SHELL', 'USER', 'LOGNAME']) {
      if (process.env[name]) environment[name] = process.env[name]
    }
    const child = spawn(executable, args, {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: environment,
    })
    let stdoutBuffer = ''
    let stderrBytes = 0
    let timedOut = false
    let settled = false
    let forceKillTimer = null
    const events = []
    const timer = setTimeout(() => {
      timedOut = true
      child.kill('SIGTERM')
      forceKillTimer = setTimeout(() => child.kill('SIGKILL'), 5_000)
    }, timeoutMs)
    child.stdout.on('data', (chunk) => {
      stdoutBuffer += chunk.toString()
      const lines = stdoutBuffer.split(/\r?\n/)
      stdoutBuffer = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const event = JSON.parse(line)
          events.push(event)
          onEvent(event)
        } catch {
          events.push({ type: 'malformed_event' })
        }
      }
    })
    child.stderr.on('data', (chunk) => { stderrBytes += chunk.length })
    child.on('error', () => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (forceKillTimer) clearTimeout(forceKillTimer)
      resolve({ exit_code: null, signal: null, timed_out: false, stderr_bytes: stderrBytes, events, spawn_error: true })
    })
    child.on('close', (exitCode, signal) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (forceKillTimer) clearTimeout(forceKillTimer)
      if (stdoutBuffer.trim()) {
        try {
          const event = JSON.parse(stdoutBuffer)
          events.push(event)
          onEvent(event)
        } catch {
          events.push({ type: 'malformed_event' })
        }
      }
      resolve({ exit_code: exitCode, signal, timed_out: timedOut, stderr_bytes: stderrBytes, events })
    })
    child.stdin.end(prompt)
  })
}

export class ClaudeVerifierAdapter {
  constructor({
    artifactStore,
    executable = path.join(os.homedir(), '.local', 'bin', 'claude'),
    model = 'fable',
    workspaceRoot = path.join(os.tmpdir(), 'motesart-verifier-workspaces'),
    identityRunner = defaultIdentityRunner,
    streamRunner = defaultStreamRunner,
    logger = null,
    maxBudgetUsd = '2.00',
    maxInputBytes = 2_000_000,
  }) {
    this.artifactStore = artifactStore
    this.executable = executable
    this.model = model
    this.workspaceRoot = workspaceRoot
    this.identityRunner = identityRunner
    this.streamRunner = streamRunner
    this.logger = logger
    this.maxBudgetUsd = maxBudgetUsd
    this.maxInputBytes = maxInputBytes
  }

  async execute({ action, payload = {} }) {
    if (!EXECUTION_ACTIONS.has(action)) throw new VerifierAdapterError('UNSUPPORTED_VERIFIER_ACTION', 'Unsupported verifier action')
    for (const forbidden of ['command', 'shell', 'script', 'argv', 'executable', 'github_write', 'merge', 'deploy', 'credential']) {
      if (Object.hasOwn(payload, forbidden)) throw new VerifierAdapterError('REJECTED_UNSUPPORTED_FIELD', 'Remote command or mutation field rejected')
    }
    switch (action) {
      case 'health': return this.health()
      case 'verify_identity': return this.verifyIdentity()
      case 'submit_review':
      case 'stream_review': return this.review(payload)
      case 'persist_partial':
      case 'persist_final':
      case 'record_model_metadata':
      case 'return_verdict':
        throw new VerifierAdapterError('INTERNAL_ACTION_ONLY', 'Persistence and verdict-return actions are internal only')
      case 'block_review': return this.blockReview(payload)
      case 'verify_output_hash': return this.verifyOutputHash(payload.artifact)
      default: throw new VerifierAdapterError('UNSUPPORTED_VERIFIER_ACTION', 'Unsupported verifier action')
    }
  }

  health() {
    return {
      ok: true,
      verifier_adapter_id: ADAPTER_ID,
      provider: PROVIDER,
      connection_model: 'LOCAL_SEPARATE_PROCESS',
      tools: 'DISABLED',
      writes: 'DENIED',
    }
  }

  async verifyIdentity() {
    const identity = await this.identityRunner(this.executable)
    return {
      verifier_adapter_id: ADAPTER_ID,
      provider: PROVIDER,
      executable: '~/.local/bin/claude',
      requested_model: this.model,
      invocation_mode: 'NONINTERACTIVE_STREAM_JSON',
      safe_mode: true,
      tools: 'DISABLED',
      session_persistence: false,
      ...identity,
      authorization_status: identity.logged_in ? 'TECHNICALLY_AUTHENTICATED_PENDING_QUALIFICATION' : 'BLOCKED_ADAPTER_UNAVAILABLE',
    }
  }

  async _prepareInput(request) {
    validateReviewRequest(request)
    await mkdir(this.workspaceRoot, { recursive: true, mode: 0o700 })
    const workspace = await mkdtemp(path.join(this.workspaceRoot, `${request.work_order_id}-`))
    const inputsDirectory = path.join(workspace, 'inputs')
    await mkdir(inputsDirectory, { mode: 0o700 })
    const verified = []
    let totalBytes = 0
    for (const artifact of request.artifacts) {
      let content
      try {
        content = await this.artifactStore.readArtifact(artifact)
      } catch {
        await rm(workspace, { recursive: true, force: true })
        throw new VerifierAdapterError('BLOCKED_ARTIFACT_INTEGRITY', 'Artifact verification failed')
      }
      totalBytes += content.length
      if (totalBytes > this.maxInputBytes) {
        await rm(workspace, { recursive: true, force: true })
        throw new VerifierAdapterError('BLOCKED_INCOMPLETE_PACKAGE', 'Review package exceeds bounded input size')
      }
      const filename = `${artifact.artifact_id}-${artifact.artifact_type}.artifact`
      await writeFile(path.join(inputsDirectory, filename), content, { mode: 0o400 })
      verified.push({ artifact, content })
    }
    const manifest = {
      work_order_id: request.work_order_id,
      review_contract_id: request.review_contract_id,
      repository_identity: request.repository_identity,
      exact_head_sha: request.exact_head_sha,
      artifacts: request.artifacts.map((artifact) => ({
        artifact_id: artifact.artifact_id,
        artifact_type: artifact.artifact_type,
        sha256: artifact.sha256,
        byte_count: artifact.byte_count,
      })),
    }
    const manifestText = `${JSON.stringify(manifest, null, 2)}\n`
    await writeFile(path.join(workspace, 'REVIEW_INPUT_MANIFEST.json'), manifestText, { mode: 0o400 })
    await chmod(inputsDirectory, 0o500)
    const sections = []
    for (const { artifact, content } of verified) {
      const text = content.toString('utf8')
      const binary = text.includes('\u0000')
      sections.push([
        `ARTIFACT ${artifact.artifact_id}`,
        `TYPE ${artifact.artifact_type}`,
        `SHA256 ${artifact.sha256}`,
        `BYTES ${artifact.byte_count}`,
        binary ? '[BINARY CONTENT OMITTED; HASH AND SIZE VERIFIED]' : text,
      ].join('\n'))
    }
    return {
      workspace,
      workspace_manifest_sha256: sha256(manifestText),
      prompt: [request.approved_review_prompt, '', 'AUTHORITATIVE VERIFIED ARTIFACTS', sections.join('\n\n---\n\n')].join('\n'),
      verified_artifact_count: verified.length,
      verified_input_bytes: totalBytes,
    }
  }

  async review(request) {
    const prepared = await this._prepareInput(request)
    const promptArtifact = await this.artifactStore.putArtifact({
      workOrderId: request.work_order_id,
      artifactType: 'prompt',
      content: prepared.prompt,
      producingExecutor: ADAPTER_ID,
      attempt: request.attempt ?? 1,
      sensitivity: 'internal',
    })
    const partialPath = this.artifactStore.partialPath(request.work_order_id, request.review_contract_id)
    await writeFile(partialPath, '', { mode: 0o600 })
    const effectiveModels = new Set()
    let resultText = ''
    let structuredOutput = null
    let partialBytes = 0
    let firstTokenAt = null
    const startedAt = Date.now()
    const args = [
      '-p', '--model', this.model, '--safe-mode', '--tools', '', '--permission-mode', 'plan',
      '--no-session-persistence', '--prompt-suggestions', 'false', '--output-format', 'stream-json',
      '--include-partial-messages', '--verbose', '--json-schema', JSON.stringify(VERDICT_JSON_SCHEMA),
      '--max-budget-usd', this.maxBudgetUsd,
    ]
    safeLog(this.logger, 'verifier_review_started', {
      work_order_id: request.work_order_id,
      review_contract_id: request.review_contract_id,
      exact_head_sha: request.exact_head_sha,
      artifact_count: prepared.verified_artifact_count,
    })
    try {
      const execution = await this.streamRunner({
        executable: this.executable,
        args,
        prompt: prepared.prompt,
        cwd: prepared.workspace,
        timeoutMs: request.timeout_policy.timeout_ms,
        onEvent: (event) => {
          if (event.message?.model) effectiveModels.add(event.message.model)
          if (event.type === 'stream_event' && typeof event.event?.delta?.text === 'string') {
            if (firstTokenAt === null) firstTokenAt = Date.now()
            const token = event.event.delta.text
            partialBytes += Buffer.byteLength(token)
            appendFileSync(partialPath, token, { mode: 0o600 })
          }
          if (event.type === 'result') {
            if (typeof event.result === 'string') resultText = event.result
            if (event.structured_output && typeof event.structured_output === 'object') structuredOutput = event.structured_output
            for (const model of Object.keys(event.modelUsage ?? {})) effectiveModels.add(model)
          }
        },
      })
      if (execution.timed_out || execution.exit_code !== 0) {
        const resultEvent = [...execution.events].reverse().find((event) => event.type === 'result')
        const partialArtifact = await this.persistPartial({
          request,
          partialPath,
          retentionStatus: execution.timed_out ? 'timeout-retained' : 'failure-retained',
        })
        throw new VerifierAdapterError(
          execution.timed_out ? 'BLOCKED_VERIFIER_TIMEOUT' : 'BLOCKED_ADAPTER_UNAVAILABLE',
          'Independent verifier execution did not complete',
          {
            partial_artifact: partialArtifact,
            stderr_bytes: execution.stderr_bytes,
            exit_code: execution.exit_code,
            signal: execution.signal,
            result_subtype: resultEvent?.subtype ?? null,
            result_is_error: resultEvent?.is_error ?? null,
            event_types: [...new Set(execution.events.map((event) => event.type))],
          },
        )
      }
      let verdict
      try {
        verdict = normalizeVerdict(structuredOutput ?? parseJsonResult(resultText), request.exact_head_sha)
      } catch (error) {
        const partialArtifact = await this.persistPartial({ request, partialPath, retentionStatus: 'schema-failure-retained' })
        error.metadata = { ...(error.metadata ?? {}), partial_artifact: partialArtifact }
        throw error
      }
      const finishedAt = Date.now()
      const finalRecord = {
        schema_version: 'motesart.operator_bridge.verifier_verdict.v1',
        verifier_adapter_id: ADAPTER_ID,
        provider: PROVIDER,
        requested_model: this.model,
        effective_models: [...effectiveModels],
        invocation_mode: 'NONINTERACTIVE_STREAM_JSON',
        read_only_enforcement: {
          safe_mode: true,
          tools: 'DISABLED',
          permission_mode: 'plan',
          session_persistence: false,
          workspace: 'SEPARATE_EPHEMERAL_READ_ONLY_INPUT_WORKSPACE',
          environment_allowlist: ['HOME', 'PATH', 'TMPDIR', 'LANG', 'LC_ALL', 'LC_CTYPE', 'SHELL', 'USER', 'LOGNAME'],
        },
        work_order_id: request.work_order_id,
        review_contract_id: request.review_contract_id,
        repository_identity: request.repository_identity,
        exact_head_sha: request.exact_head_sha,
        input_artifact_ids: request.artifacts.map((artifact) => artifact.artifact_id),
        workspace_manifest_sha256: prepared.workspace_manifest_sha256,
        prompt_artifact_id: promptArtifact.artifact_id,
        prompt_sha256: promptArtifact.sha256,
        verified_artifact_count: prepared.verified_artifact_count,
        verified_input_bytes: prepared.verified_input_bytes,
        time_to_first_token_ms: firstTokenAt === null ? null : firstTokenAt - startedAt,
        duration_ms: finishedAt - startedAt,
        response_byte_count: Buffer.byteLength(resultText || JSON.stringify(structuredOutput)),
        response_sha256: sha256(resultText || JSON.stringify(structuredOutput)),
        timeout_policy: request.timeout_policy,
        verdict,
        created_at: new Date(finishedAt).toISOString(),
      }
      const verdictArtifact = await this.persistFinal({ request, finalRecord })
      await this.artifactStore.sealArtifact(verdictArtifact)
      await unlink(partialPath).catch(() => undefined)
      safeLog(this.logger, 'verifier_review_completed', {
        work_order_id: request.work_order_id,
        exact_head_sha: request.exact_head_sha,
        overall_verdict: verdict.overall_verdict,
        verdict_sha256: verdictArtifact.sha256,
      })
      return { ok: true, verdict, verdict_artifact: verdictArtifact, model_metadata: this.recordModelMetadata(finalRecord) }
    } finally {
      await chmod(path.join(prepared.workspace, 'inputs'), 0o700).catch(() => undefined)
      await rm(prepared.workspace, { recursive: true, force: true })
    }
  }

  async persistPartial({ request, partialPath, retentionStatus }) {
    const partial = await readFile(partialPath)
    if (!partial.length) {
      await unlink(partialPath).catch(() => undefined)
      return null
    }
    const artifact = await this.artifactStore.putArtifact({
      workOrderId: request.work_order_id,
      artifactType: 'verifier_verdict',
      content: partial,
      producingExecutor: ADAPTER_ID,
      attempt: request.attempt ?? 1,
      sensitivity: 'internal',
      retentionStatus,
    })
    await unlink(partialPath).catch(() => undefined)
    return artifact
  }

  async persistFinal({ request, finalRecord }) {
    return this.artifactStore.putArtifact({
      workOrderId: request.work_order_id,
      artifactType: 'verifier_verdict',
      content: JSON.stringify(finalRecord, null, 2),
      producingExecutor: ADAPTER_ID,
      attempt: request.attempt ?? 1,
      sensitivity: 'internal',
    })
  }

  recordModelMetadata(finalRecord) {
    return {
      provider: finalRecord.provider,
      requested_model: finalRecord.requested_model,
      effective_models: finalRecord.effective_models,
      invocation_mode: finalRecord.invocation_mode,
      duration_ms: finalRecord.duration_ms,
      time_to_first_token_ms: finalRecord.time_to_first_token_ms,
      response_sha256: finalRecord.response_sha256,
    }
  }

  blockReview({ code = 'BLOCKED_ADAPTER_UNAVAILABLE', next_action = 'RETRY_AFTER_OPERATOR_REVIEW' } = {}) {
    return { ok: false, status: 'BLOCKED', blocker_code: code, next_action, resumable: true }
  }

  async verifyOutputHash(artifact) {
    await this.artifactStore.readArtifact(artifact)
    return { ok: true, artifact_id: artifact.artifact_id, sha256: artifact.sha256 }
  }
}

export const VERIFIER_ADAPTER_ID = ADAPTER_ID
export const VERIFIER_PROVIDER = PROVIDER
export const VERIFIER_ALLOWED_VERDICTS = Object.freeze([...VERDICTS])
