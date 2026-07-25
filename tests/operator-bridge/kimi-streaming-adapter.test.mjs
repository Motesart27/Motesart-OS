import assert from 'node:assert/strict'
import { mkdtemp } from 'node:fs/promises'
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
