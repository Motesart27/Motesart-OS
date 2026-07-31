import { appendFile, readFile, unlink, writeFile } from 'node:fs/promises'

import { BLOCKER_CODES } from './constants.mjs'

const SYSTEM_PROMPT = 'You are a read-only architecture reviewer. Analyze only supplied public or synthetic artifacts. Do not claim external access, take actions, or recommend bypassing governance. Separate facts, inferences, unknowns, risks, and recommendations.'
export const KIMI_OUTPUT_CONTRACTS = Object.freeze({
  PRIORITY_RISK_ASSESSMENT_V1: 'Return a concise final assessment only. Include exactly three priority risks. Each risk must include supporting evidence and one recommendation. Do not include hidden reasoning or chain-of-thought.',
})

export class KimiAdapterError extends Error {
  constructor(code, message, metadata = {}) {
    super(message)
    this.name = 'KimiAdapterError'
    this.code = code
    this.metadata = metadata
  }
}

function safeLog(logger, event, metadata = {}) {
  logger?.info?.({ event, ...metadata })
}

function extractSseContent(buffer) {
  const parts = buffer.split(/\r?\n/)
  const remainder = parts.pop() ?? ''
  const tokens = []
  let reasoningPresent = false
  const finishReasons = []
  for (const line of parts) {
    if (!line.startsWith('data:')) continue
    const data = line.slice(5).trim()
    if (!data || data === '[DONE]') continue
    try {
      const parsed = JSON.parse(data)
      const choice = parsed.choices?.[0]
      const content = choice?.delta?.content
      if (typeof content === 'string') tokens.push(content)
      if (typeof choice?.delta?.reasoning_content === 'string' && choice.delta.reasoning_content.length > 0) reasoningPresent = true
      if (typeof choice?.finish_reason === 'string') finishReasons.push(choice.finish_reason)
    } catch {
      throw new KimiAdapterError('KIMI_MALFORMED_STREAM', 'Kimi stream was malformed')
    }
  }
  return { tokens, remainder, reasoningPresent, finishReasons }
}

