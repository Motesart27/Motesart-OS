// Deterministic, zero-model-cost first-canary analyzer
// (MOS-ORCA-TRANSPORT-BINDING-C1-01). Produces the bounded status-review
// artifact for a first canary run as a pure function of the GitHub collection
// metadata: no model gateway, no credentials, no network, no clock, no
// randomness. Identical input always yields byte-identical output, so a
// canary run is reproducible and free.

export const DETERMINISTIC_CANARY_MODEL = 'deterministic-local-canary-v1'

export function buildDeterministicCanaryReview(collection) {
  if (!collection || typeof collection !== 'object') throw new Error('COLLECTION_REQUIRED')
  for (const field of ['repository', 'pull_request', 'base_sha', 'head_sha', 'state']) {
    if (collection[field] === undefined || collection[field] === null) {
      throw new Error(`COLLECTION_FIELD_MISSING:${field}`)
    }
  }
  // Sorted by content hash so artifact collection order can never change the
  // output bytes.
  const artifacts = [...(collection.artifacts ?? [])]
    .map((artifact) => ({ type: artifact.artifact_type, sha256: artifact.sha256, bytes: artifact.byte_count }))
    .sort((a, b) => (a.sha256 < b.sha256 ? -1 : a.sha256 > b.sha256 ? 1 : 0))
  return [
    'DETERMINISTIC LOCAL CANARY REVIEW (zero model cost)',
    '',
    'VERIFIED',
    `- Repository: ${collection.repository}`,
    `- Pull request: ${collection.pull_request}`,
    `- Base SHA: ${collection.base_sha}`,
    `- Head SHA: ${collection.head_sha}`,
    `- State: ${collection.state} (draft: ${collection.draft === true})`,
    `- Changed files: ${collection.changed_file_count ?? 0}`,
    `- Collected artifacts (sorted by sha256): ${JSON.stringify(artifacts)}`,
    '',
    'INFERRED',
    '- Nothing is inferred: this canary reports only collected metadata.',
    '',
    'UNKNOWN',
    '- Code-level quality, correctness, and security were not analyzed; no model was invoked.',
    '',
    'RISKS',
    '- This is a transport/loop canary only; it provides no review signal about the change itself.',
    '',
    'NEXT SAFE ACTION',
    '- Route the order through the full independent review pathway before any human decision.',
  ].join('\n')
}
