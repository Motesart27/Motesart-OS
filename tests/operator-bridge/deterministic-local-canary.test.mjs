import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildDeterministicCanaryReview,
  DETERMINISTIC_CANARY_MODEL,
} from '../../operator-bridge/deterministic-local-canary.mjs'

function collection(overrides = {}) {
  return {
    repository: 'Motesart27/Motesart-OS',
    pull_request: 27,
    base_sha: 'a'.repeat(40),
    head_sha: 'b'.repeat(40),
    state: 'open',
    draft: false,
    changed_file_count: 3,
    artifacts: [
      { artifact_type: 'diff', sha256: 'f'.repeat(64), byte_count: 120 },
      { artifact_type: 'pull_request_identity', sha256: '1'.repeat(64), byte_count: 80 },
      { artifact_type: 'repository_identity', sha256: '9'.repeat(64), byte_count: 64 },
    ],
    ...overrides,
  }
}

test('identical input yields byte-identical output — no clock, no randomness', () => {
  const first = buildDeterministicCanaryReview(collection())
  const second = buildDeterministicCanaryReview(collection())
  assert.equal(first, second)
})

test('artifact collection order can never change the output bytes', () => {
  const shuffled = collection()
  shuffled.artifacts = [shuffled.artifacts[2], shuffled.artifacts[0], shuffled.artifacts[1]]
  assert.equal(buildDeterministicCanaryReview(collection()), buildDeterministicCanaryReview(shuffled))
})

test('the review is zero model cost: building it performs no network access', async () => {
  const originalFetch = globalThis.fetch
  let networkCalls = 0
  globalThis.fetch = async () => {
    networkCalls += 1
    throw new Error('NETWORK_SHOULD_NOT_RUN')
  }
  try {
    const review = buildDeterministicCanaryReview(collection())
    assert.ok(review.length > 0)
    assert.equal(networkCalls, 0)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('the review carries the required advisory sections and the real metadata', () => {
  const review = buildDeterministicCanaryReview(collection())
  for (const section of ['VERIFIED', 'INFERRED', 'UNKNOWN', 'RISKS', 'NEXT SAFE ACTION']) {
    assert.ok(review.includes(section), `missing section ${section}`)
  }
  assert.ok(review.includes('Motesart27/Motesart-OS'))
  assert.ok(review.includes('a'.repeat(40)))
  assert.ok(review.includes('b'.repeat(40)))
  assert.ok(review.includes('zero model cost'))
  // Advisory only: the canary must never recommend consequential action.
  for (const forbidden of ['recommend merge', 'deploy now', 'auto-approve']) {
    assert.equal(review.toLowerCase().includes(forbidden), false)
  }
})

test('a collection missing identity fields is rejected', () => {
  assert.throws(() => buildDeterministicCanaryReview(null), /COLLECTION_REQUIRED/)
  for (const field of ['repository', 'pull_request', 'base_sha', 'head_sha', 'state']) {
    const broken = collection()
    delete broken[field]
    assert.throws(
      () => buildDeterministicCanaryReview(broken),
      new RegExp(`COLLECTION_FIELD_MISSING:${field}`),
    )
  }
})

test('the model label marks the artifact as deterministic and local', () => {
  assert.equal(DETERMINISTIC_CANARY_MODEL, 'deterministic-local-canary-v1')
})
