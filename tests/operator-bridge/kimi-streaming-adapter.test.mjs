import assert from 'node:assert/strict'
import { mkdtemp, readFile, readdir } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { LocalArtifactStore } from '../../operator-bridge/artifact-store.mjs'
import { KimiStreamingAdapter } from '../../operator-bridge/kimi-streaming-adapter.mjs'

function sseResponse(tokens, { signal, intervalMs = 0, stall = false } = {}) {
  let timer
  const stream = new ReadableStream({
    start(controller) {
      let index = 0
      const push = () => {
        if (index < tokens.length) {
          const payload = JSON.stringify({ choices: [{ delta: { content: tokens[index] } }] })
          controller.enqueue(new TextEncoder().encode(`data: ${payload}\n\n`))
          index += 1
          timer = setTimeout(push, intervalMs)
          return
        }
        if (!stall) {
          controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'))
          controller.close()
        }
      }
      push()
      signal?.addEventListener('abort', () => {
        clearTimeout(timer)
        controller.error(new DOMException('aborted', 'AbortError'))
      }, { once: true })
    },
    cancel() {
      clearTimeout(timer)
    },
  })
  return new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } })
}

function sseEventResponse(events, { signal } = {}) {
  const stream = new ReadableStream({
    start(controller) {
      for (const event of events) controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`))
      controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'))
      controller.close()
      signal?.addEventListener('abort', () => controller.error(new DOMException('aborted', 'AbortError')), { once: true })
    },
  })
  return new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } })
}

async function allFileText(root) {
  const values = []
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const candidate = path.join(directory, entry.name)
      if (entry.isDirectory()) await visit(candidate)
      else values.push((await readFile(candidate)).toString('utf8'))
    }
  }
  await visit(root)
  return values.join('\n')
}

async function fixture({ responseFactory, timeoutMs = 1000, logger = null } = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'operator-bridge-kimi-'))
  const artifactStore = await new LocalArtifactStore({ root }).init()
  const requests = []
  const fetchImpl = async (url, options) => {
    requests.push({ url, options, body: JSON.parse(options.body) })
    return responseFactory(options)
  }
  return {
    root,
    artifactStore,
    requests,
    adapter: new KimiStreamingAdapter({ artifactStore, fetchImpl, timeoutMs, logger }),
  }
}

for (const [label, tokenCount] of [['small', 1], ['medium', 100], ['long', 600]]) {
  test(`${label} streamed response completes and records model metadata`, async () => {
    const tokens = Array.from({ length: tokenCount }, (_, index) => `token-${index} `)
    const { adapter, artifactStore, requests } = await fixture({
      responseFactory: ({ signal }) => sseResponse(tokens, { signal }),
      timeoutMs: 5000,
    })
    const result = await adapter.analyzeSections({
      workOrderId: `wo-${label}`,
      sections: [{ id: label, title: label, prompt: 'Synthetic architecture review' }],
      apiKey: 'SYNTHETIC_GATEWAY_KEY',
    })
    assert.equal(result.model, 'kimi-k3')
    assert.equal(result.streaming, true)
    assert.equal(result.sections[0].response_byte_count, Buffer.byteLength(tokens.join('')))
    assert.equal(requests[0].body.stream, true)
    assert.equal(requests[0].body.model, 'kimi-k3')
    assert.equal(requests[0].body.max_completion_tokens, 4096)
    await artifactStore.readArtifact(result.assembled_artifact)
  })
}

test('forced timeout preserves incremental partial artifact before failure', async () => {
  const { adapter, artifactStore } = await fixture({
    responseFactory: ({ signal }) => sseResponse(['partial survives'], { signal, stall: true }),
    timeoutMs: 30,
  })
  let failure
  try {
    await adapter.analyzeSections({
      workOrderId: 'wo-timeout',
      sections: [{ id: 'timeout', title: 'timeout', prompt: 'Synthetic timeout' }],
      apiKey: 'SYNTHETIC_GATEWAY_KEY',
    })
  } catch (error) {
    failure = error
  }
  assert.equal(failure.code, 'KIMI_TIMEOUT_PARTIAL')
  assert.equal(failure.metadata.partial_byte_count, Buffer.byteLength('partial survives'))
  assert.equal((await artifactStore.readArtifact(failure.metadata.partial_artifact)).toString(), 'partial survives')
})

test('reasoning-only length completion fails closed without persisting or logging hidden reasoning', async () => {
  const sentinel = 'SENSITIVE_HIDDEN_REASONING_SENTINEL'
  const logs = []
  const { adapter, artifactStore, requests, root } = await fixture({
    responseFactory: ({ signal }) => sseEventResponse([
      { choices: [{ delta: { reasoning_content: sentinel }, finish_reason: null }] },
      { choices: [{ delta: {}, finish_reason: 'length' }] },
    ], { signal }),
    logger: { info: (entry) => logs.push(JSON.stringify(entry)) },
  })
  let failure
  try {
    await adapter.analyzeSections({
      workOrderId: 'wo-reasoning-only',
      sections: [{ id: 'risk', title: 'risk', prompt: 'Public exact-head evidence only.' }],
      apiKey: 'SYNTHETIC_GATEWAY_KEY',
      outputContract: 'PRIORITY_RISK_ASSESSMENT_V1',
    })
  } catch (error) {
    failure = error
  }
  assert.equal(requests.length, 1)
  assert.equal(failure.code, 'KIMI_REASONING_ONLY_LENGTH')
  assert.equal(failure.metadata.classification, 'REASONING_ONLY_COMPLETION_LENGTH')
  assert.equal(failure.metadata.connection_status, 'ESTABLISHED')
  assert.equal(failure.metadata.finish_reason, 'length')
  assert.equal(failure.metadata.assistant_byte_count, 0)
  assert.equal(failure.metadata.reasoning_present, true)
  assert.equal(failure.metadata.partial_artifact, null)
  assert.equal(logs.join('\n').includes(sentinel), false)
  assert.equal((await allFileText(root)).includes(sentinel), false)
  assert.match(requests[0].body.messages[1].content, /exactly three priority risks/i)
  assert.equal(requests[0].body.messages[1].content.includes(sentinel), false)
  assert.equal(artifactStore !== null, true)
})

test('completed stream with no assistant or reasoning content has its own bounded classification', async () => {
  const { adapter } = await fixture({
    responseFactory: ({ signal }) => sseEventResponse([
      { choices: [{ delta: {}, finish_reason: 'stop' }] },
    ], { signal }),
  })
  await assert.rejects(adapter.analyzeSections({
    workOrderId: 'wo-empty-stream',
    sections: [{ id: 'empty', title: 'empty', prompt: 'Synthetic.' }],
    apiKey: 'SYNTHETIC_GATEWAY_KEY',
  }), (error) => error.code === 'KIMI_RESPONSE_UNAVAILABLE'
    && error.metadata.classification === 'STREAM_COMPLETED_WITHOUT_ASSISTANT_CONTENT'
    && error.metadata.finish_reason === 'stop'
    && error.metadata.reasoning_present === false)
})

test('valid output-focused completion creates the normal response artifact with sanitized metadata', async () => {
  const { adapter, artifactStore, requests } = await fixture({
    responseFactory: ({ signal }) => sseEventResponse([
      { choices: [{ delta: { reasoning_content: 'not-persisted' }, finish_reason: null }] },
      { choices: [{ delta: { content: '1. Risk — evidence — recommendation.\n2. Risk — evidence — recommendation.\n3. Risk — evidence — recommendation.' }, finish_reason: null }] },
      { choices: [{ delta: {}, finish_reason: 'stop' }] },
    ], { signal }),
  })
  const result = await adapter.analyzeSections({
    workOrderId: 'wo-valid-contract',
    sections: [{ id: 'risk', title: 'Risk assessment', prompt: 'Public evidence.' }],
    apiKey: 'SYNTHETIC_GATEWAY_KEY',
    outputContract: 'PRIORITY_RISK_ASSESSMENT_V1',
  })
  assert.equal(requests.length, 1)
  assert.equal(result.sections[0].classification, 'STREAM_COMPLETED_WITH_ASSISTANT_CONTENT')
  assert.equal(result.sections[0].finish_reason, 'stop')
  assert.equal(result.sections[0].reasoning_present, true)
  assert.match((await artifactStore.readArtifact(result.assembled_artifact)).toString(), /3\. Risk/)
  assert.equal((await artifactStore.readArtifact(result.assembled_artifact)).toString().includes('not-persisted'), false)
})

test('connection and pre-first-token failures remain distinct and never auto-retry', async () => {
  let connectionCalls = 0
  const connection = await fixture({
    responseFactory: () => { connectionCalls += 1; throw new Error('synthetic connection failure') },
  })
  await assert.rejects(connection.adapter.analyzeSections({
    workOrderId: 'wo-connection', sections: [{ id: 'connection', title: 'connection', prompt: 'Synthetic.' }], apiKey: 'SYNTHETIC',
  }), (error) => error.code === 'KIMI_CONNECTION_FAILED' && error.metadata.classification === 'CONNECTION_FAILURE')
  assert.equal(connectionCalls, 1)

  const firstToken = await fixture({
    responseFactory: () => new Response(new ReadableStream({ start(controller) { controller.error(new Error('synthetic stream failure')) } }), { status: 200 }),
  })
  await assert.rejects(firstToken.adapter.analyzeSections({
    workOrderId: 'wo-first-token', sections: [{ id: 'first', title: 'first', prompt: 'Synthetic.' }], apiKey: 'SYNTHETIC',
  }), (error) => error.code === 'KIMI_FIRST_TOKEN_UNAVAILABLE' && error.metadata.classification === 'STREAM_FAILED_BEFORE_FIRST_ASSISTANT_TOKEN')
})

test('automatic model retries cannot be configured', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'operator-bridge-kimi-no-retry-'))
  const artifactStore = await new LocalArtifactStore({ root }).init()
  assert.throws(() => new KimiStreamingAdapter({ artifactStore, maxAttempts: 2 }), /Automatic Kimi retries are disabled/)
})

test('duplicate submission creates no duplicate final artifact', async () => {
  const { adapter } = await fixture({
    responseFactory: ({ signal }) => sseResponse(['stable'], { signal }),
  })
  const request = {
    workOrderId: 'wo-duplicate',
    sections: [{ id: 'stable', title: 'stable', prompt: 'Synthetic stable request' }],
    apiKey: 'SYNTHETIC_GATEWAY_KEY',
  }
  const first = await adapter.analyzeSections(request)
  const second = await adapter.analyzeSections(request)
  assert.equal(second.assembled_artifact.artifact_id, first.assembled_artifact.artifact_id)
  assert.equal(second.assembled_artifact.sha256, first.assembled_artifact.sha256)
})

test('gateway credential and secret-bearing errors never enter structural logs', async () => {
  const logEntries = []
  const logger = { info: (entry) => logEntries.push(JSON.stringify(entry)) }
  const { adapter } = await fixture({
    responseFactory: () => {
      throw new Error('SENSITIVE_GATEWAY_SECRET')
    },
    logger,
  })
  await assert.rejects(
    adapter.analyzeSections({
      workOrderId: 'wo-secret',
      sections: [{ id: 'secret', title: 'secret', prompt: 'Synthetic prompt' }],
      apiKey: 'SENSITIVE_GATEWAY_SECRET',
    }),
    (error) => !error.message.includes('SENSITIVE_GATEWAY_SECRET'),
  )
  assert.equal(logEntries.join('\n').includes('SENSITIVE_GATEWAY_SECRET'), false)
  assert.equal(logEntries.join('\n').includes('Synthetic prompt'), false)
})