export class KimiStreamingAdapter {
  constructor({
    baseUrl = 'http://127.0.0.1:8317/v1',
    model = 'kimi-k3',
    fetchImpl = globalThis.fetch,
    artifactStore,
    timeoutMs = 300_000,
    maxOutputTokens = 4096,
    maxAttempts = 1,
    logger = null,
    clock = () => Date.now(),
  }) {
    if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/v1$/.test(baseUrl)) {
      throw new TypeError('Kimi bridge base URL must remain loopback-local')
    }
    this.baseUrl = baseUrl
    this.model = model
    this.fetchImpl = fetchImpl
    this.artifactStore = artifactStore
    this.timeoutMs = timeoutMs
    this.maxOutputTokens = maxOutputTokens
    if (maxAttempts !== 1) throw new TypeError('Automatic Kimi retries are disabled')
    this.maxAttempts = 1
    this.logger = logger
    this.clock = clock
  }

  async analyzeSections({ workOrderId, sections, apiKey, attempt = 1, outputContract = null }) {
    if (!apiKey) throw new KimiAdapterError('KIMI_GATEWAY_CREDENTIAL_UNAVAILABLE', 'Kimi gateway unavailable')
    if (outputContract !== null && !Object.hasOwn(KIMI_OUTPUT_CONTRACTS, outputContract)) {
      throw new KimiAdapterError('KIMI_OUTPUT_CONTRACT_INVALID', 'Kimi output contract is unavailable')
    }
    const results = []
    for (const section of sections) {
      results.push(await this._streamWithPolicy({ workOrderId, section, apiKey, attempt, outputContract }))
    }
    const assembled = results.map((result) => `# ${result.section_title}\n\n${result.content}`).join('\n\n')
    const assembledArtifact = await this.artifactStore.putArtifact({
      workOrderId,
      artifactType: 'model_response',
      content: assembled,
      producingExecutor: 'kimi-streaming-adapter',
      attempt,
      sensitivity: 'public',
    })
    return {
      model: this.model,
      streaming: true,
      sections: results.map(({ content, ...metadata }) => metadata),
      assembled_artifact: assembledArtifact,
      response_byte_count: Buffer.byteLength(assembled),
    }
  }

  async _streamWithPolicy(input) {
    return this._streamSection({ ...input, transportAttempt: 1 })
  }

  async _streamSection({ workOrderId, section, apiKey, attempt, transportAttempt, outputContract }) {
    const userPrompt = outputContract
      ? `${KIMI_OUTPUT_CONTRACTS[outputContract]}\n\n${section.prompt}`
      : section.prompt
    const promptArtifact = await this.artifactStore.putArtifact({
      workOrderId,
      artifactType: 'prompt',
      content: userPrompt,
      producingExecutor: 'orca-edge-worker',
      attempt,
      sensitivity: 'public',
    })
    const partialPath = this.artifactStore.partialPath(workOrderId, section.id)
    await writeFile(partialPath, '', { mode: 0o600 })
    const startedAt = this.clock()
    let firstTokenAt = null
    let byteCount = 0
    let content = ''
    let connectionStatus = 'NOT_ESTABLISHED'
    let streamCompleted = false
    let reasoningPresent = false
    let finishReason = null
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      safeLog(this.logger, 'kimi_stream_started', { section_id: section.id, model: this.model, transport_attempt: transportAttempt })
      const response = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            {
              role: 'user',
              content: userPrompt,
            },
          ],
          max_completion_tokens: this.maxOutputTokens,
          stream: true,
        }),
        signal: controller.signal,
      })
      if (!response.ok || !response.body) {
        throw new KimiAdapterError('KIMI_GATEWAY_ERROR', 'Kimi gateway returned an unavailable response', {
          status_category: `${Math.floor(response.status / 100)}xx`,
        })
      }
      connectionStatus = 'ESTABLISHED'
      const decoder = new TextDecoder()
      let pending = ''
      for await (const chunk of response.body) {
        pending += decoder.decode(chunk, { stream: true })
        const parsed = extractSseContent(pending)
        pending = parsed.remainder
        reasoningPresent ||= parsed.reasoningPresent
        if (parsed.finishReasons.length) finishReason = parsed.finishReasons.at(-1)
        for (const token of parsed.tokens) {
          if (firstTokenAt === null) firstTokenAt = this.clock()
          content += token
          const bytes = Buffer.byteLength(token)
          byteCount += bytes
          await appendFile(partialPath, token, { mode: 0o600 })
        }
      }
      pending += '\n'
      const trailing = extractSseContent(pending)
      reasoningPresent ||= trailing.reasoningPresent
      if (trailing.finishReasons.length) finishReason = trailing.finishReasons.at(-1)
      for (const token of trailing.tokens) {
        if (firstTokenAt === null) firstTokenAt = this.clock()
        content += token
        byteCount += Buffer.byteLength(token)
        await appendFile(partialPath, token, { mode: 0o600 })
      }
      streamCompleted = true
      if (!content) {
        const code = reasoningPresent && finishReason === 'length'
          ? 'KIMI_REASONING_ONLY_LENGTH'
          : 'KIMI_RESPONSE_UNAVAILABLE'
        throw new KimiAdapterError(code, 'Kimi response contained no assistant text', {
          classification: code === 'KIMI_REASONING_ONLY_LENGTH'
            ? 'REASONING_ONLY_COMPLETION_LENGTH'
            : 'STREAM_COMPLETED_WITHOUT_ASSISTANT_CONTENT',
          connection_status: connectionStatus,
          finish_reason: finishReason,
          assistant_byte_count: 0,
          reasoning_present: reasoningPresent,
          duration_ms: this.clock() - startedAt,
        })
      }
      const artifact = await this.artifactStore.putArtifact({
        workOrderId,
        artifactType: 'model_response',
        content,
        producingExecutor: 'kimi-streaming-adapter',
        attempt,
        sensitivity: 'public',
      })
      const finishedAt = this.clock()
      await unlink(partialPath).catch(() => undefined)
      safeLog(this.logger, 'kimi_stream_completed', { section_id: section.id, model: this.model, byte_count: byteCount })
      return {
        section_id: section.id,
        section_title: section.title,
        prompt_artifact: promptArtifact,
        response_artifact: artifact,
        response_hash: artifact.sha256,
        response_byte_count: byteCount,
        time_to_first_token_ms: firstTokenAt - startedAt,
        duration_ms: finishedAt - startedAt,
        model: this.model,
        streaming: true,
        connection_status: connectionStatus,
        finish_reason: finishReason,
        reasoning_present: reasoningPresent,
        classification: 'STREAM_COMPLETED_WITH_ASSISTANT_CONTENT',
        content,
      }
    } catch (error) {
      const partial = await readFile(partialPath)
      const partialArtifact = partial.length
        ? await this.artifactStore.putArtifact({
            workOrderId,
            artifactType: 'model_response_partial',
            content: partial,
            producingExecutor: 'kimi-streaming-adapter',
            attempt,
            sensitivity: 'public',
            retentionStatus: 'interrupted-retained',
          })
        : null
      await unlink(partialPath).catch(() => undefined)
      const timedOut = controller.signal.aborted
      const code = timedOut
        ? (partial.length ? BLOCKER_CODES.KIMI_TIMEOUT_PARTIAL : BLOCKER_CODES.KIMI_TIMEOUT_BEFORE_FIRST_TOKEN)
        : (error.code ?? (connectionStatus === 'NOT_ESTABLISHED'
            ? 'KIMI_CONNECTION_FAILED'
            : (firstTokenAt === null && !streamCompleted ? 'KIMI_FIRST_TOKEN_UNAVAILABLE' : 'KIMI_STREAM_FAILED')))
      const classification = error.metadata?.classification
        ?? (code === BLOCKER_CODES.KIMI_TIMEOUT_PARTIAL
          ? 'TIMEOUT_WITH_PARTIAL_ASSISTANT_CONTENT'
          : code === BLOCKER_CODES.KIMI_TIMEOUT_BEFORE_FIRST_TOKEN
            ? 'TIMEOUT_BEFORE_FIRST_ASSISTANT_TOKEN'
            : code === 'KIMI_CONNECTION_FAILED' || code === 'KIMI_GATEWAY_ERROR'
              ? 'CONNECTION_FAILURE'
              : code === 'KIMI_FIRST_TOKEN_UNAVAILABLE'
                ? 'STREAM_FAILED_BEFORE_FIRST_ASSISTANT_TOKEN'
                : 'STREAM_FAILURE')
      const durationMs = this.clock() - startedAt
      safeLog(this.logger, 'kimi_stream_failed', {
        section_id: section.id,
        error_class: error.name,
        blocker_code: code,
        connection_status: connectionStatus,
        first_token_time_ms: firstTokenAt === null ? null : firstTokenAt - startedAt,
        finish_reason: error.metadata?.finish_reason ?? finishReason,
        assistant_byte_count: partial.length,
        reasoning_present: error.metadata?.reasoning_present ?? reasoningPresent,
        duration_ms: durationMs,
        classification,
      })
      throw new KimiAdapterError(code, 'Kimi streaming analysis did not complete', {
        partial_artifact: partialArtifact,
        partial_byte_count: partial.length,
        time_to_first_token_ms: firstTokenAt === null ? null : firstTokenAt - startedAt,
        connection_status: connectionStatus,
        finish_reason: error.metadata?.finish_reason ?? finishReason,
        assistant_byte_count: partial.length,
        reasoning_present: error.metadata?.reasoning_present ?? reasoningPresent,
        duration_ms: durationMs,
        classification,
      })
    } finally {
      clearTimeout(timeout)
    }
  }
}
