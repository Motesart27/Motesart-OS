import assert from 'node:assert/strict'
import test from 'node:test'

import { redactEvidenceValue, sanitizeUnifiedDiff } from '../../operator-bridge/redaction.mjs'

test('extended credential shapes are redacted from diffs', () => {
  // Synthetic fixtures are assembled from short fragments at runtime so that no
  // complete credential-shaped literal appears in source; runtime values are
  // byte-identical to the original dummy literals.
  const assemble = (...parts) => parts.join('')
  const cases = [
    ['github fine-grained PAT', '+const t = "' + assemble('github_pat_', '11ABCDEFG0', 'abcdefghijklmnopqrstuvwxyz', '0123456789ABCD') + '"'],
    ['GitLab PAT', '+token = "glpat-abcdefghijklmnopqrstuvwx"'],
    ['Slack token', '+const slack = "' + assemble('xoxb-', '123456789012-', 'abcdefghijkl') + '"'],
    ['Anthropic key', '+key = "' + assemble('sk-ant-', 'api03-', 'abcdefghijklmnopqrstuvwxyz', '0123456789') + '"'],
    ['JWT', '+const jwt = "eyJhbGciOiJIUzI1NiIs.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJVadQssw5c"'],
    ['npm token', '+//registry/:_authToken=npm_abcdefghijklmnopqrstuvwxyz0123456789'],
    ['Google API key', '+const g = "' + assemble('AIza', 'SyD4iE2xVSpkL0X3qFQa2yW', 'Jc7R1z8Z0AAA') + '"'],
  ]
  for (const [label, line] of cases) {
    const result = sanitizeUnifiedDiff(`diff --git a/a b/a\n${line}\n`)
    assert.equal(result.sanitized.includes(line.slice(1).trim().replace(/^const |^token = |^key = |^slack = |^jwt = |^g = /, '')), false, `${label} leaked`)
    assert.ok(result.redactionCount >= 1, `${label} not counted`)
  }
})

test('unquoted secret assignments are redacted', () => {
  const raw = 'diff --git a/a b/a\n+password = hunter2hunter2hunter2\n+const harmless = 42\n'
  const result = sanitizeUnifiedDiff(raw)
  assert.equal(result.sanitized.includes('hunter2hunter2hunter2'), false)
  assert.ok(result.sanitized.includes('+const harmless = 42'))
  assert.equal(result.redactionCount, 1)
})

test('private key blocks are redacted across line boundaries', () => {
  const raw = [
    'diff --git a/key.pem b/key.pem',
    '+-----BEGIN OPENSSH PRIVATE KEY-----',
    '+b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMw',
    '+AAAAtzc2gtZWQyNTUxOQAAACBScmVhbGx5U2VjcmV0S2V5Q29udGVudA==',
    '+-----END OPENSSH PRIVATE KEY-----',
  ].join('\n')
  const result = sanitizeUnifiedDiff(raw)
  assert.equal(result.sanitized.includes('cmVhbGx5U2VjcmV0S2V5Q29udGVudA'), false)
  assert.ok(result.redactionCount >= 1)
  assert.match(result.sourceSha256, /^[a-f0-9]{64}$/)
})

test('existing redaction behavior is preserved', () => {
  const sensitive = 'SENSITIVE_GITHUB_DIFF_SENTINEL'
  const raw = `diff --git a/auth.py b/auth.py\n-old_password = "${sensitive}"\n+new_password = os.environ["ADMIN_PASSWORD"]\n`
  const result = sanitizeUnifiedDiff(raw)
  assert.match(result.sourceSha256, /^[a-f0-9]{64}$/)
  assert.equal(result.redactionCount, 1)
  assert.equal(result.sanitized.includes(sensitive), false)
  assert.equal(result.sanitized.includes('[REDACTED_POTENTIAL_SECRET]'), true)
})

test('evidence scrubber removes sensitive fields recursively', () => {
  const dirty = {
    work_order_id: 'wo-1',
    lease_token: 'RAW_LEASE_TOKEN_VALUE',
    nested: {
      apiKey: 'RAW_API_KEY_VALUE',
      session: { session_key: 'RAW_SESSION_KEY', attempts: 2 },
      list: [{ authorization: 'Bearer RAW_BEARER_TOKEN_1234567890' }, { ok: true }],
    },
    note: 'no secrets here',
    bearer_in_string: 'used Bearer abcdef1234567890abcd inline',
  }
  const { value, redactionCount } = redactEvidenceValue(dirty)
  const text = JSON.stringify(value)
  assert.equal(text.includes('RAW_LEASE_TOKEN_VALUE'), false)
  assert.equal(text.includes('RAW_API_KEY_VALUE'), false)
  assert.equal(text.includes('RAW_SESSION_KEY'), false)
  assert.equal(text.includes('RAW_BEARER_TOKEN_1234567890'), false)
  assert.equal(text.includes('abcdef1234567890abcd'), false)
  assert.equal(value.work_order_id, 'wo-1')
  assert.equal(value.nested.session.attempts, 2)
  assert.equal(value.nested.list[1].ok, true)
  assert.equal(value.note, 'no secrets here')
  assert.ok(redactionCount >= 5)
  // Original object is not mutated.
  assert.equal(dirty.lease_token, 'RAW_LEASE_TOKEN_VALUE')
})
