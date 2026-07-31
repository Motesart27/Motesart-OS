import assert from 'node:assert/strict'
import { mkdtemp, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { LocalArtifactStore } from '../../operator-bridge/artifact-store.mjs'

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'operator-bridge-artifacts-'))
  return { root, store: await new LocalArtifactStore({ root }).init() }
}

test('artifact contract records immutable URI, hash, byte count, provenance, and classification', async () => {
  const { store } = await fixture()
  const artifact = await store.putArtifact({
    workOrderId: 'wo-1',
    artifactType: 'diff',
    content: 'public diff',
    producingExecutor: 'orca-test',
    attempt: 1,
    sensitivity: 'public',
  })
  assert.match(artifact.sha256, /^[a-f0-9]{64}$/)
  assert.equal(artifact.byte_count, 11)
  assert.equal(artifact.source_work_order_attempt, 1)
  assert.equal(artifact.sensitivity_classification, 'public')
  assert.equal((await store.readArtifact(artifact)).toString(), 'public diff')
})

test('duplicate artifact submission reuses one immutable manifest', async () => {
  const { store } = await fixture()
  const request = {
    workOrderId: 'wo-1',
    artifactType: 'model_response',
    content: 'same response',
    producingExecutor: 'kimi-test',
    attempt: 1,
  }
  const first = await store.putArtifact(request)
  const second = await store.putArtifact(request)
  assert.deepEqual(second, first)
})

test('corrupted artifact content is rejected', async () => {
  const { root, store } = await fixture()
  const artifact = await store.putArtifact({
    workOrderId: 'wo-1',
    artifactType: 'source_snapshot',
    content: 'original',
    producingExecutor: 'github-test',
    attempt: 1,
  })
  await writeFile(path.join(root, artifact.immutable_relative_uri), 'corrupted')
  await assert.rejects(store.readArtifact(artifact), (error) => error.code === 'ARTIFACT_INTEGRITY_FAILURE')
})
