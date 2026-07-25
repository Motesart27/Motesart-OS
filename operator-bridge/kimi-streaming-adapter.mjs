import { appendFile, readFile, unlink, writeFile } from 'node:fs/promises'

import { BLOCKER_CODES } from './constants.mjs'

const SYSTEM_PROMPT = 'You are a read-only architecture reviewer. Analyze only supplied public or synthetic artifacts. Do not claim external access, take actions, or recommend bypassing governance. Separate facts, inferences, unknowns, risks, and recommendations.'

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
  for (const line of parts) {
    if (!line.startsWith('data:')) continue
    const data = line.slice(5).trim()
    if (!data || data === '[DONE]') continue
    try {
      const parsed = JSON.parse(data)
      const content = parsed.choices?.[0]?.delta?.content
      if (typeof content === 'string') tokens.push(content)
    } catch {
      throw new KimiAdapterError('KIMI_MALFORMED_STREAM', 'Kimi stream was malformed')
    }
  }
  return { tokens, remainder }
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
    this.maxAttempts = maxAttempts
    this.logger = logger
    this.clock = clock
  }

  async analyzeSections({ workOrderId, sections, apiKey, attempt = 1 }) {
    if (!apiKey) throw new KimiAdapterError('KIMI_GATEWAY_CREDENTIAL_UNAVAILABLE', 'Kimi gateway unavailable')
    const results = []
    for (const section of sections) {
      results.push(await this._streamWithPolicy({ workOrderId, section, apiKey, attempt }))
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
    let lastError
    for (let currentAttempt = 1; currentAttempt <= this.maxAttempts; currentAttempt += 1) {
      try {
        return await this._streamSection({ ...input, transportAttempt: currentAttempt })
      } catch (error) {
        lastError = error
        const hasPartial = error.metadata?.partial_byte_count > 0
        if (hasPartial || currentAttempt >= this.maxAttempts) throw error
        safeLog(this.logger, 'kimi_retry_before_first_token', { attempt: currentAttempt, error_class: error.name })
      }
    }
    throw lastError
  }

  async _streamSection({ workOrderId, section, apiKey, attempt, transportAttempt }) {
    const promptArtifact = await this.artifactStore.putArtifact({
      workOrderId,
      artifactType: 'prompt',
      content: section.prompt,
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
            { role: 'user', content: section.prompt },
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
      const decoder = new TextDecoder()
      let pending = ''
      for await (const chunk of response.body) {
        pending += decoder.decode(chunk, { stream: true })
        const parsed = extractSseContent(pending)
        pending = parsed.remainder
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
      for (const token of trailing.tokens) {
        if (firstTokenAt === null) firstTokenAt = this.clock()
        content += token
        byteCount += Buffer.byteLength(token)
        await appendFile(partialPath, token, { mode: 0o600 })
      }
      if (!content) throw new KimiAdapterError('KIMI_RESPONSE_UNAVAILABLE', 'Kimi response contained no assistant text')
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
        : (error.code ?? 'KIMI_STREAM_FAILED')
      safeLog(this.logger, 'kimi_stream_failed', { section_id: section.id, error_class: error.name, blocker_code: code, partial_byte_count: partial.length })
      throw new KimiAdapterError(code, 'Kimi streaming analysis did not complete', {
        partial_artifact: partialArtifact,
        partial_byte_count: partial.length,
        time_to_first_token_ms: firstTokenAt === null ? null : firstTokenAt - startedAt,
      })
    } finally {
      clearTimeout(timeout)
    }
  }
}
