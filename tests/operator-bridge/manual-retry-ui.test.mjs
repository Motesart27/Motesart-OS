import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { StagingClient } from '../../src/operator-bridge-staging/api.js'
import { createManualRetryIdempotencyKey, isManualRetryEligible } from '../../src/operator-bridge-staging/manualRetry.js'

test('phone retry control visibility is governed only by server eligibility', () => {
  assert.equal(isManualRetryEligible({ status: 'BLOCKED', manual_retry_eligible: true }), true)
  assert.equal(isManualRetryEligible({ status: 'BLOCKED', manual_retry_eligible: false }), false)
  assert.equal(isManualRetryEligible({ status: 'QUEUED', manual_retry_eligible: false }), false)
  assert.match(createManualRetryIdempotencyKey('wo_staging_synthetic', () => 'synthetic-uuid'), /^manual-retry:wo_staging_synthetic:/)
})

test('phone retry client calls the same-ID endpoint and never submits a new work order', async (t) => {
  const originalFetch = globalThis.fetch
  const requests = []
  t.after(() => { globalThis.fetch = originalFetch })
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options, body: JSON.parse(options.body) })
    return new Response(JSON.stringify({ work_order: { work_order_id: 'wo_staging_existing', status: 'QUEUED' } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }
  const client = new StagingClient({ buildHead: 'e'.repeat(40) })
  client.token = 'SYNTHETIC_OWNER_JWT'
  const result = await client.manualRetry('wo_staging_existing', 'manual-retry:existing:unique')
  assert.equal(result.work_order.work_order_id, 'wo_staging_existing')
  assert.equal(requests.length, 1)
  assert.match(requests[0].url, /\/v1\/work-orders\/wo_staging_existing\/manual-retry$/)
  assert.equal(requests[0].options.method, 'POST')
  assert.deepEqual(requests[0].body, { idempotency_key: 'manual-retry:existing:unique' })
  assert.equal(requests[0].url.endsWith('/v1/work-orders'), false)
})

test('staging UI exposes one confirmed retry and keeps protected controls disabled', async () => {
  const source = await readFile(new URL('../../src/operator-bridge-staging/StagingOperatorBridgeApp.jsx', import.meta.url), 'utf8')
  assert.match(source, /Retry this work order once/)
  assert.match(source, /window\.confirm/)
  assert.match(source, /isManualRetryEligible\(order\)/)
  assert.match(source, /client\.manualRetry\(order\.work_order_id/)
  assert.match(source, /Approve — disabled/)
  assert.match(source, /Reject — disabled/)
  assert.match(source, /Revise — disabled/)
  const detailSource = source.slice(source.indexOf('function WorkDetail'), source.indexOf('export default function'))
  assert.equal(detailSource.includes('client.submit'), false)
})
