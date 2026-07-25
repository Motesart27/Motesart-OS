import assert from 'node:assert/strict'
import { mkdtemp } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { LocalArtifactStore } from '../../operator-bridge/artifact-store.mjs'
import { GitHubReadOnlyCollector, sanitizeUnifiedDiff } from '../../operator-bridge/github-collector.mjs'

test('GitHub collector uses typed read-only commands and hashes every result', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'operator-bridge-github-'))
  const artifactStore = await new LocalArtifactStore({ root }).init()
  const calls = []
  const runner = async (args) => {
    calls.push(args)
    const joined = args.join(' ')
    if (joined.startsWith('repo view')) {
      return { stdout: JSON.stringify({ nameWithOwner: 'Motesart27/repo', url: 'https://example.invalid/repo' }), exitCode: 0 }
    }
    if (joined.startsWith('pr view')) {
      return {
        stdout: JSON.stringify({
          number: 32,
          state: 'OPEN',
          isDraft: true,
          baseRefOid: 'a'.repeat(40),
          headRefOid: 'b'.repeat(40),
          files: [{ path: 'README.md' }],
          commits: [{ oid: 'b'.repeat(40) }],
        }),
        exitCode: 0,
      }
    }
    if (joined.startsWith('pr diff')) return { stdout: 'diff --git a/a b/a\n', exitCode: 0 }
    if (joined.startsWith('pr checks')) return { stdout: '[]', exitCode: 0 }
    if (joined.startsWith('api ')) return { stdout: '# selected file', exitCode: 0 }
    throw new Error('unexpected command')
  }
  const collector = new GitHubReadOnlyCollector({ artifactStore, runner })
  const result = await collector.collect({
    repository: 'Motesart27/repo',
    pullRequest: 32,
    selectedFiles: ['README.md'],
    workOrderId: 'wo-1',
    attempt: 1,
  })
  assert.equal(result.changed_file_count, 1)
  assert.match(result.diff_source_sha256, /^[a-f0-9]{64}$/)
  assert.equal(result.diff_redaction_count, 0)
  assert.equal(result.artifacts.length, 6)
  assert.ok(calls.every((args) => !['merge', 'comment', 'close', 'create'].some((word) => args.includes(word))))
  assert.ok(calls.filter((args) => args[0] === 'api').every((args) => args.at(-1) === 'GET'))
  for (const artifact of result.artifacts) await artifactStore.readArtifact(artifact)
})

test('diff collector hashes exact input but never persists a potential credential literal', () => {
  const sensitive = 'SENSITIVE_GITHUB_DIFF_SENTINEL'
  const raw = `diff --git a/auth.py b/auth.py\n-old_password = "${sensitive}"\n+new_password = os.environ["ADMIN_PASSWORD"]\n`
  const result = sanitizeUnifiedDiff(raw)
  assert.match(result.sourceSha256, /^[a-f0-9]{64}$/)
  assert.equal(result.redactionCount, 1)
  assert.equal(result.sanitized.includes(sensitive), false)
  assert.equal(result.sanitized.includes('[REDACTED_POTENTIAL_SECRET]'), true)
})

test('GitHub collector rejects malformed targets and path traversal before a command runs', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'operator-bridge-github-'))
  const artifactStore = await new LocalArtifactStore({ root }).init()
  let calls = 0
  const collector = new GitHubReadOnlyCollector({ artifactStore, runner: async () => { calls += 1 } })
  await assert.rejects(
    collector.collect({ repository: 'bad repo', pullRequest: 32, workOrderId: 'wo', attempt: 1 }),
    /Invalid GitHub repository/,
  )
  await assert.rejects(
    collector.collect({ repository: 'owner/repo', pullRequest: 32, selectedFiles: ['../secret'], workOrderId: 'wo', attempt: 1 }),
    /Invalid committed-file path/,
  )
  assert.equal(calls, 0)
})
